// 🔍 `stages/missionMeta.js#runMissionMeta(context, roomName, reporter, ops, client = groq)` + `noteUnknowns` — JCR/30.
//
// مسارُ الاحتياط (ميزانيةٌ مستنفدة / لا مزوّد) والمجاهيلُ موصَّفةٌ عبر المفوِّض في `jcrRuntime` (٣). هنا ما لم يكن يُرى قبل الشقّ:
// **مسارُ النجاح** بعميلٍ محقون بلا شبكة — تحويلُ الثقة (≤ ١ → مئويّة، `0` تسقط إلى ٧٠)، عتبةُ التوضيح (< ٤٥ **و**مجاهيل)، حراسُ
// المصفوفات، الأولويّةُ المسموحة → الميزانية (`complex` ١٥ / `medium` ٧) مع استدعاءٍ واحدٍ محسوب، وشكلُ الطلب نفسُه (النموذج، JSON،
// التفضيلاتُ والهدفُ في الرسالة)؛ ثمّ الاحتياطُ على رمي العميل وعلى JSON معطوب، والتكافؤُ مع المفوِّض، والحدودُ على شريحتَي الجسد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runMissionMeta, noteUnknowns } from '../agents/stages/missionMeta.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
let seq = 0;
function harness() {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const memCalls = [];
    const ops = { loadExecutiveMemory: async (u) => { memCalls.push(u); return { preferredUi: 'Neon Dark', language: 'Arabic' }; } };
    const roomName = `mm_room_${seq}`;
    const logs = () => events.filter(e => e.ev === 'log').map(e => e.payload.message).join('\n');
    const ctx = (over = {}) => ({
        username: `__mm_u${seq}__`, goal: 'موقع لمطعم', mentalModel: {},
        metaReasoning: { confidence: 100, unknowns: [], needsUserClarification: false }, budget: null, ...over,
    });
    return { io, events, reporter, ops, memCalls, roomName, logs, ctx };
}
/** عميلٌ محقون: يسجّل الطلب ويعيد JSON (أو نصّاً خامّاً / يرمي). */
function fakeClient(result, calls = []) {
    return { calls, chat: { completions: { create: async (args) => {
        calls.push(args);
        if (result instanceof Error) throw result;
        return { choices: [{ message: { content: typeof result === 'string' ? result : JSON.stringify(result) } }] };
    } } } };
}
const answer = (meta = {}, mission = {}) => ({
    mission: { businessGoal: 'مطعم بحري', technicalGoal: 'HTML/CSS/JS', uxGoal: 'دافئ', successCriteria: ['قائمة'], risks: ['صور'], ...mission },
    meta: { confidence: 0.9, unknowns: [], priority: 'Critical', ...meta },
});

test('مسارُ النجاح: المهمّةُ تُنسخ إلى النموذج الذهنيّ، الثقةُ ≤ ١ تصير مئويّة، Critical → ميزانية complex (١٥) باستدعاءٍ واحدٍ محسوب، والطلبُ بشكله', async () => {
    const h = harness();
    const client = fakeClient(answer({}, { risks: 'ليست مصفوفة' }));
    const ctx = h.ctx();
    await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, client);

    assert.deepEqual(ctx.mentalModel, { businessGoal: 'مطعم بحري', technicalGoal: 'HTML/CSS/JS', visualIdentity: 'دافئ', successCriteria: ['قائمة'], risks: [] }, 'uxGoal → visualIdentity؛ غيرُ المصفوفة → []');
    assert.deepEqual(ctx.metaReasoning, { confidence: 90, unknowns: [], needsUserClarification: false });
    assert.equal(ctx.budget.maxApiCalls, 15, 'Critical → complex');
    assert.equal(ctx.budget.apiCallsUsed, 1, 'استدعاءُ التحليل محسوبٌ على الميزانية الجديدة');
    assert.equal(ctx.budget.isExhausted(), false);
    assert.equal(ctx.budget.consumeCall(), true); assert.equal(ctx.budget.apiCallsUsed, 2, 'الميزانيةُ الجديدة تُحصي الاستهلاك');
    ctx.budget.apiCallsUsed = ctx.budget.maxApiCalls;
    assert.equal(ctx.budget.isExhausted(), true); assert.equal(ctx.budget.consumeCall(), false, 'المستنفدةُ ترفض ولا تزيد');
    assert.equal(ctx.budget.apiCallsUsed, 15);
    assert.deepEqual(h.memCalls, [ctx.username], 'التفضيلاتُ تُقرأ مرّةً عبر ops');
    assert.equal(client.calls.length, 1);
    const req = client.calls[0];
    assert.equal(req.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(req.response_format, { type: 'json_object' });
    assert.equal(req.messages.length, 2);
    assert.match(req.messages[0].content, /mission: \{ businessGoal, technicalGoal, uxGoal, successCriteria, risks \}/);
    assert.equal(req.messages[1].content, `تفضيلات: {"preferredUi":"Neon Dark","language":"Arabic"}\nالهدف: "موقع لمطعم"`);
    assert.match(h.logs(), /🔍 تفكيك الهدف والوعي الذاتي\.\.\./);
    assert.match(h.logs(), /✓ الأولوية: Critical, الميزانية: 15 استدعاءات\./);
    assert.doesNotMatch(h.logs(), /توجد مجاهيل/);
});

