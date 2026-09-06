// 🚪 `stages/intentHandlers.js#handleBareConfirmations(req, agents, reporter, gate, ops)` — JCR/26.
//
// أوّلُ معالجٍ يحمل **حالةَ الحجب** يخرج: `gatedMessages` تبقى على الصنف (الاختباراتُ تملكها على `rt.gatedMessages`) وتصل
// كشقٍّ `gate` من دوالَّ مربوطةٍ بالنسخة. هذا الملفّ يوصّف الشقَّ (قراءةً ومسحاً)، والمسارات التي لم تكن موصَّفةً
// (الاستئنافُ يُحجَب حين القرارُ ردّ، «نفّذ» مع تاريخٍ فارغ أو بمساعدٍ تحذيريّ فقط، الإنجليزيّة)، والتكافؤَ مع المفوِّض، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { handleBareConfirmations } from '../agents/stages/intentHandlers.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { addToHistory } from '../agents/projectMemory.js';
import { getUserProfile } from '../agents/userProfile.js';
import { recordTurn } from '../services/conversationStore.js';
import { enqueueMission, isMissionActive } from '../core/runtime/ExecutionQueue.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness({ lang = 'ar' } = {}) {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const map = new Map();
    const gateCalls = [];
    const gate = {
        has: (u) => { gateCalls.push('has'); return map.has(u); }, get: (u) => { gateCalls.push('get'); return map.get(u); },
        set: (u, m) => { gateCalls.push('set'); map.set(u, m); }, delete: (u) => { gateCalls.push('delete'); map.delete(u); },
        confirmReply: () => { gateCalls.push('confirmReply'); return 'CONFIRM'; },
    };
    const missions = [], edits = [];
    const ops = { executeMission: (goal, ctx) => { missions.push({ goal, ctx }); }, surgicalEdit: (goal, ctx) => { edits.push({ goal, ctx }); } };
    const username = `__bare_u${seq}_${Date.now()}__`;
    setUserLanguage(username, lang);
    const agents = { getState: () => null };
    const ctx = { username, roomName: `bare_room_${seq}`, activeProject: `bare-${seq}`, projectPath: `/nonexistent/bare_${seq}` };
    const req = (message) => ({ message, normalizedMessage: message, ...ctx, userLang: lang });
    const handle = (message) => handleBareConfirmations(req(message), agents, reporter, gate, ops);
    const replies = () => events.filter((e) => e.ev === 'chat_reply').map((e) => e.payload.message);
    const logs = () => events.filter((e) => e.ev === 'log').map((e) => e.payload.message);
    return { handle, req, events, replies, logs, map, gateCalls, missions, edits, ctx, agents, reporter, ops };
}

test('«نعم» بعد حجب: gate.get ثمّ gate.delete، ثمّ ops.surgicalEdit بالرسالة المحجوبة وسياقِ الطلب المجمَّد — لا استئناف', async () => {
    const h = harness();
    h.map.set(h.ctx.username, 'اعطي الادمن صلاحية حذف الطلبات');
    addToHistory(h.ctx.username, h.ctx.activeProject, 'بناء: تطبيق تاكسي');
    assert.equal(await h.handle('نعم'), true);
    assert.deepEqual(h.gateCalls, ['get', 'delete']);
    assert.equal(h.map.has(h.ctx.username), false, 'الحاجزُ يُصفّى');
    assert.equal(h.edits.length, 1); assert.equal(h.edits[0].goal, 'اعطي الادمن صلاحية حذف الطلبات');
    assert.ok(Object.isFrozen(h.edits[0].ctx)); assert.equal(h.edits[0].ctx.agents, h.agents); assert.equal(h.edits[0].ctx.roomName, h.ctx.roomName);
    assert.equal(h.missions.length, 0, 'الذاكرةُ القابلة للاستئناف لا تسبق المحجوب');
    assert.match(h.logs().at(-1), /"نعم" بعد حجب → تنفيذ الطلب المحجوب/);
    assert.equal(h.replies().length, 0);
    assert.equal(getUserProfile(h.ctx.username).stats.totalEdits, 1, 'المحجوبُ يُسجَّل تعديلاً في ملفّ المستخدم');
    // رسالةٌ ليست «نعم» ولا «نفّذ» → false بلا بثّ ولا نداء — المسارُ يكمل إلى المعالجات التالية.
    const n = h.events.length;
    assert.equal(await h.handle('اضف صفحة للسائق'), false);
    assert.equal(h.events.length, n); assert.equal(h.edits.length, 1); assert.equal(h.missions.length, 0);
});

