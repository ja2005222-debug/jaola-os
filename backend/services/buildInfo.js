/**
 * 🏷️ services/buildInfo.js — نسخةُ الكود العاملة، تقولها الخدمةُ بنفسها في سجلّها.
 *
 * سؤالٌ تكرّر في تشخيصٍ حقيقيّ ولم يكن للسجلّ جوابٌ عنه: **أيُّ كوميتٍ يعمل الآن؟** فبعد دمج إصلاحٍ
 * يبقى احتمالٌ قائمٌ أنّ النشرة أقدمُ منه، فيُقاس سلوكُ كودٍ غيرِ الذي أُصلح — وهو أسوأُ ما يصيب قياساً.
 * المنهجُ نفسُه المتّبع في «🚦 جاهزية الإطلاق»: تقريرٌ تقوله الخدمةُ لا استنتاجٌ من الخارج.
 *
 * البيئةُ أوّلاً (تضعها منصّةُ النشر)، ثمّ `.git` على القرص قراءةً مباشرة — بلا تشغيل `git` في الإقلاع.
 * والحدُّ: **لا يُعلَن ما ليس معروفاً**؛ متغيّرٌ موجودٌ بقيمةٍ ليست SHA لا يُطبع كأنّه كوميت.
 * ومُعرِّفُ الكوميت ليس سرّاً — هو في المستودع نفسِه — فلا شيءَ هنا يكشف مفتاحاً.
 */
import fs from 'fs';
import path from 'path';

const SHA = /^[0-9a-f]{40}$/i;
const asSha = (v) => (typeof v === 'string' && SHA.test(v.trim()) ? v.trim().toLowerCase() : '');
const asText = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

const NONE = Object.freeze({ commit: '', short: '', branch: '', source: 'unknown' });
const found = (commit, branch, source) => ({ commit, short: commit.slice(0, 7), branch, source });

/** يقرأ الكوميتَ من `.git` بلا تشغيل أمر: `HEAD` مرجعاً أو رأساً منفصلاً. `null` عند أيّ تعذّر. */
function fromGitDir(root) {
    try {
        const head = fs.readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim();
        const ref = head.match(/^ref:\s*(\S+)$/);
        if (!ref) return asSha(head) ? found(asSha(head), '', 'git') : null;
        const sha = asSha(fs.readFileSync(path.join(root, '.git', ref[1]), 'utf8'));
        return sha ? found(sha, ref[1].replace(/^refs\/heads\//, ''), 'git') : null;
    } catch { return null; }
}

/** @returns {{commit: string, short: string, branch: string, source: 'env'|'git'|'unknown'}} */
export function resolveBuildInfo(env = process.env, root = process.cwd()) {
    for (const key of ['RENDER_GIT_COMMIT', 'SOURCE_COMMIT', 'GIT_COMMIT', 'VERCEL_GIT_COMMIT_SHA']) {
        const sha = asSha(env[key]);
        if (sha) return found(sha, asText(env.RENDER_GIT_BRANCH) || asText(env.GIT_BRANCH), 'env');
    }
    return fromGitDir(root) || NONE;
}

/** سطرُ الإقلاع — يقول «غير معروفة» صراحةً بدل أن يدّعي. */
export function buildInfoLine(info) {
    if (!info.commit) return '🏷️ [Build]: نسخةُ الكود غير معروفة (لا متغيّرَ نشرٍ ولا مستودع)';
    return `🏷️ [Build]: يعمل على ${info.short}${info.branch ? ` (${info.branch})` : ''}`;
}
