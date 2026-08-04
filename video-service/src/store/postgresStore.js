/**
 * 🐘 postgresStore.js — تخزين دائم (الإنتاج) عبر PostgreSQL
 *
 * يحقق نفس عقد المخزن الذي يحققه fileStore، فالتبديل بينهما لا يمس أي
 * منطق أعمال. يُختار تلقائياً بمجرد ضبط DATABASE_URL (Neon/Supabase
 * بباقة مجانية تكفي البداية).
 *
 * مكسب حقيقي فوق الدوام: **الذرّية**. الخصم وانتقال الحالة يتمّان
 * بجملة UPDATE ... WHERE واحدة، فلا يمكن لطلبين متزامنين أن يخصما
 * رصيداً واحداً مرتين أو ينقلا مهمة من حالة انتُقل منها بالفعل — وهو
 * ما كان يعتمد في نسخة الملفات على كون العملية أحادية الخيط.
 */
import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS video_balances (
    username   TEXT PRIMARY KEY,
    credits    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS video_credit_ledger (
    id          BIGSERIAL PRIMARY KEY,
    at          BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    username    TEXT NOT NULL,
    amount      INTEGER NOT NULL,
    job_id      TEXT,
    granted_by  TEXT,
    note        TEXT,
    reason      TEXT
);
CREATE INDEX IF NOT EXISTS video_credit_ledger_user_idx ON video_credit_ledger (username, id);
-- يضمن استرداداً واحداً لكل مهمة على مستوى قاعدة البيانات نفسها،
-- لا على مستوى منطق التطبيق فقط (عصمة حقيقية من الازدواج).
CREATE UNIQUE INDEX IF NOT EXISTS video_credit_ledger_refund_once
    ON video_credit_ledger (job_id) WHERE kind = 'refund';
CREATE TABLE IF NOT EXISTS video_jobs (
    id           TEXT PRIMARY KEY,
    at           BIGINT NOT NULL,
    updated_at   BIGINT NOT NULL,
    username     TEXT NOT NULL,
    template_id  TEXT NOT NULL,
    values_json  JSONB NOT NULL,
    spec_json    JSONB NOT NULL,
    cost_credits INTEGER NOT NULL,
    status       TEXT NOT NULL,
    provider_id  TEXT,
    provider     TEXT,
    video_url    TEXT,
    error        TEXT,
    refunded     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS video_jobs_user_idx ON video_jobs (username, at);
CREATE INDEX IF NOT EXISTS video_jobs_status_idx ON video_jobs (status);
CREATE INDEX IF NOT EXISTS video_jobs_at_idx ON video_jobs (at);
-- أعلام صغيرة دائمة (تنبيه التكلفة اليومي…) — تبقى عبر إعادات التشغيل
CREATE TABLE IF NOT EXISTS video_flags (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

function newId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/** يحوّل صف قاعدة البيانات إلى نفس شكل كائن المهمة الذي يعرفه باقي الكود. */
function rowToJob(r) {
    if (!r) return null;
    return {
        id: r.id,
        at: Number(r.at),
        updatedAt: Number(r.updated_at),
        username: r.username,
        templateId: r.template_id,
        values: r.values_json,
        spec: r.spec_json,
        costCredits: r.cost_credits,
        status: r.status,
        providerId: r.provider_id,
        provider: r.provider,
        videoUrl: r.video_url,
        error: r.error,
        refunded: r.refunded,
    };
}

function rowToLedger(r) {
    return {
        id: String(r.id), at: Number(r.at), kind: r.kind, username: r.username,
        amount: r.amount, jobId: r.job_id, grantedBy: r.granted_by,
        note: r.note, reason: r.reason,
    };
}

export function createPostgresStore({ connectionString, starterCredits, poolFactory }) {
    const pool = poolFactory
        ? poolFactory()
        : new pg.Pool({
            connectionString,
            // Neon/Supabase وRender تتطلب TLS؛ الشهادات مُدارة من المزود.
            ssl: /localhost|127\.0\.0\.1|\/tmp/.test(connectionString) ? false : { rejectUnauthorized: false },
            max: 5,
        });

    /**
     * ينشئ حساباً بالرصيد الترحيبي مرة واحدة فقط. ON CONFLICT DO NOTHING
     * يجعلها ذرّية: طلبان متزامنان لمستخدم جديد لا يمنحانه الرصيد مرتين
     * (الثاني لا يُدرج شيئاً فلا يُسجَّل منح ثانٍ).
     */
    async function ensureAccount(client, user) {
        const res = await client.query(
            `INSERT INTO video_balances (username, credits) VALUES ($1, $2)
             ON CONFLICT (username) DO NOTHING RETURNING credits`,
            [user, starterCredits]
        );
        if (res.rowCount > 0) {
            await client.query(
                `INSERT INTO video_credit_ledger (at, kind, username, amount)
                 VALUES ($1, 'starter', $2, $3)`,
                [Date.now(), user, starterCredits]
            );
        }
    }

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

        /**
         * 🧪 للاختبارات فقط — تفريغ الجداول بين الحالات. لا يُستدعى من أي
         * مسار إنتاجي (لا مرجع له خارج ملف الاختبار).
         */
        async truncateAllForTest() {
            await withClient(c => c.query('TRUNCATE video_jobs, video_credit_ledger, video_balances, video_flags'));
        },

        async getBalance(user) {
            return withClient(async c => {
                await ensureAccount(c, user);
                const res = await c.query('SELECT credits FROM video_balances WHERE username = $1', [user]);
                return res.rows[0]?.credits ?? 0;
            });
        },

        async grantCredits({ user, amount, grantedBy, note }) {
            return withClient(async c => {
                await ensureAccount(c, user);
                await c.query('UPDATE video_balances SET credits = credits + $2 WHERE username = $1', [user, amount]);
                await c.query(
                    `INSERT INTO video_credit_ledger (at, kind, username, amount, granted_by, note)
                     VALUES ($1, 'grant', $2, $3, $4, $5)`,
                    [Date.now(), user, amount, grantedBy, note]
                );
                return true;
            });
        },

        /** خصم ذرّي — الشرط داخل UPDATE نفسه يمنع أي رصيد سالب أو تسابق. */
        async deductCredits({ user, amount, jobId }) {
            return withClient(async c => {
                await ensureAccount(c, user);
                const res = await c.query(
                    `UPDATE video_balances SET credits = credits - $2
                     WHERE username = $1 AND credits >= $2 RETURNING credits`,
                    [user, amount]
                );
                if (res.rowCount === 0) return false;
                await c.query(
                    `INSERT INTO video_credit_ledger (at, kind, username, amount, job_id)
                     VALUES ($1, 'deduct', $2, $3, $4)`,
                    [Date.now(), user, amount, jobId]
                );
                return true;
            });
        },

        /**
         * استرداد معصوم من الازدواج عبر فهرس فريد جزئي على job_id —
         * محاولة استرداد ثانية ترتد من قاعدة البيانات نفسها (23505)،
         * حتى لو جاءت من عملية أخرى متزامنة.
         */
        async refundCredits({ user, amount, jobId, reason }) {
            return withClient(async c => {
                await ensureAccount(c, user);
                try {
                    await c.query('BEGIN');
                    await c.query(
                        `INSERT INTO video_credit_ledger (at, kind, username, amount, job_id, reason)
                         VALUES ($1, 'refund', $2, $3, $4, $5)`,
                        [Date.now(), user, amount, jobId, reason]
                    );
                    await c.query('UPDATE video_balances SET credits = credits + $2 WHERE username = $1', [user, amount]);
                    await c.query('COMMIT');
                    return true;
                } catch (e) {
                    await c.query('ROLLBACK');
                    if (e.code === '23505') return false; // استرداد سابق لنفس المهمة
                    throw e;
                }
            });
        },

        async getUserLedger(user, limit) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM video_credit_ledger WHERE username = $1 ORDER BY id DESC LIMIT $2',
                    [user, limit]
                );
                return res.rows.map(rowToLedger);
            });
        },

        async createJob(job) {
            return withClient(async c => {
                const now = Date.now();
                const res = await c.query(
                    `INSERT INTO video_jobs
                     (id, at, updated_at, username, template_id, values_json, spec_json, cost_credits,
                      status, provider_id, provider, video_url, error, refunded)
                     VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,NULL,NULL,FALSE) RETURNING *`,
                    [newId(), now, job.username, job.templateId, JSON.stringify(job.values),
                        JSON.stringify(job.spec), job.costCredits, job.status]
                );
                return rowToJob(res.rows[0]);
            });
        },

        async getJob(id) {
            return withClient(async c => {
                const res = await c.query('SELECT * FROM video_jobs WHERE id = $1', [id]);
                return rowToJob(res.rows[0]);
            });
        },

        async listJobsByUser(user, limit) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT * FROM video_jobs WHERE username = $1 ORDER BY at DESC LIMIT $2',
                    [user, limit]
                );
                return res.rows.map(rowToJob);
            });
        },

        async listActiveJobs() {
            return withClient(async c => {
                const res = await c.query(
                    `SELECT * FROM video_jobs WHERE status IN ('queued','rendering') ORDER BY at ASC`
                );
                return res.rows.map(rowToJob);
            });
        },

        // عدّ التوليدات ضمن نافذة زمنية — أساس درع التكلفة اليومي.
        // يشمل الفاشلة عمداً: محاولة التوليد نفسها قد تكون كلّفت المزوّد.
        async countJobsSince(sinceMs) {
            return withClient(async c => {
                const res = await c.query('SELECT COUNT(*)::int AS n FROM video_jobs WHERE at >= $1', [sinceMs]);
                return res.rows[0].n;
            });
        },

        async countJobsSinceForUser(user, sinceMs) {
            return withClient(async c => {
                const res = await c.query(
                    'SELECT COUNT(*)::int AS n FROM video_jobs WHERE username = $1 AND at >= $2',
                    [user, sinceMs]
                );
                return res.rows[0].n;
            });
        },

        // أعلام صغيرة دائمة (مثل: أُرسل تنبيه التكلفة اليوم).
        async getFlag(key) {
            return withClient(async c => {
                const res = await c.query('SELECT value FROM video_flags WHERE key = $1', [key]);
                return res.rows[0]?.value ?? null;
            });
        },

        async setFlag(key, value) {
            await withClient(c => c.query(
                `INSERT INTO video_flags (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [key, String(value)]
            ));
        },

        /** انتقال ذرّي: الشرط status = ANY(from) داخل UPDATE نفسه. */
        async transitionJob(id, { from, to, patch = {} }) {
            return withClient(async c => {
                const res = await c.query(
                    `UPDATE video_jobs SET
                        status = $3, updated_at = $4,
                        provider_id = COALESCE($5, provider_id),
                        provider    = COALESCE($6, provider),
                        video_url   = COALESCE($7, video_url),
                        error       = COALESCE($8, error),
                        refunded    = COALESCE($9, refunded)
                     WHERE id = $1 AND status = ANY($2) RETURNING *`,
                    [id, from, to, Date.now(),
                        patch.providerId ?? null, patch.provider ?? null,
                        patch.videoUrl ?? null, patch.error ?? null,
                        'refunded' in patch ? patch.refunded : null]
                );
                return rowToJob(res.rows[0]);
            });
        },
    };
}
