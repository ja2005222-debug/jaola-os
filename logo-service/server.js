/**
 * 🎨 JALOGO (jalogo.online) — صانع الشعارات بالذكاء الاصطناعي
 *
 * خدمة مستقلة كلياً عن منصة JAOLA الرئيسية — نفس عقيدة video-service:
 * صفر استيراد من backend/، والرابط الوحيد هو الدخول الموحّد (نفس
 * JWT_SECRET يتحقق محلياً من نفس التوكن).
 *
 * الدور التسويقي (سبب وجود الخدمة): صفحة **عامة** يولّد فيها الزائر
 * المجهول مسودات شعار فوراً بلا تسجيل، بينما النسخة النهائية عالية
 * الجودة تتطلب حساب JAOLA — فكل زائر جاد يتحول حسابَ منصةٍ حقيقياً،
 * والحساب نفسه يفتح له jaola.dev وjatrava وjaola.net.
 *
 * createApp({...}) مصنع قابل للحقن (المخزن/السر/المزوّدين) — الاختبارات
 * تبنيه بمخزن مؤقت ومزوّدات محاكاة بلا شبكة.
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildVerifyToken, buildOptionalToken, buildAdminOnly } from './src/auth.js';
import { validateLogoInput, composeLogoPrompt, publicStyles } from './src/prompts.js';
import {
    readLimits, hashIp, checkDraftAllowed, checkFinalAllowed, maybeAlertCost, startOfUtcDay,
} from './src/limits.js';
import { createFileStore } from './src/store/fileStore.js';
import { buildLogoProviders } from './src/providers/falImageProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** يلتقط أخطاء المسارات غير المتزامنة إلى معالج Express بدل ابتلاعها. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({
    store,
    jwtSecret,
    draftProvider,
    finalProvider,
    adminUsersCsv = process.env.ADMIN_USERS || '',
    limits = readLimits(),
    ipSalt = process.env.IP_HASH_SALT,
} = {}) {
    const secrets = (Array.isArray(jwtSecret) ? jwtSecret : [jwtSecret]).filter(Boolean);
    if (secrets.length === 0) {
        throw new Error('JWT_SECRET غير مضبوط — لا يمكن تشغيل خدمة الشعارات بأمان.');
    }
    if (!store) throw new Error('store مطلوب.');
    if (!draftProvider || !finalProvider) {
        throw new Error('مزوّدا التوليد مطلوبان (draft + final) — تحقق من FAL_KEY.');
    }

    const verifyToken = buildVerifyToken(secrets);
    const optionalToken = buildOptionalToken(secrets);
    const adminOnly = buildAdminOnly(adminUsersCsv);

    const app = express();
    // خلف وكيل Render — بدونها req.ip يصبح عنوان الوكيل فيتوحد كل
    // الزوار في IP واحد ويُقفل حد الزائر على العالم كله دفعة واحدة.
    app.set('trust proxy', 1);
    app.use(cors());
    app.use(express.json({ limit: '64kb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    // درع معدل عام فوق درع السقوف: السقوف تحمي الفاتورة، وهذا يحمي
    // الخادم نفسه من الإغراق قبل الوصول لمنطق السقوف أصلاً.
    const generateRateLimit = rateLimit({
        windowMs: 60_000, limit: 10,
        standardHeaders: true, legacyHeaders: false,
        message: { error: 'طلبات كثيرة — انتظر دقيقة وحاول مجدداً.' },
    });

    app.get('/api/health', (req, res) => {
        res.json({
            ok: true, service: 'jalogo',
            providers: { draft: draftProvider.name, final: finalProvider.name },
        });
    });

    // ─── الكتالوج العلني — تعرضه الصفحة قبل أي دخول ────────────────
    app.get('/api/logo/options', (req, res) => {
        res.json({
            styles: publicStyles(),
            draftVariants: limits.draftVariants,
            guestDailyAttempts: limits.dailyDraftCapPerIp,
            userDailyAttempts: limits.dailyDraftCapPerUser,
            monthlyFinals: limits.monthlyFinalCapPerUser,
        });
    });

    // ─── جولة مسودات: مفتوحة للزائر (بحدود) ولصاحب الحساب (أرحب) ───
    app.post('/api/logo/drafts', generateRateLimit, optionalToken, wrap(async (req, res) => {
        const checked = validateLogoInput(req.body);
        if (!checked.ok) return res.status(400).json({ error: checked.error });

        const username = (req.user?.username || '').toLowerCase() || null;
        const ipHash = hashIp(req.ip, ipSalt);
        const gate = await checkDraftAllowed(store, { ipHash, username, limits });
        if (!gate.allowed) return res.status(429).json({ error: gate.error, code: gate.code });

        const prompt = composeLogoPrompt(checked.value);
        // توليد الخيارات بالتوازي، وقبولُ نجاحٍ جزئي: خيار واحد ناجح
        // خير من 502 كاملة لأن نداءً من أربعة تعثّر عند المزوّد.
        const settled = await Promise.allSettled(
            Array.from({ length: limits.draftVariants }, () =>
                draftProvider.generateImage(prompt, { image_size: 'square' }))
        );
        const images = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
        if (images.length === 0) {
            const reason = settled[0]?.reason?.message || 'المزوّد لم يستجب';
            return res.status(502).json({ error: `تعذّر توليد المسودات: ${reason}` });
        }

        const round = await store.recordDraftRound({
            ipHash, username, prompt, params: checked.value, images,
        });
        await maybeAlertCost(store, { limits, count: gate.globalCount });

        res.json({
            id: round.id, images, params: checked.value,
            // شفافية الحد المتبقي — الواجهة تعرضه بدل أن يفاجأ الزائر بالرفض
            remaining: username
                ? limits.dailyDraftCapPerUser - await store.countDraftRoundsSinceForUser(username, startOfUtcDay())
                : limits.dailyDraftCapPerIp - await store.countDraftRoundsSinceForIp(ipHash, startOfUtcDay()),
        });
    }));

    // ─── النسخة النهائية: بحساب فقط — بوابة التحويل التسويقي نفسها ──
    app.post('/api/logo/final', generateRateLimit, verifyToken, wrap(async (req, res) => {
        const username = (req.user.username || '').toLowerCase();
        const { roundId } = req.body || {};
        if (!roundId) return res.status(400).json({ error: 'roundId مطلوب — ولّد مسودات أولاً.' });

        const round = await store.getDraftRound(String(roundId));
        if (!round) return res.status(404).json({ error: 'جولة المسودات غير موجودة أو انتهت.' });
        // جولة زائرٍ مجهول تُتبنّى عند أول نهائي — هذا هو القمع المقصود:
        // ولّد كزائر ثم سجّل لتنزّل. جولة حسابٍ آخر ليست لك.
        if (round.username && round.username !== username) {
            return res.status(403).json({ error: 'هذه الجولة لحساب آخر.' });
        }

        const gate = await checkFinalAllowed(store, { username, limits });
        if (!gate.allowed) return res.status(429).json({ error: gate.error, code: gate.code });

        const imageUrl = await finalProvider.generateImage(round.prompt, { image_size: 'square_hd' });
        const final = await store.recordFinal({
            username, roundId: round.id, prompt: round.prompt, params: round.params, imageUrl,
        });

        res.json({ id: final.id, imageUrl, params: round.params });
    }));

    // ─── شعاراتي — النسخ النهائية لصاحب الحساب ──────────────────────
    app.get('/api/logo/mine', verifyToken, wrap(async (req, res) => {
        const username = (req.user.username || '').toLowerCase();
        const finals = await store.listFinalsByUser(username);
        res.json({ logos: finals.map(({ id, at, imageUrl, params }) => ({ id, at, imageUrl, params })) });
    }));

    // ─── لوحة المشرف: نبض الاستهلاك مقابل السقوف ────────────────────
    app.get('/api/logo/admin/status', verifyToken, adminOnly, wrap(async (req, res) => {
        const since = startOfUtcDay();
        res.json({
            todayDraftRounds: await store.countDraftRoundsSince(since),
            dailyDraftCap: limits.dailyDraftCap,
            providers: { draft: draftProvider.name, final: finalProvider.name },
            limits,
        });
    }));

    // معالج أخطاء عام — رسالة عربية ثابتة للعميل والتفصيل للسجل فقط.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        console.error('jalogo error:', err.message);
        res.status(500).json({ error: 'خطأ داخلي في خدمة الشعارات.' });
    });

    return app;
}

// ─── تشغيل مباشر (ليس استيراد اختبار) ──────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const jwtSecret = [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS].filter(Boolean);
    const { draft, final } = buildLogoProviders(process.env);
    const store = createFileStore({
        dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
    });
    const app = createApp({ store, jwtSecret, draftProvider: draft, finalProvider: final });
    const port = Number(process.env.PORT || 4100);
    app.listen(port, () => {
        console.log(`🎨 JALOGO يعمل على المنفذ ${port}`);
    });
}
