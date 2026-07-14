/**
 * 💳 Subscription Plans — JAOLA OS
 *
 * تعريف خطط الاشتراك وحدودها ومزاياها. مصدر واحد للحقيقة يستهلكه:
 * - subscriptionService (فرض الحدود + الاستهلاك)
 * - stripeService (إنشاء جلسة Checkout بالسعر الصحيح)
 * - مسارات /api/billing (عرض الخطط للواجهة)
 *
 * أسعار Stripe تُقرأ من متغيرات البيئة (لا تُكتب في الكود):
 *   STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE
 */

// حد لا نهائي يُمثَّل بـ Infinity — الواجهة تعرضه كـ "غير محدود"
export const UNLIMITED = Infinity;

export const PLANS = {
    free: {
        id: 'free',
        nameAr: 'مجانية',
        nameEn: 'Free',
        priceMonthly: 0,
        currency: 'usd',
        stripePriceId: null,               // مجانية — لا Checkout
        limits: {
            projects: 5,
            autoDeploy: false,
            prioritySupport: false,
            customAgents: false,
            privateHosting: false,
        },
        featuresAr: ['حتى 5 مشاريع', 'القوالب الأساسية', 'دعم عبر المجتمع'],
    },
    pro: {
        id: 'pro',
        nameAr: 'احترافية',
        nameEn: 'Pro',
        priceMonthly: 19,
        currency: 'usd',
        stripePriceEnv: 'STRIPE_PRICE_PRO',
        limits: {
            projects: UNLIMITED,
            autoDeploy: true,
            prioritySupport: true,
            customAgents: false,
            privateHosting: false,
        },
        featuresAr: ['مشاريع غير محدودة', 'نشر تلقائي', 'دعم أولوية', 'كل القوالب المتقدمة'],
    },
    enterprise: {
        id: 'enterprise',
        nameAr: 'المؤسسات',
        nameEn: 'Enterprise',
        priceMonthly: 99,
        currency: 'usd',
        stripePriceEnv: 'STRIPE_PRICE_ENTERPRISE',
        limits: {
            projects: UNLIMITED,
            autoDeploy: true,
            prioritySupport: true,
            customAgents: true,
            privateHosting: true,
        },
        featuresAr: ['كل مزايا Pro', 'وكلاء مخصّصون', 'استضافة خاصة', 'مدير حساب مخصص'],
    },
};

export const DEFAULT_PLAN = 'free';

/** خطة صالحة أو الافتراضية */
export function getPlan(planId) {
    return PLANS[planId] || PLANS[DEFAULT_PLAN];
}

/** معرّف سعر Stripe للخطة (من البيئة)، أو null */
export function getStripePriceId(planId) {
    const plan = PLANS[planId];
    if (!plan || !plan.stripePriceEnv) return null;
    return process.env[plan.stripePriceEnv] || null;
}

/** إيجاد الخطة من معرّف سعر Stripe (لاستهلاك الـ webhook) */
export function planFromStripePrice(priceId) {
    if (!priceId) return null;
    for (const plan of Object.values(PLANS)) {
        if (plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId) {
            return plan.id;
        }
    }
    return null;
}

/** قائمة عامة آمنة للعرض في الواجهة (تحوّل Infinity إلى null) */
export function publicPlans() {
    return Object.values(PLANS).map(p => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        priceMonthly: p.priceMonthly,
        currency: p.currency,
        featuresAr: p.featuresAr,
        limits: {
            ...p.limits,
            projects: p.limits.projects === UNLIMITED ? null : p.limits.projects,
        },
    }));
}
