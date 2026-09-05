// 📋 رابعُ استخراجٍ من jcr: `_stageRequirementsVerify` → `stages/requirementsVerify.js`.
//
// المرحلةُ تُنادى بالاسم من `DELIVERY_STAGES` (`this[stage.run]`) — المفوِّضُ يُبقيها.
// بلا LLM يعيد `verifyRequirements` null فتُختصر المرحلةُ إلى سطرِ بثٍّ وانتقالِ حالة؛
// حلقةُ الإكمال لم يطرقها اختبارٌ قطّ — هنا تُطرق بحقنِ `verify` (وسيطٌ اختياريّ افتراضُه
// الأصل). التكافؤُ، النصّ، الحلقةُ بجولاتها وحدِّ «لا تقدّم»، مسارُ «بلا مُصلِح»، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runRequirementsVerify } from '../agents/stages/requirementsVerify.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { transitionState, getProjectState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { topLessons, resetLessons } from '../services/platformLessons.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) }) }; };
const COMPS = [{ name: 'سلة التسوق', behavior: 'تضيف وتحذف' }, { name: 'الدفع', behavior: 'زرٌ يعمل' }];
const mk = (s, dir, comps = COMPS) => ({
    plan: { files: [{ name: 'index.html', content: '<!DOCTYPE html><html><body><h1>متجر</h1></body></html>' }] },
    blueprint: { functionalComponents: comps },
    username: s.ctx.username, activeProject: s.ctx.activeProject, projectPath: dir,
});
const verdictOf = (implementedNames) => {
    const results = COMPS.map((c) => ({ name: c.name, implemented: implementedNames.includes(c.name), reason: implementedNames.includes(c.name) ? '' : 'لا زر', fixInstruction: 'أضف زر الدفع' }));
    const missing = results.filter((r) => !r.implemented);
    return { results, missing, implementedCount: results.length - missing.length };
};

test('بلا مكوّناتٍ وظيفيّة: لا بثَّ ولا أثر — الدالّةُ الحرّة ≡ المفوِّض', async () => {
    const s = scenario('rvq'); const dir = emptyProject();
    const viaClass = await s.rt._stageRequirementsVerify(mk(s, dir, []), s.ctx.roomName, {});
    const { events, reporter } = collect();
    const viaFree = await runRequirementsVerify(mk(s, dir, []), s.ctx.roomName, {}, reporter);
    assert.equal(viaClass, undefined); assert.equal(viaFree, undefined);
    assert.deepEqual(s.events, []); assert.deepEqual(events, []);
});

