/**
 * 🌐 httpRetry.js — البابُ المشترك للنداء الشبكيّ الصادر: **مهلةٌ دائماً**،
 * وإعادةُ محاولةٍ حين تكون آمنة.
 *
 * ── لماذا المهلةُ ليست تفصيلاً
 *
 * `fetch` في Node **لا تنتهي مهلتُها أبداً** بلا `AbortSignal`. لا افتراضَ
 * ولا سقف. فمزوّدٌ **معلَّق** (لا ساقط — الاتصالُ قائمٌ ولا ردّ) يُعلّق
 * النداءَ إلى الأبد، ومعه الطلبُ الذي ينتظره.
 *
 * وقد قِيس الفرق: كلُّ موضعٍ يقصد عنواناً **يملكه المستخدم** كان يضع مهلة
 * (`platformContext` ٦ ثوانٍ، `imageService` ٨، `site-checker` مهلتَه)،
 * وكلُّ موضعٍ يقصد **مزوّداً موثوقاً** لم يضع شيئاً — كأنّ الثقةَ في المزوّد
 * ضمانٌ ضدّ التعليق. وليست كذلك.
 *
 * ⚠️ ولا تُضاف إعادةُ المحاولة هنا بالجملة: تبادلُ رمز OAuth (`POST`) رمزُه
 *    **يُستهلك مرّةً واحدة**، فإعادتُه تُفشل تسجيلَ دخولٍ كان لينجح. المهلةُ
 *    للجميع، والإعادةُ لمن تصحّ له.
 *
 * ── الأصل: نداء fetch+json مشترك مع إعادة محاولة تلقائية واحدة
 * عند تعطّل عابر (شبكي أو حدّ معدّل 429) — درس مستفاد من عطل حقيقي في
 * مستشار الكريبتو (cryptoMarket.js): نداء واحد فاشل كان يُظهر خطأً فورياً
 * للمستخدم رغم أن محاولة ثانية بعد لحظات كانت لتنجح. مشترك بين أي خدمة
 * بيانات خارجية (كريبتو، أسهم/فوركس، ...) بدل تكرار نفس المنطق.
 */

/**
 * مهلٌ مسمّاةٌ بحسب طبيعة النداء — رقمٌ عارٍ عند الاستدعاء لا يقول لماذا.
 */
export const TIMEOUTS = Object.freeze({
    oauth: 10_000,    // تبادلُ رمزٍ وجلبُ ملفٍ شخصيّ: رحلاتُ JSON صغيرة
    api: 15_000,      // واجهاتُ REST (GitHub، Vercel): قراءةٌ وكتابةٌ عاديّة
    upload: 60_000,   // رفعُ محتوى موقعٍ كامل في جسم الطلب
});

/**
 * `fetch` بمهلةٍ إجباريّة. لا إعادةَ محاولة — من احتاجها فـ`fetchJsonWithRetry`.
 * تُحترم إشارةُ المتصل إن مرّرها، فلا يُنتزع منه تحكّمٌ أدقّ.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>} وترمي `TimeoutError` عند انقضاء المهلة
 */
export function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUTS.api) {
    return fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(timeoutMs) });
}

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
