import { randomUUID, createHash } from 'node:crypto';
import { customerHash } from './bookingStore.js';
import { STORE_PRODUCTS } from './storeCatalog.js';
const options = { writeConcern: { w: 'majority' }, maxTimeMS: 5000 };
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;
const cleanOrder = ({ customerHash: owner, requestHash, requestId, ...order }) => order;
function productInput(value) {
    if (!value || !text(value.name, 100) || !text(value.cat, 60) || !Number.isFinite(value.price) || value.price < 0 || value.price > 1000000 || !Number.isSafeInteger(value.stock) || value.stock < 0 || value.stock > 1000000) fail(400, 'INVALID_PRODUCT');
    return { name: value.name.trim(), cat: value.cat.trim(), price: Math.round(value.price * 100) / 100, stock: value.stock,
        desc: typeof value.desc === 'string' ? value.desc.slice(0, 1000) : '', emoji: typeof value.emoji === 'string' ? value.emoji.slice(0, 8) : '📦',
        img: typeof value.img === 'string' && /^[\w-]{0,100}$/.test(value.img) ? value.img : '', rating: 0, active: true };
}
/** Order, stock and idempotency receipt commit in one revision-conditional project document. */
export function commerceStore(collection) {
    async function read(identity) {
        const _id = JSON.stringify([identity.u, identity.p]);
        let doc = await collection.findOne({ _id }, { maxTimeMS: 5000 });
        if (!doc) {
            try { await collection.insertOne({ _id, revision: 0, products: structuredClone(STORE_PRODUCTS), orders: [] }, options); }
            catch (e) { if (e.code !== 11000) throw e; }
            doc = await collection.findOne({ _id }, { maxTimeMS: 5000 });
        }
        if (!doc) fail(503, 'STORE_UNAVAILABLE');
        return doc;
    }
    async function mutate(identity, operation) {
        for (let i = 0; i < 10; i++) {
            const doc = await read(identity);
            const result = operation(doc);
            if (!result.changes) return result.value;
            const write = await collection.updateOne({ _id: doc._id, revision: doc.revision }, { $set: result.changes, $inc: { revision: 1 } }, options);
            if (write.modifiedCount === 1) return result.value;
        }
        fail(409, 'STORE_CONFLICT');
    }
    return {
        async catalog(identity) { return (await read(identity)).products.filter(p => p.active !== false); },
        async admin(identity) { const d = await read(identity); return { revision: d.revision, products: d.products.filter(p => p.active !== false), orders: d.orders.map(cleanOrder) }; },
        async mine(identity, key) { const owner = customerHash(key); return (await read(identity)).orders.filter(o => o.customerHash === owner).map(cleanOrder); },
        async product(identity, input) {
            const product = input?.remove ? null : productInput(input?.product);
            return mutate(identity, doc => {
                if (input.revision !== doc.revision) fail(409, 'STORE_CONFLICT');
                let products;
                if (input.id) {
                    if (!doc.products.some(p => p.id === input.id)) fail(404, 'PRODUCT_NOT_FOUND');
                    products = doc.products.map(p => p.id === input.id ? (input.remove ? { ...p, active: false } : { ...product, id: p.id }) : p);
                } else {
                    if (!product || doc.products.length >= 300) fail(409, 'PRODUCT_CAPACITY');
                    products = [...doc.products, { ...product, id: randomUUID() }];
                }
                return { changes: { products }, value: { ok: true, revision: doc.revision + 1 } };
            });
        },
        async checkout(identity, key, input) {
            const owner = customerHash(key);
            if (!input || !text(input.customer, 100) || !text(input.address, 300) || !text(input.phone, 40) || !/^[0-9+() -]{5,40}$/.test(input.phone) || !/^[a-f0-9-]{36}$/.test(input.requestId || '') || !Array.isArray(input.items) || !input.items.length || input.items.length > 50) fail(400, 'INVALID_ORDER');
            const ids = new Set();
            const items = input.items.map(item => {
                if (!item || typeof item.id !== 'string' || ids.has(item.id) || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 1000 || !Number.isFinite(item.price)) fail(400, 'INVALID_ITEMS');
                ids.add(item.id); return { id: item.id, qty: item.qty, price: item.price };
            }).sort((a, b) => a.id.localeCompare(b.id));
            const digest = createHash('sha256').update(JSON.stringify([items, input.customer.trim(), input.phone, input.address.trim()])).digest('hex');
            return mutate(identity, doc => {
                const prior = doc.orders.find(o => o.customerHash === owner && o.requestId === input.requestId);
                if (prior) { if (prior.requestHash !== digest) fail(409, 'REQUEST_ID_REUSED'); return { value: cleanOrder(prior) }; }
                if (doc.orders.length >= 2000) fail(409, 'ORDER_CAPACITY');
                let totalCents = 0;
                const lines = items.map(item => {
                    const p = doc.products.find(p => p.id === item.id && p.active !== false);
                    if (!p || p.stock < item.qty) fail(409, 'OUT_OF_STOCK');
                    if (item.price !== p.price) fail(409, 'PRICE_CHANGED');
                    totalCents += Math.round(p.price * 100) * item.qty;
                    return { id: p.id, name: p.name, price: p.price, qty: item.qty };
                });
                if (!Number.isSafeInteger(totalCents)) fail(400, 'INVALID_TOTAL');
                const order = { id: randomUUID(), items: lines, total: totalCents / 100, customer: input.customer.trim(), phone: input.phone, address: input.address.trim(), status: 'جديد', payment: 'cash_on_delivery', createdAt: Date.now(), customerHash: owner, requestId: input.requestId, requestHash: digest };
                const products = doc.products.map(p => { const item = items.find(i => i.id === p.id); return item ? { ...p, stock: p.stock - item.qty } : p; });
                return { changes: { products, orders: [...doc.orders, order] }, value: cleanOrder(order) };
            });
        },
        async transition(identity, key, input, admin = false) {
            const owner = admin ? null : customerHash(key);
            return mutate(identity, doc => {
                const order = doc.orders.find(o => o.id === input?.id && (admin || o.customerHash === owner));
                if (!order) fail(404, 'ORDER_NOT_FOUND');
                if (order.status === input.status) return { value: { ok: true } };
                if (order.status !== input.expectedStatus) fail(409, 'ORDER_CONFLICT');
                const next = { 'جديد': 'قيد التجهيز', 'قيد التجهيز': 'تم الشحن', 'تم الشحن': 'مكتمل' };
                const cancel = input.status === 'ملغي' && (order.status === 'جديد' || (admin && order.status === 'قيد التجهيز'));
                if (!cancel && (!admin || next[order.status] !== input.status)) fail(409, 'INVALID_TRANSITION');
                const products = cancel ? doc.products.map(p => { const item = order.items.find(i => i.id === p.id); return item ? { ...p, stock: p.stock + item.qty } : p; }) : doc.products;
                return { changes: { products, orders: doc.orders.map(o => o === order ? { ...o, status: input.status } : o) }, value: { ok: true } };
            });
        },
    };
}
export function registerCommerceRoutes(app, { store, verifyProjectToken, cloneId, limit, adminGuard, onRequest = () => {} }) {
    const root = '/api/public/store';
    const identity = (req, res, next) => {
        const project = verifyProjectToken(req.body?.token || req.query?.token);
        if (!project?.u || !project?.p || cloneId(project.u, project.p) !== 'jaola-store') return res.status(403).json({ error: 'INVALID_STORE_PROJECT' });
        const startedAt = performance.now();
        res.once('finish', () => {
            try { onRequest(project, { route: req.route.path, durationMs: performance.now() - startedAt, status: res.statusCode }); } catch { /* Telemetry cannot fail a transaction. */ }
        });
        req.storeProject = project; res.set('Cache-Control', 'no-store'); next();
    };
    const key = req => String(req.headers.authorization || '').replace(/^Bearer /, '');
    const run = operation => async (req, res) => {
        try { res.json(await operation(store(), req)); }
        catch (e) { res.status(e.status || 503).json({ error: e.status && e.code ? e.code : 'STORE_UNAVAILABLE' }); }
    };
    app.get(root + '/catalog', limit, identity, run((s, r) => s.catalog(r.storeProject)));
    app.get(root + '/mine', limit, identity, run((s, r) => s.mine(r.storeProject, key(r))));
    app.post(root + '/checkout', limit, identity, run((s, r) => s.checkout(r.storeProject, key(r), r.body)));
    app.post(root + '/cancel', limit, identity, run((s, r) => s.transition(r.storeProject, key(r), { ...r.body, status: 'ملغي' })));
    app.get(root + '/admin', limit, identity, adminGuard, run((s, r) => s.admin(r.storeProject)));
    app.post(root + '/admin/product', limit, identity, adminGuard, run((s, r) => s.product(r.storeProject, r.body)));
    app.post(root + '/admin/order', limit, identity, adminGuard, run((s, r) => s.transition(r.storeProject, null, r.body, true)));
}
