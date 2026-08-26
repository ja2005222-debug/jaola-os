/**
 * ✍️ prompts.js — مُركِّب برومبت الشعار (أيقونة فقط، بلا نص داخل الصورة)
 *
 * قرار المنتج الحاسم هنا: **النموذج يولّد الرمز/الأيقونة فقط** — اسم
 * العلامة لا يُطلب من النموذج أبداً. السبب مزدوج:
 *   1. كل نماذج توليد الصور ضعيفة في رسم الحروف، والعربية أسوأ حالاً —
 *      حروف مشوّهة تُفشل الانطباع الأول للخدمة كلها.
 *   2. الاسم المركّب كنصٍّ حقيقي فوق الأيقونة (في الواجهة) يبقى حاداً
 *      بأي مقاس، ويُبدَّل خطُّه ولونه فوراً بلا إعادة توليد — أي بلا تكلفة.
 *
 * البرومبت بالإنجليزية (لغة تدريب النماذج) مهما كانت لغة المُدخل، واسم
 * العلامة يدخل كمصدر إلهام للمعنى لا كنصٍّ يُرسم.
 */

// كتالوج الأساليب — id ثابت في العقد، والأسماء للعرض، والقصاصة للبرومبت.
export const LOGO_STYLES = Object.freeze([
    {
        id: 'minimal',
        nameAr: 'بسيط حديث', nameEn: 'Minimal',
        fragment: 'minimalist flat vector logo mark, clean simple geometry, generous negative space',
    },
    {
        id: 'geometric',
        nameAr: 'هندسي', nameEn: 'Geometric',
        fragment: 'geometric logo mark built from precise shapes, sharp lines, mathematical balance',
    },
    {
        id: 'gradient',
        nameAr: 'تدرّج عصري', nameEn: 'Gradient',
        fragment: 'modern logo mark with smooth vibrant color gradient, soft rounded forms, tech startup feel',
    },
    {
        id: 'emblem',
        nameAr: 'شعار درعي', nameEn: 'Emblem',
        fragment: 'emblem badge logo mark, circular or shield composition, balanced ornamental details',
    },
    {
        id: 'mascot',
        nameAr: 'شخصية كرتونية', nameEn: 'Mascot',
        fragment: 'friendly mascot logo mark, simple cartoon character head, bold outlines, flat colors',
    },
    {
        id: 'monogram',
        nameAr: 'حروف مجرّدة', nameEn: 'Abstract mark',
        // "مونوغرام بلا حروف": شكل مجرّد يوحي بالهوية دون رسم حرف فعلي —
        // رسم الحروف محجوب أصلاً بقاعدة "بلا نص" أدناه.
        fragment: 'abstract symbolic logo mark, elegant interlocking curves suggesting identity, refined and premium',
    },
]);

export const MAX_BRAND_NAME = 60;
export const MAX_INDUSTRY = 80;
export const MAX_COLORS = 3;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * يتحقق من مدخلات الشعار ويطبّعها. يُرجع {ok:true, value} أو
 * {ok:false, error} برسالة عربية جاهزة للعرض.
 */
export function validateLogoInput(body = {}) {
    const brandName = String(body.brandName || '').trim();
    if (!brandName) return { ok: false, error: 'اسم العلامة مطلوب.' };
    if (brandName.length > MAX_BRAND_NAME) {
        return { ok: false, error: `اسم العلامة أطول من ${MAX_BRAND_NAME} حرفاً.` };
    }

    const industry = String(body.industry || '').trim();
    if (!industry) return { ok: false, error: 'مجال النشاط مطلوب.' };
    if (industry.length > MAX_INDUSTRY) {
        return { ok: false, error: `وصف المجال أطول من ${MAX_INDUSTRY} حرفاً.` };
    }

    const styleId = String(body.style || 'minimal').trim();
    const style = LOGO_STYLES.find(s => s.id === styleId);
    if (!style) {
        return { ok: false, error: `أسلوب غير معروف: ${styleId.slice(0, 30)}` };
    }

    let colors = body.colors;
    if (colors == null || colors === '') colors = [];
    if (!Array.isArray(colors)) return { ok: false, error: 'الألوان تُرسل مصفوفةً من أكواد hex.' };
    if (colors.length > MAX_COLORS) return { ok: false, error: `ثلاثة ألوان كحد أقصى.` };
    for (const c of colors) {
        if (!HEX_RE.test(String(c))) {
            return { ok: false, error: `لون غير صالح: ${String(c).slice(0, 12)} — الصيغة #RRGGBB.` };
        }
    }

    return {
        ok: true,
        value: {
            brandName, industry, styleId,
            colors: colors.map(c => c.toLowerCase()),
            // ✍️ اختيار المستخدم: النموذج يرسم الاسم داخل الشعار (يجيد
            // اللاتينية) أم أيقونة نظيفة والاسم يُركّب نصاً في الواجهة
            nameInLogo: body.nameInLogo === true,
        },
    };
}

/**
 * يركّب برومبت التوليد من مدخلات متحقَّق منها (خرج validateLogoInput).
 *
 * درسٌ من الإنتاج (جولة JaOla الحقيقية): مجرد ذكر الاسم في البرومبت
 * («for a brand called "X"») يُغري النموذج برسمه داخل الأيقونة رغم
 * حارس «بلا نص» — فيتكرر الاسم مع المركّب. لذا مساران صريحان:
 *
 *   nameInLogo=false (الافتراضي): الاسم **لا يُذكر للنموذج إطلاقاً** —
 *     أيقونة نظيفة مضمونة والاسم يأتي من المركّب حصراً (آمن للعربية).
 *   nameInLogo=true: نطلب رسم الاسم صراحةً بحروف نظيفة — النماذج تجيد
 *     اللاتينية، والواجهة تحذّر عند الأحرف العربية.
 */
export function composeLogoPrompt({ brandName, industry, styleId, colors, nameInLogo = false }) {
    const style = LOGO_STYLES.find(s => s.id === styleId) || LOGO_STYLES[0];

    const parts = [`Professional ${style.fragment}`];
    if (nameInLogo) {
        parts.push(`featuring the brand name "${brandName}" written in clean bold custom lettering as part of the logo`);
        parts.push(`for a brand in the ${industry} industry`);
    } else {
        parts.push(`for a brand in the ${industry} industry`);
    }
    parts.push('centered on a plain solid background, high contrast, crisp edges');
    if (colors.length > 0) {
        parts.push(`brand color palette: ${colors.join(', ')}`);
    }
    parts.push(nameInLogo
        ? 'no watermark, no photo, no mockup'
        : 'icon only, no text, no letters, no words, no typography, no watermark, no photo, no mockup');

    return parts.join(', ');
}

/** الشكل العلني للكتالوج (للواجهة) — بلا قصاصات البرومبت الداخلية. */
export function publicStyles() {
    return LOGO_STYLES.map(({ id, nameAr, nameEn }) => ({ id, nameAr, nameEn }));
}
