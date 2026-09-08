// 💰 «مش غالي شوي؟» — سؤالٌ لا يملك أحدٌ جوابَه.
//
// قِيس بالبحث: **صفرُ** مواضعَ في المنصّة تلتقط `total_tokens`. فكلفةُ بناءٍ واحدٍ مجهولةٌ
// تماماً — لا لصاحب المنصّة ولا لي. وأيُّ جوابٍ عن «الأغلى/الأرخص» بلا رقمٍ رأيٌ لا قياس.
//
// والكلفةُ ليست سعرَ الرمز وحدَه: هي السعر × الرموز × **عدد النداءات**، وحلقةُ النقاش تبلغ
// سبعَ دورات. فالمقياسُ يعدّ النداءات والرموزَ معاً.
//
// وحدٌّ مقصود: **لا يُرسَل معامِلٌ جديد للمزوّد** (`stream_options` مثلاً). المسارُ المتدفّق
// هو مسارُ توليد الكود الذي بدأ يعمل اليوم بعد يومٍ كامل، وكسرُه بمعامِلٍ قد يرفضه مزوّدٌ
// ثمنٌ لا يُدفع لأجل عدّاد. يُقرأ ما يتطوّع به المزوّد، ويُقال صراحةً كم نداءً بقي بلا رقم.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteUsage, readAIUsage, resetAIUsage, usageLine, usageByLabelLine, withUsageLabel, currentUsageLabel } from '../core/providers/llm.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const u = (p, c) => ({ usage: { prompt_tokens: p, completion_tokens: c, total_tokens: p + c } });

test('🔴 الرموزُ تُجمع لكلِّ مزوّدٍ على حدة، والنداءاتُ تُعدّ', () => {
    resetAIUsage();
    noteUsage('groq', u(100, 50));
    noteUsage('groq', u(200, 80));
    noteUsage('deepseek', u(10, 5));

    const a = readAIUsage();
    assert.equal(a.total, 445);
    assert.equal(a.prompt, 310);
    assert.equal(a.completion, 135);
    assert.equal(a.calls, 3);
    assert.equal(a.counted, 3, 'كلُّها جاءت برقم');
    assert.equal(a.byProvider.groq.total, 430);
    assert.equal(a.byProvider.deepseek.total, 15);
});

test('🔴 ونداءٌ بلا أرقام يُعدّ ولا يُحسب — فلا يُدّعى رقمٌ ناقصٌ كاملاً', () => {
    // المزوّدُ المتدفّق قد لا يتطوّع بـusage. الصمتُ عن ذلك يجعل الرقمَ يبدو كلَّ الكلفة.
    resetAIUsage();
    noteUsage('groq', u(100, 50));
    noteUsage('groq', {});                 // ردٌّ بلا usage
    noteUsage('groq', null);               // ولا كائن
    noteUsage('groq', { usage: { total_tokens: 'كثير' } });   // قيمةٌ ليست رقماً

    const a = readAIUsage();
    assert.equal(a.total, 150);
    assert.equal(a.calls, 4, 'كلُّ نداءٍ يُعدّ');
    assert.equal(a.counted, 1, 'وواحدٌ فقط جاء برقم');
    assert.match(usageLine(a), /3/, 'السطرُ لا يذكر النداءاتِ الصامتة');
});

test('السطرُ يقول الرموزَ والنداءاتِ ونصيبَ كلِّ مزوّد', () => {
    resetAIUsage();
    noteUsage('groq', u(1000, 500));
    noteUsage('deepseek', u(200, 100));
    const line = usageLine(readAIUsage());
    assert.match(line, /1800|1,800/, 'المجموع غائب');
    assert.match(line, /groq/);
    assert.match(line, /deepseek/);
    assert.doesNotMatch(line, /undefined|NaN|null/);
});

test('الحدّ: لقطةٌ لا مرجعٌ حيّ — قراءةٌ بعد قراءةٍ لا تتبدّل تحت اليد', () => {
    resetAIUsage();
    noteUsage('groq', u(10, 10));
    const first = readAIUsage();
    noteUsage('groq', u(90, 90));
    assert.equal(first.total, 20, 'اللقطةُ تبدّلت بعد أخذها');
    assert.equal(first.byProvider.groq.total, 20, 'وحصّةُ المزوّد تبدّلت — مرجعٌ حيٌّ لا لقطة');
    assert.equal(readAIUsage().total, 200);
});

