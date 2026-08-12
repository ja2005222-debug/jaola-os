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
const MAX_MARKUP_PCT = 50; // فوق هذا غالباً خطأ إعداد لا قرار تسعير

/** يقرأ نسبة الهامش من البيئة — قيمة فاسدة/سالبة/مبالغة تقع على الافتراضي. */
export function readMarkupPct(env = process.env) {
    const raw = Number(env.TRAVEL_MARKUP_PCT);
    if (!Number.isFinite(raw) || raw < 0 || raw > MAX_MARKUP_PCT) return DEFAULT_MARKUP_PCT;
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
