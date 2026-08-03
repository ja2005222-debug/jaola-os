/**
 * 🔌 providers/index.js — اختيار المزود (نقطة التبديل الوحيدة)
 *
 * المحرك والمسارات لا يعرفون إلا الواجهة الموحدة:
 *   { name, submitRender(spec) → {providerId}, getRender(providerId) → {status,...} }
 * إضافة مزود جديد (fal.ai للتوليد بالذكاء الاصطناعي لاحقاً) = ملف محول
 * جديد + سطر هنا — صفر تعديل على بقية الخدمة.
 */
import { createMockProvider } from './mockProvider.js';
import { createShotstackProvider } from './shotstackProvider.js';

export function buildProvider({ providerName, shotstackApiKey, shotstackEnv } = {}) {
    const name = String(providerName || 'mock').toLowerCase();

    if (name === 'mock') return createMockProvider();

    if (name === 'shotstack') {
        // فشل صاخب عند الإقلاع — تشغيل "مزود حقيقي بلا مفتاح" خطأ إعداد
        // يجب أن يوقف الخدمة فوراً، لا أن يتحول لفشل صامت لكل مهمة.
        return createShotstackProvider({ apiKey: shotstackApiKey, env: shotstackEnv || 'stage' });
    }

    throw new Error(`مزود فيديو غير معروف: ${providerName}`);
}
