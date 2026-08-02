/**
 * ⛓️ chainProvider.js — مزوّد RPC لسلسلة BNB Chain، قابل للحقن للاختبار
 * (نفس فلسفة _marketsCacheForTest في cryptoMarket.js).
 */
import { ethers } from 'ethers';

const DEFAULT_RPC_URL = 'https://bsc-dataseed.binance.org/';

let cachedProvider = null;
let testOverride = undefined; // undefined = لا تجاوز، أي قيمة أخرى (بما فيها null) تُستخدَم كما هي

/** مزوّد ethers لسلسلة BNB Chain — memoized، يُعاد استخدامه بين كل استدعاءات المحرك. */
export function getProvider() {
    if (testOverride !== undefined) return testOverride;
    if (!cachedProvider) {
        const url = process.env.BSC_RPC_URL || DEFAULT_RPC_URL;
        cachedProvider = new ethers.JsonRpcProvider(url);
    }
    return cachedProvider;
}

/** للاختبارات فقط: يفرض مزوّداً وهمياً (أو null لإعادة الضبط). */
export function _setProviderForTest(providerOrNull) {
    testOverride = providerOrNull;
    if (providerOrNull === undefined) cachedProvider = null;
}
