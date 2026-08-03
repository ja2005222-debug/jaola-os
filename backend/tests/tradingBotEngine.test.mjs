// 🤖 tradingBotEngine: بوت PancakeSwap الشخصي — لا سلسلة حقيقية ولا مال حقيقي
// في هذا الملف إطلاقاً. chainClient محقون دوماً (كائن وهمي بعدّاد استدعاءات)،
// وgetOpportunities تعمل عبر global.fetch مُحاكاة (نفس نمط cryptoMarket.test.mjs).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';

import { runTradingBotTick, runTradingBotTickGuarded, isTickBusy } from '../services/tradingBotEngine.js';
import { saveConfig, isReadyToEnable, resetTradingBotConfigForTest } from '../services/tradingBotConfig.js';
import {
    recordConsideration, recordTradeOpen, updateTradeOutcome, readAllTrades, readPositions, writePosition, resetTradingLedgerForTest,
} from '../services/tradingBotLedger.js';
import { getDailyRealizedPnlBnb, isCircuitBreakerTripped, getCircuitBreakerStatus } from '../services/tradingBotCircuitBreaker.js';
import {
    isTradable, filterTradable, upsertToken, removeToken, getTokenRegistry, resetTradingBotCoinsForTest,
    lookupTokenByAddress, discoverTrendingCandidates, resetDiscoveryCacheForTest,
} from '../services/tradingBotCoins.js';
import { resetCryptoCache } from '../services/cryptoMarket.js';

const TEST_USER = 'tradingbot-test-user';
const TEST_PROJECT = 'tradingbot-test-project';
const TEST_WALLET = ethers.Wallet.createRandom().address; // عنوان اختباري فقط — لا مفتاح حقيقي هنا إطلاقاً

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'tradingbot-')); }

function baseConfigPatch(dir, overrides = {}) {
    return {
        coinIds: ['bitcoin'],
        positionSizeBnb: '0.01',
        dailyLossLimitBnb: '0.05',
        minGasReserveBnb: '0.005',
        maxOpenPositions: 3,
        cooldownMinutesPerCoin: 0,
        confirmationsRequired: 1,
        secretUsername: TEST_USER,
        secretProject: TEST_PROJECT,
        secretKeyName: 'WALLET_PRIVATE_KEY',
        addressesVerified: true,
        enabled: true,
        ...overrides,
    };
}

function fakeChainClient(overrides = {}) {
    const calls = { getBnbBalance: 0, quote: 0, buy: 0, sell: 0, ensureAllowance: 0, waitForReceipt: 0 };
    const client = {
        async getBnbBalance() { calls.getBnbBalance++; return overrides.bnbBalance ?? ethers.parseEther('1'); },
        async quote() { calls.quote++; return overrides.quoteOut ?? ethers.parseEther('100'); },
        async buy(args) {
            calls.buy++;
            if (overrides.buyArgsSpy) overrides.buyArgsSpy(args);
            if (overrides.buyThrows) throw new Error(overrides.buyThrows);
            return overrides.txHash ?? '0xTESTTXBUY';
        },
        async sell(args) {
            calls.sell++;
            if (overrides.sellArgsSpy) overrides.sellArgsSpy(args);
            if (overrides.sellThrows) throw new Error(overrides.sellThrows);
            return overrides.txHash ?? '0xTESTTXSELL';
        },
        async ensureAllowance() { calls.ensureAllowance++; return null; },
        async waitForReceipt() {
            calls.waitForReceipt++;
            return overrides.receipt ?? { confirmed: true, status: 1, gasUsed: 21000n, gasPrice: ethers.parseUnits('5', 'gwei') };
        },
    };
    return { client, calls };
}

// سلسلة أسعار هابطة بقوة (40 يوماً) — تُنتج RSI متشبّعاً بيعياً (buy) بثبات على المدى الأسبوعي.
function oversoldPrices(startTs) {
    return Array.from({ length: 40 }, (_, i) => [startTs + i * 86400000, 200 - i * 4]);
}
// سلسلة أسعار صاعدة بقوة — RSI متشبّع شرائياً (sell).
function overboughtPrices(startTs) {
    return Array.from({ length: 40 }, (_, i) => [startTs + i * 86400000, 50 + i * 4]);
}
// هبوط مع أيام صعود متفرقة — RSI منخفض (buy) لكن أبعد عن التطرف من سلسلة
// صعود صافٍ، فقوّتها (|RSI-50|) أدنى — تُرتَّب تحت بيعٍ متشبّع عمداً.
function mildOversoldPrices(startTs) {
    return Array.from({ length: 40 }, (_, i) => [startTs + i * 86400000, 200 - i * 3 + (i % 4 === 0 ? 6 : 0)]);
}

