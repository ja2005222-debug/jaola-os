/**
 * 🖼️ صور حقيقية من مالك القالب (jaola-assets) — يحتاجها أحياناً "أدمن
 * الصفحة" (صورة العيادة/المحل الفعلية، لا صورة Unsplash ولا صورة AI
 * مولَّدة). كل صورة تُخزَّن تحت "slot" مسمّى (مثال: clinicPhoto) —
 * الرفع اللاحق لنفس الـslot يستبدل القديمة (مهما اختلفت الامتدادات).
 *
 * ملفّي (offline-tolerant)، يعيد استخدام فكّ/تحقّق data:URL من
 * siteCms.js (نفس الحدود: 4MB، أنواع صور معروفة فقط).
 */

import fs from 'fs';
import path from 'path';
import { decodeDataUrl } from './siteCms.js';

const MAX_SLOTS = 30; // حدّ عدد الصور لكل مشروع
const SLOT_RE = /^[\w.-]{1,60}$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

function clean(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }
const prefix = (u, p, s) => `${clean(u)}__${clean(p)}__${clean(s)}`;
const validSlot = (s) => SLOT_RE.test(String(s || '')) && !RESERVED.has(s);

/** يحذف أي ملف قديم لنفس الـslot (بأي امتداد) قبل كتابة الجديد. */
function removeExisting(dir, u, p, slot) {
    const pfx = prefix(u, p, slot) + '.';
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const f of entries) {
        if (f.startsWith(pfx)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
    }
}

function countSlots(dir, u, p) {
    const pfx = `${clean(u)}__${clean(p)}__`;
    try { return new Set(fs.readdirSync(dir).filter(f => f.startsWith(pfx)).map(f => f.replace(/\.[^.]+$/, ''))).size; }
    catch { return 0; }
}

/** يحفظ صورة (data:URL) في slot مسمّى — يستبدل الموجود إن وُجد. */
export function saveAsset(dir, user, project, slot, dataUrl) {
    if (!validSlot(slot)) return { error: 'اسم غير صالح للصورة' };
    const dec = decodeDataUrl(dataUrl);
    if (dec.error) return { error: dec.error };

    const pfx = prefix(user, project, slot);
    const alreadyExists = (() => {
        try { return fs.readdirSync(dir).some(f => f.startsWith(pfx + '.')); } catch { return false; }
    })();
    if (!alreadyExists && countSlots(dir, user, project) >= MAX_SLOTS) {
        return { error: 'تجاوزت الحد الأقصى لعدد الصور لهذا المشروع' };
    }

    fs.mkdirSync(dir, { recursive: true });
    removeExisting(dir, user, project, slot);
    fs.writeFileSync(path.join(dir, `${pfx}.${dec.ext}`), dec.buf);
    return { ok: true };
}

/** يعيد {buf, mime} لصورة slot، أو null إن لم تُرفع بعد. */
export function readAsset(dir, user, project, slot) {
    if (!validSlot(slot)) return null;
    const pfx = prefix(user, project, slot) + '.';
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { return null; }
    const file = entries.find(f => f.startsWith(pfx));
    if (!file) return null;
    const ext = file.slice(pfx.length);
    const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
    try { return { buf: fs.readFileSync(path.join(dir, file)), mime }; }
    catch { return null; }
}
