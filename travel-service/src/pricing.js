/**
 * 💰 pricing.js — محرك الهامش (نموذج العمولة بلا تحويل)
 *
 * جوهر النموذج التجاري كله في هذا الملف الصغير: المزوّد يعطينا سعراً
 * **صافياً** (net)، ونبيع للمسافر سعر العرض (sell) = الصافي + هامشنا.
 * الفرق هو عمولتنا، ويُسجَّل على كل حجز (netAmount/sellAmount) ليكون
 * تقرير الأرباح لاحقاً مجرد جمع، لا استنتاجاً رجعياً هشّاً.
 *
 * قاعدة ثابتة: السعر الصافي **لا يغادر الخادم أبداً** — الواجهة
 * والايجنت يريان sellAmount فقط (تُختبر صراحةً في الاختبارات).
 */

export const DEFAULT_MARKUP_PCT = 8;
export const DEFAULT_PACKAGE_MARKUP_PCT = 5; // قرار المالك: خصم حقيقي من التنازل عن جزء من العمولة
export const MAX_MARKUP_PCT = 50; // فوق هذا غالباً خطأ إعداد لا قرار تسعير — مُصدَّرة ليستعملها contracts.js بلا سقف مكرَّر

/** يقرأ نسبة الهامش من البيئة — قيمة فاسدة/سالبة/مبالغة تقع على الافتراضي. */
export function readMarkupPct(env = process.env) {
    const raw = Number(env.TRAVEL_MARKUP_PCT);
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_MARKUP_PCT) return DEFAULT_MARKUP_PCT;
    return raw;
}

/**
 * هامش كل فئة منتج (طيران/فندق/سيارة) قابل للتخصيص على حدة — قبل هذا
 * كانت applyMarkup(x, markupPct) تُنادى بنفس الرقم للثلاثة حرفياً
 * (تحقّقتُ من كل نداء في server.js): لا فصل أصلاً بين هامش الطيران
 * والفندق، فسؤال «هل نفصلهما» لم يكن اختياراً بل كان عطباً قائماً.
 *
 * وبلا أي متغيّر بيئة جديد **لا يتغيّر شيء**: تسقط الفئة على `defaultPct`
 * الذي يمرّره الطالب (غالباً الهامش العام نفسه) — من لم يلمس الإعداد
 * الجديد لا يتغيّر سعره حرفاً واحداً. هذا توافق خلفي مقصود لا مصادفة.
 */
export const CATEGORY_MARKUP_ENV = {
    flight: 'TRAVEL_MARKUP_PCT_FLIGHT',
    stay: 'TRAVEL_MARKUP_PCT_STAY',
    car: 'TRAVEL_MARKUP_PCT_CAR',
    esim: 'TRAVEL_MARKUP_PCT_ESIM',
};

export function readCategoryMarkupPct(category, env = process.env, defaultPct = DEFAULT_MARKUP_PCT) {
    const envVar = CATEGORY_MARKUP_ENV[category];
    if (!envVar) return defaultPct; // فئة مجهولة — لا تخمين
    const raw = Number(env[envVar]);
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_MARKUP_PCT) return defaultPct;
    return raw;
}

/**
 * هامش الباقة — **محروس بنيوياً أن يكون أقل من الهامش العادي**.
 *
 * قرار المالك: فرق سعر الباقة خصمٌ حقيقي مموَّل من التنازل عن جزء من
 * العمولة، والربح من معدّل الإرفاق. وباقة هامشها ≥ الهامش العادي ليست
 * أرخص — فادّعاء «وفّر X» عليها كذبٌ يُكتشف بجمع بسيط. لذلك القيمة
 * المضبوطة تُقبل فقط إن كانت أدنى من الهامش العادي، وإلا سقطت على
 * افتراضٍ يُضمَن أنه أدنى (نصف الهامش العادي إن كان الافتراضُ نفسه لا
 * يحقق الشرط). البنية تمنع الادّعاء الكاذب قبل النيّة.
 */
export function readPackageMarkupPct(env = process.env, markupPct = DEFAULT_MARKUP_PCT) {
    const raw = Number(env.TRAVEL_PACKAGE_MARKUP_PCT);
    if (Number.isFinite(raw) && raw >= 0 && raw < markupPct) return raw;
    return Math.min(DEFAULT_PACKAGE_MARKUP_PCT, markupPct / 2);
}

/**
 * يطبّق الهامش على مبلغ صافٍ ويُرجع سعر البيع بمنزلتين عشريتين.
 * تقريب **لأعلى** لآخر سنت — لا نبيع أبداً بأقل من الصافي + الهامش
 * بسبب كسور التقريب.
 */
export function applyMarkup(netAmount, markupPct) {
    const net = Number(netAmount);
    if (!Number.isFinite(net) || net < 0) {
        throw new Error(`مبلغ صافٍ غير صالح: ${netAmount}`);
    }
    // الحساب بالسنتات + إبسيلون قبل ceil — يمنع شبح الفاصلة العائمة
    // (100×1.1 = 110.00000000000001) من رفع السعر سنتاً زائداً.
    const sellCents = Math.ceil(Math.round(net * 100) * (1 + markupPct / 100) - 1e-6);
    return Math.max(0, sellCents) / 100;
}