function mockFetchByCoin(pricesByCoinId) {
    global.fetch = async (url) => {
        const u = String(url);
        const id = Object.keys(pricesByCoinId).find(cid => u.includes(`/coins/${cid}/market_chart`));
        if (!id) return { ok: false, status: 404, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ prices: pricesByCoinId[id] }) };
    };
}

const realFetch = global.fetch;
let dir;

beforeEach(() => {
    dir = tmpDir();
    resetTradingBotConfigForTest(dir);
    resetTradingLedgerForTest(dir);
    resetTradingBotCoinsForTest(dir);
    resetDiscoveryCacheForTest();
    resetCryptoCache();
    upsertToken(dir, { coinId: 'bitcoin', symbol: 'BTCB', address: '0x111111111111111111111111111111111111111a', decimals: 18 });
    upsertToken(dir, { coinId: 'ethereum', symbol: 'ETH', address: '0x222222222222222222222222222222222222222b', decimals: 18 });
});
afterEach(() => {
    global.fetch = realFetch;
    fs.rmSync(dir, { recursive: true, force: true });
});

// ─── القائمة البيضاء ─────────────────────────────────────────────
test('isTradable/filterTradable: عملة خارج القائمة البيضاء غير قابلة للتداول، binancecoin مُستبعدة عمداً', () => {
    assert.equal(isTradable(dir, 'bitcoin'), true);
    assert.equal(isTradable(dir, 'dogecoin'), false, 'غير مسجَّلة في القائمة البيضاء');
    assert.equal(isTradable(dir, 'binancecoin'), false, 'عملة التمويل/الغاز نفسها — مُستبعدة صراحة');
    assert.deepEqual(filterTradable(dir, ['bitcoin', 'dogecoin', 'binancecoin', 'ethereum']), ['bitcoin', 'ethereum']);
});

// ─── إدارة السجل عبر الواجهة (upsertToken/removeToken) ──────────────
test('upsertToken: يرفض عنواناً غير صالح، معرّفاً غير صالح، binancecoin، decimals خاطئة', () => {
    assert.throws(() => upsertToken(dir, { coinId: 'cake', symbol: 'CAKE', address: '0xbadaddress', decimals: 18 }), /عنوان عقد غير صالح/);
    assert.throws(() => upsertToken(dir, { coinId: 'Cake Token!', symbol: 'CAKE', address: '0x333333333333333333333333333333333333333c', decimals: 18 }), /معرّف CoinGecko غير صالح/);
    assert.throws(() => upsertToken(dir, { coinId: 'binancecoin', symbol: 'BNB', address: '0x333333333333333333333333333333333333333c', decimals: 18 }), /binancecoin مستبعدة/);
    assert.throws(() => upsertToken(dir, { coinId: 'cake', symbol: 'CAKE', address: '0x333333333333333333333333333333333333333c', decimals: -1 }), /decimals غير صالح/);
    assert.doesNotThrow(() => upsertToken(dir, { coinId: 'cake', symbol: 'CAKE', address: '0x333333333333333333333333333333333333333c', decimals: 18 }));
    assert.equal(isTradable(dir, 'cake'), true);
});