test('الافتراضُ بلا LLM: سطرُ بثٍّ واحدٌ بحروفه وانتقالٌ إلى VERIFYING — والحلقةُ لا تُطرق', async () => {
    const s = scenario('rvdef'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });
    try {
        const { events, reporter } = collect();
        await runRequirementsVerify(mk(s, dir), s.ctx.roomName, { coreEditCodePlan: async () => { throw new Error('يجب ألّا يُنادى'); } }, reporter);
        assert.deepEqual(events, [['log', '[6. VERIFY] ➔ [Requirements]: 📋 التحقق من تنفيذ متطلبات المشروع...']]);
        assert.equal(getProjectState(s.ctx.username, s.ctx.activeProject)?.state, STATES.VERIFYING);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('حلقةُ الإكمال بحقن verify: الناقصُ يُبنى ويُكتب ويُدمج، والقائمةُ صادقة، والدرسُ يُسجَّل', async () => {
    resetLessons();
    const s = scenario('rvloop'); const dir = emptyProject(); setUserLanguage(s.ctx.username, 'ar');
    const ctx = mk(s, dir); const calls = { verify: 0, edit: [] };
    const verify = async () => (++calls.verify === 1 ? verdictOf(['سلة التسوق']) : verdictOf(['سلة التسوق', 'الدفع']));
    const agents = { coreEditCodePlan: async (instruction, files, lang) => { calls.edit.push([instruction.slice(0, 20), files.length, lang]); return { files: [{ name: 'checkout.html', content: '<!DOCTYPE html><html><body><button>ادفع</button></body></html>' }] }; } };
    const { events, reporter } = collect();
    await runRequirementsVerify(ctx, s.ctx.roomName, agents, reporter, { verify });

    assert.equal(calls.verify, 2, 'تحقّقٌ قبل الجولة وبعدها');
    assert.deepEqual(calls.edit.map((c) => [c[1], c[2]]), [[1, 'ar']], 'جولةٌ واحدة بملفّات الخطة ولغةِ المستخدم');
    assert.ok(fs.existsSync(path.join(dir, 'checkout.html')), 'الملفُّ المُصلَح كُتب على القرص');
    assert.deepEqual(ctx.plan.files.map((f) => f.name), ['index.html', 'checkout.html'], 'دُمج في الخطة');
    const logs = events.filter(([ev]) => ev === 'log').map(([, m]) => m);
    assert.ok(logs.includes('[6. VERIFY] ➔ [Requirements]: 🏗️ إكمال الشاشات 1/3 — 1 ناقصة: الدفع'), JSON.stringify(logs));
    assert.ok(logs.includes('[6. VERIFY] ➔ [Requirements]: 📋 2/2 متطلب منفّذ (+1 أُصلح تلقائياً)'), JSON.stringify(logs));
    const reply = events.find(([ev]) => ev === 'chat_reply')?.[1];
    assert.equal(reply, '📋 **تحقق متطلبات المشروع:**\n✅ سلة التسوق\n✅ الدفع', 'قائمةُ التحقّق كما تصل المستخدم (لا علامةَ للمُصلَح فيها — كما كان)');
    assert.ok(topLessons(50).some((l) => l.type === 'verifier_missing' && l.key === 'الدفع'), 'درسُ «سُلِّم ناقصاً» سُجّل');
});

test('لا تقدّمَ → جولةٌ واحدة لا ثلاث؛ ولا مُصلِحَ → لا جولةَ أصلاً والقائمةُ تقول ⚠️', async () => {
    const a = scenario('rvstall'); const da = emptyProject(); setUserLanguage(a.ctx.username, 'ar');
    let edits = 0, verifies = 0;
    await runRequirementsVerify(mk(a, da), a.ctx.roomName, { coreEditCodePlan: async () => { edits++; return { files: [{ name: 'x.html', content: '<html></html>' }] }; } }, collect().reporter, { verify: async () => { verifies++; return verdictOf(['سلة التسوق']); } });
    assert.equal(edits, 1, 'حدُّ «لا تقدّم» يوقف الحلقةَ بعد الجولة الأولى');
    assert.equal(verifies, 2);

    const b = scenario('rvnofix'); const db = emptyProject(); setUserLanguage(b.ctx.username, 'ar');
    const { events, reporter } = collect();
    await runRequirementsVerify(mk(b, db), b.ctx.roomName, {}, reporter, { verify: async () => verdictOf(['سلة التسوق']) });
    const logs = events.filter(([ev]) => ev === 'log').map(([, m]) => m);
    assert.ok(logs.includes('[6. VERIFY] ➔ [Requirements]: 📋 1/2 متطلب منفّذ'), JSON.stringify(logs));
    assert.ok(!logs.some((m) => m.includes('إكمال الشاشات')), 'بلا coreEditCodePlan لا جولات');
    assert.equal(events.find(([ev]) => ev === 'chat_reply')?.[1], '📋 **تحقق متطلبات المشروع:**\n✅ سلة التسوق\n⚠️ الدفع — غير مكتمل (لا زر)');
});

test('الحدود: لا this في الوحدة، لا استيرادَ من jcr، والمفوِّضُ سطرٌ واحد باسم المرحلة الذي يعرفه DELIVERY_STAGES', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/requirementsVerify.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.match(code, /\{ verify = verifyRequirements \} = \{\}/, 'الحقنُ اختياريٌّ وافتراضُه الأصل');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _stageRequirementsVerify\(context, roomName, agents\) \{\n\s+return runRequirementsVerify\(context, roomName, agents, this\.reporter\);\n\s+\}/);
    for (const n of ['verifyRequirements', 'buildFixInstruction', 'formatChecklist', 'recordLesson']) {
        assert.equal((jcr.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length, 0, `${n} لم يعد لـjcr به شأن`);
    }
    const contracts = fs.readFileSync(path.join(HERE, '../core/contracts/index.js'), 'utf8');
    assert.match(contracts, /run: '_stageRequirementsVerify'/, 'النداءُ بالاسم قائم — والمفوِّضُ يجيبه');
});
