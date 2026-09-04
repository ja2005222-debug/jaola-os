// 👁️ أول تغطيةٍ لـ`services/reactPreview.js` — الوحدة التي تحوّل
// `lib/content.js` إلى الصفحات التي يراها المستخدم فعلاً (٤٥٢ سطراً،
// وصفرُ اختباراتٍ مباشرة حتى اليوم).
//
// 🔴 وكانت تُميت الموقع صامتاً: `parseContent` تحليلٌ صارم بـ`JSON.parse`،
// فيردّ `null` لكل ما هو JS صالحٌ وليس JSON صارماً (فاصلةٌ زائدة، اقتباسٌ
// مفرد، تعليقٌ فيه `{`) — ثم يعيد `buildStaticSite(null)` **صفحةً واحدة
// كاملة الهيكل بجسمٍ فارغ** يكتبها المستدعي فوق `index.html` الحقيقي،
// ويُقال للمستخدم «تمّ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStaticSite, buildStaticSiteFromSource, buildDashboardPage } from '../services/reactPreview.js';

const CONTENT = {
    brand: 'متجر الأمل',
    routes: [{ label: 'الرئيسية', href: '/' }, { label: 'من نحن', href: '/about' }],
    hero: { title: 'أهلاً بكم', subtitle: 'وصف', cta1: 'ابدأ' },
    sections: { About: { heading: 'من نحن', subheading: 'نبذة', items: [{ title: 'ع', desc: 'و' }] } },
    footer: { rights: 'محفوظة' },
};
const asSource = (obj) => `// محتوى الموقع\nexport const content = ${JSON.stringify(obj, null, 2)};\n`;
const mainOf = (html) => (html.match(/<main>([\s\S]*?)<\/main>/) || [, ''])[1];

test('👁️ صفحةٌ حقيقية لكل مسار، وروابط تُشير إلى ملفّات موجودة', () => {
    const pages = buildStaticSite(CONTENT, 'ar');
    assert.deepEqual(pages.map((p) => p.name), ['index.html', 'about.html']);
    for (const p of pages) {
        assert.match(p.content, /^<!doctype html>/i, p.name);
        assert.ok(mainOf(p.content).trim().length > 0, `${p.name}: جسمٌ غير فارغ`);
    }
    // كل href في الشريط يقابل ملفاً بُني فعلاً
    const names = new Set(pages.map((p) => p.name));
    for (const href of pages[0].content.match(/href="([^"#]+\.html)"/g) || []) {
        const file = href.slice(6, -1);
        assert.ok(names.has(file), `رابطٌ إلى ملفٍّ لم يُبنَ: ${file}`);
    }
});

test('👁️ الاتجاه واللغة يتبعان اللغة المطلوبة', () => {
    assert.match(buildStaticSite(CONTENT, 'ar')[0].content, /<html lang="ar" dir="rtl">/);
    assert.match(buildStaticSite(CONTENT, 'en')[0].content, /<html lang="en" dir="ltr">/);
});

test('🛡️ محتوى المستخدم يُهرَّب: لا وسمٌ يخرج من نصٍّ ولا خروجٌ من سمة', () => {
    const evil = { ...CONTENT, brand: '<script>alert(1)</script>', hero: { title: 'x" onload="alert(1)', image: 'i.png" onerror="alert(1)' } };
    const html = buildStaticSite(evil, 'ar')[0].content;
    assert.equal(html.includes('<script>alert(1)</script>'), false, 'وسمٌ حرفيٌّ من اسم العلامة');
    assert.equal(html.includes('onload="alert(1)'), false, 'خروجٌ من سمة العنوان');
    assert.equal(html.includes('onerror="alert(1)'), false, 'خروجٌ من سمة الصورة');
    assert.ok(html.includes('&lt;script&gt;'), 'وقد ظهر مُهرَّباً لا محذوفاً');
});

test('🛍️ صفحة المتجر تُضاف تلقائياً حين توجد منتجات — ولا تُضاف بلا منتج', () => {
    const withProducts = { ...CONTENT, products: [{ name: 'قميص', price: '99', desc: 'د', image: '' }] };
    const names = buildStaticSite(withProducts, 'ar').map((p) => p.name);
    assert.ok(names.includes('products.html'), names.join(', '));
    assert.equal(buildStaticSite(CONTENT, 'ar').map((p) => p.name).includes('products.html'), false);
});

// ── الصمتُ ليس عطلاً، والعطلُ ليس صمتاً ─────────────────────────────
test('🔇 مصدرٌ فارغ = لا شيء يُبنى، فلا شيء يُكتب فوق موقعٍ قائم', () => {
    for (const src of ['', '   \n\t ', null, undefined]) {
        assert.deepEqual(buildStaticSiteFromSource(src, 'ar'), [], JSON.stringify(src));
    }
});

test('🔴 مصدرٌ لا يُقرأ = رمية، لا صفحةٌ فارغة تُدهس بها الرئيسية', () => {
    const jsLegalButNotJson = [
        'export const content = { "a": 1, };',              // فاصلةٌ زائدة
        "export const content = { 'brand': 'x' };",          // اقتباسٌ مفرد
        '// ملاحظة { مهمة\n' + asSource(CONTENT),            // تعليقٌ فيه قوس
        'export const content = { brand: "x" };',            // مفتاحٌ بلا اقتباس
    ];
    for (const src of jsLegalButNotJson) {
        assert.throws(() => buildStaticSiteFromSource(src, 'ar'), /تعذّر قراءة lib\/content\.js/,
            `يجب أن يرمي لا أن يعيد صفحةً فارغة: ${src.slice(0, 40)}`);
    }
});

test('🔴 المرجع: الصيغة القديمة كانت تعيد صفحةً كاملة الهيكل بجسمٍ فارغ', () => {
    // ما كان يُكتب فوق index.html: هيكلٌ كامل (شريط + تذييل + أنماط) و<main> فارغ.
    const blank = buildStaticSite(null, 'ar');
    assert.equal(blank.length, 1, 'صفحةٌ واحدة تحلّ محلّ كل الصفحات');
    assert.ok(blank[0].content.length > 3000, 'كاملةُ الهيكل فتبدو سليمة');
    assert.equal(mainOf(blank[0].content).replace(/<[^>]*>/g, '').trim(), '', 'وجسمُها فارغ');
    // ولهذا لم يعد المصدرُ الفاسد يصل إليها.
});

test('👁️ المحتوى السليم يمرّ من المصدر إلى الصفحات بلا فقد', () => {
    const pages = buildStaticSiteFromSource(asSource(CONTENT), 'ar');
    assert.deepEqual(pages.map((p) => p.name), ['index.html', 'about.html']);
    assert.ok(pages[0].content.includes('متجر الأمل'));
    assert.ok(pages[1].content.includes('من نحن'));
});

test('🛠️ لوحة العميل تُبنى وتحمل هوية المشروع، وتُهرِّب اسم العلامة', () => {
    const html = buildDashboardPage({ brand: '<b>x</b>' }, { project: 'shop', username: 'ali', lang: 'ar' });
    assert.match(html, /^<!doctype html>/i);
    assert.ok(html.includes('"project":"shop"') && html.includes('"username":"ali"'));
    assert.equal(html.includes('<title>لوحة إدارة الموقع — <b>x</b>'), false, 'اسمٌ مُهرَّب في العنوان');
});
