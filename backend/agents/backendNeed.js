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
]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// لغتان، قاعدتا مطابقة — لأن الصرف يختلف:
//
// • العربية: مطابقة احتواء كما كانت. السوابق واللواحق تلتصق بالكلمة
//   («الحساب»، «حسابات»، «للمستخدمين»)، فحدود الكلمات تُسقط المطابقات
//   الصحيحة لا الخاطئة.
//
// • اللاتينية: حدود كلمات مع لاحقة جمع إنجليزية اختيارية. الاحتواء
//   المجرّد كان يقرأ «api» داخل *therapist* و«auth» داخل *author*
//   و«cart» داخل *cartoon* و«store» داخل *restore* — فيولّد خادماً
//   لصفحة تعريفية ساكنة، ويحرق ميزانية نداءات المستخدم بلا سبب.
//   ⚠️ ثمن معلوم مقبول: «bookstore» لم تعد تُطابق `store` — يغطّيها
//   `cart`/`order`/`checkout`/«متجر» في أي هدف تسوّقٍ حقيقي.
const isLatin = (kw) => /^[\x20-\x7E]+$/.test(kw);
const ARABIC_KEYWORDS = BACKEND_KEYWORDS.filter((kw) => !isLatin(kw));
const LATIN_MATCHERS = BACKEND_KEYWORDS.filter(isLatin).map(
    (kw) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(kw)}(?:es|s)?(?![\\p{L}\\p{N}])`, 'iu'),
);

export function needsBackend(userGoal) {
    const goal = String(userGoal ?? '').toLowerCase();
    if (!goal) return false;
    return ARABIC_KEYWORDS.some((kw) => goal.includes(kw))
        || LATIN_MATCHERS.some((re) => re.test(goal));
}

export default { needsBackend, BACKEND_KEYWORDS };
