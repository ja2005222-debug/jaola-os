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
import { keywordMatches } from '../agents/knowledgeEngine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

// 🔇 `knowledgeEngine` وحدةٌ طابعة — والفخُّ مسجَّلٌ في `CLAUDE.md`: استيرادُها في ملفّ
//    اختبارٍ يفسد قناةَ تقرير `node --test` بطباعةٍ غير لاتينيّة. وحارسُه أوقعني الآن.
divertConsoleToStderr();

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

// ─── #١٩٧: حرفٌ غيرُ منطوقٍ قلب المنتجَ كلَّه ────────────────────────────
//
// سجلٌّ حيّ (٢٠٢٦-٠٩-٠٩، ١١:٥٢): كتب صاحبُ المشروع «أبغى **منصّة** لجمعية خيرية»
// — مشكولةً كما يكتب. والمعجمُ يخزّن «منصة» غُفلاً، والشدّةُ (`\u0651`) تقع **داخلَ**
// الكلمة فتكسر المطابقةَ الحرفيّة. فلم يجد `staticKind` في الطلب ولا لفظَ تطبيقٍ
// واحداً، فحكم «موقع تعريفي» — فرُكّبت لمنصّةِ إدارةٍ صفحةُ تسويقٍ من عشرة بلوكات
// (`pricing`, `testimonials`, `logos`)، ثمّ خلت من المكوّنات الوظيفيّة فصمتت بوّابةُ
// المتطلّبات، فأُعلن **PASS**. سلسلةٌ كاملةٌ من حرفٍ واحد.
//
// والمفارقةُ المقيسة: **التنوينُ كان يعمل** («نظامٌ» ✅) لأنّه يقع بعد الكلمة وهو
// `\p{Mn}` فلا يكسر النظرةَ اللاحقة؛ والشدّةُ بداخلها فتكسر الحرفيّة. فالعطبُ لم
// يكن يظهر إلّا لمن يشكّل كتابتَه.

test('🔴 #١٩٧ «منصّة» بالشدّة تُقرأ تطبيقاً كما تُقرأ «منصة» غُفلاً', async () => {
    const shadda = await generateBlueprint('أبغى منصّة لجمعية خيرية. المطلوب: تسجيل الحملات وملف متبرع ولوحة إحصاءات');
    const plain  = await generateBlueprint('أبغى منصة لجمعية خيرية. المطلوب: تسجيل الحملات وملف متبرع ولوحة إحصاءات');
    assert.equal(shadda.kind, plain.kind, 'الشدّةُ غيّرت نوعَ المنتج — وهي حرفٌ لا يُنطق');
    assert.notEqual(shadda.kind, 'brochure', 'منصّةُ إدارةٍ صارت موقعاً تعريفيّاً');
    assert.ok(shadda.functionalComponents.length,
        'بروشورٌ ⇒ صفرُ مكوّناتٍ ⇒ لا متطلّباتٍ تُفحَص ⇒ بوّابةٌ صامتة ⇒ PASS كاذب');
});

test('🔴 #١٩٧ ولا يُقبل كلُّ شيء: «موقع تعريفي» يبقى بروشوراً ولو شُكِّل', async () => {
    for (const g of ['أبغى موقعاً تعريفيّاً لجمعيّتنا', 'أبغى موقع تعريفي لجمعيتنا']) {
        assert.equal((await generateBlueprint(g)).kind, 'brochure', `أُسكت التمييزُ على «${g}»`);
    }
});

// 🧬 طفرةٌ نجت: إسقاطُ التشكيل من **المفتاح** لم يقتله اختبار — لأنّ كلَّ مفاتيح
//    المعاجم اليومَ غيرُ مشكولة. وهي ليست تخميناً كـ«مدخلٍ زائدٍ في قائمة»، بل
//    **تماثلٌ في المُطابِق**: مُطابِقٌ يُطبّع طرفاً ولا يُطبّع الآخر خطأٌ كامنٌ لا
//    يظهر حتّى يكتب أحدُهم مفتاحاً مشكولاً في معجمٍ يدويٍّ عربيّ — وهي معاجمُ كبيرة.
//    فيُثبَّت الضمانُ باختبارٍ بدل أن يبقى رجاءً.
test('🔴 #١٩٧ التطبيعُ من الطرفَين: مفتاحٌ مشكولٌ يطابق طلباً غُفلاً، والعكس', () => {
    assert.ok(keywordMatches('ابغى منصة لجمعيتنا', 'منصّة'), 'مفتاحٌ مشكولٌ لا يطابق طلباً غُفلاً');
    assert.ok(keywordMatches('ابغى منصّة لجمعيتنا', 'منصة'), 'طلبٌ مشكولٌ لا يطابق مفتاحاً غُفلاً');
    assert.ok(keywordMatches('ابغى منصّة لجمعيتنا', 'منصّة'), 'المشكولان لا يتطابقان');
    // ولا يُقبل ما ليس فيه: التطبيعُ لا يُذيب حدودَ الكلمات
    assert.ok(!keywordMatches('ابغى تطبيقاً طبيّاً', 'منصة'), 'صار المُطابِقُ يقبل كلَّ شيء');
});
