// ═══════════════════════════════════════════════════════════════════
// 🔍 `agents/seoAgent.js` — الوحدة التي تكتب robots.txt وsitemap.xml لكلّ
// موقعٍ يُسلَّم. كانت بلا تغطية، وفيها دعويان لا يحملهما الواقع:
//
//   ١) `generateSitemap(url)` يُنادى **بلا صفحات**، فتبقى `pages` على قيمتها
//      الافتراضية `['']` ويخرج الملفُّ برابطٍ واحد: الرئيسية. فموقعٌ من ثماني
//      صفحات يُنشَر وخريطتُه تُعلن صفحةً واحدة — و`robots.txt` يشير إليها.
//   ٢) الدرجةُ تُسجَّل `{ grade: 'A', score: 100 }` **ثابتةً مكتوبةً في
//      المستدعي**، إلى جانب درجتَي «الجودة» و«الأمان» المشتقّتين من نتائجهما.
//      فلا يميّز المستخدمُ المقياسَ من الثابت.
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSEO, generateSitemap, generateRobotsTxt } from '../agents/seoAgent.js';

const URL_ = 'https://u-proj.vercel.app';
const INFO = { name: 'مطعم البحر', description: 'أطايب البحر', url: URL_, lang: 'ar' };
const page = (name) => ({ name, content: '<!DOCTYPE html><html><head><title>ت</title></head><body>م</body></html>' });
const locs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

test('خريطةُ الموقع تُعلن كلَّ صفحةٍ سُلِّمت، لا الرئيسيةَ وحدها', async () => {
    const files = [page('index.html'), page('about.html'), page('services.html'), page('contact.html'),
        { name: 'styles.css', content: 'body{}' }, { name: 'script.js', content: '' }];
    const r = await runSEO(files, INFO);
    const sitemap = r.newFiles.find((f) => f.name === 'sitemap.xml').content;

    assert.deepEqual(locs(sitemap), [
        `${URL_}/`, `${URL_}/about.html`, `${URL_}/contact.html`, `${URL_}/services.html`,
    ]);
    assert.equal(r.pages, 4);
});

test('ما ليس صفحةً لا يدخل الخريطة', async () => {
    const r = await runSEO([page('index.html'), { name: 'styles.css', content: '' },
        { name: 'app.js', content: '' }, { name: 'data.json', content: '{}' }], INFO);
    assert.deepEqual(locs(r.newFiles.find((f) => f.name === 'sitemap.xml').content), [`${URL_}/`]);
});

test('بلا صفحاتٍ أصلاً تبقى الخريطةُ على الجذر — لا خريطةٌ فارغة', async () => {
    const r = await runSEO([{ name: 'main.js', content: '' }], INFO);
    assert.deepEqual(locs(r.newFiles.find((f) => f.name === 'sitemap.xml').content), [`${URL_}/`]);
});

// موقعٌ بلا index.html لكن بصفحات: الخريطةُ تعدّها ولا تخترع جذراً لا وجود له.
test('موقعٌ بلا رئيسية: الصفحاتُ الموجودة تُعدّ ولا يُخترَع جذر', async () => {
    const r = await runSEO([page('home.html'), page('about.html')], INFO);
    assert.deepEqual(locs(r.newFiles.find((f) => f.name === 'sitemap.xml').content),
        [`${URL_}/about.html`, `${URL_}/home.html`]);
});

test('الدرجةُ مُشتقّةٌ من واقعةٍ مقيسة لا ثابتٌ مكتوب', async () => {
    const withIndex = await runSEO([page('index.html')], INFO);
    assert.equal(withIndex.metaInjected, true);
    assert.equal(withIndex.grade, 'A');
    assert.equal(withIndex.score, 100);

    const without = await runSEO([{ name: 'main.js', content: '' }], INFO);
    assert.equal(without.metaInjected, false);
    assert.notEqual(without.grade, 'A', 'دُرِّجت A بلا صفحةٍ أُدخلت فيها الوسوم');
    assert.ok(without.score < 100);
});

test('الملخّصُ لا يذكر وسوماً لم تُدخَل', async () => {
    const without = await runSEO([{ name: 'main.js', content: '' }], INFO);
    assert.ok(!without.summary.includes('meta tags'),
        `ادّعى وسوماً لم تُدخَل: ${without.summary}`);
    const withIndex = await runSEO([page('index.html')], INFO);
    assert.ok(withIndex.summary.includes('meta tags'));
});

test('robots.txt يشير إلى الخريطة نفسها التي كُتبت', async () => {
    const r = await runSEO([page('index.html'), page('about.html')], INFO);
    const robots = r.newFiles.find((f) => f.name === 'robots.txt').content;
    assert.ok(robots.includes(`Sitemap: ${URL_}/sitemap.xml`));
    assert.ok(r.newFiles.some((f) => f.name === 'sitemap.xml'), 'أشار إلى خريطةٍ لم تُكتب');
});

test('generateSitemap يبقى محترماً لصفحاته حين تُمرَّر', () => {
    assert.deepEqual(locs(generateSitemap(URL_, ['', 'a.html'])), [`${URL_}/`, `${URL_}/a.html`]);
    assert.ok(generateRobotsTxt(URL_).includes('Disallow: /'), 'حجبُ الزواحف الذكية سقط');
});
