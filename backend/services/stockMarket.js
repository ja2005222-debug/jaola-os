/**
 * 📈 stockMarket.js — بيانات أسهم/فوركس حقيقية (Yahoo Finance، بلا مفتاح)
 * + نفس تحليل SMA/RSI المشترك من cryptoMarket.js (رياضيات عامة، لا خاصة
 * بالكريبتو) يُنتج إشارة شراء/بيع/انتظار مفسَّرة، على نفس ثلاثة مدىً زمنية
 * (يومي/أسبوعي/طويل المدى) بنفس فترات/مهلات كاش cryptoMarket.js — تجربة
 * استثمارية موحّدة عبر كل مستشاري JAOLA OS.
 *
 * ليس تنفيذاً آلياً للتداول أبداً — تحليل وعرض فقط. كاش لكل رمز على حدة
 * (مشترك بين كل المستخدمين، لا لكل مشروع). يصمد على فشل الشبكة بإرجاع
 * آخر بيانات معروفة موسومة stale:true بدل الانهيار — ومحاولة ثانية
 * تلقائية عند تعطّل عابر (httpRetry.js، الدرس المستفاد من عطل CoinGecko).
 *
 * مصدر البيانات (Yahoo Finance غير الرسمي) قد يحجب طلبات بلا ترويسة
 * User-Agent واقعية — لذا تُرسَل هنا دائماً؛ إن تغيّر شكل الاستجابة يوماً
 * (عقد غير موثَّق رسمياً)، التحليل يصمد بردّ "تعذّر جلب التحليل الآن"
 * بدل الانهيار (نفس فلسفة معالجة الأخطاء في كل الملف).
 */
import { fetchJsonWithRetry } from './httpRetry.js';
import { TIMEFRAMES, DEFAULT_TIMEFRAME, isValidTimeframe, bucketCloses, sma, rsi, buildSignal, opportunityStrength } from './cryptoMarket.js';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const QUOTE_BASE = 'https://query1.finance.yahoo.com/v7/finance/quote';
const SEARCH_BASE = 'https://query1.finance.yahoo.com/v1/finance/search';
const UA = 'Mozilla/5.0 (compatible; JaolaOS-StockAdvisor/1.0; +https://jaola-os)';

// اقتراحات سريعة (أسهم كبرى + أزواج فوركس شائعة) — لا سقفاً على المتابعة؛
// أي رمز صالح عبر البحث قابل للإضافة أيضاً (بورصات/عملات أخرى كثيرة).
export const SUPPORTED_SYMBOLS = [
    { id: 'AAPL', symbol: 'AAPL', nameAr: 'أبل', type: 'stock' },
    { id: 'MSFT', symbol: 'MSFT', nameAr: 'مايكروسوفت', type: 'stock' },
    { id: 'GOOGL', symbol: 'GOOGL', nameAr: 'جوجل', type: 'stock' },
    { id: 'AMZN', symbol: 'AMZN', nameAr: 'أمازون', type: 'stock' },
    { id: 'TSLA', symbol: 'TSLA', nameAr: 'تسلا', type: 'stock' },
    { id: 'NVDA', symbol: 'NVDA', nameAr: 'إنفيديا', type: 'stock' },
    { id: 'EURUSD=X', symbol: 'EURUSD=X', nameAr: 'يورو/دولار', type: 'forex' },
    { id: 'GBPUSD=X', symbol: 'GBPUSD=X', nameAr: 'إسترليني/دولار', type: 'forex' },
    { id: 'USDJPY=X', symbol: 'USDJPY=X', nameAr: 'دولار/ين ياباني', type: 'forex' },
    { id: 'USDSAR=X', symbol: 'USDSAR=X', nameAr: 'دولار/ريال سعودي', type: 'forex' },
];

export const MAX_WATCHLIST = 20;
const MARKETS_TTL_MS = 60 * 1000;
const SEARCH_TTL_MS = 5 * 60 * 1000;

// نطاق/دقّة نداء Yahoo لكل مدى — رياضيات التحليل (فترات SMA/RSI ومهلة
// الكاش) تبقى مشتركة من TIMEFRAMES في cryptoMarket.js، وهذا فقط تخصيص
// شكل نداء مصدر البيانات المختلف (Yahoo لا يقبل "days" كـCoinGecko).
const YAHOO_RANGE = {
    day: { range: '2d', interval: '15m' },
    week: { range: '3mo', interval: '1d' },
    long: { range: '1y', interval: '1d' },
};

const marketsCache = new Map(); // symbol → { data, at }
const analysisCache = new Map(); // "symbol:timeframe" → { data, at }
const searchCache = new Map();

// رمز Yahoo صالح: حروف/أرقام/نقطة/شرطة/علامة تساوٍ (أزواج فوركس مثل
// EURUSD=X)/كاريت (مؤشرات مثل ^GSPC) — يحمي من حقن مسار URL.
const ID_RE = /^[A-Za-z0-9.\-=^]{1,20}$/;
export const isValidSymbolId = (id) => ID_RE.test(String(id || ''));

export function findSymbol(id) {
    return SUPPORTED_SYMBOLS.find(s => s.id === id) || null;
}

function fetchJson(url) { return fetchJsonWithRetry(url, { fetchOptions: { headers: { 'User-Agent': UA, Accept: 'application/json' } } }); }

