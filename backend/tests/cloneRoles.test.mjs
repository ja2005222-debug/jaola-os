import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloneRoleOptions, resolveCloneRole, cloneRoleBinding } from '../services/cloneRoles.js';
import { templateDefaults } from '../services/templateDefaults.js';
import { transactionAccess } from '../services/transactionAccess.js';
import { listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
for (const meta of listClones()) {
    const clone = getCloneById(meta.id);
    if (clone.track !== 'system') continue;
    test(`${clone.id}: every declared role has a fail-closed server data policy`, async () => {
        const options = cloneRoleOptions(clone.id);
        assert.equal(options.length, meta.roles.length);
        const seed = await templateDefaults(clone.files.find(file => file.name === 'app.js').content);
        assert.equal(seed.ready, true);
        for (const option of options) {
            const binding = cloneRoleBinding(clone.id);
            const recordId = option.requiresRecord ? JSON.parse(seed.data[binding.key])[0].id : '';
            const policy = resolveCloneRole(clone.id, option.id, recordId);
            assert.ok(policy, option.id);
            const access = transactionAccess({ id: 'account', recordId }, policy.rules);
            const view = access.snapshot(seed.data);
            for (const [key, value] of Object.entries(view)) {
                assert.equal(policy.rules[key].read, true);
                if (policy.rules[key].scope === 'own') assert.ok(JSON.parse(value).every(row => row[policy.rules[key].ownerField] === recordId));
                if (policy.rules[key].readFields) assert.ok(JSON.parse(value).every(row => Object.keys(row).every(field => policy.rules[key].readFields.includes(field))));
                if (!policy.rules[key].write) assert.throws(() => access.changes(seed.data, { [key]: value }), { code: 'ACCESS_DENIED' });
            }
            assert.throws(() => access.changes(seed.data, { other_project_data: '[]' }), { code: 'ACCESS_DENIED' });
            if (option.requiresRecord) assert.equal(resolveCloneRole(clone.id, option.id), null);
        }
    });
}
test('cashier cannot change catalog or branding; kitchen cannot rewrite ticket content', () => {
    const cashier = transactionAccess({ id: 'cashier' }, resolveCloneRole('jaola-pos', 'cashier').rules);
    assert.throws(() => cashier.changes({ jpos_products: '[]' }, { jpos_products: '[{"id":"fake","price":0}]' }), { code: 'ACCESS_DENIED' });
    assert.throws(() => cashier.changes({ jpos_settings: '{"name":"original","receiptSeq":1}' }, { jpos_settings: '{"name":"forged","receiptSeq":2}' }), { code: 'ACCESS_DENIED' });
    const kitchen = transactionAccess({ id: 'cook' }, resolveCloneRole('jaola-restaurant-ops', 'kitchen').rules);
    const ticket = { id: 't1', table: 1, items: [{ name: 'وجبة', qty: 1 }], stage: 'new' };
    const data = { jrest_tickets: JSON.stringify([ticket]) };
    assert.doesNotThrow(() => kitchen.changes(data, { jrest_tickets: JSON.stringify([{ ...ticket, stage: 'preparing' }]) }));
    assert.throws(() => kitchen.changes(data, { jrest_tickets: JSON.stringify([{ ...ticket, table: 9 }]) }), { code: 'ACCESS_DENIED' });
});
test('financial clinic role excludes diagnosis and patient notes', () => {
    const access = transactionAccess({ id: 'accountant' }, resolveCloneRole('jaola-clinic', 'accountant').rules);
    const view = access.snapshot({ jclin_patients: '[{"id":"p1","name":"عميل","note":"private-note"}]', jclin_visits: '[{"id":"v1","pid":"p1","fee":10,"diagnosis":"private-diagnosis"}]' });
    assert.equal(JSON.stringify(view).includes('private-'), false);
});
test('unknown and prototype-like role names never gain access', () => {
    for (const clone of ['unknown', 'constructor', '__proto__']) {
        assert.deepEqual(cloneRoleOptions(clone), []);
        assert.equal(resolveCloneRole(clone, 'manager'), null);
    }
    assert.equal(resolveCloneRole('jaola-pos', '__proto__'), null);
});