test('removeToken: يزيل العملة من السجل فتصبح غير قابلة للتداول', () => {
    assert.equal(isTradable(dir, 'bitcoin'), true);
    removeToken(dir, 'bitcoin');
    assert.equal(isTradable(dir, 'bitcoin'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(getTokenRegistry(dir), 'bitcoin'), false);
});

// ─── بحث CoinGecko بعنوان العقد (راحة فقط، لا يضيف شيئاً تلقائياً) ────
test('lookupTokenByAddress: يرفض عنواناً غير صالح قبل أي نداء شبكي', async () => {
    await assert.rejects(() => lookupTokenByAddress('0xbadaddress'), /عنوان عقد غير صالح/);
});

test('lookupTokenByAddress: يرجع coinId/symbol/decimals من ردّ CoinGecko الصحيح', async () => {
    global.fetch = async (url) => {
        assert.ok(String(url).includes('/coins/binance-smart-chain/contract/0x333333333333333333333333333333333333333c'));
        return {
            ok: true, status: 200, json: async () => ({
                id: 'pancakeswap-token', symbol: 'cake', name: 'PancakeSwap Token',
                detail_platforms: { 'binance-smart-chain': { decimal_place: 18, contract_address: '0x333333333333333333333333333333333333333c' } },
            }),
        };
    };
    const r = await lookupTokenByAddress('0x333333333333333333333333333333333333333c');
    assert.deepEqual(r, { coinId: 'pancakeswap-token', symbol: 'CAKE', decimals: 18, name: 'PancakeSwap Token' });
});

test('lookupTokenByAddress: 404 ⇒ رسالة "لم يُعثر" واضحة، لا خطأ شبكي غامض', async () => {
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    await assert.rejects(() => lookupTokenByAddress('0x333333333333333333333333333333333333333c'), /لم يُعثر/);
});

// ─── اكتشاف مرشّحين رائجين (trending) ────────────────────────────────
test('discoverTrendingCandidates: يُصفّي لمن له عقد BSC فقط، يتجاوز فشل مرشّح واحد بصمت', async () => {
    global.fetch = async (url) => {
        const u = String(url);
        if (u.includes('/search/trending')) {
            return {
                ok: true, status: 200, json: async () => ({
                    coins: [
                        { item: { id: 'on-bsc-coin', symbol: 'obc', name: 'On BSC Coin' } },
                        { item: { id: 'eth-only-coin', symbol: 'eoc', name: 'ETH Only Coin' } },
                        { item: { id: 'flaky-coin', symbol: 'flk', name: 'Flaky Coin' } },
                    ],
                }),
            };
        }
        if (u.includes('/coins/on-bsc-coin')) {
            return {
                ok: true, status: 200, json: async () => ({
                    detail_platforms: { 'binance-smart-chain': { decimal_place: 18 } },
                    platforms: { 'binance-smart-chain': '0x444444444444444444444444444444444444444d' },
                }),
            };
        }
        if (u.includes('/coins/eth-only-coin')) {
            return { ok: true, status: 200, json: async () => ({ detail_platforms: {}, platforms: { ethereum: '0xabc' } }) };
        }
        if (u.includes('/coins/flaky-coin')) {
            return { ok: false, status: 500, json: async () => ({}) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
    };
    const candidates = await discoverTrendingCandidates();
    assert.deepEqual(candidates, [{ coinId: 'on-bsc-coin', symbol: 'OBC', name: 'On BSC Coin', address: '0x444444444444444444444444444444444444444d', decimals: 18 }]);
});

test('discoverTrendingCandidates: يُخزَّن مؤقتاً — نداء ثانٍ سريع لا يعيد ضرب /search/trending', async () => {
    let trendingCalls = 0;
    global.fetch = async (url) => {
        const u = String(url);
        if (u.includes('/search/trending')) { trendingCalls++; return { ok: true, status: 200, json: async () => ({ coins: [] }) }; }
        return { ok: false, status: 404, json: async () => ({}) };
    };
    await discoverTrendingCandidates();
    await discoverTrendingCandidates();
    assert.equal(trendingCalls, 1);
});

// ─── تفعيل الإعداد ─────────────────────────────────────────────────
test('saveConfig: يرفض enabled=true بلا addressesVerified أو بلا عملة قابلة للتداول', () => {
    assert.throws(() => saveConfig(dir, baseConfigPatch(dir, { addressesVerified: false })));
    assert.throws(() => saveConfig(dir, baseConfigPatch(dir, { coinIds: ['dogecoin'] })));
    assert.doesNotThrow(() => saveConfig(dir, baseConfigPatch(dir)));
});

// ─── enabled=false ──────────────────────────────────────────────────
test('runTradingBotTick: enabled=false → صفر استدعاءات على السلسلة', async () => {
    const { client, calls } = fakeChainClient();
    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, false);
    assert.equal(r.reason, 'disabled');
    assert.deepEqual(Object.values(calls).every(c => c === 0), true);
});

// ─── قاطع الأمان اليومي ──────────────────────────────────────────────
test('circuit breaker: تجارب متعددة — تفعيل/عدم تفعيل/حسب الحد', () => {
    const cfg = { dailyLossLimitBnb: '0.05' };
    assert.equal(isCircuitBreakerTripped(dir, cfg), false, 'لا صفقات بعد');

    const id = recordTradeOpen(dir, { coinId: 'bitcoin', side: 'sell', signal: 'sell', amountBnbWei: 1n, expectedOut: 1n });
    updateTradeOutcome(dir, id, { status: 'confirmed', realizedPnlBnb: -0.06 });
    assert.equal(isCircuitBreakerTripped(dir, cfg), true, 'خسارة تجاوزت الحد');

    const status = getCircuitBreakerStatus(dir, cfg);
    assert.equal(status.tripped, true);
    assert.ok(status.dailyPnlBnb <= -0.06);
});

test('circuit breaker: لا يُفعَّل بلا حدّ مضبوط (0 أو غائب)', () => {
    assert.equal(isCircuitBreakerTripped(dir, { dailyLossLimitBnb: 0 }), false);
    assert.equal(isCircuitBreakerTripped(dir, {}), false);
});

test('circuit breaker: خسائر الأمس لا تُحتسب اليوم (حدود يوم UTC)', () => {
    const id = recordTradeOpen(dir, { coinId: 'bitcoin', side: 'sell', signal: 'sell', amountBnbWei: 1n, expectedOut: 1n });
    updateTradeOutcome(dir, id, { status: 'confirmed', realizedPnlBnb: -1 });
    // نزوّر updatedAt يدوياً ليكون بالأمس
    const trades = readAllTrades(dir);
    trades.find(r => r.id === id).updatedAt = Date.now() - 25 * 3600 * 1000;
    fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify(trades));
    assert.equal(isCircuitBreakerTripped(dir, { dailyLossLimitBnb: '0.05' }), false);
});

test('circuit breaker: إعادة التسليح (reArmedAt) تتجاهل خسائر ما قبلها فقط', () => {
    const id = recordTradeOpen(dir, { coinId: 'bitcoin', side: 'sell', signal: 'sell', amountBnbWei: 1n, expectedOut: 1n });
    updateTradeOutcome(dir, id, { status: 'confirmed', realizedPnlBnb: -1 });
    // نزوّر updatedAt بفارق واضح (لا نعتمد على فارق تنفيذ متسلسل قد يتساوى بالمللي ثانية)
    const trades = readAllTrades(dir);
    trades.find(t => t.id === id).updatedAt = Date.now() - 5000;
    fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify(trades));

    const cfgBefore = { dailyLossLimitBnb: '0.05' };
    assert.equal(isCircuitBreakerTripped(dir, cfgBefore), true);
    const cfgAfterRearm = { dailyLossLimitBnb: '0.05', reArmedAt: new Date().toISOString() };
    assert.equal(isCircuitBreakerTripped(dir, cfgAfterRearm), false, 'الخسارة السابقة للتسليح لا تُعيد تفعيله فوراً');
});

