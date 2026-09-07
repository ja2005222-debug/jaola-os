// 🎚️ اختيارُ حلقات السلسلة — «الاستبعادُ لا يُلغي مفتاحاً، والصمتُ لا يُخفي خطأً».
//
// طلبٌ تشغيليّ من صاحب المنصّة: حصرُ التجارب مؤقّتاً في مزوّدَين. الطريقُ الساذج حذفُ المفتاحَين من
// البيئة — لكنّه يُتلف إعداداً ويحتاج استرجاعاً. فمفتاحُ `AI_PROVIDERS` يستبعد **دون أن يمسّ مفتاحاً**.
//
// والحدُّ الذي قِيس قبل الكتابة: `coderAgent` ينادي `deepseek` و`ai` **مباشرةً** خارج
// `createWithFailover` — فاستبعادٌ في السلسلة وحدَها كان سيترك `callGemini` يعمل. المفتاحُ يصل الموضعَين.
//
// وقائمةٌ بها اسمٌ مكتوبٌ خطأً لا تُصحَّح صامتةً: الأسماءُ المجهولة تُرصد وتُعلَن، والمعروفةُ تُحترم كما
// كُتبت. تصحيحُ إعدادٍ صريحٍ بلا إذن هو عينُ «الاختلافُ الصامت» الذي تُغلقه هذه الحزمة في كلّ جولة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { resolveEnabledProviders, PROVIDER_NAMES } from '../core/providers/llm.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
const set = (raw) => [...resolveEnabledProviders(raw).enabled].sort();

test('الافتراضُ: بلا المفتاح تبقى الحلقاتُ الأربعُ كلُّها', () => {
    for (const raw of [undefined, null, '', '   ', ',,']) {
        assert.deepEqual(set(raw), [...PROVIDER_NAMES].sort(), `«${raw}» غيّر الافتراض`);
        assert.deepEqual(resolveEnabledProviders(raw).asked, [], 'ولا يُعدُّ طلباً');
    }
});

test('🎚️ والحصرُ يُحترم كما كُتب: groq,deepseek — والاثنان الآخران يُستبعدان', () => {
    assert.deepEqual(set('groq,deepseek'), ['deepseek', 'groq']);
    assert.deepEqual(set('groq'), ['groq']);
    // مسافاتٌ وحالةُ أحرفٍ وفواصلُ زائدة تُحتمل — الإعدادُ يُكتب بيد إنسان
    assert.deepEqual(set('  GROQ , DeepSeek ,, '), ['deepseek', 'groq']);
});

test('🔴 واسمٌ مجهولٌ يُرصد ولا يُصحَّح صامتاً', () => {
    const r = resolveEnabledProviders('groq,deepsek');           // خطأٌ إملائيّ مقصود
    assert.deepEqual([...r.enabled], ['groq'], 'المعروفُ يُحترم');
    assert.deepEqual(r.unknown, ['deepsek'], 'والمجهولُ يُسمّى ليُرى');

    // وقائمةٌ كلُّها مجهولة → لا مزوّد. لا نعود إلى «الكلّ» تصحيحاً لإعدادٍ صريح:
    // «لا يوجد مزود AI مُهيأ» رسالةٌ صادقةٌ تدلّ على الإعداد، وعودةٌ صامتة تُخفيه.
    const all = resolveEnabledProviders('gorq,depseek');
    assert.deepEqual([...all.enabled], []);
    assert.deepEqual(all.unknown, ['gorq', 'depseek']);
});

// `AI_PROVIDERS` يُقرأ **مرّةً عند الإقلاع** — وهو الصواب: إعدادٌ يُعلَن في سطر البدء ثمّ لا
// يتبدّل تحت المهمّة. فلا يُقاس بتبديل `process.env` داخل الاختبار (نسخةُ `llm.js` محمَّلةٌ سلفاً
// عند `coderAgent`)، بل بعمليةٍ ابنٍ تُقلع بالبيئة كما تُقلع على Render.
const inProcess = (providers, expr) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
        `const m = await import('${path.join(HERE, '../agents/coderAgent.js')}');\n`
        + `process.stdout.write(JSON.stringify(${expr}));`],
    { env: { ...process.env, AI_PROVIDERS: providers }, encoding: 'utf8' });
    assert.equal(r.status, 0, `الابنُ فشل: ${r.stderr}`);
    return JSON.parse(r.stdout);
};

const NO_PROVIDER = 'لا مزوّد AI مُفعَّل — راجع AI_PROVIDERS.';
const PIPE = "[{ provider: 'groq' }, { provider: 'deepseek' }, { provider: 'gemini' }]";

