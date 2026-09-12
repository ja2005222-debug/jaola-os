import { createHash, randomUUID } from 'node:crypto';

import { DEFAULT_BOOKING_CONFIG, validateBookingConfiguration, calendarDays, bookingInstant, overlapsBooking } from './bookingConfiguration.js';
export const BOOKING_SERVICES = DEFAULT_BOOKING_CONFIG.services;
export const BOOKING_SLOTS = DEFAULT_BOOKING_CONFIG.slots;
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
            const result = operation(doc.bookings, doc.config || DEFAULT_BOOKING_CONFIG, doc);
            if (!result.bookings) return result.value;
            const write = await collection.updateOne({ _id: doc._id, revision: doc.revision }, {
                $set: { bookings: result.bookings, ...(result.config ? { config: result.config } : {}) }, $inc: { revision: 1 },
            }, options);
            if (write.modifiedCount === 1) return result.value;
        }
        fail(409, 'BOOKING_RETRY');
    }
    return {
        async availability(identity, selection = {}) {
            const doc = await read(identity);
            const config = doc.config || DEFAULT_BOOKING_CONFIG;
            const days = calendarDays(now(), config.timezone);
            const offers = [];
            for (const date of days) for (const slot of config.slots) {
                const start = bookingInstant(date, slot, config.timezone);
                if (!Number.isFinite(start) || start <= now()) continue;
                for (const resource of config.resources.filter(r => r.id === (selection.resource || config.resources[0].id))) for (const service of config.services.filter(s => s.id === (selection.service || config.services[0].id))) {
                    if (!doc.bookings.some(b => overlapsBooking(b, resource.id, start, start + service.dur * 60000))) offers.push({ date, slot, resource: resource.id, service: service.id });
                }
            }
            return { ...config, days, offers,
                taken: doc.bookings.filter(b => days.includes(b.date) && b.status === 'مؤكّد').map(b => ({ date: b.date, slot: b.slot })) };
        },
        async configuration(identity) {
            const doc = await read(identity);
            return { revision: doc.revision, config: doc.config || DEFAULT_BOOKING_CONFIG };
        },
        async configure(identity, request) {
            const config = validateBookingConfiguration(request?.config);
            return mutate(identity, (bookings, previous, doc) => {
                if (request.revision !== doc.revision) fail(409, 'CONFIGURATION_CONFLICT');
                if (bookings.some(b => b.status === 'مؤكّد' && (b.endsAt || Date.parse(b.date + 'T' + b.slot + ':00Z') + 3600000) > now() && !config.resources.some(r => r.id === (b.resource || 'main')))) fail(409, 'RESOURCE_HAS_BOOKINGS');
                return { bookings, config, value: { ok: true, revision: doc.revision + 1 } };
            });
        },
        async list(identity, key, admin = false) {
            const owner = admin ? null : customerHash(key);
            return (await read(identity)).bookings.filter(b => admin || b.customerHash === owner).map(publicBooking);
        },
        async create(identity, key, input) {
            const owner = customerHash(key);
            const { service, date, slot, customer, phone, requestId, resource = 'main' } = input || {};
            if (typeof customer !== 'string' || !customer.trim() || customer.length > 100 || typeof phone !== 'string' || phone.length > 40 || !/^[0-9+() -]{5,40}$/.test(phone) || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) fail(400, 'INVALID_BOOKING');
            const digest = hash(JSON.stringify([service, date, slot, customer.trim(), phone, ...(resource === 'main' ? [] : [resource])]));
            return mutate(identity, (bookings, config) => {
                const prior = bookings.find(b => b.customerHash === owner && b.requestId === requestId);
                if (prior) {
                    if (prior.requestHash !== digest) fail(409, 'REQUEST_ID_REUSED');
                    return { value: publicBooking(prior) };
                }
                const selected = config.services.find(s => s.id === service);
                if (!selected || !config.resources.some(r => r.id === resource)) fail(400, 'INVALID_BOOKING');
                if ((input.quotedPrice !== undefined && input.quotedPrice !== selected.price) || (input.quotedDuration !== undefined && input.quotedDuration !== selected.dur)) fail(409, 'SERVICE_CHANGED');
                if (!calendarDays(now(), config.timezone).includes(date) || !config.slots.includes(slot)) fail(400, 'INVALID_SLOT');
                const startsAt = bookingInstant(date, slot, config.timezone);
                if (!Number.isFinite(startsAt) || startsAt <= now()) fail(400, 'PAST_SLOT');
                const endsAt = startsAt + selected.dur * 60000;
                if (bookings.some(b => overlapsBooking(b, resource, startsAt, endsAt))) fail(409, 'SLOT_TAKEN');
                if (bookings.length >= 2000) fail(409, 'BOOKING_CAPACITY');
                const booking = { id: randomUUID(), service: selected.name, emoji: selected.emoji, price: selected.price,
                    date, slot, resource, timezone: config.timezone, startsAt, endsAt, customer: customer.trim(), phone, status: 'مؤكّد', customerHash: owner, requestId, requestHash: digest };
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

export function registerBookingRoutes(app, { store, verifyProjectToken, cloneId, limit, adminGuard, onRequest = () => {} }) {
    const root = '/api/public/booking';
    const identity = (req, res, next) => {
        const project = verifyProjectToken(req.body?.token || req.query?.token);
        if (!project?.u || !project?.p || cloneId(project.u, project.p) !== 'jaola-booking') return res.status(403).json({ error: 'INVALID_BOOKING_PROJECT' });
        const startedAt = performance.now();
        res.once('finish', () => {
            try { onRequest(project, { route: req.route.path, durationMs: performance.now() - startedAt, status: res.statusCode }); } catch { /* Telemetry cannot fail a transaction. */ }
        });
        req.bookingProject = project;
        res.set('Cache-Control', 'no-store'); next();
    };
    const key = req => String(req.headers.authorization || '').replace(/^Bearer /, '');
    const handle = operation => async (req, res) => {
        try { res.json(await operation(store(), req)); }
        catch (e) { res.status(e.status || 503).json({ error: e.code && e.status ? e.code : 'BOOKING_UNAVAILABLE' }); }
    };
    app.get(root + '/availability', limit, identity, handle((s, r) => s.availability(r.bookingProject, r.query)));
    app.get(root + '/mine', limit, identity, handle((s, r) => s.list(r.bookingProject, key(r))));
    app.post(root, limit, identity, handle((s, r) => s.create(r.bookingProject, key(r), r.body)));
    app.post(root + '/cancel', limit, identity, handle((s, r) => s.cancel(r.bookingProject, key(r), r.body.id)));
    app.get(root + '/admin/configuration', limit, identity, adminGuard, handle((s, r) => s.configuration(r.bookingProject)));
    app.post(root + '/admin/configuration', limit, identity, adminGuard, handle((s, r) => s.configure(r.bookingProject, r.body)));
    app.get(root + '/admin', limit, identity, adminGuard, handle((s, r) => s.list(r.bookingProject, null, true)));
    app.post(root + '/admin/cancel', limit, identity, adminGuard, handle((s, r) => s.cancel(r.bookingProject, null, r.body.id, true)));
}
