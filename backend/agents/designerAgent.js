/**
 * 🎨 Designer Agent — JAOLA OS
 *
 * مرحلة قرار بصري مستقلة تأتي قبل Coder.
 * تقرر: الألوان، الخطوط، الـ layout، الأقسام، الصور.
 * تُنتج design-brief.json يُمرَّر لـ Coder كمرجع إلزامي.
 *
 * Pipeline:
 * Clarifier → Designer → Architect → Coder → QA
 */

import { smartChat } from './baseAgent.js';
import { getProjectContext } from './knowledgeEngine.js';
import { getUserProfile } from './userProfile.js';
import { getProjectMemory } from './projectMemory.js';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════
// 🎨 قوائم التصميم
// ═══════════════════════════════════════════════════════
const COLOR_PALETTES = {
    luxury:   { primary: '#b8860b', secondary: '#1a1a2e', accent: '#ffd700', bg: '#0d0d0d',    text: '#f5f5f5', mood: 'فاخر وراقٍ' },
    medical:  { primary: '#0ea5e9', secondary: '#0c4a6e', accent: '#10b981', bg: '#f0f9ff',    text: '#0c4a6e', mood: 'طبي نظيف' },
    vibrant:  { primary: '#7c3aed', secondary: '#db2777', accent: '#f59e0b', bg: '#fafafa',    text: '#1a1a2e', mood: 'نابض بالحياة' },
    natural:  { primary: '#16a34a', secondary: '#14532d', accent: '#84cc16', bg: '#f0fdf4',    text: '#14532d', mood: 'طبيعي وأخضر' },
    corporate:{ primary: '#1e40af', secondary: '#1e3a8a', accent: '#3b82f6', bg: '#f8fafc',    text: '#0f172a', mood: 'مهني ورسمي' },
    warm:     { primary: '#d97706', secondary: '#92400e', accent: '#fbbf24', bg: '#fffbeb',    text: '#1c1917', mood: 'دافئ وودّي' },
    dark:     { primary: '#8b5cf6', secondary: '#6d28d9', accent: '#06b6d4', bg: '#030712',    text: '#f9fafb', mood: 'داكن وعصري' },
    minimal:  { primary: '#374151', secondary: '#111827', accent: '#6366f1', bg: '#ffffff',    text: '#111827', mood: 'بسيط ومنظم' },
    energetic:{ primary: '#dc2626', secondary: '#991b1b', accent: '#f59e0b', bg: '#0a0a0a',    text: '#f9fafb', mood: 'قوي ومحفّز' },
    ocean:    { primary: '#0891b2', secondary: '#0e7490', accent: '#22d3ee', bg: '#ecfeff',    text: '#0c4a6e', mood: 'هادئ كالبحر' },
};

const FONT_PAIRS = {
    arabic_modern:  { heading: 'Cairo',   body: 'Tajawal',  import: 'Cairo:wght@700;900&family=Tajawal:wght@400;500' },
    arabic_elegant: { heading: 'Almarai', body: 'Almarai',  import: 'Almarai:wght@400;700;800' },
    arabic_bold:    { heading: 'Cairo',   body: 'Cairo',    import: 'Cairo:wght@400;600;700;900' },
    // خطوط لاتينية للّغات غير العربية
    latin_modern:   { heading: 'Poppins', body: 'Inter',    import: 'Poppins:wght@600;700;800&family=Inter:wght@400;500;600' },
    latin_elegant:  { heading: 'Montserrat', body: 'Inter', import: 'Montserrat:wght@600;700;800&family=Inter:wght@400;500' },
};

const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);
/** يختار زوج خطوط مناسباً لاتجاه لغة المستخدم */
function pickFonts(lang = 'en') {
    return RTL_LANGS.has((lang || 'en').toLowerCase()) ? FONT_PAIRS.arabic_modern : FONT_PAIRS.latin_modern;
}

