// 🏷️ PM/17 — «اسمُ المستخدم لمشروعه يُعرض كما سمّاه»: `generateNextScaffold` يشتقّ `safeName` بإسقاط كلِّ ما
// ليس `[a-z0-9-]` — وهذا **صحيحٌ لمُعرِّف حزمة npm** الذي يجب أن يكون ASCII. لكنّ ناتجَه كان يُعاد استعمالاً
// **اسمَ العلامة المعروض** في كلّ صفحة، و`<title>` في تبويب المتصفّح، وعنوانَ README.
//
// فالعربيّةُ تُمحى كلُّها: قِيس أنّ «مكتبة المدينة» و«مطعم البحر» و«متجر-الأناقة» تخرج كلُّها **«Jaola app»**،
// و«متجر ABC» تخرج «Abc» بحذف الكلمة العربيّة. أي أنّ صاحبَ المشروع العربيَّ يرى اسمَ المنصّة مكانَ اسم متجره
// في كلِّ صفحةٍ من موقعه. قيمةٌ واحدة لغرضَين متعارضَين — كما في PM/11 (قائمةٌ لغرضَين) وPM/15 (قارئٌ لغرضَين).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextScaffold } from '../agents/reactGenerator.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const build = (projectName) => {
    const sc = generateNextScaffold({ projectName, sections: ['الرئيسية', 'الكتب'], lang: 'ar' });
    const file = (n) => (sc.files.find(f => f.name === n) || {}).content || '';
    return {
        brand: sc.meta.content.brand,
        title: (file('app/layout.jsx').match(/title:\s*"([^"]*)"/) || [])[1],
        readme: file('README.md').split('\n')[0],
        pkg: JSON.parse(file('package.json') || '{}').name,
        html: sc.files.filter(f => f.name.endsWith('.jsx')).map(f => f.content).join('\n'),
    };
};

test('الاسمُ العربيُّ يبقى عربيّاً في كلِّ ما يقرؤه صاحبُ المشروع', () => {
    for (const name of ['مكتبة المدينة', 'مطعم البحر']) {
        const r = build(name);
        assert.equal(r.brand, name, `العلامة: ${r.brand}`);
        assert.equal(r.title, name, `<title>: ${r.title}`);
        assert.equal(r.readme, `# ${name}`, `README: ${r.readme}`);
        assert.doesNotMatch(r.brand, /Jaola app/i, 'اسمُ المنصّة مكانَ اسم المستخدم');
    }
});

test('اسمُ المشروع يصل مفصولاً بشرطة (كما تُنشئه المنصّة) فيُعرض بمسافة', () => {
    // أسماءُ المشاريع تصل مُشرطنة غالباً؛ الشرطةُ فاصلُ مُعرِّفٍ لا حرفٌ من الاسم — فتُعرض مسافةً.
    const r = build('متجر-الأناقة');
    assert.equal(r.brand, 'متجر الأناقة', r.brand);
    assert.equal(r.title, 'متجر الأناقة', r.title);
});

test('واسمٌ مختلَط لا يفقد كلمتَه العربيّة', () => {
    const r = build('متجر ABC');
    assert.equal(r.brand, 'متجر ABC', r.brand);
});

test('مُعرِّفُ حزمة npm يبقى ASCII صالحاً — الغرضُ الآخرُ لم يُكسر', () => {
    assert.equal(build('مكتبة المدينة').pkg, 'jaola-app', 'اسمٌ بلا حرفٍ لاتينيّ: الاحتياطُ الصالح');
    assert.equal(build('City Library').pkg, 'city-library');
    assert.equal(build('متجر ABC').pkg, 'abc');
    for (const n of ['مكتبة المدينة', 'City Library', 'متجر ABC']) {
        assert.match(build(n).pkg, /^[a-z0-9-]+$/, `مُعرِّفٌ غيرُ صالح لـ«${n}»`);
    }
});

test('الاسمُ الإنجليزيُّ كما كتبه صاحبُه — لا مُطبَّعاً بحروفٍ صغيرة', () => {
    const r = build('City Library');
    assert.equal(r.brand, 'City Library', r.brand);
});

test('اسمٌ فارغٌ أو بلا محتوى: الاحتياطُ المكتوب لا انهيار', () => {
    for (const empty of ['', '   ', '---']) {
        const r = build(empty);
        assert.ok(r.brand && r.brand.trim().length > 0, `فارغٌ لـ«${empty}»`);
        assert.match(r.pkg, /^[a-z0-9-]+$/);
    }
});
