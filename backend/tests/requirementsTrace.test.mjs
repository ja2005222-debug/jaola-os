// ⚖️ PM/7 — «لا PASS بمتطلّباتٍ متخطّاة» (`PRODUCT_MIND.md`): مساراتُ الاستراتيجيّة (Registry/Clone/React) كانت تسجّل
// `requirements-verify: skipped` حتميّاً — فوثيقةُ نقاطِ البيع (١٢ متطلّباً مسمّى بعد PM/6) على كلونٍ يمثّل سبعةً منها كانت PASS.
// هنا: `traceRequirements` تتتبّع أثرَ كلِّ متطلّبٍ في الملفّات بالمعجم نفسِه (PM/1، PM/3) بلا مزوّد — الغيابُ قاطعٌ فيُقال
// بالاسم، والحضورُ أثرٌ لا تنفيذ فيُكتب كذلك، وما لا مفردةَ له (عامّ/تدفّق/خارج المعجم) لا يُحسب له ولا عليه. ثمّ المسارُ كاملاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
process.env.MISSION_LEDGER_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pm7-ledger-')), 'mission_ledger.json');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { traceRequirements, composeRequirements } = await import('../agents/requirementsVerifier.js');
const { requirementsTraceOutcome, strategyVerdict } = await import('../agents/stages/verify.js');
const { buildReactProject } = await import('../agents/stages/buildReact.js');
const { setDomainModel, getDomainModel } = await import('../agents/projectMemory.js');
const { RoomReporter } = await import('../core/runtime/RoomReporter.js');
const { transitionState, resetProjectState, STATES } = await import('../agents/stateMachine.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const HERE = import.meta.dirname;
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const gate = (v, name) => v.gates.find(g => g.name === name);

test('traceRequirements: دورٌ/كيانٌ في المعجم يُتتبَّع (له أثر أو بلا أثر)؛ العامُّ والتدفّقُ وما خارج المعجم لا يُتتبَّع — والتدفّقُ لا يُتتبَّع ولو حمل اسمُه مفردةً', () => {
    const files = [{ name: 'index.html', content: '<h1>قائمة المنتجات</h1><section>العميل</section>' }, { name: 'app.js', content: 'const rows = [];' }];
    const reqs = [
        { name: 'شاشة customer', _kind: 'role' }, { name: 'شاشة tenant', _kind: 'role' },
        { name: 'بيانات product', _kind: 'entity' }, { name: 'بيانات invoice', _kind: 'entity' }, { name: 'بيانات account', _kind: 'entity' },
        { name: 'شاشة User', _kind: 'role' }, { name: 'الميزة الأساسية التفاعلية' }, { name: 'تدفّق بيع بالمنتج', _kind: 'flow' },
        { name: '' }, null,
    ];
    assert.deepEqual(traceRequirements(reqs, files), {
        traced: ['شاشة customer', 'بيانات product'],
        missing: ['شاشة tenant', 'بيانات invoice', 'بيانات account'],
        untraceable: ['شاشة User', 'الميزة الأساسية التفاعلية', 'تدفّق بيع بالمنتج'],
    });
    assert.deepEqual(traceRequirements([{ name: 'تدفّق إغلاق وردية', _kind: 'flow' }], [{ name: 'a.js', content: 'وردية' }]).untraceable, ['تدفّق إغلاق وردية'], 'بلا _kind كانت ستُتتبَّع بمفردة «وردية» — التدفّقُ انتقالُ حالةٍ لا لفظ');
    assert.deepEqual(traceRequirements([{ name: 'بيانات وردية' }], [{ name: 'a.js', content: 'وردية' }]).traced, ['بيانات وردية'], 'بلا _kind: المعجمُ يقرّر');
    assert.deepEqual(traceRequirements([], files), { traced: [], missing: [], untraceable: [] });
    assert.deepEqual(traceRequirements([{ name: 'بيانات product', _kind: 'entity' }], []), { traced: [], missing: ['بيانات product'], untraceable: [] }, 'بلا ملفّات: كلُّ شيءٍ بلا أثر — والمستدعي يقرّر skipped قبل النداء');
    assert.deepEqual(traceRequirements(null, null), { traced: [], missing: [], untraceable: [] });
});

test('requirementsTraceOutcome: لا متطلّبات/لا ملفّات → skipped بالسبب؛ كلُّها لا يُتتبَّع → skipped بعدده؛ بلا أثر → fail بالأسماء؛ كلُّه له أثر → pass «أثرٌ لا تنفيذ»', () => {
    const files = [{ name: 'index.html', content: 'منتج عميل' }];
    assert.deepEqual(requirementsTraceOutcome([], files, 'سبب'), { status: 'skipped', detail: 'سبب' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }], [], 'سبب'), { status: 'skipped', detail: 'سبب' });
    assert.deepEqual(requirementsTraceOutcome(null, null), { status: 'skipped', detail: 'لا محقّقَ متطلّبات على هذا المسار' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'شاشة Visitor', _kind: 'role' }, { name: 'x' }], files, 'سبب'), { status: 'skipped', detail: 'سبب — 2 متطلّب بلا مفردةٍ تُتتبَّع' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }, { name: 'شاشة customer', _kind: 'role' }], files, 'سبب'),
        { status: 'pass', detail: '2/2 له أثر — أثرٌ لا تنفيذ' }, 'بلا غيرِ متتبَّع: لا ذيل');
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }, { name: 'شاشة tenant', _kind: 'role' }, { name: 'تدفّق x', _kind: 'flow' }], files, 'سبب'),
        { status: 'fail', detail: '1 متطلّب بلا أثر: شاشة tenant (1/2 له أثر — أثرٌ لا تنفيذ؛ 1 لا يُتتبَّع بالمفردات)' });
    // strategyVerdict يقرؤها بعينها: fail يُسقط الحكمَ إلى FAILED، وskipped لا يمنع PASS كما كان (deliveryVerdict)
    const ok = { ran: true, ok: true, summary: 'ok' };
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'شاشة tenant', _kind: 'role' }], files }).status, 'FAILED');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'بيانات product', _kind: 'entity' }], files }).status, 'PASS');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'شاشة Visitor', _kind: 'role' }], files }).summary, 'guard-and-write ✓، requirements-verify –، behavior-verify ✓');
});

