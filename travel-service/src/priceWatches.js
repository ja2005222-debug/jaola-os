/**
 * 👁️ priceWatches.js — منطق مراقبة الأسعار (نفس فلسفة bookings.js)
 *
 * فصل منطق العمل (ملكية/حالة) عن مخزن الحقائب — الفحص الدوري الفعلي في
 * priceWatchPoller.js، وهذا الملف يخدم مسارات/أدوات الايجنت المباشرة
 * (إنشاء/عرض/إلغاء).
 */

export async function createPriceWatch(store, { username, origin, destination, departDate, returnDate, cabin, targetPrice, contactEmail }) {
    return store.createPriceWatch({
        username: String(username || '').trim().toLowerCase(),
        origin, destination, departDate, returnDate: returnDate || null, cabin,
        targetPrice: targetPrice != null ? Number(targetPrice) : null,
        contactEmail: contactEmail || null,
        status: 'active',
    });
}

export async function listPriceWatchesByUser(store, username) {
    return store.listPriceWatchesByUser(String(username || '').trim().toLowerCase());
}

/** إلغاء مملوك فقط — مراقبة مستخدم آخر تُعامل كغير موجودة. يعيد null إن تعذّر. */
export async function cancelPriceWatch(store, id, username) {
    const watch = await store.getPriceWatch(String(id || ''));
    if (!watch || watch.username !== String(username || '').trim().toLowerCase() || watch.status !== 'active') {
        return null;
    }
    return store.updatePriceWatch(watch.id, { status: 'cancelled' });
}
