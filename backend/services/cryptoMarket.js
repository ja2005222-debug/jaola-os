/**
 * 📊 cryptoMarket.js — بيانات سوق حقيقية (CoinGecko، بلا مفتاح) + تحليل فني
 * مبسّط (SMA قصير/طويل + RSI) يُنتج إشارة شراء/بيع/انتظار مفسَّرة بالعربية،
 * على ثلاثة مدىً زمنية يختارها المستخدم (يومي/أسبوعي/طويل المدى — انظر
 * TIMEFRAMES أدناه).
 *
 * ليس تنفيذاً آلياً للتداول أبداً — تحليل وعرض فقط (قرار المستخدم صاحب
 * الحساب). كاش داخلي (Map، لكل عملة على حدة) يحمي CoinGecko من الاستهلاك
 * المفرط عبر كل المستخدمين معاً (مشترك، لا لكل مشروع) — قوائم متابعة
 * متداخلة (الكل يتابع بيتكوين مثلاً) تتشارك نفس النداء بدل تكراره. يصمد
 * على فشل الشبكة بإرجاع آخر بيانات معروفة موسومة stale:true بدل الانهيار.
 *
 * القائمة المتابَعة قابلة للتوسّع لأي عملة يدعمها CoinGecko (بحث بالاسم/
 * الرمز)، لا الثماني المُنسَّقة فقط — تلك تبقى "اقتراحات سريعة" بأسماء
 * عربية مألوفة، والبحث يفتح البقية (آلاف العملات) بأسمائها الإنجليزية.
 */

import { fetchJsonWithRetry } from './httpRetry.js';

const API_BASE = 'https://api.coingecko.com/api/v3';

// اقتراحات سريعة بأسماء عربية مألوفة (checkboxes في الإعدادات) — لا سقفاً
// على المتابعة؛ أي عملة صالحة عبر البحث قابلة للإضافة أيضاً.
export const SUPPORTED_COINS = [
    { id: 'bitcoin', symbol: 'BTC', nameAr: 'بيتكوين' },
    { id: 'ethereum', symbol: 'ETH', nameAr: 'إيثيريوم' },
    { id: 'binancecoin', symbol: 'BNB', nameAr: 'بينانس كوين' },
    { id: 'ripple', symbol: 'XRP', nameAr: 'ريبل' },
    { id: 'solana', symbol: 'SOL', nameAr: 'سولانا' },
    { id: 'cardano', symbol: 'ADA', nameAr: 'كاردانو' },
    { id: 'dogecoin', symbol: 'DOGE', nameAr: 'دوجكوين' },
    { id: 'tron', symbol: 'TRX', nameAr: 'ترون' },
];

export const MAX_WATCHLIST = 20; // سقف عدد العملات المتابَعة لكل مشروع

const MARKETS_TTL_MS = 60 * 1000; // دقيقة — بيانات سعر/تغيّر 24س خفيفة
const SEARCH_TTL_MS = 5 * 60 * 1000; // 5 دقائق — نتائج البحث لا تتغيّر بسرعة

// 🕐 ثلاثة مدىً زمنية للتحليل — كل شخص يختار ما يناسب أفقه الاستثماري.
// نفس منطق الإشارة (buildSignal) على فترات مختلفة: يومي (ساعات، حساس/
// سريع التغيّر)، أسبوعي (الافتراضي، أيام قصيرة/متوسطة)، طويل المدى (أيام
// أطول بكثير، أهدأ وأقل حساسية للتذبذب اليومي). مهلة الكاش تقصر كلما
// قصر المدى (بيانات يومية تحتاج تحديثاً أكثر تكراراً من طويلة المدى).
export const TIMEFRAMES = {
    day: { periodUnit: 'hour', bucketMs: 3600 * 1000, historyDays: 2, smaShortPeriod: 6, smaLongPeriod: 24, rsiPeriod: 14, cacheTtlMs: 60 * 1000 },
    week: { periodUnit: 'day', bucketMs: 86400 * 1000, historyDays: 40, smaShortPeriod: 7, smaLongPeriod: 25, rsiPeriod: 14, cacheTtlMs: 3 * 60 * 1000 },
    long: { periodUnit: 'day', bucketMs: 86400 * 1000, historyDays: 220, smaShortPeriod: 50, smaLongPeriod: 200, rsiPeriod: 14, cacheTtlMs: 15 * 60 * 1000 },
};
export const DEFAULT_TIMEFRAME = 'week';
export const isValidTimeframe = (t) => Object.prototype.hasOwnProperty.call(TIMEFRAMES, t);

