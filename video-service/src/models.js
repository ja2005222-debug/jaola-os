/**
 * 🎞️ models.js — كتالوج نماذج التوليد بالذكاء الاصطناعي (متعدد النماذج)
 *
 * جوهر "الاستوديو المنافس": صانع الأفلام يختار النموذج لكل لقطة حسب
 * حاجتها (سرعة/جودة/تكلفة) بدل نموذج واحد مثبَّت في البيئة. الكتالوج:
 *
 *   مدمج   → نماذج تحققنا من مساراتها فعلياً في الإنتاج.
 *   موسَّع → FAL_MODELS_JSON يضيف نماذج جديدة **بلا نشر كود**: مصفوفة
 *            [{id, nameAr, falPath, costCredits, aspectRatios, descriptionAr}]
 *   قديم   → FAL_MODEL (إن ضُبط) يبقى محترماً: يصبح النموذج الافتراضي،
 *            ويُضاف كخيار إن لم يكن في الكتالوج أصلاً.
 *
 * التكلفة بالأرصدة لكل نموذج — فالنموذج الأجود أغلى، والتسعير قرار
 * تجاري يعيش هنا لا في القوالب.
 */

const FAL_PATH_RE = /^[\w.-]+\/[\w.-]+(\/[\w.-]+)*$/;
const RATIO_RE = /^\d+:\d+$/;

// input: 'text' = يولّد من وصف نصي فقط، 'image' = يبدأ من صورة مرجعية
// (image-to-video) — أساس "الشخصية الثابتة": نفس الصورة المرجعية إطاراً
// أولَ لعدة لقطات تبقي البطل واحداً عبر المشاهد.
export const BUILTIN_AI_MODELS = Object.freeze([
    // 📌 الأسماء المعروضة مستويات جودة لا أسماء مزودين — قرار منتج:
    // المستخدم يشتري "قياسي/سينمائي" لا "نموذج X" الذي قد نبدله غداً.
    {
        id: 'veo3_fast',
        nameAr: 'قياسي ⚡',
        descriptionAr: 'توازن ممتاز بين الجودة والسرعة والتكلفة — الخيار الافتراضي لمعظم اللقطات.',
        falPath: 'fal-ai/veo3/fast',
        costCredits: 5,
        aspectRatios: ['16:9', '9:16'],
        input: 'text',
    },
    {
        id: 'veo3',
        nameAr: 'سينمائي 👑',
        descriptionAr: 'أعلى واقعية وتفاصيل مع صوت مدمج — للقطات البطولية والنسخ النهائية.',
        falPath: 'fal-ai/veo3',
        costCredits: 10,
        aspectRatios: ['16:9', '9:16'],
        input: 'text',
    },
    {
        id: 'veo3_fast_i2v',
        nameAr: 'قياسي ⚡ — من صورة',
        descriptionAr: 'يحرّك صورتك المرجعية كإطار أول بجودة عالية — ثبات الشخصية عبر اللقطات.',
        falPath: 'fal-ai/veo3/fast/image-to-video',
        costCredits: 5,
        aspectRatios: ['16:9', '9:16'],
        input: 'image',
    },
    {
        id: 'wan_i2v',
        nameAr: 'اقتصادي 💡 — من صورة',
        descriptionAr: 'الأرخص لتحريك صورة مرجعية — للمسودات والتجارب. الحركات الدقيقة تحتاج المستوى الأعلى.',
        falPath: 'fal-ai/wan-i2v',
        costCredits: 2,
        aspectRatios: ['16:9', '9:16'],
        input: 'image',
    },
]);

/** الشكل العلني للكتالوج — بلا مسارات المزود (قرار منتج: مستويات لا أسماء). */
export function publicAiModels(models) {
    return models.map(({ id, nameAr, descriptionAr, costCredits, aspectRatios, input }) => ({
        id, nameAr, descriptionAr, costCredits, aspectRatios, input,
    }));
}

