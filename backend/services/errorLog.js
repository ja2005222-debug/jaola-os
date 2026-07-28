/**
 * 🩺 سجل أخطاء الإنتاج — بلا اعتماد على خدمة خارجية (Sentry وغيرها تحتاج
 * حساباً/مفاتيح لا نملكها هنا، تماماً كمعضلة Stripe). حلقة أخيرة محدودة
 * الحجم في الذاكرة (نفس فلسفة platformLessons.js)، مع لقطة واحدة دائمة في
 * Mongo (مفتاح واحد لا مفتاح لكل خطأ) فتنجو من إعادة النشر/الانهيار.
 *
 * الهدف: أي عطل حقيقي (استثناء غير مُمسوك، رفض Promise، خطأ خادم عام) يُسجَّل
 * ويظهر لاحقاً في لوحة المشرف — بدل أن يضيع في سجلات الاستضافة الخام التي
 * لا يفتحها أحد فعلياً.
 */

import { persistEntry, hydrateStore, onMongoReady } from './persistence.js';

const MAX_ERRORS = 200;
const STORE = 'systemErrors';
const KEY = 'recent';

let errors = []; // الأحدث أولاً

onMongoReady(() => hydrateStore(STORE, (key, value) => {
    if (key === KEY && Array.isArray(value) && value.length > errors.length) errors = value;
}));

/** يسجّل خطأ عطل حقيقي (لا أخطاء تحقّق مدخلات متوقَّعة — تلك ليست أعطالاً). */
export function recordError({ source = 'unknown', message = '', stack = '', path = '', method = '' } = {}) {
    const entry = {
        at: Date.now(),
        source,
        message: String(message || '').slice(0, 500),
        stack: String(stack || '').slice(0, 2000),
        path: String(path || '').slice(0, 200),
        method: String(method || '').slice(0, 10),
    };
    errors.unshift(entry);
    if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
    persistEntry(STORE, KEY, errors);
    return entry;
}

/** آخر N خطأ (الأحدث أولاً) — للوحة المشرف. */
export function recentErrors(limit = 50) {
    return errors.slice(0, limit);
}

export function resetErrors() { errors = []; } // للاختبارات فقط
