import { createHash, randomUUID } from 'node:crypto';

export const BOOKING_SERVICES = [
    { id: 's1', name: 'قصّ وتصفيف', emoji: '💇', dur: 45, price: 80 },
    { id: 's2', name: 'حلاقة ذقن', emoji: '🧔', dur: 30, price: 50 },
    { id: 's3', name: 'استشارة طبية', emoji: '🩺', dur: 30, price: 150 },
    { id: 's4', name: 'جلسة تدليك', emoji: '💆', dur: 60, price: 200 },
];
export const BOOKING_SLOTS = ['10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'];
const options = { writeConcern: { w: 'majority' }, maxTimeMS: 5000 };
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const hash = value => createHash('sha256').update(value).digest('hex');
export function customerHash(key) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) fail(401, 'CUSTOMER_KEY_REQUIRED');
    return hash(key);
}
export function bookingDays(now = Date.now()) {
    return Array.from({ length: 7 }, (_, i) => new Date(now + i * 86400000).toISOString().slice(0, 10));
}
const publicBooking = ({ customerHash: ignored, requestHash, requestId, ...booking }) => booking;

/** One project document, revision CAS: booking/cancellation and retry receipt change together. */
export function bookingStore(collection, { now = Date.now } = {}) {
    async function read(identity) {
        const _id = JSON.stringify([identity.u, identity.p]);
        let doc = await collection.findOne({ _id }, { maxTimeMS: 5000 });
        if (!doc) {
            try { await collection.insertOne({ _id, revision: 0, bookings: [] }, options); }
            catch (e) { if (e.code !== 11000) throw e; }
            doc = await collection.findOne({ _id }, { maxTimeMS: 5000 });
        }
        if (!doc) fail(503, 'BOOKING_UNAVAILABLE');
        return doc;
    }
    async function mutate(identity, operation) {
        for (let attempt = 0; attempt < 10; attempt++) {
            const doc = await read(identity);
            const result = operation(doc.bookings);
            if (!result.bookings) return result.value;
            const write = await collection.updateOne({ _id: doc._id, revision: doc.revision }, {
                $set: { bookings: result.bookings }, $inc: { revision: 1 },
            }, options);
            if (write.modifiedCount === 1) return result.value;
        }
        fail(409, 'BOOKING_RETRY');
    }
    return {
        async availability(identity) {
            const doc = await read(identity);
            const days = bookingDays(now());
            return { timezone: 'UTC', days, services: BOOKING_SERVICES, slots: BOOKING_SLOTS,
                taken: doc.bookings.filter(b => days.includes(b.date) && b.status === 'مؤكّد').map(b => ({ date: b.date, slot: b.slot })) };
        },
        async list(identity, key, admin = false) {
            const owner = admin ? null : customerHash(key);
            return (await read(identity)).bookings.filter(b => admin || b.customerHash === owner).map(publicBooking);
        },
        async create(identity, key, input) {
            const owner = customerHash(key);
            const { service, date, slot, customer, phone, requestId } = input || {};
            const selected = BOOKING_SERVICES.find(s => s.id === service);
            if (!selected || typeof customer !== 'string' || !customer.trim() || customer.length > 100 || typeof phone !== 'string' || phone.length > 40 || !/^[0-9+() -]{5,40}$/.test(phone) || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) fail(400, 'INVALID_BOOKING');
            if (!bookingDays(now()).includes(date) || !BOOKING_SLOTS.includes(slot)) fail(400, 'INVALID_SLOT');
            const digest = hash(JSON.stringify([service, date, slot, customer.trim(), phone]));
            return mutate(identity, bookings => {
                const prior = bookings.find(b => b.customerHash === owner && b.requestId === requestId);
                if (prior) {
                    if (prior.requestHash !== digest) fail(409, 'REQUEST_ID_REUSED');
                    return { value: publicBooking(prior) };
                }
                if (Date.parse(date + 'T' + slot + ':00Z') <= now()) fail(400, 'PAST_SLOT');
                if (bookings.some(b => b.date === date && b.slot === slot && b.status === 'مؤكّد')) fail(409, 'SLOT_TAKEN');
                if (bookings.length >= 2000) fail(409, 'BOOKING_CAPACITY');
                const booking = { id: randomUUID(), service: selected.name, emoji: selected.emoji, price: selected.price,
                    date, slot, customer: customer.trim(), phone, status: 'مؤكّد', customerHash: owner, requestId, requestHash: digest };
                return { bookings: [...bookings, booking], value: publicBooking(booking) };
            });
        },
        async cancel(identity, key, id, admin = false) {
            const owner = admin ? null : customerHash(key);
            return mutate(identity, bookings => {
                const booking = bookings.find(b => b.id === id && (admin || b.customerHash === owner));
                if (!booking) fail(404, 'BOOKING_NOT_FOUND');
                if (booking.status === 'ملغي') return { value: { ok: true } };
                return { bookings: bookings.map(b => b === booking ? { ...b, status: 'ملغي' } : b), value: { ok: true } };
            });
        },
    };
}

export function registerBookingRoutes(app, { store, verifyProjectToken, cloneId, limit, adminGuard }) {
    const root = '/api/public/booking';
    const identity = (req, res, next) => {
        const project = verifyProjectToken(req.body?.token || req.query?.token);
        if (!project?.u || !project?.p || cloneId(project.u, project.p) !== 'jaola-booking') return res.status(403).json({ error: 'INVALID_BOOKING_PROJECT' });
        req.bookingProject = project;
        res.set('Cache-Control', 'no-store'); next();
    };
    const key = req => String(req.headers.authorization || '').replace(/^Bearer /, '');
    const handle = operation => async (req, res) => {
        try { res.json(await operation(store(), req)); }
        catch (e) { res.status(e.status || 503).json({ error: e.code && e.status ? e.code : 'BOOKING_UNAVAILABLE' }); }
    };
    app.get(root + '/availability', limit, identity, handle((s, r) => s.availability(r.bookingProject)));
    app.get(root + '/mine', limit, identity, handle((s, r) => s.list(r.bookingProject, key(r))));
    app.post(root, limit, identity, handle((s, r) => s.create(r.bookingProject, key(r), r.body)));
    app.post(root + '/cancel', limit, identity, handle((s, r) => s.cancel(r.bookingProject, key(r), r.body.id)));
    app.get(root + '/admin', limit, identity, adminGuard, handle((s, r) => s.list(r.bookingProject, null, true)));
    app.post(root + '/admin/cancel', limit, identity, adminGuard, handle((s, r) => s.cancel(r.bookingProject, null, r.body.id, true)));
}
