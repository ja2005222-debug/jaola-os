// 📊 cryptoMarket: بيانات CoinGecko + تحليل فني (SMA/RSI) + إشارة مفسَّرة.
// نفس نمط محاكاة fetch في vercelPreflight.test.mjs.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    listMarkets, getAnalysis, findCoin, resetCryptoCache,
    toDailyCloses, sma, rsi, buildSignal, SUPPORTED_COINS,
    _marketsCacheForTest, _analysisCacheForTest,
} from '../services/cryptoMarket.js';

// يُقدِّم زمن كل إدخالات الكاش الحالية لمحاكاة انتهاء صلاحيتها فوراً بلا انتظار حقيقي.
function expireCache(cache) {
    for (const [k, v] of cache.entries()) cache.set(k, { ...v, at: 0 });
}

const realFetch = global.fetch;
beforeEach(() => resetCryptoCache());
afterEach(() => { global.fetch = realFetch; });

function mockOk(body) {
    global.fetch = async () => ({ ok: true, status: 200, json: async () => body });
}
function mockFail() {
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
}

// ─── الرياضيات البحتة ─────────────────────────────────────────────
test('toDailyCloses: يختزل نقاطاً متعددة في نفس اليوم لآخر سعر فقط، ويرتّب زمنياً', () => {
    const day1 = Date.parse('2026-01-01T00:00:00Z');
    const day1Later = Date.parse('2026-01-01T20:00:00Z');
    const day2 = Date.parse('2026-01-02T00:00:00Z');
    const closes = toDailyCloses([[day2, 200], [day1, 100], [day1Later, 111]]);
    assert.deepEqual(closes, [111, 200], 'اليوم الأول: آخر سعر 111 لا 100، ثم اليوم الثاني، بالترتيب الزمني');
});

test('sma: يتطلّب عدد نقاط كافٍ، وإلا null', () => {
    assert.equal(sma([1, 2], 7), null);
    assert.equal(sma([1, 2, 3, 4, 5, 6, 7], 7), 4);
    assert.equal(sma([10, 20, 30, 40, 50, 60, 70, 80], 7), (20 + 30 + 40 + 50 + 60 + 70 + 80) / 7);
});

test('rsi: سلسلة صاعدة بحتة (لا خسائر) → 100', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    assert.equal(rsi(closes, 14), 100);
});

test('rsi: سلسلة هابطة بحتة (لا مكاسب) → 0', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i);
    assert.equal(rsi(closes, 14), 0);
});

test('rsi: بيانات غير كافية → null', () => {
    assert.equal(rsi([1, 2, 3], 14), null);
});

test('buildSignal: RSI تشبّع شرائي (>=70) يحسم "sell" حتى لو الاتجاه صاعد', () => {
    const r = buildSignal({ sma7: 120, sma25: 100, rsi14: 75 });
    assert.equal(r.signal, 'sell');
    assert.equal(r.reasonCode, 'rsi_overbought');
});

test('buildSignal: RSI تشبّع بيعي (<=30) يحسم "buy" حتى لو الاتجاه هابط', () => {
    const r = buildSignal({ sma7: 90, sma25: 100, rsi14: 25 });
    assert.equal(r.signal, 'buy');
    assert.equal(r.reasonCode, 'rsi_oversold');
});

test('buildSignal: بلا تطرّف RSI، SMA7 > SMA25 → buy (اتجاه صاعد)', () => {
    const r = buildSignal({ sma7: 110, sma25: 100, rsi14: 50 });
    assert.equal(r.signal, 'buy');
    assert.equal(r.reasonCode, 'sma_bullish');
});

test('buildSignal: بلا تطرّف RSI، SMA7 < SMA25 → sell (اتجاه هابط)', () => {
    const r = buildSignal({ sma7: 90, sma25: 100, rsi14: 50 });
    assert.equal(r.signal, 'sell');
    assert.equal(r.reasonCode, 'sma_bearish');
});

test('buildSignal: بيانات ناقصة كلياً → hold + insufficient_data', () => {
    const r = buildSignal({ sma7: null, sma25: null, rsi14: null });
    assert.equal(r.signal, 'hold');
    assert.equal(r.reasonCode, 'insufficient_data');
});

// ─── findCoin / القائمة المدعومة ──────────────────────────────────
test('findCoin: يعيد null لعملة غير مدعومة، ويعيد الكائن الصحيح لعملة مدعومة', () => {
    assert.equal(findCoin('not-a-real-coin'), null);
    assert.equal(findCoin('bitcoin')?.symbol, 'BTC');
});