/** يتحقق من مدخل نموذج واحد — فشل صاخب عند الإقلاع خير من 422 غامض لاحقاً. */
function validateModel(m, source) {
    if (!m || typeof m !== 'object') throw new Error(`${source}: مدخل نموذج ليس كائناً.`);
    if (!m.id || typeof m.id !== 'string') throw new Error(`${source}: id مطلوب.`);
    if (!m.nameAr || typeof m.nameAr !== 'string') throw new Error(`${source}: nameAr مطلوب (${m.id}).`);
    if (!FAL_PATH_RE.test(String(m.falPath || ''))) {
        throw new Error(`${source}: falPath غير صالح للنموذج ${m.id} (مثال: fal-ai/veo3/fast).`);
    }
    if (!Number.isInteger(m.costCredits) || m.costCredits < 1) {
        throw new Error(`${source}: costCredits يجب أن يكون عدداً صحيحاً موجباً (${m.id}).`);
    }
    const ratios = m.aspectRatios ?? ['16:9'];
    if (!Array.isArray(ratios) || ratios.length === 0 || !ratios.every(r => RATIO_RE.test(String(r)))) {
        throw new Error(`${source}: aspectRatios يجب أن تكون نسباً مثل "16:9" (${m.id}).`);
    }
    const input = m.input ?? 'text';
    if (!['text', 'image'].includes(input)) {
        throw new Error(`${source}: input يجب أن يكون text أو image (${m.id}).`);
    }
    return {
        id: m.id, nameAr: m.nameAr,
        descriptionAr: m.descriptionAr || '',
        falPath: String(m.falPath).replace(/^\/+|\/+$/g, ''),
        costCredits: m.costCredits,
        aspectRatios: ratios.map(String),
        input,
    };
}

/** يقرأ الكتالوج الكامل من البيئة (مدمج + موسَّع + القديم). */
export function readAiModels(env = process.env) {
    const models = BUILTIN_AI_MODELS.map(m => ({ ...m, aspectRatios: [...m.aspectRatios] }));

    if (env.FAL_MODELS_JSON) {
        let extra;
        try { extra = JSON.parse(env.FAL_MODELS_JSON); }
        catch { throw new Error('FAL_MODELS_JSON ليس JSON صالحاً.'); }
        if (!Array.isArray(extra)) throw new Error('FAL_MODELS_JSON يجب أن يكون مصفوفة نماذج.');
        for (const raw of extra) {
            const m = validateModel(raw, 'FAL_MODELS_JSON');
            // نفس المعرّف يعني استبدالاً مقصوداً (تعديل تكلفة/اسم نموذج مدمج)
            const at = models.findIndex(x => x.id === m.id);
            if (at >= 0) models[at] = m; else models.push(m);
        }
    }

    // FAL_MODEL القديم: نموذج مضبوط يدوياً خارج الكتالوج يُضاف كخيار —
    // لا نكسر إعداداً قائماً يعمل.
    if (env.FAL_MODEL) {
        const path = String(env.FAL_MODEL).replace(/^\/+|\/+$/g, '');
        if (!models.some(m => m.falPath === path)) {
            models.push(validateModel({
                id: 'env_model', nameAr: `نموذج البيئة (${path})`,
                falPath: path, costCredits: 5,
            }, 'FAL_MODEL'));
        }
    }

    return models;
}

export function getAiModel(models, id) {
    return models.find(m => m.id === String(id || '')) || null;
}

/** الافتراضي: ما يشير إليه FAL_MODEL إن وُجد في الكتالوج، وإلا الأول. */
export function defaultAiModel(models, env = process.env) {
    if (env.FAL_MODEL) {
        const path = String(env.FAL_MODEL).replace(/^\/+|\/+$/g, '');
        const m = models.find(x => x.falPath === path);
        if (m) return m;
    }
    return models[0] || null;
}
