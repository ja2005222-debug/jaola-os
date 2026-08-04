/**
 * 🔌 providers/index.js — اختيار المزودين وتوجيه المخططات (نقطة التبديل)
 *
 * صارت الخدمة تنتج نوعين مختلفين جذرياً:
 *   timeline  → تركيب قوالب لدى مزوّد تركيب (Shotstack…)
 *   ai_prompt → توليد من وصف نصي لدى مجمّع نماذج (fal.ai…)
 *
 * لكل نوع مزوّده، فيتولى **الموجّه** أدناه إرسال كل مخطط لمزوّده الصحيح.
 * المحرّك لا يعرف بهذا شيئاً — يرى واجهة مزوّد واحدة كما كان تماماً.
 *
 * معرّف المهمة لدى المزوّد يُبَدأ باسم الخلفية (`shotstack::abc`) حتى
 * يعرف الاستطلاع لاحقاً أي خلفية يسأل — بلا تغيير في المخزن.
 */
import { createMockProvider } from './mockProvider.js';
import { createShotstackProvider } from './shotstackProvider.js';
import { createFalProvider } from './falProvider.js';
import { readAiModels, defaultAiModel } from '../models.js';

const SEP = '::';

/** يبني مزوّد التركيب (القوالب). */
export function buildCompositionProvider(env = process.env) {
    const name = String(env.VIDEO_PROVIDER || 'mock').toLowerCase();
    if (name === 'mock') return createMockProvider();
    if (name === 'shotstack') {
        // فشل صاخب عند الإقلاع — "مزود حقيقي بلا مفتاح" خطأ إعداد يجب أن
        // يوقف الخدمة فوراً، لا أن يتحول لفشل صامت في كل مهمة.
        return createShotstackProvider({
            apiKey: env.SHOTSTACK_API_KEY,
            env: env.SHOTSTACK_ENV || 'stage',
        });
    }
    throw new Error(`مزود تركيب غير معروف: ${env.VIDEO_PROVIDER}`);
}

/** يبني مزوّد التوليد بالذكاء الاصطناعي (اختياري — null يعطّل القالب). */
export function buildAiProvider(env = process.env) {
    const name = String(env.VIDEO_AI_PROVIDER || '').toLowerCase();
    if (!name || name === 'none') return null; // معطَّل: قالب الذكاء الاصطناعي يُخفى
    if (name === 'mock') return createMockProvider();
    if (name === 'fal') {
        // النموذج الافتراضي من الكتالوج (FAL_MODEL يبقى محترماً إن ضُبط) —
        // كل مهمة تحمل نموذجها في مخططها، والافتراضي احتياط للقديمة فقط.
        const fallback = defaultAiModel(readAiModels(env), env);
        return createFalProvider({ apiKey: env.FAL_KEY, model: fallback?.falPath });
    }
    throw new Error(`مزود توليد غير معروف: ${env.VIDEO_AI_PROVIDER}`);
}

/**
 * يبني الموجّه الذي يراه المحرّك. يقبل المزودين حقناً (للاختبارات) أو
 * يبنيهما من البيئة.
 */
export function buildProvider(env = process.env, injected = {}) {
    const composition = injected.composition ?? buildCompositionProvider(env);
    const ai = injected.ai !== undefined ? injected.ai : buildAiProvider(env);

    const backends = { timeline: composition, ai_prompt: ai };

    return {
        name: ai ? `${composition.name}+${ai.name}` : composition.name,
        /** أنواع المخططات المدعومة فعلياً الآن — الواجهة تُخفي ما لا يُدعم. */
        supportedKinds: Object.entries(backends).filter(([, p]) => p).map(([k]) => k),

        async submitRender(spec) {
            const kind = spec?.kind || 'timeline';
            const backend = backends[kind];
            if (!backend) {
                throw new Error(`لا مزوّد مفعَّل لهذا النوع من الفيديو (${kind}).`);
            }
            const { providerId } = await backend.submitRender(spec);
            return { providerId: `${kind}${SEP}${providerId}` };
        },

        async getRender(prefixedId) {
            const idx = String(prefixedId).indexOf(SEP);
            // مهام أُنشئت قبل إضافة التوجيه لا تحمل بادئة — تُعامَل كـtimeline
            const kind = idx > 0 ? prefixedId.slice(0, idx) : 'timeline';
            const rawId = idx > 0 ? prefixedId.slice(idx + SEP.length) : prefixedId;
            const backend = backends[kind];
            if (!backend) {
                return { status: 'failed', error: `المزوّد الذي عالج هذه المهمة (${kind}) لم يعد مفعَّلاً.` };
            }
            return backend.getRender(rawId);
        },
    };
}
