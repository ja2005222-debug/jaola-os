// 🧭 `stages/intentHandlers.js` — JCR/25: `handlePlanningStage` و`handleModifyPattern` (req, agents, reporter, ops) → boolean.
//
// `jcrRuntimeFlows` يوصّف المسارَين عبر `handleUserMessage` مستبدِلاً `executeMission`/`surgicalEdit` على النسخة؛ هذا الملفّ
// يوصّف **الشقَّ** (`ops.executeMission`/`ops.surgicalEdit` بسياقِ الطلب المجمَّد)، وما لم يكن موصَّفاً (تهيئةُ ذاكرة المشروع من
// المُوضِّح وتسجيلُه، التأكيدُ بلا خطّة، النمطُ بالهمزة عبر التطبيع، النمطُ داخل مرحلة الخطّة)، والتكافؤَ مع المفوِّضَين، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { handlePlanningStage, handleModifyPattern } from '../agents/stages/intentHandlers.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { getUserProfile } from '../agents/userProfile.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness() {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const missions = [], edits = [];
    const ops = { executeMission: (goal, ctx) => { missions.push({ goal, ctx }); }, surgicalEdit: (goal, ctx) => { edits.push({ goal, ctx }); } };
    const username = `__ih_u${seq}_${Date.now()}__`;
    const ctx = { username, roomName: `ih_room_${seq}`, activeProject: `ih-${seq}`, projectPath: `/nonexistent/ih_${seq}` };
    const req = (message, extra = {}) => ({ message, normalizedMessage: message, ...ctx, userLang: 'ar', ...extra });
    const replies = () => events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload.message);
    return { events, replies, missions, edits, ctx, req, reporter, ops };
}
const planState = (extra = {}) => ({ stage: 'planning', lang: 'ar', originalGoal: 'مطعم بحري', plan: { sections: ['القائمة', 'الحجز'], features: ['حجز طاولة'], colorMood: 'أزرق' }, projectType: 'restaurant', answers: [], ...extra });

test('الخطّة + تأكيد: ops.executeMission بالهدف النهائيّ وسياقِ الطلب المجمَّد؛ الذاكرةُ تُهيَّأ من المُوضِّح والمشروعُ يُسجَّل في الملفّ', async () => {
    const h = harness();
    const state = planState();
    const agents = { getState: () => state, isConfirmation: (m) => m === 'ابدأ', getFinalGoal: () => 'ابنِ موقع مطعم بحري بقائمة وحجز طاولة' };
    assert.equal(await handlePlanningStage(h.req('ابدأ', { clarifierState: state }), agents, h.reporter, h.ops), true);
    assert.equal(h.missions.length, 1);
    assert.equal(h.missions[0].goal, 'ابنِ موقع مطعم بحري بقائمة وحجز طاولة');
    const c = h.missions[0].ctx;
    assert.ok(Object.isFrozen(c)); assert.equal(c.agents, agents); assert.equal(c.username, h.ctx.username); assert.equal(c.projectPath, h.ctx.projectPath);
    assert.deepEqual(h.replies(), ['🚀 ممتاز! بدأت البناء الآن...']);
    const mem = getProjectMemory(h.ctx.username, h.ctx.activeProject);
    assert.deepEqual(mem.structure.sections, ['القائمة', 'الحجز']); assert.deepEqual(mem.structure.features, ['حجز طاولة']); assert.equal(mem.design.colors, 'أزرق');
    const profile = getUserProfile(h.ctx.username);
    assert.equal(profile.projectTypes.restaurant, 1); assert.equal(profile.stats.totalProjects, 1);
});

test('الخطّة + تأكيد بلا خطّةٍ في الحالة: التنفيذُ يمضي ولا تهيئةَ ولا تسجيل؛ وخارجَ مرحلة الخطّة → false بلا بثّ', async () => {
    const h = harness();
    const state = { stage: 'planning', lang: 'en', answers: [] };
    const agents = { getState: () => state, isConfirmation: () => true, getFinalGoal: () => 'build it' };
    assert.equal(await handlePlanningStage(h.req('start', { clarifierState: state }), agents, h.reporter, h.ops), true);
    assert.equal(h.missions[0].goal, 'build it');
    assert.deepEqual(h.replies(), ['🚀 Great! Building now...']);
    assert.equal(getUserProfile(h.ctx.username).stats.totalProjects, 0, 'لا تسجيلَ بلا خطّة');
    const n = h.events.length;
    assert.equal(await handlePlanningStage(h.req('ابدأ', { clarifierState: { stage: 'clarifying' } }), agents, h.reporter, h.ops), false);
    assert.equal(await handlePlanningStage(h.req('ابدأ'), agents, h.reporter, h.ops), false);
    assert.equal(h.events.length, n); assert.equal(h.missions.length, 1);
});

