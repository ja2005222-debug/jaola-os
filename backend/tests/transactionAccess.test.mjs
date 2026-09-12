import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { transactionAccess } from '../services/transactionAccess.js';
import { projectTransactions } from '../services/projectTransactions.js';

const rows = JSON.stringify([
    { id: 'a', eid: 'employee-a', status: 'pending', reason: 'first' },
    { id: 'b', eid: 'employee-b', status: 'pending', reason: 'private' },
]);
const rules = {
    leaves: { read: true, write: true, scope: 'own', ownerField: 'eid', fields: ['reason'], delete: false },
    catalog: { read: true, write: false },
};
const alice = () => transactionAccess({ id: 'account-a', recordId: 'employee-a' }, rules);
test('snapshot reveals only authorized resources and own records', () => {
    const result = alice().snapshot({ leaves: rows, payroll: 'secret', catalog: '[]' });
    assert.deepEqual(Object.keys(result).sort(), ['catalog', 'leaves']);
    assert.deepEqual(JSON.parse(result.leaves).map(row => row.id), ['a']);
});
test('own-record update preserves hidden records and prevents ownership/approval escalation', () => {
    const access = alice();
    const own = JSON.parse(access.snapshot({ leaves: rows }).leaves);
    own[0].reason = 'updated';
    const result = JSON.parse(access.changes({ leaves: rows }, { leaves: JSON.stringify(own) }).leaves);
    assert.equal(result.find(row => row.id === 'b').reason, 'private');
    assert.equal(result.find(row => row.id === 'a').reason, 'updated');
    for (const next of [[], [{ ...own[0], eid: 'employee-b' }], [{ ...own[0], status: 'approved' }], [{ ...own[0], id: 'b' }], [own[0], own[0]]]) {
        assert.throws(() => access.changes({ leaves: rows }, { leaves: JSON.stringify(next) }), { code: 'ACCESS_DENIED' });
    }
    assert.throws(() => access.changes({ leaves: rows }, { leaves: null }), { code: 'ACCESS_DENIED' });
    assert.throws(() => access.changes({ leaves: rows }, { catalog: '[]' }), { code: 'ACCESS_DENIED' });
});
test('record binding is mandatory and cannot be supplied through the transaction body', () => {
    const access = transactionAccess({ id: 'unassigned' }, rules);
    assert.throws(() => access.snapshot({ leaves: rows }), { code: 'ACCESS_DENIED' });
    assert.throws(() => access.changes({}, { leaves: JSON.stringify([{ id: 'x', eid: 'employee-a' }]) }), { code: 'ACCESS_DENIED' });
});
test('object field grants cannot alter unrelated configuration', () => {
    const access = transactionAccess({ id: 'staff' }, { settings: { read: true, write: true, fields: ['counter'] } });
    assert.deepEqual(access.changes({ settings: '{"name":"original","counter":1}' }, { settings: '{"name":"original","counter":2}' }), { settings: '{"name":"original","counter":2}' });
    assert.throws(() => access.changes({ settings: '{"name":"original"}' }, { settings: '{"name":"changed"}' }), { code: 'ACCESS_DENIED' });
});
test('transaction CAS and idempotency retain actor isolation and atomic authorization', async () => {
    let doc;
    const collection = {
        async findOne() { return structuredClone(doc || null); },
        async insertOne(value) { doc = structuredClone(value); },
        async updateOne(query, update) {
            if (query.revision !== doc.revision) return { modifiedCount: 0 };
            doc = { ...doc, ...structuredClone(update.$set) }; return { modifiedCount: 1 };
        },
    };
    const store = projectTransactions(collection, { importLegacy: async () => ({ leaves: rows, payroll: '[]' }) });
    const access = alice();
    const snapshot = await store.snapshot('owner', 'project', access);
    const own = JSON.parse(snapshot.data.leaves); own[0].reason = 'updated';
    const request = { revision: 0, id: randomUUID(), changes: { leaves: JSON.stringify(own), payroll: '[1]' } };
    await assert.rejects(store.commit('owner', 'project', request, access), { code: 'ACCESS_DENIED' });
    assert.equal(doc.revision, 0);
    delete request.changes.payroll;
    await store.commit('owner', 'project', request, access);
    assert.equal((await store.commit('owner', 'project', request, access)).replayed, true);
    const other = transactionAccess({ id: 'account-b', recordId: 'employee-b' }, rules);
    await assert.rejects(store.commit('owner', 'project', request, other), { code: 'REQUEST_ID_REUSED' });
    assert.equal(JSON.parse((await store.snapshot('owner', 'project', other)).data.leaves)[0].reason, 'private');
});
