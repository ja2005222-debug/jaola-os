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
            botAiMessages: 30,             // ذكاء البوت الحيّ: عيّنة تذوّق شهرية
            emails: 20,                    // ردود بريدية من الداشبورد شهرياً
            customAgentsMax: 1,            // وكيل واحد للتذوّق
            aiImages: 6,                   // صور AI حقيقية شهرياً
            socialPosts: 10,               // منشورات تُنشر مباشرة للقنوات شهرياً
            customDomainsMax: 0,           // النطاقات الخاصة ميزة مدفوعة
            cryptoWatchlistMax: 5,         // قائمة متابعة مستشار الكريبتو: عيّنة تذوّق
            stockWatchlistMax: 5,          // قائمة متابعة مستشار الأسهم/الفوركس: عيّنة تذوّق
            autoDeploy: false,
            prioritySupport: false,
            customAgents: false,
            privateHosting: false,
        },
        featuresAr: ['حتى 5 مشاريع', 'القوالب الأساسية', 'مساعد الموقع (قاعدة داخلية + 30 رسالة ذكاء/شهر)', 'دعم عبر المجتمع'],
        featuresEn: ['Up to 5 projects', 'Core templates', 'Site assistant (built-in KB + 30 AI msgs/mo)', 'Community support'],
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
            botAiMessages: 2000,           // ذكاء البوت الحيّ لكل مواقع المستخدم شهرياً
            emails: 500,
            customAgentsMax: 3,
            aiImages: 150,
            socialPosts: 300,
            customDomainsMax: 1,           // نطاق خاص واحد
            cryptoWatchlistMax: 20,        // قائمة متابعة كاملة
            stockWatchlistMax: 20,         // قائمة متابعة كاملة
            autoDeploy: true,
            prioritySupport: true,
            customAgents: false,
            privateHosting: false,
        },
        featuresAr: ['مشاريع غير محدودة', 'نطاقك الخاص', 'نشر تلقائي', 'مساعد الموقع بذكاء حيّ (2000 رسالة/شهر)', 'دعم أولوية', 'كل القوالب المتقدمة'],
        featuresEn: ['Unlimited projects', 'Custom domain', 'Auto deploy', 'AI site assistant (2000 msgs/mo)', 'Priority support', 'All advanced templates'],
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
            botAiMessages: UNLIMITED,
            emails: UNLIMITED,
            customAgentsMax: UNLIMITED,
            aiImages: UNLIMITED,
            socialPosts: UNLIMITED,
            customDomainsMax: UNLIMITED,
            cryptoWatchlistMax: 20,        // نفس السقف التقني لدفعة CoinGecko الواحدة (MAX_WATCHLIST) — لا فرق عن Pro هنا
            stockWatchlistMax: 20,         // نفس السقف التقني لدفعة نداء الأسهم/الفوركس الواحدة — لا فرق عن Pro هنا
            autoDeploy: true,
            prioritySupport: true,
            customAgents: true,
            privateHosting: true,
        },
        featuresAr: ['كل مزايا Pro', 'ذكاء البوت بلا حدود', 'وكلاء مخصّصون', 'استضافة خاصة', 'مدير حساب مخصص'],
        featuresEn: ['Everything in Pro', 'Unlimited bot AI', 'Custom agents', 'Private hosting', 'Dedicated account manager'],
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
        featuresEn: p.featuresEn || p.featuresAr,
        limits: {
            ...p.limits,
            projects: p.limits.projects === UNLIMITED ? null : p.limits.projects,
            botAiMessages: p.limits.botAiMessages === UNLIMITED ? null : p.limits.botAiMessages,
            emails: p.limits.emails === UNLIMITED ? null : p.limits.emails,
            socialPosts: p.limits.socialPosts === UNLIMITED ? null : p.limits.socialPosts,
            customAgentsMax: p.limits.customAgentsMax === UNLIMITED ? null : p.limits.customAgentsMax,
            aiImages: p.limits.aiImages === UNLIMITED ? null : p.limits.aiImages,
            customDomainsMax: p.limits.customDomainsMax === UNLIMITED ? null : p.limits.customDomainsMax,
        },
    }));
}
