// ⚖️ PM/2b — حكمُ مسارات الاستراتيجيّة (`PRODUCT_MIND.md`): Registry/Clone/React كانت تعود قبل حلقة التسليم بنتائجها الخاصّة
// بلا حكم، فيصل المستخدمَ «✅ اكتمل» ولو لم يُتحقَّق من شيء. هنا: `behaviorOutcome`/`strategyVerdict` مشتركان، كلُّ بانٍ يبني حكمَه من
// تحقّقٍ فعليّ على ما وصل القرص (الحارسُ اجتاز بالكتابة، المتطلّباتُ «لا ينطبق» بسببٍ مكتوب، السلوكُ من verifyBehavior)، رسالةُ البانى
// تقول الحكم (`withVerdict`)، والقاضي في `_runMissionNow` يبثّه. ثم الحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { behaviorOutcome, strategyVerdict } from '../agents/stages/verify.js';
import { withVerdict } from '../agents/stages/reportMissionSuccess.js';
import { buildFromRegistry } from '../agents/stages/buildFromRegistry.js';
import { buildFromClone } from '../agents/stages/buildFromClone.js';
import { getCloneById } from '../agents/cloneTemplates/index.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { transitionState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const reply = (events) => events.find(([ev]) => ev === 'chat_reply')[1].message;
const GATES = (v) => v.gates.map(g => `${g.name}:${g.status}`);

test('behaviorOutcome: لم يُشغَّل/تُخطّي → unverified بملخّصه؛ اجتاز → pass؛ ثغرات → fail بأسماء الفحوص؛ غائب → unverified', () => {
    assert.deepEqual(behaviorOutcome(null), { status: 'unverified', detail: 'تعذّر التحقّق السلوكي' });
    assert.deepEqual(behaviorOutcome({ ran: false, skipped: true, ok: true, summary: 'لا index.html للتحقّق منه.' }), { status: 'unverified', detail: 'لا index.html للتحقّق منه.' });
    assert.deepEqual(behaviorOutcome({ ran: true, ok: true, summary: '4 ✅' }), { status: 'pass', detail: '4 ✅' });
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [{ name: 'wiring-complete', status: 'fail' }, { name: 'x', status: 'pass' }, { name: 'role-coverage', status: 'fail' }] }),
        { status: 'fail', detail: 'ثغراتٌ باقية: wiring-complete، role-coverage' });
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [], summary: 'sum' }), { status: 'fail', detail: 'ثغراتٌ باقية: sum' });
});

test('strategyVerdict: الحارسُ اجتاز بالكتابة، المتطلّباتُ لا ينطبق بسببها، السلوكُ يحكم — PASS/UNVERIFIED/FAILED بالشكل نفسِه', () => {
    const pass = strategyVerdict({ filesCount: 3, behavior: { ran: true, ok: true, summary: 'ok' }, requirementsNote: 'سبب' });
    assert.equal(pass.status, 'PASS'); assert.deepEqual(GATES(pass), ['guard-and-write:pass', 'requirements-verify:skipped', 'behavior-verify:pass']);
    assert.deepEqual(pass.gates.map(g => g.detail), ['3 ملفّاً كُتبت', 'سبب', 'ok']);
    assert.equal(pass.summary, 'guard-and-write ✓، requirements-verify –، behavior-verify ✓');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: null }).status, 'UNVERIFIED');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: null }).gates[1].detail, 'لا محقّقَ متطلّبات على هذا المسار');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: { ran: true, ok: false, checks: [{ name: 'w', status: 'fail' }] } }).status, 'FAILED');
    assert.equal(strategyVerdict().status, 'UNVERIFIED');
});

