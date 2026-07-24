// 🚀 أتمتة نشر Full-Stack (الجولة أ): زر واحد → رابط حيّ.
// كل الخارجيّات (fetch/تكامل GitHub/دفع/تجهيز Render) محقونة — لا شبكة ولا DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// secretVault يتطلّب مفتاح تشفير في البيئة (اختبار فقط — لا يمسّ الإنتاج)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
import {
    safeSlug, platformGithubReady, renderReady, fullAutomationReady,
    ensureProjectRepo, ensureRenderService, autoDeployFullStack,
} from '../services/deployAutomation.js';

const ENV_FULL = { GITHUB_PLATFORM_TOKEN: 'ghp_x', RENDER_API_KEY: 'rnd_x' };

// fetch وهمي مبنيّ على جدول مسارات: url يحوي المفتاح → الردّ المسجّل
function fakeFetch(routes, log = []) {
    return async (url, options = {}) => {
        log.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
        for (const [key, resp] of routes) {
            if (url.includes(key) && (!resp.method || resp.method === (options.method || 'GET'))) {
                return { ok: resp.status < 400, status: resp.status, json: async () => resp.body };
            }
        }
        return { ok: false, status: 404, json: async () => ({ message: 'not found' }) };
    };
}

test('الجاهزية: بلا مفاتيح → غير مهيّأة؛ بالمفتاحين → أتمتة كاملة', () => {
    assert.equal(fullAutomationReady({}), false);
    assert.equal(platformGithubReady({ GITHUB_PLATFORM_TOKEN: 'x' }), true);
    assert.equal(renderReady({ RENDER_API_KEY: 'x' }), true);
    assert.equal(fullAutomationReady(ENV_FULL), true);
});

test('safeSlug: تعقيم أسماء المستودعات/الخدمات', () => {
    assert.equal(safeSlug('Jamal_متجر Online!!'), 'jamal-online');
    assert.equal(safeSlug('--a--b--'), 'a-b');
});

test('ensureProjectRepo: مستودع مرتبط موجود → يُعاد كما هو بلا إنشاء', async () => {
    const r = await ensureProjectRepo({
        username: 'jamal', project: 'shop',
        deps: { env: ENV_FULL, getIntegration: async () => ({ repoUrl: 'https://github.com/jamal/my-shop', branch: 'main' }), fetchImpl: fakeFetch([]) },
    });
    assert.equal(r.success, true);
    assert.equal(r.created, false);
    assert.equal(r.repoUrl, 'https://github.com/jamal/my-shop');
});

test('ensureProjectRepo: يرفض مستودع المنصّة المرتبط', async () => {
    const r = await ensureProjectRepo({
        username: 'jamal', project: 'shop',
        deps: { env: ENV_FULL, getIntegration: async () => ({ repoUrl: 'https://github.com/ja2005222-debug/jaola-os' }) },
    });
    assert.equal(r.success, false);
});

test('ensureProjectRepo: لا مستودع → يُنشأ تلقائياً ويُحفظ الربط مشفّراً', async () => {
    const log = [];
    const saved = [];
    const fetchImpl = fakeFetch([
        ['/user/repos', { status: 201, method: 'POST', body: { html_url: 'https://github.com/platform-bot/jaola-jamal-shop' } }],
        ['/user', { status: 200, body: { login: 'platform-bot' } }],
    ], log);
    const r = await ensureProjectRepo({
        username: 'jamal', project: 'shop',
        deps: {
            env: ENV_FULL, fetchImpl,
            getIntegration: async () => null,
            saveIntegration: async (u, p, gh) => { saved.push({ u, p, gh }); return true; },
        },
    });
    assert.equal(r.success, true, r.error);
    assert.equal(r.created, true);
    assert.ok(r.repoUrl.includes('jaola-jamal-shop'));
    // الربط حُفظ بتوكن مشفّر (لا خام) وبنفس بنية التكامل الحالية
    assert.equal(saved.length, 1);
    assert.equal(saved[0].gh.repoUrl, r.repoUrl);
    assert.ok(saved[0].gh.patEncrypted && !saved[0].gh.patEncrypted.includes('ghp_x'), 'التوكن لا يُخزَّن خاماً');
    // أُرسل طلب إنشاء خاص (private)
    const create = log.find(l => l.url.endsWith('/user/repos'));
    assert.equal(create.body.private, true);
});

test('ensureProjectRepo: 422 (موجود مسبقاً) → يُعاد استخدامه بأمان', async () => {
    const fetchImpl = fakeFetch([
        ['/user/repos', { status: 422, method: 'POST', body: { message: 'name already exists' } }],
        ['/user', { status: 200, body: { login: 'platform-bot' } }],
    ]);
    const r = await ensureProjectRepo({
        username: 'jamal', project: 'shop',
        deps: { env: ENV_FULL, fetchImpl, getIntegration: async () => null, saveIntegration: async () => true },
    });
    assert.equal(r.success, true, r.error);
    assert.equal(r.created, false);
    assert.equal(r.repoUrl, 'https://github.com/platform-bot/jaola-jamal-shop');
});

