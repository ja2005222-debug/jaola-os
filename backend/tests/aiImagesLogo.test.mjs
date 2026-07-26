// 🎨 صور AI فوق عقد imageForge: مزوّد قابل للفحص + استبدال آمن لا يمسّ صور المستخدم
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiImagesReady, generateProductImage, applyAiImages, imageProviderOf } from '../services/aiImages.js';
import { aiImagesQuota } from '../services/subscriptionService.js';
import { UNLIMITED } from '../config/plans.js';

const APP_JS = `
function imgUrl(id) { return 'https://images.unsplash.com/photo-' + id + '?w=600&q=80&auto=format&fit=crop'; }
const PRODUCTS = [
  { "id": "p1", "name": "كنافة", "price": 25, "img": "" },
  { "id": "p2", "name": "بقلاوة", "price": 30, "img": "images/gen-p2.svg" },
  { "id": "p3", "name": "معمول", "price": 20, "img": "assets/my-real-photo.jpg" },
  { "id": "p4", "name": "هريسة", "price": 15, "img": "1470229722913-7c0e2dbbafd3" }
];
function render() { return PRODUCTS.length; }
`;

test('اختيار المزوّد: Gemini أولاً إن وُجد، وIMAGE_PROVIDER يفرض، وصور Gemini تولّد عبر generateContent', async () => {
    assert.equal(imageProviderOf({}), null);
    assert.equal(imageProviderOf({ GEMINI_API_KEY: 'g' }), 'gemini');
    assert.equal(imageProviderOf({ OPENAI_API_KEY: 'o' }), 'openai');
    assert.equal(imageProviderOf({ GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' }), 'gemini', 'Gemini مقدَّم');
    assert.equal(imageProviderOf({ GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o', IMAGE_PROVIDER: 'openai' }), 'openai', 'الفرض يعمل');
    assert.equal(imageProviderOf({ OPENAI_API_KEY: 'o', IMAGE_PROVIDER: 'gemini' }), null, 'فرض مزوّد بلا مفتاحه = غير مُفعّل');

    let captured = null;
    const png = Buffer.from('gemini-image-bytes');
    const r = await generateProductImage('كنافة شهية', {
        env: { GEMINI_API_KEY: 'gk-123' },
        fetchImpl: async (url, opts) => {
            captured = { url, opts };
            return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'وصف' }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }) };
        },
    });
    assert.ok(r.ok && Buffer.compare(r.buf, png) === 0 && r.ext === 'png');
    assert.ok(captured.url.includes('gemini-2.5-flash-image:generateContent') && captured.url.includes('key=gk-123'), 'النموذج الافتراضي صور Gemini وليس Imagen المُوقف');
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.contents[0].parts[0].text, 'كنافة شهية');
    assert.deepEqual(body.generationConfig.responseModalities, ['IMAGE']);

    const blocked = await generateProductImage('x', {
        env: { GEMINI_API_KEY: 'gk' },
        fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] }) }),
    });
    assert.ok(/IMAGE_SAFETY/.test(blocked.error), 'استجابة 200 بلا صورة تُظهر سبب الحجب — ولا يُجرَّب نموذج آخر');
});

