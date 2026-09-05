// 🔬 مرحلةُ التسليم `behavior-verify` تخرج من jcr: `_stageBehaviorVerify` → `stages/verify.js#runBehaviorVerifyStage(context, roomName, agents, reporter)` (JCR/18).
//
// تُستدعى بالاسم من `DELIVERY_STAGES`؛ جسدُها = نداءُ `verifyAndAutofix` بميزانيةٍ تحسم `canFix` + مساهمةٌ في مكتبة النماذج
// حين ينجح التحقّق. التوصيفُ: الميزانيةُ الغائبة أو المستنفَدة تُغلق الإصلاح؛ نداءٌ يُستهلَك من الميزانية؛ النجاحُ + فئةٌ +
// نموذجُ مجالٍ غيرُ فارغ → سطرُ المكتبة؛ نموذجٌ فارغ أو بلا فئة → صمتُ المكتبة؛ خطأٌ داخليّ لا يُسقط البناء — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runBehaviorVerifyStage } from '../agents/stages/verify.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setDomainModel } from '../agents/projectMemory.js';
import { resetLessons } from '../services/platformLessons.js';
import { librarySummary, _resetForTest as resetLibrary } from '../agents/modelLibrary.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const page = (body) => `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>x</h1>${body}<script src="script.js"></script></body></html>`;
const GOOD_JS = 'document.getElementById("go").addEventListener("click",()=>{document.title="ok"});';
const write = (html, js) => { const dir = emptyProject(); fs.writeFileSync(path.join(dir, 'index.html'), html); fs.writeFileSync(path.join(dir, 'script.js'), js); return dir; };
const good = () => write(page('<button id="go">go</button>'), GOOD_JS);
const broken = () => write(page('<button id="go" onclick="missingFn()">go</button>'), 'nothing();');
const fixer = (calls = []) => ({ coreEditCodePlan: async (i, files, lang) => { calls.push(lang); return { files: [{ name: 'script.js', content: GOOD_JS }, { name: 'index.html', content: page('<button id="go">go</button>') }] }; } });
const budget = (n) => { let left = n; const used = []; return { used, consumeCall: () => { used.push(left); if (left <= 0) return false; left -= 1; return true; } }; };
const ctx = (s, dir, extra = {}) => ({ ...s.ctx, projectPath: dir, blueprint: { category: 'ecommerce' }, ...extra });
const MODEL = { entities: [{ name: 'Product', fields: [{ name: 'name', type: 'string' }] }], roles: [{ name: 'Customer' }], flows: [] };

test('بلا ميزانية: canFix=false — الثغراتُ تُبثّ ولا إصلاح ولا مكتبة', async () => {
    const s = scenario('bv0'); resetLessons(); const calls = []; const { events, reporter } = collect();
    await runBehaviorVerifyStage(ctx(s, broken()), s.ctx.roomName, fixer(calls), reporter);
    assert.equal(calls.length, 0); assert.equal(logs(events).length, 1); assert.ok(logs(events)[0].includes('ثغرات سلوكية'));
});

