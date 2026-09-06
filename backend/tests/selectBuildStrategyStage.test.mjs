// 🧭 `stages/selectBuildStrategy.js#selectBuildStrategy(goal, blueprint, ctx, reporter, ops)` — JCR/29.
//
// قرارُ الاختيار نفسُه موصَّفٌ عبر المفوِّض في `jcrBuildStrategy` (١١) و`jcrMissionStrategy` (١٣). هنا نوصّف ما لا يُرى إلّا على الشقّ:
// تلميحُ المسار `ops.trackOf(roomName)` يُقرأ مرّةً واحدة وفي فرع الكلون فقط ويُغيّر المطابقة فعلاً (`system` يُقصي كلونات المواقع)؛
// رسالتا «يعمل» بالإنجليزيّة نصّاً؛ وسائطُ البناة الثلاثة كاملةً (السياقُ المجمَّد نفسُه، `sections` الافتراضيّة)؛ ثمّ التكافؤ مع
// المفوِّض على `rt.trackByRoom`، والحدودُ على شريحة الجسد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { selectBuildStrategy } from '../agents/stages/selectBuildStrategy.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { tempProject, workingProject, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness({ dir = null, lang = 'ar', track = undefined } = {}) {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const built = { registry: [], clone: [], react: [] }; const trackCalls = [];
    const ops = {
        buildFromRegistry: async (goal, ctx) => { built.registry.push({ goal, ctx }); return { success: true, via: 'registry' }; },
        buildFromClone: async (clone, goal, ctx) => { built.clone.push({ clone, goal, ctx }); return { success: true, via: 'clone' }; },
        buildReactProject: async (goal, ctx, opts) => { built.react.push({ goal, ctx, opts }); return { success: true, via: 'react' }; },
        trackOf: (room) => { trackCalls.push(room); return track; },
    };
    const username = `__strat_u${seq}_${Date.now()}__`;
    setUserLanguage(username, lang);
    const roomName = `strat_room_${seq}`;
    const ctx = createExecutionContext({ username, roomName, activeProject: `strat-${seq}`, projectPath: dir || emptyProject(), agents: {} });
    const pick = (goal, blueprint = null) => selectBuildStrategy(goal, blueprint, ctx, reporter, ops);
    const replies = () => events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload.message);
    const logs = () => events.filter((e) => e.ev === 'log').map((e) => e.payload.message);
    const noneBuilt = () => built.registry.length + built.clone.length + built.react.length === 0;
    return { events, built, trackCalls, ctx, roomName, pick, replies, logs, noneBuilt };
}
const isDelivery = (r, built) => r?.via === 'clone' && /food|delivery/i.test(String(built.clone[0]?.clone?.id));

test('trackOf: يُقرأ مرّةً باسم الغرفة في فرع الكلون فقط — لا في المسار التسويقيّ ولا عند الاستئناف — والتلميحُ system يُقصي كلونَ التوصيل', async () => {
    const m = harness({ dir: emptyProject() });
    assert.equal((await m.pick('صفحة هبوط لشركة استشارات', { kind: 'landing' })).via, 'registry');
    assert.deepEqual(m.trackCalls, [], 'المسارُ التسويقيّ يعود قبل مطابقة الكلون');
    const d = harness({ dir: emptyProject() });
    const r = await d.pick('تطبيق توصيل طعام من المطاعم', { kind: 'webapp' });
    assert.ok(isDelivery(r, d.built), 'بلا تلميحٍ → كلونُ التوصيل');
    assert.deepEqual(d.trackCalls, [d.roomName]);
    const sys = harness({ dir: emptyProject(), track: 'system' });
    const rs = await sys.pick('تطبيق توصيل طعام من المطاعم', { kind: 'webapp' });
    assert.deepEqual(sys.trackCalls, [sys.roomName]);
    assert.equal(isDelivery(rs, sys.built), false, 'تلميحُ «نظام» يُقصي كلونات المواقع فلا يُطابَق التوصيل');
    const c = harness({ dir: workingProject() });
    assert.equal(await c.pick('[استئناف] تابع تطوير المشروع القائم — لا تبدأ من الصفر. تطبيق توصيل طعام', { kind: 'webapp' }), null);
    assert.deepEqual(c.trackCalls, [], 'الاستئنافُ على مشروعٍ قائم لا يطابق كلوناً أصلاً');
});

