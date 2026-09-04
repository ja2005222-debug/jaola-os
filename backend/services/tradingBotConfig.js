/**
 * ⚙️ tradingBotConfig.js — إعداد بوت PancakeSwap الشخصي (ملف JSON واحد،
 * نفس فلسفة appData.js/signalTrackRecord.js — بلا Mongo، فشل صامت للقراءة).
 *
 * enabled يبدأ false دوماً ولا يمكن ضبطه true إلا إذا اجتاز الإعداد
 * isReadyToEnable — بوابة صريحة تمنع تفعيلاً عرَضياً بإعداد ناقص.
 */
import fs from 'fs';
import path from 'path';
import { filterTradable } from './tradingBotCoins.js';
import { chainAddressConstantsValid } from './pancakeSwapExecutor.js';

const DEFAULTS = Object.freeze({
    enabled: false,
    coinIds: [],
    timeframe: 'week',
    positionSizeBnb: '0.02',
    maxSlippageBps: 75,
    dailyLossLimitBnb: '0.05',
    minGasReserveBnb: '0.01',
    maxOpenPositions: 3,
    cooldownMinutesPerCoin: 60,
    confirmationsRequired: 2,
    stopLossPct: 0, // ٪ تحت سعر الدخول تُغلق المركز فوراً — 0 = معطَّل
    takeProfitPct: 0, // ٪ فوق سعر الدخول تُغلق المركز فوراً — 0 = معطَّل
    trailingStopPct: 0, // ٪ تحت أعلى قيمة بلغها المركز تُغلقه — يحمي الربح المتراكم ويترك الرابح يركض؛ 0 = معطَّل
    maxRoundTripLossPct: 20, // أقصى خسارة نظرية مقبولة في دورة شراء→بيع فورية — فوقها = فخ honeypot/ضرائب، يُرفض الشراء
    maxGasPriceGwei: 0, // سقف سعر الغاز (gwei) — فوقه يُؤجَّل الشراء؛ 0 = بلا سقف
    alertEmail: '', // بريد اختياري يُنبَّه عند كل صفقة منفَّذة/غاز منخفض
    // ⚠️ خيار عالي الخطورة (اختياري صراحةً، معطَّل افتراضياً): تسجيل عملات
    // رائجة تلقائياً بعنوان عقدها من CoinGecko — بلا تحقق يدوي على bscscan —
    // والدخول فيها عبر دورة التداول الاعتيادية إن أصدر محرك الإشارات شراءً.
    autoDiscoveryEnabled: false,
    secretUsername: '',
    secretProject: '',
    secretKeyName: 'WALLET_PRIVATE_KEY',
    addressesVerified: false,
    reArmedAt: null,
});

function storeFile(dir) { return path.join(dir, 'config.json'); }

/** الإعداد الحالي (الافتراضيات مدموجة بما هو محفوظ) — لا يرمي أبداً. */
export function getConfig(dir) {
    try {
        const stored = JSON.parse(fs.readFileSync(storeFile(dir), 'utf8'));
        return { ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
        return { ...DEFAULTS };
    }
}

/**
 * هل هذا الإعداد جاهز للتفعيل؟ كل الحقول الجوهرية حاضرة، وعملات قابلة
 * للتداول فعلياً (موجودة في القائمة البيضاء)، وتأكيد يدوي لعناوين العقود.
 */
export function isReadyToEnable(dir, cfg) {
    // 🔴 `addressesVerified` إقرارُ إنسانٍ نظر إلى bscscan — وإنسانٌ ينظر إلى
    // أربعين خانةً لا يرى واحدةً ناقصة. وقد كان ثابت الراوتر **٣٩ خانة**،
    // وكان هذا الإقرار وحده كافياً لتفعيل بوتٍ يتداول بمالٍ حقيقي. فما
    // تستطيع الآلةُ الجزمَ به تجزم به الآلة، ويبقى للإنسان ما لا تعرفه هي:
    // **مَن** هذا العقد، لا **كم** طولُ عنوانه.
    if (!chainAddressConstantsValid()) return false;
    if (!cfg.addressesVerified) return false;
    if (!filterTradable(dir, cfg.coinIds).length) return false;
    if (!(Number(cfg.positionSizeBnb) > 0)) return false;
    if (!(Number(cfg.dailyLossLimitBnb) > 0)) return false;
    if (!(Number(cfg.minGasReserveBnb) >= 0)) return false;
    if (!(Number(cfg.maxOpenPositions) > 0)) return false;
    if (!cfg.secretUsername || !cfg.secretProject || !cfg.secretKeyName) return false;
    return true;
}

/**
 * يدمج patch مع الإعداد الحالي ويكتبه. يرفض تفعيل enabled=true إن لم يكن
 * الإعداد الناتج جاهزاً (isReadyToEnable) — لا استثناء، حتى لو طلبه المُستدعي صراحة.
 */
export function saveConfig(dir, patch = {}) {
    const current = getConfig(dir);
    const merged = { ...current, ...patch };
    if (merged.enabled && !isReadyToEnable(dir, merged)) {
        throw new Error('لا يمكن تفعيل البوت: الإعداد غير مكتمل (تحقّق من العملات/الحجم/قاطع الخسارة/الأسرار/تأكيد العناوين).');
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storeFile(dir), JSON.stringify(merged, null, 2));
    return merged;
}

/** للاختبارات فقط. */
export function resetTradingBotConfigForTest(dir) {
    try { fs.rmSync(storeFile(dir), { force: true }); } catch { /* لا شيء */ }
}
