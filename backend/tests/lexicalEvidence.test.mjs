// ⚖️🔤 «٩/٩ ثمّ PASS» على متجرٍ لا علاقةَ له بالطلب — أخطرُ ما قِيس اليوم.
//
// طلبَ صاحبُ المنصّة منصّةَ هندسةِ برمجيّات؛ فبُني له سوقٌ إلكترونيّ، ثمّ أعلن الحكمُ
// `requirements-verify ✓` و`PASS` على **٩ من ٩** من بنود وثيقته.
//
// قِيس السببُ بلا مزوّدٍ أصلاً: `traceSections` تَعُدّ البندَ «له أثر» إن ظهرت **أيُّ كلمة**
// من عنوانه في نصّ المنتج. و`buildSectionFixInstruction` تُسلّم النموذجَ عناوينَ البنود
// **بنصّها** وتطلب تنفيذها. فأرخصُ طريقٍ لإرضاء المقياس هو كتابةُ ألفاظه — والحلقةُ تُغلق
// على نفسها: **البوّابةُ تُرضى بألفاظِها هي.**
//
// وعقدُ `traceSections` كان يقول الحقيقةَ في نصّه طوال الوقت — «أثرٌ لا تنفيذ» — ثمّ يعيد
// `status: 'pass'`. فالكلامُ صادقٌ والحالةُ كاذبة، والحكمُ يقرأ الحالة. وهذا عينُ ما وُضع
// PM/2 لمنعه: **ما لم يُتحقَّق منه لا يُعلَن نجاحاً.**
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { specSections } from '../agents/textNormalizer.js';
import { traceSections, traceRequirements } from '../agents/requirementsVerifier.js';
import { requirementsTraceOutcome, strategyVerdict } from '../agents/stages/verify.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// وثيقةُ صاحب المنصّة بعينها (بنودُها التسعة المرقّمة)
const DOC = `Build and evolve JAOLA OS into a production-ready autonomous AI software engineering platform.

Prioritize:

1. Reliable autonomous execution
2. Real codebase understanding
3. Safe sandboxed execution
4. GitHub integration
5. Testing and automatic error recovery
6. Persistent project memory
7. Security
8. Scalability
9. Clear execution logs and observability`;

const SECTIONS = specSections(DOC);
const WORDS = '1. Reliable autonomous execution 2. Real codebase understanding 3. Safe sandboxed execution '
    + '4. GitHub integration 5. Testing and automatic error recovery 6. Persistent project memory '
    + '7. Security 8. Scalability 9. Clear execution logs and observability';

/** سوقٌ إلكترونيّ + تذييلٌ ميّت يسرد ألفاظَ البنود — ما بُني فعلاً. */
const shopWithFooter = () => [
    { name: 'index.html', content: `<h1>سوق جاولا</h1><p>تسوّق من عشرات البائعين المعتمدين.</p><footer>${WORDS}</footer>` },
    { name: 'app.js', content: 'const products=[{name:"كيك"}];document.querySelector("#buy").addEventListener("click",()=>{});' },
];

test('🔴 تسعةُ بنودٍ «لها أثر» في تذييلٍ ميّت لا تُعطي PASS — والحكمُ الصادق «لم يكتمل التحقّق»', () => {
    const files = shopWithFooter();
    const d = traceSections(SECTIONS, files);
    assert.equal(d.traced.length, 9, 'الطُّعمُ لا يعيد إنتاج العطب — الاختبار لا يقيس شيئاً');

    const out = requirementsTraceOutcome(null, files, 'لا محقّق', SECTIONS);
    assert.notEqual(out.status, 'pass', 'أثرٌ لفظيّ أُعلن نجاحاً — والعقدُ نفسُه يقول «أثرٌ لا تنفيذ»');

    const v = strategyVerdict({ filesCount: files.length, files, sections: SECTIONS, behavior: null });
    assert.notEqual(v.status, 'PASS', 'PASS على متجرٍ لا علاقةَ له بالوثيقة');
});