test('🔴 الحدُّ المقيس: المفتاحُ يصل مسارَ المولّد المباشر لا السلسلةَ وحدَها', () => {
    // `callDeepSeek`/`callGemini` ينادِيان العميلَ مباشرةً خارج `createWithFailover`
    assert.deepEqual(inProcess('groq,deepseek', `m.selectModels(${PIPE}).map((x) => x.provider)`),
        ['groq', 'deepseek'], 'المستبعَدُ ما زال في خطّ المولّد');
    assert.deepEqual(inProcess('', `m.selectModels(${PIPE}).map((x) => x.provider)`),
        ['groq', 'deepseek', 'gemini'], 'بلا المفتاح تبقى الثلاثُ كلُّها');
    assert.deepEqual(inProcess('gorq', `m.selectModels(${PIPE})`), [], 'خطٌّ بلا مزوّدٍ مُفعَّل');
    // ولا يُقال «فشلت جميع النماذج» ولم يُجرَّب واحد: الرسالةُ تدلّ على الإعداد
    assert.match(inProcess('gorq', 'm.NO_PROVIDER_MSG'), /AI_PROVIDERS/);
});

test('🔴 والمولّدُ ينادي المرشِّح فعلاً — بالأسماء الصحيحة', () => {
    // `selectModels` مقيسةٌ معزولةً أعلاه؛ وهذا يقيس **موضعَ ندائها**: خطُّ المولّد الحقيقيّ
    // بأسمائه. بلا هذا كان حذفُ النداء أو خطأُ اسمٍ في مدخلةٍ ينجو من كلّ ما سبق.
    const call = `m.coreGenerateCodePlan('اصنع صفحة', '', '', [], null, [], 'ar')`;
    assert.equal(inProcess('gorq', `(await ${call}).details`), NO_PROVIDER,
        'خطُّ المولّد لا يمرّ بالمرشِّح — جُرِّب مزوّدٌ ولا مزوّدَ مُفعَّل');
    // و«gemini» تُفعِّل مدخلةً واحدة: لو حملت اسمَ مزوّدٍ آخر لخلا الخطُّ فظهرت رسالةُ الإعداد
    assert.notEqual(inProcess('gemini', `(await ${call}).details`), NO_PROVIDER,
        'مدخلةُ Gemini موسومةٌ باسمٍ غير اسمها');
});

test('🔴 وحلقاتُ السلسلة الأربعُ كلُّها مشروطةٌ بالحارس', () => {
    const llm = fs.readFileSync(path.join(HERE, '../core/providers/llm.js'), 'utf8');
    const body = llm.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    // شرطُ كلِّ حلقةٍ يُثبَّت بكتلته `) {`: عدُّ المواضع كان يَنجو منه حذفُ حارسٍ لأنّ الاسمَ
    // يتكرّر في نصوص الانتقال، وتثبيتُ السطر وحدَه كان يَنجو منه لأنّ سطرَ الإقلاع يحمل شكلَه.
    for (const guard of [
        /if \(groqClient && enabled\('groq'\)\) \{/,
        /if \(hasDeepseek && enabled\('deepseek'\)\) \{/,
        /if \(ai && enabled\('gemini'\) && !params\.stream\) \{/,
        /if \(openaiClient && enabled\('openai'\)\) \{/,
    ]) assert.match(body, guard, `حلقةٌ بلا حارس: ${guard}`);
});

test('🔴 والمستبعَدُ لا يُنادى فعلاً حين يفشل من قبله', async () => {
    // Gemini مُستبعَد ومفتاحُه موجود: DeepSeek يفشل، فالسلسلةُ يجب أن تتوقّف لا أن تنتقل إليه.
    process.env.AI_PROVIDERS = 'deepseek';
    process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
    process.env.GEMINI_API_KEY ||= 'test-only-never-sent';
    const llm = await import('../core/providers/llm.js?sel=muted-gemini');

    llm.deepseek.chat.completions.create = async () => { throw new Error('اختبار: فشلٌ عابر'); };
    let geminiCalls = 0;
    llm.ai.models.generateContent = async () => { geminiCalls++; return { candidates: [] }; };

    await assert.rejects(() => llm.groq.chat.completions.create({ messages: [] }));
    assert.equal(geminiCalls, 0, 'نُودِيَ مزوّدٌ استبعده صاحبُ المنصّة');

    delete process.env.AI_PROVIDERS;
});

test('الحدّ: الأسماءُ الأربعةُ هي عقدُ المفتاح — لا خامسَ ولا ناقص', () => {
    assert.deepEqual([...PROVIDER_NAMES], ['groq', 'deepseek', 'gemini', 'openai'], 'بترتيب السلسلة');
    assert.ok(Object.isFrozen(PROVIDER_NAMES), 'لا تُعدَّل من الخارج');
});
