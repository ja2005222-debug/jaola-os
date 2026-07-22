// 🌱 بصمة بيانات العيّنة: تخصيص مصفوفة البيانات وحدها دون مساس بالدوال —
// الحلّ الجذري لـ«التخصيص لا يحدث» (لا إعادة كتابة كاملة تُبتَر).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSeedArrays, primarySeedArray, extractArrayLiteral, validateSeedLiteral, spliceSeed, stampSeed } from '../agents/seedStamp.js';
import { extractDefinedFunctions, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

const APP = jaolaStore().files.find(f => f.name === 'app.js').content;
const HTML = jaolaStore().files.find(f => f.name === 'index.html').content;

test('findSeedArrays: يجد PRODUCTS بأقواس متوازنة (يتخطّى النصوص)', () => {
    const arrays = findSeedArrays(APP);
    const products = arrays.find(a => a.name === 'PRODUCTS');
    assert.ok(products, 'وجد PRODUCTS');
    // المصفوفة المستخرجة صالحة بنيوياً (تُقيَّم كمصفوفة كائنات)
    // eslint-disable-next-line no-new-func
    const arr = Function('"use strict";return (' + products.literal + ')')();
    assert.ok(Array.isArray(arr) && arr.length === 8, '8 منتجات');
    assert.ok('id' in arr[0] && 'price' in arr[0], 'المفاتيح موجودة');
});

test('primarySeedArray: يختار الأغنى (PRODUCTS لا CATEGORIES)', () => {
    assert.equal(primarySeedArray(APP).name, 'PRODUCTS');
});

test('validateSeedLiteral: نفس المفاتيح يمرّ، نقص مفتاح يُرفض', () => {
    const orig = '[{ id:1, name:"a", price:5 }]';
    assert.equal(validateSeedLiteral('[{ id:2, name:"عطر", price:200 }]', orig), true);
    assert.equal(validateSeedLiteral('[{ id:2, name:"عطر" }]', orig), false, 'ينقص price');
    assert.equal(validateSeedLiteral('ليس مصفوفة', orig), false);
    assert.equal(validateSeedLiteral('[]', orig), false, 'فارغة');
});

test('extractArrayLiteral: يلتقط المصفوفة وسط شرح/أسوار', () => {
    assert.equal(extractArrayLiteral('هذا ردّي: [1,2,3] انتهى'), '[1,2,3]');
    assert.equal(extractArrayLiteral('بلا مصفوفة'), null);
});

test('stampSeed: يخصّص PRODUCTS لعطور بلا فقد أي دالة (chat محقون)', async () => {
    const seed = primarySeedArray(APP);
    // chat وهمي: يعيد نفس البنية بقيَم عطور (نفس المفاتيح)
    const chat = async () => `[
      { id: 'p1', name: 'عطر باريسي فاخر', cat: 'عطور', price: 480, rating: 4.9, emoji: '🧴', stock: 10, desc: 'عطر شرقي فرنسي بثبات عالٍ.' },
      { id: 'p2', name: 'عود ملكي', cat: 'عطور', price: 950, rating: 4.8, emoji: '🌸', stock: 6, desc: 'عود كمبودي أصيل.' }
    ]`;
    const files = [{ name: 'app.js', content: APP }];
    const res = await stampSeed(files, 'متجر عطور باريسية فاخرة', { chat, category: 'ecommerce' });
    assert.equal(res.ok, true, 'نجح التخصيص');
    const newApp = res.files.find(f => f.name === 'app.js').content;
    // البيانات تغيّرت
    assert.ok(newApp.includes('عطر باريسي فاخر'), 'المنتجات صارت عطوراً');
    assert.ok(!newApp.includes('سماعات لاسلكية'), 'المنتجات القديمة استُبدلت');
    // لا دالة فُقدت ولا تعليق كُسر
    const before = new Set(extractDefinedFunctions(APP));
    const after = new Set(extractDefinedFunctions(newApp));
    const lost = [...before].filter(n => !after.has(n));
    assert.deepEqual(lost, [], 'كل الدوال محفوظة (handleInput/handleChange/init…)');
    assert.deepEqual(detectUndefinedFunctions({ html: HTML, js: newApp }), [], 'بلا دوال معلّقة بعد التخصيص');
});

test('stampSeed: ردّ فاسد (مفتاح ناقص) → ok:false (يُبقي الأصل)', async () => {
    const chat = async () => '[{ id: 1, name: "ناقص" }]'; // ينقص مفاتيح
    const res = await stampSeed([{ name: 'app.js', content: APP }], 'أي شيء', { chat });
    assert.equal(res.ok, false);
});

test('stampSeed: بلا goal أو chat → ok:false', async () => {
    assert.equal((await stampSeed([{ name: 'app.js', content: APP }], '', { chat: async () => '[]' })).ok, false);
    assert.equal((await stampSeed([{ name: 'app.js', content: APP }], 'goal', {})).ok, false);
});
