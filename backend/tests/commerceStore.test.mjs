import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { commerceStore } from '../services/commerceStore.js';
const identity = { u: 'merchant', p: 'shop' }, key = 'a'.repeat(64), other = 'b'.repeat(64);
function memoryCollection() {
    const docs = new Map();
    return {
        async findOne({ _id }) { return structuredClone(docs.get(_id)); },
        async insertOne(doc) { if (docs.has(doc._id)) throw Object.assign(Error(), { code: 11000 }); docs.set(doc._id, structuredClone(doc)); },
        async updateOne(query, update) {
            const doc = docs.get(query._id); if (!doc || doc.revision !== query.revision) return { modifiedCount: 0 };
            docs.set(query._id, { ...doc, ...structuredClone(update.$set), revision: doc.revision + update.$inc.revision }); return { modifiedCount: 1 };
        },
    };
}
const order = (qty = 1) => ({ requestId: randomUUID(), customer: 'عميل', phone: '+31123456', address: 'عنوان العميل', items: [{ id: 'p1', qty, price: 249 }] });
async function contract(collection) {
    const s = commerceStore(collection);
    const results = await Promise.allSettled([s.checkout(identity, key, order(10)), s.checkout(identity, other, order(10))]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'OUT_OF_STOCK');
    assert.equal((await s.catalog(identity)).find(p => p.id === 'p1').stock, 2);
    const winner = results.find(r => r.status === 'fulfilled').value;
    await s.transition(identity, null, { id: winner.id, expectedStatus: 'جديد', status: 'ملغي' }, true);
    await s.transition(identity, null, { id: winner.id, expectedStatus: 'جديد', status: 'ملغي' }, true);
    assert.equal((await s.catalog(identity)).find(p => p.id === 'p1').stock, 12);
}
test('atomic checkout never oversells; repeat cancellation restores stock once', () => contract(memoryCollection()));
test('prices, duplicate requests, tenant ownership and forward-only order states', async () => {
    const s = commerceStore(memoryCollection());
    const request = order();
    await assert.rejects(s.checkout(identity, key, { ...request, items: [{ id: 'p1', qty: 1, price: 1 }] }), { code: 'PRICE_CHANGED' });
    const [a, b] = await Promise.all([s.checkout(identity, key, request), s.checkout(identity, key, request)]);
    assert.equal(a.id, b.id);
    assert.equal((await s.catalog(identity)).find(p => p.id === 'p1').stock, 11);
    assert.deepEqual(await s.mine(identity, other), []);
    assert.deepEqual(await s.mine({ ...identity, p: 'other' }, key), []);
    await assert.rejects(s.transition(identity, other, { id: a.id, expectedStatus: 'جديد', status: 'ملغي' }), { code: 'ORDER_NOT_FOUND' });
    await assert.rejects(s.transition(identity, key, { id: a.id, expectedStatus: 'جديد', status: 'مكتمل' }), { code: 'INVALID_TRANSITION' });
    await s.transition(identity, null, { id: a.id, expectedStatus: 'جديد', status: 'قيد التجهيز' }, true);
    await assert.rejects(s.transition(identity, key, { id: a.id, expectedStatus: 'قيد التجهيز', status: 'ملغي' }), { code: 'INVALID_TRANSITION' });
    assert.equal(a.payment, 'cash_on_delivery');
    assert.equal('customerHash' in a, false);
});
test('catalog writes require fresh revisions and validate stock', async () => {
    const s = commerceStore(memoryCollection()), current = await s.admin(identity);
    await assert.rejects(s.product(identity, { revision: current.revision, product: { name: 'bad', cat: 'test', price: 10, stock: -1 } }), { code: 'INVALID_PRODUCT' });
    await s.checkout(identity, key, order());
    await assert.rejects(s.product(identity, { revision: current.revision, id: 'p1', remove: true }), { code: 'STORE_CONFLICT' });
});
test('real Mongo commerce stock/order atomicity', { skip: !process.env.TEST_TRANSACTION_MONGO_URI }, async () => {
    const { default: mongoose } = await import('mongoose');
    const uri = process.env.TEST_TRANSACTION_MONGO_URI;
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(uri)) throw Error('Local database only');
    const client = new mongoose.mongo.MongoClient(uri); await client.connect();
    const collection = client.db('jaola_transaction_tests').collection('commerce_' + randomUUID().replaceAll('-', ''));
    try { await contract(collection); } finally { await collection.drop().catch(() => {}); await client.close(); }
});
