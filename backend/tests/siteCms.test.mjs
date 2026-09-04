// 🛠️ أول تغطيةٍ لـ`services/siteCms.js` — الوحدة التي تحرس لوحة موقع
// العميل المنشور: كلمة مرورها، توكن جلستها، وقائمة السماح التي تَعِد
// بأن بنية الموقع ثابتة.
//
// 🔴 والوعد الأخير لم يكن يُوفى: `if (!out.sections[key]) continue`
// يسأل **السلسلة الأصلية** لا الملكية، فـ`constructor` و`toString`
// وأخواتها تُقرأ «موجودة» فتمرّ — وتُكتب أقساماً جديدة باسم المُرسِل في
// `lib/content.js`. حارسٌ يقول «لا جديد» ويكتب سبعة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    hashPassword, verifyPassword, signSiteToken, verifySiteToken,
    sanitizeProduct, applyContentPatch, decodeDataUrl, safeAssetName,
} from '../services/siteCms.js';

const SECRET = 'test-secret-value';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// ── كلمة المرور ────────────────────────────────────────────────────
test('🔑 كلمة المرور: ملحٌ لكل تعمية، وتحقّقٌ لا يقبل غيرها', () => {
    const a = hashPassword('correct horse');
    const b = hashPassword('correct horse');
    assert.notEqual(a, b, 'ملحٌ مختلف لكل تعمية — لا جدول قوس قزح');
    assert.equal(verifyPassword('correct horse', a), true);
    assert.equal(verifyPassword('correct horse', b), true);
    assert.equal(verifyPassword('wrong', a), false);
});

test('🔑 تعميةٌ مشوّهة تُردّ ولا تُرمى — ولا تُقرأ نجاحاً', () => {
    for (const bad of [null, undefined, '', 'no-colon', 'salt:', 'salt:zz', 'salt:abc', ':', 42, {}]) {
        assert.equal(verifyPassword('anything', bad), false, `مخزَّنٌ فاسد: ${JSON.stringify(bad)}`);
    }
    // كلمةٌ فارغة لا تفتح تعميةً بُنيت على غيرها
    assert.equal(verifyPassword('', hashPassword('real')), false);
});

// ── توكن الجلسة ────────────────────────────────────────────────────
test('🎫 التوكن يُوقَّع ويُقرأ بهويّته', () => {
    const t = signSiteToken({ user: 'ali', project: 'shop' }, SECRET);
    assert.deepEqual(verifySiteToken(t, SECRET), { user: 'ali', project: 'shop' });
});

test('🎫 التوقيع يُرفض بسرٍّ آخر، أو بحمولةٍ مبدَّلة، أو بشكلٍ فاسد', () => {
    const t = signSiteToken({ user: 'ali', project: 'shop' }, SECRET);
    assert.equal(verifySiteToken(t, 'other-secret'), null, 'سرٌّ آخر لا يفتح');

    // تبديل الحمولة إلى مشروعٍ آخر مع الإبقاء على التوقيع
    const forged = Buffer.from(JSON.stringify({ u: 'ali', p: 'victim', exp: 2 ** 40 }))
        .toString('base64url') + '.' + t.split('.')[1];
    assert.equal(verifySiteToken(forged, SECRET), null, 'حمولةٌ مبدَّلة لا تمرّ');

    for (const bad of [null, undefined, '', 'no-dot', '.', 'a.b', 42, {}]) {
        assert.equal(verifySiteToken(bad, SECRET), null, `توكن فاسد: ${JSON.stringify(bad)}`);
    }
});

test('🎫 التوكن المنتهي لا يُقرأ — والانتهاء يُفحَص فعلاً', () => {
    const expired = signSiteToken({ user: 'ali', project: 'shop' }, SECRET, -1);
    assert.equal(verifySiteToken(expired, SECRET), null, 'منتهٍ قبل ثانية');
    assert.ok(verifySiteToken(signSiteToken({ user: 'ali', project: 'shop' }, SECRET, 60), SECRET));
});

// ── قائمة السماح ───────────────────────────────────────────────────
const base = () => ({
    brand: 'Shop',
    hero: { title: 'T', subtitle: 'S', cta1: 'C', image: 'i.png' },
    footer: { rights: 'R' },
    sections: { about: { heading: 'A', subheading: 'B', items: [{ title: 't', desc: 'd', image: 'x' }] } },
    routes: [{ label: 'Home', href: '/' }],
});