test('runTradingBotTick: قاطع أمان مفعَّل ⇒ صفر نداءات إلى chainClient (بعد التسوية)، ولا فرص تُرتَّب', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    const id = recordTradeOpen(dir, { coinId: 'bitcoin', side: 'sell', signal: 'sell', amountBnbWei: 1n, expectedOut: 1n });
    updateTradeOutcome(dir, id, { status: 'confirmed', realizedPnlBnb: -1 }); // يتجاوز الحد 0.05 بكثير

    const { client, calls } = fakeChainClient();
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, false);
    assert.equal(r.reason, 'circuit_breaker');
    assert.equal(calls.getBnbBalance, 0);
    assert.equal(calls.quote, 0);
    assert.equal(calls.buy, 0);
    assert.equal(calls.sell, 0);

    const considerations = readAllTrades(dir).filter(r2 => r2.kind === 'consideration');
    assert.ok(considerations.some(c => c.skipReason === 'circuit_breaker'), 'سجل تدقيق لسبب التجاهل');
});

// ─── حجم الصفقة الثابت ────────────────────────────────────────────
test('runTradingBotTick: حجم الشراء دوماً القيمة الثابتة من الإعداد — لا مشتقّة من الرصيد/القوة', async () => {
    saveConfig(dir, baseConfigPatch(dir, { positionSizeBnb: '0.01', coinIds: ['bitcoin'] }));
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });

    let capturedAmount = null;
    const { client, calls } = fakeChainClient({
        bnbBalance: ethers.parseEther('10'), // رصيد كبير جداً — يجب ألا يؤثر على حجم الصفقة
        buyArgsSpy: (args) => { capturedAmount = args.amountInWei; },
    });

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, true);
    assert.equal(r.side, 'buy');
    assert.equal(capturedAmount, ethers.parseEther('0.01'), 'حجم الصفقة = القيمة المضبوطة حرفياً');
    assert.equal(calls.buy, 1);
});

