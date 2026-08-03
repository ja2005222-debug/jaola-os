/**
 * 🤖 tradingBotEngine.js — دورة تنفيذ بوت PancakeSwap الشخصي. الدالة النقية
 * runTradingBotTick تُنسّق الترتيب فقط؛ كل تفاعل مع السلسلة يمرّ عبر
 * chainClient المحقون (pancakeSwapExecutor.createChainClient) — منفذ الحقن
 * الوحيد، فتُختبَر الدورة كاملة بكائن وهمي بلا سلسلة حقيقية أو مال حقيقي.
 *
 * ترتيب الفحوصات غير قابل لإعادة الترتيب (موثَّق في خطة التنفيذ):
 * 0) تسوية صفقات pending من دورة سابقة (تعطّل منتصف التنفيذ)
 * 0ب) مخارج حماية المراكز المفتوحة (وقف خسارة/جني ربح) — قبل قاطع الأمان
 *     عمداً: إغلاق مركز ينزف تقليلٌ للضرر لا مخاطرة جديدة، ويجب أن يعمل
 *     حتى في يوم أوقف فيه القاطع فتح الصفقات (خسارته المحققة تُغذّي القاطع
 *     نفسه فيوقف الشراء تلقائياً — التفاعل الصحيح بالضبط).
 * 1) قاطع الأمان اليومي — صفر فتح صفقات جديدة إن كان مُفعَّلاً
 * 2) ترتيب الفرص (getOpportunities الموجودة، بلا تعديل عليها) واختيار أول
 *    فرصة قابلة للتنفيذ فعلاً (شراء بلا مركز مفتوح / بيع بمركز مفتوح) —
 *    إشارة ميتة في الصدارة (بيع بلا مركز) لا تحجب فرصة حية أدنى ترتيباً؛
 *    كل فرصة (حتى المتجاهَلة) تُسجَّل بسببها المحدَّد
 * 3) بوابة التبريد
 * 4) فحص رصيد الغاز
 * 5) عرض سعر محمي بانزلاق (لا amountOutMin صفري أبداً)
 * 6) حجم الصفقة الثابت + سقف عدد المراكز المفتوحة
 * 7) التنفيذ (تسجيل pending قبل الإرسال)
 * 8) انتظار تأكيد فعلي
 * 9) تسجيل النتيجة + تحديث المركز — قاطع الأمان يُعاد حسابه من السجل دوماً
 */
import { ethers } from 'ethers';
import { getOpportunities, MAX_WATCHLIST } from './cryptoMarket.js';
import { getProjectSecrets } from './projectSecrets.js';
import { getProvider } from './chainProvider.js';
import { createChainClient, applySlippage, WBNB } from './pancakeSwapExecutor.js';
import { filterTradable, getTokenInfo, isTradable, upsertToken, discoverTrendingCandidates } from './tradingBotCoins.js';
import { getConfig, saveConfig } from './tradingBotConfig.js';
import { isCircuitBreakerTripped } from './tradingBotCircuitBreaker.js';
import { sendMail } from './mailer.js';
import {
    recordConsideration, recordTradeOpen, updateTradeOutcome,
    findStalePending, readPositions, writePosition, clearPosition, writeHeartbeat, readHeartbeat,
} from './tradingBotLedger.js';
import { getPerformanceStats } from './tradingBotStats.js';

function toBnb(wei) { return Number(ethers.formatEther(wei)); }

/** تنبيه بريدي اختياري (cfg.alertEmail) — فشله لا يمسّ التداول أبداً. */
async function notify(cfg, subject, text) {
    if (!cfg.alertEmail) return;
    try { await sendMail({ to: cfg.alertEmail, subject, text }); } catch { /* البريد ثانوي دوماً */ }
}

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
 * مخارج حماية المراكز المفتوحة: يقيّم كل مركز بعرض سعر حي، ويبيع فوراً من
 * تجاوز وقف الخسارة أو جني الربح المضبوطين (0 = معطَّل). مخرج واحد كحد أقصى
 * لكل دورة (تسلسل nonce آمن). يتجاهل التبريد عمداً — هذا مخرج طوارئ محكوم
 * بعتبة سعرية لا إشارة متقلبة. يُرجع نتيجة الصفقة إن نُفِّذت، وإلا null.
 */
