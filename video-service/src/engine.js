/**
 * ⚙️ engine.js — محرك معالجة الطابور (دورة واحدة نقية + حارس busy)
 *
 * ترتيب الدورة (غير قابل لإعادة الترتيب):
 * 1. حسم المهلة القصوى: أي مهمة نشطة تجاوزت JOB_TIMEOUT_MS تُفشَل
 *    وتُسترد أرصدتها — لا مهمة معلقة للأبد تحتجز خصماً بلا حسم.
 * 2. استطلاع المهام rendering لدى المزود وحسم done/failed (مع استرداد
 *    عند الفشل — فشل المزود لا يكلف المستخدم).
 * 3. إرسال المهام queued (ضمن سقف تزامن) — فشل الإرسال نفسه = فشل فوري
 *    مع استرداد.
 * 4. تجميع تلقائي مؤجل ("أكمل تلقائياً" — AI Producer): مشروع سلّحه
 *    المستخدم بعد مراجعة مسودة السيناريو وإرسال كل مشاهده — بمجرد توقف
 *    كل نشاطه (لا queued ولا rendering) يُجمَّع تلقائياً بلا عودة يدوية.
 *    تُتجاوَز هذه الخطوة بصمت حين لا تُمرَّر limits/exemptFromDailyCap
 *    (الاختبارات الحالية التي لا تعنيها) — محاولة واحدة فقط لكل تسليح،
 *    نجحت أو فشلت، فلا تُعاد إلى الأبد كل دورة.
 *
 * مصالحة إعادة التشغيل مجانية بالتصميم: الحالة كلها في المخزن الدائم،
 * فأول دورة بعد أي تعطّل/إعادة نشر تلتقط المهام النشطة من حيث توقفت
 * (rendering تُستطلع، queued تُرسل) — لا خطوة استرجاع خاصة.
 */
import { listActiveJobs, transitionJob } from './jobs.js';
import { refundCredits } from './credits.js';
import { storageKeyFor } from './storage/index.js';
import { runAssembly } from './assemblyJob.js';

export const JOB_TIMEOUT_MS = 15 * 60 * 1000;
export const MAX_CONCURRENT_RENDERS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ينسخ الفيديو المكتمل إلى تخزيننا فور جاهزيته — هنا تتحقق "ملكية
 * الملف": يصبح لدينا نسخة مستقلة عن استضافة المزوّد المؤقتة.
 * يُرجع {storageKey, videoUrl} للحالة النهائية.
 *
 * فشل النسخ **لا يُفشل المهمة**: المستخدم دفع وحصل على فيديو، فنُبقي
 * رابط المزوّد كاحتياط شفاف بدل إهدار رصيده — ويُسجَّل الفشل.
 */
async function mirrorToStorage(storage, job, providerUrl) {
    if (!storage || !providerUrl) return { storageKey: null, videoUrl: providerUrl ?? null };
    try {
        const key = storageKeyFor({ username: job.username, jobId: job.id });
        await storage.mirrorFromUrl(providerUrl, key);
        // لا نحفظ رابط المزوّد بعد النسخ: التنزيل يمر بمسارنا الذي يوقّع
        // رابطاً قصير الأجل بعد التحقق من الملكية.
        return { storageKey: key, videoUrl: null };
    } catch (e) {
        console.warn(`⚠️ تعذّر نسخ فيديو المهمة ${job.id} إلى التخزين: ${e.message}`);
        return { storageKey: null, videoUrl: providerUrl };
    }
}

async function failWithRefund(store, job, error) {
    // الاسترداد قبل الانتقال: لو انهارت العملية بينهما تعيد دورة لاحقة
    // الإفشال بأمان — الاسترداد نفسه معصوم من الازدواج لكل مهمة.
    if (!job.refunded) {
        await refundCredits(store, {
            username: job.username,
            amount: job.costCredits,
            jobId: job.id,
            reason: error,
        });
    }
    return transitionJob(store, job.id, 'failed', { error, refunded: true });
}

