/**
 * 🧱 JAOLA Registry — طبقة Blocks/Sections (نواة «إعادة التركيب لا التوليد»).
 *
 * أقسام احترافية *مكتفية ذاتياً* (HTML/CSS، بلا build ولا JS ضروريّ) مصنّفة
 * ومختبَرة، يعيد الذكاء تركيبها في صفحة كاملة ثم يخصّصها. مملوكة محلّياً — لا
 * اعتماد خارجيّ في كل بناء. تجتاز التحقّق البنيوي وتُلمَّع لاحقاً.
 *
 * الرمز {{BRAND}} يُستبدل باسم العلامة، ومتغيّر CSS --jb بلون العلامة.
 */

// كل قسم: { id, category, name, html, css }. HTML قسم واحد؛ CSS بأصناف jb- مبدوءة.
const BLOCKS = [
    {
        id: 'nav', category: 'navigation', name: 'شريط علوي',
        html: `<header class="jb-nav"><div class="jb-wrap jb-nav-in">
    <a class="jb-brand" href="#">{{BRAND}}</a>
    <nav class="jb-links"><a href="#features">المميزات</a><a href="#pricing">الأسعار</a><a href="#faq">الأسئلة</a></nav>
    <a class="jb-btn" href="#cta">ابدأ الآن</a>
  </div></header>`,
        css: `.jb-nav{position:sticky;top:0;z-index:20;background:rgba(15,18,26,.85);backdrop-filter:blur(8px);border-bottom:1px solid var(--jb-border)}
.jb-nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0}
.jb-brand{font-weight:800;font-size:20px;color:var(--jb-text);text-decoration:none}
.jb-links{display:flex;gap:20px}.jb-links a{color:var(--jb-muted);text-decoration:none;font-size:14px}
.jb-links a:hover{color:var(--jb-text)}
@media(max-width:640px){.jb-links{display:none}}`,
    },
    {
        id: 'hero', category: 'hero', name: 'واجهة رئيسية',
        html: `<section class="jb-hero"><div class="jb-wrap">
    <span class="jb-pill">✨ منصّة {{BRAND}}</span>
    <h1 class="jb-h1">حلٌّ احترافي يُبنى في دقائق</h1>
    <p class="jb-lead">أطلق منتجك بسرعة بمكوّنات جاهزة عالية الجودة — دون تعقيد.</p>
    <div class="jb-hero-cta"><a class="jb-btn jb-lg" href="#cta">ابدأ مجاناً</a><a class="jb-btn jb-ghost jb-lg" href="#features">اكتشف المزيد</a></div>
  </div></section>`,
        css: `.jb-hero{padding:96px 0 72px;text-align:center;background:radial-gradient(1200px 400px at 50% -10%,color-mix(in srgb,var(--jb) 22%,transparent),transparent)}
.jb-pill{display:inline-block;background:color-mix(in srgb,var(--jb) 16%,transparent);border:1px solid color-mix(in srgb,var(--jb) 40%,transparent);color:var(--jb);border-radius:20px;padding:6px 14px;font-size:13px;font-weight:700;margin-bottom:18px}
.jb-h1{font-size:clamp(30px,6vw,52px);font-weight:800;line-height:1.1;margin-bottom:16px}
.jb-lead{font-size:18px;color:var(--jb-muted);max-width:620px;margin:0 auto 28px}
.jb-hero-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}`,
    },
    {
        id: 'logos', category: 'social-proof', name: 'شعارات موثوقية',
        html: `<section class="jb-logos"><div class="jb-wrap"><p class="jb-logos-t">موثوق من فرق رائدة</p>
    <div class="jb-logos-row"><span>◆ Acme</span><span>▲ Nova</span><span>● Orbit</span><span>■ Vertex</span><span>★ Pulse</span></div>
  </div></section>`,
        css: `.jb-logos{padding:28px 0;border-block:1px solid var(--jb-border)}
.jb-logos-t{text-align:center;color:var(--jb-muted);font-size:13px;margin-bottom:14px}
.jb-logos-row{display:flex;gap:32px;justify-content:center;flex-wrap:wrap;color:var(--jb-muted);font-weight:800;opacity:.8}`,
    },
    {
        id: 'features', category: 'features', name: 'شبكة مميّزات',
        html: `<section class="jb-sec" id="features"><div class="jb-wrap">
    <h2 class="jb-h2">كل ما تحتاجه</h2><p class="jb-sub">مكوّنات جاهزة، سريعة، وقابلة للتخصيص.</p>
    <div class="jb-grid-3">
      <div class="jb-card"><div class="jb-ic">⚡</div><h3>سرعة فائقة</h3><p>أطلق في دقائق لا أسابيع.</p></div>
      <div class="jb-card"><div class="jb-ic">🎨</div><h3>تصميم أنيق</h3><p>هوية بصرية احترافية جاهزة.</p></div>
      <div class="jb-card"><div class="jb-ic">🔒</div><h3>موثوق وآمن</h3><p>بُني على أسس متينة ومختبَرة.</p></div>
    </div>
  </div></section>`,
        css: `.jb-sec{padding:72px 0}
.jb-h2{font-size:clamp(24px,4vw,36px);font-weight:800;text-align:center;margin-bottom:8px}
.jb-sub{text-align:center;color:var(--jb-muted);margin-bottom:36px}
.jb-grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}
.jb-card{background:var(--jb-card);border:1px solid var(--jb-border);border-radius:16px;padding:24px}
.jb-card h3{font-size:17px;margin:10px 0 6px}.jb-card p{color:var(--jb-muted);font-size:14px}
.jb-ic{font-size:30px}`,
    },
    {
        id: 'stats', category: 'stats', name: 'أرقام',
        html: `<section class="jb-stats"><div class="jb-wrap jb-grid-4">
    <div class="jb-stat"><div class="jb-num">99.9%</div><div class="jb-lbl">جاهزية</div></div>
    <div class="jb-stat"><div class="jb-num">10k+</div><div class="jb-lbl">مستخدم</div></div>
    <div class="jb-stat"><div class="jb-num">4.9/5</div><div class="jb-lbl">تقييم</div></div>
    <div class="jb-stat"><div class="jb-num">24/7</div><div class="jb-lbl">دعم</div></div>
  </div></section>`,
        css: `.jb-stats{padding:48px 0;background:var(--jb-surface)}
.jb-grid-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:18px;text-align:center}
.jb-num{font-size:30px;font-weight:800;color:var(--jb)}.jb-lbl{color:var(--jb-muted);font-size:14px}`,
    },
    {
        id: 'pricing', category: 'pricing', name: 'باقات الأسعار',
        html: `<section class="jb-sec" id="pricing"><div class="jb-wrap">
    <h2 class="jb-h2">أسعار بسيطة</h2><p class="jb-sub">اختر ما يناسبك.</p>
    <div class="jb-grid-3">
      <div class="jb-price"><h3>مجاني</h3><div class="jb-amt">0<span>/شهر</span></div><ul><li>✔ الأساسيات</li><li>✔ مشروع واحد</li></ul><a class="jb-btn jb-ghost" href="#cta">ابدأ</a></div>
      <div class="jb-price jb-pop"><span class="jb-tag">الأكثر شعبية</span><h3>احترافي</h3><div class="jb-amt">99<span>/شهر</span></div><ul><li>✔ كل شيء</li><li>✔ مشاريع لا محدودة</li><li>✔ دعم أولوية</li></ul><a class="jb-btn" href="#cta">اشترك</a></div>
      <div class="jb-price"><h3>أعمال</h3><div class="jb-amt">299<span>/شهر</span></div><ul><li>✔ فرق</li><li>✔ SLA</li></ul><a class="jb-btn jb-ghost" href="#cta">تواصل</a></div>
    </div>
  </div></section>`,
        css: `.jb-price{background:var(--jb-card);border:1px solid var(--jb-border);border-radius:16px;padding:26px;position:relative}
.jb-price.jb-pop{border-color:var(--jb);box-shadow:0 10px 40px color-mix(in srgb,var(--jb) 20%,transparent)}
.jb-tag{position:absolute;top:-11px;inset-inline-start:26px;background:var(--jb);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:12px}
.jb-amt{font-size:36px;font-weight:800;margin:8px 0 14px}.jb-amt span{font-size:14px;color:var(--jb-muted);font-weight:400}
.jb-price ul{list-style:none;padding:0;margin:0 0 18px}.jb-price li{color:var(--jb-muted);font-size:14px;padding:4px 0}`,
    },
    {
        id: 'testimonials', category: 'social-proof', name: 'شهادات',
        html: `<section class="jb-sec"><div class="jb-wrap">
    <h2 class="jb-h2">ماذا يقول عملاؤنا</h2><div class="jb-grid-3" style="margin-top:32px">
      <blockquote class="jb-quote">"غيّر طريقة عملنا بالكامل — سرعة وجودة."<footer>— سارة، مديرة منتج</footer></blockquote>
      <blockquote class="jb-quote">"أفضل استثمار لفريقنا هذا العام."<footer>— خالد، مؤسّس</footer></blockquote>
      <blockquote class="jb-quote">"سهل، أنيق، وموثوق."<footer>— منى، مصمّمة</footer></blockquote>
    </div>
  </div></section>`,
        css: `.jb-quote{background:var(--jb-card);border:1px solid var(--jb-border);border-radius:16px;padding:22px;margin:0;font-size:15px}
.jb-quote footer{color:var(--jb-muted);font-size:13px;margin-top:12px}`,
    },
    {
        id: 'faq', category: 'faq', name: 'أسئلة شائعة',
        html: `<section class="jb-sec" id="faq"><div class="jb-wrap" style="max-width:760px">
    <h2 class="jb-h2">الأسئلة الشائعة</h2><div class="jb-faq" style="margin-top:26px">
      <details><summary>هل أحتاج خبرة تقنية؟</summary><p>لا، كل شيء جاهز — تخصّص بالنقر.</p></details>
      <details><summary>هل يمكنني الإلغاء متى شئت؟</summary><p>نعم، بلا التزام.</p></details>
      <details><summary>هل بياناتي آمنة؟</summary><p>نعم، نتبع أفضل ممارسات الأمان.</p></details>
    </div>
  </div></section>`,
        css: `.jb-faq details{background:var(--jb-card);border:1px solid var(--jb-border);border-radius:12px;padding:14px 18px;margin-bottom:10px}
.jb-faq summary{cursor:pointer;font-weight:700}.jb-faq p{color:var(--jb-muted);font-size:14px;margin:10px 0 0}`,
    },
    {
        id: 'cta', category: 'cta', name: 'دعوة للفعل',
        html: `<section class="jb-cta" id="cta"><div class="jb-wrap">
    <h2 class="jb-h2">جاهز للبدء مع {{BRAND}}؟</h2><p class="jb-sub">انضم لآلاف المستخدمين اليوم.</p>
    <a class="jb-btn jb-lg" href="#">أنشئ حسابك مجاناً</a>
  </div></section>`,
        css: `.jb-cta{padding:80px 0;text-align:center;background:linear-gradient(120deg,color-mix(in srgb,var(--jb) 22%,transparent),transparent)}`,
    },
    {
        id: 'footer', category: 'footer', name: 'تذييل',
        html: `<footer class="jb-footer"><div class="jb-wrap jb-foot-in">
    <div><div class="jb-brand">{{BRAND}}</div><p class="jb-muted-t">© {{BRAND}} — كل الحقوق محفوظة.</p></div>
    <nav class="jb-foot-links"><a href="#">المنتج</a><a href="#">الأسعار</a><a href="#">تواصل</a><a href="#">الخصوصية</a></nav>
  </div></footer>`,
        css: `.jb-footer{border-top:1px solid var(--jb-border);padding:36px 0;background:var(--jb-surface)}
.jb-foot-in{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.jb-foot-links{display:flex;gap:18px;flex-wrap:wrap}.jb-foot-links a{color:var(--jb-muted);text-decoration:none;font-size:14px}
.jb-muted-t{color:var(--jb-muted);font-size:13px;margin-top:6px}`,
    },
];

