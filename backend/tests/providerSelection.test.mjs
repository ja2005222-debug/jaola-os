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

// ─── ✂️ مسارُ التعديل الجراحيّ: الحلقةُ الثانية كانت بلا حارسٍ ولا إشارة ───────────────
//
// قِيس بالتشغيل: `AI_PROVIDERS=groq` — فتُعلن الخدمةُ في سجلّها «🔇 deepseek مُستبعَد» و
// «🔇 gemini مُستبعَد»، ثمّ **يناديهما مسارُ التعديل خاماً**، فتذهب شفرةُ مشروع المستخدم إلى
// مزوّدٍ قال صاحبُ المنصّة لا. وسببُه أنّ الحلقةَ الثانية كانت مصفوفةَ دوالٍّ عارية: لا
// `selectModels`، ولا اسمَ يُقال في السجلّ، ولا `aiUnavailable` على عطبٍ دائم.
//
// ⚠️ ويُقاس في **عمليّةٍ ابنة** لا هنا: `AI_PROVIDERS` تُقرأ عند تحميل `llm.js`، وقد حُمِّلت
//    في هذا الملفّ سلفاً؛ ولو استُبدل العميلُ على نسخةٍ ذاتِ استعلامٍ لاستورد `coderAgent`
//    نسخةً أخرى غيرَها فلم يقع الاستبدال أصلاً (وقعت هذه الغلطةُ فعلاً قبل أن تُقاس).
const EDIT_CALL = "coder.coreEditCodePlan('غيّر اللون', [{ name: 'index.html', content: '<h1>x</h1>' }], 'ar')";
const PLAN_CALL = "coder.coreGenerateCodePlan('اصنع صفحة هبوط', '', '', [], null, [], 'ar')";
const editRun = (providers, stub, call = EDIT_CALL) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
        // قناةُ التقرير تُخلى قبل أيّ استيراد: `llm.js` يطبع لافتتَه عند الإقلاع حين تُوجد
        // المفاتيح، فتختلط بالـJSON على stdout (وقعت فعلاً).
        `for (const k of ['log','warn','error','info','debug']) console[k] = (...a) => process.stderr.write(a.join(' ') + '\\n');\n`
        + `const llm = await import('${path.join(HERE, '../core/providers/llm.js')}');\n`
        + `${stub}\n`
        + `const coder = await import('${path.join(HERE, '../agents/coderAgent.js')}');\n`
        + `const out = await (${call});\n`
        + `process.stdout.write(JSON.stringify({ out, raw: globalThis.__raw || [] }));`],
    { env: { ...process.env, AI_PROVIDERS: providers,
        GROQ_API_KEY: 'test-only-never-sent', DEEPSEEK_API_KEY: 'test-only-never-sent',
        GEMINI_API_KEY: 'test-only-never-sent' }, encoding: 'utf8' });
    assert.equal(r.status, 0, `الابنُ فشل: ${r.stderr}`);
    return JSON.parse(r.stdout);
};

const COUNT_RAW = `globalThis.__raw = [];
llm.deepseek.chat.completions.create = async () => { globalThis.__raw.push('deepseek'); throw new Error('لا ينبغي أن يُنادى'); };
llm.ai.models.generateContent = async () => { globalThis.__raw.push('gemini'); throw new Error('لا ينبغي أن يُنادى'); };`;

test('🔴 التعديلُ الجراحيّ يحترم الاستبعاد — ولا يُنادي مزوّداً خاماً بعد أن قيل لا', () => {
    const { out, raw } = editRun('groq', COUNT_RAW);
    assert.deepEqual(raw, [], `نُودِيَ مستبعَدٌ خاماً: ${raw.join(', ')}`);
    assert.ok(out.error, 'ولا نجاحَ يُدَّعى بلا مزوّدٍ عامل');
});

test('🔴 وعطبُه الدائمُ يُسمّى: `aiUnavailable` كما في البناء الكامل — لا «تعذّر» وحدَها', () => {
    const permanent = `llm.deepseek.chat.completions.create = async () => {
        const e = new Error('Insufficient Balance'); e.status = 402; throw e; };`;
    const { out } = editRun('deepseek', permanent);
    assert.equal(out.aiUnavailable, true, 'بدونها يُعيد المستدعي الكرّةَ على بابٍ مغلق (علّةُ #171 في مسارٍ ثانٍ)');
    assert.match(out.details, /إعادة المحاولة/, 'والرسالةُ تقول للمستخدم إنّ طلبَه سليم');
});

