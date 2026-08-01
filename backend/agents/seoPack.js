/**
 * 🔍 حزمة SEO الحتمية — تُطبَّق عند النشر (نفس نمط installSiteConnect):
 *  - <meta name="description"> مشتقّ من أول فقرة ذات معنى (لا LLM، لا تكلفة).
 *  - وسوم Open Graph + Twitter Card (تحسين المشاركة على السوشيال).
 *  - JSON-LD (WebSite) لبطاقة معرفة أدقّ في محركات البحث.
 *  - robots.txt دائماً، وsitemap.xml عند معرفة رابط الموقع النهائي.
 *
 * الفجوة التنافسية: منافسات مثل Durable تسوّق «SEO تلقائي مع كل نشر» —
 * هذه الطبقة تُغلقها حتمياً بلا أي نداء ذكاء. idempotent عبر data-jaola-seo،
 * ولا تلمس أي وسم موجود مسبقاً (وسوم صاحب الموقع تعلو دائماً).
 */

import fs from 'fs';
import path from 'path';

const SKIP_HTML = new Set(['dashboard.html']); // لوحة CMS الداخلية — ليست صفحة زوّار

// نصّ خام من أول فقرات الصفحة — لوصف meta (بلا وسوم، مسقوف 160 حرفاً)
export function deriveDescription(html = '') {
    const matches = [...String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
    for (const m of matches) {
        const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length >= 30) return text.slice(0, 160);
    }
    // احتياط: نصّ الهيرو h1/h2
    const h = String(html).match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i);
    if (h) {
        const text = h[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text) return text.slice(0, 160);
    }
    return '';
}

function titleOf(html = '', fallback = '') {
    const m = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const t = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    return t || fallback;
}

const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** يحقن وسوم SEO في صفحة واحدة (idempotent — لا يكرّر ولا يلمس الموجود). */
export function injectSeoTags(html = '', { siteName = '', pageUrl = '' } = {}) {
    let out = String(html);
    if (!/<\/head>/i.test(out) || out.includes('data-jaola-seo')) return out;

    const title = titleOf(out, siteName);
    const desc = deriveDescription(out);
    const isAr = /dir\s*=\s*["']rtl["']|lang\s*=\s*["']ar["']/i.test(out);
    const tags = [];

    // لا نُضيف وصفاً إن كان صاحب الموقع وضع وصفه بنفسه
    if (desc && !/<meta\s[^>]*name\s*=\s*["']description["']/i.test(out)) {
        tags.push(`    <meta name="description" content="${esc(desc)}" data-jaola-seo>`);
    }
    if (!/<meta\s[^>]*property\s*=\s*["']og:title["']/i.test(out)) {
        tags.push(`    <meta property="og:title" content="${esc(title)}" data-jaola-seo>`);
        if (desc) tags.push(`    <meta property="og:description" content="${esc(desc)}" data-jaola-seo>`);
        tags.push(`    <meta property="og:type" content="website" data-jaola-seo>`);
        tags.push(`    <meta property="og:locale" content="${isAr ? 'ar_AR' : 'en_US'}" data-jaola-seo>`);
        if (pageUrl) tags.push(`    <meta property="og:url" content="${esc(pageUrl)}" data-jaola-seo>`);
    }
    if (!/<meta\s[^>]*name\s*=\s*["']twitter:card["']/i.test(out)) {
        tags.push(`    <meta name="twitter:card" content="summary" data-jaola-seo>`);
    }
    if (!out.includes('application/ld+json')) {
        const ld = { '@context': 'https://schema.org', '@type': 'WebSite', name: title, ...(desc ? { description: desc } : {}), ...(pageUrl ? { url: pageUrl } : {}) };
        tags.push(`    <script type="application/ld+json" data-jaola-seo>${JSON.stringify(ld)}</script>`);
    }

    if (!tags.length) return out;
    return out.replace(/<\/head>/i, tags.join('\n') + '\n</head>');
}

/** robots.txt (دائماً) + sitemap.xml (عند معرفة رابط الموقع النهائي). */
export function buildRobotsTxt(siteUrl = '') {
    const base = String(siteUrl || '').replace(/\/$/, '');
    return `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`;
}

export function buildSitemapXml(siteUrl, pages = []) {
    const base = String(siteUrl || '').replace(/\/$/, '');
    if (!base) return '';
    const urls = pages.map(p => {
        const loc = p === 'index.html' ? `${base}/` : `${base}/${p}`;
        return `  <url><loc>${esc(loc)}</loc></url>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * يطبّق الحزمة على مشروع كاملاً: وسوم في كل صفحات HTML الجذرية (عدا اللوحة
 * الداخلية) + robots.txt + sitemap.xml إن عُرف الرابط. آمن للتكرار مع كل نشر.
 */
export function applySeoPack(projectPath, { siteName = '', siteUrl = '' } = {}) {
    if (!projectPath || !fs.existsSync(projectPath)) return { error: 'مجلد المشروع غير موجود' };
    const injected = [];
    const htmlPages = fs.readdirSync(projectPath)
        .filter(f => f.endsWith('.html') && !SKIP_HTML.has(f));

    for (const f of htmlPages) {
        const p = path.join(projectPath, f);
        const html = fs.readFileSync(p, 'utf8');
        const pageUrl = siteUrl ? `${String(siteUrl).replace(/\/$/, '')}/${f === 'index.html' ? '' : f}` : '';
        const next = injectSeoTags(html, { siteName, pageUrl });
        if (next !== html) { fs.writeFileSync(p, next); injected.push(f); }
    }

    // robots.txt — لا نستبدل ملفاً وضعه صاحب الموقع بنفسه
    const robotsPath = path.join(projectPath, 'robots.txt');
    if (!fs.existsSync(robotsPath)) fs.writeFileSync(robotsPath, buildRobotsTxt(siteUrl));

    if (siteUrl && htmlPages.length) {
        fs.writeFileSync(path.join(projectPath, 'sitemap.xml'), buildSitemapXml(siteUrl, htmlPages.sort()));
    }
    return { ok: true, injected, pages: htmlPages.length };
}
