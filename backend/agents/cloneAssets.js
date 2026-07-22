/**
 * 🎨 أصول العلامة للكلون — توسيع «بيانات العيّنة» التي تلمسها البصمة لتشمل
 * الهوية البصرية: أيقونة/شعار مطابق للمجال + لوحة إيموجي ولون أساسي.
 *
 * كل شيء self-contained (SVG مضمّن، بلا صور خارجية) وآمن في jsdom. يُستعمل
 * حتمياً في _buildFromClone (يُطبَّق حتى لو تخطّى الذكاء التخصيص أو ارتدّ)،
 * ويغذّي أيضاً تعليمات البصمة بإيموجي/لون المجال.
 */

// لوحات حسب المجال — كلمات مفتاحية (عربي/إنجليزي) → إيموجي مناسبة + لون أساسي.
const DOMAIN_PALETTES = [
    { keys: ['قهوة', 'كوفي', 'كافيه', 'coffee', 'cafe', 'barista'], emojis: ['☕', '🥐', '🍪', '🧋'], accent: '#b45309' },
    { keys: ['مطعم', 'طعام', 'وجبات', 'برجر', 'بيتزا', 'restaurant', 'food', 'burger', 'pizza', 'توصيل طعام'], emojis: ['🍔', '🍕', '🥗', '🍰'], accent: '#f59e0b' },
    { keys: ['رياضة', 'جيم', 'نادي', 'لياقة', 'gym', 'fitness', 'sport', 'workout'], emojis: ['💪', '🏋️', '🤸', '🥗'], accent: '#22c55e' },
    { keys: ['تعليم', 'دورات', 'مدرسة', 'كورس', 'أكاديمية', 'education', 'course', 'school', 'learn', 'academy'], emojis: ['🎓', '📘', '✏️', '🧑‍🏫'], accent: '#6366f1' },
    { keys: ['عقار', 'عقارات', 'شقق', 'فلل', 'real estate', 'property', 'housing'], emojis: ['🏠', '🏢', '🏡', '🔑'], accent: '#0ea5e9' },
    { keys: ['سفر', 'سياحة', 'طيران', 'فنادق', 'رحلات', 'travel', 'flight', 'hotel', 'tour'], emojis: ['✈️', '🏖️', '🗺️', '🧳'], accent: '#0ea5e9' },
    { keys: ['تذاكر', 'مناسبات', 'فعاليات', 'حفلات', 'event', 'ticket', 'concert'], emojis: ['🎟️', '🎤', '🎭', '🎉'], accent: '#e11d48' },
    { keys: ['عيادة', 'طبي', 'صحة', 'مستشفى', 'أسنان', 'clinic', 'health', 'medical', 'dental', 'doctor'], emojis: ['🩺', '💊', '🏥', '🦷'], accent: '#06b6d4' },
    { keys: ['صالون', 'تجميل', 'حلاقة', 'سبا', 'salon', 'beauty', 'spa', 'barber'], emojis: ['💇', '💅', '💄', '🌸'], accent: '#db2777' },
    { keys: ['متجر', 'تسوق', 'ملابس', 'أزياء', 'store', 'shop', 'ecommerce', 'fashion', 'boutique'], emojis: ['🛍️', '👟', '👕', '🎁'], accent: '#8b5cf6' },
    { keys: ['تقنية', 'برمجة', 'تطبيق', 'ستارت اب', 'tech', 'saas', 'software', 'startup', 'app'], emojis: ['💻', '📱', '⚙️', '🚀'], accent: '#3b82f6' },
    { keys: ['سيارات', 'تاكسي', 'توصيل', 'نقل', 'taxi', 'ride', 'car', 'delivery'], emojis: ['🚕', '🚗', '🛵', '📦'], accent: '#facc15' },
    { keys: ['مالية', 'محفظة', 'بنك', 'دفع', 'finance', 'wallet', 'bank', 'pay', 'crypto'], emojis: ['💰', '💳', '📈', '🏦'], accent: '#10b981' },
];
const DEFAULT_PALETTE = { emojis: ['⭐', '✨', '🔷', '📦'], accent: '#0ea5e9' };

function normalize(s) {
    return (s || '').toString().toLowerCase()
        .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
        .replace(/[ًٌٍَُِّْ]/g, '');
}

/** يختار لوحة المجال الأنسب من نصّ الهدف (أو الافتراضية). */
export function pickPalette(text = '') {
    const hay = normalize(text);
    let best = null, bestHits = 0;
    for (const p of DOMAIN_PALETTES) {
        let hits = 0;
        for (const k of p.keys) if (hay.includes(normalize(k))) hits++;
        if (hits > bestHits) { bestHits = hits; best = p; }
    }
    return best ? { emojis: best.emojis.slice(), accent: best.accent } : { emojis: DEFAULT_PALETTE.emojis.slice(), accent: DEFAULT_PALETTE.accent };
}

/** أيقونة/شعار SVG مضمّن: إيموجي المجال على خلفية باللون الأساسي (self-contained). */
export function emojiFaviconSVG(emoji = '⭐', accent = '#0ea5e9') {
    const safe = String(emoji || '⭐');
    const bg = /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : '#0ea5e9';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="brand">
  <rect width="64" height="64" rx="14" fill="${bg}"/>
  <text x="32" y="35" font-size="36" text-anchor="middle" dominant-baseline="central">${safe}</text>
</svg>`;
}

/** يجمع أصول البصمة لهدفٍ ما: اللوحة + أيقونة SVG جاهزة للكتابة. */
export function assetsFor(goal = '') {
    const palette = pickPalette(goal);
    return { palette, favicon: emojiFaviconSVG(palette.emojis[0], palette.accent) };
}

/** يحقن وسم الأيقونة في <head> (idempotent — لا يكرّر ولا يستبدل أيقونة موجودة). */
export function injectFaviconTag(html = '', href = 'brand.svg') {
    if (/rel=["']icon["']/i.test(html)) return html; // أيقونة موجودة — لا نلمس
    const tag = `    <link rel="icon" type="image/svg+xml" href="${href}">\n`;
    if (html.includes('</head>')) return html.replace('</head>', tag + '  </head>');
    return tag + html;
}

/** سطر تلميح بصري لتعليمات البصمة (إيموجي المجال + اللون الأساسي). */
export function paletteHint(goal = '') {
    const p = pickPalette(goal);
    return `استخدم رموز/إيموجي مناسبة للمجال مثل: ${p.emojis.join(' ')}، ويُفضّل لون أساسي قريب من ${p.accent}.`;
}
