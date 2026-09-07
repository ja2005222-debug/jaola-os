// 🏷️ اسمُ الموديل — «المزوّدُ يقول: لا يوجد. ولا يقول: هذا يوجد».
//
// قِيس من سجلّ إنتاجٍ حقيقيّ (2026-09-07، 16:12:58–16:13:00) بعد حصر التجارب في مزوّدَين:
//   [AI Failover] Groq فشل (404 The model does not exist) → DeepSeek
//   [AI Failover] DeepSeek فشل (402) — لا بديل متبقٍ
// فالأربعةُ ساقطون، لا اثنان. وDeepSeek مسألةُ رصيدٍ لا يحلّها كود. أمّا Groq فعطبُ **إعداد**:
// صاحبُ المنصّة ضبط `GROQ_MODEL` في Render وما زال 404 — ولا يملك أحدٌ جواباً عن سؤالين:
//
//   ١) هل وصل الضبطُ إلى الكود أصلاً، أم بقي الافتراضُ الميّت؟ لا سطرَ يقول أيَّ اسمٍ يُستعمل.
//   ٢) وأيُّ اسمٍ يقبله المزوّد؟ نحن لا نسأله — رغم أنّ `models.list()` في SDK الاثنين.
//
// وهذا صمتٌ يُوقف الإنتاج: ثلاثُ نشراتٍ في يومٍ واحد بلا جوابٍ عن سؤالٍ يُجيبه سطر.
// واسمُ الموديل ليس سرّاً — افتراضاتُه مكتوبةٌ في المستودع — فلا يكشف طبعُه مفتاحاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelReportLines, discoverModels, MODEL_DISCOVERY_LIMIT } from '../core/providers/llm.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

test('🔴 سطرُ الإقلاع يقول أيَّ اسمٍ يُستعمل — ومن أين جاء', () => {
    const lines = modelReportLines({ groq: 'from-env', deepseek: 'd-model' }, {
        groq: 'from-env', deepseek: 'd-model', gemini: 'g-default', openai: 'o-default',
    });
    const joined = lines.join('\n');
    // بلا هذا السطر لا يُعرف هل بلغ ضبطُ Render الكودَ أم بقي الافتراض — وهو سؤالُ اليوم كلِّه
    assert.match(joined, /groq[^\n]*from-env[^\n]*بيئة/, 'المضبوطُ من البيئة لا يُميَّز');
    assert.match(joined, /gemini[^\n]*g-default[^\n]*افتراضي/, 'الافتراضيُّ لا يُميَّز');
    assert.equal(lines.length, 4, 'الأربعةُ كلُّهم — الصامتُ منهم هو الذي يُشكِل');
});

test('الحدّ: اسمُ الموديل يُطبع، ولا يُطبع معه شيءٌ من المفتاح', () => {
    // حارسٌ صريح: هذا السطرُ يُقرأ في سجلٍّ قد يُلتقط ويُشارَك
    const lines = modelReportLines({}, { groq: 'g', deepseek: 'd', gemini: 'x', openai: 'o' });
    for (const l of lines) assert.doesNotMatch(l, /API_KEY|sk-|gsk_/i, 'سطرٌ يقترب من مفتاح');
});

test('🔴 وعند «لا يوجد» يُسأل المزوّدُ عمّا يوجد', async () => {
    const client = { models: { list: async () => ({ data: [{ id: 'alpha' }, { id: 'beta' }] }) } };
    assert.deepEqual(await discoverModels(client), ['alpha', 'beta']);

    // بعضُ العملاء يعيدون مصفوفةً مباشرةً، وبعضُهم كائناً قابلاً للتكرار
    assert.deepEqual(await discoverModels({ models: { list: async () => [{ id: 'x' }] } }), ['x']);
});

