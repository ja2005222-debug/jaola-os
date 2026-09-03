/**
 * 💳 balanceReminders.js — تذكير سداد متبقي العربون (باقات مجدولة)
 *
 * نموذج العربون ميزتنا الفريدة (لا تقدمه OTAs الكبرى أصلاً) — هذه الوحدة
 * تجعله كامل التشغيل الذاتي: حجز بعربون ومتبقٍّ مستحق قبل `dueDate`
 * (الإقلاع − 14 يوماً = موعد تسليم الأسماء) يُذكَّر صاحبه آلياً قبل
 * الاستحقاق بأيام — فلا مقعد يضيع لأن مسافراً نسي، ولا مكالمات مطاردة
 * يدوية على المالك.
 *
 * مرة واحدة لكل حجز (علامة `balanceReminderSentAt` بنفس نمط
 * `reminderSentAt` في تذكيرات السفر): تُكتب بانتقال «من نفس الحالة إلى
 * نفسها» الذرّي — ليست انتقال حالة بل أثر جانبي (نفس فلسفة
 * markTripReminderSent وتحديث علامة التعويض في packages.js).
 *
 * يستدعيها المُطلِق الزمني ضمن `POST /api/travel/cron/run` — فشلها معزول
 * لا يمنع بقية المهام (نفس عقد بقية مهام الدورة).
 */

export const BALANCE_REMINDER_DAYS_AHEAD = 5; // ذكّر حين يبقى ≤ 5 أيام على الاستحقاق

function todayUtcStr() {
    return new Date().toISOString().slice(0, 10);
}
function daysUntil(dateStr, today = todayUtcStr()) {
    return Math.round((new Date(dateStr + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);
}

/** هل يستحق هذا الحجز تذكير سداد الآن؟ (نقية — قابلة للاختبار مباشرة) */
export function isBalanceReminderDue(booking, today = todayUtcStr()) {
    if (booking.kind !== 'fixed_package' || booking.status !== 'issued') return false;
    const plan = booking.paymentPlan;
    if (!plan || !(plan.remaining > 0) || !plan.dueDate) return false;
    if (booking.balanceReminderSentAt) return false; // ذُكِّر سلفاً
    const days = daysUntil(plan.dueDate, today);
    // داخل نافذة التذكير، ولم يفت الاستحقاق بأكثر من يوم (فائتٌ قديم
    // يُدار يدوياً — تذكير آلي متأخر جداً إحراج لا خدمة)
    return days <= BALANCE_REMINDER_DAYS_AHEAD && days >= -1;
}

export function renderBalanceReminder(booking) {
    const plan = booking.paymentPlan;
    const title = `💳 تذكير: متبقي باقتك مستحق قبل ${plan.dueDate}`;
    const body =
        `حجزك «${booking.offer?.title || 'باقة مجدولة'}» (مرجع ${booking.bookingReference}) ` +
        `مثبَّت بعربون ${plan.paidNow} ${booking.currency}.\n\n` +
        `المتبقي: ${plan.remaining} ${booking.currency} — يُسدَّد قبل ${plan.dueDate} ` +
        `(نفس موعد تسليم أسماء المسافرين، قبل الانطلاق بأسبوعين).\n\n` +
        `الانطلاق: ${booking.offer?.departDate || '؟'} — 🏨 ${booking.offer?.hotelName || ''}.\n` +
        `عدم السداد في الموعد قد يعرّض مقاعدك للإلغاء وفق الشروط.`;
    return { title, body };
}

/**
 * دورة التذكير: تلتقط حجوزات العربون المستحقة وتُرسل وتُعلّم. فشل حجز
 * واحد (إشعار أو علامة) لا يوقف البقية.
 */
export async function sendBalanceReminders({ store, notifier, today = todayUtcStr(), limit = 500 }) {
    const issued = await store.listIssuedBookings(limit);
    let sent = 0;
    const errors = [];
    for (const booking of issued) {
        if (!isBalanceReminderDue(booking, today)) continue;
        try {
            const { title, body } = renderBalanceReminder(booking);
            await notifier.deliver({
                username: booking.username,
                category: 'trip_reminder',
                title, body,
                email: booking.contact?.email || null,
                whatsappParams: [
                    booking.offer?.title || 'باقة مجدولة',
                    `${booking.paymentPlan.remaining} ${booking.currency}`,
                    booking.paymentPlan.dueDate,
                ],
                meta: { bookingId: booking.id, kind: 'balance_reminder' },
            });
            // علامة «ذُكِّر» — انتقال نفس-الحالة الذرّي، لا انتقال حالة حقيقي
            await store.transitionBooking(booking.id, {
                from: [booking.status], to: booking.status,
                patch: { balanceReminderSentAt: Date.now() },
            });
            sent += 1;
        } catch (e) {
            errors.push({ bookingId: booking.id, error: e.message });
        }
    }
    return { checked: issued.length, sent, errors };
}
