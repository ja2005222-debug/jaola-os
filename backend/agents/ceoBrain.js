/**
 * 🧠 CEO Brain — JAOLA OS
 *
 * الطبقة التي تحوّل الشات من "سؤال وجواب" إلى رئيس تنفيذي يدير شركة برمجية:
 *
 *   User → Intent Engine → Decision Engine → Task Planner → Execution
 *
 * - classifyIntentFast: نوايا إدارية لا يغطيها detectIntentFromMeaning
 *   (كمل / أين وصلنا / انشر / ادفع لGitHub / تحية)
 * - decide: محرك القرار — أجيب أم أنفذ؟ وما الذي يحتاجه التنفيذ؟
 * - buildContinuationGoal: يبني هدف "كمل" من ذاكرة المشروع وحالته
 * - buildStatusReply: بطاقة حالة المشروع الكاملة (مدير الحوار)
 * - missionBriefing: إحاطة المهمة بأسلوب CEO مع وقت متوقع
 */

import { getProjectMemory } from './projectMemory.js';
import { getProjectState, getProjectSummary, isBuilding, STATES } from './stateMachine.js';
import { normalizeArabic } from './textNormalizer.js';

// ═══════════════════════════════════════════════════════
// 1️⃣ Intent Engine — النوايا الإدارية السريعة (بدون LLM)
// ═══════════════════════════════════════════════════════
const INTENT_RULES = [
    // ملاحظة مهمة: \b في JavaScript لا يعمل مع الحروف العربية (خارج \w)
    // لذلك نستخدم (?:\s|$|[!؟?.]) كحدود للكلمات العربية
    {
        intent: 'continue',
        patterns: [
            /^(كمل|أكمل|اكمل|كمّل|واصل|تابع|استمر|استانف|استأنف)(?:\s|$|[!؟?.])/,
            // "نفذ" وحدها = أمر تنفيذ عام → استئناف من الذاكرة
            /^(نفذ|نفّذ)(?:\s*(الان|الآن|now))?\s*[!؟?.]*$/,
            /^(تمام\s*)?(نفذ|نفّذ)(?:\s|$|[!؟?.])/,
            /^(continue|resume|proceed|keep going|carry on|do it|execute|go ahead|run it)\b/i,
            /(كمل|أكمل|اكمل|واصل).*(المشروع|الموقع|الشغل|البناء|مشروع)/,
            /(continue|resume).*(project|website|work|build)/i,
        ],
    },
    {
        intent: 'status',
        patterns: [
            /(أين|وين|فين)\s*(وصلنا|وصلت|وصل)/,
            /(وش|ايش|إيش|شنو|ماذا)\s*(صار|حصل|الوضع|تم)/,
            /(حالة|وضع|تقدم)\s*(المشروع|الشغل|البناء)/,
            /^(status|progress)\b/i,
            /(where are we|what.?s the status|how.?s it going|project status)/i,
        ],
    },
    {
        intent: 'deploy',
        patterns: [
            /^(انشر|أنشر|اطلق|أطلق)(?:\s|$|[!؟?.])/,
            /(انشر|ارفع)\s*(الموقع|المشروع)\s*(الآن|الان|اونلاين|أونلاين)?/,
            /^(deploy|publish|go live|ship it)\b/i,
        ],
    },
    {
        intent: 'github_push',
        patterns: [
            /(ادفع|ارفع|احفظ).*(github|جيتهاب|جيت هاب|قيتهاب|المستودع|الريبو)/i,
            /(github|git)\s*(push|دفع)/i,
            /^push\b/i,
        ],
    },
    {
        intent: 'greeting',
        patterns: [
            /^(مرحبا|مرحباً|اهلا|أهلا|هلا|هاي|السلام عليكم|صباح الخير|مساء الخير)\s*[!.؟]*$/,
            /^(hi|hello|hey|good morning|good evening)\s*[!.?]*$/i,
        ],
    },
];

