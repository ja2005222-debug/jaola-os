import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { installDataSync } from '../services/dataSync.js';

const systems = listClones().map(meta => getCloneById(meta.id)).filter(clone => clone.track === 'system');
for (const clone of systems) {
    test(`${clone.id}: installs authenticated transactions and preserves bootstrap on republish`, () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-runtime-'));
        try {
            for (const file of clone.files) {
                const target = path.join(dir, file.name);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, file.content);
            }
            const options = { apiBase: 'https://api.example.test', token: 'project-token' };
            assert.equal(installDataSync(dir, options).ready, true);
            const script = fs.readFileSync(path.join(dir, 'jaola-data.js'), 'utf8');
            new vm.Script(script);
            assert.match(script, /function projectSessionClient/);
            assert.match(script, /function transactionSyncClient/);
            assert.match(script, /api\/public\/data\/transaction/);
            const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
            assert.equal((html.match(/src="jaola-data.js"/g) || []).length, 1);
            assert.doesNotMatch(html, /<script[^>]+src=["'](?:\.\/)?app\.js["']/);
            assert.equal(installDataSync(dir, options).ready, true);
            assert.equal(fs.readFileSync(path.join(dir, 'jaola-data.js'), 'utf8'), script);
        } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
}

test('system deployment stops if runtime installation fails or cannot recognize bootstrap', async () => {
    const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
    const start = server.indexOf("app.post('/api/deploy'");
    const end = server.indexOf('// 🧭 مشاريع full-stack', start);
    const source = server.slice(start, end) + 'res.json({ deployed: true }); });';
    for (const [installation, dataReady] of [[() => ({ skipped: true }), true], [() => { throw Error('disk full'); }, true], [() => ({ ready: true }), true], [() => ({ ready: true }), false]]) {
        let handler, status = 200, body;
        vm.runInNewContext(source, {
            app: { post: (...args) => { handler = args.at(-1); } },
            verifyToken() {}, validateProjectOwnership() {},
            getCloneId: () => null, getCloneTrack: () => 'system', installDataSync: installation,
            transactionStore: () => ({ snapshot: async () => { if (!dataReady) throw Error('database unavailable'); return { revision: 0, data: {} }; } }),
            installSiteConnect() {}, applySeoPack() {}, signBotToken: () => 'token',
            process: { env: { PUBLIC_BACKEND_URL: 'https://api.example.test' } },
        });
        const req = { user: { username: 'owner' }, activeProject: 'project', projectPath: '/project' };
        const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
        await handler(req, res);
        if (installation.toString().includes('ready: true') && dataReady) assert.equal(body.deployed, true);
        else { assert.ok([409, 503].includes(status)); assert.equal(body.deployed, undefined); }
    }
});

for (const meta of listClones()) {
    const clone = getCloneById(meta.id);
    const js = clone.files.find(file => file.name === 'app.js')?.content || '';
    for (const match of js.matchAll(/function (save\w*)\([^)]*\) \{ localStorage\.setItem[^\n]+\}/g)) {
        test(`${clone.id}/${match[1]}: storage failure interrupts the action instead of reporting silent success`, () => {
            const context = vm.createContext({ state: { orders: [], customer: {}, bookings: [] }, localStorage: { setItem() { throw Error('storage unavailable'); } } });
            vm.runInContext(match[0], context);
            assert.throws(() => vm.runInContext(`${match[1]}("items", [{id:1}])`, context), /storage unavailable/);
        });
    }
}
