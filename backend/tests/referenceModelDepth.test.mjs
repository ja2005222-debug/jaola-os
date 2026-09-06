// 🧩 PM/4 — «مرجعٌ → نموذجٌ أغنى» (`PRODUCT_MIND.md`): المرجعُ يعرف خمسَ صفحاتٍ وأربعةَ مكوّناتٍ لنظام
// التاكسي، وكان الفهمُ يأخذ أدوارَه فقط فيخرج بلا «رحلة» ولا «مركبة» — فتمرّ صفحةٌ تذكر الأدوارَ
// وحدَها من بوّابة صدق المجال (PM/3) بتغطيةٍ كاملة. وبلا مزوّدٍ يخرج المخطّطُ بمكوّنٍ عامٍّ واحد
// اسمُه «الميزة الأساسية التفاعلية»، وهي كلُّ ما يتحقّق منه محقّقُ المتطلّبات. هنا يُقفل البابان.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { matchBlueprint, referenceModel, referenceEntities, referenceFlows } from '../agents/referenceBlueprints.js';
import { conceptKind, domainFidelity, normalizeProjectModel } from '../agents/projectModel.js';
import { composeRequirements, verifyRequirements } from '../agents/requirementsVerifier.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const TAXI = () => normalizeProjectModel(referenceModel(matchBlueprint('نظام إدارة وتشغيل تاكسي')));

test('المعجمُ يعرف نوعَ مفهومه: الدورُ دورٌ والكيانُ كيان، وما ليس فيه بلا نوع', () => {
    assert.equal(conceptKind('driver'), 'role');
    assert.equal(conceptKind('passenger'), 'role');
    assert.equal(conceptKind('trip'), 'entity');
    assert.equal(conceptKind('vehicle'), 'entity');
    assert.equal(conceptKind('zzz'), null);
    assert.equal(conceptKind(null), null);
});

test('اشتقاقُ الكيانات من نصّ المرجع: كيانٌ لا دور، مرتّبٌ بالأكثر ذكراً، وبلا صفحاتٍ لا اشتقاق', () => {
    const bp = matchBlueprint('نظام تاكسي');
    const ents = referenceEntities(bp).map(e => e.name);
    assert.ok(ents.includes('trip') && ents.includes('vehicle'), ents.join(','));
    assert.ok(!ents.some(n => conceptKind(n) === 'role'), 'الأدوارُ لها حقلُها — لا تُحشر في الكيانات');
    assert.ok(ents.indexOf('trip') < ents.indexOf('account'), 'الأرسخُ ذكراً أوّلاً: «رحلة» قبل «حساب»');
    assert.deepEqual(referenceEntities({ pages: [], components: [] }), []);
    assert.deepEqual(referenceEntities(null), []);
    // «عرض» و«show» مشتركتان لفظاً فكانتا تجعلان كلَّ مرجعٍ مرجعَ أفلام
    assert.ok(!ents.includes('film'), 'عرضُ القيمة ليس فيلماً');
});

test('اشتقاقُ التدفّقات: ما فيه سهمٌ تدفّقٌ بخطواته، وما سواه مكوّنٌ لا تدفّق', () => {
    const flows = referenceFlows(matchBlueprint('نظام تاكسي'));
    assert.equal(flows.length, 1, JSON.stringify(flows.map(f => f.name)));
    assert.equal(flows[0].name, 'تدفّق حالة الرحلة');
    assert.deepEqual(flows[0].steps, ['طلب', 'قبول', 'في الطريق', 'وصل']);
    assert.deepEqual(referenceFlows({ components: ['حاسبة أجرة تعمل فعلاً'] }), [], 'بلا سهمٍ لا تدفّق');
    assert.deepEqual(referenceFlows({ components: ['بلا عنوان: خطوةٌ واحدة →'] }), [], 'خطوةٌ واحدة ليست انتقالاً');
    assert.deepEqual(referenceFlows(null), []);
});

test('الأثرُ على بوّابة صدق المجال (PM/3): صفحةٌ تذكر الأدوارَ وحدَها كانت تمرّ بتغطيةٍ كاملة، والآن نقصُها مسمّى', () => {
    const m = TAXI();
    const rolesOnly = '<h1>تاكسي</h1><div>الراكب</div><div>السائق</div><div>الإدارة</div>';
    const gap = domainFidelity(m, rolesOnly);
    assert.ok(gap.missing.includes('trip') && gap.missing.includes('vehicle'), gap.missing.join(','));
    assert.equal(gap.contaminated, false, 'نقصٌ لا تلوّث — الأدوارُ صحيحة');
    const full = domainFidelity(m, rolesOnly + '<div>رحلة</div><div>مركبة</div><div>حجز</div><div>طلب</div><div>دفع</div><div>حساب</div>');
    assert.deepEqual(full.missing, [], 'وما اكتمل لا يُلام');
});

