// 🛠️ عنوان الباك إند الموحد.
// الأولوية لـVITE_API_URL المضبوط وقت البناء — كان مضبوطاً في Vercel لكن
// الكود لم يقرأه إطلاقاً، فبقي العنوان مثبّتاً هنا مهما غُيّر الإعداد.
// عند غيابه: التطوير المحلي على منفذ 4000، والإنتاج على العنوان الافتراضي.
const CONFIGURED_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('100.115');

export const BACKEND_URL =
  CONFIGURED_API_URL ||
  (isLocalHost ? `http://${window.location.hostname}:4000` : 'https://jaola-os.onrender.com');

/**
 * 🔍 تشخيص فشل fetch — المتصفح **يخفي** سبب فشل CORS عن الجافاسكربت عمداً
 * (يرمي TypeError مبهماً مطابقاً لحالة انقطاع الشبكة)، فلا يمكن التمييز
 * برمجياً بينهما. ما نستطيعه ونفعله هنا:
 *  - التفريق بين "الجهاز غير متصل" وبين "الخادم لم يستجب/رفض".
 *  - طباعة العنوان الفعلي والسبب الخام في الـconsole للتشخيص.
 * درس مدفوع الثمن: فشل CORS كان يُعرض كـ"تعذّر الوصول للخادم" فأُهدر وقت
 * في البحث بمكان خاطئ بينما الخادم يعمل ويرفض الأصل غير المسموح.
 */
export function describeFetchFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { offline: true, host: BACKEND_URL };
  }
  console.error(
    `[JAOLA] فشل الاتصال بـ ${BACKEND_URL}. الجهاز متصل بالإنترنت، فالسبب الأرجح:\n` +
    `  • الخادم متوقف أو نائم، أو\n` +
    `  • رفض الأصل (CORS): تأكد أن ALLOWED_ORIGINS في الخادم يشمل ${window.location.origin}\n` +
    `السبب الخام:`, error
  );
  return { offline: false, host: BACKEND_URL };
}

// 🎬 استوديو الفيديو — خدمة منفصلة تماماً (video-service/) تُنشر على عنوانها
// الخاص. يُضبط عبر VITE_VIDEO_STUDIO_URL وقت البناء؛ إن لم يُضبط فالزر
// لا يظهر أصلاً — لا رابط مكسور ولا تخمين لعنوان غير مؤكد.
export const VIDEO_STUDIO_URL = (import.meta.env.VITE_VIDEO_STUDIO_URL || '').replace(/\/$/, '');

/**
 * يفتح الاستوديو بتسليم توكن الجلسة الحالية (الدخول الموحّد) في تبويب
 * جديد. الاستوديو يلتقط ?token= ويحذفه من شريط العنوان فوراً.
 */
export function openVideoStudio() {
  if (!VIDEO_STUDIO_URL) return;
  const token = localStorage.getItem('token') || '';
  window.open(`${VIDEO_STUDIO_URL}/?token=${encodeURIComponent(token)}`, '_blank', 'noopener');
}

// ✈️ بوابة السفر — خدمة منفصلة تماماً (travel-service/) بنفس قاعدة
// الاستوديو حرفياً: تُضبط عبر VITE_TRAVEL_PORTAL_URL وقت البناء، وبدونها
// لا يظهر الزر أصلاً — لا رابط مكسور ولا تخمين لعنوان غير مؤكد.
export const TRAVEL_PORTAL_URL = (import.meta.env.VITE_TRAVEL_PORTAL_URL || '').replace(/\/$/, '');

/** يفتح بوابة السفر بتسليم توكن الجلسة الحالية (الدخول الموحّد). */
export function openTravelPortal() {
  if (!TRAVEL_PORTAL_URL) return;
  const token = localStorage.getItem('token') || '';
  window.open(`${TRAVEL_PORTAL_URL}/?token=${encodeURIComponent(token)}`, '_blank', 'noopener');
}
