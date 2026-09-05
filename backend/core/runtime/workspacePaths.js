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
import { promises as fsPromises } from 'fs';

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

// ═══════════════════════════════════════════════════════
// 📄 ملفّاتُ المشروع المولَّدة — السياسةُ الرابعة، ومكانُها هنا
// ═══════════════════════════════════════════════════════

/**
 * ملفّاتٌ منقوطةٌ مشروعةٌ داخل مشروع المستخدم.
 *
 * 🔴 كانت هذه القائمةُ **مكرّرةً ومتضاربة**: `agents/fileManager.js` يسمح
 *    بـ`.gitignore` و`.env.example`، و`services/projectBrain.js` يسمح
 *    بـ`.env.example` وحده. فملفٌّ يُنسخ في النسخة الاحتياطية ولا يراه
 *    «دماغُ المشروع». سؤالٌ واحدٌ بجوابين — عائلةُ 7/1 و7/2 و4h.
 *
 * 🔴 **تصحيحُ قياسٍ لي**: قلتُ أوّلاً «لا يخرج من المولّدات اسمٌ منقوطٌ غيرُ
 *    هذين، ولا مجلّدَ منقوطٍ إطلاقاً» — وكان **خطأً**. بحثتُ عن نمطِ
 *    `name: '.x'` وحده، ففاتني ما يُكتب بمسارٍ حرفيّ:
 *      • `.jaola-bot.json` — يكتبه `jaolaBot.js:249`، ويقرؤه `jaolaBot.js:289`
 *        و`marketingAgent.js:52`. **مضافٌ أدناه** كي لا يُحذف صامتاً لو مرّ
 *        كاتبُه بهذه النواة يوماً — وهو الفخُّ نفسُه الذي نجا منه `.env.example`.
 *      • `.backups/` (`fileManager`) و`.git/` (`gitAgent`) — **مجلّدان** لا
 *        ملفّان، وتكتبهما المنصّةُ بمسارٍ ثابتٍ لا عبر أسماءِ مولِّد. فخارجُ
 *        النطاق قصداً: هذه السياسةُ لأسماءٍ **يقترحها مولِّدٌ أو نموذج**.
 *      • `.env` — سرٌّ حقيقيّ، ويجب أن يبقى مرفوضاً هنا أبداً.
 *
 *    والدرس: **بحثٌ عن صيغةٍ واحدةٍ ليس جرداً.** الاسمُ قد يُكتب حرفيّاً.
 */
export const PROJECT_DOTFILES = Object.freeze(['.gitignore', '.env.example', '.jaola-bot.json']);

/**
 * 🛡️ يحلّ اسمَ ملفٍّ **جاء من مولِّدٍ أو من نموذج** إلى مسارٍ مطلقٍ محتوىً
 * داخل جذر المشروع — أو `null` إن كان الاسمُ غيرَ مقبول.
 *
 * السياسةُ منقولةٌ من `writePlanFiles` في `jcr.js`، حيث كانت **مطبَّقةً في
 * موضعٍ واحدٍ من ستّةَ عشر**: خمسةَ عشرَ موضعاً في الملفّ نفسِه كانت تكتب
 * `path.join(projectPath, file.name)` مباشرةً بلا احتواء. وأخطرُها مسارُ
 * التعديل: الأسماءُ فيه من **مخرجات النموذج**، فاسمٌ مثل `../../x/index.html`
 * يكتب خارج مشروع صاحبه.
 *
 * الفرقُ الوحيدُ عن الأصل: الملفّاتُ المنقوطةُ المشروعة تمرّ. كان الأصلُ
 * يرفض كلَّ منقوطٍ بحجّة «لن تُخدَّم أصلاً» — وهي حجّةُ **خدمةٍ** لا حجّةُ
 * **كتابة**؛ وتطبيقُها على المولّدات يُسقط `.env.example` صامتاً.
 *
 * @returns {string|null} مسارٌ مطلقٌ آمن، أو `null` مع سببٍ صامت.
 */
export function resolveProjectFile(root, name) {
    if (typeof name !== 'string') return null;
    const norm = path.normalize(name.trim()).replace(/\\/g, '/');
    if (!norm || path.isAbsolute(norm)) return null;
    const parts = norm.split('/').filter(Boolean);
    if (!parts.length) return null;
    for (const seg of parts) {
        if (seg === '..') return null;
        // منقوطٌ مسموحٌ **كاسمِ ملفٍّ أخير** فقط — لا مجلّداتٍ منقوطة.
        if (seg.startsWith('.')) {
            const isLast = seg === parts[parts.length - 1];
            if (!isLast || !PROJECT_DOTFILES.includes(seg)) return null;
        }
    }
    return resolveInside(root, norm);
}

// 💾 كتابة آمنة لكل ملفات الخطة — القائمة البيضاء القديمة
// ['index.html','styles.css','script.js'] كانت تُسقط بصمت أي ملف باسم مختلف
// (style.css بلا s، css/styles.css، صفحات إضافية) فيصل الموقع للمستخدم
// خاماً بلا تصميم. الآن يُكتب كل ملف بعد تعقيم مساره فقط.
// 🛡️ الاحتواءُ صار **واحداً**: كانت سياسةُ `writePlanFiles` مطبَّقةً في موضعٍ
// واحدٍ من عشرين داخل هذا الملفّ؛ والباقيةُ تكتب `path.join(root, f.name)`
// مباشرةً بلا احتواء. أخطرُها مسارُ التعديل، فأسماؤه من **مخرجات النموذج**.
/**
 * ✍️ كتابةُ ملفٍّ واحدٍ من مولِّدٍ أو نموذجٍ — **محتوىً دائماً**.
 * @returns {Promise<boolean>} `false` إن رُفض الاسم (خارج الجذر أو منقوطٌ غيرُ مسموح).
 */
export async function writeProjectFile(root, name, content) {
    const fp = resolveProjectFile(root, name);
    if (!fp) return false;
    await fsPromises.mkdir(path.dirname(fp), { recursive: true });
    await fsPromises.writeFile(fp, content);
    return true;
}

/**
 * 💾 كتابةُ ملفّات الخطة كلِّها.
 * @returns {{written: number, rejected: string[]}} — الرفضُ يُحصى لا يُبتلع.
 */
export async function writePlanFiles(projectPath, files) {
    const rejected = [];
    let written = 0;
    for (const f of files || []) {
        if (!f?.name || typeof f.content !== 'string') { if (f?.name) rejected.push(String(f.name)); continue; }
        const fp = resolveProjectFile(projectPath, f.name);
        if (!fp) { rejected.push(String(f.name)); continue; }
        await fsPromises.mkdir(path.dirname(fp), { recursive: true });
        await fsPromises.writeFile(fp, f.content);
        written++;
    }
    return { written, rejected };
}
