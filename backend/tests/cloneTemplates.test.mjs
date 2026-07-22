// 🍔 كلون توصيل الطعام: تطبيق *عامل* — يجب أن يجتاز التحقّق السلوكي 100%
// (لا دوال معلّقة، كل الأدوار ممثّلة، التفاعل يعمل، لا سكربت مفقود).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { foodDeliveryClone } from '../agents/cloneTemplates/foodDelivery.js';
import { jaolaWeather } from '../agents/cloneTemplates/jaolaWeather.js';
import { jaolaCrypto } from '../agents/cloneTemplates/jaolaCrypto.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';
import { jaolaBooking } from '../agents/cloneTemplates/jaolaBooking.js';
import { matchCloneTemplate, listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { verifyBehavior, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';

// كل قوالب jaola يجب أن تجتاز التحقّق السلوكي فعلاً (jsdom) — لا دوال معلّقة،
// ولا انهيار حتى مع كتم fetch (قوالب الـ API تصمد بالوصول المحميّ).
for (const build of [foodDeliveryClone, jaolaStore, jaolaBooking, jaolaWeather, jaolaCrypto]) {
    const c = build();
    test(`قالب ${c.id}: لا دوال معلّقة`, () => {
        const html = c.files.find(f => f.name === 'index.html').content;
        const js = c.files.find(f => f.name === 'app.js').content;
        assert.deepEqual(detectUndefinedFunctions({ html, js }), [], `${c.id}: كل الدوال معرّفة`);
    });
    test(`قالب ${c.id}: يجتاز التحقّق السلوكي (jsdom)`, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-tpl-'));
        for (const f of c.files) fs.writeFileSync(path.join(dir, f.name), f.content);
        const v = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] }, domainModel: c.model });
        assert.equal(v.ran, true);
        const byName = Object.fromEntries(v.checks.map(x => [x.name, x.status]));
        assert.notEqual(byName['no-js-errors'], 'fail', `${c.id}: بلا أخطاء JS`);
        assert.notEqual(byName['wiring-complete'], 'fail', `${c.id}: بلا دوال معلّقة`);
        assert.notEqual(byName['missing-script'], 'fail', `${c.id}: app.js موجود`);
        assert.equal(v.ok, true, `${c.id}: يعمل — ${v.summary}`);
        fs.rmSync(dir, { recursive: true, force: true });
    });
}

test('قوالب API خارجي: طقس + عملات مسجّلة مع externalApi', () => {
    const list = listClones();
    assert.ok(list.find(c => c.id === 'jaola-weather')?.externalApi, 'weather API');
    assert.ok(list.find(c => c.id === 'jaola-crypto')?.externalApi, 'crypto API');
    assert.ok(list.find(c => c.id === 'jaola-delivery'), 'delivery مُعاد التسمية');
});

test('matchCloneTemplate: هدف طقس → jaola-weather', () => {
    const c = matchCloneTemplate('تطبيق طقس ومناخ', { category: 'tool', kind: 'tool' }, null);
    assert.equal(c?.id, 'jaola-weather');
});

test('matchCloneTemplate: متجر إلكتروني → jaola-store', () => {
    const c = matchCloneTemplate('متجر إلكتروني لبيع المنتجات مع سلة',
        { category: 'ecommerce', kind: 'webapp' }, { roles: [{ name: 'Customer' }] });
    assert.equal(c?.id, 'jaola-store');
});

test('matchCloneTemplate: حجز مواعيد → jaola-booking', () => {
    const c = matchCloneTemplate('تطبيق حجز مواعيد لعيادة',
        { category: 'appointments', kind: 'webapp' }, { roles: [{ name: 'Customer' }, { name: 'Admin' }] });
    assert.equal(c?.id, 'jaola-booking');
});

test('كلون التوصيل: لا دوال معلّقة (كل مرجع معرّف)', () => {
    const c = foodDeliveryClone();
    const html = c.files.find(f => f.name === 'index.html').content;
    const js = c.files.find(f => f.name === 'app.js').content;
    assert.deepEqual(detectUndefinedFunctions({ html, js }), [], 'لا قشرة — كل الدوال معرّفة');
});

test('كلون التوصيل: يجتاز التحقّق السلوكي فعلاً (jsdom)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-clone-'));
    const c = foodDeliveryClone();
    for (const f of c.files) fs.writeFileSync(path.join(dir, f.name), f.content);
    const verdict = await verifyBehavior({
        projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'order' }] }, domainModel: c.model,
    });
    assert.equal(verdict.ran, true, 'شُغّل في jsdom');
    const byName = Object.fromEntries(verdict.checks.map(c => [c.name, c.status]));
    assert.notEqual(byName['no-js-errors'], 'fail', 'بلا أخطاء JS');
    assert.notEqual(byName['wiring-complete'], 'fail', 'بلا دوال معلّقة');
    assert.notEqual(byName['role-coverage'], 'fail', 'كل الأدوار ممثّلة');
    assert.notEqual(byName['missing-script'], 'fail', 'app.js موجود (لا سكربت مفقود)');
    assert.equal(verdict.ok, true, 'الحكم النهائي: يعمل — ' + verdict.summary);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('matchCloneTemplate: هدف توصيل طعام (تطبيق) → كلون التوصيل', () => {
    const c = matchCloneTemplate('تطبيق توصيل طعام من مطاعم متعددة',
        { category: 'restaurant', kind: 'webapp' }, { roles: [{ name: 'Customer' }, { name: 'Restaurant' }] });
    assert.ok(c && c.id === 'jaola-delivery');
});

test('matchCloneTemplate: هدف ضعيف (اكمل) + نموذج محفوظ توصيل → يطابق بالنموذج', () => {
    // سجل المستخدم: delev قائم، الهدف «اكمل» بلا كلمات، لكن النموذج المحفوظ
    // يحمل هوية المشروع (Order/Restaurant/Customer/Driver) → يجب أن يطابق.
    const c = matchCloneTemplate('اكمل', { category: 'other', kind: 'webapp' }, {
        entities: [{ name: 'Order' }, { name: 'Restaurant' }, { name: 'MenuItem' }],
        roles: [{ name: 'Customer' }, { name: 'Driver' }],
    });
    assert.ok(c && c.id === 'jaola-delivery', 'طابق بالنموذج رغم ضعف الهدف');
});

test('matchCloneTemplate: بروشور/موقع بسيط → لا كلون (لا فرض)', () => {
    assert.equal(matchCloneTemplate('موقع تعريفي لمطعم', { category: 'restaurant', kind: 'brochure' }, null), null);
    assert.equal(matchCloneTemplate('صفحة هبوط لمنتج', { category: 'saas', kind: 'landing' }, null), null);
});

test('listClones + getCloneById: بيانات العرض والاسترجاع', () => {
    const list = listClones();
    assert.ok(list.some(c => c.id === 'jaola-delivery' && c.roles.includes('Customer')));
    assert.equal(getCloneById('jaola-delivery')?.id, 'jaola-delivery');
    assert.equal(getCloneById('nope'), null);
});
