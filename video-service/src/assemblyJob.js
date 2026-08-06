/**
 * 🎛️ assemblyJob.js — نواة مشتركة لإنشاء مهمة تجميع فيلم
 *
 * يستخدمها مساران: التجميع اليدوي (مسار /assemble) والتجميع التلقائي
 * ("أكمل تلقائياً" — AI Producer، انظر autoAssemble في server.js ودورة
 * engine.js) — نفس البوابات (لقطات جاهزة/سقف مهام نشطة/درع التكلفة)
 * بلا أي مسار مختصر يتجاوزها لأحدهما.
 *
 * narrationUrl وlogoUrl خارج نطاق resolveAssemblyOptions عمداً: التجميع
 * التلقائي (بلا مراجعة بشرية لحظة التشغيل الفعلي) يبقى بالخيارات
 * المرئية/الصوتية الأساسية فقط — التعليق الصوتي المولَّد ولوجو مخصص ما
 * زالا يدويين حصراً عبر /assemble، فيُمرَّران إلى runAssembly مباشرة
 * هناك بلا مرور بهذه الدالة.
 */
import { createJob, transitionJob, countActiveJobsForUser } from './jobs.js';
import { deductCredits, getBalance } from './credits.js';
import { checkRenderAllowed } from './limits.js';
import { inspectText } from './contentFilter.js';
import {
    ASSEMBLY_COST_CREDITS, TRANSITIONS, COLOR_FILTERS, CAPTION_STYLES, CAPTION_POSITIONS,
    OUTPUT_ASPECTS, OUTPUT_RESOLUTIONS, DEFAULT_RESOLUTION, buildFilmSpec,
} from './assembly.js';

/** لقطات المشروع الجاهزة للتجميع (اكتملت وتحمل رابط فيديو فعلياً). */
export async function readyShotsOf(store, projectId) {
    const shots = await store.listJobsByProject(projectId);
    return shots.filter(s => s.status === 'done' && (s.videoUrl || s.storageKey));
}

/**
 * يحوّل جسم طلب خام (معرّفات/تسميات عربية كما تصل من الواجهة) إلى قيم
 * جاهزة لـbuildFilmSpec — يُستخدم عند التشغيل اليدوي وعند "تسليح"
 * التجميع التلقائي (يُحفظ الناتج كما هو ليُستهلك لاحقاً بلا إعادة تحقق).
 * يُرجع {error} أو {values, raw}.
 */
export function resolveAssemblyOptions({ body, project, musicLibrary, sfxLibrary, blocklist }) {
    const { transition, musicId, endTitle, aspect, sfxId, resolution, burnCaptions, captionStyle, captionPosition, captionAnimated } = body || {};
    // فلتر لوني: طلب صريح (حتى '' = بلا فلتر) يتفوق دوماً؛ غيابه فقط
    // (undefined) يقع على فلتر المشروع الافتراضي (أداة التلوين السينمائي).
    const filter = body?.filter !== undefined ? body.filter : (project.defaultFilter || null);

    if (transition != null && !(transition in TRANSITIONS)) {
        return { error: `انتقال غير معروف (المتاح: ${Object.keys(TRANSITIONS).join('، ')}).` };
    }
    if (filter != null && !(filter in COLOR_FILTERS)) {
        return { error: `فلتر لوني غير معروف (المتاح: ${Object.keys(COLOR_FILTERS).join('، ')}).` };
    }
    if (captionStyle != null && !(captionStyle in CAPTION_STYLES)) {
        return { error: `نمط كابشن غير معروف (المتاح: ${Object.keys(CAPTION_STYLES).join('، ')}).` };
    }
    if (captionPosition != null && !(captionPosition in CAPTION_POSITIONS)) {
        return { error: `موضع كابشن غير معروف (المتاح: ${Object.keys(CAPTION_POSITIONS).join('، ')}).` };
    }
    if (aspect != null && !OUTPUT_ASPECTS.includes(aspect)) {
        return { error: `مقاس غير معروف (المتاح: ${OUTPUT_ASPECTS.join('، ')}).` };
    }
    if (resolution != null && !OUTPUT_RESOLUTIONS.includes(resolution)) {
        return { error: `دقة غير معروفة (المتاح: ${OUTPUT_RESOLUTIONS.join('، ')}).` };
    }
    let musicUrl = null;
    if (musicId) {
        const track = musicLibrary.find(m => m.id === String(musicId));
        if (!track) return { error: 'مقطع موسيقي غير معروف.' };
        musicUrl = track.url;
    }
    let sfxUrl = null;
    if (sfxId) {
        const sfx = sfxLibrary.find(m => m.id === String(sfxId));
        if (!sfx) return { error: 'مؤثر صوتي غير معروف.' };
        sfxUrl = sfx.url;
    }
    const title = String(endTitle || '').trim().slice(0, 60);
    if (title) {
        const flagged = inspectText(title, { blocklist });
        if (flagged) return { error: flagged.error };
    }

    return {
        values: {
            transition: transition ? TRANSITIONS[transition] : null,
            musicUrl,
            endTitle: title,
            filter: filter ? COLOR_FILTERS[filter] : null,
            aspectRatio: aspect || '16:9',
            sfxUrl,
            resolution: resolution || DEFAULT_RESOLUTION,
            burnCaptions: !!burnCaptions,
            captionStyle: captionStyle ? CAPTION_STYLES[captionStyle] : null,
            captionPosition: captionPosition ? CAPTION_POSITIONS[captionPosition] : null,
            captionAnimated: !!captionAnimated,
        },
        raw: {
            transition: transition || '', musicId: musicId || '', endTitle: title,
            filter: filter || '', aspect: aspect || '16:9', sfxId: sfxId || '',
            resolution: resolution || DEFAULT_RESOLUTION, burnCaptions: !!burnCaptions,
            captionStyle: captionStyle || '', captionPosition: captionPosition || '',
            captionAnimated: !!captionAnimated,
        },
    };
}

