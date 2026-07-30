/**
 * 📊 cryptoMarket.js — بيانات سوق حقيقية (CoinGecko، بلا مفتاح) + تحليل فني
 * مبسّط (SMA7/SMA25/RSI14) يُنتج إشارة شراء/بيع/انتظار مفسَّرة بالعربية.
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
const ANALYSIS_TTL_MS = 3 * 60 * 1000; // 3 دقائق — تستدعي جلب تاريخ أثقل
const SEARCH_TTL_MS = 5 * 60 * 1000; // 5 دقائق — نتائج البحث لا تتغيّر بسرعة

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

async function fetchJson(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('http ' + res.status);
    return res.json();
}

/** يختزل مصفوفة [timestamp, price] (أي دقّة زمنية) إلى إغلاق يومي واحد لكل يوم UTC. */
export function toDailyCloses(prices) {
    const byDay = new Map();
    for (const point of Array.isArray(prices) ? prices : []) {
        const ts = point?.[0], price = point?.[1];
        if (typeof ts !== 'number' || typeof price !== 'number') continue;
        const day = new Date(ts).toISOString().slice(0, 10);
        byDay.set(day, price); // آخر نقطة في اليوم تستبدل السابقة (البيانات مرتّبة زمنياً تصاعدياً)
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, p]) => p);
}

export function sma(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / period;
}

/** RSI بصيغة المتوسط البسيط (لا تجانس Wilder) — كافٍ لإشارة تقريبية مفسَّرة، لا تنفيذ آلي دقيق. */
export function rsi(closes, period = 14) {
    if (closes.length < period + 1) return null;
    const slice = closes.slice(-(period + 1));
    let gainSum = 0, lossSum = 0;
    for (let i = 1; i < slice.length; i++) {
        const delta = slice[i] - slice[i - 1];
        if (delta >= 0) gainSum += delta; else lossSum += -delta;
    }
    const avgGain = gainSum / period, avgLoss = lossSum / period;
    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
}

// نُعيد رمز سبب (لا جملة عربية جاهزة) — القالب (app.js) هو من يترجمه لنص
// معروض، بنفس فلسفة كل النصوص الأخرى في القالب: مُضمَّنة بالواجهة لا في
// استجابة الخادم، كي تلتقطها ترجمة templateLocalizer.js لموقع بالإنجليزية.
export function buildSignal({ sma7, sma25, rsi14 }) {
    if (rsi14 != null && rsi14 >= 70) return { signal: 'sell', reasonCode: 'rsi_overbought' };
    if (rsi14 != null && rsi14 <= 30) return { signal: 'buy', reasonCode: 'rsi_oversold' };
    if (sma7 != null && sma25 != null && sma7 > sma25) return { signal: 'buy', reasonCode: 'sma_bullish' };
    if (sma7 != null && sma25 != null && sma7 < sma25) return { signal: 'sell', reasonCode: 'sma_bearish' };
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

/** تحليل فني كامل لعملة واحدة: سعر + SMA7/SMA25 + RSI14 + إشارة مفسَّرة. */
export async function getAnalysis(id) {
    if (!isValidCoinId(id)) return { error: 'عملة غير صالحة' };
    const cached = analysisCache.get(id);
    if (cached && Date.now() - cached.at < ANALYSIS_TTL_MS) return { ...cached.data, stale: false };
    try {
        const url = `${API_BASE}/coins/${id}/market_chart?vs_currency=usd&days=40`;
        const raw = await fetchJson(url);
        const closes = toDailyCloses(raw?.prices);
        if (!closes.length) throw new Error('لا بيانات تاريخية');
        const price = closes[closes.length - 1];
        const sma7 = sma(closes, 7), sma25 = sma(closes, 25), rsi14 = rsi(closes, 14);
        const { signal, reasonCode } = buildSignal({ sma7, sma25, rsi14 });
        // آخر 14 إغلاقاً يومياً — للرسم البياني المصغّر (sparkline) في الواجهة، بلا نداء إضافي.
        const recentCloses = closes.slice(-14);
        const data = { id, price, sma7, sma25, rsi14, signal, reasonCode, recentCloses, updatedAt: Date.now() };
        analysisCache.set(id, { data, at: Date.now() });
        return { ...data, stale: false };
    } catch {
        if (cached) return { ...cached.data, stale: true };
        return { error: 'تعذّر جلب بيانات التحليل الآن — حاول مجدداً بعد قليل' };
    }
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
