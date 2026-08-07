/**
 * ✍️🎬 scriptProvider.js — تخطيط سيناريو متعدد المشاهد من فكرة واحدة
 *
 * الفجوة التي يسدّها: "برومت واحد → فيلم كامل" (بلا هذا كان المستخدم
 * يبني كل لقطة يدوياً في الستوري بورد). هذا المزوّد **تخطيط فقط** —
 * يُرجع مسودة نصية يراجعها المستخدم ويعدّلها، ثم كل مشهد يُرسَل عبر
 * /api/video/renders العادي بكل حراساته (فلترة المحتوى، درع التكلفة،
 * الطابور) — صفر التفاف على تلك المسارات المختبَرة أصلاً.
 *
 * 📝🎬 كاتب ثم مخرج — مرحلتان منفصلتان حقاً، لا وهم "فريق وكلاء":
 * لا يوجد هنا أي نموذج "مدرَّب" خصيصاً لأي دور (صفر تدريب — نفس صراحة
 * توثيق محاكاة LoRA). ما يوجد فعلياً مرحلتان متتاليتان على نفس النموذج
 * العام، لكل منهما مسؤولية مختلفة تماماً ومخرجات مختلفة الشكل، فتُختبر
 * وتُفشل باستقلالية — لا مجرد برومت واحد مطوَّل يخلط "ماذا يحدث" مع
 * "كيف يُصوَّر":
 *   1. writeStory  (الكاتب) — فكرة واحدة → عنوان + ملخص + أحداث سردية
 *      متتابعة، كل حدث بجملة معنى + "شعور سائد" (بلا أي تفصيل بصري).
 *   2. directScenes (المخرج) — الأحداث السردية → لقطات ملموسة (برومت
 *      بصري لكل حدث + معايير إخراج cinema.js)، مع مواءمة الإضاءة/المزاج
 *      لـ"الشعور السائد" الذي كتبه الكاتب بدل اختيار عشوائي.
 * planScenes() تُنسّق الاثنتين تباعاً وتُعيد {title, logline, scenes} —
 * نفس الواجهة الخارجية التي يستهلكها server.js.
 *
 * نقطة النهاية: أي خدمة متوافقة مع OpenAI chat/completions (Groq
 * افتراضياً) — نفس الصيغة المستخدمة فعلياً في backend/utils/aiProvider.js
 * لهذه المنصة (llama-3.3-70b-versatile عبر api.groq.com)، لا تخمين جديد
 * لصيغة API غير مؤكَّدة.
 *
 * ⚠️ مخرجات النموذج لا تُصدَّق حرفياً أبداً في أي من المرحلتين: هذا
 * الملف يُرجع فقط ما فسّره من JSON؛ التحقق الفعلي (خيارات cinema.js
 * المسموحة، فلترة المحتوى) يقع في server.js قبل أن يصل أي نص للمستخدم —
 * نفس مبدأ "لا تمرير أعمى" المتّبع في templates.js لمدخلات المستخدم.
 */

const DEFAULT_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/**
 * يستخرج أول كتلة JSON من رد قد يغلّفها النموذج بسياج ```json ...``` —
 * مصفوفة (directScenes) أو كائن (writeStory وgenerateMarketingCopy)، حتى
 * لو كان أحدهما متداخلاً داخل الآخر (مثل beats/hashtags كمصفوفة ضمن
 * كائن): أيهما يبدأ أولاً في النص هو الغلاف الخارجي الفعلي.
 */
