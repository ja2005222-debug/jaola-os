// 🧠 `stages/ceoIntent.js#handleCeoIntent(req, agents, reporter, ops)` — JCR/24.
//
// `jcrCeoIntent` (١٠) يوصّف النوايا الخمس عبر المفوِّض مستبدِلاً `executeMission` على النسخة؛ هذا الملفّ يوصّف **الشقَّ**
// (`ops.executeMission` بالهدف الموسوم وسياقِ الطلب المجمَّد)، وتسريبَ `io` المعلَنَ في موضعَيه (وكيلُ النشر يتلقّى `reporter.io`)،
// والتكافؤَ مع المفوِّض، والحدود. كلُّ شيءٍ حتميّ: قواعدُ نصّيّة وذاكرةُ مشروعٍ وصفُّ تنفيذٍ خامل — بلا شبكة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { handleCeoIntent } from '../agents/stages/ceoIntent.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { addToHistory } from '../agents/projectMemory.js';
import { emptyProject, tempProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness({ dir = null } = {}) {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const missions = [], deployCalls = [];
    const ops = { executeMission: (goal, ctx) => { missions.push({ goal, ctx }); } };
    const agents = { getState: () => null, deployProject: async (...a) => { deployCalls.push(a); return {}; } };
    const username = `__ceostage_u${seq}_${Date.now()}__`;
    setUserLanguage(username, 'ar');
    const ctx = { username, roomName: `ceostage_room_${seq}`, activeProject: `ceostage-${seq}`, projectPath: dir || emptyProject() };
    const req = (message) => ({ message, normalizedMessage: message, ...ctx, userLang: 'ar' });
    const handle = (message) => handleCeoIntent(req(message), agents, reporter, ops);
    const replies = () => events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload.message);
    return { handle, req, events, replies, missions, deployCalls, ctx, io, reporter, agents };
}
const until = async (pred, ms = 1500) => { const t0 = Date.now(); while (!pred() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 20)); };

test('الشقّ: «اكمل» مع ذاكرة → ops.executeMission بهدفٍ موسومٍ [استئناف] وسياقِ الطلب المجمَّد بوكلائه', async () => {
    const h = harness();
    addToHistory(h.ctx.username, h.ctx.activeProject, 'بناء: متجر عسل مع سلة');
    assert.equal(await h.handle('اكمل'), true);
    assert.equal(h.missions.length, 1);
    assert.match(h.missions[0].goal, /استئناف/);
    const c = h.missions[0].ctx;
    assert.ok(Object.isFrozen(c), 'سياقُ تنفيذٍ حقيقيّ من الطلب');
    assert.equal(c.username, h.ctx.username); assert.equal(c.roomName, h.ctx.roomName); assert.equal(c.projectPath, h.ctx.projectPath);
    assert.equal(c.agents, h.agents, 'الوكلاءُ أنفسُهم بالهويّة');
    assert.match(h.replies().at(-1), /وجدت المشروع في الذاكرة/);
});

test('الردودُ الفوريّة لا تلمس ops: حالة/تحيّة/اكمل بلا ذاكرة → true وردٌّ واحد وصفرُ مهامّ؛ وبلا نيّة → false بلا بثّ', async () => {
    const h = harness();
    for (const [m, re] of [['أين وصلنا', /./], ['مرحبا', /./], ['اكمل', /لا أجد مشروعاً سابقاً/]]) {
        const before = h.events.length;
        assert.equal(await h.handle(m), true, m);
        assert.equal(h.events.filter((e) => e.ev === 'chat_reply').length - h.events.slice(0, before).filter((e) => e.ev === 'chat_reply').length, 1, m);
        assert.match(h.replies().at(-1), re, m);
    }
    assert.equal(h.missions.length, 0);
    const n = h.events.length;
    assert.equal(await h.handle('اضف صفحة للسائق'), false);
    assert.equal(h.events.length, n, 'لا بثَّ حين لا نيّةَ سريعة');
    // ترتيبُ الأفضليّة: النصُّ المطبَّع (من `normalizeText` في handleUserMessage) يُقرأ قبل الخام، والخامُ احتياطٌ حين يغيب.
    // (قاموسُ التطبيع اليوم لا يصحّح كلمةَ نيّةٍ إداريّة، فالفرقُ لا يُرى من الرسائل الحقيقيّة — يُثبَّت العقدُ لا الحالة.)
    assert.equal(await handleCeoIntent({ ...h.req('zzz'), normalizedMessage: 'أين وصلنا' }, h.agents, h.reporter, { executeMission() {} }), true, 'المطبَّعُ أوّلاً');
    assert.equal(await handleCeoIntent({ ...h.req('أين وصلنا'), normalizedMessage: undefined }, h.agents, h.reporter, { executeMission() {} }), true, 'الخامُ احتياطاً');
});

