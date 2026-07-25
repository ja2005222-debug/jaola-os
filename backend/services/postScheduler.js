/**
 * 📅 مجدول المنشورات — «جدول أسبوعك وانسَه».
 *
 * تخزين ملفّي صامد لكل مستخدم: منشورات معلّقة بوقت استحقاق وقنوات مستهدفة.
 * حلقة الخادم (كل دقيقة) تلتقط المستحق وتنشره عبر ناشري القنوات ثم تعلّم
 * النتيجة. المنطق هنا نقيّ قابل للاختبار — الحلقة نفسها في server.js.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_PENDING = 50;      // لكل مستخدم
const KEEP_DONE = 60;        // آخر منشورات منفَّذة تُحفظ للسجل

const fileOf = (dir, user) => path.join(dir, String(user || '').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');

export function readSchedules(dir, user) {
    try { const a = JSON.parse(fs.readFileSync(fileOf(dir, user), 'utf8')); return Array.isArray(a) ? a : []; }
    catch { return []; }
}
function write(dir, user, list) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fileOf(dir, user), JSON.stringify(list));
}

/** يجدول دفعة منشورات. كل عنصر: {text, at(ms), channels[]}. */
export function schedulePosts(dir, user, posts = []) {
    const list = readSchedules(dir, user);
    const pending = list.filter(p => p.status === 'pending').length;
    const clean = posts
        .filter(p => p && typeof p.text === 'string' && p.text.trim() && Number(p.at) > Date.now() - 60000)
        .slice(0, Math.max(0, MAX_PENDING - pending))
        .map(p => ({
            id: crypto.randomBytes(6).toString('hex'),
            at: Number(p.at),
            text: String(p.text).slice(0, 4000),
            channels: (Array.isArray(p.channels) ? p.channels : []).filter(c => ['telegram', 'facebook', 'x'].includes(c)),
            status: 'pending',
        }))
        .filter(p => p.channels.length > 0);
    if (!clean.length) return { error: pending >= MAX_PENDING ? 'بلغت سقف المنشورات المجدولة (50).' : 'لا منشورات صالحة للجدولة.' };
    write(dir, user, [...list, ...clean]);
    return { ok: true, scheduled: clean.length };
}

/** المستحق الآن (يعلَّم sending ذرّياً كي لا تلتقطه دورة موازية). */
export function claimDuePosts(dir, user, now = Date.now()) {
    const list = readSchedules(dir, user);
    const due = list.filter(p => p.status === 'pending' && p.at <= now);
    if (!due.length) return [];
    for (const p of due) p.status = 'sending';
    write(dir, user, list);
    return due;
}

/** يعلّم نتيجة منشور ويقصّ سجل المنفَّذ القديم. */
export function markResult(dir, user, id, { ok, error } = {}) {
    const list = readSchedules(dir, user);
    const p = list.find(x => x.id === id);
    if (p) { p.status = ok ? 'sent' : 'failed'; p.doneAt = Date.now(); if (error) p.error = String(error).slice(0, 200); }
    const pending = list.filter(x => x.status === 'pending' || x.status === 'sending');
    const done = list.filter(x => x.status === 'sent' || x.status === 'failed').slice(-KEEP_DONE);
    write(dir, user, [...pending, ...done]);
    return { ok: true };
}

export function cancelSchedule(dir, user, id) {
    const list = readSchedules(dir, user);
    const next = list.filter(p => !(p.id === id && p.status === 'pending'));
    if (next.length === list.length) return { error: 'غير موجود أو نُفّذ بالفعل.' };
    write(dir, user, next);
    return { ok: true };
}

/** كل المستخدمين الذين لديهم ملفات جدولة (لحلقة الخادم). */
export function listScheduleUsers(dir) {
    try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)); }
    catch { return []; }
}
