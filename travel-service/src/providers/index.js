/**
 * 🔌 providers/index.js — اختيار مزوّد الطيران (نقطة التبديل الوحيدة)
 *
 * DUFFEL_API_KEY مضبوط → Duffel (Sandbox أو إنتاج حسب نوع المفتاح)،
 * وإلا → المحاكاة (تطوير كامل التدفق بلا أي مفاتيح — نفس قاعدة خدمة
 * الفيديو مع مزوّداتها).
 */
import { createDuffelProvider } from './duffelProvider.js';
import { createMockTravelProvider } from './mockProvider.js';

export function buildProvider(env = process.env) {
    if (env.DUFFEL_API_KEY) {
        return createDuffelProvider({
            apiKey: env.DUFFEL_API_KEY,
            apiUrl: env.DUFFEL_API_URL || undefined,
        });
    }
    return createMockTravelProvider();
}
