// 🗣️ PM/14 — «لغةُ الآلة ليست لغةَ المنتج»: بوّابتا الحكم الحتميّتان (أثرُ المتطلّبات PM/7، وصدقُ المجال PM/3)
// تقرآن مفاهيمَ المعجم من **نصّ الملفّ خاماً**. فقِيس: صفحةٌ لا تذكر المجالَ بكلمةٍ واحدة تنطق بستّة كيانات —
// `course` من السمة `class`، و`event` من `pointer-events` ومن `Event`، و`order` من خاصّة الترتيب في CSS،
// و`location` من `grid-area` ومن `window.location`، و`property` من `transition-property`، و`table` من الوسم
// وخاصّته. فمنتجُ العقارات يجتاز بوّابةَ متطلّباته **٢/٢** على صفحةٍ فارغة، والمطعمُ ٢/٣ — والغيابُ كان
// «قاطعاً» بنصّ العقد. وأسوأ: «المغطّى» يصير غيرَ صفر فتُخرَس بوّابةُ التلوّث التي وُضعت لالتقاط «بُني منتجٌ آخر».
// المبدأ: التنسيقُ لا يسمّي منتجاً، وأسماءُ الوسوم والسماتِ كلماتُ المنصّة لا كلماتُ صاحب المشروع.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productText, conceptsInText, domainFidelity } from '../agents/projectModel.js';
import { composeRequirements, traceRequirements } from '../agents/requirementsVerifier.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// صفحةٌ من هيكلٍ ووسمٍ وتنسيقٍ فقط — لا كلمةَ مجالٍ فيها إطلاقاً
const BARE_HTML = `<!DOCTYPE html><html><head><style>
.nav{display:flex;order:1}.card{pointer-events:none;grid-area:a}
.t{table-layout:fixed;transition-property:all}
</style></head><body><div class="wrap" style="order:2;grid-area:x"><h1>مرحباً</h1>
<table><tr><td>١</td></tr></table></div></body></html>`;
const BARE_JS = `const el=document.querySelector('.x');el.classList.add('on');
const l=window.location;location.hash='';export class Widget{}new Event('x');`;

test('صفحةٌ بلا مجالٍ لا تنطق بكيانٍ واحد — وكانت تنطق بستّة', () => {
    const spoken = [...conceptsInText(productText(BARE_HTML, 'index.html'))];
    assert.deepEqual(spoken, [], `نطقت بـ: ${spoken.join('، ')}`);
    const jsSpoken = [...conceptsInText(productText(BARE_JS, 'script.js'))];
    assert.deepEqual(jsSpoken, [], `السكربتُ نطق بـ: ${jsSpoken.join('، ')}`);
});

test('ملفُّ تنسيقٍ لا يسمّي منتجاً مهما بلغ حجمُه', () => {
    assert.equal(productText('.a{order:2}.b{pointer-events:none;grid-area:x}', 'styles.css').trim(), '');
});

// أربعةُ منتجاتٍ كيانُها الأساسيُّ من الستّة المصطدمة — الصفحةُ الفارغة كانت تُثبت أثرَها
const CASES = [
    ['عقارات', { entities: [{ name: 'عقار' }, { name: 'موقع' }], roles: [{ name: 'وسيط' }] }],
    ['مطعم', { entities: [{ name: 'طلب' }, { name: 'طاولة' }], roles: [{ name: 'نادل' }] }],
    ['فعاليات', { entities: [{ name: 'فعالية' }, { name: 'تذكرة' }], roles: [{ name: 'منظّم' }] }],
    ['تعليم', { entities: [{ name: 'دورة' }, { name: 'طالب' }], roles: [{ name: 'معلم' }] }],
];

test('لا أثرَ لمتطلّبٍ في صفحةٍ لا تذكره — والعقاراتُ كانت ٢/٢ على صفحةٍ فارغة', () => {
    const files = [{ name: 'index.html', content: BARE_HTML }, { name: 'script.js', content: BARE_JS }];
    for (const [label, model] of CASES) {
        const t = traceRequirements(composeRequirements(null, model), files);
        assert.deepEqual(t.traced, [], `${label}: «له أثر» زوراً — ${t.traced.join('، ')}`);
    }
});

test('بوّابةُ التلوّث تنطق: صفحةٌ فارغةٌ لا تغطّي مفهوماً ولا تنطق بأجنبيّ', () => {
    for (const [label, model] of CASES) {
        const d = domainFidelity(model, productText(BARE_HTML, 'index.html'));
        assert.deepEqual(d.covered, [], `${label}: «مغطّى» زوراً — ${d.covered.join('، ')}`);
        assert.deepEqual(d.foreign, [], `${label}: «أجنبيّ» زوراً — ${d.foreign.join('، ')}`);
    }
});

test('ما يقوله المنتجُ فعلاً يبقى: النصُّ المرئيُّ وقيمُ السمات وبياناتُ السكربت', () => {
    const page = `<div class="grid"><h2>الطاولات المتاحة</h2>
      <input placeholder="ابحث عن طلب" aria-label="بحث الطلبات"></div>`;
    const spoken = conceptsInText(productText(page, 'index.html'));
    assert.ok(spoken.has('table'), 'نصُّ «الطاولات» المرئيّ سقط');
    assert.ok(spoken.has('order'), 'قيمةُ السمة «ابحث عن طلب» سقطت');
    const js = `const orders=[{table:1,total:9}];function renderOrders(){}`;
    assert.ok(conceptsInText(productText(js, 'app.js')).has('order'), 'بياناتُ السكربت الحقيقيّة سقطت');
});
