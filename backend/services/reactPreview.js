/**
 * 👁️ React Live Preview — معاينة حيّة لمشاريع React/Next داخل الـ iframe
 *
 * مشاريع Next لا تُصيَّر في المعاينة الثابتة بلا build. هذا يُنتج صفحة index.html
 * **مكتفية ذاتياً** تصيّر مكوّنات المشروع فعلياً في متصفّح المستخدم:
 *   React UMD + Babel Standalone (يترجم JSX في المتصفّح) + Tailwind Play CDN.
 * فتظهر التعديلات حيّة فوراً — والنشر يبقى للمشروع الحقيقي (Next → Vercel).
 *
 * ملاحظة: للمعاينة/التطوير فقط (CDN)؛ الإنتاج يستخدم مشروع Next المبني.
 */

const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);

// يزيل import/export ليصبح الكود قابلاً للّصق في سكربت Babel واحد
function stripModuleSyntax(src) {
    return (src || '')
        .replace(/^\s*import\s.*?;?\s*$/gm, '')          // احذف كل سطور import
        .replace(/export\s+default\s+function/g, 'function')
        .replace(/export\s+default\s+/g, 'const __default__ = ')
        .replace(/^\s*export\s+/gm, '');                  // export const/function → عام
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

    // اجمع المكوّنات ثم الصفحة (الصفحة تعتمد عليها)
    const comps = files.filter(f => /^components\/.+\.jsx$/.test(f.name));
    const page = files.find(f => f.name === 'app/page.jsx' || f.name === 'app/page.js');

    const parts = [];
    for (const c of comps) parts.push(stripModuleSyntax(c.content));
    if (page) parts.push(stripModuleSyntax(page.content));
    // نقطة التصيير
    parts.push(`const __root = ReactDOM.createRoot(document.getElementById('root'));\n__root.render(React.createElement(${root}));`);

    const script = parts.join('\n\n');
    const title = opts.title || 'Preview';

    return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
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
