import { matchersFor, matchesAny } from './keywordMatch.js';
import { stripNegated } from './textNormalizer.js';

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
    // 🔴 أُسقطت «تسجيل» المفردة (2026-09-07): «**تسجيل** ما حُفظ» في متتبّع حفظٍ ليس
    //    تسجيلَ دخول. والصيغةُ الدقيقة «تسجيل دخول» باقيةٌ فوقها، و«صفحة تسجيل عضوية»
    //    يلتقطها 'عضوية' — فما سقط هو الاتّساعُ وحدَه لا الإشارة (مقيسٌ: ٥٣ اختباراً خضراء).
    'تسجيل دخول', 'حساب', 'مستخدم', 'مستخدمين',
    'دفع', 'دفع إلكتروني', 'حجز', 'حجوزات', 'لوحة تحكم', 'لوحة إدارة',
    // 🔴 وأُسقطت «بيانات» المفردة للسبب نفسِه: «بقاء **البيانات** … يبقى في المتصفّح»
    //    نصٌّ يقول صراحةً إنّه بلا خادم. و«قاعدة بيانات» باقيةٌ هنا.
    'قاعدة بيانات', 'إدارة', 'تخزين', 'رفع', 'رفع صور',
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

// 📐 قاعدتا المطابقة انتقلتا إلى `keywordMatch.js` — أداةٌ واحدة لعلّةٍ
// تكرّرت خمس مرّات (طبي/تطبيق، api/therapist، مالي/جمالي، كاش/كاشير،
// شيل/تشيلي). فما كان هنا نسخةً صار مصدراً مشتركاً.
const BACKEND_MATCHERS = matchersFor(BACKEND_KEYWORDS);
const RELATIONAL_MATCHERS = matchersFor(RELATIONAL_KEYWORDS);

// 🚫 النفيُ يُطوى قبل المطابقة — والأداةُ نفسُها انتقلت إلى `textNormalizer.js` حين تبيّن أنّ
// لها مستهلكاً ثانياً: بوّابةُ الفهم (PM/23) كانت تقرأ الطلبَ بلا طيِّ نفيٍ، فأنقذ `account`
// المأخوذُ من «بلا حساب» فهماً مهلوَساً من الوصم. مصدرٌ واحدٌ لعلّةٍ واحدة، وإعادةُ التصدير
// تُبقي مستهلكي هذه الوحدة واختباراتِها كما هي.
export { stripNegated } from './textNormalizer.js';

export function needsBackend(userGoal) {
    return matchesAny(BACKEND_MATCHERS, stripNegated(userGoal));
}

/**
 * هل يحتاج المشروع قاعدةً **علاقية**؟ مجموعةٌ جزئيّة من `needsBackend` بالبناء:
 * كلماتُها داخل الاتحاد، فما يُثبت هذه يُثبت تلك حتماً — لا تناقضَ ممكن.
 */
export function needsRelationalDb(userGoal) {
    return matchesAny(RELATIONAL_MATCHERS, stripNegated(userGoal));
}

export default { needsBackend, needsRelationalDb, stripNegated, BACKEND_KEYWORDS };
