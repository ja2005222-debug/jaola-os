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
    const notificationsPath = path.join(dataDir, 'notifications.json');
    const prefsPath = path.join(dataDir, 'notificationPrefs.json');
    const profilesPath = path.join(dataDir, 'profiles.json');
    const contractsPath = path.join(dataDir, 'hotelContracts.json');
    const allocationsPath = path.join(dataDir, 'contractAllocations.json');

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
    const readNotifications = () => readJson(notificationsPath);
    const writeNotifications = rows => writeJson(notificationsPath, rows);
    const readPrefs = () => readJson(prefsPath);
    const writePrefs = rows => writeJson(prefsPath, rows);
    const readProfiles = () => readJson(profilesPath);
    const writeProfiles = rows => writeJson(profilesPath, rows);
    const readContracts = () => readJson(contractsPath);
    const writeContracts = rows => writeJson(contractsPath, rows);
    const readAllocations = () => readJson(allocationsPath);
    const writeAllocations = rows => writeJson(allocationsPath, rows);

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
                packageId: null,
                compensation: null,
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

        async getBookingByProviderOrderId(providerOrderId) {
            const booking = readBookings().find(b => b.providerOrderId === providerOrderId);
            return booking ? { ...booking } : null;
        },

        async listBookingsByUser(username, limit = 50) {
            return readBookings()
                .filter(b => b.username === username)
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(b => ({ ...b }));
        },

        // للمُطلِق الزمني: يفحص كل المُصدَرة ويصفّي في الذاكرة. موعد
        // الإقلاع داخل offer_json فاستعلامه في Postgres هشّ، والحجم هنا
        // يجعل التصفية في الذاكرة كافية — يُعاد النظر عند نموّ فعلي.
        async listIssuedBookings(limit = 500) {
            return readBookings()
                .filter(b => b.status === 'issued')
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(b => ({ ...b }));
        },

        // علامة «أُرسل التذكير» — خارج آلة الحالات عمداً: ليست انتقال
        // حالة حجز بل أثرٌ جانبي، وإقحامها في transitionBooking كان
        // سيتطلّب انتقالاً وهمياً.
        async markTripReminderSent(id, at = Date.now()) {
            const bookings = readBookings();
            const booking = bookings.find(b => b.id === id);
            if (!booking) return null;
            booking.reminderSentAt = at;
            writeBookings(bookings);
            return { ...booking };
        },

        async transitionBooking(id, { from, to, patch = {} }) {
            const bookings = readBookings();
            const booking = bookings.find(b => b.id === id);
            if (!booking || !from.includes(booking.status)) return null;
            Object.assign(booking, patch, { status: to, updatedAt: Date.now() });
            writeBookings(bookings);
            return { ...booking };
        },

        async listAllBookings(limit = 500) {
            return readBookings()
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(b => ({ ...b }));
        },

        async listCompensationPending(limit = 20) {
            return readBookings()
                .filter(b => b.kind === 'package' && b.status === 'failed'
                    && Array.isArray(b.compensation?.pending) && b.compensation.pending.length > 0)
                .sort((a, b) => a.at - b.at)
                .slice(0, limit)
                .map(b => ({ ...b }));
        },

        // ─── 🤝 العقود الفندقية (نفس عقد postgresStore بالتطابق) ────────

        async createContract(cData) {
            const contracts = readContracts();
            const contract = {
                id: 'hc_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                updatedAt: Date.now(),
                hotelName: cData.hotelName,
                city: cData.city || null,
                iata: cData.iata,
                netPerNight: cData.netPerNight,
                currency: cData.currency,
                allotment: cData.allotment,
                usedRooms: 0,
                startDate: cData.startDate,
                endDate: cData.endDate,
                blackoutDates: cData.blackoutDates || [],
                active: cData.active !== false,
            };
            contracts.push(contract);
            writeContracts(contracts);
            return { ...contract };
        },

        async getContract(id) {
            const contract = readContracts().find(c => c.id === id);
            return contract ? { ...contract } : null;
        },

        async listContracts() {
            return readContracts().sort((a, b) => b.at - a.at).map(c => ({ ...c }));
        },

        async updateContract(id, patch = {}) {
            const contracts = readContracts();
            const contract = contracts.find(c => c.id === id);
            if (!contract) return null;
            const allowed = ['hotelName', 'city', 'iata', 'netPerNight', 'currency',
                'allotment', 'startDate', 'endDate', 'blackoutDates', 'active'];
            for (const key of allowed) {
                if (key in patch) contract[key] = patch[key];
            }
            contract.updatedAt = Date.now();
            writeContracts(contracts);
            return { ...contract };
        },

        async deleteContract(id) {
            const contracts = readContracts();
            const next = contracts.filter(c => c.id !== id);
            if (next.length === contracts.length) return false;
            writeContracts(next);
            return true;
        },

        // ⚠️ الذرّية هنا من أحادية خيط JS: الفحص والزيادة والكتابة كتلة
        // متزامنة **بلا أي await بينها** — فلا يتداخل طلبان. أي await
        // يُقحَم وسطها مستقبلاً يكسر الضمان (postgresStore يضمنها بشرط
        // داخل UPDATE واحد).
        async createContractAllocation(contractId, { rooms, netAmount, currency, checkIn = null, checkOut = null }) {
            const contracts = readContracts();
            const contract = contracts.find(c => c.id === contractId);
            if (!contract || contract.active === false) return null;
            if ((contract.usedRooms || 0) + rooms > contract.allotment) return null;
            contract.usedRooms = (contract.usedRooms || 0) + rooms;
            contract.updatedAt = Date.now();
            const allocations = readAllocations();
            const allocation = {
                id: 'ctro_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                contractId, rooms, netAmount, currency, checkIn, checkOut,
                status: 'active',
            };
            allocations.push(allocation);
            writeContracts(contracts);
            writeAllocations(allocations);
            return { ...allocation };
        },

        async getContractAllocation(id) {
            const allocation = readAllocations().find(a => a.id === id);
            return allocation ? { ...allocation } : null;
        },

        async releaseContractAllocation(id) {
            const allocations = readAllocations();
            const allocation = allocations.find(a => a.id === id);
            if (!allocation || allocation.status !== 'active') return null;
            allocation.status = 'released';
            const contracts = readContracts();
            const contract = contracts.find(c => c.id === allocation.contractId);
            if (contract) {
                contract.usedRooms = Math.max(0, (contract.usedRooms || 0) - allocation.rooms);
                contract.updatedAt = Date.now();
                writeContracts(contracts);
            }
            writeAllocations(allocations);
            return { ...allocation };
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

        async createNotification(n) {
            const rows = readNotifications();
            const notification = {
                id: 'ntf_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                read: false,
                meta: {},
                ...n,
            };
            rows.push(notification);
            writeNotifications(rows);
            return { ...notification };
        },

        async listNotificationsByUser(username, limit = 50) {
            return readNotifications()
                .filter(n => n.username === username)
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(n => ({ ...n }));
        },

        async countUnreadNotifications(username) {
            return readNotifications().filter(n => n.username === username && !n.read).length;
        },

        // اسم المستخدم شرطٌ في التحديث لا فحصٌ سابق له: بلا هذا يستطيع
        // مستخدم تعليم تنبيه غيره مقروءاً بمعرّف مُخمَّن (نفس عزل الملكية
        // في transitionBooking).
        async markNotificationRead(id, username) {
            const rows = readNotifications();
            const row = rows.find(n => n.id === id && n.username === username);
            if (!row) return null;
            row.read = true;
            writeNotifications(rows);
            return { ...row };
        },

        async markAllNotificationsRead(username) {
            const rows = readNotifications();
            let count = 0;
            for (const n of rows) {
                if (n.username === username && !n.read) { n.read = true; count += 1; }
            }
            if (count > 0) writeNotifications(rows);
            return count;
        },

        // ملف واحد لكل مستخدم (تفضيلات + مسافرون + آخر محادثة): الكتابة
        // ذرّية على الملف كله فلا تتعارض حقول، والحذف الكامل صفٌّ واحد
        // يُزال — لا بقايا موزّعة على جداول.
        async getProfile(username) {
            const row = readProfiles().find(p => p.username === username);
            return row ? row.profile : null;
        },

        async setProfile(username, profile) {
            const rows = readProfiles();
            const row = rows.find(p => p.username === username);
            if (row) row.profile = profile;
            else rows.push({ username, profile });
            writeProfiles(rows);
            return profile;
        },

        async deleteProfile(username) {
            const rows = readProfiles();
            const next = rows.filter(p => p.username !== username);
            if (next.length === rows.length) return false;
            writeProfiles(next);
            return true;
        },

        async getNotificationPrefs(username) {
            const row = readPrefs().find(p => p.username === username);
            return row ? row.prefs : null; // null = لم يضبط شيئاً → الافتراضات
        },

        async setNotificationPrefs(username, prefs) {
            const rows = readPrefs();
            const row = rows.find(p => p.username === username);
            if (row) row.prefs = prefs;
            else rows.push({ username, prefs });
            writePrefs(rows);
            return prefs;
        },
    };
}
