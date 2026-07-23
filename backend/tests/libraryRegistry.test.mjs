// 🔗 سجلّ المكتبات: عرض + حقن idempotent + سلامة القالب المضيف (jsdom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listLibraries, getLibraryById, injectLibrary } from '../agents/libraryRegistry.js';
import { detectUndefinedFunctions } from '../agents/behaviorVerifier.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

test('listLibraries: قائمة عرض غير فارغة بحقول أساسية', () => {
    const list = listLibraries();
    assert.ok(list.length >= 8, 'مكتبات متعدّدة');
    for (const l of list) {
        assert.ok(l.id && l.name && l.category && l.description, 'حقول العرض موجودة');
        assert.equal(l.css, undefined, 'لا تسريب لتفاصيل الحقن الثقيلة');
    }
    assert.ok(list.find(l => l.id === 'tailwind'), 'Tailwind مسجّل');
    assert.ok(list.find(l => l.id === 'chartjs'), 'Chart.js مسجّل');
});

test('getLibraryById: يجلب/يرفض', () => {
    assert.equal(getLibraryById('chartjs')?.id, 'chartjs');
    assert.equal(getLibraryById('nope'), null);
});

test('injectLibrary: يضيف الوسوم في الرأس/الجسم', () => {
    const html = '<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>';
    const out = injectLibrary(html, getLibraryById('swiper')); // له css + js
    assert.ok(out.includes('swiper-bundle.min.css') && out.includes('rel="stylesheet"'), 'CSS في الرأس');
    assert.ok(out.includes('swiper-bundle.min.js') && out.includes('<script'), 'JS في الجسم');
    assert.ok(out.includes('data-jlib="swiper"'), 'سمة العلامة');
});

test('injectLibrary: idempotent — لا تكرار', () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>';
    const once = injectLibrary(html, getLibraryById('chartjs'));
    const twice = injectLibrary(once, getLibraryById('chartjs'));
    assert.equal(twice, once, 'الاستدعاء الثاني لا يغيّر شيئاً');
    assert.equal((once.match(/data-jlib="chartjs"/g) || []).length, 1, 'وسم واحد');
});

test('injectLibrary: مقتطف التهيئة يُحقن للمكتبات التي تحتاجه', () => {
    const out = injectLibrary('<html><head></head><body></body></html>', getLibraryById('lucide'));
    assert.ok(out.includes('lucide.createIcons') && out.includes("data-jlib=\"lucide-init\""), 'init محقون');
});

test('تكامل: حقن مكتبة في قالب عامل لا يكسره (بلا دوال معلّقة)', () => {
    const c = jaolaStore();
    const html = c.files.find(f => f.name === 'index.html').content;
    const app = c.files.find(f => f.name === 'app.js').content;
    const out = injectLibrary(html, getLibraryById('tailwind'));
    assert.ok(out.includes('cdn.tailwindcss.com'), 'Tailwind محقون');
    assert.ok(out.includes('</head>') && out.includes('</body>'), 'البنية سليمة');
    assert.deepEqual(detectUndefinedFunctions({ html: out, js: app }), [], 'لا دوال معلّقة (لم يتأثّر السلوك)');
});
