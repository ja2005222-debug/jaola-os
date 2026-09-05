// 🗣️ `_stageDebate` — حلقةُ النقاش: المبرمجُ يكتب، والمعماريُّ والأمنُ والجودةُ
// ينقدون، والخطّةُ تُقبل أو تُعاد بدورةٍ أخرى في حدود الميزانيّة. ١١٧ سطراً
// بلا اختبارٍ يذكرها. اختباراتُ **توصيف** — الوكلاءُ الثلاثةُ مُحقَنون، والباقي
// حقيقيّ: تدقيقُ الأمن، ترجمةُ النقد من `checks`، تسجيلُ دروس الجودة.
//
// المحروسُ الأثمن: درسُ الفشل يُسجَّل من **الأعطاب وحدها** لا من `logs`
// كلِّها (كان «لا يوجد footer» التحذيريّ يُحفظ سببَ فشلِ بناءٍ ثمّ يُحقن في
// تلقينِ المولّد مستقبلاً — النظامُ يتعلّم من وصفٍ غيرِ صحيح). والسقوطُ لمزوّدٍ
// بلا `checks` صريح: تُسجَّل `logs` كما كانت — الصمتُ أسوأُ من الخلط.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { resetLessons, topLessons } from '../services/platformLessons.js';
import { fail, warn, pass } from '../core/evidence/Check.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const FILES = () => [
    { name: 'index.html', content: '<!DOCTYPE html><html><body><h1>x</h1><script src="script.js"></script></body></html>' },
    { name: 'script.js', content: 'document.body.textContent = "ok";' },
];

/** ميزانيّةٌ حقيقيّةُ الشكل: عدّادٌ لا يتجاوز maxApiCalls. */
function budget(max) {
    let used = 0;
    return { maxApiCalls: max, get used() { return used; }, isExhausted: () => used >= max, consumeCall: () => (used < max ? (++used, true) : false) };
}

function debate(prefix, { max = 5, coder, architect, qa } = {}) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    resetLessons();
    const calls = { coder: [], architect: [], qa: [] };
    const agents = {
        coreGenerateCodePlan: async (prompt, codeCtx, visual, images, onChunk, sections, lang) => {
            calls.coder.push({ prompt, lang, sections });
            return coder ? coder(calls.coder.length) : { files: FILES() };
        },
        architectReview: async (plan) => { calls.architect.push(plan); return architect ? architect(calls.architect.length) : { approved: true, feedback: '' }; },
        qaVerify: async (plan) => { calls.qa.push(plan); return qa ? qa(calls.qa.length) : { passed: true, logs: [] }; },
    };
    const context = {
        goal: 'حاسبة زكاة', initialCodeContext: '', username: s.ctx.username, activeProject: s.ctx.activeProject,
        budget: budget(max), internalDebate: { criticTranscripts: [] },
        mentalModel: { visualIdentity: 'أزرق', templateSections: ['hero'] },
    };
    const run = () => s.rt._stageDebate(context, s.ctx.roomName, agents);
    const critics = () => context.internalDebate.criticTranscripts.map((c) => c.agent);
    return { ...s, calls, context, run, critics };
}

test('المسارُ السعيد: دورةٌ واحدة، الخطّةُ تعود مُنظَّفةً من placeholders، والوكلاءُ نُودوا مرّة', async () => {
    // 🔎 توصيف: التنظيفُ يطال الأقواسَ **العربيّة** `{اسم …}` في HTML وحدَه —
    //    لا `{{PROJECT_NAME}}` ولا ملفّاتِ JS. والبديلُ اسمُ المشروع بلا شُرَط.
    const s = debate('deb', { coder: () => ({ files: [{ name: 'index.html', content: '<h1>{اسم المشروع}</h1>' }, { name: 'script.js', content: 'const t = "{اسم}";' }] }) });
    const plan = await s.run();
    assert.ok(plan?.files?.length, 'خطّةٌ عادت');
    const pretty = s.ctx.activeProject.replace(/[-_]+/g, ' ');
    assert.equal(plan.files[0].content, `<h1>${pretty}</h1>`, 'placeholder القالب يُستبدل قبل النقد');
    assert.equal(plan.files[1].content, 'const t = "{اسم}";', 'JS لا يُلمس');
    assert.equal(s.calls.coder.length, 1);
    assert.equal(s.calls.architect.length, 1);
    assert.equal(s.calls.qa.length, 1);
    assert.deepEqual(s.critics(), []);
    assert.equal(s.calls.coder[0].lang, 'ar', 'لغةُ المستخدم تُمرَّر للمولّد');
    assert.deepEqual(s.calls.coder[0].sections, ['hero']);
});