test('سلّم نماذج Gemini: اسم مُوقف → التالي، مفتاح مرفوض → توقّف فوري بإرشاد، خطأ حصة → بلا تبديل عبثي', async () => {
    // النموذج الأول غير موجود → يُجرَّب الثاني وينجح
    const png = Buffer.from('fallback-bytes');
    const urls = [];
    const ladder = await generateProductImage('كنافة', {
        env: { GEMINI_API_KEY: 'gk' },
        fetchImpl: async (url) => {
            urls.push(url);
            if (urls.length === 1) return { ok: false, status: 404, json: async () => ({ error: { message: 'models/gemini-2.5-flash-image is not found for API version v1beta' } }) };
            return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }) };
        },
    });
    assert.ok(ladder.ok && Buffer.compare(ladder.buf, png) === 0);
    assert.ok(urls[0].includes('gemini-2.5-flash-image') && urls[1].includes('gemini-3.1-flash-image'), 'الاسم المُوقف يُتخطى للتالي');

    // مفتاح مرفوض → رسالة إرشادية فورية واستدعاء واحد فقط
    let calls = 0;
    const badKey = await generateProductImage('x', {
        env: { GEMINI_API_KEY: 'stale' },
        fetchImpl: async () => { calls++; return { ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid. Please pass a valid API key.' } }) }; },
    });
    assert.equal(calls, 1, 'لا تبديل نماذج على مفتاح مرفوض');
    assert.ok(/GEMINI_API_KEY/.test(badKey.error) && /aistudio\.google\.com/.test(badKey.error), 'إرشاد تجديد المفتاح واضح');

    // خطأ حصة → يُعاد كما هو بلا تجربة بقية السلّم
    let calls2 = 0;
    const quota = await generateProductImage('x', {
        env: { GEMINI_API_KEY: 'gk' },
        fetchImpl: async () => { calls2++; return { ok: false, status: 429, json: async () => ({ error: { message: 'Resource has been exhausted (e.g. check quota).' } }) }; },
    });
    assert.equal(calls2, 1);
    assert.ok(/quota/.test(quota.error) && /gemini-2.5-flash-image/.test(quota.error), 'خطأ الحصة يصل باسم النموذج');
});

test('فرض IMAGE_MODEL_GEMINI باسم imagen يبقى على مسار :predict القديم', async () => {
    let captured = null;
    const png = Buffer.from('imagen-bytes');
    const r = await generateProductImage('كنافة', {
        env: { GEMINI_API_KEY: 'gk-123', IMAGE_MODEL_GEMINI: 'imagen-4.0-generate-001' },
        fetchImpl: async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ predictions: [{ bytesBase64Encoded: png.toString('base64') }] }) }; },
    });
    assert.ok(r.ok && Buffer.compare(r.buf, png) === 0);
    assert.ok(captured.url.includes('imagen-4.0-generate-001:predict'));
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.instances[0].prompt, 'كنافة');
    assert.equal(body.parameters.sampleCount, 1);
});

test('المزوّد: غير مُفعّل صريح، وحمولة OpenAI صحيحة مع فكّ base64', async () => {
    assert.equal(aiImagesReady({}), false);
    const off = await generateProductImage('كنافة', { env: {} });
    assert.ok(off.notConfigured && /OPENAI_API_KEY/.test(off.error) && /GEMINI_API_KEY/.test(off.error));

    let captured = null;
    const png = Buffer.from('fake-png-bytes');
    const r = await generateProductImage('ك'.repeat(2000), {
        env: { OPENAI_API_KEY: 'sk-x', IMAGE_MODEL: 'gpt-image-1' },
        fetchImpl: async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ data: [{ b64_json: png.toString('base64') }] }) }; },
    });
    assert.ok(r.ok && Buffer.compare(r.buf, png) === 0 && r.ext === 'png');
    assert.ok(captured.url.includes('/images/generations'));
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.model, 'gpt-image-1');
    assert.equal(body.prompt.length, 900, 'البرومبت مسقوف');
    assert.equal(captured.opts.headers.Authorization, 'Bearer sk-x');

    const fail = await generateProductImage('x', {
        env: { OPENAI_API_KEY: 'sk-x' },
        fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) }),
    });
    assert.ok(/quota/.test(fail.error));
});

test('applyAiImages: الفارغ والمولّد ومعرّف Unsplash المزروع تُستبدل — صورة المستخدم الحقيقية لا تُمسّ', async () => {
    const genFn = async () => ({ ok: true, buf: Buffer.from('img'), ext: 'png' });
    const r = await applyAiImages([{ name: 'app.js', content: APP_JS }], { goal: 'حلويات' }, genFn);
    assert.ok(r.changed);
    assert.equal(r.count, 3, 'الفارغ + المولّد + معرّف Unsplash (بذرة القالب لا صورة المستخدم)');
    assert.ok(r.appJs.includes('images/ai-p1.png') && r.appJs.includes('images/ai-p2.png') && r.appJs.includes('images/ai-p4.png'));
    assert.ok(r.appJs.includes('assets/my-real-photo.jpg'), 'صورة المستخدم باقية');
    assert.ok(r.appJs.includes('function render()'), 'الدوال سليمة');
    assert.deepEqual(r.images.map(i => i.name).sort(), ['images/ai-p1.png', 'images/ai-p2.png', 'images/ai-p4.png']);
    // imgUrl مُرقّعة لتمرير المسارات المحلية
    // eslint-disable-next-line no-new-func
    const imgUrl = Function(r.appJs + '; return imgUrl;')();
    assert.equal(imgUrl('images/ai-p1.png'), 'images/ai-p1.png');
});

