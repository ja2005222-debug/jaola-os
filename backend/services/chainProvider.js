/**
 * ⛓️ chainProvider.js — مزوّد RPC لسلسلة BNB Chain، قابل للحقن للاختبار
 * (نفس فلسفة _marketsCacheForTest في cryptoMarket.js).
 */
import { ethers } from 'ethers';

// عقد BSC عامة متعددة — لو تعطّل الأول (يحدث دورياً) يتولّى التالي تلقائياً.
// BSC_RPC_URL يتصدّر القائمة إن ضُبط، ثم عقد احتياطية عامة معروفة.
const DEFAULT_RPC_URLS = [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
];

let cachedProvider = null;
let testOverride = undefined; // undefined = لا تجاوز، أي قيمة أخرى (بما فيها null) تُستخدَم كما هي

function buildFallbackProvider() {
    const urls = [];
    if (process.env.BSC_RPC_URL) urls.push(process.env.BSC_RPC_URL);
    for (const u of DEFAULT_RPC_URLS) if (!urls.includes(u)) urls.push(u);
    // مزوّد واحد ⇒ لا داعي لتغليف FallbackProvider (تبسيط + نفس سلوك ما قبل)
    if (urls.length === 1) return new ethers.JsonRpcProvider(urls[0]);
    // priority تنازلي: الأول أعلى أولوية؛ FallbackProvider يتحوّل للتالي عند الفشل.
    const configs = urls.map((url, i) => ({ provider: new ethers.JsonRpcProvider(url), priority: i + 1, stallTimeout: 2000 }));
    return new ethers.FallbackProvider(configs, undefined, { quorum: 1 });
}

/** مزوّد ethers لسلسلة BNB Chain — memoized، يُعاد استخدامه بين كل استدعاءات المحرك. */
export function getProvider() {
    if (testOverride !== undefined) return testOverride;
    if (!cachedProvider) cachedProvider = buildFallbackProvider();
    return cachedProvider;
}

/** للاختبارات فقط: يفرض مزوّداً وهمياً (أو null لإعادة الضبط). */
export function _setProviderForTest(providerOrNull) {
    testOverride = providerOrNull;
    if (providerOrNull === undefined) cachedProvider = null;
}
