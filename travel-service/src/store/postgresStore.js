/**
 * 🐘 postgresStore.js — مخزن الإنتاج الدائم (نفس عقد fileStore بالتطابق)
 *
 * جدول واحد للمرحلة ١ (حجوزات الطيران). الحقول المالية net/sell تُخزَّن
 * NUMERIC نصياً محفوظ الدقة — لا Float للمال أبداً. الحمولات المركّبة
 * (العرض/الركاب/التواصل/الاسترداد) JSONB لأن شكلها يتبع المزوّد ويتطور
 * معه، بينما ما نستعلم عنه (المستخدم/الحالة/الوقت) أعمدة مفهرسة.
 */
import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS travel_bookings (
    id              TEXT PRIMARY KEY,
    at              BIGINT NOT NULL,
    updated_at      BIGINT NOT NULL,
    username        TEXT NOT NULL,
    provider        TEXT NOT NULL,
    status          TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'flight',
    offer_json      JSONB NOT NULL,
    passengers_json JSONB NOT NULL,
    contact_json    JSONB NOT NULL,
    net_amount      NUMERIC(12,2) NOT NULL,
    sell_amount     NUMERIC(12,2) NOT NULL,
    currency        TEXT NOT NULL,
    provider_order_id TEXT,
    booking_reference TEXT,
    error           TEXT,
    refund_json     JSONB
);
-- توسعة المرحلة ١ الموجودة أصلاً في الإنتاج: عمود إضافي غير هدّام
-- (الصفوف الحالية تصبح 'flight' تلقائياً).
ALTER TABLE travel_bookings ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'flight';
-- علامة تذكير ما قبل السفر: توسعة غير هدّامة، الصفوف الحالية تبقى NULL
-- (أي «لم يُرسَل») وهو الصحيح — لا تذكير أُرسل لها فعلاً.
ALTER TABLE travel_bookings ADD COLUMN IF NOT EXISTS reminder_sent_at BIGINT;
-- 🎁 الباقات: الابن يحمل معرّف أبيه، والأب يحمل تعويضاً معلّقاً إن فشل
-- إلغاء ابنٍ بعد فشل الطيران. sell_amount يقبل NULL لأن ابن الباقة
-- لا سعر بيع له — الهامش يُطبَّق مرة واحدة على الأب فلا سعران متناقضان.
ALTER TABLE travel_bookings ADD COLUMN IF NOT EXISTS package_id TEXT;
ALTER TABLE travel_bookings ADD COLUMN IF NOT EXISTS compensation_json JSONB;
ALTER TABLE travel_bookings ALTER COLUMN sell_amount DROP NOT NULL;
CREATE INDEX IF NOT EXISTS travel_bookings_package_idx ON travel_bookings (package_id);
CREATE INDEX IF NOT EXISTS travel_bookings_user_idx ON travel_bookings (username, at);
CREATE INDEX IF NOT EXISTS travel_bookings_status_idx ON travel_bookings (status);
CREATE INDEX IF NOT EXISTS travel_bookings_provider_order_idx ON travel_bookings (provider_order_id);