test('🔴 والاكتشافُ لا يُسقط مسارَ الفشل مهما ساء', async () => {
    // هذا يجري **داخل معالج فشلٍ** — رميةٌ منه تُحوّل عطبَ إعدادٍ مفهوماً إلى انهيارٍ غامض
    for (const bad of [
        { models: { list: async () => { throw new Error('شبكة'); } } },
        { models: { list: async () => null } },
        { models: {} }, {}, null, undefined,
        { models: { list: async () => ({ data: 'ليست مصفوفة' }) } },
        { models: { list: async () => ({ data: [{}, { id: '' }, { id: 42 }] }) } },  // بلا معرّفات صالحة
    ]) {
        assert.deepEqual(await discoverModels(bad), [], `رمى أو أعاد غيرَ مصفوفة: ${JSON.stringify(bad)}`);
    }
});

test('الحدّ: قائمةٌ طويلة تُقصّ — سطرُ سجلٍّ لا مِلفّ', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: `m${i}` }));
    const out = await discoverModels({ models: { list: async () => ({ data: many }) } });
    assert.equal(out.length, MODEL_DISCOVERY_LIMIT);
    assert.ok(MODEL_DISCOVERY_LIMIT >= 5 && MODEL_DISCOVERY_LIMIT <= 50, 'حدٌّ يُقرأ في سطر');
});

// ─────────────────────────────────────────────────────────────────────────────
// والبوّابةُ نفسُها تُقاس عبر السلسلة الحقيقيّة: متى يُسأل المزوّد ومتى لا يُسأل.
// نسخةٌ طازجةٌ لكلِّ حالة (المفتاحُ والذاكرةُ يُقرآن عند التحميل).
const withChain = async (tag, { failWith, ids = ['a', 'b'] }) => {
    process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
    process.env.AI_PROVIDERS = 'deepseek';
    const llm = await import(`../core/providers/llm.js?disc=${tag}`);
    llm.deepseek.chat.completions.create = async () => { throw failWith; };
    llm.deepseek.models.list = async () => ({ data: ids.map((id) => ({ id })) });

    const seen = [];
    const warn = console.warn;
    console.warn = (...a) => seen.push(a.join(' '));
    try {
        await llm.groq.chat.completions.create({ messages: [] }).catch(() => {});
        await llm.groq.chat.completions.create({ messages: [] }).catch(() => {});
    } finally { console.warn = warn; delete process.env.AI_PROVIDERS; }
    return seen.filter((l) => l.includes('🔎'));
};

test('🔴 «لا يوجد» يُسأل عنه مرّةً واحدة — والأسماءُ تُسمّى', async () => {
    const err = Object.assign(new Error('The model does not exist'), { status: 404 });
    const asked = await withChain('cfg', { failWith: err, ids: ['llama-x', 'llama-y'] });
    assert.equal(asked.length, 1, 'إمّا لم يُسأل، وإمّا سُئل في كلّ نداء (ضجيجٌ ونداءُ شبكة)');
    assert.match(asked[0], /deepseek/);
    assert.match(asked[0], /llama-x.*llama-y/, 'سُئل ولم تُسمَّ الأسماء — فلا فائدة');
});

test('🔴 والرصيدُ ليس اسمَ موديل: 402 لا يُسأل عنه', async () => {
    // سؤالُ المزوّد هنا نداءُ شبكةٍ بلا معنى — العطبُ مالٌ لا إعداد (وهو حالُ DeepSeek المقيسة)
    const err = Object.assign(new Error('Insufficient Balance'), { status: 402 });
    assert.deepEqual(await withChain('quota', { failWith: err }), []);
});

