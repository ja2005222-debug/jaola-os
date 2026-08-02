/**
 * 🛑 tradingBotCircuitBreaker.js — قاطع أمان يومي غير قابل للتفاوض (طلب
 * صريح من المالك). خسارة اليوم تُحسب دائماً من السجل نفسه (لا عدّاد منفصل
 * قد ينحرف عنه) — القاطع لا يمكن أن يختلف مع سجل التدقيق الفعلي.
 */
import { readAllTrades } from './tradingBotLedger.js';

function startOfUtcDayMs(now) {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** صافي الربح/الخسارة المحقَّق لصفقات البيع المؤكَّدة منذ نقطة زمنية (ms) مُعطاة. */
function realizedPnlSince(dir, sinceMs) {
    const trades = readAllTrades(dir);
    let total = 0;
    for (const r of trades) {
        if (r.kind !== 'trade' || r.side !== 'sell' || r.status !== 'confirmed') continue;
        if (r.realizedPnlBnb == null) continue;
        if ((r.updatedAt || 0) < sinceMs) continue;
        total += Number(r.realizedPnlBnb) || 0;
    }
    return total;
}

/**
 * صافي الربح/الخسارة المحقّق اليوم (بالـBNB) منذ بداية يوم UTC الحالي —
 * مقياس عرض بسيط وثابت (لا يتأثر بإعادة التسليح)، لواجهة الإدارة.
 * فقط صفقات البيع (إغلاق مركز) المؤكَّدة تُحسب — الشراء لا يُحقّق ربحاً/خسارة عند الفتح.
 */
export function getDailyRealizedPnlBnb(dir, now = new Date()) {
    return realizedPnlSince(dir, startOfUtcDayMs(now));
}

/**
 * هل القاطع مُفعَّل الآن؟ خسارة الفترة الحالية ≥ الحد المضبوط. الفترة تبدأ
 * من بداية يوم UTC أو من آخر إعادة تسليح يدوية (cfg.reArmedAt) أيّهما أحدث
 * — كي لا يُعيد التسليح إعادة تشغيل نفس القاطع فوراً بخسائر سابقة له.
 */
export function isCircuitBreakerTripped(dir, cfg, now = new Date()) {
    const limit = Number(cfg?.dailyLossLimitBnb);
    if (!(limit > 0)) return false; // لا حدّ مضبوط — لا معنى لقاطع بلا سقف
    const reArmedMs = cfg?.reArmedAt ? Date.parse(cfg.reArmedAt) : 0;
    const since = Math.max(startOfUtcDayMs(now), Number.isFinite(reArmedMs) ? reArmedMs : 0);
    const pnl = realizedPnlSince(dir, since);
    return pnl <= -limit;
}

/** حالة القاطع الكاملة — للوحة الإدارة. */
export function getCircuitBreakerStatus(dir, cfg, now = new Date()) {
    const dailyPnlBnb = getDailyRealizedPnlBnb(dir, now);
    const limitBnb = Number(cfg?.dailyLossLimitBnb) || 0;
    const tripped = isCircuitBreakerTripped(dir, cfg, now);
    const resetsAtUtc = new Date(startOfUtcDayMs(now) + 24 * 3600 * 1000).toISOString();
    return { tripped, dailyPnlBnb, limitBnb, resetsAtUtc };
}
