// 📐 عقد Capability في مسار الإضافات الحقيقي: PluginLoader يتحقّق من
// manifest.capabilities، وPluginOrchestrator يفهرسها — على مجلد إضافات مؤقّت.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadPluginsFrom } from '../core/PluginLoader.js';
import { PluginOrchestrator } from '../core/PluginOrchestrator.js';
import { isCapabilityName, validateCapabilities } from '../core/contracts/index.js';

function pluginsDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-plugins-'));
    for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), src);
    return dir;
}
const manifest = (extra) => `export default { name: ${JSON.stringify(extra.name)}, type: 'agent', ${extra.body || ''}
    hooks: { async registerAgent() { return { name: ${JSON.stringify(extra.agent || extra.name)}, handler: async () => ({ ok: true }) }; } } };`;

test('isCapabilityName/validateCapabilities: domain.action فقط، تنقية التكرار، وتسمية المرفوض', () => {
    for (const ok of ['site.check', 'travel.booking', 'finance.swap-v2', 'a.b.c']) assert.ok(isCapabilityName(ok), ok);
    for (const bad of ['site', 'Site.Check', 'site.', '.check', 'site check', '', 42, null]) assert.ok(!isCapabilityName(bad), String(bad));
    assert.deepEqual(validateCapabilities(undefined), { ok: true, capabilities: [], invalid: [] });
    assert.deepEqual(validateCapabilities(['site.check', 'site.check', 'x']), { ok: false, capabilities: ['site.check'], invalid: ['x'] });
    assert.equal(validateCapabilities('site.check').ok, false);
});

test('PluginLoader: القدرات الصالحة تُحمَّل مُنقّاة، والاسم المرفوض يُسقط الإضافة بخطأ يسمّيه، وبلا capabilities = []', async () => {
    const dir = pluginsDir({
        'good.js': manifest({ name: 'good', body: "capabilities: ['site.check', 'site.check', 'seo.audit']," }),
        'bad.js': manifest({ name: 'bad', body: "capabilities: ['site.check', 'NotValid']," }),
        'plain.js': manifest({ name: 'plain' }),
    });
    const { loaded, errors } = await loadPluginsFrom(dir);
    const byName = Object.fromEntries(loaded.map((m) => [m.name, m]));
    assert.deepEqual(byName.good.capabilities, ['site.check', 'seo.audit']);
    assert.deepEqual(byName.plain.capabilities, []);
    assert.equal(byName.bad, undefined);
    assert.equal(errors.length, 1);
    assert.match(errors[0].error, /capabilities غير صالحة.*NotValid/);
});

test('PluginOrchestrator: فهرس القدرات يتبع التفعيل فوراً، وstatus يعرضه', async () => {
    const dir = pluginsDir({
        'a.js': manifest({ name: 'checker-a', agent: 'a', body: "capabilities: ['site.check']," }),
        'b.js': manifest({ name: 'checker-b', agent: 'b', body: "capabilities: ['site.check', 'seo.audit']," }),
    });
    const orch = new PluginOrchestrator();
    const status = await orch.init(dir);
    assert.equal(status.capabilities.length, 3);
    assert.deepEqual(status.plugins.find((p) => p.name === 'checker-b').capabilities, ['site.check', 'seo.audit']);
    // تعطيل إضافة يُخرج قدراتها من الفهرس فوراً (لا إعادة تحميل)
    orch.setEnabled('checker-b', false);
    const caps = orch.capabilities().map((e) => `${e.plugin}:${e.capability}`);
    assert.deepEqual(caps, ['checker-a:site.check'], 'قدرات المعطَّلة تختفي');
    assert.equal(orch.status().capabilities.length, 1);
});
