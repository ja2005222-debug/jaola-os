// 📋 PM/12 — «حكمُ الحلقة بلغة الوثيقة أيضاً»: مسارُ الكلون يقول للمستخدم أيَّ بنودِ وثيقته بلا أثر (PM/9)،
// وحلقةُ التسليم — التي تبني كلَّ وثيقةٍ لا كلونَ لمجالها — تقول «المحقّقُ لم يُجب» ولا تذكر بنودَه إطلاقاً.
// مقيسٌ على وثيقة مكتبةٍ واقعيّة (١٢٣٠ حرفاً، ١٢ بنداً، `isFullSpecification` صحيح): الحكمُ `unverified`
// بينما الأثرُ الحتميّ على الملفّات المكتوبة نفسِها **٥/١٢**. والعنوانُ في وثيقةٍ تضع تفصيلَها بعد النقطتين
// يبلغ ١١١ حرفاً، فستّةُ عناوينَ سطرٌ من ٦٧٠ حرفاً في الشات — فالوسمُ اسمُ البند لا جملتُه.
process.env.MISSION_LEDGER_PATH = `${process.env.TMPDIR || '/tmp'}/jaola-loop-doc-${process.pid}.json`;
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { setDomainModel } = await import('../agents/projectMemory.js');
const { resetProjectState } = await import('../agents/stateMachine.js');
const { sectionLabel, traceSections } = await import('../agents/requirementsVerifier.js');
const { specSections } = await import('../agents/textNormalizer.js');
const { runRequirementsVerify } = await import('../agents/stages/requirementsVerify.js');
const { RoomReporter } = await import('../core/runtime/RoomReporter.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();

const LIB_SPEC = `أريد بناء نظام إدارة مكتبة عامة متكامل وقابل للاستخدام الفعلي، وليس مجرد واجهة شكلية.

1. الأعضاء: تسجيل عضو جديد بالاسم ورقم الهوية والهاتف، وإصدار بطاقة عضوية برقم فريد، وتجديد العضوية وإيقافها.
2. الكتب: فهرس كامل بالعنوان والمؤلف ودار النشر وسنة النشر والتصنيف ورقم ISBN وعدد النسخ ومكان الرف.
3. الإعارة: إعارة نسخة لعضو بتاريخ استحقاق محسوب من مدة الإعارة، ومنع الإعارة إذا تجاوز العضو حده أو عليه غرامة.
4. الإرجاع: تسجيل الإرجاع وحساب غرامة التأخير آلياً بقيمة يومية، وتحرير النسخة للحجوزات المنتظرة.
5. الحجز: حجز كتاب معار حالياً، وطابور انتظار بالأولوية، وإشعار العضو عند توفر النسخة.
6. البحث: بحث موحد سريع في الكتب والأعضاء والإعارات، بفلاتر التصنيف والمؤلف والتوفر.
7. التقارير: أكثر الكتب إعارة، الأعضاء المتأخرون، حركة الإعارة الشهرية، ورسوم بيانية، وتصدير Excel.
8. الصلاحيات والأدوار: أمين المكتبة والمدير والعضو، لكل دور شاشاته وصلاحياته الدقيقة على كل عملية.
9. الإعدادات: مدة الإعارة، الحد الأقصى للنسخ لكل عضو، قيمة الغرامة اليومية، وأيام العطل.
10. الطباعة: طباعة بطاقة العضو وإيصال الإعارة وقائمة الجرد بالطابعة العادية.
11. قاعدة البيانات: جداول مترابطة للأعضاء والكتب والنسخ والإعارات والحجوزات والغرامات مع ترحيل.
12. الأمان: تشفير كلمات المرور، جلسات آمنة، وسجل تدقيق لكل عملية إعارة أو إرجاع أو حذف.`;

const HTML = `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>المكتبة</title><link rel="stylesheet" href="styles.css"></head>
<body><main><h1>نظام المكتبة</h1><ul id="list"></ul><input id="q" placeholder="ابحث"><button id="add">أضف كتاباً</button></main><script src="script.js"></script></body></html>`;
const JS = `const books=[{title:'كتاب',author:'مؤلف'}];const ul=document.getElementById('list');
function render(f=''){ul.innerHTML='';books.filter(b=>b.title.includes(f)).forEach(b=>{const li=document.createElement('li');li.textContent=b.title;ul.appendChild(li);});}
document.getElementById('q').addEventListener('input',e=>render(e.target.value));
document.getElementById('add').addEventListener('click',()=>{books.push({title:'جديد'});render();});render();`;
const PLAN_FILES = () => [{ name: 'index.html', content: HTML }, { name: 'styles.css', content: 'body{margin:0}' }, { name: 'script.js', content: JS }];

const gate = (v, name) => v.gates.find(g => g.name === name);

test('sectionLabel: اسمُ البند لا جملتُه — ما قبل النقطتين، مقصوصاً على حدّ كلمة؛ وعناوينُ مواصفة نقاط البيع (بلا نقطتين داخليّة) كما هي', () => {
    assert.equal(sectionLabel({ n: 1, title: 'الأعضاء: تسجيل عضو جديد بالاسم ورقم الهوية والهاتف، وإصدار بطاقة عضوية برقم فريد' }), '1 الأعضاء');
    assert.equal(sectionLabel({ n: 11, title: 'قاعدة البيانات: جداول مترابطة للأعضاء والكتب' }), '11 قاعدة البيانات');
    assert.equal(sectionLabel({ n: 1, title: 'الصلاحيات والأدوار (RBAC):' }), '1 الصلاحيات والأدوار (RBAC)');
    assert.equal(sectionLabel({ n: 3, title: 'الباركود' }), '3 الباركود');
    assert.equal(sectionLabel({ n: 7, title: 'المرتجعات — سياسةُ الإرجاع خلال أسبوع' }), '7 المرتجعات');
    // الشرطةُ فاصلٌ حين تحفّها مسافتان فقط — شرطةٌ داخل الاسم تبقى منه
    assert.equal(sectionLabel({ n: 3, title: 'الباركود QR-Code' }), '3 الباركود QR-Code');
    assert.equal(sectionLabel({ n: 5, title: 'الدفع متعدّد-الوسائط: نقد وبطاقة' }), '5 الدفع متعدّد-الوسائط');
    const long = sectionLabel({ n: 9, title: 'الإعدادات العامّة للنظام وضبطُ المدد والحدود والقيم الافتراضيّة لكلّ فرعٍ على حدة' });
    assert.ok(long.length <= 42, `${long.length}: ${long}`); assert.ok(long.endsWith('…'), long);
    assert.ok(specSections(LIB_SPEC).every(s => sectionLabel(s).length <= 42), 'كلُّ وسوم الوثيقة قصيرة');
});

test('حلقةُ التسليم بلا مزوّد على وثيقة: البوّابةُ تقول بنودَ الوثيقة بلا أثر — لا «المحقّقُ لم يُجب»', async () => {
    const s = scenario('pm12loop'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
    const agents = {
        getState: () => null,
        coreGenerateCodePlan: async () => ({ files: PLAN_FILES() }),
        architectReview: async () => ({ approved: true, feedback: '' }),
        qaVerify: async () => ({ passed: true, logs: [] }),
        needsBackend: () => false,
    };
    try {
        const dir = emptyProject();
        const r = await s.rt._runMissionNow(LIB_SPEC, createExecutionContext({ ...s.ctx, projectPath: dir, agents }));
        assert.equal(r.success, true);
        const g = gate(r.verdict, 'requirements-verify');
        assert.equal(g.status, 'fail', JSON.stringify(g));
        // التحقّق صار بعد backend/full-stack: يرى الآن آثار ما أضافته الطبقات
        // اللاحقة، ولا يصدر حكماً مبكراً على نسخة لم يكتمل بناؤها.
        assert.match(g.detail, /^2 بنداً من 12 في وثيقتك بلا أثر: /);
        assert.match(g.detail, /\(10\/12 له أثر — أثرٌ لا تنفيذ/);
        assert.doesNotMatch(g.detail, /المحقّقُ لم يُجب/);
        assert.ok(g.detail.length <= 300, `${g.detail.length}: ${g.detail}`);
        assert.match(s.replies().join('\n'), /requirements-verify: 2 بنداً من 12 في وثيقتك بلا أثر/);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('المحقّقُ حين يُجيب يبقى الحكم — وذيلُ الوثيقة يُضاف إخباراً (لا يُقلب pass إلى fail بغياب لفظيّ)', async () => {
    const s = scenario('pm12llm'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [{ name: 'كتاب' }], roles: [{ name: 'عضو' }, { name: 'أمين مكتبة' }], flows: [] });
    const ctx = { username: s.ctx.username, activeProject: s.ctx.activeProject, projectPath: emptyProject(),
        originalGoal: LIB_SPEC, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'فهرس' }] }, plan: { files: PLAN_FILES() }, verdicts: {} };
    const reporter = new RoomReporter(s.rt.io ?? { to: () => ({ emit: () => {} }) });
    try {
        await runRequirementsVerify(ctx, s.ctx.roomName, {}, reporter,
            { verify: async () => ({ results: [{ name: 'فهرس', implemented: true, reason: 'موجود' }], missing: [], implementedCount: 1 }) });
        const g = ctx.verdicts['requirements-verify'];
        assert.equal(g.status, 'pass', JSON.stringify(g));
        assert.match(g.detail, /1\/1 متطلّب منفّذ/);
        assert.match(g.detail, /؛ 5\/12 بنداً من وثيقتك له أثر/);
        // والمحقّقُ حين يقول «ناقص» يبقى fail بأسمائه هو، والذيلُ يلحق
        const ctx2 = { ...ctx, verdicts: {} };
        await runRequirementsVerify(ctx2, s.ctx.roomName, {}, reporter,
            { verify: async () => ({ results: [{ name: 'فهرس', implemented: false, reason: '' }], missing: [{ name: 'فهرس' }], implementedCount: 0 }) });
        assert.equal(ctx2.verdicts['requirements-verify'].status, 'fail');
        assert.match(ctx2.verdicts['requirements-verify'].detail, /1 متطلّب ناقص: فهرس؛ 5\/12 بنداً من وثيقتك له أثر/);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('هدفٌ ليس وثيقة — ولا قائمةٌ مرقّمةٌ قصيرة: البوّابةُ كما كانت «المحقّقُ لم يُجب» بلا مزوّد (عتبةُ الوثيقة تحمي من عدّ «١. أحمر ٢. أزرق» بنوداً)', async () => {
    const s = scenario('pm12plain'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [{ name: 'كتاب' }], roles: [{ name: 'عضو' }, { name: 'أمين مكتبة' }], flows: [] });
    const ctx = { username: s.ctx.username, activeProject: s.ctx.activeProject, projectPath: emptyProject(),
        originalGoal: 'أداة حاسبة زكاة بسيطة', blueprint: { kind: 'webapp', functionalComponents: [{ name: 'حاسبة' }] }, plan: { files: PLAN_FILES() }, verdicts: {} };
    const reporter = new RoomReporter(s.rt.io ?? { to: () => ({ emit: () => {} }) });
    try {
        await runRequirementsVerify(ctx, s.ctx.roomName, {}, reporter, { verify: async () => null });
        assert.deepEqual(ctx.verdicts['requirements-verify'], { status: 'unverified', detail: 'المحقّقُ لم يُجب (لا مزوّد أو ردٌّ غير صالح)' });
        // قائمةٌ مرقّمةٌ قصيرة ليست وثيقةَ مواصفات: ثلاثةُ ألوانٍ لا ثلاثةُ متطلّبات (حدُّ `isFullSpecification`)
        const short = 'غيّر الألوان:\n1. أحمر\n2. أزرق\n3. أخضر';
        const ctx3 = { ...ctx, originalGoal: short, verdicts: {} };
        await runRequirementsVerify(ctx3, s.ctx.roomName, {}, reporter, { verify: async () => null });
        assert.deepEqual(ctx3.verdicts['requirements-verify'], { status: 'unverified', detail: 'المحقّقُ لم يُجب (لا مزوّد أو ردٌّ غير صالح)' });
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('الحدود: الأثرُ يُقاس على ما كُتب فعلاً (plan.files)، والمرحلةُ تستورد المتتبِّعَ ولا تبني قائمةً ثانية', async () => {
    const fs = await import('fs'); const path = await import('path');
    const src = fs.readFileSync(path.join(import.meta.dirname, '../agents/stages/requirementsVerify.js'), 'utf8');
    assert.ok(src.includes("import { requirementsTraceOutcome } from './verify.js';"), 'يستورد الحكمَ الحتميّ نفسَه');
    assert.equal((src.match(/requirementsTraceOutcome\(/g) || []).length, 1);
    assert.equal((src.match(/specSections\(/g) || []).length, 1);
    assert.ok(!/traceSections\(/.test(src), 'لا تتبّعَ مباشراً — الحكمُ من دالّةٍ واحدة');
    // والأثرُ نفسُه لو قِيس على الملفّات مباشرةً
    const d = traceSections(specSections(LIB_SPEC), PLAN_FILES());
    assert.equal(d.traced.length, 5); assert.equal(d.missing.length, 7);
});