async function runProtectiveExits(dir, cfg, chainClient, walletAddress) {
    const stopLossPct = Number(cfg.stopLossPct) || 0;
    const takeProfitPct = Number(cfg.takeProfitPct) || 0;
    const trailingStopPct = Number(cfg.trailingStopPct) || 0;
    if (stopLossPct <= 0 && takeProfitPct <= 0 && trailingStopPct <= 0) return null;

    const positions = readPositions(dir);
    for (const [coinId, pos] of Object.entries(positions)) {
        const tokenInfo = getTokenInfo(dir, coinId);
        if (!tokenInfo || !pos.entryTokenWei || !pos.entryBnbSpent) continue;
        // الكمية الفعلية المملوكة الآن (لا المسجَّلة) — رصيد صفر = مركز شبح يُنظَّف
        let heldWei;
        try { heldWei = await chainClient.tokenBalance(tokenInfo.address, walletAddress); } catch { continue; }
        if (heldWei <= 0n) { clearPosition(dir, coinId); continue; }
        let quote;
        try { quote = await chainClient.quote(heldWei, [tokenInfo.address, WBNB]); } catch { continue; }
        const entryBnb = toBnb(BigInt(pos.entryBnbSpent));
        if (!(entryBnb > 0)) continue;
        const currentBnb = toBnb(quote);
        const changePct = ((currentBnb - entryBnb) / entryBnb) * 100;

        // أعلى قيمة بلغها المركز (يبدأ من قيمة الدخول) — يُحدَّث ويُثبَّت كل دورة
        const prevHigh = Number(pos.highWaterBnb) || entryBnb;
        const highBnb = Math.max(prevHigh, currentBnb);
        if (highBnb > prevHigh) writePosition(dir, coinId, { ...pos, highWaterBnb: highBnb });

        // الوقف المتحرك يحمي الربح فقط (يعمل بعد صعود المركز فوق الدخول) —
        // خسائر ما دون الدخول يتكفّل بها وقف الخسارة، فلا ازدواج.
        const trailingHit = trailingStopPct > 0 && highBnb > entryBnb
            && currentBnb <= highBnb * (1 - trailingStopPct / 100);
        const exitCode = (stopLossPct > 0 && changePct <= -stopLossPct) ? 'stop_loss'
            : (takeProfitPct > 0 && changePct >= takeProfitPct) ? 'take_profit'
            : trailingHit ? 'trailing_stop' : null;
        if (!exitCode) continue;

        const minGasReserveWei = ethers.parseEther(String(cfg.minGasReserveBnb));
        const bnbBalance = await chainClient.getBnbBalance(walletAddress);
        if (bnbBalance < minGasReserveWei) {
            const written = recordConsideration(dir, { coinId, signal: 'sell', reasonCode: exitCode, decision: 'skipped', skipReason: 'insufficient_gas' });
            if (written) await notify(cfg, 'بوت التداول: غاز غير كافٍ لمخرج حماية', `تعذّر تنفيذ ${exitCode} لعملة ${coinId} — رصيد BNB أقل من احتياطي الغاز.`);
            continue;
        }

        const amountInWei = heldWei;
        const minOut = applySlippage(quote, cfg.maxSlippageBps);
        const tradeId = recordTradeOpen(dir, { coinId, side: 'sell', signal: 'sell', reasonCode: exitCode, amountBnbWei: amountInWei, expectedOut: quote, minOut });
        let txHash;
        try {
            await chainClient.ensureAllowance({ tokenAddress: tokenInfo.address, ownerAddress: walletAddress, amountWei: amountInWei });
            txHash = await chainClient.sell({ tokenAddress: tokenInfo.address, amountInWei, amountOutMin: minOut, toAddress: walletAddress });
        } catch (e) {
            updateTradeOutcome(dir, tradeId, { status: 'failed', error: e.message });
            return { executed: false, reason: 'send_failed', tradeId, exit: exitCode };
        }
        const receipt = await chainClient.waitForReceipt(txHash, cfg.confirmationsRequired);
        if (!receipt.confirmed) {
            updateTradeOutcome(dir, tradeId, { status: 'unconfirmed', txHash });
            return { executed: true, tradeId, txHash, status: 'unconfirmed', coinId, side: 'sell', exit: exitCode };
        }
        const status = receipt.status === 1 ? 'confirmed' : 'reverted';
        const gasCostBnb = receipt.gasUsed != null && receipt.gasPrice != null ? toBnb(receipt.gasUsed * receipt.gasPrice) : null;
        if (status === 'reverted') {
            updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb });
            return { executed: true, tradeId, txHash, status, coinId, side: 'sell', exit: exitCode };
        }
        const realizedPnlBnb = toBnb(quote) - entryBnb - (gasCostBnb || 0) - (Number(pos.entryGasCostBnb) || 0);
        updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb, realizedPnlBnb });
        clearPosition(dir, coinId);
        const exitLabel = exitCode === 'stop_loss' ? 'وقف خسارة' : exitCode === 'take_profit' ? 'جني ربح' : 'وقف متحرك';
        await notify(cfg, `بوت التداول: ${exitLabel} — ${coinId}`,
            `بيع ${coinId} عند ${changePct.toFixed(2)}% من الدخول. ربح/خسارة محقق: ${realizedPnlBnb.toFixed(6)} BNB. tx: ${txHash}`);
        return { executed: true, tradeId, txHash, status, coinId, side: 'sell', exit: exitCode };
    }
    return null;
}

