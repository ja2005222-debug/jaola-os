// 🧭 كلمةٌ عابرةٌ في جملةِ طموحٍ اختارت المنتجَ كلَّه.
//
// قِيس من الإنتاج: وثيقةُ صاحب المنصّة (تسعةُ بنودٍ مرقّمة) تطلب **منصّةَ هندسةِ برمجيّات**.
// وردت فيها كلمةُ `marketplace` مرّةً واحدة، في جملةٍ عن مستقبلٍ بعيد: «...custom agents,
// workflows, and an agent marketplace». فاختار المطابِقُ قالبَ **سوقٍ إلكترونيّ**، وبُني له متجر.
//
// وسندُ الاختيار المُسجَّل يفضح نفسَه: `{ hits: ["marketplace"], roleCoverage: null,
// entityOverlap: null }` — **الفهمُ لم يساهم بشيء**، والكلمةُ وحدَها حسمت. وPM/1 وُضع ليطابق
// بنموذج المنتج لا بالكلمات.
//
// والتمييزُ موجودٌ ومحسوبٌ أصلاً ولم يكن يُقرأ: `explicit` تُرفع فقط حين تقع الكلمةُ في **رأس
// الوثيقة** (`specHead`) — حيث يسمّي المستخدمُ منتجَه. وكلمةُ `marketplace` هنا بعد البنود، فـ
// `explicit === false`. فالحكمُ كان بين يدي المطابِق وهو يتجاهله.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCloneTemplateDetailed } from '../agents/cloneTemplates/index.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const PLATFORM_DOC = `Build and evolve JAOLA OS into a production-ready autonomous AI software engineering platform.

It should understand a requirement, inspect a codebase, plan, write code, test, and deploy.

Prioritize:

1. Reliable autonomous execution
2. Real codebase understanding
3. Safe sandboxed execution
4. GitHub integration
5. Testing and automatic error recovery
6. Persistent project memory
7. Security
8. Scalability
9. Clear execution logs and observability

Design JAOLA OS so it can later become a SaaS platform with team collaboration, private
projects, custom agents, workflows, and an agent marketplace.`;

const APP = { kind: 'webapp', category: 'platform', appType: 'AI software engineering platform' };

test('🔴 كلمةٌ واحدة عابرةٌ خارجَ رأس الوثيقة وبلا سندٍ من الفهم لا تختار قالباً', () => {
    const d = matchCloneTemplateDetailed(PLATFORM_DOC, APP, null);
    assert.equal(d.clone, null,
        `اختير «${d.clone?.id}» بدليلِ ${JSON.stringify(d.clone?.matchReason?.hits)} — وثيقةٌ من تسعة بنودٍ تُحسم بلفظةٍ في جملةِ مستقبل`);
    assert.match(String(d.reason), /incidental|كلمة/, `السببُ لا يُسمّى: ${d.reason}`);
});

// 🧪 الطُّعمُ التالي يعزل كلَّ شرطٍ وحدَه: **كلمةٌ واحدة** (`صيدلية`) لا أكثر، وما يتبدّل
// بينها هو موضعُها وسندُها. بغير هذا العزل يمرّ أيُّ تشدّدٍ لأنّ شرطاً آخر يحجبه.
const TAIL_DOC = `أريد بناء لوحةً تعرض الأرقام.

1. الأصناف
2. الطلبات
3. البنود

ولاحقاً صيدلية.`;
const HEAD_DOC = `أريد بناء صيدلية.

1. الأصناف
2. الطلبات
3. البنود`;

test('🔴 والوثيقةُ التي تسمّي منتجَها في **رأسها** تبقى تُطابَق — بالكلمةِ الواحدة نفسِها', () => {
    const d = matchCloneTemplateDetailed(HEAD_DOC, { kind: 'webapp' }, null);
    assert.equal(d.clone?.id, 'jaola-pharmacy',
        `«صيدلية» في الرأس لم ترفع الفيتو (${d.reason}) — والرأسُ هو حيث يسمّي المستخدمُ منتجَه`);
    assert.deepEqual(d.clone.matchReason.hits, ['صيدلية'], 'الطُّعمُ فقدَ عزلَه: أكثرُ من كلمة');
});

test('🔴 وطلبٌ قصيرٌ بالكلمة نفسِها يبقى كما كان — هناك الكلمةُ هي الطلبُ كلُّه', () => {
    const d = matchCloneTemplateDetailed('أريد صيدلية', { kind: 'webapp' }, null);
    assert.equal(d.clone?.id, 'jaola-pharmacy', `طلبٌ قصيرٌ سقط بالتشدّد (${d.reason})`);
    assert.deepEqual(d.clone.matchReason.hits, ['صيدلية']);
});

test('🔴 وكلمةٌ عابرةٌ يسندها الفهمُ تكفي — الشرطُ اجتماعُ ثلاثةِ ضعفٍ لا أحدُها', () => {
    const model = { roles: [{ name: 'مدير' }, { name: 'صيدلي' }], entities: [{ name: 'دواء' }, { name: 'عملية صرف' }] };
    assert.equal(matchCloneTemplateDetailed(TAIL_DOC, { kind: 'webapp' }, null).clone, null, 'الطُّعمُ لا يُوقع الفيتو أصلاً');
    const d = matchCloneTemplateDetailed(TAIL_DOC, { kind: 'webapp' }, model);
    assert.equal(d.clone?.id, 'jaola-pharmacy',
        `الفهمُ يشهد للقالب (أدوارُه وكياناتُه بعينها) ومع ذلك رُفض (${d.reason})`);
});

test('🔴 وما يسمّيه الرأسُ يغلب كلمةً في المتن — لا ترتيبَ البُناة', () => {
    // «الفواتير» في البنود تُصيب قالبَ محاسبة، و«صيدلية» في الرأس تُصيب الصيدلية — والرأسُ أحقّ (PM/11)
    const d = matchCloneTemplateDetailed(`أريد بناء صيدلية.

1. الأصناف
2. الطلبات
3. الفواتير`, { kind: 'webapp' }, null);
    assert.equal(d.clone?.id, 'jaola-pharmacy', `حسمَ المتنُ ما سمّاه الرأس: ${d.clone?.id || d.reason}`);
});

test('🔴 وإصابتان في المتن تكفيان — كلمةٌ واحدة صدفةٌ، وكلمتان دليل', () => {
    const two = `أريد بناء لوحةً تعرض الأرقام.

1. الأصناف
2. الطلبات
3. البنود

ولاحقاً صيدلية تصرف الأدوية بوصفة.`;
    const d = matchCloneTemplateDetailed(two, { kind: 'webapp' }, null);
    assert.equal(d.clone?.id, 'jaola-pharmacy', `إصابتان لم تكفيا (${d.reason}) — والفيتو صار يخنق المطابقة`);
    assert.ok(d.clone.matchReason.hits.length >= 2, `الطُّعمُ فقدَ عزلَه: ${JSON.stringify(d.clone.matchReason.hits)}`);
});