function extractJsonBlock(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    const arrStart = text.indexOf('[');
    const objStart = text.indexOf('{');
    const useArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    if (useArray) {
        const arrEnd = text.lastIndexOf(']');
        if (arrEnd > arrStart) return text.slice(arrStart, arrEnd + 1);
    }
    if (objStart !== -1) {
        const objEnd = text.lastIndexOf('}');
        if (objEnd > objStart) return text.slice(objStart, objEnd + 1);
    }
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
         * الكاتب: فكرة واحدة → {title, logline, beats: [{summary, emotion}]}.
         * سردي بحت — بلا أي تفصيل بصري. يرمي خطأً عربياً واضحاً عند أي فشل.
         */
        async writeStory({ idea, sceneCount }) {
            const system = [
                'أنت كاتب سيناريو محترف يبني قصة قصيرة متماسكة بالعربية من فكرة واحدة.',
                `اكتب بالضبط ${sceneCount} أحداثاً سردية متتابعة (بداية تُقدّم الموقف، تصعيد أو تطوّر في الوسط، وذروة/خاتمة في النهاية) — لا تصف كيف تُصوَّر، فقط ماذا يحدث.`,
                'أعد JSON فقط — كائن واحد بلا أي نص خارجه — بهذا الشكل بالضبط:',
                '{"title": "عنوان قصير جذاب للفيلم (حتى 6 كلمات)", "logline": "جملة واحدة تلخّص القصة كاملة", "beats": [{"summary": "وصف الحدث السردي بهذا المشهد (جملة أو جملتان)", "emotion": "كلمة أو كلمتان تصفان الشعور السائد في هذه اللحظة (مثل: فضول، توتر متصاعد، مفاجأة، ارتياح)"}]}',
                `عدد عناصر beats يجب أن يكون بالضبط ${sceneCount}.`,
                'اجعل المشاعر عبر beats تتدرّج بشكل قصصي حقيقي (لا تكرار مسطّح) — تصاعد وانفراج له معنى.',
            ].join('\n');

            const parsed = await chatJson(system, idea);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('رد الكاتب ليس كائناً صالحاً.');
            }
            if (!Array.isArray(parsed.beats)) throw new Error('رد الكاتب لا يحوي أحداثاً سردية صالحة.');
            return parsed;
        },

        /**
         * المخرج: أحداث سردية (من writeStory) → مصفوفة لقطات ملموسة —
         * كل عنصر: {prompt, caption?, shotSize?, cameraMove?, lighting?,
         * mood?, style?}. يوائم mood/lighting مع "الشعور السائد" لكل حدث.
         */
        async directScenes({ beats, shotSizeOptions, cameraMoveOptions, lightingOptions, moodOptions, styleOptions }) {
            const system = [
                'أنت مخرج سينمائي محترف يحوّل أحداثاً سردية جاهزة إلى لقطات بصرية ملموسة بالعربية.',
                'لكل حدث سردي أدناه بترتيبه، اصنع لقطة واحدة: صف المشهد بصرياً (ما سيُرسَل لنموذج توليد فيديو) واختر معايير الإخراج.',
                'أعد JSON فقط — مصفوفة بلا أي نص خارجها، بنفس عدد وترتيب الأحداث أدناه — بهذا الشكل لكل عنصر:',
                '{"prompt": "وصف بصري للمشهد بالعربية (ما سيُرسَل لنموذج توليد الفيديو) — يعكس حدث القصة لا نص القصة حرفياً", "caption": "كابشن قصير جداً (حتى 10 كلمات)", "shotSize": "...", "cameraMove": "...", "lighting": "...", "mood": "...", "style": "..."}',
                `shotSize يجب أن تكون إحدى: ${shotSizeOptions.join('، ')}`,
                `cameraMove يجب أن تكون إحدى: ${cameraMoveOptions.join('، ')}`,
                `lighting يجب أن تكون إحدى: ${lightingOptions.join('، ')}`,
                `mood يجب أن تعكس "الشعور السائد" المرفق مع كل حدث، واختر أقرب قيمة من: ${moodOptions.join('، ')}`,
                `style يجب أن تكون إحدى: ${styleOptions.join('، ')}`,
                'نوّع حجم اللقطة وحركة الكاميرا والإضاءة عبر اللقطات لإيقاع بصري حقيقي يخدم قوس المشاعر الوارد.',
            ].join('\n');
            const user = beats.map((b, i) => `${i + 1}. الحدث: ${b.summary}\n   الشعور السائد: ${b.emotion || ''}`).join('\n');

            const parsed = await chatJson(system, user);
            if (!Array.isArray(parsed)) throw new Error('رد المخرج ليس مصفوفة مشاهد.');
            return parsed;
        },

        /**
         * ينسّق الكاتب ثم المخرج تباعاً. يُرجع {title, logline, scenes} —
         * scenes مصفوفة كائنات خام (بلا تحقق نهائي، يقع في server.js).
         * يرمي خطأً عربياً واضحاً عند أي فشل في أي من المرحلتين.
         */
        async planScenes({ idea, sceneCount, shotSizeOptions, cameraMoveOptions, lightingOptions, moodOptions, styleOptions }) {
            const story = await this.writeStory({ idea, sceneCount });
            const scenes = await this.directScenes({
                beats: story.beats,
                shotSizeOptions, cameraMoveOptions, lightingOptions, moodOptions, styleOptions,
            });
            return { title: story.title, logline: story.logline, scenes };
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
