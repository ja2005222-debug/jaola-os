/**
 * 🔌 liteApiClient.js — عميل HTTP لـLiteAPI/Nuitee Connect (فنادق)
 *
 * مصادقة مؤكَّدة من Code Snippet حقيقي بلوحة العميل (API Playground):
 * هيدر X-API-Key، لا Bearer token كـDuffel. مفاتيح Sandbox تبدأ بـ`sand_`
 * (تُصدر تلقائياً عند التسجيل، بلا موافقة مبيعات — خلاف RateHawk).
 */
const DEFAULT_API_URL = 'https://api.liteapi.travel/v3.0';

export function createLiteApiClient({ apiKey, apiUrl = DEFAULT_API_URL, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('مفتاح LiteAPI مطلوب.');
    const mode = apiKey.startsWith('sand_') ? 'sandbox' : 'live';

    async function request(method, pathname, body = null) {
        const res = await fetchImpl(`${apiUrl}${pathname}`, {
            method,
            headers: {
                'X-API-Key': apiKey,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const rawText = await res.text();
        let payload = {};
        try { payload = rawText ? JSON.parse(rawText) : {}; } catch { /* رد ليس JSON */ }
        if (!res.ok) {
            const detail = payload.error?.message || payload.message || rawText.slice(0, 300);
            throw new Error(`LiteAPI HTTP ${res.status}: ${detail || 'خطأ غير مفصَّل'}`);
        }
        return payload;
    }

    return { mode, request };
}
