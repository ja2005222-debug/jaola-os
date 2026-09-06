// ⚖️ PM/3 — «صدقُ المجال بوّابةً» (`PRODUCT_MIND.md`): المحقّقُ السلوكيّ كان يفحص الاتّصالَ والأدوارَ والبيانات
// والتفاعل — ولا يسأل قطُّ: **هل هذا المنتجُ الذي طُلب؟** فلو خرج تطبيقُ مطعمٍ بعلامة تاكسي لعبَر البوّابةَ سليماً.
// هنا: فهرسٌ عكسيّ لمعجم PM/1 نفسِه (لا قائمةَ كلماتٍ ثانية)، وفحصٌ حتميّ بثلاث حالات، يغذّي حكمَ PM/2 تلقائياً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { conceptsInText, domainFidelity } from '../agents/projectModel.js';
import { analyzeStatic, verifyBehavior } from '../agents/behaviorVerifier.js';
import { behaviorOutcome } from '../agents/stages/verify.js';
import { emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const TAXI = { roles: [{ name: 'Passenger' }, { name: 'Driver' }, { name: 'Admin' }], entities: [{ name: 'Trip' }, { name: 'Vehicle' }], flows: [] };
const check = (checks) => checks.find(c => c.name === 'domain-fidelity');
const RESTAURANT = '<h1>مطعم البحر</h1><section id="menu"><h2>القائمة</h2></section><div>الطاولة رقم 3</div><p>النادل يستلم</p>';
const TAXI_PAGE = '<h1>تاكسي</h1><div>الراكب</div><div>السائق</div><div>الإدارة</div><button>احجز رحلة</button><p>المركبة</p>';

test('conceptsInText: فهرسٌ عكسيّ للمعجم — يلتقط الكلمةَ الكاملة بالعربيّة والإنجليزيّة، ويتجاهل العامّ والجزئيّ', () => {
    const found = conceptsInText('نظامُ الرحلات: الراكب يطلب والسائق يقبل، والمركبة في الطريق');
    assert.ok(['trip', 'passenger', 'driver', 'vehicle'].every(c => found.has(c)), [...found].join(','));
    assert.equal(conceptsInText('The passenger booked a trip').has('passenger'), true);
    assert.equal(conceptsInText('user item').size, 0, 'العامُّ لا يسمّي منتجاً');
    assert.deepEqual([...conceptsInText('employee')], ['staff'], '«موظّف» دورٌ حقيقيّ في المعجم (staff) لا مفهومٌ عامّ');
    assert.equal(conceptsInText('الطاولات').has('table'), true, '«ال» التعريف تُنزع فيُطابق الجمعُ المعروف');
    assert.equal(conceptsInText('طاولاتنا الجديدة').has('table'), false, 'اللاحقةُ لا تُحتسب — الكلمةُ الكاملة فقط');
    assert.ok(conceptsInText('والسائق يقود بالمركبة للراكب').has('driver'), 'سوابقُ العطف/الجرّ مع «ال» تُنزع');
    // 🔎 المرادفُ أقصرُ من ثلاثة أحرف ضجيجٌ لا مفهوم: «رد» تَرِد في كلِّ نصٍّ عربيّ، فلا تجعل كلَّ مشروعٍ مشروعَ ردود.
    assert.equal(conceptsInText('السائق رد على الراكب').has('reply'), false, '«رد» حرفان — لا تُحتسب');
    assert.equal(conceptsInText('قائمة ردود').has('reply'), true, '«ردود» أربعة — تُحتسب');
    assert.equal(conceptsInText('').size, 0); assert.equal(conceptsInText(null).size, 0);
});

test('domainFidelity: صفحةُ مطعمٍ على فهمِ تاكسي = تلوّث؛ صفحةُ تاكسي = تغطيةٌ كاملة؛ فهمٌ عامّ = لا ينطبق؛ صفحةٌ صامتة = نقصٌ لا تلوّث', () => {
    const bad = domainFidelity(TAXI, RESTAURANT);
    assert.equal(bad.applicable, true); assert.equal(bad.contaminated, true);
    assert.deepEqual(bad.covered, []); assert.ok(bad.foreign.length >= 3, bad.foreign.join(','));
    const good = domainFidelity(TAXI, TAXI_PAGE);
    assert.equal(good.contaminated, false); assert.deepEqual(good.missing, []);
    assert.deepEqual(good.covered.sort(), ['admin', 'driver', 'passenger', 'trip', 'vehicle'].sort());
    assert.equal(domainFidelity({ roles: [{ name: 'User' }], entities: [{ name: 'Item' }] }, RESTAURANT).applicable, false, 'فهمٌ بلا معنىً لا يُحاكَم');
    assert.equal(domainFidelity({ roles: [{ name: 'Passenger' }], entities: [{ name: 'Trip' }] }, '<h1>صفحة</h1>').contaminated, false, 'الصمتُ نقصٌ لا تلوّث');
    assert.equal(domainFidelity(TAXI, '<h1>مطعم</h1><div>الطاولة</div>').contaminated, false, 'مفهومان أجنبيّان لا يكفيان — العتبةُ ثلاثة');
    assert.equal(domainFidelity({ roles: [{ name: 'Passenger' }], entities: [{ name: 'Item' }] }, RESTAURANT).applicable, false,
        'مفهومٌ متوقَّعٌ واحد لا يكفي للحكم — العتبةُ اثنان (الواحدُ يصادف كثيراً)');
    // 🔎 حضورُ مفهومٍ واحدٍ صحيح ينفي التلوّث: هذا نقصٌ يُكمَل لا منتجٌ مغاير — والأجنبيُّ لا يشمل ما هو متوقَّع.
    const mixed = domainFidelity(TAXI, '<h1>الراكب</h1><div>مطعم</div><div>الطاولة</div><p>النادل</p>');
    assert.deepEqual(mixed.covered, ['passenger']);
    assert.ok(mixed.foreign.length >= 3 && !mixed.foreign.includes('passenger'), mixed.foreign.join(','));
    assert.equal(mixed.contaminated, false, 'تقاطعٌ واحدٌ يكفي لنفي التلوّث مهما كثُر الأجنبيّ');
    assert.equal(domainFidelity(null, RESTAURANT).applicable, false);
});

test('الفحصُ في المحقّق: تلوّثٌ → fail بمفاهيم الطرفين؛ نقصٌ → warn بأسمائه؛ تغطيةٌ → pass؛ فهمٌ عامّ → لا فحصَ أصلاً', () => {
    const fail = check(analyzeStatic({ html: RESTAURANT, js: '', domainModel: TAXI }));
    assert.equal(fail.status, 'fail');
    assert.match(fail.detail, /^المبنيُّ يتكلّم لغةَ منتجٍ آخر: .+ — ولا أثرَ لمفاهيم المنتج المطلوب \(trip، vehicle، passenger، driver، admin\)\.$/);
    const warn = check(analyzeStatic({ html: '<h1>الراكب</h1>', js: '', domainModel: TAXI }));
    assert.equal(warn.status, 'warn'); assert.match(warn.detail, /مفاهيمُ المنتج غير ظاهرة في الواجهة\/الكود: trip، vehicle، driver، admin\./);
    assert.equal(check(analyzeStatic({ html: TAXI_PAGE, js: '', domainModel: TAXI })).status, 'pass');
    // 🔎 النصُّ المفحوص = الواجهةُ **والكود**: مفاهيمُ منتجٍ تعيش في أسماء متغيّراته لا في عناوينه فقط.
    const CODE_ONLY = { html: '<h1>لوحة</h1><button id="go">ابدأ</button>', domainModel: TAXI };
    assert.equal(check(analyzeStatic({ ...CODE_ONLY, js: 'const trip={}, vehicle={}, driver={}, passenger={}; const admin=true;' })).status, 'pass',
        'المفاهيمُ في script.js وحدَها تكفي');
    assert.equal(check(analyzeStatic({ ...CODE_ONLY, js: '' })).status, 'warn', 'وبدونها نقصٌ — فالفرقُ من الكود لا من الصدفة');
    assert.equal(check(analyzeStatic({ html: RESTAURANT, js: '', domainModel: { roles: [{ name: 'User' }], entities: [] } })), undefined, 'صامتٌ بلا فهمٍ ذي معنى');
    assert.equal(check(analyzeStatic({ html: RESTAURANT, js: '' })), undefined, 'بلا نموذجٍ إطلاقاً');
});

test('من طرفٍ إلى طرف: مشروعٌ يعمل تقنيّاً لكنّه منتجٌ آخر → المحقّقُ يسقطه، وبوّابةُ PM/2 تقول «ثغراتٌ باقية: domain-fidelity»', async () => {
    const dir = emptyProject();
    fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>مطعم</title></head><body>
<h1>مطعم البحر</h1><section id="menu"><h2>القائمة</h2><ul id="items"></ul></section><div>الطاولة 3</div><p>النادل</p>
<button id="add">أضف</button><script src="script.js"></script></body></html>`);
    fs.writeFileSync(path.join(dir, 'script.js'), `const dishes=[{name:'سمك'}];const ul=document.getElementById('items');
dishes.forEach(d=>{const li=document.createElement('li');li.textContent=d.name;ul.appendChild(li);});
document.getElementById('add').addEventListener('click',()=>{const li=document.createElement('li');li.textContent='صنف';ul.appendChild(li);});`);
    const verdict = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp' }, domainModel: TAXI });
    assert.equal(verdict.ran, true);
    assert.equal(verdict.ok, false, 'يعمل تقنيّاً — لكنّه ليس المنتجَ المطلوب');
    assert.equal(check(verdict.checks).status, 'fail');
    const gate = behaviorOutcome(verdict);
    assert.equal(gate.status, 'fail'); assert.match(gate.detail, /domain-fidelity/);
    // ونفسُ المشروع على فهمِ مطعمٍ صحيح: لا سقوطَ بصدق المجال
    const right = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp' }, domainModel: { roles: [{ name: 'نادل' }], entities: [{ name: 'طاولة' }, { name: 'صنف قائمة' }], flows: [] } });
    assert.notEqual(check(right.checks).status, 'fail', JSON.stringify(check(right.checks)));
});

test('الحدود: المعجمُ واحد (الفحصُ يستورد domainFidelity من projectModel ولا يبني قائمةً)، والفحصُ اسمٌ واحد بثلاث حالات', () => {
    const src = fs.readFileSync(path.join(HERE, '../agents/behaviorVerifier.js'), 'utf8');
    assert.ok(src.includes("import { domainFidelity } from './projectModel.js';"));
    assert.equal((src.match(/domainFidelity\(/g) || []).length, 1);
    assert.equal((src.match(/name: 'domain-fidelity'/g) || []).length, 3, 'fail/warn/pass');
    const pm = fs.readFileSync(path.join(HERE, '../agents/projectModel.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(pm.includes('export function conceptsInText(text, { limit = 200000 } = {}) {'));
    assert.equal((pm.match(/GENERIC_CONCEPTS\.has/g) || []).length, 2, 'العامُّ يُستبعد في المجموعتين');
    assert.equal((pm.match(/const SYNONYMS = \[\]/g) || []).length, 1, 'فهرسٌ واحد للمرادفات');
    // 🔎 حدٌّ معروف: `ROLE_SYNONYMS` في المحقّق ما زالت قائمةً مستقلّةً لتغطية الأدوار (PM/3b يوحّدها بالمعجم).
    assert.ok(src.includes('const ROLE_SYNONYMS = ['), 'موجودةٌ بعد — التوحيدُ خطوةٌ لاحقة مكتوبة');
});
