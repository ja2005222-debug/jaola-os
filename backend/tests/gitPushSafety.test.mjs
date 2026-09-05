// 🐙 الدفعُ إلى مستودع المستخدم — كان `--force` دائماً وبلا شرط.
//
// مستودعُ المشروع هنا يُنشأ بـ`git init` محلّيّاً، فلا تاريخَ مشتركاً له مع
// البعيد: أيُّ عملٍ في مستودع المستخدم — التزاماتُ زملائه، ما كتبه بيده —
// كان يُمحى في لحظة، بلا سؤالٍ ولا أثر.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pushToGitHub } from '../agents/gitAgent.js';

const git = (args, cwd) => execFileSync('git', args, {
    cwd,
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
}).toString().trim();

/** مستودعٌ بعيدٌ فيه عملُ المستخدم، ومستودعُ مشروعٍ مولَّدٍ لا يشاركه تاريخاً. */
function scene({ remoteHasWork = true } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-push-'));
    const remote = path.join(root, 'remote.git');
    git(['init', '-q', '--bare', remote], root);
    if (remoteHasWork) {
        const seed = path.join(root, 'seed');
        fs.mkdirSync(seed);
        git(['init', '-q'], seed);
        fs.writeFileSync(path.join(seed, 'mine.txt'), 'عملُ المستخدم');
        git(['add', '-A'], seed); git(['commit', '-qm', 'التزامُ المستخدم'], seed);
        git(['push', '-q', remote, 'HEAD:main'], seed);
    }
    const gen = path.join(root, 'gen');
    fs.mkdirSync(gen);
    git(['init', '-q'], gen);
    fs.writeFileSync(path.join(gen, 'gen.txt'), 'ما ولّدته جولا');
    git(['add', '-A'], gen); git(['commit', '-qm', 'توليد'], gen);
    return { root, remote, gen, log: () => git(['--git-dir=' + remote, 'log', '--oneline', 'main']) };
}
const clean = (s) => fs.rmSync(s.root, { recursive: true, force: true });

test('العطب: تاريخٌ بعيدٌ مفترق كان يُمحى بلا سؤال — صار يُرفض', async () => {
    const s = scene();
    try {
        const r = await pushToGitHub(s.gen, s.remote, 'main');
        assert.strictEqual(r.success, false);
        assert.strictEqual(r.diverged, true);
        assert.strictEqual(r.remoteCommits, 1, 'ويقول كم التزاماً كان سيُمحى');
        assert.match(r.error, /سيمحوها/);
        assert.match(s.log(), /التزامُ المستخدم/, 'عملُ المستخدم على حاله');
    } finally { clean(s); }
});

test('فرعٌ غيرُ موجودٍ على البعيد: دفعٌ عاديّ بلا قوّة', async () => {
    const s = scene();
    try {
        const r = await pushToGitHub(s.gen, s.remote, 'branch-جديد');
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.branch, 'branch-جديد');
        assert.match(s.log(), /التزامُ المستخدم/, 'ولم يُمَسّ main');
    } finally { clean(s); }
});

test('مستودعٌ فارغٌ تماماً: يعمل كما كان', async () => {
    const s = scene({ remoteHasWork: false });
    try {
        const r = await pushToGitHub(s.gen, s.remote, 'main');
        assert.strictEqual(r.success, true);
        assert.match(s.log(), /توليد/);
    } finally { clean(s); }
});

test('بإذنٍ صريح: يستبدل — فالقرار للمستخدم لا للنظام', async () => {
    const s = scene();
    try {
        const r = await pushToGitHub(s.gen, s.remote, 'main', { force: true });
        assert.strictEqual(r.success, true);
        assert.doesNotMatch(s.log(), /التزامُ المستخدم/);
        assert.match(s.log(), /توليد/);
    } finally { clean(s); }
});

test('البعيدُ سلفٌ لِما عندنا: تقدّمٌ سريعٌ بلا رفض', async () => {
    const s = scene({ remoteHasWork: false });
    try {
        assert.strictEqual((await pushToGitHub(s.gen, s.remote, 'main')).success, true);
        fs.writeFileSync(path.join(s.gen, 'more.txt'), 'زيادة');
        git(['add', '-A'], s.gen); git(['commit', '-qm', 'زيادة'], s.gen);
        const r = await pushToGitHub(s.gen, s.remote, 'main');
        assert.strictEqual(r.success, true, 'لا يُرفض تقدّمٌ سريع');
        assert.match(s.log(), /زيادة/);
    } finally { clean(s); }
});

test('بعيدٌ لا يُبلَغ: لا يُدّعى نجاحٌ ولا تُمحى بيانات', async () => {
    const s = scene();
    try {
        const r = await pushToGitHub(s.gen, path.join(s.root, 'لا-وجود-له.git'), 'main');
        assert.strictEqual(r.success, false);
        assert.match(s.log(), /التزامُ المستخدم/);
    } finally { clean(s); }
});

test('عجزٌ عن الحكم لا يُقرأ أماناً: المرجعُ يُقرأ والجلبُ يعجز', async () => {
    const s = scene();
    try {
        // حالةٌ حقيقيّة: `ls-remote` يقرأ `refs/` بلا كائنات، والجلبُ يعجز.
        // لا نعرف أمفترقٌ التاريخ أم لا — والصمتُ هنا يعني المحو.
        fs.rmSync(path.join(s.remote, 'objects'), { recursive: true, force: true });
        fs.mkdirSync(path.join(s.remote, 'objects'), { recursive: true });
        const r = await pushToGitHub(s.gen, s.remote, 'main');
        assert.strictEqual(r.success, false, 'لا يُدفع على جهل');
        assert.strictEqual(r.diverged, true);
    } finally { clean(s); }
});

test('الحيازةُ المشروطة ترفض بعيداً تحرّك بعد الفحص', () => {
    // `--force-with-lease=<فرع>:<sha>` هو ما يحمي النافذةَ بين الفحص والدفع.
    // نُثبت أنّ الخاصيّة قائمةٌ فعلاً: سلسلةٌ بائدة ⇒ رفض، لا محو.
    const s = scene();
    try {
        const stale = '0'.repeat(40);
        assert.throws(
            () => git(['push', s.remote, 'HEAD:main', `--force-with-lease=main:${stale}`], s.gen),
            /stale info|rejected/i,
        );
        assert.match(s.log(), /التزامُ المستخدم/, 'ولم يُمَسّ عملُ المستخدم');
        // وبلا حيازة: القوّةُ العمياء تمحوه
        git(['push', s.remote, 'HEAD:main', '--force'], s.gen);
        assert.doesNotMatch(s.log(), /التزامُ المستخدم/);
    } finally { clean(s); }
});

test('القرار: متى تُشترط الحيازةُ ومتى تُترك القوّةُ عمياء', async () => {
    const { forceFlags } = await import('../agents/gitAgent.js');
    const sha = 'a'.repeat(40);
    assert.deepStrictEqual(forceFlags('main', { exists: false }), [], 'فرعٌ جديد: بلا قوّة');
    assert.deepStrictEqual(forceFlags('main', { exists: true, sha }),
        [`--force-with-lease=main:${sha}`], 'سلسلةٌ معلومة: حيازةٌ مشروطة');
    assert.deepStrictEqual(forceFlags('main', { exists: true, sha: null }),
        ['--force'], 'سلسلةٌ مجهولة: قوّةٌ عمياء');
});
