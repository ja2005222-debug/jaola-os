/**
 * 🎬 templates.js — كتالوج القوالب العربية (RTL) والتحقق من مدخلاتها
 *
 * كل قالب يعرّف حقولاً منمّطة (نص/لون/رابط صورة) تُتحقَّق خادمياً بصرامة،
 * ثم تُجمَّع إلى "مخطط زمني محايد" (neutral spec) لا يعرف شيئاً عن أي
 * مزود — طبقة المزودين (providers/) هي التي تترجمه لصيغة كل مزود.
 * هذا الحياد هو ما يسمح بتبديل المزود لاحقاً دون لمس القوالب.
 */

import { CINEMA_CONTROLS, cinemaFieldOptions, composeCinematicPrompt } from './cinema.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_TEXT_LEN = 200;

// نوعا المخرجات اللذان تعرفهما الخدمة. المخطط المُجمَّع يحمل kind،
// وطبقة المزودين توجّه كل نوع لمزوّده — فلا يتلقى مزوّد تركيب مخططَ
// توليد ولا العكس.
export const SPEC_TIMELINE = 'timeline';   // تركيب قوالب (Shotstack…)
export const SPEC_AI_PROMPT = 'ai_prompt'; // توليد من وصف نصي (fal.ai…)

// حقول مشتركة بين قوالب التوليد — مصدر واحد لتسمياتها (عربي/إنجليزي)
// بدل تكرارها حرفياً في ستة قوالب. تسميات معايير الإخراج تأتي من
// cinema.js نفسه (labelAr/labelEn هناك) فلا ازدواج مصدر أبداً.
const cinemaField = (key) => {
    const c = CINEMA_CONTROLS.find(x => x.key === key);
    return { key, labelAr: c.labelAr, labelEn: c.labelEn, type: 'choice', required: false, options: cinemaFieldOptions(key) };
};
// القائمة الكاملة للنسب هنا؛ النموذج المختار يقيّدها أكثر (يتحقق
// الخادم، وتعرض الواجهة نسب النموذج فقط).
const aspectField = (def) => ({
    key: 'aspectRatio', labelAr: 'نسبة الأبعاد', labelEn: 'Aspect ratio', type: 'choice', required: false,
    default: def, options: ['16:9', '9:16', '1:1', '21:9', '4:3'],
});
const negativeField = () => ({
    key: 'negativePrompt', labelAr: 'ما لا تريد رؤيته (اختياري)', labelEn: "What you don't want to see (optional)",
    type: 'text', required: false, maxLen: 300,
});

