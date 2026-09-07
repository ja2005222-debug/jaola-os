// 🩺 «رصيدٌ منتهٍ أو مفاتيحُ غير صالحة» — جملةٌ واحدةٌ لسببَين علاجُهما مختلف.
//
// قِيس ثلاثَ مرّاتٍ في يومٍ واحد على مشروعٍ حيّ: صاحبُ المنصّة يرى في لوحته السطرَ نفسَه مهما
// اختلف السبب، فيقول «لا جديد، نفس كل شيء» — وهو **صادقٌ ولا يدلّ على شيء**: لو تبدّل سببُ
// فشل مزوّدٍ من طرفٍ إلى طرفٍ لبقيت الجملةُ حرفاً بحرف. فيُفتح سجلُّ الخادم في كلّ مرّة.
//
// والسببان اللذان قِيسا فعلاً يفترقان تماماً في العلاج:
//   • `config` — الاسمُ المضبوط غير معروف عند المزوّد → سطرٌ في إعداد المنصّة، بلا نشر.
//   • `quota`  — الرصيد منتهٍ → دفعٌ. لا سطرَ يُصلحه.
//
// فتُسمّى الأصنافُ بلفظِنا لكلِّ مزوّدٍ على حدة. ولا يُسرَّب نصُّ المزوّد الخام إلى هنا أبداً:
// ذاك عينُ ما أُغلق في #588 حين وصل رابطُ فوترةِ حسابِ المنصّة إلى سجلّ مشروع مستخدم.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateFailure, describeAIFailure } from '../core/providers/llm.js';
import { buildFailureChatMessage } from '../agents/failureMessages.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const fail = (provider, message, status) =>
    Object.assign(new Error(message), { provider, status });

// الحالةُ المقيسة حرفيّاً من الإنتاج (2026-09-07)
const MEASURED = [
    fail('groq', 'The model does not exist', 404),
    fail('deepseek', 'Insufficient Balance', 402),
];

test('🔴 كلُّ مزوّدٍ يُسمّى بصنف عطبه — لا جملةً واحدةً للسببَين', () => {
    const err = aggregateFailure(MEASURED, MEASURED[1]);
    assert.ok(err.aiUnavailable, 'كلاهما دائم');
    assert.deepEqual(err.diagnosis, [
        { provider: 'groq', kind: 'config' },
        { provider: 'deepseek', kind: 'quota' },
    ]);

    const line = describeAIFailure(err.diagnosis, 'ar');
    assert.match(line, /groq/);
    assert.match(line, /deepseek/);
    // العلاجان مختلفان، فاللفظان مختلفان — وإلّا عاد العطبُ الذي تُغلقه هذه الحزمة
    const [g, d] = [line.slice(0, line.indexOf('deepseek')), line.slice(line.indexOf('deepseek'))];
    assert.match(g, /موديل|اسم/, 'صنفُ الإعداد لا يذكر الاسم');
    assert.match(d, /رصيد/, 'صنفُ الرصيد لا يذكر الرصيد');
    assert.doesNotMatch(g, /رصيد/, 'عطبُ الإعداد يُنسب إلى الرصيد');
});

