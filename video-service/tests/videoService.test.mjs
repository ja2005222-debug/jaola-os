/**
 * 🧪 اختبارات خدمة الفيديو — نفس المجموعة كاملةً ضد **كلا المخزنين**
 *
 * الملفات دوماً، وPostgres أيضاً إذا ضُبط TEST_DATABASE_URL (مضبوط في CI
 * عبر حاوية خدمة postgres). هذا يمنع تباعد سلوك المخزنين بصمت — وهو
 * الخطر الحقيقي الوحيد في وجود تطبيقين للعقد نفسه.
 *
 * بلا شبكة ولا مفاتيح حقيقية: مزود محاكاة محقون، والمحرك يُشغَّل يدوياً
 * (runEngineTick) بلا مؤقتات — حتمية كاملة.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

import { createApp, MAX_ACTIVE_JOBS_PER_USER } from '../server.js';
import { createMockProvider } from '../src/providers/mockProvider.js';
import { buildProvider, buildAiProvider } from '../src/providers/index.js';
import { createFalProvider, extractVideoUrl, specToFalInput } from '../src/providers/falProvider.js';
import { specToShotstackTimeline } from '../src/providers/shotstackProvider.js';
import { runEngineTick, JOB_TIMEOUT_MS } from '../src/engine.js';
import { getBalance, grantCredits, deductCredits, refundCredits, STARTER_CREDITS } from '../src/credits.js';
import { getTemplate, validateValues, compileSpec, listTemplates } from '../src/templates.js';
import { createJob, getJob, transitionJob, listActiveJobs } from '../src/jobs.js';
import { createFileStore } from '../src/store/fileStore.js';
import { createPostgresStore } from '../src/store/postgresStore.js';
import { readLimits, checkRenderAllowed, maybeAlertCost, startOfUtcDay, DEFAULTS } from '../src/limits.js';
import { inspectText, inspectImageUrl, inspectValues, readBlocklist } from '../src/contentFilter.js';
import { verifyWithSecrets } from '../src/auth.js';
import { storageKeyFor, buildStorage, retentionDays } from '../src/storage/index.js';

const JWT_SECRET = 'test-secret-not-for-production';

function makeToken(username, extra = {}) {
    return jwt.sign({ id: username, username, ...extra }, JWT_SECRET, { expiresIn: '1h' });
}


/** تخزين ملفات وهمي يحقق عقد storage — بلا شبكة ولا مفاتيح. */
function createFakeStorage({ failMirror = false } = {}) {
    const objects = new Map();
    return {
        name: 'fake',
        objects,
        async mirrorFromUrl(sourceUrl, key) {
            if (failMirror) throw new Error('محاكاة: فشل النسخ.');
            objects.set(key, sourceUrl);
            return { key, bytes: 123 };
        },
        async signedUrl(key, ttlSec = 600) {
            if (!objects.has(key)) throw new Error('مفتاح مجهول');
            return `https://signed.test/${encodeURIComponent(key)}?exp=${ttlSec}`;
        },
        async remove(key) { objects.delete(key); },
    };
}

