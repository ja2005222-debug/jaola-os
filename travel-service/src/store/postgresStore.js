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
CREATE INDEX IF NOT EXISTS travel_bookings_user_idx ON travel_bookings (username, at);
CREATE INDEX IF NOT EXISTS travel_bookings_status_idx ON travel_bookings (status);

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
        sellAmount: Number(r.sell_amount),
        currency: r.currency,
        providerOrderId: r.provider_order_id,
        bookingReference: r.booking_reference,
        error: r.error,
        refund: r.refund_json,
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

export function createPostgresStore({ connectionString }) {
    const pool = new pg.Pool({ connectionString, max: 5 });

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
                      passengers_json, contact_json, net_amount, sell_amount, currency)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
                    [id, now, now, b.username, b.provider, b.status, b.kind || 'flight',
                        JSON.stringify(b.offer), JSON.stringify(b.passengers),
                        JSON.stringify(b.contact), b.netAmount, b.sellAmount, b.currency]
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

        async listBookingsByUser(username, limit = 50) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM travel_bookings WHERE username = $1 ORDER BY at DESC LIMIT $2',
                    [username, limit]
                );
                return res.rows.map(rowToBooking);
            });
        },

        async transitionBooking(id, { from, to, patch = {} }) {
            // نفس ذرّية transitionJob في خدمة الفيديو: الشرط على الحالة
            // داخل UPDATE نفسه — طلبان متزامنان لا يمرران معاً أبداً.
            const sets = ['status = $2', 'updated_at = $3'];
            const vals = [id, to, Date.now()];
            let i = 4;
            const jsonCols = { offer: 'offer_json', refund: 'refund_json' };
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
    };
}
