/**
 * 🏛️ Architect Agent — ناقد البنية (حتمي، بلا LLM)
 *
 * ⚠️ كان يعود عند **أول** مشكلة: خطةٌ بلا CSS وبـHTML قصير تُبلَّغ بمشكلة
 * واحدة، فتُصلَح واحدةً واحدة — وكل دورة إعادة توليد تحرق
 * `budget.consumeCall()` في `jcr.js`. بميزانية محدودة قد لا تتقارب الخطة
 * أبداً رغم أن كل عيوبها كانت معروفة من الجولة الأولى.
 *
 * الآن يجمع الفحوص كلها بوحدة الدليل الرسمية (`core/evidence/Check.js`).
 * و`approved`/`feedback` يُشتقّان منها، فيبقى العقد القديم كما هو لكل
 * مستهلك قائم — والجديد أن `checks` تحمل **كل** ما وجده لا أوّله.
 */
import { fail, failures, passed as allPassed } from '../core/evidence/Check.js';

export function architectReview(plan) {
    const checks = [];

    if (!plan || !Array.isArray(plan.files)) {
        checks.push(fail('plan-shape', 'خطة الملفات تالفة أو غير مكتملة البنية.'));
        return { approved: false, feedback: checks[0].detail, checks };
    }

    const hasHtml = plan.files.some(f => f.name.endsWith('.html') && f.content && f.content.length > 100);
    const hasCss = plan.files.some(f => f.name.endsWith('.css') && f.content && f.content.length > 50);

    if (!hasHtml) checks.push(fail('html-missing', 'يفتقر القالب لملف HTML أساسي.'));
    if (!hasCss) checks.push(fail('css-missing', 'يفتقر القالب لملف CSS أساسي.'));

    // فحصٌ مستقل عن سابقيه: يُبلَّغ عنه حتى لو سقط غيره في نفس الجولة
    const htmlFile = plan.files.find(f => f.name.endsWith('.html'));
    if (htmlFile && (htmlFile.content || '').length < 200) {
        checks.push(fail('html-thin', 'ملف HTML قصير جداً — المحتوى غير مكتمل.'));
    }

    const approved = allPassed(checks);
    return {
        approved,
        // العقد القديم: نصٌّ واحد. يبقى أوّلَ عطبٍ حرفياً كما كان، فلا
        // يتغيّر شيء لمن يقرأ `feedback` — والتفصيل الكامل في `checks`.
        feedback: approved ? 'تمت مطابقة معايير البنية بنجاح.' : failures(checks)[0].detail,
        checks,
    };
}
