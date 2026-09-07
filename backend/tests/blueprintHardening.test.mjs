// 🧭 مخطّطُ التطبيق — «ما يُحصَّن نصفُه لا يُحصَّن».
//
// قِيس بجولةِ بناءٍ كاملةٍ ومزوّدٍ **ناجحٍ** مُحاكى (لا فشلٍ هذه المرّة): أوّلُ سطرٍ في السجلّ الحيّ كان
// «🧭 undefined — تطبيق تفاعلي». والسببُ أنّ `generateBlueprint` في مسار «النموذج أجاب» يُحصّن أربعةَ
// حقول — `kind`، `category`، `functionalComponents`، `keySections` — بينما `buildBlueprintContext`
// يُقحم حقلَين آخرَين بلا احتياط:
//     `**النوع:** ${bp.appType}`   و   `**القيمة الأساسية:** ${bp.coreValue}`
// وثالثاً داخل المكوّنات: `${c.name} — ${c.behavior}`.
//
// والأثرُ ليس سطرَ سجلٍّ فحسب: هذا النصّ **يُحقن في هدف البناء** فيُقال للمولّد حرفيّاً «النوع: undefined».
// فالمخطّطُ الذي وُجد ليمنع «تحويلَ كلِّ شيءٍ إلى بروشور» يصف المنتجَ بكلمةٍ لا معنى لها.
//
// وهو عطبٌ **يتّسع بتغيير المزوّد**: `JSON.parse` ينجح على أيّ JSON صالح، وكلُّ نموذجٍ له عادتُه في
// التسمية (`app_type`، أو لفٌّ داخل `blueprint`، أو إسقاطُ حقلٍ اختياريّ). المسارُ الاحتياطيّ — حين
// يفشل المزوّد — كان محصَّناً منذ PM/11؛ فالعطبُ لا يظهر إلّا حين **ينجح** النموذج.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// بيئةُ الاختبار بلا مفاتيح، فالسلسلةُ ترمي فوراً ويسقط كلُّ شيءٍ إلى الاحتياط — وهو **محصَّنٌ أصلاً**،
// فلا يظهر العطب. نُفعّل حلقةً واحدة (مفتاحٌ وهميّ لا يُستعمل) ثمّ نستبدل `create` قبل أيّ نداء،
// فلا تُلمس الشبكةُ قطّ: المزوّدُ **يجيب** بما نُمليه. الاستيرادُ ديناميكيٌّ لأنّ الوحدة تقرأ البيئةَ عند تحميلها.
process.env.DEEPSEEK_API_KEY ||= 'test-only-never-sent';
const { deepseek, groq } = await import('../core/providers/llm.js');
const { generateBlueprint, buildBlueprintContext } = await import('../agents/appBlueprint.js');

const GOAL = 'ابنِ لي متجر ورد إلكتروني فيه الباقات والتوصيل';

/** مزوّدٌ **يجيب** بما نُمليه — العطبُ لا يظهر إلّا على النجاح. */
function answering(json) {
    const fake = async () => ({ choices: [{ message: { content: json } }] });
    const prev = [groq?.chat.completions.create, deepseek.chat.completions.create];
    if (groq) groq.chat.completions.create = fake;
    deepseek.chat.completions.create = fake;
    return () => { if (groq) groq.chat.completions.create = prev[0]; deepseek.chat.completions.create = prev[1]; };
}
const withReply = async (json, fn) => { const undo = answering(json); try { return await fn(); } finally { undo(); } };

const FULL = {
    appType: 'متجر ورد إلكتروني', category: 'business', kind: 'webapp',
    coreValue: 'شراء باقات الورد وتوصيلها', primaryAction: 'يختار باقة ويطلبها',
    mockData: '8 باقات بأسعار', functionalComponents: [{ name: 'سلة الشراء', behavior: 'تضيف وتحذف وتحسب' }],
    keySections: ['الباقات', 'التوصيل'],
};
/** يعيد نصَّ المُوجَّه **ومصدرَه**: سقوطٌ إلى الاحتياط ليس علاجاً — إنّما إخفاءٌ للعطب. */
const build = async (obj) => withReply(JSON.stringify(obj), async () => {
    const bp = await generateBlueprint(GOAL);
    return { ctx: buildBlueprintContext(bp), source: bp._source, bp };
});
const render = async (obj) => (await build(obj)).ctx;

