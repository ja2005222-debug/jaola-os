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

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function runSEO(files, projectInfo) {
    const { name, description, url } = projectInfo;
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

    // 3. sitemap.xml
    newFiles.push({
        name: 'sitemap.xml',
        content: generateSitemap(url)
    });

    // 4. تحديث title إذا كان فارغاً
    const updatedFiles = files.map(f => {
        if (f.name === 'index.html') {
            const improved = improvedFiles.find(i => i.name === 'index.html');
            return improved || f;
        }
        return f;
    });

    return {
        success: true,
        files: updatedFiles,
        newFiles,
        summary: `SEO — robots.txt + sitemap.xml + meta tags (OG, Twitter, Schema.org)`
    };
}
