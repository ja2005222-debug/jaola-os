/**
 * 📬 صندوق الموقع — رسائل «تواصل معنا» + عدّاد زيارات لمواقع العملاء المنشورة.
 *
 * الزائر يرسل نموذج تواصل من موقع العميل (على Vercel/Render) → snippet الوصلة
 * يبعثها لنقطة عامّة هنا → تُخزَّن ملفّياً (offline-tolerant، بلا اعتماد على Mongo)
 * → يقرؤها المالك من داشبورد JAOLA. القيم كلّها منقّاة ومسقوفة الحجم.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { storeKey } from './storeKey.js';

const MAX_MESSAGES = 500;      // الأحدث يبقى، الأقدم يُقصّ
const MAX_VISIT_DAYS = 366;    // سنة من الأيام كحد أقصى

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
// 🗝️ المفتاح مبايِنٌ الآن: الفاصل `__` كان يحتمله الحقلان نفساهما
// (انظر `storeKey.js`) — فزوجان مختلفان يكتبان ملفاً واحداً.
const key = (u, p) => storeKey(u, p);
const storePath = (dir, u, p) => path.join(dir, key(u, p) + '.json');

export function readInbox(dir, user, project) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project), 'utf8'));
        return {
            messages: Array.isArray(s.messages) ? s.messages : [],
            seenAt: Number(s.seenAt) || 0,
            visits: s.visits && typeof s.visits === 'object' ? s.visits : {},
        };
    } catch { return { messages: [], seenAt: 0, visits: {} }; }
}

function save(dir, user, project, store) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify(store));
}

/** ينقّي حقول نموذج التواصل — يرفض الفارغ تماماً. */
export function sanitizeSubmission(fields = {}) {
    const out = {
        name: str(fields.name, 120),
        contact: str(fields.contact, 160),
        message: str(fields.message, 1500),
        page: str(fields.page, 200),
    };
    if (!out.message && !out.contact) return { error: 'رسالة فارغة' };
    return out;
}

/** يسجّل رسالة واردة (الأحدث أولاً، بسقف عددي). */
export function recordMessage(dir, user, project, fields) {
    const clean = sanitizeSubmission(fields);
    if (clean.error) return clean;
    const store = readInbox(dir, user, project);
    const msg = { id: crypto.randomBytes(6).toString('hex'), at: Date.now(), ...clean };
    store.messages = [msg, ...store.messages].slice(0, MAX_MESSAGES);
    save(dir, user, project, store);
    return { ok: true, message: msg };
}

/** يسجّل زيارة (عدّاد يومي؛ الـ snippet يرسل مرّة لكل جلسة زائر). */
export function recordVisit(dir, user, project, day) {
    const d = str(day, 10) || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: 'يوم غير صالح' };
    const store = readInbox(dir, user, project);
    store.visits[d] = (Number(store.visits[d]) || 0) + 1;
    const days = Object.keys(store.visits).sort();
    while (days.length > MAX_VISIT_DAYS) delete store.visits[days.shift()];
    save(dir, user, project, store);
    return { ok: true };
}

/** يعلّم كل الرسائل كمقروءة (unread يُحسب مقابل seenAt). */
export function markSeen(dir, user, project) {
    const store = readInbox(dir, user, project);
    store.seenAt = Date.now();
    save(dir, user, project, store);
    return { ok: true };
}

/** ملخّص الزيارات: الإجمالي + اليوم + آخر ٧ أيام (للرسم في اللوحة). */
export function visitSummary(store, now = new Date()) {
    const visits = store?.visits || {};
    const total = Object.values(visits).reduce((a, b) => a + (Number(b) || 0), 0);
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
        last7.push({ day: d, count: Number(visits[d]) || 0 });
    }
    return { total, today: last7[6].count, last7 };
}

/** عدد غير المقروء — للشارة على زر البريد. */
export function unreadCount(store) {
    return (store?.messages || []).filter(m => (m.at || 0) > (store.seenAt || 0)).length;
}
