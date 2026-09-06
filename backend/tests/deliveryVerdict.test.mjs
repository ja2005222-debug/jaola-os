// ⚖️ PM/2 — «الحكم» (`PRODUCT_MIND.md`): كانت الحلقةُ تعيد `{ success: true }` بعد مراحل التسليم دون أن تقرأ ما وجدته
// بوّاباتُ التحقّق — فكان «لم يُتحقَّق» يساوي «نجح» ويقال للمستخدم «✅ اكتملت المهمة». هنا: عقدُ `gate` على المراحل، حكمٌ نقيّ
// من البوّابات، المرحلتان تسجّلان ما وجدتا، الحلقةُ تحكم وتبثّ، والتقريرُ يقول الحكمَ بعنوانه. الحالةُ تبقى COMPLETED للثلاثة
// (حالةُ المهمّة ≠ حكمُ المنتج — قرارٌ مكتوب في CONTRACTS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { DELIVERY_STAGES, GATE_KINDS, VERDICT, recordGateOutcome, deliveryVerdict } from '../core/contracts/index.js';
import { runRequirementsVerify } from '../agents/stages/requirementsVerify.js';
import { runBehaviorVerifyStage } from '../agents/stages/verify.js';
import { reportMissionSuccess } from '../agents/stages/reportMissionSuccess.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { transitionState, getProjectState, STATES } from '../agents/stateMachine.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const replies = (events) => events.filter(([ev]) => ev === 'chat_reply').map(([, p]) => p.message);
const GATES = ['guard-and-write', 'requirements-verify', 'behavior-verify'];

test('العقد: ثلاثُ بوّابات واثنان استشاريّان والبقيّةُ تحسينات؛ optional كما كان؛ مجمَّد؛ قيمُ الحكم الثلاث', () => {
    assert.deepEqual(DELIVERY_STAGES.filter(s => s.gate === 'gate').map(s => s.name), GATES);
    assert.deepEqual(DELIVERY_STAGES.filter(s => s.gate === 'advisory').map(s => s.name), ['executive-memory', 'project-memory']);
    assert.equal(DELIVERY_STAGES.filter(s => s.gate === 'enhancement').length, 10);
    for (const s of DELIVERY_STAGES) { assert.ok(GATE_KINDS.includes(s.gate), s.name); assert.equal(s.optional, true, 'لا مرحلةَ تُسقط الحلقة'); }
    assert.ok(Object.isFrozen(GATE_KINDS) && Object.isFrozen(VERDICT));
    assert.deepEqual(VERDICT, { PASS: 'PASS', FAILED: 'FAILED', UNVERIFIED: 'UNVERIFIED' });
});

test('recordGateOutcome: يكتب على السياق ويستبدل، يقصّ التفصيل إلى ٣٠٠، يرفض حالةً مجهولة، ويهمل سياقاً غائباً', () => {
    const ctx = {};
    assert.deepEqual(recordGateOutcome(ctx, 'behavior-verify', 'pass', 'ok'), { status: 'pass', detail: 'ok' });
    recordGateOutcome(ctx, 'behavior-verify', 'fail', 'x'.repeat(400));
    assert.equal(ctx.verdicts['behavior-verify'].status, 'fail'); assert.equal(ctx.verdicts['behavior-verify'].detail.length, 300);
    assert.deepEqual(recordGateOutcome(ctx, 'guard-and-write', 'skipped'), { status: 'skipped', detail: '' });
    assert.throws(() => recordGateOutcome(ctx, 'x', 'ok'), /حالةُ بوّابةٍ غير معروفة: ok/);
    assert.equal(recordGateOutcome(null, 'x', 'pass'), null);
});

