/**
 * 📧 مشتركو نشرة الموقع — بريد زوّار موقع العميل المنشور الذين طلبوا الاشتراك
 * بنشرته (صندوق «📧 أرسل بالبريد» الحالي يردّ على رسالة واحدة؛ هذا يبعث لكل
 * المشتركين معاً). ملفّي offline-tolerant، بنفس بنية صندوق الموقع (siteInbox.js).
 */

import fs from 'fs';
import path from 'path';

const MAX_SUBSCRIBERS = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const key = (u, p) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(p || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const storePath = (dir, u, p) => path.join(dir, key(u, p) + '.json');

export function isValidEmail(v) {
    return EMAIL_RE.test(String(v || '').trim());
}

function readStore(dir, user, project) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project), 'utf8'));
        return { subscribers: Array.isArray(s.subscribers) ? s.subscribers : [] };
    } catch { return { subscribers: [] }; }
}

function save(dir, user, project, store) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify(store));
}

/** يضيف مشتركاً (بلا تكرار — يعيد already:true إن كان موجوداً). */
export function subscribe(dir, user, project, email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!isValidEmail(clean)) return { error: 'بريد غير صالح' };
    const store = readStore(dir, user, project);
    if (store.subscribers.some(s => s.email === clean)) return { ok: true, already: true };
    if (store.subscribers.length >= MAX_SUBSCRIBERS) return { error: 'بلغت النشرة الحدّ الأقصى للمشتركين' };
    store.subscribers.push({ email: clean, at: Date.now() });
    save(dir, user, project, store);
    return { ok: true, already: false };
}

/** يعيد قائمة المشتركين (الأحدث أولاً). */
export function listSubscribers(dir, user, project) {
    return readStore(dir, user, project).subscribers.slice().reverse();
}

/** يحذف مشتركاً (رابط إلغاء الاشتراك). */
export function unsubscribe(dir, user, project, email) {
    const clean = String(email || '').trim().toLowerCase();
    const store = readStore(dir, user, project);
    const next = store.subscribers.filter(s => s.email !== clean);
    const removed = next.length !== store.subscribers.length;
    if (removed) save(dir, user, project, { subscribers: next });
    return { ok: true, removed };
}