/** دورة معالجة واحدة نقية — تُستدعى من المجدول أو من الاختبارات مباشرة. */
export async function runEngineTick(store, {
    provider, storage = null, retentionDays = 0, now = Date.now(),
    limits = null, isAdminUser = null, maxActiveJobsPerUser = 3,
}) {
    const summary = {
        timedOut: 0, completed: 0, failed: 0, submitted: 0, submitErrors: 0, mirrored: 0, purged: 0,
        autoAssembled: 0, autoAssembleSkipped: 0,
    };
    const active = await listActiveJobs(store);

    // 1) المهلة القصوى أولاً — تُقيَّم على عمر المهمة الكلي منذ إنشائها.
    for (const job of active) {
        if (now - job.at > JOB_TIMEOUT_MS) {
            await failWithRefund(store, job, 'تجاوزت المهمة المهلة القصوى للمعالجة.');
            summary.timedOut += 1;
        }
    }

    // 2) استطلاع قيد التصدير (على الحالة الطازجة بعد حسم المهلة).
    const rendering = (await listActiveJobs(store)).filter(j => j.status === 'rendering');
    for (const job of rendering) {
        let result;
        try {
            result = await provider.getRender(job.providerId);
        } catch {
            continue; // فشل استطلاع عابر (شبكة) — الدورة التالية تعيد المحاولة.
        }
        if (result.status === 'done') {
            // النسخ قبل الانتقال: المهمة لا تُعلَن مكتملة إلا وقد استقر
            // مصير ملفها (نُسخ إلينا، أو بقي على رابط المزوّد صراحةً).
            const { storageKey, videoUrl } = await mirrorToStorage(storage, job, result.videoUrl);
            await transitionJob(store, job.id, 'done', {
                videoUrl,
                storageKey,
                error: result.note ?? null,
            });
            if (storageKey) summary.mirrored += 1;
            summary.completed += 1;
        } else if (result.status === 'failed') {
            await failWithRefund(store, job, result.error || 'فشل التصدير لدى المزود.');
            summary.failed += 1;
        }
        // 'rendering' → لا شيء، الدورة القادمة تعيد الاستطلاع.
    }

    // 3) إرسال المهام المنتظرة ضمن سقف التزامن (الأقدم أولاً — عدالة FIFO).
    const fresh = await listActiveJobs(store);
    let inFlight = fresh.filter(j => j.status === 'rendering').length;
    for (const job of fresh.filter(j => j.status === 'queued')) {
        if (inFlight >= MAX_CONCURRENT_RENDERS) break;
        try {
            const { providerId } = await provider.submitRender(job.spec);
            await transitionJob(store, job.id, 'rendering', { providerId, provider: provider.name });
            inFlight += 1;
            summary.submitted += 1;
        } catch (e) {
            await failWithRefund(store, job, `فشل الإرسال للمزود: ${e.message}`);
            summary.submitErrors += 1;
        }
    }

    // 4) تجميع تلقائي مؤجل — انظر الشرح أعلى الملف.
    if (limits && isAdminUser) {
        const pendingProjects = await store.listProjectsWithPendingAutoAssemble();
        for (const project of pendingProjects) {
            const shots = await store.listJobsByProject(project.id);
            if (shots.some(s => s.status === 'queued' || s.status === 'rendering')) continue;
            // ننزع التسليح فوراً — محاولة واحدة فقط بغضّ النظر عن النتيجة،
            // فلا يُعاد فشل عابر (بوابة مؤقتة) إلى الأبد كل دورة.
            await store.setProjectAutoAssemble(project.id, null);
            const ready = shots.filter(s => s.status === 'done' && (s.videoUrl || s.storageKey));
            if (ready.length === 0) { summary.autoAssembleSkipped += 1; continue; }
            try {
                const result = await runAssembly(store, {
                    project, username: project.username, storage,
                    resolved: project.autoAssemble.resolved, rawValues: project.autoAssemble.raw,
                    limits, exemptPerUser: isAdminUser({ username: project.username }),
                    maxActiveJobsPerUser, watermarkText: project.autoAssemble.watermarkText || null,
                });
                if (result.job) summary.autoAssembled += 1;
                else summary.autoAssembleSkipped += 1;
            } catch (e) {
                console.warn(`⚠️ تعذّر التجميع التلقائي للمشروع ${project.id}: ${e.message}`);
                summary.autoAssembleSkipped += 1;
            }
        }
    }

    // 5) تنظيف الاحتفاظ: حذف الملفات التي تجاوزت المدة المعلنة للمستخدم.
    // يُنفَّذ أخيراً حتى لا يؤخر معالجة المهام الحية، ولا يعمل إطلاقاً
    // بلا تخزين مفعَّل أو بمدة احتفاظ = 0 (احتفاظ دائم).
    if (storage && retentionDays > 0) {
        const cutoff = now - retentionDays * DAY_MS;
        for (const expired of await store.listExpiredStorageJobs(cutoff)) {
            try {
                await storage.remove(expired.storageKey);
                await store.clearStorageKey(expired.id);
                summary.purged += 1;
            } catch (e) {
                // فشل حذف واحد لا يوقف البقية — يُعاد في الدورة القادمة.
                console.warn(`⚠️ تعذّر حذف ملف المهمة ${expired.id}: ${e.message}`);
            }
        }
    }

    return summary;
}

// ─── الحارس المشترك بين الحلقة المجدولة وأي استدعاء يدوي ───────────────
let engineBusy = false;

export async function runEngineTickGuarded(store, opts) {
    if (engineBusy) return { skipped: true };
    engineBusy = true;
    try {
        return await runEngineTick(store, opts);
    } catch (e) {
        // لا نُسقط الحلقة المجدولة بخطأ دورة واحدة — يُسجَّل ويُتجاوز.
        console.error('⚠️ خطأ في دورة محرك الفيديو:', e.message);
        return { error: e.message };
    } finally {
        engineBusy = false;
    }
}
