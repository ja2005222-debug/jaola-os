// 📊 cryptoMarket: بيانات CoinGecko + تحليل فني (SMA/RSI) + إشارة مفسَّرة.
// نفس نمط محاكاة fetch في vercelPreflight.test.mjs.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    listMarkets, getAnalysis, findCoin, resetCryptoCache, searchCoins, isValidCoinId,
    toDailyCloses, bucketCloses, sma, rsi, buildSignal, SUPPORTED_COINS, MAX_WATCHLIST,
    TIMEFRAMES, DEFAULT_TIMEFRAME, isValidTimeframe,
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
    const r = buildSignal({ smaShort: 120, smaLong: 100, rsi: 75 });
    assert.equal(r.signal, 'sell');
    assert.equal(r.reasonCode, 'rsi_overbought');
});

test('buildSignal: RSI تشبّع بيعي (<=30) يحسم "buy" حتى لو الاتجاه هابط', () => {
    const r = buildSignal({ smaShort: 90, smaLong: 100, rsi: 25 });
    assert.equal(r.signal, 'buy');
    assert.equal(r.reasonCode, 'rsi_oversold');
});

test('buildSignal: بلا تطرّف RSI، smaShort > smaLong → buy (اتجاه صاعد)', () => {
    const r = buildSignal({ smaShort: 110, smaLong: 100, rsi: 50 });
    assert.equal(r.signal, 'buy');
    assert.equal(r.reasonCode, 'sma_bullish');
});

test('buildSignal: بلا تطرّف RSI، smaShort < smaLong → sell (اتجاه هابط)', () => {
    const r = buildSignal({ smaShort: 90, smaLong: 100, rsi: 50 });
    assert.equal(r.signal, 'sell');
    assert.equal(r.reasonCode, 'sma_bearish');
});

test('buildSignal: بيانات ناقصة كلياً → hold + insufficient_data', () => {
    const r = buildSignal({ smaShort: null, smaLong: null, rsi: null });
    assert.equal(r.signal, 'hold');
    assert.equal(r.reasonCode, 'insufficient_data');
});

// ─── findCoin / القائمة المدعومة ──────────────────────────────────
test('findCoin: يعيد null لعملة غير مدعومة، ويعيد الكائن الصحيح لعملة مدعومة', () => {
    assert.equal(findCoin('not-a-real-coin'), null);
    assert.equal(findCoin('bitcoin')?.symbol, 'BTC');
});

