// 🧭 `stages/intentHandlers.js#handleUnifiedRoute(req, agents, reporter, gate, ops, router = routeMessage)` — JCR/27.
//
// `routeMessage` نداءُ LLM؛ بلا مفتاحٍ يعود `null` فيسقط المعالجُ إلى `false` بصمت — وهذا ما توصّفه `jcrClassifiedIntent` عبر
// المسار الكامل. فروعُ `route.action` كانت **بلا توصيفٍ يصل إليها** (الطفراتُ الأولى نجت ٧/١٠). الموجّهُ يُحقَن هنا وسيطاً أخيراً
// على سابقة `router.js` نفسِها (`llm = smartChat` «قابل للحقن للاختبار») — لا تجريدَ جديد؛ المفوِّضُ على الصنف لا يمرّره.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { handleUnifiedRoute } from '../agents/stages/intentHandlers.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { setPendingGoal, getPendingGoal } from '../services/conversationManager.js';
import { getUserProfile } from '../agents/userProfile.js';
import { getMetrics } from '../services/metricsStore.js';
import { tempProject, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness({ dir = null, lang = 'ar' } = {}) {
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
    const edits = [], chats = [];
    const ops = { surgicalEdit: (goal, ctx) => { edits.push({ goal, ctx }); }, generateChatResponse: async (...a) => { chats.push(a); } };
    const username = `__route_u${seq}_${Date.now()}__`;
    setUserLanguage(username, lang);
    const ctx = { username, roomName: `route_room_${seq}`, activeProject: `route-${seq}`, projectPath: dir || tempProject() };
    const req = (message, extra = {}) => ({ message, normalizedMessage: message, ...ctx, userLang: lang, ...extra });
    const agents = { getState: () => null, clearState: () => { agents.cleared += 1; }, cleared: 0 };
    const routerCalls = [];
    const withRoute = (route) => async (m, c) => { routerCalls.push({ m, c }); return route; };
    const run = (message, route, extra = {}) => handleUnifiedRoute(req(message, extra), agents, reporter, gate, ops, withRoute(route));
    const replies = () => events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload.message);
    const logs = () => events.filter((e) => e.ev === 'log').map((e) => e.payload.message);
    return { events, map, gateCalls, edits, chats, ctx, req, reporter, ops, gate, agents, routerCalls, run, replies, logs };
}

test('بابُ الدخول: داخلَ حوار المُوضِّح لا يُستشار الموجّهُ أصلاً → false بلا بثّ ولا نداء', async () => {
    const h = harness();
    h.agents.getState = () => ({ stage: 'clarifying' });
    assert.equal(await h.run('غيّر لون الهيدر', { action: 'edit', confidence: 99 }), false);
    assert.equal(h.routerCalls.length, 0); assert.equal(h.events.length, 0); assert.deepEqual(h.gateCalls, []);
});

test('الموجّهُ يتلقّى السياقَ الحقيقيّ (اسمُ المشروع، وجودُه من القرص، آخرُ ردٍّ للمساعد، اللغة)؛ null أو رميٌ → false بلا أثر، وbuild → false بعد سطر الموجّه فقط', async () => {
    const h = harness();
    assert.equal(await h.run('غيّر لون الهيدر', null), false);
    assert.deepEqual(h.routerCalls[0].c, { projectName: h.ctx.activeProject, hasProject: true, lastAssistant: '', lang: 'ar' });
    assert.equal(await h.run('ابنِ لي متجراً', { action: 'build', confidence: 90 }), false, 'build يسقط عمداً للمسار القديم');
    assert.deepEqual(h.logs(), ['[ROUTER] ➔ [Unified]: 🧭 build (90%)'], 'سطرُ الموجّه يُبثّ لكلِّ قرارٍ غير null — حتّى build الساقط (سلوكٌ قائم قبل النقل)');
    assert.equal(await handleUnifiedRoute(h.req('x'), h.agents, h.reporter, h.gate, h.ops, async () => { throw new Error('llm down'); }), false, 'فشلُ الموجّه يُبتلع');
    const empty = harness({ dir: emptyProject() });
    await empty.run('x', null);
    assert.equal(empty.routerCalls[0].c.hasProject, false, 'مشروعٌ فارغ → hasProject=false');
    assert.equal(h.events.length, 1, 'لا أثرَ غيرَ سطر build'); assert.equal(empty.events.length, 0); assert.deepEqual(h.gateCalls, []); assert.equal(h.edits.length + h.chats.length, 0);
});

