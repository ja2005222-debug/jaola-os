/**
 * 🎭 characters.js — بنك الشخصيات (تثبيت هوية البطل عبر اللقطات)
 *
 * مشكلة الأفلام متعددة اللقطات: النص وحده يجعل النموذج يخترع وجهاً
 * جديداً كل مرة. الحل: شخصية محفوظة = وصف حرفي ثابت + ثلاث صور مرجعية
 * بزوايا مختلفة تُولَّد مرة واحدة. عند إدراج الشخصية في لقطة:
 *   1. وصفها الحرفي يُحقن في مقدمة البرومت (لا يُعاد صياغته أبداً —
 *      إعادة الصياغة هي أول أسباب تغيّر الملامح).
 *   2. في وضع image-to-video تُستخدم صورة الزاوية الأنسب إطاراً أول.
 */

export const CHARACTER_COST_CREDITS = 1; // ثلاث صور مرجعية بنموذج صور اقتصادي

export const CHARACTER_ANGLES = Object.freeze([
    {
        key: 'front', labelEn: 'Front', labelAr: 'أمامية',
        promptEn: 'front facing portrait, looking directly at the camera, full body visible',
    },
    {
        key: 'side', labelEn: 'Side', labelAr: 'جانبية',
        promptEn: 'side profile view, full body visible',
    },
    {
        key: 'back', labelEn: 'Back', labelAr: 'خلفية',
        promptEn: 'seen from behind, full body visible',
    },
]);

/** برومت صورة الزاوية: الوصف الحرفي + الزاوية + خلفية محايدة موحدة. */
export function characterImagePrompt(description, angle) {
    const a = CHARACTER_ANGLES.find(x => x.key === angle);
    return [
        description,
        a ? a.promptEn : CHARACTER_ANGLES[0].promptEn,
        'neutral studio background, character reference sheet, consistent identity, high detail',
    ].join('. ');
}

/** تحقق مدخلات إنشاء الشخصية — رسائل عربية جاهزة للعرض. */
export function validateCharacterInput({ name, description }) {
    const cleanName = String(name || '').trim();
    if (cleanName.length < 1 || cleanName.length > 60) {
        return { error: 'اسم الشخصية مطلوب (حتى 60 حرفاً).' };
    }
    const cleanDesc = String(description || '').trim();
    if (cleanDesc.length < 10 || cleanDesc.length > 500) {
        return { error: 'وصف الشخصية مطلوب (10–500 حرفاً) — كن محدداً: الملامح والملابس والعمر، فهذا الوصف يُحقن حرفياً في كل لقطة.' };
    }
    return { name: cleanName, description: cleanDesc };
}
