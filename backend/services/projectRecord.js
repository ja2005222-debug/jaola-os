/**
 * 🗂️ projectRecord.js — الكتابةُ على سجلّ المشروع في Mongo، بابٌ واحد.
 *
 * ── لماذا وُجد
 *
 * المشروعُ الافتراضيّ `sandbox_app` **لا مستندَ له في Mongo**، وهذه ليست
 * مصادفة: `join_project` — الطريقُ الوحيد الذي تسلكه الواجهة إلى سجلّات
 * المشاريع — يستثنيه صراحةً (`safeProject !== 'sandbox_app'`)، و
 * `/api/projects/create` يرفض الاسمَ لأنّه «محجوزٌ للمشروع الافتراضيّ»،
 * و`validateProjectOwnership` يعود مبكّراً قبل أيّ إنشاء. المسارُ الوحيدُ
 * الذي كان يُنشئه (`/api/project-context/switch`) لا تستدعيه الواجهةُ أبداً.
 *
 * وثلاثةُ مواضعَ كانت تكتب حقائقَ المشروع بـ `updateOne`/`findOneAndUpdate`
 * **بلا `upsert`**. فمع صفرِ مستندات: صفرُ مطابقات، وصفرُ كتابة، **وصمت**:
 *
 *   • `agents/deployAgent.js` — رابطُ Vercel الحيّ
 *   • `server.js` (مسار Render الآليّ) — رابطُ Render الحيّ
 *   • `services/deployAutomation.js` — تكاملُ GitHub **وتوكنُه المعمّى**،
 *     وكانت تعيد `true` بعد ألّا تكتب شيئاً. **أسوأُ الثلاثة: تقريرٌ كاذب.**
 *
 * فالمستخدمُ ينشر مشروعَه الافتراضيّ، فيرى الرابطَ في السجلّ مرّةً واحدة،
 * ثمّ لا تتذكّره اللوحةُ أبداً: `emitUserProjects` يقرأ `vercelUrl` من
 * المستند، والمستندُ غيرُ موجود، فيُرسِل `''` عند كلِّ اتّصال.
 *
 * ولماذا لم يظهر للجميع؟ لأنّ موضعاً رابعاً (`/api/github/link` في
 * `server.js`) **يستعمل `upsert`** — فمن ربط GitHub أوّلاً وُلد مستندُه،
 * فصارت نشراتُه تُحفظ. تبعيّةٌ خفيّةٌ بين ميزتين لا علاقةَ بينهما، وهي ما
 * يجعل العطبَ يبدو تذبذباً.
 *
 * ── ما تضمنه هذه الوحدة
 *
 *   1. **`upsert`** — الكتابةُ تُنشئ المستندَ إن غاب، فلا تضيع بصمت.
 *   2. **حارسُ الاتّصال** — `deployAgent` لم يكن يفحصه، وmongoose يُخزّن
 *      العمليّةَ مؤقّتاً ثمّ يرميها بعد ١٠ ثوانٍ؛ أي تعليقُ مسارِ النشر.
 *   3. **ناتجٌ صادق** — `true` تعني «طوبِق مستندٌ أو أُنشئ»، لا «لم أرمِ».
 *   4. **`localPath`** — مطلوبٌ في المخطّط، فلا بدّ منه عند الإدخال.
 *
 * ⚠️ ملحوظةٌ مسجَّلة: `localPath` **لا يقرؤه أحد** في المستودع كلِّه — يُكتب
 *    ولا يُقرأ، وبصيغتين مختلفتين (`server.js:2179` يكتب مساراً مطلقاً،
 *    و`DB.createProject` نسبيّاً). وُحِّد هنا على النسبيّ. لم يُحذف الحقلُ
 *    لأنّ حذفَ حقلٍ مطلوبٍ من مخطّطٍ حيّ يمسّ مستنداتٍ قائمة.
 */
import mongoose from 'mongoose';
import Project from '../models/Project.js';

const online = () => mongoose.connection.readyState === 1;

/** حقولُ الهويّة — تُشتقّ هنا ولا تُستقبَل من المتصل. */
const IDENTITY = Object.freeze(['name', 'owner', 'localPath', '_id']);

/** صيغةُ `localPath` الواحدة (نسبيّةٌ من جذر المستودع). */
export function projectLocalPath(owner, name) {
    return `workspace/${owner}/${name}`;
}

/**
 * يحفظ حقولاً على سجلّ المشروع، ويُنشئ السجلَّ إن غاب.
 *
 * @param {string} owner   اسمُ المالك
 * @param {string} name    اسمُ المشروع
 * @param {object} fields  الحقولُ المرادُ ضبطُها (بلا حقولِ هويّة)
 * @returns {Promise<boolean>} صحيحٌ إن طوبِق مستندٌ أو أُنشئ — لا «إن لم يُرمَ»
 */
export async function saveProjectFields(owner, name, fields) {
    if (!owner || !name || !fields || typeof fields !== 'object') return false;

    // حقلُ هويّةٍ من المتصل خطأٌ برمجيّ لا حالةُ تشغيل — يُقال ولا يُبتلع.
    const intruder = IDENTITY.find((k) => k in fields);
    if (intruder) {
        console.warn(`🗂️ [projectRecord] رُفض حفظُ ${owner}/${name}: الحقلُ \`${intruder}\` يُشتقّ ولا يُمرَّر.`);
        return false;
    }
    const set = { ...fields };
    if (!Object.keys(set).length) return false;
    if (!online()) return false;

    const filter = { name, owner };
    try {
        const r = await Project.updateOne(
            filter,
            { $set: set, $setOnInsert: { localPath: projectLocalPath(owner, name) } },
            { upsert: true },
        );
        return (r?.matchedCount ?? 0) > 0 || (r?.upsertedCount ?? 0) > 0;
    } catch (e) {
        // 11000: سباقٌ على الفهرس الفريد {name, owner} — أُدخل المستندُ
        // بيننا. فالتحديثُ وحدَه يكفي الآن، ولا داعيَ لإعلانِ فشل.
        if (e?.code === 11000) {
            try {
                const r = await Project.updateOne(filter, { $set: set });
                return (r?.matchedCount ?? 0) > 0;
            } catch { return false; }
        }
        console.warn(`🗂️ [projectRecord] فشل حفظُ ${owner}/${name}:`, e.message);
        return false;
    }
}