// ─── listMarkets: نداء شبكة، كاش، وصمود على الفشل ─────────────────
test('listMarkets: نجاح → أسعار مطابقة لكل العملات المدعومة بترتيبها', async () => {
    mockOk(SUPPORTED_COINS.map(c => ({ id: c.id, current_price: 100, price_change_percentage_24h: 1.5 })));
    const r = await listMarkets();
    assert.equal(r.stale, false);
    assert.equal(r.coins.length, SUPPORTED_COINS.length);
    assert.equal(r.coins[0].id, SUPPORTED_COINS[0].id);
    assert.equal(r.coins[0].price, 100);
});

test('listMarkets: النداء الثاني ضمن مهلة الكاش لا يعيد fetch إطلاقاً', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, json: async () => SUPPORTED_COINS.map(c => ({ id: c.id, current_price: 1, price_change_percentage_24h: 0 })) }; };
    await listMarkets();
    await listMarkets();
    assert.equal(calls, 1, 'النداء الثاني يُقرأ من الكاش');
});

test('listMarkets: فشل الشبكة بلا كاش سابق → بيانات فارغة موسومة stale', async () => {
    mockFail();
    const r = await listMarkets();
    assert.equal(r.stale, true);
    assert.equal(r.coins[0].price, null);
});

test('listMarkets: فشل الشبكة بعد نجاح سابق (منتهي الصلاحية) → يعيد آخر بيانات معروفة موسومة stale', async () => {
    mockOk(SUPPORTED_COINS.map(c => ({ id: c.id, current_price: 42, price_change_percentage_24h: 2 })));
    const first = await listMarkets();
    assert.equal(first.coins[0].price, 42);
    expireCache(_marketsCacheForTest);
    mockFail();
    const r = await listMarkets();
    assert.equal(r.stale, true);
    assert.equal(r.coins[0].price, 42, 'آخر سعر معروف يبقى معروضاً بدل فراغ عند تعذّر التحديث');
});

// ─── getAnalysis: بناء تحليل كامل من تاريخ أسعار ──────────────────
function dailyPricesFrom(startTs, values) {
    return values.map((v, i) => [startTs + i * 86400000, v]);
}

test('getAnalysis: عملة غير مدعومة → error فوري بلا أي نداء شبكة', async () => {
    global.fetch = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    const r = await getAnalysis('dogecoin-fake');
    assert.ok(r.error);
});

test('getAnalysis: اتجاه صاعد معتدل → buy مع سعر/مؤشرات محسوبة', async () => {
    // 40 يوماً، اتجاه صاعد بتذبذب خفيف (يمنع RSI من الوصول لأقصى تطرّف)
    const start = Date.parse('2026-01-01T00:00:00Z');
    const values = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5 + (i % 3 === 0 ? -1 : 0));
    mockOk({ prices: dailyPricesFrom(start, values) });
    const r = await getAnalysis('bitcoin');
    assert.equal(r.stale, false);
    assert.ok(r.sma7 != null && r.sma25 != null && r.rsi14 != null);
    assert.equal(r.price, values[values.length - 1]);
    assert.ok(['buy', 'sell', 'hold'].includes(r.signal));
    assert.ok(['rsi_overbought', 'rsi_oversold', 'sma_bullish', 'sma_bearish', 'insufficient_data'].includes(r.reasonCode));
});

test('getAnalysis: نداء ثانٍ ضمن مهلة الكاش لا يعيد fetch', async () => {
    const start = Date.parse('2026-01-01T00:00:00Z');
    const values = Array.from({ length: 30 }, (_, i) => 50 + i);
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ prices: dailyPricesFrom(start, values) }) }; };
    await getAnalysis('ethereum');
    await getAnalysis('ethereum');
    assert.equal(calls, 1);
});

test('getAnalysis: فشل الشبكة بلا كاش سابق → رسالة خطأ واضحة', async () => {
    mockFail();
    const r = await getAnalysis('solana');
    assert.ok(r.error);
});

test('getAnalysis: فشل الشبكة بعد نجاح سابق (منتهي الصلاحية) → يعيد آخر تحليل معروف موسوم stale', async () => {
    const start = Date.parse('2026-01-01T00:00:00Z');
    const values = Array.from({ length: 30 }, (_, i) => 50 + i);
    mockOk({ prices: dailyPricesFrom(start, values) });
    const first = await getAnalysis('cardano');
    assert.equal(first.stale, false);
    const knownPrice = first.price;
    expireCache(_analysisCacheForTest);
    mockFail();
    const r = await getAnalysis('cardano');
    assert.equal(r.stale, true);
    assert.equal(r.price, knownPrice);
});
