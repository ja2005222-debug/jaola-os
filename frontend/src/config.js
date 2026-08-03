// 🛠️ عنوان الباك إند الموحد — نفس المنطق المستخدم سابقاً في Dashboard/useSocket/PreviewFrame
export const BACKEND_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('100.115')
    ? `http://${window.location.hostname}:4000`
    : 'https://jaola-os.onrender.com';

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
