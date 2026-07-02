import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTemplateContext } from './templateLibrary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '../knowledge');

// ═══════════════════════════════════════════════════════
// 📚 تحميل قواعد المعرفة عند بدء التشغيل (مرة واحدة)
// ═══════════════════════════════════════════════════════
let DESIGN_RULES = null;
let COMPONENTS = null;

function loadKnowledge() {
    try {
        const rulesPath = path.join(KNOWLEDGE_DIR, 'design-rules.json');
        const componentsPath = path.join(KNOWLEDGE_DIR, 'components.json');

        if (fs.existsSync(rulesPath)) {
            DESIGN_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
        }
        if (fs.existsSync(componentsPath)) {
            COMPONENTS = JSON.parse(fs.readFileSync(componentsPath, 'utf-8'));
        }
    } catch (e) {
        console.warn('[KnowledgeEngine] فشل تحميل قواعد المعرفة:', e.message);
    }
}

loadKnowledge();

// ═══════════════════════════════════════════════════════
// 🔍 كشف نوع المشروع من وصف المستخدم
// ═══════════════════════════════════════════════════════
export function detectProjectType(userGoal) {
    if (!DESIGN_RULES) return 'business';

    const goal = (userGoal || '').toLowerCase();
    const types = DESIGN_RULES.types;

    let bestMatch = 'business';
    let bestScore = 0;

    for (const [typeName, typeData] of Object.entries(types)) {
        const keywords = getKeywordsForType(typeName);
        const score = keywords.filter(kw => goal.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = typeName;
        }
    }

    return bestMatch;
}

function getKeywordsForType(typeName) {
    const keywordMap = {
        medical:    ['طبي', 'مستشفى', 'عيادة', 'صحة', 'دكتور', 'طبيب', 'مرضى', 'medical', 'hospital', 'clinic', 'doctor', 'health'],
        restaurant: ['مطعم', 'قهوة', 'كافيه', 'طعام', 'أكل', 'وجبة', 'شيف', 'مقهى', 'restaurant', 'cafe', 'food', 'menu', 'coffee'],
        ecommerce:  ['متجر', 'بيع', 'شراء', 'منتج', 'تسوق', 'ماركة', 'ازياء', 'ملابس', 'سلة', 'shop', 'store', 'product', 'buy', 'ecommerce', 'cart'],
        hotel:      ['فندق', 'نزل', 'سكن', 'غرفة', 'حجز', 'إقامة', 'منتجع', 'hotel', 'resort', 'room', 'booking', 'accommodation'],
        education:  ['تعليم', 'مدرسة', 'دورة', 'كورس', 'أكاديمية', 'تدريب', 'تعلم', 'education', 'school', 'course', 'academy', 'learning'],
        portfolio:  ['بورتفوليو', 'معرض', 'أعمال', 'مصمم', 'مطور', 'فريلانسر', 'portfolio', 'design', 'developer', 'freelance'],
        realestate: ['عقار', 'شقة', 'فيلا', 'منزل', 'أرض', 'مبنى', 'real estate', 'property', 'apartment', 'villa', 'house'],
        gym:        ['جيم', 'نادي', 'رياضة', 'لياقة', 'تمرين', 'كمال', 'gym', 'fitness', 'sport', 'workout', 'training'],
        clinic:     ['عيادة', 'أسنان', 'نظارة', 'تجميل', 'dermatology', 'dental', 'eye', 'skin', 'beauty', 'clinic'],
        business:   ['شركة', 'مؤسسة', 'أعمال', 'خدمات', 'حلول', 'company', 'business', 'services', 'solutions', 'agency']
    };
    return keywordMap[typeName] || [];
}