export function classifyIntentFast(message) {
    const text = (message || '').trim();
    if (!text) return null;
    const normAr = normalizeArabic(text);

    for (const rule of INTENT_RULES) {
        if (rule.patterns.some(p => p.test(text) || p.test(normAr))) {
            return { intent: rule.intent, confidence: 95 };
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════
// 2️⃣ Decision Engine — أجيب أم أنفذ؟
// ═══════════════════════════════════════════════════════
export function decide(intent, username, project) {
    const building = isBuilding(username, project);

    switch (intent) {
        case 'status':
            return { action: 'reply', needs: {}, reason: 'استعلام حالة — لا يحتاج تنفيذاً' };
        case 'greeting':
            return { action: 'reply', needs: {}, reason: 'تحية — رد مباشر' };
        case 'continue':
            return building
                ? { action: 'reply', needs: {}, reason: 'مهمة تعمل بالفعل — لا تنفيذ متوازٍ' }
                : { action: 'execute', needs: { code: true, build: true }, reason: 'استئناف من الذاكرة' };
        case 'deploy':
            return building
                ? { action: 'reply', needs: {}, reason: 'انتظار انتهاء البناء قبل النشر' }
                : { action: 'execute', needs: { deploy: true }, reason: 'نشر مباشر' };
        case 'github_push':
            return { action: 'execute', needs: { git: true }, reason: 'دفع للمستودع' };
        default:
            return { action: 'delegate', needs: {}, reason: 'يُحال لتصنيف النية العام' };
    }
}

// ═══════════════════════════════════════════════════════
// 3️⃣ Task Planner — بناء هدف "كمل" من الذاكرة والحالة
// ═══════════════════════════════════════════════════════
export function buildContinuationGoal(username, project) {
    const mem = getProjectMemory(username, project);
    const state = getProjectState(username, project);

    // لا ذاكرة ولا هدف — لا شيء نكمله
    if (!mem.originalGoal && !mem.structure.sections.length && !mem.history.length) {
        return null;
    }

    const parts = [];
    if (mem.originalGoal) parts.push(`الهدف الأصلي للمشروع: ${mem.originalGoal}`);
    if (mem.structure.sections.length) parts.push(`الأقسام المبنية: ${mem.structure.sections.join('، ')}`);
    if (mem.structure.features.length) parts.push(`الميزات المطلوبة: ${mem.structure.features.join('، ')}`);
    if (mem.design.colors) parts.push(`الألوان المعتمدة: ${mem.design.colors} (حافظ عليها)`);
    if (mem.history.length) parts.push(`آخر ما تم: ${mem.history.slice(0, 3).map(h => h.action).join(' ثم ')}`);
    if (state.state === STATES.FAILED) parts.push('المحاولة السابقة فشلت — أصلح وأكمل.');
    if (state.state === STATES.PAUSED) parts.push('المشروع كان متوقفاً بطلب المستخدم — استأنف من حيث توقف.');

    return `أكمل بناء المشروع الحالي من حيث توقف. لا تبدأ من الصفر — طوّر الموجود.\n${parts.join('\n')}`;
}

// ═══════════════════════════════════════════════════════
// 4️⃣ Conversation Manager — بطاقة حالة المشروع
// ═══════════════════════════════════════════════════════
const STATE_LABELS = {
    ar: { idle: 'خامل — بانتظار أوامرك', planning: 'التخطيط (أسئلة التوضيح)', generating: 'البرمجة الآن', reviewing: 'المراجعة والفحص', deploying: 'النشر', completed: 'مكتمل ✅', failed: 'فشل ❌', paused: 'متوقف مؤقتاً ⏸' },
    en: { idle: 'Idle — awaiting orders', planning: 'Planning (clarifying)', generating: 'Coding now', reviewing: 'Reviewing & testing', deploying: 'Deploying', completed: 'Completed ✅', failed: 'Failed ❌', paused: 'Paused ⏸' },
};

export function buildStatusReply(username, project, lang = 'ar') {
    const summary = getProjectSummary(username, project);
    const mem = getProjectMemory(username, project);
    const labels = STATE_LABELS[lang] || STATE_LABELS.ar;
    const ar = lang === 'ar';

    const lines = [];
    lines.push(ar ? `📊 تقرير حالة المشروع (${project})` : `📊 Project Status Report (${project})`);
    if (mem.originalGoal) lines.push((ar ? '🎯 الهدف: ' : '🎯 Goal: ') + mem.originalGoal.slice(0, 120));
    lines.push((ar ? '⚙️ المرحلة: ' : '⚙️ Stage: ') + (labels[summary.state] || summary.state) + ` — ${summary.progress}%`);
    if (summary.currentAgent) lines.push((ar ? '🤖 الوكيل الحالي: ' : '🤖 Current agent: ') + summary.currentAgent);
    if (summary.completedAgents.length) lines.push((ar ? '✅ أنجز: ' : '✅ Done: ') + summary.completedAgents.join('، '));
    if (mem.structure.sections.length) lines.push((ar ? '🧱 الأقسام: ' : '🧱 Sections: ') + mem.structure.sections.join('، '));
    if (mem.history.length) lines.push((ar ? '🕘 آخر إجراء: ' : '🕘 Last action: ') + mem.history[0].action);
    if (summary.deployUrl) lines.push((ar ? '🌍 الرابط: ' : '🌍 Live: ') + summary.deployUrl);

    lines.push('');
    lines.push(ar
        ? 'قل "كمل" للاستئناف، أو أخبرني بتعديل محدد.'
        : 'Say "continue" to resume, or tell me a specific change.');

    return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// 5️⃣ CEO Personality — إحاطة المهمة مع وقت متوقع
// ═══════════════════════════════════════════════════════
export function estimateETA(goal = '', hasExisting = false) {
    const g = goal.toLowerCase();
    const complex = /backend|database|قاعدة بيانات|دفع|payment|auth|تسجيل|اشتراك|لوحة تحكم|admin|api/i.test(g);
    if (hasExisting && !complex) return { ar: '~دقيقة واحدة', en: '~1 minute' };
    if (complex) return { ar: '~3-4 دقائق', en: '~3-4 minutes' };
    return { ar: '~دقيقتان', en: '~2 minutes' };
}

export function missionBriefing({ lang = 'ar', goal = '', hasExisting = false }) {
    const eta = estimateETA(goal, hasExisting);
    if (lang === 'ar') {
        return [
            '✅ المهمة مقبولة — Mission Accepted.',
            '',
            '🔍 جاري تحليل متطلبات العمل...',
            hasExisting
                ? '📂 وجدت مشروعاً قائماً — سأطوّر الموجود بدل البناء من الصفر.'
                : '🆕 مشروع جديد — سأبني بأفضل المعايير.',
            '🗺️ Planner بدأ رسم الخطة.',
            '🏗️ Architect معيّن للهيكلة.',
            '💻 Coder على أهبة الاستعداد.',
            '',
            `⏱️ الوقت المتوقع: ${eta.ar}`,
            'تابع التقدم الحي هنا — سأبلغك بكل خطوة.',
        ].join('\n');
    }
    return [
        '✅ Mission Accepted.',
        '',
        '🔍 Analyzing business requirements...',
        hasExisting
            ? '📂 Existing project found — I will evolve it, not rebuild.'
            : '🆕 New project — building with best practices.',
        '🗺️ Planner started.',
        '🏗️ Architect assigned.',
        '💻 Coder standing by.',
        '',
        `⏱️ ETA: ${eta.en}`,
        'Watch the live progress here — I will report every step.',
    ].join('\n');
}

// رد التحية بأسلوب CEO — مع حالة المشروع إن وُجد
export function greetingReply(username, project, lang = 'ar') {
    const summary = getProjectSummary(username, project);
    const hasActive = summary.state !== 'idle';
    if (lang === 'ar') {
        return hasActive
            ? `أهلاً بعودتك. 👋\nمشروعك (${project}) في مرحلة "${summary.state}" — ${summary.progress}%.\nقل "كمل" للاستئناف أو "أين وصلنا" للتقرير الكامل.`
            : `أهلاً بك في JAOLA OS. 👋\nأنا رئيسك التنفيذي التقني — أخبرني ماذا نبني اليوم وسيبدأ فريقي فوراً.`;
    }
    return hasActive
        ? `Welcome back. 👋\nYour project (${project}) is at "${summary.state}" — ${summary.progress}%.\nSay "continue" to resume or "status" for the full report.`
        : `Welcome to JAOLA OS. 👋\nI'm your technical CEO — tell me what to build and my team starts immediately.`;
}
