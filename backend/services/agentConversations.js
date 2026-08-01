/**
 * 💬 محادثات الوكلاء المخصّصين — كل تبادل (سؤال الزائر + جواب الوكيل) يُسجَّل
 * ليراه صاحب الوكيل من الداشبورد. كان غائباً تماماً: لا سجلّ محادثات، لا
 * إحصاء استخدام حقيقي — فقط عدّاد حصة الذكاء الخام. ملفّي offline-tolerant،
 * بنفس فلسفة/بنية صندوق الموقع (siteInbox.js).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_EXCHANGES = 200;   // الأحدث يبقى، الأقدم يُقصّ
const MAX_DAYS = 366;

function sanitize(v, max) {
    const s = String(v ?? '');
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        out += (code <= 0x1f || code === 0x7f) ? ' ' : s[i];
    }
    return out.trim().slice(0, max);
}

const key = (u, a) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(a || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const storePath = (dir, u, a) => path.join(dir, key(u, a) + '.json');

export function readConversations(dir, user, agentId) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, agentId), 'utf8'));
        return {
            exchanges: Array.isArray(s.exchanges) ? s.exchanges : [],
            days: s.days && typeof s.days === 'object' ? s.days : {},
        };
    } catch { return { exchanges: [], days: {} }; }
}

function save(dir, user, agentId, store) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, agentId), JSON.stringify(store));
}

/** يسجّل تبادلاً (سؤال + جواب) — الأحدث أولاً، بسقف عددي + عدّاد يومي للاستخدام. */
export function recordExchange(dir, user, agentId, { message, reply } = {}) {
    const clean = {
        id: crypto.randomBytes(6).toString('hex'),
        at: Date.now(),
        message: sanitize(message, 500),
        reply: sanitize(reply, 800),
    };
    if (!clean.message) return { error: 'رسالة فارغة' };
    const store = readConversations(dir, user, agentId);
    store.exchanges = [clean, ...store.exchanges].slice(0, MAX_EXCHANGES);
    const day = new Date().toISOString().slice(0, 10);
    store.days[day] = (Number(store.days[day]) || 0) + 1;
    const dayKeys = Object.keys(store.days).sort();
    while (dayKeys.length > MAX_DAYS) delete store.days[dayKeys.shift()];
    save(dir, user, agentId, store);
    return { ok: true, exchange: clean };
}

/** ملخّص الاستخدام: الإجمالي + اليوم + آخر ٧ أيام (لرسم بياني بسيط في اللوحة). */
export function conversationSummary(store, now = new Date()) {
    const days = store?.days || {};
    const total = Object.values(days).reduce((a, b) => a + (Number(b) || 0), 0);
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
        last7.push({ day: d, count: Number(days[d]) || 0 });
    }
    return { total, today: last7[6].count, last7 };
}