test('withVerdict: PASS يلحق سطرَ التحقّق ويُبقي «✅»؛ UNVERIFIED يبدّلها بـ«☑️» ويقول ما لم يُتحقَّق؛ FAILED «⚠️» بما وُجد؛ بلا حكمٍ كما هي؛ بالإنجليزيّة', () => {
    const v = (status, gates = []) => ({ status, summary: 'S', gates });
    assert.equal(withVerdict('✅ اكتمل — x', null), '✅ اكتمل — x');
    assert.equal(withVerdict('✅ اكتمل — x', v('PASS'), 'ar'), '✅ اكتمل — x\n⚖️ التحقّق: S');
    assert.equal(withVerdict('✅ اكتمل — x', v('UNVERIFIED', [{ name: 'behavior-verify', status: 'unverified', detail: 'لا index.html' }]), 'ar'),
        '☑️ اكتمل — x\n☑️ لم يكتمل التحقّق: behavior-verify: لا index.html\n⚖️ التحقّق: S');
    assert.equal(withVerdict('✅ Done — x', v('FAILED', [{ name: 'behavior-verify', status: 'fail', detail: 'gaps' }, { name: 'guard-and-write', status: 'pass', detail: '' }]), 'en'),
        '⚠️ Done — x\n⚠️ Verification found gaps — behavior-verify: gaps\n⚖️ Verification: S');
    assert.equal(withVerdict('✅ Done — x', v('UNVERIFIED', [{ name: 'b', status: 'unverified', detail: 'd' }]), 'en'), '☑️ Done — x\n☑️ Verification incomplete: b: d\n⚖️ Verification: S');
    assert.equal(withVerdict('نصٌّ بلا أيقونة', v('FAILED', [{ name: 'b', status: 'fail', detail: 'd' }]), 'ar').split('\n')[0], 'نصٌّ بلا أيقونة', 'بلا ✅ لا تبديل');
});