test('🔴 ولا يُعلَن اسمُ مزوّدٍ لا يعمل — وبه تبقى قناةُ المخرَج نظيفة', () => {
    // سطرٌ عن مزوّدٍ لا يُنادى ضجيجٌ لا خبر. وأوّلُ صياغةٍ طبعت الأربعةَ بلا شرطٍ **عند التحميل**،
    // فكتبت على المخرَج القياسيّ الذي يحمل نتائجَ مُشغّل الاختبارات — عطبُ #486 بعينه، أوقعه
    // حارسُه القائم (`stdoutChannel`). الشرطُ هو الإصلاح، لا إسكاتُ الحارس.
    const env = {}, resolved = { groq: 'g', deepseek: 'd', gemini: 'x', openai: 'o' };
    assert.deepEqual(modelReportLines(env, resolved, []), [], 'لا مزوّدَ عاملاً → لا سطر');
    const two = modelReportLines(env, resolved, ['deepseek', 'groq']);
    assert.equal(two.length, 2);
    assert.match(two.join('\n'), /groq[\s\S]*deepseek/, 'الترتيبُ ترتيبُ السلسلة لا ترتيبُ الطلب');
    assert.doesNotMatch(two.join('\n'), /gemini|openai/, 'أُعلن مزوّدٌ لا يعمل');
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 قِيس في الإنتاج (2026-09-07): صاحبُ المنصّة وضع **مفتاح Groq** في `GROQ_MODEL`،
// فطبعه سطرُ الإقلاع الذي كتبتُه أنا كاملاً في سجلّ Render:
//     🏷️ [AI Model]: groq = gsk_… (بيئة)
//
// وكان حكمي في #592: «اسمُ الموديل ليس سرّاً، فطبعُه لا يكشف مفتاحاً». وهو صحيحٌ عن
// **الاسم**، وخاطئٌ عن **الحقل**: الحقلُ يحمل ما يضعه إنسان، والإنسانُ يخطئ. والحارسُ الذي
// كتبتُه فحص نصَّ السطر بقيمٍ من عندي («g»/«d»)، فلم يمرّ عليه قطُّ قيمةٌ تشبه مفتاحاً.
//
// فالقاعدة: **لا تُطبع قيمةُ حقلٍ يملؤها إنسانٌ قبل فحصِ شكلها**. والخطأُ نفسُه يصير تشخيصاً:
// «هذه قيمةٌ تشبه مفتاحاً، والمنتظَرُ اسمُ موديل» تدلّ على الخطأ بلا كشفه.
test('🔴 قيمةٌ تشبه مفتاحاً لا تُطبع — والخطأُ يُسمّى بدل أن يُكشف', () => {
    const shapes = [
        'gsk_XYIMZabcdefghijklmnopqrstuvwxyz012345',   // Groq
        'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789',  // OpenAI
        'AIzaSyAbcdefghijklmnopqrstuvwxyz01234567',      // Google
        'ghp_abcdefghijklmnopqrstuvwxyz0123456789',      // GitHub
        'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH',  // سلسلةٌ طويلة بلا بادئة
        // قصيرةٌ عمداً (< ٣٦): البادئةُ وحدَها تُمسكها، فحدُّ الطول لا يُنجي حذفَها
        'gsk_short12345', 'sk-short12345', 'AIzaShort1234', 'ghp_short1234',
    ];
    for (const secret of shapes) {
        const line = modelReportLines({ groq: secret }, { groq: secret }, ['groq']).join('');
        assert.doesNotMatch(line, new RegExp(secret.slice(0, 12)), `سُرّب: ${secret.slice(0, 8)}…`);
        assert.match(line, /تشبه مفتاحاً|اسمَ موديل/, 'أُخفيت القيمةُ ولم يُقَل ما الخطأ');
        assert.match(line, /groq/, 'اسمُ المزوّد يبقى — هو موضعُ الخطأ');
    }
});

test('وأسماءُ الموديلات الحقيقيّة تُطبع كما هي — لا حجبَ زائد', () => {
    // من قائمةٍ حقيقيّةٍ قالها Groq: فيها شرطات ومائلات وأرقام
    for (const real of ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile',
        'deepseek-v4-pro', 'gemini-2.0-flash', 'meta-llama/llama-prompt-guard-2-86m',
        // اسمٌ طويلٌ فيه مائلة: يتجاوز حدَّ الطول، والمائلةُ وحدَها تُميّزه عن مفتاح
        'meta-llama/Llama-4-Maverick-17B-128E-Instruct']) {
        const line = modelReportLines({ groq: real }, { groq: real }, ['groq']).join('');
        assert.match(line, new RegExp(real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `حُجب اسمٌ صحيح: ${real}`);
        assert.doesNotMatch(line, /تشبه مفتاحاً/);
    }
});
