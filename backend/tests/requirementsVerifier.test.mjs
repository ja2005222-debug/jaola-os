// 📋 حلقة تحقق المتطلبات (#66): الميزات تُنفَّذ فعلاً لا زخرفياً،
// والقائمة صادقة — "أُصلح" فقط بعد إعادة تحقق فعلية.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRequirements, buildFixInstruction, formatChecklist } from '../agents/requirementsVerifier.js';

const bp = { functionalComponents: [
    { name: 'بحث الرحلات', behavior: 'يصفي رحلات من بيانات وهمية' },
    { name: 'نموذج الحجز', behavior: 'يتحقق ويعرض تأكيداً' },
]};
const files = [{ name: 'index.html', content: '<html>...</html>' }, { name: 'script.js', content: 'function searchTrips(){}' }];
const mock = (json) => async () => JSON.stringify(json);
const mixed = mock({ results: [
    { name: 'بحث الرحلات', implemented: true, reason: 'searchTrips يصفي فعلاً' },
    { name: 'نموذج الحجز', implemented: false, reason: 'لا يوجد معالج submit', fixInstruction: 'أضف دالة bookTrip في script.js' },
]});

test('تحليل نتيجة مختلطة: منفّذ وناقص', async () => {
    const v = await verifyRequirements(bp, files, mixed);
    assert.equal(v.implementedCount, 1);
    assert.equal(v.missing.length, 1);
});

test('تعليمة الإصلاح المجمّعة تشمل الناقص وتعليمته', async () => {
    const v = await verifyRequirements(bp, files, mixed);
    const fix = buildFixInstruction(v.missing);
    assert.match(fix, /نموذج الحجز/);
    assert.match(fix, /bookTrip/);
});

test('القائمة: ✅ للمنفّذ و🔧 للمُصلح المؤكد فقط', async () => {
    const v = await verifyRequirements(bp, files, mixed);
    const cl = formatChecklist(v, 'ar', ['نموذج الحجز']);
    assert.match(cl, /✅ بحث الرحلات/);
    assert.match(cl, /🔧 نموذج الحجز/);
});

test('القائمة: ⚠️ للناقص غير المؤكد إصلاحه (صدق كامل)', async () => {
    const v = await verifyRequirements(bp, files, mixed);
    const cl = formatChecklist(v, 'ar', []);
    assert.match(cl, /⚠️ نموذج الحجز/);
});

test('كل أشكال الفشل → null بلا انهيار', async () => {
    assert.equal(await verifyRequirements(bp, files, async () => 'ليس json'), null);
    assert.equal(await verifyRequirements(bp, files, async () => { throw new Error('x'); }), null);
    assert.equal(await verifyRequirements({ functionalComponents: [] }, files), null);
    assert.equal(await verifyRequirements(bp, [], () => { throw new Error('no'); }), null);
});

test('النتائج المشوهة تُرشّح وimplemented غير الصريح = false', async () => {
    const v = await verifyRequirements(bp, files, mock({ results: [{ name: 'بحث الرحلات', implemented: 'yes' }, { bad: true }] }));
    assert.equal(v.results.length, 1);
    assert.equal(v.results[0].implemented, false);
});
