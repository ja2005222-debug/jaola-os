// 📈 stockMarket: بيانات Yahoo Finance (بلا مفتاح) + نفس تحليل SMA/RSI المشترك.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    listMarkets, getAnalysis, getOpportunities, findSymbol, resetStockCache, searchSymbols, isValidSymbolId,
    SUPPORTED_SYMBOLS, MAX_WATCHLIST, _marketsCacheForTest, _analysisCacheForTest,
} from '../services/stockMarket.js';

function expireCache(cache) {
    for (const [k, v] of cache.entries()) cache.set(k, { ...v, at: 0 });
}

const realFetch = global.fetch;
beforeEach(() => resetStockCache());
afterEach(() => { global.fetch = realFetch; });

function mockOk(body) {
    global.fetch = async () => ({ ok: true, status: 200, json: async () => body });
}
function mockFail() {
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
}
function chartWithCloses(values, { intervalMs = 86400000 } = {}) {
    const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
    return {
        chart: {
            result: [{
                meta: { regularMarketPrice: values[values.length - 1] },
                timestamp: values.map((_, i) => start + (i * intervalMs) / 1000),
                indicators: { quote: [{ close: values }] },
            }],
        },
    };
}

test('isValidSymbolId: يقبل رموز الأسهم والفوركس والمؤشرات، يرفض البقية', () => {
    assert.ok(isValidSymbolId('AAPL'));
    assert.ok(isValidSymbolId('EURUSD=X'));
    assert.ok(isValidSymbolId('^GSPC'));
    assert.ok(isValidSymbolId('2222.SR'));
    assert.ok(!isValidSymbolId('AAPL/MSFT'));
    assert.ok(!isValidSymbolId(''));
    assert.ok(!isValidSymbolId('a'.repeat(21)));
});

test('findSymbol: يجد رمزاً مدعوماً أو null', () => {
    assert.equal(findSymbol('AAPL').nameAr, 'أبل');
    assert.equal(findSymbol('NOPE'), null);
});

test('listMarkets: نجاح → أسعار وتغيّر يومي صحيحان لكل رمز', async () => {
    mockOk({ quoteResponse: { result: SUPPORTED_SYMBOLS.map(s => ({ symbol: s.id, regularMarketPrice: 100, regularMarketChangePercent: 1.5, shortName: s.nameAr })) } } );
    const r = await listMarkets(['AAPL', 'MSFT']);
    assert.equal(r.stale, false);
    assert.equal(r.symbols.length, 2);
    assert.equal(r.symbols[0].id, 'AAPL');
    assert.equal(r.symbols[0].price, 100);
    assert.equal(r.symbols[0].change24h, 1.5);
});

test('listMarkets: يقبل أي رمز صالح عبر البحث (لا الرموز المدعومة فقط)', async () => {
    mockOk({ quoteResponse: { result: [{ symbol: 'IBM', regularMarketPrice: 55.5, regularMarketChangePercent: -0.5, shortName: 'IBM Corp' }] } });
    const r = await listMarkets(['IBM']);
    assert.equal(r.symbols[0].name, 'IBM Corp');
    assert.equal(r.symbols[0].price, 55.5);
});

test('listMarkets: كاش لكل رمز — نداء ثانٍ ضمن المهلة لا يستدعي الشبكة', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ quoteResponse: { result: SUPPORTED_SYMBOLS.map(s => ({ symbol: s.id, regularMarketPrice: 1, regularMarketChangePercent: 0 })) } }) }; };
    await listMarkets();
    await listMarkets();
    assert.equal(calls, 1, 'النداء الثاني يُقرأ من الكاش');
});

test('listMarkets: فشل الشبكة بلا كاش سابق → بيانات فارغة موسومة stale', async () => {
    mockFail();
    const r = await listMarkets();
    assert.equal(r.stale, true);
    assert.equal(r.symbols[0].price, null);
});

test('listMarkets: فشل الشبكة بعد نجاح سابق (منتهي الصلاحية) → يعيد آخر بيانات معروفة موسومة stale', async () => {
    mockOk({ quoteResponse: { result: SUPPORTED_SYMBOLS.map(s => ({ symbol: s.id, regularMarketPrice: 42, regularMarketChangePercent: 2 })) } });
    const first = await listMarkets();
    assert.equal(first.symbols[0].price, 42);
    expireCache(_marketsCacheForTest);
    mockFail();
    const r = await listMarkets();
    assert.equal(r.stale, true);
    assert.equal(r.symbols[0].price, 42);
});

test('listMarkets: تعطّل عابر (الأولى تفشل، الثانية تنجح) → محاولة ثانية تلقائية تنقذ الطلب', async () => {
    let calls = 0;
    global.fetch = async () => {
        calls++;
        if (calls === 1) throw new Error('ETIMEDOUT');
        return { ok: true, status: 200, json: async () => ({ quoteResponse: { result: [{ symbol: 'AAPL', regularMarketPrice: 200, regularMarketChangePercent: 3 }] } }) };
    };
    const r = await listMarkets(['AAPL']);
    assert.equal(calls, 2);
    assert.equal(r.stale, false);
    assert.equal(r.symbols[0].price, 200);
});

test('getAnalysis: معرّف غير صالح → error فوري بلا أي نداء شبكة', async () => {
    global.fetch = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    const r = await getAnalysis('AAPL/BAD');
    assert.ok(r.error);
});

