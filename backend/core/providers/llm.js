import Groq from 'groq-sdk';
import { AsyncLocalStorage } from 'node:async_hooks';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// 🔴 dotenv@17 يطبع لافتةً ترويجية على **المخرَج القياسيّ** عند كل تحميل.
// وهي القناةُ نفسها التي يُرسل عليها مُشغّلُ اختبارات Node نتائجَ كل ملفٍ
// مُسلسَلة (وهو ما أفسده بيانُ PluginOrchestrator في #486). فتُسكَت —
// بالخيار الذي تقترحه المكتبةُ نفسها في نصّ لافتتها.
dotenv.config({ quiet: true });

// ═══════════════════════════════════════════════════════
// 🔌 العملاء الفعليون
// ═══════════════════════════════════════════════════════
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    // مفتاح بديل وهمي يمنع انهيار الإقلاع إذا لم يُضبط — الاستدعاء سيفشل بوضوح بدلاً من ذلك
    apiKey: process.env.DEEPSEEK_API_KEY || 'ds-key-not-configured',
});
const hasDeepseek = !!process.env.DEEPSEEK_API_KEY;

// موديل DeepSeek — الجيل الحالي V4 (رسالتهم الرسمية: المدعوم deepseek-v4-pro
// أو deepseek-v4-flash؛ الأسماء الأقدم deepseek-chat/coder أُلغيت نهائياً).
// الافتراضي pro (جودة الكود أولاً — هو العمود الثاني بعد Groq)، وflash عبر البيئة.
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

// 🏷️ أسماءُ الموديلات — من البيئة أوّلاً. قِيس في 2026-09-07 أنّ اسماً واحداً ميّتاً
// (`llama-3.3-70b-versatile` → 404 عند Groq) كان مكتوباً في **تسعة مواضع**، وثانياً
// (`gemini-2.0-flash`) في موضعَين — فتقاعُدُ موديلٍ عند مزوّده كان يُسقط السلسلةَ كلَّها
// ولا يُصلَح إلّا بنشرِ كود. صارت تُضبط من Render في سطر.
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * 🎚️ `AI_PROVIDERS` — أيُّ حلقاتِ السلسلة تُجرَّب. قائمةٌ بفواصل، والافتراضُ (غيابُ المفتاح) كلُّها.
 *
 * غرضُه تشغيليّ: حصرُ التجارب في مزوّدٍ أو اثنين **دون حذف مفتاحٍ من البيئة** — فالحذفُ يُتلف إعداداً
 * ويحتاج استرجاعاً، والحصرُ يُرفع بسطرٍ واحد. يصل السلسلةَ **ومسارَ المولّد المباشر** معاً: `coderAgent`
 * ينادي `deepseek` و`ai` خارج `createWithFailover`، فحارسٌ في السلسلة وحدَها كان سيترك المستبعَد يعمل.
 *
 * والاسمُ المجهول لا يُصحَّح صامتاً: يُرصد ويُعلَن عند الإقلاع، والمعروفُ يُحترم كما كُتب. وإن لم يبقَ
 * معروفٌ فلا مزوّد — «لا يوجد مزود AI مُهيأ» رسالةٌ تدلّ على الإعداد، والعودةُ الصامتة إلى «الكلّ» تُخفيه.
 */
export const PROVIDER_NAMES = Object.freeze(['groq', 'deepseek', 'gemini', 'openai']);

export function resolveEnabledProviders(raw) {
    const asked = String(raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!asked.length) return { enabled: new Set(PROVIDER_NAMES), asked: [], unknown: [] };
    return {
        enabled: new Set(asked.filter((n) => PROVIDER_NAMES.includes(n))),
        asked,
        unknown: asked.filter((n) => !PROVIDER_NAMES.includes(n)),
    };
}

const SELECTION = resolveEnabledProviders(process.env.AI_PROVIDERS);
const enabled = (name) => SELECTION.enabled.has(name);
/** يقرؤه `coderAgent` لأنّه ينادي العملاءَ مباشرةً خارج السلسلة. */
export const isProviderEnabled = (name) => enabled(name);

const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

