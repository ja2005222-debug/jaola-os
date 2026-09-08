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
import { aggregateFailure, describeAIFailure, classifyAIError } from '../core/providers/llm.js';
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

// ─── 🔀 رمزُ ٤٠٣ ملتبس، والرسالةُ تحسم ────────────────────────────────────────────
//
// من سجلٍّ حيٍّ لصاحب المنصّة: شُخِّص `groq` مرّتين في نحوِ عشرين ثانية بسببَين **متعارضَين** —
// «مفتاحُه غير صالح» ثمّ «اسمُ الموديل غير معروف عنده». ولا يصدُقان معاً: مفتاحٌ غيرُ صالحٍ لا
// يُبلَّغ عنه باسم موديل، واسمُ موديلٍ مجهولٍ يقتضي مفتاحاً صالحاً قُبل به الطلب.
//
// والعلّةُ مقيسة: `403` كان يُقرأ `auth` **قبل** أن تُقرأ الرسالة. والمزوّدُ يردّ على علّة
// الموديل عينِها بـ`404` مرّةً و`403` أخرى («…does not exist **or you do not have access
// to it**») — فيخرج التشخيصان المتناقضان من عطبٍ واحد. والضررُ أنّ صاحبَ المنصّة يُطارد
// مفتاحاً سليماً ويترك سطرَ إعدادٍ كان يُصلحه بلا نشر.
const err = (status, message) => Object.assign(new Error(message), { status });
const MODEL_403 = 'The model `llama-x` does not exist or you do not have access to it';

test('🔴 ٤٠٣ برسالةِ موديلٍ تُشخَّص إعداداً لا مفتاحاً — وهي حالةُ السجلّ الحيّ', () => {
    assert.equal(classifyAIError(err(403, MODEL_403)), 'config');
    assert.match(describeAIFailure([{ provider: 'groq', kind: classifyAIError(err(403, MODEL_403)) }]),
        /اسمُ الموديل/, 'كان يُقال «مفتاحُه غير صالح» عن مفتاحٍ سليم');
    // والمزوّدُ نفسُه بـ٤٠٤ على العلّة عينِها ← التشخيصُ **واحد** لا اثنان
    assert.equal(classifyAIError(err(404, MODEL_403)), classifyAIError(err(403, MODEL_403)),
        'رمزان مختلفان لعلّةٍ واحدة يجب أن يُعطيا تشخيصاً واحداً');
});

test('🔴 و٤٠٣ بلا رسالةِ موديلٍ تبقى مفتاحاً — لم يُفتح البابُ على مصراعيه', () => {
    assert.equal(classifyAIError(err(403, 'Forbidden')), 'auth');
    assert.equal(classifyAIError(err(403, 'Your account is not authorized')), 'auth');
});

test('🔴 و٤٠١ لا تحتمل لبساً فتبقى مفتاحاً ولو ذُكر موديل — «غيرُ موثَّق» ≠ «ممنوع»', () => {
    assert.equal(classifyAIError(err(401, 'Invalid API Key')), 'auth');
    assert.equal(classifyAIError(err(401, MODEL_403)), 'auth',
        'الرسالةُ تحسم الملتبسَ وحدَه — و٤٠١ ليست ملتبسة');
});

test('الحدّ: الأصنافُ الأخرى لم تتزحزح — الرصيدُ والمعدّلُ والعابرُ كما كانت', () => {
    assert.equal(classifyAIError(err(402, 'Insufficient Balance')), 'quota');
    assert.equal(classifyAIError(err(429, 'Rate limit reached')), 'ratelimit');
    assert.equal(classifyAIError(err(0, 'socket hang up')), 'transient');
    assert.equal(classifyAIError(err(400, 'API key not valid. Please pass a valid API key.')), 'auth');
});

test('📏 حدٌّ مكتوبٌ مقيس: `aiUnavailable` تُختصَر إلى `quota` — ولا تُعرَض قطّ', () => {
    // الاختصارُ في أوّل `classifyAIError` يجعل خطأً مجمَّعاً سببُه إعدادٌ يُقرأ «رصيد».
    assert.equal(classifyAIError(Object.assign(new Error('x'), { aiUnavailable: true })), 'quota');
    // ولا يبلغ صاحبَ المشروع: العرضُ يقرأ `diagnosis` المبنيَّ من الأخطاء **الخام**، لا يُعيد
    // التصنيف. قِيس على خطأٍ مجمَّعٍ سببُه إعداد: التشخيصُ المعروض يقول «اسمُ الموديل».
    const agg = aggregateFailure([Object.assign(new Error(MODEL_403), { status: 403, provider: 'groq' })], null);
    assert.match(describeAIFailure(agg.diagnosis), /اسمُ الموديل/, 'العرضُ من الخام لا من المجمَّع');
    assert.equal(agg.aiUnavailable, true, 'ويبقى دائماً فلا تُحرق دورات');
});

