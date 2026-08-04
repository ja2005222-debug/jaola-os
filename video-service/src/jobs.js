/**
 * 📋 jobs.js — قواعد دورة حياة المهمة (منطق أعمال نقي فوق المخزن)
 *
 * دورة الحياة: queued → rendering → done | failed
 * (queued → failed مباشرة إذا فشل الإرسال للمزود نفسه).
 * الانتقالات محصورة في خريطة صريحة هنا، ويُطبّقها المخزن ذرّياً — فلا
 * يمكن إحياء مهمة منتهية ولا تنفيذ نفس الانتقال مرتين من عمليتين.
 */

export const JOB_STATUSES = Object.freeze(['queued', 'rendering', 'done', 'failed']);

const ALLOWED_FROM = Object.freeze({
    rendering: ['queued'],
    done: ['rendering'],
    failed: ['queued', 'rendering'],
    queued: [], // لا انتقال إلى queued أبداً — حالة البداية فقط
});

export async function createJob(store, { username, templateId, values, spec, costCredits }) {
    return store.createJob({
        username: String(username || '').trim().toLowerCase(),
        templateId, values, spec, costCredits,
        status: 'queued',
    });
}

export async function getJob(store, id) {
    return store.getJob(id);
}

/** مهام مستخدم واحد، الأحدث أولاً — الواجهة لا ترى مهام غيره أبداً. */
export async function listJobsByUser(store, username, limit = 30) {
    return store.listJobsByUser(String(username || '').trim().toLowerCase(), limit);
}

/** كل المهام غير المنتهية — للمحرك (إرسال queued ومتابعة rendering). */
export async function listActiveJobs(store) {
    return store.listActiveJobs();
}

export async function countActiveJobsForUser(store, username) {
    const user = String(username || '').trim().toLowerCase();
    const active = await store.listActiveJobs();
    return active.filter(j => j.username === user).length;
}

/**
 * تحديث بانتقال حالة مضبوط. يُرجع المهمة المحدَّثة، أو null إذا كان
 * الانتقال غير مسموح أو سبقه انتقال آخر (تسابق) أو المهمة مفقودة.
 */
export async function transitionJob(store, id, nextStatus, patch = {}) {
    const from = ALLOWED_FROM[nextStatus];
    if (!from || from.length === 0) return null;
    return store.transitionJob(id, { from, to: nextStatus, patch });
}
