/**
 * 👁️ React Live Preview — معاينة حيّة لمشاريع React/Next داخل الـ iframe
 *
 * مشاريع Next لا تُصيَّر في المعاينة الثابتة بلا build. هذا يُنتج صفحة index.html
 * **مكتفية ذاتياً** تصيّر مكوّنات المشروع فعلياً في متصفّح المستخدم:
 *   React UMD + Babel Standalone (يترجم JSX في المتصفّح) + Tailwind Play CDN.
 *
 * 🛡️ لا صفحة بيضاء أبداً: نرسم **محتوى المشروع الحقيقي كـ HTML ثابت** داخل #root
 * فوراً (بأنماط مضمّنة، بلا اعتماد على أي CDN). فإن فشل تحميل React/Babel/Tailwind
 * (شبكة، حجب، خطأ ترجمة) يبقى المحتوى ظاهراً — وإن نجحت، تُصيّر React فوقه.
 * كما نُظهر أي خطأ تصيير بدل ابتلاعه صامتاً.
 *
 * ملاحظة: للمعاينة/التطوير فقط (CDN)؛ الإنتاج يستخدم مشروع Next المبني.
 */

const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// نفس اشتقاق المسار في المولّد: DataTable → data-table (لمطابقة routes)
const slugify = (comp) => (comp || '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
const hrefToFile = (href) => (href === '/' || !href) ? 'index.html' : href.replace(/^\//, '').replace(/\//g, '-') + '.html';

// يزيل import/export ليصبح الكود قابلاً للّصق في سكربت Babel واحد
function stripModuleSyntax(src) {
    return (src || '')
        .replace(/^\s*import\s.*?;?\s*$/gm, '')          // احذف كل سطور import
        .replace(/export\s+default\s+function/g, 'function')
        .replace(/export\s+default\s+/g, 'const __default__ = ')
        .replace(/^\s*export\s+/gm, '');                  // export const/function → عام
}

// يستخرج كائن المحتوى من lib/content.js (JSON.stringify مُصدَّر) — best-effort
function parseContent(src) {
    if (!src) return null;
    const i = src.indexOf('{');
    const j = src.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(src.slice(i, j + 1)); } catch { return null; }
}

/**
 * يرسم محتوى المشروع كـ HTML ثابت بأنماط مضمّنة (بلا CDN) — يضمن ظهور المحتوى
 * دائماً حتى لو فشلت React/Babel/Tailwind. تصيّر React فوقه عند النجاح.
 */
function staticFallback(content, dir) {
    if (!content || typeof content !== 'object') {
        return '<div style="padding:40px;font-family:system-ui;color:#64748b">…</div>';
    }
    const align = dir === 'rtl' ? 'right' : 'left';
    const c = content;
    const h = c.hero || {};
    const nav = (c.nav || []).map((n) => `<a style="color:#475569;text-decoration:none;font-size:14px">${esc(n)}</a>`).join('');
    const sections = Object.entries(c.sections || {}).map(([, s]) => {
        const items = (s.items || []).map((it) => `
      <div style="border:1px solid #e2e8f0;border-radius:16px;padding:22px;background:#fff">
        <div style="height:38px;width:38px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#7c3aed)"></div>
        <h3 style="margin:14px 0 6px;font-size:17px;font-weight:600;color:#0f172a">${esc(it.title)}</h3>
        <p style="margin:0;font-size:14px;color:#475569">${esc(it.desc)}</p>
      </div>`).join('');
        return `
    <section style="max-width:1100px;margin:0 auto;padding:64px 24px;text-align:${align}">
      <h2 style="font-size:28px;font-weight:700;color:#0f172a;margin:0">${esc(s.heading)}</h2>
      ${s.subheading ? `<p style="margin:10px 0 0;color:#475569">${esc(s.subheading)}</p>` : ''}
      <div style="display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:34px">${items}</div>
    </section>`;
    }).join('');
    const footer = c.footer || {};
    return `
  <header style="position:sticky;top:0;backdrop-filter:blur(8px);background:rgba(255,255,255,.75);border-bottom:1px solid #e2e8f0">
    <nav style="max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:16px 24px">
      <span style="font-size:20px;font-weight:800;background:linear-gradient(90deg,#2563eb,#7c3aed);-webkit-background-clip:text;background-clip:text;color:transparent">${esc(c.brand)}</span>
      <div style="display:flex;gap:22px">${nav}</div>
      <button style="border:0;border-radius:10px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;padding:9px 16px;font-weight:600;font-size:14px">${esc(h.cta1 || 'Start')}</button>
    </nav>
  </header>
  <section style="max-width:1100px;margin:0 auto;padding:88px 24px;text-align:${align}">
    <h1 style="font-size:46px;line-height:1.1;font-weight:800;color:#0f172a;margin:0">${esc(h.title)}</h1>
    <p style="margin:22px 0 0;max-width:640px;font-size:18px;color:#475569">${esc(h.subtitle)}</p>
    <div style="display:flex;gap:14px;margin-top:30px">
      <button style="border:0;border-radius:12px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;padding:13px 26px;font-weight:600">${esc(h.cta1)}</button>
      ${h.cta2 ? `<button style="border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#334155;padding:13px 26px;font-weight:600">${esc(h.cta2)}</button>` : ''}
    </div>
  </section>
  ${sections}
  <footer style="border-top:1px solid #e2e8f0;padding:40px 24px;text-align:center;color:#64748b;font-size:14px">© ${new Date().getFullYear()} ${esc(c.brand)}. ${esc(footer.rights || '')}</footer>`;
}

/**
 * يبني معاينة React مكتفية ذاتياً من ملفات المشروع.
 * @param {{name,content}[]} files
 * @param {{ title?, lang?, rootComponent? }} opts
 * @returns {string} index.html
 */
export function buildReactPreviewHtml(files = [], opts = {}) {
    const lang = (opts.lang || 'en').toLowerCase();
    const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
    const root = opts.rootComponent || 'Page';

    // اجمع المكوّنات ثم الصفحات (الصفحات تعتمد عليها)
    const comps = files.filter(f => /^components\/.+\.jsx$/.test(f.name));
    const contentMod = files.find(f => f.name === 'lib/content.js' || f.name === 'lib/content.jsx');
    // صفحات تحمل علامة توجيه (متعدّد الصفحات) — نبني منها راوتراً فعلياً
    const pageFiles = files.filter(f => /^app\/(?:[^/]+\/)?page\.jsx?$/.test(f.name));
    const pages = pageFiles
        .map(f => { const m = f.content.match(/jaola:route=(\S+)\s+comp=(\w+)/); return m ? { route: m[1], comp: m[2], src: f.content } : null; })
        .filter(Boolean);

    const parts = [];
    // محتوى الموقع أولاً (المكوّنات تستورده) — نُضمّنه لأن المعاينة تزيل الـ imports
    if (contentMod) parts.push(stripModuleSyntax(contentMod.content));
    for (const c of comps) parts.push(stripModuleSyntax(c.content));

    if (pages.length) {
        // 🗺️ متعدّد الصفحات: بديل next/link + راوتر هاش يعيد التصيير عند تغيّر المسار
        for (const p of pages) parts.push(stripModuleSyntax(p.src));
        const table = pages.map(p => `${JSON.stringify(p.route)}: ${p.comp}`).join(', ');
        parts.push(`
function Link(props){ var href = props.href || '/'; var rest = Object.assign({}, props); delete rest.href; delete rest.children; return React.createElement('a', Object.assign({ href: '#' + href }, rest), props.children); }
var __routes = { ${table} };
function __curRoute(){ var h = (location.hash || '').replace(/^#/, ''); return __routes[h] ? h : '/'; }
function __Router(){
  var st = React.useState(__curRoute()); var route = st[0], setRoute = st[1];
  React.useEffect(function(){ function on(){ setRoute(__curRoute()); window.scrollTo(0, 0); } window.addEventListener('hashchange', on); return function(){ window.removeEventListener('hashchange', on); }; }, []);
  var C = __routes[route] || __routes['/'];
  return React.createElement(C);
}
try {
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__Router));
} catch (e) { __showError(e && (e.stack || e.message) || String(e)); }`);
    } else {
        // صفحة واحدة (توافق خلفي)
        const page = files.find(f => f.name === 'app/page.jsx' || f.name === 'app/page.js');
        if (page) parts.push(stripModuleSyntax(page.content));
        parts.push(`try {
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${root}));
} catch (e) { __showError(e && (e.stack || e.message) || String(e)); }`);
    }

    const script = parts.join('\n\n');
    const title = opts.title || 'Preview';
    const fallback = staticFallback(parseContent(contentMod?.content), dir);

    return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#fff;color:#0f172a}</style>
</head>
<body>
  <!-- محتوى ثابت يظهر فوراً؛ تُصيّر React فوقه عند تحميلها. لا صفحة بيضاء أبداً. -->
  <div id="root">${fallback}</div>
  <div id="__err" style="display:none;position:fixed;bottom:0;inset-inline:0;background:#7f1d1d;color:#fecaca;font:12px/1.5 monospace;padding:12px 16px;white-space:pre-wrap;max-height:40vh;overflow:auto;z-index:9999"></div>
  <script>
    function __showError(msg){ var e=document.getElementById('__err'); if(e){ e.textContent='⚠️ Preview render error:\\n'+msg; e.style.display='block'; } }
    // إن لم تُحمّل React/Babel خلال مهلة، يبقى المحتوى الثابت (بلا خطأ مزعج)
    window.addEventListener('error', function(ev){
      var s = ev && ev.target && (ev.target.src || '');
      if (s && /unpkg\\.com|tailwindcss\\.com/.test(s)) { /* CDN فشل → يبقى الـ fallback الثابت */ return; }
    }, true);
  </script>
  <script type="text/babel" data-presets="react">
${script}
  </script>
</body>
</html>
`;
}

/** يُرجع ملف المعاينة الجاهز للكتابة في مجلد المشروع */
export function reactPreviewFile(files, opts) {
    return { name: 'index.html', content: buildReactPreviewHtml(files, opts) };
}

// ════════════════════════════════════════════════════════════════════
// 🗺️ معاينة ثابتة متعدّدة الصفحات — صفحات HTML حقيقية بروابط تعمل بلا CDN
//
// المشكلة التي حلّها هذا: المعاينة السابقة كانت index.html واحداً يعتمد على
// React+Babel من CDN — فإن لم تُحمّل، الروابط ميتة و"لا يفتح غير الاندكس".
// الحل: نولّد صفحة HTML حقيقية لكل مسار (index.html, pricing.html, …) بروابط
// <a href="pricing.html"> عادية تعمل فوراً في أي متصفّح، وتُخدَّم عبر مسار
// /workspace/<file> الموجود. مشروع Next الحقيقي يبقى للنشر الفعلي.
// ════════════════════════════════════════════════════════════════════

const PAGE_CSS = `*{box-sizing:border-box}
:root{--bg:#ffffff;--fg:#0f172a;--muted:#5b6472;--line:#e6e9ef;--card:#ffffff;--soft:#f7f8fb;--g1:#4f46e5;--g2:#9333ea;--ring:rgba(79,70,229,.35)}
html{scroll-behavior:smooth}
body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Kufi Arabic','Noto Sans Arabic','Cairo',sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}img{max-width:100%}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
/* nav */
.nav{position:sticky;top:0;z-index:50;backdrop-filter:saturate(1.4) blur(12px);background:color-mix(in srgb,var(--bg) 78%,transparent);border-bottom:1px solid var(--line)}
.nav .row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;gap:16px;flex-wrap:wrap}
.brand{font-size:21px;font-weight:800;letter-spacing:-.02em;text-decoration:none;background:linear-gradient(90deg,var(--g1),var(--g2));-webkit-background-clip:text;background-clip:text;color:transparent}
.links{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.links a{text-decoration:none;font-size:14px;font-weight:500;color:var(--muted);padding:7px 12px;border-radius:9px;transition:.18s}
.links a:hover{color:var(--fg);background:var(--soft)}
.links a.active{color:var(--g1);background:color-mix(in srgb,var(--g1) 10%,transparent);font-weight:700}
.cta{border:0;border-radius:11px;background:linear-gradient(90deg,var(--g1),var(--g2));color:#fff;padding:10px 18px;font-weight:600;font-size:14px;text-decoration:none;display:inline-block;box-shadow:0 6px 18px -6px var(--ring);transition:.18s}
.cta:hover{transform:translateY(-1px);box-shadow:0 10px 24px -8px var(--ring)}
/* قائمة الجوّال (☰) — CSS فقط، بلا JS (خدعة checkbox) */
.navtog{display:none}
.burger{display:none;cursor:pointer;font-size:22px;line-height:1;padding:6px 11px;border-radius:9px;color:var(--fg);user-select:none}
.burger:hover{background:var(--soft)}
@media(max-width:820px){
  .nav .row{position:relative}
  .burger{display:inline-flex}
  .nav .cta{display:none}
  .links{display:none;order:3;flex-basis:100%;flex-direction:column;align-items:stretch;gap:4px;padding:8px 0 4px}
  .links a{padding:11px 12px}
  .navtog:checked ~ .links{display:flex}
}
/* hero */
.hero{position:relative;padding:104px 0 92px;overflow:hidden}
.hero::before{content:"";position:absolute;inset:-40% 0 auto 0;height:520px;background:radial-gradient(60% 60% at 50% 0,color-mix(in srgb,var(--g1) 20%,transparent),transparent 70%);pointer-events:none;z-index:-1}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--g1);background:color-mix(in srgb,var(--g1) 9%,transparent);border:1px solid color-mix(in srgb,var(--g1) 22%,transparent);padding:6px 13px;border-radius:999px;margin-bottom:22px}
.eyebrow .dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(90deg,var(--g1),var(--g2))}
.hero h1{font-size:clamp(34px,5.4vw,58px);line-height:1.06;font-weight:800;letter-spacing:-.03em;margin:0;max-width:15ch}
.hero h1 .grad{background:linear-gradient(90deg,var(--g1),var(--g2));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:24px 0 0;max-width:60ch;font-size:clamp(16px,2.1vw,20px);color:var(--muted)}
.btns{display:flex;gap:14px;margin-top:34px;flex-wrap:wrap}
.big{border:0;border-radius:13px;background:linear-gradient(90deg,var(--g1),var(--g2));color:#fff;padding:14px 30px;font-weight:600;font-size:16px;text-decoration:none;display:inline-block;box-shadow:0 12px 30px -10px var(--ring);transition:.18s}
.big:hover{transform:translateY(-2px);box-shadow:0 18px 40px -12px var(--ring)}
.ghost{border:1px solid var(--line);border-radius:13px;background:var(--card);color:var(--fg);padding:13px 28px;font-weight:600;font-size:16px;text-decoration:none;display:inline-block;transition:.18s}
.ghost:hover{border-color:var(--g1);color:var(--g1)}
/* sections */
.sec{padding:80px 0}
.sec .head{max-width:64ch}
.sec h2{font-size:clamp(26px,3.4vw,36px);font-weight:800;letter-spacing:-.02em;margin:0}
.sec .sub{margin:12px 0 0;color:var(--muted);font-size:17px}
.grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:44px}
.card{border:1px solid var(--line);border-radius:20px;padding:26px;background:var(--card);transition:.2s;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--g1) 40%,var(--line));box-shadow:0 22px 44px -22px var(--ring)}
.card .ic{height:46px;width:46px;border-radius:14px;background:linear-gradient(135deg,var(--g1),var(--g2));box-shadow:0 8px 20px -8px var(--ring);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800}
.card .ci{width:100%;height:170px;object-fit:cover;border-radius:13px;display:block}
.card h3{margin:16px 0 6px;font-size:19px;font-weight:700;letter-spacing:-.01em}
.card p{margin:0;font-size:15px;color:var(--muted)}
.card .price{margin:6px 0 2px;font-size:18px;font-weight:800;color:var(--g1)}
.hero-img{margin-top:44px}.hero-img img{width:100%;max-height:420px;object-fit:cover;border-radius:22px;box-shadow:0 30px 60px -30px var(--ring);border:1px solid var(--line)}
/* footer */
.foot{border-top:1px solid var(--line);padding:44px 0;background:var(--soft)}
.foot .row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:14px}
.foot .fl{display:flex;gap:18px;flex-wrap:wrap}.foot .fl a{text-decoration:none;color:var(--muted)}.foot .fl a:hover{color:var(--g1)}
@media(max-width:640px){.hero{padding:72px 0 64px}.sec{padding:56px 0}}
@media(prefers-color-scheme:dark){:root{--bg:#0a0f1c;--fg:#e8ecf4;--muted:#94a0b4;--line:#1e2637;--card:#0f1626;--soft:#0c1220;--ring:rgba(129,110,247,.28);--g1:#6366f1;--g2:#a855f7}}`;

// أول كلمة/كلمتان تُلوَّن بتدرّج داخل العنوان لإحساس أرقى
function gradientTitle(title) {
    const words = String(title || '').trim().split(/\s+/);
    if (words.length <= 1) return `<span class="grad">${esc(title)}</span>`;
    const tail = words.slice(-Math.min(2, words.length - 1)).join(' ');
    const head = words.slice(0, words.length - Math.min(2, words.length - 1)).join(' ');
    return `${esc(head)} <span class="grad">${esc(tail)}</span>`;
}

function navBar(content, currentHref) {
    const routes = content.routes || [];
    const links = routes.map((r) => {
        const cls = r.href === currentHref ? 'active' : '';
        return `<a class="${cls}" href="${hrefToFile(r.href)}">${esc(r.label)}</a>`;
    }).join('');
    const cta = content.hero?.cta1 ? `<a class="cta" href="${hrefToFile((routes.find((r) => r.href !== '/') || {}).href)}">${esc(content.hero.cta1)}</a>` : '';
    // checkbox + label ☰ يبدّلان القائمة على الجوّال بلا JS
    return `<header class="nav"><div class="wrap row"><a class="brand" href="index.html">${esc(content.brand)}</a><input type="checkbox" id="navtog" class="navtog" /><label for="navtog" class="burger" aria-label="menu">☰</label><nav class="links">${links}</nav>${cta}</div></header>`;
}
function heroBlock(content) {
    const h = content.hero || {};
    const routes = content.routes || [];
    const first = (routes.find((r) => r.href !== '/') || {}).href;
    return `<section class="hero"><div class="wrap">
    <span class="eyebrow"><span class="dot"></span>${esc(content.brand)}</span>
    <h1>${gradientTitle(h.title)}</h1>
    ${h.subtitle ? `<p>${esc(h.subtitle)}</p>` : ''}
    <div class="btns">
      ${h.cta1 ? `<a class="big" href="${hrefToFile(first)}">${esc(h.cta1)}</a>` : ''}
      ${h.cta2 ? `<a class="ghost" href="${hrefToFile(first)}">${esc(h.cta2)}</a>` : ''}
    </div>
    ${h.image ? `<div class="hero-img"><img src="${esc(h.image)}" alt="" /></div>` : ''}
    </div></section>`;
}
// رأس البطاقة: صورة إن وُجدت، وإلا رقاقة (رقم أو رمز)
const cardHead = (it, chip) => it && it.image ? `<img class="ci" src="${esc(it.image)}" alt="" />` : `<div class="ic">${chip}</div>`;
function sectionBlock(sec) {
    if (!sec) return '';
    const items = (sec.items || []).map((it, i) => `<div class="card">${cardHead(it, i + 1)}<h3>${esc(it.title)}</h3><p>${esc(it.desc)}</p></div>`).join('');
    return `<section class="sec"><div class="wrap"><div class="head"><h2>${esc(sec.heading)}</h2>${sec.subheading ? `<p class="sub">${esc(sec.subheading)}</p>` : ''}</div><div class="grid">${items}</div></div></section>`;
}
function productsBlock(products, lang) {
    const ar = lang === 'ar';
    const cards = (products || []).map((p) => `<div class="card">${cardHead(p, '🛍️')}<h3>${esc(p.name)}</h3>${p.price ? `<div class="price">${esc(p.price)}</div>` : ''}${p.desc ? `<p>${esc(p.desc)}</p>` : ''}</div>`).join('');
    return `<section class="sec"><div class="wrap"><div class="head"><h2>${ar ? 'منتجاتنا' : 'Products'}</h2></div><div class="grid">${cards}</div></div></section>`;
}
function footBlock(content) {
    const f = content.footer || {};
    const links = (f.links || []).map((l) => `<a href="#">${esc(l)}</a>`).join('');
    return `<footer class="foot"><div class="wrap row"><span>© ${new Date().getFullYear()} ${esc(content.brand)}. ${esc(f.rights || '')}</span><span class="fl">${links}</span></div></footer>`;
}
function pageDoc({ lang, dir, title, body }) {
    return `<!doctype html>\n<html lang="${lang}" dir="${dir}">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${esc(title)}</title>\n  <style>${PAGE_CSS}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

/**
 * يبني موقعاً ثابتاً متعدّد الصفحات من نموذج المحتوى — صفحات HTML حقيقية بروابط تعمل.
 * @param {object} content  كائن المحتوى (brand/nav/hero/sections/footer/routes)
 * @param {string} lang
 * @returns {{name,content}[]}  ملفات HTML جاهزة للكتابة (index.html + <slug>.html)
 */
export function buildStaticSite(content, lang = 'en') {
    const code = (lang || 'en').toLowerCase();
    const dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr';
    if (!content || typeof content !== 'object') {
        return [{ name: 'index.html', content: pageDoc({ lang: code, dir, title: 'Preview', body: '<div class="wrap" style="padding:60px 24px;color:#64748b">…</div>' }) }];
    }
    const routes = (content.routes && content.routes.length) ? content.routes : [{ label: 'Home', href: '/' }];
    // خريطة slug → اسم القسم في content.sections (المسارات = '/'+slugify(comp))
    const compBySlug = {};
    for (const c of Object.keys(content.sections || {})) compBySlug[slugify(c)] = c;

    // 🛍️ صفحة منتجات تلقائية إن وُجدت منتجات (يديرها العميل من لوحة الموقع)
    const hasProducts = Array.isArray(content.products) && content.products.length > 0;
    let navRoutes = routes.slice();
    if (hasProducts && !navRoutes.some((r) => r.href === '/products')) {
        navRoutes = navRoutes.concat([{ label: content.productsLabel || (code === 'ar' ? 'المتجر' : 'Shop'), href: '/products' }]);
    }
    const navContent = { ...content, routes: navRoutes };   // الشريط يعرض كل الوجهات

    const nav = (href) => navBar(navContent, href);
    const foot = footBlock(content);
    const pages = [];
    for (const r of navRoutes) {
        let main;
        if (r.href === '/') {
            main = heroBlock(content);                        // الرئيسية = بطل
        } else if (r.href === '/products') {
            main = productsBlock(content.products, code);     // صفحة المتجر
        } else {
            const comp = compBySlug[r.href.replace(/^\//, '')];
            main = sectionBlock(content.sections?.[comp]);    // صفحة القسم
        }
        const body = `${nav(r.href)}\n<main>\n${main}\n</main>\n${foot}`;
        pages.push({ name: hrefToFile(r.href), content: pageDoc({ lang: code, dir, title: `${content.brand} — ${r.label}`, body }) });
    }
    return pages;
}

/** يبني الموقع الثابت من مصدر lib/content.js (export const content = {...}) */
export function buildStaticSiteFromSource(contentJsSource, lang = 'en') {
    return buildStaticSite(parseContent(contentJsSource), lang);
}

// ════════════════════════════════════════════════════════════════════
// 🛠️ لوحة تحكم موقع العميل (dashboard.html) — يديرها العميل بنفسه
//   محميّة بكلمة مرور خاصة بالموقع؛ تحفظ عبر خادم جولا وتعيد توليد الموقع.
//   صفحة مكتفية ذاتياً (JS عادي)، تنادي /api/site/* على نفس الأصل.
// ════════════════════════════════════════════════════════════════════
export function buildDashboardPage(content, { project = '', username = '', apiBase = '', lang = 'ar' } = {}) {
    const code = (lang || 'ar').toLowerCase();
    const dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr';
    const T = code === 'ar'
        ? { title: 'لوحة إدارة الموقع', pass: 'كلمة مرور الموقع', login: 'دخول', setup: 'تعيين كلمة المرور وبدء الإدارة', first: 'أول مرة؟ عيّن كلمة مرور لإدارة موقعك.', brand: 'اسم العلامة', htitle: 'عنوان البطل', hsub: 'وصف البطل', himg: 'صورة البطل', rights: 'حقوق التذييل', products: 'المنتجات', addp: '➕ أضف منتجاً', pname: 'الاسم', pprice: 'السعر', pdesc: 'الوصف', pimg: 'صورة', del: 'حذف', save: '💾 حفظ ونشر التعديلات', saved: '✅ حُفظ! المعاينة تحدّثت.', bad: '⚠️ كلمة المرور غير صحيحة', view: 'عرض الموقع ↗', logout: 'خروج' }
        : { title: 'Site Manager', pass: 'Site password', login: 'Log in', setup: 'Set password & start', first: 'First time? Set a password to manage your site.', brand: 'Brand name', htitle: 'Hero title', hsub: 'Hero subtitle', himg: 'Hero image', rights: 'Footer rights', products: 'Products', addp: '➕ Add product', pname: 'Name', pprice: 'Price', pdesc: 'Description', pimg: 'Image', del: 'Delete', save: '💾 Save & publish', saved: '✅ Saved! Preview updated.', bad: '⚠️ Wrong password', view: 'View site ↗', logout: 'Log out' };
    const cfg = JSON.stringify({ project, username, apiBase });
    const css = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,'Noto Kufi Arabic','Cairo',sans-serif;background:#0b1120;color:#e8ecf4;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:28px 20px}
h1{font-size:24px;margin:0 0 4px}.mut{color:#94a0b4;font-size:14px}
.card{background:#0f1626;border:1px solid #1e2637;border-radius:16px;padding:20px;margin:16px 0}
label{display:block;font-size:13px;color:#94a0b4;margin:12px 0 6px}
input,textarea{width:100%;background:#0b1120;border:1px solid #26304a;border-radius:10px;color:#e8ecf4;padding:11px 13px;font:inherit}
textarea{min-height:70px;resize:vertical}
.btn{border:0;border-radius:11px;background:linear-gradient(90deg,#6366f1,#a855f7);color:#fff;padding:12px 20px;font-weight:700;cursor:pointer;font:inherit}
.btn.sm{padding:7px 12px;font-size:13px}.btn.gray{background:#26304a}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sp{justify-content:space-between}
.prod{border:1px solid #26304a;border-radius:12px;padding:14px;margin:10px 0}
.thumb{width:54px;height:54px;object-fit:cover;border-radius:9px;border:1px solid #26304a}
.hide{display:none}.toast{position:fixed;inset-inline:0;bottom:18px;text-align:center}
.toast span{background:#16a34a;color:#fff;padding:10px 18px;border-radius:999px;font-weight:600;font-size:14px}
.err{color:#fca5a5;font-size:13px;margin-top:8px}a{color:#a5b4fc}`;
    // سكربت اللوحة (JS عادي، بلا مكتبات)
    const js = `
const CFG=${cfg}, T=${JSON.stringify(T)};
const API=CFG.apiBase||''; const KEY='jaola_site_token_'+CFG.project;
let token=localStorage.getItem(KEY)||''; let data=null;
const $=s=>document.querySelector(s);
async function api(p,opt={}){ const h=Object.assign({'Content-Type':'application/json'},opt.headers||{}); if(token)h['Authorization']='Bearer '+token;
  const r=await fetch(API+p,Object.assign({},opt,{headers:h})); const j=await r.json().catch(()=>({})); if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status}); return j; }
async function boot(){ try{ const s=await api('/api/site/status?project='+encodeURIComponent(CFG.project)+'&username='+encodeURIComponent(CFG.username));
  $('#hint').textContent = s.hasPassword? '' : T.first; $('#loginBtn').textContent = s.hasPassword? T.login : T.setup; window.__hasPass=s.hasPassword; }catch(e){} if(token)load(); }
async function doLogin(){ const pw=$('#pw').value; $('#loginErr').textContent='';
  try{ const ep=window.__hasPass? '/api/site/auth':'/api/site/password';
    const j=await api(ep,{method:'POST',body:JSON.stringify({project:CFG.project,username:CFG.username,password:pw})});
    token=j.token; localStorage.setItem(KEY,token); await load(); }catch(e){ $('#loginErr').textContent=T.bad; } }
async function load(){ try{ const j=await api('/api/site/content?project='+encodeURIComponent(CFG.project)+'&username='+encodeURIComponent(CFG.username));
  data=j.content||{}; $('#login').classList.add('hide'); $('#app').classList.remove('hide'); fill(); }catch(e){ localStorage.removeItem(KEY); token=''; } }
function fill(){ $('#brand').value=data.brand||''; $('#htitle').value=(data.hero||{}).title||''; $('#hsub').value=(data.hero||{}).subtitle||'';
  $('#himg').value=(data.hero||{}).image||''; $('#rights').value=(data.footer||{}).rights||''; renderProducts(); }
function renderProducts(){ const box=$('#products'); box.innerHTML=''; (data.products||[]).forEach((p,i)=>{ const el=document.createElement('div'); el.className='prod';
  el.innerHTML='<div class="row sp"><div class="row"><img class="thumb" src="'+(p.image||'')+'" onerror="this.style.visibility=\\'hidden\\'"><b>'+(p.name||'—')+'</b> <span class="mut">'+(p.price||'')+'</span></div><button class="btn gray sm" data-del="'+i+'">'+T.del+'</button></div>'+
    '<label>'+T.pname+'</label><input data-f="name" data-i="'+i+'" value="'+enc(p.name)+'">'+
    '<div class="row"><div style="flex:1"><label>'+T.pprice+'</label><input data-f="price" data-i="'+i+'" value="'+enc(p.price)+'"></div>'+
    '<div style="flex:1"><label>'+T.pimg+'</label><input type="file" accept="image/*" data-img="'+i+'"></div></div>'+
    '<label>'+T.pdesc+'</label><textarea data-f="desc" data-i="'+i+'">'+enc(p.desc)+'</textarea>'; box.appendChild(el); }); }
function enc(s){ return String(s==null?'':s).replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function collect(){ data.brand=$('#brand').value; data.hero=data.hero||{}; data.hero.title=$('#htitle').value; data.hero.subtitle=$('#hsub').value; data.hero.image=$('#himg').value;
  data.footer=data.footer||{}; data.footer.rights=$('#rights').value; }
async function upload(file,name){ const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file);});
  const j=await api('/api/site/asset',{method:'POST',body:JSON.stringify({project:CFG.project,username:CFG.username,name,dataUrl})}); return j.url; }
async function save(){ collect(); try{ await api('/api/site/content',{method:'POST',body:JSON.stringify({project:CFG.project,username:CFG.username,content:{brand:data.brand,hero:data.hero,footer:data.footer,products:data.products||[]}})});
  toast(T.saved); }catch(e){ toast('⚠️ '+e.message); } }
function toast(m){ const t=$('#toast'); t.innerHTML='<span>'+m+'</span>'; setTimeout(()=>t.innerHTML='',2600); }
document.addEventListener('click',async e=>{ const t=e.target;
  if(t.id==='loginBtn')return doLogin();
  if(t.id==='saveBtn')return save();
  if(t.id==='logoutBtn'){localStorage.removeItem(KEY);location.reload();return;}
  if(t.id==='addBtn'){ data.products=data.products||[]; data.products.push({name:'',price:'',desc:'',image:''}); renderProducts(); return; }
  if(t.dataset.del!=null){ data.products.splice(+t.dataset.del,1); renderProducts(); return; } });
document.addEventListener('input',e=>{ const f=e.target.dataset.f, i=e.target.dataset.i; if(f!=null&&i!=null){ data.products[+i][f]=e.target.value; } });
document.addEventListener('change',async e=>{ const i=e.target.dataset.img; if(i!=null&&e.target.files[0]){ try{ const url=await upload(e.target.files[0], (data.products[+i].name||'product')); data.products[+i].image=url; renderProducts(); toast('🖼️'); }catch(err){ toast('⚠️ '+err.message);} } });
boot();`;
    return `<!doctype html>
<html lang="${code}" dir="${dir}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(T.title)} — ${esc(content?.brand || '')}</title><style>${css}</style></head>
<body><div class="wrap">
  <div class="row sp"><h1>${esc(T.title)}</h1><a href="index.html" target="_blank">${esc(T.view)}</a></div>
  <div id="login" class="card">
    <p class="mut" id="hint"></p>
    <label>${esc(T.pass)}</label><input id="pw" type="password" autocomplete="current-password"/>
    <div class="err" id="loginErr"></div>
    <div style="margin-top:14px"><button class="btn" id="loginBtn">${esc(T.login)}</button></div>
  </div>
  <div id="app" class="hide">
    <div class="card"><label>${esc(T.brand)}</label><input id="brand"/>
      <label>${esc(T.htitle)}</label><input id="htitle"/>
      <label>${esc(T.hsub)}</label><textarea id="hsub"></textarea>
      <label>${esc(T.himg)} (URL)</label><input id="himg"/>
      <label>${esc(T.rights)}</label><input id="rights"/></div>
    <div class="card"><div class="row sp"><b>${esc(T.products)}</b><button class="btn gray sm" id="addBtn">${esc(T.addp)}</button></div><div id="products"></div></div>
    <div class="row sp"><button class="btn" id="saveBtn">${esc(T.save)}</button><button class="btn gray sm" id="logoutBtn">${esc(T.logout)}</button></div>
  </div>
  <div class="toast" id="toast"></div>
</div><script>${js}</script></body></html>
`;
}

/** يبني الموقع الثابت من مصفوفة ملفات المشروع (يجد lib/content.js) */
export function staticSiteFromFiles(files = [], lang = 'en') {
    const mod = files.find((f) => f.name === 'lib/content.js' || f.name === 'lib/content.jsx');
    return mod ? buildStaticSiteFromSource(mod.content, lang) : [];
}
