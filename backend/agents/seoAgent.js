/**
 * 🔍 SEO Agent — JAOLA OS
 *
 * يُحسّن الموقع لمحركات البحث تلقائياً:
 * - robots.txt
 * - sitemap.xml
 * - Meta tags (OG, Twitter, Schema.org)
 * - يُحدّث index.html بـ meta tags كاملة
 */

// ═══════════════════════════════════════════════════════
// 🤖 robots.txt
// ═══════════════════════════════════════════════════════
export function generateRobotsTxt(siteUrl) {
    return `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /`;
}

// ═══════════════════════════════════════════════════════
// 🗺️ sitemap.xml
// ═══════════════════════════════════════════════════════
export function generateSitemap(siteUrl, pages = ['']) {
    const today = new Date().toISOString().split('T')[0];
    const urls = pages.map(page => `
  <url>
    <loc>${siteUrl}/${page}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ═══════════════════════════════════════════════════════
// 🏷️ Meta Tags كاملة
// ═══════════════════════════════════════════════════════
export function generateMetaTags(projectInfo) {
    const { name, description, url, image, type = 'website', lang = 'ar' } = projectInfo;

    return `
    <!-- SEO Basic -->
    <meta name="description" content="${description}">
    <meta name="keywords" content="${name}, ${description.split(' ').slice(0, 5).join(', ')}">
    <meta name="author" content="${name}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${url}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type}">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image || url + '/og-image.jpg'}">
    <meta property="og:locale" content="${lang === 'ar' ? 'ar_AR' : 'en_US'}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image || url + '/og-image.jpg'}">

    <!-- Schema.org -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "${name}",
        "url": "${url}",
        "description": "${description}",
        "inLanguage": "${lang}"
    }
    </script>`.trim();
}

// ═══════════════════════════════════════════════════════
// 🔧 تحديث index.html بـ meta tags
// ═══════════════════════════════════════════════════════
export function injectMetaTags(htmlContent, projectInfo) {
    if (!htmlContent) return htmlContent;

    const metaTags = generateMetaTags(projectInfo);

    // إزالة meta description القديمة إذا وجدت
    let updated = htmlContent.replace(/<meta\s+name="description"[^>]*>/gi, '');

    // إضافة meta tags بعد <title>
    if (updated.includes('</title>')) {
        updated = updated.replace('</title>', `</title>\n    ${metaTags}`);
    } else if (updated.includes('<head>')) {
        updated = updated.replace('<head>', `<head>\n    ${metaTags}`);
    }

    return updated;
}

// صفحاتُ الموقع كما هي على القرص: الرئيسيةُ جذرٌ (''), وما عداها باسم ملفّه.
// تُشتقّ من الملفات المسلَّمة لا تُفترَض، فإن لم يكن ثمّة HTML بقيت الجذرَ وحده.
function sitePages(files = []) {
    const html = files.filter((f) => /\.html$/i.test(f?.name || '')).map((f) => f.name);
    if (!html.length) return [''];
    const rest = html.filter((n) => n !== 'index.html').sort();
    return html.includes('index.html') ? ['', ...rest] : rest;
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function runSEO(files, projectInfo) {
    const { url } = projectInfo;
    const improvedFiles = [];
    const newFiles = [];

    // 1. تحديث index.html بـ meta tags
    const htmlFile = files.find(f => f.name === 'index.html');
    if (htmlFile) {
        const updatedHtml = injectMetaTags(htmlFile.content, projectInfo);
        improvedFiles.push({ ...htmlFile, content: updatedHtml });
    }

    // 2. robots.txt
    newFiles.push({
        name: 'robots.txt',
        content: generateRobotsTxt(url)
    });

    // 3. sitemap.xml — على صفحات الموقع الفعلية.
    // 🔴 كان يُنادى `generateSitemap(url)` بلا صفحات، فتبقى `pages` على
    //    قيمتها الافتراضية `['']` ويخرج الملفُّ برابطٍ واحد: الرئيسية. فموقعٌ
    //    من ثماني صفحات يُنشر وخريطتُه تُعلن صفحةً واحدة، و`robots.txt` يشير
    //    إليها — فلا تعرف محرّكاتُ البحث بالبقيّة من هذا الطريق.
    const pages = sitePages(files);
    newFiles.push({
        name: 'sitemap.xml',
        content: generateSitemap(url, pages)
    });

    // 4. تحديث title إذا كان فارغاً
    const updatedFiles = files.map(f => {
        if (f.name === 'index.html') {
            const improved = improvedFiles.find(i => i.name === 'index.html');
            return improved || f;
        }
        return f;
    });

    // 🔴 الدرجةُ كانت تُكتب في المستدعي ثابتةً: `{ grade: 'A', score: 100 }`
    //    مهما جرى — إلى جانب درجتَي «الجودة» و«الأمان» المشتقّتين من نتائجهما،
    //    فلا يميّز المستخدمُ المقياسَ من الثابت. وهي تُشتقّ هنا من واقعتين
    //    مقيستين لا أكثر: أدُخلت الوسوم في صفحةٍ فعلية؟ وكم صفحةً في الخريطة؟
    //    درجةٌ خشنة، لكنّها **تقيس** ما جرى بدل أن تدّعيه.
    const metaInjected = improvedFiles.length > 0;
    const applied = ['robots.txt', 'sitemap.xml'];
    if (metaInjected) applied.push('meta tags (OG, Twitter, Schema.org)');

    return {
        success: true,
        files: updatedFiles,
        newFiles,
        metaInjected,
        pages: pages.length,
        grade: metaInjected ? 'A' : 'C',
        score: metaInjected ? 100 : 60,
        summary: `SEO — ${applied.join(' + ')} · ${pages.length} صفحة في الخريطة`
            + (metaInjected ? '' : ' · لا index.html فلم تُدخَل الوسوم')
    };
}