test('composeRequirements يسم كلَّ متطلّبٍ من الفهم بوجهه (`_kind`: role/entity/flow) — ومكوّناتُ المخطّط بلا وسمٍ فيقرّر المعجمُ وحدَه', () => {
    const m = { roles: [{ name: 'Driver' }], entities: [{ name: 'trip' }], flows: [{ name: 'حالة الرحلة' }] };
    const reqs = composeRequirements({ functionalComponents: [{ name: 'بحث' }] }, m);
    assert.deepEqual(reqs.map(r => [r.name, r._kind]), [['بحث', undefined], ['شاشة Driver', 'role'], ['بيانات trip', 'entity'], ['تدفّق حالة الرحلة', 'flow']]);
    assert.ok(reqs.slice(1).every(r => r._source === 'model'));
});

test('المسارُ كاملاً: وثيقةُ نقاطِ البيع على مجلّدٍ فارغ → كلون نقاط البيع → الحكمُ FAILED بأسماء ما طُلب ولا أثرَ له، في السجلّ وفي الشات — لا «✅ اكتمل» بحكم PASS', async () => {
    const s = scenario('pm7pos'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] }); // لا وراثةَ من جولةٍ سابقة
    try {
        const r = await s.rt._runMissionNow(SPEC, createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents: {} }));
        assert.equal(r.clone, 'jaola-pos'); assert.equal(r.success, true, 'المهمّةُ اكتملت — الحكمُ على المنتج شيءٌ آخر');
        assert.equal(r.verdict.status, 'FAILED', JSON.stringify(r.verdict));
        // PM/9: الوثيقةُ المرقّمة تُحاكَم بلغتها — بنودُها بعينها (٣١ من ٤٤ بلا أثر) ومفاهيمُ الفهم ذيلاً (٧/١٠)
        assert.equal(gate(r.verdict, 'requirements-verify').detail,
            '31 بنداً من 44 في وثيقتك بلا أثر: 1 الصلاحيات والأدوار (RBAC)، 3 الباركود، 7 المرتجعات، 8 دفتر المخزون، 9 المشتريات، 10 الموردون +25 (13/44 له أثر — أثرٌ لا تنفيذ؛ مفاهيمُ الفهم 7/10)');
        assert.match(s.logs(), /\[Judge\]: ⚖️ الحكم: FAILED — guard-and-write ✓، requirements-verify ✗، behavior-verify ✗/);
        assert.equal(gate(r.verdict, 'behavior-verify').detail, 'ثغراتٌ باقية: أدوار بلا واجهة/تمثيل: staff، tenant', 'والسلوكُ يقول الشيءَ نفسَه من جهته بأسماء الأدوار (PM/10) لا باسم فحصه');
        const msg = s.replies().find(m => m.includes('بدأنا من قالب'));
        assert.match(msg, /^⚠️ اكتمل — بدأنا من قالب/);
        assert.match(msg, /\n⚠️ التحقّق وجد ثغرات — requirements-verify: 31 بنداً من 44 في وثيقتك بلا أثر: 1 الصلاحيات والأدوار \(RBAC\)، 3 الباركود/);
        // الفهمُ المدمَج هو ما حُوكم إليه: أدوارُ الوثيقة الأربعة وكياناتُها الستّة + نموذجُ الكلون
        const stored = getDomainModel(s.ctx.username, s.ctx.activeProject);
        for (const n of ['staff', 'customer', 'admin', 'tenant']) assert.ok(stored.roles.some(x => x.name === n), n);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('مسارُ React: فهمٌ لا تنطق به المعاينةُ الثابتة → fail بأسمائه؛ وبلا فهمٍ → skipped بسببه المكتوب (لا «لا ينطبق» حتميّاً)', async () => {
    const run = async (prefix, model) => {
        const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
        transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
        setDomainModel(s.ctx.username, s.ctx.activeProject, model);
        try { const { reporter } = collect(); return await buildReactProject('مطعم البحر للمأكولات البحرية', { ...s.ctx, projectPath: dir }, { sections: ['الرئيسية', 'القائمة', 'تواصل'] }, reporter); }
        finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
    };
    const mismatch = await run('pm7rxm', { roles: [{ name: 'Driver' }], entities: [{ name: 'trip' }], flows: [{ name: 'حالة الرحلة' }] });
    assert.equal(mismatch.verdict.status, 'FAILED');
    assert.equal(gate(mismatch.verdict, 'requirements-verify').detail, '2 متطلّب بلا أثر: شاشة Driver، بيانات trip (0/2 له أثر — أثرٌ لا تنفيذ؛ 1 لا يُتتبَّع بالمفردات)');
    const none = await run('pm7rxn', { roles: [], entities: [], flows: [] });
    assert.deepEqual(gate(none.verdict, 'requirements-verify'), { name: 'requirements-verify', status: 'skipped', detail: 'مسارُ React — لا متطلّباتٍ من الفهم' });
    assert.equal(none.verdict.status, 'PASS');
});

