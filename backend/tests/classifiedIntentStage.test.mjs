// 🧭 `stages/intentHandlers.js#handleClassifiedIntent(req, agents, reporter, gate, ops)` — JCR/28.
//
// آخرُ معالجِ نيّةٍ يغادر `JaolaCognitiveRuntime`. سلوكُه عبر المفوِّض موصَّفٌ في `jcrClassifiedIntent` (المصنِّفُ مثبَّتٌ على
// {chat,50} هناك). هنا نوصّف ما لا يُرى إلّا على الشقّ: المصنِّفُ `ops.classifyIntent` يُستدعى مرّةً دائماً ونتيجتُه تُعتمد فقط
// حين ثقةُ المعنى < 75؛ الحاجزُ `gate` يُقرأ ويُكتب ويُمسح بنداءاتٍ معدودة لكلِّ فرع؛ وسائطُ `ops` كاملةً (اللغةُ تصل المحادثة،
// السياقُ مجمَّد للتعديل)؛ نصُّ التأكيد بالإنجليزيّة؛ والكلامُ القصير لا يُحجَب. ثمّ التكافؤ مع المفوِّض، والحدودُ على شريحة الجسد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { handleClassifiedIntent } from '../agents/stages/intentHandlers.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getUserProfile } from '../agents/userProfile.js';
import { setPendingGoal, getPendingGoal, clearDialog } from '../services/conversationManager.js';
import { tempProject, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness({ dir = null, lang = 'ar', classify = { intent: 'chat', confidence: 50 }, clarification = null } = {}) {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const map = new Map(); const gateCalls = [];
    const gate = {
        has: (u) => { gateCalls.push('has'); return map.has(u); }, get: (u) => { gateCalls.push('get'); return map.get(u); },
        set: (u, m) => { gateCalls.push('set'); map.set(u, m); }, delete: (u) => { gateCalls.push('delete'); map.delete(u); },
        confirmReply: (l) => { gateCalls.push('confirmReply'); return `CONFIRM:${l}`; },
    };
    const edits = [], chats = [], classifyCalls = [], cleared = [];
    const ops = {
        classifyIntent: async (m, u) => { classifyCalls.push([m, u]); return classify; },
        surgicalEdit: (goal, ctx) => { edits.push({ goal, ctx }); },
        generateChatResponse: async (...a) => { chats.push(a); },
    };
    const username = `__cls_u${seq}_${Date.now()}__`;
    setUserLanguage(username, lang); clearDialog(username);
    const ctx = { username, roomName: `cls_room_${seq}`, activeProject: `cls-${seq}`, projectPath: dir || emptyProject() };
    const agents = { getState: () => null, clearState: (u) => cleared.push(u), startClarification: async () => clarification };
    const req = (message, intent = 'chat', confidence = 95, extra = {}) =>
        ({ message, normalizedMessage: message, meaningIntent: { intent, confidence }, ...ctx, userLang: lang, ...extra });
    const run = (message, intent, confidence, extra) => handleClassifiedIntent(req(message, intent, confidence, extra), agents, reporter, gate, ops);
    const replies = () => events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload.message);
    const logs = () => events.filter((e) => e.ev === 'log').map((e) => e.payload.message);
    return { events, map, gateCalls, edits, chats, classifyCalls, cleared, ctx, agents, run, replies, logs };
}

test('المصنِّف: يُستدعى مرّةً بالرسالة المطبَّعة واسم المستخدم؛ ثقةُ المعنى ≥ 75 تطغى على نتيجته، ودونها تُعتمد نتيجتُه (سطرُ النيّة يقول أيَّهما)', async () => {
    const h = harness({ classify: { intent: 'build', confidence: 90 } });
    assert.equal(await h.run('توقف', 'stop', 95, { normalizedMessage: 'توقف!' }), true);
    assert.deepEqual(h.classifyCalls, [['توقف!', h.ctx.username]]);
    assert.deepEqual(h.cleared, [h.ctx.username], 'نيّةُ المعنى (stop 95) طغت على المصنِّف (build 90)');
    assert.match(h.logs()[0], /نية: stop \(ثقة: 95%\)/);
    const low = harness({ classify: { intent: 'stop', confidence: 80 } });
    assert.equal(await low.run('كلام عام', 'chat', 40), true);
    assert.deepEqual(low.cleared, [low.ctx.username], 'ثقةُ المعنى 40 < 75 → نتيجةُ المصنِّف (stop) هي المعتمدة');
    assert.match(low.logs()[0], /نية: stop \(ثقة: 80%\)/);
});