test('رسالتا «يعمل» بالإنجليزيّة نصّاً: تسويقيّ على تطبيقٍ يعمل، وكلونٌ مطابق على تطبيقٍ يعمل — بلا بناء', async () => {
    const m = harness({ dir: workingProject(), lang: 'en' });
    assert.deepEqual(await m.pick('صمم صفحة تعريفية للمطعم', { kind: 'brochure' }), { success: true, skipped: 'works' });
    assert.deepEqual(m.replies(), ['✅ Your current app is working, so I won\'t replace it with a static marketing page. Tell me a specific change to add to it, or type "rebuild" if you really want to start over as a landing page.']);
    assert.ok(m.noneBuilt()); assert.match(m.logs().at(-1), /لا يُستبدل بصفحة تسويقية دون «أعد البناء» صريحة/);
    const c = harness({ dir: workingProject(), lang: 'en' });
    assert.deepEqual(await c.pick('تطبيق توصيل طعام', { kind: 'webapp' }), { success: true, skipped: 'works' });
    assert.deepEqual(c.replies(), ['✅ Your app is already working (customer + staff panels with role-based login). Tell me a specific change to add (e.g. "add a ratings section"), or "rebuild" to start fresh.']);
    assert.ok(c.noneBuilt()); assert.match(c.logs().at(-1), /تفادينا إعادة بناء تدهسه/);
});

test('وسائطُ البناة: السجلُّ (goal, ctx)، الكلونُ (clone, goal, ctx)، React (goal, ctx, {sections}) — السياقُ المجمَّد نفسُه، وsections الافتراضيّة []', async () => {
    const reg = harness({ dir: emptyProject() });
    await reg.pick('صفحة هبوط لشركة استشارات', { kind: 'landing' });
    assert.equal(reg.built.registry[0].goal, 'صفحة هبوط لشركة استشارات'); assert.equal(reg.built.registry[0].ctx, reg.ctx); assert.ok(Object.isFrozen(reg.built.registry[0].ctx));
    const cl = harness({ dir: tempProject() });
    assert.equal((await cl.pick('تطبيق توصيل طعام', { kind: 'webapp' })).via, 'clone', 'مشروعٌ معطّل → يُصلَح بالكلون');
    assert.ok(cl.built.clone[0].clone?.id); assert.equal(cl.built.clone[0].goal, 'تطبيق توصيل طعام'); assert.equal(cl.built.clone[0].ctx, cl.ctx);
    const re = harness({ dir: emptyProject() });
    assert.equal((await re.pick('منصة تجارة إلكترونية', { category: 'ecommerce' })).via, 'react');
    assert.deepEqual(re.built.react[0], { goal: 'منصة تجارة إلكترونية', ctx: re.ctx, opts: { sections: [] } });
    assert.match(re.logs().at(-1), /مشروع كبير → React\/Next/);
});

test('حدُّ الجدّة والنطاق: صفحةٌ أقصر من ٨٠ حرفاً بناءٌ جديد → React للكبير؛ ونطاقُ الخطّة «كامل» في ذاكرة المشروع يرفع النوعَ الصغير إلى React', async () => {
    const tiny = harness({ dir: tempProject('<h1>x</h1>') });
    assert.equal((await tiny.pick('منصة تجارة إلكترونية', { category: 'ecommerce' })).via, 'react', 'محتوىً قصير (٣١ حرفاً مع ترويسة القارئ) = بناءٌ جديد');
    const scoped = harness({ dir: emptyProject() });
    getProjectMemory(scoped.ctx.username, scoped.ctx.activeProject).plan = { scope: 'كامل' };
    assert.equal((await scoped.pick('موقع لمطعم صغير', { category: 'business' })).via, 'react', 'النطاقُ «كامل» يقرّر React ولو كان النوعُ صغيراً');
    const plain = harness({ dir: emptyProject() });
    assert.equal(await plain.pick('موقع لمطعم صغير', { category: 'business' }), null, 'بلا نطاقٍ → النواة');
});

test('الدالّةُ الحرّةُ ≡ المفوِّض: تلميحُ rt.trackByRoom يصل المطابقةَ عبر المفوِّض، وغيابُ الخريطة لا يرمي', async () => {
    const mk = (trackMap) => {
        seq += 1;
        const events = [];
        const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
        const built = { registry: [], clone: [], react: [] };
        rt._buildFromRegistry = async (goal, ctx) => { built.registry.push({ goal, ctx }); return { success: true, via: 'registry' }; };
        rt._buildFromClone = async (clone, goal, ctx) => { built.clone.push({ clone, goal, ctx }); return { success: true, via: 'clone' }; };
        rt._buildReactProject = async (goal, ctx, opts) => { built.react.push({ goal, ctx, opts }); return { success: true, via: 'react' }; };
        if (trackMap) rt.trackByRoom = trackMap;
        const username = `__strat_cls${seq}_${Date.now()}__`; setUserLanguage(username, 'ar');
        const roomName = `strat_cls_room_${seq}`;
        const ctx = createExecutionContext({ username, roomName, activeProject: `strat-cls-${seq}`, projectPath: emptyProject(), agents: {} });
        return { rt, built, ctx, roomName, events };
    };
    const plain = mk(null);
    const r1 = await plain.rt._selectBuildStrategy('تطبيق توصيل طعام من المطاعم', { kind: 'webapp' }, plain.ctx);
    assert.ok(isDelivery(r1, plain.built), 'بلا خريطةٍ على النسخة → undefined → كلونُ التوصيل');
    const sys = mk(new Map());
    sys.rt.trackByRoom.set(sys.roomName, 'system');
    const r2 = await sys.rt._selectBuildStrategy('تطبيق توصيل طعام من المطاعم', { kind: 'webapp' }, sys.ctx);
    assert.equal(isDelivery(r2, sys.built), false, 'التلميحُ على النسخة يصل المطابقة عبر المفوِّض');
    const free = harness({ dir: emptyProject(), track: 'system' });
    const r3 = await free.pick('تطبيق توصيل طعام من المطاعم', { kind: 'webapp' });
    assert.deepEqual([r3?.via ?? null, free.built.clone[0]?.clone?.id ?? null], [r2?.via ?? null, sys.built.clone[0]?.clone?.id ?? null], 'النتيجةُ نفسُها على الشقّ');
    const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload.message]);
    assert.deepEqual(shape(free.events), shape(sys.events));
});

