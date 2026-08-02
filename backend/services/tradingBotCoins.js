/**
 * 🔒 tradingBotCoins.js — قائمة بيضاء لعناوين عقود BEP-20 القابلة للتداول
 * عبر بوت PancakeSwap الشخصي (backend/services/tradingBotEngine.js).
 *
 * أهم ملف أمان في هذه المنظومة: المحرك لا يشتق عنوان عقد من أي مصدر
 * ديناميكي أبداً (لا من CoinGecko، لا من الإشارات) — فقط من هذا السجل.
 * عملة غائبة عنه تبقى غير قابلة للتداول مهما قال محرك الإشارات.
 *
 * السجل يُدار عبر لوحة المشرف (Trading Bot → Token registry) لا عبر تعديل
 * كود مباشر — كل إدخال يتطلب أن يكتبه مشرف مسجَّل دخوله بنفسه (نفس مبدأ
 * "تأكيد بشري قبل أي تداول حقيقي" لكن عبر الواجهة بدل PR)، ويُخزَّن كملف
 * JSON بسيط بنفس فلسفة tradingBotConfig.js/tradingBotLedger.js.
 *
 * binancecoin مُستبعدة عمداً دوماً: هي عملة التمويل/الغاز نفسها (BNB)،
 * وليست هدف مبادلة — لا معنى لمبادلة BNB بـBNB عبر WBNB.
 */
import fs from 'fs';
import path from 'path';

const EXCLUDED_FUNDING_COIN = 'binancecoin';
const VALID_COIN_ID = /^[a-z][a-z0-9-]{1,64}$/;
const VALID_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function storeFile(dir) { return path.join(dir, 'tokens.json'); }

/** سجل العملات الحالي (معرّف CoinGecko → {symbol, address, decimals}). لا يرمي أبداً. */
export function getTokenRegistry(dir) {
    try {
        const stored = JSON.parse(fs.readFileSync(storeFile(dir), 'utf8'));
        return (stored && typeof stored === 'object') ? stored : {};
    } catch {
        return {};
    }
}

/** يضيف/يحدّث عملة في السجل بعد تحقّق صارم من الشكل — يرمي عند إدخال غير صالح. */
export function upsertToken(dir, { coinId, symbol, address, decimals }) {
    const id = String(coinId || '').trim().toLowerCase();
    if (!VALID_COIN_ID.test(id)) throw new Error('معرّف CoinGecko غير صالح (أحرف صغيرة/أرقام/شرطة، يبدأ بحرف)');
    if (id === EXCLUDED_FUNDING_COIN) throw new Error('binancecoin مستبعدة عمداً — هي عملة التمويل/الغاز نفسها');
    if (!VALID_ADDRESS.test(address || '')) throw new Error('عنوان عقد غير صالح (يجب أن يكون 0x متبوعاً بـ40 حرفاً سداسي عشرياً)');
    const sym = String(symbol || '').trim();
    if (!sym) throw new Error('الرمز مطلوب');
    const dec = Number(decimals);
    if (!Number.isInteger(dec) || dec < 0 || dec > 36) throw new Error('decimals غير صالح (يجب أن يكون عدداً صحيحاً بين 0 و36)');

    const registry = getTokenRegistry(dir);
    registry[id] = { symbol: sym, address, decimals: dec };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storeFile(dir), JSON.stringify(registry, null, 2));
    return registry;
}

/** يحذف عملة من السجل. */
export function removeToken(dir, coinId) {
    const registry = getTokenRegistry(dir);
    delete registry[coinId];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storeFile(dir), JSON.stringify(registry, null, 2));
    return registry;
}

/** هل هذه العملة مسموح تداولها؟ (موجودة بالسجل وليست عملة التمويل نفسها) */
export function isTradable(dir, coinId) {
    if (coinId === EXCLUDED_FUNDING_COIN) return false;
    return Object.prototype.hasOwnProperty.call(getTokenRegistry(dir), coinId);
}

/** بيانات عقد العملة (address/symbol/decimals) أو null إن لم تكن مسموحة. */
export function getTokenInfo(dir, coinId) {
    const registry = getTokenRegistry(dir);
    return isTradable(dir, coinId) ? registry[coinId] : null;
}

/** يُصفّي قائمة معرّفات عملات إلى المسموح تداوله فقط — يُستدعى قبل أي ترتيب فرص. */
export function filterTradable(dir, coinIds) {
    return (Array.isArray(coinIds) ? coinIds : []).filter(id => isTradable(dir, id));
}

/** للاختبارات فقط. */
export function resetTradingBotCoinsForTest(dir) {
    try { fs.rmSync(storeFile(dir), { force: true }); } catch { /* لا شيء */ }
}
