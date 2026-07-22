// 🎨 أصول العلامة: لوحة المجال + أيقونة SVG + حقن الأيقونة (idempotent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPalette, emojiFaviconSVG, assetsFor, injectFaviconTag, paletteHint } from '../agents/cloneAssets.js';
import { detectUndefinedFunctions } from '../agents/behaviorVerifier.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

test('pickPalette: يطابق المجال من الهدف', () => {
    assert.equal(pickPalette('مطعم وجبات سريعة وتوصيل').accent, '#f59e0b');
    assert.ok(pickPalette('صالة رياضية جيم').emojis.includes('💪'));
    assert.ok(pickPalette('منصة دورات تعليمية').emojis.includes('🎓'));
    assert.equal(pickPalette('coffee shop barista').accent, '#b45309');
});

test('pickPalette: هدف غامض → لوحة افتراضية سليمة', () => {
    const p = pickPalette('شيء بلا مجال واضح');
    assert.ok(Array.isArray(p.emojis) && p.emojis.length >= 3);
    assert.match(p.accent, /^#[0-9a-fA-F]{3,8}$/);
});

test('emojiFaviconSVG: SVG صالح يحمل الإيموجي واللون', () => {
    const svg = emojiFaviconSVG('☕', '#b45309');
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('☕'));
    assert.ok(svg.includes('#b45309'));
    // لون غير صالح → يرتدّ لافتراضي بلا انهيار
    assert.ok(emojiFaviconSVG('🎓', 'not-a-color').includes('#0ea5e9'));
});

test('assetsFor: يجمع اللوحة والأيقونة من الهدف', () => {
    const a = assetsFor('منصة بيع تذاكر المناسبات');
    assert.equal(a.palette.accent, '#e11d48');
    assert.ok(a.favicon.includes(a.palette.emojis[0]), 'الأيقونة تستخدم أول إيموجي');
});

test('injectFaviconTag: يحقن مرّة واحدة ولا يستبدل أيقونة موجودة', () => {
    const base = '<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>';
    const once = injectFaviconTag(base, 'brand.svg');
    assert.ok(once.includes('rel="icon"'));
    assert.ok(once.includes('brand.svg'));
    // idempotent
    const twice = injectFaviconTag(once, 'brand.svg');
    assert.equal(twice.split('rel="icon"').length - 1, 1, 'لا تكرار');
    // أيقونة موجودة مسبقاً → لا تُلمس
    const hasIcon = '<head><link rel="icon" href="x.ico"></head>';
    assert.equal(injectFaviconTag(hasIcon), hasIcon);
});

test('تكامل: حقن الأيقونة في كلون عامل يبقيه سليماً بلا دوال معلّقة', () => {
    const c = jaolaStore();
    const html = c.files.find(f => f.name === 'index.html').content;
    const app = c.files.find(f => f.name === 'app.js').content;
    const withIcon = injectFaviconTag(html, 'brand.svg');
    assert.ok(withIcon.includes('rel="icon"'), 'أُضيفت الأيقونة');
    assert.ok(withIcon.includes('</head>'), 'الرأس ما زال سليماً');
    assert.deepEqual(detectUndefinedFunctions({ html: withIcon, js: app }), [], 'لا دوال معلّقة (لم يتأثّر السلوك)');
});

test('paletteHint: نصّ تلميح يحمل إيموجي المجال', () => {
    const hint = paletteHint('عيادة أسنان');
    assert.ok(/🦷|🩺|💊|🏥/.test(hint));
    assert.ok(hint.includes('#'));
});