// ═══════════════════════════════════════════════════════
// 🎨 استخراج السياق الكامل لنوع مشروع معين
// ═══════════════════════════════════════════════════════
export function getProjectContext(userGoal) {
    const projectType = detectProjectType(userGoal);
    const globalRules = DESIGN_RULES?.global || {};
    const typeRules = DESIGN_RULES?.types?.[projectType] || {};

    const colors = typeRules.color_palette || {};
    const cssVars = Object.entries(colors)
        .map(([k, v]) => `    --${k}: ${v};`)
        .join('\n');

    const sections = typeRules.must_have_sections || [];
    const icons = typeRules.icons || [];
    const unsplashQueries = typeRules.unsplash_queries || [];

    // اختيار مثال صورة من Unsplash
    const photoIds = {
        medical: 'photo-1559757148-5c350d0d3c56',
        restaurant: 'photo-1504674900247-0877df9cc836',
        ecommerce: 'photo-1556742049-0cfed4f6a45d',
        hotel: 'photo-1542314831-068cd1dbfeeb',
        education: 'photo-1523050854058-8df90110c9f1',
        portfolio: 'photo-1498050108023-c5249f4df085',
        realestate: 'photo-1580587771525-78b9dba3b914',
        gym: 'photo-1534438327276-14e5300c3a48',
        clinic: 'photo-1631217868264-e5b90bb7e133',
        business: 'photo-1497366216548-37526070297c'
    };

    const heroPhotoId = photoIds[projectType] || photoIds.business;

    return {
        projectType,
        cssVariables: `:root {\n${cssVars}\n    --border: #e5e7eb;\n    --bg: ${colors.bg || '#ffffff'};\n    --text: ${colors.text || '#1a1a2e'};\n    --text-light: #6b7280;\n    --font: 'Cairo', 'Tajawal', sans-serif;\n}`,
        mood: typeRules.mood || 'عصري احترافي',
        mustHaveSections: sections,
        heroImage: `https://images.unsplash.com/${heroPhotoId}?w=1600&q=80&auto=format&fit=crop`,
        suggestedIcons: icons.slice(0, 4).join(', '),
        googleFontsImport: globalRules.fonts?.google_import || '',
        fontAwesomeCDN: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
        unsplashHint: unsplashQueries[0] || projectType,
        globalCssRules: globalRules.css_rules || [],
        globalHtmlRules: globalRules.html_rules || [],
    };
}

// ═══════════════════════════════════════════════════════
// 📝 توليد الـ Context Prompt الكامل لـ coderAgent
// ═══════════════════════════════════════════════════════
export function buildContextPrompt(userGoal) {
    const ctx = getProjectContext(userGoal);

    const sectionsText = ctx.mustHaveSections
        .map((s, i) => `   ${i + 1}. ${s}`)
        .join('\n');

    // 🆕 استخراج Components المناسبة من المكتبة
    let componentsHint = '';
    if (COMPONENTS?.components) {
        const projectType = ctx.projectType;
        const relevant = Object.entries(COMPONENTS.components)
            .filter(([, c]) => c.tags?.includes(projectType) || c.tags?.includes('all'))
            .map(([name, c]) => `- ${name}: ${c.description}`)
            .join('\n');
        if (relevant) {
            componentsHint = `\n\n### Components المتاحة من المكتبة (استخدم CSS patterns مشابهة لها):\n${relevant}`;
        }
    }

    // 🆕 Template Library context
    const templateContext = buildTemplateContext(ctx.projectType);

    return `## سياق المشروع من Knowledge Engine:

**نوع المشروع:** ${ctx.projectType}
**الروح التصميمية:** ${ctx.mood}

### CSS Variables (استخدمها في :root):
\`\`\`css
${ctx.cssVariables}
\`\`\`

### مصادر مطلوبة في <head>:
- Google Fonts: ${ctx.googleFontsImport}
- Font Awesome: <link rel="stylesheet" href="${ctx.fontAwesomeCDN}">

### صورة Hero المقترحة:
\`\`\`
${ctx.heroImage}
\`\`\`
(استخدم هذه الصورة كخلفية للـ hero section أو غيّر الرقم لصورة Unsplash مناسبة)

### أيقونات Font Awesome المناسبة:
${ctx.suggestedIcons}

### الأقسام الإلزامية (ابنِ كل قسم كاملاً ومفصّلاً):
${sectionsText}
${componentsHint}

### قواعد CSS الإلزامية:
${ctx.globalCssRules.map(r => `- ${r}`).join('\n')}

### قواعد HTML الإلزامية:
${ctx.globalHtmlRules.map(r => `- ${r}`).join('\n')}

${templateContext}`;
}

// ═══════════════════════════════════════════════════════
// 🔄 تصدير needsBackend للاستخدام من server.js
// ═══════════════════════════════════════════════════════
const BACKEND_KEYWORDS = [
    'تسجيل دخول', 'حساب', 'مستخدم', 'دفع', 'حجز', 'لوحة تحكم',
    'قاعدة بيانات', 'إدارة', 'سلة', 'طلبات', 'مخزون', 'فاتورة',
    'اشتراك', 'عضوية', 'login', 'signup', 'payment', 'checkout',
    'cart', 'order', 'dashboard', 'admin', 'database', 'booking',
    'upload', 'inventory', 'subscription', 'members', 'crud'
];

export function needsBackend(userGoal) {
    const goal = (userGoal || '').toLowerCase();
    return BACKEND_KEYWORDS.some(kw => goal.includes(kw));
}
