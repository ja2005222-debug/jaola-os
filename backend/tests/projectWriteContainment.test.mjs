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

test('لا موضعَ في `jcr.js` ولا في مراحله يكتب بمسارٍ غيرِ محتوى', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'agents/jcr.js'), 'utf8');
    const rawIn = (text) => [...text.matchAll(/writeFile\(\s*path\.join\([^)]*\.name\s*\)/g)].map((m) => m[0]);
    assert.deepEqual(rawIn(src), [], 'عاد موضعٌ يكتب بـ`path.join(root, x.name)` بلا احتواء');
    // JCR/7: الكاتبُ المحتوى صار في `core/runtime/workspacePaths.js`. ثمّ خرجت المواضعُ العشرون كلُّها مع مراحلها
    // (JCR/10–23؛ آخرُها إضافةُ الصفحة في JCR/23) — فلم يبقَ في jcr كاتبُ ملفّاتِ مشروعٍ أصلاً، وكتابتُه الوحيدة
    // ذاكرتُه التنفيذيّة لا ملفُّ مستخدم. الحارسُ يتبع الكتابةَ إلى بيتها الجديد: كلُّ مرحلةٍ تكتب باسمٍ متغيّر تمرّ بالكاتب المحتوى.
    assert.doesNotMatch(src, /\bwriteProjectFile\b/, 'عاد كاتبُ ملفّاتٍ إلى jcr — الكتابةُ في المراحل');
    assert.deepEqual([...src.matchAll(/writeFile\w*\(/g)].length, 1, 'كتابةٌ واحدة في jcr: ذاكرتُه التنفيذيّة');
    const stagesDir = path.join(process.cwd(), 'agents/stages');
    const writers = [];
    for (const f of fs.readdirSync(stagesDir).filter((n) => n.endsWith('.js'))) {
        const st = fs.readFileSync(path.join(stagesDir, f), 'utf8');
        assert.deepEqual(rawIn(st), [], `stages/${f}: موضعٌ يكتب بـpath.join(root, x.name) بلا احتواء`);
        if (/\bwriteProjectFile\(/.test(st)) {
            assert.match(st, /\bwriteProjectFile\b[^\n]*from '\.\.\/\.\.\/core\/runtime\/workspacePaths\.js'/, `stages/${f}: الكاتبُ المحتوى ليس من بيته`);
            writers.push(f);
        }
    }
    assert.ok(writers.length >= 10, `عشرُ مراحلَ على الأقلّ تكتب عبر الكاتب المحتوى — وُجد ${writers.length}`);
    const wp = fs.readFileSync(path.join(process.cwd(), 'core/runtime/workspacePaths.js'), 'utf8');
    assert.match(wp, /export async function writeProjectFile\(/, 'الكاتبُ المحتوى اختفى من بيته');
});

test('القائمةُ تشمل كلَّ منقوطٍ تكتبه المنصّةُ في المشروع — بأيِّ صيغة', () => {
    // 🔴 قِستُ أوّلاً بنمطِ `name: '.x'` وحده فقلتُ «لا منقوطَ غيرُ اثنين».
    //    وكان خطأً: `.jaola-bot.json` يُكتب بمسارٍ حرفيّ في `jaolaBot.js`،
    //    ويقرؤه ملفّان. بحثٌ عن صيغةٍ واحدةٍ ليس جرداً.
    const roots = ['agents', 'services'];
    const found = new Set();
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const abs = path.join(d, e.name);
            if (e.isDirectory()) { walk(abs); continue; }
            if (!/\.m?js$/.test(e.name)) continue;
            const src = fs.readFileSync(abs, 'utf8');
            for (const m of src.matchAll(/writeFile\w*\(\s*path\.join\([^,]+,\s*'(\.[\w.-]+)'/g)) found.add(m[1]);
            for (const m of src.matchAll(/name:\s*'(\.[\w.-]+)'/g)) found.add(m[1]);
        }
    };
    for (const r of roots) walk(path.join(process.cwd(), r));
    assert.ok(found.size >= 3, `الجردُ وجد ${found.size} — النمطُ لا يرى شيئاً`);

    // 🔒 مرفوضٌ **قصداً**، بحكمٍ مكتوبٍ لا بصمت:
    //    `.env` يحمل السرَّ الفعليَّ للمشروع (يكتبه `services/projectSecrets.js`
    //    بمسارٍ حرفيّ). قبولُه في قائمةِ أسماءِ المولّدات يعني أنّ اسماً يقترحه
    //    نموذجٌ يستطيع الكتابةَ فوق أسرار المشروع. يبقى مرفوضاً أبداً.
    const DENIED = ['.env'];

    // كلُّ منقوطٍ تكتبه المنصّةُ له **حكمٌ صريح**: مسموحٌ أو مرفوضٌ بسبب.
    // والصمتُ عنه هو العطب: لو ظهر ثالثٌ لا حكمَ له سقط هذا الاختبار.
    const unjudged = [...found].filter((n) => !PROJECT_DOTFILES.includes(n) && !DENIED.includes(n));
    assert.deepEqual(unjudged, [],
        `منقوطٌ تكتبه المنصّةُ بلا حكم — إمّا يُضاف للقائمة أو يُرفض بسبب:\n  ${unjudged.join('\n  ')}`);

    // ولا يُقلب الحكمُ صامتاً: `.env` مرفوضٌ فعلاً عند النواة.
    for (const d of DENIED) {
        assert.equal(resolveProjectFile(ROOT, d), null, `\`${d}\` صار مقبولاً — وهو سرُّ المشروع`);
    }
});

test('`/api/template/apply` يكتب محتوىً هو أيضاً', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
    assert.doesNotMatch(src, /for \(const f of localized\) fs\.writeFileSync\(path\.join/,
        'عاد موضعُ القوالب يكتب بلا احتواء');
    assert.match(src, /resolveProjectFile\(projectPath, f\?\.name\)/, 'الاحتواءُ اختفى من مسار القوالب');
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
