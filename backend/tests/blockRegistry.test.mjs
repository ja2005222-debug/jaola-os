// 🧱 JAOLA Registry / Blocks: أقسام مكتفية ذاتياً + إعادة تركيب صفحة صالحة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listBlocks, getBlock, composePage, composeLanding, isMarketingPageGoal, brandFromGoal, selectBlocks } from '../agents/blockRegistry.js';

test('selectBlocks: يختار الأقسام حسب نوع الطلب', () => {
    assert.deepEqual(selectBlocks('صفحة قريباً coming soon'), ['nav', 'hero', 'cta', 'footer']);
    const port = selectBlocks('بورتفوليو لمصمّم');
    assert.ok(port.includes('testimonials') && !port.includes('pricing'), 'بورتفوليو بلا أسعار');
    const full = selectBlocks('منصة SaaS باشتراك');
    assert.ok(full.includes('pricing') && full.includes('faq'), 'SaaS كامل بالأسعار');
    // كل المعرّفات المختارة موجودة فعلاً في السجلّ
    for (const id of selectBlocks('شركة تعريفية')) assert.ok(getBlock(id), id + ' موجود');
});
import { polishHtml } from '../agents/polishPack.js';
import { verifyBehavior, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';

test('isMarketingPageGoal: صفحات تسويقيّة/تعريفيّة → true؛ التطبيقات → false', () => {
    assert.equal(isMarketingPageGoal('ابني صفحة هبوط لشركة AI'), true);
    assert.equal(isMarketingPageGoal('موقع تعريفي لمطعم'), true);
    assert.equal(isMarketingPageGoal('بورتفوليو لمصمّم'), true);
    assert.equal(isMarketingPageGoal('landing page for a startup'), true);
    assert.equal(isMarketingPageGoal('أي هدف', { kind: 'brochure' }), true);
    // تطبيقات تفاعلية → ليست صفحة تسويق
    assert.equal(isMarketingPageGoal('متجر عطور فخم'), false);
    assert.equal(isMarketingPageGoal('تطبيق توصيل طعام'), false);
});

test('brandFromGoal: يستخرج علامة مختصرة أو fallback', () => {
    assert.ok(brandFromGoal('ابني صفحة هبوط لشركة نجم').length > 0);
    assert.equal(brandFromGoal('', 'proj-1'), 'proj-1');
    assert.ok(!/ابني|صفحة|موقع/.test(brandFromGoal('ابني موقع تعريفي عطور')), 'أزال كلمات البناء/النوع');
});

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

test('تكامل: صفحة مركّبة + مُلمَّعة تعمل بلا أخطاء (jsdom)', async () => {
    const { files } = composeLanding('سينما نجم', '#e11d48');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jreg-'));
    for (const f of files) {
        const content = f.name === 'index.html' ? polishHtml(f.content) : f.content;
        fs.writeFileSync(path.join(dir, f.name), content);
    }
    const v = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] }, domainModel: { roles: [{ name: 'Visitor' }] } });
    assert.equal(v.ran, true);
    const byName = Object.fromEntries(v.checks.map(x => [x.name, x.status]));
    assert.notEqual(byName['no-js-errors'], 'fail', 'الصفحة المركّبة+المُلمَّعة بلا أخطاء JS');
    fs.rmSync(dir, { recursive: true, force: true });
});
