import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerBookingRoutes } from '../services/bookingStore.js';
import { projectSessionGuard, issueProjectSession } from '../services/projectSessions.js';
import { setPassword } from '../services/projectAuth.js';
import { installBookingClient } from '../services/bookingClient.js';
import { jaolaBooking } from '../agents/cloneTemplates/jaolaBooking.js';
import { JSDOM } from 'jsdom';

test('HTTP booking admin requires real project session and reset revokes it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-http-'));
    const app = express(); app.use(express.json({ limit: '16kb' }));
    const verifyProjectToken = token => token === 'public' ? { u: 'owner', p: 'app' } : null;
    const secret = 'test-only-secret';
    await setPassword(dir, 'owner', 'app', 'valid-password-123', undefined, { ownerReset: true });
    const guard = projectSessionGuard({ dir, secret, verifyProjectToken });
    let calls = 0;
    registerBookingRoutes(app, { verifyProjectToken, cloneId: () => 'jaola-booking', limit: (q, s, n) => n(), adminGuard: guard,
        store: () => ({ list: async () => { calls++; return [{ customer: 'private' }]; } }) });
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    const url = `http://127.0.0.1:${server.address().port}/api/public/booking/admin?token=public`;
    try {
        assert.equal((await fetch(url)).status, 401);
        const token = issueProjectSession(dir, 'owner', 'app', secret);
        const headers = { Authorization: 'Bearer ' + token };
        const response = await fetch(url, { headers });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        await setPassword(dir, 'owner', 'app', 'new-password-456', undefined, { ownerReset: true });
        assert.equal((await fetch(url, { headers })).status, 401);
        assert.equal(calls, 1);
    } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); fs.rmSync(dir, { recursive: true }); }
});

test('installed clone waits for server acknowledgement; unavailable bootstrap cannot save locally', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'booking-client-'));
    const clone = jaolaBooking();
    for (const f of clone.files) fs.writeFileSync(path.join(dir, f.name), f.content);
    try {
        assert.equal(installBookingClient(dir, { apiBase: 'https://platform.test', token: 'public' }).ready, true);
        assert.equal(installBookingClient(dir, { apiBase: 'https://platform.test', token: 'public' }).ready, true);
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        assert.equal(html.split('src="jaola-booking.js"').length, 2);
        const dom = new JSDOM(html, { url: 'https://app.test', runScripts: 'outside-only' });
        const w = dom.window;
        const run = source => vm.runInContext(source, dom.getInternalVMContext());
        run(clone.files.find(f => f.name === 'app.js').content);
        run("state.step='confirm'; state.service='s1'; state.date='2030-01-02'; state.slot='10:00'");
        w.document.getElementById('custName').value = 'عميل';
        w.document.getElementById('custPhone').value = '+31123456';
        await run('confirmBooking()');
        assert.equal(w.localStorage.getItem('bookings'), null);
        assert.equal(run('state.step'), 'confirm');
        let resolve, writes = 0;
        w.jaolaBookingAPI = { create: () => { writes++; return new Promise(r => { resolve = r; }); } };
        const pending = run('confirmBooking()');
        await run('confirmBooking()');
        assert.equal(writes, 1);
        assert.equal(run('state.step'), 'confirm');
        resolve({ id: 'confirmed-id', date: '2030-01-02', slot: '10:00' });
        await pending;
        assert.equal(run('state.step'), 'done');
        assert.match(w.document.getElementById('doneMsg').textContent, /confirmed-id/);
        w.close();
    } finally { fs.rmSync(dir, { recursive: true }); }
});

test('generated client sends separate customer/admin bearers and clears admin on logout', async () => {
    const { bookingClient } = await import('../services/bookingClient.js');
    const { webcrypto } = await import('node:crypto');
    const calls = [], storage = new Map();
    const context = vm.createContext({ window: {}, crypto: webcrypto, Uint8Array, AbortSignal, URL,
        sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
        fetch: async (url, options) => {
            calls.push({ url, options });
            return { ok: true, json: async () => url.endsWith('/auth/login') ? { ok: true, session: 'admin-session' } : [] };
        },
    });
    vm.runInContext(bookingClient({ apiBase: 'https://platform.test', token: 'project-token' }), context);
    const api = context.window.jaolaBookingAPI;
    await api.mine();
    const customer = calls.at(-1).options.headers.Authorization;
    assert.match(customer, /^Bearer [a-f0-9]{64}$/);
    await api.login('owner-password');
    await api.listAdmin();
    assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer admin-session');
    await api.mine();
    assert.equal(calls.at(-1).options.headers.Authorization, customer);
    api.logout();
    await api.listAdmin();
    assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer ');
});
