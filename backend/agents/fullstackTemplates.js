/**
 * 🏗️ Full-Stack Templates — JAOLA OS
 *
 * قوالب Full-Stack (Next.js App Router + API Routes + Prisma) للفئات المتقدمة
 * التي تحتاج قاعدة بيانات ومنطق خادم حقيقي (متجر، حجوزات، عقارات، تعليم…).
 *
 * توليد *حتمي* بلا LLM — لكل فئة نماذج بيانات (Prisma models) تُشتق منها:
 * - prisma/schema.prisma + seed.js
 * - app/api/<resource>/route.js (GET قائمة + POST إنشاء) لكل مورد
 * - app/api/<resource>/[id]/route.js (GET/PUT/DELETE)
 * - صفحة رئيسية تجلب المورد الأساسي من الـ API
 * - هيكل Next.js كامل (package.json, layout, lib/prisma…)
 *
 * المخرجات: مصفوفة { name, content } جاهزة للكتابة على القرص — بنفس شكل
 * بقية الوكلاء المولّدة (backendAgent/databaseAgent).
 */

// ═══════════════════════════════════════════════════════
// 🧩 مواصفات الفئات المتقدمة (النماذج تقود توليد كل شيء)
// كل حقل: { name, type: Prisma scalar, attr?: سمات إضافية }
// كل نموذج يحصل تلقائياً على id + createdAt.
// ═══════════════════════════════════════════════════════
const CATEGORIES = {
    ecommerce: {
        labelAr: 'متجر إلكتروني',
        models: [
            {
                name: 'Product',
                fields: [
                    { name: 'name', type: 'String' },
                    { name: 'description', type: 'String' },
                    { name: 'price', type: 'Float' },
                    { name: 'image', type: 'String' },
                    { name: 'category', type: 'String' },
                    { name: 'stock', type: 'Int', attr: '@default(0)' },
                ],
                seed: [
                    { name: 'سماعات لاسلكية', description: 'صوت نقي وعزل ضوضاء', price: 299, image: 'https://picsum.photos/seed/p1/400', category: 'إلكترونيات', stock: 24 },
                    { name: 'ساعة ذكية', description: 'تتبّع اللياقة والإشعارات', price: 549, image: 'https://picsum.photos/seed/p2/400', category: 'إلكترونيات', stock: 12 },
                    { name: 'حقيبة جلدية', description: 'جلد طبيعي فاخر', price: 420, image: 'https://picsum.photos/seed/p3/400', category: 'إكسسوارات', stock: 8 },
                ],
            },
            {
                name: 'Order',
                fields: [
                    { name: 'customerName', type: 'String' },
                    { name: 'phone', type: 'String' },
                    { name: 'items', type: 'String', attr: "@default(\"[]\")" }, // JSON مُرمّز نصاً (SQLite لا يدعم Json)
                    { name: 'total', type: 'Float' },
                    { name: 'status', type: 'String', attr: "@default(\"pending\")" },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'products', model: 'Product', primary: true },
            { path: 'orders', model: 'Order' },
        ],
    },
    saas: {
        labelAr: 'منصة SaaS',
        models: [
            {
                name: 'Account',
                fields: [
                    { name: 'email', type: 'String', attr: '@unique' },
                    { name: 'name', type: 'String' },
                    { name: 'plan', type: 'String', attr: "@default(\"free\")" },
                ],
                seed: [
                    { email: 'demo@jaola.io', name: 'حساب تجريبي', plan: 'pro' },
                ],
            },
            {
                name: 'Subscription',
                fields: [
                    { name: 'plan', type: 'String' },
                    { name: 'status', type: 'String', attr: "@default(\"active\")" },
                    { name: 'renewsAt', type: 'DateTime' },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'accounts', model: 'Account', primary: true },
            { path: 'subscriptions', model: 'Subscription' },
        ],
    },
    booking: {
        labelAr: 'حجوزات ومواعيد',
        models: [
            {
                name: 'Service',
                fields: [
                    { name: 'name', type: 'String' },
                    { name: 'durationMin', type: 'Int', attr: '@default(30)' },
                    { name: 'price', type: 'Float' },
                ],
                seed: [
                    { name: 'استشارة', durationMin: 30, price: 120 },
                    { name: 'جلسة متكاملة', durationMin: 60, price: 220 },
                ],
            },
            {
                name: 'Appointment',
                fields: [
                    { name: 'customerName', type: 'String' },
                    { name: 'phone', type: 'String' },
                    { name: 'service', type: 'String' },
                    { name: 'date', type: 'String' },
                    { name: 'time', type: 'String' },
                    { name: 'status', type: 'String', attr: "@default(\"booked\")" },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'services', model: 'Service', primary: true },
            { path: 'appointments', model: 'Appointment' },
        ],
    },
    realestate: {
        labelAr: 'عقارات',
        models: [
            {
                name: 'Property',
                fields: [
                    { name: 'title', type: 'String' },
                    { name: 'type', type: 'String' },
                    { name: 'price', type: 'Float' },
                    { name: 'bedrooms', type: 'Int', attr: '@default(0)' },
                    { name: 'area', type: 'Int', attr: '@default(0)' },
                    { name: 'city', type: 'String' },
                    { name: 'image', type: 'String' },
                    { name: 'status', type: 'String', attr: "@default(\"available\")" },
                ],
                seed: [
                    { title: 'فيلا فاخرة', type: 'فيلا', price: 1850000, bedrooms: 5, area: 450, city: 'الرياض', image: 'https://picsum.photos/seed/re1/400', status: 'available' },
                    { title: 'شقة عصرية', type: 'شقة', price: 620000, bedrooms: 3, area: 160, city: 'جدة', image: 'https://picsum.photos/seed/re2/400', status: 'available' },
                ],
            },
            {
                name: 'Inquiry',
                fields: [
                    { name: 'propertyTitle', type: 'String' },
                    { name: 'name', type: 'String' },
                    { name: 'phone', type: 'String' },
                    { name: 'message', type: 'String' },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'properties', model: 'Property', primary: true },
            { path: 'inquiries', model: 'Inquiry' },
        ],
    },
    education: {
        labelAr: 'تعليم ودورات',
        models: [
            {
                name: 'Course',
                fields: [
                    { name: 'title', type: 'String' },
                    { name: 'instructor', type: 'String' },
                    { name: 'level', type: 'String', attr: "@default(\"beginner\")" },
                    { name: 'durationHours', type: 'Int', attr: '@default(1)' },
                    { name: 'price', type: 'Float' },
                    { name: 'image', type: 'String' },
                ],
                seed: [
                    { title: 'أساسيات البرمجة', instructor: 'أ. سارة', level: 'beginner', durationHours: 12, price: 199, image: 'https://picsum.photos/seed/c1/400' },
                    { title: 'تصميم واجهات', instructor: 'أ. خالد', level: 'intermediate', durationHours: 20, price: 349, image: 'https://picsum.photos/seed/c2/400' },
                ],
            },
            {
                name: 'Enrollment',
                fields: [
                    { name: 'courseTitle', type: 'String' },
                    { name: 'studentName', type: 'String' },
                    { name: 'email', type: 'String' },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'courses', model: 'Course', primary: true },
            { path: 'enrollments', model: 'Enrollment' },
        ],
    },
    medical: {
        labelAr: 'طبي وعيادات',
        models: [
            {
                name: 'Doctor',
                fields: [
                    { name: 'name', type: 'String' },
                    { name: 'specialty', type: 'String' },
                    { name: 'image', type: 'String' },
                ],
                seed: [
                    { name: 'د. أحمد', specialty: 'قلب', image: 'https://picsum.photos/seed/d1/400' },
                    { name: 'د. ليلى', specialty: 'جلدية', image: 'https://picsum.photos/seed/d2/400' },
                ],
            },
            {
                name: 'Appointment',
                fields: [
                    { name: 'doctorName', type: 'String' },
                    { name: 'patientName', type: 'String' },
                    { name: 'phone', type: 'String' },
                    { name: 'date', type: 'String' },
                    { name: 'time', type: 'String' },
                    { name: 'status', type: 'String', attr: "@default(\"booked\")" },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'doctors', model: 'Doctor', primary: true },
            { path: 'appointments', model: 'Appointment' },
        ],
    },
    restaurant: {
        labelAr: 'مطعم وطلبات',
        models: [
            {
                name: 'MenuItem',
                fields: [
                    { name: 'name', type: 'String' },
                    { name: 'description', type: 'String' },
                    { name: 'price', type: 'Float' },
                    { name: 'category', type: 'String' },
                    { name: 'image', type: 'String' },
                ],
                seed: [
                    { name: 'برجر لحم', description: 'لحم طازج مع جبن', price: 35, category: 'رئيسي', image: 'https://picsum.photos/seed/m1/400' },
                    { name: 'سلطة سيزر', description: 'خس وصلصة خاصة', price: 22, category: 'مقبلات', image: 'https://picsum.photos/seed/m2/400' },
                ],
            },
            {
                name: 'Order',
                fields: [
                    { name: 'tableNo', type: 'Int', attr: '@default(0)' },
                    { name: 'items', type: 'String', attr: "@default(\"[]\")" }, // JSON مُرمّز نصاً (SQLite لا يدعم Json)
                    { name: 'total', type: 'Float' },
                    { name: 'status', type: 'String', attr: "@default(\"new\")" },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'menu', model: 'MenuItem', primary: true },
            { path: 'orders', model: 'Order' },
        ],
    },
    blog: {
        labelAr: 'مدونة / أخبار (CMS)',
        models: [
            {
                name: 'Post',
                fields: [
                    { name: 'title', type: 'String' },
                    { name: 'slug', type: 'String', attr: '@unique' },
                    { name: 'body', type: 'String' },
                    { name: 'author', type: 'String' },
                    { name: 'coverImage', type: 'String' },
                    { name: 'tags', type: 'String', attr: "@default(\"\")" },
                    { name: 'published', type: 'Boolean', attr: '@default(true)' },
                ],
                seed: [
                    { title: 'مرحباً بالعالم', slug: 'hello-world', body: 'أول مقال في المدونة.', author: 'المحرر', coverImage: 'https://picsum.photos/seed/b1/600', tags: 'عام', published: true },
                    { title: 'دليل البداية', slug: 'getting-started', body: 'كيف تبدأ الكتابة هنا.', author: 'المحرر', coverImage: 'https://picsum.photos/seed/b2/600', tags: 'دليل', published: true },
                ],
            },
            {
                name: 'Comment',
                fields: [
                    { name: 'postSlug', type: 'String' },
                    { name: 'name', type: 'String' },
                    { name: 'body', type: 'String' },
                ],
                seed: [],
            },
        ],
        resources: [
            { path: 'posts', model: 'Post', primary: true },
            { path: 'comments', model: 'Comment' },
        ],
    },
};

// تعيينات مرادفة → فئة full-stack (أنواع القوالب الموسّعة تُوجَّه لأقرب مخطط)
const ALIASES = {
    ecommerce: 'ecommerce', shop: 'ecommerce', store: 'ecommerce',
    saas: 'saas', startup: 'saas', dashboard: 'saas',
    booking: 'booking', hotel: 'booking', travel: 'booking', beauty: 'booking',
    realestate: 'realestate', property: 'realestate',
    education: 'education', course: 'education',
    medical: 'medical', clinic: 'medical',
    restaurant: 'restaurant', cafe: 'restaurant',
    blog: 'blog', news: 'blog', magazine: 'blog',
};

// ═══════════════════════════════════════════════════════
// 🔤 أدوات
// ═══════════════════════════════════════════════════════
const camel = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** الفئات المتقدمة المدعومة كـ Full-Stack */
export function getFullStackCategories() {
    return Object.keys(CATEGORIES);
}

/** هل الفئة (أو مرادفها) لها قالب Full-Stack؟ */
export function isFullStackCategory(type) {
    if (!type) return false;
    const key = ALIASES[type] || type;
    return !!CATEGORIES[key];
}

/** يُرجع مفتاح الفئة الأساسي لأي نوع/مرادف، أو null */
export function resolveFullStackCategory(type) {
    if (!type) return null;
    return CATEGORIES[type] ? type : (ALIASES[type] || null);
}

/**
 * قرار هل يُبنى المشروع Full-Stack:
 * فئة متقدمة مدعومة + طلب فيه إشارة لبيانات/خادم حقيقي (أو kind تفاعلي).
 */
export function recommendFullStack(goal = '', category = null, blueprintKind = null) {
    const cat = resolveFullStackCategory(category);
    if (!cat) return { fullstack: false };

    const g = (goal || '').toLowerCase();
    const dataHints = /nextjs|next\.js|next js|فل ستاك|full.?stack|قاعدة بيانات|database|لوحة تحكم|dashboard|api|خادم|backend|تسجيل دخول|مصادقة|auth|حجز|طلبات|orders|تخزين|persist|prisma/;
    const interactive = blueprintKind === 'webapp' || blueprintKind === 'tool';

    const fullstack = dataHints.test(g) || interactive;
    return { fullstack, category: cat, reason: dataHints.test(g) ? 'data-intent' : (interactive ? 'interactive-kind' : null) };
}

// ═══════════════════════════════════════════════════════
// 🧱 مولّدات الملفات (حتمية)
// ═══════════════════════════════════════════════════════
function renderPrismaModel(model) {
    const lines = [`model ${model.name} {`];
    lines.push(`  id        Int      @id @default(autoincrement())`);
    for (const f of model.fields) {
        lines.push(`  ${f.name.padEnd(9)} ${f.type}${f.attr ? '   ' + f.attr : ''}`);
    }
    lines.push(`  createdAt DateTime @default(now())`);
    lines.push('}');
    return lines.join('\n');
}

function renderSchema(spec) {
    return `// Prisma schema — ${spec.labelAr}
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

${spec.models.map(renderPrismaModel).join('\n\n')}
`;
}

function renderSeed(spec) {
    const blocks = spec.models
        .filter(m => (m.seed || []).length)
        .map(m => {
            const rows = m.seed.map(r => `    ${JSON.stringify(r)}`).join(',\n');
            return `  await prisma.${camel(m.name)}.createMany({ data: [\n${rows}\n  ] });`;
        })
        .join('\n');

    return `// بيانات أولية — شغّلها بـ: node prisma/seed.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
${blocks || '  // لا بيانات أولية'}
  console.log('✅ Seed complete');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
`;
}

function renderListRoute(resource) {
    const accessor = camel(resource.model);
    return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/${resource.path} — قائمة
export async function GET() {
  const items = await prisma.${accessor}.findMany({ orderBy: { id: 'desc' } });
  return NextResponse.json(items);
}

// POST /api/${resource.path} — إنشاء
export async function POST(request) {
  const data = await request.json();
  const created = await prisma.${accessor}.create({ data });
  return NextResponse.json(created, { status: 201 });
}
`;
}

function renderItemRoute(resource) {
    const accessor = camel(resource.model);
    return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/${resource.path}/[id]
export async function GET(_request, { params }) {
  const item = await prisma.${accessor}.findUnique({ where: { id: Number(params.id) } });
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

// PUT /api/${resource.path}/[id]
export async function PUT(request, { params }) {
  const data = await request.json();
  const updated = await prisma.${accessor}.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json(updated);
}

// DELETE /api/${resource.path}/[id]
export async function DELETE(_request, { params }) {
  await prisma.${accessor}.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ deleted: true });
}
`;
}

function renderHomePage(spec, projectName) {
    const primary = spec.resources.find(r => r.primary) || spec.resources[0];
    const model = spec.models.find(m => m.name === primary.model);
    const titleField = model.fields.find(f => ['name', 'title'].includes(f.name))?.name || 'id';
    return `import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const items = await prisma.${camel(primary.model)}.findMany({ orderBy: { id: 'desc' } });
  return (
    <main className="container">
      <h1>${projectName}</h1>
      <p className="subtitle">${spec.labelAr} — Next.js + API + Prisma</p>
      <div className="grid">
        {items.map((item) => (
          <article key={item.id} className="card">
            <h3>{item.${titleField}}</h3>
            <pre>{JSON.stringify(item, null, 2)}</pre>
          </article>
        ))}
      </div>
    </main>
  );
}
`;
}

function renderLayout(projectName) {
    return `import './globals.css';

export const metadata = { title: '${projectName}', description: 'مبني بواسطة JAOLA OS' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
`;
}

const GLOBALS_CSS = `:root { --primary: #4f46e5; --bg: #0f1120; --card: #1a1d33; --text: #f5f5ff; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, 'Segoe UI', Tahoma, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
.container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
h1 { font-size: 2rem; margin-bottom: .25rem; }
.subtitle { color: #9aa0c0; margin-bottom: 2rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.card { background: var(--card); border: 1px solid #2a2e4a; border-radius: 12px; padding: 1rem; }
.card h3 { color: var(--primary); margin-bottom: .5rem; }
.card pre { font-size: .75rem; color: #aeb4d8; overflow-x: auto; white-space: pre-wrap; }
`;

const PRISMA_LIB = `import { PrismaClient } from '@prisma/client';

// نسخة مفردة تنجو من إعادة التحميل الساخن في التطوير
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`;

function renderPackageJson(projectName, spec) {
    return JSON.stringify({
        name: (projectName || 'jaola-fullstack').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'jaola-app',
        version: '0.1.0',
        private: true,
        scripts: {
            dev: 'next dev',
            build: 'prisma generate && next build',
            start: 'next start',
            'db:push': 'prisma db push',
            'db:seed': 'node prisma/seed.js',
        },
        dependencies: {
            next: '^14.2.5',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            '@prisma/client': '^5.18.0',
        },
        devDependencies: {
            prisma: '^5.18.0',
        },
    }, null, 2) + '\n';
}

function renderReadme(projectName, spec) {
    const routes = spec.resources.map(r => `- \`GET/POST /api/${r.path}\` · \`GET/PUT/DELETE /api/${r.path}/[id]\``).join('\n');
    return `# ${projectName}

تطبيق **Full-Stack** (${spec.labelAr}) مبني بـ Next.js (App Router) + API Routes + Prisma.

## التشغيل
\`\`\`bash
npm install
cp .env.example .env      # عدّل DATABASE_URL إن لزم
npx prisma db push        # إنشاء قاعدة البيانات
npm run db:seed           # بيانات أولية
npm run dev               # http://localhost:3000
\`\`\`

## نقاط الـ API
${routes}

## البنية
- \`prisma/schema.prisma\` — نماذج البيانات
- \`app/api/*/route.js\` — نقاط الـ API
- \`app/page.js\` — الصفحة الرئيسية
- \`lib/prisma.js\` — عميل Prisma

مُولّد بواسطة JAOLA OS.
`;
}

// ═══════════════════════════════════════════════════════
// 🚀 التوليد الكامل
// ═══════════════════════════════════════════════════════
/**
 * يبني مشروع Full-Stack كامل لفئة متقدمة.
 * @returns {{ category, files: Array<{name, content}> }}
 */
export function buildFullStackProject(category, projectName = 'JAOLA App') {
    const cat = resolveFullStackCategory(category);
    if (!cat) throw new Error(`لا يوجد قالب Full-Stack للفئة: ${category}`);
    const spec = CATEGORIES[cat];

    const files = [
        { name: 'package.json', content: renderPackageJson(projectName, spec) },
        { name: 'next.config.mjs', content: `/** @type {import('next').NextConfig} */\nconst nextConfig = { reactStrictMode: true };\nexport default nextConfig;\n` },
        { name: 'jsconfig.json', content: JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }, null, 2) + '\n' },
        { name: '.gitignore', content: 'node_modules\n.next\n.env\n*.db\n*.db-journal\n' },
        { name: '.env.example', content: 'DATABASE_URL="file:./dev.db"\n' },
        { name: 'README.md', content: renderReadme(projectName, spec) },
        { name: 'lib/prisma.js', content: PRISMA_LIB },
        { name: 'app/globals.css', content: GLOBALS_CSS },
        { name: 'app/layout.js', content: renderLayout(projectName) },
        { name: 'app/page.js', content: renderHomePage(spec, projectName) },
        { name: 'prisma/schema.prisma', content: renderSchema(spec) },
        { name: 'prisma/seed.js', content: renderSeed(spec) },
    ];

    for (const r of spec.resources) {
        files.push({ name: `app/api/${r.path}/route.js`, content: renderListRoute(r) });
        files.push({ name: `app/api/${r.path}/[id]/route.js`, content: renderItemRoute(r) });
    }

    return { category: cat, files };
}

/** فقرة سياق تُحقن في المولّد لتعريفه بمخطط الـ Full-Stack */
export function buildFullStackContext(category) {
    const cat = resolveFullStackCategory(category);
    if (!cat) return '';
    const spec = CATEGORIES[cat];
    const models = spec.models.map(m => `${m.name}(${m.fields.map(f => f.name).join(', ')})`).join(' · ');
    const routes = spec.resources.map(r => `/api/${r.path}`).join(' · ');
    return `\n## 🏗️ مخطط Full-Stack (${spec.labelAr}) — Next.js + Prisma:
- النماذج: ${models}
- نقاط الـ API: ${routes}
- استخدم Prisma للوصول للبيانات، وApp Router (app/*)، وnext/server للـ Responses.\n`;
}
