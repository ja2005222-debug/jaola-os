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
import { readBlocklist, inspectValues, inspectText } from './src/contentFilter.js';
import { readAiModels, getAiModel, defaultAiModel, publicAiModels } from './src/models.js';
import { CINEMA_CONTROLS } from './src/cinema.js';
import {
    ASSEMBLY_COST_CREDITS, TRANSITIONS, COLOR_FILTERS, OUTPUT_ASPECTS,
    readMusicLibrary, buildFilmSpec,
} from './src/assembly.js';
import { buildImageProvider } from './src/providers/falImageProvider.js';
import { characterImageKeyFor } from './src/storage/index.js';
import {
    CHARACTER_COST_CREDITS, CHARACTER_ANGLES,
    characterImagePrompt, validateCharacterInput,
} from './src/characters.js';
import { refundCredits } from './src/credits.js';

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
    storage = null,
    limits = readLimits(),
    blocklist = readBlocklist(),
    aiModels = readAiModels(),
    imageProvider = null,
    musicLibrary = readMusicLibrary(),
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

    app.get('/api/video/projects', verifyToken, wrap(async (req, res) => {
        res.json({ projects: await store.listProjectsByUser(userOf(req), 50) });
    }));

    app.post('/api/video/projects', verifyToken, wrap(async (req, res) => {
        const title = validTitle(req.body?.title);
        if (!title) return res.status(400).json({ error: 'عنوان المشروع مطلوب (حتى 80 حرفاً).' });
        res.json({ project: await store.createProject({ username: userOf(req), title }) });
    }));

    app.get('/api/video/projects/:id', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const shots = await store.listJobsByProject(project.id);
        res.json({ project, shots: shots.map(publicJob) });
    }));

    app.patch('/api/video/projects/:id', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        const title = validTitle(req.body?.title);
        if (!title) return res.status(400).json({ error: 'عنوان المشروع مطلوب (حتى 80 حرفاً).' });
        res.json({ project: await store.renameProject(project.id, title) });
    }));

    // حذف التجميع فقط — اللقطات تبقى في السجل العام (أُنفق عليها رصيد).
    app.delete('/api/video/projects/:id', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        await store.deleteProject(project.id);
        res.json({ success: true });
    }));

    // ─── تجميع الفيلم: لقطات المشروع الجاهزة → فيلم واحد ────────────────

    const readyShotsOf = async (projectId) => {
        const shots = await store.listJobsByProject(projectId);
        return shots.filter(s => s.status === 'done' && (s.videoUrl || s.storageKey));
    };

    app.get('/api/video/projects/:id/assembly-options', verifyToken, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });
        res.json({
            transitions: Object.keys(TRANSITIONS),
            filters: Object.keys(COLOR_FILTERS),
            aspects: OUTPUT_ASPECTS,
            music: musicLibrary.map(({ id, nameAr }) => ({ id, nameAr })),
            costCredits: ASSEMBLY_COST_CREDITS,
            readyShots: (await readyShotsOf(project.id)).length,
        });
    }));

    app.post('/api/video/projects/:id/assemble', verifyToken, renderLimit, wrap(async (req, res) => {
        const project = await ownedProject(req);
        if (!project) return res.status(404).json({ error: 'المشروع غير موجود.' });

        const { transition, musicId, endTitle, filter, aspect } = req.body || {};
        if (transition != null && !(transition in TRANSITIONS)) {
            return res.status(400).json({ error: `انتقال غير معروف (المتاح: ${Object.keys(TRANSITIONS).join('، ')}).` });
        }
        if (filter != null && !(filter in COLOR_FILTERS)) {
            return res.status(400).json({ error: `فلتر لوني غير معروف (المتاح: ${Object.keys(COLOR_FILTERS).join('، ')}).` });
        }
        if (aspect != null && !OUTPUT_ASPECTS.includes(aspect)) {
            return res.status(400).json({ error: `مقاس غير معروف (المتاح: ${OUTPUT_ASPECTS.join('، ')}).` });
        }
        let musicUrl = null;
        if (musicId) {
            const track = musicLibrary.find(m => m.id === String(musicId));
            if (!track) return res.status(400).json({ error: 'مقطع موسيقي غير معروف.' });
            musicUrl = track.url;
        }
        const title = String(endTitle || '').trim().slice(0, 60);
        if (title) {
            const flagged = inspectText(title, { blocklist });
            if (flagged) return res.status(400).json({ error: flagged.error });
        }

        const ready = await readyShotsOf(project.id);
        if (ready.length === 0) {
            return res.status(400).json({ error: 'لا لقطات مكتملة في المشروع بعد — ولّد لقطة واحدة على الأقل.' });
        }

        const username = userOf(req);
        if (await countActiveJobsForUser(store, username) >= MAX_ACTIVE_JOBS_PER_USER) {
            return res.status(429).json({ error: `لديك ${MAX_ACTIVE_JOBS_PER_USER} مهام نشطة بالفعل — انتظر اكتمالها أولاً.` });
        }
        // درع التكلفة يشمل التجميع أيضاً — كل مهمة تُحسب.
        const gate = await checkRenderAllowed(store, {
            username, limits, exemptPerUser: isAdminUser(req.user),
        });
        if (!gate.allowed) return res.status(429).json({ error: gate.error, code: gate.code });

        // روابط اللقطات للمُركِّب: المملوكة تُوقَّع بساعة (قد تنتظر الطابور)
        const shots = await Promise.all(ready.map(async s => ({
            durationSec: s.spec?.durationSec,
            videoUrl: s.storageKey && storage ? await storage.signedUrl(s.storageKey, 3600) : s.videoUrl,
        })));
        const spec = buildFilmSpec({
            shots,
            transition: transition ? TRANSITIONS[transition] : null,
            musicUrl,
            endTitle: title,
            filter: filter ? COLOR_FILTERS[filter] : null,
            aspectRatio: aspect || '16:9',
        });

        const job = await createJob(store, {
            username, templateId: 'film_assembly',
            values: {
                transition: transition || '', musicId: musicId || '', endTitle: title,
                filter: filter || '', aspect: aspect || '16:9',
            },
            spec, costCredits: ASSEMBLY_COST_CREDITS,
            projectId: project.id, shotIndex: null,
        });
        const deducted = await deductCredits(store, {
            username, amount: ASSEMBLY_COST_CREDITS, jobId: job.id,
        });
        if (!deducted) {
            await transitionJob(store, job.id, 'failed', { error: 'رصيد غير كافٍ.' });
            return res.status(402).json({
                error: `رصيدك الحالي (${await getBalance(store, username)}) لا يكفي — التجميع يكلف ${ASSEMBLY_COST_CREDITS}.`,
            });
        }
        res.json({ job: { id: job.id, status: job.status, costCredits: job.costCredits } });
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

        const validated = validateValues(template, values);
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
        let character = null;
        if (characterId && template.specKind === 'ai_prompt') {
            character = await store.getCharacter(String(characterId));
            if (!character || character.username !== userOf(req)) {
                return res.status(400).json({ error: 'الشخصية غير موجودة.' });
            }
        }

        // 🎬 الربط بمشروع (اختياري): ملكية المشروع شرط، ورقم اللقطة يُسنَد
        // خادمياً بترتيب الإضافة.
        let project = null, shotIndex = null;
        if (projectId) {
            project = await store.getProject(String(projectId));
            if (!project || project.username !== userOf(req)) {
                return res.status(400).json({ error: 'المشروع غير موجود.' });
            }
            shotIndex = await store.countJobsInProject(project.id);
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

        // عدّاد استخدام الشخصية — فشله لا يمس نجاح الطلب.
        if (character) {
            store.incrementCharacterUsage(character.id)
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

    // الحلقة المجدولة — الحارس داخل runEngineTickGuarded يمنع التداخل.
    setInterval(() => {
        runEngineTickGuarded(store, { provider, storage, retentionDays: retention });
    }, ENGINE_POLL_MS);
}
