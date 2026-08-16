/**
 * 💳 stripeClient.js — عميل Stripe يدوي (بلا SDK — نفس نمط عملاء Duffel/LiteAPI)
 *
 * النطاق عمداً ضيّق: Stripe Checkout (الصفحة المستضافة) فقط — لا عناصر
 * بطاقة مضمّنة ولا PCI على خادمنا: ننشئ جلسة، نحوّل المسافر لصفحة Stripe،
 * وwebhook موقَّع يبلغنا بالنتيجة. أربعة نداءات REST تكفي، وSDK كامل
 * (~مئات الملفات) ثمن غير متناسب — نفس القرار المتخذ مع Duffel وLiteAPI.
 *
 * ✅ تحقق توقيع الـwebhook: الخوارزمية مؤكَّدة من توثيق Stripe الرسمي
 * المنشور (Webhook signatures): هيدر `Stripe-Signature` بصيغة
 * `t=<timestamp>,v1=<hex>[,v1=...]`، والتوقيع =
 * HMAC-SHA256(secret, `${t}.${rawBody}`) بترميز hex — **نفس بنية توقيع
 * Duffel المطبَّقة والمجرَّبة في server.js حرفياً**، مع فارقين: قد تصل
 * عدة v1 أثناء تدوير الأسرار (يكفي تطابق واحدة)، ونافذة زمنية تُرفض
 * خارجها الأحداث القديمة (إعادة تشغيل رسائل مسجَّلة).
 *
 * كل النداءات form-encoded (متطلب Stripe) عبر fetchImpl قابل للحقن —
 * الاختبارات تمرر بديلاً مسجَّلاً ولا تلمس الشبكة أبداً.
 */
import crypto from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SEC = 5 * 60; // نافذة Stripe الموصى بها

/** يفكّ هيدر Stripe-Signature — null لهيدر مشوَّه. */
export function parseStripeSignature(header) {
    const parts = String(header || '').split(',').map(s => s.trim());
    const out = { t: null, v1: [] };
    for (const p of parts) {
        const [k, v] = p.split('=', 2);
        if (k === 't' && /^\d+$/.test(v || '')) out.t = Number(v);
        if (k === 'v1' && /^[0-9a-f]{64}$/i.test(v || '')) out.v1.push(v.toLowerCase());
    }
    return out.t && out.v1.length ? out : null;
}

/**
 * يتحقق من توقيع webhook على الجسم الخام بالضبط كما وصل.
 * مقارنة بزمن ثابت، ورفض الأحداث الأقدم من النافذة (إعادة تشغيل).
 */
export function verifyStripeWebhookSignature({ rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000) }) {
    if (!secret || !rawBody) return false;
    const sig = parseStripeSignature(header);
    if (!sig) return false;
    if (Math.abs(nowSec - sig.t) > SIGNATURE_TOLERANCE_SEC) return false;
    const expected = crypto.createHmac('sha256', secret)
        .update(`${sig.t}.${rawBody}`)
        .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    return sig.v1.some(v => {
        const got = Buffer.from(v, 'hex');
        return got.length === expectedBuf.length && crypto.timingSafeEqual(got, expectedBuf);
    });
}

/** يحوّل كائناً متداخلاً إلى form-encoding بأسلوب Stripe (أقواس للتداخل). */
export function toStripeForm(obj, prefix = '', out = new URLSearchParams()) {
    for (const [key, val] of Object.entries(obj)) {
        if (val === undefined || val === null) continue;
        const name = prefix ? `${prefix}[${key}]` : key;
        if (Array.isArray(val)) {
            val.forEach((item, i) => {
                if (typeof item === 'object') toStripeForm(item, `${name}[${i}]`, out);
                else out.append(`${name}[${i}]`, String(item));
            });
        } else if (typeof val === 'object') {
            toStripeForm(val, name, out);
        } else {
            out.append(name, String(val));
        }
    }
    return out;
}

export function createStripeClient({ secretKey, fetchImpl = fetch }) {
    if (!secretKey) return null;

    async function stripeRequest(method, path, body = null) {
        const res = await fetchImpl(`${STRIPE_API}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${secretKey}`,
                ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
            },
            body: body ? toStripeForm(body).toString() : undefined,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = payload?.error?.message || `HTTP ${res.status}`;
            throw new Error(`Stripe: ${msg}`);
        }
        return payload;
    }

    return {
        name: 'stripe',

        /**
         * جلسة Checkout لمبلغ محدد — Stripe يريد وحدات صغرى (سنتات) عدداً
         * صحيحاً. تنتهي بعد 30 دقيقة (الحد الأدنى لدى Stripe) حتى لا تُحبس
         * مقاعد باقةٍ خلف جلسة مهجورة طويلاً.
         */
        async createCheckoutSession({ amount, currency, title, bookingId, purpose, customerEmail, successUrl, cancelUrl }) {
            const session = await stripeRequest('POST', '/checkout/sessions', {
                mode: 'payment',
                'line_items[0]': {
                    quantity: 1,
                    price_data: {
                        currency: String(currency).toLowerCase(),
                        unit_amount: Math.round(amount * 100),
                        product_data: { name: title },
                    },
                },
                metadata: { bookingId, purpose },
                payment_intent_data: { metadata: { bookingId, purpose } },
                customer_email: customerEmail || undefined,
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
                success_url: successUrl,
                cancel_url: cancelUrl,
            });
            return { id: session.id, url: session.url, expiresAt: session.expires_at || null };
        },

        /** حالة جلسة — للمصالحة الدورية حين يضيع webhook. */
        async getCheckoutSession(sessionId) {
            const s = await stripeRequest('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
            return {
                id: s.id, status: s.status, paymentStatus: s.payment_status,
                paymentIntent: s.payment_intent || null, metadata: s.metadata || {},
            };
        },

        /**
         * استرداد دفعة — كامل بلا `amount`، وجزئي به (وحدات كبرى تُحوَّل
         * لصغرى). الجزئي ضرورة لا ترف: إلغاء رحلةٍ يردّ فيها المزوّد جزءاً
         * فقط يجب أن يردّ للمسافر بنفس النسبة لا أكثر ولا أقل.
         */
        async createRefund({ paymentIntentId, amount = null }) {
            const r = await stripeRequest('POST', '/refunds', {
                payment_intent: paymentIntentId,
                ...(Number.isFinite(amount) ? { amount: Math.round(amount * 100) } : {}),
            });
            return {
                id: r.id, status: r.status,
                amount: Number.isFinite(r.amount) ? r.amount / 100 : null,
                currency: r.currency ? String(r.currency).toUpperCase() : null,
            };
        },
    };
}
