/**
 * 🤖 tradingBotEngine.js — دورة تنفيذ بوت PancakeSwap الشخصي. الدالة النقية
 * runTradingBotTick تُنسّق الترتيب فقط؛ كل تفاعل مع السلسلة يمرّ عبر
 * chainClient المحقون (pancakeSwapExecutor.createChainClient) — منفذ الحقن
 * الوحيد، فتُختبَر الدورة كاملة بكائن وهمي بلا سلسلة حقيقية أو مال حقيقي.
 *
 * ترتيب الفحوصات غير قابل لإعادة الترتيب (موثَّق في خطة التنفيذ):
 * 0) تسوية صفقات pending من دورة سابقة (تعطّل منتصف التنفيذ)
 * 1) قاطع الأمان اليومي — صفر فتح صفقات جديدة إن كان مُفعَّلاً
 * 2) ترتيب الفرص (getOpportunities الموجودة، بلا تعديل عليها) — كل فرصة تُسجَّل
 * 3) بوابة التبريد/حالة المركز
 * 4) فحص رصيد الغاز
 * 5) عرض سعر محمي بانزلاق (لا amountOutMin صفري أبداً)
 * 6) حجم الصفقة الثابت + سقف عدد المراكز المفتوحة
 * 7) التنفيذ (تسجيل pending قبل الإرسال)
 * 8) انتظار تأكيد فعلي
 * 9) تسجيل النتيجة + تحديث المركز — قاطع الأمان يُعاد حسابه من السجل دوماً
 */
import { ethers } from 'ethers';
import { getOpportunities } from './cryptoMarket.js';
import { getProjectSecrets } from './projectSecrets.js';
import { getProvider } from './chainProvider.js';
import { createChainClient, applySlippage, WBNB } from './pancakeSwapExecutor.js';
import { filterTradable, getTokenInfo } from './tradingBotCoins.js';
import { getConfig } from './tradingBotConfig.js';
import { isCircuitBreakerTripped } from './tradingBotCircuitBreaker.js';
import {
    recordConsideration, recordTradeOpen, updateTradeOutcome,
    findStalePending, readPositions, writePosition, clearPosition,
} from './tradingBotLedger.js';

function toBnb(wei) { return Number(ethers.formatEther(wei)); }

/** يبني عميل السلسلة الحقيقي من مفتاح المحفظة المخزَّن (سرّ مشروع مشفَّر موجود أصلاً). لا مفتاح ⇒ null. */
function buildRealChainClient(cfg) {
    const secrets = getProjectSecrets(cfg.secretUsername, cfg.secretProject);
    const privateKey = secrets?.[cfg.secretKeyName];
    if (!privateKey) return null;
    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    return { chainClient: createChainClient({ provider, signer: wallet }), walletAddress: wallet.address };
}

/** يُحسم أي صفقة pending/unconfirmed من دورة سابقة قبل النظر في أي فرصة جديدة. */
async function reconcileStaleTrades(dir, chainClient) {
    const stale = findStalePending(dir);
    for (const trade of stale) {
        if (!trade.txHash) { updateTradeOutcome(dir, trade.id, { status: 'failed', error: 'لا txHash — تعذّر الإرسال أصلاً' }); continue; }
        const r = await chainClient.waitForReceipt(trade.txHash, 1, 5000).catch(() => ({ confirmed: false, timedOut: true }));
        if (!r.confirmed) continue; // ما زالت معلَّقة فعلياً — تُعاد المحاولة في الدورة القادمة
        const status = r.status === 1 ? 'confirmed' : 'reverted';
        const gasCostBnb = r.gasUsed != null && r.gasPrice != null ? toBnb(r.gasUsed * r.gasPrice) : null;
        if (status === 'reverted') { updateTradeOutcome(dir, trade.id, { status, gasCostBnb }); continue; }
        // مؤكَّدة فعلياً — نُعيد بناء المركز تقريبياً من القيمة المتوقَّعة وقت الفتح
        // (لا استخراج دقيق من سجلات الحدث Transfer هنا — تقريب موثَّق مقصود لمسار تعافٍ نادر).
        if (trade.side === 'buy') {
            writePosition(dir, trade.coinId, {
                entryBnbSpent: trade.amountBnbWei, entryTokenWei: trade.expectedOut,
                entryTxHash: trade.txHash, entryAt: trade.at, tokenAddress: getTokenInfo(dir, trade.coinId)?.address || null,
                entryGasCostBnb: gasCostBnb, lastActionAt: Date.now(),
            });
            updateTradeOutcome(dir, trade.id, { status, gasCostBnb });
        } else {
            const positions = readPositions(dir);
            const pos = positions[trade.coinId];
            const realizedPnlBnb = pos
                ? toBnb(BigInt(trade.expectedOut || '0')) - toBnb(BigInt(pos.entryBnbSpent || '0')) - (gasCostBnb || 0) - (Number(pos.entryGasCostBnb) || 0)
                : null;
            updateTradeOutcome(dir, trade.id, { status, gasCostBnb, realizedPnlBnb });
            clearPosition(dir, trade.coinId);
        }
    }
}