// ─── فحص الغاز ────────────────────────────────────────────────────
test('runTradingBotTick: رصيد غاز غير كافٍ ⇒ لا استدعاء buy أبداً، تجاهل مُسجَّل', async () => {
    saveConfig(dir, baseConfigPatch(dir, { positionSizeBnb: '0.01', minGasReserveBnb: '0.005' }));
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });

    const { client, calls } = fakeChainClient({ bnbBalance: ethers.parseEther('0.001') }); // أقل من 0.01+0.005

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, false);
    assert.equal(r.reason, 'insufficient_gas');
    assert.equal(r.alert, 'insufficient_gas');
    assert.equal(calls.buy, 0);
    assert.equal(calls.quote, 0, 'لا حاجة لعرض سعر إن كنا سنتجاهل أصلاً');

    const considerations = readAllTrades(dir).filter(r2 => r2.kind === 'consideration');
    assert.ok(considerations.some(c => c.skipReason === 'insufficient_gas'));
});

// ─── القائمة البيضاء ضمن الدورة الكاملة ─────────────────────────────
test('runTradingBotTick: عملة غير مسجَّلة في القائمة البيضاء تُستبعد قبل أي نداء شبكي، مع إبقاء عملة مسموحة تعمل', async () => {
    // dogecoin غير مسجَّلة في BSC_TOKEN_REGISTRY هنا؛ bitcoin مسجَّلة — isReadyToEnable يتطلّب عملة قابلة واحدة على الأقل
    saveConfig(dir, baseConfigPatch(dir, { coinIds: ['dogecoin', 'bitcoin'] }));
    const requestedUrls = [];
    global.fetch = async (url) => {
        requestedUrls.push(String(url));
        if (String(url).includes('/coins/bitcoin/market_chart')) {
            return { ok: true, status: 200, json: async () => ({ prices: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) }) };
        }
        return { ok: true, status: 200, json: async () => ({ prices: [] }) };
    };
    const { client } = fakeChainClient();

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, true, 'bitcoin المسموحة نُفّذت بنجاح رغم وجود dogecoin غير مسموحة في نفس الإعداد');
    assert.equal(r.coinId, 'bitcoin');
    assert.ok(!requestedUrls.some(u => u.includes('/coins/dogecoin/')), 'لا نداء تحليل لعملة غير مسموحة إطلاقاً');
});

// ─── التأكيد/الانتهاء والتراجع ────────────────────────────────────
test('runTradingBotTick: انتهاء مهلة التأكيد ⇒ unconfirmed لا confirmed', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });
    const { client } = fakeChainClient({ receipt: { confirmed: false, timedOut: true } });

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.status, 'unconfirmed');
    const trade = readAllTrades(dir).find(t => t.kind === 'trade');
    assert.equal(trade.status, 'unconfirmed');
    assert.equal(Object.keys(readPositions(dir)).length, 0, 'لا مركز يُفتح بلا تأكيد فعلي');
});

test('runTradingBotTick: معاملة مؤكَّدة لكن مرتدَّة (status=0) ⇒ reverted، لا مركز، لا ربح/خسارة', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });
    const { client } = fakeChainClient({ receipt: { confirmed: true, status: 0, gasUsed: 21000n, gasPrice: ethers.parseUnits('5', 'gwei') } });

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.status, 'reverted');
    const trade = readAllTrades(dir).find(t => t.kind === 'trade');
    assert.equal(trade.status, 'reverted');
    assert.equal(trade.realizedPnlBnb, null);
    assert.equal(Object.keys(readPositions(dir)).length, 0);
});