test('الحدود: البناةُ الثلاثة يمرّرون requirements وfiles إلى strategyVerdict؛ الحكمُ يستورد المتتبِّعَ من المحقّق؛ والمتتبِّعُ يقرأ معجمَ projectModel لا قائمةً ثانية', () => {
    const src = (f) => fs.readFileSync(path.join(HERE, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    // PM/8: المتطلّباتُ تُؤلَّف مرّةً في الكلون (جولةُ الإكمال ثمّ الحكم) — المتغيّرُ نفسُه يصل الحكم
    const clone = src('../agents/stages/buildFromClone.js');
    assert.ok(clone.includes('const requirements = composeRequirements(null, model);') && clone.includes('requirements, files: await readProjectFiles(projectPath),'));
    assert.ok(src('../agents/stages/buildFromRegistry.js').includes('requirements: composeRequirements(null, registryModel), files,'));
    assert.ok(src('../agents/stages/buildReact.js').includes('requirements: composeRequirements(null, getDomainModel(username, activeProject)), files: await readProjectFiles(projectPath),'));
    const verify = src('../agents/stages/verify.js');
    assert.ok(verify.includes("import { traceRequirements, traceSections, sectionLabel } from '../requirementsVerifier.js';"), 'PM/9 أضاف متتبِّعَ البنود وتسميتَها');
    assert.equal((verify.match(/requirementsTraceOutcome\(/g) || []).length, 2, 'تعريفٌ + نداءٌ واحد في strategyVerdict');
    const rv = src('../agents/requirementsVerifier.js');
    assert.ok(rv.includes("import { conceptOf, conceptKind, conceptsInText, isGenericConcept, normalizeConceptText } from './projectModel.js';"), 'PM/9: التطبيعُ نفسُه لمفردات البنود');
    assert.equal((rv.match(/_kind/g) || []).length, 2, 'الوسمُ يُكتب مرّةً ويُقرأ مرّة');
});
