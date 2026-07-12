import { groq, smartChat } from './baseAgent.js';
import { detectProjectType } from './knowledgeEngine.js';
import { detectLanguage, initUserLanguage, getUserLanguage, setUserLanguage } from './languageDetector.js';

// ═══════════════════════════════════════════════════════
// 🤖 Dynamic Question Generator — يولّد أسئلة ذكية بـ AI
// ═══════════════════════════════════════════════════════
async function generateDynamicQuestions(userGoal, projectType, lang = 'ar') {
    try {
        const systemPrompt = lang === 'ar'
            ? `أنت مصمم مواقع خبير. المستخدم يريد بناء موقع ويب.
اطرح 3 أسئلة قصيرة وعملية تساعدك على تصميم الموقع المناسب.
الأسئلة يجب أن تكون عن: شكل الموقع، الميزات المرئية، الجمهور.
لا تسأل عن التقنيات أو البرمجة — المستخدم لا يعرفها.
أمثلة جيدة: "هل تريد قائمة طعام مع صور وأسعار؟" / "هل تريد نموذج حجز؟" / "ما لون الهوية البصرية؟"
أعد JSON فقط: { "questions": ["سؤال 1", "سؤال 2", "سؤال 3"] }`
            : `You are an expert web designer. The user wants a website.
Ask 3 short practical questions to design the right website.
Questions should be about: visual design, key features, target audience.
Do NOT ask about tech/programming — user doesn't know that.
Good examples: "Do you want a menu with photos and prices?" / "Do you need a booking form?" / "What color theme?"
Return JSON only: { "questions": ["question 1", "question 2", "question 3"] }`;

        const response = await smartChat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `المشروع: "${userGoal}" (النوع: ${projectType})` }
        ], { max_tokens: 300, temperature: 0.6, json: true });

        const parsed = JSON.parse(response);
        if (parsed.questions && parsed.questions.length >= 2) {
            return parsed.questions.slice(0, 3);
        }
    } catch (e) {
        // fallback للأسئلة الثابتة
    }
    return null;
}

// ═══════════════════════════════════════════════════════
// 🧠 أسئلة ذكية مخصصة لكل نوع مشروع
// ═══════════════════════════════════════════════════════
const CLARIFIER_QUESTIONS = {
    medical: [
        'هل تريد نموذج حجز مواعيد حقيقي أم زر "اتصل بنا" فقط؟',
        'كم عدد التخصصات الطبية التي تريد عرضها؟ (مثال: 4 تخصصات: قلب، عظام، أطفال، نساء)',
        'هل تريد قسم "فريق الأطباء" مع صور وسيرة ذاتية لكل طبيب؟',
    ],
    restaurant: [
        'هل تريد عرض قائمة الطعام مع أسعار، أم فقط صور وأجواء المطعم؟',
        'هل تريد نموذج حجز طاولة عبر الموقع؟',
        'ما نوع المطبخ؟ (عربي، إيطالي، آسيوي، مشاوي...) لأختار الصور والألوان المناسبة',
    ],
    ecommerce: [
        'هل تريد سلة تسوق تفاعلية أم فقط عرض المنتجات؟',
        'كم عدد المنتجات التقريبي الذي تريد عرضه؟ (أقل من 20، 20-50، أكثر من 50)',
        'هل تريد صفحة منتج مفصّلة (صور متعددة، مواصفات، تقييمات)؟',
    ],
    hotel: [
        'كم عدد أنواع الغرف التي تريد عرضها؟ (مثال: غرفة عادية، جناح، جناح فاخر)',
        'هل تريد نموذج حجز مباشر أم توجيه لرقم هاتف؟',
        'هل تريد قسم "معرض صور" لعرض مرافق الفندق (مسبح، مطعم، صالة رياضية)؟',
    ],
    education: [
        'هل تريد عرض دورات مع أسعار وتفاصيل، أم فقط الخدمات العامة؟',
        'هل تريد نموذج تسجيل في الموقع أم توجيه لتواصل مباشر؟',
        'ما الفئة المستهدفة؟ (أطفال، طلاب جامعيين، مهنيون، عام)',
    ],
    portfolio: [
        'ما مجالك؟ (مصمم، مطور، مصور، كاتب، مهندس...)',
        'كم عدد الأعمال التي تريد عرضها في المعرض؟',
        'هل تريد قسم "الخدمات والأسعار" أم فقط عرض الأعمال والتواصل؟',
    ],
    realestate: [
        'هل تريد عرض عقارات للبيع، للإيجار، أم الاثنين معاً؟',
        'هل تريد نموذج بحث عقارات (تصفية بالسعر والموقع والنوع)؟',
        'كم عدد العقارات المميزة التي تريد إبرازها في الصفحة الرئيسية؟',
    ],
    gym: [
        'هل تريد عرض جدول الحصص الأسبوعي؟',
        'هل تريد باقات الاشتراك مع الأسعار؟',
        'هل تريد قسم "قبل وبعد" لعرض نتائج الأعضاء؟',
    ],
    clinic: [
        'ما تخصص العيادة؟ (أسنان، عيون، جلدية، تجميل...) لأختار الأيقونات والألوان المناسبة',
        'هل تريد نموذج حجز موعد إلكتروني؟',
        'هل تريد قسم "قبل وبعد" لعرض نتائج العمليات؟',
    ],
    business: [
        'ما الخدمة الرئيسية التي تقدمها شركتك؟ (تقنية، استشارات، تسويق، تصنيع...)',
        'هل تريد قسم "العملاء والشركاء" مع شعاراتهم؟',
        'هل تريد معرض مشاريع أو حالات نجاح (case studies)؟',
    ],
};

