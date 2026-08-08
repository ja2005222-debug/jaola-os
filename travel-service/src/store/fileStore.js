/**
 * 📁 fileStore.js — مخزن ملفات JSON (تطوير واختبار — صفر إعداد)
 *
 * نفس دور نظيره في خدمة الفيديو: يحقق عقد store/index.js بالتطابق مع
 * postgresStore حتى تعمل المجموعة الاختبارية الكاملة ضد الاثنين.
 * ⚠️ على استضافة ذات قرص مؤقت تُمسح الحجوزات مع كل إعادة نشر — للإنتاج
 * DATABASE_URL إلزامي (الخادم يحذّر صاخباً عند الإقلاع بالملفات).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function createFileStore({ dataDir }) {
    const bookingsPath = path.join(dataDir, 'bookings.json');

    function ensureDir() {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    function readBookings() {
        try {
            return JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        } catch {
            return [];
        }
    }
    function writeBookings(bookings) {
        ensureDir();
        // كتابة ذرّية عبر ملف مؤقت — انقطاع منتصف الكتابة لا يُفسد السجل
        const tmp = bookingsPath + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(bookings, null, 2));
        fs.renameSync(tmp, bookingsPath);
    }

    return {
        name: 'file',

        async init() { ensureDir(); },
        async close() {},

        async createBooking(b) {
            const bookings = readBookings();
            const booking = {
                id: 'trv_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                updatedAt: Date.now(),
                providerOrderId: null,
                bookingReference: null,
                error: null,
                refund: null,
                ...b,
            };
            bookings.push(booking);
            writeBookings(bookings);
            return { ...booking };
        },

        async getBooking(id) {
            const booking = readBookings().find(b => b.id === id);
            return booking ? { ...booking } : null;
        },

        async listBookingsByUser(username, limit = 50) {
            return readBookings()
                .filter(b => b.username === username)
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(b => ({ ...b }));
        },

        async transitionBooking(id, { from, to, patch = {} }) {
            const bookings = readBookings();
            const booking = bookings.find(b => b.id === id);
            if (!booking || !from.includes(booking.status)) return null;
            Object.assign(booking, patch, { status: to, updatedAt: Date.now() });
            writeBookings(bookings);
            return { ...booking };
        },
    };
}
