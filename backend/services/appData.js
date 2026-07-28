/**
 * 🗄️ تخزين بيانات القوالب الداخلية (jaola-data) — يمنح قوالب «السيستم»
 * (عيادة/نقطة بيع/مستودع...) تخزيناً حقيقياً بدل الاعتماد الكلي على
 * localStorage وحده، فتتزامن بيانات العمل بين الأجهزة ولا تضيع بمسح الكاش.
 *
 * ملفّي (offline-tolerant، بلا اعتماد على Mongo) — نفس فلسفة siteInbox.js:
 * ملف JSON واحد لكل مشروع يحوي كل مفاتيحه معاً. القيم تُخزَّن كنصوص خام
 * (JSON.stringify جاهزة من localStorage) بلا فكّ/إعادة ترميز — الخادم لا
 * يفهم معناها، فقط يحفظها ويعيدها كما هي.
 */

import fs from 'fs';
import path from 'path';

const MAX_KEYS = 60;                  // عدد مفاتيح كحد أقصى لكل مشروع
const MAX_VALUE_BYTES = 512 * 1024;   // 512KB لكل مفتاح
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4MB إجمالي لكل مشروع
const KEY_RE = /^[\w.-]{1,80}$/;

const slug = (u, p) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(p || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const storePath = (dir, u, p) => path.join(dir, slug(u, p) + '.json');

/** يقرأ كل مفاتيح مشروع (كائن مسطّح key→value). لا يرمي أبداً. */
export function readStore(dir, user, project) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project), 'utf8'));
        return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    } catch { return {}; }
}

/** يكتب مفتاحاً واحداً (يدمج مع الموجود) — يفرض حدود الحجم/العدد. */
export function writeKey(dir, user, project, dataKey, value) {
    if (!KEY_RE.test(String(dataKey || ''))) return { error: 'مفتاح غير صالح' };
    const strVal = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    if (Buffer.byteLength(strVal, 'utf8') > MAX_VALUE_BYTES) return { error: 'القيمة أكبر من الحد المسموح' };
    const store = readStore(dir, user, project);
    const isNew = !(dataKey in store);
    if (isNew && Object.keys(store).length >= MAX_KEYS) return { error: 'تجاوزت الحد الأقصى لعدد المفاتيح لهذا المشروع' };
    const next = { ...store, [dataKey]: strVal };
    if (Buffer.byteLength(JSON.stringify(next), 'utf8') > MAX_TOTAL_BYTES) {
        return { error: 'تجاوزت الحد الأقصى لحجم بيانات هذا المشروع' };
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify(next));
    return { ok: true };
}