test('«نعم» بلا حجب: مع ذاكرةٍ والقرارُ تنفيذ → ops.executeMission بهدفٍ موسومٍ [استئناف] وردٌّ بلغته؛ بلا ذاكرة → false بلا بثّ', async () => {
    const h = harness({ lang: 'en' });
    assert.equal(await h.handle('yes'), false);
    assert.equal(h.events.length, 0); assert.deepEqual(h.gateCalls, ['get']);
    addToHistory(h.ctx.username, h.ctx.activeProject, 'build: honey store');
    assert.equal(await h.handle('ok'), true);
    assert.equal(h.missions.length, 1); assert.match(h.missions[0].goal, /استئناف/); assert.ok(Object.isFrozen(h.missions[0].ctx));
    assert.deepEqual(h.replies(), ['⚡ Alright — resuming where we left off...']);
    assert.match(h.logs().at(-1), /"intent":"continue".*تأكيد مجرّد → استئناف فعلي/);
});

test('«نعم» مع ذاكرةٍ لكنّ القرارُ ردّ (مهمّةٌ نشطة للمشروع نفسِه) → لا استئناف، ويسقط إلى false', async () => {
    const h = harness();
    addToHistory(h.ctx.username, h.ctx.activeProject, 'بناء: متجر');
    let release; const gateP = new Promise((r) => { release = r; });
    const running = enqueueMission({ username: h.ctx.username, project: h.ctx.activeProject, run: () => gateP, onWait: () => {} });
    try {
        const t0 = Date.now(); while (!isMissionActive(h.ctx.username, h.ctx.activeProject) && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 20));
        assert.ok(isMissionActive(h.ctx.username, h.ctx.activeProject), 'الصفُّ يعرف المهمّة');
        assert.equal(await h.handle('تمام'), false);
        assert.equal(h.missions.length, 0); assert.equal(h.events.length, 0);
    } finally { release(); await running; }
});

test('«نفّذ» مجرّدة: آخرُ ردٍّ للمساعد في سجلّ المحادثة يصير تعليمةَ تعديلٍ تحمل الأمرَ والوصف → ops.surgicalEdit؛ الردودُ التحذيريّة تُتخطّى', async () => {
    const h = harness();
    const key = `${h.ctx.username}::${h.ctx.activeProject}`;
    await recordTurn(key, 'user', 'أضف زر واتساب');
    await recordTurn(key, 'assistant', 'سأضيف زرّ واتساب عائماً أسفل الصفحة يفتح رقمك مباشرة.');
    await recordTurn(key, 'assistant', '⚠️ تنبيه: الاتصال ضعيف');
    assert.equal(await h.handle('نفذ'), true);
    assert.equal(h.edits.length, 1);
    assert.match(h.edits[0].goal, /^نفّذ على الموقع الحالي ما تم الاتفاق عليه/);
    assert.match(h.edits[0].goal, /"نفذ" يشير إلى:\nسأضيف زرّ واتساب عائماً/);
    assert.doesNotMatch(h.edits[0].goal, /تنبيه: الاتصال ضعيف/, 'الردُّ التحذيريّ لا يُنفَّذ');
    assert.ok(Object.isFrozen(h.edits[0].ctx), 'سياقُ تنفيذٍ حقيقيّ من الطلب'); assert.equal(h.edits[0].ctx.agents, h.agents);
    assert.deepEqual(h.replies(), ['⚡ تمام — أنفّذ ما اتفقنا عليه الآن...']);
    assert.deepEqual(h.gateCalls, [], '«نفّذ» لا تمسّ الحاجز');
});

