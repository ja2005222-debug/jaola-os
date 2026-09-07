// 🔁🗂️ ملاحظتان من صاحب المنصّة بعد أوّل بناءٍ ناجح — كلتاهما عطبُ صدقٍ لا عطبُ شبكة.
//
// (١) «كل ما تركت جولا وذهبت لمتصفح آخر... يقطعها في نصفها»
//     قِيس: `disconnect` لا يُلغي شيئاً — المهمّةُ تُكمل على الخادم وتُنهي ملفّاتها. لكنّ
//     `Socket.IO` يبثّ إلى **غرفة**، وغرفةٌ فارغةٌ تعني حدثاً يُرمى في الفراغ. و`recordTurn`
//     — الحافظُ الوحيد الذي يستعيده `chat_history` — يُنادى من مسار الشات وحدَه، لا من
//     `reportMissionSuccess` ولا من مسار الفشل. فما يراه ليس مهمّةً مقطوعة بل **مهمّةً تمّت
//     ولم يصله خبرُها** — وهو أسوأ: ملفّاتُه موجودةٌ وهو يظنّها ضاعت.
//
// (٢) «مزود الخدمة كثير الانقطاع»
//     قِيس: `createWithFailover` يجرّب كلَّ مزوّدٍ **مرّةً واحدة**؛ لا إعادةَ محاولةٍ ولا تراجع.
//     ورسالتُنا تقول «نعيد المحاولة» — وعدٌ لا يفي به الكود. ولذلك سقط ٧ وكلاءَ من ٧ وانتهى
//     البناءُ إلى المولّد الكلاسيكيّ، بينما كانت تكفي محاولةٌ ثانيةٌ بعد أقلَّ من ثانية.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs, AI_MAX_RETRIES } from '../core/providers/llm.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

test('🔴 التراجعُ تصاعديّ ومحدود — لا يُعلَّق البناءُ إلى الأبد', () => {
    const d0 = retryDelayMs(0), d1 = retryDelayMs(1);
    assert.ok(d0 > 0, 'محاولةٌ فوريّةٌ تصطدم بالسبب نفسِه');
    assert.ok(d1 > d0, 'لا تصاعدَ — ضغطٌ متساوٍ على مزوّدٍ متعثّر');
    assert.ok(AI_MAX_RETRIES >= 1 && AI_MAX_RETRIES <= 3, 'حدٌّ يُبقي البناءَ حيّاً لا معلَّقاً');
    // مجموعُ الانتظار محسوبٌ ومحدود: المستخدم ينتظر أمام شاشة
    const total = Array.from({ length: AI_MAX_RETRIES }, (_, i) => retryDelayMs(i)).reduce((a, b) => a + b, 0);
    assert.ok(total <= 10000, `انتظارٌ إجماليّ ${total}ms أطولُ من صبرِ من ينظر`);
});

test('🔴 والعطبُ الدائم لا يُعاد عليه — التكرارُ عليه هدرٌ محض', async () => {
    process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
    process.env.AI_PROVIDERS = 'deepseek';
    process.env.AI_RETRY_BASE_MS = '1';
    const llm = await import('../core/providers/llm.js?retry=permanent');

    let calls = 0;
    llm.deepseek.chat.completions.create = async () => {
        calls++;
        throw Object.assign(new Error('Insufficient Balance'), { status: 402 });
    };
    await assert.rejects(() => llm.groq.chat.completions.create({ messages: [] }));
    assert.equal(calls, 1, 'أُعيدت المحاولةُ على رصيدٍ منتهٍ — سبعُ دوراتٍ تُحرق هكذا');
    delete process.env.AI_PROVIDERS;
});

test('🔴 والعابرُ يُعاد عليه — وينجح إن كان عابراً حقّاً', async () => {
    process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
    process.env.AI_PROVIDERS = 'deepseek';
    process.env.AI_RETRY_BASE_MS = '1';
    const llm = await import('../core/providers/llm.js?retry=transient');

    let calls = 0;
    llm.deepseek.chat.completions.create = async () => {
        if (++calls === 1) throw new Error('socket hang up');
        return { choices: [{ message: { content: 'ok' } }] };
    };
    const res = await llm.groq.chat.completions.create({ messages: [] });
    assert.equal(res.choices[0].message.content, 'ok');
    assert.equal(calls, 2, 'لم تُعَد المحاولةُ على عطبٍ عابر — و«نعيد المحاولة» وعدٌ لا يُوفى');
    delete process.env.AI_PROVIDERS;
});

