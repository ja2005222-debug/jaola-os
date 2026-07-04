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
    const projectType = detectProjectType(userGoal);
    const lang = getUserLanguage(username) || detectLanguage(userGoal);

    // 🆕 جرّب الأسئلة الديناميكية أولاً
    let questions = await generateDynamicQuestions(userGoal, projectType, lang);

    // Fallback للأسئلة الثابتة إذا فشل AI
    if (!questions) {
        questions = lang === 'ar'
            ? (CLARIFIER_QUESTIONS[projectType] || DEFAULT_QUESTIONS)
            : (CLARIFIER_QUESTIONS_EN[projectType] || DEFAULT_QUESTIONS_EN);
    }

    conversationState.set(username, {
        stage: STAGES.CLARIFYING,
        originalGoal: userGoal,
        projectType,
        questions,
        currentQuestion: 0,
        answers: [],
        lang,
        isDynamic: true,
    });

    const totalQuestions = questions.length;
    const intro = lang === 'ar'
        ? `قبل أن أبدأ البناء، لدي ${totalQuestions} أسئلة سريعة 🎯\n\n**السؤال 1/${totalQuestions}:**\n${questions[0]}`
        : `Before I start building, I have ${totalQuestions} quick questions 🎯\n\n**Question 1/${totalQuestions}:**\n${questions[0]}`;

    return { type: 'clarification', message: intro, projectType, questionIndex: 0, totalQuestions };

    return { type: 'clarification', message: intro, projectType, questionIndex: 0, totalQuestions };
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
        const label = lang === 'ar'
            ? `**السؤال ${state.currentQuestion + 1}/${state.questions.length}:**\n${nextQuestion}`
            : `**Question ${state.currentQuestion + 1}/${state.questions.length}:**\n${nextQuestion}`;
        return { type: 'clarification', message: label };
    }

    state.stage = STAGES.PLANNING;
    conversationState.set(username, state);

    const plan = await buildProjectPlan(state);
    state.plan = plan;
    conversationState.set(username, state);

    return { type: 'plan', message: formatPlan(plan, state), plan, readyToBuild: true };
}

// ═══════════════════════════════════════════════════════
// 🗺️ بناء خطة المشروع بناءً على الإجابات
// ═══════════════════════════════════════════════════════
async function buildProjectPlan(state) {
    const { originalGoal, projectType, questions, answers } = state;

    // استخراج اسم ذكي من الإجابات والطلب
    const cuisineAnswer = answers[2] || '';
    const goalWords = originalGoal.replace(/^(ابني|اصنع|انشئ|بني|سوي|اعمل)\s+(لي\s+)?(موقع\s+)?/i, '').trim();
    const smartName = cuisineAnswer && cuisineAnswer.length < 20
        ? `${goalWords} ${cuisineAnswer}`.trim()
        : goalWords || originalGoal.split(' ').slice(-3).join(' ');

    const qaText = questions.map((q, i) => `س: ${q}\nج: ${answers[i] || 'لم يُجَب'}`).join('\n\n');

    try {
        const _resp = await smartChat([
                {
                    role: 'system',
                    content: `أنت مخطط مشاريع ويب. أنشئ خطة موجزة بـ JSON: { "projectName": "اسم", "sections": [], "features": [], "colorMood": "وصف", "estimatedTime": "ثوانٍ" }`
                },
                {
                    role: 'user',
                    content: `الطلب: ${originalGoal}\nالنوع: ${projectType}\n\n${qaText}`
                }
            ], { max_tokens: 500, temperature: 0.3, json: true });
        return JSON.parse(_resp);
    } catch (e) {
        // خطة افتراضية إذا فشل الـ AI
        return {
            projectName: smartName || originalGoal.split(' ').slice(-3).join(' '),
            sections: ['navbar', 'hero', 'الخدمات', 'من نحن', 'تواصل', 'footer'],
            features: ['تصميم متجاوب', 'صور احترافية', 'نموذج تواصل'],
            colorMood: 'ألوان متناسقة واحترافية',
            estimatedTime: 'ثوانٍ'
        };
    }
}

// ═══════════════════════════════════════════════════════
// 📄 تنسيق عرض الخطة للمستخدم
// ═══════════════════════════════════════════════════════
function formatPlan(plan, state) {
    const lang = state.lang || 'ar';
    const sections = (plan.sections || []).map(s => `   ✦ ${s}`).join('\n');
    const features = (plan.features || []).map(f => `   • ${f}`).join('\n');

    if (lang === 'en') {
        return `Got it! Here's your project plan 📋

**🏷️ Project Name:** ${plan.projectName || state.originalGoal}

**📐 Sections:**
${sections}

**⚡ Features:**
${features}

**🎨 Visual Identity:** ${plan.colorMood}

**⏱️ Estimated Time:** ${plan.estimatedTime}

---
Ready to build? Type **"start"** to proceed, or tell me any changes you'd like.`;
    }

    return `ممتاز! فهمت ما تريد. إليك خطة مشروعك 📋

**🏷️ اسم المشروع:** ${plan.projectName || state.originalGoal}

**📐 الأقسام:**
${sections}

**⚡ الميزات:**
${features}

**🎨 الهوية البصرية:** ${plan.colorMood}

**⏱️ الوقت المتوقع:** ${(isNaN(plan.estimatedTime) ? plan.estimatedTime : 'دقائق') || 'دقائق'}

---
هل تريد البدء بالبناء الآن؟ اكتب **"ابدأ"** للتنفيذ، أو أخبرني بأي تعديل تريده على الخطة.`;
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

    // دمج الطلب الأصلي مع الإجابات في prompt غني
    const enrichedGoal = `${originalGoal}

تفاصيل إضافية من المستخدم:
${questions.map((q, i) => `- ${q}\n  الجواب: ${answers[i] || 'لا يوجد'}`).join('\n')}

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
