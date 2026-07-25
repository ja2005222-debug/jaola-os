/**
 * 📧 المُرسل البريدي — عبر Resend HTTP API (بلا اعتماديات جديدة).
 *
 * التفعيل بمفتاح واحد: RESEND_API_KEY (+ MAIL_FROM اختياري للمرسل المخصص).
 * غير مُفعّل → ردّ صريح notConfigured، لا انهيار ولا صمت.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function mailReady(env = process.env) {
    return !!env.RESEND_API_KEY;
}

export function isEmail(v) {
    return EMAIL_RE.test(String(v || '').trim());
}

/** يرسل بريداً نصياً. يعيد {ok,id} أو {error, notConfigured?}. */
export async function sendMail({ to, subject, text, replyTo } = {}, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    if (!env.RESEND_API_KEY) {
        return { error: 'البريد غير مُفعّل — اضبط RESEND_API_KEY في بيئة الخادم.', notConfigured: true };
    }
    if (!isEmail(to)) return { error: 'عنوان بريد غير صالح.' };
    const payload = {
        from: env.MAIL_FROM || 'JAOLA <onboarding@resend.dev>',
        to: [String(to).trim()],
        subject: String(subject || '(بلا موضوع)').slice(0, 150),
        text: String(text || '').slice(0, 5000),
    };
    if (isEmail(replyTo)) payload.reply_to = String(replyTo).trim();
    try {
        const r = await fetchImpl(RESEND_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) return { error: `فشل الإرسال (${r.status}).` };
        const d = await r.json().catch(() => ({}));
        return { ok: true, id: d.id || null };
    } catch (e) {
        return { error: 'تعذّر الوصول لخدمة البريد: ' + e.message };
    }
}
