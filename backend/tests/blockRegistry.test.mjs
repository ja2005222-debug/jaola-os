// 🧱 JAOLA Registry / Blocks: أقسام مكتفية ذاتياً + إعادة تركيب صفحة صالحة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listBlocks, getBlock, composePage, composeLanding } from '../agents/blockRegistry.js';
import { detectUndefinedFunctions } from '../agents/behaviorVerifier.js';

test('listBlocks: قائمة عرض بحقول أساسية بلا تسريب HTML/CSS', () => {
    const list = listBlocks();
    assert.ok(list.length >= 8, 'أقسام متعدّدة');
    for (const b of list) {
        assert.ok(b.id && b.name && b.category, 'حقول العرض');
        assert.equal(b.html, undefined, 'لا تسريب HTML');
        assert.equal(b.css, undefined, 'لا تسريب CSS');
    }
    assert.ok(list.find(b => b.id === 'hero') && list.find(b => b.id === 'pricing'));
});

test('getBlock: يجلب/يرفض', () => {
    assert.equal(getBlock('hero')?.id, 'hero');
    assert.equal(getBlock('nope'), null);
});

test('composePage: يركّب صفحة كاملة صالحة بالعلامة واللون', () => {
    const { files, blocks } = composePage({ brand: 'سينما نجم', accent: '#e11d48', blocks: ['nav', 'hero', 'cta', 'footer'] });
    const html = files.find(f => f.name === 'index.html').content;
    const css = files.find(f => f.name === 'styles.css').content;
    assert.ok(html.startsWith('<!DOCTYPE html>'), 'وثيقة كاملة');
    assert.ok(html.includes('</head>') && html.includes('</body>'), 'بنية سليمة');
    assert.ok(html.includes('سينما نجم'), 'العلامة مُطبَّقة (لا {{BRAND}})');
    assert.ok(!html.includes('{{BRAND}}'), 'لا رموز غير مستبدَلة');
    assert.ok(css.includes('--jb:#e11d48'), 'لون العلامة مُطبَّق');
    assert.deepEqual(blocks, ['nav', 'hero', 'cta', 'footer'], 'الأقسام المطلوبة بالترتيب');
});

test('composePage: صفحة مركّبة بلا دوال معلّقة (أقسام ثابتة آمنة)', () => {
    const { files } = composeLanding('JAOLA', '#6366f1');
    const html = files.find(f => f.name === 'index.html').content;
    // لا JS ضروريّ في الأقسام → لا دوال معلّقة
    assert.deepEqual(detectUndefinedFunctions({ html, js: '' }), []);
});

test('composePage: افتراضيّ = صفحة هبوط كاملة عند غياب الاختيار', () => {
    const { blocks } = composePage({ brand: 'X' });
    assert.ok(blocks.includes('hero') && blocks.includes('pricing') && blocks.includes('footer'));
    // معرّف مجهول يُتجاهَل بأمان
    const { blocks: b2 } = composePage({ blocks: ['hero', 'ghost-block', 'footer'] });
    assert.deepEqual(b2, ['hero', 'footer']);
});
