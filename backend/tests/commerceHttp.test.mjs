import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { registerCommerceRoutes } from '../services/commerceStore.js';
import { installCommerceClient } from '../services/commerceClient.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';
import { projectSessionGuard, issueProjectSession } from '../services/projectSessions.js';
import { setPassword } from '../services/projectAuth.js';

test('all commerce administration routes enforce project session and reset revocation', async () => {
    const dir = fs.mkdtempSync('/tmp/commerce-http-');
    const app = express(); app.use(express.json({ limit: '16kb' }));
    const verifyProjectToken = token => token === 'public' ? { u: 'owner', p: 'app' } : null;
    const secret = 'test-only-secret';
    await setPassword(dir, 'owner', 'app', 'valid-password-123', undefined, { ownerReset: true });
    const guard = projectSessionGuard({ dir, secret, verifyProjectToken });
    let calls = 0;
    const operation = async () => { calls++; return { ok: true }; };
    registerCommerceRoutes(app, { verifyProjectToken, cloneId: () => 'jaola-store', limit: (q, s, n) => n(), adminGuard: guard,
        store: () => ({ admin: operation, product: operation, transition: operation }) });
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}/api/public/store`;
    try {
        const token = issueProjectSession(dir, 'owner', 'app', secret);
        const request = (route, bearer) => fetch(base + route + '?token=public', { method: route === '/admin' ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + bearer } });
        for (const route of ['/admin', '/admin/product', '/admin/order']) {
            assert.equal((await request(route, 'guest')).status, 401);
            const response = await request(route, token);
            assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
        }
        assert.equal((await fetch(base + '/admin?token=bad')).status, 403);
        await setPassword(dir, 'owner', 'app', 'new-password-456', undefined, { ownerReset: true });
        assert.equal((await request('/admin', token)).status, 401); assert.equal(calls, 3);
    } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); fs.rmSync(dir, { recursive: true }); }
});

test('generated store fails closed without runtime and waits for server acknowledgement', async () => {
    const dir = fs.mkdtempSync('/tmp/commerce-dom-'), clone = jaolaStore();
    let dom;
    try {
        for (const f of clone.files) fs.writeFileSync(dir + '/' + f.name, f.content);
        assert.equal(installCommerceClient(dir, { apiBase: 'https://platform.test', token: 'public' }).ready, true);
        assert.equal(installCommerceClient(dir, { apiBase: 'https://platform.test', token: 'public' }).ready, true);
        const html = fs.readFileSync(dir + '/index.html', 'utf8');
        assert.equal(html.split('src="jaola-store.js"').length, 2);
        dom = new JSDOM(html, { url: 'https://shop.test', runScripts: 'outside-only' });
        const run = source => vm.runInContext(source, dom.getInternalVMContext());
        run(clone.files.find(f => f.name === 'app.js').content);
        run("state.cart=[{id:'p1',name:'test',price:249,qty:1}]; state.step='info';renderCheckout()");
        for (const [id, value] of [['coName', 'Customer'], ['coPhone', '+31123456'], ['coAddr', 'Address']]) dom.window.document.getElementById(id).value = value;
        await run('confirmOrder()'); assert.equal(run('state.step'), 'info'); assert.equal(dom.window.localStorage.length, 0);
        let resolve, calls = 0;
        dom.window.jaolaStoreAPI = { checkout: () => { calls++; return new Promise(r => { resolve = r; }); }, catalog: async () => [] };
        const pending = run('confirmOrder()'); await run('confirmOrder()');
        assert.equal(calls, 1); assert.equal(run('state.step'), 'info');
        resolve({ id: 'acknowledged-order' }); await pending;
        assert.equal(run('state.step'), 'done'); assert.match(dom.window.document.getElementById('checkoutBody').textContent, /acknowledged-order/);
    } finally { dom?.window.close(); fs.rmSync(dir, { recursive: true }); }
});

test('customer recovery survives a fresh client while failed recovery preserves ownership', async () => {
    const { commerceClient } = await import('../services/commerceClient.js');
    const { webcrypto } = await import('node:crypto');
    const key = 'a'.repeat(64), storage = new Map(), calls = [];
    const context = vm.createContext({ window: {}, crypto: webcrypto, Uint8Array, AbortSignal, URL,
        sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
        fetch: async (url, options) => {
            calls.push(options.headers.Authorization);
            return { ok: true, json: async () => options.headers.Authorization === 'Bearer ' + key ? [{ id: 'private-order' }] : [] };
        },
    });
    const script = commerceClient({ apiBase: 'https://platform.test', token: 'project' });
    vm.runInContext(script, context);
    await context.window.jaolaStoreAPI.restore(key);
    vm.runInContext(script, context);
    assert.equal((await context.window.jaolaStoreAPI.mine())[0].id, 'private-order');
    await assert.rejects(context.window.jaolaStoreAPI.restore('b'.repeat(64)), /NO_ORDERS/);
    await context.window.jaolaStoreAPI.mine(); assert.equal(calls.at(-1), 'Bearer ' + key);
    vm.runInContext(commerceClient({ apiBase: 'https://platform.test', token: 'other-project' }), context);
    await context.window.jaolaStoreAPI.mine(); assert.notEqual(calls.at(-1), 'Bearer ' + key);
});