// ═══════════════════════════════════════════════════════
// 🔍 اختيار لوحة الألوان حسب نوع المشروع والسياق
// ═══════════════════════════════════════════════════════
function selectPalette(projectType, userGoal, userProfile) {
    // خريطة النوع → لوحة الألوان الافتراضية
    // نوع المشروع له الأولوية القصوى على أي كلمات في الوصف
    const FORCED_TYPES = { medical: 'medical', clinic: 'medical' };
    if (FORCED_TYPES[projectType]) return FORCED_TYPES[projectType];

    const typeDefaults = {
        medical:    'medical',
        clinic:     'medical',
        restaurant: 'warm',
        ecommerce:  'vibrant',
        hotel:      'luxury',
        education:  'corporate',
        portfolio:  'dark',
        gym:        'energetic',
        realestate: 'natural',
        business:   'corporate',
    };

    // فحص الكلمات في وصف المستخدم
    const goal = (userGoal || '').toLowerCase();
    if (/فاخر|luxury|راقٍ|راقي|gold|ذهب/i.test(goal)) return 'luxury';
    if (/داكن|dark|أسود|black/i.test(goal)) return 'dark';
    if (/طبيعي|أخضر|green|نباتي/i.test(goal)) return 'natural';
    if (/بسيط|minimal|نظيف|clean/i.test(goal)) return 'minimal';
    if (/رياضي|قوي|bold|energetic/i.test(goal)) return 'energetic';
    if (/هادئ|أزرق|ocean|بحر/i.test(goal)) return 'ocean';

    // تفضيلات المستخدم السابقة
    if (userProfile?.designPrefs?.favoriteStyle === 'راقٍ') return 'luxury';
    if (userProfile?.designPrefs?.favoriteStyle === 'بسيط') return 'minimal';
    if (userProfile?.designPrefs?.favoriteStyle === 'جريء') return 'energetic';

    return typeDefaults[projectType] || 'corporate';
}

// ═══════════════════════════════════════════════════════
// 🖼️ اختيار صور Unsplash حسب النوع والأقسام
// ═══════════════════════════════════════════════════════
const UNSPLASH_LIBRARY = {
    medical:    ['photo-1559757148-5c350d0d3c56', 'photo-1631217868264-e5b90bb7e133', 'photo-1585421514738-01798e348b17'],
    restaurant: ['photo-1504674900247-0877df9cc836', 'photo-1414235077428-338989a2e8c0', 'photo-1555396273-367ea4eb4db5'],
    ecommerce:  ['photo-1556742049-0cfed4f6a45d', 'photo-1607082348824-0a96f2a4b9da', 'photo-1483985988355-763728e1935b'],
    hotel:      ['photo-1542314831-068cd1dbfeeb', 'photo-1566073771259-6a8506099945', 'photo-1582719508461-905c673771fd'],
    education:  ['photo-1523050854058-8df90110c9f1', 'photo-1509062522246-3755977927d7', 'photo-1427504494785-3a9ca7044f45'],
    portfolio:  ['photo-1498050108023-c5249f4df085', 'photo-1461749280684-dccba630e2f6', 'photo-1542831371-29b0f74f9713'],
    gym:        ['photo-1534438327276-14e5300c3a48', 'photo-1571019613454-1cb2f99b2d8b', 'photo-1583454110551-21f2fa2afe61'],
    realestate: ['photo-1580587771525-78b9dba3b914', 'photo-1560518883-ce09059eeffa', 'photo-1512917774080-9991f1c4c750'],
    business:   ['photo-1497366216548-37526070297c', 'photo-1454165804606-c3d57bc86b40', 'photo-1559136555-9303baea8ebd'],
    clinic:     ['photo-1631217868264-e5b90bb7e133', 'photo-1576091160550-2173dba999ef', 'photo-1559757175-5700dde675bc'],
};

function getImages(projectType, count = 3) {
    const photos = UNSPLASH_LIBRARY[projectType] || UNSPLASH_LIBRARY.business;
    return photos.slice(0, count).map(id =>
        `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`
    );
}

