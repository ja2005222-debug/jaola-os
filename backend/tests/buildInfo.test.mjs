// 🏷️ نسخةُ الكود العاملة — «الخدمةُ تقول ما تُشغّل، ولا يُستنتَج».
//
// سؤالٌ تكرّر في تشخيصٍ حقيقيّ ولم يكن لسجلّ الخادم جوابٌ عنه: **أيُّ كوميتٍ يعمل الآن؟** فبعد دمج
// إصلاحٍ يبقى احتمالٌ قائمٌ أنّ النشرة أقدمُ منه، فيُقاس سلوكُ كودٍ غيرِ الذي أُصلح. وهو المنهجُ نفسُه
// الذي اتُّبع في «🚦 جاهزية الإطلاق»: تقريرٌ تقوله الخدمةُ بنفسها في سجلّها بدل استنتاجٍ من الخارج.
//
// الحدُّ المقصود: لا يُعلَن ما ليس معروفاً. متغيّرٌ موجودٌ بقيمةٍ ليست SHA لا يُطبع كأنّه كوميت.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveBuildInfo, buildInfoLine } from '../services/buildInfo.js';

const SHA = 'cf925282a9cd92aeb12bc519e3af32096f9728d9';

/** مستودعُ git صغيرٌ على القرص — بلا تشغيل git. */
function gitDir({ head }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildinfo-'));
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git/HEAD'), head);
    return dir;
}

test('🔴 يقرأ الكوميتَ من بيئة المنصّة ويعرضه مختصراً مع فرعه', () => {
    const info = resolveBuildInfo({ RENDER_GIT_COMMIT: SHA, RENDER_GIT_BRANCH: 'main' }, '/nonexistent');
    assert.equal(info.commit, SHA);
    assert.equal(info.short, 'cf92528');
    assert.equal(info.branch, 'main');
    assert.equal(info.source, 'env');
    assert.equal(buildInfoLine(info), '🏷️ [Build]: يعمل على cf92528 (main)');
});

test('وأسماءُ المنصّات الأخرى مقبولةٌ بالأولويّة نفسِها', () => {
    for (const key of ['RENDER_GIT_COMMIT', 'SOURCE_COMMIT', 'GIT_COMMIT', 'VERCEL_GIT_COMMIT_SHA']) {
        assert.equal(resolveBuildInfo({ [key]: SHA }, '/nonexistent').short, 'cf92528', key);
    }
});

test('🔴 وبلا بيئةٍ يُقرأ من القرص — مرجعاً أو رأساً منفصلاً', () => {
    const withRef = gitDir({ head: 'ref: refs/heads/main\n' });
    fs.mkdirSync(path.join(withRef, '.git/refs/heads'), { recursive: true });
    fs.writeFileSync(path.join(withRef, '.git/refs/heads/main'), `${SHA}\n`);
    const a = resolveBuildInfo({}, withRef);
    assert.equal(a.short, 'cf92528');
    assert.equal(a.branch, 'main', 'اسمُ الفرع من المرجع نفسِه');
    assert.equal(a.source, 'git');

    const detached = gitDir({ head: `${SHA}\n` });
    const b = resolveBuildInfo({}, detached);
    assert.equal(b.short, 'cf92528');
    assert.equal(b.branch, '', 'رأسٌ منفصلٌ بلا فرع');
});

test('🔴 الحدّ: ما ليس كوميتاً لا يُعلَن كوميتاً — ولا يُدّعى ما لا يُعرف', () => {
    for (const bad of ['', '   ', 'main', 'not-a-sha', 'ref: refs/heads/x', 'z'.repeat(40), SHA.slice(0, 39) + 'z', SHA + 'ff']) {
        const info = resolveBuildInfo({ RENDER_GIT_COMMIT: bad }, '/nonexistent');
        assert.equal(info.commit, '', `قُبل «${bad}» كوميتاً`);
        assert.equal(info.source, 'unknown');
    }
    assert.equal(buildInfoLine(resolveBuildInfo({}, '/nonexistent')), '🏷️ [Build]: نسخةُ الكود غير معروفة (لا متغيّرَ نشرٍ ولا مستودع)');
});

test('الحدّ: لا يُقرأ من القرص إن كفت البيئة، ولا يرمي على مستودعٍ مشوّه', () => {
    const broken = gitDir({ head: 'ref: refs/heads/gone\n' });   // المرجعُ مفقود
    assert.equal(resolveBuildInfo({}, broken).source, 'unknown');
    // ومرجعٌ **موجودٌ** بمحتوىً ليس كوميتاً: لا يُعلَن كوميتاً فارغاً (أمسكته الطفرة)
    const junk = gitDir({ head: 'ref: refs/heads/main\n' });
    fs.mkdirSync(path.join(junk, '.git/refs/heads'), { recursive: true });
    fs.writeFileSync(path.join(junk, '.git/refs/heads/main'), 'ليس كوميتاً\n');
    assert.deepEqual(resolveBuildInfo({}, junk), { commit: '', short: '', branch: '', source: 'unknown' });
    assert.equal(resolveBuildInfo({ RENDER_GIT_COMMIT: SHA }, broken).source, 'env', 'البيئةُ أوّلاً');
    assert.doesNotThrow(() => resolveBuildInfo({}, path.join(broken, 'لا-يوجد')));
});
