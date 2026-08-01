// 🔍 حزمة SEO الحتمية: اشتقاق الوصف، حقن الوسوم idempotent، robots/sitemap
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveDescription, injectSeoTags, buildRobotsTxt, buildSitemapXml, applySeoPack } from '../agents/seoPack.js';

const PAGE = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>مطعم الريف</title></head>
<body><h1>أهلاً بكم</h1><p>قصير</p><p>مطعم الريف يقدّم أشهى المأكولات الشامية الطازجة يومياً مع توصيل سريع لكل أحياء المدينة.</p></body></html>`;

test('deriveDescription: يتجاوز الفقرات القصيرة ويأخذ أول فقرة ذات معنى ويسقفها 160', () => {
    const d = deriveDescription(PAGE);
    assert.match(d, /^مطعم الريف يقدّم/);
    assert.ok(d.length <= 160);
    const long = deriveDescription(`<p>${'كلمة '.repeat(100)}</p>`);
    assert.equal(long.length, 160);
});

test('injectSeoTags: يحقن description/OG/twitter/JSON-LD مرة واحدة فقط (idempotent)', () => {
    const once = injectSeoTags(PAGE, { siteName: 'alreef', pageUrl: 'https://x.com/' });
    assert.match(once, /<meta name="description"/);
    assert.match(once, /og:title/);
    assert.match(once, /og:locale" content="ar_AR"/);
    assert.match(once, /twitter:card/);
    assert.match(once, /application\/ld\+json/);
    assert.equal(injectSeoTags(once, { siteName: 'alreef' }), once, 'لا حقن مكرّر');
});

test('injectSeoTags: لا يلمس وصفاً وضعه صاحب الموقع بنفسه', () => {
    const withDesc = PAGE.replace('</head>', '<meta name="description" content="وصفي الخاص"></head>');
    const out = injectSeoTags(withDesc, {});
    assert.equal((out.match(/name="description"/g) || []).length, 1, 'وصف واحد فقط — وصف المالك');
    assert.match(out, /وصفي الخاص/);
});

test('robots/sitemap: robots دائماً، وSitemap فقط عند معرفة الرابط', () => {
    assert.match(buildRobotsTxt(''), /Allow: \//);
    assert.doesNotMatch(buildRobotsTxt(''), /Sitemap:/);
    assert.match(buildRobotsTxt('https://site.com/'), /Sitemap: https:\/\/site\.com\/sitemap\.xml/);
    const sm = buildSitemapXml('https://site.com', ['index.html', 'about.html']);
    assert.match(sm, /<loc>https:\/\/site\.com\/<\/loc>/);
    assert.match(sm, /<loc>https:\/\/site\.com\/about\.html<\/loc>/);
    assert.equal(buildSitemapXml('', ['index.html']), '', 'بلا رابط → لا sitemap');
});

test('applySeoPack: يعالج كل صفحات الجذر عدا dashboard.html، ولا يستبدل robots المالك', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'));
    fs.writeFileSync(path.join(dir, 'index.html'), PAGE);
    fs.writeFileSync(path.join(dir, 'about.html'), PAGE);
    fs.writeFileSync(path.join(dir, 'dashboard.html'), PAGE);
    const r = applySeoPack(dir, { siteName: 'alreef', siteUrl: 'https://alreef.vercel.app' });
    assert.deepEqual(r.injected.sort(), ['about.html', 'index.html'], 'اللوحة الداخلية مستثناة');
    assert.ok(fs.existsSync(path.join(dir, 'robots.txt')));
    assert.match(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8'), /about\.html/);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'dashboard.html'), 'utf8'), /data-jaola-seo/);
    // إعادة تطبيق (نشر ثانٍ) لا تكرّر شيئاً
    const r2 = applySeoPack(dir, { siteName: 'alreef', siteUrl: 'https://alreef.vercel.app' });
    assert.deepEqual(r2.injected, []);
    // robots موجود مسبقاً من المالك → لا يُستبدل
    fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /secret\n');
    applySeoPack(dir, {});
    assert.match(fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8'), /secret/);
    fs.rmSync(dir, { recursive: true, force: true });
});
