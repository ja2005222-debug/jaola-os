// 💬 ردُّ الشات يخرج من `jcr` (JCR/31): `generateChatResponse` → `stages/chatResponse.js`.
// لم يُطرق جسدُها في اختبارٍ من قبل — ١٣٧ سطراً بلا تغطية، وهي الطريقةُ التي يراها المستخدمُ في كلِّ رسالة.
// التوصيفُ بلا مزوّدٍ حقيقيّ: العميلُ يُحقَن (سابقة JCR/30)، فالبثُّ الحيُّ ومسارُ الفشل كلاهما مقيسان.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { generateChatResponse } from '../agents/stages/chatResponse.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario } from './helpers/jcrScenario.mjs';
import { loadForPrompt, clearConversation } from '../services/conversationStore.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { readAIUsage, resetAIUsage } from '../core/providers/llm.js';

divertConsoleToStderr();
const HERE = import.meta.dirname;
// مفتاحُ المحادثة كما تشتقّه المرحلةُ نفسُها: لكلِّ مشروعٍ مفتاحُه، وبلا بادئةِ المستخدم في اسم الغرفة فالمفتاحُ اسمُه.
// 🔎 مخزنُ المحادثة يبقى على القرص بين الجولات (أسماءُ `scenario` حتميّة) — فالرسائلُ تُختَم
// بطابعِ الجولة حتّى لا تُرضي جولةٌ سابقة تأكيداتِ هذه الجولة (درسُ JCR/8، وقد وقع فعلاً:
// طفرةٌ في جولةِ الطفرات كتبت دورةً فاشلة في المخزن فأخفت نفسَها عن التأكيد التالي).
const STAMP = `#${Date.now()}`;
const convKeyOf = (username, roomName) => (roomName.startsWith(username + '-') ? `${username}::${roomName.slice(username.length + 1)}` : username);
// 🩹 وخَتْمُ الرسائل وحدَه لم يكفِ: المفتاحُ نفسُه حتميٌّ (`__chat1_u1__`)، فالدوراتُ **تتراكم**
//    في `memory/chat_memory.json` جولةً بعد جولة. وبعد عشرين جولةً تجاوزت النافذةَ (`CONTEXT_WINDOW=40`)
//    فانطلق الطيُّ، فسقط تأكيدُ «لا طيَّ على دورةٍ واحدة» — سقوطٌ متقطّعٌ في الجولة الخامسة، وقد قِيس:
//    ١٠٠ رسالةٍ متراكمة تحت ذلك المفتاح. الاختبارُ يبدأ من صفحةٍ بيضاء ويُنظّف أثرَه.
const fresh = async (s) => { await clearConversation(convKeyOf(s.ctx.username, s.ctx.roomName)); return s; };
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const evs = (events) => events.map(([ev]) => ev);
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const opsOf = (calls) => ({
    loadExecutiveMemory: async (u) => { calls.push(['mem', u]); return { tone: 'موجز' }; },
    summarizeConversation: async (p, o, l) => { calls.push(['sum', l]); return 'ملخّص'; },
});
// عميلٌ يبثّ قطعاً حقيقيّة — شكلُ groq نفسُه (chat.completions.create → async iterable)
const streamingClient = (parts) => ({
    chat: { completions: { create: async () => (async function* () {
        for (const p of parts) yield { choices: [{ delta: { content: p } }] };
    })() } },
});
const failingClient = (msg = 'rate limited') => ({ chat: { completions: { create: async () => { throw new Error(msg); } } } });

