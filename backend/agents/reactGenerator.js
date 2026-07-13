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

function componentSource(name, lang) {
    const rtl = RTL_LANGS.has(lang);
    const align = rtl ? 'text-right' : 'text-left';
    if (name === 'Navbar') {
        return `export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Brand</span>
        <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#" className="hover:text-blue-600">Home</a>
          <a href="#" className="hover:text-blue-600">Features</a>
          <a href="#" className="hover:text-blue-600">Contact</a>
        </div>
        <button className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white">Get Started</button>
      </nav>
    </header>
  );
}
`;
    }
    if (name === 'Hero') {
        return `export default function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 ${align}">
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        Build something great
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
        A modern, fast, production-ready starting point — customized by JAOLA to your needs.
      </p>
      <div className="mt-8 flex gap-4">
        <button className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white">Start now</button>
        <button className="rounded-xl border border-slate-300 dark:border-slate-700 px-6 py-3 font-semibold text-slate-700 dark:text-slate-200">Learn more</button>
      </div>
    </section>
  );
}
`;
    }
    if (name === 'Footer') {
        return `export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} Brand. All rights reserved.</span>
        <div className="flex gap-6"><a href="#" className="hover:text-blue-600">Privacy</a><a href="#" className="hover:text-blue-600">Terms</a></div>
      </div>
    </footer>
  );
}
`;
    }
    // قسم عام: بطاقات شبكية
    const title = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    return `export default function ${name}() {
  const items = [1, 2, 3];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 ${align}">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">${title}</h2>
      <p className="mt-3 text-slate-600 dark:text-slate-300">Section content — customized by JAOLA.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600" />
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">Item {i}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Concise, useful description goes here.</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

/**
 * يولّد مشروع Next.js + Tailwind كاملاً.
 * @returns {{ files: {name,content}[] }}
 */
export function generateNextScaffold({ projectName = 'jaola-app', sections = [], features = [], lang = 'en', title } = {}) {
    const code = (lang || 'en').toLowerCase();
    const dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr';
    const safeName = (projectName || 'jaola-app').toString().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'jaola-app';
    const pageTitle = title || cap(safeName.replace(/-/g, ' '));

    // أقسام افتراضية إن لم تُمرَّر
    let secs = (sections && sections.length ? sections : ['navbar', 'hero', 'features', 'about', 'contact', 'footer']).slice(0, 12);
    // اسم مكوّن فريد لكل قسم
    const seen = new Set();
    const comps = secs.map((s, i) => {
        let n = compName(s, i);
        while (seen.has(n)) n = n + (i + 1);
        seen.add(n);
        return n;
    });

    const files = [];

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

    return { files, meta: { stack: 'react-next', components: comps, dir, lang: code } };
}
