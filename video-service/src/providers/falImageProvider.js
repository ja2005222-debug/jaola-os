/**
 * 🖼️ falImageProvider.js — توليد صور مرجعية (بنك الشخصيات) عبر fal.ai
 *
 * الصور تُولَّد في ثوانٍ لا دقائق، فالتدفق هنا **متزامن مع استطلاع
 * قصير** داخل نفس الطلب — لا يمر بطابور المهام (المصمم لمهام الفيديو
 * الطويلة). نفس قواعد fal الموثقة في falProvider.js تنطبق حرفياً:
 * الإرسال بالمسار الكامل، والمتابعة بمعرّف التطبيق (أول جزأين)،
 * و4xx عند النتيجة يعني فشل التوليد نفسه بتفاصيل تستحق الإظهار.
 */

const QUEUE_BASE = 'https://queue.fal.run';

/** يستخرج رابط الصورة من رد النموذج مهما اختلفت تسميته. */
export function extractImageUrl(data) {
    return (
        data?.images?.[0]?.url ||
        data?.image?.url ||
        (typeof data?.image === 'string' ? data.image : null) ||
        null
    );
}

export function createFalImageProvider({
    apiKey, model, fetchImpl = fetch,
    sleep = ms => new Promise(r => setTimeout(r, ms)),
    pollMs = 1500, maxWaitMs = 60_000,
}) {
    if (!apiKey) throw new Error('FAL_KEY مطلوب لتوليد الصور.');
    if (!model) throw new Error('نموذج صور مطلوب (مثال: fal-ai/flux/schnell).');

    const headers = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' };
    const modelPath = String(model).replace(/^\/+|\/+$/g, '');
    const appPath = modelPath.split('/').slice(0, 2).join('/');

    return {
        name: `fal-image:${modelPath}`,

        /** يولّد صورة واحدة ويعيد رابطها — يرمي خطأً عربياً واضحاً عند الفشل. */
        async generateImage(prompt) {
            const submit = await fetchImpl(`${QUEUE_BASE}/${modelPath}`, {
                method: 'POST', headers, body: JSON.stringify({ prompt }),
            });
            if (!submit.ok) {
                const detail = await submit.text().catch(() => '');
                throw new Error(`fal.ai رفض طلب الصورة (HTTP ${submit.status}). ${detail.slice(0, 200)}`);
            }
            const { request_id: requestId } = await submit.json();
            if (!requestId) throw new Error('fal.ai لم يُرجع request_id لطلب الصورة.');

            const deadline = Date.now() + maxWaitMs;
            while (Date.now() < deadline) {
                const statusRes = await fetchImpl(
                    `${QUEUE_BASE}/${appPath}/requests/${requestId}/status`, { headers }
                );
                if (statusRes.status === 401 || statusRes.status === 403) {
                    const detail = await statusRes.text().catch(() => '');
                    throw new Error(`fal.ai رفض الاستطلاع (HTTP ${statusRes.status}) — تحقق من المفتاح/الرصيد. ${detail.slice(0, 200)}`);
                }
                if (statusRes.ok) {
                    const { status } = await statusRes.json();
                    if (status === 'COMPLETED') {
                        const resultRes = await fetchImpl(`${QUEUE_BASE}/${appPath}/requests/${requestId}`, { headers });
                        if (!resultRes.ok) {
                            const detail = await resultRes.text().catch(() => '');
                            throw new Error(`فشل توليد الصورة (HTTP ${resultRes.status}). ${detail.slice(0, 300)}`);
                        }
                        const data = await resultRes.json();
                        const url = extractImageUrl(data);
                        if (!url) {
                            console.error('⚠️ رد صورة fal بلا رابط معروف:', JSON.stringify(data).slice(0, 500));
                            throw new Error('اكتمل التوليد لكن تعذّر استخراج رابط الصورة.');
                        }
                        return url;
                    }
                }
                await sleep(pollMs);
            }
            throw new Error('انتهت مهلة توليد الصورة — أعد المحاولة.');
        },
    };
}

/** يُبنى من البيئة — null حين لا توليد صور (يخفي بنك الشخصيات). */
export function buildImageProvider(env = process.env) {
    // توليد الصور يتبع تفعيل توليد الفيديو: نفس المفتاح، ونموذج صور
    // قابل للتبديل بمتغير واحد (flux/schnell الافتراضي: سريع ورخيص).
    const aiName = String(env.VIDEO_AI_PROVIDER || '').toLowerCase();
    if (aiName !== 'fal') return null;
    return createFalImageProvider({
        apiKey: env.FAL_KEY,
        model: env.FAL_IMAGE_MODEL || 'fal-ai/flux/schnell',
    });
}