test('ثقةٌ منخفضة مع مجاهيل → توضيحٌ مطلوب والمجاهيلُ تُبثّ؛ أولويّةٌ خارج القائمة → Medium (٧)؛ High → complex', async () => {
    const h = harness();
    const ctx = h.ctx();
    await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, fakeClient(answer({ confidence: 30, unknowns: ['أي مدينة؟', 'أي لغة؟'], priority: 'Urgent' })));
    assert.deepEqual(ctx.metaReasoning, { confidence: 30, unknowns: ['أي مدينة؟', 'أي لغة؟'], needsUserClarification: true }, 'ثقةٌ > ١ تبقى كما هي');
    assert.equal(ctx.budget.maxApiCalls, 7, 'Urgent ليست مسموحة → Medium');
    const logs = h.logs();
    assert.match(logs, /🟡 ملاحظة: توجد مجاهيل/);
    assert.match(logs, /الأسئلة المحتملة:\n1\. أي مدينة؟\n2\. أي لغة؟/);
    assert.match(logs, /✓ الأولوية: Medium, الميزانية: 7 استدعاءات\./);

    const high = harness(); const c2 = high.ctx();
    await runMissionMeta(c2, high.roomName, high.reporter, high.ops, fakeClient(answer({ priority: 'High' })));
    assert.equal(c2.budget.maxApiCalls, 15, 'High → complex');
});

test('اكتشافاتٌ مثبَّتة كما هي: ثقة 0 → ٧٠ (`|| 70`)، ثقة 1 → ١٠٠، عتبةُ التوضيح ٤٥ حصراً، ومجاهيلُ بلا انخفاضٍ لا تُعرض، ومجاهيلُ غيرُ مصفوفة → []', async () => {
    const run = async (meta) => { const h = harness(); const ctx = h.ctx(); await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, fakeClient(answer(meta))); return { ctx, logs: h.logs() }; };
    assert.equal((await run({ confidence: 0 })).ctx.metaReasoning.confidence, 70, 'الصفرُ يسقط إلى الافتراضيّ — لا «ثقة صفر»');
    assert.equal((await run({ confidence: 1 })).ctx.metaReasoning.confidence, 100, '١ تُقرأ نسبةً لا مئويّة');
    assert.equal((await run({ confidence: 44, unknowns: ['س'] })).ctx.metaReasoning.needsUserClarification, true);
    assert.equal((await run({ confidence: 45, unknowns: ['س'] })).ctx.metaReasoning.needsUserClarification, false, '٤٥ ليست أقلَّ من ٤٥');
    const quiet = await run({ confidence: 0.2, unknowns: [] });
    assert.equal(quiet.ctx.metaReasoning.needsUserClarification, false, 'بلا مجاهيل لا توضيح');
    assert.doesNotMatch(quiet.logs, /توجد مجاهيل/);
    const shape = await run({ confidence: 0.2, unknowns: 'ليست مصفوفة' });
    assert.deepEqual(shape.ctx.metaReasoning.unknowns, []);
    assert.equal(shape.ctx.metaReasoning.needsUserClarification, false);
});

