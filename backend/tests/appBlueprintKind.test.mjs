// 🧭 التصنيف الاحتياطي حين يسقط نداء الـLLM — يقرّر أكثر ممّا يبدو:
// `behaviorVerifier` يقرأ `kind` ليعرف **هل يفحص التفاعل أصلاً**،
// و`blockRegistry` لاختيار الكتل، و`jcr` للتسمية المعروضة. فخطؤه يُسلّم
// تطبيقاً بلا ميزةٍ عاملة **وبلا فحصٍ يكشف ذلك**.
//
// 🔴 وكان مخطئاً في نصف الحالات لسببين مستقلّين:
//   ١) `شركة`/`مؤسسة`/`عيادة` في قائمة البروشور — وهي تصف **مَن يطلب**
//      لا **ما يُطلَب** — والشرط `app && !brochure` يجعلها نقضاً مطلقاً.
//   ٢) مطابقةُ احتواءٍ بلا حدود كلمات: `app` داخل «happy» و«apple».
//
// 📌 والاختبار يمرّ بالدالّة الحقيقية `generateBlueprint`، لا بنسخةٍ منها:
// بلا مفاتيح AI في بيئة الاختبار يسقط `smartChat` حتماً — وهذا **هو**
// المسار الاحتياطي بعينه، فالمقيس هو ما يجري فعلاً عند عطل المزوّد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBlueprint } from '../agents/appBlueprint.js';

const kindOf = async (goal) => {
    const bp = await generateBlueprint(goal);
    assert.equal(bp._source, 'fallback', 'يجب أن يكون هذا المسار الاحتياطي');
    return bp.kind;
};

test('🧭 لفظُ العميل لا ينقض لفظَ المنتج — «شركة» لا تحوّل متجراً إلى بروشور', async () => {
    for (const goal of [
        'متجر إلكتروني لشركة ملابس',
        'نظام حجز مواعيد لعيادة أسنان',
        'منصة إدارة موظفي شركة',
        'لوحة تحكم مبيعات لمؤسسة تجارية',
        'أداة حساب قروض لشركة تمويل',
    ]) assert.equal(await kindOf(goal), 'webapp', goal);
});

test('🧭 ولفظُ المنتج ينقض فعلاً — «تعريفي» و«بروشور» تبقيان حاسمتين', async () => {
    for (const goal of [
        'موقع تعريفي لشركة محاماة',
        'موقع بروشور لعيادة',
        'صفحة هبوط بسيطة لمنتج',
        'a simple brochure for our store',
    ]) assert.equal(await kindOf(goal), 'brochure', goal);
});

test('🧭 حدودُ الكلمات: `app` لا تُلتقط من داخل «happy» ولا «apple»', async () => {
    assert.equal(await kindOf('a happy landing page'), 'brochure');
    assert.equal(await kindOf('apple orchard site'), 'brochure');
    assert.equal(await kindOf('a map of our offices'), 'brochure', '«map» وحدها ليست تطبيقاً');
    assert.equal(await kindOf('flight booking app'), 'webapp', 'والكلمة القائمة بذاتها تُلتقط');
});

test('🧭 السوابق العربية اللاصقة تُلتقط — «للمتجر» و«بالتطبيق»', async () => {
    assert.equal(await kindOf('واجهة للمتجر'), 'webapp');
    assert.equal(await kindOf('شاشة بالتطبيق'), 'webapp');
});

test('🧭 ما لا إشارة فيه يبقى بروشوراً — لا تصنيفَ متفائلاً', async () => {
    for (const goal of ['موقع شخصي لعرض أعمالي', 'صفحة عن فريقنا']) {
        assert.equal(await kindOf(goal), 'brochure', goal);
    }
});

test('🧭 والتصنيف يُترجَم أثراً: التطبيق يأخذ مكوّناً تفاعلياً والبروشور لا', async () => {
    const app = await generateBlueprint('متجر إلكتروني لشركة ملابس');
    const bro = await generateBlueprint('موقع تعريفي لشركة محاماة');
    assert.equal(app.functionalComponents.length, 1, 'التطبيق يحمل ميزةً تفاعلية واحدة على الأقل');
    assert.equal(bro.functionalComponents.length, 0, 'والبروشور لا يدّعي تفاعلاً');
});

test('🔴 المرجع: الصيغة القديمة تُخطئ فيما تُصيبه الجديدة', () => {
    const oldApp = /تطبيق|اب |app|application|منصة|platform|نظام|system|أداة|tool|حاسبة|calculator|محول|converter|لوحة تحكم|dashboard|بحث|search|حجز طيران|طيران|flight|رحلات|booking|متجر|store|shop|سلة|cart|to.?do|قائمة مهام|chat|محادثة|خريطة|map|لعبة|game|تتبع|tracker/;
    const oldBro = /تعريفي|بروشور|brochure|صفحة هبوط بسيطة|شركة|مؤسسة|عيادة|مطعم تعريفي/;
    const oldKind = (g) => oldApp.test(g.toLowerCase()) && !oldBro.test(g.toLowerCase()) ? 'webapp' : 'brochure';
    assert.equal(oldKind('متجر إلكتروني لشركة ملابس'), 'brochure', 'لو لم تُخطئ لَما كان في الإصلاح ما يُختبَر');
    assert.equal(oldKind('a happy landing page'), 'webapp', 'و«happy» كانت تطبيقاً');
});
