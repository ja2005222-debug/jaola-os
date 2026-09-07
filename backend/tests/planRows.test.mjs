// 🗓️ PM/21 — «خطّةُ التسليم ليست مطالبَ المنتج»: مواصفاتُ المستخدمين تنتهي غالباً بجدولٍ زمنيّ («المرحلة ١: …»).
// وهي أسطرٌ عن **ترتيب العمل** لا عن المنتج، فتُفسد حكمَ PM/9 من طرفَيه معاً — قِيس على مواصفة نقاط البيع (٤٤ بنداً):
//   • ثلاثةُ أسطرِ مراحل تُعلَن «له أثر» بمفرداتٍ أثبتت بنوداً أخرى قبلها: «٣٨ المرحلة 2» بـ«منتجات · كاشير»
//     (وهما دليلا البندَين ٢ و٤)، و«٣٩ المرحلة 3» بـ«فواتير · دفع»، و«٤٢ المرحلة 6» بـ«تقارير». أثرٌ مكرَّرٌ يرفع البسط.
//   • وخمسةُ أسطرٍ أخرى تُعلَن «بلا أثر» فتُعرض على صاحب المشروع فجواتٍ عليه سدُّها — وهي لا تُبنى أصلاً.
// فالسطرُ الذي يصف *متى* نبني ليس سطراً يصف *ماذا* نبني: دلوُ `untraceable` القائم هو موضعُه — خارج البسط والمقام معاً.
// وهو مبدأُ PM/11 وPM/13 نفسُه: ما يصف الطلبَ أو الوثيقةَ لا يصف المطلوب.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { specSections } from '../agents/textNormalizer.js';
import { traceSections } from '../agents/requirementsVerifier.js';
import { getCloneById } from '../agents/cloneTemplates/index.js';
import { requirementsTraceOutcome } from '../agents/stages/verify.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const posFiles = () => (getCloneById('jaola-pos').files || []).map(f => ({ name: f.name, content: f.content }));
const isPhase = (t) => /مرحل|phase/i.test(t);

test('أسطرُ المراحل لا تُحسَب مطالبَ منتج: لا في «له أثر» ولا في «بلا أثر»', () => {
    const secs = specSections(SPEC);
    assert.equal(secs.length, 44, 'الوثيقةُ ٤٤ بنداً');
    assert.equal(secs.filter(s => isPhase(s.title)).length, 8, 'ثمانيةُ أسطرِ مراحل في الوثيقة');

    const d = traceSections(secs, posFiles());
    for (const bucket of ['traced', 'missing']) {
        const phases = d[bucket].filter((i) => isPhase(i.title)).map((i) => `${i.n} ${i.title}`);
        assert.deepEqual(phases, [], `أسطرُ مراحلَ في «${bucket}»: ${phases.join('، ')}`);
    }
    assert.equal(d.untraceable.filter((i) => isPhase(i.title)).length, 8, 'الثمانيةُ كلُّها لا تُتتبَّع');
    // والمقياسُ الصادق: ١٣/٤٤ ← ١٠/٣٦
    assert.equal(d.traced.length, 10, 'البسطُ بلا الأثر المكرَّر');
    assert.equal(d.traced.length + d.missing.length, 36, 'المقامُ بلا أسطر الجدول');
});

test('وبنودُ المنتج تبقى كما هي — لم يُسكَت مطلبٌ حقيقيّ', () => {
    const d = traceSections(specSections(SPEC), posFiles());
    for (const n of [2, 4, 5, 6, 14, 16, 20, 26, 30, 32]) {
        assert.ok(d.traced.some((i) => i.n === n), `البند ${n} ما زال له أثر`);
    }
    for (const n of [1, 3, 7, 8, 9, 10]) {
        assert.ok(d.missing.some((i) => i.n === n), `البند ${n} ما زال بلا أثر`);
    }
});

