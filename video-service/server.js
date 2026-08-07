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
import { buildVerifyToken, buildAdminOnly, buildIsAdmin } from './src/auth.js';
import { listTemplates, getTemplate, validateValues, compileSpec } from './src/templates.js';
import { getBalance, grantCredits, deductCredits, getUserLedger } from './src/credits.js';
import { createJob, getJob, listJobsByUser, countActiveJobsForUser, listActiveJobs, transitionJob } from './src/jobs.js';
import { runEngineTickGuarded } from './src/engine.js';
import { buildProvider } from './src/providers/index.js';
import { buildStore } from './src/store/index.js';
import { buildStorage, retentionDays as readRetentionDays } from './src/storage/index.js';
import { readLimits, checkRenderAllowed, maybeAlertCost, startOfUtcDay } from './src/limits.js';
import { readBlocklist, inspectValues, inspectText, inspectImageUrl } from './src/contentFilter.js';
import { readAiModels, getAiModel, defaultAiModel, publicAiModels } from './src/models.js';
import { CINEMA_CONTROLS, cinemaFieldOptions } from './src/cinema.js';
import {
    ASSEMBLY_COST_CREDITS, NARRATION_COST_CREDITS, TRANSITIONS, COLOR_FILTERS, OUTPUT_ASPECTS,
    OUTPUT_RESOLUTIONS, DEFAULT_RESOLUTION, DEFAULT_WATERMARK_TEXT,
    CAPTION_STYLES, CAPTION_POSITIONS, DEFAULT_CAPTION_STYLE, DEFAULT_CAPTION_POSITION,
    PLATFORM_PRESETS, readMusicLibrary, readSfxLibrary, buildFilmSpec,
} from './src/assembly.js';
import { buildImageProvider } from './src/providers/falImageProvider.js';
import { buildTtsProvider } from './src/providers/falTtsProvider.js';
import { characterImageKeyFor } from './src/storage/index.js';
import {
    CHARACTER_COST_CREDITS, CHARACTER_ANGLES,
    characterImagePrompt, validateCharacterInput,
} from './src/characters.js';
import { refundCredits } from './src/credits.js';
import { buildScriptProvider } from './src/scriptProvider.js';
import { readyShotsOf, resolveAssemblyOptions, checkAssemblyGates, finalizeAssembly } from './src/assemblyJob.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAX_ACTIVE_JOBS_PER_USER = 3;
const ENGINE_POLL_MS = 5000;
// درع تكلفة لتخطيط السيناريو: مشاهد كثيرة جداً في نداء واحد = تكلفة/زمن
// استجابة أعلى لمزوّد التخطيط بلا فائدة حقيقية (المستخدم يراجع/يعدّل أصلاً).
const MAX_PLAN_SCENES = 8;
const MIN_PLAN_SCENES = 2;

