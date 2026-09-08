// 📐 قياسٌ لا إصلاح — بوّابةُ الفهم (`goalFidelity.ungrounded`) على بياناتٍ حقيقيّة.
//
// الدافعُ سجلٌّ حيٌّ لصاحب المشروع: طلبَ «SaaS متكامل لإدارة المشاريع» فخرج فهمٌ يسمّي
// `Customer/Company/Interaction/Desk/MeetingRoom/SalesRep` — منتجَ CRM وحجزِ مكاتب — ومرَّ
// بلا وقوعِ البوّابة، ثمّ وُصمت البناءُ بـ`role-coverage` لدورٍ لم يُطلَب قطّ.
//
// الفرضيّةُ التي دخلتُ بها: «العتبةُ `supported.length === 0` كلُّها-أو-لا-شيء، فلتصر **نسبة**».
// وهذه الملفُّ يسجّل أنّ القياسَ **أسقط الفرضيّة**، ويسجّل لماذا، كي لا تُبنى مرّةً أخرى بلا دليل:
//
//   ١) النطاقان متداخلان. الفهمُ **الصادق** قِيس عند ٠٪ و١٧٪ و٣٣٪، والفهمُ **المهلوَس** عند
//      ٠٪ و١٣٪. فأيُّ عتبةِ نسبةٍ تُوقع المهلوَسَ (١٣٪) تُوقع معه الصادقَ (٠٪ و١٧٪).
//
//   ٢) والعلّةُ تحت ذلك: نصفُ أسماء أيِّ نموذجٍ **خارجَ المعجم أصلاً** (`Company`, `Interaction`,
//      `MeetingRoom`, `SalesRep` — وكذلك `Post`, `Comment`, `Tag`, `Author`, `Category`, `Reader`
//      في مدوّنةٍ صادقة). فما كان خارجَه لا يُسنَد بجسر المعجم ولا يُعرَف غريباً؛ لا يبقى إلّا
//      جسرُ اللفظ، وهو يعبر أو لا يعبر بحسب ما إذا كان صاحبُ الطلب كتب بالعربيّة اسماً
//      إنجليزيّاً. فالمقياسُ يقيس **تغطيةَ المعجم** أكثرَ ممّا يقيس **صدقَ الفهم**.
//
//   ٣) وجُرّب محورُ دليلٍ ثانٍ — اتّفاقُ `modelProjectType(الفهم)` مع نوعِ الطلب — فسقط أيضاً:
//      احتياطُ **المطعم** المنسَّقُ بيد إنسان يُعطي `modelProjectType = 'ecommerce'` (لأنّ
//      `Order`+`Customer` يطابقان توقيعَ المتجر)، فلو صار الاختلافُ إدانةً لوُصم بناءٌ صادق.
//
// وقِيست في الطريق **علّةٌ ثانية معاكسة**: البوّابةُ تقع اليومَ على فهمٍ صادق — «متجر إلكتروني
// لبيع الملابس» باحتياطِ الفئة المنسَّق يخرج ٠/٤ فيُقال لصاحبه «فهمي لا يمسّ طلبَك». مسجَّلةٌ
// أدناه ولم تُصلَح في هذه الجولة: تهدئةُ بوّابةٍ فعلٌ خطِرٌ لا يُقدَم عليه بمحورِ دليلٍ ساقط.
//
// فلا شيءَ في هذه الجولة أُصلح؛ وهذه أرقامُها مثبَّتةً كي يبدأ من يأتي من قياسٍ لا من ظنّ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalFidelity, deriveProjectModel, modelProjectType, conceptOf, conceptKind } from '../agents/projectModel.js';

const BP = (category) => ({ kind: 'webapp', category, functionalComponents: [{ name: 'الميزة الأساسية التفاعلية' }], _source: 'fallback' });
const names = (l) => (l || []).map((x) => x.name);
const pct = (f) => (f.names.length ? Math.round((f.supported.length / f.names.length) * 100) : 0);

// نصُّ صاحب المشروع كما كتبه في السجلّ الحيّ (مختصَرٌ إلى بنوده الحاملة للمعنى)
const SAAS_GOAL = `ابني منتج SaaS متكامل لإدارة المشاريع:
- واجهة React مع لوحة Kanban (سحب وإفلات)
- خادم Node.js/Express مع REST API كامل
- قاعدة بيانات MongoDB (مستخدمين، مشاريع، مهام، تعليقات)
- مصادقة JWT مع أدوار (owner, editor, viewer)
- WebSocket للتحديثات الفورية
- لوحة تحكم إدارية منفصلة
- صفحات: هبوط، تسجيل، مشاريع، تفاصيل المهمة، إعدادات
- تقارير وتحليلات للمسؤول

أنشئ جميع الملفات مع Docker وdocker-compose وREADME.`;

// الفهمُ الذي خرج فعلاً في ذلك السجلّ
const SAAS_LIVE = {
    entities: [{ name: 'Customer' }, { name: 'Company' }, { name: 'Interaction' },
        { name: 'Desk' }, { name: 'MeetingRoom' }, { name: 'Item' }],
    roles: [{ name: 'SalesRep' }, { name: 'Customer' }, { name: 'User' }, { name: 'Admin' }],
};