test('الحدود: شريحةُ الجسد — readCodeContext ×١، liveLog ٨ (٥ + ثلاثةُ أسطر الفهم)، send ٢، ops أربعةٌ مرّةً لكلٍّ ولا خامس، لا this ولا io، المفوِّضُ بنصّه، اليتائمُ الستّ غائبة، وtrackByRoom في jcr كاتبٌ ومفوِّض فقط', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/selectBuildStrategy.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/\bio\b/.test(code));
    assert.ok(mod.includes("import { resolveProjectType } from './enrich.js';"), 'نوعُ المشروع من مصدره لا من واجهة jcr');
    const fnStart = code.indexOf('export async function selectBuildStrategy(goal, blueprint, ctx, reporter, ops) {');
    assert.ok(fnStart > 0);
    const body = code.slice(fnStart, code.indexOf('\n}\n', fnStart) + 3);
    const count = (re) => (body.match(re) || []).length;
    assert.deepEqual(
        { registry: count(/ops\.buildFromRegistry\(/g), clone: count(/ops\.buildFromClone\(/g), react: count(/ops\.buildReactProject\(/g), track: count(/ops\.trackOf\(/g), all: count(/\bops\.\w+/g) },
        { registry: 1, clone: 1, react: 1, track: 1, all: 4 }, 'قِيست قبل النقل');
    assert.equal(count(/\breadCodeContext\(/g), 1, 'القارئُ يُستورد لا يُمرَّر');
    assert.equal(count(/reporter\.send\(/g), 2);
    assert.equal(count(/reporter\.liveLog\(/g), 8, 'JCR/29: ٥؛ PM/1 أضاف ثلاثةَ أسطر «ProductMind» (المستبعَد بالفهم، والمختار بدليله، وفجوةُ الأدوار على مشروعٍ يعمل)');
    assert.equal(count(/\btransitionState\(/g), 2); assert.equal(count(/\banalyzeProjectStatic\(/g), 2);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _selectBuildStrategy(goal, blueprint, ctx) {
        return selectBuildStrategy(goal, blueprint, ctx, this.reporter, {
            buildFromRegistry: (g, c) => this._buildFromRegistry(g, c),
            buildFromClone: (clone, g, c) => this._buildFromClone(clone, g, c),
            buildReactProject: (g, c, o) => this._buildReactProject(g, c, o),
            trackOf: (room) => this.trackByRoom?.get(room),
        });
    }\n`));
    assert.ok(jcr.includes("import { selectBuildStrategy } from './stages/selectBuildStrategy.js';"));
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    for (const n of ['isContinuationGoal', 'isExplicitNewBuild', 'isExplicitRebuild', 'isMarketingPageGoal', 'matchCloneTemplate', 'resolveStack']) assert.ok(!new RegExp(`\\b${n}\\b`).test(plain), `${n} ما زال في jcr`);
    // JCR/31: ردُّ الشات كان آخرَ مستهلكٍ لبعض هذه الأسماء في `jcr`، فخرج استيرادُها معه.
    // ما غادر يُثبَّت غيابُه هنا صراحةً — لا يُحذف السطرُ بصمت.
    assert.ok(!new RegExp(`\\banalyzeProjectStatic\\b`).test(typeof plain !== 'undefined' ? plain : jcr), 'analyzeProjectStatic غادر jcr مع JCR/31');
    assert.ok(!new RegExp(`\\bgetProjectMemory\\b`).test(typeof plain !== 'undefined' ? plain : jcr), 'getProjectMemory غادر jcr مع JCR/31');
    for (const n of ['getDomainModel', 'transitionState', 'STATES', 'resolveProjectType', 'readCodeContext', 'normalizeText', 'detectIntentFromMeaning']) assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
    assert.equal((plain.match(/this\.trackByRoom/g) || []).length, 2, 'الكاتبُ في handleUserMessage + الدالّةُ المربوطة في المفوِّض — لا قارئَ ثالث');
});