if (groqClient && enabled('groq')) console.log('⚡ [AI Core]: Groq نشط كخيار أول فائق السرعة.');
if (hasDeepseek && enabled('deepseek')) console.log('🐋 [AI Core]: DeepSeek نشط كخط ثانٍ تلقائي (failover).');
if (openaiClient && enabled('openai')) console.log('🧠 [AI Core]: OpenAI نشط كخط ثالث أخير.');
if (ai && enabled('gemini')) console.log('♊ [AI Core]: محرك Gemini نشط كخطة بديلة لحالات الضغط.');
// 🔇 مفتاحٌ موجودٌ ومزوّدٌ مستبعَد: يُقال صراحةً كي لا يُظنّ الغيابُ عطباً — والمجهولُ يُسمّى ليُصحَّح.
for (const [name, present] of [['groq', !!groqClient], ['deepseek', hasDeepseek], ['gemini', !!ai], ['openai', !!openaiClient]]) {
    if (present && !enabled(name)) console.log(`🔇 [AI Core]: ${name} مُستبعَد بـAI_PROVIDERS (مفتاحُه موجود، لم يُحذف).`);
}
// يُعلَن اسمُ **المزوّد العامل وحدَه**: مزوّدٌ بلا مفتاحٍ أو مستبعَدٌ لا يُعلَن اسمُ موديله — سطرٌ
// عن مزوّدٍ لا يُنادى ضجيجٌ لا خبر. وهذا الشرطُ هو أيضاً ما يُبقي قناةَ المخرَج القياسيّ نظيفة:
// أوّلُ صياغةٍ طبعت الأربعةَ بلا شرط، فأفسدت مخرَجَ مُشغّل الاختبارات — عطبُ #486 بعينه.
for (const line of modelReportLines(
    { groq: process.env.GROQ_MODEL, deepseek: process.env.DEEPSEEK_MODEL, gemini: process.env.GEMINI_MODEL, openai: process.env.OPENAI_MODEL },
    { groq: GROQ_MODEL, deepseek: DEEPSEEK_MODEL, gemini: GEMINI_MODEL, openai: OPENAI_MODEL },
    [['groq', !!groqClient], ['deepseek', hasDeepseek], ['gemini', !!ai], ['openai', !!openaiClient]]
        .filter(([n, present]) => present && enabled(n)).map(([n]) => n),
)) console.log(line);
if (SELECTION.unknown.length) console.warn(`⚠️ [AI Core]: أسماءٌ لا تُعرف في AI_PROVIDERS: ${SELECTION.unknown.join('، ')} — المعروفُ منها وحدَه يُحترم (${PROVIDER_NAMES.join('، ')}).`);

// ═══════════════════════════════════════════════════════
// 🔄 Failover تلقائي: Groq → DeepSeek → Gemini → OpenAI
//
// نُصدّر كائن groq بنفس واجهة SDK الأصلية (chat.completions.create)
// لكنه يحوّل تلقائياً للمزود التالي عند rate limit أو أعطال الخادم —
// وبذلك يستفيد كل وكيل يستورد groq بدون تعديل أي موقع استدعاء.
// ═══════════════════════════════════════════════════════
// ── تصنيف أعطال المزوّدين — عطل دائم (رصيد/مفاتيح) لا يُجدى معه التكرار ──
export const AI_UNAVAILABLE_MSG = 'خدمة الذكاء الاصطناعي غير متاحة حالياً (رصيد المزوّد منتهٍ أو مفاتيح غير صالحة) — طلبك سليم ولا فائدة من إعادة المحاولة الآن.';
/** عطلٌ قد يزول: نُبلّغ صاحبَ المشروع أنّ المحاولة مستمرّة — بلا نصِّ المزوّد الخام. */
export const AI_RETRYABLE_MSG = 'تعذّر نداء خدمة الذكاء الاصطناعي في هذه المحاولة — نعيد المحاولة.';

/** نمطُ «علّةُ الموديل» — **مصدرٌ واحد** يقرؤه حاسمُ ٤٠٣ وحاسمُ `config` معاً. */
const MODEL_PROBLEM = /model.*(not exist|not found|no longer available|deprecated|supported)|supported api model/;