test('الاحتياطُ الحتميّ: رميُ العميل، JSON معطوب، ميزانيةٌ مستنفدة (لا استدعاء)، وعميلٌ غائب — هدفٌ عامّ وثقة ٧٠ وmedium بلا استهلاك والسببُ كما هو', async () => {
    const check = (ctx, logs, reason) => {
        assert.equal(ctx.mentalModel.businessGoal, 'بناء كود الموقع');
        assert.equal(ctx.metaReasoning.confidence, 70);
        assert.equal(ctx.budget.maxApiCalls, 7); assert.equal(ctx.budget.apiCallsUsed, 0);
        assert.match(logs, new RegExp(`ℹ️ تعذّر تحليل المهمة \\(${reason}\\) — الاحتياط الحتمي: ميزانية medium \\(7 استدعاءات\\)`));
        assert.doesNotMatch(logs, /✓ الأولوية/);
    };
    let h = harness(); let ctx = h.ctx();
    await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, fakeClient(new Error('rate limited')));
    check(ctx, h.logs(), 'rate limited');

    h = harness(); ctx = h.ctx({ mentalModel: { businessGoal: 'قديم' } });
    await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, fakeClient('ليس json'));
    check(ctx, h.logs(), '[^)]+'); assert.equal(ctx.mentalModel.businessGoal, 'بناء كود الموقع', 'الهدفُ القديم يُستبدل بالعامّ');

    h = harness(); ctx = h.ctx({ budget: { consumeCall: () => false } });
    const never = fakeClient(answer());
    await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, never);
    check(ctx, h.logs(), 'Budget exhausted'); assert.equal(never.calls.length, 0, 'لا استدعاءَ بلا ميزانية');

    h = harness(); ctx = h.ctx();
    await runMissionMeta(ctx, h.roomName, h.reporter, h.ops, null);
    check(ctx, h.logs(), 'لا مزوّد AI مُهيأ');
    assert.deepEqual(h.memCalls, [ctx.username], 'التفضيلاتُ تُقرأ قبل المحاولة حتى في الاحتياط');
});

test('noteUnknowns: صامتةٌ بلا توضيحٍ أو بلا مجاهيل (تعيد false)، وتبثّ سطرَين مرقَّمَين عند وجودهما (true)؛ metaReasoning غائبة لا ترمي', () => {
    const h = harness();
    assert.equal(noteUnknowns(h.ctx(), h.roomName, h.reporter), false);
    assert.equal(noteUnknowns(h.ctx({ metaReasoning: { needsUserClarification: true, unknowns: [] } }), h.roomName, h.reporter), false);
    assert.equal(noteUnknowns(h.ctx({ metaReasoning: { needsUserClarification: false, unknowns: ['س'] } }), h.roomName, h.reporter), false, 'مجاهيلُ بلا طلبِ توضيح لا تُعرض');
    assert.equal(noteUnknowns({}, h.roomName, h.reporter), false);
    assert.equal(h.events.length, 0, 'لا ضجيج');
    assert.equal(noteUnknowns(h.ctx({ metaReasoning: { needsUserClarification: true, unknowns: ['أ', 'ب'] } }), h.roomName, h.reporter), true);
    const logs = h.events.filter(e => e.ev === 'log');
    assert.equal(logs.length, 2);
    assert.ok(logs.every(e => e.room === h.roomName));
    assert.match(logs[1].payload.message, /1\. أ\n2\. ب/);
});