// ═══════════════════════════════════════════════════════
// 📐 بناء design-brief كامل
// ═══════════════════════════════════════════════════════
export async function generateDesignBrief(userGoal, username, activeProject, lang = 'en') {
    try {
        const ctx = getProjectContext(userGoal);
        const userProfile = getUserProfile(username);
        const projectMem = getProjectMemory(username, activeProject);

        // اختيار لوحة الألوان
        const paletteName = selectPalette(ctx.projectType, userGoal, userProfile);
        const palette = COLOR_PALETTES[paletteName];

        // اختيار الخطوط حسب لغة المستخدم (لاتيني لغير العربية)
        const fonts = pickFonts(lang);

        // الصور
        const images = getImages(ctx.projectType, 4);

        // استخدام ألوان محفوظة في ذاكرة المشروع إن وجدت
        const savedColors = projectMem?.design?.colors;
        const savedStyle = projectMem?.design?.style;

        // طلب من AI لتحسين الـ brief إن احتجنا لتخصيص أعمق
        let aiEnhancements = null;
        if (userGoal.length > 30) { // فقط للطلبات المفصّلة
            try {
                const completion = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{
                        role: 'system',
                        content: `أنت مصمم ويب خبير. أجب فقط بـ JSON صالح بدون أي نص خارجه. اكتب قيم heroSlogan وuniqueTouch بلغة المستخدم: ${(lang || 'en')}.`
                    }, {
                        role: 'user',
                        content: `للمشروع: "${userGoal}"
النوع: ${ctx.projectType}، لوحة الألوان: ${paletteName}
لغة المحتوى المطلوبة: ${(lang || 'en')}

أعطني JSON بهذا الشكل فقط (heroSlogan وuniqueTouch بلغة ${(lang || 'en')}):
{
  "heroSlogan": "شعار قصير وجذاب للـ hero section",
  "uniqueTouch": "لمسة تصميمية مميزة ومختلفة لهذا الموقع تحديداً",
  "animations": ["تأثير hover للأزرار", "fade-in للأقسام"]
}`
                    }],
                    max_tokens: 200,
                    temperature: 0.7,
                    response_format: { type: 'json_object' },
                });
                aiEnhancements = JSON.parse(completion.choices[0].message.content);
            } catch (e) { /* تجاهل أخطاء AI واستخدام القيم الافتراضية */ }
        }

        const brief = {
            projectType: ctx.projectType,
            paletteName,
            generatedAt: Date.now(),

            // الألوان
            colors: {
                ...palette,
                // تطبيق الألوان المحفوظة في الذاكرة إن وجدت
                ...(savedColors ? { savedNote: savedColors } : {}),
            },

            // CSS Variables جاهزة للنسخ مباشرة
            cssVariables: `
:root {
    --primary: ${palette.primary};
    --secondary: ${palette.secondary};
    --accent: ${palette.accent};
    --bg: ${palette.bg};
    --text: ${palette.text};
    --font-heading: '${fonts.heading}', sans-serif;
    --font-body: '${fonts.body}', sans-serif;
    --radius: 12px;
    --shadow: 0 4px 20px rgba(0,0,0,0.1);
    --transition: all 0.3s ease;
}`.trim(),

            // Google Fonts
            googleFontsURL: `https://fonts.googleapis.com/css2?family=${fonts.import}&display=swap`,

            // الأقسام الإلزامية
            sections: ctx.mustHaveSections,

            // الصور
            images: {
                hero: images[0],
                secondary: images[1],
                gallery: images.slice(2),
            },

            // الأسلوب البصري
            mood: savedStyle || palette.mood,

            // تحسينات AI
            heroSlogan: aiEnhancements?.heroSlogan || null,
            uniqueTouch: aiEnhancements?.uniqueTouch || null,
            animations: aiEnhancements?.animations || ['fade-in للأقسام عند الـ scroll', 'hover smooth على الأزرار'],

            // تعليمات إلزامية للـ Coder
            coderInstructions: `
## تعليمات التصميم الإلزامية:
- استخدم CSS Variables من :root في كل الألوان (لا hardcoded colors)
- الخط الرئيسي: ${fonts.heading} للعناوين، ${fonts.body} للنص
- الصورة الرئيسية: ${images[0]}
- الأسلوب: ${savedStyle || palette.mood}
- الأنيميشن: ${(aiEnhancements?.animations || ['fade-in']).join('، ')}
${aiEnhancements?.heroSlogan ? `- شعار الـ hero: "${aiEnhancements.heroSlogan}"` : ''}
${aiEnhancements?.uniqueTouch ? `- اللمسة المميزة: ${aiEnhancements.uniqueTouch}` : ''}
`.trim(),
        };

        return { success: true, brief };

    } catch (error) {
        console.error('[DesignerAgent] Error:', error.message);
        return { success: false, error: error.message };
    }
}

// ═══════════════════════════════════════════════════════
// 💾 حفظ وقراءة الـ brief من القرص
// ═══════════════════════════════════════════════════════
export function saveDesignBrief(projectPath, brief) {
    try {
        fs.writeFileSync(
            path.join(projectPath, 'design-brief.json'),
            JSON.stringify(brief, null, 2)
        );
    } catch (e) {
        console.warn('[DesignerAgent] فشل حفظ الـ brief:', e.message);
    }
}

export function loadDesignBrief(projectPath) {
    try {
        const briefPath = path.join(projectPath, 'design-brief.json');
        if (fs.existsSync(briefPath)) {
            return JSON.parse(fs.readFileSync(briefPath, 'utf-8'));
        }
    } catch (e) {}
    return null;
}