// ترتيب افتراضيّ لصفحة هبوط تسويقيّة كاملة
const LANDING_PRESET = ['nav', 'hero', 'logos', 'features', 'stats', 'pricing', 'testimonials', 'faq', 'cta', 'footer'];

const BASE_CSS = `*{box-sizing:border-box;margin:0;padding:0}
:root{--jb:#6366f1;--jb-bg:#0f121a;--jb-surface:#151a24;--jb-card:#1a2130;--jb-text:#e8edf6;--jb-muted:#8b93a3;--jb-border:#272d3a}
body{font-family:'Cairo',system-ui,'Segoe UI',Tahoma,sans-serif;background:var(--jb-bg);color:var(--jb-text);line-height:1.6}
.jb-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.jb-btn{display:inline-block;background:var(--jb);color:#fff;border:1px solid var(--jb);border-radius:10px;padding:11px 20px;font-weight:700;font-size:14px;text-decoration:none;cursor:pointer}
.jb-btn.jb-ghost{background:transparent;color:var(--jb-text);border-color:var(--jb-border)}
.jb-btn.jb-lg{padding:14px 28px;font-size:15px}
h1,h2,h3{color:var(--jb-text)}`;

/** بيانات العرض (بلا HTML/CSS الثقيل). */
export function listBlocks() {
    return BLOCKS.map(b => ({ id: b.id, category: b.category, name: b.name }));
}

