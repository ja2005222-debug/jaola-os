/**
 * 🏷️ discounts.js — أكواد خصم داخلية (منطقٌ نقيّ، لا Stripe Coupons)
 *
 * قرار مالك صريح: كودٌ داخليّ لا كوبونات Stripe العامة — فهذا يعطي تحكماً
 * كاملاً بحملات متعدّدة (كودٌ لكل مؤثّر/قناة)، وتتبّعاً لمن استعمل ماذا،
 * ومنتجاً مقيَّداً به الكود (رحلات فقط مثلاً) — أشياء Stripe Checkout
 * العام لا يعرفها عن نموذج الخدمة (منتجات متعددة، عملات متعددة).
 *
 * ⚠️ **تبسيطٌ متعمَّد بلا تحويل عملات**: `minAmount`/`maxDiscount` (لكود
 * نسبة مئوية) رقمان يُقارَنان مباشرةً بـ`sellAmount` **بعملة الحجز كما
 * هي** — بلا افتراض عملة موحّدة ولا تحويل. من يضبط كوداً بحدٍّ أدنى يعرف
 * بأي عملة يبيع غالباً (نفس مبدأ `TRAVEL_BILLING_CURRENCY` الذي يحصر
 * التحصيل أصلاً). كودٌ من نوع `fixed` وحده يحمل عملة **إلزامية** لأنه
 * مبلغٌ مطلق لا نسبة — ويُرفض صراحةً لا يُحوَّل حين تختلف عملة الحجز.
 *
 * ⚠️ **لا تعويض عند فشل الحجز بعد استهلاك الكود**: `redeemDiscountCode`
 * يُستدعى في `server.js` كآخر خطوة قبل إنشاء الحجز — فمحاولاتٌ فاشلة
 * لاحقاً (رفض المزوّد) لا تُعيد الاستعمال للكود. نفس مخاطرة كوبونٍ ورقي
 * يُستهلك عند شبّاك الدفع الفعلي — تبسيطٌ مقبول، لا عطبٌ يُصلَح لاحقاً
 * بلا طلبٍ فعلي لذلك.
 */

const CODE_RE = /^[A-Z0-9_-]{3,24}$/;
const MAX_NOTE = 120;
export const DISCOUNT_PRODUCTS = ['flight', 'stay', 'car', 'esim'];

/** ينقّي كوداً جديداً/معدَّلاً — {error} أو {value}. */
export function normalizeDiscountCode(raw) {
    const code = String(raw?.code || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) {
        return { error: 'كود الخصم 3–24 حرفاً/رقماً إنجليزياً (يُسمح بـ - و _ فقط).' };
    }
    const type = raw?.type === 'fixed' ? 'fixed' : 'percent';
    const value = Number(raw?.value);
    if (type === 'percent') {
        if (!Number.isFinite(value) || value <= 0 || value > 100) {
            return { error: 'نسبة الخصم رقم بين 1 و100.' };
        }
    } else if (!Number.isFinite(value) || value <= 0) {
        return { error: 'مبلغ الخصم رقم موجب.' };
    }
    let currency = null;
    if (type === 'fixed') {
        currency = String(raw?.currency || '').trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
            return { error: 'كود الخصم الثابت يحتاج عملة من ثلاثة أحرف (مثل SAR).' };
        }
    }
    let products = null;
    if (raw?.products != null && raw.products !== '') {
        const list = Array.isArray(raw.products) ? raw.products : String(raw.products).split(',');
        products = list.map(p => String(p).trim().toLowerCase()).filter(Boolean);
        if (products.length === 0) products = null;
        else if (products.some(p => !DISCOUNT_PRODUCTS.includes(p))) {
            return { error: `المنتجات المسموحة: ${DISCOUNT_PRODUCTS.join('، ')}.` };
        }
    }
    let maxDiscount = null;
    if (raw?.maxDiscount !== null && raw?.maxDiscount !== undefined && raw?.maxDiscount !== '') {
        const m = Number(raw.maxDiscount);
        if (!Number.isFinite(m) || m <= 0) return { error: 'سقف الخصم رقم موجب أو اتركه فارغاً.' };
        maxDiscount = m;
    }
    let minAmount = null;
    if (raw?.minAmount !== null && raw?.minAmount !== undefined && raw?.minAmount !== '') {
        const m = Number(raw.minAmount);
        if (!Number.isFinite(m) || m <= 0) return { error: 'الحد الأدنى للطلب رقم موجب أو اتركه فارغاً.' };
        minAmount = m;
    }
    let maxUses = null;
    if (raw?.maxUses !== null && raw?.maxUses !== undefined && raw?.maxUses !== '') {
        const m = Number(raw.maxUses);
        if (!Number.isInteger(m) || m <= 0) return { error: 'الحد الأقصى للاستخدام عدد صحيح موجب أو اتركه فارغاً.' };
        maxUses = m;
    }
    let expiresAt = null;
    if (raw?.expiresAt !== null && raw?.expiresAt !== undefined && raw?.expiresAt !== '') {
        const t = new Date(raw.expiresAt).getTime();
        if (!Number.isFinite(t)) return { error: 'تاريخ الانتهاء غير صالح.' };
        expiresAt = t;
    }
    return {
        value: {
            code, type, value, currency, products, maxDiscount, minAmount, maxUses,
            expiresAt, active: raw?.active !== false,
            note: String(raw?.note || '').trim().slice(0, MAX_NOTE) || null,
        },
    };
}

/**
 * يحسب الخصم لحجزٍ بعينه — **بلا** أي كتابة أو استهلاك عدّاد (فحصٌ نقيّ
 * يُستعمل للمعاينة العامة وقبل الاستهلاك الذرّي في server.js معاً).
 * {error} أو {value: المبلغ المخصوم بعملة الحجز}.
 */
export function computeDiscount(discount, { sellAmount, currency, product }) {
    if (!discount || discount.active === false) return { error: 'كود الخصم غير صالح.' };
    if (discount.expiresAt != null && Date.now() > discount.expiresAt) {
        return { error: 'انتهت صلاحية كود الخصم.' };
    }
    if (discount.maxUses != null && (discount.usedCount || 0) >= discount.maxUses) {
        return { error: 'نفدت الكمية المتاحة من كود الخصم.' };
    }
    if (Array.isArray(discount.products) && !discount.products.includes(product)) {
        return { error: 'كود الخصم لا ينطبق على هذا المنتج.' };
    }
    if (discount.type === 'fixed' && discount.currency !== currency) {
        return { error: `كود الخصم بعملة ${discount.currency} ولا يعمل مع حجزٍ بعملة ${currency}.` };
    }
    if (discount.minAmount != null && sellAmount < discount.minAmount) {
        return { error: `كود الخصم يحتاج طلباً لا يقل عن ${discount.minAmount} ${currency}.` };
    }
    const raw = discount.type === 'fixed' ? discount.value : sellAmount * discount.value / 100;
    const capped = discount.maxDiscount != null ? Math.min(raw, discount.maxDiscount) : raw;
    const amount = Math.round(Math.min(capped, sellAmount) * 100) / 100;
    if (amount <= 0) return { error: 'كود الخصم لا يخصم شيئاً على هذا المبلغ.' };
    return { value: amount };
}
