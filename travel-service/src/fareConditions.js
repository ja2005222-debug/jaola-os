/**
 * 🎟️ fareConditions.js — عائلة السعر وشروطه: ما الذي تشتريه فعلاً؟
 *
 * سعرٌ واحد مجرَّد لا يكفي لاتخاذ قرار. تذكرتان بفارق ٨٠ ريالاً قد تكون
 * إحداهما قابلة للاسترداد والأخرى لا — وهذا فارقٌ أكبر بكثير من ٨٠ ريالاً
 * لمن قد تتغيّر خطته. الآن تُعرض **عائلة السعر** (Fare Brand) وشرطا
 * التغيير والاسترداد بجانب كل عرض.
 *
 * 🔴 القاعدة الحاكمة هنا — والسبب في وجود هذا الملف أصلاً:
 * الشرط ليس نعم/لا بل **ثلاثيّ**، وDuffel يوثّق ذلك صراحةً: قد يصل
 * `allowed: true` و`penalty_amount: null` معاً، ومعناه «مسموح والرسم
 * يحدّده الناقل» لا «مجاني». وغياب كائن الشروط كلّه معناه «غير معلوم» لا
 * «ممنوع». خلطُ أيٍّ من هذه بـ«مجاني» أو «غير قابل» وعدٌ كاذب يدفع ثمنه
 * المسافر على شبّاك المطار.
 *
 * فالحالات خمسٌ متمايزة، لكلٍّ نصّها:
 *   unknown  — لا معلومة (لا نخترع)
 *   no       — ممنوع صراحةً
 *   free     — مسموح برسم صفر
 *   fee      — مسموح برسم معلوم
 *   feeUnknown — مسموح والرسم غير معلوم  ← الحالة التي تُنسى فتكذب
 *
 * ⚠️ رسم الغرامة **لا يُضاف عليه هامشنا**: هو ما يقبضه الناقل منك لاحقاً
 * عند التغيير، لا شيءٌ نبيعه. إضافة هامش عليه كانت ستجعلنا نعلن رقماً لا
 * يطابق ما ستدفعه فعلاً.
 */

/** الحالات الخمس — تُصدَّر ليقارنها الاختبار بالاسم لا بالنصّ. */
export const CONDITION_STATES = ['unknown', 'no', 'free', 'fee', 'feeUnknown'];

/**
 * يطبّع شرطاً واحداً من صيغة Duffel
 * (`{ allowed, penalty_amount, penalty_currency }`) إلى شكلنا الموحّد.
 * أي شكل غير متوقَّع يسقط إلى «غير معلوم» — لا إلى «ممنوع».
 */
export function normalizeCondition(raw) {
    if (!raw || typeof raw !== 'object') return { state: 'unknown', amount: null, currency: null };
    if (raw.allowed === false) return { state: 'no', amount: null, currency: null };
    if (raw.allowed !== true) return { state: 'unknown', amount: null, currency: null };

    const amount = raw.penalty_amount == null ? null : Number(raw.penalty_amount);
    const currency = raw.penalty_currency || null;
    // ⚠️ الرقم الفاسد (نصّ غير عددي) ليس صفراً — يسقط إلى «رسم غير معلوم»
    if (amount == null || !Number.isFinite(amount)) return { state: 'feeUnknown', amount: null, currency };
    if (amount === 0) return { state: 'free', amount: 0, currency };
    return { state: 'fee', amount, currency };
}

/** يطبّع كائن شروط العرض كاملاً — التغيير والاسترداد قبل المغادرة. */
export function normalizeFareConditions(raw) {
    return {
        change: normalizeCondition(raw?.change_before_departure),
        refund: normalizeCondition(raw?.refund_before_departure),
    };
}

/**
 * ⚠️ **الصياغة ليست هنا.** هذا الملفّ يطبّع فقط؛ ونصوص العرض (وترجمتها)
 * في `public/fare.js` وحده — يستعمله كرتُ نتائج البحث وقسيمة الحجز معاً.
 * الفصل مقصود: التطبيع يخصّ المزوّد، والصياغة تخصّ لغة المستخدم، ولا
 * ينبغي أن توجد نسختان من أيٍّ منهما.
 */