test('🔴 والفرقُ بين لقطتَين هو كلفةُ مهمّةٍ واحدة — لا كلفةُ العملية كلِّها', () => {
    resetAIUsage();
    noteUsage('groq', u(1000, 0));          // مهمّةٌ سابقة
    const before = readAIUsage();
    noteUsage('groq', u(30, 20));           // مهمّتُنا
    noteUsage('deepseek', u(5, 5));
    const line = usageLine(readAIUsage(), before);
    // الرقمُ مثبَّتٌ بموضعه لا بوجوده: «1060» يحوي «60» أيضاً، فمطابقةٌ رخوة تُنجي الطفرة
    assert.match(line, /:\s*60\s/, 'الفرقُ ٦٠ رمزاً — حُسبت المهمّةُ السابقة معها');
    assert.doesNotMatch(line, /1060|1,060/, 'أُعلن مجموعُ العملية مكانَ كلفة المهمّة');
});

test('الحدّ: صفرُ نداءاتٍ لا يُنتج سطراً أعرج', () => {
    resetAIUsage();
    const line = usageLine(readAIUsage());
    assert.match(line, /لا نداءات/, 'سطرُ أصفارٍ بدل «لا نداءات»');
    assert.doesNotMatch(line, /undefined|NaN/);
});

test('🔴 والتدفّقُ لا يُحسب عند إنشائه — الرموزُ تُعرف عند آخر قطعة', async () => {
    // التدفّقُ يُوسَم باسم مزوّده ويُترك لمستهلكه؛ عدُّه عند الإنشاء يسجّل نداءً بلا أرقامٍ أبداً
    process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
    process.env.AI_PROVIDERS = 'deepseek';
    const llm = await import('../core/providers/llm.js?usage=stream');
    const chunks = [{ choices: [{ delta: { content: 'x' } }] }, { choices: [], usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } }];
    llm.deepseek.chat.completions.create = async () => ({ async *[Symbol.asyncIterator]() { yield* chunks; } });

    llm.resetAIUsage();
    const stream = await llm.groq.chat.completions.create({ messages: [], stream: true });
    assert.equal(llm.readAIUsage().calls, 0, 'حُسب التدفّقُ عند إنشائه');
    assert.equal(stream.__aiProvider, 'deepseek', 'التدفّقُ بلا وسمِ مزوّده');

    for await (const c of stream) llm.noteUsage(stream.__aiProvider, c);
    const a = llm.readAIUsage();
    assert.equal(a.total, 10);
    assert.equal(a.byProvider.deepseek.total, 10, 'نُسبت الرموزُ لغير مزوّدها');
    delete process.env.AI_PROVIDERS;
});

// ─── 🏷️ وسمُ المنادي: «أيُّ وكيلٍ يحرق الرموز؟» ────────────────────────────────
//
// العدّادُ كان يسجّل لكلِّ **مزوّد**، فيجيب «كم» ولا يجيب «أين». وصاحبُ المنصّة عرض توزيعَ
// موديلاتٍ على الوكلاء، فقِيس أوّلاً أنّ ذلك التوزيعَ **غيرُ قابلٍ للتطبيق اليوم** (موديلٌ
// واحدٌ للمنصّة، والسلسلةُ تدهس أيَّ موديلٍ يمرّره المنادي)، وأنّ قرارَه بلا هذه الأرقام حدسٌ.
//
// والوسمُ **محيطيّ**: قِيس أنّ مواضعَ النداء المباشرة ١٩ في ١٤ ملفّاً، وأنّ وكلاء فريق الخلفية
// كلَّهم يمرّون بـ`runAgent` وهو يعرف `agent.id` سلفاً — فتغييرُ التواقيع كان يمسّ كلَّ منادٍ
// ليخدم عدّاداً.
const U = (t) => ({ usage: { total_tokens: t, prompt_tokens: t, completion_tokens: 0 } });