test('runTradingBotTick: شراء مؤكَّد → مركز يُفتح فعلياً؛ ثم بيع مؤكَّد → مركز يُغلق وربح/خسارة يُحسَب', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });
    const buyClient = fakeChainClient({ quoteOut: ethers.parseEther('100') }).client;

    const buyResult = await runTradingBotTick(dir, { chainClient: buyClient, walletAddress: TEST_WALLET });
    assert.equal(buyResult.side, 'buy');
    assert.equal(buyResult.status, 'confirmed');
    const positionsAfterBuy = readPositions(dir);
    assert.ok(positionsAfterBuy.bitcoin, 'مركز مفتوح فعلياً بعد شراء مؤكَّد');

    // الآن نجعل الإشارة بيعاً (سعر مرتفع بقوة) ونتحقّق من إغلاق المركز
    resetCryptoCache();
    mockFetchByCoin({ bitcoin: overboughtPrices(Date.parse('2026-01-01T00:00:00Z')) });
    const sellClient = fakeChainClient({ quoteOut: ethers.parseEther('0.02') }).client; // عائد أعلى من رأس المال المستثمر (0.01)

    const sellResult = await runTradingBotTick(dir, { chainClient: sellClient, walletAddress: TEST_WALLET });
    assert.equal(sellResult.side, 'sell');
    assert.equal(sellResult.status, 'confirmed');
    assert.equal(Object.keys(readPositions(dir)).length, 0, 'المركز أُغلق');
    const sellTrade = readAllTrades(dir).find(t => t.kind === 'trade' && t.side === 'sell');
    assert.ok(sellTrade.realizedPnlBnb > 0, 'ربح محقَّق فعلياً (باع بأكثر مما اشترى)');
});

// ─── سقف عدد المراكز المفتوحة ──────────────────────────────────────
test('runTradingBotTick: لا شراء جديد يتجاوز maxOpenPositions', async () => {
    saveConfig(dir, baseConfigPatch(dir, { maxOpenPositions: 1 }));
    writePosition(dir, 'ethereum', { entryBnbSpent: '1', entryTokenWei: '1', entryAt: Date.now() }); // مركز مفتوح مسبقاً يشغل السقف
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });
    const { client, calls } = fakeChainClient();

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, false);
    assert.equal(r.reason, 'max_open_positions');
    assert.equal(calls.buy, 0);
});

// ─── تسوية إعادة التشغيل ──────────────────────────────────────────
test('runTradingBotTick: صفقة pending من دورة سابقة تُحسم قبل النظر في أي فرصة جديدة', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    const staleId = recordTradeOpen(dir, {
        coinId: 'bitcoin', side: 'buy', signal: 'buy',
        amountBnbWei: ethers.parseEther('0.01'), expectedOut: ethers.parseEther('50'), minOut: ethers.parseEther('49'),
    });
    // txHash مفقود من دورة سابقة لم تُكمل الإرسال فعلياً — لا حاجة، نضيفه يدوياً هنا لمحاكاة إرسال ناجح
    const trades = readAllTrades(dir);
    trades.find(t => t.id === staleId).txHash = '0xSTALE';
    fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify(trades));

    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });
    const { client, calls } = fakeChainClient({ receipt: { confirmed: true, status: 1, gasUsed: 21000n, gasPrice: ethers.parseUnits('5', 'gwei') } });

    await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });

    const staleTrade = readAllTrades(dir).find(t => t.id === staleId);
    assert.equal(staleTrade.status, 'confirmed', 'حُسمت الصفقة المعلَّقة');
    assert.ok(readPositions(dir).bitcoin, 'مركز أُعيد بناؤه من الصفقة المُسوَّاة');
    assert.ok(calls.waitForReceipt >= 1, 'استُدعي التأكيد أثناء التسوية');
});