// التكلفة بالأرصدة لكل قالب — القوالب الأطول أغلى (تكلفة تصدير أعلى
// لدى المزود). التسعير النهائي للباقات يُدار تجارياً خارج الكود.
export const TEMPLATES = Object.freeze([
    {
        id: 'promo_announcement',
        nameEn: 'Promo announcement',
        descriptionEn: 'Big headline + subline + call to action over an animated gradient background. Perfect for offers and sale ads.',
        nameAr: 'إعلان ترويجي',
        descriptionAr: 'عنوان كبير + سطر فرعي + دعوة لإجراء، على خلفية لونية متدرجة الظهور. مثالي لإعلانات العروض والتخفيضات.',
        durationSec: 8,
        costCredits: 1,
        fields: [
            { key: 'headline', labelEn: 'Main headline', labelAr: 'العنوان الرئيسي', type: 'text', required: true, maxLen: 60 },
            { key: 'subline', labelEn: 'Subline', labelAr: 'السطر الفرعي', type: 'text', required: false, maxLen: 90 },
            { key: 'cta', labelEn: 'Call to action (e.g., Order now)', labelAr: 'دعوة الإجراء (مثال: اطلب الآن)', type: 'text', required: true, maxLen: 30 },
            { key: 'bgColor', labelEn: 'Background color', labelAr: 'لون الخلفية', type: 'color', required: false, default: '#1F4E5F' },
        ],
    },
    {
        id: 'product_showcase',
        nameEn: 'Product showcase',
        descriptionEn: 'The product image takes center screen with its name, price and a short description. Perfect for stores.',
        nameAr: 'عرض منتج',
        descriptionAr: 'صورة المنتج تتوسط الشاشة مع اسمه وسعره ووصف قصير. مثالي للمتاجر.',
        durationSec: 10,
        costCredits: 1,
        fields: [
            { key: 'productName', labelEn: 'Product name', labelAr: 'اسم المنتج', type: 'text', required: true, maxLen: 50 },
            { key: 'price', labelEn: 'Price (as text, e.g., $99)', labelAr: 'السعر (نصاً، مثال: 99 ر.س)', type: 'text', required: true, maxLen: 20 },
            { key: 'description', labelEn: 'Short description', labelAr: 'وصف قصير', type: 'text', required: false, maxLen: 120 },
            { key: 'imageUrl', labelEn: 'Product image URL', labelAr: 'رابط صورة المنتج', type: 'imageUrl', required: true },
            { key: 'bgColor', labelEn: 'Background color', labelAr: 'لون الخلفية', type: 'color', required: false, default: '#0F172A' },
        ],
    },
    {
        id: 'ai_clip',
        nameEn: 'AI cinematic shot',
        descriptionEn: 'Describe the scene and set the direction — shot size, camera movement, lighting and style — and a full shot is generated with the model you choose.',
        nameAr: 'لقطة سينمائية بالذكاء الاصطناعي',
        descriptionAr: 'صف المشهد واضبط الإخراج — حجم اللقطة وحركة الكاميرا والإضاءة والأسلوب — فتُولَّد لقطة كاملة بالنموذج الذي تختاره.',
        durationSec: 5,
        costCredits: 5, // تكلفة افتراضية — النموذج المختار يحدد التكلفة الفعلية
        specKind: SPEC_AI_PROMPT,
        fields: [
            { key: 'prompt', labelEn: 'Scene description', labelAr: 'وصف المشهد المطلوب', type: 'text', required: true, maxLen: 1000 },
            aspectField('16:9'),
            // 🎥 معايير الإخراج — اختيارية كلها؛ تُركَّب مصطلحاتها
            // الإنجليزية في الوصف النهائي (انظر cinema.js).
            cinemaField('shotSize'),
            cinemaField('cameraMove'),
            cinemaField('lighting'),
            cinemaField('mood'),
            cinemaField('style'),
            negativeField(),
            // 📝 كابشن اختياري — لا يدخل في وصف التوليد إطلاقاً (compileSpec
            // لا يقرأ هذا الحقل)، يُحفظ فقط ليُحرق كنص فوق اللقطة عند
            // التجميع إن اختار المستخدم ذلك (راجع assembly.js).
            { key: 'caption', labelEn: 'Caption burned over the shot at assembly (optional)', labelAr: 'كابشن يُحرق فوق اللقطة عند التجميع (اختياري)', type: 'text', required: false, maxLen: 80 },
        ],
    },
    {
        id: 'ai_image_clip',
        nameEn: 'Shot from a reference image (consistent character)',
        descriptionEn: 'Upload your hero image once and make it the first frame of every shot — the same person/product persists across your film instead of the model inventing a new face every time.',
        nameAr: 'لقطة من صورة مرجعية (شخصية ثابتة)',
        descriptionAr: 'ارفع صورة بطلك مرة واحدة واجعلها الإطار الأول لكل لقطة — فيبقى الشخص/المنتج نفسه عبر مشاهد فيلمك بدل أن يخترع النموذج وجهاً جديداً كل مرة.',
        durationSec: 5,
        costCredits: 5, // النموذج المختار يحدد التكلفة الفعلية
        specKind: SPEC_AI_PROMPT,
        aiInput: 'image', // لا تصلح له إلا نماذج image-to-video من الكتالوج
        fields: [
            // غير إلزامي: البديل شخصية من البنك — الخادم يرفض غياب الاثنين معاً.
            { key: 'imageUrl', labelEn: 'Reference image URL (first frame) — or pick a character', labelAr: 'رابط الصورة المرجعية (الإطار الأول) — أو اختر شخصية', type: 'imageUrl', required: false },
            { key: 'prompt', labelEn: 'What happens in this shot?', labelAr: 'ماذا يحدث في اللقطة؟', type: 'text', required: true, maxLen: 1000 },
            aspectField('16:9'),
            cinemaField('cameraMove'),
            cinemaField('lighting'),
            cinemaField('mood'),
            cinemaField('style'),
            negativeField(),
            { key: 'caption', labelEn: 'Caption burned over the shot at assembly (optional)', labelAr: 'كابشن يُحرق فوق اللقطة عند التجميع (اختياري)', type: 'text', required: false, maxLen: 80 },
        ],
    },
    // 🎥 قوالب صنّاع الفيديو — نفس بنية ai_clip (prompt + معايير إخراج +
    // caption) بلا أي منطق تجميع جديد؛ الفرق كله في التوجيه والمقاسات
    // الافتراضية المناسبة لصيغ صنّاع المحتوى القصيرة تحديداً، بدل قوالب
    // الإعلانات التسويقية العامة أعلاه.
    {
        id: 'faceless_channel_short',
        nameEn: 'Faceless YouTube channel',
        descriptionEn: 'A vertical shot with no visible face — a hand, a product, a nature scene or an abstract detail — with a text hook on top. The most popular format on YouTube Shorts and automated facts/story channels.',
        nameAr: 'قناة يوتيوب بلا وجه',
        descriptionAr: 'لقطة عمودية بلا وجه ظاهر — يد، منتج، مشهد طبيعي، أو تفصيل مجرَّد — مع خطاف نصي فوقها. الصيغة الأكثر انتشاراً في يوتيوب شورتس وقنوات "الحقائق/القصص" الآلية.',
        durationSec: 5,
        costCredits: 5,
        specKind: SPEC_AI_PROMPT,
        fields: [
            { key: 'prompt', labelEn: 'Describe the scene (e.g., camera slowly closing in on a steaming coffee cup on a wooden table on a rainy morning)', labelAr: 'صف المشهد (مثال: كاميرا تقترب ببطء من كوب قهوة يتصاعد منه البخار على طاولة خشب في صباح ماطر)', type: 'text', required: true, maxLen: 1000 },
            aspectField('9:16'),
            cinemaField('shotSize'),
            cinemaField('cameraMove'),
            cinemaField('lighting'),
            cinemaField('mood'),
            cinemaField('style'),
            negativeField(),
            { key: 'caption', labelEn: '📝 Opening hook — big text over the scene (e.g., the strangest fact you will hear today)', labelAr: '📝 الخطاف الافتتاحي — نص كبير فوق المشهد (مثال: أغرب حقيقة لن تصدقها اليوم)', type: 'text', required: false, maxLen: 80 },
        ],
    },
    {
        id: 'podcast_highlight',
        nameEn: 'Podcast visual highlight',
        descriptionEn: 'A calm visual scene (abstract background / sound waves / studio) centered on a standout quote from the episode — perfect for short promo clips on social media.',
        nameAr: 'ملخص بودكاست مرئي',
        descriptionAr: 'مشهد بصري هادئ (خلفية مجردة/موجات صوت/استوديو) يتوسطه اقتباس بارز من الحلقة — مثالي لمقاطع الترويج القصيرة على السوشال ميديا.',
        durationSec: 5,
        costCredits: 5,
        specKind: SPEC_AI_PROMPT,
        fields: [
            { key: 'prompt', labelEn: 'Describe the visual background (e.g., glowing purple sound waves pulsing slowly on a dark background, modern podcast studio)', labelAr: 'صف الخلفية البصرية (مثال: موجات صوت متوهجة بنفسجية تنبض ببطء على خلفية داكنة، استوديو بودكاست عصري)', type: 'text', required: true, maxLen: 1000 },
            aspectField('1:1'),
            cinemaField('shotSize'),
            cinemaField('cameraMove'),
            cinemaField('lighting'),
            cinemaField('mood'),
            cinemaField('style'),
            negativeField(),
            { key: 'caption', labelEn: '📝 Standout quote from the episode — shown as text over the scene', labelAr: '📝 الاقتباس البارز من الحلقة — يظهر كنص فوق المشهد', type: 'text', required: false, maxLen: 80 },
        ],
    },
    {
        id: 'product_review_clip',
        nameEn: 'Quick product review',
        descriptionEn: 'A shot that showcases a product in a realistic review style — clean studio lighting or a real usage setting — with a takeaway or rating text on top.',
        nameAr: 'مراجعة منتج سريعة',
        descriptionAr: 'لقطة تُبرز منتجاً بأسلوب مراجعة واقعي — إضاءة استوديو نظيفة أو بيئة استخدام حقيقية — مع خلاصة أو تقييم نصي فوقها.',
        durationSec: 5,
        costCredits: 5,
        specKind: SPEC_AI_PROMPT,
        fields: [
            { key: 'prompt', labelEn: 'Describe the product and scene (e.g., a hand holding white wireless earbuds, rotating them slowly against a light grey background with soft studio lighting)', labelAr: 'صف المنتج والمشهد (مثال: يد تمسك سماعة لاسلكية بيضاء وتديرها ببطء أمام خلفية رمادية فاتحة بإضاءة استوديو ناعمة)', type: 'text', required: true, maxLen: 1000 },
            aspectField('9:16'),
            cinemaField('shotSize'),
            cinemaField('cameraMove'),
            cinemaField('lighting'),
            cinemaField('mood'),
            cinemaField('style'),
            negativeField(),
            { key: 'caption', labelEn: '📝 Takeaway or rating — shown as text over the scene (e.g., worth buying ✅)', labelAr: '📝 الخلاصة أو التقييم — يظهر كنص فوق المشهد (مثال: يستحق الشراء ✅)', type: 'text', required: false, maxLen: 80 },
        ],
    },
    {
        id: 'story_slides',
        nameEn: 'Three-shot story',
        descriptionEn: 'Three sequential text shots (problem → solution → call) — the foundation for "article to video" later.',
        nameAr: 'قصة من ثلاث لقطات',
        descriptionAr: 'ثلاث لقطات نصية متتابعة (مشكلة → حل → دعوة) — الأساس الذي سيُبنى عليه "تحويل المقال إلى فيديو" لاحقاً.',
        durationSec: 15,
        costCredits: 2,
        fields: [
            { key: 'slide1', labelEn: 'First shot', labelAr: 'اللقطة الأولى', type: 'text', required: true, maxLen: 100 },
            { key: 'slide2', labelEn: 'Second shot', labelAr: 'اللقطة الثانية', type: 'text', required: true, maxLen: 100 },
            { key: 'slide3', labelEn: 'Third shot', labelAr: 'اللقطة الثالثة', type: 'text', required: true, maxLen: 100 },
            { key: 'bgColor', labelEn: 'Background color', labelAr: 'لون الخلفية', type: 'color', required: false, default: '#1E1B4B' },
        ],
    },
]);

