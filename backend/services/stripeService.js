/**
 * 💳 Stripe Service — JAOLA OS
 *
 * غلاف رقيق حول Stripe. مصمّم ليكون آمناً عند غياب المفاتيح: كل دالة
 * ترمي خطأً واضحاً (لا crash) إن لم تُضبط STRIPE_SECRET_KEY، فيبقى الخادم
 * يعمل والواجهة تعرض رسالة مفهومة بدل انهيار.
 *
 * متغيرات البيئة:
 *   STRIPE_SECRET_KEY        — مفتاح Stripe السري
 *   STRIPE_WEBHOOK_SECRET    — سر توقيع الـ webhook
 *   STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE — معرّفات الأسعار
 *   BILLING_SUCCESS_URL / BILLING_CANCEL_URL — روابط العودة بعد الدفع
 */

import { getStripePriceId, planFromStripePrice } from '../config/plans.js';

let _stripe = null;
let _loaded = false;

/** هل Stripe مُهيّأ (المفتاح موجود)؟ */
export function isStripeConfigured() {
    return !!process.env.STRIPE_SECRET_KEY;
}

// تحميل كسول لعميل Stripe — لا نستورد الحزمة إلا عند الحاجة الفعلية
async function getStripe() {
    if (!isStripeConfigured()) {
        throw new Error('نظام الدفع غير مُفعّل (STRIPE_SECRET_KEY غير مضبوط).');
    }
    if (!_loaded) {
        _loaded = true;
        try {
            const mod = await import('stripe');
            const Stripe = mod.default || mod;
            _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        } catch (e) {
            throw new Error('تعذّر تحميل مكتبة Stripe — تأكد من تثبيت الحزمة: ' + e.message);
        }
    }
    return _stripe;
}

/**
 * ينشئ جلسة Checkout للاشتراك في خطة.
 * @returns {Promise<{ url, id }>}
 */
export async function createCheckoutSession({ planId, username, email, customerId }) {
    const priceId = getStripePriceId(planId);
    if (!priceId) {
        throw new Error(`لا يوجد سعر Stripe مضبوط للخطة "${planId}" (اضبط متغير البيئة المناسب).`);
    }
    const stripe = await getStripe();

    const successUrl = process.env.BILLING_SUCCESS_URL || 'http://localhost:5173/settings?billing=success';
    const cancelUrl = process.env.BILLING_CANCEL_URL || 'http://localhost:5173/settings?billing=cancel';

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: username,
        ...(customerId ? { customer: customerId } : (email ? { customer_email: email } : {})),
        metadata: { username, planId },
        subscription_data: { metadata: { username, planId } },
    });

    return { url: session.url, id: session.id };
}

/** جلسة بوابة إدارة الاشتراك (تحديث/إلغاء) للعميل */
export async function createPortalSession({ customerId }) {
    if (!customerId) throw new Error('لا يوجد حساب Stripe لهذا المستخدم بعد — اشترك أولاً.');
    const stripe = await getStripe();
    const returnUrl = process.env.BILLING_PORTAL_RETURN_URL || process.env.BILLING_SUCCESS_URL || 'http://localhost:5173/settings';
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return { url: session.url };
}

/**
 * يتحقق من توقيع الـ webhook ويُرجع الحدث. يرمي إن كان التوقيع غير صالح.
 * @param {Buffer} rawBody جسم الطلب الخام (Buffer — ليس JSON مُحلَّلاً)
 * @param {string} signature ترويسة stripe-signature
 */
export async function constructWebhookEvent(rawBody, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET غير مضبوط.');
    const stripe = await getStripe();
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * يحوّل حدث Stripe إلى تحديث اشتراك مبسّط يفهمه نظامنا، أو null إن كان
 * الحدث غير ذي صلة. لا يلمس قاعدة البيانات — الاستدعاء الأعلى يطبّق التحديث.
 * @returns {{ username, customerId, subscriptionId, plan, status, currentPeriodEnd, cancelAtPeriodEnd } | null}
 */
export function interpretWebhookEvent(event) {
    if (!event?.type) return null;
    const obj = event.data?.object || {};

    switch (event.type) {
        case 'checkout.session.completed': {
            return {
                username: obj.client_reference_id || obj.metadata?.username || null,
                customerId: obj.customer || null,
                subscriptionId: obj.subscription || null,
                plan: obj.metadata?.planId || null,
                status: 'active',
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
            };
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const priceId = obj.items?.data?.[0]?.price?.id || null;
            return {
                username: obj.metadata?.username || null,
                customerId: obj.customer || null,
                subscriptionId: obj.id || null,
                plan: planFromStripePrice(priceId) || obj.metadata?.planId || null,
                status: obj.status || 'active',
                currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000) : null,
                cancelAtPeriodEnd: !!obj.cancel_at_period_end,
            };
        }
        case 'customer.subscription.deleted': {
            return {
                username: obj.metadata?.username || null,
                customerId: obj.customer || null,
                subscriptionId: obj.id || null,
                plan: 'free',
                status: 'canceled',
                currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000) : null,
                cancelAtPeriodEnd: false,
            };
        }
        default:
            return null;
    }
}