export function classifyAIError(e) {
    if (e?.aiUnavailable) return 'quota';
    const status = e?.status || e?.response?.status || 0;
    const msg = String(e?.message || '').toLowerCase();
    if (/insufficient_quota|exceeded your current quota|billing|payment required/.test(msg) || status === 402) return 'quota';
    if (/invalid api key|incorrect api key|api key not valid|no auth credentials|invalid authentication/.test(msg) || status === 401) return 'auth';
    // 🔀 **٤٠٣ رمزٌ ملتبس، والرسالةُ تحسم.** قِيس: `403` مع نصِّ المزوّد
    //    «The model `x` does not exist **or you do not have access to it**» كان يُقرأ
    //    `auth` فيُقال لصاحب المشروع «مفتاحُه غير صالح» — ومفتاحُه سليم، والعلّةُ اسمُ موديل.
    //    فيُطارد إعداداً صحيحاً ويترك العطبَ الحقيقيّ. والمزوّدُ نفسُه يردّ على العلّة عينِها
    //    بـ`404` مرّةً و`403` أخرى، فيخرج **تشخيصان متناقضان لمزوّدٍ واحد** — وهو ما ظهر في
    //    سجلٍّ حيّ لصاحب المنصّة. و`401` تبقى `auth` بلا شرط: «غيرُ موثَّق» لا لبسَ فيه،
    //    بخلاف «ممنوع» التي تحتمل المفتاحَ والموردَ معاً.
    if (status === 403 && !MODEL_PROBLEM.test(msg)) return 'auth';
    if (status === 429) return 'ratelimit';
    // موديل غير موجود/غير مدعوم = خطأ إعداد دائم — التكرار عليه هدر محض
    // قِيس من سجلّ إنتاجٍ حقيقيّ: Google تقول «no longer available» و`NOT_FOUND`، وOpenAI تقول
    // «deprecated» — ولا يعرف المُصنِّفُ إلّا `not exist`/`not found`. فعطبُ إعدادٍ دائمٌ كان يُقرأ
    // عابراً، فتُحرق كلُّ دورات النقاش على بابٍ مغلق. اللفظُ لفظُ المزوّد لا لفظُنا: أُسقطت
    // `not_found` و`retired` بعد القياس — لا رسالةَ مزوّدٍ حقيقيّةٍ تحتاجهما (`supported` سابقةٌ لنا،
    // بقيت كما كانت ولم تُقَس).
    if (MODEL_PROBLEM.test(msg)) return 'config';
    if (/غير مُفعّل|لا يوجد مزود|not configured/.test(msg)) return 'config';
    return 'transient';
}

/** عطل لا يزول بإعادة المحاولة: رصيد منتهٍ، مفتاح غير صالح، أو مزوّد غير مُهيأ. */
export const isPermanentAIError = (e) => ['quota', 'auth', 'config'].includes(classifyAIError(e));

/**
 * 🧾 قرارُ الفشل المجمَّع — موضعٌ واحد يقرّر أمرَين معاً:
 *   • أيُوقَف التكرار؟ نعم إن كانت كلُّ الأعطال دائمة (رصيد/مفاتيح/إعداد) — `aiUnavailable`.
 *   • وماذا يُقال لصاحب المشروع؟ **جملتُنا لا نصُّ المزوّد**. كان الخامُ يُرمى كما هو خارج تلك الحالة
 *     الواحدة، فيقرأ من يبني متجراً رابطَ فوترةِ حسابِ المنصّة في سجلّ مشروعه. التفصيلُ الخام يبقى
 *     في `causes` وفي `console.warn` أعلاه — للتشخيص لا للعرض.
 */
export function aggregateFailure(failures, lastError) {
    if (!failures.length) {
        // 🔴 لا مزوّدَ حاولَ أصلاً — لا مفاتيحَ أو كلُّها مُستبعَدةٌ بـ`AI_PROVIDERS`. وهذا **أدومُ**
        // الأعطال: لا محاولةَ ثانيةٌ تُوجِد مفتاحاً. كان الغلافُ يعيد المحاولةَ عليه لأنّ الراية
        // غابت — أوقعَته حزمةُ الاختبارات نفسُها (وهي تعمل بلا مفاتيح) بانتظارٍ لا سبب له.
        const none = lastError || new Error('لا يوجد مزود AI مُهيأ (GROQ_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY).');
        none.aiUnavailable = true;
        return none;
    }
    const permanent = failures.every(isPermanentAIError);
    const diagnosis = failures
        .filter(f => f?.provider)
        .map(f => ({ provider: f.provider, kind: classifyAIError(f) }));
    // التشخيصُ في نصّ الخطأ نفسِه: سطرُ السجلّ الحيّ يعرض `message` مباشرةً، فبدونه يبقى
    // أظهرُ ما يراه صاحبُ المشروع جملةً واحدةً لكلّ الأسباب.
    const detail = describeAIFailure(diagnosis);
    const err = new Error((permanent ? AI_UNAVAILABLE_MSG : AI_RETRYABLE_MSG) + (detail ? ` [${detail}]` : ''));
    if (permanent) err.aiUnavailable = true;
    err.diagnosis = diagnosis;
    err.causes = failures.map(f => String(f.message).slice(0, 120));
    // `causes` تحمل نصَّ المزوّد الخام وتبقى لسجلّ الخادم وحدَه؛ `diagnosis` أعلاه هو
    // الوحيدُ المسموحُ عرضُه لصاحب المشروع.
    err.cause = lastError;
    return err;
}