test('🔴 ويُسمّى الدليلُ الزائف بعدده — «أثرُه في نصٍّ لا يشغّله شيء»', () => {
    const out = requirementsTraceOutcome(null, shopWithFooter(), 'لا محقّق', SECTIONS);
    assert.match(out.detail, /9 منها أثرُه في نصٍّ لا يشغّله شيء/,
        'العددُ لا يُقال، فلا يرى صاحبُ المنصّة أين ذهبت تسعتُه');
    assert.match(out.detail, /7 Security|Reliable/, 'ولا يُسمّى بندٌ واحد — فلا يُعرف أيُّها زينة');
});

test('🔴 والغيابُ يبقى قاطعاً — بندٌ لا تنطق به الملفّاتُ فشلٌ لا «لم يكتمل»', () => {
    const bare = [{ name: 'index.html', content: '<h1>سوق جاولا</h1><p>تسوّق من عشرات البائعين.</p>' }];
    const out = requirementsTraceOutcome(null, bare, 'لا محقّق', SECTIONS);
    assert.equal(out.status, 'fail', 'الغيابُ لُيِّن — وهو أقوى إشارةٍ نملكها');
    assert.equal(traceSections(SECTIONS, bare).missing.length, 9);
});

test('🔴 وأثرٌ في الشفرة العاملة يُميَّز من أثرٍ في نصٍّ ميّت — وإلّا فالتمييزُ دعوى', () => {
    const inert = [{ name: 'index.html', content: `<h1>م</h1><footer>${WORDS}</footer>` }];
    const live = [
        { name: 'index.html', content: '<h1>م</h1><button id="run">تشغيل</button>' },
        { name: 'app.js', content: `// ${WORDS}\nfunction execution(){}` },
    ];
    // والشفرةُ المضمَّنة شفرةٌ أيضاً: صفحةٌ بلا ملفِّ js تبقى قابلةً للتمييز
    const inline = [{ name: 'index.html', content: `<h1>م</h1><script>/* ${WORDS} */<\/script>` }];
    const a = traceSections(SECTIONS, inert);
    const b = traceSections(SECTIONS, live);
    const c = traceSections(SECTIONS, inline);
    assert.ok(a.decorative.length > 0, 'نصٌّ ميّتٌ لم يُوسَم');
    assert.ok(b.decorative.length < a.decorative.length, 'الشفرةُ العاملة عوملت معاملةَ التذييل');
    assert.ok(c.decorative.length < a.decorative.length, '`<script>` المضمَّن عُدَّ نثراً — وأكثرُ ما نبنيه صفحةٌ واحدة');
});

test('🔴 والتمييزُ نفسُه على مسار المفاهيم — لا على البنود وحدَها', () => {
    const req = [{ name: 'بيانات product', _kind: 'entity' }];
    const prose = traceRequirements(req, [{ name: 'index.html', content: '<p>قائمة المنتجات</p>' }, { name: 'app.js', content: 'const x = 1;' }]);
    const code = traceRequirements(req, [{ name: 'app.js', content: 'const المنتجات = []; render(المنتجات);' }]);
    assert.deepEqual(prose.traced, ['بيانات product']);
    assert.deepEqual(prose.decorative, ['بيانات product'], 'مفهومٌ أثرُه نثرٌ لم يُوسَم');
    assert.deepEqual(code.decorative, [], 'مفهومٌ تنطق به الشفرةُ وُسم زينةً');
});

test('🔴 ولا يُدان بانٍ صادق: أثرٌ لفظيّ ليس فشلاً — «لم يكتمل التحقّق» لا «وُجدت ثغرات»', () => {
    const out = requirementsTraceOutcome(null, shopWithFooter(), 'لا محقّق', SECTIONS);
    assert.notEqual(out.status, 'fail', 'الحضورُ عوملَ كالغياب — فلا فرقَ بين من بنى ومن لم يبنِ');
    assert.equal(out.status, 'unverified');
});