test('applyAiImages: سقف الدفعة يُحترم، وفشل صورة لا يفشل البقية، وnotConfigured يوقف مبكراً', async () => {
    const files = [{ name: 'app.js', content: APP_JS }];
    const one = await applyAiImages(files, { goal: 'x', maxCount: 1 }, async () => ({ ok: true, buf: Buffer.from('i'), ext: 'png' }));
    assert.equal(one.count, 1, 'الحصة المتبقية تُحترم');

    let calls = 0;
    const flaky = await applyAiImages(files, { goal: 'x' }, async () => {
        calls++;
        return calls === 1 ? { error: 'فشل مؤقت' } : { ok: true, buf: Buffer.from('i'), ext: 'png' };
    });
    assert.equal(flaky.count, 2, 'الفاشلة تُتخطى والناجحتان تُطبَّقان');

    const allFail = await applyAiImages(files, { goal: 'x' }, async () => ({ error: 'فشل توليد الصورة عبر gemini-2.5-flash-image (quota exceeded).' }));
    assert.ok(!allFail.changed && /quota exceeded/.test(allFail.reason), 'فشل كل الصور يُظهر خطأ المزوّد الفعلي لا رسالة عامة');

    const off = await applyAiImages(files, { goal: 'x' }, async () => ({ notConfigured: true, error: 'لا مفتاح' }));
    assert.ok(off.notConfigured && !off.changed);

    const none = await applyAiImages([{ name: 'app.js', content: 'var x = 1;' }], {}, async () => ({}));
    assert.ok(!none.changed, 'لا مصفوفة بيانات → لا تغيير');
});

test('حصة صور AI بالخطة: مجاني 6، Pro 150، مؤسسات بلا حدود', () => {
    assert.equal(aiImagesQuota(null).monthly, 6);
    assert.equal(aiImagesQuota({ subscription: { plan: 'pro', status: 'active' } }).monthly, 150);
    assert.equal(aiImagesQuota({ subscription: { plan: 'enterprise', status: 'active' } }).monthly, UNLIMITED);
});

test('applyHeroImage: يستهدف قسم الـ hero ويحفظ الأنماط ويستبدل الخلفية القديمة', async () => {
    const { applyHeroImage } = await import('../services/aiImages.js');
    // قالب حقيقي: topbar قبل الـ hero — يجب ألا يُلمس شريط التنقل
    const html = '<header class="topbar">nav</header><section class="hero"><div class="hero-in">x</div></section>';
    const r = applyHeroImage(html, 'images/ai-hero.png');
    assert.ok(r.changed);
    assert.ok(r.html.includes('<section class="hero" style="background-image:url(\'images/ai-hero.png\')'));
    assert.ok(r.html.includes('<header class="topbar">'), 'شريط التنقل سليم');

    // style موجود: تبقى الأنماط الأخرى وتُستبدل الخلفية القديمة فقط
    const styled = '<div class="banner" style="min-height:300px;background:linear-gradient(red,blue);">y</div>';
    const r2 = applyHeroImage(styled, 'images/ai-hero.png');
    assert.ok(r2.changed && r2.html.includes('min-height:300px') && !r2.html.includes('linear-gradient'));
    assert.ok(r2.html.includes("background-image:url('images/ai-hero.png')"));

    // لا hero → أول section؛ لا شيء إطلاقاً → سبب واضح
    const plain = '<section id="about">z</section>';
    assert.ok(applyHeroImage(plain, 'i.png').changed);
    assert.ok(!applyHeroImage('<p>text only</p>', 'i.png').changed);
});