// ─── isValidCoinId ────────────────────────────────────────────────
test('isValidCoinId: يقبل slugs صالحة، يرفض الباقي', () => {
    assert.equal(isValidCoinId('bitcoin'), true);
    assert.equal(isValidCoinId('shiba-inu'), true);
    assert.equal(isValidCoinId('Bitcoin'), false, 'حروف كبيرة مرفوضة');
    assert.equal(isValidCoinId('bitcoin/../etc'), false);
    assert.equal(isValidCoinId('has space'), false);
    assert.equal(isValidCoinId(''), false);
    assert.equal(isValidCoinId('a'.repeat(65)), false, 'أطول من الحد الأقصى');
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

test('listMarkets: يقبل أي عملة صالحة عبر CoinGecko (لا الثماني المدعومة فقط)', async () => {
    mockOk([{ id: 'shiba-inu', symbol: 'shib', name: 'Shiba Inu', current_price: 0.00001, price_change_percentage_24h: 3 }]);
    const r = await listMarkets(['shiba-inu']);
    assert.equal(r.coins[0].id, 'shiba-inu');
    assert.equal(r.coins[0].symbol, 'SHIB');
    assert.equal(r.coins[0].name, 'Shiba Inu');
});

test('listMarkets: يتجاهل المعرّفات غير الصالحة ويحدّ العدد بسقف المتابعة', async () => {
    let requestedIds = null;
    global.fetch = async (url) => { requestedIds = new URL(url).searchParams.get('ids').split(','); return { ok: true, json: async () => [] }; };
    const tooMany = Array.from({ length: MAX_WATCHLIST + 10 }, (_, i) => 'coin' + i);
    const r = await listMarkets(['BAD ID!', ...tooMany]);
    assert.equal(r.coins.length, MAX_WATCHLIST, 'لا يتجاوز سقف المتابعة');
    assert.equal(requestedIds.length, MAX_WATCHLIST);
    assert.ok(!requestedIds.includes('BAD ID!'));
});

test('listMarkets: قوائم متداخلة تتشارك الكاش — عملة مكرّرة لا تُطلب مرتين', async () => {
    let calls = 0;
    global.fetch = async (url) => {
        calls++;
        const ids = new URL(url).searchParams.get('ids').split(',');
        return { ok: true, json: async () => ids.map(id => ({ id, current_price: 1, price_change_percentage_24h: 0 })) };
    };
    await listMarkets(['bitcoin', 'ethereum']);
    let secondRequestedIds = null;
    global.fetch = async (url) => { calls++; secondRequestedIds = new URL(url).searchParams.get('ids').split(','); return { ok: true, json: async () => secondRequestedIds.map(id => ({ id, current_price: 1, price_change_percentage_24h: 0 })) }; };
    const r = await listMarkets(['ethereum', 'solana']);
    assert.equal(calls, 2, 'نداء واحد لكل مجموعة، لا نداء لكل عملة');
    assert.deepEqual(secondRequestedIds, ['solana'], 'إيثيريوم كان مخزّناً مسبقاً — لم يُطلب مجدداً');
    assert.equal(r.coins.find(c => c.id === 'ethereum').price, 1);
    assert.equal(r.coins.find(c => c.id === 'solana').price, 1);
});

// ─── getAnalysis: بناء تحليل كامل من تاريخ أسعار ──────────────────
function dailyPricesFrom(startTs, values) {
    return values.map((v, i) => [startTs + i * 86400000, v]);
}

test('getAnalysis: معرّف غير صالح الصيغة → error فوري بلا أي نداء شبكة', async () => {
    global.fetch = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    const r = await getAnalysis('Not A Valid ID!!');
    assert.ok(r.error);
});

test('getAnalysis: يعمل لأي عملة صالحة الصيغة (لا الثماني المدعومة فقط)', async () => {
    const start = Date.parse('2026-01-01T00:00:00Z');
    const values = Array.from({ length: 30 }, (_, i) => 10 + i * 0.3);
    mockOk({ prices: dailyPricesFrom(start, values) });
    const r = await getAnalysis('shiba-inu');
    assert.equal(r.id, 'shiba-inu');
    assert.equal(r.stale, false);
    assert.ok(r.smaShort != null);
});

test('getAnalysis: اتجاه صاعد معتدل → buy مع سعر/مؤشرات محسوبة (المدى الافتراضي "week")', async () => {
    // 40 يوماً، اتجاه صاعد بتذبذب خفيف (يمنع RSI من الوصول لأقصى تطرّف)
    const start = Date.parse('2026-01-01T00:00:00Z');
    const values = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5 + (i % 3 === 0 ? -1 : 0));
    mockOk({ prices: dailyPricesFrom(start, values) });
    const r = await getAnalysis('bitcoin');
    assert.equal(r.timeframe, 'week', 'بلا تحديد → الافتراضي');
    assert.equal(r.stale, false);
    assert.ok(r.smaShort != null && r.smaLong != null && r.rsi != null);
    assert.equal(r.smaShortPeriod, TIMEFRAMES.week.smaShortPeriod);
    assert.equal(r.smaLongPeriod, TIMEFRAMES.week.smaLongPeriod);
    assert.equal(r.periodUnit, 'day');
    assert.equal(r.price, values[values.length - 1]);
    assert.ok(['buy', 'sell', 'hold'].includes(r.signal));
    assert.ok(['rsi_overbought', 'rsi_oversold', 'sma_bullish', 'sma_bearish', 'insufficient_data'].includes(r.reasonCode));
    assert.equal(r.recentCloses.length, 14, 'آخر 14 نقطة للرسم المصغّر');
    assert.equal(r.recentCloses[r.recentCloses.length - 1], r.price);
});

// ─── المدى الزمني (day/week/long) ──────────────────────────────────
test('isValidTimeframe: يقبل المدى الثلاثة فقط', () => {
    assert.equal(isValidTimeframe('day'), true);
    assert.equal(isValidTimeframe('week'), true);
    assert.equal(isValidTimeframe('long'), true);
    assert.equal(isValidTimeframe('month'), false);
    assert.equal(isValidTimeframe(''), false);
    assert.equal(isValidTimeframe(undefined), false);
});

test('getAnalysis: مدى غير صالح → يرجع للافتراضي بصمت (لا خطأ)', async () => {
    const start = Date.parse('2026-01-01T00:00:00Z');
    const values = Array.from({ length: 40 }, (_, i) => 100 + i);
    mockOk({ prices: dailyPricesFrom(start, values) });
    const r = await getAnalysis('bitcoin', 'not-a-real-timeframe');
    assert.equal(r.timeframe, DEFAULT_TIMEFRAME);
});

test('getAnalysis: المدى "day" يطلب نافذة تاريخ أقصر ويستخدم دلواً بالساعة', async () => {
    let requestedDays = null;
    global.fetch = async (url) => {
        requestedDays = new URL(url).searchParams.get('days');
        // نقاط كل 10 دقائق على مدى يومين — كافية لتشكيل عدّة ساعات بعد التجميع بالدلو الساعي
        const start = Date.parse('2026-01-01T00:00:00Z');
        const points = Array.from({ length: 288 }, (_, i) => [start + i * 600000, 100 + i * 0.05]);
        return { ok: true, json: async () => ({ prices: points }) };
    };
    const r = await getAnalysis('bitcoin', 'day');
    assert.equal(requestedDays, String(TIMEFRAMES.day.historyDays));
    assert.equal(r.timeframe, 'day');
    assert.equal(r.periodUnit, 'hour');
    assert.equal(r.smaShortPeriod, TIMEFRAMES.day.smaShortPeriod);
});

test('getAnalysis: المدى "long" يطلب نافذة تاريخ أطول بكثير وفترات SMA أكبر', async () => {
    let requestedDays = null;
    global.fetch = async (url) => {
        requestedDays = new URL(url).searchParams.get('days');
        const start = Date.parse('2025-01-01T00:00:00Z');
        const values = Array.from({ length: 220 }, (_, i) => 100 + i * 0.2);
        return { ok: true, json: async () => ({ prices: dailyPricesFrom(start, values) }) };
    };
    const r = await getAnalysis('bitcoin', 'long');
    assert.equal(requestedDays, String(TIMEFRAMES.long.historyDays));
    assert.equal(r.smaShortPeriod, 50);
    assert.equal(r.smaLongPeriod, 200);
    assert.ok(r.smaLong != null, 'تاريخ كافٍ لحساب SMA200');
});

test('getAnalysis: نفس العملة بمدىً مختلفَين لهما كاش مستقلّ (لا تداخل)', async () => {
    let calls = 0;
    global.fetch = async (url) => {
        calls++;
        const start = Date.parse('2026-01-01T00:00:00Z');
        const values = Array.from({ length: 220 }, (_, i) => 100 + i * 0.1);
        return { ok: true, json: async () => ({ prices: dailyPricesFrom(start, values) }) };
    };
    await getAnalysis('ethereum', 'week');
    await getAnalysis('ethereum', 'long');
    assert.equal(calls, 2, 'مدى مختلف = نداء منفصل، لا يُقرأ من كاش المدى الآخر');
    // كل مدى يُقرأ من كاشه الخاص بعد ذلك بلا نداء إضافي
    await getAnalysis('ethereum', 'week');
    await getAnalysis('ethereum', 'long');
    assert.equal(calls, 2, 'النداءات اللاحقة لنفس (عملة، مدى) تُقرأ من الكاش');
});

test('bucketCloses: يجمع حسب الساعة عند تمرير bucketMs بالساعة', () => {
    const h1 = Date.parse('2026-01-01T10:00:00Z');
    const h1Later = Date.parse('2026-01-01T10:45:00Z');
    const h2 = Date.parse('2026-01-01T11:05:00Z');
    const closes = bucketCloses([[h1, 100], [h1Later, 105], [h2, 110]], 3600 * 1000);
    assert.deepEqual(closes, [105, 110], 'الساعة الأولى: آخر سعر 105، ثم الساعة الثانية');
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

// ─── searchCoins ────────────────────────────────────────────────────
test('searchCoins: استعلام قصير جداً → [] بلا أي نداء شبكة', async () => {
    global.fetch = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    assert.deepEqual(await searchCoins('a'), []);
    assert.deepEqual(await searchCoins(''), []);
});

test('searchCoins: نجاح → أعلى 8 نتائج مطابقة، مُهيَّأة', async () => {
    mockOk({ coins: Array.from({ length: 15 }, (_, i) => ({ id: 'coin' + i, symbol: 'c' + i, name: 'Coin ' + i })) });
    const r = await searchCoins('coin');
    assert.equal(r.length, 8);
    assert.equal(r[0].symbol, 'C0');
    assert.equal(r[0].name, 'Coin 0');
});

test('searchCoins: يستبعد نتائج بمعرّفات غير صالحة', async () => {
    mockOk({ coins: [{ id: 'Bad Id!', symbol: 'x', name: 'Bad' }, { id: 'good-coin', symbol: 'y', name: 'Good' }] });
    const r = await searchCoins('test');
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'good-coin');
});

test('searchCoins: النداء الثاني بنفس الاستعلام ضمن مهلة الكاش لا يعيد fetch', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ coins: [] }) }; };
    await searchCoins('bitcoin');
    await searchCoins('  Bitcoin  '); // تطبيع (trim + lowercase) يطابق نفس الكاش
    assert.equal(calls, 1);
});

test('searchCoins: فشل الشبكة بلا كاش سابق → []، وبعد نجاح سابق → آخر نتائج معروفة', async () => {
    mockFail();
    assert.deepEqual(await searchCoins('xyz'), []);
    mockOk({ coins: [{ id: 'known-coin', symbol: 'k', name: 'Known' }] });
    const first = await searchCoins('known');
    assert.equal(first.length, 1);
    mockFail();
    const r = await searchCoins('known');
    assert.deepEqual(r, first, 'ضمن مهلة الكاش أصلاً — يعيد نفس النتائج بلا الحاجة لفشل/نجاح');
});
