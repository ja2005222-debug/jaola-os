import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { setPassword } from '../services/projectAuth.js';
import { issueProjectSession, verifyProjectSession, projectSessionGuard } from '../services/projectSessions.js';
import { projectSessionClient } from '../services/projectSessionClient.js';

test('project sessions bind owner/project/role, expire, revoke on password rotation and use a separate signing domain', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-'));
    const secret = crypto.randomUUID(), password = crypto.randomUUID();
    try {
        assert.throws(() => issueProjectSession(dir, 'alice', 'shop', secret));
        await setPassword(dir, 'alice', 'shop', password, undefined, { ownerReset: true });
        const token = issueProjectSession(dir, 'alice', 'shop', secret);
        assert.equal(verifyProjectSession(token, dir, 'alice', 'shop', secret).role, 'project-admin');
        assert.equal(verifyProjectSession(token, dir, 'bob', 'shop', secret), null);
        assert.equal(verifyProjectSession(token, dir, 'alice', 'other', secret), null);
        assert.equal(verifyProjectSession(token + 'x', dir, 'alice', 'shop', secret), null);
        assert.throws(() => jwt.verify(token, secret), 'project tokens cannot authenticate as platform users');
        const decoded = jwt.decode(token);
        assert.equal(decoded.exp - decoded.iat, 3600);
        const expired = jwt.sign({ ...decoded, exp: 1 }, crypto.createHash('sha256').update('jaola-project-session:' + secret).digest('hex'));
        assert.equal(verifyProjectSession(expired, dir, 'alice', 'shop', secret), null);
        await setPassword(dir, 'alice', 'shop', crypto.randomUUID(), undefined, { ownerReset: true });
        assert.equal(verifyProjectSession(token, dir, 'alice', 'shop', secret), null);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('guard rejects published token alone and cross-project sessions before invoking handlers', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-guard-'));
    const secret = crypto.randomUUID();
    try {
        await setPassword(dir, 'alice', 'shop', crypto.randomUUID(), undefined, { ownerReset: true });
        const session = issueProjectSession(dir, 'alice', 'shop', secret);
        const guard = projectSessionGuard({ dir, secret, verifyProjectToken: t => t === 'public' ? { u: 'alice', p: 'shop' } : { u: 'bob', p: 'shop' } });
        let entered = 0;
        for (const [token, bearer, expected] of [['public', '', 401], ['other', session, 401], ['public', session, 200]]) {
            const res = { code: 200, status(c) { this.code = c; return this; }, json() {} };
            guard({ query: { token }, headers: { authorization: bearer ? 'Bearer ' + bearer : '' } }, res, () => entered++);
            assert.equal(res.code, expected);
        }
        assert.equal(entered, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('generated gate does not start or expose old browser data before login; bearer only sent to project API', async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<body></body>', { url: 'https://project.example', runScripts: 'dangerously' });
    const tick = () => new Promise(resolve => setImmediate(resolve));
    try {
        const w = dom.window;
        w.Headers = Headers; w.Response = Response;
        w.localStorage.setItem('orders', 'previous-account');
        let starts = 0, accept = false;
        const calls = [];
        w.fetch = async (url, options = {}) => {
            calls.push({ url, options });
            if (String(url).endsWith('/auth/login')) return new Response(JSON.stringify(accept ? { session: 'private-session' } : { code: 'OWNER_SETUP_REQUIRED' }), { status: accept ? 200 : 403 });
            return new Response('{}');
        };
        w.start = () => starts++;
        w.eval('(' + projectSessionClient.toString() + ')("https://api.example", "published", window.start)');
        assert.equal(starts, 0);
        assert.equal(w.localStorage.getItem('orders'), null);
        const form = w.document.querySelector('form');
        form.querySelector('input').value = crypto.randomUUID();
        form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
        assert.equal(starts, 0);
        assert.match(form.textContent, /المالك/);
        accept = true;
        form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
        assert.equal(starts, 1);
        await w.fetch('https://api.example/api/public/data?token=published');
        assert.equal(calls.at(-1).options.headers.get('authorization'), 'Bearer private-session');
        await w.fetch('https://elsewhere.example/api/public/data');
        assert.equal(calls.at(-1).options.headers, undefined);
        assert.equal(w.sessionStorage.length, 0);
    } finally { dom.window.dispatchEvent(new dom.window.Event("pagehide")); dom.window.close(); }
});

test('server protects every shared data family and reserves provisioning for authenticated ownership', async () => {
    const vm = await import('node:vm');
    const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
    const begin = source.indexOf('const APPDATA_DIR =');
    const end = source.indexOf('// 🗄️ مجموعات حقيقية', begin);
    const routes = new Map(), protections = [];
    const authenticate = () => {}, ownership = () => {}, guard = () => {};
    let passwordWrite;
    vm.runInNewContext(source.slice(begin, end), {
        path, BASE_WORKSPACE: '/unused', JWT_SECRET: crypto.randomUUID(),
        app: { use: (paths, middleware) => protections.push({ paths, middleware }), get: (p, ...f) => routes.set('GET ' + p, f), post: (p, ...f) => routes.set('POST ' + p, f), put: (p, ...f) => routes.set('PUT ' + p, f) },
        registerCommerceRoutes: () => {}, registerBookingRoutes: () => {}, getCloneId: () => null,
        projectSessionGuard: () => guard, verifyBotToken: () => ({ u: 'alice', p: 'shop' }),
        verifyToken: authenticate, validateProjectOwnership: ownership, authLimit: () => {}, appDataLimit: () => {},
        setProjectPassword: async (...args) => { passwordWrite = args; return { ok: true }; },
        credentialVersion: () => null,
    });
    assert.deepEqual(Array.from(protections[0].paths), ['/api/public/data', '/api/public/collections', '/api/public/assets', '/api/public/budget', '/api/public/crypto', '/api/public/stock']);
    assert.equal(protections[0].middleware, guard);
    const chain = routes.get('POST /api/project/access-password');
    assert.equal(chain[0], authenticate);
    assert.equal(chain[2], ownership);
    const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
    await chain.at(-1)({ user: { username: 'alice' }, activeProject: 'shop', body: { username: 'victim', project: 'other', password: crypto.randomUUID() } }, response());
    assert.equal(passwordWrite[1], 'alice');
    assert.equal(passwordWrite[2], 'shop');
    assert.equal(passwordWrite[5].ownerReset, true);
    passwordWrite = null;
    const denied = response();
    await routes.get('POST /api/public/auth/set-password').at(-1)({ body: { token: 'public', password: crypto.randomUUID() } }, denied);
    assert.equal(denied.code, 403);
    assert.equal(passwordWrite, null);
    const login = response();
    await routes.get('POST /api/public/auth/login').at(-1)({ body: { token: 'public', password: 'admin' } }, login);
    assert.equal(login.code, 403);
    assert.equal(login.body.code, 'OWNER_SETUP_REQUIRED');
});

test('generated sync script waits for login and successful hydration before loading app.js', async () => {
    const { JSDOM } = await import('jsdom');
    const { buildDataSyncJS } = await import('../services/dataSync.js');
    const dom = new JSDOM('<body></body>', { url: 'https://project.example', runScripts: 'dangerously' });
    const tick = () => new Promise(resolve => setImmediate(resolve));
    try {
        const w = dom.window;
        w.Headers = Headers; w.Response = Response;
        const calls = [];
        w.fetch = async (url, options = {}) => {
            calls.push({ url, options });
            if (String(url).endsWith('/auth/login')) return new Response(JSON.stringify({ session: 'session' }));
            return new Response(JSON.stringify({ revision: 0, data: { orders: 'server-data' } }));
        };
        w.eval(buildDataSyncJS({ apiBase: 'https://api.example', token: 'public' }));
        assert.equal(calls.length, 0);
        assert.equal(w.document.querySelector('script[src="app.js"]'), null);
        const form = w.document.querySelector('form');
        form.querySelector('input').value = crypto.randomUUID();
        form.dispatchEvent(new w.Event('submit', { cancelable: true }));
        await tick(); await tick();
        assert.equal(calls.length, 2);
        assert.equal(calls[1].options.headers.get('authorization'), 'Bearer session');
        assert.equal(w.localStorage.getItem('orders'), 'server-data');
        assert.ok(w.document.querySelector('script[src="app.js"]'));
    } finally { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
});