test('الخطّة بلا تأكيد: سؤالٌ → ملخّصٌ بالإنجليزيّة حين lang=en؛ ولا خطّةَ → «لم تُبنَ خطة بعد»', async () => {
    const h = harness();
    const agents = { getState: () => null, isConfirmation: () => false };
    await handlePlanningStage(h.req('what sections?', { clarifierState: planState({ lang: 'en' }) }), agents, h.reporter, h.ops);
    assert.match(h.replies().at(-1), /^Current plan includes: الأقسام: القائمة، الحجز \| الميزات: حجز طاولة/);
    await handlePlanningStage(h.req('ماهي الخطة؟', { clarifierState: { stage: 'planning', lang: 'ar' } }), agents, h.reporter, h.ops);
    assert.match(h.replies().at(-1), /لم تُبنَ خطة بعد/);
    assert.equal(h.missions.length, 0);
});

test('النمط: «أضف …» بالهمزة يُلتقط عبر التطبيع → سطرُ النيّة ثمّ ops.surgicalEdit بالرسالة الخام وسياقِ الطلب المجمَّد؛ وبلا نمط → false', async () => {
    const h = harness();
    const agents = { getState: () => null };
    assert.equal(await handleModifyPattern(h.req('أضف قسم تقييمات'), agents, h.reporter, h.ops), true);
    assert.equal(h.edits.length, 1); assert.equal(h.edits[0].goal, 'أضف قسم تقييمات');
    assert.ok(Object.isFrozen(h.edits[0].ctx)); assert.equal(h.edits[0].ctx.agents, agents);
    assert.match(h.events.filter((e) => e.ev === 'log').at(-1).payload.message, /نية: modify \(ثقة: 100%\) - قاعدة مباشرة/);
    assert.equal(h.replies().length, 0);
    const n = h.events.length;
    assert.equal(await handleModifyPattern(h.req('كم سعر الباقة؟'), agents, h.reporter, h.ops), false);
    assert.equal(h.events.length, n); assert.equal(h.edits.length, 1);
});

test('النمط داخل مرحلة الخطّة: تعديلٌ عليها لا تنفيذ — اللونُ سؤالٌ بلا تسجيل، وغيرُه يُسجَّل في الإجابات', async () => {
    const h = harness();
    const state = planState();
    const agents = { getState: () => state };
    assert.equal(await handleModifyPattern(h.req('غير الالوان الى ذهبي', { clarifierState: state }), agents, h.reporter, h.ops), true);
    assert.match(h.replies().at(-1), /^ما اللون المفضل؟/);
    assert.deepEqual(state.answers, [], 'سؤالُ اللون هنا لا يُسجَّل (بخلاف مرحلة الخطّة نفسِها)');
    assert.equal(await handleModifyPattern(h.req('اضف قسم آراء', { clarifierState: state }), agents, h.reporter, h.ops), true);
    assert.deepEqual(state.answers, ['edit: اضف قسم آراء']);
    assert.match(h.replies().at(-1), /فهمت! سأراعي: "اضف قسم آراء"/);
    assert.equal(h.edits.length, 0, 'لا تعديلَ جراحيّاً في مرحلة الخطّة');
});

