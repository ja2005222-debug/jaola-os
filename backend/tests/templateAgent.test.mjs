// 📥 وكيلُ القالب — يكتب أوّلَ ملفَّين في مشروع المستخدم (`styles.css`
// و`index.html`) على المجلد الفارغ، ثمّ يُغذّي الهويةَ البصرية للمبرمج.
// يكتبُ في مشروعِ مستخدمٍ حقيقيّ، وقاعدةُ الدهس فيه غيرُ بديهيّة: يستبدل
// `styles.css` القائمَ إن كان أقصرَ من ٥٠ محرفاً. كان بلا تغطية.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { applyTemplate } from '../agents/template.agent.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tmpl-'));
const read = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');

test('مجلدٌ فارغ: يُكتب الملفّان ويُعاد النوعُ ومصدرُه', async () => {
    const dir = tmp();
    const r = await applyTemplate('موقع مطعم', dir, 'restaurant');
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.template, 'restaurant');
    assert.strictEqual(r.source, 'knowledge-engine');
    assert.ok(fs.existsSync(path.join(dir, 'styles.css')));
    assert.ok(fs.existsSync(path.join(dir, 'index.html')));
});

// 🔑 الحارسُ المشتقّ: كلُّ متغيّرٍ يستعمله القالبُ معرَّفٌ في الملفّ نفسِه.
// مشتقٌّ من النصّ المكتوب لا من قائمةٍ بيدي، فلا يشيخ حين تتغيّر القاعدة.
test('لا يُستعمل متغيّرٌ لم يُعرَّف — الأساسُ يُحلّ كاملاً', async () => {
    for (const type of ['restaurant', 'clinic', 'business']) {
        const dir = tmp();
        await applyTemplate('هدف', dir, type);
        const css = read(dir, 'styles.css');
        const used = [...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]);
        assert.ok(used.length > 0, `لا متغيّراتٍ مستعملة أصلاً (${type})`);
        for (const v of new Set(used)) {
            assert.ok(new RegExp(`${v}\\s*:`).test(css), `${type}: يُستعمل ${v} ولا يُعرَّف`);
        }
    }
});

test('ملفُّ أنماطٍ قائمٌ ذو محتوى لا يُدهَس', async () => {
    const dir = tmp();
    const mine = '/* أنماطي أنا */\n' + '.a { color: red; }\n'.repeat(5);
    fs.writeFileSync(path.join(dir, 'styles.css'), mine);
    await applyTemplate('هدف', dir, 'business');
    assert.strictEqual(read(dir, 'styles.css'), mine, 'دُهس عملُ المستخدم');
});

test('ملفُّ أنماطٍ شبهُ فارغ يُستبدَل (القاعدة: أقصرُ من ٥٠ محرفاً)', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'styles.css'), '/* فارغ */');
    await applyTemplate('هدف', dir, 'business');
    assert.ok(read(dir, 'styles.css').includes(':root'), 'لم يُستبدَل الفارغ');
});

test('index.html قائمٌ لا يُدهَس أبداً — ولو كان فارغاً', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'index.html'), '');
    await applyTemplate('هدف', dir, 'business');
    assert.strictEqual(read(dir, 'index.html'), '', 'دُهست صفحةُ المستخدم');
});

test('السياقُ الراجع يحمل ما يقرؤه jcr فعلاً', async () => {
    const dir = tmp();
    const r = await applyTemplate('عيادة أسنان', dir, 'clinic');
    assert.ok(r.context.visualGuide, 'الهويةُ البصرية تُغذّي mentalModel.visualIdentity');
    assert.ok(Array.isArray(r.context.sections) && r.context.sections.length,
        'الأقسامُ تُغذّي mentalModel.templateSections');
    assert.ok(r.context.colorScheme.includes(':root'));
});

test('مسارٌ لا يُكتب فيه: يُقال الفشلُ ولا يُرمى', async () => {
    const r = await applyTemplate('هدف', path.join(tmp(), 'لا', 'يوجد'), 'business');
    assert.strictEqual(r.success, false, 'ادُّعي نجاحٌ على مسارٍ غير موجود');
    assert.ok(r.error, 'فشلٌ بلا سبب');
});