test('🔴 لا كلمةَ «undefined» في المُوجَّه مهما نقص من ردّ النموذج', async () => {
    for (const key of Object.keys(FULL)) {
        const partial = { ...FULL }; delete partial[key];
        const ctx = await render(partial);
        assert.ok(!/undefined/.test(ctx), `غيابُ «${key}» كتب undefined: ${ctx.split('\n').find((l) => /undefined/.test(l))?.trim()}`);
    }
});

test('🔴 وشكلُ الردّ يختلف باختلاف النموذج — ولا يُملى على المولّد ما لا معنى له', async () => {
    for (const [label, obj] of [
        ['snake_case', { app_type: 'متجر ورد', kind: 'webapp' }],
        ['ملفوفٌ داخل blueprint', { blueprint: { appType: 'متجر ورد', kind: 'webapp' } }],
        ['JSON صالحٌ ليس مخطّطاً', { ok: true }],
        ['حقولٌ بأنواعٍ خاطئة', { appType: 42, coreValue: { a: 1 }, kind: 'webapp' }],
    ]) {
        const ctx = await render(obj);
        assert.ok(!/undefined|\[object Object\]/.test(ctx), `«${label}» سرّب: ${ctx.split('\n').find((l) => /undefined|\[object/.test(l))?.trim()}`);
    }
});

test('🔴 والمكوّنُ ناقصُ الوصف يُسقَط وحدَه — لا يُملى ناقصاً ولا يُسقِط المخطّطَ كلَّه', async () => {
    const { ctx, source, bp } = await build({
        ...FULL,
        functionalComponents: [{ name: 'سلة الشراء' }, { behavior: 'تُصفّي' }, { name: 'بحث', behavior: 'يُصفّي الباقات' }],
    });
    assert.ok(!/undefined/.test(ctx), ctx.split('\n').find((l) => /undefined/.test(l))?.trim());
    // الحدُّ الذي كشفته الطفرة: رميُ التحصين يُسقط إلى الاحتياط فيختفي «undefined» بلا علاج
    assert.equal(source, 'llm', 'ما أجاب به النموذجُ لم يُهدر بسبب مكوّنٍ ناقص');
    assert.deepEqual(bp.functionalComponents, [{ name: 'بحث', behavior: 'يُصفّي الباقات' }], 'الصالحُ وحدَه يبقى');
    assert.match(ctx, /بحث — يُصفّي الباقات/);
});

test('🔴 وقيمةٌ بيضاءُ ليست قيمة — ولا قسمٌ ليس نصّاً', async () => {
    const { ctx, bp, source } = await build({ ...FULL, appType: '   ', coreValue: '', keySections: ['الباقات', { a: 1 }, null, 42] });
    assert.equal(source, 'llm');
    assert.ok(bp.appType.trim(), 'الفراغُ لا يُعرض اسماً للمنتج');
    assert.ok(bp.coreValue.trim());
    assert.deepEqual(bp.keySections, ['الباقات'], 'ما ليس نصّاً يسقط');
    assert.ok(!/undefined|\[object Object\]|\*\*النوع:\*\*\s*$/m.test(ctx), ctx);
});

test('الحدّ: ما أجاب به النموذجُ صحيحاً يبقى بنصّه — لا يُستبدل بتقديرنا', async () => {
    const ctx = await render(FULL);
    assert.match(ctx, /\*\*النوع:\*\* متجر ورد إلكتروني/);
    assert.match(ctx, /\*\*القيمة الأساسية:\*\* شراء باقات الورد وتوصيلها/);
    assert.match(ctx, /سلة الشراء — تضيف وتحذف وتحسب/);
    assert.match(ctx, /الباقات • التوصيل/);
});

test('والاحتياطُ حين يفشل المزوّد يبقى كما ضبطته PM/11 — رأسُ الطلب اسماً للمنتج', async () => {
    const undo = answering('{}');
    if (groq) groq.chat.completions.create = async () => { throw new Error('لا مزوّد'); };
    deepseek.chat.completions.create = async () => { throw new Error('لا مزوّد'); };
    try {
        const bp = await generateBlueprint(GOAL);
        assert.equal(bp._source, 'fallback');
        assert.ok(bp.appType && !/undefined/.test(bp.appType), `الاحتياطُ سمّى: ${bp.appType}`);
        assert.ok(!/undefined/.test(buildBlueprintContext(bp)));
    } finally { undo(); }
});