test('🔴 ولا مزوّدَ مُفعَّل ← رسالةُ الإعداد لا «فشل التعديل» — الحلقتان تقولان الشيءَ نفسَه', () => {
    // اسمٌ مكتوبٌ خطأ: لا يُصحَّح صامتاً، والخطُّ يخلو فتُقال رسالةُ الإعداد
    const { out } = editRun('gorq', '');
    assert.equal(out.details, NO_PROVIDER, 'تدلُّ على الإعداد لا على عطلٍ في الطلب');
});

test('🔴 و«كلُّها دائمة» لا «إحداها»: عابرٌ واحدٌ يكفي لألّا يُقال «لا فائدة من الإعادة»', () => {
    // 🧪 طفرةُ `every → some` نجت حتّى كُتب هذا: كلُّ ما سبق خطٌّ بمزوّدٍ واحد، وعندها
    //    الدالّتان سواء. وبمزوّدَين يفترقان — والفرقُ ليس تجميليّاً: لو قيل «دائم» ومعنا
    //    عطبٌ عابر لحُرمَ المستخدمُ إعادةً كانت ستنجح.
    const mixed = `llm.deepseek.chat.completions.create = async () => {
        const e = new Error('Insufficient Balance'); e.status = 402; throw e; };
    llm.ai.models.generateContent = async () => { throw new Error('socket hang up'); };`;
    const { out } = editRun('deepseek,gemini', mixed);
    assert.ok(out.error, 'فشلٌ — نعم');
    assert.notEqual(out.aiUnavailable, true, 'ولكنّه ليس باباً مغلقاً: أحدُ العطبَين عابر');
    assert.match(out.details, /تعذّر تطبيق التعديل/, 'فتُقال الرسالةُ العامّة لا رسالةُ الانقطاع');
});

test('🔴 والبناءُ الكامل مثلُه: «كلُّها دائمة» لا «إحداها» — ثغرةٌ قائمةٌ كشفتها الطفرة', () => {
    // 🧪 قِيس: طفرةُ `every → some` في `coreGenerateCodePlan` نجت من **٢٠٠٦ اختباراً**.
    //    فالشرطُ في المسار الأهمّ — الذي يكتب موقعَ المستخدم — لم يكن مثبَّتاً قطّ.
    const mixed = `llm.deepseek.chat.completions.create = async () => {
        const e = new Error('Insufficient Balance'); e.status = 402; throw e; };
    llm.ai.models.generateContent = async () => { throw new Error('socket hang up'); };`;
    const { out } = editRun('deepseek,gemini', mixed, PLAN_CALL);
    assert.ok(out.error);
    assert.notEqual(out.aiUnavailable, true, 'عابرٌ واحدٌ يمنع دعوى «لا فائدة من الإعادة»');
    // وكلُّها دائمة ← تُقال الدعوى
    const allPermanent = `const perm = () => { const e = new Error('Invalid API Key'); e.status = 401; throw e; };
    llm.deepseek.chat.completions.create = async () => perm();
    llm.ai.models.generateContent = async () => perm();`;
    assert.equal(editRun('deepseek,gemini', allPermanent, PLAN_CALL).out.aiUnavailable, true);
});