test('build غيرُ صريح: على مشروعٍ قائم فعلٌ → ops.surgicalEdit بسياقٍ مجمَّد ويُسجَّل، سؤالٌ بفعلٍ أو وصفٌ → محادثة بوسائطها الأربعة؛ وعلى مشروعٍ فارغ → سؤالُ التأكيد', async () => {
    const h = harness({ dir: tempProject() });
    assert.equal(await h.run('أضف قسم تقييمات', 'build'), true);
    assert.equal(h.edits.length, 1); assert.equal(h.edits[0].goal, 'أضف قسم تقييمات');
    assert.ok(Object.isFrozen(h.edits[0].ctx)); assert.equal(h.edits[0].ctx.agents, h.agents);
    assert.equal(getUserProfile(h.ctx.username).stats.totalEdits, 1);
    assert.equal(await h.run('ممكن تضيف قسم تقييمات؟', 'build'), true);
    assert.equal(await h.run('نحن نعمل على موقع تاكسي', 'build'), true);
    assert.equal(h.edits.length, 1, 'السؤالُ (ولو بفعل) والوصفُ لا يعدّلان');
    assert.deepEqual(h.chats, [['ممكن تضيف قسم تقييمات؟', h.ctx.username, h.ctx.roomName, 'ar'], ['نحن نعمل على موقع تاكسي', h.ctx.username, h.ctx.roomName, 'ar']]);
    assert.deepEqual(h.gateCalls, [], 'فرعُ build لا يلمس الحاجز');
    assert.equal(h.replies().length, 0);
    const empty = harness({ dir: emptyProject() });
    assert.equal(await empty.run('أضف قسم تقييمات', 'build'), true);
    assert.equal(empty.edits.length + empty.chats.length, 0);
    assert.match(empty.replies()[0], /هل تريد بناء موقع لـ "أضف قسم تقييمات"/);
});

test('build صريح: حوارٌ استراتيجيّ → خياراتُه بلا هدفٍ معلّق؛ وإلّا سؤالُ تأكيدٍ بلغة المستخدم (en) يعلّق الهدف — وحتّى على مشروعٍ قائم لا تعديلَ', async () => {
    const h = harness({ dir: tempProject(), clarification: { type: 'clarification', message: 'ما نوع المتجر؟', options: ['عطور', 'ملابس'] } });
    assert.equal(await h.run('ابني متجر', 'build'), true);
    assert.equal(h.edits.length + h.chats.length, 0, 'الفعلُ الصريح لا يُحوَّل تعديلاً ولا محادثةً حتّى على مشروعٍ قائم');
    const last = h.events.filter((e) => e.ev === 'chat_reply').at(-1).payload;
    assert.deepEqual(last, { message: 'ما نوع المتجر؟', options: ['عطور', 'ملابس'] });
    assert.equal(getPendingGoal(h.ctx.username), null);
    assert.match(h.logs().at(-1), /بدء حوار التخطيط/);
    const en = harness({ dir: tempProject(), lang: 'en' });
    assert.equal(await en.run('build a perfume store', 'build'), true);
    assert.equal(en.edits.length + en.chats.length, 0);
    const p = en.events.filter((e) => e.ev === 'chat_reply').at(-1).payload;
    assert.equal(p.message, `Do you want me to build a website for "a perfume store"?\n📂 It will build into your current project: "${en.ctx.activeProject}" — create a new project first if you want it separate.`);
    assert.deepEqual(p.options, ['Yes, build it now ⚡', 'No, tell me more']); assert.equal(p.pendingGoal, 'build a perfume store');
    assert.equal(getPendingGoal(en.ctx.username), 'build a perfume store');
});

test('modify: سؤالٌ → محادثة؛ جملةٌ إخباريّة → حجبٌ (gate has/set/confirmReply) بردّ الصنف؛ الإصرارُ → مسحٌ وتعديلٌ يُسجَّل؛ فعلٌ صريح → تعديلٌ بلا كتابةٍ على الحاجز', async () => {
    const h = harness({ dir: tempProject() });
    assert.equal(await h.run('ماذا يمكن أن نضيف للمشروع؟', 'modify'), true);
    assert.deepEqual(h.gateCalls, ['has']); assert.equal(h.chats.length, 1); assert.match(h.logs().at(-1), /سؤال — رد محادثة/);
    h.gateCalls.length = 0;
    assert.equal(await h.run('ولكن قائمة الأصدقاء موجودة', 'modify'), true);
    assert.deepEqual(h.gateCalls, ['has', 'set', 'confirmReply']); assert.equal(h.map.get(h.ctx.username), 'ولكن قائمة الأصدقاء موجودة');
    assert.equal(h.replies().at(-1), 'CONFIRM:ar'); assert.equal(h.edits.length, 0);
    h.gateCalls.length = 0;
    assert.equal(await h.run('ولكن قائمة الأصدقاء موجودة', 'modify'), true);
    assert.deepEqual(h.gateCalls, ['has', 'delete']); assert.equal(h.edits.length, 1); assert.equal(h.map.size, 0);
    assert.match(h.logs().at(-1), /إصرار المستخدم → تنفيذ التعديل/);
    assert.equal(getUserProfile(h.ctx.username).stats.totalEdits, 1);
    h.gateCalls.length = 0;
    assert.equal(await h.run('غيّر لون الزر إلى أخضر', 'modify'), true);
    assert.deepEqual(h.gateCalls, ['has']); assert.equal(h.edits.length, 2); assert.equal(h.replies().length, 1, 'ردٌّ واحد فقط في المسار كلِّه — ردُّ الحجب');
});

