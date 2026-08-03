/**
 * 🎬 templates.js — كتالوج القوالب العربية (RTL) والتحقق من مدخلاتها
 *
 * كل قالب يعرّف حقولاً منمّطة (نص/لون/رابط صورة) تُتحقَّق خادمياً بصرامة،
 * ثم تُجمَّع إلى "مخطط زمني محايد" (neutral spec) لا يعرف شيئاً عن أي
 * مزود — طبقة المزودين (providers/) هي التي تترجمه لصيغة كل مزود.
 * هذا الحياد هو ما يسمح بتبديل المزود لاحقاً دون لمس القوالب.
 */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_TEXT_LEN = 200;

// التكلفة بالأرصدة لكل قالب — القوالب الأطول أغلى (تكلفة تصدير أعلى
// لدى المزود). التسعير النهائي للباقات يُدار تجارياً خارج الكود.
export const TEMPLATES = Object.freeze([
    {
        id: 'promo_announcement',
        nameAr: 'إعلان ترويجي',
        descriptionAr: 'عنوان كبير + سطر فرعي + دعوة لإجراء، على خلفية لونية متدرجة الظهور. مثالي لإعلانات العروض والتخفيضات.',
        durationSec: 8,
        costCredits: 1,
        fields: [
            { key: 'headline', labelAr: 'العنوان الرئيسي', type: 'text', required: true, maxLen: 60 },
            { key: 'subline', labelAr: 'السطر الفرعي', type: 'text', required: false, maxLen: 90 },
            { key: 'cta', labelAr: 'دعوة الإجراء (مثال: اطلب الآن)', type: 'text', required: true, maxLen: 30 },
            { key: 'bgColor', labelAr: 'لون الخلفية', type: 'color', required: false, default: '#1F4E5F' },
        ],
    },
    {
        id: 'product_showcase',
        nameAr: 'عرض منتج',
        descriptionAr: 'صورة المنتج تتوسط الشاشة مع اسمه وسعره ووصف قصير. مثالي للمتاجر.',
        durationSec: 10,
        costCredits: 1,
        fields: [
            { key: 'productName', labelAr: 'اسم المنتج', type: 'text', required: true, maxLen: 50 },
            { key: 'price', labelAr: 'السعر (نصاً، مثال: 99 ر.س)', type: 'text', required: true, maxLen: 20 },
            { key: 'description', labelAr: 'وصف قصير', type: 'text', required: false, maxLen: 120 },
            { key: 'imageUrl', labelAr: 'رابط صورة المنتج', type: 'imageUrl', required: true },
            { key: 'bgColor', labelAr: 'لون الخلفية', type: 'color', required: false, default: '#0F172A' },
        ],
    },
    {
        id: 'story_slides',
        nameAr: 'قصة من ثلاث لقطات',
        descriptionAr: 'ثلاث لقطات نصية متتابعة (مشكلة → حل → دعوة) — الأساس الذي سيُبنى عليه "تحويل المقال إلى فيديو" لاحقاً.',
        durationSec: 15,
        costCredits: 2,
        fields: [
            { key: 'slide1', labelAr: 'اللقطة الأولى', type: 'text', required: true, maxLen: 100 },
            { key: 'slide2', labelAr: 'اللقطة الثانية', type: 'text', required: true, maxLen: 100 },
            { key: 'slide3', labelAr: 'اللقطة الثالثة', type: 'text', required: true, maxLen: 100 },
            { key: 'bgColor', labelAr: 'لون الخلفية', type: 'color', required: false, default: '#1E1B4B' },
        ],
    },
]);

export function getTemplate(id) {
    return TEMPLATES.find(t => t.id === id) || null;
}

/** كتالوج للواجهة — بلا أي منطق داخلي. */
export function listTemplates() {
    return TEMPLATES.map(({ id, nameAr, descriptionAr, durationSec, costCredits, fields }) => ({
        id, nameAr, descriptionAr, durationSec, costCredits, fields,
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
    if (field.type === 'imageUrl') {
        let parsed;
        try { parsed = new URL(value); } catch { parsed = null; }
        if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
            return { error: `الحقل "${field.labelAr}" يجب أن يكون رابط صورة صالحاً (http/https).` };
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
 * يجمّع القالب + القيم المنقّاة إلى مخطط زمني محايد:
 * { durationSec, background, scenes: [{ startSec, lengthSec, layers: [...] }] }
 * الطبقات: { kind: 'title'|'text'|'image', ... } — مفهومة لكل المزودين.
 */
export function compileSpec(template, clean) {
    const bg = clean.bgColor || '#111827';

    if (template.id === 'promo_announcement') {
        const layers = [
            { kind: 'title', text: clean.headline },
            ...(clean.subline ? [{ kind: 'text', text: clean.subline }] : []),
        ];
        return {
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
