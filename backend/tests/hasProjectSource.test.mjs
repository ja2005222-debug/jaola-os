// 🏗️ «أثمّة مشروعٌ هنا؟» سؤالُ وجودٍ يُسأل للقرص، لا يُشتقّ من قارئ محتوىً بقائمةِ أسماءٍ مغلقة.
//
// العطبُ الذي وُلد منه هذا الملفّ، مقيساً: `readCodeContext` يفلتر بثلاثة أسماء
// (`index.html`/`styles.css`/`script.js`)، فمستودعٌ بسبعةِ ملفّات PHP حقيقيّة يُقرأ **صفرَ حرف**،
// فيصير `isFreshBuild = true` — وهو الشرطُ الذي **يُجيز الاستبدالَ الكامل**. مشروعٌ عامرٌ يُدهَس صامتاً.
//
// وما **لا** يتغيّر: العتبة. صفحةُ `<h1>x</h1>` ركامُ بناءٍ فاشل لا منتجٌ يُخشى دهسُه —
// ولو عُدَّت مشروعاً قائماً لامتنع مسارُ React عنها إلى الأبد. فالسقوطُ على القائمة وحدَها.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readCodeContext, hasProjectSource } from '../agents/projectReader.js';

let seq = 0;
const mk = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `hps${++seq}_`));
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    return dir;
};
const php = (n) => '<?php\n' + '// سطرُ مصدرٍ حقيقيّ\n'.repeat(n);

test('العطبُ نفسُه: مستودعُ Laravel بسبعةِ ملفّات — القارئُ صفرٌ، والوجودُ حقّ', async () => {
    const dir = mk({
        'app/Http/Controllers/HomeController.php': php(6),
        'app/User.php': php(4),
        'routes/web.php': php(5),
        'composer.json': '{"name":"x/y"}\n',
        'artisan': php(3),
        'README.md': '# مشروع\n'.repeat(4),
        '.env.example': 'APP_KEY=\n',
    });
    assert.equal((await readCodeContext(dir)).trim().length, 0, 'القارئُ القائم يراه فارغاً — هذا هو العطب');
    assert.equal(await hasProjectSource(dir), true, 'والقرصُ يقول: ثمّة مشروع');
});

test('مفتوحٌ على الأسماء والامتدادات: لا قائمةَ ثلاثةٍ ولا قائمةَ امتدادات', async () => {
    for (const name of ['main.js', 'app.py', 'Program.cs', 'lib/content.js', 'ما-لا-امتدادَ-له']) {
        const dir = mk({ [name]: 'x'.repeat(400) });
        assert.equal(await hasProjectSource(dir), true, `${name} دليلُ وجود`);
    }
});

test('العتبةُ تبقى: ركامُ صفحةٍ قزمة ما يزال بناءً جديداً — والعتبةُ تُمرَّر من موضع النداء', async () => {
    const stub = mk({ 'index.html': '<h1>x</h1>' });                       // ١٠ بايتات
    assert.equal(await hasProjectSource(stub, { minBytes: 80 }), false, 'دون الثمانين → بناءٌ جديد كما كان');
    assert.equal(await hasProjectSource(stub, { minBytes: 100 }), false);
    assert.equal(await hasProjectSource(stub, { minBytes: 5 }), true, 'العتبةُ هي الفاصل، لا اسمُ الملفّ');
    const mid = mk({ 'index.html': 'z'.repeat(90) });                      // بين العتبتَين
    assert.deepEqual(
        [await hasProjectSource(mid, { minBytes: 80 }), await hasProjectSource(mid, { minBytes: 100 })],
        [true, false],
        'العتبتان المختلفتان (٨٠ و١٠٠) تبقيان كما كانتا في موضعَيهما — لا توحيدَ خلسة',
    );
});