test('الدالّتان الحرّتان ≡ المفوِّضان — بثّاً ونداءً، والاستبدالاتُ على النسخة تصل', async () => {
    const events = [];
    const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
    const seen = { mission: [], edit: [] };
    rt.executeMission = (goal, c) => { seen.mission.push({ goal, c }); };
    rt.surgicalEdit = (goal, c) => { seen.edit.push({ goal, c }); };
    const free = harness();
    const state = planState({ projectType: 'shop' });
    const agents = { getState: () => state, isConfirmation: (m) => m === 'ابدأ', getFinalGoal: () => 'ابنِ متجراً' };
    const uname = `__ih_cls_${Date.now()}__`;
    const reqC = (m, extra = {}) => ({ message: m, normalizedMessage: m, username: uname, roomName: 'ih_room_cls', activeProject: 'ih-cls', projectPath: '/nonexistent/ih_cls', userLang: 'ar', ...extra });
    assert.equal(await rt._handlePlanningStage(reqC('ابدأ', { clarifierState: state }), agents), await handlePlanningStage(free.req('ابدأ', { clarifierState: planState({ projectType: 'shop' }) }), agents, free.reporter, free.ops));
    assert.equal(seen.mission.length, 1); assert.equal(seen.mission[0].goal, 'ابنِ متجراً'); assert.equal(free.missions[0].goal, 'ابنِ متجراً');
    assert.equal(await rt._handleModifyPattern(reqC('عدل: غير لون الهيدر'), { getState: () => null }), true);
    assert.equal(await handleModifyPattern(free.req('عدل: غير لون الهيدر'), { getState: () => null }, free.reporter, free.ops), true);
    assert.equal(seen.edit.length, 1); assert.equal(seen.edit[0].goal, 'عدل: غير لون الهيدر'); assert.ok(Object.isFrozen(seen.edit[0].c));
    const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload?.message === 'string' ? e.payload.message : null]);
    assert.deepEqual(shape(events), shape(free.events));
});

test('الحدود: لا this، لا استيرادَ من jcr، لا io، أعدادُ ops وreporter على مستوى الملفّ بالقياس، المفوِّضان بنصّهما، واليتيماتُ الثلاث غائبةٌ عن jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/intentHandlers.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/\bio\b/.test(code), 'لا io هنا — لا مرحلةَ تبثّ بنفسها');
    const count = (re) => (code.match(re) || []).length;
    // سجلُّ الملفّ بالقياس: JCR/26 أضاف `handleBareConfirmations` (executeMission +١، surgicalEdit +٢، send +٣، liveLog +٣)،
    // وJCR/27 أضاف `handleUnifiedRoute` (surgicalEdit +٢، generateChatResponse +١، send +٣، liveLog +١)، وJCR/28 أضاف `handleClassifiedIntent`
    // (classifyIntent +١، surgicalEdit +٣، generateChatResponse +٣، send +٤، liveLog +٩). عقدُ كلِّ معالجٍ في اختباره.
    assert.equal(count(/ops\.executeMission\(/g), 2); assert.equal(count(/ops\.surgicalEdit\(/g), 8); assert.equal(count(/ops\.generateChatResponse\(/g), 4); assert.equal(count(/ops\.classifyIntent\(/g), 1); assert.equal(count(/\bops\.\w+/g), 15);
    assert.equal(count(/reporter\.send\(/g), 17); assert.equal(count(/reporter\.liveLog\(/g), 14);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _handlePlanningStage(req, agents) {
        return handlePlanningStage(req, agents, this.reporter, {
            executeMission: (goal, c) => this.executeMission(goal, c),
        });
    }\n`));
    assert.ok(jcr.includes(`\n    async _handleModifyPattern(req, agents) {
        return handleModifyPattern(req, agents, this.reporter, {
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
        });
    }\n`));
    assert.match(jcr, /import \{[^}]*\bhandlePlanningStage\b[^}]*\bhandleModifyPattern\b[^}]*\} from '\.\/stages\/intentHandlers\.js';/);
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    for (const n of ['initFromClarifier', 'recordProject', 'normalizeArabic']) assert.ok(!new RegExp(`\\b${n}\\b`).test(plain), `${n} ما زال في jcr`);
    // `recordEdit`/`contextFromRequest` كانا هنا يومَ JCR/25 — خرجا بعدها مع المصنِّف الأخير (JCR/28)؛ القائمةُ تتبع القياس.
    // JCR/31: ردُّ الشات كان آخرَ مستهلكٍ لبعض هذه الأسماء في `jcr`، فخرج استيرادُها معه.
    // ما غادر يُثبَّت غيابُه هنا صراحةً — لا يُحذف السطرُ بصمت.
    assert.ok(!new RegExp(`\\bgetProjectMemory\\b`).test(typeof plain !== 'undefined' ? plain : jcr), 'getProjectMemory غادر jcr مع JCR/31');
    for (const n of ['addToHistory', 'getDomainModel', 'updateLanguage', 'normalizeText']) assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
});