test('🧱 التعديل لا يلمس ما ليس في القائمة (routes مثلاً)', () => {
    const out = applyContentPatch(base(), { routes: [{ label: 'X', href: '/evil' }], brand: 'New' });
    assert.deepEqual(out.routes, [{ label: 'Home', href: '/' }], 'المسارات لا تُعدَّل من اللوحة');
    assert.equal(out.brand, 'New');
});

test('🧱 لا يُنشئ قسماً جديداً — ولا حتى باسمٍ موروثٍ من Object', () => {
    const inherited = ['constructor', 'toString', 'hasOwnProperty', 'valueOf',
        'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable'];
    const patch = { sections: { newone: { heading: 'N' } } };
    for (const k of inherited) patch.sections[k] = { heading: 'HACK-' + k };
    const out = applyContentPatch(base(), patch);

    assert.deepEqual(Object.keys(out.sections), ['about'], `أقسامٌ زائدة: ${Object.keys(out.sections)}`);
    // والدليل الأصدق: ما يُكتب فعلاً في lib/content.js
    const written = JSON.parse(JSON.stringify(out));
    assert.deepEqual(Object.keys(written.sections), ['about']);
});

test('🧱 القسم الموجود يُعدَّل، والحقل المتروك يبقى على قيمته', () => {
    const out = applyContentPatch(base(), { sections: { about: { heading: 'A2' } } });
    assert.equal(out.sections.about.heading, 'A2');
    assert.equal(out.sections.about.subheading, 'B', 'ما لم يُرسَل لا يُمحى');
    assert.equal(out.sections.about.items.length, 1, 'العناصر تبقى');
});

test('🧱 تعديلٌ ليس كائناً لا يُسقط الطلب ولا يمحو القسم', () => {
    for (const s of [null, 'x', 42, true]) {
        const out = applyContentPatch(base(), { sections: { about: s } });
        assert.equal(out.sections.about.heading, 'A', `تعديلٌ من نوع ${typeof s}`);
    }
});

test('🧱 الحدود مفروضة: طول النصوص وعدد العناصر والمنتجات', () => {
    const long = 'x'.repeat(5000);
    const out = applyContentPatch(base(), {
        brand: long,
        hero: { title: long },
        sections: { about: { heading: long, items: Array.from({ length: 50 }, () => ({ title: long })) } },
        products: Array.from({ length: 500 }, (_, i) => ({ name: 'p' + i, price: long })),
    });
    assert.equal(out.brand.length, 120);
    assert.equal(out.hero.title.length, 400);
    assert.equal(out.sections.about.heading.length, 160);
    assert.equal(out.sections.about.items.length, 24);
    assert.equal(out.products.length, 200);
    assert.equal(out.products[0].price.length, 40);
});

test('🧱 المنتج يُنقّى إلى حقوله الأربعة لا غير', () => {
    const p = sanitizeProduct({ name: 'n', price: '9', desc: 'd', image: 'i', script: '<script>' });
    assert.deepEqual(Object.keys(p), ['name', 'price', 'desc', 'image']);
    assert.equal(p.script, undefined);
});

// ── الصور ──────────────────────────────────────────────────────────
test('🖼️ data:URL: نوعٌ مسموح يُفكّ، وغيره يُردّ برسالة لا برمية', () => {
    const ok = decodeDataUrl(PNG);
    assert.equal(ok.ext, 'png');
    assert.ok(ok.buf.length > 0);
    assert.ok(decodeDataUrl('data:text/html;base64,PHNjcmlwdD4=').error, 'نوع غير صورة');
    assert.ok(decodeDataUrl('not-a-data-url').error);
    assert.ok(decodeDataUrl(null).error);
    assert.ok(decodeDataUrl('data:image/png;base64,').error, 'حمولةٌ فارغة');
});

test('🖼️ اسم الملف لا يحمل مساراً ولا امتداداً مزدوجاً، ولا يتكرّر', () => {
    const a = safeAssetName('../../etc/passwd', 'png');
    assert.equal(a.includes('/'), false);
    assert.equal(a.includes('..'), false);
    assert.ok(a.endsWith('.png'));
    assert.notEqual(safeAssetName('logo', 'png'), safeAssetName('logo', 'png'), 'لا يدهس رفعاً سابقاً');
    assert.ok(safeAssetName('', 'png').startsWith('img-'), 'اسمٌ فارغ يصير img');
});