const marketsCache = new Map(); // coinId → { data: {id,symbol,name,price,change24h}, at }
const analysisCache = new Map(); // coinId → { data, at }
const searchCache = new Map(); // query مُطبَّع → { data, at }

// معرّف CoinGecko slug صالح (حروف/أرقام/شرطات فقط) — يحمي من حقن مسار URL
// ومن إساءة استخدام نقطة النهاية كوكيل مفتوح لأي مسار على CoinGecko.
const ID_RE = /^[a-z0-9-]{1,64}$/;
export const isValidCoinId = (id) => ID_RE.test(String(id || ''));

export function findCoin(id) {
    return SUPPORTED_COINS.find(c => c.id === id) || null;
}

// نداء واحد فاشل (تعطّل شبكي عابر أو حدّ معدّل CoinGecko المجاني 429) لا يعني
// أن البيانات غائبة فعلاً — httpRetry.js يعيد المحاولة تلقائياً مرّة (ينقذ
// أغلب الحالات العابرة، خصوصاً لمدىً أطول كالأسبوعي/طويل المدى حيث الحمولة
// أكبر فاحتمال تأخّر عابر أعلى من المدى اليومي الصغير).
function fetchJson(url) { return fetchJsonWithRetry(url); }

/** يختزل مصفوفة [timestamp, price] (أي دقّة زمنية) إلى إغلاق واحد لكل نافذة زمنية (bucketMs). */
export function bucketCloses(prices, bucketMs) {
    const byBucket = new Map();
    for (const point of Array.isArray(prices) ? prices : []) {
        const ts = point?.[0], price = point?.[1];
        if (typeof ts !== 'number' || typeof price !== 'number') continue;
        const key = Math.floor(ts / bucketMs);
        byBucket.set(key, price); // آخر نقطة في النافذة تستبدل السابقة (البيانات مرتّبة زمنياً تصاعدياً)
    }
    return [...byBucket.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}

/** إغلاق يومي واحد لكل يوم UTC — حالة خاصة شائعة من bucketCloses (يُستخدَم مباشرة في اختبارات سابقة). */
export function toDailyCloses(prices) {
    return bucketCloses(prices, 86400 * 1000);
}

export function sma(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / period;
}

/**
 * RSI بصيغة Wilder الأصلية (تجانس أسّي، لا متوسط بسيط لآخر نافذة فقط) —
 * يستخدم كل التاريخ المُعطى: نافذة تمهيد بسيطة لأول period تغيّر، ثم
 * تجانس تراكمي لبقية النقاط. هذا ما تستخدمه منصّات التداول الحقيقية —
 * أدق وأنعم (أقل قفزات) من متوسط بسيط لآخر 14 نقطة فقط.
 */
export function rsi(closes, period = 14) {
    if (closes.length < period + 1) return null;
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const delta = closes[i] - closes[i - 1];
        if (delta >= 0) avgGain += delta; else avgLoss += -delta;
    }
    avgGain /= period; avgLoss /= period;
    for (let i = period + 1; i < closes.length; i++) {
        const delta = closes[i] - closes[i - 1];
        const gain = delta >= 0 ? delta : 0;
        const loss = delta < 0 ? -delta : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
}

// نُعيد رمز سبب (لا جملة عربية جاهزة) — القالب (app.js) هو من يترجمه لنص
// معروض، بنفس فلسفة كل النصوص الأخرى في القالب: مُضمَّنة بالواجهة لا في
// استجابة الخادم، كي تلتقطها ترجمة templateLocalizer.js لموقع بالإنجليزية.
// أسماء عامة (smaShort/smaLong) لا "sma7/sma25" — نفس الدالة تُستخدَم لكل
// المدى الزمنية الثلاثة (ساعات/أيام قصيرة/أيام طويلة)، فتخصيص الاسم للفترة
// الأسبوعية فقط كان سيضلّل عند استخدامها للمدى اليومي أو الطويل.
export function buildSignal({ smaShort, smaLong, rsi: rsiVal }) {
    if (rsiVal != null && rsiVal >= 70) return { signal: 'sell', reasonCode: 'rsi_overbought' };
    if (rsiVal != null && rsiVal <= 30) return { signal: 'buy', reasonCode: 'rsi_oversold' };
    if (smaShort != null && smaLong != null && smaShort > smaLong) return { signal: 'buy', reasonCode: 'sma_bullish' };
    if (smaShort != null && smaLong != null && smaShort < smaLong) return { signal: 'sell', reasonCode: 'sma_bearish' };
    return { signal: 'hold', reasonCode: 'insufficient_data' };
}

/**
 * أسعار + تغيّر 24س لقائمة عملات (يحدّد القالب أيّها — قائمة متابعته)،
 * كاش لكل عملة على حدة فيُعاد استخدامه بين مستخدمين مختلفين يتابعون نفس
 * العملة. نداء CoinGecko واحد لكل العملات الناقصة/منتهية الصلاحية فقط.
 */
export async function listMarkets(ids) {
    const wanted = (Array.isArray(ids) && ids.length ? ids : SUPPORTED_COINS.map(c => c.id))
        .filter(isValidCoinId).slice(0, MAX_WATCHLIST);
    if (!wanted.length) return { coins: [], stale: false };

    const now = Date.now();
    const stale = [];
    for (const id of wanted) {
        const c = marketsCache.get(id);
        if (!c || now - c.at >= MARKETS_TTL_MS) stale.push(id);
    }

    let anyFetchFailed = false;
    if (stale.length) {
        try {
            const url = `${API_BASE}/coins/markets?vs_currency=usd&ids=${stale.join(',')}&order=market_cap_desc&price_change_percentage=24h`;
            const raw = await fetchJson(url);
            const byId = new Map((Array.isArray(raw) ? raw : []).map(r => [r.id, r]));
            for (const id of stale) {
                const r = byId.get(id);
                const meta = findCoin(id);
                const data = {
                    id, symbol: (r?.symbol || meta?.symbol || id).toString().toUpperCase(),
                    name: r?.name || meta?.nameAr || id,
                    price: r?.current_price ?? null, change24h: r?.price_change_percentage_24h ?? null,
                };
                marketsCache.set(id, { data, at: now });
            }
        } catch { anyFetchFailed = true; }
    }

    const coins = wanted.map(id => {
        const c = marketsCache.get(id);
        if (c) return c.data;
        const meta = findCoin(id);
        return { id, symbol: meta?.symbol || id.toUpperCase(), name: meta?.nameAr || id, price: null, change24h: null };
    });
    return { coins, stale: anyFetchFailed };
}

/**
 * تحليل فني كامل لعملة واحدة على مدى زمني مختار (day/week/long، افتراضي
 * week): سعر + SMA قصير/طويل + RSI + إشارة مفسَّرة. كل مدى له فترات
 * ونافذة تاريخ ومهلة كاش مختلفة (انظر TIMEFRAMES أعلاه).
 */
export async function getAnalysis(id, timeframe = DEFAULT_TIMEFRAME) {
    if (!isValidCoinId(id)) return { error: 'عملة غير صالحة' };
    const tf = isValidTimeframe(timeframe) ? timeframe : DEFAULT_TIMEFRAME;
    const cfg = TIMEFRAMES[tf];
    const cacheKey = `${id}:${tf}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cfg.cacheTtlMs) return { ...cached.data, stale: false };
    try {
        const url = `${API_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${cfg.historyDays}`;
        const raw = await fetchJson(url);
        const closes = bucketCloses(raw?.prices, cfg.bucketMs);
        if (!closes.length) throw new Error('لا بيانات تاريخية');
        const price = closes[closes.length - 1];
        const smaShort = sma(closes, cfg.smaShortPeriod), smaLong = sma(closes, cfg.smaLongPeriod), rsiVal = rsi(closes, cfg.rsiPeriod);
        const { signal, reasonCode } = buildSignal({ smaShort, smaLong, rsi: rsiVal });
        // آخر 14 نقطة (ساعة أو يوم حسب المدى) — للرسم البياني المصغّر (sparkline)، بلا نداء إضافي.
        const recentCloses = closes.slice(-14);
        const data = {
            id, timeframe: tf, price, smaShort, smaLong, rsi: rsiVal, signal, reasonCode, recentCloses,
            smaShortPeriod: cfg.smaShortPeriod, smaLongPeriod: cfg.smaLongPeriod, rsiPeriod: cfg.rsiPeriod, periodUnit: cfg.periodUnit,
            updatedAt: Date.now(),
        };
        analysisCache.set(cacheKey, { data, at: Date.now() });
        return { ...data, stale: false };
    } catch {
        if (cached) return { ...cached.data, stale: true };
        return { error: 'تعذّر جلب بيانات التحليل الآن — حاول مجدداً بعد قليل' };
    }
}

// قوّة الفرصة (0-100 تقريبية، للترتيب فقط لا للعرض الدقيق): كلما ابتعد RSI
// عن حدّه (70/30) أو اتّسعت الفجوة النسبية بين المتوسطين، كانت الإشارة أقوى.
// مُصدَّرة (لا كريبتو-خاصة في منطقها) — يعيد استخدامها stockMarket.js أيضاً.
export function opportunityStrength(r) {
    if (r.reasonCode === 'rsi_overbought' || r.reasonCode === 'rsi_oversold') {
        return Math.abs((r.rsi ?? 50) - 50);
    }
    if (r.reasonCode === 'sma_bullish' || r.reasonCode === 'sma_bearish') {
        if (!r.smaLong) return 0;
        return Math.min(100, Math.abs((r.smaShort - r.smaLong) / r.smaLong) * 100 * 5);
    }
    return 0;
}

/**
 * أقوى فرص الدخول (شراء/بيع فعلي، لا "انتظار") ضمن قائمة عملات — لشريط
 * "الفرص القوية" في الواجهة. يعيد استخدام getAnalysis (وكاشها لكل عملة)،
 * فلا يُضاعف تكلفة CoinGecko عن استدعاء كل عملة على حدة. أعلى 8 نتائج
 * مرتّبة تنازلياً بقوة الفرصة.
 */
export async function getOpportunities(ids, timeframe = DEFAULT_TIMEFRAME) {
    const wanted = (Array.isArray(ids) ? ids : []).filter(isValidCoinId).slice(0, MAX_WATCHLIST);
    if (!wanted.length) return [];
    const results = await Promise.all(wanted.map(id => getAnalysis(id, timeframe).catch(() => ({ error: true }))));
    return wanted
        .map((id, i) => ({ id, result: results[i] }))
        .filter(({ result }) => result && !result.error && (result.signal === 'buy' || result.signal === 'sell'))
        .map(({ id, result }) => ({ id, signal: result.signal, reasonCode: result.reasonCode, price: result.price, strength: opportunityStrength(result) }))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 8);
}

/** بحث عن عملة بالاسم/الرمز (لإضافتها لقائمة المتابعة) — أعلى 8 نتائج مطابقة. */
export async function searchCoins(query) {
    const q = String(query || '').trim().toLowerCase().slice(0, 60);
    if (q.length < 2) return [];
    const cached = searchCache.get(q);
    if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.data;
    try {
        const raw = await fetchJson(`${API_BASE}/search?query=${encodeURIComponent(q)}`);
        const data = (Array.isArray(raw?.coins) ? raw.coins : [])
            .slice(0, 8)
            .map(c => ({ id: c.id, symbol: String(c.symbol || '').toUpperCase(), name: c.name || c.id }))
            .filter(c => isValidCoinId(c.id));
        searchCache.set(q, { data, at: Date.now() });
        return data;
    } catch {
        return cached ? cached.data : [];
    }
}

/** لإعادة ضبط الكاش بين الاختبارات فقط. */
export function resetCryptoCache() {
    marketsCache.clear();
    analysisCache.clear();
    searchCache.clear();
}

// تصدير الكاش نفسه للاختبارات فقط (محاكاة انتهاء صلاحية بلا انتظار حقيقي) —
// لا يُستخدَم إنتاجياً خارج دوال هذا الملف.
export { marketsCache as _marketsCacheForTest, analysisCache as _analysisCacheForTest };
