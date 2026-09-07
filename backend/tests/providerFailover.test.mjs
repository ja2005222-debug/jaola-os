// ⛓️ سلسلةُ المزوّدين — «العطبُ الدائمُ يُقرأ عابراً فتُحرق الدورات، والنصُّ الخامُ يُعرض لصاحب المشروع».
//
// قِيس من سجلّ Render الحقيقيّ (2026-09-07، 11:02:48–11:02:53) على مشروعٍ حيّ: أربعةُ مزوّدين سقطوا
// بالترتيب، واثنان منهم لسببٍ ليس الرصيد بل **اسمُ موديلٍ تقاعد**:
//   Groq      404 — The model `llama-3.3-70b-versatile` does not exist or you do not have access to it
//   DeepSeek  402 — Insufficient Balance
//   Gemini    404 — This model models/gemini-2.0-flash is no longer available … use models/gemini-3.6-flash
//   OpenAI    429 — You have no credits remaining. Add credits … platform.openai.com/…/billing
//
// وعطبان يخرجان من ذلك، وهما في الجذر عطبٌ واحد:
//   • لفظُ Google «no longer available»/`NOT_FOUND` لا يعرفه المُصنِّف (يعرف `not exist`/`not found`)،
//     فيُقرأ عطبُ الإعداد الدائمُ **عابراً**، فيسقط شرطُ `failures.every(isPermanentAIError)`،
//     فلا تُرفع `aiUnavailable`، فتُكمل حلقةُ النقاش دوراتِها السبع على أربعة أبوابٍ مغلقة.
//   • وحين لا تُرفع الإشارة تُرمى رسالةُ المزوّد الخام كما هي، فيقرأ صاحبُ المشروع — وهو يبني متجراً —
//     رابطَ فوترةِ حسابِ المنصّة. للسلسلة جملتُها الآمنة أصلاً؛ كانت لا تُبلَغ إلّا في حالةٍ واحدة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    classifyAIError, isPermanentAIError, aggregateFailure,
    AI_UNAVAILABLE_MSG, AI_RETRYABLE_MSG,
} from '../core/providers/llm.js';
import { runDebate } from '../agents/stages/debate.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const mk = (message, status) => Object.assign(new Error(message), status ? { status } : {});

/** أعطالُ الجولة كما كتبها المزوّدون في سجلّ المالك — بلا تهذيب. */
const LOG = {
    groq: () => mk('404 404 {"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or you do not have access to it"}}', 404),
    deepseek: () => mk('402 402 Insufficient Balance', 402),
    openai: () => mk('429 429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing', 429),
    // كما يلفّها coderAgent.js: `throw new Error(\`Gemini: ${e.message}\`)`
    gemini: () => new Error('Gemini: {"error":{"code":404,"message":"This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.6-flash for the latest features and improvements. We recommend you to use the Interactions API.","status":"NOT_FOUND"}}'),
};

test('🔴 الأعطالُ الأربعةُ الحقيقيّة كلُّها دائمة — لا يزول أيٌّ منها بإعادة المحاولة', () => {
    for (const [name, make] of Object.entries(LOG)) {
        const e = make();
        assert.ok(isPermanentAIError(e), `${name} قُرئ «${classifyAIError(e)}» — والتكرارُ عليه هدر`);
    }
    // ولكلٍّ سببُه الصحيح لا مجرّد «دائم»
    assert.equal(classifyAIError(LOG.groq()), 'config', 'اسمُ موديلٍ ميّت = عطبُ إعداد');
    assert.equal(classifyAIError(LOG.gemini()), 'config', 'وتقاعدُ الموديل كذلك — بلفظ Google');
    assert.equal(classifyAIError(LOG.deepseek()), 'quota');
    assert.equal(classifyAIError(LOG.openai()), 'quota');
});

test('🔴 تقاعدُ الموديل بألفاظ المزوّدين الأربعة — لا بلفظٍ واحدٍ توقّعناه', () => {
    for (const msg of [
        'The model `x` does not exist or you do not have access to it',   // Groq / OpenAI
        'This model models/gemini-2.0-flash is no longer available.',      // Google
        'models/gemini-1.0-pro is not found for API version v1beta',        // Google (صيغةٌ أخرى)
        'This model has been deprecated, please use the replacement',      // OpenAI
    ]) {
        assert.equal(classifyAIError(new Error(msg)), 'config', `لم يُعرف: ${msg.slice(0, 46)}`);
    }
});

