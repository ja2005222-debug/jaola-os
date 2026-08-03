/**
 * 🎬 JAOLA Video Studio — خدمة مستقلة كلياً عن منصة JAOLA الرئيسية
 *
 * الفصل المتعمد: صفر استيراد من backend/ — الرابط الوحيد مع المنصة هو
 * الدخول الموحّد (نفس JWT_SECRET يتحقق محلياً من نفس التوكن). تعطُّل أو
 * بطء هذه الخدمة لا يمس المنصة، والعكس صحيح، وتُنشر وتتوسع باستقلال.
 *
 * createApp({...}) مصنع قابل للحقن (المجلد/السر/المزود) — الاختبارات
 * تبنيه بمجلد مؤقت ومزود محاكاة وتشغّل المحرك يدوياً بلا مؤقتات.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAX_ACTIVE_JOBS_PER_USER = 3;
const ENGINE_POLL_MS = 5000;

export function createApp({
    dataDir,
    jwtSecret,
    adminUsersCsv = process.env.ADMIN_USERS || '',
    provider,
} = {}) {
    if (!jwtSecret) {
        // نفس حارس المنصة: لا تشغيل أبداً بسر مفقود/افتراضي.
        throw new Error('JWT_SECRET غير مضبوط — لا يمكن تشغيل خدمة الفيديو بأمان.');
    }
    if (!dataDir) throw new Error('dataDir مطلوب.');
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
        res.json({ ok: true, service: 'jaola-video-service', provider: provider.name });
    });

    // ─── مسارات المستخدم (توكن المنصة نفسه) ────────────────────────────
    app.get('/api/video/templates', verifyToken, (req, res) => {
        res.json({ templates: listTemplates() });
    });

    app.get('/api/video/credits', verifyToken, (req, res) => {
        res.json({
            credits: getBalance(dataDir, req.user.username),
            ledger: getUserLedger(dataDir, req.user.username, 30),
        });
    });

    app.post('/api/video/renders', verifyToken, renderLimit, (req, res) => {
        const { templateId, values } = req.body || {};
        const template = getTemplate(String(templateId || ''));
        if (!template) return res.status(400).json({ error: 'قالب غير معروف.' });

        const validated = validateValues(template, values);
        if (validated.error) return res.status(400).json({ error: validated.error });

        const username = req.user.username;
        if (countActiveJobsForUser(dataDir, username) >= MAX_ACTIVE_JOBS_PER_USER) {
            return res.status(429).json({
                error: `لديك ${MAX_ACTIVE_JOBS_PER_USER} مهام نشطة بالفعل — انتظر اكتمالها أولاً.`,
            });
        }

        const spec = compileSpec(template, validated.values);

        // الخصم قبل الإنشاء — مهمة بلا خصمٍ مثبت لا تدخل الطابور أبداً.
        // نُنشئ المهمة أولاً لنملك jobId يربط الخصم بها في سجل التدقيق،
        // فإن فشل الخصم (رصيد غير كافٍ) نُفشلها فوراً قبل أي معالجة.
        const job = createJob(dataDir, {
            username, templateId: template.id, values: validated.values,
            spec, costCredits: template.costCredits,
        });
        const deducted = deductCredits(dataDir, {
            username, amount: template.costCredits, jobId: job.id,
        });
        if (!deducted) {
            transitionJob(dataDir, job.id, 'failed', { error: 'رصيد غير كافٍ.', refunded: false });
            return res.status(402).json({
                error: `رصيدك الحالي (${getBalance(dataDir, username)}) لا يكفي — هذا القالب يكلف ${template.costCredits}.`,
            });
        }

        res.json({ job: { id: job.id, status: job.status, costCredits: job.costCredits } });
    });

    app.get('/api/video/renders', verifyToken, (req, res) => {
        const jobs = listJobsByUser(dataDir, req.user.username).map(j => ({
            id: j.id, at: j.at, templateId: j.templateId, status: j.status,
            videoUrl: j.videoUrl, error: j.error, costCredits: j.costCredits,
            updatedAt: j.updatedAt,
        }));
        res.json({ jobs });
    });

    app.get('/api/video/renders/:id', verifyToken, (req, res) => {
        const job = getJob(dataDir, req.params.id);
        // عزل صارم: مهمة مستخدم آخر تُعامل كغير موجودة (404 لا 403) —
        // لا نؤكد حتى وجودها.
        if (!job || job.username !== String(req.user.username || '').trim().toLowerCase()) {
            return res.status(404).json({ error: 'المهمة غير موجودة.' });
        }
        res.json({
            job: {
                id: job.id, at: job.at, templateId: job.templateId, status: job.status,
                videoUrl: job.videoUrl, error: job.error, costCredits: job.costCredits,
                updatedAt: job.updatedAt,
            },
        });
    });

    // ─── مسارات المشرف ─────────────────────────────────────────────────
    app.post('/api/video/admin/credits/grant', verifyToken, adminOnly, (req, res) => {
        const { username, amount, note } = req.body || {};
        const ok = grantCredits(dataDir, {
            username, amount, grantedBy: req.user.username, note: note || null,
        });
        if (!ok) return res.status(400).json({ error: 'بيانات منح غير صالحة (اسم مستخدم + عدد صحيح موجب).' });
        res.json({ success: true, credits: getBalance(dataDir, username) });
    });

    app.get('/api/video/admin/status', verifyToken, adminOnly, (req, res) => {
        const active = listActiveJobs(dataDir);
        res.json({
            provider: provider.name,
            activeJobs: active.length,
            queued: active.filter(j => j.status === 'queued').length,
            rendering: active.filter(j => j.status === 'rendering').length,
        });
    });

    return app;
}

// ─── الإقلاع الفعلي (لا يعمل عند الاستيراد من الاختبارات) ──────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const dataDir = process.env.VIDEO_DATA_DIR || path.join(__dirname, '.videostudio');
    const provider = buildProvider({
        providerName: process.env.VIDEO_PROVIDER || 'mock',
        shotstackApiKey: process.env.SHOTSTACK_API_KEY,
        shotstackEnv: process.env.SHOTSTACK_ENV,
    });
    const app = createApp({
        dataDir,
        jwtSecret: process.env.JWT_SECRET,
        provider,
    });

    const port = Number(process.env.PORT || 4100);
    app.listen(port, () => {
        console.log(`🎬 خدمة الفيديو تعمل على المنفذ ${port} (المزود: ${provider.name})`);
    });

    // الحلقة المجدولة — الحارس داخل runEngineTickGuarded يمنع التداخل.
    setInterval(() => {
        runEngineTickGuarded(dataDir, { provider });
    }, ENGINE_POLL_MS);
}