const CLARIFIER_QUESTIONS_EN = {
    medical:    ['Do you need an online appointment booking form, or just a "Contact Us" button?', 'How many medical specialties do you want to display?', 'Do you want a "Meet the Doctors" section with photos and bios?'],
    restaurant: ['Do you want a food menu with prices, or just photos and ambiance?', 'Do you want an online table reservation form?', 'What type of cuisine? (Arabic, Italian, Asian, BBQ...) — this affects colors and images'],
    ecommerce:  ['Do you need an interactive shopping cart, or just product display?', 'How many products approximately? (under 20 / 20-50 / 50+)', 'Do you want a detailed product page with multiple images, specs, and reviews?'],
    hotel:      ['How many room types do you want to showcase?', 'Do you want a direct booking form, or redirect to phone?', 'Do you want a photo gallery for hotel facilities (pool, restaurant, gym)?'],
    education:  ['Do you want to show courses with prices and details, or just general services?', 'Do you want an online registration form?', 'Who is your target audience? (kids, university, professionals, general)'],
    portfolio:  ['What is your field? (designer, developer, photographer, writer...)', 'How many works do you want in your portfolio?', 'Do you want a "Services & Pricing" section, or just portfolio and contact?'],
    realestate: ['Are you listing properties for sale, rent, or both?', 'Do you want a search/filter form (price, location, type)?', 'How many featured properties on the homepage?'],
    gym:        ['Do you want to show a weekly class schedule?', 'Do you want membership packages with prices?', 'Do you want a "Before & After" section showing member results?'],
    clinic:     ['What is your clinic specialty? (dental, eye, skin, cosmetic...)', 'Do you want an online appointment form?', 'Do you want a "Before & After" results section?'],
    business:   ['What is your main service? (tech, consulting, marketing, manufacturing...)', 'Do you want a "Clients & Partners" section with their logos?', 'Do you want a projects gallery or case studies section?'],
};

const DEFAULT_QUESTIONS_EN = [
    'What is the main goal of this website? (showcase services, sell products, book appointments, show portfolio...)',
    'Who is your target audience? (individuals, businesses, youth, families...)',
    'Do you have specific colors in mind, or should I choose?',
];

// ═══════════════════════════════════════════════════════
// 🎯 أسئلة استراتيجية — للطلبات الواسعة التي تتفرّع قراراتها كثيراً
// (لا يبدأ البناء مباشرة، بل يفهم الاتجاه أولاً ثم يحوّله لخطة تنفيذ)
// ═══════════════════════════════════════════════════════
const BROAD_TYPES = new Set(['travel', 'saas', 'ecommerce', 'marketplace', 'platform', 'app', 'realestate', 'education', 'fintech']);

