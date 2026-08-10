/**
 * ⏰ tripReminders.js — تذكير ما قبل السفر
 *
 * الفئة `trip_reminder` كانت موجودة في نظام التنبيهات بلا شيء يُطلقها:
 * لا حدث يصل من مزوّد، ولا شيء في البوابة يعرف أن الغد موعد رحلة. هذا
 * الملف هو المُطلِق المفقود.
 *
 * ⚠️ الاعتماد الأخطر هنا هو **عدم التكرار**: المُطلِق الزمني يفتح كل
 * ساعة، فتذكيرٌ بلا علامة «أُرسل» يصير ٣٦ رسالة عن رحلة واحدة. العلامة
 * تُكتب على الحجز نفسه لا على سجل التنبيهات، لأن المستخدم قد يُطفئ سجل
 * هذه الفئة (ليست alwaysInApp) فيختفي الأثر ويُعاد الإرسال كل دورة —
 * فخٌّ حقيقي تفاداه هذا الاختيار.
 *
 * 🛡️ ولا يحجز ولا يلغي ولا يدفع: يخبر فقط، كبقية مسار الأحداث.
 */
import { airportCoords } from './airports.js';
import { getDestinationWeather } from './travelInfo.js';

// نافذة التذكير: قبل الإقلاع بما بين ٦ و٣٦ ساعة. الحدّ الأعلى يجعل
// التذكير في متناول اليد (حقائب، تسجيل دخول)، والأدنى يمنع تذكيراً يصل
// والمسافر في الطريق للمطار أصلاً.
export const REMIND_MIN_HOURS = 6;
export const REMIND_MAX_HOURS = 36;
const MAX_PER_RUN = 50; // سقف أمان: خللٌ ما لا يتحوّل إلى فيض رسائل

/** موعد إقلاع أول شريحة — الأساس الذي تُقاس عليه النافذة. */
export function departureAt(booking) {
    const at = booking?.offer?.slices?.[0]?.departAt;
    if (!at) return null;
    const t = Date.parse(at.endsWith('Z') || at.includes('+') ? at : at + 'Z');
    return Number.isFinite(t) ? t : null;
}

/**
 * هل يستحق هذا الحجز تذكيراً الآن؟
 * رحلات فقط (الفنادق والسيارات مواعيدها أقل حساسية لدقيقة الوصول)،
 * مُصدَرة، لم تُذكَّر سابقاً، وموعدها داخل النافذة.
 */
export function isReminderDue(booking, now = Date.now()) {
    if (!booking || booking.status !== 'issued') return false;
    if ((booking.kind || 'flight') !== 'flight') return false;
    if (booking.reminderSentAt) return false;
    const depart = departureAt(booking);
    if (depart === null) return false;
    const hoursAway = (depart - now) / 3600000;
    return hoursAway >= REMIND_MIN_HOURS && hoursAway <= REMIND_MAX_HOURS;
}

/** يصوغ نص التذكير من بيانات الحجز — كل سطر من حقيقة مخزَّنة. */
export function renderTripReminder({ booking, weatherLine = null }) {
    const slices = booking.offer?.slices || [];
    const outbound = slices[0] || {};
    const depart = (outbound.departAt || '').slice(0, 16).replace('T', ' ');
    const lines = [
        `رحلتك بعد أقل من يومين — ${outbound.origin || '؟'} ← ${outbound.destination || '؟'}.`,
        '',
        `📅 الإقلاع: ${depart}`,
        `🎫 المرجع: ${booking.bookingReference || '—'}`,
    ];
    if (slices.length > 1) {
        const back = slices[slices.length - 1];
        lines.push(`↩️ العودة: ${(back.departAt || '').slice(0, 16).replace('T', ' ')}`);
    }
    if (weatherLine) lines.push('', weatherLine);
    lines.push('', 'تأكّد من صلاحية جواز السفر وسياسة الأمتعة، وسجّل دخولك مع شركة الطيران في وقتها.');
    return lines.join('\n');
}

/** سطر طقس الوجهة يوم الوصول — يُحذف كلياً عند أي تعذّر، ولا يُختلق. */
async function weatherLineFor(booking, fetchImpl) {
    try {
        const slices = booking.offer?.slices || [];
        const dest = slices[0]?.destination;
        const day = (slices[0]?.arriveAt || slices[0]?.departAt || '').slice(0, 10);
        const coords = airportCoords(dest);
        if (!coords || !day) return null;
        // getDestinationWeather تعيد **مصفوفة أيام** بحقول maxTempC/minTempC
        const days = await getDestinationWeather({
            lat: coords.lat, lon: coords.lon, dateFrom: day, dateTo: day, fetchImpl,
        });
        const d = Array.isArray(days) ? days[0] : null;
        if (!d || d.maxTempC == null || d.minTempC == null) return null;
        const rain = d.precipitationMm > 1 ? ` وأمطار متوقّعة (${d.precipitationMm} مم)` : '';
        return `🌤️ طقس ${coords.city} يوم وصولك: من ${d.minTempC}° إلى ${d.maxTempC}°${rain}.`;
    } catch {
        return null; // إثراء لا شرط
    }
}

/**
 * يفحص كل الحجوزات المُصدَرة ويرسل ما استحقّ تذكيراً. لا يرمي أبداً:
 * فشل تذكير واحد لا يوقف البقية (نفس عقد checkWatches).
 */
export async function sendTripReminders({ store, notifier, now = Date.now(), fetchImpl = fetch }) {
    const bookings = await store.listIssuedBookings(500);
    const due = bookings.filter(b => isReminderDue(b, now)).slice(0, MAX_PER_RUN);
    let sent = 0;
    const errors = [];

    for (const booking of due) {
        try {
            const weatherLine = await weatherLineFor(booking, fetchImpl);
            const result = await notifier.deliver({
                username: booking.username,
                category: 'trip_reminder',
                title: `⏰ تذكير برحلتك — مرجع ${booking.bookingReference || ''}`.trim(),
                body: renderTripReminder({ booking, weatherLine }),
                email: booking.contact?.email || null,
                meta: { bookingId: booking.id },
            });
            // ⚠️ تُوضع العلامة حتى عند skipped (المستخدم أطفأ الفئة): وإلا
            // أُعيد الفحص والنداء كل دورة إلى الأبد لتذكير لن يُرسَل.
            // أما فشل التسليم فعلياً فيُبقيها بلا علامة لتُعاد المحاولة.
            if (result.inApp || result.email || result.skipped) {
                await store.markTripReminderSent(booking.id, now);
                if (result.inApp || result.email) sent += 1;
            }
        } catch (e) {
            errors.push({ bookingId: booking.id, error: e.message });
        }
    }
    return { checked: bookings.length, due: due.length, sent, errors };
}
