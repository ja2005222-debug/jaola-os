/**
 * 🚫 contentFilter.js — خط الدفاع الأول على المحتوى المُدخل
 *
 * ⚠️ صدقٌ ضروري: هذا **ليس** إشرافاً كاملاً على المحتوى. لا وجود لقائمة
 * كلمات تكفي لذلك، ولن أدّعي غير هذا. الغرض هنا محدد وواقعي:
 *  (أ) إشارات إساءة **بنيوية** موضوعية لا تحتاج حكماً لغوياً
 *      (روابط مدسوسة، حقن، تكرار مفتعل، محارف تحكم/اتجاه خفية).
 *  (ب) قائمة حجب **قابلة للضبط** من البيئة تملؤها أنت حسب سياستك وسوقك.
 * الإشراف الدلالي الحقيقي يحتاج واجهة moderation مخصصة — تُضاف كطبقة
 * إضافية لاحقاً بلا تغيير هذا العقد.
 *
 * القيمة العملية الفورية: يمنع استغلال حقول النص كقناة سبام (روابط)،
 * ويحمي حسابك لدى المزوّد من محتوى يُسبب حظره.
 */

/**
 * محارف تحكم/اتجاه خفية: تُستخدم لإخفاء نص أو قلب اتجاهه بصرياً.
 * نفحصها بالنقاط البرمجية صراحةً بدل حشوها في تعبير نمطي — أوضح قراءةً،
 * ويتجنب تعبيراً نمطياً يحوي محارف تحكم حرفية (نمط هشّ ومحذَّر منه).
 * (التبويب/السطر الجديد مقبولان — التحقق النمطي يقصّهما أصلاً.)
 */
function hasHiddenChars(text) {
    for (const ch of text) {
        const c = ch.codePointAt(0);
        if (c === 0x09 || c === 0x0a || c === 0x0d) continue; // tab/LF/CR مقبولة
        if (c <= 0x1f || c === 0x7f) return true;             // محارف تحكم
        if (c >= 0x200b && c <= 0x200f) return true;          // فراغات صفرية وعلامات اتجاه
        if (c >= 0x202a && c <= 0x202e) return true;          // تضمين/قلب الاتجاه
        if (c >= 0x2066 && c <= 0x2069) return true;          // عزل الاتجاه
        if (c === 0xfeff) return true;                        // مسافة صفرية غير فاصلة
    }
    return false;
}
// أي رابط داخل حقل نصي — حقول النصوص للعرض لا للترويج
const URL_IN_TEXT = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|top|link)\b)/i;
// تكرار مفتعل لمحرف واحد (إغراق بصري)
const CHAR_FLOOD = /(.)\1{9,}/;

function normalize(text) {
    return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** قائمة الحجب من البيئة: كلمات/عبارات مفصولة بفواصل (فارغة افتراضياً). */
export function readBlocklist(env = process.env) {
    return String(env.CONTENT_BLOCKLIST || '')
        .split(',')
        .map(w => normalize(w))
        .filter(Boolean);
}

/**
 * يفحص نصاً واحداً. يُرجع null إن كان سليماً، أو {code, error} عربية.
 */
export function inspectText(raw, { blocklist = [] } = {}) {
    const text = String(raw ?? '');
    if (!text) return null;

    if (hasHiddenChars(text)) {
        return { code: 'hidden_chars', error: 'النص يحتوي محارف مخفية غير مسموحة.' };
    }
    if (URL_IN_TEXT.test(text)) {
        return { code: 'url_in_text', error: 'لا يُسمح بالروابط داخل نصوص الفيديو.' };
    }
    if (CHAR_FLOOD.test(text)) {
        return { code: 'char_flood', error: 'النص يحتوي تكراراً مفرطاً لحرف واحد.' };
    }

    const normalized = normalize(text);
    for (const word of blocklist) {
        if (normalized.includes(word)) {
            return { code: 'blocked_term', error: 'النص يحتوي مصطلحاً محظوراً بحسب سياسة الاستخدام.' };
        }
    }
    return null;
}

/**
 * يفحص رابط صورة. يمنع الأهداف الداخلية/المحلية — الرابط يُمرَّر لمزوّد
 * خارجي يجلبه بنفسه، فلا معنى لعنوان خاص إلا محاولة استكشاف شبكة.
 */
export function inspectImageUrl(raw) {
    // توكن صورة مرفوعة (upload:uploads/...) لا رابطاً يجلبه مزوّد خارجي —
    // لا سطح SSRF هنا؛ الملكية تُفحص في server.js قبل توقيع أي رابط فعلي.
    if (/^upload:uploads\/[a-z0-9_-]+\/[a-z0-9_-]+\.(png|jpg|webp)$/i.test(String(raw))) return null;
    let url;
    try { url = new URL(String(raw)); } catch { return { code: 'bad_url', error: 'رابط الصورة غير صالح.' }; }
    if (!['http:', 'https:'].includes(url.protocol)) {
        return { code: 'bad_scheme', error: 'رابط الصورة يجب أن يبدأ بـ http أو https.' };
    }
    const host = url.hostname.toLowerCase();
    const isPrivate =
        host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') ||
        /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        /^169\.254\./.test(host) || host === '0.0.0.0' || host === '::1' || host === '[::1]';
    if (isPrivate) {
        return { code: 'private_host', error: 'رابط الصورة يشير إلى عنوان داخلي غير مسموح.' };
    }
    return null;
}

/**
 * يفحص كل قيم القالب بعد التحقق النمطي. النصوص عبر inspectText وروابط
 * الصور عبر inspectImageUrl — حسب نوع الحقل المعرَّف في القالب نفسه.
 */
export function inspectValues(template, values, { blocklist = [] } = {}) {
    for (const field of template.fields) {
        const value = values[field.key];
        if (value == null || value === '') continue;
        const issue = field.type === 'imageUrl'
            ? inspectImageUrl(value)
            : field.type === 'text' ? inspectText(value, { blocklist }) : null;
        if (issue) return { ...issue, field: field.key };
    }
    return null;
}
