// 🤖 budgetCommentary: وكيل ضيّق يصف نمط الإنفاق — llm قابل للحقن (لا حاجة لمحاكاة smartChat).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBudgetCommentary, resetBudgetCommentaryCache } from '../services/budgetCommentary.js';

const DATA = { periodLabel: 'هذا الشهر', income: 5000, expense: 3000, net: 2000, categories: [{ category: 'طعام', amount: 1000 }, { category: 'سكن', amount: 900 }] };

test('generateBudgetCommentary: نجاح → يعيد نص اللغة نظيفاً (مقلّماً)', async () => {
    resetBudgetCommentaryCache();
    const llm = async () => '  دخلك يفوق مصروفك هذا الشهر بفارق جيد.  ';
    const text = await generateBudgetCommentary(DATA, llm);
    assert.equal(text, 'دخلك يفوق مصروفك هذا الشهر بفارق جيد.');
});

test('generateBudgetCommentary: يمرّر الأرقام والفئات الصحيحة لنموذج اللغة', async () => {
    resetBudgetCommentaryCache();
    let seenUser = null;
    const llm = async (messages) => { seenUser = JSON.parse(messages[1].content); return 'نص'; };
    await generateBudgetCommentary(DATA, llm);
    assert.equal(seenUser.income, 5000);
    assert.equal(seenUser.expense, 3000);
    assert.equal(seenUser.net, 2000);
    assert.equal(seenUser.topCategories.length, 2);
    assert.equal(seenUser.topCategories[0].category, 'طعام');
});

test('generateBudgetCommentary: أكثر من 3 فئات → لا يُرسَل للنموذج سوى أعلى 3', async () => {
    resetBudgetCommentaryCache();
    let seenUser = null;
    const llm = async (messages) => { seenUser = JSON.parse(messages[1].content); return 'نص'; };
    const cats = [1, 2, 3, 4, 5].map(i => ({ category: 'فئة' + i, amount: i }));
    await generateBudgetCommentary({ ...DATA, categories: cats }, llm);
    assert.equal(seenUser.topCategories.length, 3);
});

test('generateBudgetCommentary: lang=en → system prompt إنجليزي بلا عربية', async () => {
    resetBudgetCommentaryCache();
    let seenSystem = null;
    const llm = async (messages) => { seenSystem = messages[0].content; return 'Your spending is well within income this month.'; };
    const text = await generateBudgetCommentary({ ...DATA, lang: 'en' }, llm);
    assert.match(seenSystem, /English sentences/);
    assert.doesNotMatch(seenSystem, /[؀-ۿ]/, 'system prompt إنجليزي بلا عربية');
    assert.equal(text, 'Your spending is well within income this month.');
});

test('generateBudgetCommentary: lang غائبة أو غير en → عربي افتراضياً', async () => {
    resetBudgetCommentaryCache();
    let seenSystem = null;
    const llm = async (messages) => { seenSystem = messages[0].content; return 'نص'; };
    await generateBudgetCommentary({ ...DATA, lang: undefined }, llm);
    assert.match(seenSystem, /مساعد مالي/);
});

test('generateBudgetCommentary: نفس السياق بلغتين → مفتاح كاش مستقلّ (لا تسريب)', async () => {
    resetBudgetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'text ' + calls; };
    const ar = await generateBudgetCommentary({ ...DATA, lang: 'ar' }, llm);
    const en = await generateBudgetCommentary({ ...DATA, lang: 'en' }, llm);
    assert.equal(calls, 2);
    assert.notEqual(ar, en);
});

test('generateBudgetCommentary: فشل النموذج → null بدل رمي خطأ', async () => {
    resetBudgetCommentaryCache();
    const llm = async () => { throw new Error('quota exceeded'); };
    assert.equal(await generateBudgetCommentary(DATA, llm), null);
});

test('generateBudgetCommentary: ردّ فارغ من النموذج → null', async () => {
    resetBudgetCommentaryCache();
    const llm = async () => '   ';
    assert.equal(await generateBudgetCommentary(DATA, llm), null);
});

test('generateBudgetCommentary: بلا income/expense → null فوراً بلا استدعاء النموذج', async () => {
    resetBudgetCommentaryCache();
    const llm = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    assert.equal(await generateBudgetCommentary({ ...DATA, income: null }, llm), null);
    assert.equal(await generateBudgetCommentary({ ...DATA, expense: undefined }, llm), null);
});

test('generateBudgetCommentary: نداء ثانٍ لنفس السياق ضمن مهلة الكاش لا يستدعي النموذج مجدداً', async () => {
    resetBudgetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'ثابت'; };
    const first = await generateBudgetCommentary(DATA, llm);
    const second = await generateBudgetCommentary(DATA, llm);
    assert.equal(calls, 1);
    assert.equal(second, first);
});

test('generateBudgetCommentary: تغيّر الأرقام يُبطل الكاش (سياق مختلف يستحق تعليقاً جديداً)', async () => {
    resetBudgetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'تعليق ' + calls; };
    await generateBudgetCommentary({ ...DATA, expense: 3000 }, llm);
    await generateBudgetCommentary({ ...DATA, expense: 4000 }, llm);
    assert.equal(calls, 2);
});

test('generateBudgetCommentary: فشل بعد نجاح سابق (كاش لا يزال سارياً) → يعيد آخر نص معروف بدل null', async () => {
    resetBudgetCommentaryCache();
    const okLlm = async () => 'تحليل معروف';
    const first = await generateBudgetCommentary(DATA, okLlm);
    assert.equal(first, 'تحليل معروف');
    const failLlm = async () => { throw new Error('نداء لا ينبغي أن يحدث ضمن الكاش'); };
    const second = await generateBudgetCommentary(DATA, failLlm);
    assert.equal(second, 'تحليل معروف');
});