test('🔴 والحدُّ الأمنيّ: لا نصَّ مزوّدٍ خام ولا رابط', () => {
    const leaky = [
        fail('openai', 'You have no credits remaining. Add credits at https://platform.openai.com/billing', 429),
        fail('gemini', 'models/x is no longer available, use models/y-3.6', 404),
    ];
    const line = describeAIFailure(aggregateFailure(leaky, leaky[0]).diagnosis, 'ar');
    assert.doesNotMatch(line, /https?:\/\//, 'رابطٌ وصل إلى سجلّ المستخدم — عطبُ #588 عاد');
    assert.doesNotMatch(line, /credits remaining|no longer available|models\//, 'نصُّ المزوّد الخام');
});

test('رسالةُ الشات تحمل التشخيص حين يوجد، وتبقى كما كانت حين لا يوجد', () => {
    const err = aggregateFailure(MEASURED, MEASURED[1]);
    const withDiag = buildFailureChatMessage('ar', err);
    assert.match(withDiag, /groq/);
    assert.match(withDiag, /deepseek/);

    // بلا تشخيص (كلُّ المسارات القديمة) لا يتغيّر شيء — ولا تُطبع كلمةُ undefined
    const plain = buildFailureChatMessage('ar', { aiUnavailable: true });
    assert.doesNotMatch(plain, /undefined|null/);
    assert.match(plain, /خدمة الذكاء الاصطناعي غير متاحة/);
    assert.doesNotMatch(buildFailureChatMessage('en', { aiUnavailable: true }), /undefined|null/);
});

test('الحدّ: مزوّدٌ بلا اسمٍ أو صنفٌ مجهول لا يُنتج سطراً أعرجَ', () => {
    for (const bad of [null, undefined, [], [{}], [{ provider: 'x' }], [{ kind: 'quota' }]]) {
        const out = describeAIFailure(bad, 'ar');
        assert.equal(typeof out, 'string');
        assert.doesNotMatch(out, /undefined|null/, `أعرج: ${JSON.stringify(bad)}`);
    }
});

test('🔴 والعابرُ لا يُسمّى دائماً: صنفٌ واحدٌ عابرٌ يُبقي المحاولة قائمة', () => {
    const mixed = [fail('groq', 'socket hang up'), fail('deepseek', 'Insufficient Balance', 402)];
    const err = aggregateFailure(mixed, mixed[1]);
    assert.ok(!err.aiUnavailable, 'عطبٌ عابرٌ واحدٌ يمنع إعلانَ «لا فائدة من إعادة المحاولة»');
    assert.deepEqual(err.diagnosis.map((d) => d.kind), ['transient', 'quota']);
});

test('🔴 والتشخيصُ يبلغ نصَّ الخطأ نفسِه — فسطرُ السجلّ الحيّ هو أظهرُ ما يُرى', () => {
    // لوحةُ المشروع تعرض `message` مباشرةً في سطر [Orchestrator] و[Kernel]. هذا هو الموضعُ
    // الذي نظر إليه صاحبُ المنصّة ثلاثَ مرّاتٍ فقال «لا جديد» — وكان صادقاً.
    const err = aggregateFailure(MEASURED, MEASURED[1]);
    assert.match(err.message, /خدمة الذكاء الاصطناعي غير متاحة/, 'الجملةُ الأصليّة لا تُحذف');
    assert.match(err.message, /groq/, 'التشخيصُ لا يبلغ سطرَ السجلّ');
    assert.match(err.message, /deepseek/);
    assert.doesNotMatch(err.message, /https?:\/\/|Insufficient Balance|does not exist/, 'نصٌّ خام');
});

test('الحدّ: فاصلٌ ظاهرٌ بين المزوّدَين — لا كلمتان ملتصقتان', () => {
    const line = describeAIFailure(aggregateFailure(MEASURED, MEASURED[1]).diagnosis, 'ar');
    assert.match(line, /\S\s+·\s+\S/, 'التصقت أسطرُ المزوّدَين فصارت جملةً واحدةً غامضة');
});

test('🔴 وعطبٌ بلا مزوّدٍ لا يُقحَم في التشخيص، ولا يُترك عنوانٌ فارغ', () => {
    // أعطالٌ تُرمى من خارج حلقات السلسلة (مثل «لا يوجد مزود مُهيأ») بلا وسمِ مزوّد
    const anon = Object.assign(new Error('Insufficient Balance'), { status: 402 });
    const err = aggregateFailure([anon, MEASURED[0]], anon);
    assert.deepEqual(err.diagnosis, [{ provider: 'groq', kind: 'config' }], 'دخل مجهولٌ التشخيص');

    // وبلا أيِّ تشخيصٍ لا يبقى عنوانٌ معلَّقٌ بلا محتوى
    const bare = aggregateFailure([anon], anon);
    assert.deepEqual(bare.diagnosis, []);
    assert.doesNotMatch(bare.message, /\[\]|التشخيص/, 'عنوانُ تشخيصٍ بلا تشخيص');
    for (const lang of ['ar', 'en']) {
        assert.doesNotMatch(buildFailureChatMessage(lang, bare), /التشخيص:\s*\.|Detected:\s*\./,
            'سطرُ تشخيصٍ فارغٌ في الشات');
    }
});