/** أسعار + تغيّر يومي لقائمة رموز — كاش لكل رمز على حدة، نداء واحد مُجمَّع للناقص/المنتهي فقط. */
export async function listMarkets(ids) {
    const wanted = (Array.isArray(ids) && ids.length ? ids : SUPPORTED_SYMBOLS.map(s => s.id))
        .filter(isValidSymbolId).slice(0, MAX_WATCHLIST);
    if (!wanted.length) return { symbols: [], stale: false };

    const now = Date.now();
    const stale = [];
    for (const id of wanted) {
        const c = marketsCache.get(id);
        if (!c || now - c.at >= MARKETS_TTL_MS) stale.push(id);
    }

    let anyFetchFailed = false;
    if (stale.length) {
        try {
            const url = `${QUOTE_BASE}?symbols=${stale.map(encodeURIComponent).join(',')}`;
            const raw = await fetchJson(url);
            const results = raw?.quoteResponse?.result;
            const byId = new Map((Array.isArray(results) ? results : []).map(r => [r.symbol, r]));
            for (const id of stale) {
                const r = byId.get(id);
                const meta = findSymbol(id);
                const data = {
                    id, symbol: id,
                    name: r?.shortName || r?.longName || meta?.nameAr || id,
                    price: (typeof r?.regularMarketPrice === 'number') ? r.regularMarketPrice : null,
                    change24h: (typeof r?.regularMarketChangePercent === 'number') ? r.regularMarketChangePercent : null,
                };
                marketsCache.set(id, { data, at: now });
            }
        } catch { anyFetchFailed = true; }
    }

    const symbols = wanted.map(id => {
        const c = marketsCache.get(id);
        if (c) return c.data;
        const meta = findSymbol(id);
        return { id, symbol: id, name: meta?.nameAr || id, price: null, change24h: null };
    });
    return { symbols, stale: anyFetchFailed };
}

/** تحليل فني كامل لرمز واحد على مدى زمني مختار — نفس منطق cryptoMarket.js تماماً، بمصدر بيانات مختلف فقط. */
export async function getAnalysis(id, timeframe = DEFAULT_TIMEFRAME) {
    if (!isValidSymbolId(id)) return { error: 'رمز غير صالح' };
    const tf = isValidTimeframe(timeframe) ? timeframe : DEFAULT_TIMEFRAME;
    const cfg = TIMEFRAMES[tf];
    const yahooCfg = YAHOO_RANGE[tf];
    const cacheKey = `${id}:${tf}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.at < cfg.cacheTtlMs) return { ...cached.data, stale: false };
    try {
        const url = `${CHART_BASE}/${encodeURIComponent(id)}?range=${yahooCfg.range}&interval=${yahooCfg.interval}`;
        const raw = await fetchJson(url);
        const result = raw?.chart?.result?.[0];
        const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
        const rawCloses = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : [];
        const prices = timestamps
            .map((ts, i) => [ts * 1000, rawCloses[i]])
            .filter(([, p]) => typeof p === 'number');
        const closes = bucketCloses(prices, cfg.bucketMs);
        if (!closes.length) throw new Error('لا بيانات تاريخية');
        const price = (typeof result?.meta?.regularMarketPrice === 'number') ? result.meta.regularMarketPrice : closes[closes.length - 1];
        const smaShort = sma(closes, cfg.smaShortPeriod), smaLong = sma(closes, cfg.smaLongPeriod), rsiVal = rsi(closes, cfg.rsiPeriod);
        const { signal, reasonCode } = buildSignal({ smaShort, smaLong, rsi: rsiVal });
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

/** أقوى فرص الدخول (شراء/بيع فعلي، لا "انتظار") ضمن قائمة رموز — أعلى 8 نتائج مرتّبة تنازلياً بقوة الفرصة. */
export async function getOpportunities(ids, timeframe = DEFAULT_TIMEFRAME) {
    const wanted = (Array.isArray(ids) ? ids : []).filter(isValidSymbolId).slice(0, MAX_WATCHLIST);
    if (!wanted.length) return [];
    const results = await Promise.all(wanted.map(id => getAnalysis(id, timeframe).catch(() => ({ error: true }))));
    return wanted
        .map((id, i) => ({ id, result: results[i] }))
        .filter(({ result }) => result && !result.error && (result.signal === 'buy' || result.signal === 'sell'))
        .map(({ id, result }) => ({ id, signal: result.signal, reasonCode: result.reasonCode, price: result.price, strength: opportunityStrength(result) }))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 8);
}

/** بحث عن رمز (سهم/فوركس/مؤشر) لإضافته لقائمة المتابعة — أعلى 8 نتائج مطابقة. */
export async function searchSymbols(query) {
    const q = String(query || '').trim().slice(0, 60);
    if (q.length < 2) return [];
    const cached = searchCache.get(q.toLowerCase());
    if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.data;
    try {
        const raw = await fetchJson(`${SEARCH_BASE}?q=${encodeURIComponent(q)}`);
        const data = (Array.isArray(raw?.quotes) ? raw.quotes : [])
            .filter(r => r?.symbol && ['EQUITY', 'CURRENCY', 'INDEX', 'ETF'].includes(r.quoteType))
            .slice(0, 8)
            .map(r => ({ id: r.symbol, symbol: r.symbol, name: r.shortname || r.longname || r.symbol }))
            .filter(r => isValidSymbolId(r.id));
        searchCache.set(q.toLowerCase(), { data, at: Date.now() });
        return data;
    } catch {
        return cached ? cached.data : [];
    }
}

/** لإعادة الضبط بين الاختبارات فقط. */
export function resetStockCache() {
    marketsCache.clear(); analysisCache.clear(); searchCache.clear();
}
export { marketsCache as _marketsCacheForTest, analysisCache as _analysisCacheForTest };