/** يلتقط أخطاء المسارات غير المتزامنة إلى معالج Express بدل ابتلاعها. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({
    store,
    jwtSecret,
    adminUsersCsv = process.env.ADMIN_USERS || '',
    provider,
    storage = null,
    limits = readLimits(),
    blocklist = readBlocklist(),
    aiModels = readAiModels(),
    imageProvider = null,
    musicLibrary = readMusicLibrary(),
    sfxLibrary = readSfxLibrary(),
    ttsProvider = null,
    scriptProvider = null,
    // علامة الخطة المجانية: مفتاح تفعيل صريح منفصل — التوكنات الحالية
    // (المُصدرة قبل حمل ادّعاء plan) تُعامَل مجانية افتراضياً في الفرع
    // أدناه، فتفعيله فوراً عند نشر هذا الكود قد يضع علامة خطأً على
    // مشتركين حاليين حتى يُجدَّد توكنهم (تسجيل دخول جديد). فعّله فقط
    // بعد التأكد من نشر مطالبة plan في توكنات تسجيل الدخول بالمنصة.
    watermarkEnforced = String(process.env.WATERMARK_ENFORCEMENT || '').toLowerCase() === 'true',
    watermarkText = process.env.WATERMARK_TEXT || DEFAULT_WATERMARK_TEXT,
} = {}) {
    const secrets = (Array.isArray(jwtSecret) ? jwtSecret : [jwtSecret]).filter(Boolean);
    if (secrets.length === 0) {
        // نفس حارس المنصة: لا تشغيل أبداً بسر مفقود/افتراضي.
        throw new Error('JWT_SECRET غير مضبوط — لا يمكن تشغيل خدمة الفيديو بأمان.');
    }
    if (!store) throw new Error('store مطلوب.');
    if (!provider) throw new Error('provider مطلوب.');

    const verifyToken = buildVerifyToken(secrets);
    const adminOnly = buildAdminOnly(adminUsersCsv);
    const isAdminUser = buildIsAdmin(adminUsersCsv);

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
            fileStorage: storage ? storage.name : 'provider-hosted',
        });
    });

    // ─── مسارات المستخدم (توكن المنصة نفسه) ────────────────────────────
    // لا نعرض قالباً لا يستطيع المزوّد المفعَّل تنفيذه — عرضه يعني وعداً
    // بميزة تفشل عند أول ضغطة (قالب الذكاء الاصطناعي بلا مزوّد مثلاً).
    const supported = new Set(provider.supportedKinds || ['timeline']);
    const availableTemplates = () => listTemplates().filter(t => supported.has(t.specKind));

    app.get('/api/video/templates', verifyToken, (req, res) => {
        res.json({
            templates: availableTemplates(),
            // كتالوج نماذج التوليد بشكله العلني (مستويات جودة بلا مسارات
            // مزودين). فارغ حين لا مزوّد توليد مفعَّلاً (لا وعد بميزة معطلة).
            aiModels: supported.has('ai_prompt') ? publicAiModels(aiModels) : [],
            // خرائط الإخراج السينمائي — للواجهة كي تعرض معاينة البرومت
            // النهائي حياً بنفس تركيب الخادم حرفياً.
            cinema: CINEMA_CONTROLS.map(c => ({ key: c.key, labelAr: c.labelAr, map: c.map })),
        });
    });

    app.get('/api/video/credits', verifyToken, wrap(async (req, res) => {
        res.json({
            credits: await getBalance(store, req.user.username),
            ledger: await getUserLedger(store, req.user.username, 30),
        });
    }));

    // 🎙️ هندسة الصوت وAI Voice: مكتبات الموسيقى/المؤثرات ورابط كل مقطع
    // (لمعاينته مباشرة) — مستقلة عن أي مشروع، خلافاً لـassembly-options
    // المرتبطة بمشروع محدد. رابط المقطع نفسه علني أصلاً (يُضمَّن حرفياً
    // في الفيلم النهائي المُصدَّر) فلا حساسية إضافية بعرضه هنا للمعاينة.
    app.get('/api/video/audio-options', verifyToken, wrap(async (req, res) => {
        res.json({
            music: musicLibrary.map(({ id, nameAr, url }) => ({ id, nameAr, url })),
            sfx: sfxLibrary.map(({ id, nameAr, url }) => ({ id, nameAr, url })),
            narrationEnabled: !!ttsProvider,
            narrationCostCredits: NARRATION_COST_CREDITS,
        });
    }));

    // ─── مشاريع الأفلام (ستوري بورد) ───────────────────────────────────
    // كل مسارات المشروع تتحقق من الملكية بنفس قاعدة المهام: مشروع مستخدم
    // آخر غير موجود (404) — لا نؤكد حتى وجوده.
    const userOf = req => String(req.user.username || '').trim().toLowerCase();
    const ownedProject = async (req) => {
        const p = await store.getProject(req.params.id);
        return p && p.username === userOf(req) ? p : null;
    };
    const validTitle = raw => {
        const title = String(raw || '').trim();
        return title.length >= 1 && title.length <= 80 ? title : null;
    };
    // مصدر الحقيقة الوحيد لخيارات الإعدادات الموروثة — نفس القوائم التي
    // تراها الواجهة في قالب اللقطة، لا تكرار يتباعد عنها بصمت.
    const PROJECT_ASPECTS = getTemplate('ai_clip').fields.find(f => f.key === 'aspectRatio').options;
    const PROJECT_STYLES = cinemaFieldOptions('style');
    const PROJECT_FILTERS = Object.keys(COLOR_FILTERS);
    const MAX_STYLE_PROFILE_LEN = 300;
    const validSettings = ({ defaultAspectRatio, defaultStyle, defaultFilter, styleProfile }) => {
        if (defaultAspectRatio != null && !PROJECT_ASPECTS.includes(defaultAspectRatio)) {
            return `نسبة أبعاد غير معروفة (المتاح: ${PROJECT_ASPECTS.join('، ')}).`;
        }
        if (defaultStyle != null && !PROJECT_STYLES.includes(defaultStyle)) {
            return `أسلوب بصري غير معروف (المتاح: ${PROJECT_STYLES.join('، ')}).`;
        }
        // فارغ/null = "بلا فلتر افتراضي" — يُفحص فقط حين تصل قيمة فعلية.
        if (defaultFilter && !PROJECT_FILTERS.includes(defaultFilter)) {
            return `فلتر لوني غير معروف (المتاح: ${PROJECT_FILTERS.join('، ')}).`;
        }
        if (styleProfile) {
            if (styleProfile.length > MAX_STYLE_PROFILE_LEN) {
                return `بصمة الأسلوب البصري طويلة جداً (الحد ${MAX_STYLE_PROFILE_LEN} حرفاً).`;
            }
            // تُفحص هنا (مرة عند الحفظ) لا عند كل توليد — تُحقن لاحقاً في
            // كل برومت بهذا المشروع بلا فحص إضافي، فيجب أن تكون نظيفة أولاً.
            const flagged = inspectText(styleProfile, { blocklist });
            if (flagged) return flagged.error;
        }
        return null;
    };

    app.get('/api/video/projects', verifyToken, wrap(async (req, res) => {
        res.json({
            projects: await store.listProjectsByUser(userOf(req), 50),
            settingsOptions: { aspects: PROJECT_ASPECTS, styles: PROJECT_STYLES, filters: PROJECT_FILTERS },
            scriptPlanningEnabled: !!scriptProvider,
        });
    }));

    app.post('/api/video/projects', verifyToken, wrap(async (req, res) => {
        const title = validTitle(req.body?.title);
        if (!title) return res.status(400).json({ error: 'عنوان المشروع مطلوب (حتى 80 حرفاً).' });
        const { defaultAspectRatio, defaultStyle } = req.body || {};
        const issue = validSettings({ defaultAspectRatio, defaultStyle });
        if (issue) return res.status(400).json({ error: issue });
        res.json({
            project: await store.createProject({
                username: userOf(req), title,
                defaultAspectRatio: defaultAspectRatio || null,
                defaultStyle: defaultStyle || null,
            }),
        });
    }));

    app.get('/api/video/projects/:id', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const shots = await store.listJobsByProject(project.id);
        res.json({ project, shots: shots.map(publicJob) });
    }));

    // ✍️ تخطيط سيناريو من فكرة واحدة: "برومت واحد → مسودة فيلم كامل".
    // تخطيط فقط — لا يُنشئ مهمة ولا يخصم رصيداً؛ الناتج يُراجعه المستخدم
    // ويُرسل كل مشهد لاحقاً عبر /api/video/renders العادي بكل حراساته.
    app.post('/api/video/projects/:id/plan-shots', verifyToken, wrap(async (req, res) => {
        if (!scriptProvider) return res.status(503).json({ error: 'تخطيط السيناريو غير مفعَّل على هذا الخادم.' });
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });

        const idea = String(req.body?.idea || '').trim();
        if (idea.length < 5 || idea.length > 500) {
            return res.status(400).json({ error: 'صف فكرة الفيلم بين 5 و500 حرف.' });
        }
        const ideaFlagged = inspectText(idea, { blocklist });
        if (ideaFlagged) return res.status(400).json({ error: ideaFlagged.error });

        const rawCount = parseInt(req.body?.sceneCount, 10);
        const sceneCount = Math.min(Math.max(Number.isFinite(rawCount) ? rawCount : 4, MIN_PLAN_SCENES), MAX_PLAN_SCENES);

        const shotSizeOptions = cinemaFieldOptions('shotSize');
        const cameraMoveOptions = cinemaFieldOptions('cameraMove');
        const lightingOptions = cinemaFieldOptions('lighting');
        const moodOptions = cinemaFieldOptions('mood');
        const styleOptions = cinemaFieldOptions('style');

        let rawScenes;
        try {
            rawScenes = await scriptProvider.planScenes({
                idea, sceneCount, shotSizeOptions, cameraMoveOptions, lightingOptions, moodOptions, styleOptions,
            });
        } catch (e) {
            return res.status(502).json({ error: `تعذّر تخطيط السيناريو: ${e.message}` });
        }

        // 🛡️ مخرجات نموذج خارجي لا تُصدَّق حرفياً: كل حقل يُقيَّد ضمن
        // خيارات cinema.js المسموحة فقط (قيمة خارجها تُسقَط بصمت، لا تُفشل
        // المشهد كله)، والنصوص تمر بنفس فلترة المحتوى — مشهد يفشل الفلترة
        // يُسقَط كاملاً بصمت أيضاً، لا يُفشل الطلب كله لمشهد واحد سيّئ.
        const pickOption = (value, options) => {
            const clean = String(value || '').trim();
            return options.includes(clean) ? clean : '';
        };
        const scenes = [];
        for (const raw of (rawScenes || []).slice(0, MAX_PLAN_SCENES)) {
            const prompt = String(raw?.prompt || '').trim().slice(0, 1000);
            if (!prompt || inspectText(prompt, { blocklist })) continue;
            const captionRaw = String(raw?.caption || '').trim().slice(0, 80);
            const caption = captionRaw && !inspectText(captionRaw, { blocklist }) ? captionRaw : '';
            scenes.push({
                prompt, caption,
                shotSize: pickOption(raw?.shotSize, shotSizeOptions),
                cameraMove: pickOption(raw?.cameraMove, cameraMoveOptions),
                lighting: pickOption(raw?.lighting, lightingOptions),
                mood: pickOption(raw?.mood, moodOptions),
                style: pickOption(raw?.style, styleOptions),
            });
        }
        if (scenes.length === 0) {
            return res.status(502).json({ error: 'تعذّر إنتاج أي مشهد صالح — أعد صياغة الفكرة أو جرّب فكرة أخرى.' });
        }
        res.json({ scenes });
    }));

    // العنوان وإعدادات التوريث الآن مستقلان: أي منهما قد يصل وحده، أو
    // معاً — مفتاح غائب في الطلب لا يمسّ قيمته المخزَّنة.
    app.patch('/api/video/projects/:id', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const { title, defaultAspectRatio, defaultStyle, defaultFilter, styleProfile, defaultCharacterId } = req.body || {};
        let updated = project;
        if (title !== undefined) {
            const clean = validTitle(title);
            if (!clean) return res.status(400).json({ error: 'عنوان المشروع مطلوب (حتى 80 حرفاً).' });
            updated = await store.renameProject(project.id, clean);
        }
        // الشخصية الافتراضية: خلافاً لبقية الإعدادات الموروثة، تُتحقَّق
        // ملكيتها هنا صراحةً (لا تفويض صامت لشخصية مستخدم آخر أبداً).
        if (defaultCharacterId) {
            const c = await store.getCharacter(String(defaultCharacterId));
            if (!c || c.username !== userOf(req)) {
                return res.status(400).json({ error: 'الشخصية المختارة كافتراضية غير موجودة.' });
            }
        }
        if (defaultAspectRatio !== undefined || defaultStyle !== undefined
            || defaultFilter !== undefined || styleProfile !== undefined || defaultCharacterId !== undefined) {
            const cleanStyleProfile = styleProfile !== undefined ? String(styleProfile || '').trim() : undefined;
            const issue = validSettings({
                defaultAspectRatio, defaultStyle, defaultFilter, styleProfile: cleanStyleProfile,
            });
            if (issue) return res.status(400).json({ error: issue });
            updated = await store.updateProjectSettings(project.id, {
                aspectRatio: defaultAspectRatio, style: defaultStyle,
                filter: defaultFilter, styleProfile: cleanStyleProfile,
                characterId: defaultCharacterId,
            });
        }
        res.json({ project: updated });
    }));

    // حذف التجميع فقط — اللقطات تبقى في السجل العام (أُنفق عليها رصيد).
    app.delete('/api/video/projects/:id', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        await store.deleteProject(project.id);
        res.json({ success: true });
    }));

    // إعادة ترتيب لقطات المشروع (سحب وإفلات) — يجب أن يطابق order كل
    // لقطات المشروع تماماً، لا نقبل ترتيباً جزئياً يُسقط لقطة بصمت.
    app.patch('/api/video/projects/:id/reorder', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const order = Array.isArray(req.body?.order) ? req.body.order.map(String) : null;
        if (!order || order.length === 0) return res.status(400).json({ error: 'ترتيب غير صالح.' });
        const ok = await store.reorderProjectShots(project.id, order);
        if (!ok) return res.status(400).json({ error: 'الترتيب لا يطابق لقطات المشروع الحالية.' });
        res.json({ success: true });
    }));

    // ─── تجميع الفيلم: لقطات المشروع الجاهزة → فيلم واحد ────────────────

    app.get('/api/video/projects/:id/assembly-options', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        res.json({
            transitions: Object.keys(TRANSITIONS),
            filters: Object.keys(COLOR_FILTERS),
            captionStyles: Object.keys(CAPTION_STYLES),
            captionPositions: Object.keys(CAPTION_POSITIONS),
            defaultCaptionStyle: DEFAULT_CAPTION_STYLE,
            defaultCaptionPosition: DEFAULT_CAPTION_POSITION,
            aspects: OUTPUT_ASPECTS,
            resolutions: OUTPUT_RESOLUTIONS,
            music: musicLibrary.map(({ id, nameAr }) => ({ id, nameAr })),
            sfx: sfxLibrary.map(({ id, nameAr }) => ({ id, nameAr })),
            narrationEnabled: !!ttsProvider,
            narrationCostCredits: NARRATION_COST_CREDITS,
            costCredits: ASSEMBLY_COST_CREDITS,
            readyShots: (await readyShotsOf(store, project.id)).length,
            watermarked: watermarkEnforced && !['pro', 'enterprise'].includes(req.user.plan),
            defaultFilter: project.defaultFilter || null,
            platformPresets: PLATFORM_PRESETS,
            marketingCopyEnabled: !!scriptProvider,
        });
    }));

    app.post('/api/video/projects/:id/assemble', verifyToken, renderLimit, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });

        // تجميع يدوي بعد تسليح "أكمل تلقائياً": ننزع التسليح فوراً — لا
        // داعٍ لمحاولة تلقائية لاحقة بعد أن جمّع المستخدم بنفسه يدوياً
        // (تفادي تجميعين مزدوجين لنفس المشروع).
        if (project.autoAssemble) {
            await store.setProjectAutoAssemble(project.id, null);
        }

        const resolved = resolveAssemblyOptions({ body: req.body, project, musicLibrary, sfxLibrary, blocklist });
        if (resolved.error) return res.status(400).json({ error: resolved.error });

        const { logoUrl, narrationText } = req.body || {};
        // شعار المستخدم: نفس فحص SSRF/الصيغة على حقول imageUrl في القوالب.
        let cleanLogoUrl = null;
        if (logoUrl) {
            const issue = inspectImageUrl(logoUrl);
            if (issue) return res.status(400).json({ error: issue.error });
            cleanLogoUrl = String(logoUrl);
        }
        // تعليق صوتي (TTS): نص يذهب لمزوّد خارجي — نفس فلترة بقية النصوص.
        const narration = String(narrationText || '').trim().slice(0, 500);
        if (narration) {
            if (!ttsProvider) return res.status(400).json({ error: 'التعليق الصوتي غير مفعَّل على هذا الخادم.' });
            const flagged = inspectText(narration, { blocklist });
            if (flagged) return res.status(400).json({ error: flagged.error });
        }

        const username = userOf(req);
        // البوابات (لقطات جاهزة/سقف مهام نشطة/درع التكلفة) قبل أي توليد
        // صوتي مدفوع — فشلها لا يجب أن يهدر نداء مزوّد خارجي حقيقي.
        const gated = await checkAssemblyGates(store, {
            project, username, maxActiveJobsPerUser: MAX_ACTIVE_JOBS_PER_USER,
            limits, exemptPerUser: isAdminUser(req.user),
        });
        if (gated.error) return res.status(gated.status).json({ error: gated.error, code: gated.code });

        // تعليق صوتي: توليد متزامن (كالصور المرجعية) — خصم مقدَّم يُسترد
        // عند الفشل؛ يحدث بعد كل بوابات الرفض المجانية كي لا يُخصم رصيد
        // على طلب كان سيُرفض على أي حال.
        let narrationUrl = null;
        if (narration) {
            const narrationReqId = `narr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
            const deducted = await deductCredits(store, {
                username, amount: NARRATION_COST_CREDITS, jobId: narrationReqId,
            });
            if (!deducted) {
                return res.status(402).json({
                    error: `رصيدك لا يكفي — التعليق الصوتي يكلف ${NARRATION_COST_CREDITS}.`,
                });
            }
            try {
                narrationUrl = await ttsProvider.generateSpeech(narration);
            } catch (e) {
                await refundCredits(store, {
                    username, amount: NARRATION_COST_CREDITS, jobId: narrationReqId,
                    reason: 'فشل توليد التعليق الصوتي',
                }).catch(() => {});
                return res.status(502).json({ error: `تعذّر توليد التعليق الصوتي: ${e.message} (استُرد الرصيد)` });
            }
        }

        // علامة الخطة المجانية: تُحدَّد من ادّعاء plan في التوكن حصراً —
        // لا حقل يرسله العميل أبداً، فلا يمكن للمستخدم إسقاطها بنفسه.
        // خطة غير معروفة/مفقودة (توكن قديم قبل حمل هذا الادّعاء) تُعامَل
        // مجانية افتراضياً — القاعدة الآمنة تجارياً، لا الأريح للمستخدم.
        const isPaidPlan = ['pro', 'enterprise'].includes(req.user.plan);
        const appliedWatermark = (watermarkEnforced && !isPaidPlan) ? watermarkText : null;

        const result = await finalizeAssembly(store, {
            project, username, storage, ready: gated.ready,
            resolved: resolved.values,
            rawValues: { ...resolved.raw, logoUrl: cleanLogoUrl || '', narrationText: narration || '' },
            watermarkText: appliedWatermark, narrationUrl, logoUrl: cleanLogoUrl,
        });
        if (result.error) return res.status(result.status).json({ error: result.error });
        res.json({ job: { id: result.job.id, status: result.job.status, costCredits: result.job.costCredits } });
    }));

    // 🎬 "أكمل تلقائياً" (AI Producer): تسليح تجميع مؤجَّل — يراجع المستخدم
    // مسودة السيناريو ويرسل كل مشاهدها كالمعتاد (POST /renders لكل مشهد)،
    // ثم يسلّح هذا المسار بخيارات تجميع أساسية؛ محرك المعالجة (engine.js)
    // يُجمِّع تلقائياً بمجرد توقف كل نشاط المشروع — بلا عودة يدوية. لا
    // تعليق صوتي ولا لوجو هنا عمداً (يبقيان يدويين حصراً عبر /assemble).
    app.post('/api/video/projects/:id/auto-assemble', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        if (await store.countJobsInProject(project.id) === 0) {
            return res.status(400).json({ error: 'لا لقطات في هذا المشروع بعد — أرسل مشهداً واحداً على الأقل أولاً.' });
        }
        const resolved = resolveAssemblyOptions({ body: req.body, project, musicLibrary, sfxLibrary, blocklist });
        if (resolved.error) return res.status(400).json({ error: resolved.error });

        const isPaidPlan = ['pro', 'enterprise'].includes(req.user.plan);
        const appliedWatermark = (watermarkEnforced && !isPaidPlan) ? watermarkText : null;

        const updated = await store.setProjectAutoAssemble(project.id, {
            resolved: resolved.values, raw: resolved.raw,
            watermarkText: appliedWatermark, armedAt: Date.now(),
        });
        res.json({ project: updated });
    }));

    app.delete('/api/video/projects/:id/auto-assemble', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const updated = await store.setProjectAutoAssemble(project.id, null);
        res.json({ project: updated });
    }));

    // 🎁 حزمة تسويقية: من مشروع فيه لقطة جاهزة واحدة على الأقل، ثلاث نسخ
    // منصات (تيك توك/يوتيوب/مربع — PLATFORM_PRESETS نفسها) عبر نفس نواة
    // /assemble تماماً (checkAssemblyGates/finalizeAssembly)، بلا أي بوابة
    // مختصرة؛ كل نسخة تُفحص وتُخصم مستقلة، فتقرير جزئي وارد وسليم. النص
    // التسويقي خطوة مجانية منفصلة (بلا خصم ولا مهمة) — فشله لا يُسقط
    // النسخ المرئية الناجحة أصلاً.
    app.post('/api/video/projects/:id/marketing-pack', verifyToken, renderLimit, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const username = userOf(req);

        const ready = await readyShotsOf(store, project.id);
        if (ready.length === 0) {
            return res.status(400).json({ error: 'لا لقطات مكتملة في المشروع بعد — ولّد لقطة واحدة على الأقل.' });
        }

        const isPaidPlan = ['pro', 'enterprise'].includes(req.user.plan);
        const appliedWatermark = (watermarkEnforced && !isPaidPlan) ? watermarkText : null;

        const cuts = [];
        for (const [preset, opts] of Object.entries(PLATFORM_PRESETS)) {
            const resolved = resolveAssemblyOptions({ body: opts, project, musicLibrary, sfxLibrary, blocklist });
            if (resolved.error) { cuts.push({ preset, error: resolved.error }); continue; }
            const gated = await checkAssemblyGates(store, {
                project, username, maxActiveJobsPerUser: MAX_ACTIVE_JOBS_PER_USER,
                limits, exemptPerUser: isAdminUser(req.user),
            });
            if (gated.error) { cuts.push({ preset, error: gated.error }); continue; }
            const outcome = await finalizeAssembly(store, {
                project, username, storage, ready: gated.ready,
                resolved: resolved.values, rawValues: resolved.raw, watermarkText: appliedWatermark,
            });
            if (outcome.error) { cuts.push({ preset, error: outcome.error }); continue; }
            cuts.push({
                preset,
                job: { id: outcome.job.id, status: outcome.job.status, costCredits: outcome.job.costCredits },
            });
        }

        let copy = null;
        if (scriptProvider) {
            try {
                const shotPrompts = ready.map(s => String(s.values?.prompt || '').slice(0, 200)).filter(Boolean);
                const raw = await scriptProvider.generateMarketingCopy({ projectTitle: project.title, shotPrompts });
                // 🛡️ نفس انضباط مخرجات النموذج في plan-shots: طول محدود
                // وفلترة محتوى قبل أن يصل أي نص للمستخدم — نص/وسم يفشل
                // الفلترة يُسقَط بصمت بدل إفشال الحزمة كلها.
                const headline = String(raw?.headline || '').trim().slice(0, 80);
                const caption = String(raw?.caption || '').trim().slice(0, 300);
                const hashtags = Array.isArray(raw?.hashtags)
                    ? raw.hashtags.map(h => String(h || '').replace(/^#+/, '').trim().slice(0, 30))
                        .filter(h => h && !inspectText(h, { blocklist })).slice(0, 8)
                    : [];
                copy = {
                    headline: headline && !inspectText(headline, { blocklist }) ? headline : '',
                    caption: caption && !inspectText(caption, { blocklist }) ? caption : '',
                    hashtags,
                };
            } catch (e) {
                console.warn(`⚠️ تعذّر توليد النص التسويقي للمشروع ${project.id}: ${e.message}`);
            }
        }

        res.json({ cuts, copy });
    }));

    // ─── بنك الشخصيات (تثبيت هوية البطل) ───────────────────────────────
    // عرض الصور: مفتاح مخزَّن → رابط موقّع طازج عند كل قراءة؛ وإلا رابط
    // المزوّد كما هو — نفس فلسفة publicJob بلا ادعاء ملكية غير قائمة.
    const publicCharacter = async (c) => ({
        id: c.id, at: c.at, name: c.name, description: c.description,
        usageCount: c.usageCount || 0,
        images: await Promise.all((c.images || []).map(async img => ({
            angle: img.angle,
            url: img.storageKey && storage ? await storage.signedUrl(img.storageKey) : img.url,
        }))),
    });

    app.get('/api/video/characters', verifyToken, wrap(async (req, res) => {
        const list = await store.listCharactersByUser(userOf(req), 50);
        res.json({
            characters: await Promise.all(list.map(publicCharacter)),
            enabled: !!imageProvider,
            costCredits: CHARACTER_COST_CREDITS,
            angles: CHARACTER_ANGLES.map(a => ({ key: a.key, labelAr: a.labelAr })),
        });
    }));

    app.post('/api/video/characters', verifyToken, wrap(async (req, res) => {
        if (!imageProvider) {
            return res.status(503).json({ error: 'توليد الصور المرجعية غير مفعَّل حالياً في الخدمة.' });
        }
        const input = validateCharacterInput(req.body || {});
        if (input.error) return res.status(400).json({ error: input.error });
        // الوصف يذهب لمزوّد خارجي — نفس فلترة نصوص الفيديو قبل أي إرسال.
        const flagged = inspectText(input.description, { blocklist }) || inspectText(input.name, { blocklist });
        if (flagged) return res.status(400).json({ error: flagged.error });

        const username = userOf(req);
        // خصم مقدَّم بمعرّف طلب فريد — الفشل بعده يسترد به (معصوم من الازدواج).
        const requestId = `char-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const deducted = await deductCredits(store, {
            username, amount: CHARACTER_COST_CREDITS, jobId: requestId,
        });
        if (!deducted) {
            return res.status(402).json({
                error: `رصيدك لا يكفي — إنشاء شخصية (٣ صور مرجعية) يكلف ${CHARACTER_COST_CREDITS}.`,
            });
        }

        try {
            // ثلاث زوايا بنفس الوصف الحرفي — أساس الثبات عبر اللقطات.
            const images = [];
            for (const angle of CHARACTER_ANGLES) {
                const url = await imageProvider.generateImage(
                    characterImagePrompt(input.description, angle.key)
                );
                images.push({ angle: angle.key, url });
            }
            // نسخ الصور لملكيتنا قبل الحفظ (إن فُعّل التخزين) — روابط
            // المزوّد مؤقتة، وفشل النسخ لا يفشل الشخصية (احتياط شفاف).
            if (storage) {
                for (const img of images) {
                    try {
                        const key = characterImageKeyFor({ username, characterId: requestId, angle: img.angle });
                        await storage.mirrorFromUrl(img.url, key);
                        img.storageKey = key;
                    } catch (e) {
                        console.warn('⚠️ تعذّر نسخ صورة شخصية:', e.message);
                    }
                }
            }
            const character = await store.createCharacter({
                username, name: input.name, description: input.description, images,
            });
            res.json({ character: await publicCharacter(character) });
        } catch (e) {
            // فشل التوليد: استرداد فوري + السبب الكامل (لا رقم صامت).
            await refundCredits(store, {
                username, amount: CHARACTER_COST_CREDITS, jobId: requestId,
                reason: 'فشل توليد صور الشخصية',
            }).catch(() => {});
            res.status(502).json({ error: `تعذّر توليد صور الشخصية: ${e.message} (استُرد الرصيد)` });
        }
    }));

    app.delete('/api/video/characters/:id', verifyToken, wrap(async (req, res) => {
        const character = await store.getCharacter(req.params.id);
        if (!character || character.username !== userOf(req)) {
            return res.status(404).json({ error: 'الشخصية غير موجودة.' });
        }
        // حذف الملفات المملوكة أولاً (أفضل جهد) ثم السجل.
        if (storage) {
            for (const img of character.images || []) {
                if (img.storageKey) await storage.remove(img.storageKey).catch(() => {});
            }
        }
        await store.deleteCharacter(character.id);
        res.json({ success: true });
    }));

    app.post('/api/video/renders', verifyToken, renderLimit, wrap(async (req, res) => {
        const { templateId, values, modelId, projectId, characterId, characterAngle } = req.body || {};
        const template = getTemplate(String(templateId || ''));
        if (!template) return res.status(400).json({ error: 'قالب غير معروف.' });
        // الإخفاء من الواجهة لا يكفي — الطلب المباشر يُرفض أيضاً.
        if (!supported.has(template.specKind || 'timeline')) {
            return res.status(503).json({ error: 'هذا النوع من الفيديو غير مفعَّل حالياً في الخدمة.' });
        }

        // 🎬 الربط بمشروع (اختياري): ملكية المشروع شرط، ورقم اللقطة يُسنَد
        // خادمياً بترتيب الإضافة. نُبكّر هذا الفحص لأن إعدادات المشروع
        // الموروثة (نسبة الأبعاد/الأسلوب) تُطبَّق على القيم قبل التحقق.
        let project = null, shotIndex = null;
        if (projectId) {
            project = await store.getProject(String(projectId));
            if (!project || project.username !== userOf(req)) {
                return res.status(400).json({ error: 'المشروع غير موجود.' });
            }
            shotIndex = await store.countJobsInProject(project.id);
        }

        // توريث إعدادات المشروع: يُطبَّق فقط حين يترك المستخدم الحقل
        // فارغاً — مدخل المستخدم يتفوق دوماً على الافتراضي الموروث.
        const mergedValues = { ...(values && typeof values === 'object' ? values : {}) };
        if (project) {
            const hasField = key => template.fields.some(f => f.key === key);
            if (project.defaultAspectRatio && !mergedValues.aspectRatio && hasField('aspectRatio')) {
                mergedValues.aspectRatio = project.defaultAspectRatio;
            }
            if (project.defaultStyle && !mergedValues.style && hasField('style')) {
                mergedValues.style = project.defaultStyle;
            }
        }

        const validated = validateValues(template, mergedValues);
        if (validated.error) return res.status(400).json({ error: validated.error });

        // 🎞️ اختيار النموذج (قوالب التوليد فقط): النموذج يحدد التكلفة
        // الفعلية ونسب الأبعاد المسموحة — والتحقق خادمي لا واجهة فقط.
        let aiModel = null;
        if (template.specKind === 'ai_prompt') {
            // قالب الصورة المرجعية لا تصلح له إلا نماذج image-to-video،
            // وقالب النص لا تصلح له نماذج الصورة — إرسال خاطئ = 422 مؤكد
            // لدى المزود، فنرفضه هنا برسالة مفهومة بدل هدر محاولة.
            const requiredInput = template.aiInput || 'text';
            const candidates = aiModels.filter(m => (m.input || 'text') === requiredInput);
            aiModel = modelId ? getAiModel(aiModels, modelId) : (candidates[0] || defaultAiModel(aiModels));
            if (!aiModel) return res.status(400).json({ error: 'نموذج توليد غير معروف.' });
            if ((aiModel.input || 'text') !== requiredInput) {
                return res.status(400).json({
                    error: requiredInput === 'image'
                        ? `النموذج ${aiModel.nameAr} نصّي — هذا القالب يحتاج نموذج "من صورة" (image-to-video).`
                        : `النموذج ${aiModel.nameAr} يبدأ من صورة — اختر نموذجاً نصّياً لهذا القالب.`,
                });
            }
            const ratio = validated.values.aspectRatio || '16:9';
            if (aiModel.aspectRatios?.length && !aiModel.aspectRatios.includes(ratio)) {
                return res.status(400).json({
                    error: `النموذج ${aiModel.nameAr} لا يدعم نسبة ${ratio} (المتاح: ${aiModel.aspectRatios.join('، ')}).`,
                });
            }
        }
        const costCredits = aiModel ? aiModel.costCredits : template.costCredits;

        // 🎭 إدراج شخصية من البنك (اختياري): وصفها الحرفي يُحقن في مقدمة
        // البرومت، وصورة الزاوية المطلوبة تصبح الإطار الأول في وضع الصورة.
        // اختيار صريح من الطلب يتفوق دوماً؛ غيابه فقط يقع على الشخصية
        // الافتراضية الموروثة من المشروع (إن وُجدت) — بديل "بنقرة واحدة"
        // عن اختيار الشخصية يدوياً في كل لقطة جديدة بنفس الفيلم.
        let character = null;
        if (characterId && template.specKind === 'ai_prompt') {
            character = await store.getCharacter(String(characterId));
            if (!character || character.username !== userOf(req)) {
                return res.status(400).json({ error: 'الشخصية غير موجودة.' });
            }
        } else if (!characterId && project?.defaultCharacterId && template.specKind === 'ai_prompt') {
            // توريث "أفضل جهد": شخصية افتراضية محذوفة/غير مملوكة لا تُفشل
            // الطلب — تُتجاهَل بصمت (نفس فلسفة توريث نسبة الأبعاد/الأسلوب).
            const c = await store.getCharacter(String(project.defaultCharacterId));
            if (c && c.username === userOf(req)) character = c;
        }

        // فلترة المحتوى بعد التحقق النمطي وقبل أي حجز أو خصم — لا يصل
        // للمزوّد إلا ما اجتاز الفحصين.
        const flagged = inspectValues(template, validated.values, { blocklist });
        if (flagged) return res.status(400).json({ error: flagged.error, field: flagged.field });

        const username = req.user.username;
        if (await countActiveJobsForUser(store, username) >= MAX_ACTIVE_JOBS_PER_USER) {
            return res.status(429).json({
                error: `لديك ${MAX_ACTIVE_JOBS_PER_USER} مهام نشطة بالفعل — انتظر اكتمالها أولاً.`,
            });
        }

        // درع التكلفة: السقف اليومي (العام ولكل مستخدم) يُفحص قبل إنشاء
        // المهمة — لا تُحجز ولا تُخصم أرصدة لطلب سيُرفض. المشرف معفى من
        // سقف الفرد فقط (السقف العام يسري على الجميع).
        const gate = await checkRenderAllowed(store, {
            username, limits, exemptPerUser: isAdminUser(req.user),
        });
        if (!gate.allowed) {
            return res.status(429).json({ error: gate.error, code: gate.code });
        }

        const spec = compileSpec(template, validated.values);
        if (aiModel) {
            // المخطط يحمل نموذجه — فيرسله المزوّد للمسار الصحيح ويعرضه
            // السجل، بلا أي تغيير في مخطط المخزن (spec يُخزَّن أصلاً).
            spec.modelId = aiModel.id;
            spec.modelPath = aiModel.falPath;
        }
        if (character) {
            // الوصف الحرفي في المقدمة — لا يُعاد صياغته أبداً (إعادة
            // الصياغة أول أسباب تغيّر الملامح بين اللقطات).
            spec.prompt = `${character.description}. ${spec.prompt}`;
            spec.characterId = character.id;
            if ((template.aiInput || 'text') === 'image' && !spec.imageUrl) {
                const angleKey = CHARACTER_ANGLES.some(a => a.key === characterAngle)
                    ? characterAngle : 'front';
                const img = (character.images || []).find(i => i.angle === angleKey)
                    || (character.images || [])[0];
                if (img) {
                    // رابط موقّع بساعة كاملة: المهمة قد تنتظر دورها في
                    // الطابور قبل أن يقرأ المزوّد الصورة.
                    spec.imageUrl = img.storageKey && storage
                        ? await storage.signedUrl(img.storageKey, 3600)
                        : img.url;
                }
            }
        }
        // 🧬 بصمة الأسلوب البصري للمشروع (محاكاة LoRA — "التحكم بمحاكاة
        // LORA" في الواجهة): نص وصفي يحقنه صاحب المشروع مرة واحدة (أداة
        // التلوين/الأسلوب)، ثم يُضاف تلقائياً في مقدمة كل برومت بهذا
        // المشروع — قبل وصف الشخصية إن وُجدت (الأعمّ أولاً) — فيحاكي
        // اتساق نموذج مدرَّب (LoRA) بلا أي تدريب فعلي على أي GPU. فُحص
        // محتواه عند الحفظ (validSettings) لا هنا، فهو نظيف مسبقاً.
        if (project && project.styleProfile && template.specKind === 'ai_prompt') {
            spec.prompt = `${project.styleProfile}. ${spec.prompt}`;
        }
        // قالب الصورة المرجعية يحتاج مصدراً للإطار الأول — رابطاً مباشراً
        // أو شخصية من البنك.
        if (template.specKind === 'ai_prompt' && (template.aiInput || 'text') === 'image' && !spec.imageUrl) {
            return res.status(400).json({ error: 'وفّر رابط صورة مرجعية أو اختر شخصية من بنك الشخصيات.' });
        }

        // الخصم قبل المعالجة — مهمة بلا خصمٍ مثبت لا تُعالَج أبداً.
        // نُنشئ المهمة أولاً لنملك jobId يربط الخصم بها في سجل التدقيق،
        // فإن فشل الخصم (رصيد غير كافٍ) نُفشلها فوراً قبل أن يلمسها المحرك.
        const job = await createJob(store, {
            username, templateId: template.id, values: validated.values,
            spec, costCredits,
            projectId: project ? project.id : null, shotIndex,
        });
        const deducted = await deductCredits(store, {
            username, amount: costCredits, jobId: job.id,
        });
        if (!deducted) {
            await transitionJob(store, job.id, 'failed', { error: 'رصيد غير كافٍ.' });
            return res.status(402).json({
                error: `رصيدك الحالي (${await getBalance(store, username)}) لا يكفي — هذا الطلب يكلف ${costCredits}.`,
            });
        }

        // عدّاد استخدام الشخصية — يُنتظر (لا fire-and-forget): بلا await
        // كانت قراءة العداد فور الرد قد تسبق كتابته فعلياً (سباق حقيقي
        // تحت Postgres تحديداً — كشفه فشل عابر في CI لا يظهر أبداً على
        // المخزن الملفي المتزامن). فشل التحديث نفسه لا يزال لا يفشل الطلب.
        if (character) {
            await store.incrementCharacterUsage(character.id)
                .catch(e => console.warn('⚠️ تعذّر تحديث عداد الشخصية:', e.message));
        }

        // إنذار مبكر عند الاقتراب من السقف العام — مرة واحدة يومياً،
        // وفشله لا يمس نجاح الطلب.
        maybeAlertCost(store, { limits, count: gate.globalCount })
            .catch(e => console.warn('⚠️ تعذّر فحص تنبيه التكلفة:', e.message));

        res.json({ job: { id: job.id, status: job.status, costCredits: job.costCredits } });
    }));

    // ما يراه المستخدم: إن كان الملف مملوكاً لنا فالرابط هو مسار التنزيل
    // الخاص بنا (يتحقق من الملكية ويوقّع رابطاً قصير الأجل عند كل نقرة)،
    // وإلا فرابط المزوّد كما هو — بلا ادعاء ملكية غير قائمة.
    const publicJob = j => ({
        id: j.id, at: j.at, templateId: j.templateId, status: j.status,
        videoUrl: j.storageKey ? `/api/video/renders/${j.id}/download` : j.videoUrl,
        owned: !!j.storageKey,
        error: j.error, costCredits: j.costCredits,
        modelId: j.spec?.modelId || null,
        projectId: j.projectId || null,
        shotIndex: j.shotIndex ?? null,
        // قيم المستخدم نفسها تعود له — أساس "تكرار اللقطة" و"إعادة التوليد"
        values: j.values,
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

    /**
     * تنزيل الفيديو المملوك: يتحقق من الملكية أولاً ثم يوقّع رابطاً
     * صالحاً دقائق ويعيد التوجيه إليه. لا رابط دائم يُسرَّب أبداً، وكل
     * نقرة تولّد توقيعاً جديداً.
     */
    app.get('/api/video/renders/:id/download', verifyToken, wrap(async (req, res) => {
        const job = await getJob(store, req.params.id);
        if (!job || job.username !== String(req.user.username || '').trim().toLowerCase()) {
            return res.status(404).json({ error: 'المهمة غير موجودة.' });
        }
        if (!job.storageKey) {
            return res.status(404).json({ error: 'لا ملف مخزَّن لهذه المهمة.' });
        }
        if (!storage) {
            // إعداد تغيّر بعد تخزين الملف — نصارح بدل إعطاء رابط ميت.
            return res.status(503).json({ error: 'تخزين الملفات غير مفعَّل حالياً.' });
        }
        const url = await storage.signedUrl(job.storageKey);
        res.redirect(302, url);
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
        const usedToday = await store.countJobsSince(startOfUtcDay());
        res.json({
            provider: provider.name,
            store: store.name,
            fileStorage: storage ? storage.name : 'provider-hosted',
            activeJobs: active.length,
            queued: active.filter(j => j.status === 'queued').length,
            rendering: active.filter(j => j.status === 'rendering').length,
            // درع التكلفة مرئي للمشرف: كم استُهلك اليوم من السقف
            usage: {
                usedToday,
                dailyCap: limits.dailyRenderCap,
                dailyCapPerUser: limits.dailyRenderCapPerUser,
                remainingToday: Math.max(0, limits.dailyRenderCap - usedToday),
                starterCredits: limits.starterCredits,
            },
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
    const limits = readLimits();
    const store = buildStore({
        databaseUrl: process.env.DATABASE_URL,
        dataDir: process.env.VIDEO_DATA_DIR || path.join(__dirname, '.videostudio'),
        starterCredits: limits.starterCredits,
    });
    const provider = buildProvider(); // موجّه: تركيب + توليد ذكاء اصطناعي
    const storage = buildStorage();            // null ما لم يُضبط VIDEO_STORAGE=r2
    const imageProvider = buildImageProvider(); // null ما لم يكن fal مفعَّلاً
    const ttsProvider = buildTtsProvider();     // null ما لم يُضبط FAL_TTS_MODEL
    const scriptProvider = buildScriptProvider(); // null ما لم يُضبط VIDEO_SCRIPT_API_KEY
    const retention = readRetentionDays();

    await store.init(); // ينشئ الجداول عند أول إقلاع — فشلٌ صاخب إن تعذّر

    const app = createApp({
        store,
        // السر السابق (اختياري) يُقبل أثناء تدوير المفتاح فقط — يُزال بعده.
        jwtSecret: [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS],
        provider,
        storage,
        limits,
        imageProvider,
        ttsProvider,
        scriptProvider,
    });

    const port = Number(process.env.PORT || 4100);
    app.listen(port, () => {
        console.log(`🎬 خدمة الفيديو على المنفذ ${port} (المزود: ${provider.name}، التخزين: ${store.name})`);
        console.log(`🧩 أنواع الفيديو المفعَّلة: ${(provider.supportedKinds || []).join('، ') || 'لا شيء'}`);
        console.log(`🛡️ السقف اليومي: ${limits.dailyRenderCap} إجمالاً، ${limits.dailyRenderCapPerUser} لكل مستخدم، رصيد ترحيبي: ${limits.starterCredits}`);
        if (storage) {
            console.log(`🗃️ ملكية الملفات مفعّلة (${storage.name}) — احتفاظ: ${retention > 0 ? retention + ' يوماً' : 'دائم'}`);
        } else {
            console.warn('⚠️ تخزين الملفات غير مفعَّل — الفيديوهات تبقى على استضافة المزوّد المؤقتة. اضبط VIDEO_STORAGE=r2 لملكيتها.');
        }
        if (store.name === 'file') {
            console.warn('⚠️ تخزين بالملفات — على منصة ذات قرص مؤقت تُمسح الأرصدة مع كل إعادة نشر. اضبط DATABASE_URL للإنتاج.');
        }
        if (process.env.JWT_SECRET_PREVIOUS) {
            console.warn('🔑 وضع تدوير المفتاح فعّال (السر السابق مقبول) — أزل JWT_SECRET_PREVIOUS بعد انقضاء أطول صلاحية توكن.');
        }
    });

    // نفس منطق isAdminUser المبني داخل createApp — يُعاد بناؤه هنا لأن
    // المحرك يعمل خارج نطاقها (لا req متاح وقت التجميع التلقائي).
    const isAdminUser = buildIsAdmin(process.env.ADMIN_USERS || '');

    // الحلقة المجدولة — الحارس داخل runEngineTickGuarded يمنع التداخل.
    setInterval(() => {
        runEngineTickGuarded(store, {
            provider, storage, retentionDays: retention,
            limits, isAdminUser, maxActiveJobsPerUser: MAX_ACTIVE_JOBS_PER_USER,
        });
    }, ENGINE_POLL_MS);
}
