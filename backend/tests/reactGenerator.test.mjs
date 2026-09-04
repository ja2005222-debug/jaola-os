import test from 'node:test';
import assert from 'node:assert/strict';
import { planSections, generateNextScaffold, generateContentModel, compName, slugify } from '../agents/reactGenerator.js';

const AR = ['الرئيسية', 'من نحن', 'خدماتنا', 'تواصل معنا'];

// نموذجٌ زائف: يقرأ خريطة المفاتيح من الطلب نفسه ويكتب لكل مفتاحٍ ما يُعرف صاحبُه
function spyModel() {
    const seen = {};
    const llm = async (messages) => {
        const sys = messages[0].content;
        seen.sys = sys;
        seen.owner = {};
        for (const m of sys.matchAll(/"(\w+)" = "([^"]+)"/g)) seen.owner[m[1]] = m[2];
        seen.keys = [...(/"sections": \{ (.*) \}/.exec(sys)?.[1] || '')
            .matchAll(/"(\w+)": \{ "heading"/g)].map((m) => m[1]);
        const out = { sections: {} };
        for (const k of seen.keys) out.sections[k] = { heading: `محتوى<${seen.owner[k] ?? '؟'}>`, subheading: '', items: [{ title: 't', desc: 'd' }] };
        return JSON.stringify(out);
    };
    return { llm, seen };
}

const labelOf = (meta, comp) => meta.pages.find((p) => p.href === '/' + slugify(comp))?.label;
const genericOf = (comps) => comps.filter((c) => !['Navbar', 'Hero', 'Footer'].includes(c));

// ═══════════════════════════════════════════════════════
// الاشتقاق الواحد
// ═══════════════════════════════════════════════════════

test('planSections يحقن الشريط والبطل والتذييل حين تغيب', () => {
    const { comps } = planSections(AR);
    assert.equal(comps[0], 'Navbar');
    assert.equal(comps[1], 'Hero');
    assert.equal(comps[comps.length - 1], 'Footer');
});

test('planSections لا يعيد مكوّناً مرّتين ويحفظ التسمية الأصلية', () => {
    const { comps, labels } = planSections(['about', 'about', 'contact']);
    assert.equal(new Set(comps).size, comps.length, `تكرار: ${comps.join(', ')}`);
    assert.ok(comps.includes('About') && comps.includes('About4'));
    assert.equal(labels.About, 'About');
});

test('planSections لا يمسّ مصفوفة المستدعي — فالنداءان لا يحقنان مرّتين', () => {
    const secs = ['about', 'contact'];
    planSections(secs);
    planSections(secs);
    assert.deepEqual(secs, ['about', 'contact']);
});

// ═══════════════════════════════════════════════════════
// العطب: مفتاحان مختلفان للسؤال الواحد
// ═══════════════════════════════════════════════════════

for (const [label, sections] of [['أقسامٌ عربية', AR], ['قسمان متطابقان', ['about', 'about', 'contact']], ['مختلط', ['hero', 'من نحن', 'pricing']]]) {
    test(`ما يُطلب من النموذج هو ما يُبنى بعينه — ${label}`, async () => {
        const { llm, seen } = spyModel();
        await generateContentModel('متجر عطور فاخرة', { sections: [...sections], lang: 'ar', llm });
        const { meta } = generateNextScaffold({ projectName: 'demo', sections: [...sections], lang: 'ar' });
        assert.deepEqual(seen.keys, genericOf(meta.components),
            `طُلب [${seen.keys}] وبُني [${genericOf(meta.components)}]`);
    });
}

test('لا مفتاحَ مكرّرٌ في شكل JSON المطلوب', async () => {
    const { llm, seen } = spyModel();
    await generateContentModel('هدف', { sections: ['about', 'about', 'contact'], lang: 'en', llm });
    assert.equal(new Set(seen.keys).size, seen.keys.length, `مفاتيح مكرّرة: ${seen.keys}`);
});

test('الطلب يحمل تسمية صاحب المشروع لكل مفتاح — وإلا طُلب محتوىً «غير عامّ» لقسمٍ مجهول', async () => {
    const { llm, seen } = spyModel();
    await generateContentModel('متجر عطور', { sections: AR, lang: 'ar', llm });
    for (const k of seen.keys) {
        assert.ok(seen.owner[k], `المفتاح ${k} بلا تسمية في الطلب`);
        assert.ok(AR.includes(seen.owner[k]), `تسمية ${k} ليست من أقسام المستخدم: ${seen.owner[k]}`);
    }
    assert.equal(new Set(Object.values(seen.owner)).size, seen.keys.length, 'تسميتان لمفتاحٍ واحد أو العكس');
});

test('المحتوى يحطّ على الصفحة التي كُتب لها', async () => {
    const { llm } = spyModel();
    const content = await generateContentModel('متجر عطور', { sections: AR, lang: 'ar', llm });
    const { meta } = generateNextScaffold({ projectName: 'demo', sections: AR, lang: 'ar', content });
    for (const c of genericOf(meta.components)) {
        assert.equal(meta.content.sections[c].heading, `محتوى<${meta.content.sections[c] && labelOf(meta, c)}>`,
            `صفحة «${labelOf(meta, c)}» (${c}) حطّ عليها: ${meta.content.sections[c].heading}`);
    }
});

test('لا قسمَ يُبنى بلا محتوىً طُلب له', async () => {
    const { llm, seen } = spyModel();
    const content = await generateContentModel('هدف', { sections: ['hero', 'من نحن', 'pricing'], lang: 'ar', llm });
    const { meta } = generateNextScaffold({ projectName: 'demo', sections: ['hero', 'من نحن', 'pricing'], lang: 'ar', content });
    for (const c of genericOf(meta.components)) {
        assert.ok(seen.keys.includes(c), `القسم ${c} يُبنى ولم يُطلب له محتوى`);
        assert.match(meta.content.sections[c].heading, /^محتوى</, `${c} سقط على الافتراضي`);
    }
});

// ═══════════════════════════════════════════════════════
// حرّاسٌ على ما هو سليمٌ اليوم — كي يبقى
// ═══════════════════════════════════════════════════════

test('كل وجهةٍ في الشريط لها ملفُ صفحةٍ فعليّ، ولا وجهتان متطابقتان', () => {
    for (const sections of [AR, ['about', 'about', 'contact'], ['storefront', 'product', 'cart'], []]) {
        const { files, meta } = generateNextScaffold({ projectName: 'demo', sections: [...sections], lang: 'ar' });
        const names = new Set(files.map((f) => f.name));
        const hrefs = meta.pages.map((p) => p.href);
        assert.equal(new Set(hrefs).size, hrefs.length, `وجهات مكرّرة: ${hrefs}`);
        for (const h of hrefs) {
            const want = h === '/' ? 'app/page.jsx' : `app/${h.slice(1)}/page.jsx`;
            assert.ok(names.has(want), `وجهة ${h} بلا ملف`);
        }
    }
});

test('كل مكوّنٍ تستورده صفحةٌ موجود، ومساره النسبيّ بعمقه', () => {
    const { files } = generateNextScaffold({ projectName: 'demo', sections: AR, lang: 'ar' });
    const names = new Set(files.map((f) => f.name));
    for (const f of files.filter((x) => x.name.endsWith('page.jsx'))) {
        const depth = f.name.split('/').length - 1;          // app/page.jsx = 1، app/x/page.jsx = 2
        for (const m of f.content.matchAll(/import (\w+) from '([^']+)';/g)) {
            assert.ok(names.has(`components/${m[1]}.jsx`), `${f.name} يستورد ${m[1]} غير الموجود`);
            assert.equal(m[2], '../'.repeat(depth) + 'components/' + m[1], `مسار خاطئ في ${f.name}`);
        }
    }
});