test('chat على مشروعٍ قائم: أمرٌ صريح → تعديلٌ فوريّ ويُمسح الحاجزُ ويُسجَّل؛ جملةٌ إخباريّة → تُحجَب مرّةً بردّ الصنف؛ الإصرارُ بعدها → تعديل', async () => {
    const h = harness();
    const route = { action: 'chat', confidence: 70, reason: 'يبدو حديثاً' };
    assert.equal(await h.run('اضف قسم تقييمات', route), true);
    assert.deepEqual(h.gateCalls, ['has', 'delete']); assert.equal(h.edits.length, 1); assert.equal(h.edits[0].goal, 'اضف قسم تقييمات');
    assert.ok(Object.isFrozen(h.edits[0].ctx)); assert.equal(h.edits[0].ctx.agents, h.agents);
    assert.equal(getUserProfile(h.ctx.username).stats.totalEdits, 1); assert.equal(getMetrics(h.ctx.username, h.ctx.activeProject).totalEdits, 1, 'عدّادُ اللوحة أيضاً');
    assert.match(h.logs()[0], /🧭 chat \(70%\) — يبدو حديثاً/);
    h.gateCalls.length = 0;
    assert.equal(await h.run('الالوان في الهيدر حلوة', route), true);
    assert.deepEqual(h.gateCalls, ['has', 'set', 'confirmReply']); assert.equal(h.map.get(h.ctx.username), 'الالوان في الهيدر حلوة');
    assert.deepEqual(h.replies(), ['CONFIRM:ar']); assert.equal(h.edits.length, 1); assert.equal(h.chats.length, 0);
    h.gateCalls.length = 0;
    assert.equal(await h.run('خليها أغمق شوي', route), true, 'أيُّ رسالةٍ بعد الحجب إصرارٌ — لا مطابقةَ حرفيّة');
    assert.deepEqual(h.gateCalls, ['has', 'delete']); assert.equal(h.edits.length, 2); assert.equal(h.edits[1].goal, 'خليها أغمق شوي');
});

test('chat: السؤالُ على مشروعٍ قائم لا يُحجَب → محادثة؛ وبلا مشروعٍ كلُّ chat محادثة بوسائطها', async () => {
    const h = harness();
    const route = { action: 'chat', confidence: 80 };
    assert.equal(await h.run('كم صفحة في الموقع؟', route), true);
    assert.deepEqual(h.gateCalls, ['has']); assert.equal(h.chats.length, 1);
    assert.deepEqual(h.chats[0], ['كم صفحة في الموقع؟', h.ctx.username, h.ctx.roomName, 'ar']);
    const empty = harness({ dir: emptyProject(), lang: 'en' });
    assert.equal(await empty.run('add a reviews section', route), true);
    assert.equal(empty.chats.length, 1); assert.equal(empty.edits.length, 0); assert.deepEqual(empty.gateCalls, ['has']);
});

test('edit → ops.surgicalEdit بتعليمة الموجّه (أو الرسالة حين لا تعليمة) وسياقٍ مجمَّد، ويُسجَّل في الملفّ', async () => {
    const h = harness();
    assert.equal(await h.run('غير الالوان', { action: 'edit', instruction: 'غيّر الألوان إلى أزرق', confidence: 95 }), true);
    assert.equal(h.edits[0].goal, 'غيّر الألوان إلى أزرق'); assert.ok(Object.isFrozen(h.edits[0].ctx));
    assert.equal(await h.run('كبّر الخط', { action: 'edit', confidence: 95 }), true);
    assert.equal(h.edits[1].goal, 'كبّر الخط');
    assert.equal(getUserProfile(h.ctx.username).stats.totalEdits, 2); assert.deepEqual(h.gateCalls, []);
});

