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
    const fixedPackagesPath = path.join(dataDir, 'fixedPackages.json');
    const interestsPath = path.join(dataDir, 'packageInterests.json');
    const reviewsPath = path.join(dataDir, 'packageReviews.json');
    const wishlistPath = path.join(dataDir, 'wishlist.json');

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
    const readFixedPackages = () => readJson(fixedPackagesPath);
    const writeFixedPackages = rows => writeJson(fixedPackagesPath, rows);
    const readInterests = () => readJson(interestsPath);
    const writeInterests = rows => writeJson(interestsPath, rows);
    const readReviews = () => readJson(reviewsPath);
    const writeReviews = rows => writeJson(reviewsPath, rows);
    const readWishlist = () => readJson(wishlistPath);
    const writeWishlist = rows => writeJson(wishlistPath, rows);

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
                marginPct: cData.marginPct ?? null,
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
                'allotment', 'startDate', 'endDate', 'blackoutDates', 'active', 'marginPct'];
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

        // ─── 🎒 الباقات المجدولة (نفس عقد postgresStore بالتطابق) ───────

        async createFixedPackage(pData) {
            const rows = readFixedPackages();
            const pkg = {
                id: 'fxp_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                updatedAt: Date.now(),
                seatsSold: 0,
                ...pData,
            };
            rows.push(pkg);
            writeFixedPackages(rows);
            return { ...pkg };
        },

        async getFixedPackage(id) {
            const pkg = readFixedPackages().find(p => p.id === id);
            return pkg ? { ...pkg } : null;
        },

        async listFixedPackages() {
            return readFixedPackages()
                .sort((a, b) => String(a.departDate).localeCompare(String(b.departDate)))
                .map(p => ({ ...p }));
        },

        async updateFixedPackage(id, patch = {}) {
            const rows = readFixedPackages();
            const pkg = rows.find(p => p.id === id);
            if (!pkg) return null;
            const allowed = ['title', 'city', 'iata', 'hotelName', 'board', 'description',
                'departDate', 'nights', 'seatCapacity', 'sourcing', 'releaseDate',
                'currency', 'netPerSeat', 'pricePerSeat', 'singleSupplement', 'childPrice',
                'ebPct', 'ebUntil', 'depositPct', 'active'];
            for (const key of allowed) {
                if (key in patch) pkg[key] = patch[key];
            }
            // السعة لا تهبط دون المباع — تقليصها تحت الحجوزات القائمة بيعٌ زائد بأثر رجعي
            if (pkg.seatCapacity < (pkg.seatsSold || 0)) pkg.seatCapacity = pkg.seatsSold;
            pkg.updatedAt = Date.now();
            writeFixedPackages(rows);
            return { ...pkg };
        },

        async deleteFixedPackage(id) {
            const rows = readFixedPackages();
            const pkg = rows.find(p => p.id === id);
            if (!pkg) return false;
            if ((pkg.seatsSold || 0) > 0) return false; // عليها حجوزات — تُغلق (active=false) لا تُحذف
            writeFixedPackages(rows.filter(p => p.id !== id));
            return true;
        },

        // ⚠️ نفس ضمان ذرّية حصص العقود أعلاه: فحص وزيادة وكتابة كتلة
        // متزامنة بلا await بينها — postgresStore يضمنها بشرط داخل UPDATE واحد.
        async allocateFixedSeats(id, seats) {
            const rows = readFixedPackages();
            const pkg = rows.find(p => p.id === id);
            if (!pkg || pkg.active === false) return null;
            if ((pkg.seatsSold || 0) + seats > pkg.seatCapacity) return null;
            pkg.seatsSold = (pkg.seatsSold || 0) + seats;
            pkg.updatedAt = Date.now();
            writeFixedPackages(rows);
            return { ...pkg };
        },

        async releaseFixedSeats(id, seats) {
            const rows = readFixedPackages();
            const pkg = rows.find(p => p.id === id);
            if (!pkg) return null;
            pkg.seatsSold = Math.max(0, (pkg.seatsSold || 0) - seats);
            pkg.updatedAt = Date.now();
            writeFixedPackages(rows);
            return { ...pkg };
        },

        // ─── 🔔 اهتمامات الباقات: قائمة انتظار + طلبات عروض خاصة ────────

        async createPackageInterest(entry) {
            const rows = readInterests();
            // انتظار مكرَّر لنفس (مستخدم، باقة) يُعاد كما هو — لا صفوف مكرّرة
            if (entry.kind === 'waitlist') {
                const dup = rows.find(r => r.kind === 'waitlist' && r.status === 'new'
                    && r.username === entry.username && r.packageId === entry.packageId);
                if (dup) return { ...dup, duplicate: true };
            }
            const row = {
                id: 'pin_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                status: 'new',
                packageId: null,
                ...entry,
            };
            rows.push(row);
            writeInterests(rows);
            return { ...row };
        },

        async listPackageInterests(limit = 200) {
            return readInterests()
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(r => ({ ...r }));
        },

        async listWaitlistByPackage(packageId) {
            return readInterests()
                .filter(r => r.kind === 'waitlist' && r.packageId === packageId && r.status === 'new')
                .map(r => ({ ...r }));
        },

        async updatePackageInterest(id, patch = {}) {
            const rows = readInterests();
            const row = rows.find(r => r.id === id);
            if (!row) return null;
            Object.assign(row, patch);
            writeInterests(rows);
            return { ...row };
        },

        // ─── ⭐ مراجعات الباقات (موثقة بحجز — نفس عقد postgresStore) ─────

        // مراجعة واحدة لكل (مستخدم، باقة): الثانية تحديثٌ للأولى لا صف جديد
        async upsertReview(rData) {
            const rows = readReviews();
            const existing = rows.find(r => r.username === rData.username && r.packageId === rData.packageId);
            if (existing) {
                Object.assign(existing, {
                    rating: rData.rating, title: rData.title, text: rData.text,
                    bookingId: rData.bookingId, updatedAt: Date.now(),
                });
                writeReviews(rows);
                return { ...existing };
            }
            const row = {
                id: 'rev_' + crypto.randomBytes(10).toString('hex'),
                at: Date.now(),
                updatedAt: Date.now(),
                ...rData,
            };
            rows.push(row);
            writeReviews(rows);
            return { ...row };
        },

        async listReviewsByPackage(packageId, limit = 100) {
            return readReviews()
                .filter(r => r.packageId === packageId)
                .sort((a, b) => b.at - a.at)
                .slice(0, limit)
                .map(r => ({ ...r }));
        },

        async getReviewByUser(username, packageId) {
            const row = readReviews().find(r => r.username === username && r.packageId === packageId);
            return row ? { ...row } : null;
        },

        // ─── ❤️ المفضلة (قائمة رغبات لكل مستخدم) ────────────────────────

        async addWishlist(username, packageId) {
            const rows = readWishlist();
            if (rows.some(w => w.username === username && w.packageId === packageId)) return false;
            rows.push({ username, packageId, at: Date.now() });
            writeWishlist(rows);
            return true;
        },

        async removeWishlist(username, packageId) {
            const rows = readWishlist();
            const next = rows.filter(w => !(w.username === username && w.packageId === packageId));
            if (next.length === rows.length) return false;
            writeWishlist(next);
            return true;
        },

        async listWishlistByUser(username) {
            return readWishlist()
                .filter(w => w.username === username)
                .sort((a, b) => b.at - a.at)
                .map(w => ({ ...w }));
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