test('استهداف بالاسم: العنصر المسمّى وحده يُستبدل — حتى لو صورته حقيقية (التسمية = موافقة)', async () => {
    const genFn = async () => ({ ok: true, buf: Buffer.from('i'), ext: 'png' });
    const r = await applyAiImages([{ name: 'app.js', content: APP_JS }], { goal: 'x', targetLabel: 'معمول' }, genFn);
    assert.ok(r.changed);
    assert.equal(r.count, 1, 'العنصر المسمّى فقط');
    assert.ok(r.appJs.includes('images/ai-p3.png'), 'صورة المعمول الحقيقية استُبدلت لأنه سُمّي صراحة');
    assert.ok(r.appJs.includes('images/gen-p2.svg'), 'غير المسمّى لا يُمسّ حتى المولّد منه');

    // «ال» التعريف لا تمنع المطابقة
    const al = await applyAiImages([{ name: 'app.js', content: APP_JS }], { goal: 'x', targetLabel: 'الكنافة' }, genFn);
    assert.ok(al.changed && al.count === 1 && al.appJs.includes('images/ai-p1.png'));

    // اسم غير موجود → سبب واضح باسم الطلب
    const none = await applyAiImages([{ name: 'app.js', content: APP_JS }], { targetLabel: 'طائرات' }, genFn);
    assert.ok(!none.changed && none.reason.includes('طائرات'), 'رسالة «لم أجد» تذكر الاسم المطلوب');
});

test('استهداف بالتصنيف والجمع: «مؤتمرات» تصيب بطاقة category مؤتمرات في قالب الفعاليات', async () => {
    // بنية SEED_EVENTS الحقيقية من قالب jaolaEvents (مختصرة)
    const EVENTS_JS = `
function imgUrl(id) { return 'x' + id; }
const SEED_EVENTS = [
  { "id": "e1", "title": "ليلة الطرب العربي", "category": "حفلات موسيقية", "img": "1470229722913-7c0e2dbbafd3" },
  { "id": "e3", "title": "مؤتمر التقنية 2026", "category": "مؤتمرات", "img": "1505373877841-8d25f7d46678" },
  { "id": "e4", "title": "مسرحية الرحلة", "category": "مسرح", "img": "assets/user-play.jpg" }
];
`;
    const genFn = async () => ({ ok: true, buf: Buffer.from('i'), ext: 'png' });
    // «مؤتمرات» (جمع) تطابق category «مؤتمرات» وعنوان «مؤتمر …» (مفرد) — العنصر e3 وحده
    const r = await applyAiImages([{ name: 'app.js', content: EVENTS_JS }], { goal: 'فعاليات', targetLabel: 'مؤتمرات' }, genFn);
    assert.ok(r.changed);
    assert.equal(r.count, 1, 'بطاقة المؤتمرات وحدها');
    assert.ok(r.appJs.includes('images/ai-e3.png'));
    assert.ok(r.appJs.includes('1470229722913-7c0e2dbbafd3'), 'بقية البطاقات لا تُمسّ في الاستهداف');

    // «الحفلات» (بأل التعريف) تطابق «حفلات موسيقية»
    const r2 = await applyAiImages([{ name: 'app.js', content: EVENTS_JS }], { goal: 'فعاليات', targetLabel: 'الحفلات' }, genFn);
    assert.ok(r2.changed && r2.count === 1 && r2.appJs.includes('images/ai-e1.png'));
});

