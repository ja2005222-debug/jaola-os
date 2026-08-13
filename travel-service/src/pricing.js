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