const AUDIENCE = { ar: { q: 'من جمهورك المستهدف؟', options: ['أفراد (B2C)', 'شركات (B2B)', 'كلاهما', 'قرر أنت 🤖'] }, en: { q: 'Who is your target audience?', options: ['Consumers (B2C)', 'Businesses (B2B)', 'Both', 'You decide 🤖'] } };
const PLATFORM = { ar: { q: 'أي منصّة تريد؟', options: ['موقع ويب', 'تطبيق جوال أيضاً (PWA)', 'قرر أنت 🤖'] }, en: { q: 'Which platform?', options: ['Web only', 'Mobile app too (PWA)', 'You decide 🤖'] } };
const SCOPE = { ar: { q: 'ما نطاق الإطلاق؟', options: ['نسخة أولى سريعة (MVP)', 'منصّة متكاملة', 'قرر أنت 🤖'] }, en: { q: 'Launch scope?', options: ['Fast MVP', 'Full platform', 'You decide 🤖'] } };

// أسئلة خاصة بالنوع (فوق الأسئلة الاستراتيجية العامة)
const STRATEGIC_BY_TYPE = {
    travel: {
        ar: [{ q: 'ما محور المنصّة؟', options: ['طيران', 'فنادق', 'باقات سياحية', 'الكل'] }, { q: 'هل تريد نظام حجز فعلي أم استعلام وتواصل؟', options: ['حجز فعلي', 'استعلام فقط', 'قرر أنت 🤖'] }, { q: 'هل تريد نظام نقاط/ولاء؟', options: ['نعم ✅', 'لا', 'قرر أنت 🤖'] }],
        en: [{ q: 'Platform focus?', options: ['Flights', 'Hotels', 'Tour packages', 'All'] }, { q: 'Real booking or inquiry & contact?', options: ['Real booking', 'Inquiry only', 'You decide 🤖'] }, { q: 'Loyalty/points system?', options: ['Yes ✅', 'No', 'You decide 🤖'] }],
    },
    saas: {
        ar: [{ q: 'ما نموذج التسعير؟', options: ['اشتراك شهري', 'مجاني + مدفوع', 'لمرة واحدة', 'قرر أنت 🤖'] }, { q: 'هل تريد لوحة تحكم للمستخدم؟', options: ['نعم ✅', 'لا', 'قرر أنت 🤖'] }, { q: 'هل يدعم فرق/مؤسسات؟', options: ['نعم ✅', 'لا', 'قرر أنت 🤖'] }],
        en: [{ q: 'Pricing model?', options: ['Monthly subscription', 'Freemium', 'One-time', 'You decide 🤖'] }, { q: 'User dashboard?', options: ['Yes ✅', 'No', 'You decide 🤖'] }, { q: 'Support teams/orgs?', options: ['Yes ✅', 'No', 'You decide 🤖'] }],
    },
    ecommerce: {
        ar: [{ q: 'كم عدد المنتجات تقريباً؟', options: ['أقل من 20', '20-50', 'أكثر من 50'] }, { q: 'هل تريد دفعاً إلكترونياً فعلياً؟', options: ['نعم ✅', 'لاحقاً', 'قرر أنت 🤖'] }],
        en: [{ q: 'Approx. number of products?', options: ['Under 20', '20-50', '50+'] }, { q: 'Real online payments?', options: ['Yes ✅', 'Later', 'You decide 🤖'] }],
    },
    marketplace: {
        ar: [{ q: 'من يبيع على المنصّة؟', options: ['بائعون متعدّدون', 'أنت فقط', 'قرر أنت 🤖'] }, { q: 'هل تأخذ عمولة على المعاملات؟', options: ['نعم ✅', 'لا', 'قرر أنت 🤖'] }],
        en: [{ q: 'Who sells on it?', options: ['Multiple vendors', 'Only you', 'You decide 🤖'] }, { q: 'Take commission on transactions?', options: ['Yes ✅', 'No', 'You decide 🤖'] }],
    },
    realestate: {
        ar: [{ q: 'عرض للبيع، للإيجار، أم الاثنين؟', options: ['بيع', 'إيجار', 'كلاهما'] }, { q: 'هل تريد بحثاً بالخريطة والتصفية؟', options: ['نعم ✅', 'لا', 'قرر أنت 🤖'] }],
        en: [{ q: 'For sale, rent, or both?', options: ['Sale', 'Rent', 'Both'] }, { q: 'Map search & filters?', options: ['Yes ✅', 'No', 'You decide 🤖'] }],
    },
};

