// 🍔 كلون توصيل الطعام: تطبيق *عامل* — يجب أن يجتاز التحقّق السلوكي 100%
// (لا دوال معلّقة، كل الأدوار ممثّلة، التفاعل يعمل، لا سكربت مفقود).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { foodDeliveryClone } from '../agents/cloneTemplates/foodDelivery.js';
import { matchCloneTemplate, listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { verifyBehavior, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';

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
    assert.ok(c && c.id === 'food-delivery');
});

test('matchCloneTemplate: بروشور/موقع بسيط → لا كلون (لا فرض)', () => {
    assert.equal(matchCloneTemplate('موقع تعريفي لمطعم', { category: 'restaurant', kind: 'brochure' }, null), null);
    assert.equal(matchCloneTemplate('صفحة هبوط لمنتج', { category: 'saas', kind: 'landing' }, null), null);
});

test('listClones + getCloneById: بيانات العرض والاسترجاع', () => {
    const list = listClones();
    assert.ok(list.some(c => c.id === 'food-delivery' && c.roles.includes('Customer')));
    assert.equal(getCloneById('food-delivery')?.id, 'food-delivery');
    assert.equal(getCloneById('nope'), null);
});