test('ensureRenderService: خدمة جديدة → إنشاء بالمالك المكتشف + رابط حيّ', async () => {
    const log = [];
    const fetchImpl = fakeFetch([
        ['/services?name=', { status: 200, body: [] }],
        ['/owners', { status: 200, body: [{ owner: { id: 'own-1' } }] }],
        ['/services', { status: 201, method: 'POST', body: { service: { id: 'srv-1', serviceDetails: { url: 'https://jamal-shop.onrender.com' } } } }],
    ], log);
    const r = await ensureRenderService({
        name: 'jamal-shop', repoUrl: 'https://github.com/platform-bot/jaola-jamal-shop.git',
        envVars: { MONGODB_URI: 'mongodb://x', NODE_ENV: 'production' },
        deps: { env: ENV_FULL, fetchImpl },
    });
    assert.equal(r.success, true, r.error);
    assert.equal(r.created, true);
    assert.equal(r.url, 'https://jamal-shop.onrender.com');
    const create = log.find(l => l.method === 'POST' && l.url.endsWith('/services'));
    assert.equal(create.body.repo, 'https://github.com/platform-bot/jaola-jamal-shop', 'بلا ‎.git');
    assert.equal(create.body.serviceDetails.envSpecificDetails.startCommand, 'node server.js');
    assert.ok(create.body.envVars.some(v => v.key === 'MONGODB_URI'), 'الأسرار محقونة');
});

test('ensureRenderService: خدمة موجودة → تحديث الأسرار + إعادة نشر (لا إنشاء)', async () => {
    const log = [];
    const fetchImpl = fakeFetch([
        ['/services?name=', { status: 200, body: [{ service: { id: 'srv-9', name: 'jamal-shop', serviceDetails: { url: 'https://jamal-shop.onrender.com' } } }] }],
        ['/env-vars', { status: 200, method: 'PUT', body: [] }],
        ['/deploys', { status: 201, method: 'POST', body: { id: 'dep-1' } }],
    ], log);
    const r = await ensureRenderService({
        name: 'jamal-shop', repoUrl: 'https://github.com/x/y', envVars: { A: '1' },
        deps: { env: ENV_FULL, fetchImpl },
    });
    assert.equal(r.success, true, r.error);
    assert.equal(r.created, false);
    assert.ok(log.some(l => l.url.includes('/env-vars') && l.method === 'PUT'));
    assert.ok(log.some(l => l.url.includes('/deploys') && l.method === 'POST'));
    assert.ok(!log.some(l => l.method === 'POST' && l.url.endsWith('/services')), 'لا إنشاء مكرّر');
});

test('autoDeployFullStack: بلا مفاتيح منصّة → fallback (يكمل المسار النصف-آلي)', async () => {
    const r = await autoDeployFullStack({ username: 'u', project: 'p', projectPath: '/tmp/x', projectSlug: 'u-p', deps: { env: {} } });
    assert.equal(r.success, false);
    assert.equal(r.fallback, true);
});

test('autoDeployFullStack: المسار السعيد كاملاً → رابط حيّ + مستودع + خدمة', async () => {
    const fetchImpl = fakeFetch([
        ['/user/repos', { status: 201, method: 'POST', body: { html_url: 'https://github.com/platform-bot/jaola-u-p' } }],
        ['/user', { status: 200, body: { login: 'platform-bot' } }],
        ['/services?name=', { status: 200, body: [] }],
        ['/owners', { status: 200, body: [{ owner: { id: 'own-1' } }] }],
        ['/services', { status: 201, method: 'POST', body: { service: { id: 'srv-1', serviceDetails: { url: 'https://u-p.onrender.com' } } } }],
    ]);
    const pushed = [];
    const r = await autoDeployFullStack({
        username: 'u', project: 'p', projectPath: '/tmp/x', projectSlug: 'u-p',
        secrets: { MONGODB_URI: 'mongodb://secret' },
        deps: {
            env: ENV_FULL, fetchImpl,
            prepareRenderDeploy: async () => ({ success: true, summary: 'جاهز' }),
            getIntegration: async () => null,
            saveIntegration: async () => true,
            pushProject: async (u, p, path, ov) => { pushed.push(ov); return { success: true }; },
        },
    });
    assert.equal(r.success, true, r.error);
    assert.equal(r.liveUrl, 'https://u-p.onrender.com');
    assert.equal(r.repoCreated, true);
    assert.equal(r.serviceCreated, true);
    assert.equal(pushed[0].repoUrl, 'https://github.com/platform-bot/jaola-u-p', 'دُفع للمستودع المُنشأ');
});

test('autoDeployFullStack: فشل الدفع → خطأ صريح لا نجاح أجوف', async () => {
    const fetchImpl = fakeFetch([
        ['/user/repos', { status: 201, method: 'POST', body: { html_url: 'https://github.com/platform-bot/jaola-u-p' } }],
        ['/user', { status: 200, body: { login: 'platform-bot' } }],
    ]);
    const r = await autoDeployFullStack({
        username: 'u', project: 'p', projectPath: '/tmp/x', projectSlug: 'u-p',
        deps: {
            env: ENV_FULL, fetchImpl,
            prepareRenderDeploy: async () => ({ success: true }),
            getIntegration: async () => null, saveIntegration: async () => true,
            pushProject: async () => ({ success: false, error: 'رفض المصادقة' }),
        },
    });
    assert.equal(r.success, false);
    assert.ok(/الدفع/.test(r.error));
});
