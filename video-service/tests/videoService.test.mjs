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
import { specToShotstackTimeline } from '../src/providers/shotstackProvider.js';
import { runEngineTick, JOB_TIMEOUT_MS } from '../src/engine.js';
import { getBalance, grantCredits, deductCredits, refundCredits, STARTER_CREDITS } from '../src/credits.js';
import { getTemplate, validateValues, compileSpec, listTemplates } from '../src/templates.js';
import { createJob, getJob, transitionJob, listActiveJobs } from '../src/jobs.js';
import { createFileStore } from '../src/store/fileStore.js';
import { createPostgresStore } from '../src/store/postgresStore.js';

const JWT_SECRET = 'test-secret-not-for-production';

function makeToken(username, extra = {}) {
    return jwt.sign({ id: username, username, ...extra }, JWT_SECRET, { expiresIn: '1h' });
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

        before(async () => {
            store = await makeStore();
            await store.init();
            provider = createMockProvider({ pollsToComplete: 2 });
            const app = createApp({ store, jwtSecret: JWT_SECRET, adminUsersCsv: 'boss', provider });
            await new Promise(resolve => { server = app.listen(0, resolve); });
            baseUrl = `http://127.0.0.1:${server.address().port}`;
        });

        after(async () => {
            await new Promise(resolve => server.close(resolve));
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
            assert.equal(res.data.provider, 'mock');
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
