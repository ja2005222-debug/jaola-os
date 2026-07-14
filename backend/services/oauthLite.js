/**
 * 🔑 Lightweight OAuth — JAOLA OS
 *
 * تدفّق authorization-code لـ GitHub و Google بلا passport —
 * fetch مباشر + JWT، متوافق مع نمط المصادقة الحالي (DB abstraction + offline).
 *
 * يتحلّل بلطف: إن لم تُضبط مفاتيح مزوّد، لا ينهار — يُخفى زره في الواجهة.
 * scope الـ github يشمل repo لتمكين قراءة/تعديل/رفع الملفات من لوحة الأدمِن.
 */

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

    const res = await fetch(p.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
    });
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
        const uRes = await fetch('https://api.github.com/user', { headers });
        const u = await uRes.json();
        if (!u || !u.id) throw new Error('تعذّر جلب ملف GitHub');

        let email = u.email;
        if (!email) {
            try {
                const eRes = await fetch('https://api.github.com/user/emails', { headers });
                const emails = await eRes.json();
                if (Array.isArray(emails)) {
                    email = (emails.find((e) => e.primary && e.verified) || emails[0])?.email || null;
                }
            } catch { /* اختياري */ }
        }
        return { providerId: String(u.id), username: u.login, email, avatar: u.avatar_url, name: u.name };
    }

    // google
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = await res.json();
    if (!u || !u.sub) throw new Error('تعذّر جلب ملف Google');
    return {
        providerId: u.sub,
        username: (u.email || `google_${u.sub}`).split('@')[0],
        email: u.email || null,
        avatar: u.picture || null,
        name: u.name || null,
    };
}
