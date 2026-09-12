import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { projectTransactions } from '../services/projectTransactions.js';

function memoryCollection() {
    const docs = new Map();
    return {
        async findOne({ _id }) { return structuredClone(docs.get(_id) || null); },
        async insertOne(doc) { if (docs.has(doc._id)) throw Object.assign(new Error('duplicate'), { code: 11000 }); docs.set(doc._id, structuredClone(doc)); },
        async updateOne(filter, update) {
            const doc = docs.get(filter._id);
            if (!doc || doc.revision !== filter.revision) return { modifiedCount: 0 };
            docs.set(doc._id, structuredClone({ ...doc, ...update.$set }));
            return { modifiedCount: 1 };
        },
    };
}
async function contract(collection) {
    const store = projectTransactions(collection, { importLegacy: async () => ({ items: '[5]', history: '[]' }) });
    const a = await store.snapshot('alice', 'shop');
    assert.equal(a.revision, 0);
    const request = { revision: 0, id: randomUUID(), changes: { items: '[3]', history: '["sale"]', settings: '{"sequence":2}' } };
    const results = await Promise.allSettled([store.commit('alice', 'shop', request), store.commit('alice', 'shop', { ...request, id: randomUUID(), changes: { items: '[1]' } })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    const saved = await store.snapshot('alice', 'shop');
    assert.equal(saved.revision, 1);
    // Whichever request wins, no partial mixture is accepted.
    if (saved.data.items === '[3]') {
        assert.equal(saved.data.history, '["sale"]');
        assert.equal(saved.data.settings, '{"sequence":2}');
        const replay = await store.commit('alice', 'shop', request);
        assert.equal(replay.replayed, true);
        await assert.rejects(store.commit('alice', 'shop', { ...request, changes: { items: '[0]' } }), { code: 'REQUEST_ID_REUSED' });
    } else { assert.equal(saved.data.history, '[]'); assert.equal(saved.data.settings, undefined); }
    assert.equal((await store.snapshot('bob', 'shop')).revision, 0);
    const before = await store.snapshot('alice', 'shop');
    await assert.rejects(store.commit('alice', 'shop', { revision: 1, id: randomUUID(), changes: { items: 'safe', invalid: 42 } }));
    assert.deepEqual(await store.snapshot('alice', 'shop'), before);
    await store.commit('alice', 'shop', { revision: 1, id: randomUUID(), changes: { history: null } });
    assert.equal((await store.snapshot('alice', 'shop')).data.history, undefined);
}
test('transaction contract: atomic multi-key updates, conflicts, replay, validation and isolation', async () => contract(memoryCollection()));
test('concurrent identical retries commit exactly once', async () => {
    const store = projectTransactions(memoryCollection());
    await store.snapshot('u', 'p');
    const request = { revision: 0, id: randomUUID(), changes: { value: '1' } };
    const result = await Promise.all([store.commit('u', 'p', request), store.commit('u', 'p', request)]);
    assert.equal((await store.snapshot('u', 'p')).revision, 1);
    assert.equal(result.filter(r => r.replayed).length, 1);
});
test('unavailable database and corrupt legacy data never return successful commits', async () => {
    const store = projectTransactions({ findOne: async () => { throw Error('offline'); } });
    await assert.rejects(store.snapshot('u', 'p'), /offline/);
    const broken = projectTransactions(memoryCollection(), { importLegacy: async () => { throw Error('corrupt'); } });
    await assert.rejects(broken.commit('u', 'p', { revision: 0, id: randomUUID(), changes: { x: 'y' } }), /corrupt/);
});
test('real Mongo transaction contract', { skip: !process.env.TEST_TRANSACTION_MONGO_URI }, async () => {
    const { default: mongoose } = await import('mongoose');
    const uri = process.env.TEST_TRANSACTION_MONGO_URI;
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(uri)) throw Error('Only a local test database is allowed');
    const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const collection = client.db('jaola_transaction_tests').collection('run_' + randomUUID().replaceAll('-', ''));
    try { await contract(collection); }
    finally { await collection.drop().catch(() => {}); await client.close(); }
});

test('legacy import is one-time and cannot reintroduce deleted data or session flags', async () => {
    let imports = 0;
    const store = projectTransactions(memoryCollection(), { importLegacy: async () => { imports++; return { items: '[1]', user_session: 'admin' }; } });
    assert.deepEqual((await store.snapshot('u', 'p')).data, { items: '[1]' });
    await store.commit('u', 'p', { revision: 0, id: randomUUID(), changes: { items: null } });
    assert.deepEqual((await store.snapshot('u', 'p')).data, {});
    assert.equal(imports, 1);
});

test('invalid keys and oversized values cannot partially change a project', async () => {
    const store = projectTransactions(memoryCollection());
    for (const changes of [{ valid: 'ok', constructor: 'bad' }, { valid: 'ok', user_session: 'bad' }, { valid: 'ok', huge: 'x'.repeat(512 * 1024 + 1) }]) {
        await assert.rejects(store.commit('u', 'p', { revision: 0, id: randomUUID(), changes }));
        assert.deepEqual(await store.snapshot('u', 'p'), { revision: 0, data: {} });
    }
});
