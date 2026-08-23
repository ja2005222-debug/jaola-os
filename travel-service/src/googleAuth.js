/**
 * 🔵 googleAuth.js — التحقق اليدوي من Google ID Token (بلا SDK — نفس نمط
 * عملاء Duffel/LiteAPI/Stripe: نداءات REST قليلة بدل اعتمادية كاملة).
 *
 * تدفّق الدخول: زر «Sign in with Google» في المتصفح (مكتبة جوجل الرسمية
 * gsi/client) يُرجع JWT موقّعاً بمفتاح جوجل الخاص — لا يحتاج خادمنا سرّاً
 * ولا تبادل كود (implicit ID-token flow)، فيكفي التحقق من التوقيع
 * والمُصدِر والجمهور. الخوارزمية موثَّقة رسمياً في توثيق Google Identity
 * Services (OpenID Connect discovery + JWKS منشورة على الرابط أدناه).
 *
 * ⚠️ **RS256 حصراً — لا نقرأ الخوارزمية من التوكن نفسه**: قبول ما يُعلنه
 * التوكن (`alg` في الترويسة) يفتح هجوم تبديل الخوارزمية المعروف (`none`،
 * أو HMAC بمفتاحٍ عام كسرّ) — هنا `algorithms: ['RS256']` صريحة في
 * jwt.verify فلا تُقبل غيرها مهما ادّعى التوكن.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const JWKS_TTL_MS = 60 * 60 * 1000; // ساعة — جوجل يدوّر المفاتيح ببطء شديد

/**
 * ينشئ عميل تحقق مربوطاً بمعرّف عميل (Client ID) واحد. بلا معرّف: null —
 * فلا مسار `/auth/google` يعمل ولا زر يظهر في الواجهة (بناء server.js).
 */
export function createGoogleAuthClient({ clientId, fetchImpl = fetch }) {
    if (!clientId) return null;

    let jwksCache = null; // { keys: Map<kid, KeyObject>, at: number }

    async function loadKeys({ forceRefresh = false } = {}) {
        if (!forceRefresh && jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
        const res = await fetchImpl(GOOGLE_JWKS_URL);
        if (!res.ok) throw new Error(`تعذّر جلب مفاتيح جوجل العامة (${res.status}).`);
        const body = await res.json();
        const keys = new Map();
        for (const jwk of body.keys || []) {
            if (jwk.kid) keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
        }
        jwksCache = { keys, at: Date.now() };
        return keys;
    }

    /**
     * يتحقق من رمز جوجل ويُرجع الهوية المستخرجة، أو يرمي خطأً بنصٍّ يصلح
     * للعرض مباشرةً (server.js يردّه 401 حرفياً).
     */
    async function verifyIdToken(idToken) {
        const decoded = jwt.decode(String(idToken || ''), { complete: true });
        const kid = decoded?.header?.kid;
        if (!kid) throw new Error('رمز جوجل غير صالح.');

        let keys = await loadKeys();
        let key = keys.get(kid);
        // مفتاحٌ جديد دوّرته جوجل منذ آخر كاش — نعيد الجلب مرةً واحدة قبل الرفض
        if (!key) key = (await loadKeys({ forceRefresh: true })).get(kid);
        if (!key) throw new Error('رمز جوجل غير صالح.');

        let payload;
        try {
            payload = jwt.verify(idToken, key, { algorithms: ['RS256'], audience: clientId, issuer: GOOGLE_ISSUERS });
        } catch {
            throw new Error('تعذّر التحقق من حساب جوجل — حاول مجدداً.');
        }
        if (!payload.email) throw new Error('حساب جوجل بلا بريد إلكتروني — تعذّر إتمام الدخول.');
        return {
            email: payload.email,
            emailVerified: !!payload.email_verified,
            name: String(payload.name || payload.given_name || '').trim(),
        };
    }

    return { clientId, verifyIdToken };
}