test('🏷️ النداءُ يُنسَب إلى نطاقه — ولو بعد await عميق', async () => {
    resetAIUsage();
    await withUsageLabel('planner', async () => {
        await new Promise((r) => setTimeout(r, 5));
        await (async () => { await Promise.resolve(); noteUsage('groq', U(50)); })();
    });
    assert.deepEqual(readAIUsage().byLabel, { planner: { calls: 1, total: 50 } });
});

test('🏷️ والمسارُ التدفّقيّ كذلك — وهو موضعُ الشكّ الوحيد فقِيس ولم يُفترَض', async () => {
    // `callGroq` يستهلك التدفّقَ بـ`for await` ثمّ ينادي `noteUsage` عند آخر قطعة. لو لم يعبر
    // الوسمُ هناك لاحتاج كائنُ التدفّق وسماً مستقلّاً — قِيس أنّه يعبر، فبقيت الشفرةُ أبسط.
    resetAIUsage();
    async function* stream() { yield {}; yield {}; yield U(77); }
    await withUsageLabel('coder', async () => {
        for await (const chunk of stream()) if (chunk.usage) noteUsage('تدفّق', chunk);
    });
    assert.deepEqual(readAIUsage().byLabel, { coder: { calls: 1, total: 77 } });
});

test('🏷️ نداءان متوازيان بوسمَين لا يتسرّب أحدُهما إلى الآخر', async () => {
    resetAIUsage();
    await Promise.all([
        withUsageLabel('A', async () => { await new Promise((r) => setTimeout(r, 10)); noteUsage('groq', U(1)); }),
        withUsageLabel('B', async () => { await new Promise((r) => setTimeout(r, 3)); noteUsage('groq', U(2)); }),
    ]);
    const { byLabel } = readAIUsage();
    assert.equal(byLabel.A.total, 1); assert.equal(byLabel.B.total, 2);
});

test('🏷️ التعشيشُ: الأقربُ يغلب، والخارجُ يستأنف بعده', async () => {
    resetAIUsage();
    await withUsageLabel('outer', async () => {
        noteUsage('groq', U(10));
        await withUsageLabel('inner', async () => { noteUsage('groq', U(20)); });
        noteUsage('groq', U(30));
    });
    const { byLabel } = readAIUsage();
    assert.deepEqual(byLabel.outer, { calls: 2, total: 40 });
    assert.deepEqual(byLabel.inner, { calls: 1, total: 20 });
});

test('🏷️ وما وقع خارج كلِّ نطاقٍ يُسمّى «بلا وسم» — لا يُبتلَع في المجموع', async () => {
    resetAIUsage();
    noteUsage('groq', U(9));
    assert.deepEqual(readAIUsage().byLabel, { 'بلا وسم': { calls: 1, total: 9 } });
    // ووسمٌ فارغ = لا نطاق: لا يُخترَع اسمٌ من فراغ
    assert.equal(currentUsageLabel(), null);
    for (const empty of ['', '   ', null, undefined]) {
        assert.equal(await withUsageLabel(empty, async () => currentUsageLabel()), null, `«${empty}» فتح نطاقاً`);
    }
});

test('🏷️ الحدُّ: المجموعُ لا يتغيّر بالوسم — أداةُ نسبةٍ لا أداةُ حساب', async () => {
    resetAIUsage();
    await withUsageLabel('x', async () => { noteUsage('groq', U(5)); });
    noteUsage('groq', U(7));
    const a = readAIUsage();
    assert.equal(a.total, 12, 'الوسمُ لا يزيد ولا ينقص');
    assert.equal(a.byLabel.x.total + a.byLabel['بلا وسم'].total, a.total, 'وحصصُ الوسوم تجمع الكلّ');
    // واللقطةُ منفصلة كما byProvider
    const snap = readAIUsage();
    noteUsage('groq', U(3));
    assert.equal(snap.byLabel['بلا وسم'].total, 7, 'لقطةٌ لا مرجعٌ حيّ');
});


// ═══════════════════════════════════════════════════════
// 🏷️ سطرُ «أين ذهبت الرموز»
// ═══════════════════════════════════════════════════════

test('🔴 السطرُ يرتّب تنازليّاً — لأنّ السؤالَ عليه دائماً «مَن الأكثر؟»', () => {
    resetAIUsage();
    withUsageLabel('review', () => noteUsage('groq', u(10, 10)));
    withUsageLabel('coder:generate', () => noteUsage('groq', u(500, 500)));
    withUsageLabel('router', () => noteUsage('groq', u(50, 50)));
    const line = usageByLabelLine(readAIUsage());
    assert.match(line, /coder:generate 1000 \(1\).*router 100 \(1\).*review 20 \(1\)/);
});