// الاكتشاف التلقائي لا يعمل أكثر من مرة كل 30 دقيقة (فوق كاش trending نفسه) —
// يحمي حصة CoinGecko المجانية من نداءات تحليل متكررة لعملات جديدة كل 5 دقائق.
const AUTO_DISCOVERY_INTERVAL_MS = 30 * 60 * 1000;
let lastAutoDiscoveryAt = 0;

/** للاختبارات فقط. */
export function resetAutoDiscoveryThrottleForTest() { lastAutoDiscoveryAt = 0; }

/**
 * الاكتشاف التلقائي (خيار صريح عالي الخطورة، معطَّل افتراضياً): يجلب الرائج
 * على CoinGecko، يحلّله عبر محرك الإشارات نفسه، ومن أصدر شراءً فعلياً يُسجَّل
 * في سجل العملات (بعنوان عقده من CoinGecko — بلا تحقق يدوي!) ويُضاف لقائمة
 * المتابعة، فيدخل دورة التداول الاعتيادية بكل ضوابطها (حجم ثابت، قاطع أمان،
 * سقف مراكز، انزلاق). لا ينفّذ شراءً بنفسه أبداً — التسجيل والمتابعة فقط.
 * يُرجع الإعداد المحدَّث إن أضاف شيئاً، وإلا null.
 */