export function getTemplate(id) {
    return TEMPLATES.find(t => t.id === id) || null;
}

/** كتالوج للواجهة — بلا أي منطق داخلي. */
export function listTemplates() {
    return TEMPLATES.map(({ id, nameAr, nameEn, descriptionAr, descriptionEn, durationSec, costCredits, fields, specKind, aiInput }) => ({
        id, nameAr, nameEn, descriptionAr, descriptionEn, durationSec, costCredits, fields,
        specKind: specKind || SPEC_TIMELINE,
        aiInput: aiInput || (specKind === SPEC_AI_PROMPT ? 'text' : null),
    }));
}

function validateField(field, raw) {
    if (raw == null || raw === '') {
        if (field.required) return { error: `الحقل "${field.labelAr}" مطلوب.` };
        return { value: field.default ?? '' };
    }
    if (typeof raw !== 'string') return { error: `الحقل "${field.labelAr}" يجب أن يكون نصاً.` };
    const value = raw.trim();

    if (field.type === 'text') {
        const maxLen = field.maxLen || MAX_TEXT_LEN;
        if (value.length > maxLen) return { error: `الحقل "${field.labelAr}" يتجاوز الحد (${maxLen} حرفاً).` };
        return { value };
    }
    if (field.type === 'color') {
        if (!HEX_COLOR.test(value)) return { error: `الحقل "${field.labelAr}" يجب أن يكون لوناً سداسياً مثل #1F4E5F.` };
        return { value };
    }
    if (field.type === 'choice') {
        if (!field.options.includes(value)) {
            return { error: `قيمة "${field.labelAr}" غير مسموحة (المتاح: ${field.options.join('، ')}).` };
        }
        return { value };
    }
    if (field.type === 'imageUrl') {
        // صورة مرفوعة من جهاز المستخدم: توكن `upload:uploads/...` بدل رابط —
        // شكله فقط يُفحص هنا؛ الملكية والوجود يفحصهما server.js عند الحل
        // لرابط موقّع (نفس تقسيم المسؤولية مع فلترة المحتوى).
        if (/^upload:uploads\/[a-z0-9_-]+\/[a-z0-9_-]+\.(png|jpg|webp)$/i.test(value)) {
            return { value };
        }
        let parsed;
        try { parsed = new URL(value); } catch { parsed = null; }
        if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
            return { error: `الحقل "${field.labelAr}" يجب أن يكون رابط صورة صالحاً (http/https) أو صورة مرفوعة.` };
        }
        if (value.length > 500) return { error: `رابط "${field.labelAr}" أطول من المسموح.` };
        return { value };
    }
    return { error: `نوع حقل غير معروف: ${field.type}` };
}

