// 📚 المعرفة التراكمية عبر المشاريع: مشروع ناجح يُغني فهم فئته، والمشروع
// الجديد يُبذَر من ذلك الفهم بدل البدء من الصفر.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLibraryModel, recordModel, librarySummary, _resetForTest } from '../agents/modelLibrary.js';

test('فئة جديدة بلا مساهمات → لا نموذج (null)', () => {
    _resetForTest();
    assert.equal(getLibraryModel('restaurant'), null);
});

test('recordModel ثم getLibraryModel: يُسترجع الفهم المُسجّل', () => {
    _resetForTest();
    recordModel('restaurant', {
        entities: [{ name: 'Order', fields: [{ name: 'id', type: 'string' }] }],
        roles: [{ name: 'Customer' }, { name: 'RestaurantOwner' }],
        flows: [{ name: 'تقديم طلب' }],
    }, { verified: true });
    const m = getLibraryModel('restaurant');
    assert.ok(m.entities.some(e => e.name === 'Order'));
    assert.ok(m.roles.some(r => r.name === 'RestaurantOwner'));
});

test('التراكم عبر المشاريع: مساهمتان تتّحدان في نموذج فئة أغنى', () => {
    _resetForTest();
    recordModel('restaurant', { entities: [{ name: 'Order', fields: [{ name: 'id', type: 'string' }] }], roles: [{ name: 'Customer' }] });
    recordModel('restaurant', { entities: [{ name: 'Order', fields: [{ name: 'status', type: 'string' }] }, { name: 'Driver' }], roles: [{ name: 'Driver' }] });
    const m = getLibraryModel('restaurant');
    const order = m.entities.find(e => e.name === 'Order');
    assert.deepEqual(order.fields.map(f => f.name), ['id', 'status'], 'حقول Order اتّحدت عبر مشروعين');
    assert.ok(m.entities.some(e => e.name === 'Driver'), 'كيان من المشروع الثاني أُضيف');
    assert.equal(librarySummary().find(s => s.category === 'restaurant').contributions, 2);
});

test('الفئات معزولة: متجر لا يلوّث مطعماً', () => {
    _resetForTest();
    recordModel('ecommerce', { entities: [{ name: 'Product' }], roles: [{ name: 'Seller' }] });
    assert.equal(getLibraryModel('restaurant'), null, 'فئة أخرى غير متأثّرة');
    assert.ok(getLibraryModel('ecommerce').entities.some(e => e.name === 'Product'));
});

test('لا نحفظ فراغاً (نموذج بلا كيانات/أدوار يُتجاهل)', () => {
    _resetForTest();
    assert.equal(recordModel('restaurant', { entities: [], roles: [], flows: [] }), null);
    assert.equal(getLibraryModel('restaurant'), null);
});

test('عدّاد التحقّق: يميّز المساهمات المُجرَّبة', () => {
    _resetForTest();
    recordModel('saas', { roles: [{ name: 'Admin' }] }, { verified: true });
    recordModel('saas', { roles: [{ name: 'User' }] }, { verified: false });
    const s = librarySummary().find(x => x.category === 'saas');
    assert.equal(s.contributions, 2);
    assert.equal(s.verified, 1);
});

test('الفئة الفارغة/undefined تُطبّع إلى other', () => {
    _resetForTest();
    recordModel(undefined, { entities: [{ name: 'Item' }] });
    assert.ok(getLibraryModel(undefined).entities.some(e => e.name === 'Item'));
    assert.ok(getLibraryModel('other').entities.some(e => e.name === 'Item'));
});
