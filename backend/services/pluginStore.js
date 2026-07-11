/**
 * 🗄️ Plugin Store — تخزين الإضافات دائماً في MongoDB
 *
 * قرص Render مؤقت: الإضافات المصنوعة من لوحة التحكم تُمسح مع كل إعادة نشر.
 * هذه الخدمة تحفظ كود كل إضافة في Mongo، وتستعيدها للقرص عند الإقلاع
 * قبل أن يمسحها PluginLoader — فتبقى وكلاؤك المصنوعة دائمين.
 *
 * كل الدوال آمنة (no-op) عندما تكون قاعدة البيانات غير متصلة.
 */

import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.resolve(__dirname, '../plugins');

const PluginSchema = new mongoose.Schema({
    file: { type: String, required: true, unique: true }, // اسم الملف (مثل: arabic-poet.js)
    code: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
});

const PluginDoc = mongoose.models.CustomPlugin || mongoose.model('CustomPlugin', PluginSchema);

const online = () => mongoose.connection.readyState === 1;
const safeFile = (f) => path.basename(f || '').replace(/[^a-z0-9\-_.]/gi, '');

// حفظ/تحديث كود إضافة في MongoDB (يُستدعى بعد كل إنشاء/تعديل)
export async function persistPlugin(file, code) {
    if (!online()) return;
    const f = safeFile(file);
    if (!f.endsWith('.js')) return;
    try {
        await PluginDoc.updateOne(
            { file: f },
            { $set: { code, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch (e) {
        console.warn('[PluginStore] فشل حفظ الإضافة:', e.message);
    }
}

// حذف إضافة من MongoDB (يُستدعى مع حذف الملف)
export async function removePlugin(file) {
    if (!online()) return;
    try {
        await PluginDoc.deleteOne({ file: safeFile(file) });
    } catch (e) {
        console.warn('[PluginStore] فشل حذف الإضافة:', e.message);
    }
}

// استعادة كل الإضافات من MongoDB إلى القرص (تُستدعى قبل تحميل الإضافات)
export async function restorePluginsToDisk() {
    if (!online()) return { restored: 0 };
    try {
        const docs = await PluginDoc.find().lean();
        if (!docs.length) return { restored: 0 };

        await fsp.mkdir(PLUGINS_DIR, { recursive: true });
        let restored = 0;
        for (const doc of docs) {
            const f = safeFile(doc.file);
            if (!f.endsWith('.js')) continue;
            const target = path.join(PLUGINS_DIR, f);
            // نستعيد فقط إذا كان الملف غائباً أو نسخة Mongo أحدث
            let write = true;
            if (fs.existsSync(target)) {
                const diskMtime = fs.statSync(target).mtimeMs;
                write = new Date(doc.updatedAt).getTime() > diskMtime;
            }
            if (write) {
                await fsp.writeFile(target, doc.code);
                restored++;
            }
        }
        if (restored) console.log(`🗄️ [PluginStore] استُعيد ${restored} إضافة من MongoDB`);
        return { restored };
    } catch (e) {
        console.warn('[PluginStore] فشل الاستعادة:', e.message);
        return { restored: 0 };
    }
}
