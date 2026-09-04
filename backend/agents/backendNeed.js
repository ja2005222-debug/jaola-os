/**
 * 🎯 «هل يحتاج هذا المشروع خادماً؟» — مصدر الحقيقة الواحد
 *
 * كان هذا السؤال يُسأل مرّتين في المهمة الواحدة ويُجاب من قائمتَين
 * مختلفتَين، فتتناقض إجابتاه:
 *   • `jcr.js:_stageBackend`      → نسخة `knowledgeEngine` (تصل عبر
 *     `agents` من `server.js`)  → تقرّر **توليد ملفات الخلفية فعلاً**.
 *   • `jcr.js:_stageRenderConfig` → نسخة `backendAgent` (استيراد مباشر)
 *     → تقرّر **هل يُعدّ نشر Render مشروعاً بخادم**.
 * فهدفٌ مثل «أريد موقعاً يستقبل مدفوعات stripe» كان يولّد ملفات خلفية
 * ثم يُنشَر كموقع ثابت — فلا تعمل واجهة الدفع في الإنتاج أصلاً. القائمة
 * هنا هي **اتحاد** ما قصده كاتبا القائمتين، والدالة واحدة للموضعين.
 *
 * 📐 موضع الملف مقصود: `agents/` لا `core/`. المبدأ السادس في الخط
 * الأساس: «Core يملك orchestration وليس منطق Travel أو Coding» — وقائمة
 * كلماتٍ تصف متى يحتاج مشروعٌ مولَّدٌ خادماً هي منطق مجال البرمجة.
 */

// كلماتُ القاعدة العلاقية — كانت في `postgresAgent.js` وحدها
const RELATIONAL_KEYWORDS = Object.freeze([
    'محاسبة', 'مالي', 'علاقية',
    'postgres', 'postgresql', 'prisma', 'relational', 'finance', 'accounting',
]);

// كلمات تُشير أن المشروع يحتاج خادماً (اتحاد القائمتين السابقتين)
export const BACKEND_KEYWORDS = Object.freeze([
    // عربي
    'تسجيل دخول', 'تسجيل', 'حساب', 'مستخدم', 'مستخدمين',
    'دفع', 'دفع إلكتروني', 'حجز', 'حجوزات', 'لوحة تحكم', 'لوحة إدارة',
    'قاعدة بيانات', 'إدارة', 'تخزين', 'رفع', 'رفع صور', 'بيانات',
    'سلة', 'طلبات', 'منتجات', 'مخزون', 'فاتورة', 'اشتراك', 'عضوية',
    // إنجليزي
    'login', 'signup', 'register', 'auth', 'authentication', 'oauth',
    'google login', 'payment', 'checkout', 'cart', 'order', 'orders',
    'dashboard', 'admin', 'database', 'booking', 'reservation',
    'upload', 'inventory', 'subscription', 'members', 'users',
    'api', 'backend', 'server', 'crud', 'store', 'stripe', 'paypal',
    // 🔴 قائمةٌ ثالثة أغفلها الاتحاد: `postgresAgent.needsPostgres` كانت تقرّر
    // وحدها أن المشروع يحتاج قاعدةً علاقية، فتُكتب ملفات Prisma في مشروعٍ
    // يقول هذا الاتحادُ إنه بلا خادم أصلاً — schema بلا خادمٍ يُشغّلها.
    // وما يحتاج قاعدةً علاقية يحتاج خادماً بالتعريف، فصارت جزءاً من الاتحاد.
    ...RELATIONAL_KEYWORDS,
]);

/** ما يدلّ على حاجةٍ إلى قاعدةٍ **علاقية** تحديداً — مجموعةٌ جزئيّة من الاتحاد */
export const RELATIONAL_KEYWORDS_LIST = RELATIONAL_KEYWORDS;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// لغتان، قاعدتا مطابقة — لأن الصرف يختلف:
//
// • العربية: بدايةٌ مقيَّدة بالسوابق المعروفة، والنهايةُ حرّة. السوابقُ
//   واللواحق تلتصق بالكلمة («الحساب»، «حسابات»، «للمستخدمين»)، فحدُّ
//   الكلمة الكامل يُسقط المطابقات الصحيحة. لكنّ الاحتواءَ المجرّد كان
//   يقرأ «مالي» داخل *جمالي* و*أعمالي* و*الشمالي* و*الإجمالي* — فيولّد
//   Prisma لطلبٍ اسمُه «تصميم جمالي». فالسابقةُ لا تكون إلا من
//   [و ف] ثمّ [ب ك] ثمّ [لل ال ل]، وما عداها حرفٌ أصليّ يُبطل المطابقة.
//
// • اللاتينية: حدود كلمات مع لاحقة جمع إنجليزية اختيارية. الاحتواء
//   المجرّد كان يقرأ «api» داخل *therapist* و«auth» داخل *author*
//   و«cart» داخل *cartoon* و«store» داخل *restore* — فيولّد خادماً
//   لصفحة تعريفية ساكنة، ويحرق ميزانية نداءات المستخدم بلا سبب.
//   ⚠️ ثمن معلوم مقبول: «bookstore» لم تعد تُطابق `store` — يغطّيها
//   `cart`/`order`/`checkout`/«متجر» في أي هدف تسوّقٍ حقيقي.
const isLatin = (kw) => /^[\x20-\x7E]+$/.test(kw);

const arabicMatcher = (kw) =>
    new RegExp(`(?<![\\p{L}\\p{N}])(?:[وف])?(?:[بك])?(?:لل|ال|ل)?${escapeRe(kw)}`, 'u');
const latinMatcher = (kw) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(kw)}(?:es|s)?(?![\\p{L}\\p{N}])`, 'iu');

const matchersFor = (list) => list.map((kw) => (isLatin(kw) ? latinMatcher(kw) : arabicMatcher(kw)));

const BACKEND_MATCHERS = matchersFor(BACKEND_KEYWORDS);
const RELATIONAL_MATCHERS = matchersFor(RELATIONAL_KEYWORDS);

const matchesAny = (matchers, userGoal) => {
    const goal = String(userGoal ?? '').toLowerCase();
    if (!goal) return false;
    return matchers.some((re) => re.test(goal));
};

export function needsBackend(userGoal) {
    return matchesAny(BACKEND_MATCHERS, userGoal);
}

/**
 * هل يحتاج المشروع قاعدةً **علاقية**؟ مجموعةٌ جزئيّة من `needsBackend` بالبناء:
 * كلماتُها داخل الاتحاد، فما يُثبت هذه يُثبت تلك حتماً — لا تناقضَ ممكن.
 */
export function needsRelationalDb(userGoal) {
    return matchesAny(RELATIONAL_MATCHERS, userGoal);
}

export default { needsBackend, needsRelationalDb, BACKEND_KEYWORDS };
