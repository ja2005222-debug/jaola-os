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
 */
(function (global) {
    'use strict';

    const money = (amount, currency) => `${amount}${currency ? ' ' + currency : ''}`;

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
        const state = cond && cond.state;
        if (!state || state === 'unknown') return null;
        const table = TEXT[kind] && TEXT[kind][lang === 'en' ? 'en' : 'ar'];
        if (!table) return null;
        const entry = table[state];
        if (entry === undefined) return null;
        return typeof entry === 'function' ? entry(money(cond.amount, cond.currency)) : entry;
    }

    /**
     * اسم عائلة السعر. Duffel يضعه على **الشريحة** لا على العرض، وقد
     * تختلف الشرائح — فيُعرض حين تتفق كلّها فقط. اسمٌ واحد منسوبٌ لرحلةٍ
     * عائلتُها مختلفة في العودة تضليلٌ لا اختصار.
     */
    function fareBrandOf(offer) {
        const slices = (offer && offer.slices) || [];
        const brands = slices.map(s => s && s.fareBrand).filter(Boolean);
        if (brands.length === 0 || brands.length !== slices.length) return null;
        return brands.every(b => b === brands[0]) ? brands[0] : null;
    }

    /** أجزاء سطر الشروط (عائلة السعر ثم التغيير ثم الاسترداد) — قد تكون فارغة. */
    function fareParts(offer, lang) {
        const out = [];
        const brand = fareBrandOf(offer);
        if (brand) out.push(brand);
        const conditions = (offer && offer.conditions) || {};
        const change = conditionLabel(conditions.change, 'change', lang);
        const refund = conditionLabel(conditions.refund, 'refund', lang);
        if (change) out.push(change);
        if (refund) out.push(refund);
        return out;
    }

    /** السطر الجاهز، أو '' إن لا معلومة تستحق سطراً. */
    function fareSummary(offer, lang) {
        return fareParts(offer, lang).join(' · ');
    }

    global.JAOLA_FARE = { conditionLabel, fareBrandOf, fareParts, fareSummary };
}(typeof window !== 'undefined' ? window : globalThis));