test('stop: مسحُ حالة المُوضِّح والحوار (getPendingGoal → null)، سطرُ سجلٍّ، ولا بثَّ ولا نداءَ على ops ولا على الحاجز', async () => {
    const h = harness();
    setPendingGoal(h.ctx.username, 'هدفٌ معلّق');
    assert.equal(await h.run('توقف', 'stop', 98), true);
    assert.deepEqual(h.cleared, [h.ctx.username]); assert.equal(getPendingGoal(h.ctx.username), null);
    assert.match(h.logs().at(-1), /🛑 أمر إيقاف\./);
    assert.equal(h.replies().length, 0); assert.equal(h.edits.length + h.chats.length, 0); assert.deepEqual(h.gateCalls, []);
});

test('وإلّا على مشروعٍ قائم: فعلٌ → مسحُ الحاجز وتعديل؛ جملةٌ → حجبٌ بردّ الصنف ثمّ أيُّ رسالةٍ تاليةٍ تعديل؛ سؤالٌ وكلامٌ قصير → محادثة بوسائطها؛ وبلا مشروعٍ محادثةٌ مهما كان الفعل', async () => {
    const h = harness({ dir: tempProject() });
    assert.equal(await h.run('قم بربط الصفحات ببعضها', 'chat', 40), true);
    assert.deepEqual(h.gateCalls, ['has', 'delete']); assert.equal(h.edits.length, 1); assert.match(h.logs().at(-1), /طلب على مشروع قائم → تعديل جراحي/);
    h.gateCalls.length = 0;
    assert.equal(await h.run('الصفحة الرئيسية جميلة جداً', 'chat', 40), true);
    assert.deepEqual(h.gateCalls, ['has', 'set', 'confirmReply']); assert.equal(h.replies().at(-1), 'CONFIRM:ar'); assert.equal(h.edits.length, 1);
    h.gateCalls.length = 0;
    assert.equal(await h.run('الترويسة أيضاً', 'chat', 40), true);
    assert.deepEqual(h.gateCalls, ['has', 'delete']); assert.equal(h.edits.length, 2); assert.match(h.logs().at(-1), /رسالة بعد حجب — إصرار/);
    assert.equal(getUserProfile(h.ctx.username).stats.totalEdits, 2, 'كلا التعديلين يُسجَّل في الملفّ الشخصيّ');
    h.gateCalls.length = 0;
    assert.equal(await h.run('هل الموقع متجاوب مع الجوال؟', 'chat', 40), true);
    assert.equal(await h.run('هلا', 'chat', 40), true);
    assert.deepEqual(h.gateCalls, ['has', 'has']); assert.equal(h.map.size, 0, 'السؤالُ والكلامُ القصير لا يُحجَبان');
    assert.deepEqual(h.chats, [['هل الموقع متجاوب مع الجوال؟', h.ctx.username, h.ctx.roomName, 'ar'], ['هلا', h.ctx.username, h.ctx.roomName, 'ar']]);
    const empty = harness({ dir: emptyProject() });
    assert.equal(await empty.run('أضف قسم تقييمات', 'chat', 40), true);
    assert.equal(empty.edits.length, 0); assert.equal(empty.chats.length, 1); assert.deepEqual(empty.gateCalls, ['has']);
});

