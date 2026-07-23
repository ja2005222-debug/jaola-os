/**
 * ✨ باقة التلميع — طبقة نضج *حتميّة* تُخرج عملاً احترافياً مكتملاً بلا ذكاء:
 *  - خطّ عربي أنيق (Cairo) كأساس.
 *  - حركات ظهور عند التمرير (AOS) تُطبَّق *تلقائياً* على الأقسام/البطاقات دون
 *    تعديل محتوى الصفحة (فتصبح أي صفحة حيّة فوراً).
 *  - تحسينات أساسية آمنة (تمرير ناعم، صور مرنة، تركيز واضح).
 *
 * إضافية بالكامل (لا تغيّر تخطيط/ألوان المكوّنات)، self-contained عبر CDN، وآمنة
 * في jsdom (الوسوم خاملة، السكربت محروس بـ try/catch). idempotent عبر data-jaola-polish.
 */

const HEAD_BLOCK = [
    '    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" data-jaola-polish>',
    '    <link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css" data-jaola-polish>',
    '    <style data-jaola-polish>',
    "      html{scroll-behavior:smooth}",
    "      body{font-family:'Cairo',system-ui,'Segoe UI',Tahoma,sans-serif}",
    "      img{max-width:100%;height:auto}",
    "      a{transition:color .15s,opacity .15s}",
    "      *:focus-visible{outline:2px solid currentColor;outline-offset:2px}",
    "      [data-aos]{will-change:transform,opacity}",
    '    </style>',
].join('\n');

const BODY_BLOCK = [
    '    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js" data-jaola-polish></script>',
    '    <script data-jaola-polish>',
    "      window.addEventListener('load', function () {",
    "        try {",
    "          var sel = 'section, .card, .panel, .stat, .res-card, .mini-row, .ticket, .grid > *';",
    "          var els = document.querySelectorAll(sel), i = 0;",
    "          els.forEach(function (el) {",
    "            if (!el.hasAttribute('data-aos')) {",
    "              el.setAttribute('data-aos', 'fade-up');",
    "              el.setAttribute('data-aos-delay', String((i % 6) * 60));",
    "              i++;",
    "            }",
    "          });",
    "          if (window.AOS) { window.AOS.init({ once: true, duration: 600, offset: 40 }); }",
    "        } catch (e) {}",
    "      });",
    '    </script>',
].join('\n');

/** يطبّق باقة التلميع على index.html (idempotent، إضافيّ، آمن). */
export function polishHtml(html = '') {
    if (/data-jaola-polish/.test(html)) return html; // مُلمَّع مسبقاً
    let out = html;
    out = out.includes('</head>') ? out.replace('</head>', HEAD_BLOCK + '\n  </head>') : HEAD_BLOCK + '\n' + out;
    out = out.includes('</body>') ? out.replace('</body>', BODY_BLOCK + '\n  </body>') : out + '\n' + BODY_BLOCK;
    return out;
}

/** هل الصفحة مُلمَّعة؟ */
export function isPolished(html = '') { return /data-jaola-polish/.test(html); }