test('🔴 السجلُّ الحيّ: سبعةٌ من ثمانيةٍ بلا أثرٍ في الطلب — والبوّابةُ صامتة', () => {
    const f = goalFidelity(SAAS_LIVE, SAAS_GOAL);
    assert.deepEqual(f.groundless,
        ['Customer', 'Company', 'Interaction', 'Desk', 'MeetingRoom', 'SalesRep', 'Customer']);
    assert.deepEqual(f.supported, ['Admin'], 'ساندٌ واحدٌ يكفي لإسكاتها');
    assert.equal(pct(f), 13);
    assert.equal(f.ungrounded, false, 'هذا هو العطبُ المقيس: فهمُ منتجٍ آخرَ يمرّ');
});

test('🟢 و«Admin» سندُه صادقٌ لا مصادفة — صاحبُ الطلب كتب `owner` بنفسه', () => {
    // مرادفُ `admin` في المعجم يشمل `owner`، وقد كتبها صاحبُه في «أدوار (owner, editor, viewer)».
    // فليس الحلُّ إخراجَ `Admin` من الأدلّة: هو دليلٌ صحيح، لكنّه دليلٌ **واحد** من ثمانية.
    assert.equal(conceptOf('Admin'), 'admin');
    assert.ok(SAAS_GOAL.includes('owner'));
    assert.equal(goalFidelity({ entities: [], roles: [{ name: 'Admin' }, { name: 'Customer' }] }, SAAS_GOAL).supported.length, 1);
});

test('🔴 لماذا لا تصلح عتبةُ النسبة: النطاقان متداخلان — صادقٌ عند ٠٪ و١٧٪، ومهلوَسٌ عند ١٣٪', () => {
    const honestClinic = goalFidelity(
        { entities: [{ name: 'Appointment' }, { name: 'Patient' }, { name: 'Prescription' }, { name: 'Invoice' }],
            roles: [{ name: 'Doctor' }, { name: 'Receptionist' }] },
        'موقع عيادة أسنان مع حجز مواعيد');
    const honestBlog = goalFidelity(
        { entities: [{ name: 'Post' }, { name: 'Comment' }, { name: 'Category' }, { name: 'Tag' }],
            roles: [{ name: 'Author' }, { name: 'Reader' }] },
        'مدونة شخصية');
    const hallucinated = goalFidelity(SAAS_LIVE, SAAS_GOAL);
    assert.equal(pct(honestClinic), 17);
    assert.equal(pct(honestBlog), 0);
    assert.equal(pct(hallucinated), 13);
    // العتبةُ التي تُوقع ١٣٪ تُوقع ٠٪ و١٧٪ معها — والأخيران فهمان صادقان.
    assert.ok(pct(honestBlog) < pct(hallucinated) && pct(hallucinated) < pct(honestClinic),
        'المهلوَسُ **محشورٌ بين** صادقَين — فلا عتبةَ تفصل');
});

test('🔎 العلّةُ تحت ذلك: نصفُ أسماء النماذج خارجَ المعجم، فلا تُسنَد ولا تُعرَف غريبة', () => {
    const outside = ['Company', 'Interaction', 'MeetingRoom', 'SalesRep', 'Post', 'Comment', 'Category', 'Tag', 'Author', 'Reader'];
    for (const n of outside) assert.equal(conceptKind(conceptOf(n)), null, `${n} صار معروفاً — يُعاد القياس`);
    // وما بداخله يُعرف — فالمعجمُ ليس فارغاً، بل **جزئيّ**، وهذا بيتُ الداء
    for (const n of ['Customer', 'Product', 'Doctor', 'Patient', 'Admin']) assert.ok(conceptKind(conceptOf(n)));
});

test('🔴 المحورُ البديل (اتّفاقُ النوعَين) ساقطٌ أيضاً: احتياطُ المطعم الصادق نوعُه `ecommerce`', async () => {
    const rest = await deriveProjectModel('تطبيق مطعم لعرض القائمة واستقبال الطلبات', BP('restaurant'));
    assert.deepEqual([...names(rest.entities), ...names(rest.roles)], ['Order', 'MenuItem', 'Customer', 'RestaurantOwner']);
    assert.equal(modelProjectType(rest), 'ecommerce',
        '`Order`+`Customer` يطابقان توقيعَ المتجر — فاختلافُ النوعَين لا يدلّ على هلوسة');
});

test('🔴 والعلّةُ المعاكسة مقيسةٌ على المسار الحيّ: احتياطُ متجرٍ صادق يُوصَم اليوم', async () => {
    const shop = await deriveProjectModel('متجر إلكتروني لبيع الملابس', BP('ecommerce'));
    const f = goalFidelity(shop, 'متجر إلكتروني لبيع الملابس');
    assert.equal(shop._source, 'fallback', 'جدولٌ منسَّقٌ بيد إنسان لا تخمينُ نموذجٍ لغويّ');
    assert.deepEqual(f.groundless, ['Product', 'Order', 'Customer', 'Seller']);
    assert.equal(f.ungrounded, true, 'يُقال لصاحبه «فهمي لا يمسّ طلبَك» عن فهمٍ صحيح');
});
