// 🏛️ المخططات المرجعية — محاكاة أنماط مشاريع مشهورة ترفع جودة التوليد.
// التاكسي أول نمط (مقارنةً بما بُني سابقاً وفشل).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchBlueprint, buildBlueprintPrompt, BLUEPRINTS } from '../agents/referenceBlueprints.js';

test('يطابق التاكسي بصيغ عربية/إنجليزية متعددة', () => {
    for (const g of ['ابني موقع تاكسي', 'إدارة وتشغيل تأجير تاكسي', 'نظام حجز سائقين', 'a taxi ride hailing app', 'fleet management for drivers']) {
        assert.equal(matchBlueprint(g)?.id, 'taxi_fleet', g);
    }
});

test('يطابق بقية الأنماط', () => {
    assert.equal(matchBlueprint('محرك بحث طيران لبيع التذاكر بالعمولة')?.id, 'booking_flights');
    assert.equal(matchBlueprint('flight search engine')?.id, 'booking_flights');
    assert.equal(matchBlueprint('سوق إلكتروني بعمولة للبائعين')?.id, 'marketplace');
    assert.equal(matchBlueprint('a saas analytics dashboard')?.id, 'saas_dashboard');
    assert.equal(matchBlueprint('موقع حجز مواعيد لعيادة')?.id, 'appointments');
});

test('يطابق توصيل الطعام متعدّد المطاعم — دون اختطاف موقع مطعم واحد', () => {
    for (const g of ['تطبيق توصيل الطعام من مطاعم مختلفة', 'موقع طلب طعام ودليفري', 'a multi restaurant food delivery app', 'مثل talabat']) {
        assert.equal(matchBlueprint(g)?.id, 'food_delivery', g);
    }
    // موقع مطعم واحد تعريفي ليس نمط التوصيل → لا يُلتقط
    assert.notEqual(matchBlueprint('موقع تعريفي لمطعمي')?.id, 'food_delivery');
});

test('مخطط التوصيل: 4 أدوار + سلة عاملة + خريطة مندوب', () => {
    const block = buildBlueprintPrompt('تطبيق توصيل طعام من مطاعم متعددة');
    assert.match(block, /Talabat|Uber Eats/);
    assert.match(block, /المطعم|المندوب/);
    assert.match(block, /سلة تعمل بالكامل|رسوم التوصيل/);
    assert.match(block, /Leaflet/);
});

test('لا نمط مطابق → null (لا حقن عشوائي)', () => {
    assert.equal(matchBlueprint('موقع تعريفي لمخبز'), null);
    assert.equal(matchBlueprint(''), null);
    assert.equal(matchBlueprint('portfolio شخصي'), null);
});

test('مخطط التاكسي: أدوار منفصلة + خريطة Leaflet + دخول منفصل', () => {
    const block = buildBlueprintPrompt('ابني موقع تاكسي مكتمل');
    assert.match(block, /معمارية مرجعية/);
    assert.match(block, /Uber|Careem/);
    assert.match(block, /العميل|السائق|الإدارة/);
    assert.match(block, /Leaflet/);
    assert.match(block, /صفحة دخول منفصلة|صفحة الدخول المنفصلة|دخول منفصل/);
    assert.match(block, /حاسبة أجرة/);
});

test('لوحة SaaS تقترح Chart.js؛ الطيران بلا مكتبات (أخفّ = أسرع)', () => {
    assert.match(buildBlueprintPrompt('saas dashboard analytics'), /Chart\.js/);
    const flights = buildBlueprintPrompt('flight booking engine');
    assert.match(flights, /بلا مكتبات خارجية/);
    assert.doesNotMatch(flights, /unpkg|jsdelivr/);
});

test('كل مخطط له صفحات ومكوّنات وظيفية (اكتمال البنية)', () => {
    for (const bp of BLUEPRINTS) {
        assert.ok(bp.pages.length >= 3, `${bp.id} صفحات`);
        assert.ok(bp.components.length >= 2, `${bp.id} مكوّنات`);
        assert.ok(bp.reference, `${bp.id} مرجع`);
    }
});

test('كتلة المولّد تُشدّد على "يعمل فعلاً" لا واجهة ثابتة', () => {
    const block = buildBlueprintPrompt('ابني تطبيق تاكسي');
    assert.match(block, /يعمل فعلاً|تعمل بـ JS|ليست عناصر عرض/);
});
