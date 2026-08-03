/**
 * 🧪 اختبارات خدمة الفيديو — دورة كاملة بلا شبكة ولا مفاتيح حقيقية
 *
 * النمط: createApp بمجلد مؤقت + مزود محاكاة، خادم على منفذ عشوائي،
 * والمحرك يُشغَّل يدوياً (runEngineTick) بلا مؤقتات — حتمية كاملة.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

import { createApp, MAX_ACTIVE_JOBS_PER_USER } from '../server.js';
import { createMockProvider } from '../src/providers/mockProvider.js';
import { specToShotstackTimeline } from '../src/providers/shotstackProvider.js';
import { runEngineTick, JOB_TIMEOUT_MS } from '../src/engine.js';
import { getBalance, grantCredits, deductCredits, refundCredits, STARTER_CREDITS } from '../src/credits.js';
import { getTemplate, validateValues, compileSpec, listTemplates } from '../src/templates.js';
import { createJob, getJob, transitionJob, listActiveJobs } from '../src/jobs.js';

const JWT_SECRET = 'test-secret-not-for-production';
let dir;          // مجلد بيانات مؤقت — يُعاد إنشاؤه لكل اختبار
let server;
let baseUrl;
let provider;

function makeToken(username, extra = {}) {
    return jwt.sign({ id: username, username, ...extra }, JWT_SECRET, { expiresIn: '1h' });
}

async function call(pathname, { method = 'GET', token = null, body = null } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${pathname}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
}

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'videostudio-test-'));
    provider = createMockProvider({ pollsToComplete: 2 });
    const app = createApp({
        dataDir: dir,
        jwtSecret: JWT_SECRET,
        adminUsersCsv: 'boss',
        provider,
    });
    await new Promise(resolve => { server = app.listen(0, resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

beforeEach(() => {
    // عزل كل اختبار: تصفير ملفات البيانات (الخادم نفسه يبقى حياً).
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
});

// ─── المصادقة (الدخول الموحد) ──────────────────────────────────────────

test('كل مسارات /api/video ترفض الطلب بلا توكن (401)', async () => {
    for (const p of ['/api/video/templates', '/api/video/credits', '/api/video/renders']) {
        const res = await call(p);
        assert.equal(res.status, 401, p);
    }
});

test('توكن موقَّع بسر مختلف يُرفض — لا يكفي أن يكون JWT صالح الشكل', async () => {
    const foreign = jwt.sign({ username: 'x' }, 'wrong-secret');
    const res = await call('/api/video/credits', { token: foreign });
    assert.equal(res.status, 401);
});

test('توكن المنصة الصحيح يمر — نفس السر يعني نفس تسجيل الدخول', async () => {
    const res = await call('/api/video/templates', { token: makeToken('jamal') });
    assert.equal(res.status, 200);
    assert.ok(res.data.templates.length >= 3);
});

test('مسار الصحة عام بلا توكن ويُظهر اسم المزود', async () => {
    const res = await call('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.provider, 'mock');
});

// ─── الأرصدة ───────────────────────────────────────────────────────────

test('أول تعامل يمنح الرصيد الترحيبي مرة واحدة فقط', async () => {
    const token = makeToken('newuser');
    const first = await call('/api/video/credits', { token });
    assert.equal(first.data.credits, STARTER_CREDITS);
    assert.equal(first.data.ledger[0].kind, 'starter');
    const second = await call('/api/video/credits', { token });
    assert.equal(second.data.credits, STARTER_CREDITS); // لا منح ثانٍ
});

test('المنح الإداري: المشرف فقط، ويرفض القيم غير الصالحة', async () => {
    const admin = makeToken('boss');
    const normal = makeToken('jamal');

    const denied = await call('/api/video/admin/credits/grant', {
        method: 'POST', token: normal, body: { username: 'jamal', amount: 100 },
    });
    assert.equal(denied.status, 403);

    const ok = await call('/api/video/admin/credits/grant', {
        method: 'POST', token: admin, body: { username: 'jamal', amount: 10 },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.credits, STARTER_CREDITS + 10);

    for (const bad of [0, -5, 2.5, 'abc']) {
        const res = await call('/api/video/admin/credits/grant', {
            method: 'POST', token: admin, body: { username: 'jamal', amount: bad },
        });
        assert.equal(res.status, 400, `amount=${bad}`);
    }
});

test('علامة isAdmin في التوكن تكفي للمسارات الإدارية (نفس عقد المنصة)', async () => {
    const res = await call('/api/video/admin/status', {
        token: makeToken('someone', { isAdmin: true }),
    });
    assert.equal(res.status, 200);
});

test('الاسترداد معصوم من الازدواج لكل مهمة (idempotent)', () => {
    grantCredits(dir, { username: 'u1', amount: 10, grantedBy: 'test' });
    const before = getBalance(dir, 'u1');
    assert.equal(refundCredits(dir, { username: 'u1', amount: 2, jobId: 'j-1' }), true);
    assert.equal(refundCredits(dir, { username: 'u1', amount: 2, jobId: 'j-1' }), false);
    assert.equal(getBalance(dir, 'u1'), before + 2); // مرة واحدة فقط
});

// ─── القوالب والتحقق ───────────────────────────────────────────────────

test('التحقق يرفض: حقل مطلوب مفقود، لون غير صالح، رابط غير http، حقل مجهول', () => {
    const t = getTemplate('promo_announcement');
    assert.ok(validateValues(t, { cta: 'اشترِ' }).error);                       // headline مفقود
    assert.ok(validateValues(t, { headline: 'أ', cta: 'ب', bgColor: 'red' }).error);
    assert.ok(validateValues(t, { headline: 'أ', cta: 'ب', hack: '1' }).error);
    const p = getTemplate('product_showcase');
    assert.ok(validateValues(p, {
        productName: 'أ', price: '9', imageUrl: 'javascript:alert(1)',
    }).error);
});

test('التحقق يقبل مدخلات سليمة ويطبق الافتراضيات ويقص الفراغات', () => {
    const t = getTemplate('promo_announcement');
    const r = validateValues(t, { headline: '  عرض اليوم  ', cta: 'اطلب الآن' });
    assert.equal(r.error, undefined);
    assert.equal(r.values.headline, 'عرض اليوم');
    assert.equal(r.values.bgColor, '#1F4E5F'); // الافتراضي
});

test('compileSpec ينتج مخططاً محايداً سليماً لكل قالب في الكتالوج', () => {
    const samples = {
        promo_announcement: { headline: 'أ', cta: 'ب' },
        product_showcase: { productName: 'أ', price: '9', imageUrl: 'https://x.test/i.png' },
        story_slides: { slide1: '١', slide2: '٢', slide3: '٣' },
    };
    for (const t of listTemplates()) {
        const full = getTemplate(t.id);
        const v = validateValues(full, samples[t.id]);
        assert.equal(v.error, undefined, t.id);
        const spec = compileSpec(full, v.values);
        assert.equal(spec.durationSec, full.durationSec, t.id);
        assert.ok(spec.scenes.length >= 1, t.id);
    }
});

test('ترجمة Shotstack: كل مشهد يتحول لمقاطع بأزمنة صحيحة', () => {
    const t = getTemplate('story_slides');
    const v = validateValues(t, { slide1: '١', slide2: '٢', slide3: '٣' }).values;
    const timeline = specToShotstackTimeline(compileSpec(t, v));
    const clips = timeline.tracks[0].clips;
    assert.equal(clips.length, 3);
    assert.deepEqual(clips.map(c => c.start), [0, 5, 10]);
    assert.equal(timeline.background, '#1E1B4B');
});

// ─── دورة حياة المهمة الكاملة ──────────────────────────────────────────

test('الدورة السعيدة: إنشاء → خصم → إرسال → تصدير → اكتمال', async () => {
    const token = makeToken('jamal');
    await call('/api/video/credits', { token }); // يفعّل الرصيد الترحيبي

    const created = await call('/api/video/renders', {
        method: 'POST', token,
        body: { templateId: 'promo_announcement', values: { headline: 'عرض', cta: 'اطلب' } },
    });
    assert.equal(created.status, 200);
    const jobId = created.data.job.id;

    // الخصم وقع فوراً قبل أي معالجة
    const credits = await call('/api/video/credits', { token });
    assert.equal(credits.data.credits, STARTER_CREDITS - 1);

    // الدورة 1: إرسال للمزود → rendering
    await runEngineTick(dir, { provider });
    assert.equal(getJob(dir, jobId).status, 'rendering');

    // الدورتان 2 و3: المحاكاة تكتمل بعد استطلاعين
    await runEngineTick(dir, { provider });
    await runEngineTick(dir, { provider });
    const done = getJob(dir, jobId);
    assert.equal(done.status, 'done');
    assert.equal(done.videoUrl, null); // المحاكاة لا تفبرك روابط

    // لا استرداد لمهمة ناجحة
    const after = await call('/api/video/credits', { token });
    assert.equal(after.data.credits, STARTER_CREDITS - 1);
});

test('رصيد غير كافٍ: 402، المهمة تُحسم فشلاً، ولا خصم', async () => {
    const token = makeToken('poor');
    await call('/api/video/credits', { token });
    // story_slides يكلف 2 — نستنزف الرصيد إلى 1 عبر مهمتين promo (1+1)
    for (let i = 0; i < 2; i++) {
        await call('/api/video/renders', {
            method: 'POST', token,
            body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
        });
    }
    assert.equal((await call('/api/video/credits', { token })).data.credits, 1);

    const res = await call('/api/video/renders', {
        method: 'POST', token,
        body: { templateId: 'story_slides', values: { slide1: '١', slide2: '٢', slide3: '٣' } },
    });
    assert.equal(res.status, 402);
    assert.equal((await call('/api/video/credits', { token })).data.credits, 1); // لم يُمس
    // ولم تدخل الطابور
    assert.equal(listActiveJobs(dir).filter(j => j.templateId === 'story_slides').length, 0);
});

test('فشل التصدير لدى المزود: المهمة failed والرصيد يُسترد تلقائياً', async () => {
    grantCredits(dir, { username: 'u2', amount: 5, grantedBy: 'test' });
    const t = getTemplate('promo_announcement');
    const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
    const spec = { ...compileSpec(t, v), _forceFail: true };
    const job = createJob(dir, {
        username: 'u2', templateId: t.id, values: v, spec, costCredits: 1,
    });
    assert.ok(require_deduct(dir, 'u2', job.id));
    const before = getBalance(dir, 'u2');

    await runEngineTick(dir, { provider }); // إرسال
    await runEngineTick(dir, { provider }); // استطلاع → فشل
    const failed = getJob(dir, job.id);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.refunded, true);
    assert.equal(getBalance(dir, 'u2'), before + 1);
});

test('فشل الإرسال نفسه للمزود: فشل فوري مع استرداد', async () => {
    grantCredits(dir, { username: 'u3', amount: 5, grantedBy: 'test' });
    const t = getTemplate('promo_announcement');
    const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
    const spec = { ...compileSpec(t, v), _forceSubmitError: true };
    const job = createJob(dir, {
        username: 'u3', templateId: t.id, values: v, spec, costCredits: 1,
    });
    assert.ok(require_deduct(dir, 'u3', job.id));
    const before = getBalance(dir, 'u3');

    await runEngineTick(dir, { provider });
    assert.equal(getJob(dir, job.id).status, 'failed');
    assert.equal(getBalance(dir, 'u3'), before + 1);
});

test('المهلة القصوى: مهمة معلقة تُفشَل ويُسترد رصيدها', async () => {
    grantCredits(dir, { username: 'u4', amount: 5, grantedBy: 'test' });
    const t = getTemplate('promo_announcement');
    const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
    const job = createJob(dir, {
        username: 'u4', templateId: t.id, values: v,
        spec: compileSpec(t, v), costCredits: 1,
    });
    assert.ok(require_deduct(dir, 'u4', job.id));
    const before = getBalance(dir, 'u4');

    await runEngineTick(dir, { provider }); // أُرسلت → rendering
    // دورة "في المستقبل" بعد تجاوز المهلة
    await runEngineTick(dir, { provider, now: Date.now() + JOB_TIMEOUT_MS + 1000 });
    const timedOut = getJob(dir, job.id);
    assert.equal(timedOut.status, 'failed');
    assert.equal(getBalance(dir, 'u4'), before + 1);
});

test('مصالحة إعادة التشغيل: مهمة rendering قديمة تُستكمل من أول دورة جديدة', async () => {
    // نحاكي "عملية سابقة" بإنشاء مهمة وإرسالها ثم "التعطل" (لا شيء في
    // الذاكرة بعدها) — الدورة الجديدة تقرأ jobs.json وتكمل الاستطلاع.
    grantCredits(dir, { username: 'u5', amount: 5, grantedBy: 'test' });
    const t = getTemplate('promo_announcement');
    const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
    const job = createJob(dir, {
        username: 'u5', templateId: t.id, values: v,
        spec: compileSpec(t, v), costCredits: 1,
    });
    await runEngineTick(dir, { provider });
    assert.equal(getJob(dir, job.id).status, 'rendering');

    // "إعادة التشغيل": المحرك عديم الحالة أصلاً — دورتان تكملان المهمة
    await runEngineTick(dir, { provider });
    await runEngineTick(dir, { provider });
    assert.equal(getJob(dir, job.id).status, 'done');
});

test('سقف التزامن: لا يُرسل أكثر من مهمتين معاً والبقية تنتظر دورها', async () => {
    grantCredits(dir, { username: 'u6', amount: 10, grantedBy: 'test' });
    const t = getTemplate('promo_announcement');
    const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
    for (let i = 0; i < 4; i++) {
        createJob(dir, {
            username: 'u6', templateId: t.id, values: v,
            spec: compileSpec(t, v), costCredits: 1,
        });
    }
    await runEngineTick(dir, { provider });
    const active = listActiveJobs(dir);
    assert.equal(active.filter(j => j.status === 'rendering').length, 2);
    assert.equal(active.filter(j => j.status === 'queued').length, 2);
});

// ─── العزل بين المستخدمين ─────────────────────────────────────────────

test('المستخدم لا يرى مهام غيره — القائمة معزولة والوصول المباشر 404', async () => {
    const tokenA = makeToken('usera');
    const tokenB = makeToken('userb');
    await call('/api/video/credits', { token: tokenA });
    const created = await call('/api/video/renders', {
        method: 'POST', token: tokenA,
        body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
    });
    const jobId = created.data.job.id;

    const listB = await call('/api/video/renders', { token: tokenB });
    assert.equal(listB.data.jobs.length, 0);

    const directB = await call(`/api/video/renders/${jobId}`, { token: tokenB });
    assert.equal(directB.status, 404); // لا 403 — لا نؤكد حتى الوجود

    const directA = await call(`/api/video/renders/${jobId}`, { token: tokenA });
    assert.equal(directA.status, 200);
});

test('سقف المهام النشطة لكل مستخدم يمنع إغراق الطابور', async () => {
    const token = makeToken('flooder');
    await call('/api/video/credits', { token });
    grantCredits(dir, { username: 'flooder', amount: 20, grantedBy: 'test' });

    for (let i = 0; i < MAX_ACTIVE_JOBS_PER_USER; i++) {
        const res = await call('/api/video/renders', {
            method: 'POST', token,
            body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
        });
        assert.equal(res.status, 200, `job ${i}`);
    }
    const overflow = await call('/api/video/renders', {
        method: 'POST', token,
        body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
    });
    assert.equal(overflow.status, 429);
});

// ─── سلامة انتقالات الحالة ─────────────────────────────────────────────

test('انتقالات الحالة المحظورة تُرفض (لا إحياء لمهمة منتهية)', () => {
    const t = getTemplate('promo_announcement');
    const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
    const job = createJob(dir, {
        username: 'u7', templateId: t.id, values: v,
        spec: compileSpec(t, v), costCredits: 1,
    });
    assert.equal(transitionJob(dir, job.id, 'done'), null);       // queued → done ممنوع
    assert.ok(transitionJob(dir, job.id, 'failed'));
    assert.equal(transitionJob(dir, job.id, 'queued'), null);     // لا إحياء
    assert.equal(transitionJob(dir, job.id, 'rendering'), null);
});

// أداة مساعدة: خصم رصيد مهمة مُنشأة يدوياً — تُبقي الاختبارات مقروءة.
function require_deduct(d, username, jobId) {
    return deductCredits(d, { username, amount: 1, jobId });
}
