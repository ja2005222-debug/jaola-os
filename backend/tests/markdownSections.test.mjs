// 📐 بنودُ المواصفة بصيغة ماركداون — «## 1.» بندٌ كما «1.» سواء.
//
// **العطبُ المقيس** (برومت «JAOLA Tester»، وثيقةٌ بخمسة عناوين مرقّمة): `numberedSections`
// تعود بـ**صفر**، فتسقط `isFullSpecification`، ومعها **كلُّ ما تحرسه**: بوّابةُ المتطلّبات
// (PM/9، PM/12 — `specSections` لا تُستدعى أصلاً)، وتسميةُ الكيانات من العناوين (PM/23)،
// و`specHead` (PM/11) التي تعود بالوثيقة كلِّها بدل جملة التسمية.
//
// والسببُ حرفٌ واحد: `NUMBERED_LINE` يشترط أن **يبدأ السطرُ برقم**، و«## 1.» يبدأ بـ`#`.
// فمن كتب مواصفتَه بماركداون — وهو أكثرُ ما يُولَّد اليوم — سقطت بنودُه **صامتةً**.
//
// 🔒 والحدُّ المحفوظ: **الرقمُ شرطٌ لا زينة**. «## الغاية» عنوانٌ لا بند، وإلّا صار كلُّ
//    عنوانٍ في الوثيقة مطلباً يُحاسَب عليه البناء.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberedSections, specSections, specHead, isFullSpecification } from '../agents/textNormalizer.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const MD = `أداةٌ لمتابعة المخزون.

## 1. الأصناف
إضافةُ صنفٍ واسمِه.

## 2. الجرد
عدُّ ما في المستودع.

### 3. التقرير
تقريرٌ شهريّ.`;

test('«## 1.» بندٌ يُعدّ — وقد كان صفراً', () => {
    assert.equal(numberedSections(MD), 3);
});

test('العنوانُ يخرج بلا علامات ماركداون', () => {
    assert.deepEqual(specSections(MD).map(s => `${s.n}:${s.title}`),
        ['1:الأصناف', '2:الجرد', '3:التقرير']);
});

test('مستوياتُ العنوان كلُّها (# إلى ######) سواء', () => {
    for (const h of ['#', '##', '###', '####', '#####', '######']) {
        assert.equal(numberedSections(`${h} 1. بند`), 1, `المستوى «${h}» لم يُعدّ`);
    }
});

test('الأرقامُ الهنديّة كالعربيّة تحت رأس ماركداون', () => {
    assert.deepEqual(specSections('## ١. الوِرد\n### ٢. المراجعة').map(s => s.n), [1, 2]);
});

test('🔒 عنوانٌ بلا رقم ليس بنداً — وإلّا صار كلُّ عنوانٍ مطلباً', () => {
    assert.equal(numberedSections('## الغاية\n### Requirements\n## النطاق'), 0);
    assert.equal(specSections('## الغاية').length, 0);
});

test('🔒 لا نقطةَ قائمةٍ ولا إحالةُ عطبٍ تُعدّ بنداً', () => {
    // «- auth.test.js» نقطةُ قائمة، و«#1» إحالةٌ بلا فاصلٍ بعد الرقم
    assert.equal(numberedSections('- auth.test.js: register\n#1 issue reference\n#12 آخر'), 0);
});

test('`specHead` يقف عند أوّل بندٍ ماركداونيّ — لا يبتلع الوثيقة', () => {
    assert.equal(specHead(MD), 'أداةٌ لمتابعة المخزون.');
});

test('الصيغةُ العارية لم تتغيّر — لا انحدار', () => {
    const plain = '1. الأوّل\n٢) الثاني\n3- الثالث';
    assert.equal(numberedSections(plain), 3);
    assert.deepEqual(specSections(plain).map(s => s.title), ['الأوّل', 'الثاني', 'الثالث']);
});

test('التوأمان متطابقان: ما تعدّه البوّابةُ هو ما تقرؤه القائمة', () => {
    // `numberedSections` تغذّي `isFullSpecification` (الحارس)، و`specSections` تُقرأ بعده.
    // لو افترقا لعدّت البوّابةُ ما لا يصل المستهلك — فالتطابقُ عقدٌ لا صدفة.
    for (const t of [MD, '## 1. أ\n2. ب\n### ٣. ج', '## بلا رقم\n1. مع رقم', '']) {
        assert.equal(numberedSections(t), specSections(t).length, `افترقا على: ${JSON.stringify(t)}`);
    }
});

test('حدُّ الطول والعدد باقٍ على حاله — ماركداون لا يتخطّى الحارس', () => {
    // `isFullSpecification` تشترط ١٢٠٠ حرفاً و٦ بنود. توسيعُ الصيغة لا يُرخي العتبة.
    assert.equal(isFullSpecification('## 1. أ\n## 2. ب'), false, 'قصيرةٌ فلا تمرّ');
    const long = 'ن'.repeat(1300) + '\n' + [1, 2, 3, 4, 5, 6].map(n => `## ${n}. بند`).join('\n');
    assert.equal(isFullSpecification(long), true, 'طويلةٌ بستّة بنودٍ ماركداونيّة تمرّ');
});
