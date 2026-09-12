import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { projectMembers } from '../services/projectMembers.js';
import { resolveCloneRole } from '../services/cloneRoles.js';

function setup() {
    const records = new Map();
    let ownerVersion = 'first';
    let projectInstance = 'instance-one';
    const collection = {
        async findOne({ _id }) { return structuredClone(records.get(_id) || null); },
        async updateOne({ _id }, { $set }, options = {}) {
            if (!records.has(_id) && !options.upsert) return { modifiedCount: 0 };
            records.set(_id, { _id, ...records.get(_id), ...structuredClone($set) }); return { modifiedCount: 1 };
        },
        find({ user, project }) {
            return { limit() { return { async toArray() { return [...records.values()].filter(row => row.user === user && row.project === project); } }; } };
        },
    };
    const store = projectMembers(collection, { secret: randomUUID(), ownerVersion: async () => ownerVersion, projectInstance: async () => projectInstance,
        resolvePolicy: (clone, role, recordId) => clone === 'hr' && role === 'employee' && recordId
            ? { uiRole: 'employee', rules: { attendance: { read: true, write: true, scope: 'own', ownerField: 'eid' } } } : null });
    return { store, records, reset: () => { ownerVersion = randomUUID(); }, recreate: () => { projectInstance = randomUUID(); } };
}
test('account authentication uses stored role, project binding and per-account row scope', async () => {
    const { store, records } = setup();
    const password = randomUUID();
    const saved = await store.save('owner', 'project', 'hr', { account: 'موظف', password, role: 'employee', recordId: 'e1' });
    assert.deepEqual(saved, { account: 'موظف', role: 'employee', recordId: 'e1', active: true });
    assert.notEqual([...records.values()][0].hash, password);
    assert.equal(await store.login('owner', 'project', 'hr', { account: 'موظف', password: randomUUID() }), null);
    assert.equal(await store.login('other', 'project', 'hr', { account: 'موظف', password }), null);
    const login = await store.login('owner', 'project', 'hr', { account: 'موظف', password, role: 'manager', recordId: 'e2' });
    assert.equal(login.role, 'employee');
    const session = await store.resolveSession(login.session, 'owner', 'project', 'hr');
    assert.equal(session.role, 'project-member');
    const data = session.access.snapshot({ attendance: JSON.stringify([{ id: 'a', eid: 'e1' }, { id: 'b', eid: 'e2' }]) });
    assert.deepEqual(JSON.parse(data.attendance).map(row => row.id), ['a']);
    assert.equal(await store.resolveSession(login.session, 'owner', 'other', 'hr'), null);
    assert.equal(await store.resolveSession(login.session, 'owner', 'project', 'another-clone'), null);
    assert.equal(JSON.stringify(await store.list('owner', 'project')).includes('hash'), false);
    assert.deepEqual(await store.list('another-owner', 'project'), []);
});
test('password changes, account revocation and owner credential reset invalidate sessions', async () => {
    const { store, reset } = setup();
    const input = { account: 'staff', password: randomUUID(), role: 'employee', recordId: 'e1' };
    await store.save('owner', 'project', 'hr', input);
    const first = await store.login('owner', 'project', 'hr', input);
    await store.save('owner', 'project', 'hr', { ...input, password: randomUUID() });
    assert.equal(await store.resolveSession(first.session, 'owner', 'project', 'hr'), null);
    assert.equal(await store.login('owner', 'project', 'hr', input), null);
    await store.save('owner', 'project', 'hr', input);
    const second = await store.login('owner', 'project', 'hr', input);
    reset();
    assert.equal(await store.resolveSession(second.session, 'owner', 'project', 'hr'), null);
    const third = await store.login('owner', 'project', 'hr', input);
    await store.revoke('owner', 'project', 'staff');
    assert.equal(await store.resolveSession(third.session, 'owner', 'project', 'hr'), null);
    assert.equal(await store.login('owner', 'project', 'hr', input), null);
});
test('unavailable roles, missing record binding and invalid passwords never create accounts', async () => {
    const { store, records } = setup();
    const input = { account: 'staff', password: randomUUID(), role: 'employee', recordId: 'e1' };
    for (const change of [{ role: 'manager' }, { recordId: '' }, { password: 'short' }, { password: 'ع'.repeat(40) }, { account: '../escape' }]) {
        await assert.rejects(store.save('owner', 'project', 'hr', { ...input, ...change }));
    }
    assert.equal(records.size, 0);
});

test('recreated project with the same name does not inherit old team accounts', async () => {
    const { store, recreate } = setup();
    const input = { account: 'staff', password: randomUUID(), role: 'employee', recordId: 'e1' };
    await store.save('owner', 'project', 'hr', input);
    const login = await store.login('owner', 'project', 'hr', input);
    recreate();
    assert.equal(await store.resolveSession(login.session, 'owner', 'project', 'hr'), null);
    assert.equal(await store.login('owner', 'project', 'hr', input), null);
    assert.deepEqual(await store.list('owner', 'project'), []);
});

test('real Mongo persists account grants across service restart and revokes active sessions', { skip: !process.env.TEST_TRANSACTION_MONGO_URI }, async () => {
    const uri = process.env.TEST_TRANSACTION_MONGO_URI;
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(uri)) throw Error('Only a local test database is allowed');
    const { default: mongoose } = await import('mongoose');
    const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const collection = client.db('jaola_transaction_tests').collection('members_' + randomUUID().replaceAll('-', ''));
    const options = { secret: randomUUID(), ownerVersion: async () => 'owner-version', projectInstance: async () => 'project-instance', resolvePolicy: resolveCloneRole };
    try {
        const first = projectMembers(collection, options);
        const input = { account: 'موظف', password: randomUUID(), role: 'employee', recordId: 'e1' };
        await first.save('owner', 'hr', 'jaola-hr', input);
        const restarted = projectMembers(collection, options);
        const login = await restarted.login('owner', 'hr', 'jaola-hr', { ...input, role: 'manager' });
        assert.equal(login.role, 'employee');
        assert.equal((await restarted.list('owner', 'hr')).length, 1);
        assert.deepEqual(await restarted.list('other-owner', 'hr'), []);
        assert.equal(await restarted.resolveSession(login.session, 'other-owner', 'hr', 'jaola-hr'), null);
        assert.equal((await restarted.resolveSession(login.session, 'owner', 'hr', 'jaola-hr')).uiRole, 'employee');
        await first.revoke('owner', 'hr', input.account);
        assert.equal(await restarted.resolveSession(login.session, 'owner', 'hr', 'jaola-hr'), null);
    } finally { await collection.drop().catch(() => {}); await client.close(); }
});
