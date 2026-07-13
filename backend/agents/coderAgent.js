import { deepseek, groq, ai } from './baseAgent.js';
import { buildContextPrompt } from './knowledgeEngine.js';

// ============================================================
// 🌐 لغة الموقع المُولَّد — يجب أن تطابق لغة المستخدم
// ============================================================
const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);
const LANG_NAMES = {
    ar: 'Arabic (العربية)', en: 'English', fr: 'French (Français)', es: 'Spanish (Español)',
    de: 'German (Deutsch)', tr: 'Turkish (Türkçe)', pt: 'Portuguese (Português)',
    ur: 'Urdu (اردو)', nl: 'Dutch (Nederlands)', ru: 'Russian (Русский)',
    zh: 'Chinese (中文)', ja: 'Japanese (日本語)', ko: 'Korean (한국어)',
    it: 'Italian (Italiano)', hi: 'Hindi (हिन्दी)',
};

function langMeta(lang = 'en') {
    const code = (lang || 'en').toLowerCase();
    const isRTL = RTL_LANGS.has(code);
    return {
        code,
        isRTL,
        dir: isRTL ? 'rtl' : 'ltr',
        name: LANG_NAMES[code] || 'English',
        fonts: isRTL
            ? 'Arabic Google Fonts (Cairo, Tajawal or Almarai)'
            : 'modern Latin Google Fonts (Inter, Poppins, Manrope or Montserrat)',
    };
}