/** هل يحتاج الطلب حواراً استراتيجياً؟ (نوع واسع + طلب مقتضب غير مفصّل) */
export function needsStrategicClarification(goal, projectType) {
    if (!BROAD_TYPES.has(projectType)) return false;
    const clean = (goal || '').replace(/^(ابني|اصنع|انشئ|بني|سوي|اعمل|build|create|make|a|an)\s+/gi, '').trim();
    const words = clean.split(/\s+/).filter(Boolean).length;
    // طلب مفصّل (كلمات كثيرة) = يعرف ما يريد → لا نُثقل عليه بأسئلة
    return words <= 6;
}

/** يبني قائمة الأسئلة الاستراتيجية لنوع ما */
function strategicQuestions(projectType, lang = 'ar') {
    const L = lang === 'en' ? 'en' : 'ar';
    const typeQs = (STRATEGIC_BY_TYPE[projectType]?.[L] || []);
    // عام: الجمهور + المنصّة + النطاق، ثم أسئلة النوع (نحدّها بـ 5 إجمالاً)
    const universal = [AUDIENCE[L], PLATFORM[L], SCOPE[L]];
    return [...universal, ...typeQs].slice(0, 5);
}

// ═══════════════════════════════════════════════════════
// 📋 حالة المحادثة — يتتبع مرحلة كل مستخدم
// ═══════════════════════════════════════════════════════
// conversationState: Map<username, { stage, originalGoal, answers, projectType, plan }>
export const conversationState = new Map();

const STAGES = {
    IDLE: 'idle',           // لا يوجد مشروع قيد التخطيط
    CLARIFYING: 'clarifying', // نسأل المستخدم
    PLANNING: 'planning',   // نعرض الخطة وننتظر موافقة
    BUILDING: 'building',   // نبني
};

// ═══════════════════════════════════════════════════════
// 🔍 هل الرسالة طلب بناء؟
// ═══════════════════════════════════════════════════════
// كشف لغة المستخدم

// فقط طلبات البناء الصريحة — "build me a X" وليس "can you build"
const BUILD_PATTERNS_AR = /^(ابني|اصنع|انشئ|أنشئ|ابدأ|اعمل|صمم|طور)\s+/i;
const BUILD_PATTERNS_EN = /^(build|create|make|design|develop)\s+(me\s+)?(a\s+|an\s+)?(?!for|me\b)/i;

export function isBuildRequest(message) {
    return BUILD_PATTERNS_AR.test(message.trim()) || BUILD_PATTERNS_EN.test(message.trim());
}