test('البثُّ الحيّ: قطعٌ حرفاً-بحرف بين بدءٍ ونهاية، والردُّ هو المتراكم، والذاكرةُ التنفيذيّة تُقرأ والدورةُ تُسجَّل', async () => {
    const s = await fresh(scenario('chat1')); const { events, reporter } = collect(); const calls = [];
    const reply = await generateChatResponse(`كيف حال المشروع؟ ${STAMP}`, s.ctx.username, s.ctx.roomName, 'ar',
        reporter, opsOf(calls), streamingClient(['مرح', 'باً ', 'بك']));
    assert.equal(reply, 'مرحباً بك');
    assert.deepEqual(evs(events).filter(e => e.startsWith('chat_')),
        ['chat_stream_start', 'chat_stream_chunk', 'chat_stream_chunk', 'chat_stream_chunk', 'chat_stream_end']);
    assert.deepEqual(events.filter(([e]) => e === 'chat_stream_chunk').map(([, p]) => p.delta), ['مرح', 'باً ', 'بك']);
    assert.equal(events.find(([e]) => e === 'chat_stream_end')[1].message, 'مرحباً بك');
    assert.ok(!evs(events).includes('chat_reply'), 'البثُّ نجح — لا إرسالَ دفعةً واحدة');
    assert.deepEqual(calls.filter(c => c[0] === 'mem'), [['mem', s.ctx.username]], 'الذاكرةُ التنفيذيّة تُقرأ مرّةً');
    // 🔎 `summarizeConversation` ليست نداءً بل **ردّاً على طيّ النافذة**: `recordTurn` تستدعيها
    // حين تفيض النافذةُ فقط. محادثةٌ قصيرة تُسجَّل بلا طيّ — فغيابُها هنا هو السلوكُ الصحيح.
    assert.deepEqual(calls.filter(c => c[0] === 'sum'), [], 'لا طيَّ على دورةٍ واحدة');
    assert.ok(logs(events).some((m) => m.includes('Chat Reply')), 'السطرُ الأخير يقول الردّ');
    const stored = await loadForPrompt(convKeyOf(s.ctx.username, s.ctx.roomName));
    const i = stored.window.findIndex((m) => m.role === 'user' && String(m.content).endsWith(STAMP));
    assert.ok(i >= 0 && stored.window[i + 1]?.content === 'مرحباً بك', 'الدورةُ الناجحة تُسجَّل بطرفَيها');
});

test('فشلُ المزوّد: محاولتان بسطرَيهما، ثمّ رسالةٌ صادقة عن ضغط الحصّة تُرسَل دفعةً واحدة — ولا دورةٌ تُسجَّل', async () => {
    const s = await fresh(scenario('chat2')); const { events, reporter } = collect(); const calls = [];
    const reply = await generateChatResponse(`مرحبا ${STAMP}`, s.ctx.username, s.ctx.roomName, 'ar',
        reporter, opsOf(calls), failingClient('429 too many'));
    assert.match(reply, /^⚠️ خدمة الذكاء مشغولة مؤقتاً/);
    const warn = logs(events).filter((m) => m.includes('محاولة'));
    assert.equal(warn.length, 2, warn.join('\n'));
    assert.ok(warn[0].includes('1/2') && warn[1].includes('2/2'));
    assert.ok(warn.every((m) => m.includes('429 too many')), 'السببُ يُقال لا يُخفى');
    assert.ok(evs(events).includes('chat_reply') && !evs(events).includes('chat_stream_start'));
    // 🔎 «لا نلوّث الذاكرة» يُقاس على المخزن نفسِه لا على ردِّ الطيّ: الدورةُ لا تُسجَّل أصلاً.
    const stored = await loadForPrompt(convKeyOf(s.ctx.username, s.ctx.roomName));
    assert.ok(!stored.window.some((m) => String(m.content).endsWith(STAMP)), 'الدورةُ التي فشلت دخلت الذاكرة');
    assert.deepEqual(calls.filter(c => c[0] === 'sum'), [], 'ولا طيَّ');
});

