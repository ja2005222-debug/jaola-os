/**
 * 💵 fx.js — سعر صرف للعرض بعملة المسافر (فجوة أمام OTAs الكبرى)
 *
 * المشكلة الإقليمية الصريحة: Frankfurter (بيانات البنك المركزي الأوروبي)
 * لا يغطي عملات الخليج إطلاقاً — لا SAR ولا AED ولا QAR. لكن هذه العملات
 * **مربوطة رسمياً بالدولار منذ عقود** بأسعار بنوكها المركزية المعلنة:
 * أسعار الربط أدناه حقائق نقدية منشورة لا أرقام مخمَّنة، وأي فكّ ربط
 * (حدث تاريخي نادر) يستلزم تحديثها يدوياً — لذلك كل نتيجة تحمل `source`
 * صريحاً (peg/market/mixed) والواجهة تعرض التحويل «≈ تقريبي» دوماً.
 *
 * **العرض فقط لا التسعير**: عملة الفوترة تبقى عملة المزوّد كما هي في كل
 * حجز — التحويل هنا راحةُ قراءة للمسافر، لا سعرَ بيع. الخلط بينهما هو
 * بالضبط «الرقم المُختلَق» الذي ترفضه هذه البوابة بنيوياً.
 */

import { convertCurrency } from './travelInfo.js';

// أسعار الربط الرسمية بالدولار (البنوك المركزية): وحدة عملة لكل دولار
export const USD_PEGS = {
    USD: 1,
    SAR: 3.75,    // مؤسسة النقد السعودية — ربط منذ 1986
    AED: 3.6725,  // مصرف الإمارات المركزي — منذ 1997
    QAR: 3.64,    // مصرف قطر المركزي — منذ 2001
    BHD: 0.376,   // مصرف البحرين المركزي — منذ 1980
    OMR: 0.3845,  // البنك المركزي العماني — منذ 1986
    KWD: null,    // ⚠️ الدينار الكويتي مربوط بسلة غير معلنة — لا ربط دولاري ثابت
    JOD: 0.709,   // البنك المركزي الأردني — منذ 1995
};

/** العملات المعروضة في منتقي الواجهة — المربوطة + الرئيسية العائمة */
export const DISPLAY_CURRENCIES = ['USD', 'SAR', 'AED', 'QAR', 'BHD', 'OMR', 'JOD', 'EUR', 'GBP', 'TRY'];

const CURRENCY_RE = /^[A-Z]{3}$/;
const round6 = n => Math.round(n * 1e6) / 1e6;

function pegOf(code) {
    const v = USD_PEGS[code];
    return Number.isFinite(v) ? v : null;
}

/** سعر مربوط↔مربوط بلا أي شبكة — أو null إن لم يكن الطرفان مربوطين. */
export function pegRate(from, to) {
    const f = pegOf(from), t = pegOf(to);
    if (f == null || t == null) return null;
    return round6(t / f);
}

/**
 * سعر صرف من أي عملة عرض لأي أخرى:
 *  - نفس العملة → 1 (بلا شبكة)
 *  - مربوطة↔مربوطة → قسمة ربطَين (بلا شبكة)
 *  - عائمة↔عائمة → Frankfurter مباشرة (سوق)
 *  - مربوطة↔عائمة → عبر الدولار: ربطٌ × سوق (mixed)
 * يرمي بخطأ ذي status لعملة غير صالحة أو فشل السوق.
 */
export async function fxRate({ from, to, fetchImpl = fetch }) {
    const f = String(from || '').trim().toUpperCase();
    const t = String(to || '').trim().toUpperCase();
    if (!CURRENCY_RE.test(f) || !CURRENCY_RE.test(t)) {
        throw Object.assign(new Error('رمزا العملة من ثلاثة أحرف (مثل USD وSAR).'), { status: 400 });
    }
    if (f === t) return { from: f, to: t, rate: 1, source: 'same', date: null };

    const direct = pegRate(f, t);
    if (direct != null) return { from: f, to: t, rate: direct, source: 'peg', date: null };

    const fPeg = pegOf(f), tPeg = pegOf(t);
    try {
        if (fPeg == null && tPeg == null) {
            // عائمة↔عائمة — سوق مباشر
            const r = await convertCurrency({ amount: 1, from: f, to: t, fetchImpl });
            return { from: f, to: t, rate: round6(r.rate), source: 'market', date: r.date };
        }
        if (fPeg != null) {
            // مربوطة → عائمة: f→USD ربطاً ثم USD→t سوقاً
            const r = await convertCurrency({ amount: 1, from: 'USD', to: t, fetchImpl });
            return { from: f, to: t, rate: round6(r.rate / fPeg), source: 'mixed', date: r.date };
        }
        // عائمة → مربوطة: f→USD سوقاً ثم USD→t ربطاً
        const r = await convertCurrency({ amount: 1, from: f, to: 'USD', fetchImpl });
        return { from: f, to: t, rate: round6(r.rate * tPeg), source: 'mixed', date: r.date };
    } catch (e) {
        throw Object.assign(
            new Error(`تعذّر جلب سعر الصرف ${f}→${t}: ${e.message}`),
            { status: 502 }
        );
    }
}
