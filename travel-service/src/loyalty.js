/**
 * 🎁 loyalty.js — برنامج الولاء (نظير Genius/Kiwi.com Club عند الكبار)
 *
 * التصميم عمداً **مشتق بلا تخزين جديد**: النقاط والمستوى يُحسبان من سجل
 * الحجوزات نفسه في كل طلب — لا عدّاد منفصل يتباعد عن الحقيقة، ولا جدول
 * يحتاج هجرة، وإلغاء حجز يُصحّح الرصيد تلقائياً لأن المصدر واحد.
 *
 * النقاط من **المدفوع فعلاً** لا قيمة العقد: حجز باقة بعربون يُكسب نقاط
 * العربون المدفوع (لا الإجمالي الموعود)، وبقية الأنواع sellAmount لأنها
 * تُدفع كاملة عند الإصدار. الملغى لا يُحتسب (استُرد ماله)، وأبناء الباقات
 * الحية sellAmount=null فيسقطون تلقائياً (الهامش والدفع على الأب).
 *
 * ⚠️ الجمع عبر عملات مختلفة تقريبي بطبيعته (نفس تنبيه الإيراد في لوحة
 * الأدمن) — الرد يحمل `currencies` و`mixedCurrencies` فتقول الواجهة
 * الحقيقة بدل رقم يوحي بدقة زائفة.
 *
 * **الاستبدال مؤجَّل عمداً لمرحلة الدفع**: خصمٌ آلي الآن قرار مالي يخص
 * المالك ولا بوابة دفع تسنده — النقاط تتراكم من اليوم، وقيمتها تُفعَّل
 * مع Stripe (مذكور في خارطة CLAUDE.md).
 */

export const LOYALTY_TIERS = [
    { id: 'member', label: 'مسافر', icon: '🧳', minPoints: 0, perk: 'تتبّع نقاطك من أول حجز' },
    { id: 'silver', label: 'فضي', icon: '🥈', minPoints: 5000, perk: 'أولوية الرد على طلبات العروض الخاصة' },
    { id: 'gold', label: 'ذهبي', icon: '🥇', minPoints: 15000, perk: 'أولوية قوائم الانتظار + عروض مبكّرة' },
];

/** نقاط حجز واحد — صفر لغير المُصدَر أو لابن باقة بلا sellAmount. */
export function bookingPoints(b) {
    if (b.status !== 'issued') return 0;
    const paid = b.paymentPlan?.paidNow ?? b.sellAmount ?? 0;
    return Number.isFinite(paid) && paid > 0 ? Math.floor(paid) : 0;
}

/** يحسب ولاء مستخدم من قائمة حجوزاته — دالة نقية قابلة للاختبار مباشرة. */
export function computeLoyalty(bookings = []) {
    let points = 0;
    let trips = 0;
    const currencies = new Set();
    for (const b of bookings) {
        const p = bookingPoints(b);
        if (p <= 0) continue;
        points += p;
        trips += 1;
        if (b.currency) currencies.add(b.currency);
    }
    let tier = LOYALTY_TIERS[0];
    for (const t of LOYALTY_TIERS) if (points >= t.minPoints) tier = t;
    const nextIdx = LOYALTY_TIERS.indexOf(tier) + 1;
    const nextTier = LOYALTY_TIERS[nextIdx] || null;
    return {
        points,
        trips,
        tier: { id: tier.id, label: tier.label, icon: tier.icon, perk: tier.perk },
        nextTier: nextTier ? { id: nextTier.id, label: nextTier.label, icon: nextTier.icon, pointsNeeded: nextTier.minPoints - points } : null,
        // نسبة التقدم نحو المستوى التالي — 100 عند القمة
        progressPct: nextTier
            ? Math.min(100, Math.round(((points - tier.minPoints) / (nextTier.minPoints - tier.minPoints)) * 100))
            : 100,
        currencies: [...currencies],
        mixedCurrencies: currencies.size > 1,
        redeemNote: 'النقاط تتراكم من اليوم — استبدالها بخصومات يُفعَّل مع إطلاق الدفع الإلكتروني.',
    };
}