test('delete_project → طلبُ تأكيدٍ حرفيّ باسم المشروع؛ sandbox_app لا يُحذف؛ stop → مسحُ حالة المُوضِّح والحوار وردٌّ بلغته', async () => {
    const h = harness();
    assert.equal(await h.run('امسح المشروع', { action: 'delete_project', confidence: 90 }), true);
    assert.match(h.replies().at(-1), new RegExp(`حذف المشروع «${h.ctx.activeProject}» \\*\\*نهائي\\*\\*[^]*احذف نهائياً ${h.ctx.activeProject}`));
    assert.equal(await h.run('امسح المشروع', { action: 'delete_project', confidence: 90 }, { activeProject: 'sandbox_app' }), true);
    assert.match(h.replies().at(-1), /لا يمكن حذف المشروع الافتراضي sandbox_app/);
    setPendingGoal(h.ctx.username, 'هدفٌ معلّق');
    assert.equal(await h.run('خلاص وقف', { action: 'stop', confidence: 90 }), true);
    assert.equal(h.agents.cleared, 1); assert.equal(h.replies().at(-1), '🛑 تم الإيقاف. أخبرني بما تريد.');
    assert.equal(getPendingGoal(h.ctx.username), null, 'الحوارُ يُمسح أيضاً (clearDialog)');
    const en = harness({ lang: 'en' });
    assert.equal(await en.run('stop', { action: 'stop', confidence: 90 }), true);
    assert.equal(en.replies().at(-1), '🛑 Stopped. Tell me what you need.');
    assert.equal(h.edits.length + h.chats.length, 0);
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — بلا مفتاح كلاهما false بلا أثر، والمفوِّضُ لا يمرّر موجّهاً (الافتراضيُّ routeMessage)', async () => {
    const events = [];
    const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
    let touched = 0; rt.surgicalEdit = () => { touched += 1; }; rt.generateChatResponse = async () => { touched += 100; };
    const username = `__route_cls_${Date.now()}__`; setUserLanguage(username, 'ar');
    const req = { message: 'غيّر لون الهيدر', normalizedMessage: 'غيّر لون الهيدر', username, roomName: 'route_room_cls', activeProject: 'route-cls', projectPath: tempProject(), userLang: 'ar' };
    assert.equal(await rt._handleUnifiedRoute(req, { getState: () => null }), false);
    assert.equal(events.length, 0); assert.equal(touched, 0); assert.equal(rt.gatedMessages.size, 0);
    const free = harness();
    assert.equal(await handleUnifiedRoute(free.req('غيّر لون الهيدر'), { getState: () => null }, free.reporter, free.gate, free.ops), false, 'الافتراضيُّ بلا مفتاح → null');
    assert.equal(free.events.length, 0);
});

test('الحدود: شريحةُ الجسد — gate has/delete/set/confirmReply مرّةً، ops surgicalEdit ×٢ وgenerateChatResponse ×١، router نداءٌ واحد وافتراضيُّه routeMessage، readCodeContext يُستورد، المفوِّضُ بنصّه', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/intentHandlers.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/\bio\b/.test(code));
    const fnStart = code.indexOf('export async function handleUnifiedRoute(req, agents, reporter, gate, ops, router = routeMessage) {');
    assert.ok(fnStart !== -1, 'التوقيعُ بالموجّه المحقَن وافتراضيِّه');
    const body = code.slice(fnStart, code.indexOf('\n}\n', fnStart) + 3);
    const count = (re) => (body.match(re) || []).length;
    assert.deepEqual(
        { has: count(/\bgate\.has\(/g), del: count(/\bgate\.delete\(/g), set: count(/\bgate\.set\(/g), confirm: count(/\bgate\.confirmReply\(/g), gateAll: count(/\bgate\.\w+/g) },
        { has: 1, del: 1, set: 1, confirm: 1, gateAll: 4 }, 'قِيست قبل النقل: الحجبُ يُقرأ ويُمسح ويُكتب وردُّه من الصنف');
    assert.deepEqual({ edit: count(/ops\.surgicalEdit\(/g), chat: count(/ops\.generateChatResponse\(/g), all: count(/\bops\.\w+/g) }, { edit: 2, chat: 1, all: 3 });
    assert.equal(count(/\breadCodeContext\(/g), 1, 'القارئُ يُستورد لا يُمرَّر — لا اختبارَ يستبدل مفوِّضَه');
    assert.equal(count(/\bawait router\(/g), 1); assert.equal(count(/\brouteMessage\(/g), 0, 'النداءُ عبر الوسيط لا الاستيراد مباشرةً');
    assert.equal(count(/reporter\.send\(/g), 3); assert.equal(count(/reporter\.liveLog\(/g), 1);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _handleUnifiedRoute(req, agents) {
        return handleUnifiedRoute(req, agents, this.reporter, this._gate(), {
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
            generateChatResponse: (...a) => this.generateChatResponse(...a),
        });
    }\n`), 'المفوِّضُ لا يمرّر موجّهاً — الافتراضيُّ هو الإنتاج');
    assert.match(jcr, /import \{[^}]*\bhandleUnifiedRoute\b[^}]*\} from '\.\/stages\/intentHandlers\.js';/);
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    for (const n of ['routeMessage', 'recordEditAction']) assert.ok(!new RegExp(`\\b${n}\\b`).test(plain), `${n} ما زال في jcr`);
    // `hasActionIntent`/`isQuestionMessage` كانا هنا يومَ JCR/27 — خرجا بعدها مع المصنِّف الأخير (JCR/28)؛ القائمةُ تتبع القياس.
    for (const n of ['recordBuild', 'buildMetricsPayload', 'clearDialog', 'readCodeContext']) assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
});