test('🔴 وعابرٌ مستمرٌّ يتوقّف عند الحدّ — لا حلقةَ لا نهاية لها', async () => {
    process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
    process.env.AI_PROVIDERS = 'deepseek';
    process.env.AI_RETRY_BASE_MS = '1';
    const llm = await import('../core/providers/llm.js?retry=forever');

    let calls = 0;
    llm.deepseek.chat.completions.create = async () => { calls++; throw new Error('socket hang up'); };
    await assert.rejects(() => llm.groq.chat.completions.create({ messages: [] }));
    assert.equal(calls, llm.AI_MAX_RETRIES + 1, 'المحاولةُ الأولى + الإعاداتُ المحدودة، لا أكثر');
    delete process.env.AI_PROVIDERS;
});

test('🔴 و«لا مزوّد مُهيأ» أدومُ الأعطال — لا يُعاد عليه ولا يُنتظَر لأجله', async () => {
    // لا مزوّدَ مُفعَّلاً أصلاً: السلسلةُ لا تسجّل عطباً واحداً، فـ`aggregateFailure` تعود
    // بخطأٍ بلا `aiUnavailable` — وكان الغلافُ يُعيد المحاولةَ مرّتين على غياب المفاتيح.
    // أوقعَته الحزمةُ نفسُها: كلُّ اختبارٍ يمرّ على الـLLM صار ينتظر ١٫٦ ثانية بلا سبب.
    process.env.AI_PROVIDERS = 'none';
    process.env.AI_RETRY_BASE_MS = '120';
    const llm = await import('../core/providers/llm.js?retry=unconfigured');

    // `groq` المصدَّر يصير `null` بلا مزوّد (وحُرّاسُ المستدعين يقرؤونه)، لكنّ `smartChat`
    // تنفذ إلى السلسلة مباشرةً — وهذا هو المسارُ الذي كانت الحزمةُ كلُّها تنتظر عليه.
    assert.equal(llm.groq, null, 'بلا مزوّدٍ مُفعَّل لا يُصدَّر موجّه');
    const t0 = Date.now();
    const err = await llm.smartChat([{ role: 'user', content: 'x' }]).then(() => null, (e) => e);
    const elapsed = Date.now() - t0;

    assert.ok(err, 'لم يُرمَ خطأ');
    assert.equal(err.aiUnavailable, true, 'غيابُ المفاتيح ليس عطباً عابراً — لا محاولةَ تُصلحه');
    assert.ok(elapsed < 120, `انتُظر ${elapsed}ms على غيابِ مفاتيح — انتظارٌ لا يغيّر شيئاً`);
    delete process.env.AI_PROVIDERS;
    process.env.AI_RETRY_BASE_MS = '1';
});

// ── (١) خبرُ المهمّة يبقى ─────────────────────────────────────────────────
// `join_project` يستعيد الحوارَ من `${username}::${project}` وحدَه (server.js:767).
// فما لم يُكتَب هناك لا يعود أبداً — ومهمّةٌ تمّت وغرفتُها فارغةٌ خبرُها في الفراغ.
import { rememberMissionNote, loadForPrompt, clearConversation } from '../services/conversationStore.js';
import { reportMissionSuccess } from '../agents/stages/reportMissionSuccess.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** المهلةُ قصيرة: الحفظُ لا يُنتظَر في مسار المستخدم (ولا يجوز أن يُبطئه). */
async function untilStored(key, tries = 60) {
    for (let i = 0; i < tries; i++) {
        const { window } = await loadForPrompt(key);
        if (window.length) return window;
        await new Promise(r => setTimeout(r, 10));
    }
    return (await loadForPrompt(key)).window;
}

test('🔴 خبرُ المهمّة يُكتب حيث يقرأ `chat_history` — لا في مفتاحٍ لا يُقرأ أبداً', async () => {
    const u = '__recall_u1__', p = 'proj-recall-1';
    await clearConversation(`${u}::${p}`);
    await clearConversation(u);

    await rememberMissionNote(u, p, '✅ اكتملت المهمة — تقرير التسليم:');

    const { window } = await loadForPrompt(`${u}::${p}`);
    assert.equal(window.at(-1)?.content, '✅ اكتملت المهمة — تقرير التسليم:');
    const bare = await loadForPrompt(u);
    assert.equal(bare.window.length, 0, 'كُتب تحت الاسم المجرّد — `join_project` لا ينظر هناك');
    await clearConversation(`${u}::${p}`);
});

