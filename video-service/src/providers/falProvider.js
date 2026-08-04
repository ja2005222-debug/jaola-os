/**
 * 🤖 falProvider.js — توليد فيديو بالذكاء الاصطناعي عبر fal.ai
 *
 * fal.ai مجمّع نماذج: نموذج واحد يُضبط بـFAL_MODEL (Veo/Kling/Wan…)،
 * فتبديل النموذج تغييرُ متغيّر بيئة لا كود — وهو جوهر اختيار مجمّع بدل
 * التعاقد المباشر مع مزوّد واحد.
 *
 * الطابور غير متزامن بطبيعته: الإرسال يُرجع request_id فوراً، والنتيجة
 * تُستطلع لاحقاً — وهو ما يطابق محرّكنا تماماً بلا أي تعديل عليه.
 *
 * ⚠️ تحقق مطلوب عند أول تشغيل حقيقي: أسماء حقول **مُخرجات** النماذج
 * تختلف بينها (video.url / videos[0].url / output.video.url…)، لذا
 * extractVideoUrl أدناه يجرّبها بالترتيب. إن جاء نموذج بشكل مختلف
 * فسيُسجَّل الرد كاملاً في السجل ليُضاف شكله — لا تخمين صامت.
 */

const QUEUE_BASE = 'https://queue.fal.run';

/** يستخرج رابط الفيديو من رد النموذج مهما اختلف تسمية حقله. */
export function extractVideoUrl(data) {
    return (
        data?.video?.url ||
        data?.videos?.[0]?.url ||
        data?.output?.video?.url ||
        (typeof data?.video === 'string' ? data.video : null) ||
        data?.url ||
        null
    );
}

/** يترجم المخطط المحايد إلى مدخلات النموذج. */
export function specToFalInput(spec) {
    return {
        prompt: spec.prompt,
        aspect_ratio: spec.aspectRatio || '16:9',
        duration: spec.durationSec,
    };
}

export function createFalProvider({ apiKey, model, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('FAL_KEY مطلوب لمزوّد fal.');
    // لا نضع نموذجاً افتراضياً: معرّفات النماذج تتغيّر وتُهجَر، وافتراضٌ
    // خاطئ يعني فشل كل مهمة بسبب غامض. الضبط الصريح أوضح وأصدق.
    if (!model) throw new Error('FAL_MODEL مطلوب (مثال: fal-ai/veo3/fast) — راجع كتالوج نماذج fal.ai.');

    const headers = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' };
    const modelPath = String(model).replace(/^\/+|\/+$/g, '');

    return {
        name: `fal:${modelPath}`,
        specKinds: ['ai_prompt'],

        async submitRender(spec) {
            const res = await fetchImpl(`${QUEUE_BASE}/${modelPath}`, {
                method: 'POST', headers, body: JSON.stringify(specToFalInput(spec)),
            });
            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                throw new Error(`fal.ai رفض الإرسال (HTTP ${res.status}). ${detail.slice(0, 200)}`);
            }
            const data = await res.json();
            const providerId = data?.request_id;
            if (!providerId) throw new Error('fal.ai لم يُرجع request_id.');
            return { providerId };
        },

        async getRender(providerId) {
            const statusRes = await fetchImpl(
                `${QUEUE_BASE}/${modelPath}/requests/${providerId}/status`, { headers }
            );
            if (!statusRes.ok) {
                // فشل استطلاع عابر ليس فشل التوليد — يحسمه الاستطلاع
                // التالي أو مهلة المحرك القصوى.
                return { status: 'rendering' };
            }
            const { status } = await statusRes.json();
            if (status !== 'COMPLETED') {
                // IN_QUEUE / IN_PROGRESS — ما زال يعمل.
                return { status: 'rendering' };
            }

            const resultRes = await fetchImpl(`${QUEUE_BASE}/${modelPath}/requests/${providerId}`, { headers });
            if (!resultRes.ok) {
                return { status: 'failed', error: `fal.ai تعذّر جلب النتيجة (HTTP ${resultRes.status}).` };
            }
            const data = await resultRes.json();
            const videoUrl = extractVideoUrl(data);
            if (!videoUrl) {
                // شكل مخرجات غير متوقّع: نسجّله كاملاً ليُضاف لـextractVideoUrl
                // بدل ابتلاعه بصمت.
                console.error('⚠️ رد fal.ai بلا رابط فيديو معروف:', JSON.stringify(data).slice(0, 500));
                return { status: 'failed', error: 'اكتمل التوليد لكن تعذّر استخراج رابط الفيديو من رد المزوّد.' };
            }
            return { status: 'done', videoUrl };
        },
    };
}