test('استثناءٌ عابر من المبرمج → نقدٌ CODER_EXCEPTION ودورةٌ تالية تنجح', async () => {
    const s = debate('deb', { coder: (n) => { if (n === 1) throw new Error('rate limited'); return { files: FILES() }; } });
    const plan = await s.run();
    assert.ok(plan?.files?.length);
    assert.equal(s.calls.coder.length, 2);
    assert.deepEqual(s.critics(), ['CODER_EXCEPTION']);
    assert.equal(s.context.internalDebate.criticTranscripts[0].critique, 'rate limited');
    assert.match(s.logs(), /استثناء: rate limited/);
});

test('عطلُ مزوّدٍ دائم (aiUnavailable) → يُرمى فوراً بلا دوراتٍ عبثيّة', async () => {
    const s = debate('deb', { coder: () => { const e = new Error('رصيد منتهٍ'); e.aiUnavailable = true; throw e; } });
    await assert.rejects(s.run, (e) => e.aiUnavailable === true && e.message === 'رصيد منتهٍ');
    assert.equal(s.calls.coder.length, 1, 'دورةٌ واحدةٌ فقط');
    assert.match(s.logs(), /⛔ رصيد منتهٍ/);
});

test('خطّةٌ بخطأ aiUnavailable → الرميُ نفسُه', async () => {
    const s = debate('deb', { coder: () => ({ error: true, aiUnavailable: true, details: 'مفاتيح مفقودة' }) });
    await assert.rejects(s.run, (e) => e.aiUnavailable === true && e.message === 'مفاتيح مفقودة');
    assert.equal(s.calls.coder.length, 1);
});

test('خطأٌ عاديّ ثمّ ردٌّ فارغ → نقدان بترتيبهما، ثمّ نجاح', async () => {
    const s = debate('deb', { coder: (n) => (n === 1 ? { error: true, details: 'bad json' } : n === 2 ? { files: [] } : { files: FILES() }) });
    const plan = await s.run();
    assert.ok(plan?.files?.length);
    assert.deepEqual(s.critics(), ['CODER_ERROR', 'CODER_EMPTY_RESPONSE']);
    assert.equal(s.calls.coder.length, 3);
});

test('المعماريُّ يرفض → **كلُّ** ما وجده يُنقَل لا أوّلُه، ثمّ تُقبل الدورةُ التالية', async () => {
    const s = debate('deb', {
        architect: (n) => (n === 1 ? { approved: false, checks: [fail('a11y', 'لا alt'), fail('seo', 'لا title'), warn('perf', 'صورة كبيرة')], feedback: 'x' } : { approved: true, feedback: '' }),
    });
    const plan = await s.run();
    assert.ok(plan?.files?.length);
    assert.deepEqual(s.critics(), ['Architect']);
    const c = s.context.internalDebate.criticTranscripts[0].critique;
    assert.match(c, /❌ لا alt/); assert.match(c, /❌ لا title/); assert.match(c, /⚠️ صورة كبيرة/);
    assert.equal(s.calls.coder.length, 2);
    assert.match(s.logs(), /رُفض من 1 متخصص/);
});

test('معماريٌّ بلا checks → يُقبل feedback احتياطاً', async () => {
    const s = debate('deb', { architect: (n) => (n === 1 ? { approved: false, feedback: 'بنية ضعيفة' } : { approved: true }) });
    await s.run();
    assert.equal(s.context.internalDebate.criticTranscripts[0].critique, 'بنية ضعيفة');
});

test('تدقيقُ الأمن الحتميّ: innerHTML بلا textContent في index.html → نقدٌ أمنيّ', async () => {
    const s = debate('deb', {
        coder: (n) => ({ files: [{ name: 'index.html', content: n === 1 ? '<div id=a></div><script>a.innerHTML=location.hash</script>' : '<div>ok</div>' }] }),
    });
    const plan = await s.run();
    assert.ok(plan?.files?.length);
    assert.deepEqual(s.critics(), ['Security']);
    assert.match(s.context.internalDebate.criticTranscripts[0].critique, /XSS/);
});

