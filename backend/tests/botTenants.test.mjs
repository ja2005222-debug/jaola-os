// 🤖 مستأجرو جولا بوت المستقلّون: توليد معرّف + تنقية إعداد (بلا Mongo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genTenantId, isValidTenantId, sanitizeTenantConfig } from '../services/botTenants.js';

test('genTenantId: معرّف hex عشوائي بطول ثابت، وكل استدعاء مختلف', () => {
    const a = genTenantId(), b = genTenantId();
    assert.ok(isValidTenantId(a));
    assert.ok(isValidTenantId(b));
    assert.notEqual(a, b);
});

test('isValidTenantId: يرفض الأشكال غير الصالحة', () => {
    assert.ok(!isValidTenantId(''));
    assert.ok(!isValidTenantId('not-hex-!!'));
    assert.ok(!isValidTenantId('abc')); // قصير جداً
    assert.ok(!isValidTenantId(genTenantId().toUpperCase())); // أحرف كبيرة مرفوضة
});

test('sanitizeTenantConfig: قيم افتراضية عند إدخال فارغ', () => {
    const c = sanitizeTenantConfig({});
    assert.equal(c.brandName, 'مساعدك');
    assert.equal(c.emoji, '🤖');
    assert.equal(c.color, '#3b82f6');
    assert.deepEqual(c.faq, []);
    assert.deepEqual(c.quick, []);
    assert.equal(c.apiEnabled, true);
});

test('sanitizeTenantConfig: يسقف الأطوال والأعداد مطابقاً حدود jaolaBot.js', () => {
    const c = sanitizeTenantConfig({
        brandName: 'ن'.repeat(200),
        emoji: '😀😀😀😀😀😀',
        welcome: 'م'.repeat(1000),
        faq: Array.from({ length: 30 }, (_, i) => ({ q: 'س'.repeat(300), a: 'ج'.repeat(900) })),
        quick: ['1', '2', '3', '4', '5', '6'],
    });
    assert.equal(c.brandName.length, 40);
    assert.equal(c.emoji.length, 4);
    assert.equal(c.welcome.length, 300);
    assert.equal(c.faq.length, 20);
    assert.equal(c.faq[0].q.length, 200);
    assert.equal(c.faq[0].a.length, 600);
    assert.equal(c.quick.length, 4);
});

test('sanitizeTenantConfig: يتجاهل عناصر FAQ الناقصة، ويرفض لوناً غير صالح', () => {
    const c = sanitizeTenantConfig({
        faq: [{ q: 'سؤال' }, { a: 'جواب بلا سؤال' }, { q: 'ok', a: 'ok' }],
        color: 'not-a-color',
    });
    assert.equal(c.faq.length, 1);
    assert.equal(c.color, '#3b82f6');
});

test('sanitizeTenantConfig: apiEnabled=false يبقى false (ثابت لا ذكاء حيّ)', () => {
    assert.equal(sanitizeTenantConfig({ apiEnabled: false }).apiEnabled, false);
});
