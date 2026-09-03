/**
 * 🔍 site-checker — وكيل يفحص موقعاً حياً فعلياً (لا LLM يخمّن)
 *
 * يستقبل رابطاً (input.url، أو رابط داخل input.text)، يجلبه فعلاً عبر
 * fetch، ويقرأ حالته الحقيقية: كود الاستجابة، زمن الاستجابة، العنوان،
 * وجود وصف SEO وmeta viewport، صور بلا alt، وهل الاستجابة مضغوطة.
 * لا استدعاء ذكاء اصطناعي هنا — نتيجة حتمية قابلة للتكرار، مطابقة لروح
 * behaviorVerifier.js (تحقّق فعلي لا ادّعاء).
 */

const TIMEOUT_MS = 10000;

export async function checkSite(url) {
    const started = Date.now();
    let res;
    try {
        res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
        return { url, ok: false, error: `تعذّر الوصول للموقع: ${e.message}` };
    }
    const ms = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    const html = contentType.includes('text/html') ? await res.text() : '';

    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null;
    const hasDesc = /<meta[^>]+name=["']description["']/i.test(html);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const imgs = html.match(/<img\b[^>]*>/gi) || [];
    const imgsNoAlt = imgs.filter(t => !/\balt\s*=/i.test(t)).length;
    const compressed = /gzip|br|deflate/i.test(res.headers.get('content-encoding') || '');

    const issues = [];
    if (!res.ok) issues.push(`رمز استجابة غير سليم: ${res.status}`);
    if (html && !title) issues.push('لا يوجد وسم <title>');
    if (html && !hasDesc) issues.push('لا يوجد وصف meta (يضرّ الظهور في نتائج البحث)');
    if (html && !hasViewport) issues.push('لا يوجد meta viewport (قد لا يكون متجاوباً مع الجوال)');
    if (imgsNoAlt) issues.push(`${imgsNoAlt} صورة بلا نص alt`);
    if (html && !compressed) issues.push('الاستجابة غير مضغوطة (gzip/br) — تحميل أبطأ من اللازم');
    if (ms > 3000) issues.push(`زمن استجابة بطيء نسبياً: ${ms}ms`);

    return {
        url, ok: res.ok, status: res.status, ms, contentType,
        title, hasDesc, hasViewport, imgsCount: imgs.length, imgsNoAlt, compressed, issues,
    };
}

function extractUrl(input) {
    const raw = typeof input === 'string' ? input : (input?.url || input?.text || input?.message || '');
    const m = /https?:\/\/[^\s"'<>]+/i.exec(raw);
    if (m) return m[0];
    const trimmed = String(raw).trim();
    return trimmed.startsWith('http') ? trimmed : null;
}

function formatReport(r) {
    if (r.error) return `❌ ${r.error}`;
    const lines = [
        `🔍 فحص ${r.url}`,
        `الحالة: ${r.status} ${r.ok ? '✅' : '⚠️'} — زمن الاستجابة ${r.ms}ms`,
    ];
    if (r.title) lines.push(`العنوان: ${r.title}`);
    lines.push('');
    lines.push(r.issues.length
        ? `ملاحظات (${r.issues.length}):\n${r.issues.map(i => '• ' + i).join('\n')}`
        : '✅ لا ملاحظات — الموقع بحالة جيدة.');
    return lines.join('\n');
}

export default {
    name: 'site-checker',
    version: '1.0.0',
    type: 'agent',
    description: 'يفحص موقعاً حياً فعلياً: يجلبه، ويتحقّق من حالته وسرعته وأساسيات SEO — لا تخمين، فحص حقيقي.',
    enabled: true,
    capabilities: ['site.check'], // 📐 عقد Capability — ما يقدر عليه هذا الوكيل

    hooks: {
        async registerAgent() {
            return {
                name: 'siteChecker',
                handler: async (input = {}) => {
                    const url = extractUrl(input);
                    if (!url) {
                        return {
                            agent: 'site-checker',
                            reply: 'أرسل رابط الموقع الذي تريد فحصه (مثال: https://example.com).',
                        };
                    }
                    const result = await checkSite(url);
                    return { agent: 'site-checker', reply: formatReport(result), details: result };
                },
            };
        },
    },
};