// ============================================================
// 🎨 System Prompt الاحترافي — قلب جودة JAOLA OS (يتكيّف مع لغة المستخدم)
// ============================================================
function buildCoderSystemPrompt(lang = 'en') {
    const L = langMeta(lang);
    return `أنت مهندس ويب خبير متخصص في بناء مواقع HTML/CSS/JavaScript احترافية ومتكاملة.

## 🌐 لغة الموقع (قاعدة حرجة لا تُخالَف):
- لغة المستخدم المستهدفة: **${L.name}** (code: ${L.code}, direction: ${L.dir}).
- **كل النصوص المرئية للمستخدم** (العناوين، الفقرات، الأزرار، القوائم، النماذج، الفوتر، أسماء المنتجات/الأقسام) يجب أن تُكتب بلغة **${L.name}** حصراً.
- لا تخلط لغتين. لا تفترض العربية افتراضياً — التزم بلغة المستخدم أعلاه بالضبط.
- استخدم dir="${L.dir}" lang="${L.code}" على وسم <html>، وصمّم التخطيط ليناسب اتجاه ${L.dir}.

## قواعد الإخراج الصارمة (لا تنتهكها أبداً):

١. **التنسيق الإلزامي** — أخرج الملفات بهذا الشكل الحرفي بالضبط:
// FILE: index.html
[كود HTML كامل هنا]
// FILE: styles.css
[كود CSS كامل هنا]
// FILE: script.js
[كود JavaScript كامل هنا]

٢. **لا تختصر أبداً** — اكتب الكود كاملاً حتى آخر سطر. لا تكتب "// ... بقية الكود" أو "/* تكملة */" أو أي اختصار.

٣. **الملفات الثلاثة إلزامية دائماً** — حتى لو script.js فارغ، اكتبه.

## معايير الجودة الإلزامية:

### index.html:
- DOCTYPE وmeta charset وviewport إلزامية
- استخدم ${L.fonts}
- استخدم Font Awesome للأيقونات (CDN)
- اربط styles.css وscript.js
- هيكل HTML5 معنوي (header, main, section, footer)
- dir="${L.dir}" lang="${L.code}" على الـ html
- محتوى واقعي ومفصّل بلغة ${L.name} (ليس placeholder) — أسماء حقيقية، أرقام، وصف

### styles.css:
- CSS Variables في :root لكل الألوان والمقاسات
- Reset CSS في البداية
- تصميم متجاوب بـ CSS Grid وFlexbox
- Mobile-first (ابدأ بالجوال، استخدم @media للشاشات الكبيرة)
- Smooth transitions وanimations على التفاعلات
- Hover effects على كل العناصر التفاعلية
- الألوان: استخدم التدرجات اللونية (gradients) ولا تستخدم لوناً واحداً مسطحاً
- اجعل الأزرار والحقول جميلة ومريحة (padding كافٍ، border-radius)
- **مهم جداً**: حدد لون النص صراحةً لكل element رئيسي لتجنب مشاكل التباين

### script.js:
- Use Strict في البداية
- أضف تفاعلاً حقيقياً: قائمة متحركة للجوال، scroll animations، form validation
- DOMContentLoaded للتهيئة
- لا تستخدم jQuery — Vanilla JS فقط

## ⚙️ المكوّنات الوظيفية (الأهم — يفرّق التطبيق عن البروشور):
إذا وُجد في الطلب "مخطط التطبيق" بمكوّنات وظيفية (بحث، فلترة، حجز، حاسبة، سلة، قائمة مهام...):
- ابنِها كميزات **تعمل فعلاً** في script.js — ليست عناصر ثابتة للعرض فقط.
- عرّف بيانات وهمية واقعية كمصفوفة كائنات في script.js (مثل: مصفوفة رحلات/منتجات/عقارات بأسماء وأسعار حقيقية).
- حقل البحث/الفلترة: يقرأ المدخلات، يُصفّي البيانات، ويعرض النتائج ديناميكياً في DOM عند الضغط أو الكتابة.
- النماذج: تتحقق من المدخلات وتعرض نتيجة واضحة داخل الصفحة (بطاقة تأكيد/نتائج) لا مجرد alert.
- التطبيق التفاعلي محوره ميزته الأساسية في الأعلى — ابنِها أولاً وبشكل بارز، ثم الأقسام الداعمة.
- مثال: تطبيق طيران = نموذج بحث (من/إلى/تاريخ) يُصفّي مصفوفة رحلات ويعرض النتائج المطابقة ببطاقات.

## معايير التصميم البصري:
- **عصري ومميز**: لا تستخدم Bootstrap أو أي framework CSS
- **صور**: استخدم Unsplash بـ https://images.unsplash.com/photo-ID?w=800&q=80 (أضف صوراً واقعية مناسبة للمحتوى)
- **الهيدر**: شريط تنقل ثابت (sticky) بخلفية شبه شفافة مع backdrop-filter
- **Hero section**: كبير ومؤثر مع صورة خلفية أو تدرج لوني جذاب
- **الأقسام**: متنوعة ومنظمة بـ Grid Cards
- **الفوتر**: احترافي مع روابط ومعلومات تواصل
- **الألوان**: استخرجها من طلب المستخدم أو اختر لوحة ألوان متناسقة ومميزة`;
}

// ============================================================
// 🔧 Parse متين للملفات — يتعامل مع كل حالات الانحراف
// ============================================================
function parseResponseToFiles(responseText) {
    if (!responseText || typeof responseText !== 'string') return [];

    const files = [];

    // المحاولة الأولى: التنسيق الرسمي // FILE: name
    const fileRegex = /\/\/\s*FILE:\s*([^\n\r]+)\s*[\n\r]+([\s\S]*?)(?=\/\/\s*FILE:|$)/gi;
    let match;
    while ((match = fileRegex.exec(responseText)) !== null) {
        const name = match[1].trim();
        const content = match[2].trim();
        if (name && content.length > 10) { // تجاهل الملفات الفارغة أو شبه الفارغة
            files.push({ name, content });
        }
    }

    if (files.length > 0) return files;

    // المحاولة الثانية: ابحث عن كتل كود مسماة بـ markdown
    const mdRegex = /```(?:html|css|javascript|js)\s*(?:\/\/\s*(?:FILE:|file:)\s*(\S+))?\s*\n([\s\S]*?)```/gi;
    let idx = 0;
    const defaultNames = ['index.html', 'styles.css', 'script.js'];
    while ((match = mdRegex.exec(responseText)) !== null) {
        const name = match[1]?.trim() || defaultNames[idx] || `file${idx}.txt`;
        const content = match[2]?.trim();
        if (content && content.length > 10) {
            files.push({ name, content });
            idx++;
        }
    }

    if (files.length > 0) return files;

    // المحاولة الثالثة: استخرج HTML مباشرة إذا لم يُوجد تنسيق
    const htmlMatch = responseText.match(/<!DOCTYPE[\s\S]*<\/html>/i);
    if (htmlMatch) {
        files.push({ name: 'index.html', content: htmlMatch[0] });
        // حاول استخراج CSS مضمّن من style tags
        const styleMatch = responseText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
            files.push({ name: 'styles.css', content: styleMatch[1].trim() });
        }
        // حاول استخراج JS مضمّن من script tags
        const scriptMatch = responseText.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (scriptMatch && !scriptMatch[1].includes('src=')) {
            files.push({ name: 'script.js', content: scriptMatch[1].trim() });
        }
    }

    return files;
}

