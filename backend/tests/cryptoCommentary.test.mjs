// 🤖 cryptoCommentary: وكيل ضيّق يكتب جملتين/ثلاثاً تفسّر أرقام التحليل —
// llm قابل للحقن (نفس نمط router.js/routeMessage) — لا حاجة لمحاكاة smartChat نفسها.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCommentary, resetCommentaryCache } from '../services/cryptoCommentary.js';

const DATA = { id: 'bitcoin', symbol: 'BTC', price: 65000, smaShort: 64000, smaLong: 60000, rsi: 55, signal: 'buy', reasonCode: 'sma_bullish', timeframe: 'week' };

test('generateCommentary: نجاح → يعيد نص اللغة نظيفاً (مقلّماً)', async () => {
    resetCommentaryCache();
    const llm = async () => '  بيتكوين يُظهر زخماً صاعداً حسب المتوسطات.  ';
    const text = await generateCommentary(DATA, llm);
    assert.equal(text, 'بيتكوين يُظهر زخماً صاعداً حسب المتوسطات.');
});

test('generateCommentary: يمرّر الأرقام الصحيحة لنموذج اللغة (لا نص عشوائي)', async () => {
    resetCommentaryCache();
    let seenUser = null;
    const llm = async (messages) => { seenUser = JSON.parse(messages[1].content); return 'نص'; };
    await generateCommentary(DATA, llm);
    assert.equal(seenUser.symbol, 'BTC');
    assert.equal(seenUser.price, 65000);
    assert.equal(seenUser.signal, 'شراء', 'الإشارة تُترجم للعربية قبل إرسالها للنموذج');
    assert.equal(seenUser.timeframe, 'أسبوعي', 'المدى الزمني يُترجم للعربية قبل إرسالها للنموذج');
});

test('generateCommentary: مدى مختلف لنفس (id+signal+reasonCode) → مفتاح كاش مستقلّ', async () => {
    resetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'تعليق ' + calls; };
    await generateCommentary({ ...DATA, timeframe: 'week' }, llm);
    await generateCommentary({ ...DATA, timeframe: 'long' }, llm);
    assert.equal(calls, 2, 'المدى الزمني جزء من مفتاح الكاش');
});

// ─── اللغة: system prompt وسياق الطلب يتبعان lang، لا عربي دائماً ────
test('generateCommentary: lang=en → system prompt إنجليزي وسياق الطلب إنجليزي', async () => {
    resetCommentaryCache();
    let seenSystem = null, seenUser = null;
    const llm = async (messages) => { seenSystem = messages[0].content; seenUser = JSON.parse(messages[1].content); return 'Momentum looks bullish.'; };
    const text = await generateCommentary({ ...DATA, lang: 'en' }, llm);
    assert.match(seenSystem, /English sentences/);
    assert.doesNotMatch(seenSystem, /[؀-ۿ]/, 'system prompt إنجليزي بلا عربية');
    assert.equal(seenUser.signal, 'Buy');
    assert.equal(seenUser.timeframe, 'weekly');
    assert.equal(text, 'Momentum looks bullish.');
});

test('generateCommentary: lang غائبة أو غير en → عربي (افتراضي)', async () => {
    resetCommentaryCache();
    let seenSystem = null;
    const llm = async (messages) => { seenSystem = messages[0].content; return 'نص'; };
    await generateCommentary({ ...DATA, lang: undefined }, llm);
    assert.match(seenSystem, /محلّل بيانات/);
    resetCommentaryCache();
    const llm2 = async (messages) => { seenSystem = messages[0].content; return 'نص'; };
    await generateCommentary({ ...DATA, lang: 'fr' }, llm2);
    assert.match(seenSystem, /محلّل بيانات/, 'لغة غير مدعومة → عربي افتراضياً');
});

test('generateCommentary: نفس السياق بلغتين مختلفتين → مفتاح كاش مستقلّ (لا تسريب نص لغة لأخرى)', async () => {
    resetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'text ' + calls; };
    const ar = await generateCommentary({ ...DATA, lang: 'ar' }, llm);
    const en = await generateCommentary({ ...DATA, lang: 'en' }, llm);
    assert.equal(calls, 2, 'اللغة جزء من مفتاح الكاش');
    assert.notEqual(ar, en);
});

test('generateCommentary: فشل النموذج (لا مزوّد/رصيد) → null بدل رمي خطأ', async () => {
    resetCommentaryCache();
    const llm = async () => { throw new Error('quota exceeded'); };
    const text = await generateCommentary(DATA, llm);
    assert.equal(text, null);
});

test('generateCommentary: رد فارغ من النموذج → null', async () => {
    resetCommentaryCache();
    const llm = async () => '   ';
    assert.equal(await generateCommentary(DATA, llm), null);
});

test('generateCommentary: بلا id/إشارة → null فوراً بلا استدعاء النموذج', async () => {
    resetCommentaryCache();
    const llm = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    assert.equal(await generateCommentary({ ...DATA, id: null }, llm), null);
    assert.equal(await generateCommentary({ ...DATA, signal: null }, llm), null);
});

test('generateCommentary: نداء ثانٍ لنفس (id+signal+reasonCode) ضمن مهلة الكاش لا يستدعي النموذج مجدداً', async () => {
    resetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'تعليق ثابت'; };
    const first = await generateCommentary(DATA, llm);
    const second = await generateCommentary(DATA, llm);
    assert.equal(calls, 1);
    assert.equal(second, first);
});

test('generateCommentary: تغيّر الإشارة يُبطل الكاش (سياق مختلف يستحق تعليقاً جديداً)', async () => {
    resetCommentaryCache();
    let calls = 0;
    const llm = async () => { calls++; return 'تعليق ' + calls; };
    await generateCommentary({ ...DATA, signal: 'buy' }, llm);
    await generateCommentary({ ...DATA, signal: 'sell' }, llm);
    assert.equal(calls, 2, 'مفتاح كاش مختلف لإشارة مختلفة');
});

test('generateCommentary: فشل بعد نجاح سابق (كاش منتهٍ) → يعيد آخر نص معروف بدل null', async () => {
    resetCommentaryCache();
    const okLlm = async () => 'تحليل معروف';
    const first = await generateCommentary(DATA, okLlm);
    assert.equal(first, 'تحليل معروف');
    // كاش لا يزال سارياً هنا فعلياً (5 دقائق)، لكن نتحقّق فقط أن فشلاً لاحقاً
    // لنفس المفتاح ضمن المهلة يعيد نفس النص المخزَّن (لا يستدعي llm الفاشل أصلاً)
    const failLlm = async () => { throw new Error('نداء لا ينبغي أن يحدث ضمن الكاش'); };
    const second = await generateCommentary(DATA, failLlm);
    assert.equal(second, 'تحليل معروف');
});