test('Registry: الصفحةُ المركّبة تُتحقَّق فعلاً — PASS بثلاث بوّابات، والرسالةُ تلحق سطرَ التحقّق', async () => {
    const s = scenario('svreg'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    try {
        const { events, reporter } = collect();
        const r = await buildFromRegistry('صفحة هبوط لشركة استشارات', { ...s.ctx, projectPath: dir }, reporter);
        assert.equal(r.verdict.status, 'PASS'); assert.deepEqual(GATES(r.verdict), ['guard-and-write:pass', 'requirements-verify:skipped', 'behavior-verify:pass']);
        // PM/7: المتطلّباتُ تُمرَّر وتُتتبَّع — نموذجُ الزائر (`Visitor` → `user`) عامٌّ فلا يُتتبَّع، والبوّابةُ تقول ذلك بعدده
        assert.equal(r.verdict.gates[1].detail, 'صفحةٌ من بلوكات Registry — لا مكوّناتٍ وظيفيّة تُتحقَّق — 1 متطلّب بلا مفردةٍ تُتتبَّع');
        assert.match(r.verdict.gates[0].detail, /^\d+ ملفّاً كُتبت$/);
        // 🔬 الحكمُ من تحقّقٍ فعليّ: التفصيلُ بصيغة المحقّق نفسِها — قيمةٌ مُرضية مكتوبة يدوياً لا تُنتجها
        assert.match(r.verdict.gates[2].detail, /^\d+ ✅ \/ \d+ ⚠️ \/ \d+ ❌ \(\d+%\)$/, r.verdict.gates[2].detail);
        const lines = reply(events).split('\n');
        assert.match(lines[0], /^✅ اكتمل — ركّبنا/); assert.equal(lines.at(-1), '⚖️ التحقّق: guard-and-write ✓، requirements-verify –، behavior-verify ✓');
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('Clone: تحقّقٌ نهائيّ على ما وصل القرص — كلونٌ سليم PASS؛ وكلونٌ ملفّاتُه معطوبة FAILED بأسماء الفحوص والرسالةُ «⚠️ اكتمل» تقول الثغرات', async () => {
    const run = async (clone, prefix) => {
        const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
        transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
        try { const { events, reporter } = collect(); const r = await buildFromClone(clone, 'متجر عطور', { ...s.ctx, projectPath: dir }, reporter); return { r, msg: reply(events) }; }
        finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
    };
    const good = await run(getCloneById('jaola-store'), 'svclok');
    // PM/7: متطلّباتُ نموذج المتجر (Customer/Admin/Product/Order) كلُّها لها أثرٌ في ملفّاته، والتدفّقان لا يُتتبَّعان بالمفردات — pass مكتوبٌ عليه «أثرٌ لا تنفيذ»
    assert.equal(good.r.verdict.status, 'PASS'); assert.equal(good.r.verdict.gates[1].detail, '4/4 له أثر — أثرٌ لا تنفيذ؛ 2 لا يُتتبَّع بالمفردات');
    assert.match(good.msg, /^✅ اكتمل — بدأنا من قالب/); assert.match(good.msg, /\n⚖️ التحقّق: guard-and-write ✓، requirements-verify ✓، behavior-verify ✓$/);
    const broken = getCloneById('jaola-store');
    broken.files = broken.files.map(f => f.name === 'app.js' ? { ...f, content: 'nothing();' } : f.name === 'index.html' ? { ...f, content: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>x</h1><button onclick="missingFn()">go</button><script src="app.js"></script></body></html>' } : f);
    const bad = await run(broken, 'svclbad');
    assert.equal(bad.r.verdict.status, 'FAILED', JSON.stringify(bad.r.verdict));
    assert.match(bad.r.verdict.gates[2].detail, /^ثغراتٌ باقية: .*wiring-complete/);
    // PM/7: الملفّاتُ المعطوبة أفرغت مفرداتِ المتجر أيضاً — فبوّابةُ المتطلّبات تسبق السلوكَ بثلاثةٍ بلا أثر (Admin وحدَه بقي في styles.css)
    assert.equal(bad.r.verdict.gates[1].detail, '3 متطلّب بلا أثر: شاشة Customer، بيانات Product، بيانات Order (1/4 له أثر — أثرٌ لا تنفيذ؛ 2 لا يُتتبَّع بالمفردات)');
    assert.match(bad.msg, /^⚠️ اكتمل — بدأنا من قالب/); assert.match(bad.msg, /\n⚠️ التحقّق وجد ثغرات — requirements-verify: 3 متطلّب بلا أثر: [^\n]* • behavior-verify: ثغراتٌ باقية: /);
    assert.equal(bad.r.success, true, 'المهمّةُ اكتملت — الحكمُ على المنتج شيءٌ آخر');
});

test('القاضي في _runMissionNow: نتيجةُ استراتيجيّة بحكمٍ تُبثّ «⚖️ الحكم»؛ وبلا حكمٍ (يعمل/تخطّي) لا سطر', async () => {
    const s = scenario('svjudge'); setUserLanguage(s.ctx.username, 'ar');
    s.rt._buildFromRegistry = async () => ({ success: true, registry: true, verdict: { status: 'UNVERIFIED', summary: 'g ✓، r –، b ?', gates: [] } });
    const r = await s.rt._runMissionNow('صفحة هبوط لشركة استشارات', createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents: {} }));
    assert.equal(r.verdict.status, 'UNVERIFIED');
    assert.match(s.logs(), /\[Judge\]: ⚖️ الحكم: UNVERIFIED — g ✓، r –، b \?/);
    const q = scenario('svquiet'); setUserLanguage(q.ctx.username, 'ar');
    q.rt._buildFromRegistry = async () => ({ success: true, registry: true });
    await q.rt._runMissionNow('صفحة هبوط لشركة استشارات', createExecutionContext({ ...q.ctx, projectPath: emptyProject(), agents: {} }));
    assert.doesNotMatch(q.logs(), /\[Judge\]/);
});

test('الحدود: البناةُ الثلاثة يستوردون strategyVerdict وwithVerdict ويعودون بـverdict؛ jcr يبثّ القاضي مرّتين (الحلقةُ والاستراتيجيّة)؛ المرحلةُ السلوكيّة تشارك behaviorOutcome', () => {
    for (const f of ['buildFromRegistry', 'buildFromClone', 'buildReact']) {
        const src = fs.readFileSync(path.join(HERE, `../agents/stages/${f}.js`), 'utf8').replace(/^\s*\/\/.*$/gm, '');
        assert.ok(/import \{ (verifyAndAutofix, )?strategyVerdict \} from '\.\/verify\.js';/.test(src), f + ' strategyVerdict');
        assert.ok(src.includes("import { withVerdict } from './reportMissionSuccess.js';"), f + ' withVerdict');
        assert.equal((src.match(/strategyVerdict\(\{/g) || []).length, 1, f);
        assert.equal((src.match(/withVerdict\(/g) || []).length, 1, f);
        assert.ok(/return \{ success: true, [^}]*verdict \};/.test(src), f + ' يعود بالحكم');
    }
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.equal((jcr.match(/'7\. VERDICT', 'Judge'/g) || []).length, 2);
    assert.ok(jcr.includes("if (strategyResult.verdict) this.emitLiveLog(roomName, '7. VERDICT', 'Judge', `⚖️ الحكم: ${strategyResult.verdict.status} — ${strategyResult.verdict.summary}`);"));
    const verify = fs.readFileSync(path.join(HERE, '../agents/stages/verify.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(verify.includes('export function behaviorOutcome(verdict) {') && verify.includes("export function strategyVerdict({ filesCount = 0, behavior = null, requirementsNote = 'لا محقّقَ متطلّبات على هذا المسار', requirements = null, files = null } = {}) {"));
    assert.ok(verify.includes("recordGateOutcome(context, 'behavior-verify', outcome.status, outcome.detail);"), 'المرحلةُ تستعمل التصنيفَ المشترك');
});
