// 🤖 stockCommentary: وكيل ضيّق يكتب جملتين/ثلاثاً تفسّر أرقام تحليل سهم/فوركس.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStockCommentary, resetStockCommentaryCache } from '../services/stockCommentary.js';

const DATA = { id: 'AAPL', symbol: 'AAPL', price: 190, smaShort: 188, smaLong: 180, rsi: 55, signal: 'buy', reasonCode: 'sma_bullish', timeframe: 'week' };

test('generateStockCommentary: نجاح → يعيد نص اللغة نظيفاً (مقلّماً)', async () => {
    resetStockCommentaryCache();
    const llm = async () => '  سهم أبل يُظهر زخماً صاعداً حسب المتوسطات.  ';
    const text = await generateStockCommentary(DATA, llm);
    assert.equal(text, 'سهم أبل يُظهر زخماً صاعداً حسب المتوسطات.');
});

test('generateStockCommentary: يمرّر الأرقام الصحيحة لنموذج اللغة', async () => {
    resetStockCommentaryCache();
    let seenUser = null;
    const llm = async (messages) => { seenUser = JSON.parse(messages[1].content); return 'نص'; };
    await generateStockCommentary(DATA, llm);
    assert.equal(seenUser.symbol, 'AAPL');
    assert.equal(seenUser.price, 190);
    assert.equal(seenUser.signal, 'شراء');
    assert.equal(seenUser.timeframe, 'أسبوعي');
});

test('generateStockCommentary: مدى مختلف لنفس (id+signal+reasonCode) → مفتاح كاش مستقلّ', async () => {
    resetStockCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'تعليق ' + calls; };
    await generateStockCommentary({ ...DATA, timeframe: 'week' }, llm);
    await generateStockCommentary({ ...DATA, timeframe: 'long' }, llm);
    assert.equal(calls, 2);
});

test('generateStockCommentary: lang=en → system prompt إنجليزي بلا عربية', async () => {
    resetStockCommentaryCache();
    let seenSystem = null, seenUser = null;
    const llm = async (messages) => { seenSystem = messages[0].content; seenUser = JSON.parse(messages[1].content); return 'Momentum looks bullish.'; };
    const text = await generateStockCommentary({ ...DATA, lang: 'en' }, llm);
    assert.match(seenSystem, /English sentences/);
    assert.doesNotMatch(seenSystem, /[؀-ۿ]/);
    assert.equal(seenUser.signal, 'Buy');
    assert.equal(seenUser.timeframe, 'weekly');
    assert.equal(text, 'Momentum looks bullish.');
});

test('generateStockCommentary: lang غائبة أو غير en → عربي افتراضياً', async () => {
    resetStockCommentaryCache();
    let seenSystem = null;
    const llm = async (messages) => { seenSystem = messages[0].content; return 'نص'; };
    await generateStockCommentary({ ...DATA, lang: undefined }, llm);
    assert.match(seenSystem, /محلّل بيانات/);
});

test('generateStockCommentary: نفس السياق بلغتين مختلفتين → مفتاح كاش مستقلّ', async () => {
    resetStockCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'text ' + calls; };
    const ar = await generateStockCommentary({ ...DATA, lang: 'ar' }, llm);
    const en = await generateStockCommentary({ ...DATA, lang: 'en' }, llm);
    assert.equal(calls, 2);
    assert.notEqual(ar, en);
});

test('generateStockCommentary: فشل النموذج → null بدل رمي خطأ', async () => {
    resetStockCommentaryCache();
    const llm = async () => { throw new Error('quota exceeded'); };
    assert.equal(await generateStockCommentary(DATA, llm), null);
});

test('generateStockCommentary: بلا id/إشارة → null فوراً بلا استدعاء النموذج', async () => {
    resetStockCommentaryCache();
    const llm = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    assert.equal(await generateStockCommentary({ ...DATA, id: null }, llm), null);
    assert.equal(await generateStockCommentary({ ...DATA, signal: null }, llm), null);
});

test('generateStockCommentary: نداء ثانٍ لنفس السياق ضمن مهلة الكاش لا يستدعي النموذج مجدداً', async () => {
    resetStockCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'تعليق ثابت'; };
    const first = await generateStockCommentary(DATA, llm);
    const second = await generateStockCommentary(DATA, llm);
    assert.equal(calls, 1);
    assert.equal(second, first);
});

test('generateStockCommentary: فشل بعد نجاح سابق (كاش لا يزال سارياً) → يعيد آخر نص معروف', async () => {
    resetStockCommentaryCache();
    const okLlm = async () => 'تحليل معروف';
    const first = await generateStockCommentary(DATA, okLlm);
    assert.equal(first, 'تحليل معروف');
    const failLlm = async () => { throw new Error('نداء لا ينبغي أن يحدث ضمن الكاش'); };
    const second = await generateStockCommentary(DATA, failLlm);
    assert.equal(second, 'تحليل معروف');
});
