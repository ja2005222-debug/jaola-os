// Standalone Next + database smoke test. Only the local auth-service boundary is stubbed.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { buildFullStackProject } from '../agents/fullstackTemplates.js';
const dir = path.resolve(process.argv[3] || '/tmp/jaola-admin-smoke');
const appUrl = 'http://127.0.0.1:4762';
if (process.argv[2] === 'prepare') {
    const { files } = buildFullStackProject('saas', 'تجربة دخول الأدمن', { databaseProvider: process.env.TEST_DATABASE_PROVIDER || 'sqlite', api: 'http://127.0.0.1:4761', token: 'fixture-project', ownerUrl: 'https://jaola.test/dashboard?setupProject=fixture&setupOwner=owner' });
    for (const file of files) { const target = path.join(dir, file.name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, file.content); }
    await fs.writeFile(path.join(dir, '.env'), 'DATABASE_URL=' + JSON.stringify(process.env.TEST_DATABASE_URL || 'file:./dev.db') + '\n');
    await fs.writeFile(path.join(dir, 'next.config.mjs'), 'export default { experimental: { cpus: 2 } };\n');
} else {
    let revoked = false;
    const session = 'fixture.session.' + 'x'.repeat(40);
    const upstream = http.createServer(async (req, res) => {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const data = JSON.parse(raw || '{}');
        const ok = data.token === 'fixture-project' && (req.url === '/api/public/auth/login' ? data.password === 'fixture-admin-password' : !revoked && req.headers.authorization === 'Bearer ' + session);
        res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(req.url === '/api/public/auth/login' ? { ok, ...(ok ? { session } : {}) } : { ok, role: ok ? 'project-admin' : null }));
    });
    await new Promise(resolve => upstream.listen(4761, '127.0.0.1', resolve));
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '4762', '-H', '127.0.0.1'], { cwd: dir, env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'ignore', 'inherit'] });
    const call = (url, options = {}) => fetch(appUrl + url, { ...options, signal: AbortSignal.timeout(10000) });
    try {
        let ready = false;
        for (let i = 0; i < 100; i++) { try { if ((await call('/login')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
        assert.ok(ready, 'Next server ready');
        assert.match(await (await call('/login')).text(), /كلمة مرور الأدمن/);
        assert.equal((await call('/api/accounts')).status, 401);
        const login = await call('/api/admin/login', { method: 'POST', headers: { Origin: appUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'fixture-admin-password' }) });
        assert.equal(login.status, 200);
        assert.deepEqual(await login.json(), { ok: true });
        const cookieHeader = login.headers.get('set-cookie');
        for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(cookieHeader.includes(flag));
        const cookie = cookieHeader.split(';')[0];
        assert.equal((await call('/api/admin/session', { headers: { Cookie: cookie } })).status, 200);
        const write = { method: 'POST', headers: { Cookie: cookie, Origin: appUrl, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'صاحب المشروع', email: 'owner@example.test' }) };
        assert.equal((await call('/api/accounts', { ...write, headers: { ...write.headers, Origin: 'https://attacker.test' } })).status, 403);
        assert.equal((await call('/api/accounts', write)).status, 201);
        const rows = await (await call('/api/accounts', { headers: { Cookie: cookie } })).json();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].email, 'owner@example.test');
        const update = await call('/api/accounts/' + rows[0].id, { ...write, method: 'PUT', body: JSON.stringify({ name: 'اسم محدث' }) });
        assert.equal(update.status, 200);
        assert.equal((await (await call('/api/accounts', { headers: { Cookie: cookie } })).json())[0].name, 'اسم محدث');
        assert.equal((await call('/api/accounts/' + rows[0].id, { method: 'DELETE', headers: write.headers })).status, 200);
        assert.deepEqual(await (await call('/api/accounts', { headers: { Cookie: cookie } })).json(), []);
        revoked = true;
        assert.equal((await call('/api/accounts', { headers: { Cookie: cookie } })).status, 401);
        const out = await call('/api/admin/logout', { method: 'POST', headers: { Cookie: cookie, Origin: appUrl } });
        assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
        assert.equal((await call('/api/accounts')).status, 401);
        console.log('Generated admin flow: login, database create/read/edit/delete, CSRF, revocation and logout passed.');
    } finally { child.kill('SIGTERM'); await new Promise(resolve => upstream.close(resolve)); }
}
