import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTemplateContext } from './templateLibrary.js';
import { buildMarketplaceContext } from './componentMarketplace.js';

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
// خريطة فئات App Blueprint → أنواع القوالب المتاحة
// (فئات ليس لها قالب مباشر تُوجَّه لأقرب نوع مناسب بدل السقوط لكلمات خاطئة)
const CATEGORY_TO_TYPE = {
    travel: 'travel', saas: 'saas', tool: 'tool',
    dashboard: 'saas', social: 'saas', game: 'gaming',
    ecommerce: 'ecommerce', medical: 'medical', restaurant: 'restaurant',
    education: 'education', realestate: 'realestate', portfolio: 'portfolio',
    business: 'business',
    // 📚➕ تعيينات الفئات الموسّعة (تلميحات الـ Blueprint → نوع قالب)
    startup: 'startup', entertainment: 'entertainment', events: 'entertainment',
    booking: 'booking', appointments: 'booking', blog: 'blog', news: 'news',
    magazine: 'news', law: 'law', legal: 'law', beauty: 'beauty', salon: 'beauty',
    spa: 'beauty', automotive: 'automotive', cars: 'automotive', wedding: 'wedding',
    photography: 'photography', music: 'music', artist: 'music', nonprofit: 'nonprofit',
    charity: 'nonprofit', agency: 'agency', finance: 'finance', insurance: 'finance',
    construction: 'construction', interior: 'interior', gaming: 'gaming',
    esports: 'gaming', crypto: 'crypto', web3: 'crypto',
};