// ═══════════════════════════════════════════════════════
// 🏷️ وسمُ الكلفة على مسارَي المولّد — في عمليّةٍ ابنة لنفس السبب
// ═══════════════════════════════════════════════════════
// الطفرةُ التي أسقطت الوسمَ عن `model.call()` **نجت** من الحزمة كلِّها (٢٠١٢ اختباراً):
// لا شيء كان يقرأ `byLabel` على هذا المسار. فالوسمُ يُقاس هنا حيث تُقاس السلسلة —
// ويُستبدَل **عميلُ المزوّد** لا `groq` المصدَّر، كي يجري `tagged` → `noteUsage` حقيقةً
// داخل النطاق بدل أن نحاكيَه فنُثبّت محاكاتَنا.
const USAGE_STUB = `llm.deepseek.chat.completions.create = async () => ({
    choices: [{ message: { content: '\`\`\`html\\n<h1>مرحبا يا عالم كامل</h1>\\n\`\`\`' } }],
    usage: { prompt_tokens: 70, completion_tokens: 30, total_tokens: 100 },
});`;
const labelRun = (call) => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
        `for (const k of ['log','warn','error','info','debug']) console[k] = (...a) => process.stderr.write(a.join(' ') + '\\n');\n`
        + `const llm = await import('${path.join(HERE, '../core/providers/llm.js')}');\n`
        + `${USAGE_STUB}\n`
        + `const coder = await import('${path.join(HERE, '../agents/coderAgent.js')}');\n`
        + `await (${call});\n`
        + `process.stdout.write(JSON.stringify(llm.readAIUsage()));`],
    { env: { ...process.env, AI_PROVIDERS: 'deepseek', DEEPSEEK_API_KEY: 'test-only-never-sent' }, encoding: 'utf8' });
    assert.equal(r.status, 0, `الابنُ فشل: ${r.stderr}`);
    return JSON.parse(r.stdout);
};

test('🔴 رموزُ مسار التوليد تُنسَب إلى «coder:generate» — لا إلى «بلا وسم»', () => {
    const u = labelRun(PLAN_CALL);
    assert.equal(u.byLabel['coder:generate']?.total, 100);
    assert.equal(u.byLabel['بلا وسم'], undefined);
    assert.equal(u.total, 100, 'والوسمُ ينسب ولا يزيد المجموع');
});

test('🔴 ورموزُ مسار التعديل الجراحيّ تُنسَب إلى «coder:edit» — والمساران لا يختلطان', () => {
    const u = labelRun(EDIT_CALL);
    assert.equal(u.byLabel['coder:edit']?.total, 100);
    assert.equal(u.byLabel['coder:generate'], undefined, 'مسارٌ لم يُسلَك لا يُحمَّل شيئاً');
    assert.equal(u.byLabel['بلا وسم'], undefined);
});

// 🔴 #١٩٣/ب — المسارُ الحيّ: `groq` المصدَّرُ هو `createWithFailover` نفسُه، فالتطهيرُ
//    يقع على كلِّ مُنادٍ بلا استثناء. ويُقاس بابنٍ حقيقيّ لأنّ `AI_PROVIDERS` تُقرأ عند
//    التحميل — واستبدالُ **عميل المزوّد** لا `groq` كي يجري المسارُ كلُّه كما يجري حيّاً.
test('🔴 حقلُ `at` من سجلّ المحادثة لا يصل المزوّدَ عبر البوّابة المصدَّرة', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
        `for (const k of ['log','warn','error','info','debug']) console[k] = (...a) => process.stderr.write(a.join(' ') + '\\n');\n`
        + `const llm = await import('${path.join(HERE, '../core/providers/llm.js')}');\n`
        + `let seen = null;\n`
        + `llm.deepseek.chat.completions.create = async (p) => { seen = p; return { choices: [{ message: { content: 'ok' } }] }; };\n`
        + `await llm.groq.chat.completions.create({ model: 'm', messages: [\n`
        + `  { role: 'user', content: 'مرحباً', at: 1757000000000 },\n`
        + `  { role: 'assistant', content: 'أهلاً', at: 1757000000001 },\n`
        + `] });\n`
        + `process.stdout.write(JSON.stringify(seen.messages));`],
    { env: { ...process.env, AI_PROVIDERS: 'deepseek', DEEPSEEK_API_KEY: 'test-only-never-sent' }, encoding: 'utf8' });
    assert.equal(r.status, 0, `الابنُ فشل: ${r.stderr}`);
    const sent = JSON.parse(r.stdout);
    for (const m of sent) {
        assert.ok(!('at' in m), `وصل المزوّدَ حقلٌ يرفضه بـ400: ${JSON.stringify(m)}`);
    }
    assert.deepEqual(sent.map(m => m.content), ['مرحباً', 'أهلاً'], 'ضاع محتوى المحادثة في التطهير');
});
