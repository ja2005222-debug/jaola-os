/**
 * 🖼️ Image Forge — توليد صور مضمون *في حالة عدم توفّرها*.
 *
 * القاعدة (طلب المستخدم): أي عنصر بيانات بلا صورة يجب أن تُولَّد له صورة —
 * لا الاكتفاء برمز على تدرّج مسطّح. المولّد حتميّ ومحليّ بالكامل (SVG):
 * تدرّج بلون المجال + أشكال زخرفية متنوّعة بالبذرة + الرمز الكبير بظلّ —
 * فيعمل بلا إنترنت وبلا مفاتيح وبتكلفة صفر، ويجتاز jsdom كأي ملف ثابت.
 *
 * نقطة الحقن: بعد بصمة البيانات في بناء الكلون — العناصر المبصومة تُفرَّغ
 * صورها عمداً (كي لا تظهر صور غير مطابقة)، فيملؤها المولّد بصور مولّدة
 * مطابقة للمجال. لاحقاً يمكن تركيب مزوّد AI فوق نفس الطبقة (نفس العقد).
 */

import { primarySeedArray, spliceSeed, validateSeedLiteral } from './seedStamp.js';
import { pickPalette } from './cloneAssets.js';

// ─── أدوات لونية ─────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return { r: 99, g: 102, b: 241 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex, factor) {
    const { r, g, b } = hexToRgb(hex);
    const f = (x) => Math.max(0, Math.min(255, Math.round(x * factor)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// بذرة حتميّة من نصّ — نفس المدخل = نفس الصورة دائماً (قابل للاختبار)
export function seedOf(s = '') {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}

/**
 * صورة عنصر (بطاقة) 600×400: تدرّج المجال + فقاعات زجاجية متموضعة بالبذرة +
 * شبكة نقاط خفيفة + الرمز كبيراً بظلّ. حتميّة تماماً.
 */
export function forgeItemSVG({ emoji = '✨', accent = '#6366f1', seed = 0, label = '' } = {}) {
    const s = typeof seed === 'number' ? seed : seedOf(String(seed));
    const dark = shade(accent, 0.28), mid = shade(accent, 0.55), glow = shade(accent, 1.15);
    // ثلاث فقاعات تتوزّع باختلاف البذرة (تنويع بصري بين العناصر)
    const bub = (i) => {
        const x = 60 + ((s * (i + 3)) % 480);
        const y = 40 + ((s * (i + 7)) % 320);
        const r = 46 + ((s * (i + 5)) % 80);
        const o = 0.10 + ((s * (i + 2)) % 12) / 100;
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${glow}" opacity="${o.toFixed(2)}"/>`;
    };
    const title = String(label || '').slice(0, 28)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.6" fill="#ffffff" opacity="0.07"/>
    </pattern>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="600" height="400" fill="url(#bg)"/>
  <rect width="600" height="400" fill="url(#dots)"/>
  ${bub(0)}${bub(1)}${bub(2)}
  <text x="300" y="205" font-size="150" text-anchor="middle" dominant-baseline="middle" filter="url(#sh)">${emoji}</text>
  ${title ? `<text x="300" y="352" font-size="26" font-weight="700" text-anchor="middle" fill="#ffffff" opacity="0.9" font-family="Segoe UI, Tahoma, sans-serif">${title}</text>` : ''}
</svg>`;
}

// ─── حقن التمرير المحلي في imgUrl ────────────────────────────────────────
// قوالبنا تبني رابط Unsplash من معرّف الصورة؛ الصور المولّدة مسارات محلية
// (images/*.svg) فتحتاج تمريراً كما هي. تعديل حتميّ موضعي على الدالة نفسها.
const IMGURL_RE = /function imgUrl\(id\)\s*\{\s*return\s*'https:\/\/images\.unsplash\.com\/photo-'\s*\+\s*id\s*\+\s*'([^']*)';\s*\}/;
export function patchImgUrlPassthrough(js = '') {
    if (!IMGURL_RE.test(js)) return { changed: false, js };
    const out = js.replace(IMGURL_RE, (_m, params) =>
        `function imgUrl(id) { var v = String(id || ''); return (v.indexOf('/') !== -1 || v.indexOf('.') !== -1) ? v : 'https://images.unsplash.com/photo-' + v + '${params}'; }`);
    return { changed: out !== js, js: out };
}

/**
 * 🧩 المدخل الرئيسي: يفحص مصفوفة البيانات الرئيسية في app.js، وأي عنصر
 * (أو عنصر متداخل) يملك حقل `img` فارغاً → يولّد له SVG في images/ ويربطه.
 * يعيد {changed, files:[app.js + الصور], count} — أو {changed:false}.
 */
export function forgeSeedImages(files = [], { goal = '', category = '' } = {}) {
    const app = files.find(f => f.name === 'app.js');
    if (!app || !IMGURL_RE.test(app.content)) return { changed: false };

    const seedArr = primarySeedArray(app.content);
    if (!seedArr) return { changed: false };

    let items;
    try {
        // eslint-disable-next-line no-new-func
        items = Function('"use strict";return (' + seedArr.literal + ');')();
    } catch { return { changed: false }; }
    if (!Array.isArray(items) || !items.length) return { changed: false };

    const palette = pickPalette(`${goal} ${category}`);
    const images = [];
    let count = 0;

    const forgeInto = (obj, key) => {
        const emoji = obj.emoji || palette.emojis[count % palette.emojis.length];
        const label = obj.name || obj.title || obj.city || '';
        const fileName = `images/gen-${key}.svg`;
        images.push({ name: fileName, content: forgeItemSVG({ emoji, accent: palette.accent, seed: seedOf(key + label), label }) });
        obj.img = fileName;
        count++;
    };

    items.forEach((item, i) => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || i);
        if ('img' in item && !item.img) forgeInto(item, id);
        // عناصر متداخلة (مثل قائمة أطباق داخل مطعم)
        for (const [k, v] of Object.entries(item)) {
            if (!Array.isArray(v)) continue;
            v.forEach((sub, j) => {
                if (sub && typeof sub === 'object' && 'img' in sub && !sub.img) forgeInto(sub, `${id}-${k}-${String(sub.id || j)}`);
            });
        }
    });

    if (!count) return { changed: false };

    // إعادة تركيب المصفوفة (JSON = JS صالح) + حارس البنية نفسه المستخدم في البصمة
    const newLit = '[\n  ' + items.map(o => JSON.stringify(o)).join(',\n  ') + '\n]';
    if (!validateSeedLiteral(newLit, seedArr.literal)) return { changed: false };

    let js = spliceSeed(app.content, seedArr, newLit);
    js = patchImgUrlPassthrough(js).js;

    return { changed: true, count, files: [{ name: 'app.js', content: js }, ...images] };
}