test('المتطلّباتُ من الفهم: المكوّنُ العامُّ الواحد يصير شاشةً لكلِّ دورٍ وبياناتٍ لكلِّ كيانٍ وتدفّقاً، بلا إزاحةٍ ولا تكرار', () => {
    const m = TAXI();
    const bp = { functionalComponents: [{ name: 'الميزة الأساسية التفاعلية', behavior: 'تعمل' }] };
    const names = composeRequirements(bp, m).map(c => c.name);
    assert.equal(names[0], 'الميزة الأساسية التفاعلية', 'ما في المخطّط أوّلاً — لا يُزاح');
    assert.ok(names.includes('شاشة Passenger') && names.includes('شاشة Driver') && names.includes('شاشة Admin'));
    assert.ok(names.includes('بيانات trip') && names.includes('بيانات vehicle'));
    assert.ok(names.includes('تدفّق حالة الرحلة'), 'بلا تكرار كلمة «تدفّق»');
    assert.ok(names.length > 1, `كانت واحدة، صارت ${names.length}`);
    assert.deepEqual(composeRequirements(bp, null).map(c => c.name), ['الميزة الأساسية التفاعلية'], 'بلا فهمٍ: كما كان تماماً');
    // لا تكرار: مكوّنٌ يحمل اسمَ شاشةِ دورٍ لا يُضاف مرّتين
    const dup = composeRequirements({ functionalComponents: [{ name: 'شاشة Driver' }] }, m).filter(c => c.name === 'شاشة Driver');
    assert.equal(dup.length, 1);
    assert.deepEqual(composeRequirements(null, null), []);
    assert.ok(composeRequirements(bp, m).every(c => c.name), 'بلا عناصرَ مجهولةِ الاسم');
});

test('المحقّقُ يسأل عمّا فُهم: قائمةُ المتطلّبات التي تصل المدقّقَ تحمل شاشاتِ الأدوار وبياناتِ الكيانات لا المكوّنَ العامَّ وحدَه', async () => {
    const m = TAXI();
    const bp = { functionalComponents: [{ name: 'الميزة الأساسية التفاعلية', behavior: 'تعمل' }] };
    const files = [{ name: 'index.html', content: '<h1>تاكسي</h1>' }, { name: 'script.js', content: 'const trips=[];' }];
    let asked = '';
    const llm = async (msgs) => { asked = msgs.map(x => x.content).join('\n'); return JSON.stringify({ results: [{ name: 'شاشة Driver', implemented: false, reason: 'لا قسمَ للسائق' }] }); };
    const v = await verifyRequirements(bp, files, llm, m);
    assert.match(asked, /شاشة Driver/, 'الدورُ المفهوم صار متطلّباً مسؤولاً عنه');
    assert.match(asked, /بيانات trip/, 'والكيانُ كذلك');
    assert.match(asked, /الميزة الأساسية التفاعلية/, 'وما في المخطّط باقٍ');
    assert.equal(v.missing.length, 1);
    // وبلا فهمٍ: السؤالُ كما كان — مكوّنُ المخطّط وحدَه
    await verifyRequirements(bp, files, llm, null);
    assert.doesNotMatch(asked, /شاشة Driver/);
});

test('الحدود: الاشتقاقُ بالمعجم لا بقائمةٍ ثالثة، والبوّابةُ تسأل عن المتطلّبات لا عن مكوّنات المخطّط', () => {
    const ref = fs.readFileSync(path.join(HERE, '../agents/referenceBlueprints.js'), 'utf8');
    assert.ok(ref.includes("import { conceptsInText, conceptKind } from './projectModel.js';"), 'معجمٌ واحد');
    const stage = fs.readFileSync(path.join(HERE, '../agents/stages/requirementsVerify.js'), 'utf8');
    assert.ok(stage.includes('composeRequirements(context.blueprint, domainModel).length'), 'الشرطُ على المتطلّبات');
    assert.ok(!/if \(context\.blueprint\?\.functionalComponents\?\.length/.test(stage), 'لا شرطَ على المكوّنات وحدَها');
    assert.equal((stage.match(/verify\(context\.blueprint, plan\.files, undefined, domainModel\)/g) || []).length, 2,
        'النداءان (الأوّل وجولةُ الإكمال) يمرّان بالفهم');
});
