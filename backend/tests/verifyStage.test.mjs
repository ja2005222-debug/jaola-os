// 🔬 التحقّقُ السلوكيّ + الإصلاحُ يخرجان من jcr: `_verifyAndAutofix` → `stages/verify.js#verifyAndAutofix(opts, reporter)` (JCR/17).
//
// المستدعون الثلاثة (مرحلةُ التسليم `behavior-verify`، التعديلُ الجراحيّ، بناءُ React) يمرّون بالمفوِّض،
// و`jcrSurgicalEdit` يستبدله على النسخة — فجسدُه لم يُطرق مباشرةً. التوصيفُ الأوّل: لا index.html → صمتٌ وحكمٌ
// «لم يجرِ»؛ صفحةٌ تعمل → سطرٌ واحد؛ صفحةٌ مثقوبة → الثغراتُ بحروفها، جولةُ إصلاحٍ واحدة عبر `agents.coreEditCodePlan`
// والحارس، إعادةُ الحكم بـ«أُصلح تلقائياً» أو «يحتاج مراجعتك»؛ `canFix=false` → لا إصلاح؛ الدرسُ يُسجَّل — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { verifyAndAutofix } from '../agents/stages/verify.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { topLessons, resetLessons } from '../services/platformLessons.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const page = (body) => `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>x</h1>${body}<script src="script.js"></script></body></html>`;
const GOOD_JS = 'document.getElementById("go").addEventListener("click",()=>{document.title="ok"});';
const write = (dir, html, js) => { fs.writeFileSync(path.join(dir, 'index.html'), html); fs.writeFileSync(path.join(dir, 'script.js'), js); return dir; };
const good = () => write(emptyProject(), page('<button id="go">go</button>'), GOOD_JS);
const broken = () => write(emptyProject(), page('<button id="go" onclick="missingFn()">go</button>'), 'nothing();');
const opts = (s, dir, extra = {}) => ({ projectPath: dir, blueprint: null, username: s.ctx.username, activeProject: s.ctx.activeProject, roomName: s.ctx.roomName, agents: null, lang: 'ar', ...extra });
const fixer = (calls) => ({ coreEditCodePlan: async (instruction, files, lang) => { calls.push({ instruction, files: files.map((f) => f.name), lang }); return { files: [{ name: 'script.js', content: GOOD_JS }, { name: 'index.html', content: page('<button id="go">go</button><p>{اسم المشروع}</p>') }] }; } });

test('بلا index.html: حكمٌ «لم يجرِ» يُعاد كما هو، بلا بثٍّ ولا درس', async () => {
    const s = scenario('vf0'); resetLessons(); const { events, reporter } = collect();
    const v = await verifyAndAutofix(opts(s, emptyProject()), reporter);
    assert.equal(v.ran, false); assert.equal(v.skipped, true); assert.deepEqual(events, []); assert.deepEqual(topLessons(), []);
});

test('صفحةٌ تعمل: سطرٌ واحد بملخّصه، لا إصلاح، ولا درس', async () => {
    const s = scenario('vf1'); resetLessons(); const calls = []; const { events, reporter } = collect();
    const v = await verifyAndAutofix(opts(s, good(), { agents: fixer(calls) }), reporter);
    assert.equal(v.ok, true);
    assert.deepEqual(logs(events), ['[6. VERIFY] ➔ [BehaviorVerifier]: 🔬 التحقّق السلوكي: يعمل (1 ✅ / 0 ⚠️ / 0 ❌ (100%))']);
    assert.equal(calls.length, 0); assert.deepEqual(topLessons(), []);
});

test('صفحةٌ مثقوبة + مُصلِح: الثغراتُ بحروفها، جولةٌ واحدة بملفّات القرص، الكتابةُ عبر الحارس، ثمّ «أُصلح تلقائياً» — ولا درسَ بعد الإصلاح', async () => {
    const s = scenario('vf2'); resetLessons(); const dir = broken(); const calls = []; const { events, reporter } = collect();
    const v = await verifyAndAutofix(opts(s, dir, { agents: fixer(calls) }), reporter);
    assert.equal(v.ok, true, 'الحكمُ المُعاد هو ما بعد الإصلاح');
    const L = logs(events);
    assert.equal(L.length, 3);
    assert.ok(L[0].startsWith('[6. VERIFY] ➔ [BehaviorVerifier]: 🔬 ثغرات سلوكية (0 ✅ / 0 ⚠️ / 2 ❌ (0%)) — لم يُعلَن النجاح أجوفاً:\n❌ '), L[0]);
    assert.ok(L[0].includes('missingFn') && L[0].includes('ReferenceError'), 'الثغراتُ تُسمّى');
    assert.equal(L[1], '[6. VERIFY] ➔ [BehaviorVerifier]: 🔧 جولة إصلاح سلوكية مستهدفة...');
    assert.equal(L[2], '[6. VERIFY] ➔ [BehaviorVerifier]: 🔬 التحقّق السلوكي: يعمل (1 ✅ / 0 ⚠️ / 0 ❌ (100%)) (أُصلح تلقائياً)');
    assert.equal(calls.length, 1); assert.deepEqual(calls[0].files, ['index.html', 'script.js']); assert.equal(calls[0].lang, 'ar');
    assert.match(calls[0].instruction, /^أصلح المشكلات السلوكية التالية/);
    assert.equal(fs.readFileSync(path.join(dir, 'script.js'), 'utf8'), GOOD_JS, 'المُصلَحُ كُتب على القرص');
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(!html.includes('{اسم المشروع}') && html.includes(s.ctx.activeProject.replace(/[-_]+/g, ' ')), 'الكتابةُ عبر الحارس: الـplaceholder العربيّ يُبدَل باسم المشروع');
    assert.deepEqual(topLessons(), [], 'ما أُصلح ليس درساً');
});

