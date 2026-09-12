import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingStore } from '../services/bookingStore.js';
const project = { u: 'owner', p: 'appointments' };
const key = 'a'.repeat(64), other = 'b'.repeat(64);
const input = { service: 's1', date: '2030-01-02', slot: '10:00', customer: 'عميل', phone: '+31123456', requestId: '12345678-1234-1234-1234-123456789012' };
function database() {
    const docs = new Map();
    return {
        async findOne({ _id }) { return structuredClone(docs.get(_id)); },
        async insertOne(doc) { if (docs.has(doc._id)) throw Object.assign(Error(), { code: 11000 }); docs.set(doc._id, structuredClone(doc)); },
        async updateOne(query, update) {
            const doc = docs.get(query._id);
            if (doc.revision !== query.revision) return { modifiedCount: 0 };
            docs.set(query._id, { ...doc, ...structuredClone(update.$set), revision: doc.revision + update.$inc.revision });
            return { modifiedCount: 1 };
        },
    };
}
const service = () => bookingStore(database(), { now: () => Date.parse('2030-01-01T00:00:00Z') });
test('concurrent customers cannot reserve one slot; availability contains no customer data', async () => {
    const s = service();
    const results = await Promise.allSettled([s.create(project, key, input), s.create(project, other, input)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SLOT_TAKEN');
    const availability = await s.availability(project);
    assert.deepEqual(availability.taken, [{ date: input.date, slot: input.slot }]);
    assert.equal(JSON.stringify(availability).includes(input.customer), false);
});
test('retry is idempotent, ownership isolates reads/cancels and cancellation frees slot', async () => {
    const s = service();
    const [a, b] = await Promise.all([s.create(project, key, input), s.create(project, key, input)]);
    assert.equal(a.id, b.id);
    assert.deepEqual(await s.list(project, other), []);
    assert.deepEqual(await s.list({ ...project, p: 'other' }, key), []);
    await assert.rejects(s.cancel(project, other, a.id), { code: 'BOOKING_NOT_FOUND' });
    await assert.rejects(s.create(project, key, { ...input, customer: 'changed' }), { code: 'REQUEST_ID_REUSED' });
    await s.cancel(project, key, a.id);
    assert.equal((await s.availability(project)).taken.length, 0);
    assert.equal((await s.create(project, other, input)).status, 'مؤكّد');
});
test('server controls prices and validates inputs; database errors never become success', async () => {
    const s = service();
    await assert.rejects(s.create(project, key, { ...input, service: 'unknown' }), { code: 'INVALID_BOOKING' });
    await assert.rejects(s.create(project, key, { ...input, date: '2000-01-01' }), { code: 'INVALID_SLOT' });
    const result = await s.create(project, key, { ...input, price: 0, status: 'paid' });
    assert.equal(result.price, 80);
    assert.equal('customerHash' in result, false);
    assert.equal('requestHash' in result, false);
    const unavailable = bookingStore({ async findOne() { throw Error('offline'); } });
    await assert.rejects(unavailable.availability(project), /offline/);
});

test('real Mongo prevents concurrent double booking', { skip: !process.env.TEST_TRANSACTION_MONGO_URI }, async () => {
    const { default: mongoose } = await import('mongoose');
    const { randomUUID } = await import('node:crypto');
    const uri = process.env.TEST_TRANSACTION_MONGO_URI;
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(uri)) throw Error('Local test database only');
    const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const collection = client.db('jaola_transaction_tests').collection('booking_' + randomUUID().replaceAll('-', ''));
    try {
        const s = bookingStore(collection, { now: () => Date.parse('2030-01-01T00:00:00Z') });
        const results = await Promise.allSettled([s.create(project, key, input), s.create(project, other, input)]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        await s.cancel(project, null, results.find(r => r.status === 'fulfilled').value.id, true);
        assert.equal((await s.availability(project)).taken.length, 0);
    } finally { await collection.drop().catch(() => {}); await client.close(); }
});