test('🔴 وهو سطرُ مساعدٍ واحد — لا دورةَ حوارٍ يُختلق فيها كلامٌ لم يقلْه صاحبُ المشروع', async () => {
    const u = '__recall_u2__', p = 'proj-recall-2';
    await clearConversation(`${u}::${p}`);

    await rememberMissionNote(u, p, 'تقريرُ التسليم');

    const { window, total } = await loadForPrompt(`${u}::${p}`);
    assert.equal(total, 1, 'رسالتان: أُقحمت رسالةُ مستخدمٍ مختلقة تُلوّث نافذةَ النموذج');
    assert.equal(window[0].role, 'assistant');
    await clearConversation(`${u}::${p}`);
});

test('🔴 ولا يُخزَّن فراغ — سطرٌ خاوٍ يعود للمستخدم بلا معنى', async () => {
    const u = '__recall_u3__', p = 'proj-recall-3';
    await clearConversation(`${u}::${p}`);
    await rememberMissionNote(u, p, '   ');
    await rememberMissionNote(u, p, null);
    const { total } = await loadForPrompt(`${u}::${p}`);
    assert.equal(total, 0, 'خُزّن فراغ');
    await clearConversation(`${u}::${p}`);
});

test('🔴 تقريرُ التسليم يُحفظ حرفيّاً ولو كانت الغرفةُ فارغة — هذا هو العطبُ الذي رآه صاحبُ المنصّة', async () => {
    const u = '__recall_u4__', p = 'proj-recall-4';
    await clearConversation(`${u}::${p}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>مطعم</title>');

    let emitted = null;
    // غرفةٌ فارغة: البثُّ يذهب إلى لا أحد — كما يحدث حين ينتقل صاحبُ المنصّة لمتصفّحٍ آخر
    const io = { to: () => ({ emit: (ev, payload) => { if (ev === 'chat_reply') emitted = payload.message; } }) };
    const reporter = { io, send: (r, ev, pl) => io.to(r).emit(ev, pl), liveLog: () => {} };

    reportMissionSuccess('مطعم', { projectPath: dir, username: u, activeProject: p, roomName: `${u}-${p}` }, reporter);

    const window = await untilStored(`${u}::${p}`);
    assert.ok(emitted, 'لم يُبثّ تقرير أصلاً — الاختبار لا يقيس شيئاً');
    assert.equal(window.at(-1)?.content, emitted, 'ما حُفظ ليس ما بُثّ — العائدُ يقرأ خبراً غيرَ خبرِه');
    await clearConversation(`${u}::${p}`);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('🔴 وخبرُ الفشل كذلك — الصمتُ عن الفشل أسوأُ من الفشل', async () => {
    const u = '__recall_u5__', p = 'proj-recall-5';
    await clearConversation(`${u}::${p}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-fail-'));

    const replies = [];
    const io = { to: () => ({ emit: (ev, pl) => { if (ev === 'chat_reply') replies.push(pl.message); } }) };
    const rt = new JaolaCognitiveRuntime(io);
    rt._understandGoal = async () => ({ enrichedGoal: 'مطعم', blueprint: null, blueprintContext: '', domainModelContext: '' });
    rt._selectBuildStrategy = async () => null;
    rt._enrichBuildContext = async () => ({ requirementsContext: '', imageContext: '', pluginContext: '' });
    rt.buildWorldModel = async () => {};
    rt.buildMissionAndMeta = async () => {};
    rt.runDynamicMultiAgentRuntime = async () => { throw new Error('كل المزوّدين تعثّروا'); };

    const res = await rt._runMissionNow('مطعم', {
        projectPath: dir, username: u, activeProject: p, roomName: `${u}-${p}`, agents: {}, dbStatus: {},
    });
    assert.equal(res.success, false);

    const window = await untilStored(`${u}::${p}`);
    assert.ok(replies.length, 'لم تُبثّ رسالةُ فشل — الاختبار لا يقيس شيئاً');
    assert.equal(window.at(-1)?.content, replies.at(-1), 'خبرُ الفشل لم يُحفظ — يعود فيجد شاشةً بيضاء ولا يدري ما جرى');
    await clearConversation(`${u}::${p}`);
    fs.rmSync(dir, { recursive: true, force: true });
});