async function runAutoDiscovery(dir, cfg) {
    if (Date.now() - lastAutoDiscoveryAt < AUTO_DISCOVERY_INTERVAL_MS) return null;
    lastAutoDiscoveryAt = Date.now();

    let candidates;
    try { candidates = await discoverTrendingCandidates(); } catch { return null; }
    const fresh = candidates.filter(c => !isTradable(dir, c.coinId));
    if (!fresh.length) return null;
    const room = Math.max(0, MAX_WATCHLIST - (cfg.coinIds?.length || 0));
    if (!room) return null;

    let opps;
    try { opps = await getOpportunities(fresh.map(c => c.coinId), cfg.timeframe); } catch { return null; }
    const buyable = opps.filter(o => o.signal === 'buy');

    const coinIds = [...(cfg.coinIds || [])];
    let added = 0;
    for (const o of buyable) {
        if (added >= room) break;
        const cand = fresh.find(c => c.coinId === o.id);
        if (!cand) continue;
        try { upsertToken(dir, cand); } catch { continue; } // binancecoin/شكل غير صالح — يُتجاوَز
        if (!coinIds.includes(o.id)) coinIds.push(o.id);
        added++;
        recordConsideration(dir, { coinId: o.id, signal: o.signal, reasonCode: 'auto_discovered', strength: o.strength, decision: 'auto_registered' });
        await notify(cfg, `بوت التداول: عملة رائجة سُجِّلت تلقائياً — ${o.id}`,
            `${cand.symbol} سُجِّلت تلقائياً بإشارة شراء (عنوان العقد من CoinGecko بلا تحقق يدوي: ${cand.address}). ستدخل دورة التداول الاعتيادية بكل ضوابطها.`);
    }
    if (!added) return null;
    return saveConfig(dir, { coinIds });
}

/**
 * دورة واحدة. options.chainClient/walletAddress للاختبارات (يتجاوزان بناء
 * محفظة حقيقية). بلا تجاوز، يُبنى العميل من السرّ المضبوط في الإعداد.
 */
