/**
 * ⚛️ React/Next Generator — مسار المشاريع الكبيرة (المسار الهجين)
 *
 * يولّد سكافولد Next.js (App Router) + Tailwind كاملاً وصالحاً للتشغيل، **حتمياً**
 * (لا يعتمد على LLM للهيكل) — فيُختبَر بدقّة. المحتوى النصّي placeholder واقعي
 * يخصّصه الذكاء لاحقاً. هذا يفتح مكتبات React (shadcn/Flowbite...) لأن الأساس React.
 */

const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);
const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
// اسم مكوّن صالح من اسم قسم (عربي/إنجليزي) → PascalCase لاتيني آمن
const compName = (section, i) => {
    const map = {
        navbar: 'Navbar', hero: 'Hero', services: 'Services', features: 'Features',
        about: 'About', contact: 'Contact', footer: 'Footer', pricing: 'Pricing',
        menu: 'Menu', gallery: 'Gallery', products: 'Products', reservation: 'Reservation',
        works: 'Works', testimonials: 'Testimonials', faq: 'Faq', cta: 'Cta',
        overview: 'Overview', analytics: 'Analytics', tables: 'DataTable', settings: 'Settings',
        storefront: 'Storefront', product: 'Product', cart: 'Cart', checkout: 'Checkout', search: 'Search',
        landing: 'Landing', auth: 'Auth', dashboard: 'Dashboard', account: 'Account', sidebar: 'Sidebar',
    };
    const key = (section || '').toString().trim().toLowerCase();
    if (map[key]) return map[key];
    const latin = key.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(cap).join('');
    return latin && /^[A-Za-z]/.test(latin) ? latin : `Section${i + 1}`;
};