/**
 * يتحقق من مدخلات المستخدم ضد تعريف القالب ويُرجع القيم المنقّاة.
 * أي حقل غير معرَّف في القالب يُرفض صراحةً — لا تمرير أعمى للمزود.
 */
export function validateValues(template, rawValues) {
    const values = rawValues && typeof rawValues === 'object' ? rawValues : {};
    const knownKeys = new Set(template.fields.map(f => f.key));
    for (const key of Object.keys(values)) {
        if (!knownKeys.has(key)) return { error: `حقل غير معروف: ${key}` };
    }
    const clean = {};
    for (const field of template.fields) {
        const result = validateField(field, values[field.key]);
        if (result.error) return { error: result.error };
        clean[field.key] = result.value;
    }
    return { values: clean };
}

/**
 * يجمّع القالب + القيم المنقّاة إلى **مخطط محايد** عن أي مزود، بأحد شكلين
 * يميّزهما الحقل `kind`:
 *
 *  timeline  → { kind, durationSec, background, scenes: [{startSec, lengthSec, layers}] }
 *              الطبقات: {kind:'title'|'text'|'image'} — لمزوّدي التركيب.
 *  ai_prompt → { kind, durationSec, prompt, aspectRatio }
 *              — لمزوّدي التوليد بالذكاء الاصطناعي.
 *
 * هذا الحياد هو ما يسمح بتبديل المزود أو إضافة غيره بلا لمس القوالب.
 */
