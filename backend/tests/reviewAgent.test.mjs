import test from 'node:test';
import assert from 'node:assert/strict';
import { runStaticReview, autoFix, reviewCode } from '../agents/reviewAgent.js';

const html = (body, attrs = 'dir="rtl" lang="ar"') =>
    `<!DOCTYPE html><html ${attrs}><head><meta charset="UTF-8"><meta name="viewport" content="w"><title>م</title></head><body>${body}</body></html>`;

// ═══════════════════════════════════════════════════════
// العدُّ من العمل نفسه، لا من تنبّؤٍ بسلوك دالّةٍ أخرى
// ═══════════════════════════════════════════════════════

test('إصلاحٌ وقع يُعَدّ — ولو لم يكن من الأنواع الثلاثة القديمة', () => {
    const files = [{ name: 'index.html', content: html('<img src="a.png"><img src="b.png">') }];
    const { files: out, fixes } = autoFix(files, 'ar');
    assert.equal(fixes.length, 2, `عُدَّ ${fixes.length} والمُصلَح صورتان`);
    assert.ok(fixes.every((f) => f.type === 'accessibility'));
    assert.notEqual(out[0].content, files[0].content, 'أُعلن إصلاحٌ ولم يتغيّر الملف');
});

test('امتناعٌ عن الإصلاح لا يُعَدّ إصلاحاً', () => {
    // صفحةٌ سليمةٌ تماماً — لا شيء يُصلَح
    const files = [{ name: 'index.html', content: html('<img src="a.png" alt="ص">') }];
    const { files: out, fixes } = autoFix(files, 'ar');
    assert.deepEqual(fixes, []);
    assert.equal(out[0], files[0], 'أُعيد كائنٌ جديدٌ بلا تغيير');
});

test('console.log الزائدة تُعَدّ بعدد ما حُذف', () => {
    const files = [{ name: 'script.js', content: 'console.log(1);\nconsole.log(2);\nconsole.log(3);\nconsole.log(4);\nconsole.log(5);\n' }];
    const { files: out, fixes } = autoFix(files, 'ar');
    assert.equal(fixes.length, 2, 'حُذف اثنان (ما فوق الثلاثة)');
    assert.equal((out[0].content.match(/console\.log/g) || []).length, 3);
});

test('reviewCode يبلّغ fixedCount من الإصلاحات الواقعة', async () => {
    const r = await reviewCode([{ name: 'index.html', content: html('<img src="a.png">') }], 'هدف', 'ar');
    assert.equal(r.fixedCount, 1);
    assert.deepEqual(r.fixes.map((f) => f.type), ['accessibility']);
    assert.notEqual(r.fixedFiles[0].content.includes('alt='), false);
});

test('صفحةٌ سليمة: fixedCount صفر فلا تُكتب', async () => {
    const r = await reviewCode([{ name: 'index.html', content: html('<img src="a.png" alt="ص">') }], 'هدف', 'ar');
    assert.equal(r.fixedCount, 0);
});

test('runStaticReview لم يعد يتنبّأ بسلوك autoFix', () => {
    const r = runStaticReview([{ name: 'index.html', content: html('') }], 'ar');
    assert.equal(r.fixable, undefined, 'عاد التنبّؤ بسلوك دالّةٍ أخرى');
    assert.ok(Array.isArray(r.issues));
});

// ═══════════════════════════════════════════════════════
// الاتجاه واللغة: كلُّ سمةٍ على حِدة
// ═══════════════════════════════════════════════════════

test('lang موجودٌ وdir مفقود → يُضاف dir (كان يُمتنع)', () => {
    const { files, fixes } = autoFix([{ name: 'index.html', content: '<html lang="ar"><head></head></html>' }], 'ar');
    assert.match(files[0].content, /<html[^>]*\bdir="rtl"/);
    assert.match(files[0].content, /\blang="ar"/);
    assert.ok(fixes.some((f) => f.type === 'rtl'));
});

test('dir موجودٌ وlang مفقود → يُضاف lang وحده', () => {
    const { files } = autoFix([{ name: 'index.html', content: '<html dir="rtl"><head></head></html>' }], 'ar');
    assert.equal((files[0].content.match(/\bdir=/g) || []).length, 1, 'كُرِّرت dir');
    assert.match(files[0].content, /\blang="ar"/);
});

test('كلتاهما موجودتان → لا تُمَسّان', () => {
    const src = '<html dir="ltr" lang="fr"><head></head></html>';
    const { files } = autoFix([{ name: 'index.html', content: src }], 'ar');
    assert.match(files[0].content, /dir="ltr" lang="fr"/, 'دِيسَ اختيارُ المولّد');
});

// ═══════════════════════════════════════════════════════
// إضافةُ alt لا تُفسد الوسم المُغلَق ذاتياً
// ═══════════════════════════════════════════════════════

test('الشرطةُ المُغلِقة تبقى في محلّها', () => {
    for (const [src, want] of [
        ['<img src="a.png">', '<img src="a.png" alt="صورة">'],
        ['<img src="a.png"/>', '<img src="a.png" alt="صورة"/>'],
        ['<img src="a.png" />', '<img src="a.png" alt="صورة" />'],
    ]) {
        const { files } = autoFix([{ name: 'index.html', content: src }], 'ar');
        assert.equal(files[0].content, want);
    }
});

test('صورةٌ لها alt لا تُمَسّ', () => {
    const src = '<img alt="س" src="a.png">';
    const { files, fixes } = autoFix([{ name: 'index.html', content: src }], 'ar');
    assert.equal(files[0].content, src);
    assert.deepEqual(fixes, []);
});
