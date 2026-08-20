/**
 * 🔗 shareLinks.js — رابط مشاركة مؤقّت للقسيمة، موقّع وبلا حالة.
 *
 * المشكلة: مشاركة الحجز كانت **نصّاً** يُنسخ ويُلصق. من أراد إرسال قسيمته
 * لمرافقه أو لمكتب التأشيرات أرسل لقطة شاشة — أو، وهو الأسوأ، بيانات
 * دخوله. فأردنا رابطاً يفتحه أي أحد بلا حساب، ويموت وحده.
 *
 * التصميم: التوكن **موقّع لا مُخزَّن** — الحمولة (معرّف الحجز + لحظة
 * الانتهاء) داخل التوكن نفسه، وتوقيعها HMAC-SHA256. لماذا بلا حالة؟
 * لأن المخزنين (ملفات/Postgres) يجب أن يتطابقا حرفياً، وكل حقلٍ جديد
 * يُكتب في الحجز هو فرصةٌ لتباعدهما — وقد كلّفنا ذلك عطباً صامتاً فعلاً
 * (transitionBooking كانت تُسقط الحقول غير المُدرَجة في Postgres). بلا
 * كتابة أصلاً لا يوجد ما يتباعد.
 *
 * ⚠️ الثمن المقبول والمُعلَن: **لا إلغاء مبكّر لرابطٍ صدر**. لا سجلّ
 * يُشطب منه. المهلة القصيرة هي الحماية — لذا الافتراضي ٢٤ ساعة والسقف
 * أسبوع، وتقول الواجهة ذلك صراحةً بدل أن توهم بزرّ إلغاء لا نملكه.
 *
 * 🔐 السرّ مشتقّ من JWT_SECRET بفصلٍ نطاقي (HMAC عليه بثابت هذا الملف)
 * لا مستعملٌ كما هو: فتوكن مشاركةٍ مسروق لا يصلح توكن دخول أبداً، ولا
 * يحتاج المشغّل ضبط متغيّر بيئة جديد.
 */
import crypto from 'node:crypto';

// الفصل النطاقي + رقم الإصدار: تغيير الصيغة لاحقاً يُبطل القديم حتماً
const DOMAIN = 'jaola-travel:share:v1';

export const SHARE_DEFAULT_HOURS = 24;
export const SHARE_MAX_HOURS = 168; // أسبوع

/** يشتقّ سرّ التوقيع من سرّ المنصّة — لا يُستعمل JWT_SECRET حرفياً. */
export function deriveShareSecret(jwtSecret) {
    const base = Array.isArray(jwtSecret) ? jwtSecret[0] : jwtSecret;
    if (!base) throw new Error('JWT_SECRET مطلوب لاشتقاق سرّ المشاركة.');
    return crypto.createHmac('sha256', String(base)).update(DOMAIN).digest();
}

const b64url = buf => Buffer.from(buf).toString('base64url');

/** يقصّ المهلة المطلوبة داخل [1، SHARE_MAX_HOURS] — الفارغ يأخذ الافتراضي. */
export function clampShareHours(hours) {
    const n = Number(hours);
    if (!Number.isFinite(n)) return SHARE_DEFAULT_HOURS;
    return Math.min(SHARE_MAX_HOURS, Math.max(1, Math.floor(n)));
}

/**
 * يوقّع توكن مشاركة. الصيغة: «حمولة.توقيع» بترميز base64url.
 * expiresAt بالمللي ثانية (Date.now)، ويُخزَّن بالثواني ليبقى التوكن قصيراً.
 */
export function signShareToken({ bookingId, expiresAt, secret }) {
    const id = String(bookingId || '').trim();
    if (!id) throw new Error('معرّف الحجز مطلوب.');
    const payload = b64url(JSON.stringify({ b: id, e: Math.floor(expiresAt / 1000) }));
    const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
    return `${payload}.${sig}`;
}

/** مقارنة ثابتة الزمن لا تتسرّب منها معلومة عن موضع أول اختلاف. */
function signatureMatches(expected, given) {
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    // timingSafeEqual يرمي على اختلاف الطول — الطول ليس سرّاً هنا
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * يتحقّق من توكن ويفكّه. يُرجع `{ bookingId, expiresAt }` أو `{ error }`
 * بأحد سببين متمايزين: `invalid` (توقيع/صيغة) و`expired` (انتهت المهلة) —
 * الواجهة تفرّق بينهما في الرسالة، فـ«انتهى الرابط» ليست «رابط خاطئ».
 */
export function verifyShareToken(token, { secret, now = Date.now() } = {}) {
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return { error: 'invalid' };
    const [payload, sig] = parts;

    const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
    if (!signatureMatches(expected, sig)) return { error: 'invalid' };

    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return { error: 'invalid' };
    }
    const bookingId = String(data?.b || '');
    const expSeconds = Number(data?.e);
    if (!bookingId || !Number.isFinite(expSeconds)) return { error: 'invalid' };

    const expiresAt = expSeconds * 1000;
    // ⚠️ الترتيب مقصود: التوقيع أولاً ثم الانتهاء. لو فُحص الانتهاء أولاً
    // لأخبر ردُّنا صاحبَ توكنٍ مزوَّر أن حمولته «قُرئت» — ولا نعطيه ذلك.
    if (expiresAt <= now) return { error: 'expired' };

    return { bookingId, expiresAt };
}