test('«نفّذ» بلا سجلّ (أو بمساعدٍ تحذيريّ فقط) → سؤالٌ محدَّد بلغته، ولا تنفيذ', async () => {
    const h = harness({ lang: 'en' });
    assert.equal(await h.handle('do it'), true);
    assert.deepEqual(h.replies(), ['What exactly should I execute? Describe the change in one sentence.']);
    assert.equal(h.edits.length, 0);
    const h2 = harness();
    await recordTurn(`${h2.ctx.username}::${h2.ctx.activeProject}`, 'assistant', '⚡ تمام — أكمل من حيث توقفنا...');
    assert.equal(await h2.handle('طبقها'), true);
    assert.match(h2.replies().at(-1), /^ماذا تريد أن أنفّذ بالضبط؟/);
    assert.equal(h2.edits.length, 0);
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — «نعم» بعد حجب: الخريطةُ على النسخة تُقرأ وتُصفّى، والاستبدالُ على النسخة يصل', async () => {
    const events = [];
    const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
    const seen = [];
    rt.surgicalEdit = (goal, c) => { seen.push({ goal, c }); };
    const username = `__bare_cls_${Date.now()}__`; setUserLanguage(username, 'ar');
    rt.gatedMessages.set(username, 'غيّر لون الهيدر');
    const req = { message: 'نعم', normalizedMessage: 'نعم', username, roomName: 'bare_room_cls', activeProject: 'bare-cls', projectPath: '/nonexistent/bare_cls', userLang: 'ar' };
    assert.equal(await rt._handleBareConfirmations(req, { getState: () => null }), true);
    assert.equal(rt.gatedMessages.has(username), false, 'الخريطةُ نفسُها صُفّيت عبر gate');
    assert.equal(seen.length, 1); assert.equal(seen[0].goal, 'غيّر لون الهيدر');
    const free = harness(); free.map.set(free.ctx.username, 'غيّر لون الهيدر');
    await free.handle('نعم');
    const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload?.message === 'string' ? e.payload.message : null]);
    assert.deepEqual(shape(events), shape(free.events));
    // شقُّ الصنف: `_gate()` يعيد دوالَّ مربوطةً بالخريطة نفسِها وبنصّ الحجب نفسِه — لا نسخة.
    const g = rt._gate(); g.set('u1', 'm1');
    assert.equal(rt.gatedMessages.get('u1'), 'm1'); assert.equal(g.has('u1'), true); assert.equal(g.get('u1'), 'm1');
    g.delete('u1'); assert.equal(rt.gatedMessages.has('u1'), false);
    assert.equal(g.confirmReply('ar'), rt.gateConfirmReply('ar')); assert.equal(g.confirmReply('en'), rt.gateConfirmReply('en'));
});

test('الحدود: gate يُقرأ ويُمسح فقط هنا (لا set)، ops بثلاثة نداءات، لا this ولا io، المفوِّضُ و_gate بنصّهما، واليتيماتُ الأربع غائبةٌ عن jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/intentHandlers.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/\bio\b/.test(code));
    // عدُّ هذا المعالج وحدَه (شريحةُ جسده) — لا الملفّ كلِّه: JCR/27 أضاف معالجاً رابعاً يكتب الحاجز، وسجلُّ الملفّ في `intentHandlersStage`.
    const fnStart = code.indexOf('export async function handleBareConfirmations(');
    const body = code.slice(fnStart, code.indexOf('\n}\n', fnStart) + 3);
    const count = (re) => (body.match(re) || []).length;
    assert.equal(count(/\bgate\.get\(/g), 1); assert.equal(count(/\bgate\.delete\(/g), 1); assert.equal(count(/\bgate\.\w+/g), 2, 'لا set ولا has ولا confirmReply في هذا المعالج');
    assert.equal(count(/ops\.surgicalEdit\(/g), 2); assert.equal(count(/ops\.executeMission\(/g), 1); assert.equal(count(/\bops\.\w+/g), 3);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _handleBareConfirmations(req, agents) {
        return handleBareConfirmations(req, agents, this.reporter, this._gate(), {
            executeMission: (goal, c) => this.executeMission(goal, c),
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
        });
    }\n`));
    assert.ok(jcr.includes(`\n    _gate() {
        return {
            has: (u) => this.gatedMessages.has(u),
            get: (u) => this.gatedMessages.get(u),
            set: (u, m) => this.gatedMessages.set(u, m),
            delete: (u) => this.gatedMessages.delete(u),
            confirmReply: (lang) => this.gateConfirmReply(lang),
        };
    }\n`));
    assert.match(jcr, /import \{[^}]*\bhandleBareConfirmations\b[^}]*\} from '\.\/stages\/intentHandlers\.js';/);
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    for (const n of ['buildContinuationGoal', 'decide', 'isBareExecute', 'isBareYes']) assert.ok(!new RegExp(`\\b${n}\\b`).test(plain), `${n} ما زال في jcr`);
    for (const n of ['missionBriefing', 'matchDeleteCommand', 'loadConversation', 'recordTurn', 'recordEdit']) assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
    // الحالةُ تبقى على الصنف: خريطةٌ واحدة في البانية، وقُرّاؤها الباقون معالجان لم يُنقلا بعد.
    assert.equal((plain.match(/this\.gatedMessages = new Map\(\)/g) || []).length, 1);
});