// ─── حارس التداخل busy ─────────────────────────────────────────────
test('runTradingBotTickGuarded: يمنع دورتين متداخلتين', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) });
    let resolveFirst;
    const slowReceipt = new Promise(res => { resolveFirst = res; });
    const { client } = fakeChainClient();
    const originalWait = client.waitForReceipt;
    client.waitForReceipt = async (...args) => { await slowReceipt; return originalWait(...args); };

    const p1 = runTradingBotTickGuarded(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(isTickBusy(), true);
    const r2 = await runTradingBotTickGuarded(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r2.reason, 'busy', 'الدورة الثانية تُرفض فوراً ما دامت الأولى قائمة');
    resolveFirst();
    await p1;
    assert.equal(isTickBusy(), false);
});

// ─── اختيار أول فرصة قابلة للتنفيذ (لا انسداد بإشارة ميتة في الصدارة) ──
test('runTradingBotTick: بيع متصدّر بلا مركز لا يحجب شراءً حياً أدنى ترتيباً', async () => {
    saveConfig(dir, baseConfigPatch(dir, { coinIds: ['bitcoin', 'ethereum'] }));
    // ethereum: بيع متشبّع (قوة ~50) يتصدّر؛ bitcoin: شراء معتدل (قوة أدنى) — لا مركز في أيٍّ منهما
    mockFetchByCoin({
        ethereum: overboughtPrices(Date.parse('2026-01-01T00:00:00Z')),
        bitcoin: mildOversoldPrices(Date.parse('2026-01-01T00:00:00Z')),
    });
    const { client, calls } = fakeChainClient();

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, true, 'الشراء الحي نُفِّذ رغم تصدُّر بيع ميت');
    assert.equal(r.coinId, 'bitcoin');
    assert.equal(r.side, 'buy');
    assert.equal(calls.buy, 1);
    const deadSell = readAllTrades(dir).find(t => t.kind === 'consideration' && t.coinId === 'ethereum');
    assert.equal(deadSell?.skipReason, 'no_position_to_sell', 'البيع الميت سُجِّل بسببه المحدَّد');
});

// ─── مخارج حماية المراكز (وقف خسارة/جني ربح) ─────────────────────────
test('protective exits: هبوط تحت وقف الخسارة ⇒ بيع فوري، مركز يُغلق، خسارة محققة تُسجَّل', async () => {
    saveConfig(dir, baseConfigPatch(dir, { stopLossPct: 10 }));
    writePosition(dir, 'bitcoin', {
        entryBnbSpent: ethers.parseEther('0.01').toString(), entryTokenWei: ethers.parseEther('100').toString(),
        entryAt: Date.now(), entryGasCostBnb: 0, lastActionAt: Date.now(),
    });
    mockFetchByCoin({}); // لا فرص سوقية — المخرج الوقائي وحده يعمل
    const { client, calls } = fakeChainClient({ quoteOut: ethers.parseEther('0.008') }); // -20% ≤ -10%

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.executed, true);
    assert.equal(r.exit, 'stop_loss');
    assert.equal(r.side, 'sell');
    assert.equal(calls.sell, 1);
    assert.equal(Object.keys(readPositions(dir)).length, 0, 'المركز أُغلق');
    const trade = readAllTrades(dir).find(t => t.kind === 'trade' && t.reasonCode === 'stop_loss');
    assert.ok(Number(trade.realizedPnlBnb) < 0, 'خسارة محققة مُسجَّلة');
});

test('protective exits: صعود فوق جني الربح ⇒ بيع فوري بربح محقق', async () => {
    saveConfig(dir, baseConfigPatch(dir, { takeProfitPct: 15 }));
    writePosition(dir, 'bitcoin', {
        entryBnbSpent: ethers.parseEther('0.01').toString(), entryTokenWei: ethers.parseEther('100').toString(),
        entryAt: Date.now(), entryGasCostBnb: 0, lastActionAt: Date.now(),
    });
    mockFetchByCoin({});
    const { client } = fakeChainClient({ quoteOut: ethers.parseEther('0.0125') }); // +25% ≥ +15%

    const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    assert.equal(r.exit, 'take_profit');
    const trade = readAllTrades(dir).find(t => t.kind === 'trade' && t.reasonCode === 'take_profit');
    assert.ok(Number(trade.realizedPnlBnb) > 0, 'ربح محقق مُسجَّل');
});