export async function runTradingBotTick(dir, options = {}) {
    let cfg = getConfig(dir);
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

    // 0ب) مخارج حماية المراكز المفتوحة — قبل قاطع الأمان عمداً (انظر رأس الملف)
    const protective = await runProtectiveExits(dir, cfg, chainClient, walletAddress);
    if (protective) return protective;

    // 1) قاطع الأمان اليومي — صفر نداءات تفتح صفقة جديدة بعد هذه النقطة إن كان مُفعَّلاً
    if (isCircuitBreakerTripped(dir, cfg)) {
        recordConsideration(dir, { coinId: null, signal: null, decision: 'skipped', skipReason: 'circuit_breaker' });
        return { executed: false, reason: 'circuit_breaker' };
    }

    // 1ب) الاكتشاف التلقائي (اختياري صريح) — بعد قاطع الأمان عمداً: لا عملات
    // جديدة تُضاف في يوم أوقف فيه القاطع الشراء. الإضافة تتسع بها قائمة
    // المتابعة فتلتقطها هذه الدورة نفسها عبر الترتيب الاعتيادي أدناه.
    if (cfg.autoDiscoveryEnabled) {
        const updatedCfg = await runAutoDiscovery(dir, cfg);
        if (updatedCfg) cfg = updatedCfg;
    }

    // 2) ترتيب الفرص (getOpportunities بلا تعديل) واختيار أول فرصة قابلة
    // للتنفيذ فعلاً: شراء بلا مركز مفتوح، أو بيع بمركز مفتوح. إشارة ميتة في
    // الصدارة (بيع بلا مركز يتكرر لأيام) كانت تحجب كل ما تحتها — الآن تُسجَّل
    // بسببها وتُتجاوَز. كل فرصة غير المختارة تُسجَّل فوراً بسبب تجاهلها المحدَّد؛
    // المختارة تُسجَّل عند حسم مصيرها (تجاهل لاحق محدَّد أو سجل صفقة).
    const tradableCoins = filterTradable(dir, cfg.coinIds);
    const opportunities = tradableCoins.length ? await getOpportunities(tradableCoins, cfg.timeframe) : [];
    if (!opportunities.length) return { executed: false, reason: 'no_opportunity' };

    const positions = readPositions(dir);
    let candidate = null;
    for (const o of opportunities) {
        const hasPosition = !!positions[o.id];
        const actionable = o.signal === 'buy' ? !hasPosition : hasPosition;
        if (!candidate && actionable) { candidate = o; continue; }
        recordConsideration(dir, {
            coinId: o.id, signal: o.signal, reasonCode: o.reasonCode, strength: o.strength,
            decision: 'skipped',
            skipReason: actionable ? 'not_top_ranked' : (o.signal === 'buy' ? 'position_already_open' : 'no_position_to_sell'),
        });
    }
    if (!candidate) return { executed: false, reason: 'no_actionable_opportunity' };

    const tokenInfo = getTokenInfo(dir, candidate.id);
    if (!tokenInfo) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'not_tradable' });
        return { executed: false, reason: 'not_tradable' };
    }

    // 3) بوابة التبريد
    const openPosition = positions[candidate.id];
    const cooldownMs = (cfg.cooldownMinutesPerCoin || 0) * 60 * 1000;
    if (openPosition?.lastActionAt && Date.now() - openPosition.lastActionAt < cooldownMs) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'cooldown' });
        return { executed: false, reason: 'cooldown' };
    }

    // 4) فحص رصيد الغاز — فشل مغلَق دوماً، لا "جرّب رغم ذلك"
    const positionSizeWei = ethers.parseEther(String(cfg.positionSizeBnb));
    const minGasReserveWei = ethers.parseEther(String(cfg.minGasReserveBnb));
    const bnbBalance = await chainClient.getBnbBalance(walletAddress);
    const gasShort = candidate.signal === 'buy' ? bnbBalance < positionSizeWei + minGasReserveWei : bnbBalance < minGasReserveWei;
    if (gasShort) {
        const written = recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'insufficient_gas' });
        if (written) await notify(cfg, 'بوت التداول: رصيد BNB غير كافٍ', `تجاهُل ${candidate.signal} لعملة ${candidate.id} — الرصيد ${toBnb(bnbBalance).toFixed(6)} BNB أقل من المطلوب. أودِع BNB أو عطِّل البوت.`);
        return { executed: false, reason: 'insufficient_gas', alert: 'insufficient_gas' };
    }

    // 6) سقف عدد المراكز المفتوحة (قبل التنفيذ، للشراء فقط — البيع يُغلق مركزاً لا يفتحه)
    if (candidate.signal === 'buy' && Object.keys(positions).length >= (cfg.maxOpenPositions || 1)) {
        recordConsideration(dir, { coinId: candidate.id, signal: candidate.signal, decision: 'skipped', skipReason: 'max_open_positions' });
        return { executed: false, reason: 'max_open_positions' };
    }

    // 5) عرض سعر محمي بانزلاق — البيع بالكمية الفعلية المملوكة الآن (لا
    // المسجَّلة وقت الدخول): الكمية المستلمة تختلف عن المقتبَسة بسبب الانزلاق
    // ورسوم التوكن، فبيع كمية أكبر من الفعلية يُفشل المعاملة ويحرق غازها.
    const side = candidate.signal; // 'buy' | 'sell'
    let amountInWei;
    if (side === 'buy') {
        amountInWei = positionSizeWei;
    } else {
        amountInWei = await chainClient.tokenBalance(tokenInfo.address, walletAddress);
        if (amountInWei <= 0n) {
            recordConsideration(dir, { coinId: candidate.id, signal: 'sell', decision: 'skipped', skipReason: 'no_token_balance' });
            clearPosition(dir, candidate.id); // مركز شبح: مسجَّل لكن لا رصيد فعلي (بيع يدوي/فخ)
            return { executed: false, reason: 'no_token_balance' };
        }
    }
    const path = side === 'buy' ? [WBNB, tokenInfo.address] : [tokenInfo.address, WBNB];
    const quote = await chainClient.quote(amountInWei, path);
    const minOut = applySlippage(quote, cfg.maxSlippageBps);

    // فحوصات ما قبل الشراء الإضافية (لا تخصّ البيع — البيع خروج مطلوب دوماً)
    if (side === 'buy') {
        // فحص honeypot: عرض سعر ذهاب وإياب (BNB→توكن→BNB). خسارة نظرية مفرطة
        // في دورة فورية = ضرائب مرتفعة أو فخ بيع — أخطر سيناريو لعملة رائجة.
        const maxLossPct = Number(cfg.maxRoundTripLossPct) || 0;
        if (maxLossPct > 0) {
            const roundTripBnb = await chainClient.quote(quote, [tokenInfo.address, WBNB]);
            const lossPct = (toBnb(positionSizeWei) - toBnb(roundTripBnb)) / toBnb(positionSizeWei) * 100;
            if (lossPct > maxLossPct) {
                const written = recordConsideration(dir, { coinId: candidate.id, signal: 'buy', reasonCode: candidate.reasonCode, decision: 'skipped', skipReason: 'honeypot_suspected' });
                if (written) await notify(cfg, `بوت التداول: اشتباه honeypot — ${candidate.id}`, `رُفض شراء ${candidate.id}: خسارة دورة شراء→بيع فورية ${lossPct.toFixed(1)}% تتجاوز الحد ${maxLossPct}%. غالباً ضرائب مرتفعة أو فخ بيع.`);
                return { executed: false, reason: 'honeypot_suspected' };
            }
        }
        // سقف سعر الغاز: فوقه يُؤجَّل الشراء (ليس البيع — الخروج أهم من توفير غاز)
        const maxGasGwei = Number(cfg.maxGasPriceGwei) || 0;
        if (maxGasGwei > 0) {
            const gp = await chainClient.gasPrice();
            if (gp > ethers.parseUnits(String(maxGasGwei), 'gwei')) {
                recordConsideration(dir, { coinId: candidate.id, signal: 'buy', reasonCode: candidate.reasonCode, decision: 'skipped', skipReason: 'gas_price_too_high' });
                return { executed: false, reason: 'gas_price_too_high' };
            }
        }
    }

    // 7) التنفيذ — تسجيل pending قبل الإرسال (قابل للاسترجاع عند تعطّل)
    const tradeId = recordTradeOpen(dir, {
        coinId: candidate.id, side, signal: candidate.signal, reasonCode: candidate.reasonCode,
        amountBnbWei: amountInWei, expectedOut: quote, minOut,
    });

    // رصيد التوكن قبل الشراء — لقياس الكمية المستلمة فعلياً بعد التأكيد (فرق الرصيد)
    const tokenBalBefore = side === 'buy' ? await chainClient.tokenBalance(tokenInfo.address, walletAddress) : 0n;

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
        // الكمية المستلمة فعلياً = فرق رصيد التوكن (لا المقتبَسة) — تُستخدَم لاحقاً
        // للبيع الدقيق وحساب الربح/الخسارة. تعذّر القياس ⇒ ارتداد للمقتبَسة.
        let receivedWei = quote;
        try {
            const after = await chainClient.tokenBalance(tokenInfo.address, walletAddress);
            const delta = after - tokenBalBefore;
            if (delta > 0n) receivedWei = delta;
        } catch { /* يبقى المقتبَس كتقريب */ }
        writePosition(dir, candidate.id, {
            entryBnbSpent: amountInWei.toString(), entryTokenWei: receivedWei.toString(),
            entryTxHash: txHash, entryAt: Date.now(), tokenAddress: tokenInfo.address,
            entryGasCostBnb: gasCostBnb, lastActionAt: Date.now(),
        });
        updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb });
        await notify(cfg, `بوت التداول: شراء ${candidate.id}`, `اشترى ${toBnb(amountInWei).toFixed(6)} BNB من ${candidate.id} (${candidate.reasonCode || ''}). tx: ${txHash}`);
    } else {
        const realizedPnlBnb = toBnb(quote) - toBnb(BigInt(openPosition.entryBnbSpent)) - (gasCostBnb || 0) - (Number(openPosition.entryGasCostBnb) || 0);
        updateTradeOutcome(dir, tradeId, { status, txHash, gasCostBnb, realizedPnlBnb });
        clearPosition(dir, candidate.id);
        await notify(cfg, `بوت التداول: بيع ${candidate.id}`, `باع ${candidate.id} بإشارة ${candidate.reasonCode || 'sell'}. ربح/خسارة محقق: ${realizedPnlBnb.toFixed(6)} BNB. tx: ${txHash}`);
    }

    return { executed: true, tradeId, txHash, status, coinId: candidate.id, side };
}

