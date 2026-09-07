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
import { noteUsage, readAIUsage, resetAIUsage, usageLine } from '../core/providers/llm.js';
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
