/**
 * 🔑 Lightweight OAuth — JAOLA OS
 *
 * تدفّق authorization-code لـ GitHub و Google بلا passport —
 * fetch مباشر + JWT، متوافق مع نمط المصادقة الحالي (DB abstraction + offline).
 *
 * يتحلّل بلطف: إن لم تُضبط مفاتيح مزوّد، لا ينهار — يُخفى زره في الواجهة.
 * scope الـ github يشمل repo لتمكين قراءة/تعديل/رفع الملفات من لوحة الأدمِن.
 */

import { fetchWithTimeout, TIMEOUTS } from './httpRetry.js';

const PROVIDERS = {
    github: {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'read:user user:email repo',
        clientId: () => process.env.GITHUB_CLIENT_ID,
        clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    },
    google: {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        clientId: () => process.env.GOOGLE_CLIENT_ID,
        clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    },
};

export function isProvider(provider) {
    return Object.prototype.hasOwnProperty.call(PROVIDERS, provider);
}

export function providerConfigured(provider) {
    const p = PROVIDERS[provider];
    return !!(p && p.clientId() && p.clientSecret());
}

/** قائمة المزوّدين المُهيّئين فعلاً (لتُظهر الواجهة أزرارهم فقط) */
export function configuredProviders() {
    return Object.keys(PROVIDERS).filter(providerConfigured);
}

/** رابط صفحة موافقة المزوّد */
export function getAuthUrl(provider, { state, redirectUri }) {
    const p = PROVIDERS[provider];
    const params = new URLSearchParams({
        client_id: p.clientId(),
        redirect_uri: redirectUri,
        scope: p.scope,
        state,
        response_type: 'code',
    });
    if (provider === 'google') {
        params.set('access_type', 'online');
        params.set('prompt', 'select_account');
    }
    return `${p.authUrl}?${params.toString()}`;
}

/** تبديل الكود بـ access token */
export async function exchangeCode(provider, { code, redirectUri }) {
    const p = PROVIDERS[provider];
    const body = {
        client_id: p.clientId(),
        client_secret: p.clientSecret(),
        code,
        redirect_uri: redirectUri,
    };
    if (provider === 'google') body.grant_type = 'authorization_code';

    // 🔴 بلا مهلة: مزوّدٌ معلَّقٌ يُعلّق تسجيلَ الدخول إلى الأبد.
    //    ولا إعادةَ محاولةٍ هنا: رمزُ التفويض يُستهلك مرّةً واحدة.
    const res = await fetchWithTimeout(p.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
    }, TIMEOUTS.oauth);
    const data = await res.json().catch(() => ({}));
    if (!data.access_token) {
        throw new Error(data.error_description || data.error || 'فشل تبادل التوكن مع المزوّد');
    }
    return data.access_token;
}

/** جلب ملف المستخدم من المزوّد → صيغة موحّدة */
export async function fetchProfile(provider, accessToken) {
    if (provider === 'github') {
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'jaola-os',
        };
        const uRes = await fetchWithTimeout('https://api.github.com/user', { headers }, TIMEOUTS.oauth);
        const u = await uRes.json();
        if (!u || !u.id) throw new Error('تعذّر جلب ملف GitHub');

        // 🔴 البريد هنا ليس حقلاً تجميلياً: `DB.upsertOAuthUser` **يربط
        // الحسابات به** — يجد المستخدم القائم بالبريد ثم يعيد كتابة
        // provider/providerId إليه ويسلّمه. فبريدٌ غير مؤكَّد = حسابُ غيرك.
        // (بريد `/user` العلني آمن: GitHub لا يقبل جعل بريدٍ غير مؤكَّد علنياً.)
        let email = u.email || null;
        if (!email) {
            try {
                const eRes = await fetchWithTimeout('https://api.github.com/user/emails', { headers }, TIMEOUTS.oauth);
                const emails = await eRes.json();
                if (Array.isArray(emails)) {
                    // كان السقوط على `emails[0]` **مهما كان** — أي على غير المؤكَّد.
                    const verified = emails.filter((e) => e && e.verified);
                    email = (verified.find((e) => e.primary) || verified[0])?.email || null;
                }
            } catch { /* اختياري */ }
        }
        return { providerId: String(u.id), username: u.login, email, avatar: u.avatar_url, name: u.name };
    }

    // google
    const res = await fetchWithTimeout('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    }, TIMEOUTS.oauth);
    const u = await res.json();
    if (!u || !u.sub) throw new Error('تعذّر جلب ملف Google');
    // 🔴 جوجل توثّق صراحةً أن `email` بلا `email_verified` لا يُوثق به،
    // وخدمة السفر في هذا المستودع ترفضه لهذا السبب بعينه
    // (`travel-service/src/googleAuth.js`). وهنا لم يكن يُفحَص إطلاقاً.
    // 📌 ولا نرفض الدخول كما تفعل هي — لاختلاف المقدّمة: هناك **البريد هو
    // الهوية**، وهنا الهوية معرّفُ المزوّد والبريدُ مفتاحُ ربطٍ فقط. فإسقاطه
    // يغلق الانتحال بلا أن يحجب صاحب حسابٍ مؤسّسيّ لم يُثبَت بريده.
    const email = u.email_verified === true ? (u.email || null) : null;
    return {
        providerId: u.sub,
        username: (email || `google_${u.sub}`).split('@')[0],
        email,
        avatar: u.picture || null,
        name: u.name || null,
    };
}
