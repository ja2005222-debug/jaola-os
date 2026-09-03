/**
 * 🖼️ falImageProvider.js — توليد صور الشعارات عبر fal.ai
 *
 * نفس نمط video-service/src/providers/falImageProvider.js المتحقق منه
 * في الإنتاج: إرسال بالمسار الكامل، متابعة بمعرّف التطبيق (أول جزأين)،
 * استطلاع قصير متزامن داخل الطلب (الصور ثوانٍ لا دقائق).
 *
 * الفرق الوحيد: generateImage تقبل مدخلات إضافية (مقاس، صيغة…) تُدمج
 * في جسم الطلب — الشعارات تحتاج مربعاً و PNG بينما مسودات الفيديو لا.
 *
 * 💰 نموذجان لا واحد — جوهر هندسة التكلفة في jalogo:
 *   draft (رخيص، flux/schnell) → مسودات الزائر المجهول، ٤ صور بسنتات.
 *   final (أجود، flux/dev افتراضياً) → النسخة النهائية بعد التسجيل فقط.
 * LOGO_FINAL_MODEL يسمح بترقية النهائي (مثلاً Recraft V3 المتخصص
 * بالشعارات) بعد التحقق من مساره في لوحة fal — بلا نشر كود.
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
        async generateImage(prompt, extraInput = {}) {
            const submit = await fetchImpl(`${QUEUE_BASE}/${modelPath}`, {
                method: 'POST', headers, body: JSON.stringify({ prompt, ...extraInput }),
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

/**
 * يبني مزوّدَي المسودة والنهائي من البيئة — null حين لا مفتاح (وضع
 * التطوير بلا توليد حقيقي؛ الخادم يرفض التشغيل بلا مزوّد إلا في الاختبار).
 */
export function buildLogoProviders(env = process.env) {
    if (!env.FAL_KEY) return { draft: null, final: null };
    return {
        draft: createFalImageProvider({
            apiKey: env.FAL_KEY,
            model: env.LOGO_DRAFT_MODEL || 'fal-ai/flux/schnell',
        }),
        final: createFalImageProvider({
            apiKey: env.FAL_KEY,
            model: env.LOGO_FINAL_MODEL || 'fal-ai/flux/dev',
        }),
    };
}
