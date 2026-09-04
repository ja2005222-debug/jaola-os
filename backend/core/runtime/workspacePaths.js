/**
 * 🛡️ Workspace Paths — نواة احتواء المسارات المشتركة (Sprint 2c / محور Tool).
 *
 * `CONTRACTS.md` §3 سمّى الحقيقة: حارس المسار **مكرَّر ثلاث مرات** بمنطق
 * متقارب لا متطابق — `safeRelPath` (فريق الخلفية)، `sanitizePath`
 * (`middleware/security.js`)، و`writePlanFiles` (داخل `jcr.js`).
 *
 * ⚠️ **لم تُدمَج الثلاثة في دالة واحدة عمداً**: سياساتها تختلف اختلافاً حقيقياً،
 * ودمجها الأعمى يغيّر سلوك ثلاثة مسارات حيّة دفعةً واحدة:
 *   • `safeRelPath` يرفض بقائمة أحرف بيضاء (`\w.-/ ` فقط) ويعيد `null` بصمت.
 *   • `sanitizePath` يقبل أي أحرف لكنه **يرمي** ويعيد مساراً مطلقاً.
 *   • `writePlanFiles` يرفض الملفات المخفية (`.foo` لا تُخدَّم أصلاً) ويتخطّى بصمت.
 *
 * فالمشترك الحقيقي هو **الاحتواء** وحده: «هل المسار الناتج داخل جذر المشروع؟».
 * هذا ما يوحَّد هنا؛ وكل موضع يحتفظ بسياسته الصريحة ويستدعي النواة.
 *
 * 📌 ملاحظة صدق: الفحص السابق في `writePlanFiles` كان
 * `fp.startsWith(projectPath)` **بلا فاصل مسار** — أضعف مما يبدو (شقيق باسم
 * `<root>-evil` يمرّ منطقياً). لم يكن قابلاً للاستغلال فعلياً لأن سياسة `..`
 * تسبقه و`path.join` يُطبّع، لكنه دفاعٌ في العمق معطوب — و`isInsideRoot` يصلحه.
 */

import path from 'path';

/**
 * هل المسار المطلق داخل الجذر (أو هو الجذر نفسه)؟
 * المقارنة بفاصل المسار تمنع تجاوز البادئة (`/w/proj` مقابل `/w/proj-evil`).
 */
export function isInsideRoot(root, absPath) {
    if (typeof root !== 'string' || typeof absPath !== 'string' || !root || !absPath) return false;
    const r = path.resolve(root);
    const a = path.resolve(absPath);
    return a === r || a.startsWith(r + path.sep);
}

/**
 * يحلّ مساراً نسبياً داخل الجذر ويعيده مطلقاً — أو `null` إن خرج عنه.
 * لا سياسة أحرف هنا: المستدعي يطبّق سياسته قبل النداء.
 */
export function resolveInside(root, relPath) {
    if (typeof root !== 'string' || typeof relPath !== 'string' || !root) return null;
    const abs = path.resolve(path.resolve(root), relPath);
    return isInsideRoot(root, abs) ? abs : null;
}

/**
 * يطهّر مساراً نسبياً: يمنع الجذر المطلق و`..` وأحرفاً خطيرة، ويوحّد الفواصل.
 * **منقول حرفياً** من `agents/backendTeam/backendTeam.js` (نفس السياسة تماماً)
 * إلى موقع محايد كي يستهلكه منفّذ الوكيل العام أيضاً بلا دورة استيراد.
 * ملاحظة موثّقة: `\w` لاتيني — فأسماء الملفات العربية تُرفض هنا (لا أثر عملي
 * اليوم: عقود الفريق تُلزم مسارات إنجليزية، وتغيير السياسة قرار مستقل).
 */
export function safeRelPath(p) {
    if (typeof p !== 'string') return null;
    let clean = p.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.includes('..') || /[<>:"|?*\0]/.test(clean)) return null;
    // احصر الطول والأحرف المسموحة
    if (clean.length > 200 || !/^[\w.\-\/ ]+$/.test(clean)) return null;
    return clean;
}

/**
 * 📁 مسار مشروع داخل مساحة العمل — **اشتقاقٌ نقيّ بلا أثر على القرص**.
 *
 * كان `getProjectPath` في `server.js` يفعل الأمرين معاً: يشتقّ المسار
 * **ويُنشئ المجلد** (`mkdirSync`) قبل أن يعيده. وهذا يُبطل كل فحص وجودٍ
 * مبنيّ عليه:
 *
 *     if (!fs.existsSync(getProjectPath(username, project)))
 *         return res.status(404).json({ error: 'المشروع غير موجود' });
 *
 * الفحص يُنشئ ما يفحصه فيراه موجوداً **دائماً** — حارسٌ لا يقع أبداً.
 * وموضعه `/api/site/password`: مسارٌ **بلا مصادقة** تُعيَّن به أول كلمة
 * مرور للوحة موقعٍ منشور. فكان أيُّ أحد يعيّنها لمشروعٍ لا وجود له، فإذا
 * أنشأ صاحبه مشروعاً بذلك الاسم لاحقاً وجد لوحته مملوكةً سلفاً.
 *
 * التطهير منقولٌ حرفياً من `server.js` — والمحرف البديل `_` لم يُغيَّر كي
 * لا يتغيّر أيُّ مسارٍ قائم على القرص.
 */
export const safeSegment = (value, fallback) =>
    String(value || fallback).replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();

export function projectPathOf(baseWorkspace, username, activeProject) {
    return path.join(
        baseWorkspace,
        safeSegment(username, 'guest_user'),
        safeSegment(activeProject, 'sandbox_app'),
    );
}
