/**
 * 🔑 بيانات دخول لوحة الموقع المنشور — مخزنٌ ملفّي صغير بمطالبةٍ ذرّية
 *
 * كانت هذه الأسطر داخل `server.js`، فلم يكن حارسها قابلاً للاختبار — وهو
 * حارسٌ يستحقّ اختباراً، لأن الوعد الذي يقطعه لم يكن الكود يفي به.
 *
 * 🔴 **«أول من يعيّن يفوز» لم يكن كذلك.** المسار `/api/site/password`
 * **بلا مصادقة** بحكم تصميمه (لوحة الموقع المنشور يفتحها صاحب الموقع لا
 * صاحب حساب جولا)، وحارسه كان: اقرأ فإن لم تجد كلمةً فاكتب. وبين
 * القراءة والكتابة فاصلٌ زمني، والكتابة تدهس ما تجده. فطلبان متزامنان
 * يجتازان الفحص **معاً**.
 *
 * وثمنه أثقل من «يفوز آخرُ من يكتب»: توكن اللوحة موقَّعٌ على
 * `{user, project}` وحدهما ولا يرتبط بكلمة المرور إطلاقاً — فكلا
 * المتسابقَين يخرج بتوكنٍ **صالحٍ ثماني ساعات**، ومن خسر الكتابة يحتفظ
 * بصلاحية تحرير محتوى الموقع ورفع ملفّاته كاملةً. حارسٌ يعلن فائزاً
 * واحداً ويسلّم المفاتيح لاثنين.
 *
 * فالمطالبة الآن **إنشاءٌ حصري** (`flag: 'wx'`) يقرّره نظام الملفات: يفوز
 * كاتبٌ واحد ويأخذ الباقي `EEXIST` بلا توكن — نفس عرف «أول كتابةٍ تفوز»
 * في رمز الاستعادة بخدمة السفر، والذرّية في المخزن لا في الكود المستدعي.
 *
 * 📌 ولا تُفتح الدالّة لتعديلٍ لاحق عمداً: ما يُنشأ مرّة لا يُدهَس بنداءٍ
 * عابر. تغيير كلمة المرور ميزةٌ مستقلة تحتاج قراراً عن **من** يملك
 * تغييرها، لا فرعاً في هذه الدالّة.
 */

import fs from 'fs';
import path from 'path';

const seg = (v) => String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');

/** مسار ملفّ الاعتماد — نفس صياغة `cmsKey` السابقة حرفياً. */
export const siteCredPath = (dir, username, project) =>
    path.join(dir, `${seg(username)}__${seg(project)}.json`);

export function readSiteCred(dir, username, project) {
    try { return JSON.parse(fs.readFileSync(siteCredPath(dir, username, project), 'utf8')); }
    catch { return null; }
}

/**
 * مطالبةٌ ذرّية: تنجح مرّةً واحدة لكل (مستخدم، مشروع) مهما تزامن الطالبون.
 * @returns {boolean} صدقٌ إن فاز هذا النداء.
 */
export function claimSiteCred(dir, username, project, cred) {
    fs.mkdirSync(dir, { recursive: true });
    try {
        fs.writeFileSync(siteCredPath(dir, username, project), JSON.stringify(cred), { flag: 'wx' });
        return true;
    } catch (e) {
        if (e.code === 'EEXIST') return false;
        throw e;
    }
}

export default { siteCredPath, readSiteCred, claimSiteCred };