// ═══════════════════════════════════════════════════════
// 💬 بدء مرحلة التوضيح
// ═══════════════════════════════════════════════════════
export async function startClarification(username, userGoal) {
    const lang = getUserLanguage(username) || 'ar';
    const projectType = detectProjectType(userGoal);

    // 🎯 طلب واسع وغامض → حوار استراتيجي (لا يبدأ مباشرة)
    if (needsStrategicClarification(userGoal, projectType)) {
        const questions = strategicQuestions(projectType, lang);
        conversationState.set(username, {
            stage: STAGES.CLARIFYING, originalGoal: userGoal, projectType, lang,
            questions, answers: [], currentQuestion: 0,
        });
        const first = questions[0];
        const intro = lang === 'ar'
            ? `فهمت أنك تريد ${projectTypeLabelAr(projectType)}. أسئلة سريعة لأصمّم الخطة الصحيحة:\n\n**السؤال 1/${questions.length}:** ${first.q}`
            : `Got it — a ${projectType} project. A few quick questions to plan it right:\n\n**Question 1/${questions.length}:** ${first.q}`;
        return { type: 'clarification', message: intro, options: first.options };
    }

    // ⚡ طلب واضح/بسيط → بناء مباشر (نحافظ على السرعة)
    conversationState.set(username, { stage: 'done', originalGoal: userGoal, lang });
    const cleanName = userGoal.replace(/^(ابني|اصنع|انشئ|بني|سوي|اعمل|build|create|make)\s+/i, '').trim();
    const msg = lang === 'ar'
        ? `⚡ ممتاز! سأبني "${cleanName.slice(0,25)}" الآن فوراً...`
        : `⚡ Got it! Building "${cleanName.slice(0,25)}" right now...`;
    return { type: 'build_direct', message: msg, readyToBuild: true, finalGoal: userGoal };
}

function projectTypeLabelAr(t) {
    const m = { travel: 'منصّة سفر', saas: 'منصّة SaaS', ecommerce: 'متجراً إلكترونياً', marketplace: 'سوقاً متعدّد البائعين', realestate: 'منصّة عقارات', education: 'منصّة تعليمية', app: 'تطبيقاً', platform: 'منصّة', fintech: 'منصّة مالية' };
    return m[t] || 'مشروعاً';
}
// ═══════════════════════════════════════════════════════
// 📝 معالجة إجابة المستخدم
// ═══════════════════════════════════════════════════════
export async function processAnswer(username, answer) {
    const state = conversationState.get(username);
    if (!state || state.stage !== STAGES.CLARIFYING) return null;

    state.answers.push(answer);
    state.currentQuestion++;

    // 🆕 تحديث لغة الجلسة بناءً على إجابات المستخدم
    // إذا أجاب بلغة مختلفة عن لغة الأسئلة، نتكيّف معه
    const answerLang = detectLanguage(answer);
    if (answer.trim().length > 2) {
        state.lang = answerLang;
        // حدّث لغة الجلسة الكاملة أيضاً
        try {
            const { setUserLanguage } = await import('./languageDetector.js');
            setUserLanguage(username, answerLang);
        } catch(e) {}
    }

    conversationState.set(username, state);

    const lang = state.lang || 'ar';

    if (state.currentQuestion < state.questions.length) {
        const nextQuestion = state.questions[state.currentQuestion];
        // الأسئلة قد تكون كائنات {q, options} (استراتيجية) أو نصوصاً (قديمة)
        const qText = typeof nextQuestion === 'string' ? nextQuestion : nextQuestion.q;
        const qOptions = typeof nextQuestion === 'string' ? questionQuickOptions(nextQuestion, lang) : nextQuestion.options;
        const label = lang === 'ar'
            ? `**السؤال ${state.currentQuestion + 1}/${state.questions.length}:**\n${qText}`
            : `**Question ${state.currentQuestion + 1}/${state.questions.length}:**\n${qText}`;
        return { type: 'clarification', message: label, options: qOptions };
    }

    state.stage = STAGES.PLANNING;
    conversationState.set(username, state);

    const plan = await buildProjectPlan(state);
    state.plan = plan;
    conversationState.set(username, state);

    const planOptions = lang === 'ar'
        ? ['🚀 ابدأ البناء', '🎨 غيّر الألوان', '✏️ أريد تعديلاً']
        : ['🚀 Start building', '🎨 Change colors', '✏️ I want a change'];
    return { type: 'plan', message: formatPlan(plan, state), plan, readyToBuild: true, options: planOptions };
}

// 🆕 أزرار سريعة للأسئلة — أسئلة "هل..." تحصل على نعم/لا/قرر أنت
function questionQuickOptions(question, lang = 'ar') {
    const isYesNo = /^(هل|do you|would you|are you|should)/i.test((question || '').trim());
    if (!isYesNo) return undefined;
    return lang === 'ar'
        ? ['نعم ✅', 'لا', 'قرر أنت 🤖']
        : ['Yes ✅', 'No', 'You decide 🤖'];
}

