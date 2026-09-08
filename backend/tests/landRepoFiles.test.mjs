// 📦 إنزالُ ملفّاتِ مستودعٍ ليس كتابةَ اقتراحِ نموذج — السياسةُ الخامسة في `workspacePaths`.
//
// العطبُ الذي وُلد منه هذا الملفّ، مقيساً على شجرةِ مستودع Next.js واقعيّة:
// `writePlanFiles` تُنزل ١٤ من ٢٢ وترفض ثمانية — ومنها **`.github/workflows/ci.yml`**،
// وهو بعينه **دليلُ الصيانة**: اختباراتُ المستودع هي ما يُحكَم به على أيّ تعديلٍ فيه.
// وسياستُها مكتوبةٌ بنصِّها «لأسماءٍ يقترحها مولِّدٌ أو نموذج» — وملفّاتُ مستودعٍ ليست اقتراحاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { landRepoFiles, resolveRepoFile, writePlanFiles } from '../core/runtime/workspacePaths.js';

let seq = 0;
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), `lrf${++seq}_`));
const land = (names, dir = root()) => landRepoFiles(dir, names.map((name) => ({ name, content: 'x' }))).then((r) => ({ ...r, dir }));

// شجرةُ مستودعٍ واقعيّة — هي القياسُ الذي وُلد منه البند
const REAL_TREE = [
    'package.json', 'README.md', 'next.config.js', 'tsconfig.json',
    'app/page.tsx', 'app/layout.tsx', 'components/Nav.tsx', 'lib/db.ts',
    'public/robots.txt', 'styles/globals.css', '.gitignore', '.env.example',
    '.eslintrc.json', '.prettierrc', '.nvmrc', '.editorconfig',
    '.github/workflows/ci.yml', '.github/dependabot.yml',
    '.husky/pre-commit', '.vscode/settings.json',
    'prisma/schema.prisma', 'docs/ARCHITECTURE.md',
];

test('العطبُ نفسُه: كاتبُ المولّدات يُسقط ثمانيةً من الشجرة الواقعيّة — وكاتبُ المستودع يُنزلها', async () => {
    const files = REAL_TREE.map((name) => ({ name, content: 'x' }));
    const old = await writePlanFiles(root(), files);
    assert.deepEqual(old.rejected.sort(), [
        '.editorconfig', '.eslintrc.json', '.github/dependabot.yml', '.github/workflows/ci.yml',
        '.husky/pre-commit', '.nvmrc', '.prettierrc', '.vscode/settings.json',
    ], 'الرفضُ الثمانيّ هو القياسُ الذي وُلد منه هذا الكاتب');
    const now = await landRepoFiles(root(), files);
    assert.deepEqual([now.written, now.rejected], [REAL_TREE.length, []], 'الشجرةُ كلُّها تنزل');
});

test('دليلُ الصيانة ينزل فعلاً على القرص: سيرُ العمل موجودٌ بمحتواه', async () => {
    const dir = root();
    await landRepoFiles(dir, [{ name: '.github/workflows/ci.yml', content: 'on: [push]\n' }]);
    assert.equal(fs.readFileSync(path.join(dir, '.github/workflows/ci.yml'), 'utf8'), 'on: [push]\n');
});

test('`.git/` لا ينزل أبداً — أينما وقع المقطع، لا في الجذر وحدَه', async () => {
    const r = await land(['.git/config', '.git/objects/aa', 'src/.git/HEAD', 'a/b/.git/hooks/pre-push', '.GIT/config']);
    assert.equal(r.written, 0);
    assert.equal(r.rejected.length, 5, 'الخمسةُ كلُّها مرفوضة — والمنعُ بالمقطع لا باللاحقة');
    assert.equal(fs.existsSync(path.join(r.dir, '.git')), false);
});

test('الأسرارُ لا تنزل — و`.env.example` وحدَه يمرّ (قرارُ `PROJECT_DOTFILES` نفسُه)', async () => {
    const r = await land(['.env', '.env.local', '.env.production', '.env.test', '.env.example']);
    assert.deepEqual(r.rejected, ['.env', '.env.local', '.env.production', '.env.test']);
    assert.equal(r.written, 1);
    assert.ok(fs.existsSync(path.join(r.dir, '.env.example')), 'القالبُ يقول أيَّ مفاتيحَ يحتاج المشروع — فلا يُحذف باسم الأمن');

    // 🔎 والسرُّ يُمنع **أينما وقع** لا في الجذر وحدَه: مستودعاتُ الحزم (monorepo)
    //    تضع `.env` تحت كلِّ حزمة. طفرةُ «امنعْه في الجذر فقط» نجَت أوّلَ مرّة فكشفت هذا.
    const deep = await land(['packages/api/.env', 'apps/web/.env.local', 'packages/api/.env.example']);
    assert.deepEqual(deep.rejected, ['packages/api/.env', 'apps/web/.env.local']);
    assert.equal(deep.written, 1, 'والقالبُ المتداخلُ ينزل كأخيه في الجذر');
});

