/**
 * 🎬 JAOLA Video Studio — خدمة مستقلة كلياً عن منصة JAOLA الرئيسية
 *
 * الفصل المتعمد: صفر استيراد من backend/ — الرابط الوحيد مع المنصة هو
 * الدخول الموحّد (نفس JWT_SECRET يتحقق محلياً من نفس التوكن). تعطُّل أو
 * بطء هذه الخدمة لا يمس المنصة، والعكس صحيح، وتُنشر وتتوسع باستقلال.
 *
 * createApp({...}) مصنع قابل للحقن (المخزن/السر/المزود) — الاختبارات
 * تبنيه بمخزن مؤقت ومزود محاكاة وتشغّل المحرك يدوياً بلا مؤقتات.
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildVerifyToken, buildAdminOnly } from './src/auth.js';
import { listTemplates, getTemplate, validateValues, compileSpec } from './src/templates.js';
import { getBalance, grantCredits, deductCredits, getUserLedger } from './src/credits.js';
import { createJob, getJob, listJobsByUser, countActiveJobsForUser, listActiveJobs, transitionJob } from './src/jobs.js';
import { runEngineTickGuarded } from './src/engine.js';
import { buildProvider } from './src/providers/index.js';
import { buildStore } from './src/store/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAX_ACTIVE_JOBS_PER_USER = 3;
const ENGINE_POLL_MS = 5000;

/** يلتقط أخطاء المسارات غير المتزامنة إلى معالج Express بدل ابتلاعها. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({
    store,
    jwtSecret,
    adminUsersCsv = process.env.ADMIN_USERS || '',
    provider,
} = {}) {
    if (!jwtSecret) {
        // نفس حارس المنصة: لا تشغيل أبداً بسر مفقود/افتراضي.
        throw new Error('JWT_SECRET غير مضبوط — لا يمكن تشغيل خدمة الفيديو بأمان.');
    }
    if (!store) throw new Error('store مطلوب.');
    if (!provider) throw new Error('provider مطلوب.');

    const verifyToken = buildVerifyToken(jwtSecret);
    const adminOnly = buildAdminOnly(adminUsersCsv);

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '256kb' }));

    // واجهة الاستوديو الذاتية — الخدمة تقدّم واجهتها بنفسها (فصل حقيقي
    // عن واجهة المنصة الرئيسية؛ الرابط بينهما تسليم التوكن فقط).
    app.use(express.static(path.join(__dirname, 'public')));

    const renderLimit = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 30,
        message: { error: 'تجاوزت حد إنشاء الفيديوهات المسموح في الساعة.' },
    });

    // ─── مسارات عامة ────────────────────────────────────────────────────
    app.get('/api/health', (req, res) => {
        res.json({
            ok: true, service: 'jaola-video-service',
            provider: provider.name, store: store.name,
        });
    });

    // ─── مسارات المستخدم (توكن المنصة نفسه) ────────────────────────────
    app.get('/api/video/templates', verifyToken, (req, res) => {
        res.json({ templates: listTemplates() });
    });

    app.get('/api/video/credits', verifyToken, wrap(async (req, res) => {
        res.json({
            credits: await getBalance(store, req.user.username),
            ledger: await getUserLedger(store, req.user.username, 30),
        });
    }));

    app.post('/api/video/renders', verifyToken, renderLimit, wrap(async (req, res) => {
        const { templateId, values } = req.body || {};
        const template = getTemplate(String(templateId || ''));
        if (!template) return res.status(400).json({ error: 'قالب غير معروف.' });

        const validated = validateValues(template, values);
        if (validated.error) return res.status(400).json({ error: validated.error });

        const username = req.user.username;
        if (await countActiveJobsForUser(store, username) >= MAX_ACTIVE_JOBS_PER_USER) {
            return res.status(429).json({
                error: `لديك ${MAX_ACTIVE_JOBS_PER_USER} مهام نشطة بالفعل — انتظر اكتمالها أولاً.`,
            });
        }

        const spec = compileSpec(template, validated.values);

        // الخصم قبل المعالجة — مهمة بلا خصمٍ مثبت لا تُعالَج أبداً.
        // نُنشئ المهمة أولاً لنملك jobId يربط الخصم بها في سجل التدقيق،
        // فإن فشل الخصم (رصيد غير كافٍ) نُفشلها فوراً قبل أن يلمسها المحرك.
        const job = await createJob(store, {
            username, templateId: template.id, values: validated.values,
            spec, costCredits: template.costCredits,
        });
        const deducted = await deductCredits(store, {
            username, amount: template.costCredits, jobId: job.id,
        });
        if (!deducted) {
            await transitionJob(store, job.id, 'failed', { error: 'رصيد غير كافٍ.' });
            return res.status(402).json({
                error: `رصيدك الحالي (${await getBalance(store, username)}) لا يكفي — هذا القالب يكلف ${template.costCredits}.`,
            });
        }

        res.json({ job: { id: job.id, status: job.status, costCredits: job.costCredits } });
    }));

    const publicJob = j => ({
        id: j.id, at: j.at, templateId: j.templateId, status: j.status,
        videoUrl: j.videoUrl, error: j.error, costCredits: j.costCredits,
        updatedAt: j.updatedAt,
    });

    app.get('/api/video/renders', verifyToken, wrap(async (req, res) => {
        const jobs = await listJobsByUser(store, req.user.username);
        res.json({ jobs: jobs.map(publicJob) });
    }));

    app.get('/api/video/renders/:id', verifyToken, wrap(async (req, res) => {
        const job = await getJob(store, req.params.id);
        // عزل صارم: مهمة مستخدم آخر تُعامل كغير موجودة (404 لا 403) —
        // لا نؤكد حتى وجودها.
        if (!job || job.username !== String(req.user.username || '').trim().toLowerCase()) {
            return res.status(404).json({ error: 'المهمة غير موجودة.' });
        }
        res.json({ job: publicJob(job) });
    }));

    // ─── مسارات المشرف ─────────────────────────────────────────────────
    app.post('/api/video/admin/credits/grant', verifyToken, adminOnly, wrap(async (req, res) => {
        const { username, amount, note } = req.body || {};
        const ok = await grantCredits(store, {
            username, amount, grantedBy: req.user.username, note: note || null,
        });
        if (!ok) return res.status(400).json({ error: 'بيانات منح غير صالحة (اسم مستخدم + عدد صحيح موجب).' });
        res.json({ success: true, credits: await getBalance(store, username) });
    }));

    app.get('/api/video/admin/status', verifyToken, adminOnly, wrap(async (req, res) => {
        const active = await listActiveJobs(store);
        res.json({
            provider: provider.name,
            store: store.name,
            activeJobs: active.length,
            queued: active.filter(j => j.status === 'queued').length,
            rendering: active.filter(j => j.status === 'rendering').length,
        });
    }));

    // معالج أخطاء أخير — لا تسريب تفاصيل داخلية للعميل.
    app.use((err, req, res, next) => {
        console.error('⚠️ خطأ غير متوقع في خدمة الفيديو:', err.message);
        res.status(500).json({ error: 'خطأ داخلي في الخدمة.' });
    });

    return app;
}

// ─── الإقلاع الفعلي (لا يعمل عند الاستيراد من الاختبارات) ──────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const store = buildStore({
        databaseUrl: process.env.DATABASE_URL,
        dataDir: process.env.VIDEO_DATA_DIR || path.join(__dirname, '.videostudio'),
    });
    const provider = buildProvider({
        providerName: process.env.VIDEO_PROVIDER || 'mock',
        shotstackApiKey: process.env.SHOTSTACK_API_KEY,
        shotstackEnv: process.env.SHOTSTACK_ENV,
    });

    await store.init(); // ينشئ الجداول عند أول إقلاع — فشلٌ صاخب إن تعذّر

    const app = createApp({ store, jwtSecret: process.env.JWT_SECRET, provider });

    const port = Number(process.env.PORT || 4100);
    app.listen(port, () => {
        console.log(`🎬 خدمة الفيديو على المنفذ ${port} (المزود: ${provider.name}، التخزين: ${store.name})`);
        if (store.name === 'file') {
            console.warn('⚠️ تخزين بالملفات — على منصة ذات قرص مؤقت تُمسح الأرصدة مع كل إعادة نشر. اضبط DATABASE_URL للإنتاج.');
        }
    });

    // الحلقة المجدولة — الحارس داخل runEngineTickGuarded يمنع التداخل.
    setInterval(() => {
        runEngineTickGuarded(store, { provider });
    }, ENGINE_POLL_MS);
}
