import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { templateDefaults, readProjectDefaults } from '../services/templateDefaults.js';
import { listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
test('relative seed dates do not depend on host timezone or daylight saving', () => {
    const script = `import { templateDefaults } from ${JSON.stringify(new URL('../services/templateDefaults.js', import.meta.url).href)};
const source = "function futureDate(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); } function load(k, fb) { return localStorage.getItem('demo_' + k); } const rows = load('rows', [{expiry:futureDate(200)}]);";
console.log(JSON.stringify(await templateDefaults(source, {now:Date.UTC(2030,0,1)})));`;
    for (const TZ of ['UTC', 'America/Los_Angeles', 'Asia/Riyadh']) {
        const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8', timeout: 15000 }));
        assert.equal(JSON.parse(result.data.demo_rows)[0].expiry, '2030-07-20', TZ);
    }
});
const systems = listClones().map(meta => getCloneById(meta.id)).filter(clone => clone.track === 'system');
for (const clone of systems) {
    test(`${clone.id}: server can initialize the actual template defaults without executing its code`, async () => {
        const result = await templateDefaults(clone.files.find(file => file.name === 'app.js').content, { now: Date.UTC(2030, 0, 1), language: 'en' });
        assert.equal(result.ready, true, JSON.stringify(result.unresolved));
        assert.ok(Object.keys(result.data).length >= 2);
        assert.equal(Object.keys(result.data).some(key => key.endsWith('_session')), false);
        for (const value of Object.values(result.data)) assert.doesNotThrow(() => JSON.parse(value));
        if (clone.id === 'jaola-pharmacy') assert.equal(JSON.parse(result.data.jphar_meds)[0].expiry, '2030-07-20');
        if (clone.id === 'jaola-crypto-advisor') assert.equal(JSON.parse(result.data.jcrypto_lang), 'en');
    });
}
test('untrusted calls, getters, arbitrary imports and prototype keys are never evaluated', async () => {
    const load = "function load(k,fb){return localStorage.getItem('test_'+k)||fb;}\n";
    for (const expression of ['fetch("https://attacker.test")', '(globalThis.seedExecuted=true)', '({get secret(){throw Error("executed")}})', '({__proto__:{polluted:true}})']) {
        const result = await templateDefaults(load + 'const records = load("records", ' + expression + ');');
        assert.equal(result.ready, false);
        assert.deepEqual(result.data, {});
    }
    assert.equal(globalThis.seedExecuted, undefined);
    assert.equal({}.polluted, undefined);
});
test('filesystem reader respects HTML language and refuses symlinks to other projects', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-defaults-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const clone = getCloneById('jaola-stock-advisor');
    fs.writeFileSync(path.join(dir, 'app.js'), clone.files.find(file => file.name === 'app.js').content);
    fs.writeFileSync(path.join(dir, 'index.html'), '<html lang="en"></html>');
    assert.equal(JSON.parse((await readProjectDefaults(dir)).data.jstock_lang), 'en');
    fs.renameSync(path.join(dir, 'app.js'), path.join(dir, 'original.js'));
    fs.symlinkSync(path.join(dir, 'original.js'), path.join(dir, 'app.js'));
    await assert.rejects(readProjectDefaults(dir));
});
