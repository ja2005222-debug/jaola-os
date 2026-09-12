import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FULLSTACK_ADMIN_LIB } from '../agents/fullstackAdminRuntime.js';
import { FULLSTACK_API_LIB } from '../agents/fullstackApiRuntime.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { setPassword, verifyPassword } from '../services/projectAuth.js';
import { issueProjectSession, verifyProjectSession } from '../services/projectSessions.js';
const strip = source => source.replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
function harness(fetch, config = { api: 'https://jaola.test', token: 'bound-project' }) {
    const c = vm.createContext({ config, fetch, URL, Response, AbortSignal, process: { env: { NODE_ENV: 'production' } } });
    vm.runInContext(strip(FULLSTACK_ADMIN_LIB), c);
    return c;
}
const req = (method, cookie = '', origin = 'https://app.test') => new Request('https://app.test/api/admin/login', { method, headers: { Origin: origin, Cookie: cookie } });

test('password login, protected cookie, project-bound validation and owner reset work together', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-admin-'));
    const secret = 'test-platform-secret';
    try {
        await setPassword(dir, 'owner', 'app', 'initial-password-123', undefined, { ownerReset: true });
        const c = harness(async (url, options) => {
            const body = JSON.parse(options.body);
            assert.equal(body.token, 'bound-project');
            if (url.endsWith('/login')) {
                const ok = await verifyPassword(dir, 'owner', 'app', body.password);
                return Response.json(ok ? { ok, session: issueProjectSession(dir, 'owner', 'app', secret) } : { ok }, { status: ok ? 200 : 401 });
            }
            const token = options.headers.Authorization.slice(7);
            const valid = verifyProjectSession(token, dir, 'owner', 'app', secret);
            return Response.json({ ok: !!valid, role: valid?.role }, { status: valid ? 200 : 401 });
        });
        assert.equal((await c.login(req('POST'), 'wrong-password-123')).status, 401);
        const login = await c.login(req('POST'), 'initial-password-123');
        assert.equal(login.status, 200);
        const cookie = login.headers.get('set-cookie');
        assert.match(cookie, /^__Host-jaola-admin=/);
        for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=3600']) assert.ok(cookie.includes(flag));
        assert.deepEqual(await login.json(), { ok: true });
        const pair = cookie.split(';')[0];
        assert.equal(await c.adminSession(req('GET', pair)), true);
        const token = pair.slice(pair.indexOf('=') + 1);
        assert.equal(verifyProjectSession(token, dir, 'other-owner', 'app', secret), null);
        await setPassword(dir, 'owner', 'app', 'replacement-password-123', undefined, { ownerReset: true });
        assert.equal(await c.adminSession(req('GET', pair)), false);
        const out = c.logout(req('POST', pair));
        assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
        assert.equal(await c.adminSession(req('GET')), false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('no anonymous setup, cross-origin login/logout blocked and upstream failures never authenticate', async () => {
    let calls = 0;
    const c = harness(async () => { calls++; throw Error('offline'); });
    assert.equal((await c.login(req('POST', '', 'https://attacker.test'), 'valid-password-123')).status, 403);
    assert.equal(c.logout(req('POST', '', 'https://attacker.test')).status, 403);
    assert.equal(calls, 0);
    assert.equal((await c.login(req('POST'), 'valid-password-123')).status, 503);
    assert.equal(await c.adminSession(req('GET')), false);
    const setup = harness(async () => Response.json({ code: 'OWNER_SETUP_REQUIRED' }, { status: 403 }));
    const response = await setup.login(req('POST'), 'valid-password-123');
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'OWNER_SETUP_REQUIRED');
    assert.equal(response.headers.get('set-cookie'), null);
});

test('cookie authorization fails closed and requires Origin for writes; service credentials remain separate', async () => {
    let valid = true;
    const c = vm.createContext({ Response, createHash, timingSafeEqual, process: { env: {} }, adminSession: async () => valid, sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin });
    vm.runInContext(strip(FULLSTACK_API_LIB), c);
    assert.equal(await c.authorize(req('GET')), null);
    assert.equal((await c.authorize(req('POST', '', 'https://attacker.test'), { write: true })).status, 403);
    assert.equal(await c.authorize(req('POST'), { write: true }), null);
    valid = false;
    assert.equal((await c.authorize(req('GET'))).status, 401);
    c.adminSession = async () => { throw Error('unavailable'); };
    assert.equal((await c.authorize(req('GET'))).status, 503);
});

test('session validation endpoint uses the project guard, and password setup remains owner-only', () => {
    const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
    assert.match(server, /app.post\('\/api\/public\/auth\/session', appDataLimit, requireProjectSession,/);
    assert.match(server, /app.post\('\/api\/project\/access-password', verifyToken, authLimit, validateProjectOwnership,/);
});

test('owner setup link survives sign-in and opens only the matching owned project', () => {
    const dashboard = fs.readFileSync(new URL('../../frontend/src/pages/Dashboard.jsx', import.meta.url), 'utf8');
    const start = dashboard.indexOf('  useEffect(() => {\n    const url = new URL(window.location.href);\n    const requested =');
    assert.ok(start > 0);
    const source = dashboard.slice(start, dashboard.indexOf('\n  const getHeaders', start));
    const values = new Map(); const opened = [], notifications = [];
    const c = vm.createContext({ URL, useEffect: fn => fn(), isAuthenticated: false, currentUser: '', projects: [],
        sessionStorage: { setItem: (k,v) => values.set(k,v), getItem: k => values.get(k) || null, removeItem: k => values.delete(k) },
        window: { location: { href: 'https://jaola.test/dashboard?setupProject=shop&setupOwner=alice' }, history: { replaceState() {} } },
        setAccessProject: p => opened.push(p), setAccessPassword() {}, setAccessError() {}, addNotification: text => notifications.push(text),
    });
    vm.runInContext(source, c);
    assert.equal(opened.length, 0); assert.equal(values.size, 1);
    c.window.location.href = 'https://jaola.test/dashboard'; c.isAuthenticated = true; c.currentUser = 'alice'; c.projects = ['shop'];
    vm.runInContext(source, c);
    assert.deepEqual(opened, ['shop']); assert.equal(values.size, 0);
    c.window.location.href = 'https://jaola.test/dashboard?setupProject=shop&setupOwner=alice'; c.currentUser = 'bob';
    vm.runInContext(source, c);
    assert.equal(opened.length, 1); assert.equal(notifications.length, 1);
});

test('Origin checks use public Host behind Next proxy without trusting forwarded-host or foreign origins', () => {
    const c = harness(async () => { throw Error('unused'); });
    const proxy = (origin, host = 'app.test', forwarded = '') => new Request('http://internal:3000/api/admin/login', { method:'POST', headers:{ Origin:origin, Host:host, 'X-Forwarded-Host':forwarded } });
    assert.equal(c.sameOrigin(proxy('https://app.test')), true);
    assert.equal(c.sameOrigin(proxy('https://attacker.test', 'app.test', 'attacker.test')), false);
    assert.equal(c.sameOrigin(proxy('http://app.test')), false);
    assert.equal(c.sameOrigin(proxy('https://app.test:444')), false);
    assert.equal(c.sameOrigin(proxy('null')), false);
    assert.equal(c.sameOrigin(proxy('https://app.test/extra')), false);
    assert.equal(c.sameOrigin(proxy('http://127.0.0.1:4762', '127.0.0.1:4762')), true);
});
