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

import { stripNegated } from './textNormalizer.js';

const BIG_TYPES = new Set(['saas', 'ecommerce', 'marketplace', 'dashboard', 'fintech', 'platform']);

/**
 * ⚛️ **إطارٌ يسمّيه صاحبُ المشروع بنفسِه** — لا تصنيفٌ يُشتقّ له.
 *
 * قِيس على سجلٍّ حيّ: طلبٌ يقول حرفيّاً «— واجهة **React** مع لوحة Kanban» و«منتج SaaS
 * **متكامل**»، وخرج البناءُ على مسار **Vanilla**. وتتبُّعُ السبب:
 *   • `detectProjectType(الطلب)` = `saas` ← و`saas` في `BIG_TYPES`، فالطلبُ **كان** يكفي.
 *   • لكنّ `resolveProjectType` تُعطي **فئةَ المخطّط الأولويّةَ المطلقة** على الطلب:
 *     `blueprint.category && !== 'other' && _source !== 'fallback' ? category : detect(goal)`.
 *     وحارسُها القائم يحمي من احتياطٍ يكتب `business`، **لا** من نموذجٍ يُصنّف SaaS بأنّه
 *     `business`. والسجلُّ نفسُه يشهد: «✅ تم تطبيق قالب **business**».
 *
 * فالكلمةُ التي كتبها صاحبُ المشروع بيده تخسر أمام تصنيفٍ خمّنه نموذج. وهي عائلةُ
 * PM/22–PM/25 نفسُها: مدخلٌ مغلقٌ يحلّ محلَّ كلماته.
 *
 * ⚖️ **ولمَ الذكرُ الصريح وحدَه، لا الكشفُ كلُّه؟** لأنّ التصنيفَ **تخمينٌ من الطرفَين**:
 *    قلبُ القرار بمجرّد أنّ الكشفَ قال «كبير» يجعل موقعَ مطعمٍ بسيطاً مشروعَ React —
 *    خسارةٌ حقيقيّة. أمّا «React» مكتوبةً فليست تخميناً: هي **مطلبٌ منصوص**، ولا يُنقض.
 *
 * 🚫 والنفيُ يُطوى أوّلاً (`stripNegated`): «بدون React» ليست طلباً لـReact — وهي علّةُ
 *    PM/23 نفسُها بمصدرها الواحد. قِيس ٨/٨ حالات: الطلبُ الحقيقيّ، وموقعُ مطعم، وذكرٌ
 *    صريح، وNext.js، ونفيٌ عربيّ، ونفيٌ إنجليزيّ، و«reaction» المركّبة، و«تفاعليّ».
 *
 * ⚠️ **حدٌّ مكتوب**: يقرأ **ذكرَ الإطار** فقط. لا يقرأ سَعةً ولا تعقيداً — تلك يقرؤها
 *    `projectType` و`scope` كما كانا، ولم يُمَسّا.
 * @returns {'react-next'|null}
 */
const EXPLICIT_REACT = /(?:^|[^\p{L}])(react|next\.?js|nextjs)(?=$|[^\p{L}])/iu;

export function explicitStackRequest(goalText) {
    return EXPLICIT_REACT.test(stripNegated(String(goalText || ''))) ? 'react-next' : null;
}

/**
 * يقرّر مسار البناء (المسار الهجين):
 *  - إطارٌ يسمّيه صاحبُ المشروع صراحةً → هو (لا يُنقَض بتصنيف)
 *  - نوع كبير أو نطاق "full" → react-next
 *  - غير ذلك → vanilla (سريع)
 */
export function resolveStack({ projectType, scope, goal } = {}) {
    const asked = explicitStackRequest(goal);
    if (asked) return asked;
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
