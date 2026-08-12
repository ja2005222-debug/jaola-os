/**
 * 🎫 bookings.js — آلة حالات الحجز (نفس فلسفة jobs.js في خدمة الفيديو)
 *
 * pending → issued | failed        (نتيجة نداء المزوّد وقت الحجز)
 * issued  → cancelled              (إلغاء بمبادرة المسافر)
 * failed / cancelled               (نهائيتان — لا إحياء)
 *
 * كل الانتقالات تمر عبر transitionBooking الذرّي في المخزن — لا كتابة
 * حالة مباشرة في أي مكان آخر، فلا تعارض بين طلبين متزامنين.
 */

export const BOOKING_STATUSES = ['pending', 'issued', 'failed', 'cancelled'];

const ALLOWED = {
    pending: ['issued', 'failed'],
    issued: ['cancelled'],
    failed: [],
    cancelled: [],
};

export function canTransition(from, to) {
    return (ALLOWED[from] || []).includes(to);
}

export async function createBooking(store, { username, provider, offer, passengers, contact, netAmount, sellAmount, currency, kind = 'flight', packageId = null }) {
    return store.createBooking({
        username: String(username || '').trim().toLowerCase(),
        provider, offer, passengers, contact,
        netAmount, sellAmount, currency, kind, packageId,
        status: 'pending',
    });
}

export async function getBooking(store, id) {
    return store.getBooking(id);
}

export async function getBookingByProviderOrderId(store, providerOrderId) {
    return store.getBookingByProviderOrderId(String(providerOrderId || ''));
}

export async function listBookingsByUser(store, username, limit = 50) {
    return store.listBookingsByUser(String(username || '').trim().toLowerCase(), limit);
}

/** انتقال ذرّي محكوم بالجدول أعلاه — يُرجع null لانتقال ممنوع أو حجز مفقود. */
export async function transitionBooking(store, id, to, patch = {}) {
    const from = Object.keys(ALLOWED).filter(s => canTransition(s, to));
    if (from.length === 0) return null;
    return store.transitionBooking(id, { from, to, patch });
}
