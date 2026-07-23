/**
 * 🔗 سجلّ المكتبات الجاهزة — قائمة مُنسّقة من مكتبات ناضجة تُحقن في المشروع عند
 * الطلب عبر CDN (على نمط الإضافات المثبت: pwaAgent/jaolaBot).
 *
 * ملاحظة: وسوم CDN خاملة في jsdom (لا تُجلب) فالتحقّق السلوكي يبقى سليماً؛
 * وتعمل فعلياً على المواقع المنشورة. الحقن idempotent عبر السمة data-jlib.
 */

// كل مكتبة: { id, name, category, description, css:[url], js:[url], init? }
const LIBRARIES = [
    { id: 'tailwind', name: 'Tailwind CSS', category: 'تنسيق', description: 'إطار utility-first لتصميم سريع ومتّسق (Play CDN).',
      css: [], js: ['https://cdn.tailwindcss.com'] },
    { id: 'bootstrap', name: 'Bootstrap 5', category: 'تنسيق', description: 'إطار مكوّنات جاهزة (شبكة، أزرار، نوافذ) + JS.',
      css: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'],
      js: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'] },
    { id: 'bulma', name: 'Bulma', category: 'تنسيق', description: 'إطار CSS حديث خفيف بلا JavaScript.',
      css: ['https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css'], js: [] },
    { id: 'alpine', name: 'Alpine.js', category: 'تفاعل', description: 'تفاعل تصريحيّ خفيف (x-data/x-show) بلا بناء.',
      css: [], js: ['https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js'] },
    { id: 'htmx', name: 'htmx', category: 'تفاعل', description: 'طلبات AJAX وتحديث DOM من سمات HTML مباشرةً.',
      css: [], js: ['https://unpkg.com/htmx.org@2.0.2'] },
    { id: 'chartjs', name: 'Chart.js', category: 'رسوم', description: 'رسوم بيانية تفاعلية للوحات التحكّم والإحصاءات.',
      css: [], js: ['https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'] },
    { id: 'apexcharts', name: 'ApexCharts', category: 'رسوم', description: 'رسوم بيانية حديثة غنيّة بالتفاعل.',
      css: [], js: ['https://cdn.jsdelivr.net/npm/apexcharts@3.54.0/dist/apexcharts.min.js'] },
    { id: 'swiper', name: 'Swiper', category: 'عرض', description: 'سلايدر/كاروسيل لمساتيّ للمنتجات والمعارض.',
      css: ['https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'],
      js: ['https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js'] },
    { id: 'aos', name: 'AOS', category: 'حركة', description: 'تأثيرات ظهور عند التمرير (Animate On Scroll).',
      css: ['https://unpkg.com/aos@2.3.1/dist/aos.css'], js: ['https://unpkg.com/aos@2.3.1/dist/aos.js'],
      init: 'if(window.AOS){AOS.init();}' },
    { id: 'animatecss', name: 'Animate.css', category: 'حركة', description: 'مكتبة حركات CSS جاهزة بأصناف.',
      css: ['https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css'], js: [] },
    { id: 'fontawesome', name: 'Font Awesome', category: 'أيقونات', description: 'آلاف الأيقونات الاحترافية بأصناف.',
      css: ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css'], js: [] },
    { id: 'lucide', name: 'Lucide Icons', category: 'أيقونات', description: 'أيقونات SVG أنيقة وخفيفة.',
      css: [], js: ['https://unpkg.com/lucide@0.454.0'], init: 'if(window.lucide){lucide.createIcons();}' },
    { id: 'cairo-font', name: 'خط Cairo (Google Fonts)', category: 'خطوط', description: 'خط عربي احترافي واضح للعناوين والنصوص.',
      css: ['https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap'], js: [] },
    { id: 'gridjs', name: 'Grid.js', category: 'جداول', description: 'جداول بيانات قابلة للفرز/البحث/التصفّح.',
      css: ['https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css'],
      js: ['https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js'] },
];

/** بيانات العرض للواجهة (بلا تفاصيل الحقن الثقيلة). */
export function listLibraries() {
    return LIBRARIES.map(l => ({ id: l.id, name: l.name, category: l.category, description: l.description }));
}

/** يجلب مكتبة بمعرّفها (للحقن). */
export function getLibraryById(id) {
    return LIBRARIES.find(l => l.id === id) || null;
}

/**
 * يحقن وسوم مكتبة في index.html (idempotent عبر data-jlib):
 * الـ CSS في <head>، والـ JS + مقتطف التهيئة قبل </body>.
 */
export function injectLibrary(html = '', lib) {
    if (!lib || !lib.id) return html;
    const marker = new RegExp(`data-jlib=["']${lib.id}["']`);
    if (marker.test(html)) return html; // محقونة مسبقاً — لا تكرار

    const headTags = (lib.css || []).map(u => `    <link rel="stylesheet" href="${u}" data-jlib="${lib.id}">`);
    const bodyTags = (lib.js || []).map(u => `    <script src="${u}" data-jlib="${lib.id}"></script>`);
    if (lib.init) bodyTags.push(`    <script data-jlib="${lib.id}-init">window.addEventListener('load',function(){${lib.init}});</script>`);

    let out = html;
    if (headTags.length) {
        const block = headTags.join('\n') + '\n';
        out = out.includes('</head>') ? out.replace('</head>', block + '  </head>') : block + out;
    }
    if (bodyTags.length) {
        const block = bodyTags.join('\n') + '\n';
        out = out.includes('</body>') ? out.replace('</body>', block + '  </body>') : out + '\n' + block;
    }
    return out;
}