/** يجلب قسماً بمعرّفه. */
export function getBlock(id) {
    return BLOCKS.find(b => b.id === id) || null;
}

/**
 * يركّب صفحة كاملة مكتفية ذاتياً من أقسام مختارة (إعادة تركيب). دالة نقية.
 * @param {{brand?:string, title?:string, accent?:string, blocks?:string[]}} opts
 * @returns {{files:[{name,content}], blocks:string[]}}
 */
export function composePage(opts = {}) {
    const brand = (opts.brand || 'JAOLA').toString().slice(0, 40);
    const title = (opts.title || brand).toString().slice(0, 80);
    const accent = /^#[0-9a-fA-F]{3,8}$/.test(opts.accent || '') ? opts.accent : '#6366f1';
    const ids = (Array.isArray(opts.blocks) && opts.blocks.length ? opts.blocks : LANDING_PRESET)
        .map(id => getBlock(id)).filter(Boolean);
    const used = ids.length ? ids : LANDING_PRESET.map(getBlock).filter(Boolean);

    const stamp = (s) => s.replace(/\{\{BRAND\}\}/g, brand);
    const bodyHtml = used.map(b => stamp(b.html)).join('\n');
    const css = [BASE_CSS.replace('--jb:#6366f1', `--jb:${accent}`)]
        .concat(used.map(b => b.css)).join('\n');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${bodyHtml}
</body>
</html>
`;
    return { files: [{ name: 'index.html', content: html }, { name: 'styles.css', content: css }], blocks: used.map(b => b.id) };
}

/** صفحة هبوط كاملة جاهزة (اختصار). */
export function composeLanding(brand = 'JAOLA', accent = '#6366f1') {
    return composePage({ brand, accent, blocks: LANDING_PRESET });
}

// كلمات تدلّ على صفحة تسويقيّة/تعريفيّة ثابتة (لا تطبيق تفاعليّ) — تُبنى بإعادة
// تركيب من الـ Registry (كاملة واحترافية) بدل التوليد الهشّ.
const MARKETING_HINTS = [
    'landing', 'هبوط', 'لاندنج', 'لاندنق', 'بروشور', 'brochure', 'تعريفي', 'تعريفية',
    'بورتفوليو', 'portfolio', 'معرض اعمال', 'معرض أعمال', 'شركة', 'company', 'corporate',
    'وكالة', 'agency', 'صفحة تسويق', 'marketing page', 'one page', 'ونبيج', 'onepage',
    'صفحة هبوط', 'موقع تعريفي', 'coming soon', 'قريبا', 'startup', 'ستارت اب',
];

/** هل الهدف صفحة تسويقيّة/تعريفيّة ثابتة → إعادة تركيب من الـ Registry؟ */
export function isMarketingPageGoal(goal = '', blueprint = null) {
    const k = blueprint?.kind;
    if (k === 'landing' || k === 'brochure') return true;
    const hay = (goal || '').toString().toLowerCase();
    return MARKETING_HINTS.some(h => hay.includes(h.toLowerCase()));
}

// كلمات تُستبعَد عند استخراج العلامة (أفعال بناء + كلمات نوع عامّة). تصفية بالرمز
// لا بـ \b (لا يعمل مع العربية).
const BRAND_STOPWORDS = new Set([
    'ابني', 'ابن', 'أبني', 'أنشئ', 'انشئ', 'اصنع', 'صمم', 'صمّم', 'اعمل', 'build', 'create', 'make', 'design', 'generate',
    'موقع', 'صفحة', 'منصة', 'منصّة', 'تطبيق', 'هبوط', 'تعريفي', 'تعريفية', 'بروشور', 'landing', 'page', 'website', 'site',
    'for', 'لـ', 'ل', 'شركة', 'لشركة', 'مع', 'a', 'an', 'the',
]);

/** يختار مجموعة الأقسام الأنسب حسب نوع الطلب (اختيار ذكيّ لا preset ثابت). */
export function selectBlocks(goal = '') {
    const g = (goal || '').toString().toLowerCase();
    if (/قريبا|قريباً|coming soon|\bsoon\b|قيد الإنشاء|تحت الإنشاء|under construction/.test(g)) {
        return ['nav', 'hero', 'cta', 'footer'];
    }
    if (/بورتفوليو|portfolio|معرض اعمال|معرض أعمال|أعمالي|اعمالي|مصمم|مصمّم|freelance/.test(g)) {
        return ['nav', 'hero', 'features', 'testimonials', 'cta', 'footer'];
    }
    if (/بروشور|brochure|تعريفي|تعريفية|شركة|company|corporate|وكالة|agency/.test(g)) {
        return ['nav', 'hero', 'logos', 'features', 'stats', 'testimonials', 'cta', 'footer'];
    }
    // افتراضي (SaaS/هبوط/عام): صفحة تسويقيّة كاملة
    return LANDING_PRESET.slice();
}

/** يستخرج اسم علامة تقريبيّاً من الهدف (لتخصيص العنوان/الترويسة). */
export function brandFromGoal(goal = '', fallback = 'JAOLA') {
    const toks = (goal || '').toString().replace(/["'«»]/g, ' ').split(/\s+/).filter(Boolean)
        .filter(w => !BRAND_STOPWORDS.has(w.toLowerCase()));
    const s = toks.slice(0, 3).join(' ').trim();
    return s || fallback || 'JAOLA';
}