/** لفظُنا لكلِّ صنف — العلاجُ يختلف، فاللفظُ يختلف. */
const KIND_WORDS = {
    ar: {
        config: 'اسمُ الموديل المضبوط غير معروف عنده (يُصلَح من إعداد المنصّة بلا نشر)',
        quota: 'رصيدُه منتهٍ',
        auth: 'مفتاحُه غير صالح',
        ratelimit: 'تجاوزَ حدَّ المعدّل مؤقّتاً',
        transient: 'تعذّر الوصولُ إليه في هذه المحاولة',
    },
    en: {
        config: 'does not recognize the configured model name (fixable in platform settings, no deploy)',
        quota: 'is out of credit',
        auth: 'key is not valid',
        ratelimit: 'hit its rate limit temporarily',
        transient: 'could not be reached on this attempt',
    },
};

/**
 * 🩺 سطرُ التشخيص لصاحب المشروع: مزوّدٌ وصنفُ عطبه بلفظِنا.
 *
 * قِيس أنّ جملةً واحدةً لكلّ الأسباب تجعل «لا جديد» صادقةً ولا تدلّ على شيء: اسمُ موديلٍ خاطئ
 * (سطرٌ في الإعداد) ورصيدٌ منتهٍ (دفع) كانا يُقالان بالعبارة نفسِها.
 */
export function describeAIFailure(diagnosis, lang = 'ar') {
    const words = KIND_WORDS[lang] || KIND_WORDS.ar;
    const parts = (Array.isArray(diagnosis) ? diagnosis : [])
        .filter((d) => d?.provider && words[d.kind])
        .map((d) => `${d.provider}: ${words[d.kind]}`);
    return parts.join(' · ');
}

/**
 * 🏷️ أسماءُ الموديلات — تُعلَن عند الإقلاع مع **مصدر** كلٍّ منها.
 *
 * قِيس من سجلّ إنتاج: صاحبُ المنصّة ضبط `GROQ_MODEL` في Render وبقي 404 — ولم يكن لأحدٍ جوابٌ
 * عن «هل وصل الضبطُ أصلاً؟». سطرٌ واحد يُنهي السؤال. واسمُ الموديل ليس سرّاً (افتراضاتُه في
 * المستودع)، فطبعُه لا يكشف مفتاحاً — وهذا ما يُميّزه عن كلّ ما لا يُطبع هنا.
 */
/**
 * 🔴 حقلٌ يملؤه إنسانٌ لا تُطبع قيمتُه قبل فحصِ شكلها.
 *
 * قِيس في الإنتاج: وُضع **مفتاح Groq** في `GROQ_MODEL`، فطبعه سطرُ الإقلاع كاملاً في السجلّ.
 * وحكمُ #592 («اسمُ الموديل ليس سرّاً») صحيحٌ عن الاسم، خاطئٌ عن الحقل: الحقلُ يحمل ما يُكتب فيه.
 *
 * والفحصُ بالشكل: بادئةُ اعتمادٍ معروفة، أو سلسلةٌ طويلةٌ بلا `/` — وأطولُ اسمِ موديلٍ حقيقيٍّ
 * قِيس بلا `/` هو `llama-3.3-70b-versatile` (٢٣ محرفاً)، فحدُّ ٣٦ يترك مسافةً واسعة.
 */
// تعريفُ دالّةٍ لا ثابتاً: سطورُ الإقلاع تنادي `modelReportLines` **قبل** هذا الموضع في الملفّ،
// وثابتُ `const` في منطقة الموت الزمنيّ حينها فيرمي — أوقعه الاختبارُ قبل النشر.
export function looksLikeSecret(v) {
    const s = String(v ?? '').trim();
    return /^(gsk_|sk-|AIza|gh[pousr]_|xai-|r8_|hf_|Bearer\s)/i.test(s)
        || (s.length >= 36 && !s.includes('/'));
}