test('deliveryVerdict نقيّة: ثغرةٌ تغلب، ثمّ «لم يُتحقَّق»، ثمّ اجتياز؛ «لا ينطبق» لا يُحسب؛ الغائبُ = لم يسجّل؛ التحسيناتُ خارج الحكم', () => {
    const o = (g, r, b) => ({ 'guard-and-write': { status: g }, 'requirements-verify': { status: r }, 'behavior-verify': { status: b } });
    assert.equal(deliveryVerdict(o('pass', 'pass', 'pass')).status, 'PASS');
    assert.equal(deliveryVerdict(o('pass', 'pass', 'pass')).summary, 'guard-and-write ✓، requirements-verify ✓، behavior-verify ✓');
    assert.equal(deliveryVerdict(o('pass', 'unverified', 'fail')).status, 'FAILED', 'الثغرةُ تغلب «لم يُتحقَّق»');
    assert.equal(deliveryVerdict(o('pass', 'unverified', 'pass')).status, 'UNVERIFIED');
    assert.equal(deliveryVerdict(o('pass', 'skipped', 'pass')).status, 'PASS', 'لا ينطبق لا يمنع الاجتياز');
    assert.equal(deliveryVerdict(o('skipped', 'skipped', 'skipped')).status, 'UNVERIFIED', 'لم يُتحقَّق من شيء');
    const empty = deliveryVerdict({});
    assert.equal(empty.status, 'UNVERIFIED');
    assert.deepEqual(empty.gates.map(g => g.detail), Array(3).fill('لم تسجّل المرحلةُ حكماً'));
    assert.equal(deliveryVerdict({ ...o('pass', 'pass', 'pass'), 'requirements-verify': { status: 'weird' } }).status, 'UNVERIFIED', 'حالةٌ مجهولة = لم يُتحقَّق');
    assert.equal(deliveryVerdict({ ...o('pass', 'pass', 'pass'), seo: { status: 'fail' } }).status, 'PASS', 'فشلُ تحسينٍ لا يحكم');
    assert.equal(deliveryVerdict(o('pass', 'fail', 'skipped')).summary, 'guard-and-write ✓، requirements-verify ✗، behavior-verify –');
    const custom = deliveryVerdict({ a: { status: 'pass' } }, [{ name: 'a', gate: 'gate' }, { name: 'b', gate: 'enhancement' }]);
    assert.deepEqual(custom, { status: 'PASS', gates: [{ name: 'a', status: 'pass', detail: '' }], summary: 'a ✓' });
    assert.equal(deliveryVerdict(null).status, 'UNVERIFIED');
});

const COMPS = [{ name: 'سلة التسوق', behavior: 'تضيف وتحذف' }, { name: 'الدفع', behavior: 'زرٌ يعمل' }];
const rvCtx = (s, comps = COMPS) => ({
    plan: { files: [{ name: 'index.html', content: '<!DOCTYPE html><html><body><h1>متجر</h1></body></html>' }] },
    blueprint: { functionalComponents: comps }, username: s.ctx.username, activeProject: s.ctx.activeProject, projectPath: emptyProject(),
});
const rvVerdict = (implemented) => { const results = COMPS.map(c => ({ name: c.name, implemented: implemented.includes(c.name), reason: '', fixInstruction: '' })); const missing = results.filter(r => !r.implemented); return { results, missing, implementedCount: results.length - missing.length }; };

