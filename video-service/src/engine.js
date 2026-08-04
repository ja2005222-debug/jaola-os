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
 *
 * مصالحة إعادة التشغيل مجانية بالتصميم: الحالة كلها في المخزن الدائم،
 * فأول دورة بعد أي تعطّل/إعادة نشر تلتقط المهام النشطة من حيث توقفت
 * (rendering تُستطلع، queued تُرسل) — لا خطوة استرجاع خاصة.
 */
import { listActiveJobs, transitionJob } from './jobs.js';
import { refundCredits } from './credits.js';

export const JOB_TIMEOUT_MS = 15 * 60 * 1000;
export const MAX_CONCURRENT_RENDERS = 2;

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
export async function runEngineTick(store, { provider, now = Date.now() }) {
    const summary = { timedOut: 0, completed: 0, failed: 0, submitted: 0, submitErrors: 0 };
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
            await transitionJob(store, job.id, 'done', {
                videoUrl: result.videoUrl ?? null,
                error: result.note ?? null,
            });
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
