/**
 * 🔐 أسرار التطبيقات المولَّدة — مصدر واحد لما يُكتب في كود المستخدم
 *
 * سرُّ توقيع JWT كان مكتوباً حرفياً في **ثلاثة قوالب** بقيمتين مختلفتين:
 *
 *   api/auth.js            → 'jaola-secret-key-change-in-production'  (يُصدر)
 *   api/middleware/auth.js → 'jaola-secret-key-change-in-production'  (يتحقّق)
 *   api/auth/google.js     → 'jaola-secret'                           (يُصدر)
 *
 * فالمشروع الذي فيه دخولُ Google ولم يُضبط له `JWT_SECRET`: كل توكن يصدره
 * دخول Google يوقَّع بسرٍّ، ويتحقّق منه الوسيط بسرٍّ آخر — **فيُرفَض فوراً**.
 * ميزةٌ مكتملة لا تعمل، وسببها قيمةٌ كُتبت مرّتين لا مرّة.
 *
 * ثم كانت القيمة الموحَّدة **معروفة علناً** في هذا المستودع: أي تطبيق
 * يُنشر بلا `JWT_SECRET` يمكن تزوير توكناته — بمعرفة سطرٍ واحد من كودٍ
 * مفتوح. فصار السقوط **مشتقّاً لكل مشروع على حدة**:
 *
 *     HMAC-SHA256(سرّ جاولا نفسه، مسار المشروع)
 *
 * • ثابتٌ لمشروعٍ واحد → المولِّدان يتّفقان بلا تمرير حالة بينهما، ويبقى
 *   السرّ نفسه بعد كل إعادة توليد فلا تسقط جلسات المستخدمين.
 * • مختلفٌ بين مشروعين → لا يُفتح مشروعٌ بسرّ آخر.
 * • غير متوقَّعٍ من الخارج → مفتاح جاولا نفسه هو الملح، وهو غير منشور.
 *
 * 📌 وهذا **لا يُغني** عن ضبط `JWT_SECRET` في بيئة التطبيق المنشور: السرّ
 * المشتقّ يعيش في شيفرة المشروع، ومن يقرأ الشيفرة يقرأه. لذلك يبقى
 * `process.env.JWT_SECRET` أولاً، والكود المولَّد **يُنذر عند الإقلاع**
 * حين لا يجده. السقوط الآمن يبقى، والصمت هو ما أُصلح — نفس مبدأ حارس
 * النِسَب في خدمة السفر.
 */

import { createHmac } from 'crypto';

/** سقوطٌ أخير حين لا مسار ولا مفتاح لجاولا (لا يقع في الإنتاج: الخادم يرفض الإقلاع بلا JWT_SECRET). */
export const GENERATED_JWT_SECRET_FALLBACK = 'jaola-dev-only-change-me';

/** سرُّ المشروع: ثابتٌ له، مختلفٌ عن غيره، غير متوقَّعٍ بلا مفتاح جاولا. */
export function projectJwtSecret(projectPath, env = process.env) {
    const salt = String(env.JWT_SECRET || '').trim();
    const scope = String(projectPath || '').trim();
    if (!salt || !scope) return GENERATED_JWT_SECRET_FALLBACK;
    return 'jaola_' + createHmac('sha256', salt).update(scope, 'utf8').digest('base64url').slice(0, 43);
}

/**
 * السطر الذي يُكتب في كل ملف مولَّد يحتاج السرّ. يُدرَج نصّاً في القوالب
 * كي لا تعود القيمة تُكتب في أكثر من موضع.
 */
export function jwtSecretSnippet(projectPath, env = process.env) {
    return `const JWT_SECRET = process.env.JWT_SECRET || (() => {
    console.warn('⚠️  JWT_SECRET غير مضبوط — يُستعمل سرٌّ افتراضيٌّ مكتوبٌ في شيفرة المشروع. اضبطه في متغيّرات البيئة قبل النشر، وإلا أمكن لمن يقرأ الشيفرة تزوير جلسات المستخدمين.');
    return ${JSON.stringify(projectJwtSecret(projectPath, env))};
})();`;
}

export default { GENERATED_JWT_SECRET_FALLBACK, projectJwtSecret, jwtSecretSnippet };