test('🚪 العطبُ الدائمُ لا يُنتظَر عليه: نداءٌ واحدٌ بلا تراخٍ — لا «محاولة ١/٢» تُوهم بجدوى', async () => {
    // هذه الحلقةُ سبقت `createWithFailover` وإعادتَها، فبقيت لا تعرف `aiUnavailable` — العَلَمَ
    // الذي يقول «كلُّ المزوّدين فشلوا فشلاً **دائماً**» (رصيدٌ منتهٍ، مفتاحٌ خاطئ، موديلٌ غير موجود).
    // فالسلسلةُ تحته تمتنع عن الإعادة بحقّ، ثمّ كانت هذه تنتظر ٢٥٠٠ms وتُعيد على البابِ نفسِه.
    // قِيس بالتشغيل قبل الإصلاح: نداءان و**٢٥٠٥ms** من انتظار المستخدم بلا أيّ احتمال نجاح.
    const s = await fresh(scenario('chatPerm')); const { events, reporter } = collect(); const calls = [];
    let hits = 0;
    const permanent = { chat: { completions: { create: async () => {
        hits += 1; const e = new Error('رصيدٌ منتهٍ'); e.aiUnavailable = true; throw e;
    } } } };
    const t0 = Date.now();
    const reply = await generateChatResponse(`مرحبا ${STAMP}`, s.ctx.username, s.ctx.roomName, 'ar', reporter, opsOf(calls), permanent);
    const spent = Date.now() - t0;

    assert.equal(hits, 1, 'نداءٌ واحدٌ لا اثنان — لا إعادةَ على عطبٍ دائم');
    assert.ok(spent < 500, `ولا تراخٍ: ${spent}ms (كان ٢٥٠٥ms)`);
    const lines = logs(events).filter((m) => m.includes('عطبٌ دائم') || m.includes('محاولة'));
    assert.equal(lines.length, 1, lines.join('\n'));
    assert.ok(lines[0].includes('عطبٌ دائم') && lines[0].includes('رصيدٌ منتهٍ'), 'يُسمّى دائماً ويُقال سببُه');
    assert.ok(!lines[0].includes('1/2'), 'ولا يُعدّ محاولةً من اثنتَين — العدُّ وعدٌ بثانيةٍ لا تأتي');
    assert.match(reply, /^⚠️ خدمة الذكاء مشغولة مؤقتاً/, 'والردُّ الصادقُ كما هو');
});

test('الإنجليزيّةُ تُبقي الرسالةَ الصادقة بلغتها، والبثُّ الفارغ يُعامَل فشلاً', async () => {
    const s = await fresh(scenario('chat3')); const { events, reporter } = collect(); const calls = [];
    const en = await generateChatResponse('hi', s.ctx.username, s.ctx.roomName, 'en', reporter, opsOf(calls), failingClient());
    assert.match(en, /^⚠️ AI service is momentarily busy/);
    const t = collect(); const c2 = [];
    const empty = await generateChatResponse('hi', s.ctx.username, s.ctx.roomName, 'en', t.reporter, opsOf(c2), streamingClient(['   ']));
    assert.match(empty, /^⚠️ AI service is momentarily busy/, 'متراكمٌ فارغ ليس ردّاً');
    assert.ok(evs(t.events).includes('chat_reply'), 'يُرسل دفعةً واحدة');
    assert.deepEqual(c2.filter(x => x[0] === 'sum'), [], 'ولا دورةَ تُسجَّل');
});

