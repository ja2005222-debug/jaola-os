// ═══════════════════════════════════════════════════════════════════
// 🧪 `agents/testingAgent.js` — الدرجةُ التي تُقال للمستخدم بعد كل بناء
//    («✅ A (100/100)» في سجلّ البناء الحيّ).
//
// 🔴 كانت تكافئ النقصان. `calculateScore` يقسم على عدد الفحوص **المُنفَّذة**،
//    والملفُّ الغائب كان يُسهم بسقوطٍ واحد ويحذف من المقام فحوصَه كلَّها ومعها
//    تحذيراتُها (كلُّ تحذيرٍ −٢). فقِيس:
//        كامل ١٩ فحصاً → ٨٣ | بلا JS → ٨٤ | بلا CSS → ٨٥ | html وحده → ٨٦
//    **كلُّ ملفٍّ يُحذَف يرفع الدرجة.** وموقعٌ لا يُعرَض ولا يعمل يُقال لصاحبه
//    «🟡 B (86/100)».
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { runTests } from '../agents/testingAgent.js';

const HTML = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>مطعم البحر</title>
<meta name="description" content="أطايب البحر الطازجة يومياً في قلب المدينة">
<link rel="stylesheet" href="styles.css"></head><body><header><h1>مطعم البحر</h1></header>
<main><img src="a.jpg" alt="طبق سمك"><button id="o">اطلب</button></main>
<script src="script.js"></script></body></html>`;

const html = { name: 'index.html', content: HTML };
// موقعٌ تعريفيّ مشروع: لا يربط سكربتاً أصلاً
const brochure = { name: 'index.html', content: HTML.replace('<script src="script.js"></script>', '') };
const css = { name: 'styles.css', content: ':root{--primary:#06c}body{font-family:sans-serif}@media(max-width:600px){body{font-size:14px}}' };
const js = { name: 'script.js', content: 'document.getElementById("o").addEventListener("click",()=>console.log(1));' };

test('حذفُ ملفٍّ لا يرفع الدرجة — الغيابُ أسوأُ من النقص لا أهون', async () => {
    const full = await runTests([html, css, js], 'ar');
    const noJs = await runTests([html, css], 'ar');
    const noCss = await runTests([html, js], 'ar');
    const htmlOnly = await runTests([html], 'ar');

    assert.ok(noJs.score < full.score, `حذفُ script.js رفع الدرجة: ${full.score} → ${noJs.score}`);
    assert.ok(noCss.score < full.score, `حذفُ styles.css رفع الدرجة: ${full.score} → ${noCss.score}`);
    assert.ok(htmlOnly.score < noJs.score && htmlOnly.score < noCss.score,
        `حذفُ الاثنين ليس أسوأَ من حذف أحدهما: ${htmlOnly.score}`);
});

// وشرطُ العقوبة دليلٌ من الصفحة نفسها، لا قاعدةٌ عمياء.
test('موقعٌ تعريفيّ لا يربط سكربتاً لا يُعاقَب على غيابه', async () => {
    const full = await runTests([html, css, js], 'ar');
    const fair = await runTests([brochure, css], 'ar');
    assert.ok(fair.score >= full.score - 5,
        `عوقب موقعٌ تعريفيّ مشروع: ${fair.score} مقابل ${full.score}`);
});

test('ملفٌّ مرتبطٌ في الصفحة ثمّ غائب يُقاس بفحوصه لا بسقوطٍ واحد', async () => {
    const noCss = await runTests([html, js], 'ar');
    const withEmptyCss = await runTests([html, { name: 'styles.css', content: '' }, js], 'ar');
    // الغائبُ ≤ الفارغ: كلاهما بلا تنسيق، والغائبُ يزيد عليه بأنّ الرابط مكسور
    assert.ok(noCss.score <= withEmptyCss.score,
        `الغائبُ (${noCss.score}) أعلى من الفارغ (${withEmptyCss.score})`);
    assert.ok(noCss.total >= withEmptyCss.total - 1, 'المقامُ انكمش بغياب الملف');
});

test('الدرجةُ تُميّز السليمَ من المعطوب فعلاً', async () => {
    const good = await runTests([html, css, js], 'ar');
    const broken = await runTests([
        { name: 'index.html', content: '<html><body><img src=x><div>Lorem ipsum dolor</div></body></html>' },
        { name: 'styles.css', content: 'body{color:red' },
        { name: 'script.js', content: 'function a( {  var x = ' },
    ], 'ar');
    assert.ok(good.score - broken.score >= 25, `الفرقُ ضئيل: ${good.score} مقابل ${broken.score}`);
    assert.equal(broken.grade, 'D');
    assert.ok(broken.failedTests.length > good.failedTests.length);
});

// حقلٌ واحدٌ بمعنيين يضيع أحدُهما صامتاً.
test('عددُ الناجحة ونتيجةُ النجاح حقلان متمايزان', async () => {
    const r = await runTests([html, css, js], 'ar');
    assert.equal(typeof r.passed, 'boolean', 'passed يجب أن تكون نتيجةً لا عدداً');
    assert.equal(typeof r.passedCount, 'number', 'عددُ الناجحة ضاع');
    assert.ok(r.passedCount > 1 && r.passedCount <= r.total);
    assert.ok(r.report.includes(`${r.passedCount}/${r.total}`),
        `التقريرُ لا يذكر العددَ الصحيح: ${r.report}`);
});

test('لا ملفاتٍ إطلاقاً: درجةٌ منخفضة وتقريرٌ لا يدّعي نجاحاً', async () => {
    const r = await runTests([], 'ar');
    assert.equal(r.passed, false);
    assert.ok(r.score < 50, `درجةٌ مرتفعة لمشروعٍ فارغ: ${r.score}`);
    assert.ok(r.failedTests.includes('HTML'));
});
