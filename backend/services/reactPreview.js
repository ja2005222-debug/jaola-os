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

const PAGE_CSS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Arabic',sans-serif;background:#fff;color:#0f172a}
a{color:inherit}.wrap{max-width:1100px;margin:0 auto;padding:0 24px}
.nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(8px);background:rgba(255,255,255,.8);border-bottom:1px solid #e2e8f0}
.nav .row{display:flex;align-items:center;justify-content:space-between;padding:15px 0;gap:16px;flex-wrap:wrap}
.brand{font-size:20px;font-weight:800;text-decoration:none;background:linear-gradient(90deg,#2563eb,#7c3aed);-webkit-background-clip:text;background-clip:text;color:transparent}
.links{display:flex;gap:20px;flex-wrap:wrap}.links a{text-decoration:none;font-size:14px;font-weight:500;color:#475569}
.links a:hover{color:#2563eb}.links a.active{color:#2563eb;font-weight:700}
.cta{border:0;border-radius:10px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;padding:9px 18px;font-weight:600;font-size:14px;text-decoration:none;display:inline-block}
.hero{padding:88px 0}.hero h1{font-size:44px;line-height:1.1;font-weight:800;margin:0}
.hero p{margin:22px 0 0;max-width:640px;font-size:18px;color:#475569}.hero .btns{display:flex;gap:14px;margin-top:30px;flex-wrap:wrap}
.ghost{border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#334155;padding:12px 26px;font-weight:600;text-decoration:none;display:inline-block}
.big{border:0;border-radius:12px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;padding:13px 28px;font-weight:600;text-decoration:none;display:inline-block}
.sec{padding:64px 0}.sec h2{font-size:30px;font-weight:700;margin:0}.sec .sub{margin:10px 0 0;color:#475569}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:36px}
.card{border:1px solid #e2e8f0;border-radius:16px;padding:24px;background:#fff}
.card .ic{height:40px;width:40px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#7c3aed)}
.card h3{margin:16px 0 6px;font-size:18px;font-weight:600}.card p{margin:0;font-size:14px;color:#475569}
.foot{border-top:1px solid #e2e8f0;padding:40px 0;color:#64748b;font-size:14px;text-align:center}
@media(prefers-color-scheme:dark){body{background:#0b1120;color:#e2e8f0}.nav{background:rgba(11,17,32,.8);border-color:#1e293b}.card,.nav{border-color:#1e293b}.card{background:#0f172a}.ghost{background:#0f172a;border-color:#334155;color:#cbd5e1}.foot{border-color:#1e293b}.links a{color:#94a3b8}}`;

function navBar(content, currentHref) {
    const routes = content.routes || [];
    const links = routes.map((r) => {
        const cls = r.href === currentHref ? 'active' : '';
        return `<a class="${cls}" href="${hrefToFile(r.href)}">${esc(r.label)}</a>`;
    }).join('');
    const cta = content.hero?.cta1 ? `<a class="cta" href="${hrefToFile((routes.find((r) => r.href !== '/') || {}).href)}">${esc(content.hero.cta1)}</a>` : '';
    return `<header class="nav"><div class="wrap row"><a class="brand" href="index.html">${esc(content.brand)}</a><nav class="links">${links}</nav>${cta}</div></header>`;
}
function heroBlock(content) {
    const h = content.hero || {};
    const routes = content.routes || [];
    const first = (routes.find((r) => r.href !== '/') || {}).href;
    return `<section class="hero"><div class="wrap">
    <h1>${esc(h.title)}</h1>
    ${h.subtitle ? `<p>${esc(h.subtitle)}</p>` : ''}
    <div class="btns">
      ${h.cta1 ? `<a class="big" href="${hrefToFile(first)}">${esc(h.cta1)}</a>` : ''}
      ${h.cta2 ? `<a class="ghost" href="${hrefToFile(first)}">${esc(h.cta2)}</a>` : ''}
    </div></div></section>`;
}
function sectionBlock(sec) {
    if (!sec) return '';
    const items = (sec.items || []).map((it) => `<div class="card"><div class="ic"></div><h3>${esc(it.title)}</h3><p>${esc(it.desc)}</p></div>`).join('');
    return `<section class="sec"><div class="wrap"><h2>${esc(sec.heading)}</h2>${sec.subheading ? `<p class="sub">${esc(sec.subheading)}</p>` : ''}<div class="grid">${items}</div></div></section>`;
}
function footBlock(content) {
    const f = content.footer || {};
    return `<footer class="foot"><div class="wrap">© ${new Date().getFullYear()} ${esc(content.brand)}. ${esc(f.rights || '')}</div></footer>`;
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

    const nav = (href) => navBar(content, href);
    const foot = footBlock(content);
    const pages = [];
    for (const r of routes) {
        let main;
        if (r.href === '/') {
            main = heroBlock(content);                        // الرئيسية = بطل
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

/** يبني الموقع الثابت من مصفوفة ملفات المشروع (يجد lib/content.js) */
export function staticSiteFromFiles(files = [], lang = 'en') {
    const mod = files.find((f) => f.name === 'lib/content.js' || f.name === 'lib/content.jsx');
    return mod ? buildStaticSiteFromSource(mod.content, lang) : [];
}