export function compileSpec(template, clean) {
    if (template.specKind === SPEC_AI_PROMPT) {
        return {
            kind: SPEC_AI_PROMPT,
            durationSec: template.durationSec,
            // الوصف النهائي مركَّب: وصف المستخدم + معايير الإخراج المختارة
            // بمصطلحاتها الإنجليزية + "Avoid: …" للوصف السلبي.
            prompt: composeCinematicPrompt(clean),
            aspectRatio: clean.aspectRatio || '16:9',
            // الصورة المرجعية (إن وُجدت) — إطار أول لوضع image-to-video.
            ...(clean.imageUrl ? { imageUrl: clean.imageUrl } : {}),
        };
    }

    const bg = clean.bgColor || '#111827';

    if (template.id === 'promo_announcement') {
        const layers = [
            { kind: 'title', text: clean.headline },
            ...(clean.subline ? [{ kind: 'text', text: clean.subline }] : []),
        ];
        return {
            kind: SPEC_TIMELINE,
            durationSec: template.durationSec,
            background: bg,
            scenes: [
                { startSec: 0, lengthSec: 5, layers },
                { startSec: 5, lengthSec: 3, layers: [{ kind: 'title', text: clean.cta }] },
            ],
        };
    }

    if (template.id === 'product_showcase') {
        return {
            kind: SPEC_TIMELINE,
            durationSec: template.durationSec,
            background: bg,
            scenes: [
                {
                    startSec: 0, lengthSec: 10,
                    layers: [
                        { kind: 'image', url: clean.imageUrl },
                        { kind: 'title', text: clean.productName },
                        { kind: 'text', text: [clean.price, clean.description].filter(Boolean).join(' — ') },
                    ],
                },
            ],
        };
    }

    if (template.id === 'story_slides') {
        return {
            kind: SPEC_TIMELINE,
            durationSec: template.durationSec,
            background: bg,
            scenes: [
                { startSec: 0, lengthSec: 5, layers: [{ kind: 'title', text: clean.slide1 }] },
                { startSec: 5, lengthSec: 5, layers: [{ kind: 'title', text: clean.slide2 }] },
                { startSec: 10, lengthSec: 5, layers: [{ kind: 'title', text: clean.slide3 }] },
            ],
        };
    }

    // قالب معرَّف في الكتالوج بلا مجمّع — خطأ برمجي داخلي، لا خطأ مستخدم.
    throw new Error(`لا مجمّع للقالب: ${template.id}`);
}