// ─── المجموعة الكاملة، مُعامَلة بمصنع المخزن ──────────────────────────
function runSuite(storeLabel, { makeStore, resetStore }) {
    describe(`خدمة الفيديو — تخزين: ${storeLabel}`, () => {
        let store, server, baseUrl, provider;

        async function call(pathname, { method = 'GET', token = null, body = null } = {}) {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${baseUrl}${pathname}`, {
                method, headers, body: body ? JSON.stringify(body) : undefined,
            });
            return { status: res.status, data: await res.json().catch(() => null) };
        }

        // نسخة ثانية بحدود ضيقة وقائمة حجب — لاختبار درع التكلفة والفلترة
        // بلا إضعاف الحدود الواقعية في بقية الاختبارات.
        let cappedServer, cappedUrl;
        let ownedServer, ownedUrl, fakeStorage;
        const TIGHT = { dailyRenderCap: 2, dailyRenderCapPerUser: 1, alertAtPct: 50, starterCredits: 3, alertWebhookUrl: '' };

        async function callAt(url, pathname, { method = 'GET', token = null, body = null } = {}) {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`${url}${pathname}`, {
                method, headers, body: body ? JSON.stringify(body) : undefined,
            });
            return { status: res.status, data: await res.json().catch(() => null) };
        }

        before(async () => {
            store = await makeStore();
            await store.init();
            // موجّه بمزوّد محاكاة للنوعين — يعكس بنية الإنتاج لا يلتف عليها
            provider = buildProvider({}, { composition: createMockProvider({ pollsToComplete: 2 }), ai: createMockProvider({ pollsToComplete: 2 }) });
            const app = createApp({ store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider });
            await new Promise(resolve => { server = app.listen(0, resolve); });
            baseUrl = `http://127.0.0.1:${server.address().port}`;

            const capped = createApp({
                store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider,
                limits: TIGHT, blocklist: ['كلمةمحظورة'],
            });
            await new Promise(resolve => { cappedServer = capped.listen(0, resolve); });
            cappedUrl = `http://127.0.0.1:${cappedServer.address().port}`;

            // نسخة ثالثة بتخزين ملفات مفعّل — لاختبار ملكية الملفات
            fakeStorage = createFakeStorage();
            const owned = createApp({
                store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider, storage: fakeStorage,
            });
            await new Promise(resolve => { ownedServer = owned.listen(0, resolve); });
            ownedUrl = `http://127.0.0.1:${ownedServer.address().port}`;
        });

        after(async () => {
            await new Promise(resolve => server.close(resolve));
            await new Promise(resolve => cappedServer.close(resolve));
            await new Promise(resolve => ownedServer.close(resolve));
            await store.close();
        });

        beforeEach(async () => { await resetStore(store); });

        // ─── المصادقة (الدخول الموحد) ──────────────────────────────────

        test('كل مسارات /api/video ترفض الطلب بلا توكن (401)', async () => {
            for (const p of ['/api/video/templates', '/api/video/credits', '/api/video/renders']) {
                assert.equal((await call(p)).status, 401, p);
            }
        });

        test('توكن موقَّع بسر مختلف يُرفض — لا يكفي أن يكون JWT صالح الشكل', async () => {
            const foreign = jwt.sign({ username: 'x' }, 'wrong-secret');
            assert.equal((await call('/api/video/credits', { token: foreign })).status, 401);
        });

        test('توكن المنصة الصحيح يمر — نفس السر يعني نفس تسجيل الدخول', async () => {
            const res = await call('/api/video/templates', { token: makeToken('jamal') });
            assert.equal(res.status, 200);
            assert.ok(res.data.templates.length >= 3);
        });

        test('مسار الصحة عام بلا توكن ويُظهر المزود والتخزين', async () => {
            const res = await call('/api/health');
            assert.equal(res.status, 200);
            assert.equal(res.data.provider, 'mock+mock'); // موجّه: تركيب+توليد
            assert.equal(res.data.store, storeLabel);
        });

        // ─── الأرصدة ───────────────────────────────────────────────────

        test('أول تعامل يمنح الرصيد الترحيبي مرة واحدة فقط', async () => {
            const token = makeToken('newuser');
            const first = await call('/api/video/credits', { token });
            assert.equal(first.data.credits, STARTER_CREDITS);
            assert.equal(first.data.ledger.at(-1).kind, 'starter');
            const second = await call('/api/video/credits', { token });
            assert.equal(second.data.credits, STARTER_CREDITS); // لا منح ثانٍ
            assert.equal(second.data.ledger.filter(r => r.kind === 'starter').length, 1);
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
            assert.equal(res.data.store, storeLabel);
        });

        test('الاسترداد معصوم من الازدواج لكل مهمة (idempotent)', async () => {
            await grantCredits(store, { username: 'u1', amount: 10, grantedBy: 'test' });
            const before = await getBalance(store, 'u1');
            assert.equal(await refundCredits(store, { username: 'u1', amount: 2, jobId: 'j-1' }), true);
            assert.equal(await refundCredits(store, { username: 'u1', amount: 2, jobId: 'j-1' }), false);
            assert.equal(await getBalance(store, 'u1'), before + 2); // مرة واحدة فقط
        });

        test('الخصم لا ينزل بالرصيد تحت الصفر مهما تكررت المحاولات', async () => {
            await getBalance(store, 'u0'); // رصيد ترحيبي = 3
            for (let i = 0; i < 3; i++) {
                assert.equal(await deductCredits(store, { username: 'u0', amount: 1, jobId: `j${i}` }), true);
            }
            assert.equal(await deductCredits(store, { username: 'u0', amount: 1, jobId: 'j-extra' }), false);
            assert.equal(await getBalance(store, 'u0'), 0);
        });

        // ─── القوالب والتحقق (منطق نقي — لا يمس المخزن) ────────────────

        test('التحقق يرفض: حقل مطلوب مفقود، لون غير صالح، رابط غير http، حقل مجهول', () => {
            const t = getTemplate('promo_announcement');
            assert.ok(validateValues(t, { cta: 'اشترِ' }).error);
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
            assert.equal(r.values.bgColor, '#1F4E5F');
        });

        test('compileSpec ينتج مخططاً محايداً سليماً لكل قالب في الكتالوج', () => {
            const samples = {
                promo_announcement: { headline: 'أ', cta: 'ب' },
                product_showcase: { productName: 'أ', price: '9', imageUrl: 'https://x.test/i.png' },
                story_slides: { slide1: '١', slide2: '٢', slide3: '٣' },
                ai_clip: { prompt: 'قطة تمشي على الشاطئ وقت الغروب' },
            };
            for (const t of listTemplates()) {
                const full = getTemplate(t.id);
                const v = validateValues(full, samples[t.id]);
                assert.equal(v.error, undefined, t.id);
                const spec = compileSpec(full, v.values);
                assert.equal(spec.durationSec, full.durationSec, t.id);
                // لكل نوع شكله: الزمني له مشاهد، والتوليدي له وصف نصي
                if (spec.kind === 'ai_prompt') {
                    assert.ok(spec.prompt.length > 0, t.id);
                    assert.ok(spec.aspectRatio, t.id);
                } else {
                    assert.ok(spec.scenes.length >= 1, t.id);
                }
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

        // ─── دورة حياة المهمة الكاملة ──────────────────────────────────

        test('الدورة السعيدة: إنشاء → خصم → إرسال → تصدير → اكتمال', async () => {
            const token = makeToken('jamal');
            await call('/api/video/credits', { token });

            const created = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'promo_announcement', values: { headline: 'عرض', cta: 'اطلب' } },
            });
            assert.equal(created.status, 200);
            const jobId = created.data.job.id;

            const credits = await call('/api/video/credits', { token });
            assert.equal(credits.data.credits, STARTER_CREDITS - 1);

            await runEngineTick(store, { provider });
            assert.equal((await getJob(store, jobId)).status, 'rendering');

            await runEngineTick(store, { provider });
            await runEngineTick(store, { provider });
            const done = await getJob(store, jobId);
            assert.equal(done.status, 'done');
            assert.equal(done.videoUrl, null); // المحاكاة لا تفبرك روابط

            const after = await call('/api/video/credits', { token });
            assert.equal(after.data.credits, STARTER_CREDITS - 1); // لا استرداد لناجحة
        });

        test('رصيد غير كافٍ: 402، المهمة تُحسم فشلاً، ولا خصم', async () => {
            const token = makeToken('poor');
            await call('/api/video/credits', { token });
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
            const active = await listActiveJobs(store);
            assert.equal(active.filter(j => j.templateId === 'story_slides').length, 0);
        });

        test('فشل التصدير لدى المزود: المهمة failed والرصيد يُسترد تلقائياً', async () => {
            await grantCredits(store, { username: 'u2', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const spec = { ...compileSpec(t, v), _forceFail: true };
            const job = await createJob(store, { username: 'u2', templateId: t.id, values: v, spec, costCredits: 1 });
            assert.ok(await deductCredits(store, { username: 'u2', amount: 1, jobId: job.id }));
            const before = await getBalance(store, 'u2');

            await runEngineTick(store, { provider }); // إرسال
            await runEngineTick(store, { provider }); // استطلاع → فشل
            const failed = await getJob(store, job.id);
            assert.equal(failed.status, 'failed');
            assert.equal(failed.refunded, true);
            assert.equal(await getBalance(store, 'u2'), before + 1);
        });

        test('فشل الإرسال نفسه للمزود: فشل فوري مع استرداد', async () => {
            await grantCredits(store, { username: 'u3', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const spec = { ...compileSpec(t, v), _forceSubmitError: true };
            const job = await createJob(store, { username: 'u3', templateId: t.id, values: v, spec, costCredits: 1 });
            assert.ok(await deductCredits(store, { username: 'u3', amount: 1, jobId: job.id }));
            const before = await getBalance(store, 'u3');

            await runEngineTick(store, { provider });
            assert.equal((await getJob(store, job.id)).status, 'failed');
            assert.equal(await getBalance(store, 'u3'), before + 1);
        });

        test('المهلة القصوى: مهمة معلقة تُفشَل ويُسترد رصيدها', async () => {
            await grantCredits(store, { username: 'u4', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'u4', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            assert.ok(await deductCredits(store, { username: 'u4', amount: 1, jobId: job.id }));
            const before = await getBalance(store, 'u4');

            await runEngineTick(store, { provider });
            await runEngineTick(store, { provider, now: Date.now() + JOB_TIMEOUT_MS + 1000 });
            assert.equal((await getJob(store, job.id)).status, 'failed');
            assert.equal(await getBalance(store, 'u4'), before + 1);
        });

        test('مصالحة إعادة التشغيل: مهمة rendering قديمة تُستكمل من أول دورة جديدة', async () => {
            // المحرك عديم الحالة أصلاً — الحالة كلها في المخزن الدائم،
            // فأي دورة جديدة (بعد أي تعطّل) تلتقط المهام من حيث توقفت.
            await grantCredits(store, { username: 'u5', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'u5', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            await runEngineTick(store, { provider });
            assert.equal((await getJob(store, job.id)).status, 'rendering');

            await runEngineTick(store, { provider });
            await runEngineTick(store, { provider });
            assert.equal((await getJob(store, job.id)).status, 'done');
        });

        test('سقف التزامن: لا يُرسل أكثر من مهمتين معاً والبقية تنتظر دورها', async () => {
            await grantCredits(store, { username: 'u6', amount: 10, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            for (let i = 0; i < 4; i++) {
                await createJob(store, {
                    username: 'u6', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
                });
            }
            await runEngineTick(store, { provider });
            const active = await listActiveJobs(store);
            assert.equal(active.filter(j => j.status === 'rendering').length, 2);
            assert.equal(active.filter(j => j.status === 'queued').length, 2);
        });

        // ─── العزل بين المستخدمين ─────────────────────────────────────

        test('المستخدم لا يرى مهام غيره — القائمة معزولة والوصول المباشر 404', async () => {
            const tokenA = makeToken('usera');
            const tokenB = makeToken('userb');
            await call('/api/video/credits', { token: tokenA });
            const created = await call('/api/video/renders', {
                method: 'POST', token: tokenA,
                body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
            });
            const jobId = created.data.job.id;

            assert.equal((await call('/api/video/renders', { token: tokenB })).data.jobs.length, 0);
            assert.equal((await call(`/api/video/renders/${jobId}`, { token: tokenB })).status, 404);
            assert.equal((await call(`/api/video/renders/${jobId}`, { token: tokenA })).status, 200);
        });

        test('سقف المهام النشطة لكل مستخدم يمنع إغراق الطابور', async () => {
            const token = makeToken('flooder');
            await grantCredits(store, { username: 'flooder', amount: 20, grantedBy: 'test' });

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

        // ─── سلامة انتقالات الحالة ─────────────────────────────────────

        test('انتقالات الحالة المحظورة تُرفض (لا إحياء لمهمة منتهية)', async () => {
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'u7', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            assert.equal(await transitionJob(store, job.id, 'done'), null);   // queued → done ممنوع
            assert.ok(await transitionJob(store, job.id, 'failed'));
            assert.equal(await transitionJob(store, job.id, 'queued'), null); // لا إحياء
            assert.equal(await transitionJob(store, job.id, 'rendering'), null);
        });

        // ─── درع التكلفة ───────────────────────────────────────────────

        test('السقف اليومي لكل مستخدم يمنع التوليد الزائد (429)', async () => {
            const token = makeToken('capuser');
            const body = { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } };

            const first = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token, body });
            assert.equal(first.status, 200);

            const second = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token, body });
            assert.equal(second.status, 429);
            assert.equal(second.data.code, 'user_daily_cap_reached');
        });

        test('السقف اليومي العام يوقف الخدمة كلها بعد بلوغه', async () => {
            const body = { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } };
            // مستخدمان مختلفان يستهلكان السقف العام (2)
            for (const u of ['g1', 'g2']) {
                const r = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token: makeToken(u), body });
                assert.equal(r.status, 200, u);
            }
            const third = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token: makeToken('g3'), body });
            assert.equal(third.status, 429);
            assert.equal(third.data.code, 'daily_cap_reached');
        });

        test('الرفض بالسقف لا يخصم رصيداً ولا يترك مهمة نشطة', async () => {
            const token = makeToken('capuser2');
            const body = { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } };
            await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token, body }); // يستهلك حده
            const before = await getBalance(store, 'capuser2');
            const activeBefore = (await listActiveJobs(store)).length;

            const rejected = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token, body });
            assert.equal(rejected.status, 429);
            assert.equal(await getBalance(store, 'capuser2'), before);
            assert.equal((await listActiveJobs(store)).length, activeBefore);
        });

        test('تنبيه التكلفة يُرسل مرة واحدة في اليوم لا أكثر', async () => {
            const limits = { ...TIGHT, dailyRenderCap: 10, alertAtPct: 50 };
            assert.equal(await maybeAlertCost(store, { limits, count: 4 }), false); // دون العتبة
            assert.equal(await maybeAlertCost(store, { limits, count: 5 }), true);  // بلغها
            assert.equal(await maybeAlertCost(store, { limits, count: 9 }), false); // لا تكرار
        });

        test('تنبيه التكلفة يُرسل إلى الويبهوك عند ضبطه، وفشله لا يُسقط شيئاً', async () => {
            let received = null;
            const ok = await maybeAlertCost(store, {
                limits: { ...TIGHT, dailyRenderCap: 10, alertAtPct: 50, alertWebhookUrl: 'https://hook.test/x' },
                count: 8,
                fetchImpl: async (url, opts) => { received = { url, body: JSON.parse(opts.body) }; return { ok: true }; },
            });
            assert.equal(ok, true);
            assert.equal(received.url, 'https://hook.test/x');
            assert.equal(received.body.count, 8);

            // مزوّد ويبهوك متعطل: لا يرمي — التنبيه لا يُفشل شيئاً
            const store2Key = { ...TIGHT, dailyRenderCap: 10, alertAtPct: 50, alertWebhookUrl: 'https://hook.test/x' };
            await store.setFlag(`cost_alert_${new Date().toISOString().slice(0, 10)}`, null);
            await assert.doesNotReject(() => maybeAlertCost(store, {
                limits: store2Key, count: 9, fetchImpl: async () => { throw new Error('down'); },
            }));
        });

        test('عدّ اليوم يشمل المهام الفاشلة (المحاولة نفسها قد تكلّف)', async () => {
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'counted', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            await transitionJob(store, job.id, 'failed', { error: 'x' });
            assert.equal(await store.countJobsSince(startOfUtcDay()), 1);
            assert.equal(await store.countJobsSinceForUser('counted', startOfUtcDay()), 1);
        });

        // ─── فلترة المحتوى ─────────────────────────────────────────────

        test('الفلترة ترفض الروابط داخل نصوص الفيديو (429 → 400)', async () => {
            const res = await callAt(cappedUrl, '/api/video/renders', {
                method: 'POST', token: makeToken('spammer'),
                body: { templateId: 'promo_announcement', values: { headline: 'زُر موقعنا example.com', cta: 'ب' } },
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.field, 'headline');
        });

        test('الفلترة ترفض المصطلح المحظور من قائمة البيئة', async () => {
            const res = await callAt(cappedUrl, '/api/video/renders', {
                method: 'POST', token: makeToken('blocked1'),
                body: { templateId: 'promo_announcement', values: { headline: 'هذه كلمةمحظورة هنا', cta: 'ب' } },
            });
            assert.equal(res.status, 400);
        });

        test('الفلترة ترفض المحارف المخفية والتكرار المفتعل', () => {
            assert.equal(inspectText('نص‮مقلوب')?.code, 'hidden_chars');
            assert.equal(inspectText('أأأأأأأأأأأأ')?.code, 'char_flood');
            assert.equal(inspectText('نص عادي تماماً'), null);
        });

        test('الفلترة ترفض روابط الصور الداخلية (منع استكشاف الشبكة)', () => {
            for (const bad of [
                'http://localhost/x.png', 'http://127.0.0.1/x.png', 'http://10.0.0.5/x.png',
                'http://192.168.1.1/x.png', 'http://169.254.169.254/meta', 'http://172.16.0.1/x',
            ]) {
                assert.ok(inspectImageUrl(bad), bad);
            }
            assert.equal(inspectImageUrl('https://cdn.example.org/a.png'), null);
        });

        test('قراءة الحدود من البيئة: القيم الخاطئة ترتد للافتراضي الآمن', () => {
            const parsed = readLimits({
                DAILY_RENDER_CAP: '50', DAILY_RENDER_CAP_PER_USER: 'abc',
                COST_ALERT_AT_PCT: '250', STARTER_CREDITS: '0',
            });
            assert.equal(parsed.dailyRenderCap, 50);
            assert.equal(parsed.dailyRenderCapPerUser, DEFAULTS.dailyRenderCapPerUser); // 'abc' مرفوضة
            assert.equal(parsed.alertAtPct, DEFAULTS.alertAtPct);                        // 250 خارج المدى
            assert.equal(parsed.starterCredits, 0);                                      // صفر قيمة صحيحة لا "فارغة"
        });

        test('قراءة قائمة الحجب: تقصّ الفراغات وتتجاهل الفارغ', () => {
            assert.deepEqual(readBlocklist({ CONTENT_BLOCKLIST: ' أ , ,ب ' }), ['أ', 'ب']);
            assert.deepEqual(readBlocklist({}), []);
        });

        test('checkRenderAllowed مباشرةً: سقف صفر يوقف كل توليد (إيقاف طوارئ)', async () => {
            const stopped = await checkRenderAllowed(store, {
                username: 'anyone',
                limits: { ...TIGHT, dailyRenderCap: 0 },
            });
            assert.equal(stopped.allowed, false);
            assert.equal(stopped.code, 'daily_cap_reached');
        });

        test('verifyWithSecrets يجرّب الأسرار بالترتيب ويرمي إن فشلت كلها', () => {
            const token = jwt.sign({ username: 'x' }, 'second');
            assert.equal(verifyWithSecrets(token, ['first', 'second']).username, 'x');
            assert.throws(() => verifyWithSecrets(token, ['first', 'third']));
        });

        test('الفلترة لا تمس القيم السليمة', () => {
            const t = getTemplate('product_showcase');
            const v = validateValues(t, {
                productName: 'قميص قطني', price: '99 ر.س', imageUrl: 'https://cdn.example.org/a.png',
            }).values;
            assert.equal(inspectValues(t, v, { blocklist: ['ممنوع'] }), null);
        });

        // ─── تدوير مفتاح JWT ───────────────────────────────────────────

        test('تدوير المفتاح: يُقبل التوكن الموقّع بالسر السابق والحالي معاً', async () => {
            const rotated = createApp({
                store, jwtSecret: ['new-secret', JWT_SECRET], adminUsersCsv: 'boss', provider,
            });
            const srv = await new Promise(resolve => {
                const s = rotated.listen(0, () => resolve(s));
            });
            const url = `http://127.0.0.1:${srv.address().port}`;
            try {
                const oldToken = jwt.sign({ username: 'rot' }, JWT_SECRET);
                const newToken = jwt.sign({ username: 'rot' }, 'new-secret');
                assert.equal((await callAt(url, '/api/video/credits', { token: oldToken })).status, 200);
                assert.equal((await callAt(url, '/api/video/credits', { token: newToken })).status, 200);
                const alien = jwt.sign({ username: 'rot' }, 'third-secret');
                assert.equal((await callAt(url, '/api/video/credits', { token: alien })).status, 401);
            } finally {
                await new Promise(r => srv.close(r));
            }
        });


        // ─── ملكية ملفات الفيديو ───────────────────────────────────────

        test('مفتاح التخزين يعزل المستخدمين ويُنظَّف من محارف المسار', () => {
            assert.equal(storageKeyFor({ username: 'Jamal', jobId: 'j-1' }), 'videos/Jamal/j-1.mp4');
            // محاولة خروج من المسار تُبطَل بالكامل
            assert.equal(storageKeyFor({ username: '../../etc', jobId: 'a/b' }), 'videos/______etc/a_b.mp4');
        });

        test('التخزين معطَّل افتراضياً ولا يُفعَّل إلا بطلب صريح', () => {
            assert.equal(buildStorage({}), null);
            assert.equal(buildStorage({ VIDEO_STORAGE: '' }), null);
            // مفعَّل بلا مفاتيح = خطأ إعداد صاخب لا فشل صامت
            assert.throws(() => buildStorage({ VIDEO_STORAGE: 'r2' }));
        });

        test('مدة الاحتفاظ: افتراضي ٣٠ يوماً، و0 احتفاظ دائم، والخطأ يرتد للافتراضي', () => {
            assert.equal(retentionDays({}), 30);
            assert.equal(retentionDays({ VIDEO_RETENTION_DAYS: '0' }), 0);
            assert.equal(retentionDays({ VIDEO_RETENTION_DAYS: '7' }), 7);
            assert.equal(retentionDays({ VIDEO_RETENTION_DAYS: 'abc' }), 30);
        });

        test('اكتمال المهمة ينسخ الفيديو لتخزيننا ويستبدل رابط المزوّد بمسارنا', async () => {
            const provider2 = createMockProvider({ pollsToComplete: 1 });
            provider2.getRender = async () => ({ status: 'done', videoUrl: 'https://provider.test/v.mp4' });
            await grantCredits(store, { username: 'owner1', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'owner1', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });

            await runEngineTick(store, { provider: provider2, storage: fakeStorage });  // إرسال
            const s2 = await runEngineTick(store, { provider: provider2, storage: fakeStorage }); // اكتمال+نسخ
            assert.equal(s2.mirrored, 1);

            const done = await getJob(store, job.id);
            assert.equal(done.status, 'done');
            assert.equal(done.storageKey, 'videos/owner1/' + job.id + '.mp4');
            assert.equal(done.videoUrl, null); // لا رابط مزوّد محفوظ بعد النسخ
            assert.ok(fakeStorage.objects.has(done.storageKey));
        });

        test('فشل النسخ لا يُفشل المهمة ولا يهدر الرصيد — يبقى رابط المزوّد', async () => {
            const failing = createFakeStorage({ failMirror: true });
            const provider2 = createMockProvider({ pollsToComplete: 1 });
            provider2.getRender = async () => ({ status: 'done', videoUrl: 'https://provider.test/v.mp4' });
            await grantCredits(store, { username: 'owner2', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'owner2', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            assert.ok(await deductCredits(store, { username: 'owner2', amount: 1, jobId: job.id }));
            const before = await getBalance(store, 'owner2');

            await runEngineTick(store, { provider: provider2, storage: failing });
            await runEngineTick(store, { provider: provider2, storage: failing });

            const done = await getJob(store, job.id);
            assert.equal(done.status, 'done');          // نجحت رغم فشل النسخ
            assert.equal(done.storageKey, null);
            assert.equal(done.videoUrl, 'https://provider.test/v.mp4'); // احتياط شفاف
            assert.equal(await getBalance(store, 'owner2'), before);    // لا استرداد لناجحة
        });

        test('مسار التنزيل: المالك يُوجَّه لرابط موقّع، وغيره 404', async () => {
            const provider2 = createMockProvider({ pollsToComplete: 1 });
            provider2.getRender = async () => ({ status: 'done', videoUrl: 'https://provider.test/v.mp4' });
            const tokenOwner = makeToken('dl1');
            const created = await callAt(ownedUrl, '/api/video/renders', {
                method: 'POST', token: tokenOwner,
                body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
            });
            assert.equal(created.status, 200);
            await runEngineTick(store, { provider: provider2, storage: fakeStorage });
            await runEngineTick(store, { provider: provider2, storage: fakeStorage });
            const jobId = created.data.job.id;

            // القائمة تعرض مسارنا لا رابط المزوّد، وتعلن الملكية صراحةً
            const list = await callAt(ownedUrl, '/api/video/renders', { token: tokenOwner });
            const row = list.data.jobs.find(j => j.id === jobId);
            assert.equal(row.owned, true);
            assert.equal(row.videoUrl, `/api/video/renders/${jobId}/download`);

            // المالك: إعادة توجيه 302 لرابط موقّع
            const res = await fetch(`${ownedUrl}/api/video/renders/${jobId}/download`, {
                headers: { Authorization: `Bearer ${tokenOwner}` }, redirect: 'manual',
            });
            assert.equal(res.status, 302);
            assert.ok(res.headers.get('location').startsWith('https://signed.test/'));

            // مستخدم آخر: 404 (لا تأكيد للوجود)
            const other = await callAt(ownedUrl, `/api/video/renders/${jobId}/download`, { token: makeToken('dl2') });
            assert.equal(other.status, 404);

            // بلا توكن: 401
            const anon = await fetch(`${ownedUrl}/api/video/renders/${jobId}/download`, { redirect: 'manual' });
            assert.equal(anon.status, 401);
        });

        test('تنزيل مهمة بلا ملف مخزَّن يُرجع 404 لا رابطاً ميتاً', async () => {
            const token = makeToken('dl3');
            const created = await callAt(ownedUrl, '/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } },
            });
            const res = await callAt(ownedUrl, `/api/video/renders/${created.data.job.id}/download`, { token });
            assert.equal(res.status, 404);
        });

        test('تنظيف الاحتفاظ يحذف الملفات المنتهية ويمسح أثرها', async () => {
            const provider2 = createMockProvider({ pollsToComplete: 1 });
            provider2.getRender = async () => ({ status: 'done', videoUrl: 'https://provider.test/v.mp4' });
            await grantCredits(store, { username: 'keep1', amount: 5, grantedBy: 'test' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'keep1', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            await runEngineTick(store, { provider: provider2, storage: fakeStorage });
            await runEngineTick(store, { provider: provider2, storage: fakeStorage });
            const key = (await getJob(store, job.id)).storageKey;
            assert.ok(fakeStorage.objects.has(key));

            // لم تنقضِ المدة بعد → لا حذف
            let sum = await runEngineTick(store, { provider: provider2, storage: fakeStorage, retentionDays: 30 });
            assert.equal(sum.purged, 0);
            assert.ok(fakeStorage.objects.has(key));

            // بعد انقضائها (دورة في المستقبل) → يُحذف ويُمسح أثره
            sum = await runEngineTick(store, {
                provider: provider2, storage: fakeStorage, retentionDays: 30,
                now: Date.now() + 31 * 24 * 60 * 60 * 1000,
            });
            assert.equal(sum.purged, 1);
            assert.equal(fakeStorage.objects.has(key), false);
            const purged = await getJob(store, job.id);
            assert.equal(purged.storageKey, null);
            assert.equal(purged.videoUrl, null); // لا رابط يوهم بتوفر ملف محذوف
        });

        test('بلا تخزين مفعَّل: لا نسخ ولا حذف — سلوك ما قبل الميزة كما هو', async () => {
            const provider2 = createMockProvider({ pollsToComplete: 1 });
            provider2.getRender = async () => ({ status: 'done', videoUrl: 'https://provider.test/v.mp4' });
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'nostore', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            await runEngineTick(store, { provider: provider2 });
            const sum = await runEngineTick(store, { provider: provider2, retentionDays: 30 });
            assert.equal(sum.mirrored, 0);
            assert.equal(sum.purged, 0);
            const done = await getJob(store, job.id);
            assert.equal(done.storageKey, null);
            assert.equal(done.videoUrl, 'https://provider.test/v.mp4');
        });


        // ─── توليد الفيديو بالذكاء الاصطناعي (المرحلة ٢) ───────────────

        test('قالب الذكاء الاصطناعي يُجمَّع لمخطط وصف نصي لا مخطط زمني', () => {
            const t = getTemplate('ai_clip');
            const v = validateValues(t, { prompt: 'مدينة ليلاً تحت المطر', aspectRatio: '9:16' });
            assert.equal(v.error, undefined);
            const spec = compileSpec(t, v.values);
            assert.equal(spec.kind, 'ai_prompt');
            assert.equal(spec.prompt, 'مدينة ليلاً تحت المطر');
            assert.equal(spec.aspectRatio, '9:16');
            assert.equal(spec.scenes, undefined); // ليس مخططاً زمنياً
        });

        test('حقل الاختيار يرفض قيمة خارج القائمة ويطبّق الافتراضي', () => {
            const t = getTemplate('ai_clip');
            assert.ok(validateValues(t, { prompt: 'x', aspectRatio: '4:3' }).error);
            assert.equal(validateValues(t, { prompt: 'x' }).values.aspectRatio, '16:9');
        });

        test('الموجّه يرسل كل نوع لمزوّده ويُعيد الاستطلاع للمزوّد نفسه', async () => {
            const seen = { timeline: [], ai: [] };
            const mk = (bucket) => ({
                name: bucket,
                async submitRender(spec) { seen[bucket].push(spec.kind); return { providerId: `${bucket}-1` }; },
                async getRender(id) { return { status: 'done', videoUrl: `https://${bucket}.test/${id}.mp4` }; },
            });
            const router = buildProvider({}, { composition: mk('timeline'), ai: mk('ai') });

            const a = await router.submitRender({ kind: 'timeline', scenes: [] });
            const b = await router.submitRender({ kind: 'ai_prompt', prompt: 'x' });
            assert.deepEqual(seen.timeline, ['timeline']);
            assert.deepEqual(seen.ai, ['ai_prompt']);

            // المعرّف يحمل بادئة النوع فيعرف الاستطلاع أي مزوّد يسأل
            assert.ok(a.providerId.startsWith('timeline::'));
            assert.ok(b.providerId.startsWith('ai_prompt::'));
            assert.match((await router.getRender(b.providerId)).videoUrl, /^https:\/\/ai\.test\//);
            assert.match((await router.getRender(a.providerId)).videoUrl, /^https:\/\/timeline\.test\//);
        });

        test('معرّف قديم بلا بادئة يُعامَل كمخطط زمني (توافق خلفي)', async () => {
            const router = buildProvider({}, {
                composition: { name: 'c', async submitRender() { return { providerId: 'x' }; },
                    async getRender(id) { return { status: 'done', videoUrl: `old/${id}` }; } },
                ai: null,
            });
            assert.equal((await router.getRender('legacy-id')).videoUrl, 'old/legacy-id');
        });

        test('بلا مزوّد ذكاء اصطناعي: القالب يُخفى من الكتالوج ويُرفض طلبه مباشرةً', async () => {
            const noAi = buildProvider({}, { composition: createMockProvider(), ai: null });
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider: noAi });
            const srv = await new Promise(r => { const s2 = app.listen(0, () => r(s2)); });
            const url = `http://127.0.0.1:${srv.address().port}`;
            try {
                const token = makeToken('noai');
                const list = await callAt(url, '/api/video/templates', { token });
                assert.equal(list.data.templates.some(t => t.id === 'ai_clip'), false);

                // الإخفاء لا يكفي — الطلب المباشر يُرفض أيضاً
                const direct = await callAt(url, '/api/video/renders', {
                    method: 'POST', token, body: { templateId: 'ai_clip', values: { prompt: 'x' } },
                });
                assert.equal(direct.status, 503);
            } finally { await new Promise(r => srv.close(r)); }
        });

        test('اختيار مزوّد الذكاء الاصطناعي: معطَّل افتراضياً، ويفشل صاخباً بإعداد ناقص', () => {
            assert.equal(buildAiProvider({}), null);
            assert.equal(buildAiProvider({ VIDEO_AI_PROVIDER: 'none' }), null);
            assert.throws(() => buildAiProvider({ VIDEO_AI_PROVIDER: 'fal' }));                    // بلا مفتاح
            assert.throws(() => buildAiProvider({ VIDEO_AI_PROVIDER: 'fal', FAL_KEY: 'k' }));      // بلا نموذج
            assert.throws(() => buildAiProvider({ VIDEO_AI_PROVIDER: 'unknown' }));
        });

        test('fal: الإرسال والاستطلاع واستخراج الرابط (بلا شبكة)', async () => {
            const calls = [];
            const fetchImpl = async (url, opts = {}) => {
                calls.push({ url, method: opts.method || 'GET', auth: opts.headers?.Authorization });
                if (opts.method === 'POST') return { ok: true, json: async () => ({ request_id: 'req-9' }) };
                if (url.endsWith('/status')) return { ok: true, json: async () => ({ status: 'COMPLETED' }) };
                return { ok: true, json: async () => ({ video: { url: 'https://cdn.fal/v.mp4' } }) };
            };
            const p = createFalProvider({ apiKey: 'K', model: 'fal-ai/some/model', fetchImpl });

            const { providerId } = await p.submitRender({ kind: 'ai_prompt', prompt: 'قطة', aspectRatio: '9:16', durationSec: 5 });
            assert.equal(providerId, 'req-9');
            assert.equal(calls[0].auth, 'Key K');
            assert.equal(calls[0].url, 'https://queue.fal.run/fal-ai/some/model');

            const done = await p.getRender('req-9');
            assert.equal(done.status, 'done');
            assert.equal(done.videoUrl, 'https://cdn.fal/v.mp4');

            // 📌 درس إنتاجي: مسارات المتابعة تستخدم معرّف التطبيق (أول
            // جزأين) لا المسار الكامل — البناء الكامل يعطي 404 دائماً
            // فتتعلق المهمة حتى المهلة القصوى.
            assert.equal(calls[1].url, 'https://queue.fal.run/fal-ai/some/requests/req-9/status');
            assert.equal(calls[2].url, 'https://queue.fal.run/fal-ai/some/requests/req-9');
        });

        test('fal: التحقق الذاتي يصرخ إذا خالف status_url الفعلي المسار المبني', async () => {
            const logged = [];
            const orig = console.error;
            console.error = (...a) => logged.push(a.join(' '));
            try {
                const p = createFalProvider({
                    apiKey: 'K', model: 'fal-ai/app/endpoint',
                    fetchImpl: async () => ({
                        ok: true,
                        json: async () => ({ request_id: 'r1', status_url: 'https://queue.fal.run/other-owner/other-app/requests/r1/status' }),
                    }),
                });
                await p.submitRender({ kind: 'ai_prompt', prompt: 'x', durationSec: 5 });
                assert.ok(logged.some(l => l.includes('لا يطابق المبني')), 'يجب أن يُسجَّل عدم التطابق');
            } finally { console.error = orig; }
        });

        test('خطأ المصادقة في الاستطلاع يُفشل فوراً — لا تعليق حتى المهلة (درس إنتاجي)', async () => {
            // fal: حساب مقفول (403) → فشل فوري بتفاصيل الخطأ
            for (const code of [401, 403]) {
                const p = createFalProvider({
                    apiKey: 'K', model: 'm',
                    fetchImpl: async () => ({ ok: false, status: code, text: async () => 'User is locked.' }),
                });
                const r = await p.getRender('req');
                assert.equal(r.status, 'failed', `fal ${code}`);
                assert.match(r.error, /User is locked/);
            }
            // shotstack: نفس القاعدة
            const { createShotstackProvider } = await import('../src/providers/shotstackProvider.js');
            const sp = createShotstackProvider({
                apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 403 }),
            });
            assert.equal((await sp.getRender('id')).status, 'failed');
        });

        test('fal: الحالات غير المكتملة تبقى قيد المعالجة لا تُحسم', async () => {
            for (const status of ['IN_QUEUE', 'IN_PROGRESS']) {
                const p = createFalProvider({
                    apiKey: 'K', model: 'm',
                    fetchImpl: async () => ({ ok: true, json: async () => ({ status }) }),
                });
                assert.equal((await p.getRender('r')).status, 'rendering', status);
            }
            // فشل استطلاع عابر (HTTP خطأ) لا يُفشل المهمة أيضاً
            const flaky = createFalProvider({ apiKey: 'K', model: 'm', fetchImpl: async () => ({ ok: false, status: 502 }) });
            assert.equal((await flaky.getRender('r')).status, 'rendering');
        });

        test('fal: رد مكتمل بلا رابط معروف يُحسم فشلاً لا نجاحاً صامتاً', async () => {
            const p = createFalProvider({
                apiKey: 'K', model: 'm',
                fetchImpl: async (url) => url.endsWith('/status')
                    ? { ok: true, json: async () => ({ status: 'COMPLETED' }) }
                    : { ok: true, json: async () => ({ unexpected: true }) },
            });
            const r = await p.getRender('r');
            assert.equal(r.status, 'failed');
        });

        test('fal: استخراج الرابط يغطي أشكال مخرجات النماذج المختلفة', () => {
            assert.equal(extractVideoUrl({ video: { url: 'a' } }), 'a');
            assert.equal(extractVideoUrl({ videos: [{ url: 'b' }] }), 'b');
            assert.equal(extractVideoUrl({ output: { video: { url: 'c' } } }), 'c');
            assert.equal(extractVideoUrl({ video: 'd' }), 'd');
            assert.equal(extractVideoUrl({ url: 'e' }), 'e');
            assert.equal(extractVideoUrl({ nothing: 1 }), null);
        });

        test('fal: ترجمة المخطط لمدخلات النموذج — بلا duration (درس إنتاجي)', () => {
            const input = specToFalInput({ kind: 'ai_prompt', prompt: 'مشهد', aspectRatio: '1:1', durationSec: 5 });
            // duration محذوف عمداً: شكله يختلف بين النماذج ("8s"/"5"/غائب)
            // والقيمة غير المطابقة ترد 422 عند التنفيذ لا عند الإرسال.
            assert.deepEqual(input, { prompt: 'مشهد', aspect_ratio: '1:1' });
        });

        test('fal: 422 عند جلب النتيجة يُفشل بتفاصيل fal لا برقم صامت', async () => {
            const orig = console.error;
            console.error = () => {};
            try {
                const p = createFalProvider({
                    apiKey: 'K', model: 'm',
                    fetchImpl: async (url) => url.endsWith('/status')
                        ? { ok: true, json: async () => ({ status: 'COMPLETED' }) }
                        : { ok: false, status: 422, text: async () => '{"detail":[{"msg":"Input should be \'8s\'"}]}' },
                });
                const r = await p.getRender('r');
                assert.equal(r.status, 'failed');
                assert.match(r.error, /Input should be/);
            } finally { console.error = orig; }
        });

        test('fal: 5xx عند جلب النتيجة عابر — يبقى قيد المعالجة للدورة التالية', async () => {
            const p = createFalProvider({
                apiKey: 'K', model: 'm',
                fetchImpl: async (url) => url.endsWith('/status')
                    ? { ok: true, json: async () => ({ status: 'COMPLETED' }) }
                    : { ok: false, status: 503, text: async () => '' },
            });
            assert.equal((await p.getRender('r')).status, 'rendering');
        });

        test('Shotstack يرفض مخطط توليد لا يخصه', async () => {
            const { createShotstackProvider } = await import('../src/providers/shotstackProvider.js');
            const p = createShotstackProvider({ apiKey: 'k' });
            await assert.rejects(() => p.submitRender({ kind: 'ai_prompt', prompt: 'x' }));
        });

        test('دورة كاملة لمقطع ذكاء اصطناعي عبر المسارات الفعلية', async () => {
            const token = makeToken('aiuser');
            await grantCredits(store, { username: 'aiuser', amount: 10, grantedBy: 'test' });
            const created = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'ai_clip', values: { prompt: 'شروق الشمس فوق الجبال' } },
            });
            assert.equal(created.status, 200);
            assert.equal(created.data.job.costCredits, 5); // أغلى من قوالب التركيب

            await runEngineTick(store, { provider });
            const sent = await getJob(store, created.data.job.id);
            assert.equal(sent.status, 'rendering');
            assert.ok(sent.providerId.startsWith('ai_prompt::')); // ذهبت لمزوّد التوليد

            await runEngineTick(store, { provider });
            await runEngineTick(store, { provider });
            assert.equal((await getJob(store, created.data.job.id)).status, 'done');
        });

        test('انتقال متزامن مكرر: واحد فقط ينجح (ذرّية الانتقال)', async () => {
            const t = getTemplate('promo_announcement');
            const v = validateValues(t, { headline: 'أ', cta: 'ب' }).values;
            const job = await createJob(store, {
                username: 'u8', templateId: t.id, values: v, spec: compileSpec(t, v), costCredits: 1,
            });
            const results = await Promise.all([
                transitionJob(store, job.id, 'rendering', { providerId: 'a' }),
                transitionJob(store, job.id, 'rendering', { providerId: 'b' }),
            ]);
            assert.equal(results.filter(Boolean).length, 1);
        });
    });
}

// ─── تشغيل المجموعة على المخزنين ──────────────────────────────────────

const fileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'videostudio-file-'));
runSuite('file', {
    makeStore: async () => createFileStore({ dataDir: fileDir, starterCredits: STARTER_CREDITS }),
    resetStore: async () => {
        for (const f of fs.readdirSync(fileDir)) fs.rmSync(path.join(fileDir, f), { force: true });
    },
});

// Postgres يُختبر فقط عند توفر قاعدة اختبار (مضبوطة في CI عبر حاوية خدمة).
// غيابها محلياً يعني تشغيل مجموعة الملفات وحدها — لا فشل ولا تخطٍّ صامت
// لسلوك مختبَر، لأن CI يشغّل المجموعتين دوماً قبل أي دمج.
if (process.env.TEST_DATABASE_URL) {
    runSuite('postgres', {
        makeStore: async () => createPostgresStore({
            connectionString: process.env.TEST_DATABASE_URL,
            starterCredits: STARTER_CREDITS,
        }),
        resetStore: store => store.truncateAllForTest(),
    });
}
