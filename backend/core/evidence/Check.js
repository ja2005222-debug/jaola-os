/**
 * 🔍 Check — وحدة الدليل الرسمية (Sprint 4 / محور Evidence).
 *
 * الشكل **قائمٌ ومتماسك** منذ `behaviorVerifier.js`، ولا يُعاد تصميمه هنا:
 *   `{ name, status: 'pass'|'fail'|'warn', detail }`
 * ما يضيفه هذا الملف هو **مصدرٌ واحد** لبنائه وفرزه، ليتكلّم به الناقدان
 * (`qaVerify` و`architectReview`) نفس لغة بقية النظام.
 *
 * ⚠️ ولماذا هذا ليس مراسم تجريد؟ لأن اختلاف اللغة كان يُنتج عطبين
 * مُثبتين بالتشغيل:
 *
 * 1️⃣ **`qaVerify` كان يمحو الفرق بين الفشل والتحذير عند الإرجاع**:
 *    داخلياً `failures` و`logs` منفصلان، لكن العقد يعيد
 *    `logs: passed ? logs : [...failures, ...logs]` — مصفوفةٌ واحدة مسطّحة.
 *    و`jcr.js` يسجّل **كل** سطر فيها درساً باسم `qa_failure`. فخطةٌ فشلها
 *    الصلب «أقواس غير متوازنة» كانت تسجّل معها «لا يوجد footer» و«بلا meta
 *    viewport» **بوصفها أسباب فشل** — في الذاكرة التعليمية التي تُحقن في
 *    prompt المولّد مستقبلاً. أي أن النظام كان يتعلّم من كذبةٍ عن نفسه.
 *
 * 2️⃣ **`architectReview` كان يعود عند أول مشكلة**: خطةٌ بلا CSS وبـHTML
 *    قصير تُبلَّغ بمشكلة واحدة، فتُصلَح واحدةً واحدة — ودورة إعادة التوليد
 *    تحرق `budget.consumeCall()`. بميزانية محدودة قد لا تتقارب الخطة أبداً.
 *
 * الحلّ في الحالتين واحد: **لا تمحُ تمييزاً تملكه**.
 */

export const STATUS = Object.freeze({ PASS: 'pass', FAIL: 'fail', WARN: 'warn' });

/** يبني فحصاً بالشكل الرسمي — `detail` نصٌّ يقرؤه إنسان ونموذج معاً. */
export function check(name, status, detail) {
    return { name: String(name || 'check'), status, detail: String(detail || '') };
}

export const fail = (name, detail) => check(name, STATUS.FAIL, detail);
export const warn = (name, detail) => check(name, STATUS.WARN, detail);
export const pass = (name, detail) => check(name, STATUS.PASS, detail);

const of = (checks, status) => (Array.isArray(checks) ? checks : []).filter((c) => c?.status === status);

/** ما يوجب الرفض وإعادة التوليد — وحده يُسجَّل درس فشل. */
export const failures = (checks) => of(checks, STATUS.FAIL);
/** ما يُذكر ولا يوقف — لا يُسجَّل درس فشل أبداً. */
export const warnings = (checks) => of(checks, STATUS.WARN);
/** هل اجتاز؟ وجود تحذيرات لا يُسقط. */
export const passed = (checks) => failures(checks).length === 0;

/**
 * نصٌّ للنقد يُمرَّر للمولّد: الأعطاب أولاً وموسومة، ثم التحذيرات.
 * الوسم مقصود — النموذج كان يرى قائمةً مسطّحة فلا يعرف أيّها أوقف البناء.
 */
export function renderCritique(checks) {
    const f = failures(checks).map((c) => `❌ ${c.detail}`);
    const w = warnings(checks).map((c) => `⚠️ ${c.detail}`);
    return [...f, ...w].join(' | ');
}