export function modelReportLines(env, resolved, only = PROVIDER_NAMES) {
    return PROVIDER_NAMES.filter((n) => only.includes(n)).map((name) => {
        const from = env[name] ? 'بيئة' : 'افتراضي';
        // الخطأُ نفسُه يصير تشخيصاً: يُقال ما هو، ولا تُكشف القيمة
        if (looksLikeSecret(resolved[name])) {
            return `🔴 [AI Model]: ${name} — القيمةُ المضبوطة تشبه مفتاحاً لا اسمَ موديل (${from}). `
                + `أُخفيت. ضع المفتاحَ في ${name.toUpperCase()}_API_KEY واجعل ${name.toUpperCase()}_MODEL اسمَ موديل.`;
        }
        return `🏷️ [AI Model]: ${name} = ${resolved[name]} (${from})`;
    });
}

/** أقصى ما يُطبع من الأسماء المكتشفة — سطرُ سجلٍّ يُقرأ، لا مِلفّ. */
export const MODEL_DISCOVERY_LIMIT = 20;

/**
 * 🔎 سؤالُ المزوّد عمّا يقبله. يُنادى **داخل معالج فشلٍ** من صنف `config`، فلا يرمي أبداً:
 * رميةٌ منه تُحوّل عطبَ إعدادٍ مفهوماً إلى انهيارٍ غامض في مسارٍ هو أصلاً مسارُ عطب.
 */
export async function discoverModels(client) {
    try {
        const r = await client?.models?.list?.();
        const rows = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
        return rows
            .map((m) => (typeof m?.id === 'string' ? m.id.trim() : ''))
            .filter(Boolean)
            .slice(0, MODEL_DISCOVERY_LIMIT);
    } catch {
        return [];   // المزوّدُ لا يجيب: نبقى على ما نعرف، ولا نُسقط المسار
    }
}

// يُسأل المزوّدُ مرّةً واحدةً لكلِّ عمر عملية: العطبُ إعداديّ لا يتبدّل تحت التشغيل.
const askedFor = new Set();
async function reportAvailableModels(client, name, err) {
    if (classifyAIError(err) !== 'config' || askedFor.has(name)) return;
    askedFor.add(name);
    const ids = await discoverModels(client);
    console.warn(ids.length
        ? `🔎 [AI Model]: ${name} لا يعرف الاسمَ المضبوط. الأسماءُ المتاحة عنده: ${ids.join('، ')}`
        : `🔎 [AI Model]: ${name} لا يعرف الاسمَ المضبوط، ولم يُجب عن قائمة المتاح.`);
}

// ═══════════════════════════════════════════════════════
// 💰 عدّادُ الرموز — «كم كلّف هذا البناء؟» سؤالٌ لم يكن له جواب
// ═══════════════════════════════════════════════════════
/**
 * قِيس بالبحث: صفرُ مواضعَ تلتقط `total_tokens`. فكلفةُ بناءٍ واحدٍ مجهولةٌ تماماً، وكلُّ حكمٍ
 * على «الأغلى/الأرخص» رأيٌ لا قياس. والكلفةُ ليست سعرَ الرمز وحدَه: هي السعر × الرموز ×
 * **عدد النداءات** — وحلقةُ النقاش تبلغ سبعَ دورات.
 *
 * **حدٌّ مقصود**: لا يُرسَل معامِلٌ جديد للمزوّد (`stream_options`). مسارُ التدفّق هو مسارُ
 * توليد الكود، وكسرُه بمعامِلٍ قد يرفضه مزوّدٌ ثمنٌ لا يُدفع لأجل عدّاد. يُقرأ ما يتطوّع به
 * المزوّد، ويُقال صراحةً كم نداءً بقي بلا رقم.
 */
