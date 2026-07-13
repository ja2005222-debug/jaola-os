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
