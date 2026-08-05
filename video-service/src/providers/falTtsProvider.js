/**
 * 🗣️ falTtsProvider.js — تعليق صوتي (Voiceover) للفيلم المُجمَّع عبر fal.ai
 *
 * النقل (إرسال → استطلاع حالة → جلب نتيجة) هو **نفس** طابور fal
 * الموثَّق في falProvider.js وfalImageProvider.js — مُثبَت بالفعل مع
 * الفيديو والصور، فخطره معروف. المجهول الوحيد فعلياً هو حقلا مُدخل
 * ومُخرج نموذج TTS تحديداً (يختلفان بين النماذج):
 * - النص يُرسل بحقل "text" (شبه عالمي بين واجهات TTS، خلافاً لحقل
 *   duration في falProvider.js الذي اختلف اسمه ونوعه فعلاً بين النماذج).
 * - الصوت (متحدث/لهجة) اختياري عبر FAL_TTS_VOICE — يُرسل فقط عند
 *   ضبطه، فغيابه لا يُفشل الإرسال بحقل مجهول لدى النموذج.
 * - extractAudioUrl يجرّب عدة أسماء حقول محتملة، ويسجّل الرد كاملاً
 *   عند الفشل بدل تخمين صامت (نفس نهج extractVideoUrl/extractImageUrl).
 *
 * ⚠️ اختيار النموذج نفسه (FAL_TTS_MODEL) مسؤولية صاحب المنصة عمداً —
 * لا نموذج افتراضياً هنا: كتالوج نماذج TTS ودعمها للعربية يتغيّر بلا
 * إشعار، وتوثيق fal.ai الفعلي غير متاح من بيئة التطوير هذه. الميزة
 * تبقى مخفية بالكامل ما لم يُضبط FAL_TTS_MODEL صراحة — وأول استخدام
 * حقيقي يحتاج تحققاً من أن الصوت الناتج مفهوم وباللغة الصحيحة فعلاً.
 */

const QUEUE_BASE = 'https://queue.fal.run';

/** يستخرج رابط الصوت من رد النموذج مهما اختلفت تسميته. */
export function extractAudioUrl(data) {
    return (
        data?.audio?.url ||
        data?.audio_url ||
        (typeof data?.audio === 'string' ? data.audio : null) ||
        data?.url ||
        null
    );
}

export function createFalTtsProvider({
    apiKey, model, voice = null, fetchImpl = fetch,
    sleep = ms => new Promise(r => setTimeout(r, ms)),
    pollMs = 1500, maxWaitMs = 60_000,
}) {
    if (!apiKey) throw new Error('FAL_KEY مطلوب للتعليق الصوتي.');
    if (!model) throw new Error('نموذج TTS مطلوب (FAL_TTS_MODEL).');

    const headers = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' };
    const modelPath = String(model).replace(/^\/+|\/+$/g, '');
    const appPath = modelPath.split('/').slice(0, 2).join('/');

    return {
        name: `fal-tts:${modelPath}`,

        /** يولّد تعليقاً صوتياً من نص عربي ويعيد رابط الصوت. */
        async generateSpeech(text) {
            const input = { text, ...(voice ? { voice } : {}) };
            const submit = await fetchImpl(`${QUEUE_BASE}/${modelPath}`, {
                method: 'POST', headers, body: JSON.stringify(input),
            });
            if (!submit.ok) {
                const detail = await submit.text().catch(() => '');
                throw new Error(`fal.ai رفض طلب التعليق الصوتي (HTTP ${submit.status}). ${detail.slice(0, 200)}`);
            }
            const { request_id: requestId } = await submit.json();
            if (!requestId) throw new Error('fal.ai لم يُرجع request_id لطلب التعليق الصوتي.');

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
                            throw new Error(`فشل توليد التعليق الصوتي (HTTP ${resultRes.status}). ${detail.slice(0, 300)}`);
                        }
                        const data = await resultRes.json();
                        const url = extractAudioUrl(data);
                        if (!url) {
                            console.error('⚠️ رد TTS من fal بلا رابط صوت معروف:', JSON.stringify(data).slice(0, 500));
                            throw new Error('اكتمل التوليد لكن تعذّر استخراج رابط الصوت.');
                        }
                        return url;
                    }
                }
                await sleep(pollMs);
            }
            throw new Error('انتهت مهلة توليد التعليق الصوتي — أعد المحاولة.');
        },
    };
}

/** يُبنى من البيئة — null ما لم يُضبط FAL_TTS_MODEL صراحة (يخفي الميزة كلياً). */
export function buildTtsProvider(env = process.env) {
    const aiName = String(env.VIDEO_AI_PROVIDER || '').toLowerCase();
    if (aiName !== 'fal' || !env.FAL_TTS_MODEL) return null;
    return createFalTtsProvider({
        apiKey: env.FAL_KEY,
        model: env.FAL_TTS_MODEL,
        voice: env.FAL_TTS_VOICE || null,
    });
}