test('الدالّةُ الحرّةُ ≡ المفوِّض: جملةٌ إخباريّة (modify) على النسخة تُحجَب في rt.gatedMessages بردّ الصنف نفسِه، والإصرارُ يمسحها؛ والشكلُ نفسُه على الشقّ', async () => {
    const events = [];
    const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
    rt.classifyIntent = async () => ({ intent: 'chat', confidence: 50 });
    const edits = []; rt.surgicalEdit = (...a) => { edits.push(a); }; rt.generateChatResponse = async () => {};
    const username = `__cls_free_${Date.now()}__`; setUserLanguage(username, 'ar'); clearDialog(username);
    const dir = tempProject();
    const req = { message: 'ولكن قائمة الأصدقاء موجودة', normalizedMessage: 'ولكن قائمة الأصدقاء موجودة', meaningIntent: { intent: 'modify', confidence: 95 }, username, roomName: 'cls_room_free', activeProject: 'cls-free', projectPath: dir, userLang: 'ar' };
    const agents = { getState: () => null };
    assert.equal(await rt._handleClassifiedIntent(req, agents), true);
    assert.equal(rt.gatedMessages.get(username), 'ولكن قائمة الأصدقاء موجودة');
    assert.deepEqual(events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload), [{ message: rt.gateConfirmReply('ar') }]);
    const firstRun = events.length;
    assert.equal(await rt._handleClassifiedIntent(req, agents), true);
    assert.equal(edits.length, 1); assert.equal(rt.gatedMessages.size, 0, 'الإصرارُ عبر المفوِّض يمسح خريطةَ النسخة');
    const free = harness({ dir });
    assert.equal(await free.run('ولكن قائمة الأصدقاء موجودة', 'modify'), true);
    const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload.message]);
    assert.deepEqual(shape(free.events), shape(events.slice(0, firstRun)));
});

test('الحدود: شريحةُ الجسد — gate has/delete/set/confirmReply مرّتين لكلٍّ، ops classifyIntent ×١ وsurgicalEdit ×٣ وgenerateChatResponse ×٣، readCodeContext ×٢، send ٤، liveLog ٩، لا this ولا io، المفوِّضُ بنصّه، اليتائمُ الخمس غائبة، ولم يبقَ قارئٌ للحاجز في الصنف غيرَ الشقّ', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/intentHandlers.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/\bio\b/.test(code));
    const fnStart = code.indexOf('export async function handleClassifiedIntent(req, agents, reporter, gate, ops) {');
    assert.ok(fnStart > 0);
    const body = code.slice(fnStart, code.indexOf('\n}\n', fnStart) + 3);
    const count = (re) => (body.match(re) || []).length;
    assert.deepEqual(
        { has: count(/\bgate\.has\(/g), del: count(/\bgate\.delete\(/g), set: count(/\bgate\.set\(/g), confirm: count(/\bgate\.confirmReply\(/g), gateAll: count(/\bgate\.\w+/g) },
        { has: 2, del: 2, set: 2, confirm: 2, gateAll: 8 }, 'قِيست قبل النقل: فرعا modify ووإلّا يقرآن ويكتبان ويمسحان');
    assert.deepEqual({ classify: count(/ops\.classifyIntent\(/g), edit: count(/ops\.surgicalEdit\(/g), chat: count(/ops\.generateChatResponse\(/g), all: count(/\bops\.\w+/g) }, { classify: 1, edit: 3, chat: 3, all: 7 });
    assert.equal(count(/\breadCodeContext\(/g), 2, 'القارئُ يُستورد لا يُمرَّر — لا اختبارَ يستبدل مفوِّضَه');
    // 📋 «مواصفةٌ كاملة» أضافت سطرَ سجلٍّ واحداً (٩ ← ١٠): يقول عددَ البنود والحروف ولماذا خالفَ المصنِّفَ.
    assert.equal(count(/reporter\.send\(/g), 4); assert.equal(count(/reporter\.liveLog\(/g), 10);
    assert.equal(count(/\bsetPendingGoal\(/g), 1); assert.equal(count(/\bclearDialog\(/g), 1); assert.equal(count(/\brecordEdit\(/g), 3);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _handleClassifiedIntent(req, agents) {
        return handleClassifiedIntent(req, agents, this.reporter, this._gate(), {
            classifyIntent: (m, u) => this.classifyIntent(m, u),
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
            generateChatResponse: (...a) => this.generateChatResponse(...a),
        });
    }\n`));
    assert.ok(jcr.includes("import { handlePlanningStage, handleModifyPattern, handleBareConfirmations, handleUnifiedRoute, handleClassifiedIntent } from './stages/intentHandlers.js';"));
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    for (const n of ['contextFromRequest', 'hasActionIntent', 'isQuestionMessage', 'recordEdit', 'setPendingGoal']) assert.ok(!new RegExp(`\\b${n}\\b`).test(plain), `${n} ما زال في jcr`);
    for (const n of ['clearDialog', 'getUserLanguage', 'readCodeContext', 'createExecutionContext', 'getPendingGoal', 'consumePendingGoal']) assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
    assert.equal((plain.match(/this\.gatedMessages/g) || []).length, 5, 'البانيةُ + أربعُ دوالّ الشقّ — لا قارئَ للحاجز في الصنف بعد JCR/28');
});
