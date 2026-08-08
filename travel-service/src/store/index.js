/**
 * 🗄️ store/index.js — اختيار المخزن (نقطة التبديل الوحيدة)
 *
 * عقد المخزن (يحققه fileStore وpostgresStore بالتطابق):
 *   init() / close()
 *   createBooking(b) → booking            (يولّد id/at/updatedAt)
 *   getBooking(id) → booking|null
 *   listBookingsByUser(user, limit) → [booking]   (الأحدث أولاً)
 *   transitionBooking(id, {from:[حالات], to, patch}) → booking|null  (ذرّي)
 *
 * الاختيار: DATABASE_URL مضبوط → postgres (دائم، للإنتاج)، وإلا → ملفات
 * (صفر إعداد، للتطوير والاختبار) — نفس قاعدة خدمة الفيديو حرفياً.
 */
import { createFileStore } from './fileStore.js';
import { createPostgresStore } from './postgresStore.js';

export function buildStore({ databaseUrl, dataDir } = {}) {
    if (databaseUrl) {
        return createPostgresStore({ connectionString: databaseUrl });
    }
    if (!dataDir) throw new Error('dataDir مطلوب حين لا يُضبط DATABASE_URL.');
    return createFileStore({ dataDir });
}