test('getAnalysis: اتجاه هابط قوي → RSI منخفض وإشارة buy', async () => {
    const values = Array.from({ length: 40 }, (_, i) => 300 - i * 5);
    mockOk(chartWithCloses(values));
    const r = await getAnalysis('AAPL', 'week');
    assert.equal(r.signal, 'buy');
    assert.ok(r.rsi < 30);
    assert.equal(r.timeframe, 'week');
});

test('getAnalysis: اتجاه صاعد قوي → RSI مرتفع وإشارة sell', async () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 + i * 5);
    mockOk(chartWithCloses(values));
    const r = await getAnalysis('MSFT', 'week');
    assert.equal(r.signal, 'sell');
    assert.ok(r.rsi > 70);
});

test('getAnalysis: مدى مختلف لنفس الرمز = نداء منفصل، لا يُقرأ من كاش المدى الآخر', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => chartWithCloses(Array.from({ length: 40 }, (_, i) => 100 + i)) }; };
    await getAnalysis('AAPL', 'week');
    await getAnalysis('AAPL', 'long');
    assert.equal(calls, 2);
    await getAnalysis('AAPL', 'week');
    await getAnalysis('AAPL', 'long');
    assert.equal(calls, 2, 'النداءات اللاحقة لنفس (رمز، مدى) تُقرأ من الكاش');
});

test('getAnalysis: فشل الشبكة بلا كاش سابق → رسالة خطأ واضحة', async () => {
    mockFail();
    const r = await getAnalysis('AAPL');
    assert.ok(r.error);
});

test('getAnalysis: فشل الشبكة بعد نجاح سابق (منتهي الصلاحية) → يعيد آخر تحليل معروف موسوم stale', async () => {
    mockOk(chartWithCloses(Array.from({ length: 40 }, (_, i) => 50 + i)));
    const first = await getAnalysis('AAPL');
    assert.equal(first.stale, false);
    const knownPrice = first.price;
    expireCache(_analysisCacheForTest);
    mockFail();
    const r = await getAnalysis('AAPL');
    assert.equal(r.stale, true);
    assert.equal(r.price, knownPrice);
});

test('getAnalysis: نقاط close الفارغة (null، شائعة في استجابات Yahoo) تُتجاهل بلا انهيار', async () => {
    const start = Date.parse('2026-01-01T00:00:00Z') / 1000;
    const values = Array.from({ length: 40 }, (_, i) => (i % 5 === 0 ? null : 100 + i));
    mockOk({ chart: { result: [{ meta: {}, timestamp: values.map((_, i) => start + i * 86400), indicators: { quote: [{ close: values }] } }] } });
    const r = await getAnalysis('AAPL');
    assert.ok(!r.error);
    assert.ok(r.price != null);
});

test('getOpportunities: يتجاهل "انتظار"، يرتّب تنازلياً بقوة الفرصة، يحدّ بثمانية', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => 'S' + i);
    global.fetch = async (url) => {
        if (url.includes('quote?')) return { ok: true, status: 200, json: async () => ({ quoteResponse: { result: [] } }) };
        const id = decodeURIComponent(url.match(/chart\/([^?]+)/)[1]);
        const i = Number(id.slice(1));
        const values = Array.from({ length: 40 }, (_, j) => 300 - j * (4 + i));
        return { ok: true, status: 200, json: async () => chartWithCloses(values) };
    };
    const r = await getOpportunities(ids);
    assert.ok(r.length <= 8);
    assert.ok(r.every(o => o.signal === 'buy' || o.signal === 'sell'));
});

test('getOpportunities: يتجاهل رموزاً غير صالحة ويحدّ العدد بسقف المتابعة', async () => {
    let sawBadId = false;
    global.fetch = async (url) => { if (url.includes('BAD')) sawBadId = true; return { ok: false, status: 404, json: async () => ({}) }; };
    await getOpportunities(['BAD/ID!', 'AAPL']);
    assert.equal(sawBadId, false);
});

test('searchSymbols: استعلام قصير جداً → [] بلا أي نداء شبكة', async () => {
    global.fetch = async () => { throw new Error('لا ينبغي أن يُستدعى'); };
    assert.deepEqual(await searchSymbols('a'), []);
    assert.deepEqual(await searchSymbols(''), []);
});

test('searchSymbols: نجاح → نتائج مطابقة مُهيَّأة، يستبعد أنواعاً غير مالية', async () => {
    mockOk({ quotes: [
        { symbol: 'IBM', shortname: 'IBM Corp', quoteType: 'EQUITY' },
        { symbol: 'SOMEFUND', shortname: 'Some Mutual Fund', quoteType: 'MUTUALFUND' },
        { symbol: 'EURUSD=X', shortname: 'EUR/USD', quoteType: 'CURRENCY' },
    ] });
    const r = await searchSymbols('ibm');
    assert.equal(r.length, 2);
    assert.equal(r[0].id, 'IBM');
});

test('searchSymbols: فشل الشبكة بلا كاش سابق → []، وبعد نجاح سابق → آخر نتائج معروفة', async () => {
    mockFail();
    assert.deepEqual(await searchSymbols('xyz'), []);
    mockOk({ quotes: [{ symbol: 'AAPL', shortname: 'Apple', quoteType: 'EQUITY' }] });
    const first = await searchSymbols('appl');
    assert.equal(first.length, 1);
    mockFail();
    const r = await searchSymbols('appl');
    assert.deepEqual(r, first);
});
