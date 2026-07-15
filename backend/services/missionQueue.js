/**
 * 🚦 Mission Queue — صف تنفيذ المهام
 *
 * كانت المهام تنفذ فورياً بلا تنسيق: مستخدمان يبنيان معاً = تنافس على
 * حصة الـ LLM (rate limits) وذاكرة العملية. هذا الصف:
 *
 * - يمنع بنائين متوازيين لنفس المشروع (username:project)
 * - يحد التوازي الكلي عبر MAX_CONCURRENT_MISSIONS (افتراضي 2)
 * - يخبر المستخدم بمركزه في الصف بدل صمت الانتظار
 */

const waiting = [];               // المهام المنتظرة
let runningCount = 0;
const activeKeys = new Set();     // مشاريع قيد التنفيذ الآن

const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_MISSIONS) || 2);

function pump() {
    while (runningCount < MAX_CONCURRENT && waiting.length > 0) {
        // أول مهمة لمشروع غير نشط حالياً
        const idx = waiting.findIndex(j => !activeKeys.has(j.key));
        if (idx === -1) break;

        const job = waiting.splice(idx, 1)[0];
        runningCount++;
        activeKeys.add(job.key);

        Promise.resolve()
            .then(job.run)
            .catch(e => console.error(`[MissionQueue] مهمة ${job.key} انتهت بخطأ:`, e.message))
            .finally(() => {
                runningCount--;
                activeKeys.delete(job.key);
                pump();
            });
    }
}

/**
 * إدراج مهمة — تنفذ فوراً إن توفرت سعة، وإلا تنتظر بدورها.
 * onWait(position) يُستدعى فقط عند الانتظار الفعلي.
 */
export function enqueueMission({ username, project, run, onWait }) {
    const key = `${username}:${project}`;

    // نفس المشروع يبني الآن؟ ارفض — الحماية من التوازي الذاتي
    if (activeKeys.has(key)) {
        return { accepted: false, reason: 'already_running' };
    }
    // نفس المشروع منتظر في الصف؟ لا تكدس طلبات مكررة
    if (waiting.some(j => j.key === key)) {
        return { accepted: false, reason: 'already_queued' };
    }

    const willWait = runningCount >= MAX_CONCURRENT;
    waiting.push({ key, run, enqueuedAt: Date.now() });

    if (willWait && onWait) {
        onWait(waiting.length);
    }

    pump();
    return { accepted: true, waited: willWait };
}

export function queueStatus() {
    return { running: runningCount, waiting: waiting.length, maxConcurrent: MAX_CONCURRENT };
}

/**
 * هل يوجد بناء *فعلي* جارٍ لهذا المشروع الآن؟ (المصدر الحقيقي للحقيقة)
 * يعتمد على حالة العملية الحالية — يعود false بعد أي إعادة تشغيل/تعطّل،
 * بعكس حالة الآلة المُخزّنة التي قد تبقى عالقة عند GENERATING.
 */
export function isMissionActive(username, project) {
    const key = `${username}:${project}`;
    return activeKeys.has(key) || waiting.some(j => j.key === key);
}