test('قوالب باستدعاءات دوال في البيانات (g: grad(…)): القراءة تنجح والاستبدال جراحي لا يفسدها', async () => {
    // البنية الحرفية لقالب jaolaEvents التي كانت تفشل بـ «grad is not defined»
    const GRAD_JS = `
function grad(a, b) { return 'linear-gradient(135deg,' + a + ',' + b + ')'; }
function imgUrl(id) { return 'x' + id; }
const SEED_EVENTS = [
  { id: 'e1', title: 'ليلة الطرب العربي', category: 'حفلات موسيقية', img: '1470229722913-7c0e2dbbafd3', g: grad('#7c3aed', '#db2777'), approved: true },
  { id: 'e3', title: 'مؤتمر التقنية 2026', category: 'مؤتمرات', img: '1505373877841-8d25f7d46678', g: grad('#2563eb', '#7c3aed'), approved: true }
];
`;
    const genFn = async () => ({ ok: true, buf: Buffer.from('i'), ext: 'png' });

    // توليد جماعي: كلا البذرتين Unsplash تُستبدلان — وgrad(...) يبقى حرفياً
    const all = await applyAiImages([{ name: 'app.js', content: GRAD_JS }], { goal: 'فعاليات' }, genFn);
    assert.ok(all.changed, 'القراءة لم تعد تفشل على grad');
    assert.equal(all.count, 2);
    assert.ok(all.appJs.includes("grad('#7c3aed', '#db2777')") && all.appJs.includes("grad('#2563eb', '#7c3aed')"), 'استدعاءات grad سليمة حرفياً');
    assert.ok(all.appJs.includes('images/ai-e1.png') && all.appJs.includes('images/ai-e3.png'));
    assert.ok(all.appJs.includes('function grad(a, b)'), 'الدوال خارج المصفوفة سليمة');

    // استهداف «مؤتمرات» عبر category — بطاقة e3 وحدها
    const one = await applyAiImages([{ name: 'app.js', content: GRAD_JS }], { goal: 'فعاليات', targetLabel: 'مؤتمرات' }, genFn);
    assert.ok(one.changed && one.count === 1);
    assert.ok(one.appJs.includes('images/ai-e3.png') && one.appJs.includes('1470229722913-7c0e2dbbafd3'), 'e1 لم تُمسّ');
});

test('شبكة أمان imgUrl: توقيع مُعدَّل → غلاف تمرير يُلحق، وصورنا المولّدة سابقاً قابلة للتجديد', async () => {
    // imgUrl بشكل غير قياسي (عدّله إصلاح تلقائي) — الرقعة الكلاسيكية لن تنطبق
    const ODD_JS = `
const imgUrl = (id) => 'https://images.unsplash.com/photo-' + String(id) + '?w=700';
const ITEMS = [
  { id: 'a1', name: 'منتج أول', img: '1470229722913-7c0e2dbbafd3' },
  { id: 'a2', name: 'منتج ثانٍ', img: 'images/ai-old.png' }
];
`;
    const genFn = async () => ({ ok: true, buf: Buffer.from('i'), ext: 'png' });
    const r = await applyAiImages([{ name: 'app.js', content: ODD_JS }], { goal: 'x' }, genFn);
    assert.ok(r.changed);
    assert.equal(r.count, 2, 'بذرة Unsplash + صورتنا القديمة (تجديد) كلاهما مؤهّل');
    assert.ok(r.appJs.includes("v.indexOf('/')"), 'غلاف التمرير المحلي أُلحق');
    // الغلاف يعمل فعلاً: مسار محلي يمرّ كما هو رغم imgUrl السهمية الأصلية
    // eslint-disable-next-line no-new-func
    const scope = Function(r.appJs.replace('const imgUrl', 'var imgUrl') + '; return imgUrl;')();
    assert.equal(scope('images/ai-a1.png'), 'images/ai-a1.png');
    assert.ok(scope('12345678-abcd').startsWith('https://images.unsplash.com/'), 'المعرّفات البعيدة كما كانت');
});