/**
 * بوابات القبول فقط (لقطات جاهزة/سقف مهام نشطة/درع التكلفة) — بلا أي
 * أثر جانبي (لا خصم، لا إنشاء مهمة). مفصولة عن finalizeAssembly كي
 * يفحصها المسار اليدوي **قبل** توليد تعليق صوتي مدفوع (نداء مزوّد خارجي
 * حقيقي) — فشل بوابة لا يجب أن يهدر رصيد/نداء توليد صوت كان سيُرفض على
 * أي حال. يُرجع {ready} عند القبول، أو {status, error} عند الرفض.
 */
export async function checkAssemblyGates(store, { project, username, maxActiveJobsPerUser, limits, exemptPerUser = false }) {
    const ready = await readyShotsOf(store, project.id);
    if (ready.length === 0) {
        return { status: 400, error: 'لا لقطات مكتملة في المشروع بعد — ولّد لقطة واحدة على الأقل.' };
    }
    if (await countActiveJobsForUser(store, username) >= maxActiveJobsPerUser) {
        return { status: 429, error: `لديك ${maxActiveJobsPerUser} مهام نشطة بالفعل — انتظر اكتمالها أولاً.` };
    }
    const gate = await checkRenderAllowed(store, { username, limits, exemptPerUser });
    if (!gate.allowed) return { status: 429, error: gate.error, code: gate.code };
    return { ready };
}

/**
 * إنشاء مهمة التجميع فعلياً وخصم رصيدها — يفترض أن checkAssemblyGates
 * قد قَبِل الطلب بالفعل (ready جاهزة). يُرجع {job} عند النجاح، أو
 * {status, error} عند فشل الخصم فقط (رصيد غير كافٍ).
 */
export async function finalizeAssembly(store, {
    project, username, storage, ready, resolved, rawValues,
    watermarkText = null, narrationUrl = null, logoUrl = null, costCredits = ASSEMBLY_COST_CREDITS,
}) {
    const shots = await Promise.all(ready.map(async s => ({
        durationSec: s.spec?.durationSec,
        videoUrl: s.storageKey && storage ? await storage.signedUrl(s.storageKey, 3600) : s.videoUrl,
        caption: typeof s.values?.caption === 'string' ? s.values.caption : null,
    })));
    const spec = buildFilmSpec({ shots, ...resolved, logoUrl, narrationUrl, watermarkText });

    const job = await createJob(store, {
        username, templateId: 'film_assembly',
        values: {
            ...rawValues, watermarked: !!watermarkText,
            logoUrl: logoUrl || '', narrationText: rawValues?.narrationText || '',
        },
        spec, costCredits,
        projectId: project.id, shotIndex: null,
    });
    const deducted = await deductCredits(store, { username, amount: costCredits, jobId: job.id });
    if (!deducted) {
        await transitionJob(store, job.id, 'failed', { error: 'رصيد غير كافٍ.' });
        return {
            status: 402,
            error: `رصيدك الحالي (${await getBalance(store, username)}) لا يكفي — التجميع يكلف ${costCredits}.`,
        };
    }
    return { job };
}

/**
 * تركيبة مباشرة (بوابات ثم إنشاء) للسياقات التي لا تحتاج خطوة وسيطة
 * مدفوعة بين الاثنين (التجميع التلقائي — لا تعليق صوتي ولا لوجو فيه).
 * المسار اليدوي (/assemble) يستدعي الدالتين منفصلتين بدلاً من هذه —
 * انظر الشرح أعلى checkAssemblyGates.
 */
export async function runAssembly(store, {
    project, username, storage, resolved, rawValues, limits, exemptPerUser = false,
    maxActiveJobsPerUser, watermarkText = null, narrationUrl = null, logoUrl = null,
    costCredits = ASSEMBLY_COST_CREDITS,
}) {
    const gated = await checkAssemblyGates(store, { project, username, maxActiveJobsPerUser, limits, exemptPerUser });
    if (gated.error) return gated;
    return finalizeAssembly(store, {
        project, username, storage, ready: gated.ready, resolved, rawValues,
        watermarkText, narrationUrl, logoUrl, costCredits,
    });
}