const acc = { calls: 0, counted: 0, prompt: 0, completion: 0, total: 0, byProvider: {}, byLabel: {} };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * 🏷️ وسمُ المنادي — «أيُّ وكيلٍ يحرق الرموز؟» سؤالٌ لم يكن للعدّاد جوابٌ عليه.
 *
 * كان يسجّل لكلِّ **مزوّد**، وهو يجيب «كم» ولا يجيب «أين». فأيُّ قرارِ توزيعِ موديلاتٍ على
 * الوكلاء كان سيُبنى على حدسٍ لا رقم.
 *
 * والوسمُ **محيطيٌّ لا معامِل**: قِيس أنّ مواضعَ النداء المباشرة تسعةَ عشرَ في أربعةَ عشرَ ملفّاً،
 * وأنّ وكلاءَ العقود كلَّهم يمرّون بـ`runAgent` وهو يعرف `agent.id` سلفاً. فتغييرُ التواقيع
 * كان سيمسّ كلَّ منادٍ ليخدم عدّاداً — و`AsyncLocalStorage` تعبر `await` و`for await` فتنسب
 * النداءَ العميقَ إلى مرحلته بلا أن يعلم بها أحدٌ في الطريق.
 */
const labelScope = new AsyncLocalStorage();

/** يُشغّل `fn` تحت وسمٍ يُنسَب إليه كلُّ نداءِ نموذجٍ يقع داخلَه. وسمٌ فارغ = لا نطاق. */
export function withUsageLabel(label, fn) {
    const name = String(label || '').trim();
    return name ? labelScope.run(name, fn) : fn();
}

/** الوسمُ النافذُ الآن، أو `null` خارج أيّ نطاق. */
export const currentUsageLabel = () => labelScope.getStore() || null;

/** يُسجّل نداءً واحداً؛ `carrier` أيُّ كائنٍ قد يحمل `usage` (ردٌّ كامل أو آخرُ قطعةِ تدفّق). */
export function noteUsage(provider, carrier) {
    acc.calls++;
    const usage = carrier?.usage;
    // 🔤 اسمان لحقلٍ واحد: OpenAI/Groq/DeepSeek تكتب `prompt_tokens`، وGemini تكتب
    //    `promptTokenCount` في `usageMetadata` (والسلسلةُ تمرّرها كما هي في `tagged('gemini', …)`).
    //    **قِيس لا خُمِّن**: نداءُ Gemini بأرقامه الكاملة كان يُعدّ «صامتاً» — `counted: 0`،
    //    `total: 0` — فكلُّ رموز مزوّدٍ كاملٍ كانت تسقط من الحساب بلا أثرٍ يُنبّه.
    const total = num(usage?.total_tokens) || num(usage?.totalTokenCount);
    const prompt = num(usage?.prompt_tokens) || num(usage?.promptTokenCount);
    const completion = num(usage?.completion_tokens) || num(usage?.candidatesTokenCount);
    if (!total && !prompt && !completion) return;   // نداءٌ صامت: يُعدّ ولا يُحسب
    acc.counted++;
    acc.prompt += prompt; acc.completion += completion;
    const sum = total || (prompt + completion);
    acc.total += sum;
    const name = String(provider || 'مجهول');
    const b = (acc.byProvider[name] ||= { calls: 0, total: 0 });
    b.calls++; b.total += sum;
    // 🏷️ والوسمُ من نطاقه المحيط. وما وقع خارج كلِّ نطاقٍ يُسمّى «بلا وسم» ولا يُخفى:
    //    نداءٌ لا نعرف صاحبَه حقيقةٌ تُعرَض، لا فجوةٌ تُبتلَع في المجموع.
    const tag = currentUsageLabel() || 'بلا وسم';
    const l = (acc.byLabel[tag] ||= { calls: 0, total: 0 });
    l.calls++; l.total += sum;
}

/** لقطةٌ منفصلة — لا مرجعٌ حيّ يتبدّل تحت يد قارئه. */
export function readAIUsage() {
    return {
        calls: acc.calls, counted: acc.counted, prompt: acc.prompt,
        completion: acc.completion, total: acc.total,
        byProvider: Object.fromEntries(Object.entries(acc.byProvider).map(([k, v]) => [k, { ...v }])),
        byLabel: Object.fromEntries(Object.entries(acc.byLabel).map(([k, v]) => [k, { ...v }])),
    };
}

export function resetAIUsage() {
    Object.assign(acc, { calls: 0, counted: 0, prompt: 0, completion: 0, total: 0, byProvider: {}, byLabel: {} });
}

