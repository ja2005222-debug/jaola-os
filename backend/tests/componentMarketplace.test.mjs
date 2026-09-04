import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKETPLACE_COMPONENTS, MARKETPLACE_CHAR_BUDGET, searchComponents, buildMarketplaceContext } from '../agents/componentMarketplace.js';

// ═══════════════════════════════════════════════════════
// 🔴 العطب: المكتبة تخزّن 9,719 حرفاً من markup منسَّق، وكانت تُرسل إلى
// النموذج **أسماءَ** المكوّنات فقط (362 حرفاً) ثم تقول له «استخدم هذه الـ
// components كمرجع» — ومرجعٌ لم يره. قائمةُ طعامٍ بلا طعام.
//
// فالعقد: ما يُذكر بوصفه حاضراً **يُرسَل**، وما لا يُرسَل **يُصرَّح بغيابه**.
// ═══════════════════════════════════════════════════════

const hasMarkup = (s) => /<[a-z][^>]*>/i.test(s);

test('الـmarkup نفسه يصل إلى النموذج لا اسمُه', () => {
    const ctx = buildMarketplaceContext('clinic');
    assert.ok(hasMarkup(ctx), 'السياق بلا وسمٍ واحد — أسماءٌ فقط كما كان');
    for (const c of searchComponents('', 'clinic')) {
        if (c.html.length <= MARKETPLACE_CHAR_BUDGET) {
            assert.ok(ctx.includes(c.html), `markup «${c.id}» لم يُرسَل رغم اتّساع الميزانية`);
        }
    }
});

test('لا يُذكر مكوّنٌ بوصفه حاضراً وmarkupه غائب', () => {
    const ctx = buildMarketplaceContext('clinic', { charBudget: 1500 });
    const lines = ctx.split('\n');
    const idx = lines.findIndex((l) => l.includes('لم يُرسَل markup'));
    assert.ok(idx > -1, 'مكوّناتٌ خارج الميزانية ولا تصريحَ بذلك');
    // كلُّ ما بعد التصريح مذكورٌ بالاسم، وmarkupه ليس في السياق
    for (const l of lines.slice(idx + 1)) {
        const m = /- \*\*([^*]+)\*\*/.exec(l);
        if (!m) continue;
        const c = MARKETPLACE_COMPONENTS[m[1]];
        assert.ok(c, `اسمٌ لا يقابل مكوّناً: ${m[1]}`);
        assert.ok(!ctx.includes(c.html), `«${m[1]}» أُعلن غائباً وmarkupه حاضر`);
    }
});

test('الميزانيةُ تُحترم فلا ينتفخ الـprompt بنموّ المكتبة', () => {
    const budget = 2500;
    const ctx = buildMarketplaceContext('clinic', { charBudget: budget });
    const sent = Object.values(MARKETPLACE_COMPONENTS)
        .filter((c) => ctx.includes(c.html))
        .reduce((s, c) => s + c.html.length, 0);
    assert.ok(sent <= budget, `أُرسل ${sent} حرفاً والميزانية ${budget}`);
});

test('ميزانيةُ صفر: لا markup، ولا دعوى بأن هناك مرجعاً', () => {
    const ctx = buildMarketplaceContext('clinic', { charBudget: 0 });
    assert.ok(!hasMarkup(ctx), 'أُرسل markup رغم ميزانية الصفر');
    assert.ok(ctx.includes('لم يُرسَل markup'), 'غاب التصريح بالغياب');
    assert.ok(!/جاهزةٌ أمامك/.test(ctx), 'دعوى حضورٍ على لا شيء');
});

// 📌 تصحيحُ توقّعٍ خاطئ لي: ظننتُ نوعاً مجهولاً يُرجع فراغاً. وليس كذلك —
// سبعةٌ من الثمانية موسومةٌ «all»، فكلُّ نوعٍ يُصيبها. وحارسُ
// `components.length === 0` لا يقع إلا لو **فرغت المكتبة** نفسها. أُثبت
// بالتشغيل لا بالقراءة، ويُقال كما هو لا كما تمنّيت.
test('كل نوع — ولو مجهولاً — يصيب المكوّنات الموسومة «all»', () => {
    const ctx = buildMarketplaceContext('نوع-لا-وجود-له');
    assert.notEqual(ctx, '', 'المكوّنات العامّة لم تصل لنوعٍ مجهول');
    assert.ok(hasMarkup(ctx));
    assert.equal(searchComponents('', 'نوع-لا-وجود-له').length,
        Object.values(MARKETPLACE_COMPONENTS).filter((c) => c.tags.includes('all')).length);
});

test('searchComponents يرشّح بالنوع وبالنصّ', () => {
    const gym = searchComponents('', 'gym').map((c) => c.id);
    const clinic = searchComponents('', 'clinic').map((c) => c.id);
    // pricing-modern موسومٌ saas/gym/education فقط — لا «all»
    assert.ok(gym.includes('pricing-modern'));
    assert.ok(!clinic.includes('pricing-modern'));
    assert.deepEqual(searchComponents('Footer', 'clinic').map((c) => c.id), ['footer-modern']);
});

test('كل مكوّن يحمل اسماً ووسوماً وmarkup غير فارغ', () => {
    const bad = Object.entries(MARKETPLACE_COMPONENTS)
        .filter(([, c]) => !c.name || !Array.isArray(c.tags) || !c.tags.length || !c.html?.trim());
    assert.deepEqual(bad.map(([id]) => id), []);
});

test('الوسمُ «all» يعني كل نوع فعلاً', () => {
    const universal = Object.entries(MARKETPLACE_COMPONENTS).filter(([, c]) => c.tags.includes('all'));
    for (const t of ['clinic', 'restaurant', 'ecommerce', 'hotel', 'portfolio']) {
        const got = new Set(searchComponents('', t).map((c) => c.id));
        for (const [id] of universal) assert.ok(got.has(id), `«${id}» موسومٌ all ولم يظهر لـ${t}`);
    }
});
