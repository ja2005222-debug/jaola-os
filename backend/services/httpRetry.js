/**
 * 🔁 httpRetry.js — نداء fetch+json مشترك مع إعادة محاولة تلقائية واحدة
 * عند تعطّل عابر (شبكي أو حدّ معدّل 429) — درس مستفاد من عطل حقيقي في
 * مستشار الكريبتو (cryptoMarket.js): نداء واحد فاشل كان يُظهر خطأً فورياً
 * للمستخدم رغم أن محاولة ثانية بعد لحظات كانت لتنجح. مشترك بين أي خدمة
 * بيانات خارجية (كريبتو، أسهم/فوركس، ...) بدل تكرار نفس المنطق.
 */

export function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * fetchJson مع محاولة ثانية تلقائية: أي فشل شبكي أو ردّ !ok يُعاد مرّة
 * واحدة بعد مهلة قصيرة (أطول قليلاً خصيصاً لردّ 429 — حدّ معدّل واضح).
 */
export async function fetchJsonWithRetry(url, opts = {}) {
    const { timeoutMs = 10000, retryDelayMs = 350, rateLimitDelayMs = 700, fetchOptions = {} } = opts;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeoutMs) });
            if (!res.ok) {
                if (res.status === 429 && attempt === 0) { await sleep(rateLimitDelayMs); continue; }
                throw new Error('http ' + res.status);
            }
            return await res.json();
        } catch (e) {
            if (attempt === 0) { await sleep(retryDelayMs); continue; }
            throw e;
        }
    }
}