test('صفحةٌ مثقوبة بلا إصلاح (canFix=false أو بلا مُصلِح): الثغراتُ تُبثّ، لا جولة، والدرسُ يُسجَّل بأسماء الفحوص الفاشلة', async () => {
    const s = scenario('vf3'); resetLessons(); const calls = []; const { events, reporter } = collect();
    const v = await verifyAndAutofix(opts(s, broken(), { agents: fixer(calls), canFix: false }), reporter);
    assert.equal(v.ok, false); assert.equal(logs(events).length, 1); assert.equal(calls.length, 0);
    assert.deepEqual(topLessons().map((l) => `${l.type}:${l.key}`).sort(), ['behavior_gap:no-js-errors', 'behavior_gap:wiring-complete']);
    resetLessons(); const n = collect();
    await verifyAndAutofix(opts(s, broken(), { agents: null }), n.reporter);
    assert.equal(logs(n.events).length, 1, 'بلا coreEditCodePlan لا جولة');
});

test('المُصلِحُ يعود فارغاً أو بخطأ: لا كتابة، والحكمُ الأوّل يبقى ويُسجَّل درساً', async () => {
    const s = scenario('vf4'); resetLessons(); const dir = broken(); const { events, reporter } = collect();
    const v = await verifyAndAutofix(opts(s, dir, { agents: { coreEditCodePlan: async () => ({ files: [], error: 'المزوّد صامت' }) } }), reporter);
    assert.equal(v.ok, false); assert.equal(logs(events).length, 2, 'الثغراتُ + سطرُ الجولة، ولا حكمَ ثانياً');
    assert.equal(fs.readFileSync(path.join(dir, 'script.js'), 'utf8'), 'nothing();');
    assert.equal(topLessons().length, 2);
    const withErr = collect();
    await verifyAndAutofix(opts(s, dir, { agents: { coreEditCodePlan: async () => ({ files: [{ name: 'script.js', content: 'x()' }], error: 'مبتور' }) } }), withErr.reporter);
    assert.equal(fs.readFileSync(path.join(dir, 'script.js'), 'utf8'), 'nothing();', 'خطّةٌ بخطأ لا تُكتب ولو حملت ملفّات');
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — بثّاً وحكماً', async () => {
    const s = scenario('vfq'); resetLessons();
    const a = await s.rt._verifyAndAutofix(opts(s, broken(), { agents: fixer([]) }));
    const { events, reporter } = collect();
    const b = await verifyAndAutofix(opts(s, broken(), { agents: fixer([]) }), reporter);
    assert.deepEqual(logs(events), s.events.filter((e) => e.ev === 'log').map((e) => e.payload.message));
    assert.deepEqual(b.checks.map((c) => [c.name, c.status]), a.checks.map((c) => [c.name, c.status]));
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد، والقارئُ يُستورد لا يُفوَّض', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/verify.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/reporter\.io\b/.test(code));
    // JCR/18: مرحلةُ التسليم `runBehaviorVerifyStage` تجاور الدالّةَ في الوحدة نفسِها وتبثّ سطرَ المكتبة — ٣ + ١.
    assert.equal((code.match(/reporter\.liveLog\(/g) || []).length, 4); assert.equal((code.match(/\breadProjectFiles\(/g) || []).length, 1);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes('\n    async _verifyAndAutofix(opts) {\n        return verifyAndAutofix(opts, this.reporter);\n    }\n'));
    assert.equal((jcr.replace(/^import .*$/gm, '').match(/\bverifyBehavior\(|\bbuildBehaviorFixInstruction\(|\brecordBehaviorGaps\(/g) || []).length, 0);
    assert.ok(!jcr.includes('/** يقرأ الملفات الأساسية كمصفوفة'), 'الـdocblock اليتيم رحل مع المرحلة');
});
