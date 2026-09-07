// 🧹 PM/18 — «كلماتُ الإطار تُطبَّع كما تُطبَّع مفرداتُ البند»: `traceSections` (PM/9) يشتقّ مفرداتِ عنوان البند
// بـ`normalizeConceptText` — الذي يقلب `ى` إلى `ي` و`ة` إلى `ه` — ثمّ يقارنها بقائمة إطارٍ مكتوبةٍ **خاماً**.
// فأربعُ كلماتٍ في القائمة لا تُطابَق أبداً: «على»→«علي»، «الى»→«الي»، «حتى»→«حتي» (و«امكانية»→«امكانيه»
// نجت لأنّ لها توأماً مكتوباً في القائمة).
//
// و«على» حرفُ جرٍّ يظهر في **أيّ** صفحةٍ عربيّة. فقِيس: بندُ «٨ الصلاحيات والأدوار» في وثيقة مكتبةٍ حقيقيّة
// يُعلَن «له أثر» — وأثرُه كلمةُ «على» وحدَها. أثرٌ زائفٌ يقرؤه المستخدمُ في حكم منتجه.
// المبدأُ نفسُه الذي أخرج التنسيقَ من قراءة المفاهيم (PM/14): البوّابةُ لا تُصدّق ما ليس لغةَ المنتج.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceSections, sectionLabel } from '../agents/requirementsVerifier.js';
import { normalizeConceptText } from '../agents/projectModel.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// صفحةٌ عربيّةٌ عاديّة: حروفُ الجرّ فيها كما في أيّ نصّ، ولا ذكرَ لصلاحياتٍ ولا أدوار
const PAGE = [{
    name: 'index.html',
    content: `<!DOCTYPE html><html lang="ar"><body><h1>مكتبة المدينة</h1>
<p>تعرّف على خدماتنا، واطّلع على الجديد حتى نهاية الشهر.</p>
<p>أضفنا الكتب إلى الفهرس.</p></body></html>`,
}];

test('حرفُ الجرّ لا يُثبت أثراً: بندٌ لا تذكره الصفحةُ يبقى بلا أثر', () => {
    const secs = [{ n: 8, title: 'الصلاحيات والأدوار: صلاحيات على كل عملية', body: '' }];
    const d = traceSections(secs, PAGE);
    assert.equal(d.traced.length, 0, `«له أثر» زوراً: ${d.traced.map(sectionLabel).join('، ')}`);
    assert.equal(d.missing.length, 1);
});

test('كلُّ كلمةِ إطارٍ في القائمة تنجو من التطبيع — وإلّا فهي ميّتة', () => {
    // العنوانُ كلُّه كلماتُ إطار: لا مفردةَ صالحة → لا يُتتبَّع (لا «له أثر» ولا «بلا أثر»)
    for (const framing of ['على كل من', 'إلى ذلك أيضا', 'حتى يجب أن']) {
        const d = traceSections([{ n: 1, title: framing, body: '' }], PAGE);
        assert.equal(d.untraceable.length, 1, `«${framing}»: ${JSON.stringify(d)}`);
    }
});

test('والمفردةُ الحقيقيّة ما زالت تُتتبَّع — لم يُوسَّع الإسكاتُ على حساب الصدق', () => {
    const d = traceSections([{ n: 2, title: 'الكتب: فهرس على مستوى المكتبة', body: '' }], PAGE);
    assert.equal(d.traced.length, 1, JSON.stringify(d));
    const gone = traceSections([{ n: 3, title: 'الغرامات: احتساب على التأخير', body: '' }], PAGE);
    assert.equal(gone.missing.length, 1, 'بندٌ لا تذكره الصفحةُ يبقى بلا أثر');
});

test('والحدُّ الأدنى ثلاثةُ أحرف: كلمةٌ من حرفَين لا تُثبت أثراً ولو لم تكن في القائمة', () => {
    // «ما» ليست في قائمة الإطار، وتظهر في أيّ نصٍّ عربيّ — الحدُّ هو ما يمنعها، لا القائمة
    const d = traceSections([{ n: 9, title: 'ما يجب أن يكون', body: '' }], [{
        name: 'index.html', content: '<p>هذا ما نقدّمه لكم</p>',
    }]);
    assert.equal(d.traced.length, 0, `«له أثر» بحرفَين: ${d.traced.map(sectionLabel).join('، ')}`);
});

test('حدُّ المصدر: القائمةُ تُطبَّع مرّةً، فأيُّ إملاءٍ فيها يعمل', () => {
    // «على» و«علي» و«عَلى» كلُّها صورةٌ واحدة بعد التطبيع — فلا يهمّ كيف كُتبت في القائمة
    for (const spelling of ['على', 'علي']) assert.equal(normalizeConceptText(spelling), 'علي');
});