/** سطرُ الكلفة. بلقطةِ بدايةٍ يصير الفرقُ كلفةَ مهمّةٍ واحدة لا كلفةَ العملية كلِّها. */
export function usageLine(now, before = null) {
    const d = (k) => now[k] - (before ? before[k] : 0);
    const calls = d('calls');
    if (!calls) return '💰 [AI Usage]: لا نداءات.';
    const silent = calls - d('counted');
    const per = Object.entries(now.byProvider)
        .map(([k, v]) => `${k} ${v.total - (before?.byProvider?.[k]?.total || 0)}`)
        .join('، ');
    return `💰 [AI Usage]: ${d('total')} رمزاً (دخل ${d('prompt')} / خرج ${d('completion')}) في ${calls} نداء`
        + `${per ? ` — ${per}` : ''}`
        + `${silent ? ` · ${silent} نداءً بلا أرقامٍ من المزوّد (غيرُ محسوبة)` : ''}`;
}

/**
 * 🏷️ سطرُ «أين ذهبت الرموز» — الوجهُ الآخر من `usageLine`: ذاك يقول **كم** ومن أيّ مزوّد،
 * وهذا يقول **أيُّ وكيلٍ** أحرقها. وهو مرتَّبٌ تنازليّاً لأنّ السؤالَ الذي يُطرح عليه دائماً
 * هو «مَن الأكثر؟» — فأوّلُ سطرٍ يُقرأ هو الجواب.
 *
 * و«بلا وسم» **بندٌ مُعلَن لا فجوةٌ مبتلَعة**: يقع فيه ما لم يُوسَم قصداً — أبرزُه نداءاتُ
 * وكلاء الإضافات التي يُنشئها المستخدم من اللوحة (`services/adminService.js` يكتب شفرتَها
 * داخل قوالبَ نصّيّة، فهي شفرةٌ مولَّدة لا موضعُ نداءٍ في المنصّة). فإن كبر هذا البند
 * فالرقمُ نفسُه هو الخبر، لا نقصٌ في الأداة.
 */
export function usageByLabelLine(now, before = null) {
    const rows = Object.entries(now.byLabel)
        .map(([k, v]) => [k, v.total - (before?.byLabel?.[k]?.total || 0), v.calls - (before?.byLabel?.[k]?.calls || 0)])
        .filter(([, total, calls]) => total > 0 || calls > 0)
        .sort((a, b) => b[1] - a[1]);
    if (!rows.length) return '🏷️ [AI Usage/وكيل]: لا نداءات.';
    return '🏷️ [AI Usage/وكيل]: ' + rows.map(([k, total, calls]) => `${k} ${total} (${calls})`).join('، ');
}

/**
 * الردُّ الكامل يُحسب فوراً؛ والتدفّقُ يُوسَم باسم مزوّده ليحسبه مستهلكُه عند آخر قطعة —
 * فالمستهلكُ وحدَه يعرف متى انتهى التدفّق.
 */
function tagged(provider, res) {
    if (res && typeof res[Symbol.asyncIterator] === 'function') {
        try { res.__aiProvider = provider; } catch { /* كائنٌ مُحكَم: يُحسب 'مجهول' */ }
        return res;
    }
    noteUsage(provider, res);
    return res;
}

// ═══════════════════════════════════════════════════════
// 🔁 إعادةُ المحاولة — «نعيد المحاولة» وعدٌ لم يكن الكودُ يفي به
// ═══════════════════════════════════════════════════════
/**
 * قِيس من لقطة إنتاج: سقط سبعةُ وكلاءَ من سبعة بـ«تعذّر الوصول» (عطبٌ عابر)، فانتهى البناءُ
 * إلى المولّد الكلاسيكيّ — بينما كانت تكفي محاولةٌ ثانيةٌ بعد أقلَّ من ثانية. و`createWithFailover`
 * كان يجرّب كلَّ مزوّدٍ **مرّةً واحدة**؛ ورسالةُ `AI_RETRYABLE_MSG` تقول «نعيد المحاولة».
 *
 * والإعادةُ على العابر وحدَه: الرصيدُ المنتهي واسمُ الموديل الخاطئ لا تُجدي معهما محاولة —
 * وتكرارُها هو عينُ ما أُغلق في #588 (سبعُ دوراتٍ تُحرق على بابٍ مغلق).
 */
export const AI_MAX_RETRIES = Math.min(3, Math.max(1, Number(process.env.AI_MAX_RETRIES) || 2));
const RETRY_BASE_MS = Math.max(1, Number(process.env.AI_RETRY_BASE_MS) || 400);

