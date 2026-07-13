/**
 * 🧰 Starter Registry — بذرة "JAOLA Marketplace" (المسار الهجين)
 *
 * سجلّ منسّق لعدد محدود من القوالب الموثوقة المرخّصة MIT — بدل بحث GitHub المفتوح
 * (الذي يجلب كوداً مكسوراً/غير آمن). لكل نوع مشروع قالب Vanilla بسيط + قالب React/Next
 * للمشاريع الكبيرة. الكلاسيفاير يختار المسار والقالب الأنسب ثم يخصّصه بالذكاء.
 *
 * هذه اللبنة = الأساس + طبقة القرار. توليد سكافولد React الفعلي خطوة تالية تُبنى فوقها.
 */

// stack: 'vanilla' (يولّده JAOLA حالياً) أو 'react-next' (مسار المشاريع الكبيرة)
// scale: 'mvp' (بسيط سريع) · 'full' (منصّة متكاملة) · 'any'
export const STARTERS = [
    // ── Vanilla (بسيط/سريع — المولّد الحالي) ──────────────────────────
    { id: 'vanilla-business', type: 'business', stack: 'vanilla', scale: 'mvp', name: 'Business (Vanilla)', license: 'internal', repo: null,
      sections: ['navbar', 'hero', 'services', 'about', 'contact', 'footer'], features: ['responsive', 'contact-form'], tags: ['شركة', 'خدمات', 'تعريفي'] },
    { id: 'vanilla-restaurant', type: 'restaurant', stack: 'vanilla', scale: 'mvp', name: 'Restaurant (Vanilla)', license: 'internal', repo: null,
      sections: ['navbar', 'hero', 'menu', 'gallery', 'reservation', 'footer'], features: ['menu', 'reservation-form'], tags: ['مطعم', 'قائمة طعام', 'حجز'] },
    { id: 'vanilla-portfolio', type: 'portfolio', stack: 'vanilla', scale: 'mvp', name: 'Portfolio (Vanilla)', license: 'internal', repo: null,
      sections: ['navbar', 'hero', 'works', 'about', 'contact'], features: ['gallery'], tags: ['أعمال', 'معرض', 'شخصي'] },

    // ── React / Next.js (مشاريع كبيرة — منسّقة، MIT) ──────────────────
    { id: 'next-saas', type: 'saas', stack: 'react-next', scale: 'full', name: 'Next.js SaaS + Stripe', license: 'MIT',
      repo: 'https://github.com/vercel/nextjs-subscription-payments',
      sections: ['landing', 'pricing', 'auth', 'dashboard', 'account'], features: ['subscriptions', 'auth', 'stripe', 'dashboard'], tags: ['saas', 'اشتراكات', 'لوحة تحكم'] },
    { id: 'next-commerce', type: 'ecommerce', stack: 'react-next', scale: 'full', name: 'Next.js Commerce', license: 'MIT',
      repo: 'https://github.com/vercel/commerce',
      sections: ['storefront', 'product', 'cart', 'checkout', 'search'], features: ['cart', 'checkout', 'search', 'catalog'], tags: ['متجر', 'تجارة', 'سلة'] },
    { id: 'next-dashboard', type: 'dashboard', stack: 'react-next', scale: 'full', name: 'shadcn/ui Dashboard', license: 'MIT',
      repo: 'https://github.com/shadcn-ui/ui',
      sections: ['sidebar', 'overview', 'analytics', 'tables', 'settings'], features: ['charts', 'tables', 'auth-ui', 'dark-mode'], tags: ['لوحة تحكم', 'تحليلات', 'أدمن'] },
    { id: 'next-starter', type: 'business', stack: 'react-next', scale: 'full', name: 'Precedent (Next.js Starter)', license: 'MIT',
      repo: 'https://github.com/steven-tey/precedent',
      sections: ['landing', 'auth', 'dashboard'], features: ['auth', 'components', 'seo'], tags: ['starter', 'next', 'قاعدة'] },
    { id: 'next-boilerplate', type: 'app', stack: 'react-next', scale: 'full', name: 'Next.js Boilerplate', license: 'MIT',
      repo: 'https://github.com/ixartz/Next-js-Boilerplate',
      sections: ['app', 'auth', 'i18n'], features: ['ts', 'tailwind', 'testing', 'i18n'], tags: ['قاعدة', 'tailwind', 'typescript'] },
];

const BIG_TYPES = new Set(['saas', 'ecommerce', 'marketplace', 'dashboard', 'fintech', 'platform']);

/**
 * يقرّر مسار البناء (المسار الهجين):
 *  - نوع كبير أو نطاق "full" → react-next
 *  - غير ذلك → vanilla (سريع)
 */
export function resolveStack({ projectType, scope } = {}) {
    const t = (projectType || '').toLowerCase();
    const wantsFull = /full|كامل|متكامل|كبير|large/i.test(scope || '');
    if (BIG_TYPES.has(t) || wantsFull) return 'react-next';
    return 'vanilla';
}

/**
 * يختار أفضل قالب لنوع المشروع ومساره.
 * يفضّل مطابقة (type + stack)، ثم مطابقة النوع، ثم أي قالب بنفس المسار.
 * يُرجع null إذا لا قالب مناسب (فيبني JAOLA من الصفر كالمعتاد).
 */
export function selectStarter({ projectType, scope } = {}) {
    const t = (projectType || '').toLowerCase();
    const stack = resolveStack({ projectType, scope });
    const byType = STARTERS.filter(s => s.type === t);
    return (
        byType.find(s => s.stack === stack) ||
        byType[0] ||
        STARTERS.find(s => s.stack === stack && (s.type === 'business' || s.type === 'app')) ||
        null
    );
}

/** كل القوالب (للعرض في لوحة الأدمِن / الـ Marketplace) */
export function listStarters() {
    return STARTERS.map(s => ({ ...s }));
}
