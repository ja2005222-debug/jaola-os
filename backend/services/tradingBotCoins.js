/**
 * 🔒 tradingBotCoins.js — قائمة بيضاء ثابتة لعناوين عقود BEP-20 القابلة
 * للتداول عبر بوت PancakeSwap الشخصي (backend/services/tradingBotEngine.js).
 *
 * أهم ملف أمان في هذه المنظومة: المحرك لا يشتق عنوان عقد من أي مصدر
 * ديناميكي أبداً (لا من CoinGecko، لا من إدخال مستخدم) — فقط من هنا. عملة
 * غائبة عن هذه القائمة تبقى غير قابلة للتداول مهما قال محرك الإشارات.
 *
 * ⚠️ العناوين أدناه لم تُتحقّق من هذه الجلسة (WebFetch/WebSearch فشلا في
 * الوصول لـ bscscan.com/pancakeswap.finance من هذه البيئة — حجب 403
 * ونتائج بحث بها تشويه في السلاسل السداسية عشرية). لا تُستخدَم لأي صفقة
 * حقيقية قبل أن تتحقّق منها يدوياً على bscscan.com وتضبط addressesVerified
 * في tradingBotConfig.js. عنوان خاطئ هنا = صفقة فاشلة أو أموال ضائعة.
 *
 * binancecoin مُستبعدة عمداً: هي عملة التمويل/الغاز نفسها (BNB)، وليست
 * هدف مبادلة — لا معنى لمبادلة BNB بـBNB عبر WBNB.
 */

export const BSC_TOKEN_REGISTRY = {
    // مثال بنية فقط — عنوانان يتطلّبان تحققاً يدوياً قبل أي استخدام حقيقي:
    // bitcoin:  { symbol: 'BTCB', address: '0x0000000000000000000000000000000000dEaD', decimals: 18 },
    // ethereum: { symbol: 'ETH',  address: '0x0000000000000000000000000000000000dEaD', decimals: 18 },
};

const EXCLUDED_FUNDING_COIN = 'binancecoin';

/** هل هذه العملة مسموح تداولها؟ (موجودة بالقائمة البيضاء وليست عملة التمويل نفسها) */
export function isTradable(coinId) {
    if (coinId === EXCLUDED_FUNDING_COIN) return false;
    return Object.prototype.hasOwnProperty.call(BSC_TOKEN_REGISTRY, coinId);
}

/** بيانات عقد العملة (address/symbol/decimals) أو null إن لم تكن مسموحة. */
export function getTokenInfo(coinId) {
    return isTradable(coinId) ? BSC_TOKEN_REGISTRY[coinId] : null;
}

/** يُصفّي قائمة معرّفات عملات إلى المسموح تداوله فقط — يُستدعى قبل أي ترتيب فرص. */
export function filterTradable(coinIds) {
    return (Array.isArray(coinIds) ? coinIds : []).filter(isTradable);
}
