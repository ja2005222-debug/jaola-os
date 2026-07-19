// 🖥️ الخيار (ب): خادم دائم على Render بدل Serverless — يزيل حدّ 12 دالة.
// المرحلة أ: توليد server.js حقيقي (كان render.yaml يستدعي node server.js بلا ملف).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateServerEntry, generateRenderConfig, prepareRenderDeploy, buildRenderDeployUrl, deployToRender } from '../agents/renderAgent.js';

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

// ─── المرحلة ب: النشر بنصف-أتمتة (زر Deploy to Render بلا مفتاح API) ───
test('رابط Deploy to Render: يبنى من مستودع GitHub، ينظّف .git والشرطة', () => {
    assert.equal(
        buildRenderDeployUrl('https://github.com/jamal/shop.git'),
        'https://render.com/deploy?repo=' + encodeURIComponent('https://github.com/jamal/shop')
    );
    assert.equal(
        buildRenderDeployUrl('https://github.com/jamal/shop/'),
        'https://render.com/deploy?repo=' + encodeURIComponent('https://github.com/jamal/shop')
    );
});

test('رابط Deploy to Render: فرع غير main يُضاف كمعامل', () => {
    const url = buildRenderDeployUrl('https://github.com/jamal/shop', 'dev');
    assert.match(url, /&branch=dev$/);
    // main لا يُضاف (افتراضي)
    assert.doesNotMatch(buildRenderDeployUrl('https://github.com/jamal/shop', 'main'), /branch=/);
});

test('رابط Deploy to Render: رابط غير GitHub صالح → null', () => {
    assert.equal(buildRenderDeployUrl('https://gitlab.com/x/y'), null);
    assert.equal(buildRenderDeployUrl(''), null);
    assert.equal(buildRenderDeployUrl(null), null);
});

test('deployToRender: بلا مستودع GitHub → needsGitHub (Render ينشر من GitHub)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-r-nogh-'));
    const r = await deployToRender(
        { projectPath: dir, projectName: 'jamal-shop', username: 'jamal', activeProject: 'shop', hasBackend: true },
        null, 'room',
        { getIntegration: async () => null, pushProject: async () => ({ success: true }) }
    );
    assert.equal(r.success, false);
    assert.equal(r.needsGitHub, true);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('deployToRender: مع مستودع → يدفع ويعيد رابط النشر', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-r-ok-'));
    let pushed = false;
    const r = await deployToRender(
        { projectPath: dir, projectName: 'jamal-shop', username: 'jamal', activeProject: 'shop', hasBackend: true },
        null, 'room',
        {
            getIntegration: async () => ({ repoUrl: 'https://github.com/jamal/shop', branch: 'main' }),
            pushProject: async () => { pushed = true; return { success: true }; },
        }
    );
    assert.equal(r.success, true, r.error);
    assert.equal(pushed, true, 'دفع إلى GitHub قبل النشر');
    assert.match(r.deployUrl, /^https:\/\/render\.com\/deploy\?repo=/);
    assert.ok(fs.existsSync(path.join(dir, 'server.js')), 'جهّز server.js');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('deployToRender: فشل الدفع → خطأ واضح (لا رابط)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-r-fail-'));
    const r = await deployToRender(
        { projectPath: dir, projectName: 'jamal-shop', username: 'jamal', activeProject: 'shop', hasBackend: true },
        null, 'room',
        {
            getIntegration: async () => ({ repoUrl: 'https://github.com/jamal/shop', branch: 'main' }),
            pushProject: async () => ({ success: false, error: 'auth rejected' }),
        }
    );
    assert.equal(r.success, false);
    assert.match(r.error, /auth rejected/);
    fs.rmSync(dir, { recursive: true, force: true });
});