// المكوّنات تقرأ محتواها من lib/content.js (يملؤه الذكاء) — فالهيكل حتمي والمحتوى مخصّص
function componentSource(name, lang) {
    const rtl = RTL_LANGS.has(lang);
    const align = rtl ? 'text-right' : 'text-left';
    const head = `import { content } from '../lib/content';\n\n`;
    if (name === 'Navbar') {
        return `${head}export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">{content.brand}</span>
        <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          {(content.nav || []).map((n) => (<a key={n} href="#" className="hover:text-blue-600">{n}</a>))}
        </div>
        <button className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white">{content.hero?.cta1 || 'Start'}</button>
      </nav>
    </header>
  );
}
`;
    }
    if (name === 'Hero') {
        return `${head}export default function Hero() {
  const h = content.hero || {};
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 ${align}">
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">{h.title}</h1>
      <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">{h.subtitle}</p>
      <div className="mt-8 flex gap-4">
        <button className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white">{h.cta1}</button>
        {h.cta2 ? <button className="rounded-xl border border-slate-300 dark:border-slate-700 px-6 py-3 font-semibold text-slate-700 dark:text-slate-200">{h.cta2}</button> : null}
      </div>
    </section>
  );
}
`;
    }
    if (name === 'Footer') {
        return `${head}export default function Footer() {
  const f = content.footer || {};
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} {content.brand}. {f.rights}</span>
        <div className="flex gap-6">{(f.links || []).map((l) => (<a key={l} href="#" className="hover:text-blue-600">{l}</a>))}</div>
      </div>
    </footer>
  );
}
`;
    }
    // قسم عام: عنوان + وصف + بطاقات من content.sections[name]
    return `${head}export default function ${name}() {
  const s = (content.sections && content.sections['${name}']) || {};
  const items = s.items || [];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 ${align}">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{s.heading}</h2>
      {s.subheading ? <p className="mt-3 text-slate-600 dark:text-slate-300">{s.subheading}</p> : null}
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600" />
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{it.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

// محتوى افتراضي (يُستبدل بمحتوى الذكاء) — بلغة المستخدم
// labels: خريطة اسم المكوّن → التسمية الأصلية للقسم (عربي/إنجليزي) لعنوان ذي معنى
function defaultContent(pageTitle, comps, lang, labels = {}) {
    const ar = lang === 'ar';
    const generic = comps.filter((c) => !['Navbar', 'Hero', 'Footer'].includes(c));
    const sections = {};
    for (const c of generic) {
        const label = labels[c] || c.replace(/([a-z])([A-Z])/g, '$1 $2');
        sections[c] = {
            heading: label,
            subheading: ar ? 'محتوى هذا القسم — يخصّصه الذكاء حسب مشروعك.' : 'Section content — customized to your project.',
            items: [1, 2, 3].map((i) => ({
                title: ar ? `عنصر ${i}` : `Item ${i}`,
                desc: ar ? 'وصف موجز ومفيد.' : 'Concise, useful description.',
            })),
        };
    }
    return {
        brand: pageTitle,
        nav: ar ? ['الرئيسية', 'المزايا', 'تواصل'] : ['Home', 'Features', 'Contact'],
        hero: {
            title: ar ? 'ابنِ شيئاً رائعاً' : 'Build something great',
            subtitle: ar ? 'انطلاقة عصرية وسريعة وجاهزة للإنتاج — يخصّصها JAOLA لاحتياجك.' : 'A modern, fast, production-ready start — customized by JAOLA.',
            cta1: ar ? 'ابدأ الآن' : 'Start now',
            cta2: ar ? 'اعرف أكثر' : 'Learn more',
        },
        sections,
        footer: { rights: ar ? 'كل الحقوق محفوظة.' : 'All rights reserved.', links: ar ? ['الخصوصية', 'الشروط'] : ['Privacy', 'Terms'] },
    };
}

/** يدمج محتوى الذكاء فوق الافتراضي (يضمن اكتمال الحقول → لا أعطال) */
function mergeContent(base, model) {
    if (!model || typeof model !== 'object') return base;
    return {
        brand: model.brand || base.brand,
        nav: Array.isArray(model.nav) && model.nav.length ? model.nav : base.nav,
        hero: { ...base.hero, ...(model.hero || {}) },
        sections: (() => {
            const out = { ...base.sections };
            for (const k of Object.keys(base.sections)) {
                const m = model.sections?.[k];
                if (m) out[k] = { heading: m.heading || base.sections[k].heading, subheading: m.subheading ?? base.sections[k].subheading, items: Array.isArray(m.items) && m.items.length ? m.items : base.sections[k].items };
            }
            return out;
        })(),
        footer: { ...base.footer, ...(model.footer || {}) },
    };
}

/**
 * يولّد مشروع Next.js + Tailwind كاملاً.
 * @returns {{ files: {name,content}[] }}
 */
export function generateNextScaffold({ projectName = 'jaola-app', sections = [], features = [], lang = 'en', title, content } = {}) {
    const code = (lang || 'en').toLowerCase();
    const dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr';
    const safeName = (projectName || 'jaola-app').toString().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'jaola-app';
    const pageTitle = title || cap(safeName.replace(/-/g, ' '));

    // أقسام افتراضية إن لم تُمرَّر
    let secs = (sections && sections.length ? sections : ['navbar', 'hero', 'features', 'about', 'contact', 'footer']).slice(0, 12);
    // اسم مكوّن فريد لكل قسم + احتفظ بالتسمية الأصلية (لعنوان ذي معنى)
    const seen = new Set();
    const labels = {};
    const comps = secs.map((s, i) => {
        let n = compName(s, i);
        while (seen.has(n)) n = n + (i + 1);
        seen.add(n);
        const orig = (s || '').toString().trim();
        if (orig) labels[n] = orig.charAt(0).toUpperCase() + orig.slice(1);
        return n;
    });

    // 🧠 المحتوى: افتراضي مدموج فوقه نموذج الذكاء (إن وُجد) — يضمن اكتمال الحقول
    const finalContent = mergeContent(defaultContent(pageTitle, comps, code, labels), content);

    const files = [];
    files.push({ name: 'lib/content.js', content: `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(finalContent, null, 2)};\n` });

    files.push({ name: 'package.json', content: JSON.stringify({
        name: safeName, version: '0.1.0', private: true,
        scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
        dependencies: { next: '14.2.5', react: '18.3.1', 'react-dom': '18.3.1' },
        devDependencies: { autoprefixer: '10.4.19', postcss: '8.4.39', tailwindcss: '3.4.7' },
    }, null, 2) + '\n' });

    files.push({ name: 'next.config.mjs', content: `/** @type {import('next').NextConfig} */\nconst nextConfig = { reactStrictMode: true };\nexport default nextConfig;\n` });
    files.push({ name: 'postcss.config.mjs', content: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n` });
    files.push({ name: 'tailwind.config.js', content: `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  darkMode: 'class',\n  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],\n  theme: { extend: {} },\n  plugins: [],\n};\n` });

    files.push({ name: 'app/globals.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nhtml, body { padding: 0; margin: 0; }\nbody { @apply bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100; }\n` });

    files.push({ name: 'app/layout.jsx', content: `import './globals.css';

export const metadata = {
  title: ${JSON.stringify(pageTitle)},
  description: 'Generated by JAOLA — React/Next + Tailwind starter',
};

export default function RootLayout({ children }) {
  return (
    <html lang="${code}" dir="${dir}">
      <body>{children}</body>
    </html>
  );
}
` });

    const imports = comps.map((c) => `import ${c} from '../components/${c}';`).join('\n');
    const usage = comps.map((c) => `      <${c} />`).join('\n');
    files.push({ name: 'app/page.jsx', content: `${imports}

export default function Page() {
  return (
    <main>
${usage}
    </main>
  );
}
` });

    comps.forEach((c, i) => {
        files.push({ name: `components/${c}.jsx`, content: componentSource(c, code) });
    });

    files.push({ name: 'README.md', content: `# ${pageTitle}

مشروع **Next.js (App Router) + Tailwind** ولّده JAOLA.

## التشغيل
\`\`\`bash
npm install
npm run dev      # http://localhost:3000
\`\`\`

## البناء والنشر
\`\`\`bash
npm run build && npm start
\`\`\`
جاهز للنشر على Vercel مباشرة. الأقسام: ${secs.join('، ')}.
` });

    files.push({ name: '.gitignore', content: `node_modules\n.next\n.env\n` });

    return { files, meta: { stack: 'react-next', components: comps, dir, lang: code, content: finalContent } };
}

/**
 * 🧠 نموذج المحتوى بالذكاء — يملأ هيكل React بمحتوى المشروع الفعلي بلغة المستخدم.
 * يُرجع كائن content (أو null عند الفشل → يُستخدم الافتراضي). @param llm async(messages,opts)=>text
 */
export async function generateContentModel(goal, { sections = [], lang = 'en', llm } = {}) {
    if (typeof llm !== 'function') return null;
    const comps = sections.map((s, i) => compName(s, i));
    const generic = comps.filter((c) => !['Navbar', 'Hero', 'Footer'].includes(c));
    const sys = `أنت كاتب محتوى ويب محترف. أعِد **JSON فقط** يملأ محتوى موقع بلغة: ${lang}.
اكتب محتوى واقعياً ومقنعاً لمشروع المستخدم (لا نصوصاً عامة). الشكل:
{
  "brand": "اسم العلامة",
  "nav": ["رابط","رابط","رابط"],
  "hero": { "title": "...", "subtitle": "...", "cta1": "...", "cta2": "..." },
  "sections": { ${generic.map((c) => `"${c}": { "heading": "...", "subheading": "...", "items": [ { "title": "...", "desc": "..." } ] }`).join(', ')} },
  "footer": { "rights": "...", "links": ["...","..."] }
}`;
    try {
        const raw = await llm(
            [{ role: 'system', content: sys }, { role: 'user', content: `المشروع: ${goal}` }],
            { max_tokens: 1200, temperature: 0.5, json: true }
        );
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
}