CREATE TABLE IF NOT EXISTS travel_price_watches (
    id              TEXT PRIMARY KEY,
    at              BIGINT NOT NULL,
    updated_at      BIGINT NOT NULL,
    username        TEXT NOT NULL,
    origin          TEXT NOT NULL,
    destination     TEXT NOT NULL,
    depart_date     TEXT NOT NULL,
    return_date     TEXT,
    cabin           TEXT NOT NULL,
    target_price    NUMERIC(12,2),
    last_price      NUMERIC(12,2),
    currency        TEXT,
    contact_email   TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS travel_price_watches_user_idx ON travel_price_watches (username, at);
CREATE INDEX IF NOT EXISTS travel_price_watches_status_idx ON travel_price_watches (status);

CREATE TABLE IF NOT EXISTS travel_notifications (
    id              TEXT PRIMARY KEY,
    at              BIGINT NOT NULL,
    username        TEXT NOT NULL,
    category        TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    meta_json       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS travel_notifications_user_idx ON travel_notifications (username, at DESC);
-- فهرس جزئي: الاستعلام الوحيد المتكرر هو عدّاد غير المقروء في كل تحميل
-- صفحة، والمقروءة تتراكم بلا حد — فلا داعي لفهرستها معها.
CREATE INDEX IF NOT EXISTS travel_notifications_unread_idx
    ON travel_notifications (username) WHERE read = FALSE;

CREATE TABLE IF NOT EXISTS travel_notification_prefs (
    username        TEXT PRIMARY KEY,
    prefs_json      JSONB NOT NULL
);

-- 🔒 ملف المسافر: صفٌّ واحد لكل مستخدم يجمع التفضيلات والمسافرين
-- المحفوظين وآخر محادثة. التجميع مقصود لا كسل: «امسح بياناتي» يصير
-- DELETE واحداً لا مطاردةَ بقايا عبر جداول.
CREATE TABLE IF NOT EXISTS travel_profiles (
    username        TEXT PRIMARY KEY,
    profile_json    JSONB NOT NULL,
    updated_at      BIGINT NOT NULL
);

-- 🤝 العقود الفندقية المباشرة (أسعار خاصة متفاوَض عليها — Free-sale ضمن
-- حصة غرف). used_rooms عدّاد الحصة: يُزاد ذرّياً بشرط عدم تجاوز allotment
-- في UPDATE واحد، فلا تُباع الغرفة الحادية عشرة من حصة عشرٍ بطلبين
-- متزامنين (نفس فلسفة transitionBooking حرفياً).
CREATE TABLE IF NOT EXISTS travel_hotel_contracts (
    id            TEXT PRIMARY KEY,
    at            BIGINT NOT NULL,
    updated_at    BIGINT NOT NULL,
    hotel_name    TEXT NOT NULL,
    city          TEXT,
    iata          TEXT NOT NULL,
    net_per_night NUMERIC(12,2) NOT NULL,
    currency      TEXT NOT NULL,
    allotment     INTEGER NOT NULL,
    used_rooms    INTEGER NOT NULL DEFAULT 0,
    start_date    TEXT NOT NULL,
    end_date      TEXT NOT NULL,
    blackout_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    margin_pct    NUMERIC(5,2)
);
-- عقود سابقة على هذا العمود (تثبيت قديم) — NULL تعني «ورّث هامش الفنادق
-- الافتراضي»، وهو نفس سلوكها قبل وجود العمود أصلاً فلا تغيير سعر صامت.
ALTER TABLE travel_hotel_contracts ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(5,2);
CREATE INDEX IF NOT EXISTS travel_hotel_contracts_iata_idx ON travel_hotel_contracts (iata);

-- كل حجز من عقد = تخصيص غرفة/غرف. الإلغاء يعيدها للحصة.
CREATE TABLE IF NOT EXISTS travel_contract_allocations (
    id           TEXT PRIMARY KEY,
    at           BIGINT NOT NULL,
    contract_id  TEXT NOT NULL,
    rooms        INTEGER NOT NULL,
    net_amount   NUMERIC(12,2) NOT NULL,
    currency     TEXT NOT NULL,
    check_in     TEXT,
    check_out    TEXT,
    status       TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS travel_contract_allocations_contract_idx ON travel_contract_allocations (contract_id);

-- 🎒 الباقات المجدولة: مخزون مملوك (فندق متعاقَد + مقاعد محجوزة سلفاً)
-- يُباع بانطلاقات ثابتة. seats_sold يُزاد ذرّياً بشرط عدم تجاوز السعة
-- داخل UPDATE واحد — نفس حارس البيع الزائد في حصص العقود حرفياً.
-- التفاصيل الوصفية في data_json؛ الأعمدة المفصولة هي ما تحتاجه الذرّية
-- والفرز فقط (سعة/مباع/نشط/تاريخ الانطلاق).
CREATE TABLE IF NOT EXISTS travel_fixed_packages (
    id            TEXT PRIMARY KEY,
    at            BIGINT NOT NULL,
    updated_at    BIGINT NOT NULL,
    depart_date   TEXT NOT NULL,
    seat_capacity INTEGER NOT NULL,
    seats_sold    INTEGER NOT NULL DEFAULT 0,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    data_json     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS travel_fixed_packages_depart_idx ON travel_fixed_packages (depart_date);

-- 🔔 اهتمامات الباقات: قائمة انتظار انطلاقة مكتملة + طلبات عروض خاصة.
CREATE TABLE IF NOT EXISTS travel_package_interests (
    id          TEXT PRIMARY KEY,
    at          BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    package_id  TEXT,
    username    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new',
    data_json   JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS travel_package_interests_pkg_idx ON travel_package_interests (package_id);
`;

function rowToBooking(r) {
    if (!r) return null;
    return {
        id: r.id,
        at: Number(r.at),
        updatedAt: Number(r.updated_at),
        username: r.username,
        provider: r.provider,
        status: r.status,
        kind: r.kind,
        offer: r.offer_json,
        passengers: r.passengers_json,
        contact: r.contact_json,
        netAmount: Number(r.net_amount),
        // NULL لابن الباقة (الهامش على الأب) — Number(null) كان سيحوّله صفراً كاذباً
        sellAmount: r.sell_amount != null ? Number(r.sell_amount) : null,
        currency: r.currency,
        providerOrderId: r.provider_order_id,
        bookingReference: r.booking_reference,
        error: r.error,
        refund: r.refund_json,
        packageId: r.package_id || null,
        compensation: r.compensation_json || null,
        reminderSentAt: r.reminder_sent_at != null ? Number(r.reminder_sent_at) : null,
    };
}

function rowToContract(r) {
    if (!r) return null;
    return {
        id: r.id,
        at: Number(r.at),
        updatedAt: Number(r.updated_at),
        hotelName: r.hotel_name,
        city: r.city,
        iata: r.iata,
        netPerNight: Number(r.net_per_night),
        currency: r.currency,
        allotment: Number(r.allotment),
        usedRooms: Number(r.used_rooms),
        startDate: r.start_date,
        endDate: r.end_date,
        blackoutDates: r.blackout_json || [],
        active: r.active,
        marginPct: r.margin_pct != null ? Number(r.margin_pct) : null,
    };
}

function rowToAllocation(r) {
    if (!r) return null;
    return {
        id: r.id,
        at: Number(r.at),
        contractId: r.contract_id,
        rooms: Number(r.rooms),
        netAmount: Number(r.net_amount),
        currency: r.currency,
        checkIn: r.check_in,
        checkOut: r.check_out,
        status: r.status,
    };
}

function rowToFixedPackage(r) {
    if (!r) return null;
    return {
        ...(r.data_json || {}),
        id: r.id,
        at: Number(r.at),
        updatedAt: Number(r.updated_at),
        departDate: r.depart_date,
        seatCapacity: Number(r.seat_capacity),
        seatsSold: Number(r.seats_sold),
        active: r.active,
    };
}

function rowToInterest(r) {
    if (!r) return null;
    return {
        ...(r.data_json || {}),
        id: r.id,
        at: Number(r.at),
        kind: r.kind,
        packageId: r.package_id || null,
        username: r.username,
        status: r.status,
    };
}

function rowToWatch(r) {
    if (!r) return null;
    return {
        id: r.id,
        at: Number(r.at),
        updatedAt: Number(r.updated_at),
        username: r.username,
        origin: r.origin,
        destination: r.destination,
        departDate: r.depart_date,
        returnDate: r.return_date,
        cabin: r.cabin,
        targetPrice: r.target_price != null ? Number(r.target_price) : null,
        lastPrice: r.last_price != null ? Number(r.last_price) : null,
        currency: r.currency,
        contactEmail: r.contact_email,
        status: r.status,
    };
}

function rowToNotification(r) {
    if (!r) return null;
    return {
        id: r.id,
        at: Number(r.at),
        username: r.username,
        category: r.category,
        title: r.title,
        body: r.body,
        read: r.read,
        meta: r.meta_json || {},
    };
}

export function createPostgresStore({ connectionString }) {
    const pool = new pg.Pool({
        connectionString,
        // Neon/Supabase وRender تتطلب TLS؛ الشهادات مُدارة من المزوّد
        // (نفس ضبط video-service/src/store/postgresStore.js حرفياً).
        ssl: /localhost|127\.0\.0\.1|\/tmp/.test(connectionString) ? false : { rejectUnauthorized: false },
        max: 5,
    });
    // عميل خامل يفشل (إعادة تشغيل مُدار، قطع اتصال) يُصدر حدث 'error' على
    // الـPool — بلا مستمع هنا ترميه Node كاستثناء غير مُعالَج فيسقط الخادم
    // كاملاً بمنتصف طلبات أخرى (موثَّق في node-postgres). تسجيل فقط؛ الـPool
    // نفسه يستبدل العميل الفاسد تلقائياً.
    pool.on('error', err => {
        console.error('⚠️ خطأ في اتصال Postgres (عميل خامل):', err.message);
    });

    async function withClient(fn) {
        const client = await pool.connect();
        try { return await fn(client); } finally { client.release(); }
    }

    return {
        name: 'postgres',

        async init() {
            await withClient(c => c.query(SCHEMA));
        },
        async close() { await pool.end(); },

        async createBooking(b) {
            const id = 'trv_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                .map(x => x.toString(16).padStart(2, '0')).join('');
            const now = Date.now();
            return withClient(async c => {
                const res = await c.query(
                    `INSERT INTO travel_bookings
                     (id, at, updated_at, username, provider, status, kind, offer_json,
                      passengers_json, contact_json, net_amount, sell_amount, currency, package_id)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
                    [id, now, now, b.username, b.provider, b.status, b.kind || 'flight',
                        JSON.stringify(b.offer), JSON.stringify(b.passengers),
                        JSON.stringify(b.contact), b.netAmount, b.sellAmount ?? null, b.currency,
                        b.packageId || null]
                );
                return rowToBooking(res.rows[0]);
            });
        },

        async getBooking(id) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_bookings WHERE id = $1', [id]);
                return rowToBooking(res.rows[0]);
            });
        },

        async getBookingByProviderOrderId(providerOrderId) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_bookings WHERE provider_order_id = $1', [providerOrderId]);
                return rowToBooking(res.rows[0]);
            });
        },

        async listBookingsByUser(username, limit = 50) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM travel_bookings WHERE username = $1 ORDER BY at DESC LIMIT $2',
                    [username, limit]
                );
                return res.rows.map(rowToBooking);
            });
        },

        // الفهرس على status موجود سلفاً — والتصفية بموعد الإقلاع تتم في
        // الذاكرة لأنه داخل offer_json (نفس تعليق fileStore).
        async listIssuedBookings(limit = 500) {
            return withClient(async c => {
                const res = await c.query(
                    "SELECT * FROM travel_bookings WHERE status = 'issued' ORDER BY at DESC LIMIT $1",
                    [limit]
                );
                return res.rows.map(rowToBooking);
            });
        },

        async markTripReminderSent(id, at = Date.now()) {
            return withClient(async c => {
                const res = await c.query(
                    'UPDATE travel_bookings SET reminder_sent_at = $2, updated_at = $3 WHERE id = $1 RETURNING *',
                    [id, at, Date.now()]
                );
                return rowToBooking(res.rows[0]);
            });
        },

        async transitionBooking(id, { from, to, patch = {} }) {
            // نفس ذرّية transitionJob في خدمة الفيديو: الشرط على الحالة
            // داخل UPDATE نفسه — طلبان متزامنان لا يمرران معاً أبداً.
            const sets = ['status = $2', 'updated_at = $3'];
            const vals = [id, to, Date.now()];
            let i = 4;
            const jsonCols = { offer: 'offer_json', refund: 'refund_json', compensation: 'compensation_json' };
            const textCols = {
                providerOrderId: 'provider_order_id',
                bookingReference: 'booking_reference',
                error: 'error',
            };
            for (const [key, col] of Object.entries(jsonCols)) {
                if (key in patch) { sets.push(`${col} = $${i++}`); vals.push(JSON.stringify(patch[key])); }
            }
            for (const [key, col] of Object.entries(textCols)) {
                if (key in patch) { sets.push(`${col} = $${i++}`); vals.push(patch[key]); }
            }
            vals.push(from);
            return withClient(async c => {
                const res = await c.query(
                    `UPDATE travel_bookings SET ${sets.join(', ')}
                     WHERE id = $1 AND status = ANY($${i}) RETURNING *`,
                    vals
                );
                return rowToBooking(res.rows[0]);
            });
        },

        // للأدمن: كل الحجوزات عبر كل المستخدمين — التقارير تُجمَع في الخادم
        async listAllBookings(limit = 500) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM travel_bookings ORDER BY at DESC LIMIT $1', [limit]
                );
                return res.rows.map(rowToBooking);
            });
        },

        // باقات فشل تعويضها (إلغاء ابنٍ بعد فشل الطيران) — يلتقطها
        // المُطلِق الزمني فيعيد المحاولة. jsonb_array_length على NULL
        // يعيد NULL فتُستبعد الصفوف بلا تعويض تلقائياً.
        async listCompensationPending(limit = 20) {
            return withClient(async c => {
                const res = await c.query(
                    `SELECT * FROM travel_bookings
                     WHERE kind = 'package' AND status = 'failed'
                       AND jsonb_array_length(compensation_json -> 'pending') > 0
                     ORDER BY at ASC LIMIT $1`, [limit]
                );
                return res.rows.map(rowToBooking);
            });
        },

        // ─── 🤝 العقود الفندقية ───────────────────────────────────────

        async createContract(cData) {
            const id = 'hc_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                .map(x => x.toString(16).padStart(2, '0')).join('');
            const now = Date.now();
            return withClient(async c => {
                const res = await c.query(
                    `INSERT INTO travel_hotel_contracts
                     (id, at, updated_at, hotel_name, city, iata, net_per_night, currency,
                      allotment, used_rooms, start_date, end_date, blackout_json, active, margin_pct)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14) RETURNING *`,
                    [id, now, now, cData.hotelName, cData.city || null, cData.iata,
                        cData.netPerNight, cData.currency, cData.allotment,
                        cData.startDate, cData.endDate,
                        JSON.stringify(cData.blackoutDates || []), cData.active !== false,
                        cData.marginPct ?? null]
                );
                return rowToContract(res.rows[0]);
            });
        },

        async getContract(id) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_hotel_contracts WHERE id = $1', [id]);
                return rowToContract(res.rows[0]);
            });
        },

        async listContracts() {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_hotel_contracts ORDER BY at DESC');
                return res.rows.map(rowToContract);
            });
        },

        async updateContract(id, patch = {}) {
            const sets = ['updated_at = $2'];
            const vals = [id, Date.now()];
            let i = 3;
            const cols = {
                hotelName: 'hotel_name', city: 'city', iata: 'iata',
                netPerNight: 'net_per_night', currency: 'currency',
                allotment: 'allotment', startDate: 'start_date', endDate: 'end_date',
                active: 'active', marginPct: 'margin_pct',
            };
            for (const [key, col] of Object.entries(cols)) {
                if (key in patch) { sets.push(`${col} = $${i++}`); vals.push(patch[key]); }
            }
            if ('blackoutDates' in patch) {
                sets.push(`blackout_json = $${i++}`);
                vals.push(JSON.stringify(patch.blackoutDates || []));
            }
            return withClient(async c => {
                const res = await c.query(
                    `UPDATE travel_hotel_contracts SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
                    vals
                );
                return rowToContract(res.rows[0]);
            });
        },

        async deleteContract(id) {
            return withClient(async c => {
                const res = await c.query('DELETE FROM travel_hotel_contracts WHERE id = $1', [id]);
                return res.rowCount > 0;
            });
        },

        /**
         * تخصيص غرف ذرّي: الشرط `used_rooms + n <= allotment` داخل UPDATE
         * نفسه — طلبان متزامنان على آخر غرفة لا يمرّان معاً أبداً.
         * يعيد null عند نفاد الحصة (ليس خطأً — جوابٌ تجاري صريح).
         */
        async createContractAllocation(contractId, { rooms, netAmount, currency, checkIn = null, checkOut = null }) {
            const id = 'ctro_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                .map(x => x.toString(16).padStart(2, '0')).join('');
            return withClient(async c => {
                try {
                    await c.query('BEGIN');
                    const upd = await c.query(
                        `UPDATE travel_hotel_contracts
                         SET used_rooms = used_rooms + $2, updated_at = $3
                         WHERE id = $1 AND active = TRUE AND used_rooms + $2 <= allotment
                         RETURNING id`,
                        [contractId, rooms, Date.now()]
                    );
                    if (!upd.rows[0]) { await c.query('ROLLBACK'); return null; }
                    const ins = await c.query(
                        `INSERT INTO travel_contract_allocations
                         (id, at, contract_id, rooms, net_amount, currency, check_in, check_out, status)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING *`,
                        [id, Date.now(), contractId, rooms, netAmount, currency, checkIn, checkOut]
                    );
                    await c.query('COMMIT');
                    return rowToAllocation(ins.rows[0]);
                } catch (e) {
                    await c.query('ROLLBACK');
                    throw e;
                }
            });
        },

        async getContractAllocation(id) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_contract_allocations WHERE id = $1', [id]);
                return rowToAllocation(res.rows[0]);
            });
        },

        /** إلغاء التخصيص يعيد الغرف للحصة — الشرط على status يمنع التحرير المزدوج. */
        async releaseContractAllocation(id) {
            return withClient(async c => {
                try {
                    await c.query('BEGIN');
                    const upd = await c.query(
                        `UPDATE travel_contract_allocations SET status = 'released'
                         WHERE id = $1 AND status = 'active' RETURNING *`, [id]
                    );
                    if (!upd.rows[0]) { await c.query('ROLLBACK'); return null; }
                    await c.query(
                        `UPDATE travel_hotel_contracts
                         SET used_rooms = GREATEST(0, used_rooms - $2), updated_at = $3
                         WHERE id = $1`,
                        [upd.rows[0].contract_id, upd.rows[0].rooms, Date.now()]
                    );
                    await c.query('COMMIT');
                    return rowToAllocation(upd.rows[0]);
                } catch (e) {
                    await c.query('ROLLBACK');
                    throw e;
                }
            });
        },

        // ─── 🎒 الباقات المجدولة ──────────────────────────────────────

        async createFixedPackage(pData) {
            const id = 'fxp_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                .map(x => x.toString(16).padStart(2, '0')).join('');
            const now = Date.now();
            const { departDate, seatCapacity, active, ...data } = pData;
            return withClient(async c => {
                const res = await c.query(
                    `INSERT INTO travel_fixed_packages
                     (id, at, updated_at, depart_date, seat_capacity, seats_sold, active, data_json)
                     VALUES ($1,$2,$3,$4,$5,0,$6,$7) RETURNING *`,
                    [id, now, now, departDate, seatCapacity, active !== false, JSON.stringify(data)]
                );
                return rowToFixedPackage(res.rows[0]);
            });
        },

        async getFixedPackage(id) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_fixed_packages WHERE id = $1', [id]);
                return rowToFixedPackage(res.rows[0]);
            });
        },

        async listFixedPackages() {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_fixed_packages ORDER BY depart_date ASC');
                return res.rows.map(rowToFixedPackage);
            });
        },

        async updateFixedPackage(id, patch = {}) {
            const { departDate, seatCapacity, active, ...dataPatch } = patch;
            return withClient(async c => {
                try {
                    await c.query('BEGIN');
                    const cur = await c.query('SELECT * FROM travel_fixed_packages WHERE id = $1 FOR UPDATE', [id]);
                    if (!cur.rows[0]) { await c.query('ROLLBACK'); return null; }
                    const row = cur.rows[0];
                    const mergedData = { ...(row.data_json || {}), ...dataPatch };
                    // السعة لا تهبط دون المباع — تقليصها تحت الحجوزات القائمة بيعٌ زائد بأثر رجعي
                    const nextCapRaw = seatCapacity !== undefined ? seatCapacity : Number(row.seat_capacity);
                    const nextCap = Math.max(nextCapRaw, Number(row.seats_sold));
                    const res = await c.query(
                        `UPDATE travel_fixed_packages
                         SET updated_at = $2, depart_date = $3, seat_capacity = $4, active = $5, data_json = $6
                         WHERE id = $1 RETURNING *`,
                        [id, Date.now(),
                            departDate !== undefined ? departDate : row.depart_date,
                            nextCap,
                            active !== undefined ? active : row.active,
                            JSON.stringify(mergedData)]
                    );
                    await c.query('COMMIT');
                    return rowToFixedPackage(res.rows[0]);
                } catch (e) {
                    await c.query('ROLLBACK');
                    throw e;
                }
            });
        },

        async deleteFixedPackage(id) {
            return withClient(async c => {
                // عليها حجوزات (seats_sold > 0) → تُغلق لا تُحذف — الشرط داخل DELETE
                const res = await c.query(
                    'DELETE FROM travel_fixed_packages WHERE id = $1 AND seats_sold = 0', [id]
                );
                return res.rowCount > 0;
            });
        },

        /**
         * حجز مقاعد ذرّي: الشرط `seats_sold + n <= seat_capacity` داخل
         * UPDATE نفسه — طلبان متزامنان على آخر مقعد لا يمرّان معاً أبداً.
         * null عند نفاد السعة (جواب تجاري صريح لا خطأ).
         */
        async allocateFixedSeats(id, seats) {
            return withClient(async c => {
                const res = await c.query(
                    `UPDATE travel_fixed_packages
                     SET seats_sold = seats_sold + $2, updated_at = $3
                     WHERE id = $1 AND active = TRUE AND seats_sold + $2 <= seat_capacity
                     RETURNING *`,
                    [id, seats, Date.now()]
                );
                return rowToFixedPackage(res.rows[0]);
            });
        },

        async releaseFixedSeats(id, seats) {
            return withClient(async c => {
                const res = await c.query(
                    `UPDATE travel_fixed_packages
                     SET seats_sold = GREATEST(0, seats_sold - $2), updated_at = $3
                     WHERE id = $1 RETURNING *`,
                    [id, seats, Date.now()]
                );
                return rowToFixedPackage(res.rows[0]);
            });
        },

        // ─── 🔔 اهتمامات الباقات (انتظار + طلبات عروض) ────────────────

        async createPackageInterest(entry) {
            const { kind, packageId = null, username, status, ...data } = entry;
            return withClient(async c => {
                if (kind === 'waitlist') {
                    // انتظار مكرَّر لنفس (مستخدم، باقة) يُعاد كما هو — لا صفوف مكرّرة
                    const dup = await c.query(
                        `SELECT * FROM travel_package_interests
                         WHERE kind = 'waitlist' AND status = 'new' AND username = $1 AND package_id = $2
                         LIMIT 1`,
                        [username, packageId]
                    );
                    if (dup.rows[0]) return { ...rowToInterest(dup.rows[0]), duplicate: true };
                }
                const id = 'pin_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                    .map(x => x.toString(16).padStart(2, '0')).join('');
                const res = await c.query(
                    `INSERT INTO travel_package_interests
                     (id, at, kind, package_id, username, status, data_json)
                     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                    [id, Date.now(), kind, packageId, username, status || 'new', JSON.stringify(data)]
                );
                return rowToInterest(res.rows[0]);
            });
        },

        async listPackageInterests(limit = 200) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM travel_package_interests ORDER BY at DESC LIMIT $1', [limit]
                );
                return res.rows.map(rowToInterest);
            });
        },

        async listWaitlistByPackage(packageId) {
            return withClient(async c => {
                const res = await c.query(
                    `SELECT * FROM travel_package_interests
                     WHERE kind = 'waitlist' AND package_id = $1 AND status = 'new'`,
                    [packageId]
                );
                return res.rows.map(rowToInterest);
            });
        },

        async updatePackageInterest(id, patch = {}) {
            const { status, ...dataPatch } = patch;
            return withClient(async c => {
                try {
                    await c.query('BEGIN');
                    const cur = await c.query('SELECT * FROM travel_package_interests WHERE id = $1 FOR UPDATE', [id]);
                    if (!cur.rows[0]) { await c.query('ROLLBACK'); return null; }
                    const mergedData = { ...(cur.rows[0].data_json || {}), ...dataPatch };
                    const res = await c.query(
                        `UPDATE travel_package_interests SET status = $2, data_json = $3 WHERE id = $1 RETURNING *`,
                        [id, status !== undefined ? status : cur.rows[0].status, JSON.stringify(mergedData)]
                    );
                    await c.query('COMMIT');
                    return rowToInterest(res.rows[0]);
                } catch (e) {
                    await c.query('ROLLBACK');
                    throw e;
                }
            });
        },

        async createPriceWatch(w) {
            const id = 'pw_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                .map(x => x.toString(16).padStart(2, '0')).join('');
            const now = Date.now();
            return withClient(async c => {
                const res = await c.query(
                    `INSERT INTO travel_price_watches
                     (id, at, updated_at, username, origin, destination, depart_date,
                      return_date, cabin, target_price, contact_email, status)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
                    [id, now, now, w.username, w.origin, w.destination, w.departDate,
                        w.returnDate || null, w.cabin, w.targetPrice ?? null, w.contactEmail || null, w.status || 'active']
                );
                return rowToWatch(res.rows[0]);
            });
        },

        async getPriceWatch(id) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM travel_price_watches WHERE id = $1', [id]);
                return rowToWatch(res.rows[0]);
            });
        },

        async listPriceWatchesByUser(username, limit = 50) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM travel_price_watches WHERE username = $1 ORDER BY at DESC LIMIT $2',
                    [username, limit]
                );
                return res.rows.map(rowToWatch);
            });
        },

        async listActivePriceWatches() {
            return withClient(async c => {
                const res = await c.query("SELECT * FROM travel_price_watches WHERE status = 'active'");
                return res.rows.map(rowToWatch);
            });
        },

        async updatePriceWatch(id, patch = {}) {
            const sets = ['updated_at = $2'];
            const vals = [id, Date.now()];
            let i = 3;
            const cols = { lastPrice: 'last_price', currency: 'currency', status: 'status' };
            for (const [key, col] of Object.entries(cols)) {
                if (key in patch) { sets.push(`${col} = $${i++}`); vals.push(patch[key]); }
            }
            return withClient(async c => {
                const res = await c.query(
                    `UPDATE travel_price_watches SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
                    vals
                );
                return rowToWatch(res.rows[0]);
            });
        },

        async createNotification(n) {
            const row = {
                id: 'ntf_' + Array.from(crypto.getRandomValues(new Uint8Array(10)))
                    .map(x => x.toString(16).padStart(2, '0')).join(''),
                at: Date.now(),
                read: false,
                meta: {},
                ...n,
            };
            return withClient(async c => {
                const res = await c.query(
                    `INSERT INTO travel_notifications (id, at, username, category, title, body, read, meta_json)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                    [row.id, row.at, row.username, row.category, row.title, row.body, row.read, row.meta]
                );
                return rowToNotification(res.rows[0]);
            });
        },

        async listNotificationsByUser(username, limit = 50) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM travel_notifications WHERE username = $1 ORDER BY at DESC LIMIT $2',
                    [username, limit]
                );
                return res.rows.map(rowToNotification);
            });
        },

        async countUnreadNotifications(username) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT COUNT(*)::int AS n FROM travel_notifications WHERE username = $1 AND read = FALSE',
                    [username]
                );
                return res.rows[0]?.n || 0;
            });
        },

        // username في WHERE لا في فحص سابق — عزل ملكية بالاستعلام نفسه
        async markNotificationRead(id, username) {
            return withClient(async c => {
                const res = await c.query(
                    'UPDATE travel_notifications SET read = TRUE WHERE id = $1 AND username = $2 RETURNING *',
                    [id, username]
                );
                return rowToNotification(res.rows[0]);
            });
        },

        async markAllNotificationsRead(username) {
            return withClient(async c => {
                const res = await c.query(
                    'UPDATE travel_notifications SET read = TRUE WHERE username = $1 AND read = FALSE',
                    [username]
                );
                return res.rowCount;
            });
        },

        async getProfile(username) {
            return withClient(async c => {
                const res = await c.query('SELECT profile_json FROM travel_profiles WHERE username = $1', [username]);
                return res.rows[0]?.profile_json || null;
            });
        },

        async setProfile(username, profile) {
            return withClient(async c => {
                await c.query(
                    `INSERT INTO travel_profiles (username, profile_json, updated_at) VALUES ($1, $2, $3)
                     ON CONFLICT (username) DO UPDATE SET profile_json = EXCLUDED.profile_json, updated_at = EXCLUDED.updated_at`,
                    [username, profile, Date.now()]
                );
                return profile;
            });
        },

        async deleteProfile(username) {
            return withClient(async c => {
                const res = await c.query('DELETE FROM travel_profiles WHERE username = $1', [username]);
                return res.rowCount > 0;
            });
        },

        async getNotificationPrefs(username) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT prefs_json FROM travel_notification_prefs WHERE username = $1', [username]
                );
                return res.rows[0]?.prefs_json || null;
            });
        },

        async setNotificationPrefs(username, prefs) {
            return withClient(async c => {
                await c.query(
                    `INSERT INTO travel_notification_prefs (username, prefs_json) VALUES ($1, $2)
                     ON CONFLICT (username) DO UPDATE SET prefs_json = EXCLUDED.prefs_json`,
                    [username, prefs]
                );
                return prefs;
            });
        },
    };
}
