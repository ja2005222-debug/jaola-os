/**
 * 💾 Persistence Layer — JAOLA OS
 *
 * قرص Render يُمسح مع كل إعادة نشر — هذه الطبقة تجعل ذاكرات النظام
 * (ذاكرة المشاريع، ملفات المستخدمين، حالات البناء) دائمة في MongoDB:
 *
 * - persistEntry: حفظ مؤجل (debounced) لمدخل واحد — آمن للاستدعاء المتكرر
 * - hydrateStore: استرجاع كل مدخلات مخزن عند توفر الاتصال
 * - onMongoReady: تنفيذ عند جاهزية Mongo (فوراً إن كان متصلاً)
 *
 * كل الدوال no-op آمنة عندما تكون قاعدة البيانات غير متاحة.
 */

import mongoose from 'mongoose';

const KVSchema = new mongoose.Schema({
    store: { type: String, required: true },   // اسم المخزن: projectMemory | userProfiles | projectStates
    key:   { type: String, required: true },   // مفتاح المدخل: username:project أو username
    value: { type: mongoose.Schema.Types.Mixed },
    updatedAt: { type: Date, default: Date.now },
});
KVSchema.index({ store: 1, key: 1 }, { unique: true });

const KV = mongoose.models.MemoryKV || mongoose.model('MemoryKV', KVSchema);

const online = () => mongoose.connection.readyState === 1;
const pendingWrites = new Map(); // `${store}:${key}` → timeout

export function persistEntry(store, key, value) {
    if (!online()) return;
    const k = `${store}:${key}`;
    clearTimeout(pendingWrites.get(k));
    pendingWrites.set(k, setTimeout(async () => {
        pendingWrites.delete(k);
        try {
            await KV.updateOne(
                { store, key },
                { $set: { value, updatedAt: new Date() } },
                { upsert: true }
            );
        } catch (e) {
            console.warn(`[Persistence] فشل حفظ ${k}:`, e.message);
        }
    }, 1500));
}

export async function removeEntry(store, key) {
    if (!online()) return;
    const k = `${store}:${key}`;
    clearTimeout(pendingWrites.get(k));   // ألغِ أي كتابة مؤجلة لنفس المفتاح
    pendingWrites.delete(k);
    try {
        await KV.deleteOne({ store, key });
    } catch (e) {
        console.warn(`[Persistence] فشل حذف ${k}:`, e.message);
    }
}

export async function hydrateStore(store, applyFn) {
    if (!online()) return 0;
    try {
        const docs = await KV.find({ store }).lean();
        docs.forEach(d => {
            try { applyFn(d.key, d.value); } catch (e) {}
        });
        if (docs.length) console.log(`💾 [Persistence] استُعيد ${docs.length} مدخل من ${store}`);
        return docs.length;
    } catch (e) {
        console.warn(`[Persistence] فشل استرجاع ${store}:`, e.message);
        return 0;
    }
}

export function onMongoReady(fn) {
    if (online()) {
        fn();
    } else {
        mongoose.connection.once('connected', () => setTimeout(fn, 200));
    }
}