export function detectProjectType(userGoal, typeHint = null) {
    // تلميح صريح من App Blueprint (LLM) — أدق من كشف الكلمات المفتاحية
    if (typeHint) {
        const mapped = CATEGORY_TO_TYPE[typeHint] || typeHint;
        if (DESIGN_RULES?.types?.[mapped]) return mapped;
    }
    if (!DESIGN_RULES) return 'business';

    const goal = (userGoal || '').toLowerCase();
    const types = DESIGN_RULES.types;

    let bestMatch = 'business';
    let bestScore = 0;

    for (const [typeName, typeData] of Object.entries(types)) {
        const keywords = getKeywordsForType(typeName);
        const score = keywords.filter(kw => keywordMatches(goal, kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = typeName;
        }
    }

    return bestMatch;
}

/**
 * مطابقة كلمة مفتاحية على حدود الكلمات لا كنصّ فرعي.
 * `goal.includes('طبي')` كانت تطابق «تطبيق» فيُصنَّف «تطبيق توصيل طعام» طبياً
 * (عطل موثَّق في ARCHITECTURE_MIGRATION.md). نسمح فقط بسوابق العربية اللاصقة
 * (و/ف/ب/ل/ك + ال/لل) ولواحقها الشائعة (ة/ات/ين/ون/ي/ك/كم/نا/ه/ها/هم) حول
 * الكلمة، وبحدود الكلمات في اللاتينية.
 */
const AR_PREFIX = '(?:و|ف|ب|ل|ك)?(?:ال|لل)?';
const AR_SUFFIX = '(?:ة|ات|ين|ون|ي|ك|كم|نا|ه|ها|هم|s|es)?'; // + جمع اللاتينية
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function keywordMatches(goal, kw) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${AR_PREFIX}${escapeRe(kw)}${AR_SUFFIX}(?![\\p{L}\\p{N}])`, 'iu');
    return re.test(goal);
}

function getKeywordsForType(typeName) {
    const keywordMap = {
        tool:       ['أداة', 'حاسبة', 'محول', 'مولد', 'converter', 'calculator', 'generator', 'tool', 'utility'],
        medical:    ['طبي', 'أطباء', 'مستشفى', 'عيادة', 'صحة', 'دكتور', 'طبيب', 'مرضى', 'medical', 'hospital', 'clinic', 'doctor', 'health'],
        restaurant: ['مطعم', 'مطاعم', 'توصيل طعام', 'قهوة', 'كافيه', 'طعام', 'أكل', 'وجبة', 'شيف', 'مقهى', 'restaurant', 'cafe', 'food', 'menu', 'coffee'],
        ecommerce:  ['متجر', 'بيع', 'شراء', 'منتج', 'تسوق', 'ماركة', 'ازياء', 'ملابس', 'سلة', 'shop', 'store', 'product', 'buy', 'ecommerce', 'cart'],
        hotel:      ['فندق', 'نزل', 'سكن', 'غرفة', 'حجز', 'إقامة', 'منتجع', 'hotel', 'resort', 'room', 'booking', 'accommodation'],
        education:  ['تعليم', 'مدرسة', 'دورة', 'كورس', 'أكاديمية', 'تدريب', 'تعلم', 'education', 'school', 'course', 'academy', 'learning'],
        portfolio:  ['بورتفوليو', 'معرض', 'أعمال', 'مصمم', 'مطور', 'فريلانسر', 'portfolio', 'design', 'developer', 'freelance'],
        realestate: ['عقار', 'شقة', 'فيلا', 'منزل', 'أرض', 'مبنى', 'real estate', 'property', 'apartment', 'villa', 'house'],
        gym:        ['جيم', 'نادي', 'رياضة', 'لياقة', 'تمرين', 'كمال', 'gym', 'fitness', 'sport', 'workout', 'training'],
        clinic:     ['عيادة', 'أسنان', 'نظارة', 'dermatology', 'dental', 'eye', 'skin', 'clinic'],
        business:   ['شركة', 'مؤسسة', 'أعمال', 'خدمات', 'حلول', 'company', 'business', 'services', 'solutions'],
        // 📚➕ الفئات الموسّعة
        saas:       ['saas', 'منصة', 'اشتراك', 'تطبيق ويب', 'لوحة تحكم', 'نظام إدارة', 'platform', 'dashboard', 'subscription', 'web app'],
        startup:    ['شركة ناشئة', 'ناشئة', 'ستارت اب', 'قائمة انتظار', 'منتج جديد', 'startup', 'waitlist', 'mvp', 'launch', 'landing'],
        entertainment: ['ترفيه', 'فعالية', 'فعاليات', 'حفلة', 'حفل', 'عرض', 'مهرجان', 'تذاكر', 'entertainment', 'event', 'concert', 'festival', 'show'],
        booking:    ['حجز', 'حجوزات', 'موعد', 'مواعيد', 'احجز', 'appointment', 'booking', 'reservation', 'schedule'],
        blog:       ['مدونة', 'مقالات', 'مقال', 'تدوين', 'كاتب', 'blog', 'article', 'post', 'writer'],
        news:       ['أخبار', 'خبر', 'صحيفة', 'مجلة', 'إعلام', 'جريدة', 'news', 'magazine', 'newspaper', 'press', 'media'],
        law:        ['محاماة', 'محامي', 'قانون', 'قانوني', 'استشارة قانونية', 'قضايا', 'law', 'lawyer', 'legal', 'attorney', 'firm'],
        beauty:     ['تجميل', 'صالون', 'سبا', 'مكياج', 'شعر', 'عناية', 'حلاقة', 'beauty', 'salon', 'spa', 'makeup', 'barber'],
        automotive: ['سيارات', 'سيارة', 'معرض سيارات', 'مركبات', 'تمويل سيارة', 'car', 'cars', 'automotive', 'vehicle', 'dealership'],
        wedding:    ['زفاف', 'عرس', 'زواج', 'مناسبات', 'عروس', 'حفل زفاف', 'wedding', 'marriage', 'bride'],
        photography:['تصوير', 'مصور', 'فوتوغرافي', 'استوديو تصوير', 'جلسة تصوير', 'photography', 'photographer', 'photo', 'studio'],
        music:      ['موسيقى', 'فنان', 'أغاني', 'ألبوم', 'حفلات', 'مطرب', 'music', 'artist', 'band', 'album', 'singer'],
        nonprofit:  ['جمعية', 'خيرية', 'تبرع', 'تبرعات', 'غير ربحية', 'تطوع', 'إغاثة', 'nonprofit', 'charity', 'donate', 'ngo', 'volunteer'],
        agency:     ['وكالة', 'إبداعية', 'تسويق', 'إعلان', 'براندنج', 'هوية بصرية', 'agency', 'creative', 'marketing', 'branding'],
        finance:    ['مالية', 'استثمار', 'تأمين', 'محاسبة', 'بنك', 'تمويل', 'ثروات', 'finance', 'investment', 'insurance', 'accounting', 'bank'],
        construction:['مقاولات', 'مقاول', 'بناء', 'إنشاءات', 'تشطيب', 'هندسي', 'construction', 'contractor', 'building', 'engineering'],
        interior:   ['تصميم داخلي', 'ديكور', 'أثاث', 'ديكورات', 'مساحات', 'interior', 'decor', 'furniture', 'design studio'],
        gaming:     ['ألعاب', 'لعبة', 'قيمنق', 'رياضات إلكترونية', 'بطولة', 'لاعبين', 'gaming', 'game', 'esports', 'tournament', 'gamers'],
        crypto:     ['عملات رقمية', 'كريبتو', 'بيتكوين', 'تداول', 'بلوكتشين', 'محفظة رقمية', 'crypto', 'bitcoin', 'blockchain', 'web3', 'trading', 'nft'],
        travel:     ['طيران', 'رحلات', 'سفر', 'حجز طيران', 'تذاكر', 'وجهة', 'سياحة', 'flight', 'travel', 'trip', 'airline', 'tourism', 'vacation']
    };
    return keywordMap[typeName] || [];
}

// ═══════════════════════════════════════════════════════
// 🎨 استخراج السياق الكامل لنوع مشروع معين
// ═══════════════════════════════════════════════════════
export function getProjectContext(userGoal, typeHint = null) {
    const projectType = detectProjectType(userGoal, typeHint);
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
        travel: 'photo-1436491865332-7a61a109cc05',
        saas: 'photo-1551288049-bebda4e38f71',
        tool: 'photo-1454165804606-c3d57bc86b40',
        medical: 'photo-1559757148-5c350d0d3c56',
        restaurant: 'photo-1504674900247-0877df9cc836',
        ecommerce: 'photo-1556742049-0cfed4f6a45d',
        hotel: 'photo-1542314831-068cd1dbfeeb',
        education: 'photo-1523050854058-8df90110c9f1',
        portfolio: 'photo-1498050108023-c5249f4df085',
        realestate: 'photo-1580587771525-78b9dba3b914',
        gym: 'photo-1534438327276-14e5300c3a48',
        clinic: 'photo-1631217868264-e5b90bb7e133',
        business: 'photo-1497366216548-37526070297c',
        // 📚➕ صور hero للفئات الموسّعة
        startup: 'photo-1519389950473-47ba0277781c',
        entertainment: 'photo-1470229722913-7c0e2dbbafd3',
        booking: 'photo-1506784983877-45594efa4cbe',
        blog: 'photo-1499750310107-5fef28a66643',
        news: 'photo-1495020689067-958852a7765e',
        law: 'photo-1589829545856-d10d557cf95f',
        beauty: 'photo-1560066984-138dadb4c035',
        automotive: 'photo-1503376780353-7e6692767b70',
        wedding: 'photo-1519741497674-611481863552',
        photography: 'photo-1452587925148-ce544e77e70d',
        music: 'photo-1493225457124-a3eb161ffa5f',
        nonprofit: 'photo-1488521787991-ed7bbaae773c',
        agency: 'photo-1522071820081-009f0129c71c',
        finance: 'photo-1611974789855-9c2a0a7236a3',
        construction: 'photo-1503387762-592deb58ef4e',
        interior: 'photo-1618221195710-dd6b41faaea6',
        gaming: 'photo-1542751371-adc38448a05e',
        crypto: 'photo-1621761191319-c6fb62004040'
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

    // 🆕 Component Marketplace context
    const marketplaceContext = buildMarketplaceContext(ctx.projectType);

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

${templateContext}
${marketplaceContext}`;
}

// ═══════════════════════════════════════════════════════
// 🔄 تصدير needsBackend للاستخدام من server.js
// ═══════════════════════════════════════════════════════
// كشف الميزات المتقدمة المطلوبة
export function detectAdvancedFeatures(userGoal) {
    const goal = (userGoal || '').toLowerCase();
    return {
        needsStripe: /stripe|دفع إلكتروني|بطاقة ائتمان|credit card|payment gateway/i.test(goal),
        needsUpload: /رفع صور|upload|صور منتجات|file upload|media/i.test(goal),
        needsOAuth: /google login|تسجيل بجوجل|oauth|social login/i.test(goal),
        needsPostgres: /postgres|postgresql|prisma|relational|علاقية/i.test(goal),
        needsRedis: /redis|cache|كاش|real.?time|realtime/i.test(goal),
        needsGraphQL: /graphql/i.test(goal),
    };
}

// 🔄 هل يحتاج المشروع خادماً؟ — مصدرٌ واحد مشترك مع `backendAgent`.
// الاسم المُصدَّر كما كان: `server.js:63` يستورده من هنا ويمرّره في `agents`.
export { needsBackend } from './backendNeed.js';