// ═══════════════════════════════════════════════════════
// 🗺️ بناء خطة المشروع بناءً على الإجابات
// ═══════════════════════════════════════════════════════
const qText = (q) => (typeof q === 'string' ? q : q.q);

/** يشتقّ القرارات الاستراتيجية من إجابات المستخدم (حتمي وقابل للاختبار) */
export function deriveStrategicDecisions(answers = []) {
    const a = answers.map((x) => (x || '').toString().toLowerCase());
    const pick = (i, map, dflt) => {
        const ans = a[i] || '';
        if (/قرر أنت|you decide/.test(ans)) return dflt;
        for (const [re, val] of map) if (re.test(ans)) return val;
        return dflt;
    };
    const audience = pick(0, [[/b2b|شركات|business/, 'B2B'], [/كلا|both/, 'B2C+B2B'], [/b2c|أفراد|consumer/, 'B2C']], 'B2C');
    const platform = pick(1, [[/تطبيق|app|pwa|mobile/, 'Web+PWA'], [/ويب|web/, 'Web']], 'Web');
    const scope = pick(2, [[/mvp|سريع|أولى|fast/, 'MVP'], [/متكامل|full|منصّ/, 'Full']], 'MVP');
    return { audience, platform, scope };
}

function planPhases(decisions, lang = 'ar') {
    const L = lang === 'ar';
    const phases = L
        ? ['المرحلة 1 (MVP): الواجهة الأساسية + الميزة المحورية', 'المرحلة 2: الحسابات والمصادقة', 'المرحلة 3: لوحة التحكم والتحليلات']
        : ['Phase 1 (MVP): core UI + key feature', 'Phase 2: accounts & auth', 'Phase 3: dashboard & analytics'];
    if (decisions.scope === 'MVP') return phases.slice(0, 2);
    return phases;
}

async function buildProjectPlan(state) {
    const { originalGoal, projectType, questions, answers, lang } = state;
    const decisions = deriveStrategicDecisions(answers);

    const goalWords = originalGoal.replace(/^(ابني|اصنع|انشئ|بني|سوي|اعمل|build|create|make)\s+(لي\s+)?(موقع\s+)?/i, '').trim();
    const smartName = goalWords || originalGoal.split(' ').slice(-3).join(' ');
    const qaText = questions.map((q, i) => `س: ${qText(q)}\nج: ${answers[i] || 'لم يُجَب'}`).join('\n\n');

    let plan;
    try {
        const _resp = await smartChat([
            { role: 'system', content: `أنت مخطط مشاريع ويب. أنشئ خطة موجزة بـ JSON: { "projectName": "اسم", "sections": [], "features": [], "colorMood": "وصف" }` },
            { role: 'user', content: `الطلب: ${originalGoal}\nالنوع: ${projectType}\nالقرارات: ${JSON.stringify(decisions)}\n\n${qaText}` },
        ], { max_tokens: 500, temperature: 0.3, json: true });
        plan = JSON.parse(_resp);
    } catch (e) {
        plan = {
            projectName: smartName,
            sections: ['navbar', 'hero', 'الخدمات', 'من نحن', 'تواصل', 'footer'],
            features: ['تصميم متجاوب', 'صور احترافية', 'نموذج تواصل'],
            colorMood: 'ألوان متناسقة واحترافية',
        };
    }
    // القرارات الاستراتيجية والمراحل تُضاف دائماً (حتمية) فوق مخرجات الـ AI
    plan.audience = decisions.audience;
    plan.platform = decisions.platform;
    plan.scope = decisions.scope;
    plan.phases = planPhases(decisions, lang);
    plan.estimatedTime = lang === 'en' ? 'minutes' : 'دقائق';
    // ميزات مشتقّة من القرارات
    plan.features = plan.features || [];
    if (decisions.audience.includes('B2B') && !plan.features.some(f => /إدارة|admin|dashboard|لوحة/.test(f))) plan.features.push('لوحة إدارة للشركات');
    if (decisions.platform.includes('PWA') && !plan.features.some(f => /PWA|جوال|offline/.test(f))) plan.features.push('دعم تطبيق جوال (PWA)');
    return plan;
}