test('🔴 حارسٌ مضادّ: العابرُ يبقى عابراً — لا يُسكَت التكرارُ على عطلٍ يزول', () => {
    for (const e of [
        mk('429 Rate limit reached for model X. Please try again in 19.5s', 429),
        mk('500 Internal Server Error', 500),
        new Error('Connection error.'),
        new Error('Request timed out.'),
    ]) {
        assert.equal(isPermanentAIError(e), false, `صار دائماً خطأً: ${e.message.slice(0, 40)}`);
    }
});

test('🔴 نصُّ المزوّد الخام لا يخرج من السلسلة — لا رابطَ فوترةٍ ولا مضيفَ مزوّد', () => {
    const permanent = aggregateFailure([LOG.groq(), LOG.deepseek(), LOG.openai()], LOG.openai());
    assert.equal(permanent.message, AI_UNAVAILABLE_MSG);
    assert.equal(permanent.aiUnavailable, true, 'الإشارةُ التي توقف الدورات');

    // ومجموعةٌ ليست كلُّها دائمة: التكرارُ يبقى مسموحاً، والنصُّ الخامُ يبقى محجوباً
    const mixed = aggregateFailure([mk('429 Rate limit reached, try again in 19.5s', 429), LOG.openai()], LOG.openai());
    assert.equal(mixed.message, AI_RETRYABLE_MSG);
    assert.ok(!mixed.aiUnavailable, 'عطلٌ قد يزول — لا تُرفع إشارةُ الإيقاف');
    assert.equal(isPermanentAIError(mixed), false, 'ولا تُصنَّف الرسالةُ الآمنةُ نفسُها دائمة');

    for (const err of [permanent, mixed]) {
        assert.ok(!/platform\.openai\.com|billing|api\.deepseek|credits remaining/i.test(err.message),
            `تسرّب إلى صاحب المشروع: ${err.message}`);
        // والتفصيلُ الخام محفوظٌ للسجلّ — يُشخَّص العطبُ ولا يُعرض
        assert.ok(err.causes.some((c) => /credits remaining/.test(c)), 'السببُ الخامُ باقٍ في causes');
    }
});

test('🔴 حلقةُ النقاش تقف من الدورة الأولى على أعطال الجولة الحقيقيّة — لا سبعُ دورات', async () => {
    const run = async (failures) => {
        let cycles = 0;
        const context = {
            budget: { maxApiCalls: 7, isExhausted: () => false, consumeCall: () => true },
            goal: 'متجر ورد', initialCodeContext: '', username: `pf_${Date.now()}_${Math.random()}`,
            activeProject: 'pf', internalDebate: { criticTranscripts: [] }, mentalModel: {},
        };
        const agents = {
            // قرارُ coderAgent.js على مجموعةِ فشلٍ معطاة
            coreGenerateCodePlan: async () => {
                cycles += 1;
                const agg = aggregateFailure(failures, failures.at(-1));
                return agg.aiUnavailable
                    ? { error: true, aiUnavailable: true, details: agg.message }
                    : { error: true, details: 'فشلت جميع النماذج في توليد كود صالح.' };
            },
            architectReview: async () => ({ approved: true, feedback: '' }),
            qaVerify: async () => ({ passed: true, logs: [] }),
        };
        let stopped = false;
        try { await runDebate(context, 'room', agents, { liveLog: () => {}, send: () => {} }); }
        catch (e) { stopped = !!e.aiUnavailable; }
        return { cycles, stopped };
    };

    const real = await run([LOG.groq(), LOG.deepseek(), LOG.gemini()]);
    assert.deepEqual(real, { cycles: 1, stopped: true }, `أُحرقت ${real.cycles} دورات على أربعة أبوابٍ مغلقة`);

    // وحدُّه: عطلٌ عابرٌ واحدٌ بينها يعني أنّ إعادةَ المحاولة قد تُجدي — فتُستأنف الدورات عمداً
    const worthRetrying = await run([LOG.groq(), mk('500 Internal Server Error', 500)]);
    assert.equal(worthRetrying.stopped, false, 'عطلٌ قد يزول لا يوقف المحاولة');
    assert.equal(worthRetrying.cycles, 7);
});
