/**
 * 🐘 postgresStore.js — تخزين دائم (الإنتاج) عبر PostgreSQL
 *
 * يحقق نفس عقد fileStore بالتطابق، ويُختار تلقائياً بضبط DATABASE_URL.
 * ضرورته هنا أشد منها في خدمة الفيديو: المخزن هو **درع التكلفة** —
 * عدّادات السقوف (يومي/شهري) تعيش فيه، وقرص Render المؤقت يمسحها مع
 * كل نشر فتنفتح السقوف من الصفر بلا قصد. Postgres يبقيها صامدة.
 */
import pg from 'pg';
import crypto from 'crypto';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS logo_draft_rounds (
    id          TEXT PRIMARY KEY,
    at          BIGINT NOT NULL,
    ip_hash     TEXT NOT NULL,
    username    TEXT,
    prompt      TEXT NOT NULL,
    params_json JSONB NOT NULL,
    images_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS logo_draft_rounds_at_idx   ON logo_draft_rounds (at);
CREATE INDEX IF NOT EXISTS logo_draft_rounds_ip_idx   ON logo_draft_rounds (ip_hash, at);
CREATE INDEX IF NOT EXISTS logo_draft_rounds_user_idx ON logo_draft_rounds (username, at);
CREATE TABLE IF NOT EXISTS logo_finals (
    id          TEXT PRIMARY KEY,
    at          BIGINT NOT NULL,
    username    TEXT NOT NULL,
    round_id    TEXT,
    prompt      TEXT NOT NULL,
    params_json JSONB NOT NULL,
    image_url   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS logo_finals_user_idx ON logo_finals (username, at);
CREATE TABLE IF NOT EXISTS logo_flags (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

const newId = () => `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const roundRow = r => r ? ({
    id: r.id, at: Number(r.at), ipHash: r.ip_hash, username: r.username,
    prompt: r.prompt, params: r.params_json, images: r.images_json,
}) : null;

const finalRow = f => ({
    id: f.id, at: Number(f.at), username: f.username, roundId: f.round_id,
    prompt: f.prompt, params: f.params_json, imageUrl: f.image_url,
});

export function createPostgresStore({ connectionString }) {
    if (!connectionString) throw new Error('connectionString مطلوب لمخزن Postgres.');
    const pool = new pg.Pool({ connectionString, max: 5 });

    return {
        async init() { await pool.query(SCHEMA); },
        async close() { await pool.end(); },

        // ─── جولات المسودات ─────────────────────────────────────────
        async recordDraftRound({ ipHash, username = null, prompt, params, images }) {
            const round = { id: newId(), at: Date.now(), ipHash, username, prompt, params, images };
            await pool.query(
                `INSERT INTO logo_draft_rounds (id, at, ip_hash, username, prompt, params_json, images_json)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [round.id, round.at, ipHash, username, prompt, JSON.stringify(params), JSON.stringify(images)]
            );
            return round;
        },
        async getDraftRound(id) {
            const { rows } = await pool.query('SELECT * FROM logo_draft_rounds WHERE id = $1', [id]);
            return roundRow(rows[0]);
        },
        async countDraftRoundsSince(since) {
            const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM logo_draft_rounds WHERE at >= $1', [since]);
            return rows[0].n;
        },
        async countDraftRoundsSinceForIp(ipHash, since) {
            const { rows } = await pool.query(
                'SELECT COUNT(*)::int AS n FROM logo_draft_rounds WHERE ip_hash = $1 AND at >= $2', [ipHash, since]);
            return rows[0].n;
        },
        async countDraftRoundsSinceForUser(username, since) {
            const { rows } = await pool.query(
                'SELECT COUNT(*)::int AS n FROM logo_draft_rounds WHERE username = $1 AND at >= $2', [username, since]);
            return rows[0].n;
        },
        /** أحدث الأيقونات المولّدة (للمعرض العلني) — صور فقط، لا أسماء ولا أصحاب. */
        async listRecentImages(limit = 12) {
            // جولة = حتى ٨ صور؛ جلب limit جولة يضمن كفاية الصور بلا مسح كامل
            const { rows } = await pool.query(
                'SELECT images_json FROM logo_draft_rounds ORDER BY at DESC LIMIT $1', [limit]);
            const images = [];
            for (const r of rows) {
                for (const url of r.images_json || []) {
                    images.push(url);
                    if (images.length >= limit) return images;
                }
            }
            return images;
        },

        // ─── النسخ النهائية ─────────────────────────────────────────
        async recordFinal({ username, roundId, prompt, params, imageUrl }) {
            const final = { id: newId(), at: Date.now(), username, roundId, prompt, params, imageUrl };
            await pool.query(
                `INSERT INTO logo_finals (id, at, username, round_id, prompt, params_json, image_url)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [final.id, final.at, username, roundId, prompt, JSON.stringify(params), imageUrl]
            );
            return final;
        },
        async countFinalsSinceForUser(username, since) {
            const { rows } = await pool.query(
                'SELECT COUNT(*)::int AS n FROM logo_finals WHERE username = $1 AND at >= $2', [username, since]);
            return rows[0].n;
        },
        async listFinalsByUser(username) {
            const { rows } = await pool.query(
                'SELECT * FROM logo_finals WHERE username = $1 ORDER BY at DESC', [username]);
            return rows.map(finalRow);
        },

        // ─── الأعلام ────────────────────────────────────────────────
        async getFlag(key) {
            const { rows } = await pool.query('SELECT value FROM logo_flags WHERE key = $1', [key]);
            return rows[0]?.value ?? null;
        },
        async setFlag(key, value) {
            await pool.query(
                `INSERT INTO logo_flags (key, value) VALUES ($1,$2)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [key, String(value)]
            );
        },

        /** للاختبارات فقط — تفريغ الجداول بين الحالات. */
        async truncateAllForTest() {
            await pool.query('TRUNCATE logo_draft_rounds, logo_finals, logo_flags');
        },
    };
}
