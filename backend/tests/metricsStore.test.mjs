// 📊 مخزن المقاييس — وحدةٌ تُغذّي لوحةً عنوانُها «صحّة الموقع»، وكانت بلا تغطية.
//
// العطبان كلاهما من عائلةٍ واحدة: دعوى يقينٍ لا تملكه اللوحة.
import { test } from 'node:test';
import assert from 'node:assert';
import {
    recordScore, recordBuild, recordEditAction,
    buildMetricsPayload, clearMetrics, getMetrics,
} from '../services/metricsStore.js';

// مفتاحٌ فريدٌ لكل اختبار — المخزن وحدةٌ مشتركة داخل العملية.
let n = 0;
const fresh = () => [`u${++n}`, `p${n}`];

test('الدرجةُ الطازجة ليست قديمة', () => {
    const [u, p] = fresh();
    recordBuild(u, p, { success: true, durationSec: 3, filesCount: 2, goal: 'متجر' });
    recordScore(u, p, 'seo', { grade: 'A', score: 100 });
    assert.strictEqual(buildMetricsPayload(u, p).seo.stale, false);
});

test('العطب: درجةٌ قيست قبل آخر بناءٍ كانت تُعرض كأنّها عن الكود الحالي', () => {
    const [u, p] = fresh();
    // بناءٌ أوّل يفحصه وكيل SEO
    recordScore(u, p, 'seo', { grade: 'A', score: 100 });
    recordBuild(u, p, { success: true, durationSec: 5, filesCount: 9, goal: 'مطعم' });
    assert.strictEqual(buildMetricsPayload(u, p).seo.stale, false, 'البناءُ الأوّل مفحوص');

    // بناءٌ ثانٍ يُخطَّى فيه وكيل SEO («⚠️ تخطّي» في jcr.js) — لا recordScore
    const m = getMetrics(u, p);
    m.builds[0].at = m.seo.at + 1000;          // البناءُ بعد القياس
    const after = buildMetricsPayload(u, p);
    assert.strictEqual(after.seo.score, 100, 'الدرجةُ نفسُها ما تزال معروضة');
    assert.strictEqual(after.seo.stale, true, 'ولكن موسومةً بأنّها تسبق البناء');
});

test('الوسمُ يشمل المحاور الثلاثة، ولا يُخترع لدرجةٍ غائبة', () => {
    const [u, p] = fresh();
    recordScore(u, p, 'seo', { grade: 'A', score: 100 });
    recordScore(u, p, 'security', { grade: 'B', score: 80 });
    recordBuild(u, p, { success: true });
    const m = getMetrics(u, p);
    m.builds[0].at = Date.now() + 5000;
    const pay = buildMetricsPayload(u, p);
    assert.strictEqual(pay.seo.stale, true);
    assert.strictEqual(pay.security.stale, true);
    assert.strictEqual(pay.quality, null, 'لا جودةَ قيست — فلا وسمَ ولا كائن');
});

test('بلا بناءٍ لا قِدَم: لا شيء أبطل القياس', () => {
    const [u, p] = fresh();
    recordScore(u, p, 'quality', { grade: 'A', score: 91 });
    assert.strictEqual(buildMetricsPayload(u, p).quality.stale, false);
});

test('التعديلُ لا يُبطل الدرجة — فالمقياسُ آخرُ بناء', () => {
    const [u, p] = fresh();
    recordBuild(u, p, { success: true });
    recordScore(u, p, 'seo', { grade: 'A', score: 100 });
    for (let i = 0; i < 5; i++) recordEditAction(u, p);
    const pay = buildMetricsPayload(u, p);
    assert.strictEqual(pay.totalEdits, 5);
    assert.strictEqual(pay.seo.stale, false);
});

test('العطب: مشروعٌ جديد بالاسم نفسه كان يرث مقاييسَ المحذوف', async () => {
    const [u, p] = fresh();
    recordScore(u, p, 'seo', { grade: 'A', score: 100 });
    recordBuild(u, p, { success: true, goal: 'متجر عطور المستخدم الأول' });
    assert.strictEqual(buildMetricsPayload(u, p).totalBuilds, 1);

    await clearMetrics(u, p);   // ما يفعله deleteProjectCompletely الآن

    const after = buildMetricsPayload(u, p);   // مشروعٌ جديد بالاسم نفسه
    assert.strictEqual(after.seo, null, 'لا درجةَ موروثة');
    assert.strictEqual(after.totalBuilds, 0, 'لا بناءاتٌ موروثة');
    assert.deepStrictEqual(after.builds, [], 'ولا أهدافُ المحذوف');
});

test('محوُ مشروعٍ بلا مقاييس ليس خطأً، ولا يمسّ جارَه', async () => {
    const [u, p] = fresh();
    recordBuild(u, p, { success: true });
    const r = await clearMetrics(u, 'مشروعٌ-لا-وجود-له');
    assert.strictEqual(r.existed, false);
    assert.strictEqual(buildMetricsPayload(u, p).totalBuilds, 1, 'الجارُ سليم');
});

test('البناءُ الفاشل يُسجَّل فاشلاً — الحقلُ يقبل القيمتين', () => {
    const [u, p] = fresh();
    recordBuild(u, p, { success: false, goal: 'أخفق' });
    recordBuild(u, p, { success: true, goal: 'نجح' });
    assert.deepStrictEqual(
        buildMetricsPayload(u, p).builds.map((b) => b.success), [true, false]);
});

test('سجلُّ البناءات لا يتجاوز خمسةَ عشر، والأحدثُ أوّلاً', () => {
    const [u, p] = fresh();
    for (let i = 0; i < 20; i++) recordBuild(u, p, { success: true, goal: `هدف${i}` });
    const pay = buildMetricsPayload(u, p);
    assert.strictEqual(pay.builds.length, 15);
    assert.strictEqual(pay.builds[0].goal, 'هدف19');
    assert.strictEqual(pay.totalBuilds, 20, 'العدّادُ يعدّ كلَّ البناءات لا المحفوظَ منها');
});
