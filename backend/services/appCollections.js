/**
 * 🗄️ مجموعات بيانات حقيقية (jaola-collections) — طبقة إضافية فوق appData.js
 * (بلا أي تعديل عليها): سجلات بمعرّفات (id) وعمليات CRUD فردية — إضافة/
 * تعديل/حذف سجل واحد دون إعادة إرسال/استبدال كتلة البيانات كاملة، كما
 * يفرضه appData.js اليوم (كل حفظ يستبدل القيمة المخزَّنة بالكامل، تماماً
 * كما يفعل localStorage.setItem الذي يحاكيه).
 *
 * ملاحظة نطاق: هذه القدرة إضافية جاهزة — القوالب الـ١٥ الحالية لا تستخدمها
 * بعد (منطق كل قالب الداخلي لا يزال يقرأ/يكتب مصفوفة كاملة عبر load/save)؛
 * ربطها بقالب يتطلب إعادة كتابة دوال الإضافة/التعديل/الحذف الخاصة بكل
 * كيان فيه، وهو عمل تالٍ منفصل. هذه الوحدة توفّر الأساس الخادمي فقط.
 *
 * ملفّي (offline-tolerant)، نفس فلسفة appData.js — مجموعة واحدة لكل ملف.
 */

import fs from 'fs';
import path from 'path';

const MAX_RECORDS = 2000;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;
const NAME_RE = /^[\w.-]{1,60}$/;
const ID_RE = /^[\w.-]{1,80}$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

function clean(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }
const slug = (u, p, c) => `${clean(u)}__${clean(p)}__${clean(c)}`;
const storePath = (dir, u, p, c) => path.join(dir, slug(u, p, c) + '.json');
const validName = (n) => NAME_RE.test(String(n || '')) && !RESERVED.has(n);

function readCollection(dir, user, project, name) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project, name), 'utf8'));
        return Array.isArray(s?.records) ? s.records : [];
    } catch { return []; }
}

function writeCollection(dir, user, project, name, records) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project, name), JSON.stringify({ records, updatedAt: Date.now() }));
}

/** سجلات مجموعة، مع فلترة تساوٍ بسيطة اختيارية ({field: value, ...}). */
export function listRecords(dir, user, project, name, filter) {
    if (!validName(name)) return [];
    let records = readCollection(dir, user, project, name);
    const keys = filter && typeof filter === 'object' ? Object.keys(filter) : [];
    if (keys.length) records = records.filter(r => keys.every(k => String(r?.[k] ?? '') === String(filter[k])));
    return records;
}

/** إضافة سجل جديد أو استبدال سجل بنفس id — لا يمسّ بقية سجلات المجموعة. */
export function upsertRecord(dir, user, project, name, record) {
    if (!validName(name)) return { error: 'اسم مجموعة غير صالح' };
    if (!record || typeof record !== 'object' || Array.isArray(record)) return { error: 'سجل غير صالح' };
    const id = String(record.id ?? '').trim();
    if (!id || RESERVED.has(id) || !ID_RE.test(id)) return { error: 'معرّف سجل غير صالح' };
    if (Buffer.byteLength(JSON.stringify(record), 'utf8') > MAX_RECORD_BYTES) return { error: 'السجل أكبر من الحد المسموح' };

    const records = readCollection(dir, user, project, name);
    const idx = records.findIndex(r => String(r?.id) === id);
    const isNew = idx === -1;
    if (isNew && records.length >= MAX_RECORDS) return { error: 'تجاوزت الحد الأقصى لعدد سجلات هذه المجموعة' };
    const next = isNew ? [...records, record] : records.map((r, i) => (i === idx ? record : r));
    if (Buffer.byteLength(JSON.stringify(next), 'utf8') > MAX_TOTAL_BYTES) {
        return { error: 'تجاوزت الحد الأقصى لحجم هذه المجموعة' };
    }
    writeCollection(dir, user, project, name, next);
    return { ok: true, record };
}

/** حذف سجل بمعرّفه — لا يرمي إن كان غائباً أصلاً. */
export function deleteRecord(dir, user, project, name, id) {
    if (!validName(name)) return { error: 'اسم مجموعة غير صالح' };
    const records = readCollection(dir, user, project, name);
    const next = records.filter(r => String(r?.id) !== String(id));
    if (next.length === records.length) return { ok: true, deleted: false };
    writeCollection(dir, user, project, name, next);
    return { ok: true, deleted: true };
}