/** تراجعٌ تصاعديّ محدود — المستخدمُ ينتظر أمام شاشة، فالمجموعُ محسوب. */
export function retryDelayMs(attempt) {
    return RETRY_BASE_MS * Math.pow(3, attempt);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attemptChain(params, opts) {
    let lastError = null;
    const failures = [];

    // 1️⃣ Groq — الأسرع. أي فشل (rate limit/مفتاح/شبكة) → المزود التالي فوراً
    if (groqClient && enabled('groq')) {
        try {
            return tagged('groq', await groqClient.chat.completions.create(params, opts));
        } catch (e) {
            e.provider = 'groq';
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] Groq فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) → DeepSeek`);
            await reportAvailableModels(groqClient, 'groq', e);
        }
    }

    // 2️⃣ DeepSeek — الاشتراك المدفوع، نفس واجهة OpenAI ويدعم البث و JSON mode
    if (hasDeepseek && enabled('deepseek')) {
        try {
            return tagged('deepseek', await deepseek.chat.completions.create({ ...params, model: DEEPSEEK_MODEL }, opts));
        } catch (e) {
            e.provider = 'deepseek';
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] DeepSeek فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) → ${(ai && enabled('gemini')) ? 'Gemini' : (openaiClient && enabled('openai')) ? 'OpenAI' : 'لا بديل متبقٍ'}`);
            await reportAvailableModels(deepseek, 'deepseek', e);
        }
    }

    // 3️⃣ Gemini — واجهة مختلفة تُغلَّف بشكل OpenAI؛ لا يدعم بثّنا فيُتخطّى للبث
    if (ai && enabled('gemini') && !params.stream) {
        try {
            const wantJson = params.response_format?.type === 'json_object';
            const text = (params.messages || [])
                .map(m => (m.role === 'system' ? `تعليمات النظام:\n${m.content}` : m.content))
                .join('\n\n');
            const r = await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: [{ role: 'user', parts: [{ text }] }],
                ...(wantJson ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
            });
            const out = r.response?.text?.() || r.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!out) throw new Error('Gemini أعاد رداً فارغاً');
            return tagged('gemini', { choices: [{ message: { content: out } }], usage: r?.usageMetadata });
        } catch (e) {
            e.provider = 'gemini';
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] Gemini فشل (${String(e.message).slice(0, 80)}) → ${(openaiClient && enabled('openai')) ? 'OpenAI' : 'لا بديل متبقٍ'}`);
        }
    }

    // 4️⃣ OpenAI — الخط الأخير
    if (openaiClient && enabled('openai')) {
        try {
            return tagged('openai', await openaiClient.chat.completions.create({ ...params, model: OPENAI_MODEL }, opts));
        } catch (e) {
            e.provider = 'openai';
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] OpenAI فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) — لا بديل متبقٍ`);
            await reportAvailableModels(openaiClient, 'openai', e);
        }
    }

    throw aggregateFailure(failures, lastError);
}

/**
 * جولةٌ كاملةٌ على السلسلة، ثمّ إعادةٌ محدودةٌ إن كان الفشلُ عابراً.
 * `aiUnavailable` تعني «كلُّها دائمة» — فلا إعادة.
 */
async function createWithFailover(params, opts) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await attemptChain(params, opts);
        } catch (err) {
            if (err?.aiUnavailable || attempt >= AI_MAX_RETRIES) throw err;
            const wait = retryDelayMs(attempt);
            console.warn(`[AI Retry] عطبٌ عابر — إعادةُ المحاولة ${attempt + 1}/${AI_MAX_RETRIES} بعد ${wait}ms`);
            await sleep(wait);
        }
    }
}

// كائن متوافق مع واجهة Groq SDK — non-null ما دام أي مزود متاحاً
export const groq = ((groqClient && enabled('groq')) || (hasDeepseek && enabled('deepseek'))
    || (ai && enabled('gemini')) || (openaiClient && enabled('openai')))
    ? { chat: { completions: { create: createWithFailover } } }
    : null;

/**
 * 🔄 smartChat — استدعاء ذكي مبسط (يرجع نص الرد مباشرة)
 * يستخدم نفس سلسلة الـ failover أعلاه
 */
export async function smartChat(messages, options = {}) {
    const { max_tokens = 1000, temperature = 0.3, json = false } = options;
    const params = {
        model: GROQ_MODEL,
        messages,
        max_tokens,
        temperature,
    };
    if (json) params.response_format = { type: 'json_object' };
    const res = await createWithFailover(params);
    return res.choices[0].message.content;
}
