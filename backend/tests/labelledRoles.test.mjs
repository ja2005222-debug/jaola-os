// 👥 «أدوارُك كما كتبتَها» — رفعُ حدِّ PM/23 من جهته الصحيحة (PM/25).
//
// PM/23 كتبت حدّاً: «العناوينُ تسمّي كياناتٍ لا أدواراً، فالأدوارُ تسقط ولا تُختلق». وهو صوابٌ
// في موضعه — لكنّه تُرك حدّاً ولم يُسأل بعده سؤالُ PM/23 نفسِها: **أين يكتب صاحبُ المشروع أدوارَه؟**
//
// القياسُ على مواصفةِ نقاط البيع الحقيقيّة (`fixtures/pos_spec.txt`):
//   • ما كتبه صاحبُها : أدوار: مالك النظام، مدير الفرع، الكاشير، أمين المخزن، المحاسب.
//   • ما كان يصل     : staff، customer، admin، tenant  ← أربعةٌ من معجمٍ **مغلقٍ إنجليزيّ**
// وليست تسميةً أجمل فحسب: `role-coverage` تقع بأربعةٍ، فتفحص الصفحةَ بحثاً عن «tenant»
// و«staff» — ألفاظٍ لم يكتبها صاحبُ المشروع قطّ. فالحكمُ يقيس اسماً لم يُطلَب.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { labelledRoleNames, deriveProjectModel } from '../agents/projectModel.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POS = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const NO_LLM = { chat: async () => { throw new Error('لا مزوّد'); } };

test('🔴 المواصفةُ الحقيقيّة: الأدوارُ الخمسةُ تُقرأ من سطرها بنصِّها', () => {
    assert.deepEqual(labelledRoleNames(POS),
        ['مالك النظام', 'مدير الفرع', 'الكاشير', 'أمين المخزن', 'المحاسب'],
        'إمّا لم يُقرأ السطرُ المعنون، أو قُسّم على الفاصل الخطأ');
});

test('🔴 وتصل البُناةَ فعلاً بدل معجمِنا المغلق — والفرقُ هو العطب', async () => {
    const m = await deriveProjectModel(POS, {}, NO_LLM);
    const names = (m.roles || []).map((r) => r.name);
    for (const mine of ['staff', 'customer', 'admin', 'tenant']) {
        assert.ok(!names.includes(mine), `لفظُ معجمِنا «${mine}» ما يزال يصل بدل ما كتبه صاحبُه`);
    }
    assert.deepEqual(names, ['مالك النظام', 'مدير الفرع', 'الكاشير', 'أمين المخزن']);
});

test('📏 وسقفُ الأربعة قائمٌ سلفاً لا أُخفيه: «المحاسب» يسقط بالسقف لا بالقاعدة', async () => {
    assert.equal(labelledRoleNames(POS).length, 5, 'القاعدةُ تقرأ خمسة');
    const m = await deriveProjectModel(POS, {}, NO_LLM);
    assert.equal((m.roles || []).length, 4, '`normalizeProjectModel` يقصّ عند أربعة — قرارٌ قائمٌ لم يُرفع هنا');
});

test('لا تختلق: طلبٌ بلا سطرِ أدوارٍ يعود فارغاً — يُقال ولا يُخترع', () => {
    assert.deepEqual(labelledRoleNames('1. الورد اليوميّ\nيحدّد الحافظ سورةً ويسجّل ما حفظ.'), [],
        'فعلٌ في المتن ليس تسميةَ دور');
    assert.deepEqual(labelledRoleNames(''), []);
    assert.deepEqual(labelledRoleNames(null), []);
    assert.deepEqual(labelledRoleNames('نصٌّ بلا نقطتَين ولا عنوان'), []);
});

