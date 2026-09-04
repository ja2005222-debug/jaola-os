/**
 * 🔐 مصادقة حقيقية لقوالب «السيستم» — تستبدل كلمة المرور المشتركة المُقارَنة
 * محلياً (نص صريح داخل localStorage/jaola-data، يقرأها أي حامل توكن مشروع)
 * بكلمة مرور واحدة للمشروع، مُجزَّأة (bcrypt) ومُتحقَّق منها هنا فقط —
 * لا يغادر التجزيء الخادم أبداً، ولا تُعاد كلمة المرور أو تجزئتها لأي طلب.
 *
 * ملفّي (offline-tolerant، بلا اعتماد على Mongo)، نفس فلسفة appData.js.
 * كلمة المرور الافتراضية 'admin' (نفس بذرة كل القوالب) تُقبَل طالما لم
 * يُغيِّر المالك كلمة مرور حقيقية بعد — فلا حاجة لتزويد كل مشروع بكلمة
 * مرور عند التطبيق (بلا حالة "لم تُهيَّأ").
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

const DEFAULT_PASSWORD = 'admin';

const slug = (u, p) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(p || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const storePath = (dir, u, p) => path.join(dir, slug(u, p) + '.json');

function readHash(dir, user, project) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project), 'utf8'));
        return (s && typeof s.hash === 'string') ? s.hash : null;
    } catch { return null; }
}

/** يتحقّق من كلمة المرور — تجزئة محفوظة إن وُجدت، وإلا الافتراضية 'admin'. */
export async function verifyPassword(dir, user, project, plainPassword) {
    const hash = readHash(dir, user, project);
    if (!hash) return String(plainPassword || '') === DEFAULT_PASSWORD;
    try { return await bcrypt.compare(String(plainPassword || ''), hash); }
    catch { return false; }
}

/**
 * يضبط كلمة مرور جديدة (مُجزَّأة) لمشروع.
 *
 * 🔴 **تغييرُ اعتمادٍ قائم يتطلّب إثباتَه.** كان هذا المسار محروساً بتوكن
 * المشروع وحده — والتوكن **ليس سرّاً**: يُكتب حرفياً في `jaola-data.js`
 * داخل الموقع المنشور، ويُعرض على `window.JAOLA_SYNC.token`. فأي زائر
 * يفتح الطرفية، يقرؤه، ويستبدل كلمة مرور اللوحة **بلا معرفة القديمة** —
 * فيدخل ويُقصي المالك من لوحته.
 *
 * ووجودُ `/auth/login` نفسه هو الدليل على أن كلمة المرور اعتمادٌ حقيقي لا
 * تزيين: التجزيء لا يغادر الخادم، والتحقق هنا وحده. ثم كان مسارٌ شقيق
 * يسلّم الاعتماد لمن طلبه. حارسٌ يَعِد بما ينقضه جارُه.
 *
 * 📌 **وما لا يُصلحه هذا**: مشروعٌ لم تُضبط له كلمة مرور بعدُ يبقى على
 * الافتراضية `'admin'` — وهي **معلنة في هذا الملف** ويعرفها الجميع، فلا
 * إثباتَ فيها يُطلَب. اشتراطها هنا كان سيمنع أصحاب التطبيقات المنشورة
 * سلفاً من أول تغيير بلا أن يمنع مهاجماً يعرفها أصلاً. الحماية الحقيقية
 * لتلك الحالة قرارُ منتَج (إلزام ضبط كلمة مرور عند أول نشر)، لا شرطٌ
 * يُضاف هنا.
 *
 * @param {string} [currentPassword] إلزاميّ **حين تكون هناك كلمة مرور مضبوطة**.
 */
export async function setPassword(dir, user, project, plainPassword, currentPassword) {
    const pw = String(plainPassword || '');
    if (!pw || pw.length < 3 || pw.length > 200) return { error: 'كلمة مرور غير صالحة' };
    // الاعتماد القائم يُثبَت قبل استبداله — وغيابُه (الافتراضية المعلنة) لا شيء فيه يُثبَت.
    if (readHash(dir, user, project) && !await verifyPassword(dir, user, project, currentPassword)) {
        return { error: 'كلمة المرور الحالية غير صحيحة', status: 403 };
    }
    const hash = await bcrypt.hash(pw, 10);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify({ hash, updatedAt: Date.now() }));
    return { ok: true };
}