// ============================================================
// 🚀 الدالة الرئيسية مع Fallback للنماذج
// ============================================================
export async function coreGenerateCodePlan(prompt, currentCodeContext, visualIdentity, images, onChunk, templateSections, lang = 'en') {
    // 🆕 استخدام Knowledge Engine لتوليد سياق غني ومخصص
    const knowledgeContext = buildContextPrompt(prompt);
    const L = langMeta(lang);
    const systemPrompt = buildCoderSystemPrompt(lang);

    const sectionsGuide = templateSections && templateSections.length > 0
        ? `\n## أقسام الموقع المطلوبة (الزامية، ابنِ كل قسم بالتفصيل):\n${templateSections.map((s, i) => `${i+1}. ${s}`).join('\n')}`
        : '';

    const userMessage = `## المطلوب بناؤه:
${prompt}

${knowledgeContext}

## الهوية البصرية الإضافية المطلوبة:
${visualIdentity || 'اتبع الروح التصميمية من Knowledge Engine أعلاه'}
${sectionsGuide}

## الكود الحالي للمشروع (اقرأه وطوّره أو ابنِ جديداً):
${currentCodeContext && currentCodeContext.trim().length > 50
    ? currentCodeContext.substring(0, 6000)
    : 'لا يوجد كود سابق — ابنِ المشروع من الصفر بكود كامل ومفصّل'}

## تذكير إلزامي:
- 🌐 لغة كل المحتوى المرئي: **${L.name}** حصراً — dir="${L.dir}" lang="${L.code}" على <html>
- اكتب الكود كاملاً بدون اختصار
- تباين الألوان إلزامي: خلفية داكنة → نص فاتح (#fff أو #f1f5f9)، خلفية فاتحة → نص داكن (#111 أو #1a1a2e)
- إذا استخدمت --bg-dark أو background داكن في body، يجب أن يكون color: #ffffff أو color: #f1f5f9
- لا تضع نصاً داكناً على خلفية داكنة أبداً
- استخدم CSS Variables من :root في كل الألوان
- استخدم التنسيق: // FILE: name
- ثلاثة ملفات: index.html وstyles.css وscript.js`;

    // قائمة النماذج بالأولوية — إذا فشل الأول، يجرب الثاني، إلخ
    const modelPipeline = [
        {
            name: 'DeepSeek Coder',
            call: () => callDeepSeek(userMessage, onChunk, systemPrompt)
        },
        {
            name: 'Groq Llama',
            call: () => callGroq(userMessage, onChunk, systemPrompt)
        },
        {
            name: 'Gemini',
            call: () => callGemini(userMessage, systemPrompt)
        }
    ];

    for (const model of modelPipeline) {
        try {
            const responseText = await model.call();
            if (!responseText || responseText.length < 100) continue;

            const files = parseResponseToFiles(responseText);
            if (files.length > 0) {
                return { files, images: [] };
            }

            console.warn(`[CoderAgent] ${model.name}: رد بدون ملفات قابلة للاستخراج. جاري تجربة النموذج التالي...`);
        } catch (err) {
            console.warn(`[CoderAgent] ${model.name} فشل: ${err.message}. جاري تجربة النموذج التالي...`);
        }
    }

    return { error: true, details: 'فشلت جميع النماذج في توليد كود صالح.' };
}

