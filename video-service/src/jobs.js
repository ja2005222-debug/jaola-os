/**
 * 📋 jobs.js — مخزن مهام التصدير الدائم (jobs.json)
 *
 * دورة الحياة: queued → rendering → done | failed
 * (queued → failed مباشرة إذا فشل الإرسال للمزود نفسه).
 * الانتقالات محصورة في خريطة صريحة — أي انتقال خارجها يُرفض، فلا يمكن
 * مثلاً إعادة مهمة منتهية إلى الطابور أو ازدواج استرداد عبر تكرار الفشل.
 *
 * الاجتزاء (trim) يطال المهام المنتهية فقط — مهمة نشطة لا تُحذف أبداً
 * مهما تقادمت، وإلا فقدنا أثر خصمٍ لم يُحسم مصيره.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_TERMINAL_JOBS = 500;

export const JOB_STATUSES = Object.freeze(['queued', 'rendering', 'done', 'failed']);
const ALLOWED_TRANSITIONS = Object.freeze({
    queued: ['rendering', 'failed'],
    rendering: ['done', 'failed'],
    done: [],
    failed: [],
});

function jobsFile(dir) { return path.join(dir, 'jobs.json'); }
function newId() { return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`; }

function readJobs(dir) {
    try {
        const v = JSON.parse(fs.readFileSync(jobsFile(dir), 'utf8'));
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}

function writeJobs(dir, jobs) {
    fs.mkdirSync(dir, { recursive: true });
    const terminal = jobs.filter(j => j.status === 'done' || j.status === 'failed');
    if (terminal.length > MAX_TERMINAL_JOBS) {
        const toDrop = new Set(
            terminal.slice(0, terminal.length - MAX_TERMINAL_JOBS).map(j => j.id)
        );
        jobs = jobs.filter(j => !toDrop.has(j.id));
    }
    fs.writeFileSync(jobsFile(dir), JSON.stringify(jobs));
}

export function createJob(dir, { username, templateId, values, spec, costCredits }) {
    const jobs = readJobs(dir);
    const job = {
        id: newId(),
        at: Date.now(),
        username: String(username || '').trim().toLowerCase(),
        templateId,
        values,
        spec,
        costCredits,
        status: 'queued',
        providerId: null,
        provider: null,
        videoUrl: null,
        error: null,
        refunded: false,
        updatedAt: Date.now(),
    };
    jobs.push(job);
    writeJobs(dir, jobs);
    return job;
}

export function getJob(dir, id) {
    return readJobs(dir).find(j => j.id === id) || null;
}

/** مهام مستخدم واحد، الأحدث أولاً — الواجهة لا ترى مهام غيره أبداً. */
export function listJobsByUser(dir, username, limit = 30) {
    const user = String(username || '').trim().toLowerCase();
    return readJobs(dir)
        .filter(j => j.username === user)
        .slice(-limit)
        .reverse();
}

/** كل المهام غير المنتهية — للمحرك (إرسال المصفوفة queued ومتابعة rendering). */
export function listActiveJobs(dir) {
    return readJobs(dir).filter(j => j.status === 'queued' || j.status === 'rendering');
}

export function countActiveJobsForUser(dir, username) {
    const user = String(username || '').trim().toLowerCase();
    return listActiveJobs(dir).filter(j => j.username === user).length;
}

/**
 * تحديث بانتقال حالة مضبوط. patch يقبل فقط حقول النتيجة المعروفة —
 * يُرجع المهمة المحدَّثة أو null إذا كان الانتقال غير مسموح/المهمة مفقودة.
 */
export function transitionJob(dir, id, nextStatus, patch = {}) {
    const jobs = readJobs(dir);
    const job = jobs.find(j => j.id === id);
    if (!job) return null;
    if (!ALLOWED_TRANSITIONS[job.status]?.includes(nextStatus)) return null;

    job.status = nextStatus;
    job.updatedAt = Date.now();
    for (const key of ['providerId', 'provider', 'videoUrl', 'error', 'refunded']) {
        if (key in patch) job[key] = patch[key];
    }
    writeJobs(dir, jobs);
    return { ...job };
}
