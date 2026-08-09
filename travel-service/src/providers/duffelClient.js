/**
 * 🔌 duffelClient.js — عميل HTTP مشترك لعائلة Duffel (طيران + فنادق)
 *
 * نفس شركة API الواحدة بنسختين (air/stays) بنفس المصادقة وشكل الأخطاء
 * — استُخرج هنا بدل تكرار نفس منطق fetch/الأخطاء حرفياً في مزوّدَين.
 */
const DEFAULT_API_URL = 'https://api.duffel.com';
const DUFFEL_VERSION = 'v2';

export function createDuffelClient({ apiKey, apiUrl = DEFAULT_API_URL, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('مفتاح Duffel مطلوب.');
    // مفاتيح Duffel الاختبارية تبدأ بـduffel_test — نكشف الوضع للواجهة
    // لتعرض لافتة "بيئة تجريبية" بصدق.
    const mode = apiKey.startsWith('duffel_test') ? 'sandbox' : 'live';

    async function request(method, pathname, body = null) {
        const res = await fetchImpl(`${apiUrl}${pathname}`, {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Duffel-Version': DUFFEL_VERSION,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        // نقرأ نصاً خاماً أولاً لا json() مباشرة: ردود الرفض على مستوى
        // الشبكة (WAF/CDN أمام Duffel) غالباً HTML أو نص عادي لا JSON —
        // لو اعتمدنا json().catch(() => ({})) لضاع محتواها كلياً ولظهر
        // "خطأ غير مفصَّل" رغم وجود تفصيل فعلي يفسّر الرفض.
        const rawText = await res.text();
        let payload = {};
        try { payload = rawText ? JSON.parse(rawText) : {}; } catch { /* رد ليس JSON */ }
        if (!res.ok) {
            const detail = (payload.errors || []).map(e => e.message || e.title).join('؛ ');
            throw new Error(`Duffel HTTP ${res.status}: ${detail || rawText.slice(0, 300) || 'خطأ غير مفصَّل'}`);
        }
        return payload.data;
    }

    return { mode, request };
}