test('🔴 و«بلا وسم» بندٌ مُعلَنٌ في السطر — لا فجوةٌ تُبتلَع في المجموع', () => {
    resetAIUsage();
    withUsageLabel('review', () => noteUsage('groq', u(10, 10)));
    noteUsage('groq', u(30, 30));   // وكيلُ إضافةٍ من اللوحة: شفرةٌ مولَّدة لا موضعُ نداء
    const line = usageByLabelLine(readAIUsage());
    assert.match(line, /بلا وسم 60 \(1\)/);
    // والمجموعُ يبقى المجموع: الوسمُ ينسب ولا يخصم.
    assert.equal(readAIUsage().total, 80);
});

test('الحدّ: صفرُ نداءاتٍ لا يُنتج سطراً أعرج هنا أيضاً', () => {
    resetAIUsage();
    assert.equal(usageByLabelLine(readAIUsage()), '🏷️ [AI Usage/وكيل]: لا نداءات.');
});

test('🔴 والفرقُ بين لقطتَين ينسب كلفةَ **مهمّةٍ واحدة** لوكلائها', () => {
    resetAIUsage();
    withUsageLabel('review', () => noteUsage('groq', u(100, 100)));   // مهمّةٌ سابقة
    const before = readAIUsage();
    withUsageLabel('review', () => noteUsage('groq', u(5, 5)));
    withUsageLabel('blueprint', () => noteUsage('groq', u(20, 20)));
    const line = usageByLabelLine(readAIUsage(), before);
    // لا تظهر الـ٢٠٠ السابقة، ويبقى `review` بنصيبه من هذه المهمّة وحدَها
    assert.match(line, /blueprint 40 \(1\)/);
    assert.match(line, /review 10 \(1\)/);
    assert.ok(!line.includes('210'), 'كلفةُ المهمّة السابقة لا تُحمَّل على هذه');
});

test('🔴 ووكيلٌ لم يُنادَ في هذه المهمّة لا يظهر بصفرٍ يُشوّش الترتيب', () => {
    resetAIUsage();
    withUsageLabel('review', () => noteUsage('groq', u(100, 100)));
    const before = readAIUsage();
    withUsageLabel('blueprint', () => noteUsage('groq', u(20, 20)));
    const line = usageByLabelLine(readAIUsage(), before);
    assert.ok(!line.includes('review'), 'الساكنُ في هذه المهمّة يُطوى لا يُعرض صفراً');
});

// ═══════════════════════════════════════════════════════
// 🔤 اسمان لحقلٍ واحد — ثقبٌ ظهر حين وُسِمت النداءات
// ═══════════════════════════════════════════════════════
test('🔴 أرقامُ Gemini تُحسب — حقولُها camelCase وكانت تسقط كلُّها صامتة', () => {
    resetAIUsage();
    // شكلُ `usageMetadata` كما تمرّرها السلسلةُ في `tagged('gemini', { …, usage: r?.usageMetadata })`
    noteUsage('gemini', { usage: { promptTokenCount: 70, candidatesTokenCount: 30, totalTokenCount: 100 } });
    const u = readAIUsage();
    assert.equal(u.counted, 1, 'نداءٌ بأرقامٍ كاملة لا يُعدّ صامتاً');
    assert.equal(u.total, 100);
    assert.equal(u.prompt, 70);
    assert.equal(u.completion, 30);
});

test('والاسمُ الآخرُ لم ينكسر — snake_case يبقى مقروءاً كما كان', () => {
    resetAIUsage();
    noteUsage('groq', u(70, 30));
    assert.equal(readAIUsage().total, 100);
});

test('الحدّ: نداءٌ بلا أرقامٍ بأيِّ التسميتَين يبقى صامتاً — لا يُخترَع له رقم', () => {
    resetAIUsage();
    noteUsage('gemini', { usage: { candidatesTokenCount: 0 } });
    const r = readAIUsage();
    assert.equal(r.calls, 1);
    assert.equal(r.counted, 0);
});
