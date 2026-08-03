/**
 * 📈 tradingBotStats.js — ملخص أداء مُشتقّ من سجل التدقيق (append-only) دوماً،
 * لا عدّاد منفصل قد ينحرف (نفس مبدأ قاطع الأمان). البيانات كلها موجودة في
 * السجل — هذا يحوّلها من خام إلى إجابة عن "هل الاستراتيجية تكسب فعلاً؟".
 */
import { readAllTrades } from './tradingBotLedger.js';

/** ملخص أداء كامل: ربح/خسارة محقق، نسبة الفوز، أفضل/أسوأ عملة، أعداد. */
export function getPerformanceStats(dir) {
    const trades = readAllTrades(dir).filter(t => t.kind === 'trade');
    const closed = trades.filter(t => t.side === 'sell' && t.status === 'confirmed' && t.realizedPnlBnb != null);

    let totalPnlBnb = 0, wins = 0, losses = 0, totalGasBnb = 0;
    const byCoin = {}; // coinId → مجموع الربح/الخسارة المحقق
    for (const t of closed) {
        const pnl = Number(t.realizedPnlBnb) || 0;
        totalPnlBnb += pnl;
        if (pnl >= 0) wins++; else losses++;
        byCoin[t.coinId] = (byCoin[t.coinId] || 0) + pnl;
    }
    for (const t of trades) totalGasBnb += Number(t.gasCostBnb) || 0;

    const coinEntries = Object.entries(byCoin);
    let bestCoin = null, worstCoin = null;
    for (const [coinId, pnl] of coinEntries) {
        if (!bestCoin || pnl > bestCoin.pnlBnb) bestCoin = { coinId, pnlBnb: pnl };
        if (!worstCoin || pnl < worstCoin.pnlBnb) worstCoin = { coinId, pnlBnb: pnl };
    }

    const closedCount = closed.length;
    const buyCount = trades.filter(t => t.side === 'buy' && t.status === 'confirmed').length;
    return {
        totalPnlBnb, totalGasBnb,
        closedTradeCount: closedCount,
        openBuyCount: buyCount,
        wins, losses,
        winRatePct: closedCount ? (wins / closedCount) * 100 : null,
        bestCoin, worstCoin,
    };
}

/**
 * "لماذا لا صفقات؟" — يُحصي أسباب التجاهل في آخر considerations، فيكشف
 * القيد المهيمن (لا إشارة شراء؟ اشتباه honeypot؟ غاز؟) بدل التخمين.
 */
export function getRecentSkipSummary(dir, lookback = 200) {
    const recent = readAllTrades(dir).slice(-lookback);
    const considerations = recent.filter(t => t.kind === 'consideration' && t.decision === 'skipped');
    const counts = {};
    for (const c of considerations) {
        const key = c.skipReason || 'unknown';
        counts[key] = (counts[key] || 0) + 1;
    }
    const executed = recent.filter(t => t.kind === 'trade').length;
    // "لا إشارة قابلة للتنفيذ" لا يُسجَّل كتجاهل لعملة بعينها — نستنتجه من غياب الفرص
    return { skipReasonCounts: counts, executedInWindow: executed, considered: considerations.length };
}