test('الجودةُ تفشل بـchecks → درسُ الفشل من الأعطاب **وحدها**، لا من التحذيرات', async () => {
    const s = debate('deb', {
        qa: (n) => (n === 1 ? { passed: false, checks: [fail('js', 'خطأ JS في script.js'), warn('footer', 'لا يوجد footer'), pass('title', 'ok')], logs: ['خطأ JS في script.js', 'لا يوجد footer'] } : { passed: true, logs: [] }),
    });
    await s.run();
    const lessons = topLessons(50).filter((l) => l.type === 'qa_failure').map((l) => l.key);
    assert.deepEqual(lessons, ['خطأ js في script.js'], `الأعطابُ وحدَها، بمفتاحٍ مُطبَّع: ${lessons}`);
    assert.match(s.context.internalDebate.criticTranscripts[0].critique, /❌ خطأ JS.*⚠️ لا يوجد footer/);
});

test('الجودةُ تفشل بلا checks (مزوّدٌ قديم) → السقوطُ الصريح: logs كلُّها تُسجَّل', async () => {
    // بلا دليلٍ على التمييز لا نخترعه — الصمتُ عن الجميع أسوأُ من خلطِهم.
    const s = debate('deb', { qa: (n) => (n === 1 ? { passed: false, logs: ['عطب أ', 'تحذير ب'] } : { passed: true, logs: [] }) });
    await s.run();
    const lessons = topLessons(50).filter((l) => l.type === 'qa_failure').map((l) => l.key).sort();
    assert.deepEqual(lessons, ['تحذير ب', 'عطب أ'], `كلاهما: ${lessons}`);
    assert.equal(s.context.internalDebate.criticTranscripts[0].critique, 'عطب أ | تحذير ب');
});

test('ثلاثةُ ناقدين معاً → نقدٌ واحدٌ لكلٍّ في الدورة نفسِها', async () => {
    const s = debate('deb', {
        coder: (n) => ({ files: [{ name: 'index.html', content: n === 1 ? '<script>x.innerHTML=1</script>' : '<p>ok</p>' }] }),
        architect: (n) => (n === 1 ? { approved: false, feedback: 'a' } : { approved: true }),
        qa: (n) => (n === 1 ? { passed: false, logs: ['q'] } : { passed: true, logs: [] }),
    });
    await s.run();
    assert.deepEqual(s.critics(), ['Architect', 'Security', 'QA']);
    assert.match(s.logs(), /رُفض من 3 متخصص/);
});

test('التلقينُ يحمل آخرَ ثلاثةِ انتقاداتٍ فقط — لا المصفوفةَ كلَّها', async () => {
    const s = debate('deb', { max: 20, coder: (n) => (n <= 5 ? { error: true, details: `خطأ${n}` } : { files: FILES() }) });
    await s.run();
    const last = s.calls.coder.at(-1).prompt;
    assert.match(last, /خطأ3/); assert.match(last, /خطأ4/); assert.match(last, /خطأ5/);
    assert.doesNotMatch(last, /خطأ1|خطأ2/, 'النقدُ القديمُ المُعالَج لا يضخّم التلقين');
    assert.doesNotMatch(s.calls.coder[0].prompt, /انتقادات يجب معالجتها/, 'الدورةُ الأولى بلا كتلةِ انتقادات');
});

test('الميزانيّة: كلُّ الدورات ترفض → null بعد maxApiCalls محاولةً بالضبط', async () => {
    const s = debate('deb', { max: 3, coder: () => ({ error: true, details: 'x' }) });
    assert.equal(await s.run(), null);
    assert.equal(s.calls.coder.length, 3);
    assert.equal(s.critics().length, 3);
});

test('الميزانيّة: النقّادُ يستهلكون نداءاتٍ أيضاً، فمع ٢ لا تُبلَغ دورةٌ ثانية', async () => {
    // دورةٌ واحدة = مبرمج + معماريّ + جودة = ٣ نداءات. بميزانيّة ٢: المبرمجُ ١،
    // المعماريُّ ٢، والجودةُ بلا رصيد تُقبل افتراضيّاً. رفضٌ → الدورةُ ٢ تُقطع.
    const s = debate('deb', { max: 2, architect: () => ({ approved: false, feedback: 'no' }) });
    assert.equal(await s.run(), null);
    assert.equal(s.calls.coder.length, 1);
    assert.equal(s.calls.qa.length, 0, 'الجودةُ لم تُستدعَ — الرصيدُ نفد');
    assert.match(s.logs(), /الميزانية استنفدت/);
});
