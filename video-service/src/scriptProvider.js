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

/**
 * يستخرج أول كتلة JSON من رد قد يغلّفها النموذج بسياج ```json ...``` —
 * مصفوفة (planScenes) أو كائن (generateMarketingCopy) على السواء.
 */
function extractJsonBlock(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) return text.slice(arrStart, arrEnd + 1);
    const objStart = text.indexOf('{');
    const objEnd = text.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) return text.slice(objStart, objEnd + 1);
    return text.trim();
}

export function createScriptProvider({ apiKey, apiUrl = DEFAULT_API_URL, model = DEFAULT_MODEL, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('مفتاح مزوّد تخطيط السيناريو مطلوب.');

    /** نداء نصي عام لنفس نقطة النهاية — planScenes وgenerateMarketingCopy يتشاركانه. */
    async function chatJson(system, user) {
        const res = await fetchImpl(apiUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
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
        try {
            return JSON.parse(extractJsonBlock(content));
        } catch {
            throw new Error('تعذّر تفسير رد مزوّد التخطيط (لم يكن JSON صالحاً).');
        }
    }

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

            const parsed = await chatJson(system, idea);
            if (!Array.isArray(parsed)) throw new Error('رد مزوّد التخطيط ليس مصفوفة مشاهد.');
            return parsed;
        },

        /**
         * نص تسويقي (عنوان + كابشن + هاشتاقات) من عنوان المشروع ومشاهده —
         * يُستهلَك ضمن "حزمة تسويقية". يُرجع كائناً خاماً (بلا تحقق):
         * {headline?, caption?, hashtags?}. يرمي خطأً عربياً واضحاً عند
         * أي فشل — نفس انضباط planScenes، مخرجاته لا تُصدَّق حرفياً أبداً
         * (التحقق والفلترة الفعلية في server.js قبل وصول أي نص للمستخدم).
         */
        async generateMarketingCopy({ projectTitle, shotPrompts }) {
            const system = [
                'أنت مسوّق محتوى محترف يكتب نصاً ترويجياً قصيراً بالعربية لفيديو قصير.',
                'أعد JSON فقط — كائن واحد بلا أي نص خارجه — بهذا الشكل بالضبط:',
                '{"headline": "عنوان جذاب حتى 8 كلمات", "caption": "كابشن ترويجي حتى 200 حرف يناسب السوشال ميديا", "hashtags": ["وسم1", "وسم2", "..."]}',
                'الهاشتاقات: 5 إلى 8 وسوم عربية أو إنجليزية قصيرة ذات صلة، بلا علامة # نفسها.',
                'لا مبالغة ولا وعود كاذبة ولا لغة تحريضية — نبرة احترافية جذابة فقط.',
            ].join('\n');
            const user = `عنوان المشروع: ${projectTitle}\nمشاهد الفيلم:\n${shotPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;

            const parsed = await chatJson(system, user);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('رد مزوّد النص التسويقي ليس كائناً صالحاً.');
            }
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