test('العتبةُ الافتراضيّةُ ثمانون لا صفر: نداءٌ عارٍ لا يعني «أيُّ بايتٍ مشروع»', async () => {
    // الموضعان الحيّان يمرّران عتبتَيهما (٨٠ و١٠٠)، فالافتراضُ لا يُمارَس إنتاجاً اليوم —
    // ولذلك يُثبَّت هنا: صفراً كان سيعيدُ العطبَ الذي فُتح له هذا البند من الجهة الأخرى،
    // فيصير ركامُ `<h1>x</h1>` مشروعاً قائماً يمتنع عنه مسارُ React أبداً.
    const stub = mk({ 'index.html': '<h1>x</h1>' });
    assert.equal(await hasProjectSource(stub), false, 'عارياً: عشرةُ بايتات دون الافتراض');
    const just = mk({ 'index.html': 'z'.repeat(81) });
    assert.equal(await hasProjectSource(just), true, 'وواحدٌ فوق الثمانين يكفي');
    assert.equal(await hasProjectSource(mk({ 'index.html': 'z'.repeat(80) })), false, 'وثمانون بالضبط ليست فوقها');
});

test('الضجيجُ ليس مشروعاً: node_modules والمخفيّ والثنائيّات لا تُعدّ دليلاً', async () => {
    assert.equal(await hasProjectSource(mk({ 'node_modules/pkg/index.js': 'x'.repeat(9000) })), false);
    assert.equal(await hasProjectSource(mk({ '.git/objects/aa': 'x'.repeat(9000) })), false);
    assert.equal(await hasProjectSource(mk({ 'vendor/lib.php': php(80) })), false);
    assert.equal(await hasProjectSource(mk({ 'dist/bundle.js': 'x'.repeat(9000) })), false);
    assert.equal(await hasProjectSource(mk({ 'logo.png': 'x'.repeat(9000), 'hero.jpg': 'y'.repeat(9000) })), false,
        'صورٌ وحدَها ليست مصدراً');
    assert.equal(await hasProjectSource(mk({ 'logo.png': 'x'.repeat(9000), 'app.js': 'y'.repeat(200) })), true,
        'وصورةٌ بجانب مصدرٍ لا تحجب المصدر');
});

test('العميقُ يُرى: مصدرٌ في مجلّدٍ متداخل دليلُ وجود', async () => {
    assert.equal(await hasProjectSource(mk({ 'src/app/pages/home/view.jsx': 'x'.repeat(300) })), true);
});

test('لا يرمي: مسارٌ غائب أو فارغ → false لا استثناء (كالقارئ القائم)', async () => {
    assert.equal(await hasProjectSource(path.join(mk({}), 'nope')), false);
    assert.equal(await hasProjectSource(mk({})), false);
    assert.equal(await hasProjectSource(mk({ 'sub/x/.keep': '' })), false, 'مجلّداتٌ فارغةٌ ليست مصدراً');
});

test('الميزانيّةُ تحدّه: مستودعٌ ضخمٌ لا يُمشى كلُّه — ويخرج عند أوّل ما يكفي', async () => {
    const many = {};
    for (let i = 0; i < 60; i += 1) many[`assets/img${i}.png`] = 'x'.repeat(9000);
    many['zz-last/main.js'] = 'y'.repeat(500);
    assert.equal(await hasProjectSource(mk(many), { budget: 10 }), false, 'الميزانيّةُ الضيّقة تقطع المشي');
    assert.equal(await hasProjectSource(mk(many)), true, 'وبالميزانيّة الافتراضيّة يُبلَغ المصدرُ العميق');
});

test('يُقاس بالحجم لا بالقراءة: ملفٌّ واحدٌ ضخمٌ يكفي، وملفّاتٌ قزمةٌ تتراكم', async () => {
    assert.equal(await hasProjectSource(mk({ 'a.js': 'x'.repeat(5000) })), true);
    const crumbs = {};
    for (let i = 0; i < 12; i += 1) crumbs[`c${i}.js`] = 'xxxxxxxxxx';   // ١٠ لكلٍّ، ١٢٠ جملةً
    assert.equal(await hasProjectSource(mk(crumbs), { minBytes: 80 }), true, 'المجموعُ يتجاوز العتبة');
    assert.equal(await hasProjectSource(mk(crumbs), { minBytes: 500 }), false);
});