test('بوّابةُ المتطلّبات تقول ما وجدت: محقّقٌ صامت → unverified؛ ناقص → fail بأسمائه؛ مكتمل → pass؛ لا مكوّنات → skipped؛ رمي → unverified', async () => {
    const run = async (comps, verify) => { const s = scenario('dvr'); transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' }); const ctx = rvCtx(s, comps); const { events, reporter } = collect(); await runRequirementsVerify(ctx, s.ctx.roomName, {}, reporter, { verify }); return { out: ctx.verdicts['requirements-verify'], logs: logs(events) }; };
    assert.deepEqual((await run(COMPS, async () => null)).out, { status: 'unverified', detail: 'المحقّقُ لم يُجب (لا مزوّد أو ردٌّ غير صالح)' });
    assert.deepEqual((await run(COMPS, async () => rvVerdict(['سلة التسوق']))).out, { status: 'fail', detail: '1 متطلّب ناقص: الدفع' });
    assert.deepEqual((await run(COMPS, async () => rvVerdict(['سلة التسوق', 'الدفع']))).out, { status: 'pass', detail: '2/2 متطلّب منفّذ' });
    // PM/4: شرطُ البوّابة صار «هل من متطلّبات؟» لا «هل في المخطّط مكوّنات؟» — فالسببُ يذكر الفهمَ أيضاً.
    assert.deepEqual((await run([], async () => { throw new Error('لا يُستدعى'); })).out, { status: 'skipped', detail: 'لا متطلّباتٍ (لا مكوّناتٍ في المخطّط ولا فهمَ) أو لا ملفّات' });
    const thrown = await run(COMPS, async () => { throw new Error('انقطع'); });
    assert.deepEqual(thrown.out, { status: 'unverified', detail: 'انقطع' });
    assert.ok(thrown.logs.some(l => l.includes('⚠️ تخطّي التحقق: انقطع')), 'سطرُ التخطّي كما كان');
});

const page = (body) => `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>x</h1>${body}<script src="script.js"></script></body></html>`;
const write = (html, js) => { const dir = emptyProject(); fs.writeFileSync(path.join(dir, 'index.html'), html); fs.writeFileSync(path.join(dir, 'script.js'), js); return dir; };

test('بوّابةُ السلوك تقول ما وجدت: يعمل → pass؛ معطّل بلا ميزانية → fail بأسماء الفحوص؛ بلا index.html → unverified', async () => {
    const run = async (dir) => { const s = scenario('dvb'); const ctx = { ...s.ctx, projectPath: dir, blueprint: { category: 'tool' } }; const { reporter } = collect(); await runBehaviorVerifyStage(ctx, s.ctx.roomName, {}, reporter); return ctx.verdicts['behavior-verify']; };
    const good = await run(write(page('<button id="go">go</button>'), 'document.getElementById("go").addEventListener("click",()=>{document.title="ok"});'));
    assert.equal(good.status, 'pass'); assert.ok(good.detail.length > 0);
    const bad = await run(write(page('<button id="go" onclick="missingFn()">go</button>'), 'nothing();'));
    assert.equal(bad.status, 'fail'); assert.match(bad.detail, /^ثغراتٌ باقية: .+/);
    assert.deepEqual(await run(emptyProject()), { status: 'unverified', detail: 'لا index.html للتحقّق منه.' });
});

// ── الحلقةُ كاملةً: البوّاباتُ تحكم والتقريرُ يقول ──
const HTML = `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>حاسبة</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>حاسبة</h1><input id="amount" type="number"><button id="calc">احسب</button><p id="out"></p></main><script src="script.js"></script></body></html>`;
const JS = `const rates=[{name:'زكاة',rate:0.025}];document.getElementById('calc').addEventListener('click',()=>{const v=Number(document.getElementById('amount').value)||0;document.getElementById('out').textContent=(v*rates[0].rate).toFixed(2);});`;
function kernel(prefix, requirementsOutcome) {
    const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    const agents = {
        getState: () => null, needsBackend: () => false,
        coreGenerateCodePlan: async () => ({ files: [{ name: 'index.html', content: HTML }, { name: 'styles.css', content: 'body{margin:0}' }, { name: 'script.js', content: JS }] }),
        architectReview: async () => ({ approved: true, feedback: '' }), qaVerify: async () => ({ passed: true, logs: [] }),
    };
    if (requirementsOutcome) s.rt._stageRequirementsVerify = async (ctx) => { recordGateOutcome(ctx, 'requirements-verify', ...requirementsOutcome); };
    const run = () => s.rt._runMissionNow('أداة حاسبة زكاة بسيطة', createExecutionContext({ ...s.ctx, projectPath: dir, agents }));
    return { s, run, state: () => getProjectState(s.ctx.username, s.ctx.activeProject).state };
}

test('الحلقة: بوّاباتٌ كلُّها تجتاز → PASS، «⚖️ الحكم» في السجلّ، العنوانُ «✅ اكتملت المهمة» وسطرُ التحقّق، COMPLETED', async () => {
    const k = kernel('dvpass', ['pass', '2/2 متطلّب منفّذ']);
    const r = await k.run();
    assert.equal(r.success, true); assert.equal(r.verdict.status, 'PASS');
    assert.deepEqual(r.verdict.gates.map(g => g.status), ['pass', 'pass', 'pass']);
    assert.match(k.s.logs(), /\[Judge\]: ⚖️ الحكم: PASS — guard-and-write ✓، requirements-verify ✓، behavior-verify ✓/);
    const rep = k.s.replies().find(m => m.includes('تقرير التسليم'));
    assert.match(rep, /^✅ اكتملت المهمة — تقرير التسليم:\n⚖️ التحقّق: guard-and-write ✓، requirements-verify ✓، behavior-verify ✓\n⏱️/);
    assert.equal(k.state(), STATES.COMPLETED);
});

test('الحلقة: بوّابةٌ وجدت ثغرات → FAILED — العنوانُ «⚠️ اكتمل البناء لكنّ التحقّق وجد ثغرات» بتفصيلها، ولا «اكتملت المهمة»؛ الحالةُ COMPLETED والمعاينةُ تتحدّث (قرارٌ مكتوب)', async () => {
    const k = kernel('dvfail', ['fail', '1 متطلّب ناقص: الدفع']);
    const r = await k.run();
    assert.equal(r.success, true, 'المهمّةُ اكتملت — الحكمُ على المنتج شيءٌ آخر');
    assert.equal(r.verdict.status, 'FAILED');
    assert.match(k.s.logs(), /\[Judge\]: ⚖️ الحكم: FAILED — guard-and-write ✓، requirements-verify ✗، behavior-verify ✓/);
    const all = k.s.replies().join('\n');
    assert.match(all, /⚠️ اكتمل البناء لكنّ التحقّق وجد ثغرات — requirements-verify: 1 متطلّب ناقص: الدفع\n⚖️ التحقّق: /);
    assert.doesNotMatch(all, /اكتملت المهمة/);
    assert.equal(k.state(), STATES.COMPLETED);
    assert.ok(k.s.events.some(e => e.ev === 'preview_updated'));
});

test('التقرير مباشرةً: بلا حكم (مستدعٍ قديم) العنوانُ القديم بلا سطر تحقّق؛ UNVERIFIED بالإنجليزيّة؛ FAILED بالعربيّة يجمع البوّابات السيّئة', () => {
    const rep = (lang, verdict) => { const s = scenario('dvrep'); setUserLanguage(s.ctx.username, lang); const { events, reporter } = collect(); reportMissionSuccess('x', { ...s.ctx, projectPath: emptyProject() }, reporter, verdict); return replies(events)[0].split('\n'); };
    const legacy = rep('ar', null);
    assert.equal(legacy[0], '✅ اكتملت المهمة — تقرير التسليم:'); assert.match(legacy[1], /^⏱️/);
    const un = rep('en', { status: 'UNVERIFIED', summary: 'guard-and-write ✓، requirements-verify ?، behavior-verify ✓', gates: [{ name: 'requirements-verify', status: 'unverified', detail: 'no provider' }] });
    assert.equal(un[0], '☑️ Build complete — verification incomplete: requirements-verify: no provider');
    assert.equal(un[1], '⚖️ Verification: guard-and-write ✓، requirements-verify ?، behavior-verify ✓');
    const failed = rep('ar', { status: 'FAILED', summary: 's', gates: [{ name: 'requirements-verify', status: 'fail', detail: 'ناقص' }, { name: 'behavior-verify', status: 'unverified', detail: 'لا صفحة' }, { name: 'guard-and-write', status: 'pass', detail: '' }] });
    assert.equal(failed[0], '⚠️ اكتمل البناء لكنّ التحقّق وجد ثغرات — requirements-verify: ناقص • behavior-verify: لا صفحة');
    const pass = rep('en', { status: 'PASS', summary: 'a ✓', gates: [] });
    assert.equal(pass[0], '✅ Mission complete — Delivery report:'); assert.equal(pass[1], '⚖️ Verification: a ✓');
});

test('الحدود: الحكمُ في العقد لا في jcr؛ الحلقةُ تعيد { success: true, verdict } وتبثّ سطرَ القاضي مرّةً؛ الحارسُ يسجّل؛ المرحلتان تستوردان التسجيل؛ التقريرُ بحكمٍ افتراضيّه null', () => {
    const contracts = fs.readFileSync(path.join(HERE, '../core/contracts/index.js'), 'utf8');
    assert.equal((contracts.match(/gate: 'gate'/g) || []).length, 3);
    assert.equal((contracts.match(/gate: 'advisory'/g) || []).length, 2);
    assert.ok(contracts.includes('export function deliveryVerdict(outcomes = {}, stages = DELIVERY_STAGES) {'));
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.equal((jcr.match(/deliveryVerdict\(/g) || []).length, 1);
    assert.ok(jcr.includes("const verdict = deliveryVerdict(context.verdicts);\n            this.emitLiveLog(roomName, '7. VERDICT', 'Judge', `⚖️ الحكم: ${verdict.status} — ${verdict.summary}`);\n            return { success: true, verdict };"));
    assert.ok(jcr.includes("recordGateOutcome(context, 'guard-and-write', 'pass', `${plan.files.length} ملفّاً كُتبت بعد الحراسة`);"));
    assert.ok(jcr.includes('this._reportMissionSuccess(goal, ctx, execResult.verdict);'));
    assert.equal((jcr.match(/recordGateOutcome\(/g) || []).length, 1, 'الحارسُ وحده في jcr — البوّابتان الأخريان في مرحلتيهما');
    assert.ok(fs.readFileSync(path.join(HERE, '../agents/stages/requirementsVerify.js'), 'utf8').includes("import { recordGateOutcome } from '../../core/contracts/index.js';"));
    // PM/2b: verify.js يحمل حكمَ مسارات الاستراتيجيّة أيضاً فيستورد deliveryVerdict
    assert.ok(fs.readFileSync(path.join(HERE, '../agents/stages/verify.js'), 'utf8').includes("import { recordGateOutcome, deliveryVerdict } from '../../core/contracts/index.js';"));
    assert.equal((fs.readFileSync(path.join(HERE, '../agents/stages/requirementsVerify.js'), 'utf8').match(/recordGateOutcome\(context, 'requirements-verify', /g) || []).length, 5, 'خمسُ حالات: صامت/ناقص/مكتمل/لا ينطبق/رمي');
    const vsrc = fs.readFileSync(path.join(HERE, '../agents/stages/verify.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.equal((vsrc.match(/recordGateOutcome\(context, 'behavior-verify', /g) || []).length, 2, 'PM/2b: التصنيفُ في behaviorOutcome (مشترك مع مسارات الاستراتيجيّة) + حالةُ الرمي');
    assert.equal((vsrc.match(/\bbehaviorOutcome\(/g) || []).length, 3, 'تعريفٌ + المرحلة + strategyVerdict');
    const rep = fs.readFileSync(path.join(HERE, '../agents/stages/reportMissionSuccess.js'), 'utf8');
    assert.ok(rep.includes('export function reportMissionSuccess(goal, ctx, reporter, verdict = null) {'));
});