test('التكافؤ مع المفوِّض: rt.buildMissionAndMeta يقرأ التفضيلات من النسخة ويسقط إلى الاحتياط بلا مزوّد في بيئة الاختبار، وrt._noteUnknowns هي noteUnknowns على مُبلِّغ النسخة', async () => {
    const h = harness();
    const rt = new JaolaCognitiveRuntime(h.io);
    const memCalls = [];
    rt.loadExecutiveMemory = async (u) => { memCalls.push(u); return { preferredUi: 'X' }; };
    const ctx = h.ctx();
    await rt.buildMissionAndMeta(ctx, h.roomName);
    assert.deepEqual(memCalls, [ctx.username], 'المفوِّضُ يربط ops.loadExecutiveMemory بالنسخة');
    assert.equal(ctx.budget.maxApiCalls, 7);
    assert.match(h.logs(), /تعذّر تحليل المهمة \(لا مزوّد AI مُهيأ\)/);

    const before = h.events.length;
    const shown = h.ctx({ metaReasoning: { confidence: 30, unknowns: ['س'], needsUserClarification: true } });
    assert.equal(rt._noteUnknowns(shown, h.roomName), true);
    assert.equal(h.events.length - before, 2);
    assert.equal(rt._noteUnknowns(h.ctx(), h.roomName), false);
    assert.equal(h.events.length - before, 2);
});

test('الحدود: شريحتا الجسد — liveLog ٣ + ٢، ops واحدٌ ولا ثانٍ، العميلُ مرّةً وحارسُه مرّةً، ثلاثُ ميزانيات، noteUnknowns تُستدعى مرّةً، groq في المرحلة معاملٌ افتراضيّ فقط، لا this ولا io، المفوِّضان بنصّهما، والصنفُ غادر jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/missionMeta.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/jcr\.js/.test(code)); assert.ok(!/\bio\b/.test(code));
    assert.ok(mod.includes("import { groq } from '../../core/providers/llm.js';"));
    assert.equal((code.match(/\bgroq\b/g) || []).length, 2, 'الاستيرادُ + الافتراضيُّ وحدهما — لا استدعاءَ مباشر على groq');
    const slice = (sig) => { const i = code.indexOf(sig); assert.ok(i > 0, sig); return code.slice(i, code.indexOf('\n}\n', i) + 3); };
    const run = slice('export async function runMissionMeta(context, roomName, reporter, ops, client = groq) {');
    const note = slice('export function noteUnknowns(context, roomName, reporter) {');
    const count = (s, re) => (s.match(re) || []).length;
    assert.ok(!/\bthis\./.test(run) && !/\bthis\./.test(note), 'this فقط داخل صنف الميزانية');
    assert.deepEqual(
        { liveLog: count(run, /reporter\.liveLog\(/g), mem: count(run, /ops\.loadExecutiveMemory\(/g), ops: count(run, /\bops\.\w+/g), call: count(run, /client\.chat\.completions\.create\(/g), guard: count(run, /!client\b/g), budgets: count(run, /new CognitiveBudget\(/g), note: count(run, /noteUnknowns\(context, roomName, reporter\);/g), send: count(run, /reporter\.send\(/g) },
        { liveLog: 3, mem: 1, ops: 1, call: 1, guard: 1, budgets: 3, note: 1, send: 0 }, 'قِيست قبل النقل');
    assert.equal(count(note, /reporter\.liveLog\(/g), 2);
    assert.ok(code.includes('class CognitiveBudget {'), 'الصنفُ خرج مع مستهلكه الوحيد');
    assert.ok(!/export class CognitiveBudget/.test(code), 'لا تصديرَ بلا مستهلك');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async buildMissionAndMeta(context, roomName) {
        return runMissionMeta(context, roomName, this.reporter, {
            loadExecutiveMemory: (u) => this.loadExecutiveMemory(u),
        });
    }

    _noteUnknowns(context, roomName) {
        return noteUnknowns(context, roomName, this.reporter);
    }\n`));
    assert.ok(jcr.includes("import { runMissionMeta, noteUnknowns } from './stages/missionMeta.js';"));
    const plain = jcr.replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bCognitiveBudget\b/.test(plain), 'الصنفُ ما زال في jcr');
    assert.equal((plain.match(/\bgroq\b/g) || []).length, 3, 'الاستيرادُ + classifyIntent + generateChatResponse — ما زال له مستهلكان في jcr');
    for (const n of ['smartChat', 'loadExecutiveMemory']) assert.ok(new RegExp(`\\b${n}\\b`).test(plain), `${n} بقي له مستهلكٌ في jcr`);
});
