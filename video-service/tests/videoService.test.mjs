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
import { readAiModels, getAiModel, defaultAiModel } from '../src/models.js';
import { composeCinematicPrompt } from '../src/cinema.js';
import { createFalImageProvider, extractImageUrl } from '../src/providers/falImageProvider.js';
import { createFalTtsProvider, extractAudioUrl, buildTtsProvider } from '../src/providers/falTtsProvider.js';
import { CHARACTER_COST_CREDITS, characterImagePrompt, validateCharacterInput } from '../src/characters.js';
import {
    ASSEMBLY_COST_CREDITS, buildFilmSpec, readMusicLibrary, readSfxLibrary,
    OUTPUT_RESOLUTIONS, DEFAULT_RESOLUTION, DEFAULT_WATERMARK_TEXT,
} from '../src/assembly.js';
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
                ai_image_clip: { imageUrl: 'https://x.test/hero.png', prompt: 'البطل يلتفت نحو الأفق' },
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
            assert.ok(validateValues(t, { prompt: 'x', aspectRatio: '7:5' }).error);
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
            // بلا FAL_MODEL: يعمل بالافتراضي من الكتالوج المدمج (متعدد النماذج)
            assert.match(buildAiProvider({ VIDEO_AI_PROVIDER: 'fal', FAL_KEY: 'k' }).name, /veo3\/fast/);
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
            // المعرّف مركّب: مسار النموذج + معرّف الطلب — فتتابع كل مهمة
            // نموذجها هي حتى لو تغيّر الافتراضي لاحقاً.
            assert.equal(providerId, 'fal-ai/some/model|req-9');
            assert.equal(calls[0].auth, 'Key K');
            assert.equal(calls[0].url, 'https://queue.fal.run/fal-ai/some/model');

            const done = await p.getRender(providerId);
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

        test('Shotstack: دقة الإخراج تُرسَل كما هي (افتراضي hd)، ورفض الإرسال يُظهر تفصيل الرد', async () => {
            const { createShotstackProvider } = await import('../src/providers/shotstackProvider.js');
            const bodies = [];
            const p = createShotstackProvider({
                apiKey: 'k',
                fetchImpl: async (url, opts = {}) => {
                    bodies.push(JSON.parse(opts.body));
                    return { ok: true, json: async () => ({ response: { id: 'r1' } }) };
                },
            });
            await p.submitRender({ kind: 'timeline', scenes: [], durationSec: 5 });
            assert.equal(bodies[0].output.resolution, 'hd'); // بلا resolution في المخطط

            await p.submitRender({ kind: 'timeline', scenes: [], durationSec: 5, resolution: '4k' });
            assert.equal(bodies[1].output.resolution, '4k');

            // رفض الإرسال (مثلاً قيمة resolution مرفوضة فعلياً من Shotstack)
            // يُظهر تفصيل رده كاملاً — لا HTTP فارغ.
            const rejecting = createShotstackProvider({
                apiKey: 'k',
                fetchImpl: async () => ({ ok: false, status: 400, text: async () => 'Invalid output.resolution: 4k' }),
            });
            await assert.rejects(
                () => rejecting.submitRender({ kind: 'timeline', scenes: [], durationSec: 5, resolution: '4k' }),
                /Invalid output\.resolution/
            );
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
            // الصورة المرجعية تُرسل image_url فقط عند وجودها (i2v)
            const i2v = specToFalInput({ kind: 'ai_prompt', prompt: 'م', imageUrl: 'https://x.test/hero.png' });
            assert.equal(i2v.image_url, 'https://x.test/hero.png');
        });

        test('الشخصية الثابتة: قالب الصورة المرجعية يمرّر الصورة ويرفض النموذج غير المطابق', async () => {
            // المخطط يحمل imageUrl
            const t = getTemplate('ai_image_clip');
            const v = validateValues(t, { imageUrl: 'https://x.test/hero.png', prompt: 'يلتفت البطل' });
            assert.equal(v.error, undefined);
            const spec = compileSpec(t, v.values);
            assert.equal(spec.imageUrl, 'https://x.test/hero.png');

            // الكتالوج يميّز نماذج الصورة، وإدخال فاسد يفشل صاخباً
            const models = readAiModels({});
            assert.ok(models.some(m => m.input === 'image'));
            assert.throws(() => readAiModels({
                FAL_MODELS_JSON: JSON.stringify([{ id: 'x', nameAr: 'س', falPath: 'a/b', costCredits: 1, input: 'صوت' }]),
            }));

            // الخادم: نموذج نصي لقالب الصورة → 400، ونموذج i2v اقتصادي → 200 بتكلفته
            const token = makeToken('consistency');
            await call('/api/video/credits', { token });
            const mismatch = await call('/api/video/renders', {
                method: 'POST', token,
                body: {
                    templateId: 'ai_image_clip', modelId: 'veo3_fast',
                    values: { imageUrl: 'https://x.test/hero.png', prompt: 'مشهد' },
                },
            });
            assert.equal(mismatch.status, 400);
            assert.match(mismatch.data.error, /نصّي/);

            const reverse = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'ai_clip', modelId: 'wan_i2v', values: { prompt: 'مشهد' } },
            });
            assert.equal(reverse.status, 400);

            const ok = await call('/api/video/renders', {
                method: 'POST', token,
                body: {
                    templateId: 'ai_image_clip', modelId: 'wan_i2v',
                    values: { imageUrl: 'https://x.test/hero.png', prompt: 'مشهد' },
                },
            });
            assert.equal(ok.status, 200);
            assert.equal(ok.data.job.costCredits, 2); // تكلفة Wan الاقتصادي لا القالب
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

        test('كتالوج النماذج: مدمج + توسيع/استبدال بFAL_MODELS_JSON + احترام FAL_MODEL', () => {
            const base = readAiModels({});
            assert.ok(base.some(m => m.id === 'veo3_fast'));
            assert.equal(defaultAiModel(base, {}).id, 'veo3_fast');

            // توسيع بنموذج جديد بلا نشر كود
            const extended = readAiModels({
                FAL_MODELS_JSON: JSON.stringify([{
                    id: 'kling', nameAr: 'كلينغ', falPath: 'fal-ai/kling-video/v2/master',
                    costCredits: 7, aspectRatios: ['16:9', '1:1'],
                }]),
            });
            assert.equal(getAiModel(extended, 'kling').costCredits, 7);

            // نفس المعرّف = استبدال مقصود (تعديل تكلفة نموذج مدمج) لا تكرار
            const replaced = readAiModels({
                FAL_MODELS_JSON: JSON.stringify([{
                    id: 'veo3_fast', nameAr: 'سريع بسعر خاص', falPath: 'fal-ai/veo3/fast', costCredits: 3,
                }]),
            });
            assert.equal(getAiModel(replaced, 'veo3_fast').costCredits, 3);
            assert.equal(replaced.length, base.length);

            // FAL_MODEL قديم خارج الكتالوج: يُضاف ويصبح الافتراضي
            const env = { FAL_MODEL: 'fal-ai/wan/v2' };
            const withEnv = readAiModels(env);
            assert.ok(withEnv.some(m => m.falPath === 'fal-ai/wan/v2'));
            assert.equal(defaultAiModel(withEnv, env).falPath, 'fal-ai/wan/v2');

            // إعداد فاسد يفشل صاخباً عند الإقلاع لا 422 غامضاً لاحقاً
            assert.throws(() => readAiModels({ FAL_MODELS_JSON: 'ليس json' }));
            assert.throws(() => readAiModels({
                FAL_MODELS_JSON: JSON.stringify([{ id: 'x', nameAr: 'س', falPath: 'بلا-مالك', costCredits: 1 }]),
            }));
            assert.throws(() => readAiModels({
                FAL_MODELS_JSON: JSON.stringify([{ id: 'x', nameAr: 'س', falPath: 'a/b', costCredits: 0 }]),
            }));
        });

        test('التركيب السينمائي: المعايير تُترجم اصطلاحياً والسلبي يُلحق بـAvoid', () => {
            const composed = composeCinematicPrompt({
                prompt: 'فارس يعبر الصحراء',
                shotSize: 'واسعة', cameraMove: 'تتبع',
                lighting: 'الساعة الذهبية', style: 'سينمائي واقعي',
                negativePrompt: 'نص مكتوب على الشاشة',
            });
            assert.match(composed, /فارس يعبر الصحراء/);
            assert.match(composed, /wide shot/);
            assert.match(composed, /tracking shot/);
            assert.match(composed, /golden hour/);
            assert.match(composed, /35mm/);
            assert.match(composed, /Avoid: نص مكتوب على الشاشة/);
            // المزاج والإيقاع معيار مستقل
            assert.match(composeCinematicPrompt({ prompt: 'م', mood: 'ملحمي' }), /epic grand atmosphere/);
            // بلا معايير: الوصف يمر كما هو حرفياً
            assert.equal(composeCinematicPrompt({ prompt: 'مشهد' }), 'مشهد');
            // قيمة غير معروفة لمعيار تُتجاهل بصمت (الخادم يتحقق قبلها أصلاً)
            assert.equal(composeCinematicPrompt({ prompt: 'مشهد', shotSize: 'غريبة' }), 'مشهد');
        });

        test('fal متعدد النماذج: المخطط يحمل نموذجه والمتابعة تلاحقه لا الافتراضي', async () => {
            const calls = [];
            const fetchImpl = async (url, opts = {}) => {
                calls.push(url);
                if (opts.method === 'POST') return { ok: true, json: async () => ({ request_id: 'r7' }) };
                if (url.endsWith('/status')) return { ok: true, json: async () => ({ status: 'COMPLETED' }) };
                return { ok: true, json: async () => ({ video: { url: 'https://cdn.fal/x.mp4' } }) };
            };
            const p = createFalProvider({ apiKey: 'K', model: 'fal-ai/default/model', fetchImpl });
            const { providerId } = await p.submitRender({
                kind: 'ai_prompt', prompt: 'x', modelPath: 'fal-ai/kling-video/v2/master',
            });
            assert.equal(providerId, 'fal-ai/kling-video/v2/master|r7');
            assert.equal(calls[0], 'https://queue.fal.run/fal-ai/kling-video/v2/master');
            const done = await p.getRender(providerId);
            assert.equal(done.status, 'done');
            assert.equal(calls[1], 'https://queue.fal.run/fal-ai/kling-video/requests/r7/status');
            assert.equal(calls[2], 'https://queue.fal.run/fal-ai/kling-video/requests/r7');
        });

        test('اختيار النموذج في الطلب: التكلفة بالنموذج، ورفض المجهول والنسبة غير المدعومة', async () => {
            const token = makeToken('director');
            await call('/api/video/credits', { token }); // الرصيد الترحيبي
            await call('/api/video/admin/credits/grant', {
                method: 'POST', token: makeToken('boss'),
                body: { username: 'director', amount: 20 },
            });

            // veo3 الكامل يكلف 10 لا تكلفة القالب الافتراضية
            const created = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'ai_clip', values: { prompt: 'مشهد افتتاحي' }, modelId: 'veo3' },
            });
            assert.equal(created.status, 200);
            assert.equal(created.data.job.costCredits, 10);
            assert.equal(
                (await call('/api/video/credits', { token })).data.credits,
                STARTER_CREDITS + 20 - 10
            );

            const unknown = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'ai_clip', values: { prompt: 'x' }, modelId: 'لا-وجود' },
            });
            assert.equal(unknown.status, 400);

            // veo3_fast لا يدعم 1:1 — تحقق خادمي لا واجهة فقط
            const badRatio = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'ai_clip', values: { prompt: 'x', aspectRatio: '1:1' }, modelId: 'veo3_fast' },
            });
            assert.equal(badRatio.status, 400);
            assert.match(badRatio.data.error, /لا يدعم/);
        });

        test('كتالوج النماذج في /templates حاضر مع التوليد وغائب بدونه', async () => {
            const withAi = await call('/api/video/templates', { token: makeToken('jamal') });
            assert.ok(withAi.data.aiModels.length >= 2);
            assert.ok(withAi.data.aiModels.some(m => m.id === 'veo3_fast'));
            // قرار منتج: مستويات جودة لا أسماء مزودين — لا مسار fal يتسرب للواجهة
            assert.ok(withAi.data.aiModels.every(m => m.falPath === undefined));
            assert.ok(withAi.data.aiModels.every(m => !/veo|wan|kling/i.test(m.nameAr)));
            // خرائط الإخراج تصل للواجهة لتبني معاينة البرومت بنفس تركيب الخادم
            assert.ok(withAi.data.cinema.some(c => c.key === 'mood'));
            assert.ok(withAi.data.cinema.find(c => c.key === 'shotSize').map['واسعة']);

            // خدمة تركيب فقط: لا كتالوج (فلا وعد بميزة معطلة)
            const compOnly = createApp({
                store, jwtSecret: JWT_SECRET,
                provider: buildProvider({}, { composition: createMockProvider(), ai: null }),
            });
            const s = await new Promise(resolve => {
                const srv = compOnly.listen(0, () => resolve(srv));
            });
            try {
                const res = await callAt(`http://127.0.0.1:${s.address().port}`, '/api/video/templates', {
                    token: makeToken('jamal'),
                });
                assert.deepEqual(res.data.aiModels, []);
            } finally {
                await new Promise(resolve => s.close(resolve));
            }
        });

        test('المشرف معفى من سقف المستخدم الفردي — والسقف العام يسري عليه', async () => {
            // TIGHT: سقف الفرد 1 والعام 2 — المشرف يتجاوز الأول لا الثاني
            const admin = makeToken('boss');
            await callAt(cappedUrl, '/api/video/credits', { token: admin });
            await callAt(cappedUrl, '/api/video/admin/credits/grant', {
                method: 'POST', token: admin, body: { username: 'boss', amount: 10 },
            });
            const body = { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' } };

            const r1 = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token: admin, body });
            assert.equal(r1.status, 200);
            const r2 = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token: admin, body });
            assert.equal(r2.status, 200, 'تجاوز سقف الفرد (1) لأنه مشرف');
            const r3 = await callAt(cappedUrl, '/api/video/renders', { method: 'POST', token: admin, body });
            assert.equal(r3.status, 429);
            assert.equal(r3.data.code, 'daily_cap_reached'); // العام بلا استثناء لأحد
        });

        // ─── بنك الشخصيات ──────────────────────────────────────────────

        test('بنك الشخصيات: الإنشاء يولّد ٣ زوايا ويخصم، والفشل يسترد بالتفاصيل', async () => {
            // خادم بمولّد صور وهمي محقون — بلا شبكة
            const genPrompts = [];
            const fakeImages = {
                name: 'fake-image',
                async generateImage(prompt) {
                    genPrompts.push(prompt);
                    return `https://img.test/${genPrompts.length}.png`;
                },
            };
            const app = createApp({
                store, jwtSecret: JWT_SECRET, provider, imageProvider: fakeImages,
            });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('casting');
                await callAt(url, '/api/video/credits', { token }); // رصيد ترحيبي 3

                const desc = 'A man in his 40s with a grey beard wearing a long dark coat';
                const created = await callAt(url, '/api/video/characters', {
                    method: 'POST', token, body: { name: 'البطل', description: desc },
                });
                assert.equal(created.status, 200);
                const c = created.data.character;
                assert.equal(c.images.length, 3);
                assert.deepEqual(c.images.map(i => i.angle), ['front', 'side', 'back']);
                // كل برومت زاوية يبدأ بالوصف الحرفي نفسه
                assert.ok(genPrompts.every(p => p.startsWith(desc)));

                // الخصم وقع (1 رصيد)
                const credits = await callAt(url, '/api/video/credits', { token });
                assert.equal(credits.data.credits, STARTER_CREDITS - CHARACTER_COST_CREDITS);

                // مدخلات فاسدة تُرفض قبل أي خصم
                assert.equal((await callAt(url, '/api/video/characters', {
                    method: 'POST', token, body: { name: '', description: desc },
                })).status, 400);
                assert.equal((await callAt(url, '/api/video/characters', {
                    method: 'POST', token, body: { name: 'س', description: 'قصير' },
                })).status, 400);

                // عزل: مستخدم آخر لا يرى ولا يحذف
                const other = makeToken('outsider');
                assert.equal((await callAt(url, '/api/video/characters', { token: other })).data.characters.length, 0);
                assert.equal((await callAt(url, `/api/video/characters/${c.id}`, {
                    method: 'DELETE', token: other,
                })).status, 404);

                // فشل التوليد: استرداد + السبب الكامل
                fakeImages.generateImage = async () => { throw new Error('نموذج الصور مشغول'); };
                const before = (await callAt(url, '/api/video/credits', { token })).data.credits;
                const failed = await callAt(url, '/api/video/characters', {
                    method: 'POST', token, body: { name: 'ثانية', description: desc },
                });
                assert.equal(failed.status, 502);
                assert.match(failed.data.error, /نموذج الصور مشغول/);
                assert.equal((await callAt(url, '/api/video/credits', { token })).data.credits, before);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('إدراج الشخصية في لقطة: حقن الوصف الحرفي + صورة الزاوية + العدّاد', async () => {
            const token = makeToken('director-cast');
            await call('/api/video/credits', { token });
            await call('/api/video/admin/credits/grant', {
                method: 'POST', token: makeToken('boss'), body: { username: 'director-cast', amount: 20 },
            });
            const desc = 'A knight in silver armor with a red cape';
            const character = await store.createCharacter({
                username: 'director-cast', name: 'الفارس', description: desc,
                images: [
                    { angle: 'front', url: 'https://img.test/front.png' },
                    { angle: 'side', url: 'https://img.test/side.png' },
                    { angle: 'back', url: 'https://img.test/back.png' },
                ],
            });

            // قالب الصورة بلا رابط يدوي — الشخصية توفّر الإطار الأول
            const created = await call('/api/video/renders', {
                method: 'POST', token,
                body: {
                    templateId: 'ai_image_clip', modelId: 'wan_i2v',
                    characterId: character.id, characterAngle: 'side',
                    values: { prompt: 'يمتطي حصانه نحو القلعة' },
                },
            });
            assert.equal(created.status, 200);
            const job = await getJob(store, created.data.job.id);
            assert.ok(job.spec.prompt.startsWith(desc + '. '), 'الوصف الحرفي في المقدمة');
            assert.equal(job.spec.imageUrl, 'https://img.test/side.png');
            assert.equal(job.spec.characterId, character.id);
            assert.equal((await store.getCharacter(character.id)).usageCount, 1);

            // قالب الصورة بلا صورة ولا شخصية → 400 واضح
            const missing = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'ai_image_clip', modelId: 'wan_i2v', values: { prompt: 'مشهد' } },
            });
            assert.equal(missing.status, 400);
            assert.match(missing.data.error, /شخصية|صورة/);

            // شخصية مستخدم آخر → 400 بلا تسريب
            const foreign = await call('/api/video/renders', {
                method: 'POST', token: makeToken('stranger-2'),
                body: {
                    templateId: 'ai_image_clip', modelId: 'wan_i2v',
                    characterId: character.id, values: { prompt: 'مشهد' },
                },
            });
            assert.equal(foreign.status, 400);
        });

        test('مولّد صور fal: مسارات المتابعة بمعرّف التطبيق ومهلة صريحة', async () => {
            const calls = [];
            const fetchImpl = async (url, opts = {}) => {
                calls.push(url);
                if (opts.method === 'POST') return { ok: true, json: async () => ({ request_id: 'img-1' }) };
                if (url.endsWith('/status')) return { ok: true, json: async () => ({ status: 'COMPLETED' }) };
                return { ok: true, json: async () => ({ images: [{ url: 'https://img.fal/x.png' }] }) };
            };
            const p = createFalImageProvider({
                apiKey: 'K', model: 'fal-ai/flux/schnell', fetchImpl, sleep: async () => {},
            });
            assert.equal(await p.generateImage('hero'), 'https://img.fal/x.png');
            assert.equal(calls[0], 'https://queue.fal.run/fal-ai/flux/schnell');
            assert.equal(calls[1], 'https://queue.fal.run/fal-ai/flux/requests/img-1/status');
            assert.equal(calls[2], 'https://queue.fal.run/fal-ai/flux/requests/img-1');

            // مهلة: حالة لا تكتمل أبداً ترمي خطأً عربياً لا تعليقاً صامتاً
            const stuck = createFalImageProvider({
                apiKey: 'K', model: 'm/x', maxWaitMs: 10, pollMs: 1, sleep: async () => {},
                fetchImpl: async (url, opts = {}) => opts.method === 'POST'
                    ? { ok: true, json: async () => ({ request_id: 'r' }) }
                    : { ok: true, json: async () => ({ status: 'IN_PROGRESS' }) },
            });
            await assert.rejects(() => stuck.generateImage('x'), /مهلة/);

            // استخراج الرابط يغطي الأشكال المختلفة
            assert.equal(extractImageUrl({ images: [{ url: 'a' }] }), 'a');
            assert.equal(extractImageUrl({ image: { url: 'b' } }), 'b');
            assert.equal(extractImageUrl({ image: 'c' }), 'c');
            assert.equal(extractImageUrl({}), null);

            // برومت الزوايا يحمل الوصف والزاوية
            assert.match(characterImagePrompt('desc', 'back'), /^desc\. seen from behind/);
            assert.ok(validateCharacterInput({ name: 'س', description: 'قصير' }).error);
        });

        test('مزوّد TTS عبر fal: نفس آلية الطابور، ومهلة صريحة، واستخراج رابط الصوت', async () => {
            const calls = [];
            const bodies = [];
            const fetchImpl = async (url, opts = {}) => {
                calls.push(url);
                if (opts.method === 'POST') {
                    bodies.push(JSON.parse(opts.body));
                    return { ok: true, json: async () => ({ request_id: 'tts-1' }) };
                }
                if (url.endsWith('/status')) return { ok: true, json: async () => ({ status: 'COMPLETED' }) };
                return { ok: true, json: async () => ({ audio: { url: 'https://tts.fal/x.mp3' } }) };
            };
            const p = createFalTtsProvider({
                apiKey: 'K', model: 'fal-ai/some-tts/voice', voice: 'ar-arabic', fetchImpl, sleep: async () => {},
            });
            assert.equal(await p.generateSpeech('مرحباً'), 'https://tts.fal/x.mp3');
            assert.equal(calls[0], 'https://queue.fal.run/fal-ai/some-tts/voice');
            assert.equal(calls[1], 'https://queue.fal.run/fal-ai/some-tts/requests/tts-1/status');
            assert.equal(calls[2], 'https://queue.fal.run/fal-ai/some-tts/requests/tts-1');
            // الصوت يُرسل فقط عند ضبطه صراحة
            assert.deepEqual(bodies[0], { text: 'مرحباً', voice: 'ar-arabic' });

            const noVoice = createFalTtsProvider({ apiKey: 'K', model: 'm/x', fetchImpl, sleep: async () => {} });
            await noVoice.generateSpeech('نص');
            assert.deepEqual(bodies[1], { text: 'نص' });

            // مهلة: حالة لا تكتمل أبداً ترمي خطأً عربياً لا تعليقاً صامتاً
            const stuck = createFalTtsProvider({
                apiKey: 'K', model: 'm/x', maxWaitMs: 10, pollMs: 1, sleep: async () => {},
                fetchImpl: async (url, opts = {}) => opts.method === 'POST'
                    ? { ok: true, json: async () => ({ request_id: 'r' }) }
                    : { ok: true, json: async () => ({ status: 'IN_PROGRESS' }) },
            });
            await assert.rejects(() => stuck.generateSpeech('x'), /مهلة/);

            // استخراج الرابط يغطي الأشكال المختلفة
            assert.equal(extractAudioUrl({ audio: { url: 'a' } }), 'a');
            assert.equal(extractAudioUrl({ audio_url: 'b' }), 'b');
            assert.equal(extractAudioUrl({ audio: 'c' }), 'c');
            assert.equal(extractAudioUrl({}), null);

            // البناء من البيئة: مخفي بلا fal مفعَّل أو بلا FAL_TTS_MODEL
            assert.equal(buildTtsProvider({}), null);
            assert.equal(buildTtsProvider({ VIDEO_AI_PROVIDER: 'fal' }), null);
            assert.ok(buildTtsProvider({ VIDEO_AI_PROVIDER: 'fal', FAL_KEY: 'K', FAL_TTS_MODEL: 'm/x' }));
        });

        // ─── مشاريع الأفلام (ستوري بورد) ───────────────────────────────

        test('المشاريع: إنشاء وقائمة وإعادة تسمية وحذف — بعزل صارم بين المستخدمين', async () => {
            const token = makeToken('filmmaker');
            const other = makeToken('intruder');

            const created = await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'فيلمي الأول' },
            });
            assert.equal(created.status, 200);
            const pid = created.data.project.id;

            assert.equal((await call('/api/video/projects', { method: 'POST', token, body: { title: '   ' } })).status, 400);
            assert.equal((await call('/api/video/projects', { method: 'POST', token, body: { title: 'ط'.repeat(81) } })).status, 400);

            assert.equal((await call('/api/video/projects', { token })).data.projects.length, 1);

            // مستخدم آخر: لا يرى ولا يصل — 404 لا 403 (لا نؤكد حتى الوجود)
            assert.equal((await call('/api/video/projects', { token: other })).data.projects.length, 0);
            assert.equal((await call(`/api/video/projects/${pid}`, { token: other })).status, 404);
            assert.equal((await call(`/api/video/projects/${pid}`, { method: 'PATCH', token: other, body: { title: 'اختراق' } })).status, 404);
            assert.equal((await call(`/api/video/projects/${pid}`, { method: 'DELETE', token: other })).status, 404);

            const renamed = await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { title: 'الفيلم النهائي' },
            });
            assert.equal(renamed.data.project.title, 'الفيلم النهائي');

            assert.equal((await call(`/api/video/projects/${pid}`, { method: 'DELETE', token })).status, 200);
            assert.equal((await call(`/api/video/projects/${pid}`, { token })).status, 404);
        });

        test('إعدادات المشروع الموروثة: إنشاء/تعديل برفض القيم المجهولة، ومفتاح غائب لا يُمس', async () => {
            const token = makeToken('art-director');

            // إنشاء بإعداد فاسد → 400 قبل أي إنشاء
            assert.equal((await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'x', defaultAspectRatio: '3:2' },
            })).status, 400);
            assert.equal((await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'x', defaultStyle: 'كرتوني' },
            })).status, 400);

            const created = await call('/api/video/projects', {
                method: 'POST', token,
                body: { title: 'وثائقي درامي', defaultAspectRatio: '9:16', defaultStyle: 'نوار' },
            });
            assert.equal(created.status, 200);
            assert.equal(created.data.project.defaultAspectRatio, '9:16');
            assert.equal(created.data.project.defaultStyle, 'نوار');
            const pid = created.data.project.id;

            // خيارات الإعداد تصل في قائمة المشاريع (مصدر حقيقة واحد للواجهة)
            const list = await call('/api/video/projects', { token });
            assert.ok(list.data.settingsOptions.aspects.includes('9:16'));
            assert.ok(list.data.settingsOptions.styles.includes('نوار'));

            // تعديل نسبة الأبعاد وحدها لا يمسّ الأسلوب المحفوظ
            const patched = await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { defaultAspectRatio: '1:1' },
            });
            assert.equal(patched.data.project.defaultAspectRatio, '1:1');
            assert.equal(patched.data.project.defaultStyle, 'نوار'); // بلا تغيير

            // إعداد فاسد في التعديل → 400 بلا أي تغيير
            const before = await call(`/api/video/projects/${pid}`, { token });
            assert.equal((await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { defaultStyle: 'غير موجود' },
            })).status, 400);
            const after = await call(`/api/video/projects/${pid}`, { token });
            assert.deepEqual(after.data.project, before.data.project);
        });

        test('🎨 التلوين السينمائي: فلتر افتراضي للمشروع — تحقق ورفض ومسح صريح', async () => {
            const token = makeToken('grader');
            const pid = (await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'مشروع تلوين' },
            })).data.project.id;

            // فلتر مجهول → 400 بلا أي تغيير
            assert.equal((await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { defaultFilter: 'وردي فاقع' },
            })).status, 400);

            // قيمة صالحة تُحفظ وتظهر في قائمة الخيارات (مصدر حقيقة واحد للواجهة)
            const patched = await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { defaultFilter: 'أبيض وأسود' },
            });
            assert.equal(patched.status, 200);
            assert.equal(patched.data.project.defaultFilter, 'أبيض وأسود');
            const list = await call('/api/video/projects', { token });
            assert.ok(list.data.settingsOptions.filters.includes('أبيض وأسود'));

            // مسح صريح بقيمة فارغة
            const cleared = await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { defaultFilter: '' },
            });
            assert.equal(cleared.status, 200);
            assert.equal(cleared.data.project.defaultFilter, null);
        });

        test('🧬 التحكم بمحاكاة LORA: بصمة أسلوب المشروع — طول أقصى وفلترة محتوى ومسح', async () => {
            const token = makeToken('lora-writer');
            const pid = (await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'مشروع بصمة' },
            })).data.project.id;

            // طويلة جداً → 400
            assert.equal((await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { styleProfile: 'ط'.repeat(301) },
            })).status, 400);

            // تُحفظ وتُقرأ كما هي
            const patched = await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { styleProfile: 'أنمي ياباني بألوان زاهية' },
            });
            assert.equal(patched.status, 200);
            assert.equal(patched.data.project.styleProfile, 'أنمي ياباني بألوان زاهية');

            // مسح صريح بقيمة فارغة
            const cleared = await call(`/api/video/projects/${pid}`, {
                method: 'PATCH', token, body: { styleProfile: '' },
            });
            assert.equal(cleared.data.project.styleProfile, null);

            // محتوى محظور → 400 (نفس فحص بقية النصوص في الخدمة — الخادم المقيّد بقائمة حظر)
            const blockedPid = (await callAt(cappedUrl, '/api/video/projects', {
                method: 'POST', token, body: { title: 'مشروع مقيّد' },
            })).data.project.id;
            assert.equal((await callAt(cappedUrl, `/api/video/projects/${blockedPid}`, {
                method: 'PATCH', token, body: { styleProfile: 'نص فيه كلمةمحظورة هنا' },
            })).status, 400);
        });

        test('🧬 بصمة الأسلوب تُحقن في مقدمة كل برومت بالمشروع — قبل وصف الشخصية إن وُجدت', async () => {
            // تطبيق مستقل (حصة renderLimit خاصة) + مولّد صور وهمي لإنشاء شخصية.
            const fakeImages = {
                name: 'fake-image',
                async generateImage(prompt) { return `https://img.test/${Date.now()}.png`; },
            };
            const app = createApp({
                store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider, imageProvider: fakeImages,
            });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('lora-director');
                await callAt(url, '/api/video/credits', { token });
                await callAt(url, '/api/video/admin/credits/grant', {
                    method: 'POST', token: makeToken('boss'), body: { username: 'lora-director', amount: 20 },
                });
                const pid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token, body: { title: 'فيلم ببصمة' },
                })).data.project.id;
                await callAt(url, `/api/video/projects/${pid}`, {
                    method: 'PATCH', token, body: { styleProfile: 'anime style fingerprint' },
                });

                // بلا شخصية: بصمة الأسلوب وحدها في المقدمة
                const withoutChar = await callAt(url, '/api/video/renders', {
                    method: 'POST', token,
                    body: { templateId: 'ai_clip', values: { prompt: 'مشهد' }, projectId: pid },
                });
                assert.equal(withoutChar.status, 200);
                const j1 = await getJob(store, withoutChar.data.job.id);
                assert.match(j1.spec.prompt, /^anime style fingerprint\. /);

                // مع شخصية: البصمة أولاً ثم وصف الشخصية ثم البرومت (الأعمّ فالأخصّ)
                const char = await callAt(url, '/api/video/characters', {
                    method: 'POST', token,
                    body: { name: 'البطل', description: 'رجل بمعطف أزرق' },
                });
                assert.equal(char.status, 200);
                const withChar = await callAt(url, '/api/video/renders', {
                    method: 'POST', token,
                    body: {
                        templateId: 'ai_clip', values: { prompt: 'مشهد آخر' },
                        projectId: pid, characterId: char.data.character.id,
                    },
                });
                assert.equal(withChar.status, 200);
                const j2 = await getJob(store, withChar.data.job.id);
                assert.match(j2.spec.prompt, /^anime style fingerprint\. رجل بمعطف أزرق\. /);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('🎨 فلتر المشروع الافتراضي يُستخدم عند التجميع فقط إن لم يُحدَّد فلتر صراحةً', async () => {
            // تطبيق مستقل: /assemble يشارك محدود renderLimit مع /renders.
            const app = createApp({ store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('color-editor');
                await callAt(url, '/api/video/credits', { token });
                const pid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token, body: { title: 'فيلم بفلتر افتراضي' },
                })).data.project.id;
                await callAt(url, `/api/video/projects/${pid}`, {
                    method: 'PATCH', token, body: { defaultFilter: 'دافئ مُشبع' },
                });

                const j = await createJob(store, {
                    username: 'color-editor', templateId: 'ai_clip',
                    values: { prompt: 'لقطة' },
                    spec: { kind: 'ai_prompt', durationSec: 5, prompt: 'x' },
                    costCredits: 1, projectId: pid, shotIndex: 0,
                });
                await transitionJob(store, j.id, 'rendering', {});
                await transitionJob(store, j.id, 'done', { videoUrl: 'https://v.test/0.mp4' });

                // خيارات التجميع تعرض الفلتر الافتراضي المحفوظ
                const opts = await callAt(url, `/api/video/projects/${pid}/assembly-options`, { token });
                assert.equal(opts.data.defaultFilter, 'دافئ مُشبع');

                // لا فلتر مُحدَّد في الطلب → يقع على فلتر المشروع الافتراضي
                const asm1 = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: {},
                });
                assert.equal(asm1.status, 200);
                const film1 = await getJob(store, asm1.data.job.id);
                assert.equal(film1.spec.filter, 'boost'); // قيمة Shotstack لـ"دافئ مُشبع"

                // فلتر صريح في الطلب يتفوق على افتراضي المشروع
                const asm2 = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { filter: 'أبيض وأسود' },
                });
                assert.equal(asm2.status, 200);
                const film2 = await getJob(store, asm2.data.job.id);
                assert.equal(film2.spec.filter, 'greyscale');
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('توريث إعدادات المشروع في اللقطة الجديدة: يُطبَّق فقط حين يترك المستخدم الحقل فارغاً', async () => {
            // تطبيق مستقل (حصة renderLimit خاصة — نفس سبب اختباري الشعار
            // وإعادة الترتيب أعلاه).
            const app = createApp({ store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('inheritor');
                await callAt(url, '/api/video/credits', { token });
                await callAt(url, '/api/video/admin/credits/grant', {
                    method: 'POST', token: makeToken('boss'), body: { username: 'inheritor', amount: 20 },
                });
                const pid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token,
                    body: { title: 'فيلم موروث', defaultAspectRatio: '9:16', defaultStyle: 'أنمي' },
                })).data.project.id;

                // لم يحدد المستخدم نسبة الأبعاد ولا الأسلوب — يرثهما من المشروع
                const inherited = await callAt(url, '/api/video/renders', {
                    method: 'POST', token,
                    body: { templateId: 'ai_clip', values: { prompt: 'مشهد' }, projectId: pid },
                });
                assert.equal(inherited.status, 200);
                const j1 = await getJob(store, inherited.data.job.id);
                assert.equal(j1.spec.aspectRatio, '9:16');
                assert.match(j1.spec.prompt, /anime/i);

                // المستخدم يحدد نسبة صراحة (مدعومة لدى النموذج) — تتفوق
                // على الموروثة من المشروع (9:16)
                const overridden = await callAt(url, '/api/video/renders', {
                    method: 'POST', token,
                    body: { templateId: 'ai_clip', values: { prompt: 'مشهد', aspectRatio: '16:9' }, projectId: pid },
                });
                assert.equal(overridden.status, 200);
                const j2 = await getJob(store, overridden.data.job.id);
                assert.equal(j2.spec.aspectRatio, '16:9');

                // بلا مشروع: لا توريث بالطبع — الافتراضي العادي للقالب
                const free = await callAt(url, '/api/video/renders', {
                    method: 'POST', token,
                    body: { templateId: 'ai_clip', values: { prompt: 'مشهد حر' } },
                });
                assert.equal(free.status, 200);
                const j3 = await getJob(store, free.data.job.id);
                assert.equal(j3.spec.aspectRatio, '16:9');
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('اللقطات تنضم للمشروع بترتيب يسنده الخادم وتبقى بعد حذفه في السجل', async () => {
            const token = makeToken('director2');
            await call('/api/video/credits', { token });
            const pid = (await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'قصة قصيرة' },
            })).data.project.id;

            const s0 = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'promo_announcement', values: { headline: 'أ', cta: 'ب' }, projectId: pid },
            });
            assert.equal(s0.status, 200);
            await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'promo_announcement', values: { headline: 'ج', cta: 'د' }, projectId: pid },
            });

            const detail = await call(`/api/video/projects/${pid}`, { token });
            assert.equal(detail.data.shots.length, 2);
            assert.deepEqual(detail.data.shots.map(s => s.shotIndex), [0, 1]);
            // القيم تعود للمالك — أساس "إعادة التوليد" و"أساس للقطة جديدة"
            assert.equal(detail.data.shots[0].values.headline, 'أ');

            // مشروع مستخدم آخر أو وهمي في الطلب → 400 بلا إنشاء مهمة
            const other = makeToken('someone-else');
            await call('/api/video/credits', { token: other });
            const foreign = await call('/api/video/renders', {
                method: 'POST', token: other,
                body: { templateId: 'promo_announcement', values: { headline: 'س', cta: 'ص' }, projectId: pid },
            });
            assert.equal(foreign.status, 400);
            const ghost = await call('/api/video/renders', {
                method: 'POST', token,
                body: { templateId: 'promo_announcement', values: { headline: 'س', cta: 'ص' }, projectId: 'لا-وجود' },
            });
            assert.equal(ghost.status, 400);

            // حذف المشروع يزيل التجميع فقط — اللقطات باقية في السجل العام
            await call(`/api/video/projects/${pid}`, { method: 'DELETE', token });
            const jobs = await call('/api/video/renders', { token });
            assert.equal(jobs.data.jobs.length, 2);
        });

        // ─── تجميع الفيلم ──────────────────────────────────────────────

        test('buildFilmSpec: مشاهد متتابعة بأزمنة صحيحة + لوحة ختامية + رفض الفراغ', () => {
            const spec = buildFilmSpec({
                shots: [
                    { durationSec: 5, videoUrl: 'https://v.test/a.mp4' },
                    { durationSec: 8, videoUrl: 'https://v.test/b.mp4' },
                ],
                transition: 'fade', musicUrl: 'https://m.test/epic.mp3', endTitle: 'JAOLA',
            });
            assert.equal(spec.kind, 'timeline');
            assert.equal(spec.assembly, true);
            assert.equal(spec.scenes.length, 3); // لقطتان + ختام
            assert.deepEqual(spec.scenes.map(s => s.startSec), [0, 5, 13]);
            assert.equal(spec.durationSec, 16);
            assert.equal(spec.scenes[0].layers[0].kind, 'video');
            assert.equal(spec.scenes[2].layers[0].text, 'JAOLA');
            assert.throws(() => buildFilmSpec({ shots: [] }));

            // ترجمة Shotstack: مقاطع فيديو + موسيقى + انتقال المخطط
            const timeline = specToShotstackTimeline(spec);
            const clips = timeline.tracks[0].clips;
            assert.equal(clips[0].asset.type, 'video');
            assert.equal(clips[0].asset.src, 'https://v.test/a.mp4');
            assert.deepEqual(clips[0].transition, { in: 'fade', out: 'fade' });
            assert.equal(timeline.soundtrack.src, 'https://m.test/epic.mp3');

            // فلتر ما بعد الإنتاج يُطبَّق على لقطات الفيديو فقط
            const filtered = buildFilmSpec({
                shots: [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }],
                filter: 'greyscale', endTitle: 'ختام',
            });
            const fClips = specToShotstackTimeline(filtered).tracks[0].clips;
            assert.equal(fClips[0].filter, 'greyscale');       // لقطة فيديو
            assert.equal(fClips[1].filter, undefined);          // العنوان بلا فلتر

            // مكتبة الموسيقى: فارغة بلا env، وفاسدة تفشل صاخباً
            assert.deepEqual(readMusicLibrary({}), []);
            assert.equal(readMusicLibrary({
                MUSIC_LIBRARY_JSON: JSON.stringify([{ id: 'epic', nameAr: 'ملحمية', url: 'https://m.test/e.mp3' }]),
            })[0].id, 'epic');
            assert.throws(() => readMusicLibrary({ MUSIC_LIBRARY_JSON: 'ليس json' }));
            assert.throws(() => readMusicLibrary({ MUSIC_LIBRARY_JSON: JSON.stringify([{ id: 'x' }]) }));
        });

        test('هندسة الصوت: مكتبتا الموسيقى/المؤثرات وحالة TTS مستقلة عن أي مشروع', async () => {
            const token = makeToken('audio-checker');
            const res = await call('/api/video/audio-options', { token });
            assert.equal(res.status, 200);
            // بلا مكتبات مضبوطة في بيئة الاختبار (لا MUSIC_LIBRARY_JSON/SFX_LIBRARY_JSON) وبلا TTS
            assert.deepEqual(res.data.music, []);
            assert.deepEqual(res.data.sfx, []);
            assert.equal(res.data.narrationEnabled, false);
            assert.equal(typeof res.data.narrationCostCredits, 'number');

            // بلا توكن → 401 (نفس حماية بقية مسارات الخدمة)
            assert.equal((await call('/api/video/audio-options')).status, 401);
        });

        test('هندسة الصوت: مكتبات مضبوطة تصل برابطها الكامل للمعاينة (لا id/nameAr فقط)', async () => {
            const app = createApp({
                store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider,
                musicLibrary: [{ id: 'm1', nameAr: 'مقطع', url: 'https://music.test/a.mp3' }],
                sfxLibrary: [{ id: 's1', nameAr: 'مؤثر', url: 'https://sfx.test/b.mp3' }],
                ttsProvider: { async generateSpeech() { return 'x'; } },
            });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const res = await callAt(url, '/api/video/audio-options', { token: makeToken('audio-checker-2') });
                assert.equal(res.status, 200);
                assert.deepEqual(res.data.music, [{ id: 'm1', nameAr: 'مقطع', url: 'https://music.test/a.mp3' }]);
                assert.deepEqual(res.data.sfx, [{ id: 's1', nameAr: 'مؤثر', url: 'https://sfx.test/b.mp3' }]);
                assert.equal(res.data.narrationEnabled, true);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('تجميع الفيلم عبر المسار: لقطات جاهزة → مهمة تركيب بخصم وتحقق', async () => {
            const token = makeToken('editor');
            await call('/api/video/credits', { token });
            const pid = (await call('/api/video/projects', {
                method: 'POST', token, body: { title: 'فيلم للتجميع' },
            })).data.project.id;

            // لا لقطات جاهزة → 400
            const empty = await call(`/api/video/projects/${pid}/assemble`, {
                method: 'POST', token, body: {},
            });
            assert.equal(empty.status, 400);

            // لقطتان مكتملتان بروابط (نبنيهما مباشرة في المخزن)
            for (const n of [0, 1]) {
                const j = await createJob(store, {
                    username: 'editor', templateId: 'ai_clip',
                    values: { prompt: `لقطة ${n}` },
                    spec: { kind: 'ai_prompt', durationSec: 5, prompt: 'x' },
                    costCredits: 1, projectId: pid, shotIndex: n,
                });
                await transitionJob(store, j.id, 'rendering', {});
                await transitionJob(store, j.id, 'done', { videoUrl: `https://v.test/${n}.mp4` });
            }

            const opts = await call(`/api/video/projects/${pid}/assembly-options`, { token });
            assert.equal(opts.status, 200);
            assert.equal(opts.data.readyShots, 2);
            assert.ok(opts.data.transitions.includes('تلاشٍ'));
            assert.ok(opts.data.filters.includes('أبيض وأسود'));
            assert.ok(opts.data.aspects.includes('9:16'));

            // انتقال/فلتر/مقاس مجهول → 400
            assert.equal((await call(`/api/video/projects/${pid}/assemble`, {
                method: 'POST', token, body: { transition: 'دوران' },
            })).status, 400);
            assert.equal((await call(`/api/video/projects/${pid}/assemble`, {
                method: 'POST', token, body: { filter: 'وردي' },
            })).status, 400);
            assert.equal((await call(`/api/video/projects/${pid}/assemble`, {
                method: 'POST', token, body: { aspect: '3:2' },
            })).status, 400);

            const before = (await call('/api/video/credits', { token })).data.credits;
            const asm = await call(`/api/video/projects/${pid}/assemble`, {
                method: 'POST', token,
                body: { transition: 'تلاشٍ', endTitle: 'النهاية', filter: 'خافت سينمائي', aspect: '9:16' },
            });
            assert.equal(asm.status, 200);
            assert.equal(asm.data.job.costCredits, ASSEMBLY_COST_CREDITS);
            assert.equal(
                (await call('/api/video/credits', { token })).data.credits,
                before - ASSEMBLY_COST_CREDITS
            );

            const film = await getJob(store, asm.data.job.id);
            assert.equal(film.templateId, 'film_assembly');
            assert.equal(film.projectId, pid);
            assert.equal(film.spec.assembly, true);
            assert.equal(film.spec.scenes.length, 3); // لقطتان + ختام
            assert.equal(film.spec.transition, 'fade');
            assert.equal(film.spec.filter, 'muted');
            assert.equal(film.spec.aspectRatio, '9:16');

            // مشروع مستخدم آخر → 404
            assert.equal((await call(`/api/video/projects/${pid}/assemble`, {
                method: 'POST', token: makeToken('not-editor'), body: {},
            })).status, 404);
        });

        test('شعار المستخدم: مسار مركّب علوي طوال الفيلم، ورابط فاسد يُرفض قبل أي خصم', () => {
            const spec = buildFilmSpec({
                shots: [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }],
                logoUrl: 'https://logo.test/x.png',
            });
            assert.equal(spec.logoUrl, 'https://logo.test/x.png');

            const timeline = specToShotstackTimeline(spec);
            // مسار الشعار أولاً (أعلى البقية) ويمتد طوال مدة الفيلم كاملة
            assert.equal(timeline.tracks.length, 2);
            const logoClip = timeline.tracks[0].clips[0];
            assert.equal(logoClip.asset.type, 'image');
            assert.equal(logoClip.asset.src, 'https://logo.test/x.png');
            assert.equal(logoClip.length, spec.durationSec);
            assert.equal(logoClip.position, 'topRight');

            // بلا شعار: مسار واحد فقط (لا تغيير عن السلوك القديم)
            const noLogo = buildFilmSpec({ shots: [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }] });
            assert.equal(specToShotstackTimeline(noLogo).tracks.length, 1);
        });

        test('مؤثر صوتي للانتقال: مقطع قصير عند كل نقطة انتقال بين المشاهد', () => {
            const spec = buildFilmSpec({
                shots: [
                    { durationSec: 5, videoUrl: 'https://v.test/a.mp4' },
                    { durationSec: 8, videoUrl: 'https://v.test/b.mp4' },
                ],
                endTitle: 'ختام', sfxUrl: 'https://sfx.test/whoosh.mp3',
            });
            assert.deepEqual(spec.sceneStarts, [0, 5, 13]); // لقطتان + ختام
            const timeline = specToShotstackTimeline(spec);
            // مسار المؤثر منفصل عن الفيديو والشعار — آخر مسار
            const sfxTrack = timeline.tracks.at(-1);
            assert.equal(sfxTrack.clips.length, 3);
            assert.deepEqual(sfxTrack.clips.map(c => c.start), [0, 5, 13]);
            assert.equal(sfxTrack.clips[0].asset.type, 'audio');
            assert.equal(sfxTrack.clips[0].asset.src, 'https://sfx.test/whoosh.mp3');

            // بلا مؤثر: لا مسار إضافي
            const noSfx = buildFilmSpec({ shots: [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }] });
            assert.equal(specToShotstackTimeline(noSfx).tracks.length, 1);

            // مكتبة المؤثرات: فارغة بلا env، وفاسدة تفشل صاخباً (نفس قاعدة الموسيقى)
            assert.deepEqual(readSfxLibrary({}), []);
            assert.equal(readSfxLibrary({
                SFX_LIBRARY_JSON: JSON.stringify([{ id: 'whoosh', nameAr: 'انتقال', url: 'https://sfx.test/w.mp3' }]),
            })[0].id, 'whoosh');
            assert.throws(() => readSfxLibrary({ SFX_LIBRARY_JSON: 'ليس json' }));
        });

        test('تعليق صوتي (TTS): مسار كامل الفيلم، منفصل عن الموسيقى والمؤثرات', () => {
            const spec = buildFilmSpec({
                shots: [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }],
                musicUrl: 'https://music.test/bg.mp3',
                narrationUrl: 'https://tts.test/voice.mp3',
            });
            assert.equal(spec.narrationUrl, 'https://tts.test/voice.mp3');
            const timeline = specToShotstackTimeline(spec);
            const narrTrack = timeline.tracks.find(t => t.clips[0]?.asset?.src === 'https://tts.test/voice.mp3');
            assert.ok(narrTrack);
            assert.equal(narrTrack.clips[0].start, 0);
            assert.equal(narrTrack.clips[0].length, spec.durationSec);
            // الموسيقى تبقى soundtrack منفصلاً — لا تعارض
            assert.equal(timeline.soundtrack.src, 'https://music.test/bg.mp3');

            const noNarration = buildFilmSpec({ shots: [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }] });
            assert.equal(specToShotstackTimeline(noNarration).tracks.length, 1);
        });

        test('دقة الإخراج: افتراضي hd، وقيمة صريحة تُحفظ في المخطط', () => {
            const shots = [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }];
            assert.equal(buildFilmSpec({ shots }).resolution, DEFAULT_RESOLUTION);
            assert.equal(buildFilmSpec({ shots, resolution: '4k' }).resolution, '4k');
            assert.deepEqual(OUTPUT_RESOLUTIONS, ['sd', 'hd', '1080', '4k']);
        });

        test('علامة الخطة المجانية: مسار عنوان منفصل زاوية سفلى يسرى، وغيابها بلا مسار إضافي', () => {
            const shots = [{ durationSec: 5, videoUrl: 'https://v.test/a.mp4' }];
            const spec = buildFilmSpec({ shots, logoUrl: 'https://logo.test/x.png', watermarkText: DEFAULT_WATERMARK_TEXT });
            assert.equal(spec.watermarkText, DEFAULT_WATERMARK_TEXT);
            const timeline = specToShotstackTimeline(spec);
            // شعار + علامة مائية: مساران فوق الفيديو + مسار الفيديو نفسه
            assert.equal(timeline.tracks.length, 3);
            const wmClip = timeline.tracks.find(t => t.clips[0]?.asset?.text === DEFAULT_WATERMARK_TEXT).clips[0];
            assert.equal(wmClip.asset.type, 'title');
            assert.equal(wmClip.position, 'bottomLeft');
            assert.equal(wmClip.length, spec.durationSec);

            const noWatermark = buildFilmSpec({ shots });
            assert.equal(noWatermark.watermarkText, null);
            assert.equal(specToShotstackTimeline(noWatermark).tracks.length, 1);
        });

        test('التجميع: شعار برابط فاسد يُرفض بـ400 قبل الخصم، وشعار صالح يصل المخطط', async () => {
            // تطبيق مستقل: /assemble يشارك محدود renderLimit مع /renders،
            // وقد استُهلك حصة الساعة عبر عشرات النداءات في بقية هذا الملف —
            // تطبيق جديد يملك عدّاده الخاص فلا يتأثر بذلك.
            const app = createApp({ store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('logo-user');
                await callAt(url, '/api/video/credits', { token });
                const pid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token, body: { title: 'فيلم بشعار' },
                })).data.project.id;
                const j = await createJob(store, {
                    username: 'logo-user', templateId: 'ai_clip', values: { prompt: 'x' },
                    spec: { kind: 'ai_prompt', durationSec: 5, prompt: 'x' },
                    costCredits: 1, projectId: pid, shotIndex: 0,
                });
                await transitionJob(store, j.id, 'rendering', {});
                await transitionJob(store, j.id, 'done', { videoUrl: 'https://v.test/0.mp4' });

                const before = (await callAt(url, '/api/video/credits', { token })).data.credits;
                const badLogo = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { logoUrl: 'file:///etc/passwd' },
                });
                assert.equal(badLogo.status, 400);
                assert.equal((await callAt(url, '/api/video/credits', { token })).data.credits, before); // لا خصم

                const ssrfLogo = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { logoUrl: 'http://127.0.0.1/logo.png' },
                });
                assert.equal(ssrfLogo.status, 400);

                const ok = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { logoUrl: 'https://logo.test/mine.png' },
                });
                assert.equal(ok.status, 200);
                const film = await getJob(store, ok.data.job.id);
                assert.equal(film.spec.logoUrl, 'https://logo.test/mine.png');

                // مؤثر صوتي مجهول → 400 (بلا مكتبة SFX مضبوطة في هذه الخدمة)
                const badSfx = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { sfxId: 'لا-وجود' },
                });
                assert.equal(badSfx.status, 400);

                // تعليق صوتي مطلوب لكن TTS غير مفعَّل في هذه الخدمة → 400
                const badTts = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { narrationText: 'مرحباً بكم' },
                });
                assert.equal(badTts.status, 400);
                assert.match(badTts.data.error, /التعليق الصوتي غير مفعَّل/);

                // دقة غير معروفة → 400
                const badRes = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { resolution: '8k' },
                });
                assert.equal(badRes.status, 400);
                // دقة صحيحة (4k) تصل المخطط رغم كونها غير مؤكَّدة عملياً
                const okRes = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { resolution: '4k' },
                });
                assert.equal(okRes.status, 200);
                assert.equal((await getJob(store, okRes.data.job.id)).spec.resolution, '4k');
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('علامة الخطة المجانية: تُفرض من الخادم حسب ادّعاء plan في التوكن — لا حقل يرسله العميل', async () => {
            // تطبيق مستقل بتفعيل صريح (معطَّل افتراضياً — راجع التعليق في server.js).
            const app = createApp({
                store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider,
                watermarkEnforced: true, watermarkText: 'TESTMARK',
            });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                // مستخدم بلا ادّعاء plan (توكن قديم/افتراضي) → يُعامَل مجانياً
                const freeToken = makeToken('free-plan-user');
                await callAt(url, '/api/video/credits', { token: freeToken });
                const freePid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token: freeToken, body: { title: 'مجاني' },
                })).data.project.id;
                const freeJob = await createJob(store, {
                    username: 'free-plan-user', templateId: 'ai_clip', values: { prompt: 'x' },
                    spec: { kind: 'ai_prompt', durationSec: 5, prompt: 'x' },
                    costCredits: 1, projectId: freePid, shotIndex: 0,
                });
                await transitionJob(store, freeJob.id, 'rendering', {});
                await transitionJob(store, freeJob.id, 'done', { videoUrl: 'https://v.test/0.mp4' });

                const freeOpts = await callAt(url, `/api/video/projects/${freePid}/assembly-options`, { token: freeToken });
                assert.equal(freeOpts.data.watermarked, true);
                const freeAssemble = await callAt(url, `/api/video/projects/${freePid}/assemble`, {
                    method: 'POST', token: freeToken, body: {},
                });
                assert.equal(freeAssemble.status, 200);
                const freeSpec = (await getJob(store, freeAssemble.data.job.id)).spec;
                assert.equal(freeSpec.watermarkText, 'TESTMARK');

                // مستخدم بخطة pro → بلا علامة، ولا يملك أي حقل يُسقطها بنفسه
                const proToken = makeToken('pro-plan-user', { plan: 'pro' });
                await callAt(url, '/api/video/credits', { token: proToken });
                const proPid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token: proToken, body: { title: 'احترافي' },
                })).data.project.id;
                const proJob = await createJob(store, {
                    username: 'pro-plan-user', templateId: 'ai_clip', values: { prompt: 'x' },
                    spec: { kind: 'ai_prompt', durationSec: 5, prompt: 'x' },
                    costCredits: 1, projectId: proPid, shotIndex: 0,
                });
                await transitionJob(store, proJob.id, 'rendering', {});
                await transitionJob(store, proJob.id, 'done', { videoUrl: 'https://v.test/1.mp4' });

                const proOpts = await callAt(url, `/api/video/projects/${proPid}/assembly-options`, { token: proToken });
                assert.equal(proOpts.data.watermarked, false);
                const proAssemble = await callAt(url, `/api/video/projects/${proPid}/assemble`, {
                    // محاولة تمرير watermarkText من العميل — لا حقل معروف بهذا الاسم، يُتجاهل بصمت
                    method: 'POST', token: proToken, body: { watermarkText: 'محاولة تحايل' },
                });
                assert.equal(proAssemble.status, 200);
                assert.equal((await getJob(store, proAssemble.data.job.id)).spec.watermarkText, null);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('تعليق صوتي (TTS): خصم مقدَّم ونجاح يصل المخطط، وفشل يسترد الرصيد', async () => {
            // تطبيق مستقل بمزوّد TTS محاكى — لا شبكة حقيقية، فقط تحقّق التوصيل.
            const ttsCalls = [];
            const ttsProvider = {
                async generateSpeech(text) {
                    ttsCalls.push(text);
                    if (text === 'ارفضني') throw new Error('رفض النموذج النص');
                    return 'https://tts.test/out.mp3';
                },
            };
            const app = createApp({
                store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider, ttsProvider,
            });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('narrator');
                await callAt(url, '/api/video/credits', { token });
                const opts0 = await callAt(url, '/api/video/projects', {
                    method: 'POST', token, body: { title: 'فيلم بتعليق صوتي' },
                });
                const pid = opts0.data.project.id;
                const j = await createJob(store, {
                    username: 'narrator', templateId: 'ai_clip', values: { prompt: 'x' },
                    spec: { kind: 'ai_prompt', durationSec: 5, prompt: 'x' },
                    costCredits: 1, projectId: pid, shotIndex: 0,
                });
                await transitionJob(store, j.id, 'rendering', {});
                await transitionJob(store, j.id, 'done', { videoUrl: 'https://v.test/0.mp4' });

                const options = await callAt(url, `/api/video/projects/${pid}/assembly-options`, { token });
                assert.equal(options.data.narrationEnabled, true);
                assert.equal(typeof options.data.narrationCostCredits, 'number');

                const before = (await callAt(url, '/api/video/credits', { token })).data.credits;
                const ok = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { narrationText: 'مرحباً بكم في الفيلم' },
                });
                assert.equal(ok.status, 200);
                const film = await getJob(store, ok.data.job.id);
                assert.equal(film.spec.narrationUrl, 'https://tts.test/out.mp3');
                assert.deepEqual(ttsCalls, ['مرحباً بكم في الفيلم']);
                // النجاح يخصم تكلفة التعليق الصوتي + تكلفة التجميع نفسه (منفصلتان)
                const afterOk = (await callAt(url, '/api/video/credits', { token })).data.credits;
                assert.equal(afterOk, before - options.data.narrationCostCredits - options.data.costCredits);

                // فشل توليد الصوت → 502 واسترداد خصم التعليق الصوتي فقط (لا تجميع يُنشأ أصلاً)
                const beforeFail = afterOk;
                const failed = await callAt(url, `/api/video/projects/${pid}/assemble`, {
                    method: 'POST', token, body: { narrationText: 'ارفضني' },
                });
                assert.equal(failed.status, 502);
                assert.match(failed.data.error, /استُرد الرصيد/);
                const afterFail = (await callAt(url, '/api/video/credits', { token })).data.credits;
                assert.equal(afterFail, beforeFail); // مسترد بالكامل — لا خصم تجميع لأن الفشل سابق لإنشاء المهمة
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('إعادة ترتيب اللقطات (سحب وإفلات): ترتيب صحيح يُطبَّق، والجزئي/الأجنبي يُرفض', async () => {
            // تطبيق مستقل لنفس سبب الاختبار السابق (حصة renderLimit خاصة).
            const app = createApp({ store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('reorderer');
                await callAt(url, '/api/video/credits', { token });
                const pid = (await callAt(url, '/api/video/projects', {
                    method: 'POST', token, body: { title: 'إعادة الترتيب' },
                })).data.project.id;

                const ids = [];
                for (const n of [0, 1, 2]) {
                    const r = await callAt(url, '/api/video/renders', {
                        method: 'POST', token,
                        body: { templateId: 'promo_announcement', values: { headline: `${n}`, cta: 'ب' }, projectId: pid },
                    });
                    ids.push(r.data.job.id);
                }
                // الترتيب الأصلي [0,1,2] — نعكسه
                const reversed = [...ids].reverse();
                const ok = await callAt(url, `/api/video/projects/${pid}/reorder`, {
                    method: 'PATCH', token, body: { order: reversed },
                });
                assert.equal(ok.status, 200);
                const afterReorder = await callAt(url, `/api/video/projects/${pid}`, { token });
                assert.deepEqual(afterReorder.data.shots.map(x => x.id), reversed);

                // ترتيب ناقص لقطة → 400 بلا أي تغيير
                const partial = await callAt(url, `/api/video/projects/${pid}/reorder`, {
                    method: 'PATCH', token, body: { order: ids.slice(0, 2) },
                });
                assert.equal(partial.status, 400);

                // معرّف غريب مكان معرّف حقيقي → 400
                const foreignId = await callAt(url, `/api/video/projects/${pid}/reorder`, {
                    method: 'PATCH', token, body: { order: [ids[0], ids[1], 'لا-وجود'] },
                });
                assert.equal(foreignId.status, 400);

                // ترتيب فارغ / بلا مصفوفة → 400
                assert.equal((await callAt(url, `/api/video/projects/${pid}/reorder`, {
                    method: 'PATCH', token, body: { order: [] },
                })).status, 400);
                assert.equal((await callAt(url, `/api/video/projects/${pid}/reorder`, {
                    method: 'PATCH', token, body: {},
                })).status, 400);

                // مشروع مستخدم آخر → 404
                assert.equal((await callAt(url, `/api/video/projects/${pid}/reorder`, {
                    method: 'PATCH', token: makeToken('not-reorderer'), body: { order: reversed },
                })).status, 404);
            } finally {
                await new Promise(r => s.close(r));
            }
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