// ═══════════════════════════════════════════════════════
// 📄 تنسيق عرض الخطة للمستخدم
// ═══════════════════════════════════════════════════════
function formatPlan(plan, state) {
    const lang = state.lang || 'ar';
    const sections = (plan.sections || []).map(s => `   ✦ ${s}`).join('\n');
    const features = (plan.features || []).map(f => `   • ${f}`).join('\n');
    const phases = (plan.phases || []).map(p => `   ${p}`).join('\n');
    const strat = plan.audience
        ? (lang === 'en'
            ? `\n**🎯 Strategy:** ${plan.audience} · ${plan.platform} · ${plan.scope}\n`
            : `\n**🎯 الاستراتيجية:** ${plan.audience} · ${plan.platform} · ${plan.scope}\n`)
        : '';

    if (lang === 'en') {
        return `Got it! Here's your project plan 📋
${strat}
**🏷️ Project Name:** ${plan.projectName || state.originalGoal}

**📐 Sections:**
${sections}

**⚡ Features:**
${features}
${phases ? `\n**🗺️ Roadmap:**\n${phases}\n` : ''}
**🎨 Visual Identity:** ${plan.colorMood}

---
Ready to build? Type **"start"** to proceed, or tell me any changes.`;
    }

    return `ممتاز! فهمت ما تريد. إليك خطة مشروعك 📋
${strat}
**🏷️ اسم المشروع:** ${plan.projectName || state.originalGoal}

**📐 الأقسام:**
${sections}

**⚡ الميزات:**
${features}
${phases ? `\n**🗺️ خارطة الطريق:**\n${phases}\n` : ''}
**🎨 الهوية البصرية:** ${plan.colorMood}

---
هل تريد البدء بالبناء الآن؟ اكتب **"ابدأ"** للتنفيذ، أو أخبرني بأي تعديل.`;
}

// ═══════════════════════════════════════════════════════
// ✅ تأكيد البناء بعد عرض الخطة
// ═══════════════════════════════════════════════════════
const CONFIRM_PATTERNS = /^(ابدأ|ابدا|ابد|نفذ|تمام|موافق|نعم|اكمل|يلا|امشي|هيا|اوكي|اوك|يس|go|yes|ok|okay|start|proceed|build|build it|let's go|do it|اكيد|صح|بالتوفيق|كمل|هيه|اه|آه|يي|yep|sure|alright|begin|execute|run|launch|deploy|lets go|let go|يلا|هلا)/i;

export function isConfirmation(message) {
    return CONFIRM_PATTERNS.test(message.trim());
}

export function getFinalGoal(username) {
    const state = conversationState.get(username);
    if (!state) return null;

    const { originalGoal, answers, questions, plan } = state;

    // دمج الطلب الأصلي مع الإجابات والقرارات الاستراتيجية في prompt غني تقرؤه الفرق
    const stratLine = plan?.audience
        ? `\nالقرارات الاستراتيجية (التزم بها):\n- الجمهور: ${plan.audience}\n- المنصّة: ${plan.platform}\n- النطاق: ${plan.scope}\n- خارطة الطريق: ${(plan.phases || []).join(' ← ')}`
        : '';
    const enrichedGoal = `${originalGoal}
${stratLine}

تفاصيل إضافية من المستخدم:
${questions.map((q, i) => `- ${qText(q)}\n  الجواب: ${answers[i] || 'لا يوجد'}`).join('\n')}

خطة المشروع المتفق عليها:
- الأقسام: ${(plan?.sections || []).join('، ')}
- الميزات: ${(plan?.features || []).join('، ')}
- الهوية البصرية: ${plan?.colorMood || ''}`;

    // مسح الحالة بعد البناء
    conversationState.delete(username);

    return enrichedGoal;
}

export function clearState(username) {
    conversationState.delete(username);
}

export function getState(username) {
    return conversationState.get(username) || { stage: STAGES.IDLE };
}
