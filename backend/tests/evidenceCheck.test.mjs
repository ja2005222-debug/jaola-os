// 🔍 وحدة الدليل: الفرق بين «عطب» و«تحذير» يجب ألّا يُمحى عند أي حدّ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, fail, warn, pass, failures, warnings, passed, renderCritique, STATUS } from '../core/evidence/Check.js';
import { qaVerify } from '../agents/qaAgent.js';
import { architectReview } from '../agents/architectAgent.js';

const html = (extra = '') => `<!DOCTYPE html><html><head>${extra}</head><body><section></section><section></section><section></section>${'ب'.repeat(600)}</body></html>`;
const goodCss = '@media(min-width:1px){a{color:red}}' + '/*' + 'x'.repeat(320) + '*/';

test('الشكل مطابق لما ينتجه behaviorVerifier — لا عقد ثانٍ', () => {
    assert.deepEqual(check('n', STATUS.FAIL, 'd'), { name: 'n', status: 'fail', detail: 'd' });
    assert.deepEqual(fail('a', 'x'), { name: 'a', status: 'fail', detail: 'x' });
    assert.deepEqual(warn('b', 'y'), { name: 'b', status: 'warn', detail: 'y' });
    assert.deepEqual(pass('c', 'z'), { name: 'c', status: 'pass', detail: 'z' });
});

test('التحذير لا يُسقط، والعطب وحده يُسقط', () => {
    assert.equal(passed([warn('a', 'x'), pass('b', 'y')]), true);
    assert.equal(passed([warn('a', 'x'), fail('b', 'y')]), false);
    assert.equal(passed([]), true, 'بلا فحوص = لا عطب');
    assert.equal(passed(null), true);
    assert.equal(failures([fail('a', '1'), warn('b', '2'), pass('c', '3')]).length, 1);
    assert.equal(warnings([fail('a', '1'), warn('b', '2'), pass('c', '3')]).length, 1);
});

test('النقد يوسم الأعطاب ويقدّمها — النموذج كان يرى قائمة مسطّحة', () => {
    const out = renderCritique([warn('w', 'تحذير'), fail('f', 'عطب')]);
    assert.ok(out.indexOf('❌ عطب') < out.indexOf('⚠️ تحذير'), 'العطب أولاً');
    assert.equal(renderCritique([pass('p', 'تمام')]), '', 'الناجح ليس نقداً');
});

test('🐛 qaVerify: التحذيرات لم تعد تُخلط بالأعطاب في الدليل', () => {
    // فشل صلب واحد (أقواس) + ثلاثة تحذيرات (viewport/title/footer)
    const r = qaVerify({ files: [
        { name: 'index.html', content: html('') },
        { name: 'style.css', content: goodCss },
        { name: 'script.js', content: 'function a(){' },
    ] });
    assert.equal(r.passed, false);
    const f = failures(r.checks);
    assert.equal(f.length, 1, 'عطب واحد فقط');
    assert.equal(f[0].name, 'unbalanced-braces');
    assert.ok(warnings(r.checks).length >= 3, 'والتحذيرات باقية موسومة');
    // العقد القديم مطابق حرفياً: logs تحوي الأعطاب ثم التحذيرات
    assert.equal(r.logs[0], f[0].detail);
    assert.equal(r.logs.length, f.length + warnings(r.checks).length);
});

test('qaVerify: النجاح مع تحذيرات يبقى نجاحاً، ونصّه كما كان', () => {
    const clean = qaVerify({ files: [
        { name: 'index.html', content: html('<meta name="viewport" content="w"><title>ت</title>') + '<header></header><footer></footer>' },
        { name: 'style.css', content: goodCss },
    ] });
    assert.equal(clean.passed, true);
    assert.equal(failures(clean.checks).length, 0);
    // بلا تحذيرات إطلاقاً → الرسالة الافتراضية القديمة بحرفها
    const spotless = qaVerify({ files: [] });
    assert.deepEqual(spotless.logs, ['جميع فحوصات الاكتمال والجودة مرت بنجاح.']);
    assert.equal(spotless.passed, true);
});

test('🐛 architectReview: كل المشاكل في جولة واحدة لا واحدة كل جولة', () => {
    const r = architectReview({ files: [{ name: 'index.html', content: '<html>ب</html>' }] });
    assert.equal(r.approved, false);
    assert.deepEqual(r.checks.map(c => c.name), ['html-missing', 'css-missing', 'html-thin']);
    // العقد القديم: نفس النصّ الأول حرفياً
    assert.equal(r.feedback, 'يفتقر القالب لملف HTML أساسي.');
});

test('architectReview: الخطة السليمة والتالفة — العقد القديم بحرفه', () => {
    const ok = architectReview({ files: [
        { name: 'index.html', content: 'x'.repeat(250) },
        { name: 'style.css', content: 'y'.repeat(60) },
    ] });
    assert.equal(ok.approved, true);
    assert.equal(ok.feedback, 'تمت مطابقة معايير البنية بنجاح.');
    assert.deepEqual(ok.checks, []);

    const broken = architectReview(null);
    assert.equal(broken.approved, false);
    assert.equal(broken.feedback, 'خطة الملفات تالفة أو غير مكتملة البنية.');
    assert.equal(broken.checks.length, 1);
});
