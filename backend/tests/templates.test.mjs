// 📚 مكتبة القوالب (#20): 30 فئة كاملة، وكشف النوع يصيب الفئة الصحيحة
// بدل السقوط على "الأعمال" العام.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableTemplates, getTemplate } from '../agents/templateLibrary.js';
import { detectProjectType, keywordMatches } from '../agents/knowledgeEngine.js';

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

test('كشف النوع على حدود الكلمات: «تطبيق» لا تُطابق «طبي» (كانت تصنّف توصيل الطعام طبياً)', () => {
    assert.equal(detectProjectType('تطبيق توصيل طعام مع سائقين ومطاعم'), 'restaurant');
    assert.equal(detectProjectType('تطبيق توصيل طعام للمطاعم مع تتبع الطلب'), 'restaurant');
    assert.equal(detectProjectType('Food delivery app for restaurants'), 'restaurant');
    assert.equal(detectProjectType('موقع طبي للمستشفى'), 'medical');
    assert.equal(detectProjectType('تطبيق للأطباء'), 'medical');
    assert.equal(detectProjectType('my application for doctors'), 'medical');
});

test('keywordMatches: سوابق ولواحق العربية اللاصقة مسموحة، والنصّ الفرعي داخل كلمة أخرى لا', () => {
    assert.equal(keywordMatches('تطبيق', 'طبي'), false);
    assert.equal(keywordMatches('application', 'app'), false);
    assert.equal(keywordMatches('والمطعمُ الجديد', 'مطعم'), true);
    assert.equal(keywordMatches('للمطاعم', 'مطاعم'), true);
    assert.equal(keywordMatches('عيادات الأسنان', 'عيادة'), false, 'جمع «عيادات» جذره «عياد» — لاحقة ات على «عيادة» لا تطابق');
    assert.equal(keywordMatches('عيادات الأسنان', 'عياد'), true);
    assert.equal(keywordMatches('two restaurants', 'restaurant'), true);
});