test('صيغُ السطر: بشرطةٍ أو بنقطةٍ أو بلا شيء، معرَّفاً أو منكَّراً، وبالإنجليزيّة', () => {
    const cases = [
        ['- أدوار: بائع، مشرف', ['بائع', 'مشرف']],
        ['الأدوار: بائع، مشرف', ['بائع', 'مشرف']],
        ['  • ادوار : بائع، مشرف  ', ['بائع', 'مشرف']],
        ['Roles: Seller, Admin', ['Seller', 'Admin']],
        ['actors: Seller / Admin', ['Seller', 'Admin']],
        ['المستخدمون: بائع؛ مشرف', ['بائع', 'مشرف']],
    ];
    for (const [line, want] of cases) assert.deepEqual(labelledRoleNames(line), want, line);
});

test('⚠️ فخُّ `\\b`: الحروفُ العربيّة ليست `\\w` — لو استُعمل لما طابق السطرُ أبداً', () => {
    assert.equal(/أدوار\b/u.test('أدوار: بائع'), false, 'هذا هو الفخُّ نفسُه، مثبَّتاً لئلّا يُعاد');
    assert.deepEqual(labelledRoleNames('أدوار: بائع، مشرف'), ['بائع', 'مشرف'], 'والقاعدةُ تطابق لأنّها لا تستعمله');
});

test('المِرساةُ حاملة: «أدوار:» داخلَ جملةٍ نثريّة ليست قائمةَ أدوار', () => {
    // بلا مِرساةِ رأسِ السطر يصير النفيُ إثباتاً: «لا نستعمل الأدوار: النظامُ بمستخدمٍ واحد»
    // تُقرأ أنّ «النظام بمستخدم واحد» اسمُ دور. السطرُ يكون قائمةً أو لا يكون.
    assert.deepEqual(labelledRoleNames('ملاحظة: لا نستعمل الأدوار: النظام بمستخدم واحد'), []);
    assert.deepEqual(labelledRoleNames('كل دور له شاشاته وصلاحياته'), []);
});

test('📏 حدٌّ مكتوب: العنوانُ المركَّب لا يُلتقط — قرارٌ لا سهو', () => {
    // «الصلاحيات والأدوار: بائع، مشرف» في سطرٍ واحد **لا يُقرأ**: رأسُ السطر «الصلاحيات».
    // والمواصفةُ المقيسة تفصلهما (عنوانُ القسم ثمّ سطرُ «أدوار:»)، فلم يُقَس كسرُ هذا —
    // ولا يُصلَح ما لم يُقَس كسرُه. مثبَّتٌ هنا كي يكون توسيعُه قراراً برهانِه لا انزلاقاً.
    assert.deepEqual(labelledRoleNames('الصلاحيات والأدوار: بائع، مشرف'), []);
});

test('ما ليس اسمَ دورٍ يسقط: الجملةُ الوصفيّة الطويلة والفراغُ والمكرَّر', () => {
    assert.deepEqual(
        labelledRoleNames('أدوار: بائع، ، بائع، مشرفٌ عامٌّ على كلِّ الفروع والمخازن والحسابات، مدير'),
        ['بائع', 'مدير'],
        'الفارغُ يسقط، والمكرَّرُ مرّةً واحدة، والجملةُ الطويلة وصفٌ لا اسم',
    );
});

test('لا يلتقط سطراً ليس سطرَ أدوار — ولا يخلط قسمَ الصلاحيّات بقائمة الأدوار', () => {
    assert.deepEqual(labelledRoleNames('الصلاحيات والأدوار (RBAC):\nنصٌّ تحته'), [],
        'العنوانُ يذكر «الأدوار» لكنّه ليس قائمةً — لا قيمةَ بعد النقطتَين');
    assert.deepEqual(labelledRoleNames('طرق الدفع: نقدي، بطاقة'), [], 'سطرٌ آخرُ بقائمة ليس أدواراً');
});

test('السقفُ يحدّ ولا يرمي: أكثرُ من ستّةٍ تُقصّ عند ستّ', () => {
    const many = 'أدوار: أ١، أ٢، أ٣، أ٤، أ٥، أ٦، أ٧، أ٨';
    assert.equal(labelledRoleNames(many).length, 6);
    assert.equal(labelledRoleNames(many, { max: 2 }).length, 2);
});