// ─── 🚨 حارس إعداد النِسَب: الصمت هو العطب ────────────────────────────
//
// كل الدوال أعلاه تسقط على الافتراضي عند قيمة فاسدة — وهذا **صحيح**
// كسلوك تشغيل (لا نُسقط موقعاً حياً بسبب رقمٍ مكتوبٍ خطأً). لكنها تسقط
// **بلا صوت**: لا خطأ، ولا سطر سجلّ، ولا أثر في الواجهة.
//
// ⚠️ حادثة حقيقية (٣ سبتمبر ٢٠٢٦): لُصق مفتاح LiteAPI في
// `TRAVEL_MARKUP_PCT_FLIGHT` على لوحة الاستضافة. `Number('sand_…')`
// يساوي `NaN` ⇒ سقوطٌ صامت على الهامش العام. الموقع يعمل، والحجوزات
// تمرّ، وهامش الطيران وحده يتغيّر — بلا عَرَضٍ واحد يدلّ عليه. عطبٌ
// يُسقط الخدمة يُكتشف في دقيقة؛ هذا قد يعيش شهوراً.
//
// فالحارس لا يغيّر السقوط الآمن — يجعله **مسموعاً**.

export const MAX_FX_BUFFER_PCT = 10;
export const DEFAULT_FX_BUFFER_PCT = 2;

/**
 * هامش الصرف عند التحصيل بعملة محلية. كان يُقرأ في موضعين بصيغتين
 * مختلفتين: `server.js` يحسبه بحدّ 0–10، **ثم يطبع في سجلّ الإقلاع قيمة
 * البيئة الخام** — فكان يعلن «99%» بينما يستعمل 2%. مصدرٌ واحد يمنع ذلك.
 */
export function readFxBufferPct(env = process.env) {
    const raw = Number(env.TRAVEL_FX_BUFFER_PCT);
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_FX_BUFFER_PCT) return DEFAULT_FX_BUFFER_PCT;
    return raw;
}

/** كل متغيّر نسبةٍ في الخدمة وحدّه الأعلى — مصدر الحارس الوحيد. */
export const PERCENT_ENV_RULES = Object.freeze([
    ...Object.values(CATEGORY_MARKUP_ENV).map(envVar => ({ envVar, max: MAX_MARKUP_PCT })),
    { envVar: 'TRAVEL_MARKUP_PCT', max: MAX_MARKUP_PCT },
    { envVar: 'TRAVEL_PACKAGE_MARKUP_PCT', max: MAX_MARKUP_PCT },
    { envVar: 'TRAVEL_FX_BUFFER_PCT', max: MAX_FX_BUFFER_PCT },
].map(Object.freeze));

// بادئات المفاتيح التي تمرّ فعلاً في هذه الخدمة — للتلميح لا للحصر
const LOOKS_LIKE_KEY = /^(sand_|prod_|sk_|pk_|whsec_|duffel_|re_|key-)/i;

/**
 * يجرد متغيّرات النِسَب **المضبوطة** التي لن تُستعمل قيمتها فعلياً.
 * المتغيّر غير المضبوط ليس عطباً: غيابه سقوطٌ مقصود على الافتراضي.
 *
 * 🔒 لا يُعيد القيمة الخام أبداً — الحادثة نفسها تثبت أن ما يُلصق في
 * حقل نسبةٍ قد يكون **مفتاح API**، وطباعته في السجلّ تسريبٌ لا تشخيص.
 */
export function collectPercentConfigIssues(env = process.env) {
    const issues = [];
    for (const { envVar, max } of PERCENT_ENV_RULES) {
        const raw = env[envVar];
        if (raw === undefined || raw === null) continue;
        const text = String(raw);
        if (text.trim() === '') { issues.push({ envVar, reason: 'empty', max }); continue; }
        const num = Number(text);
        if (!Number.isFinite(num)) {
            issues.push({ envVar, reason: 'not-a-number', max, length: text.length, looksLikeKey: LOOKS_LIKE_KEY.test(text.trim()) });
        } else if (num < 0 || num > max) {
            issues.push({ envVar, reason: 'out-of-range', max, value: num });
        }
    }
    return issues;
}

/** صياغة عربية لملاحظةٍ واحدة — بلا كشف القيمة. */
export function formatPercentIssue(issue) {
    const head = `⚠️ ${issue.envVar}:`;
    if (issue.reason === 'empty') {
        // `Number('')` يساوي صفراً لا NaN — فالقيمة الفارغة **تُستعمل**
        // كصفرٍ بالمئة، أي بيعٌ بلا عمولة إطلاقاً. أخطر من الفاسدة.
        return `${head} قيمة فارغة — تُقرأ **صفراً بالمئة** (بيعٌ بلا عمولة)، لا سقوطاً على الافتراضي. احذف المتغيّر أو اكتب رقماً.`;
    }
    if (issue.reason === 'not-a-number') {
        const hint = issue.looksLikeKey
            ? ' القيمة تبدأ ببادئة مفتاح API — يبدو أنها لُصقت في المتغيّر الخطأ.'
            : '';
        return `${head} ليست رقماً (${issue.length} حرفاً) — تُهمَل ويُستعمل الافتراضي بصمت.${hint}`;
    }
    return `${head} ${issue.value} خارج المدى المسموح 0–${issue.max} — تُهمَل ويُستعمل الافتراضي بصمت.`;
}
