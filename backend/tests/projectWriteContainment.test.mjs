// 🛡️ احتواءُ كتابةِ ملفّات المشروع — سياسةٌ كانت في موضعٍ من عشرين
//
// `jcr.js` يكتب ملفّات المشروع في **عشرين موضعاً**. واحدٌ منها فقط
// (`writePlanFiles`) كان يطهّر الاسم ويتحقّق من الاحتواء؛ والتسعةَ عشرَ
// الباقية تكتب `path.join(root, f.name)` مباشرةً.
//
// وأخطرُها **مسارُ التعديل**: أسماءُ ملفّاته من **مخرجات النموذج**، ويمرّ
// بـ`guardFiles`/`ensureEditIntegrity` — وكلاهما يفحص **المحتوى** لا الاسم.
// فاسمٌ مثل `../../<مستخدمٍ آخر>/index.html` كان يخرج من مشروع صاحبه.
//
// 🔴 والفخُّ الذي كاد يوقعني: سياسةُ `writePlanFiles` كانت ترفض **كلَّ** اسمٍ
//    منقوط بحجّة «لن تُخدَّم أصلاً». وهي حجّةُ **خدمةٍ** لا حجّةُ **كتابة**؛
//    وأربعةُ مولّدات تُخرج `.env.example` و`.gitignore`. فلو عمّمتُها كما هي
//    لحذفتُ `.env.example` من كلّ مشروعٍ صامتاً — واختبارُ خطّ الأنابيب
//    (`jcrRuntimePipeline`) يؤكّد وجودَه على القرص.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { resolveProjectFile, PROJECT_DOTFILES } from '../core/runtime/workspacePaths.js';

divertConsoleToStderr();

const ROOT = path.join(os.tmpdir(), 'jaola-root', 'user', 'proj');

test('الأسماءُ العدائيّة تُرفض — لا كتابةَ خارج جذر المشروع', () => {
    const hostile = [
        '../../other-user/index.html',
        '../sibling/x.js',
        'a/b/../../../../etc/passwd',
        '/etc/passwd',
        '/absolute.html',
        './../escape.html',
    ];
    for (const name of hostile) {
        assert.equal(resolveProjectFile(ROOT, name), null, `اسمٌ عدائيٌّ مرّ: ${name}`);
    }
});

test('الأسماءُ المشروعة تمرّ — بما فيها المتداخلة', () => {
    for (const name of ['index.html', 'css/styles.css', 'api/auth.js', 'a/b/c/d.js']) {
        const r = resolveProjectFile(ROOT, name);
        assert.ok(r && r.startsWith(ROOT + path.sep), `اسمٌ مشروعٌ رُفض: ${name}`);
    }
});

test('الملفّاتُ المنقوطةُ المشروعةُ لا تسقط — وغيرُها يسقط', () => {
    for (const d of PROJECT_DOTFILES) {
        assert.ok(resolveProjectFile(ROOT, d), `\`${d}\` رُفض — وأربعةُ مولّدات تُخرجه`);
        assert.ok(resolveProjectFile(ROOT, `api/${d}`), `\`api/${d}\` رُفض`);
    }
    for (const bad of ['.env', '.secret', '.ssh/id_rsa', '.git/config', '.github/workflows/x.yml']) {
        assert.equal(resolveProjectFile(ROOT, bad), null, `منقوطٌ غيرُ مسموحٍ مرّ: ${bad}`);
    }
    // 🔒 `.env` تحديداً: فيه السرُّ، و`.env.example` وحده هو القالب.
    assert.equal(resolveProjectFile(ROOT, '.env'), null, '`.env` يجب ألّا يُكتب أبداً');
});

test('القائمةُ واحدةٌ فعلاً — والنسختان القديمتان تتبعانها', () => {
    const fm = fs.readFileSync(path.join(process.cwd(), 'agents/fileManager.js'), 'utf8');
    const pb = fs.readFileSync(path.join(process.cwd(), 'services/projectBrain.js'), 'utf8');
    assert.match(fm, /PROJECT_DOTFILES/, '`fileManager` عاد إلى نسخةٍ خاصّة');
    assert.match(pb, /PROJECT_DOTFILES/, '`projectBrain` عاد إلى نسخةٍ خاصّة');
    assert.doesNotMatch(pb, /e\.name !== '\.env\.example'/, 'عادت القائمةُ المنقوصة إلى `projectBrain`');
});

test('لا موضعَ في `jcr.js` يكتب بمسارٍ غيرِ محتوى', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'agents/jcr.js'), 'utf8');
    const raw = [...src.matchAll(/writeFile\(\s*path\.join\([^)]*\.name\s*\)/g)];
    assert.deepEqual(raw.map((m) => m[0]), [], 'عاد موضعٌ يكتب بـ`path.join(root, x.name)` بلا احتواء');
    assert.match(src, /async function writeProjectFile\(/, 'الكاتبُ المحتوى اختفى');
});

test('الكاتبُ المحتوى يكتب فعلاً ما يقبله، ويرفض ما يرفضه', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-write-'));
    try {
        const ok = resolveProjectFile(dir, 'nested/deep/page.html');
        fs.mkdirSync(path.dirname(ok), { recursive: true });
        fs.writeFileSync(ok, 'x');
        assert.ok(fs.existsSync(path.join(dir, 'nested', 'deep', 'page.html')));
        assert.equal(resolveProjectFile(dir, '../outside.html'), null);
        assert.ok(!fs.existsSync(path.join(path.dirname(dir), 'outside.html')), 'كُتب خارج الجذر');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