// ============================================================
// ✂️ تعديل جراحي — يُعيد فقط الملفات المتغيّرة (لا يعيد بناء كل شيء)
// ============================================================
export async function coreEditCodePlan(instruction, currentFiles = [], lang = 'en', onChunk) {
    const L = langMeta(lang);
    const filesBlock = currentFiles
        .map(f => `// FILE: ${f.name}\n${(f.content || '').slice(0, 8000)}`)
        .join('\n\n');

    const systemPrompt = `أنت محرّر كود جراحي خبير. لديك ملفات مشروع ويب قائم، والمستخدم يريد **تعديلاً محدداً**.

## قواعد صارمة:
- طبّق **أقل تغيير ممكن** لتحقيق طلب المستخدم — لا تُعِد تصميم أو إعادة كتابة ما لم يُطلب.
- أعِد **فقط الملفات التي تغيّرت فعلاً**، كل ملف كاملاً، بصيغة: // FILE: name
- **لا تُعِد** الملفات غير المتغيّرة إطلاقاً.
- حافظ على كل شيء آخر كما هو تماماً (المحتوى، البنية، الأسماء، الاتجاه، اللغة ${L.name}).
- إن كان التعديل في ملف واحد فقط، أعِد ذلك الملف فقط.
- لا تشرح، أخرِج الملفات فقط بالصيغة المطلوبة.`;

    const userMessage = `## طلب التعديل:
${instruction}

## ملفات المشروع الحالية:
${filesBlock || '(لا ملفات)'}

أعِد الملفات المتغيّرة فقط بصيغة // FILE: name`;

    const pipeline = [
        () => callDeepSeek(userMessage, onChunk, systemPrompt),
        () => callGroq(userMessage, onChunk, systemPrompt),
        () => callGemini(userMessage, systemPrompt),
    ];
    for (const call of pipeline) {
        try {
            const responseText = await call();
            if (!responseText || responseText.length < 30) continue;
            const files = parseResponseToFiles(responseText);
            // احتفظ فقط بالملفات ذات المحتوى الفعلي
            const changed = files.filter(f => f.content && f.content.trim().length > 5);
            if (changed.length > 0) return { files: changed };
        } catch (err) {
            console.warn(`[CoderAgent:edit] فشل نموذج: ${err.message}`);
        }
    }
    return { error: true, details: 'تعذّر تطبيق التعديل الجراحي.' };
}

// ============================================================
// 🤖 دوال استدعاء النماذج
// ============================================================
async function callDeepSeek(userMessage, onChunk, systemPrompt = buildCoderSystemPrompt('en')) {
    if (onChunk) {
        const stream = await deepseek.chat.completions.create({
            model: 'deepseek-coder',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 8000,
            stream: true,
        });

        let fullResponse = '';
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                onChunk(content);
            }
        }
        return fullResponse;
    }

    const completion = await deepseek.chat.completions.create({
        model: 'deepseek-coder',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 8000,
        stream: false,
    });
    return completion.choices[0].message.content;
}

async function callGroq(userMessage, onChunk, systemPrompt = buildCoderSystemPrompt('en')) {
    if (onChunk) {
        const stream = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 8000,
            stream: true,
        });

        let fullResponse = '';
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                onChunk(content);
            }
        }
        return fullResponse;
    }

    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 8000,
    });
    return completion.choices[0].message.content;
}

async function callGemini(userMessage, systemPrompt = buildCoderSystemPrompt('en')) {
    if (!ai) throw new Error('Gemini غير مُفعّل (GEMINI_API_KEY غير موجود)');
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
            ],
            generationConfig: { maxOutputTokens: 8000, temperature: 0.3 }
        });
        return result.response?.text() || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
        throw new Error(`Gemini: ${e.message}`);
    }
}
