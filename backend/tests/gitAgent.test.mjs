// ═══════════════════════════════════════════════════════════════════
// 🔀 `agents/gitAgent.js` — الوحدة التي تُشغّل `git` على مشروع المستخدم.
//
// 🔴 كانت تبني سطرَ الأمر نصّاً وتُمرّره على `exec` — أي على `/bin/sh`:
//        runGit(`commit -m "${commitMsg}"`, projectPath)
//    و`commitMsg` تُشتقّ من **هدف المستخدم الحرّ** (`jcr.js:_stageGitBackup`
//    يمرّر `context.originalGoal.slice(0, 60)`). فهدفُ بناءٍ فيه `"` ثمّ
//    `$(...)` أو `` ` `` كان يُنفَّذ على الخادم — بحساب الخدمة، حيث
//    `JWT_SECRET` و`DATABASE_URL` ومفاتيح المزوّدين. قِيس بالتشغيل: أُنشئ
//    ملفٌّ شاهدٌ فعلاً.
//
// والإصلاحُ إزالةُ الصدفة لا تهريبُ النصّ: `execFile` بمصفوفة وسائط.
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
    initProjectRepo, commitBuild, getCommitHistory,
    rollbackToCommit, getProjectStats,
} from '../agents/gitAgent.js';

function repo(seed = 'hello') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitagent-'));
    execFileSync('git', ['init', '-q', '.'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a.txt'), seed);
    return dir;
}
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });

test('حقنُ أوامرَ عبر هدف المستخدم لا يُنفَّذ — والنصُّ يُحفظ رسالةً', async () => {
    const dir = repo();
    const witness = path.join(dir, 'PWNED');
    const goal = `موقع" $(touch ${witness}) \`touch ${witness}2\` "`;

    const r = await commitBuild(dir, goal, 'build');

    assert.equal(fs.existsSync(witness), false, '⛔ نُفِّذ $(...) — الصدفة ما زالت في الطريق');
    assert.equal(fs.existsSync(witness + '2'), false, '⛔ نُفِّذ `...`');
    assert.equal(r.success, true, 'الحفظُ نفسه يجب أن ينجح');

    const [head] = await getCommitHistory(dir, 1);
    assert.ok(head.message.includes('$(touch'), 'النصُّ لم يُحفظ حرفياً');
    rm(dir);
});

// انحدارٌ وظيفيّ كان قائماً قبل الإصلاح: اقتباسٌ في اسم المشروع يكسر الأمر،
// فيسقط النسخُ الاحتياطيّ كلُّه صامتاً (Git «اختياري — لا يوقف البناء»).
test('هدفٌ فيه اقتباسٌ عاديّ يُحفظ — لا يسقط النسخُ الاحتياطيّ صامتاً', async () => {
    const dir = repo();
    const r = await commitBuild(dir, 'ابنِ موقعاً باسم "مطعم البحر"', 'build');
    assert.equal(r.success, true, `فشل الحفظ: ${r.error}`);
    const [head] = await getCommitHistory(dir, 1);
    assert.ok(head.message.includes('مطعم البحر'));
    rm(dir);
});

test('لا commit بلا تغيير — ولا دعوى حفظٍ لم يقع', async () => {
    const dir = repo();
    await commitBuild(dir, 'أوّل', 'build');
    const again = await commitBuild(dir, 'ثانٍ', 'build');
    assert.equal(again.skipped, true);
    assert.equal(again.hash, undefined, 'أعطى hash لحفظٍ لم يقع');
    rm(dir);
});

test('السجلّ يُعرب الحقول الثلاثة، والعددُ يُقسَر صحيحاً', async () => {
    const dir = repo();
    for (const m of ['أوّل', 'ثانٍ', 'ثالث']) {
        fs.appendFileSync(path.join(dir, 'a.txt'), m);
        await commitBuild(dir, m, 'build');
    }
    const all = await getCommitHistory(dir, 10);
    assert.equal(all.length, 3);
    for (const c of all) {
        assert.match(c.hash, /^[0-9a-f]{7,}$/, `hash غير سليم: ${c.hash}`);
        assert.ok(c.message && c.time, 'حقلٌ ناقص');
    }
    // عددٌ غيرُ صالح لا يصير وسيطاً لـgit
    assert.equal((await getCommitHistory(dir, '2; rm -rf /')).length, 2);
    assert.ok((await getCommitHistory(dir, -5)).length >= 1);
    rm(dir);
});

