'use strict';
/**
 * 🎟️ fare.js — صياغة عائلة السعر وشروطه، بلغة المستخدم.
 *
 * منطق نقيّ بلا DOM ولا شبكة (نمط `trips.js` و`i18n.js`) — فيُختبر في
 * Node مباشرةً. يستعمله **مكانان**: كرت نتائج البحث وقسيمة الحجز — نسخةٌ
 * واحدة لا اثنتان، فلا يقول أحدهما «تغيير مجاني» ويقول الآخر غير ذلك عن
 * التذكرة نفسها.
 *
 * التطبيع (تحويل صيغة المزوّد إلى `{state, amount, currency}`) ليس هنا بل
 * في `src/fareConditions.js` على الخادم — التطبيع يخصّ المزوّد والصياغة
 * تخصّ اللغة، ولا ينبغي أن توجد نسختان من أيٍّ منهما.
 *
 * 🔴 الحالات خمسٌ لا اثنتان. الفخّ الذي يوقع فيه أكثر التنفيذات:
 * `allowed: true` مع رسمٍ **غير معلوم** ليست «مجاني» — بل «مسموح والرسم
 * يحدّده الناقل». وغياب المعلومة ليس «ممنوع» بل صمت. راجع تعليق
 * `src/fareConditions.js`.
 *
 * 🧩 النصوص بجدولٍ مُفهرَس بالنوع ثم اللغة ثم الحالة — لا سلسلة شروط:
 * الحالات خمسٌ والأنواع اثنان واللغتان اثنتان، وسلسلة `if` كانت تتضخّم
 * تعقيداً مع كل حالة جديدة.
 */
(function () {
    const money = (amount, currency) => `${amount}${currency ? ` ${currency}` : ''}`;

    // الحالة → نصّها. الدالة تعني «رسمٌ معلوم يُدرَج في الجملة».
    const TEXT = {
        change: {
            ar: {
                no: 'غير قابلة للتغيير',
                free: 'تغيير مجاني',
                fee: amt => `تغيير برسم ${amt}`,
                feeUnknown: 'قابلة للتغيير — الرسم يحدّده الناقل',
            },
            en: {
                no: 'Not changeable',
                free: 'Free changes',
                fee: amt => `Change fee ${amt}`,
                feeUnknown: 'Changeable — fee set by the airline',
            },
        },
        refund: {
            ar: {
                no: 'غير قابلة للاسترداد',
                free: 'استرداد كامل',
                fee: amt => `استرداد برسم ${amt}`,
                feeUnknown: 'قابلة للاسترداد — الرسم يحدّده الناقل',
            },
            en: {
                no: 'Non-refundable',
                free: 'Fully refundable',
                fee: amt => `Refund fee ${amt}`,
                feeUnknown: 'Refundable — fee set by the airline',
            },
        },
    };

    /**
     * نصّ شرطٍ واحد، أو `null` لحالة «غير معلوم»: نسكت عمّا لا نعرف بدل
     * كتابة «غير معلوم» في كل بطاقة فنملأ الشاشة بضجيج بلا قرار.
     */
    function conditionLabel(cond, kind, lang) {
        const entry = TEXT[kind]?.[lang === 'en' ? 'en' : 'ar']?.[cond?.state];
        if (entry === undefined) return null; // يشمل unknown وأي حالة طارئة
        return typeof entry === 'function' ? entry(money(cond.amount, cond.currency)) : entry;
    }

    /**
     * اسم عائلة السعر. Duffel يضعه على **الشريحة** لا على العرض، وقد
     * تختلف الشرائح — فيُعرض حين تتفق كلّها فقط. اسمٌ واحد منسوبٌ لرحلةٍ
     * عائلتُها مختلفة في العودة تضليلٌ لا اختصار.
     */
    function fareBrandOf(offer) {
        const slices = offer?.slices ?? [];
        const brands = slices.map(slice => slice?.fareBrand).filter(Boolean);
        if (brands.length === 0 || brands.length !== slices.length) return null;
        return brands.every(brand => brand === brands[0]) ? brands[0] : null;
    }

    /** أجزاء سطر الشروط (عائلة السعر ثم التغيير ثم الاسترداد) — قد تكون فارغة. */
    function fareParts(offer, lang) {
        const conditions = offer?.conditions ?? {};
        return [
            fareBrandOf(offer),
            conditionLabel(conditions.change, 'change', lang),
            conditionLabel(conditions.refund, 'refund', lang),
        ].filter(Boolean);
    }

    /** السطر الجاهز، أو '' إن لا معلومة تستحق سطراً. */
    const fareSummary = (offer, lang) => fareParts(offer, lang).join(' · ');

    window.JAOLA_FARE = { conditionLabel, fareBrandOf, fareParts, fareSummary };
})();
