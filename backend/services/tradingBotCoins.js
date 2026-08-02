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
import { fetchJsonWithRetry, sleep } from './httpRetry.js';

const EXCLUDED_FUNDING_COIN = 'binancecoin';
const VALID_COIN_ID = /^[a-z][a-z0-9-]{1,64}$/;
const VALID_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DISCOVERY_TTL_MS = 5 * 60 * 1000; // 5 دقائق — يحمي حصة CoinGecko المجانية من ضغط تكرار الضغط على "اكتشاف"

let discoveryCache = null; // { at, candidates }

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

/**
 * بحث تلقائي بعنوان العقد على CoinGecko — راحة فقط، لا يُضاف شيء للسجل
 * تلقائياً؛ المشرف يراجع النتيجة ويضغط "Add" بنفسه كما هو الحال دوماً.
 * يرمي برسالة واضحة إن لم يُعثر على العملة أو تعذّر الاتصال.
 */
export async function lookupTokenByAddress(address) {
    if (!VALID_ADDRESS.test(address || '')) throw new Error('عنوان عقد غير صالح (يجب أن يكون 0x متبوعاً بـ40 حرفاً سداسي عشرياً)');
    let data;
    try {
        data = await fetchJsonWithRetry(`${COINGECKO_BASE}/coins/binance-smart-chain/contract/${address}`);
    } catch (e) {
        if (String(e.message).includes('404')) throw new Error('لم يُعثر على عملة بهذا العنوان على CoinGecko');
        throw new Error('تعذّر الاتصال بـCoinGecko: ' + e.message);
    }
    const decimals = data?.detail_platforms?.['binance-smart-chain']?.decimal_place;
    if (!data?.id || !data?.symbol || !Number.isInteger(decimals)) {
        throw new Error('ردّ CoinGecko غير مكتمل لهذا العنوان — أدخل البيانات يدوياً');
    }
    return { coinId: data.id, symbol: String(data.symbol).toUpperCase(), decimals, name: data.name || '' };
}

/**
 * اكتشاف مرشحين للإضافة عبر "الأكثر رواجاً" على CoinGecko (search/trending)،
 * مُصفّاة لمن له عقد فعلي على BNB Chain فقط. راحة اقتراح فقط — لا تُضيف شيئاً
 * للسجل أبداً؛ المشرف يراجع كل مرشّح ويضغط "Add" بنفسه كعملية Lookup تماماً.
 *
 * نداءات متتالية (لا متوازية) مع تأخير قصير بينها لتخفيف ضغط الحصة المجانية
 * المشتركة أصلاً مع مستشار الكريبتو؛ فشل مرشّح واحد (429/عملة غير مدعومة على
 * BSC) يُتجاوَز بصمت ولا يُسقِط بقية القائمة. نتيجة مُخزَّنة مؤقتاً 5 دقائق.
 */
export async function discoverTrendingCandidates() {
    if (discoveryCache && (Date.now() - discoveryCache.at) < DISCOVERY_TTL_MS) return discoveryCache.candidates;

    let trending;
    try {
        trending = await fetchJsonWithRetry(`${COINGECKO_BASE}/search/trending`);
    } catch (e) {
        throw new Error('تعذّر الاتصال بـCoinGecko: ' + e.message);
    }
    const items = Array.isArray(trending?.coins) ? trending.coins.map(c => c.item).filter(Boolean) : [];

    const candidates = [];
    for (const item of items) {
        if (!item?.id) continue;
        try {
            const detail = await fetchJsonWithRetry(
                `${COINGECKO_BASE}/coins/${item.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
            );
            const address = detail?.platforms?.['binance-smart-chain'];
            const decimals = detail?.detail_platforms?.['binance-smart-chain']?.decimal_place;
            if (address && VALID_ADDRESS.test(address) && Number.isInteger(decimals)) {
                candidates.push({ coinId: item.id, symbol: String(item.symbol || '').toUpperCase(), name: item.name || '', address, decimals });
            }
        } catch { /* مرشّح واحد فشل (429 أو غيره) — يُتجاوَز، لا يُوقف الاكتشاف بالكامل */ }
        await sleep(300); // تباعد بين النداءات — يقلّل احتمال 429 عبر كل المرشّحين معاً
    }

    discoveryCache = { at: Date.now(), candidates };
    return candidates;
}

/** للاختبارات فقط. */
export function resetDiscoveryCacheForTest() { discoveryCache = null; }

/** للاختبارات فقط. */
export function resetTradingBotCoinsForTest(dir) {
    try { fs.rmSync(storeFile(dir), { force: true }); } catch { /* لا شيء */ }
}
