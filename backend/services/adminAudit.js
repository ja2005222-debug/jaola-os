/**
 * 🧾 سجلّ تدقيق الأدمِن — من فعل ماذا ومتى على بيانات أي مستخدم.
 *
 * صلاحيات الأدمِن الحالية واسعة (قراءة/كتابة/حذف ملفات أي مشروع، تغيير خطة
 * أي مستخدم) بلا أي أثر سابق — هذا يسجّل كل فعل حسّاس. نفس فلسفة/بنية
 * errorLog.js: حلقة أخيرة محدودة في الذاكرة + لقطة دائمة واحدة في Mongo.
 */

import { persistEntry, hydrateStore, onMongoReady } from './persistence.js';

const MAX_ACTIONS = 500;
const STORE = 'adminAudit';
const KEY = 'recent';

let actions = []; // الأحدث أولاً

onMongoReady(() => hydrateStore(STORE, (key, value) => {
    if (key === KEY && Array.isArray(value) && value.length > actions.length) actions = value;
}));

/** يسجّل فعل أدمِن حسّاساً (تغيير خطة، كتابة/حذف ملف مستخدم آخر...). */
export function recordAdminAction({ admin = '', action = '', target = '', details = '' } = {}) {
    const entry = {
        at: Date.now(),
        admin: String(admin || '').slice(0, 40),
        action: String(action || '').slice(0, 60),
        target: String(target || '').slice(0, 200),
        details: String(details || '').slice(0, 500),
    };
    actions.unshift(entry);
    if (actions.length > MAX_ACTIONS) actions.length = MAX_ACTIONS;
    persistEntry(STORE, KEY, actions);
    return entry;
}

/** آخر N فعل (الأحدث أولاً) — للوحة المشرف. */
export function recentAdminActions(limit = 100) {
    return actions.slice(0, limit);
}

export function resetAdminAudit() { actions = []; } // للاختبارات فقط
