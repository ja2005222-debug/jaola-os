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
CREATE INDEX IF NOT EXISTS travel_bookings_user_idx ON travel_bookings (username, at);
CREATE INDEX IF NOT EXISTS travel_bookings_status_idx ON travel_bookings (status);
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
                     (id, at, updated_at, username, provider, status, offer_json,
                      passengers_json, contact_json, net_amount, sell_amount, currency)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
                    [id, now, now, b.username, b.provider, b.status,
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
    };
}
