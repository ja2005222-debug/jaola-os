/**
 * 🔌 providers/index.js — اختيار مزوّد الطيران (نقطة التبديل الوحيدة)
 *
 * DUFFEL_API_KEY مضبوط → Duffel (Sandbox أو إنتاج حسب نوع المفتاح)،
 * وإلا → المحاكاة (تطوير كامل التدفق بلا أي مفاتيح — نفس قاعدة خدمة
 * الفيديو مع مزوّداتها).
 */
import { createDuffelProvider } from './duffelProvider.js';
import { createMockTravelProvider } from './mockProvider.js';
import { createDuffelStaysProvider } from './duffelStaysProvider.js';
import { createLiteApiStaysProvider } from './liteApiStaysProvider.js';
import { createMockStaysProvider } from './mockStaysProvider.js';
import { createDuffelCarsProvider } from './duffelCarsProvider.js';
import { createMockCarsProvider } from './mockCarsProvider.js';
import { createMockEsimProvider } from './mockEsimProvider.js';

export function buildProvider(env = process.env) {
    if (env.DUFFEL_API_KEY) {
        return createDuffelProvider({
            apiKey: env.DUFFEL_API_KEY,
            apiUrl: env.DUFFEL_API_URL || undefined,
        });
    }
    return createMockTravelProvider();
}

// LITEAPI_API_KEY أولاً إن ضُبط: حساب مستقل تماماً عن Duffel (Sandbox
// ذاتي التفعيل بلا موافقة مبيعات) — مفضَّل حالياً لأن Duffel Stays معطَّل
// على حسابنا (راجع تحذير README). Duffel Stays يبقى احتياطاً إن فُعِّل لاحقاً.
export function buildStaysProvider(env = process.env) {
    if (env.LITEAPI_API_KEY) {
        return createLiteApiStaysProvider({
            apiKey: env.LITEAPI_API_KEY,
            apiUrl: env.LITEAPI_API_URL || undefined,
            bookApiUrl: env.LITEAPI_BOOK_API_URL || undefined,
        });
    }
    if (env.DUFFEL_API_KEY) {
        return createDuffelStaysProvider({
            apiKey: env.DUFFEL_API_KEY,
            apiUrl: env.DUFFEL_API_URL || undefined,
        });
    }
    return createMockStaysProvider();
}

/** نفس مفتاح الطيران بالضبط — Duffel Cars على نفس الحساب. */
export function buildCarsProvider(env = process.env) {
    if (env.DUFFEL_API_KEY) {
        return createDuffelCarsProvider({
            apiKey: env.DUFFEL_API_KEY,
            apiUrl: env.DUFFEL_API_URL || undefined,
        });
    }
    return createMockCarsProvider();
}

/**
 * باقات إنترنت السفر (eSIM) — محاكاة فقط حالياً: لا مزوّد حي متعاقَد بعد.
 * أُبقيت دالة بناء مستقلة (لا مجرد `createMockEsimProvider()` مباشرة في
 * server.js) كي يضاف فرع حي لاحقاً بنفس نمط باقي المزوّدين بلا تغيير أي
 * مستدعٍ — «لا صيغة مزوّد بلا توثيق مؤكَّد» تمنع بناءه اليوم فقط، لا بنية التبديل.
 */
export function buildEsimProvider(env = process.env) {
    return createMockEsimProvider();
}
