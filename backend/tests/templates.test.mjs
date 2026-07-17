// 📚 مكتبة القوالب (#20): 30 فئة كاملة، وكشف النوع يصيب الفئة الصحيحة
// بدل السقوط على "الأعمال" العام.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableTemplates, getTemplate } from '../agents/templateLibrary.js';
import { detectProjectType } from '../agents/knowledgeEngine.js';

test('30 قالباً وكلها مكتملة (css_vars + قسمان+)', () => {
    const all = getAvailableTemplates();
    assert.ok(all.length >= 30, `عدد القوالب: ${all.length}`);
    for (const t of all) {
        const tpl = getTemplate(t);
        assert.ok(tpl.css_vars, `[${t}] بلا css_vars`);
        assert.ok(Object.keys(tpl.sections || {}).length >= 2, `[${t}] أقسام ناقصة`);
    }
});

test('كشف النوع يصيب الفئات الجديدة', () => {
    const cases = [
        ['أريد موقع مكتب محاماة واستشارات قانونية', 'law'],
        ['صمم لي متجر معرض سيارات مع حاسبة تمويل', 'automotive'],
        ['ابني موقع صالون تجميل وسبا', 'beauty'],
        ['موقع أخبار وصحيفة إلكترونية', 'news'],
        ['منصة تداول عملات رقمية بيتكوين', 'crypto'],
        ['موقع جمعية خيرية للتبرعات', 'nonprofit'],
        ['موقع تنظيم حفلات زفاف ومناسبات', 'wedding'],
        ['مدونة مقالات شخصية', 'blog'],
        ['موقع حجز مواعيد', 'booking'],
        ['فريق رياضات إلكترونية وبطولات ألعاب', 'gaming'],
        ['شركة مقاولات وبناء', 'construction'],
        ['استوديو تصميم داخلي وديكور', 'interior'],
    ];
    for (const [goal, expected] of cases) {
        assert.equal(detectProjectType(goal), expected, `"${goal}"`);
    }
});
