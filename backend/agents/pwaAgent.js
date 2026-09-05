import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

/**
 * 🎨 استخراج اللون الأساسي من ملف CSS الموجود في المشروع
 * يبحث عن متغيرات CSS شائعة (--primary, --primary-blue, إلخ) أو أول لون hex يجده
 */
async function extractThemeColor(projectPath) {
    const DEFAULT_COLOR = '#0ea5e9'; // أزرق افتراضي أنيق
    try {
        const cssPath = path.join(projectPath, 'styles.css');
        if (!fs.existsSync(cssPath)) return DEFAULT_COLOR;

        const css = await fsPromises.readFile(cssPath, 'utf-8');

        // أولوية للمتغيرات الشائعة بأسماء "primary"
        const primaryVarMatch = css.match(/--(?:primary|main|theme)[a-z-]*:\s*(#[0-9a-fA-F]{3,8})/);
        if (primaryVarMatch) return primaryVarMatch[1];

        // وإلا، أول لون hex صريح في الملف
        const anyHexMatch = css.match(/#[0-9a-fA-F]{6}\b/);
        if (anyHexMatch) return anyHexMatch[0];

        return DEFAULT_COLOR;
    } catch (e) {
        return DEFAULT_COLOR;
    }
}

/**
 * 🖼️ توليد أيقونة SVG بسيطة: حرف أول من اسم التطبيق على خلفية ملوّنة بتدرج
 * SVG يُحوَّل لاحقاً لـ data URI، فلا حاجة لملفات PNG منفصلة أو معالجة صور
 */
function generateIconSVG(appName, themeColor) {
    const letter = (appName?.trim()?.[0] || 'J').toUpperCase();
    // تدرج بسيط من اللون الأساسي إلى نسخة أغمق منه قليلاً
    const darkerColor = adjustColorBrightness(themeColor, -30);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${themeColor}"/>
      <stop offset="100%" stop-color="${darkerColor}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="256" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="260" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="central">${letter}</text>
</svg>`;
}

/** تفتيح أو تغميق لون hex بنسبة مئوية بسيطة */
function adjustColorBrightness(hex, percent) {
    try {
        let color = hex.replace('#', '');
        if (color.length === 3) color = color.split('').map(c => c + c).join('');
        const num = parseInt(color, 16);
        let r = (num >> 16) + Math.round(255 * (percent / 100));
        let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
        let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) {
        return hex;
    }
}

/**
 * 📋 توليد محتوى manifest.json حسب معيار PWA
 */
function generateManifest({ appName, shortName, themeColor, backgroundColor }) {
    return JSON.stringify({
        name: appName,
        short_name: shortName || appName.slice(0, 12),
        description: `تطبيق ${appName} — تم إنشاؤه عبر JAOLA OS`,
        start_url: './index.html',
        display: 'standalone',
        background_color: backgroundColor || '#ffffff',
        theme_color: themeColor,
        orientation: 'portrait-primary',
        icons: [
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
    }, null, 2);
}

/**
 * ⚙️ توليد service worker بسيط: cache-first للملفات الثابتة، مناسب لمواقع JAOLA
 */
// 🔴 كانت القائمةُ مكتوبةً بيدٍ: `['index.html','styles.css','script.js','icon.svg']`،
// و`cache.addAll` **ذرّيّة**: يفشل ملفٌّ واحد فلا يُخزَّن أيُّ ملف. والـ`catch`
// حولها كان يبتلع الخطأ وتعليقُه يقول «تجاهل الملفات غير الموجودة» — وهو
// يتجاهل **الخطأ** لا الملف. فقِيس بتشغيل المعالج: مشروعٌ بلا `script.js`
// (الحالةُ التي يسمّيها التعليقُ نفسه) يُخزّن **صفرَ ملفات**، والمستخدمُ
// يُقال له إنّ التطبيق أُضيف. فلا عملَ دون اتصال البتّة.
//
// والقائمةُ الآن تُشتقّ من ملفات المشروع الفعلية — فصفحاتُ الموقع المتعدّدة
// (`about.html` وأخواتُها) تُخزَّن هي أيضاً — والتخزينُ **ملفاً ملفاً** فلا
// يُسقط غائبٌ واحد الباقين.
function generateServiceWorker(appName, files = ['index.html', 'styles.css', 'script.js', 'icon.svg']) {
    const cacheName = `jaola-${(appName || 'app').toLowerCase().replace(/[^a-z0-9]/g, '-')}-v1`;
    return `// Service Worker تلقائي — تم توليده عبر JAOLA OS PWA Agent
const CACHE_NAME = '${cacheName}';
const FILES_TO_CACHE = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // ملفاً ملفاً لا addAll: الأخيرةُ ذرّيّة، فملفٌّ غائبٌ واحد يُفرغ الكاش كلَّه.
            Promise.all(FILES_TO_CACHE.map((f) => cache.add(f).catch(() => {})))
        )
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // استراتيجية cache-first مع fallback للشبكة
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => caches.match('index.html'));
        })
    );
});
`;
}

/**
 * 🔧 حقن وسوم PWA اللازمة داخل <head> في index.html
 * يتحقق أولاً من عدم وجودها مسبقاً لتجنب التكرار عند الاستدعاء المتكرر
 */
function injectPWATags(htmlContent, themeColor) {
    let updated = htmlContent;

    if (!updated.includes('rel="manifest"')) {
        updated = updated.replace(
            '</head>',
            `    <link rel="manifest" href="manifest.json">\n` +
            `    <meta name="theme-color" content="${themeColor}">\n` +
            `    <link rel="icon" type="image/svg+xml" href="icon.svg">\n` +
            `    <link rel="apple-touch-icon" href="icon.svg">\n` +
            `  </head>`
        );
    }

    if (!updated.includes('serviceWorker.register')) {
        const swScript = `\n    <script>\n` +
            `      if ('serviceWorker' in navigator) {\n` +
            `        window.addEventListener('load', () => {\n` +
            `          navigator.serviceWorker.register('service-worker.js').catch(() => {});\n` +
            `        });\n` +
            `      }\n` +
            `    </script>\n`;
        updated = updated.replace('</body>', `${swScript}  </body>`);
    }

    return updated;
}

/**
 * 🚀 الدالة الرئيسية: تُستدعى من server.js لتوليد PWA كامل لمشروع معيّن
 * @param {string} projectPath - المسار الفعلي لمجلد المشروع على القرص
 * @param {object} options - { appName, shortName } من المستخدم
 * @returns {Promise<{success: boolean, error?: string}>}
 */
// امتداداتٌ يفيد تخزينُها للعمل دون اتصال. الجذرُ وحده: مواقعُ جولا الثابتة
// مسطّحة، والغوصُ في المجلّدات يجرّ `node_modules` وأخواتِها.
const CACHEABLE_EXT = new Set(['html', 'css', 'js', 'svg', 'json', 'png', 'jpg', 'jpeg', 'webp', 'ico', 'woff2']);
const MAX_CACHED_FILES = 60;

function listCacheableFiles(projectPath) {
    let names = [];
    try {
        names = fs.readdirSync(projectPath, { withFileTypes: true })
            .filter((e) => e.isFile() && !e.name.startsWith('.'))
            .map((e) => e.name)
            .filter((n) => CACHEABLE_EXT.has((n.split('.').pop() || '').toLowerCase()));
    } catch { return ['index.html']; }
    // الرئيسيةُ أوّلاً (هي احتياطُ التنقّل)، ثمّ الباقي مرتّباً — وترتيبٌ ثابتٌ
    // يجعل ملفَّ العامل نفسه ثابتاً بين البناءات فلا يتغيّر بلا سبب.
    const rest = names.filter((n) => n !== 'index.html' && n !== 'service-worker.js').sort();
    const out = (names.includes('index.html') ? ['index.html'] : []).concat(rest);
    return out.slice(0, MAX_CACHED_FILES);
}

export async function generatePWA(projectPath, options = {}) {
    try {
        const indexPath = path.join(projectPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            return { success: false, error: 'index.html غير موجود في هذا المشروع. ابنِ الموقع أولاً.' };
        }

        const appName = (options.appName || 'تطبيقي').trim().slice(0, 45);
        const shortName = (options.shortName || appName).trim().slice(0, 12);

        const themeColor = await extractThemeColor(projectPath);
        const iconSVG = generateIconSVG(appName, themeColor);
        const manifestJSON = generateManifest({ appName, shortName, themeColor, backgroundColor: '#ffffff' });
        // تُحسب قبل كتابة manifest/icon كي تشملهما أيضاً (يُضافان صراحةً)
        const cacheFiles = [...new Set([...listCacheableFiles(projectPath), 'manifest.json', 'icon.svg'])];
        const swJS = generateServiceWorker(appName, cacheFiles);

        const htmlContent = await fsPromises.readFile(indexPath, 'utf-8');
        const updatedHTML = injectPWATags(htmlContent, themeColor);

        await Promise.all([
            fsPromises.writeFile(path.join(projectPath, 'manifest.json'), manifestJSON),
            fsPromises.writeFile(path.join(projectPath, 'icon.svg'), iconSVG),
            fsPromises.writeFile(path.join(projectPath, 'service-worker.js'), swJS),
            fsPromises.writeFile(indexPath, updatedHTML),
        ]);

        return {
            success: true,
            appName,
            themeColor,
            files: ['manifest.json', 'icon.svg', 'service-worker.js'],
            cached: cacheFiles
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