let tickBusy = false;

// دورة ناجحة كل 5 دقائق؛ مرور هذه المدة بلا نجاح = خلل مستمر (RPC معطّل
// مثلاً) يستحق تنبيهاً واحداً — لا رسالة كل دورة فاشلة.
const HEARTBEAT_STALE_MS = 30 * 60 * 1000;

/** يوم UTC كسلسلة (YYYY-MM-DD) — مفتاح إرسال الملخص اليومي مرة واحدة يومياً. */
function utcDayKey(ms = Date.now()) { return new Date(ms).toISOString().slice(0, 10); }

/** يرسل ملخص أداء يومياً مرة واحدة (عند تغيّر يوم UTC) إن ضُبط alertEmail. */
async function maybeSendDailySummary(dir, cfg) {
    if (!cfg.alertEmail) return;
    const today = utcDayKey();
    const hb = readHeartbeat(dir);
    if (hb.lastSummaryDay === today) return;
    const s = getPerformanceStats(dir);
    const body = [
        `ملخص أداء بوت التداول (${today}):`,
        `صافي الربح/الخسارة المحقق: ${s.totalPnlBnb.toFixed(6)} BNB`,
        `صفقات مغلقة: ${s.closedTradeCount} (رابحة ${s.wins} / خاسرة ${s.losses}${s.winRatePct != null ? ` — نسبة الفوز ${s.winRatePct.toFixed(0)}%` : ''})`,
        `مراكز مفتوحة حالياً: ${Object.keys(readPositions(dir)).length}`,
        s.bestCoin ? `أفضل عملة: ${s.bestCoin.coinId} (${s.bestCoin.pnlBnb.toFixed(6)} BNB)` : '',
        s.worstCoin ? `أسوأ عملة: ${s.worstCoin.coinId} (${s.worstCoin.pnlBnb.toFixed(6)} BNB)` : '',
        `إجمالي الغاز المدفوع: ${s.totalGasBnb.toFixed(6)} BNB`,
    ].filter(Boolean).join('\n');
    await notify(cfg, `بوت التداول: ملخص ${today}`, body);
    writeHeartbeat(dir, { ok: true, lastSummaryDay: today });
}

