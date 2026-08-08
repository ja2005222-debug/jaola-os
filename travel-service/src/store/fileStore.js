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
    const watchesPath = path.join(dataDir, 'priceWatches.json');

    function ensureDir() {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    function readJson(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
            return [];
        }
    }
    function writeJson(filePath, rows) {
        ensureDir();
        // كتابة ذرّية عبر ملف مؤقت — انقطاع منتصف الكتابة لا يُفسد السجل
        const tmp = filePath + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
        fs.renameSync(tmp, filePath);
    }
    const readBookings = () => readJson(bookingsPath);
    const writeBookings = rows => writeJson(bookingsPath, rows);
    const readWatches = () => readJson(watchesPath);
    const writeWatches = rows => writeJson(watchesPath, rows);

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

        async createPriceWatch(w) {
            const watches = readWatches();
            const watch = {
                id: 'pw_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                updatedAt: Date.now(),
                lastPrice: null,
                currency: null,
                ...w,
            };
            watches.push(watch);
            writeWatches(watches);
            return { ...watch };
        },

        async getPriceWatch(id) {
            const watch = readWatches().find(w => w.id === id);
            return watch ? { ...watch } : null;
        },

        async listPriceWatchesByUser(username, limit = 50) {
            return readWatches()
                .filter(w => w.username === username)
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(w => ({ ...w }));
        },

        async listActivePriceWatches() {
            return readWatches().filter(w => w.status === 'active').map(w => ({ ...w }));
        },

        async updatePriceWatch(id, patch = {}) {
            const watches = readWatches();
            const watch = watches.find(w => w.id === id);
            if (!watch) return null;
            Object.assign(watch, patch, { updatedAt: Date.now() });
            writeWatches(watches);
            return { ...watch };
        },
    };
}
