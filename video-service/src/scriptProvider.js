/**
 * ✍️ scriptProvider.js — تخطيط سيناريو متعدد المشاهد من فكرة واحدة
 *
 * الفجوة التي يسدّها: "برومت واحد → فيلم كامل" (بلا هذا كان المستخدم
 * يبني كل لقطة يدوياً في الستوري بورد). هذا المزوّد **تخطيط فقط** —
 * يُرجع مسودة نصية يراجعها المستخدم ويعدّلها، ثم كل مشهد يُرسَل عبر
 * /api/video/renders العادي بكل حراساته (فلترة المحتوى، درع التكلفة،
 * الطابور) — صفر التفاف على تلك المسارات المختبَرة أصلاً.
 *
 * نقطة النهاية: أي خدمة متوافقة مع OpenAI chat/completions (Groq
 * افتراضياً) — نفس الصيغة المستخدمة فعلياً في backend/utils/aiProvider.js
 * لهذه المنصة (llama-3.3-70b-versatile عبر api.groq.com)، لا تخمين جديد
 * لصيغة API غير مؤكَّدة.
 *
 * ⚠️ مخرجات النموذج لا تُصدَّق حرفياً أبداً: هذا الملف يُرجع فقط ما فسّره
 * من JSON؛ التحقق الفعلي (خيارات cinema.js المسموحة، فلترة المحتوى) يقع
 * في server.js قبل أن يصل أي نص للمستخدم — نفس مبدأ "لا تمرير أعمى"
 * المتّبع في templates.js لمدخلات المستخدم البشري.
 */

const DEFAULT_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/** يستخرج أول كتلة JSON من رد قد يغلّفها النموذج بسياج ```json ...```. */
function extractJsonBlock(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
    return text.trim();
}

export function createScriptProvider({ apiKey, apiUrl = DEFAULT_API_URL, model = DEFAULT_MODEL, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('مفتاح مزوّد تخطيط السيناريو مطلوب.');

    return {
        name: `script:${model}`,

        /**
         * يخطّط sceneCount مشهداً من فكرة واحدة. يُرجع مصفوفة كائنات خام
         * (بلا تحقق) — كل عنصر: {prompt, caption?, shotSize?, cameraMove?,
         * lighting?, mood?, style?}. يرمي خطأً عربياً واضحاً عند أي فشل.
         */
        async planScenes({ idea, sceneCount, shotSizeOptions, cameraMoveOptions, lightingOptions, moodOptions, styleOptions }) {
            const system = [
                'أنت مساعد إخراج سينمائي يخطّط ستوري بورد قصيراً بالعربية.',
                `اقترح بالضبط ${sceneCount} مشاهد متتابعة تحكي فكرة المستخدم كقصة متماسكة (بداية ووسط ونهاية واضحة).`,
                'أعد JSON فقط — مصفوفة بلا أي نص خارجها — بهذا الشكل لكل عنصر:',
                '{"prompt": "وصف المشهد بالعربية (ما سيُرسَل لنموذج توليد الفيديو)", "caption": "كابشن قصير جداً (حتى 10 كلمات)", "shotSize": "...", "cameraMove": "...", "lighting": "...", "mood": "...", "style": "..."}',
                `shotSize يجب أن تكون إحدى: ${shotSizeOptions.join('، ')}`,
                `cameraMove يجب أن تكون إحدى: ${cameraMoveOptions.join('، ')}`,
                `lighting يجب أن تكون إحدى: ${lightingOptions.join('، ')}`,
                `mood يجب أن تكون إحدى: ${moodOptions.join('، ')}`,
                `style يجب أن تكون إحدى: ${styleOptions.join('، ')}`,
                'لا تكرر نفس القيم في كل المشاهد — نوّع حجم اللقطة وحركة الكاميرا لإيقاع بصري حقيقي.',
            ].join('\n');

            const res = await fetchImpl(apiUrl, {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: idea },
                    ],
                    temperature: 0.8,
                }),
            });
            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                throw new Error(`تعذّر الاتصال بمزوّد التخطيط (HTTP ${res.status}). ${detail.slice(0, 300)}`);
            }
            const data = await res.json();
            const content = data?.choices?.[0]?.message?.content;
            if (!content) throw new Error('مزوّد التخطيط أعاد رداً فارغاً.');

            let parsed;
            try {
                parsed = JSON.parse(extractJsonBlock(content));
            } catch {
                throw new Error('تعذّر تفسير رد مزوّد التخطيط (لم يكن JSON صالحاً).');
            }
            if (!Array.isArray(parsed)) throw new Error('رد مزوّد التخطيط ليس مصفوفة مشاهد.');
            return parsed;
        },
    };
}

/** يُبنى من البيئة — null بلا مفتاح (يخفي الميزة بالكامل، لا رابط مكسور). */
export function buildScriptProvider(env = process.env) {
    const apiKey = env.VIDEO_SCRIPT_API_KEY;
    if (!apiKey) return null;
    return createScriptProvider({
        apiKey,
        apiUrl: env.VIDEO_SCRIPT_API_URL || DEFAULT_API_URL,
        model: env.VIDEO_SCRIPT_MODEL || DEFAULT_MODEL,
    });
}