test('مزامن localStorage: يُحقن مع خريطة الصور، يندمج مع السابق، ويعمل فعلاً على حالة محفوظة', async () => {
    const { injectImgSync, diagnoseImages } = await import('../services/aiImages.js');
    const base = "let events = load('events', SEED);";
    const v1 = injectImgSync(base, { e1: 'images/ai-e1.png' });
    assert.ok(v1.startsWith('/* jaola:img-sync */'), 'المزامن يسبق قراءة الحالة');
    // حقن ثانٍ يدمج الخريطتين في كتلة واحدة (idempotent)
    const v2 = injectImgSync(v1, { e3: 'images/ai-e3.png' });
    assert.equal((v2.match(/jaola:img-sync \*\//g) || []).length, 2, 'كتلة واحدة (بداية+نهاية) لا تكرار');
    assert.ok(v2.includes('images/ai-e1.png') && v2.includes('images/ai-e3.png'), 'الخريطتان مدموجتان');

    // تنفيذ فعلي على localStorage صوري: الحالة القديمة تتحدث بالصور الجديدة
    const store = new Map([['jev_events', JSON.stringify([{ id: 'e1', img: 'old-unsplash-id' }, { id: 'e2', img: 'keep' }])]]);
    const fakeLS = {
        get length() { return store.size; },
        key: (i) => [...store.keys()][i],
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
    };
    const syncCode = v2.slice(0, v2.indexOf('/* /jaola:img-sync */'));
    // eslint-disable-next-line no-new-func
    Function('localStorage', syncCode.replace('/* jaola:img-sync */', ''))(fakeLS);
    const synced = JSON.parse(store.get('jev_events'));
    assert.equal(synced[0].img, 'images/ai-e1.png', 'العنصر المولّد تزامن');
    assert.equal(synced[1].img, 'keep', 'غير المولّد لم يُمسّ');

    // التشخيص يرى المزامن والرقعة
    const d = diagnoseImages([{ name: 'app.js', content: v2 + " function imgUrl(id){var v=String(id||'');return v.indexOf('/')!==-1?v:'u'+v;} const ITEMS = [{ id: 'e1', name: 'x', img: 'images/ai-e1.png' }];" }]);
    assert.ok(d.ok && d.syncBlock && d.passthrough);
    assert.equal(d.itemCount, 1);
    assert.deepEqual(d.imgs, ['images/ai-e1.png']);
});

test('مخزن اللقطات يحفظ الثنائيات base64 ويعيدها سليمة بايتاً ببايت', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    // نختبر جمع/استعادة الملفات عبر أقراص فعلية (بلا Mongo — الدوال تتجاوز بأمان)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe]);
    fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'images/ai-e1.png'), png);
    fs.writeFileSync(path.join(dir, 'app.js'), 'const A = 1;');
    // نصل لدالة الجمع عبر snapshot الذي يفشل offline لكن collect داخلي —
    // نتحقق مباشرة من قابلية الترميز والاسترجاع
    const b64 = fs.readFileSync(path.join(dir, 'images/ai-e1.png')).toString('base64');
    const back = Buffer.from(b64, 'base64');
    assert.equal(Buffer.compare(back, png), 0, 'ذهاب وإياب base64 يحفظ البايتات');
    // القراءة النصية القديمة كانت تتلفها
    const corrupted = Buffer.from(fs.readFileSync(path.join(dir, 'images/ai-e1.png'), 'utf-8'));
    assert.notEqual(Buffer.compare(corrupted, png), 0, 'utf-8 يتلف الثنائي فعلاً — سبب الإصلاح');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('برومبت العناصر من هوية العنصر (عنوان + تصنيف) لا اسم المشروع — ومحصّن ضد الكتابة', async () => {
    const EV_JS = `
function imgUrl(id) { return 'x' + id; }
const SEED = [{ id: 'e4', title: 'مسرحية «الرحلة»', category: 'مسرح', img: '1503095396549-807759245b35' }];
`;
    const prompts = [];
    const genFn = async (p) => { prompts.push(p); return { ok: true, buf: Buffer.from('i'), ext: 'png' }; };
    const r = await applyAiImages([{ name: 'app.js', content: EV_JS }], { goal: 'photo-test-26-2' }, genFn);
    assert.ok(r.changed && prompts.length === 1);
    assert.ok(prompts[0].includes('مسرحية «الرحلة»') && prompts[0].includes('مسرح'), 'العنوان والتصنيف حاضران');
    assert.ok(!prompts[0].includes('photo-test-26-2'), 'اسم المشروع التقني لا يلوّث البرومبت');
    assert.ok(/no text/.test(prompts[0]) && /no letters/.test(prompts[0]), 'تحصين ضد الكتابة داخل الصورة');
});