/**
 * حارس تداخل مشترك بين الحلقة المجدولة وأي تشغيل يدوي — يمنع تسابقاً يضاعف
 * nonce التوقيع. يكتب نبض الحياة في كل دورة (نجاحاً أو فشلاً)، ويُنبّه مرة
 * واحدة إن استمر الفشل حتى تقادمت آخر دورة ناجحة.
 */
export async function runTradingBotTickGuarded(dir, options = {}) {
    if (tickBusy) return { executed: false, reason: 'busy' };
    tickBusy = true;
    try {
        const result = await runTradingBotTick(dir, options);
        writeHeartbeat(dir, { ok: true });
        try { await maybeSendDailySummary(dir, getConfig(dir)); } catch { /* الملخص ثانوي دوماً */ }
        return result;
    } catch (e) {
        const hb = writeHeartbeat(dir, { ok: false, error: e.message });
        // تنبيه تقادم: آخر نجاح قديم، ولم نُنبّه منذ ذلك النجاح بعد
        if (hb.lastOkAt && Date.now() - hb.lastOkAt > HEARTBEAT_STALE_MS
            && (!hb.alertedStaleAt || hb.alertedStaleAt < hb.lastOkAt)) {
            const cfg = getConfig(dir);
            await notify(cfg, 'بوت التداول: توقّف الدورات الناجحة', `آخر دورة ناجحة قبل ${Math.round((Date.now() - hb.lastOkAt) / 60000)} دقيقة. الخطأ الأخير: ${e.message}. تحقّق من مزوّد RPC والخادم.`);
            writeHeartbeat(dir, { ok: false, error: e.message, alertedStaleAt: Date.now() });
        }
        return { executed: false, reason: 'tick_error', error: e.message };
    } finally {
        tickBusy = false;
    }
}

export function isTickBusy() { return tickBusy; }