test('الحدّ: «مرحلة» وصفاً لا جدولاً تبقى مطلباً — العبرةُ بترقيم المرحلة لا بورود الكلمة', () => {
    const files = [{ name: 'app.js', content: 'مرحلة الدفع والتحصيل والفاتورة' }];
    const secs = [
        { n: 1, title: 'مرحلة الدفع في المتجر' },   // مطلبٌ فيه الكلمة — يبقى
        { n: 2, title: 'المرحلة 3: الفواتير' },      // سطرُ جدول — يخرج
        { n: 3, title: 'Phase 2: Reporting' },       // وبالإنجليزيّة كذلك
    ];
    const d = traceSections(secs, files);
    assert.deepEqual(d.untraceable.map((i) => i.n), [2, 3], 'أسطرُ الجدول وحدَها تخرج');
    assert.ok(d.traced.some((i) => i.n === 1), '«مرحلة الدفع» مطلبٌ له أثر');
});

test('والحدُّ الثاني: الجدولُ يُعرف بصدارة العنوان — ذكرُ المرحلة داخل مطلبٍ لا يُسقطه', () => {
    const secs = [
        { n: 1, title: 'تسليم المرحلة 3 يشمل الفواتير' },   // مطلبٌ يذكر مرحلةً وسطَ عنوانه
        { n: 2, title: 'المرحلة 3: الفواتير' },              // سطرُ جدولٍ في صدارته
    ];
    // والحالةُ التي يحملها التثبيتُ وحدَه: مطلبٌ **ينتهي** بذكر المرحلة، فالرقمُ آخرُ العنوان
    secs.push({ n: 3, title: 'الفواتير تُسلَّم في المرحلة 3' });
    const d = traceSections(secs, [{ name: 'a.js', content: 'الفواتير والتسليم' }]);
    assert.deepEqual(d.untraceable.map((i) => i.n), [2], 'الصدارةُ وحدَها تُخرج');
    assert.ok(d.traced.some((i) => i.n === 1), 'المطلبُ الذي يذكر المرحلة يبقى مقيساً');
    assert.ok(d.traced.some((i) => i.n === 3), 'ولا يُسكَت مطلبٌ لأنّ عنوانَه انتهى برقم مرحلة');
});

test('والحدُّ الثالث: الألفاظُ المقصودةُ بعينها — و«stage»/«جولة» تبقيان مطلبَين عمداً', () => {
    const rows = ['المرحلة 2: النواة', 'Phase 2: Core', 'Milestone 3: Billing', 'Sprint 4: Reports'];
    const keep = ['Stage 2: Payment pipeline', 'الجولة 2: جولة المتحف'];  // لهما معنىً منتَجيٌّ حقيقيّ
    const d = traceSections(
        [...rows, ...keep].map((title, i) => ({ n: i + 1, title })),
        [{ name: 'a.js', content: 'core billing reports payment pipeline المتحف النواة' }]);
    assert.deepEqual(d.untraceable.map((i) => i.title), rows, 'أسطرُ الجدول الأربعة');
    assert.deepEqual(d.traced.map((i) => i.title), keep, '«stage» و«جولة» مطلبان يُقاسان');
});

test('والحكمُ يقول لمَ نقص المقام: اختفاءُ ثمانيةِ بنودٍ بلا كلمةٍ ليس أصدقَ من عدّها خطأً', () => {
    const o = requirementsTraceOutcome(null, posFiles(), 'لا محقّق', specSections(SPEC));
    assert.equal(o.status, 'fail');
    assert.match(o.detail, /26 بنداً من 36/, o.detail);
    assert.match(o.detail, /8 من أسطر خطّة التسليم لا تُحسَب \(لا تُبنى\)/, o.detail);
    assert.equal(o.docTraced, 10); assert.equal(o.docTraceable, 36);
    // ووثيقةٌ بلا جدولٍ زمنيّ: لا ذيلَ زائد
    const plain = requirementsTraceOutcome(null, posFiles(), 'لا محقّق', specSections(SPEC).filter((x) => !/مرحل/.test(x.title)));
    assert.ok(!/خطّة التسليم/.test(plain.detail), plain.detail);
});