/**
 * دورة واحدة. options.chainClient/walletAddress للاختبارات (يتجاوزان بناء
 * محفظة حقيقية). بلا تجاوز، يُبنى العميل من السرّ المضبوط في الإعداد.
 */
export async function runTradingBotTick(dir, options = {}) {
    const cfg = getConfig(dir);
    if (!cfg.enabled) return { executed: false, reason: 'disabled' };

    let chainClient = options.chainClient;
    let walletAddress = options.walletAddress;
    if (!chainClient) {
        const built = buildRealChainClient(cfg);
        if (!built) {
            recordConsideration(dir, { coinId: null, signal: null, decision: 'skipped', skipReason: 'no_key' });
            return { executed: false, reason: 'no_key' };
        }
        ({ chainClient, walletAddress } = built);
    }

    // 0) تسوية صفقات معلَّقة من دورة سابقة — قبل أي شيء آخر
    await reconcileStaleTrades(dir, chainClient);

    // 1) قاطع الأمان اليومي — صفر نداءات تفتح صفقة جديدة بعد هذه النقطة إن كان مُفعَّلاً
    if (isCircuitBreakerTripped(dir, cfg)) {
        recordConsideration(dir, { coinId: null, signal: null, decision: 'skipped', skipReason: 'circuit_breaker' });
        return { executed: false, reason: 'circuit_breaker' };
    }

    // 2) ترتيب الفرص — cryptoMarket.getOpportunities الموجودة، بلا تعديل عليها
    const tradableCoins = filterTradable(dir, cfg.coinIds);
    const opportunities = tradableCoins.length ? await getOpportunities(tradableCoins, cfg.timeframe) : [];
    // كل فرصة غير الأعلى تُرتَّب تُسجَّل فوراً كمتجاهَلة — مصيرها معروف الآن.
    // الفرصة الأعلى (candidate) تُسجَّل لاحقاً عند حسم مصيرها (تجاهل بسبب محدَّد،
    // أو سجل صفقة منفصل عند التنفيذ) — لا سجل "معلَّق" مزدوج بلا داعٍ.
    opportunities.slice(1).forEach(o => {
        recordConsideration(dir, {
            coinId: o.id, signal: o.signal, reasonCode: o.reasonCode, strength: o.strength,
            decision: 'skipped', skipReason: 'not_top_ranked',
        });
    });
    if (!opportunities.length) return { executed: false, reason: 'no_opportunity' };
    const candidate = opportunities[0];

    const tokenInfo = getTokenInfo(dir, candidate.id);
    if (!tokenInfo) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'not_tradable' });
        return { executed: false, reason: 'not_tradable' };
    }

    // 3) بوابة التبريد/حالة المركز
    const positions = readPositions(dir);
    const openPosition = positions[candidate.id];
    if (candidate.signal === 'buy' && openPosition) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'position_already_open' });
        return { executed: false, reason: 'position_already_open' };
    }
    if (candidate.signal === 'sell' && !openPosition) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'no_position_to_sell' });
        return { executed: false, reason: 'no_position_to_sell' };
    }
    const cooldownMs = (cfg.cooldownMinutesPerCoin || 0) * 60 * 1000;
    if (openPosition?.lastActionAt && Date.now() - openPosition.lastActionAt < cooldownMs) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'cooldown' });
        return { executed: false, reason: 'cooldown' };
    }

    // 4) فحص رصيد الغاز — فشل مغلَق دوماً، لا "جرّب رغم ذلك"
    const positionSizeWei = ethers.parseEther(String(cfg.positionSizeBnb));
    const minGasReserveWei = ethers.parseEther(String(cfg.minGasReserveBnb));
    const bnbBalance = await chainClient.getBnbBalance(walletAddress);
    if (candidate.signal === 'buy' && bnbBalance < positionSizeWei + minGasReserveWei) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'insufficient_gas' });
        return { executed: false, reason: 'insufficient_gas', alert: 'insufficient_gas' };
    }
    if (candidate.signal === 'sell' && bnbBalance < minGasReserveWei) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'insufficient_gas' });
        return { executed: false, reason: 'insufficient_gas', alert: 'insufficient_gas' };
    }

    // 6) سقف عدد المراكز المفتوحة (قبل التنفيذ، للشراء فقط — البيع يُغلق مركزاً لا يفتحه)
    if (candidate.signal === 'buy' && Object.keys(positions).length >= (cfg.maxOpenPositions || 1)) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'max_open_positions' });
        return { executed: false, reason: 'max_open_positions' };
    }

    // 5) عرض سعر محمي بانزلاق
    const side = candidate.signal; // 'buy' | 'sell'
    const amountInWei = side === 'buy' ? positionSizeWei : BigInt(openPosition.entryTokenWei);
    const path = side === 'buy' ? [WBNB, tokenInfo.address] : [tokenInfo.address, WBNB];
    const quote = await chainClient.quote(amountInWei, path);
    const minOut = applySlippage(quote, cfg.maxSlippageBps);

    // 7) التنفيذ — تسجيل pending قبل الإرسال (قابل للاسترجاع عند تعطّل)
    const tradeId = recordTradeOpen(dir, {
        coinId: candidate.id, side, signal: candidate.signal, reasonCode: candidate.reasonCode,
        amountBnbWei: amountInWei, expectedOut: quote, minOut,
    });

    let txHash;
    try {
        if (side === 'buy') {
            txHash = await chainClient.buy({ tokenAddress: tokenInfo.address, amountInWei, amountOutMin: minOut, toAddress: walletAddress });
        } else {
            await chainClient.ensureAllowance({ tokenAddress: tokenInfo.address, ownerAddress: walletAddress, amountWei: amountInWei });
            txHash = await chainClient.sell({ tokenAddress: tokenInfo.address, amountInWei, amountOutMin: minOut, toAddress: walletAddress });
        }
    } catch (e) {
        updateTradeOutcome(dir, tradeId, { status: 'failed', error: e.message });
        return { executed: false, reason: 'send_failed', tradeId };
    }

    // 8) انتظار تأكيد فعلي — لا نجاح مُفترَض عند انتهاء المهلة
    const receipt = await chainClient.waitForReceipt(txHash, cfg.confirmationsRequired);
    if (!receipt.confirmed) {
        updateTradeOutcome(dir, tradeId, { status: 'unconfirmed', txHash });
        return { executed: true, tradeId, txHash, status: 'unconfirmed' };
    }

    // 9) تسجيل النتيجة + تحديث المركز
    const status = receipt.status === 1 ? 'confirmed' : 'reverted';
    const gasCostBnb = receipt.gasUsed != null && receipt.gasPrice != null ? toBnb(receipt.gasUsed * receipt.gasPrice) : null;

    if (status === 'reverted') {
        updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb });
        return { executed: true, tradeId, txHash, status };
    }

    if (side === 'buy') {
        writePosition(dir, candidate.id, {
            entryBnbSpent: amountInWei.toString(), entryTokenWei: quote.toString(),
            entryTxHash: txHash, entryAt: Date.now(), tokenAddress: tokenInfo.address,
            entryGasCostBnb: gasCostBnb, lastActionAt: Date.now(),
        });
        updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb });
    } else {
        const realizedPnlBnb = toBnb(quote) - toBnb(BigInt(openPosition.entryBnbSpent)) - (gasCostBnb || 0) - (Number(openPosition.entryGasCostBnb) || 0);
        updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb, realizedPnlBnb });
        clearPosition(dir, candidate.id);
    }

    return { executed: true, tradeId, txHash, status, coinId: candidate.id, side };
}

let tickBusy = false;

/** حارس تداخل مشترك بين الحلقة المجدولة وأي تشغيل يدوي — يمنع تسابقاً يضاعف nonce التوقيع. */
export async function runTradingBotTickGuarded(dir, options = {}) {
    if (tickBusy) return { executed: false, reason: 'busy' };
    tickBusy = true;
    try {
        return await runTradingBotTick(dir, options);
    } finally {
        tickBusy = false;
    }
}

export function isTickBusy() { return tickBusy; }