test('الاسترجاع يُعيد المحتوى فعلاً', async () => {
    const dir = repo('نسخة-أولى');
    const first = await commitBuild(dir, 'الأولى', 'build');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'نسخة-ثانية');
    await commitBuild(dir, 'الثانية', 'build');

    const back = await rollbackToCommit(dir, first.hash);

    assert.equal(back.success, true);
    assert.equal(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'نسخة-أولى',
        'أعلن الاسترجاع ولم يُعِد المحتوى');
    rm(dir);
});

// وعدُ الدالّة «حفظ الحالة الحالية أولاً» يُقاس في الحالة التي يعني فيها
// شيئاً: شجرةٌ فيها تعديلٌ غيرُ محفوظ. (شجرةٌ نظيفة لا شيءَ فيها ليُحفظ،
// فتخطّي الحفظ هناك صوابٌ لا نقص — قِيس، فلا يُدَّعى عليه عطب.)
test('تعديلٌ غيرُ محفوظ لا يضيع في الاسترجاع', async () => {
    const dir = repo('نسخة-أولى');
    const first = await commitBuild(dir, 'الأولى', 'build');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'عملٌ لم يُحفظ بعد');

    await rollbackToCommit(dir, first.hash);

    const msgs = (await getCommitHistory(dir, 10)).map(c => c.message).join('\n');
    assert.ok(msgs.includes('قبل الاسترجاع'), 'التعديلُ غيرُ المحفوظ ضاع بلا نسخة');
    rm(dir);
});

test('الإحصاءات تُميّز «لا مستودع» من مستودعٍ فارغ الحفظات', async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'gitagent-none-'));
    assert.deepEqual(await getProjectStats(bare), { hasRepo: false });
    rm(bare);

    const dir = repo();
    await commitBuild(dir, 'واحدة', 'build');
    const st = await getProjectStats(dir);
    assert.equal(st.hasRepo, true);
    assert.equal(st.totalCommits, 1);
    assert.ok(st.lastCommit.message.includes('واحدة'));
    rm(dir);
});

test('التهيئة لا تُعيد إنشاء مستودعٍ قائم، وتكتب .gitignore للجديد', async () => {
    const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'gitagent-new-'));
    const a = await initProjectRepo(fresh);
    assert.deepEqual(a, { success: true, existed: false });
    assert.ok(fs.readFileSync(path.join(fresh, '.gitignore'), 'utf8').includes('.env'));
    const b = await initProjectRepo(fresh);
    assert.equal(b.existed, true);
    rm(fresh);
});

// حارسُ الصنف: لا يعود أمرُ صدفةٍ يُبنى بالدمج في هذه الوحدة — لا اليوم ولا غداً.
test('لا أمرَ git يُبنى بدمج نصّ: الصدفةُ خارج الطريق', () => {
    const src = fs.readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), '../agents/gitAgent.js'), 'utf8');
    assert.ok(!/\bexec\s*\(/.test(src.replace(/execFile\s*\(/g, '')),
        'عاد `exec` — وهو يُمرّر النصّ على /bin/sh');
    assert.match(src, /execFileAsync\('git',\s*args/, 'النداءُ لم يعد بمصفوفة وسائط');
    // تُستثنى سطرُ التعريف نفسه (`function runGit(args, cwd)`) — المقصودُ النداءات.
    const calls = [...src.matchAll(/await runGit\(([^,]*),/g)].map(m => m[1].trim());
    assert.ok(calls.length >= 10, `مواضعُ النداء انهارت إلى ${calls.length} — النمطُ كُسر`);
    for (const c of calls) {
        assert.ok(c.startsWith('['), `نداءٌ لا يمرّر مصفوفة: runGit(${c.slice(0, 40)}…`);
    }
});