test('الوجهات حتميّة لا يلمسها الذكاء', async () => {
    const llm = async () => JSON.stringify({ brand: 'X', routes: [{ label: 'مزيّف', href: '/hacked' }] });
    const content = await generateContentModel('هدف', { sections: AR, lang: 'ar', llm });
    const { meta } = generateNextScaffold({ projectName: 'demo', sections: AR, lang: 'ar', content });
    assert.ok(!meta.content.routes.some((r) => r.href === '/hacked'));
    assert.equal(meta.content.brand, 'X', 'العلامة من الذكاء لم تُقبل');
});

test('لغةٌ من اليمين تُنتج dir=rtl في التخطيط', () => {
    const { files } = generateNextScaffold({ projectName: 'demo', sections: AR, lang: 'ar' });
    const layout = files.find((f) => f.name === 'app/layout.jsx').content;
    assert.match(layout, /<html lang="ar" dir="rtl">/);
});

test('compName: الخريطة، ثمّ اللاتيني، ثمّ رقمُ القسم للعربي', () => {
    assert.equal(compName('tables', 0), 'DataTable');
    assert.equal(compName('our services', 1), 'OurServices');
    assert.equal(compName('من نحن', 2), 'Section3');
});

test('slugify: PascalCase → مسارٌ بشُرَط', () => {
    assert.equal(slugify('DataTable'), 'data-table');
    assert.equal(slugify('Section3'), 'section3');
    assert.equal(slugify(''), 'page');
});