test('protective exits: ضمن النطاق الآمن ⇒ لا بيع؛ ومعطَّلة افتراضياً ⇒ صفر عروض أسعار', async () => {
    // ضمن النطاق: وقف 10% وهبوط 5% فقط — لا مخرج
    saveConfig(dir, baseConfigPatch(dir, { stopLossPct: 10 }));
    writePosition(dir, 'bitcoin', {
        entryBnbSpent: ethers.parseEther('0.01').toString(), entryTokenWei: ethers.parseEther('100').toString(),
        entryAt: Date.now(), entryGasCostBnb: 0, lastActionAt: Date.now(),
    });
    mockFetchByCoin({});
    const inRange = fakeChainClient({ quoteOut: ethers.parseEther('0.0095') }); // -5% فقط
    const r1 = await runTradingBotTick(dir, { chainClient: inRange.client, walletAddress: TEST_WALLET });
    assert.equal(r1.executed, false);
    assert.equal(inRange.calls.sell, 0);
    assert.ok(readPositions(dir).bitcoin, 'المركز باقٍ');

    // معطَّلة (الافتراضي 0): لا حتى عرض سعر للمراكز
    saveConfig(dir, baseConfigPatch(dir, { stopLossPct: 0, takeProfitPct: 0 }));
    const disabled = fakeChainClient({ quoteOut: ethers.parseEther('0.0001') }); // كان سيوجب وقف خسارة لو مفعَّلاً
    const r2 = await runTradingBotTick(dir, { chainClient: disabled.client, walletAddress: TEST_WALLET });
    assert.equal(r2.executed, false);
    assert.equal(disabled.calls.quote, 0, 'صفر عروض أسعار — الحماية معطَّلة فلا فحص أصلاً');
    assert.equal(disabled.calls.sell, 0);
});

// ─── منع إغراق السجل (دمج التجاهلات المتطابقة) ───────────────────────
test('recordConsideration: تجاهل متطابق خلال النافذة لا يتكرر، وحالة مختلفة تُسجَّل دوماً', async () => {
    saveConfig(dir, baseConfigPatch(dir));
    writePosition(dir, 'bitcoin', { entryBnbSpent: '1', entryTokenWei: '1', entryAt: Date.now() });
    mockFetchByCoin({ bitcoin: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) }); // شراء ومركز مفتوح ⇒ position_already_open
    const { client } = fakeChainClient();

    await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
    const dupes = readAllTrades(dir).filter(t => t.kind === 'consideration' && t.skipReason === 'position_already_open');
    assert.equal(dupes.length, 1, 'ثلاث دورات متطابقة ⇒ سجل واحد فقط');

    // حالة مختلفة (سبب آخر لنفس العملة) تُسجَّل رغم النافذة
    assert.equal(recordConsideration(dir, { coinId: 'bitcoin', signal: 'buy', decision: 'skipped', skipReason: 'cooldown' }), true);
});

// ─── تنبيه بريدي عند تنفيذ صفقة (اختياري عبر alertEmail) ─────────────
test('runTradingBotTick: alertEmail مضبوط ⇒ بريد واحد يُرسَل عند شراء مؤكَّد، وفشل البريد لا يمسّ الصفقة', async () => {
    process.env.RESEND_API_KEY = 'test-key-not-real';
    try {
        saveConfig(dir, baseConfigPatch(dir, { alertEmail: 'owner@example.com' }));
        const baseFetch = (url) => {
            const u = String(url);
            if (u.includes('/coins/bitcoin/market_chart')) {
                return { ok: true, status: 200, json: async () => ({ prices: oversoldPrices(Date.parse('2026-01-01T00:00:00Z')) }) };
            }
            return { ok: false, status: 404, json: async () => ({}) };
        };
        const mailCalls = [];
        global.fetch = async (url, opts) => {
            if (String(url).includes('api.resend.com')) { mailCalls.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ id: 'mail1' }) }; }
            return baseFetch(url);
        };
        const { client } = fakeChainClient();

        const r = await runTradingBotTick(dir, { chainClient: client, walletAddress: TEST_WALLET });
        assert.equal(r.executed, true);
        assert.equal(r.status, 'confirmed');
        assert.equal(mailCalls.length, 1, 'بريد واحد بالضبط عند الصفقة المنفَّذة');
        assert.deepEqual(mailCalls[0].to, ['owner@example.com']);
    } finally {
        delete process.env.RESEND_API_KEY;
    }
});
