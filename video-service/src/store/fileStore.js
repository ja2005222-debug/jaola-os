/**
 * 📁 fileStore.js — تخزين بملفات JSON (الافتراضي للتطوير والاختبار)
 *
 * يحقق نفس عقد المخزن (انظر store/index.js) الذي يحققه postgresStore،
 * فتعمل الخدمة بلا أي قاعدة بيانات محلياً. **لا يصلح للإنتاج** على
 * منصات ذات قرص مؤقت (مثل خطة Render المجانية) لأن البيانات تُمسح مع
 * كل إعادة نشر — للإنتاج يُضبط DATABASE_URL فيُختار postgresStore.
 *
 * الواجهة async رغم أن العمليات متزامنة هنا — العقد واحد للمخزنين.
 * الأمان من التسابق يأتي من كون العملية أحادية الخيط (Node) وأن كل
 * دالة تقرأ-تعدّل-تكتب بلا await في المنتصف.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_LEDGER_RECORDS = 2000;
const MAX_TERMINAL_JOBS = 500;

function newId() { return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`; }

function readJson(file, fallback) {
    try {
        const v = JSON.parse(fs.readFileSync(file, 'utf8'));
        return v && typeof v === 'object' ? v : fallback;
    } catch { return fallback; }
}

function writeJson(dir, file, value) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
}

export function createFileStore({ dataDir, starterCredits }) {
    const balancesFile = path.join(dataDir, 'balances.json');
    const ledgerFile = path.join(dataDir, 'creditLedger.json');
    const jobsFile = path.join(dataDir, 'jobs.json');
    const flagsFile = path.join(dataDir, 'flags.json');

    const readBalances = () => readJson(balancesFile, {});
    const writeBalances = v => writeJson(dataDir, balancesFile, v);
    const readLedger = () => { const v = readJson(ledgerFile, []); return Array.isArray(v) ? v : []; };
    const readJobs = () => { const v = readJson(jobsFile, []); return Array.isArray(v) ? v : []; };

    function appendLedger(entry) {
        const records = readLedger();
        records.push({ id: newId(), at: Date.now(), ...entry });
        writeJson(dataDir, ledgerFile,
            records.length > MAX_LEDGER_RECORDS ? records.slice(-MAX_LEDGER_RECORDS) : records);
    }

    function writeJobs(jobs) {
        const terminal = jobs.filter(j => j.status === 'done' || j.status === 'failed');
        if (terminal.length > MAX_TERMINAL_JOBS) {
            const drop = new Set(terminal.slice(0, terminal.length - MAX_TERMINAL_JOBS).map(j => j.id));
            jobs = jobs.filter(j => !drop.has(j.id));
        }
        writeJson(dataDir, jobsFile, jobs);
    }

    function ensureAccountSync(user) {
        const balances = readBalances();
        if (!balances[user]) {
            balances[user] = { credits: starterCredits };
            writeBalances(balances);
            appendLedger({ kind: 'starter', username: user, amount: starterCredits });
        }
        return balances[user];
    }

    return {
        name: 'file',
        async init() { fs.mkdirSync(dataDir, { recursive: true }); },
        async close() {},

        async getBalance(user) {
            return ensureAccountSync(user).credits;
        },

        async grantCredits({ user, amount, grantedBy, note }) {
            ensureAccountSync(user);
            const balances = readBalances();
            balances[user].credits += amount;
            writeBalances(balances);
            appendLedger({ kind: 'grant', username: user, amount, grantedBy, note });
            return true;
        },

        /** خصم ذرّي: يفشل (false) إن لم يكفِ الرصيد — بلا رصيد سالب أبداً. */
        async deductCredits({ user, amount, jobId }) {
            ensureAccountSync(user);
            const balances = readBalances();
            if (balances[user].credits < amount) return false;
            balances[user].credits -= amount;
            writeBalances(balances);
            appendLedger({ kind: 'deduct', username: user, amount, jobId });
            return true;
        },

        /** معصوم من الازدواج: استرداد سابق بنفس jobId يمنع أي استرداد ثانٍ. */
        async refundCredits({ user, amount, jobId, reason }) {
            if (readLedger().some(r => r.kind === 'refund' && r.jobId === jobId)) return false;
            ensureAccountSync(user);
            const balances = readBalances();
            balances[user].credits += amount;
            writeBalances(balances);
            appendLedger({ kind: 'refund', username: user, amount, jobId, reason });
            return true;
        },

        async getUserLedger(user, limit) {
            return readLedger().filter(r => r.username === user).slice(-limit).reverse();
        },

        async createJob(job) {
            const jobs = readJobs();
            const full = { id: newId(), at: Date.now(), updatedAt: Date.now(), ...job };
            jobs.push(full);
            writeJobs(jobs);
            return { ...full };
        },

        async getJob(id) {
            const job = readJobs().find(j => j.id === id);
            return job ? { ...job } : null;
        },

        async listJobsByUser(user, limit) {
            return readJobs().filter(j => j.username === user).slice(-limit).reverse().map(j => ({ ...j }));
        },

        async listActiveJobs() {
            return readJobs()
                .filter(j => j.status === 'queued' || j.status === 'rendering')
                .map(j => ({ ...j }));
        },

        // عدّ التوليدات ضمن نافذة زمنية — أساس درع التكلفة اليومي.
        // يشمل الفاشلة عمداً: محاولة التوليد نفسها قد تكون كلّفت المزوّد.
        // ⚠️ هنا تُجتزأ المهام المنتهية عند MAX_TERMINAL_JOBS، فلو ضُبط
        // سقف يومي أعلى من ذلك صار العدّ ناقصاً — سبب إضافي لاعتماد
        // Postgres (بلا اجتزاء) في الإنتاج.
        async countJobsSince(sinceMs) {
            return readJobs().filter(j => j.at >= sinceMs).length;
        },

        async countJobsSinceForUser(user, sinceMs) {
            return readJobs().filter(j => j.username === user && j.at >= sinceMs).length;
        },

        // أعلام صغيرة دائمة (مثل: أُرسل تنبيه التكلفة اليوم) — تمنع تكرار
        // التنبيه عبر إعادات التشغيل، لا مجرد ذاكرة العملية.
        async getFlag(key) {
            return readJson(flagsFile, {})[key] ?? null;
        },

        async setFlag(key, value) {
            const flags = readJson(flagsFile, {});
            flags[key] = value;
            writeJson(dataDir, flagsFile, flags);
        },

        /**
         * انتقال حالة ذرّي: يُطبَّق فقط إن كانت الحالة الراهنة ضمن
         * allowedFrom — يُرجع المهمة المحدَّثة أو null.
         */
        async transitionJob(id, { from, to, patch = {} }) {
            const jobs = readJobs();
            const job = jobs.find(j => j.id === id);
            if (!job || !from.includes(job.status)) return null;
            job.status = to;
            job.updatedAt = Date.now();
            for (const key of ['providerId', 'provider', 'videoUrl', 'error', 'refunded']) {
                if (key in patch) job[key] = patch[key];
            }
            writeJobs(jobs);
            return { ...job };
        },
    };
}
