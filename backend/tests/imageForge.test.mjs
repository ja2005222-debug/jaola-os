// 🖼️ Image Forge: توليد صور مضمون في حالة عدم توفّرها — حتميّ، محليّ، بلا شبكة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { forgeItemSVG, forgeSeedImages, patchImgUrlPassthrough, seedOf } from '../agents/imageForge.js';
import { stampSeed } from '../agents/seedStamp.js';
import { extractDefinedFunctions, verifyBehavior } from '../agents/behaviorVerifier.js';
import { foodDeliveryClone } from '../agents/cloneTemplates/foodDelivery.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

test('forgeItemSVG: صورة SVG صالحة بالرمز واللون — وحتميّة (نفس البذرة = نفس الناتج)', () => {
    const a = forgeItemSVG({ emoji: '🧴', accent: '#8b5cf6', seed: 7, label: 'عطر باريسي' });
    assert.ok(a.startsWith('<svg') && a.includes('</svg>'), 'وثيقة SVG');
    assert.ok(a.includes('🧴'), 'الرمز حاضر');
    assert.ok(a.includes('linearGradient'), 'تدرّج الخلفية');
    assert.ok(a.includes('عطر باريسي'), 'التسمية حاضرة');
    assert.equal(a, forgeItemSVG({ emoji: '🧴', accent: '#8b5cf6', seed: 7, label: 'عطر باريسي' }), 'حتميّ');
    assert.notEqual(a, forgeItemSVG({ emoji: '🧴', accent: '#8b5cf6', seed: 8, label: 'عطر باريسي' }), 'بذرة مختلفة = تنويع');
    // تعقيم نصّ التسمية (لا حقن)
    assert.ok(forgeItemSVG({ label: 'a<b&c' }).includes('a&lt;b&amp;c'));
});

test('patchImgUrlPassthrough: يمرّر المسارات المحلية ويُبقي معرّفات Unsplash', () => {
    const js = "function imgUrl(id) { return 'https://images.unsplash.com/photo-' + id + '?w=600&q=80&auto=format&fit=crop'; }";
    const { changed, js: out } = patchImgUrlPassthrough(js);
    assert.equal(changed, true);
    // eslint-disable-next-line no-new-func
    const imgUrl = Function(out + '; return imgUrl;')();
    assert.equal(imgUrl('images/gen-1.svg'), 'images/gen-1.svg', 'مسار محلي يمرّ كما هو');
    assert.ok(imgUrl('1505740420928-5e560c06d30e').startsWith('https://images.unsplash.com/photo-1505740420928'), 'معرّف Unsplash يبقى');
    assert.equal(patchImgUrlPassthrough('no imgUrl here').changed, false, 'لا دالة → لا تغيير');
});

test('forgeSeedImages: كلون التوصيل (فيه عناصر img فارغة متداخلة) → صور مولّدة وربط سليم', () => {
    const c = foodDeliveryClone();
    const r = forgeSeedImages(c.files, { goal: 'توصيل طعام', category: c.category });
    assert.equal(r.changed, true);
    assert.ok(r.count >= 3, `عناصر بلا صور مُلئت (${r.count})`);
    const app = r.files.find(f => f.name === 'app.js').content;
    // كل الصور المولّدة موجودة كملفات ومربوطة في البيانات
    for (const f of r.files.filter(f => f.name.startsWith('images/'))) {
        assert.ok(f.content.startsWith('<svg'), f.name + ' صورة SVG');
        assert.ok(app.includes(f.name), f.name + ' مربوطة في app.js');
    }
    // لا فقد لأي دالة بعد إعادة تركيب المصفوفة
    const before = new Set(extractDefinedFunctions(c.files.find(f => f.name === 'app.js').content));
    const after = new Set(extractDefinedFunctions(app));
    assert.deepEqual([...before].filter(n => !after.has(n)), [], 'كل الدوال محفوظة');
    // imgUrl صار يمرّر المحلي
    assert.ok(/indexOf\('\/'\)/.test(app), 'تمرير المسارات المحلية');
});

test('forgeSeedImages: قالب كل صوره متوفّرة (المتجر) → لا تغيير (لا ضجيج)', () => {
    const r = forgeSeedImages(jaolaStore().files, { goal: 'متجر', category: 'ecommerce' });
    assert.equal(r.changed, false);
});

test('السيناريو الكامل: بصمة تُفرِّغ الصور → المولّد يملؤها كلّها', async () => {
    const c = jaolaStore();
    const chat = async () => `[
      { "id": "p1", "name": "عطر باريسي", "cat": "عطور", "price": 480, "rating": 4.9, "emoji": "🧴", "stock": 10, "img": "", "desc": "شرقي فرنسي." },
      { "id": "p2", "name": "عود ملكي", "cat": "عطور", "price": 950, "rating": 4.8, "emoji": "🌸", "stock": 6, "img": "", "desc": "عود أصيل." }
    ]`;
    const stamped = await stampSeed(c.files, 'متجر عطور', { chat, category: 'ecommerce' });
    assert.equal(stamped.ok, true);
    const files = c.files.map(f => (f.name === 'app.js' ? stamped.files.find(x => x.name === 'app.js') : f));
    const r = forgeSeedImages(files, { goal: 'متجر عطور', category: 'ecommerce' });
    assert.equal(r.changed, true);
    assert.equal(r.count, 2, 'صورتان مولّدتان للعطرين');
    const app = r.files.find(f => f.name === 'app.js').content;
    assert.ok(app.includes('عطر باريسي') && app.includes('images/gen-'), 'البيانات المبصومة + الصور المولّدة معاً');
});

test('تكامل jsdom: مشروع بعد التوليد يجتاز التحقّق السلوكي بلا أخطاء', async () => {
    const c = foodDeliveryClone();
    const r = forgeSeedImages(c.files, { goal: 'توصيل', category: c.category });
    const merged = new Map(c.files.map(f => [f.name, f.content]));
    for (const f of r.files) merged.set(f.name, f.content);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-'));
    for (const [name, content] of merged) {
        const fp = path.join(dir, name);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, content);
    }
    const v = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] }, domainModel: c.model });
    assert.equal(v.ok, true, 'يعمل بعد التوليد — ' + v.summary);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('seedOf: حتميّ وموجب', () => {
    assert.equal(seedOf('abc'), seedOf('abc'));
    assert.ok(seedOf('أي نص عربي') >= 0);
});
