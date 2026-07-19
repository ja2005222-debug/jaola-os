// 🖥️ الخيار (ب): خادم دائم على Render بدل Serverless — يزيل حدّ 12 دالة.
// المرحلة أ: توليد server.js حقيقي (كان render.yaml يستدعي node server.js بلا ملف).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateServerEntry, generateRenderConfig, prepareRenderDeploy } from '../agents/renderAgent.js';

test('server.js: يخدم الواجهة + يركّب api ديناميكياً + يتصل بـ Mongo + PORT', () => {
    const code = generateServerEntry();
    assert.match(code, /express\.static/, 'يخدم الواجهة الثابتة');
    assert.match(code, /\/api\/'/, 'يركّب مسارات api');
    assert.match(code, /readdirSync/, 'تحميل ديناميكي بلا حدّ عدد');
    assert.match(code, /process\.env\.MONGODB_URI/, 'اتصال قاعدة البيانات');
    assert.match(code, /process\.env\.PORT/, 'يستمع على PORT');
});

test('render.yaml للخادم: node + npm install + node server.js + MONGODB_URI', () => {
    const cfg = generateRenderConfig('x', true);
    assert.match(cfg, /env: node/);
    assert.match(cfg, /startCommand: node server\.js/);
    assert.match(cfg, /MONGODB_URI/);
});

test('prepareRenderDeploy(hasBackend): يكتب server.js + render.yaml فعلياً', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-render-'));
    const r = await prepareRenderDeploy(dir, 'jamal-delv', true);
    assert.equal(r.success, true);
    assert.ok(fs.existsSync(path.join(dir, 'server.js')), 'server.js مكتوب');
    assert.ok(fs.existsSync(path.join(dir, 'render.yaml')), 'render.yaml مكتوب');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('موقع ثابت (بلا خادم): لا server.js', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-static-'));
    await prepareRenderDeploy(dir, 'brochure', false);
    assert.equal(fs.existsSync(path.join(dir, 'server.js')), false, 'الموقع الثابت لا يحتاج server.js');
    fs.rmSync(dir, { recursive: true, force: true });
});
