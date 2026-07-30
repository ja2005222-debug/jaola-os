/**
 * 📊 cryptoMarket.js — بيانات سوق حقيقية (CoinGecko، بلا مفتاح) + تحليل فني
 * مبسّط (SMA7/SMA25/RSI14) يُنتج إشارة شراء/بيع/انتظار مفسَّرة بالعربية.
 *
 * ليس تنفيذاً آلياً للتداول أبداً — تحليل وعرض فقط (قرار المستخدم صاحب
 * الحساب). كاش داخلي (Map) يحمي CoinGecko من الاستهلاك المفرط عبر كل
 * المستخدمين معاً (مشترك، لا لكل مشروع)، ويصمد على فشل الشبكة بإرجاع
 * آخر بيانات معروفة موسومة stale:true بدل الانهيار.
 */

const API_BASE = 'https://api.coingecko.com/api/v3';

// قائمة مقفلة (لا نتيح أي id عشوائي) — تحمي من إساءة استخدام نقطة النهاية
// كوكيل مفتوح لأي طلب على CoinGecko.
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

const MARKETS_TTL_MS = 60 * 1000; // دقيقة — بيانات سعر/تغيّر 24س خفيفة
const ANALYSIS_TTL_MS = 3 * 60 * 1000; // 3 دقائق — تستدعي جلب تاريخ أثقل

const marketsCache = new Map(); // 'all' → { data, at }
const analysisCache = new Map(); // coinId → { data, at }

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

/** أسعار + تغيّر 24س لكل العملات المدعومة (نداء CoinGecko واحد للجميع). */
export async function listMarkets() {
    const cached = marketsCache.get('all');
    if (cached && Date.now() - cached.at < MARKETS_TTL_MS) return { coins: cached.data, stale: false };
    try {
        const ids = SUPPORTED_COINS.map(c => c.id).join(',');
        const url = `${API_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&price_change_percentage=24h`;
        const raw = await fetchJson(url);
        const byId = new Map((Array.isArray(raw) ? raw : []).map(r => [r.id, r]));
        const data = SUPPORTED_COINS.map(c => {
            const r = byId.get(c.id);
            return { id: c.id, symbol: c.symbol, nameAr: c.nameAr, price: r?.current_price ?? null, change24h: r?.price_change_percentage_24h ?? null };
        });
        marketsCache.set('all', { data, at: Date.now() });
        return { coins: data, stale: false };
    } catch {
        if (cached) return { coins: cached.data, stale: true };
        return { coins: SUPPORTED_COINS.map(c => ({ id: c.id, symbol: c.symbol, nameAr: c.nameAr, price: null, change24h: null })), stale: true };
    }
}

/** تحليل فني كامل لعملة واحدة: سعر + SMA7/SMA25 + RSI14 + إشارة مفسَّرة. */
export async function getAnalysis(id) {
    const coin = findCoin(id);
    if (!coin) return { error: 'عملة غير مدعومة' };
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
        const data = { id: coin.id, symbol: coin.symbol, nameAr: coin.nameAr, price, sma7, sma25, rsi14, signal, reasonCode, updatedAt: Date.now() };
        analysisCache.set(id, { data, at: Date.now() });
        return { ...data, stale: false };
    } catch {
        if (cached) return { ...cached.data, stale: true };
        return { error: 'تعذّر جلب بيانات التحليل الآن — حاول مجدداً بعد قليل' };
    }
}

/** لإعادة ضبط الكاش بين الاختبارات فقط. */
export function resetCryptoCache() {
    marketsCache.clear();
    analysisCache.clear();
}

// تصدير الكاش نفسه للاختبارات فقط (محاكاة انتهاء صلاحية بلا انتظار حقيقي) —
// لا يُستخدَم إنتاجياً خارج دوال هذا الملف.
export { marketsCache as _marketsCacheForTest, analysisCache as _analysisCacheForTest };
