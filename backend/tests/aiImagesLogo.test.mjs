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
  { "id": "p3", "name": "معمول", "price": 20, "img": "assets/my-real-photo.jpg" }
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

test('applyAiImages: يستبدل الفارغ والمولّد فقط — صورة المستخدم الحقيقية لا تُمسّ', async () => {
    const genFn = async () => ({ ok: true, buf: Buffer.from('img'), ext: 'png' });
    const r = await applyAiImages([{ name: 'app.js', content: APP_JS }], { goal: 'حلويات' }, genFn);
    assert.ok(r.changed);
    assert.equal(r.count, 2, 'عنصران مؤهّلان فقط');
    assert.ok(r.appJs.includes('images/ai-p1.png') && r.appJs.includes('images/ai-p2.png'));
    assert.ok(r.appJs.includes('assets/my-real-photo.jpg'), 'صورة المستخدم باقية');
    assert.ok(r.appJs.includes('function render()'), 'الدوال سليمة');
    assert.deepEqual(r.images.map(i => i.name).sort(), ['images/ai-p1.png', 'images/ai-p2.png']);
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
    assert.equal(flaky.count, 1, 'الفاشلة تُتخطى والناجحة تُطبَّق');

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
