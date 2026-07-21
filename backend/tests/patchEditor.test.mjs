// 🩹 المحرّر الموضعي: يُعيد الجزء المتغيّر فقط (لا الملف كاملاً) — الحلّ
// الجذري للتعديل على المشاريع الكبيرة بلا بتر ولا فقدان ميزات.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEditBlocks, applyEdits, patchEditPlan } from '../agents/patchEditor.js';

test('parseEditBlocks: يحلّل كتلة بحث/استبدال مع اسم الملف', () => {
    const raw = `app.js
<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE`;
    const blocks = parseEditBlocks(raw);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].file, 'app.js');
    assert.equal(blocks[0].search, 'const x = 1;');
    assert.equal(blocks[0].replace, 'const x = 2;');
});

test('parseEditBlocks: كتل متعددة عبر ملفات + تنظيف FILE:/علامات', () => {
    const raw = `بعض الشرح
FILE: app.js
<<<<<<< SEARCH
a();
=======
a(); b();
>>>>>>> REPLACE
\`styles.css\`
<<<<<<< SEARCH
.x{color:red}
=======
.x{color:blue}
>>>>>>> REPLACE`;
    const blocks = parseEditBlocks(raw);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].file, 'app.js');
    assert.equal(blocks[1].file, 'styles.css');
});

test('applyEdits: تطابق حرفي يُطبّق ويُبقي الباقي (لا فقدان)', () => {
    const files = [{ name: 'app.js', content: 'function a(){}\nfunction financials(){ return 99; }\nfunction c(){}' }];
    const blocks = [{ file: 'app.js', search: 'function a(){}', replace: 'function a(){ log(); }' }];
    const { files: out, applied, failed } = applyEdits(files, blocks);
    assert.equal(applied, 1);
    assert.equal(failed.length, 0);
    assert.match(out[0].content, /function a\(\)\{ log\(\); \}/);
    assert.match(out[0].content, /function financials/, 'الميزة الأخرى محفوظة (لم تُلمس)');
});

test('applyEdits: إضافة عبر سطر مرجعي (financials تبقى + جديد يُضاف)', () => {
    const files = [{ name: 'app.js', content: 'function financials(){}\n// END' }];
    const blocks = [{ file: 'app.js', search: '// END', replace: 'function payouts(){}\n// END' }];
    const { files: out, applied } = applyEdits(files, blocks);
    assert.equal(applied, 1);
    assert.match(out[0].content, /function financials/, 'القديم باقٍ');
    assert.match(out[0].content, /function payouts/, 'الجديد أُضيف');
});

test('applyEdits: تطابق مع فرق مسافة بادئة (تسامح)', () => {
    const files = [{ name: 'app.js', content: '  const y = 1;\n  return y;' }];
    const blocks = [{ file: 'app.js', search: 'const y = 1;', replace: 'const y = 42;' }];
    const { applied, files: out } = applyEdits(files, blocks);
    assert.equal(applied, 1);
    assert.match(out[0].content, /y = 42/);
});

test('applyEdits: بحث غير موجود → failed (لا يُطبّق شيئاً خطأً)', () => {
    const files = [{ name: 'app.js', content: 'const a=1;' }];
    const { applied, failed } = applyEdits(files, [{ file: 'app.js', search: 'const zzz=9;', replace: 'x' }]);
    assert.equal(applied, 0);
    assert.equal(failed.length, 1);
});

test('applyEdits: $ في البديل لا يُفسَّر كمرجع regex', () => {
    const files = [{ name: 'app.js', content: 'const price = 0;' }];
    const { files: out } = applyEdits(files, [{ file: 'app.js', search: 'const price = 0;', replace: 'const price = "$5.00";' }]);
    assert.match(out[0].content, /\$5\.00/);
});

test('patchEditPlan: chat مُحقَن → يطبّق ويُرجع الملف المتغيّر فقط', async () => {
    const fakeChat = async () => `app.js
<<<<<<< SEARCH
const v = 1;
=======
const v = 2;
>>>>>>> REPLACE`;
    const r = await patchEditPlan('غيّر v إلى 2',
        [{ name: 'app.js', content: 'const v = 1;\nfunction keep(){}' }, { name: 'styles.css', content: 'body{}' }],
        'ar', { chat: fakeChat });
    assert.equal(r.ok, true);
    assert.equal(r.applied, 1);
    assert.equal(r.files.length, 1, 'فقط الملف المتغيّر يُرجَع');
    assert.equal(r.files[0].name, 'app.js');
    assert.match(r.files[0].content, /const v = 2/);
    assert.match(r.files[0].content, /function keep/, 'الباقي محفوظ');
});

test('patchEditPlan: مخرَج بلا كتل → ok=false (يسقط للمسار الكامل)', async () => {
    const r = await patchEditPlan('x', [{ name: 'app.js', content: 'a' }], 'ar', { chat: async () => 'لا كتل هنا' });
    assert.equal(r.ok, false);
    assert.equal(r.applied, 0);
});
