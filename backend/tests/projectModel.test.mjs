// 🧩 طبقة الفهم: نموذج المشروع (كيانات + أدوار + تدفّقات) — يُبنى، يُحفظ،
// يتراكم، ويُحقن في التوليد. هذه اختبارات الدوال النقية + مسار الاحتياط.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeProjectModel,
    deriveProjectModel,
    mergeProjectModel,
    buildProjectModelContext,
    summarizeModel,
} from '../agents/projectModel.js';

test('normalize: يحصّن الشكل ويحدّ الأحجام ويستبعد الفاسد', () => {
    const m = normalizeProjectModel({
        entities: [{ name: 'Order', fields: [{ name: 'id', type: 'string' }, { bad: true }], ownedBy: 'Customer' }, { junk: 1 }],
        roles: [{ name: 'Customer', capabilities: ['يطلب', '', null] }],
        flows: [{ name: 'تقديم طلب', actor: 'Customer', touches: ['Order'], realtime: true }],
    });
    assert.equal(m.entities.length, 1, 'الكيان الفاسد بلا اسم يُستبعد');
    assert.equal(m.entities[0].fields.length, 2, 'الحقل الفاسد يُطبّع لا يُسقط الكيان');
    assert.equal(m.roles[0].capabilities.length, 1, 'الصلاحيات الفارغة تُصفّى');
    assert.equal(m.flows[0].realtime, true);
});

test('deriveProjectModel: chat مُحقَن ينتج نموذجاً مُطبّعاً', async () => {
    const fakeChat = async () => JSON.stringify({
        entities: [{ name: 'Order', fields: [{ name: 'status', type: 'string' }], ownedBy: 'Customer' }],
        roles: [{ name: 'Customer' }, { name: 'RestaurantOwner' }],
        flows: [{ name: 'تقديم طلب', actor: 'Customer', touches: ['Order'], realtime: true }],
    });
    const m = await deriveProjectModel('تطبيق مطعم', { category: 'restaurant' }, { chat: fakeChat });
    assert.equal(m._source, 'llm');
    assert.equal(m.roles.length, 2, 'دوران: زبون + صاحب مطعم');
    assert.equal(m.entities[0].name, 'Order');
});

test('deriveProjectModel: فشل الـ chat → احتياطي حسب الفئة (مطعم)', async () => {
    const boom = async () => { throw new Error('no LLM'); };
    const m = await deriveProjectModel('تطبيق مطعم لاستقبال الطلبات', { category: 'restaurant' }, { chat: boom });
    assert.equal(m._source, 'fallback');
    assert.ok(m.entities.some(e => e.name === 'Order'), 'الاحتياطي يعرف كيان Order');
    assert.ok(m.roles.some(r => r.name === 'RestaurantOwner'), 'الاحتياطي يعرف دور صاحب المطعم');
    assert.ok(m.flows.some(f => f.realtime), 'تدفّق الطلب لحظي');
});

test('deriveProjectModel: JSON غير صالح → احتياطي لا انهيار', async () => {
    const bad = async () => 'ليس JSON';
    const m = await deriveProjectModel('أداة', { category: 'other' }, { chat: bad });
    assert.equal(m._source, 'fallback');
    assert.ok(m.roles.length >= 1);
});

test('merge: الفهم يتراكم — كيانات/أدوار جديدة تُضاف والحقول تُدمج', () => {
    const v1 = normalizeProjectModel({
        entities: [{ name: 'Order', fields: [{ name: 'id', type: 'string' }] }],
        roles: [{ name: 'Customer', capabilities: ['يطلب'] }],
        flows: [{ name: 'تقديم طلب' }],
    });
    const v2 = {
        entities: [{ name: 'Order', fields: [{ name: 'status', type: 'string' }] }, { name: 'Driver', fields: [] }],
        roles: [{ name: 'Customer', capabilities: ['يتابع'] }, { name: 'Driver' }],
        flows: [{ name: 'توصيل', actor: 'Driver' }],
    };
    const merged = mergeProjectModel(v1, v2);
    const order = merged.entities.find(e => e.name === 'Order');
    assert.deepEqual(order.fields.map(f => f.name), ['id', 'status'], 'حقول Order اتّحدت');
    assert.ok(merged.entities.some(e => e.name === 'Driver'), 'كيان جديد أُضيف');
    const cust = merged.roles.find(r => r.name === 'Customer');
    assert.deepEqual(cust.capabilities, ['يطلب', 'يتابع'], 'صلاحيات الدور اتّحدت بلا تكرار');
    assert.equal(merged.flows.length, 2, 'تدفّق جديد أُضيف');
});

test('buildContext: يحقن الكيانات والأدوار والتدفّقات + القواعد الإلزامية', () => {
    const ctx = buildProjectModelContext({
        entities: [{ name: 'Order', fields: [{ name: 'status', type: 'string' }], ownedBy: 'Customer' }],
        roles: [{ name: 'Customer' }, { name: 'RestaurantOwner' }],
        flows: [{ name: 'تقديم طلب', actor: 'Customer', steps: ['يطلب', 'يصل للمطعم'], touches: ['Order'], realtime: true }],
    });
    assert.match(ctx, /Domain Model/);
    assert.match(ctx, /Order/);
    assert.match(ctx, /RestaurantOwner/);
    assert.match(ctx, /⚡لحظي/, 'يعلّم التدفّق اللحظي');
    assert.match(ctx, /أكثر من دور/, 'يفرض بناء منظور كل دور');
});

test('buildContext: نموذج فارغ → نص فارغ (لا حقن ضوضاء)', () => {
    assert.equal(buildProjectModelContext(null), '');
    assert.equal(buildProjectModelContext({ entities: [], roles: [], flows: [] }), '');
});

test('summarize: ملخّص مقروء', () => {
    const s = summarizeModel({ entities: [{ name: 'Order' }], roles: [{ name: 'Customer' }], flows: [{ name: 'x' }] });
    assert.match(s, /1 كيان/);
    assert.match(s, /Order/);
    assert.match(s, /Customer/);
});
