/**
 * ⚡ كشف فشل تحميل حزم الصفحات المقسّمة (`lazy()`) والتعافي منه.
 *
 * ⚠️ درس إنتاجي (٢٥ أغسطس ٢٠٢٦): بلاغ «jaola.dev يعطي صفحة بيضاء فقط».
 * كل صفحات التطبيق تُحمَّل بـ`lazy()`، وحين يفشل جلب حزمة صفحةٍ يرمي React
 * أثناء الرسم؛ وبلا حدّ أخطاء **تُفرَّغ الشجرة كلها** فيبقى بياضٌ تام مع
 * عنوان التبويب سليماً (لأنه من index.html الثابت، بينما `document.title`
 * لا يُضبط إلا داخل تأثيرٍ لم يُنفَّذ قط) — وهو وصف البلاغ حرفياً.
 *
 * السبب الأشيع: **حزمة متقادمة**. المتصفح يحمل index.html قديماً (تبويب
 * مفتوح منذ ما قبل النشر) يشير إلى `index-<hash>.js` لم يعد موجوداً؛ وكان
 * كلا الخادمين يردّ index.html على أي مسار غير معروف بدل 404، فيصل HTML
 * بترويسة `text/html` مكان وحدة جافاسكربت فيرفض المتصفح تنفيذها.
 * (عولج جذرياً أيضاً: استثناء `/assets/` من احتياط SPA في backend/server.js
 * وvercel.json — 404 صريحة أصدق من HTML مموّه.)
 */

const RELOAD_GUARD_KEY = 'jaolaChunkReloadedAt';
const RELOAD_GUARD_TTL_MS = 60 * 1000;

// رسائل فشل الاستيراد الديناميكي تختلف بين المتصفحات — لا رمز خطأ موحّداً.
const CHUNK_ERROR = /dynamically imported module|Loading chunk|Importing a module script failed|Failed to fetch dynamically|expected a JavaScript(?:-or-Wasm)? module|MIME type/i;

export function isChunkLoadError(error) {
    return CHUNK_ERROR.test(String(error?.message || error || ''));
}

/**
 * يعيد التحميل مرة واحدة خلال نافذة زمنية قصيرة — فيجلب index.html طازجاً
 * بأسماء الحزم الصحيحة. الحراسة بـsessionStorage تمنع حلقة إعادة تحميل
 * لا نهائية إن كان العطب دائماً لا متقادماً.
 * @returns {boolean} true إن بوشرت الإعادة، false إن استُهلكت المحاولة سلفاً.
 */
export function reloadOnceForStaleChunk() {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
        if (Date.now() - last < RELOAD_GUARD_TTL_MS) return false;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
        // التصفح الخاص قد يمنع التخزين — بلا حارس لا نخاطر بحلقة إعادة تحميل
        return false;
    }
    window.location.reload();
    return true;
}