test('الحدود: شريحةُ الجسد — لا this ولا io، البثُّ عبر المُبلِّغ، ops اثنان لا ثالث، والعميلُ معاملٌ افتراضيّ يُستعمل مرّةً', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/chatResponse.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code) && !/\breporter\.io\b/.test(code) && !/jcr\.js/.test(code));
    assert.equal((code.match(/reporter\.send\(/g) || []).length, 4, 'بدءٌ + قطعة + نهاية + الردُّ دفعةً');
    // 🚪 سطرٌ ثالث: العطبُ الدائمُ يُسمّى دائماً ويُكسَر عليه الحلقة (لا «محاولة ١/٢» كاذبة).
    assert.equal((code.match(/reporter\.liveLog\(/g) || []).length, 3, 'تحذيرُ المحاولة + سطرُ العطب الدائم + سطرُ الردّ');
    assert.equal((code.match(/\bops\b/g) || []).length, 2, 'المعاملُ وتفكيكُه في الرأس — ولا استعمالَ ثالث');
    assert.equal((code.match(/\bloadExecutiveMemory\(|\bsummarizeConversation\(/g) || []).length, 2, 'نداءٌ لكلٍّ');
    assert.equal((code.match(/\bgroq\b/g) || []).length, 2, 'الاستيرادُ + الافتراضيُّ فقط — لا نداءَ مباشر');
    assert.equal((code.match(/\bclient\.chat\.completions\.create\(/g) || []).length, 1);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes("import { generateChatResponse as runChatResponse } from './stages/chatResponse.js';"));
    assert.ok(jcr.includes("        return runChatResponse(userMessage, username, roomName, userLang, this.reporter, {\n            loadExecutiveMemory: (u) => this.loadExecutiveMemory(u),\n            summarizeConversation: (p, o, l) => this.summarizeConversation(p, o, l),\n        });\n"), 'المفوِّضُ بنصّه');
    // اليتائمُ التي غادرت مع المرحلة لم يبقَ لها مستهلكٌ في الصنف
    for (const n of ['scanProjectFiles', 'buildProjectBrain', 'summarizeBrain', 'summarizeFacts', 'getPlatformKnowledge', 'loadConversation', 'recordTurn', 'projectPathOf', 'analyzeProjectStatic', 'getLangInfo', 'getProjectMemory'])
        assert.ok(!new RegExp(`\\b${n}\\b`).test(jcr), `${n} ما زال في jcr`);
});

// ═══════════════════════════════════════════════════════
// 🏷️ الوسمُ على المسار الحيّ — لا على العدّاد وحدَه
// ═══════════════════════════════════════════════════════
// اختباراتُ `aiUsage` تقيس **الأداة**؛ هذا يقيس أنّها **ركِبت الطريق**. والمسارُ التدفّقيّ
// هو موضعُ الخطر: الرموزُ تُحسب في `for await` بعد أن عاد `create` بزمن، فلفُّ `create`
// وحدَه كان سيترك النداءَ «بلا وسم» — والاختبارُ يقع لو رجعنا إليه.
test('🏷️ نداءُ الشات يُنسَب إلى «chat» على المسار الحيّ — والحسابُ في تصريفِ التدفّق', async () => {
    const s = await fresh(scenario('chatLabel', 'u1'));
    const { reporter } = collect();
    // قطعٌ حقيقيّة، وآخرُها يحمل `usage` كما يتطوّع به المزوّد
    const client = { chat: { completions: { create: async () => (async function* () {
        yield { choices: [{ delta: { content: 'مرحبا' } }] };
        yield { choices: [{ delta: { content: ' بك' } }], usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 } };
    })() } } };
    resetAIUsage();
    await generateChatResponse(`مرحبا ${STAMP}`, s.ctx.username, s.ctx.roomName, 'ar', reporter, opsOf([]), client);
    const usage = readAIUsage();
    assert.equal(usage.byLabel['chat']?.total, 50, 'الرموزُ تُنسَب إلى وكيل الشات');
    assert.equal(usage.byLabel['بلا وسم'], undefined, 'ولا يتسرّب النداءُ خارجَ كلِّ وسم');
    assert.equal(usage.total, 50, 'والمجموعُ لا يتغيّر بالوسم');
    // 🌊 والنداءُ **واحد** مهما بلغت قِطَعُه: هذا ما فضحه سجلُّ صاحب المشروع («٧٩٩٥٤ نداء»
    //    وحقيقتُها عشرات). القطعتان هنا كانتا تُعدّان نداءَين قبل `drainStream`.
    assert.equal(usage.byLabel['chat'].calls, 1, 'قطعتان ⇒ نداءٌ واحد');
    assert.equal(usage.calls, 1);
});