test('تسريبُ io المعلَن: وكيلُ النشر يتلقّى reporter.io لا شيئاً آخر، والنيّةُ والقرارُ في السجلّ', async () => {
    const h = harness({ dir: tempProject() });
    assert.equal(await h.handle('انشر الموقع'), true);
    await until(() => h.deployCalls.length === 1);
    const [opts, io, cb] = h.deployCalls[0];
    assert.equal(io, h.io, 'io المُبلِّغ نفسُه يُمرَّر لوكيل النشر');
    assert.equal(typeof cb, 'function');
    assert.equal(opts.currentUser, h.ctx.username);
    const logs = h.events.filter((e) => e.ev === 'log').map((e) => e.payload.message);
    assert.ok(logs.some((l) => /\[INTENT\].*"intent":"deploy"/.test(l)) && logs.some((l) => /\[DECISION\]/.test(l)));
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — «انشر» بثّاً ونداءً، واستبدالُ executeMission على النسخة يصل عبر ops', async () => {
    const free = harness({ dir: tempProject() });
    assert.equal(await free.handle('انشر'), true);
    await until(() => free.deployCalls.length === 1);

    const events = [];
    const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
    const seen = [];
    rt.executeMission = (goal, c) => { seen.push({ goal, c }); };
    const deployCalls = [];
    const agents = { getState: () => null, deployProject: async (...a) => { deployCalls.push(a); return {}; } };
    const username = `__ceostage_cls_${Date.now()}__`; setUserLanguage(username, 'ar');
    const ctx = { username, roomName: 'ceostage_room_cls', activeProject: 'ceostage-cls', projectPath: tempProject() };
    const viaClass = await rt._handleCeoIntent({ message: 'انشر', normalizedMessage: 'انشر', ...ctx, userLang: 'ar' }, agents);
    assert.equal(viaClass, true);
    await until(() => deployCalls.length === 1);
    assert.equal(deployCalls[0][1], rt.io, 'المفوِّضُ يمرّر io النسخة عبر reporter.io');
    const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload?.message === 'string' ? e.payload.message.replace(/"project":"[^"]+"/, '') : null]);
    assert.deepEqual(shape(free.events), shape(events));

    addToHistory(username, 'ceostage-cls', 'بناء: متجر');
    assert.equal(await rt._handleCeoIntent({ message: 'اكمل', normalizedMessage: 'اكمل', ...ctx, userLang: 'ar' }, agents), true);
    assert.equal(seen.length, 1, 'الاستبدالُ على النسخة نافذ'); assert.match(seen[0].goal, /استئناف/);
});

test('الحدود: لا this، لا استيرادَ من jcr، ops.executeMission مرّةً ولا غيرَه، reporter.io موضعان معلَنان، المفوِّضُ بنصّه، واليتيماتُ الثماني غائبة', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/ceoIntent.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    const count = (re) => (code.match(re) || []).length;
    assert.equal(count(/ops\.executeMission\(/g), 1); assert.equal(count(/\bops\.\w+/g), 1);
    assert.equal(count(/reporter\.io\b/g), 2, 'deployToRender + وكيلُ النشر — كلاهما يبثّ بنفسه');
    assert.equal(count(/reporter\.liveLog\(/g), 2); assert.equal(count(/reporter\.send\(/g), 16);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _handleCeoIntent(req, agents) {
        return handleCeoIntent(req, agents, this.reporter, {
            executeMission: (goal, c) => this.executeMission(goal, c),
        });
    }\n`), 'المفوِّضُ سطرُ نداءٍ واحد بدالّةٍ مربوطةٍ بالنسخة');
    assert.ok(jcr.includes("import { handleCeoIntent } from './stages/ceoIntent.js';"));
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    for (const n of ['buildStatusReply', 'classifyIntentFast', 'deployToRender', 'getProjectSecrets', 'greetingReply', 'isFullStackProject', 'pushProject', 'renderServiceName']) {
        assert.ok(!new RegExp(`\\b${n}\\b`).test(plain), `${n} ما زال في jcr`);
    }
    for (const n of ['decide', 'buildContinuationGoal', 'missionBriefing', 'contextFromRequest']) {
        assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
    }
    // 🔒 آخرُ تمريرةٍ لـ`this.io` خرجت: لم يبقَ في jcr إلّا إسنادُ البانية.
    assert.equal((plain.match(/this\.io\b/g) || []).length, 1, 'jcr لا يمرّر io بنفسه بعد الآن');
});