test('الاحتواءُ قائمٌ كما هو: لا خروجَ بـ`..` ولا بمسارٍ مطلق — والاسمُ الفارغُ معناه لا اسم', async () => {
    const r = await land(['../escape.js', '../../x/index.html', '/etc/passwd', 'a/../../b.js', '.', '..']);
    assert.equal(r.written, 0, 'ولا واحدٌ ينزل');
    assert.equal(r.rejected.length, 6);
    for (const bad of ['../escape.js', '/etc/passwd', '.']) assert.ok(r.rejected.includes(bad));

    // 🔒 والمطلقُ يُردّ **بذاته** لا بالاحتواء: مسارٌ مطلقٌ يقع صدفةً داخلَ الجذر
    //    كان سيمرّ لو اتّكلنا على `resolveInside` وحدَه. اسمُ ملفٍّ في مستودعٍ نسبيٌّ
    //    دائماً، فالمطلقُ خبرُ عطبٍ لا اسمُ ملفّ.
    const same = root();
    const inside = await land([`${same}/looks-inside.js`], same);   // الجذرُ نفسُه، لا جذرٌ آخر
    assert.deepEqual([inside.written, inside.rejected.length], [0, 1]);
    assert.equal(fs.existsSync(path.join(same, 'looks-inside.js')), false);
    // و`./ok.js` ليس منها: التطبيعُ يُسقط المقطعَ النسبيَّ فيصير اسماً سليماً
    const good = await land(['./ok.js']);
    assert.deepEqual([good.written, good.rejected], [1, []]);
    assert.ok(fs.existsSync(path.join(good.dir, 'ok.js')));
});

test('التطبيعُ لا يفتح باباً: `a/./b.js` يُطبَّع فينزل، و`a/../../b.js` يبقى خارجاً', async () => {
    const r = await land(['a/./b.js']);
    assert.equal(r.written, 1);
    assert.ok(fs.existsSync(path.join(r.dir, 'a/b.js')));
    assert.equal(resolveRepoFile('/w/p', 'a/../../b.js'), null);
    assert.ok(String(resolveRepoFile('/w/p', 'a/../b.js')).endsWith('/w/p/b.js'), 'صعودٌ يبقى داخلَ الجذر مقبول');
});

test('الرفضُ يُحصى لا يُبتلع — والمدخلُ المعطوب يُحصى باسمه إن كان له اسم', async () => {
    const dir = root();
    const r = await landRepoFiles(dir, [
        { name: 'ok.js', content: 'a' },
        { name: 'bad.js', content: 123 },          // ليس نصّاً
        { name: '', content: 'x' },                 // بلا اسم
        null,
        { name: '.env', content: 'SECRET=1' },
    ]);
    assert.equal(r.written, 1);
    assert.deepEqual(r.rejected, ['bad.js', '.env'], 'ما له اسمٌ يُسمّى، وما لا اسمَ له يُتخطّى بلا ضجيج');
});

test('لا مدخلات: `[]` و`undefined` و`null` تعود صفراً بلا رمي', async () => {
    const dir = root();
    for (const input of [[], undefined, null]) {
        assert.deepEqual(await landRepoFiles(dir, input), { written: 0, rejected: [] });
    }
});

test('المحتوى ينزل بنصّه لا مقصوصاً، والمجلّداتُ العميقةُ تُنشأ', async () => {
    const dir = root();
    const body = 'export const x = 1;\n'.repeat(50);
    await landRepoFiles(dir, [{ name: 'src/app/deep/nested/mod.ts', content: body }]);
    assert.equal(fs.readFileSync(path.join(dir, 'src/app/deep/nested/mod.ts'), 'utf8'), body);
});

test('`resolveRepoFile` يعود بمسارٍ مطلقٍ داخلَ الجذر — أو `null` بلا رمي', () => {
    assert.equal(resolveRepoFile('/w/p', 123), null);
    assert.equal(resolveRepoFile('/w/p', '   '), null);
    assert.equal(resolveRepoFile('', 'a.js'), null);
    assert.ok(path.isAbsolute(resolveRepoFile('/w/p', '.github/workflows/ci.yml')));
});
