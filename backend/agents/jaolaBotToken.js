import crypto from 'crypto';

/**
 * 🔐 توكن موقّع (HMAC) لجولا بوت — يُضمَّن في الودجت على موقع الزائر، فيُرسله
 * مع كل رسالة إلى نقطة الدردشة العامّة. يحمل هوية المشروع (المالك/الاسم) موقّعةً
 * فلا يمكن تزويره أو تعديله، ودون تسريب أي مفتاح سرّي في كود الواجهة.
 *
 * ملاحظة: التوكن ليس سرّاً (يظهر في مصدر الصفحة) — دوره منع *انتحال* مشروع آخر
 * أو تفخيخ الحمولة، لا إخفاءها. حماية إساءة الاستخدام تكمّلها محدّدات المعدّل.
 */

function b64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}
function secret() {
    // نفس سرّ JWT (الخادم يرفض التشغيل بدونه)؛ fallback للتطوير/الاختبار فقط.
    return process.env.JWT_SECRET || 'jaola-bot-dev-secret';
}

/** يوقّع حمولة {u, p, b?} ويعيد توكناً نصّياً "body.sig". */
export function signBotToken(payload = {}) {
    const body = b64url(JSON.stringify(payload));
    const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
    return body + '.' + sig;
}

/** يتحقّق من التوكن ويعيد الحمولة، أو null إن كان غير صالح/مزوّراً. */
export function verifyBotToken(token) {
    if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
    const idx = token.indexOf('.');
    const body = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    if (!body || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
    let a, b;
    try { a = Buffer.from(sig); b = Buffer.from(expected); } catch { return null; }
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const obj = JSON.parse(fromB64url(body));
        return obj && typeof obj === 'object' ? obj : null;
    } catch { return null; }
}