test('ميزانيةٌ مستنفَدة: نداءٌ واحد يُستهلَك (يعود false) → لا إصلاح؛ وميزانيةٌ حيّة → إصلاحٌ ثمّ مكتبةٌ حين النموذجُ غيرُ فارغ', async () => {
    const s = scenario('bv1'); resetLessons(); setDomainModel(s.ctx.username, s.ctx.activeProject, MODEL);
    const empty = budget(0); const calls = []; const { events, reporter } = collect();
    await runBehaviorVerifyStage(ctx(s, broken(), { budget: empty }), s.ctx.roomName, fixer(calls), reporter);
    assert.deepEqual(empty.used, [0]); assert.equal(calls.length, 0); assert.ok(!logs(events).some((m) => m.includes('[ModelLibrary]')));
    const live = budget(3); const n = collect(); resetLibrary();
    await runBehaviorVerifyStage(ctx(s, broken(), { budget: live }), s.ctx.roomName, fixer(calls), n.reporter);
    const entry = librarySummary().find((e) => e.category === 'ecommerce');
    assert.equal(entry?.verified, 1, 'النموذجُ يُحفظ مُجرَّباً (verified) لا مجرّدَ محفوظ');
    assert.deepEqual(live.used, [3], 'نداءٌ واحد من الميزانية مهما كانت النتيجة');
    // 🔎 اكتشافٌ (لا يُغيَّر هنا): `getUserLanguage(...) || 'ar'` — الاحتياطُ 'ar' ميّت لأنّ getUserLanguage تعود 'en' لا فارغاً
    // (أخو JCR/متابعة-أ)، فمستخدمٌ بلا لغةِ جلسة يستلم تعليمةَ الإصلاح بالإنجليزيّة. مثبَّتٌ كما هو.
    assert.deepEqual(calls, ['en']);
    const L = logs(n.events);
    assert.equal(L.at(-1), '[6. VERIFY] ➔ [ModelLibrary]: 📚 أُغني فهم فئة «ecommerce» بنموذج مُجرَّب — يستفيد منه كل مشروع لاحق.');
    assert.ok(L.some((m) => m.endsWith('(أُصلح تلقائياً)')), 'المكتبةُ بعد الإصلاح لا قبله');
});

test('نجاحٌ بلا فئةٍ أو بنموذجٍ فارغ → لا سطرَ للمكتبة', async () => {
    const s = scenario('bv2'); resetLessons(); setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
    const a = collect();
    await runBehaviorVerifyStage(ctx(s, good(), { budget: budget(1) }), s.ctx.roomName, null, a.reporter);
    assert.deepEqual(logs(a.events).map((m) => m.split(']: ')[0]), ['[6. VERIFY] ➔ [BehaviorVerifier'], 'نموذجٌ فارغ لا يُحفظ');
    setDomainModel(s.ctx.username, s.ctx.activeProject, MODEL);
    for (const blueprint of [null, {}, { category: '' }]) {
        const b = collect();
        await runBehaviorVerifyStage(ctx(s, good(), { budget: budget(1), blueprint }), s.ctx.roomName, null, b.reporter);
        assert.equal(logs(b.events).length, 1, `بلا فئةٍ (${JSON.stringify(blueprint)}) لا مكتبة`);
    }
});

test('خطأٌ داخليّ (سياقٌ بلا حقول) لا يرمي — لا يُسقط البناء', async () => {
    const s = scenario('bv3'); const { events, reporter } = collect();
    await runBehaviorVerifyStage({}, s.ctx.roomName, null, reporter);
    await runBehaviorVerifyStage(null, s.ctx.roomName, null, reporter);
    assert.deepEqual(events, []);
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — بثّاً', async () => {
    const s = scenario('bvq'); resetLessons(); setDomainModel(s.ctx.username, s.ctx.activeProject, MODEL);
    await s.rt._stageBehaviorVerify(ctx(s, broken(), { budget: budget(2) }), s.ctx.roomName, fixer());
    const { events, reporter } = collect();
    await runBehaviorVerifyStage(ctx(s, broken(), { budget: budget(2) }), s.ctx.roomName, fixer(), reporter);
    assert.deepEqual(logs(events), s.events.filter((e) => e.ev === 'log').map((e) => e.payload.message));
});

test('الحدود: المرحلةُ تجاور verifyAndAutofix في الوحدة نفسِها، المفوِّضُ سطرٌ واحد بـagents، وrecordModel لم يعد في jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/verify.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.equal((code.match(/\}, reporter\);/g) || []).length, 1, 'النداءُ الداخليّ يمرّر المُبلِّغَ نفسَه');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes('\n    async _stageBehaviorVerify(context, roomName, agents) {\n        return runBehaviorVerifyStage(context, roomName, agents, this.reporter);\n    }\n'));
    assert.equal((jcr.replace(/^import .*$/gm, '').match(/\brecordModel\b/g) || []).length, 0);
});
