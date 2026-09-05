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
// 🔴 كانت **تمحو** الحروف غير المسموحة بدل أن ترفض الاسم، فينهار
//    «شاعر-عربي.js» و«وكيل.js» إلى المفتاح `.js` نفسِه ويطمس أحدُهما الآخر.
//    الشكلُ هنا هو مخرَجُ `toPluginFileName` نفسُه — فما خالفه ليس اسمَ إضافة.
const VALID_PLUGIN_FILE = /^[a-z0-9_][a-z0-9\-_.]*\.js$/i;
const safeFile = (f) => {
    const base = path.basename(f || '');
    return VALID_PLUGIN_FILE.test(base) ? base : '';
};

/**
 * حفظ/تحديث كود إضافة في MongoDB (يُستدعى بعد كل إنشاء/تعديل).
 *
 * 🔴 كانت تعود صامتةً في كلّ إخفاق — بلا اتصالٍ أو باستثناء — بينما
 *    يعلّق المستدعي «🗄️ دائم في MongoDB» ويردّ `created: true`. فتقول
 *    اللوحةُ للمالك إنّ وكيلَه صار دائماً، ويمحوه أوّلُ نشرٍ على Render.
 *    الديمومةُ الآن ناتجٌ يُقال، لا تعليقٌ يُفترَض.
 *
 * @returns {Promise<{durable: boolean, reason?: string}>}
 */
export async function persistPlugin(file, code) {
    const f = safeFile(file);
    if (!f) return { durable: false, reason: 'اسم ملفٍ غير صالح' };
    if (!online()) return { durable: false, reason: 'قاعدة البيانات غير متصلة' };
    try {
        await PluginDoc.updateOne(
            { file: f },
            { $set: { code, updatedAt: new Date() } },
            { upsert: true }
        );
        return { durable: true };
    } catch (e) {
        console.warn('[PluginStore] فشل حفظ الإضافة:', e.message);
        return { durable: false, reason: e.message };
    }
}

/** حذف إضافة من MongoDB (يُستدعى مع حذف الملف). */
export async function removePlugin(file) {
    if (!online()) return { durable: false, removed: false, reason: 'قاعدة البيانات غير متصلة' };
    try {
        const r = await PluginDoc.deleteOne({ file: safeFile(file) });
        return { durable: true, removed: !!r?.deletedCount };
    } catch (e) {
        console.warn('[PluginStore] فشل حذف الإضافة:', e.message);
        return { durable: false, removed: false, reason: e.message };
    }
}

/**
 * استعادة كل الإضافات من MongoDB إلى القرص (تُستدعى قبل تحميل الإضافات).
 *
 * 🔴 كان القرارُ `doc.updatedAt > mtime` القرص. وmtime لا يسجّل **مَن كتب
 *    المحتوى** بل متى لُمس الملف: نشرُ Render يعيد سحبَ كلّ ملفٍ متتبَّعٍ
 *    في git بطابعٍ جديد. و`plugins/site-checker.js` متتبَّع — فأيُّ تعديلٍ
 *    أجراه المالك عليه من اللوحة يصير «أقدمَ من القرص» بعد أوّل نشر،
 *    فيُطرح صامتاً، ويُبلَّغ `restored: 0` كأنّ لا شيء كان ينتظر.
 *
 *    الساعةُ ليست دليلاً هنا، فالمقارنةُ صارت بالمحتوى. ومَن في Mongo لم
 *    يصل إليها إلّا عبر اللوحة، فهي مرادُ المالك. ولأنّ ذلك يعني أنّ نسخةً
 *    مشحونةً أحدثَ قد تُغطَّى بتعديلٍ أقدمَ للمالك — وهو تعارضٌ حقيقيّ لا
 *    يستطيع الكودُ حسمَه — يُقال التعارضُ في السجلّ بدل أن يُبتلَع.
 *
 * @param {string} [dir] مجلّد الإضافات — المُعامل للاختبار، والافتراضُ للإنتاج.
 */
export async function restorePluginsToDisk(dir = PLUGINS_DIR) {
    const empty = { restored: 0, unchanged: 0, failed: 0, skipped: 0, available: 0 };
    // 🔴 «صفرٌ مُستعاد» كان جواب ثلاثِ حالات: بلا اتصال، واستثناء، ولا شيء
    //    ينتظر. والمستدعي يعيد التحميل عند `restored > 0` فقط — فالإخفاقُ
    //    كان يمرّ صامتاً. `ok` تفصل العجزَ عن عدم الحاجة.
    if (!online()) return { ok: false, reason: 'قاعدة البيانات غير متصلة', ...empty };
    try {
        const docs = await PluginDoc.find().lean();
        if (!docs.length) return { ok: true, ...empty };

        await fsp.mkdir(dir, { recursive: true });
        let restored = 0, unchanged = 0, failed = 0, skipped = 0;
        const overwritten = [];
        for (const doc of docs) {
            const f = safeFile(doc.file);
            if (!f) { skipped++; continue; }
            const target = path.join(dir, f);
            try {
                const current = fs.existsSync(target) ? await fsp.readFile(target, 'utf8') : null;
                if (current === doc.code) { unchanged++; continue; }
                if (current !== null) overwritten.push(f);
                await fsp.writeFile(target, doc.code);
                restored++;
            } catch (e) {
                failed++;
                console.warn(`[PluginStore] تعذّرت استعادة ${f}:`, e.message);
            }
        }
        if (restored) console.log(`🗄️ [PluginStore] استُعيد ${restored} إضافة من MongoDB`);
        if (overwritten.length) {
            console.warn(`🗄️ [PluginStore] نسخةُ اللوحة غطّت نسخةَ القرص في: ${overwritten.join('، ')}`
                + ' — إن كان المقصودُ نسخةَ المستودع فاحذف الإضافة من اللوحة ثمّ أعد النشر.');
        }
        return { ok: true, restored, unchanged, failed, skipped, available: docs.length };
    } catch (e) {
        console.warn('[PluginStore] فشل الاستعادة:', e.message);
        return { ok: false, reason: e.message, ...empty };
    }
}
