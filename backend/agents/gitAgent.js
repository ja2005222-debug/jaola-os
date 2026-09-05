/**
 * 🔀 Git Agent — JAOLA OS
 *
 * مسؤول عن:
 * - إنشاء git repo للمشروع تلقائياً
 * - Commit بعد كل بناء ناجح
 * - حفظ نقاط استرجاع (snapshots)
 * - Rollback لأي نقطة سابقة
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// ═══════════════════════════════════════════════════════
// 🔧 دوال مساعدة
// ═══════════════════════════════════════════════════════
// 🔴 كان هذا يبني سطرَ أمرٍ نصّياً ويمرّره على `exec` — أي على `/bin/sh`.
// ورسالةُ الـcommit تُشتقّ من **هدف المستخدم الحرّ** (`jcr.js:_stageGitBackup`)،
// فهدفٌ فيه `"` ثمّ `$(...)` كان يُنفَّذ على الخادم: تنفيذُ أوامرَ عن بُعد بحساب
// الخدمة، حيث `JWT_SECRET` و`DATABASE_URL` والمفاتيح. قِيس بالتشغيل لا بالقراءة.
//
// والإصلاحُ ليس تهريبَ النصّ — التهريبُ يُنسى ويُخترَق — بل **إزالةُ الصدفة**:
// `execFile` يُمرّر الوسائطَ إلى `git` مصفوفةً، فلا مُفسِّرَ بينهما يقرأ رموزاً.
// لذلك `runGit` تأخذ الآن `string[]` لا نصّاً، ولا يُبنى أمرٌ بالدمج أبداً.
async function runGit(args, cwd) {
    try {
        const { stdout } = await execFileAsync('git', args, {
            cwd,
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: 'JAOLA OS',
                GIT_AUTHOR_EMAIL: 'jaola@os.ai',
                GIT_COMMITTER_NAME: 'JAOLA OS',
                GIT_COMMITTER_EMAIL: 'jaola@os.ai',
            }
        });
        return { success: true, output: stdout.trim() };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══════════════════════════════════════════════════════
// 🚀 تهيئة Git Repo للمشروع
// ═══════════════════════════════════════════════════════
export async function initProjectRepo(projectPath) {
    // تحقق هل repo موجود مسبقاً
    const gitDir = path.join(projectPath, '.git');
    if (fs.existsSync(gitDir)) return { success: true, existed: true };

    // إنشاء repo جديد
    const init = await runGit(['init'], projectPath);
    if (!init.success) return init;

    // إنشاء .gitignore
    const gitignore = `node_modules/\n.env\n.DS_Store\n*.log\ndist/\n.next/\n`;
    fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignore);

    return { success: true, existed: false };
}

// ═══════════════════════════════════════════════════════
// 💾 Commit بعد البناء
// ═══════════════════════════════════════════════════════
export async function commitBuild(projectPath, message, buildType = 'build') {
    // تهيئة repo إذا لم يكن موجوداً
    await initProjectRepo(projectPath);

    // إضافة كل الملفات
    const add = await runGit(['add', '-A'], projectPath);
    if (!add.success) return add;

    // تحقق هل هناك تغييرات
    const status = await runGit(['status', '--porcelain'], projectPath);
    if (!status.output) {
        return { success: true, skipped: true, reason: 'لا توجد تغييرات للحفظ' };
    }

    // Commit
    const emoji = buildType === 'build' ? '🏗️' : buildType === 'edit' ? '✏️' : '🔧';
    const commitMsg = `${emoji} ${message || 'JAOLA OS auto-commit'} [${new Date().toLocaleTimeString('ar-SA')}]`;
    const commit = await runGit(['commit', '-m', commitMsg], projectPath);

    if (!commit.success) return commit;

    // استخراج الـ hash
    const hashResult = await runGit(['rev-parse', '--short', 'HEAD'], projectPath);
    const hash = hashResult.output || 'unknown';

    return { success: true, hash, message: commitMsg };
}

// ═══════════════════════════════════════════════════════
// 📋 قائمة آخر Commits
// ═══════════════════════════════════════════════════════
export async function getCommitHistory(projectPath, limit = 10) {
    // العددُ يُقسَر صحيحاً موجباً محدوداً: وسيطٌ نصّيٌّ هنا يصير خياراً لـgit.
    const n = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 200);
    const result = await runGit(
        ['log', '--oneline', `-${n}`, '--format=%h|%s|%ar'],
        projectPath
    );

    if (!result.success || !result.output) return [];

    return result.output.split('\n').map(line => {
        const [hash, message, time] = line.split('|');
        return { hash, message, time };
    });
}

// ═══════════════════════════════════════════════════════
// ⏪ Rollback لـ commit سابق
// ═══════════════════════════════════════════════════════
export async function rollbackToCommit(projectPath, commitHash) {
    // حفظ الحالة الحالية أولاً
    await commitBuild(projectPath, 'قبل الاسترجاع', 'backup');

    // استرجاع
    const reset = await runGit(['checkout', commitHash, '--', '.'], projectPath);
    if (!reset.success) return reset;

    // commit الاسترجاع
    const rollbackCommit = await commitBuild(projectPath, `استرجاع إلى ${commitHash}`, 'rollback');

    return { success: true, restoredTo: commitHash, newCommit: rollbackCommit.hash };
}

// ═══════════════════════════════════════════════════════
// 📊 إحصائيات المشروع
// ═══════════════════════════════════════════════════════
export async function getProjectStats(projectPath) {
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir)) {
        return { hasRepo: false };
    }

    const countResult = await runGit(['rev-list', '--count', 'HEAD'], projectPath);
    const lastCommit = await runGit(['log', '-1', '--format=%s|%ar'], projectPath);

    const [lastMsg, lastTime] = (lastCommit.output || '|').split('|');

    return {
        hasRepo: true,
        totalCommits: parseInt(countResult.output) || 0,
        lastCommit: { message: lastMsg, time: lastTime },
    };
}

/**
 * رايةُ القوّة تبعاً لحال البعيد — مِفصلٌ نقيٌّ لأنّ القرارَ نفسَه هو المحروس.
 *
 * • الفرعُ غيرُ موجود → لا قوّةَ أصلاً.
 * • موجودٌ وسلسلتُه معلومة → `--force-with-lease=<فرع>:<sha>`: القوّةُ لازمة
 *   (لا تاريخَ مشتركاً بين مشروعٍ مولَّدٍ محلّيّاً والبعيد)، لكنّها ترفض إن
 *   تحرّك البعيدُ بين الفحص والدفع — نافذةٌ صغيرةٌ لكنّها حقيقية.
 * • موجودٌ وسلسلتُه مجهولة → لا حيازةَ نشترطها، فالقوّةُ عمياء.
 *
 * تُعاد **لاحقةً** لا الأمرَ كلَّه، ليبقى كلُّ نداءِ `runGit` مصفوفةً حرفيّةً
 * كما يشترط حارسُ «الصدفةُ خارج الطريق» في `tests/gitAgent.test.mjs`.
 */
export function forceFlags(branch, remoteState = {}) {
    if (!remoteState.exists) return [];
    return [remoteState.sha ? `--force-with-lease=${branch}:${remoteState.sha}` : '--force'];
}

/**
 * حالةُ الفرع على المستودع البعيد قبل الدفع.
 *
 * `ls-remote` يكشف الوجودَ والـSHA بلا جلبٍ كامل. ثمّ `fetch` لذلك المرجع
 * وحدَه يتيح سؤالَ git: أهذا الالتزامُ سلفٌ لِما عندنا؟ فإن لم يكن، فالتاريخُ
 * مفترق، ودفعُ القوّة يمحو عملاً ليس لنا.
 */
async function inspectRemoteBranch(projectPath, target, branch) {
    const ls = await runGit(['ls-remote', target, `refs/heads/${branch}`], projectPath);
    if (!ls.success) return { exists: false, diverged: false, sha: null, aheadCount: 0, unknown: true };
    const sha = (ls.output || '').split(/\s+/)[0] || null;
    if (!sha) return { exists: false, diverged: false, sha: null, aheadCount: 0 };

    const fetched = await runGit(['fetch', '--no-tags', target, `refs/heads/${branch}`], projectPath);
    if (!fetched.success) {
        // لا نستطيع الحكم — نُبلّغ الجهل بدل ادّعاء الأمان
        return { exists: true, diverged: true, sha, aheadCount: 0, unknown: true };
    }
    const ancestor = await runGit(['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], projectPath);
    if (ancestor.success) return { exists: true, diverged: false, sha, aheadCount: 0 };

    const count = await runGit(['rev-list', '--count', 'HEAD..FETCH_HEAD'], projectPath);
    return { exists: true, diverged: true, sha, aheadCount: parseInt(count.output, 10) || 0 };
}

// ═══════════════════════════════════════════════════════
// 🐙 GitHub Push
// ═══════════════════════════════════════════════════════
export async function pushToGitHub(projectPath, repoUrl, branch = 'main', options = {}) {
    try {
        // تهيئة repo إذا لم يكن موجوداً (يشمل .gitignore)
        await initProjectRepo(projectPath);

        // الـ remote يُخزَّن دائماً بالرابط النظيف — التوكن لا يُكتب في .git/config
        const remoteCheck = await runGit(['remote', '-v'], projectPath);

        if (!remoteCheck.output?.includes('origin')) {
            // أضف remote
            await runGit(['remote', 'add', 'origin', repoUrl], projectPath);
        } else {
            // حدّث remote
            await runGit(['remote', 'set-url', 'origin', repoUrl], projectPath);
        }

        // تأكد أن كل شيء مُضاف
        await runGit(['add', '-A'], projectPath);

        const status = await runGit(['status', '--porcelain'], projectPath);
        if (status.output) {
            await runGit(['commit', '-m', `🚀 JAOLA OS auto-push [${new Date().toLocaleTimeString()}]`], projectPath);
        }

        // Push — نستخدم الرابط المُصادق (بالتوكن) مباشرة إن وُجد، بدون حفظه
        const pushTarget = options.authUrl || 'origin';

        // 🔴 كان الدفعُ `--force` دائماً وبلا شرط. ومستودعُ المشروع هنا
        //    يُنشأ بـ`git init` محلّيّاً، فلا تاريخَ مشتركاً له مع البعيد:
        //    أيُّ عملٍ في مستودع المستخدم — التزاماتُ زملائه، فرعُه الحقيقيّ،
        //    ما كتبه بيده — يُمحى في لحظة، بلا سؤالٍ ولا أثر.
        //    فصار الدفعُ يسأل البعيدَ أوّلاً:
        //      • الفرعُ غيرُ موجود        → دفعٌ عاديّ
        //      • البعيدُ سلفٌ لِما عندنا  → دفعٌ عاديّ (تقدّمٌ سريع)
        //      • تاريخٌ مفترق             → **يرفض** ويقول ما سيُمحى،
        //                                   إلّا أن يأذن المستدعي بـ`force`
        const remoteState = await inspectRemoteBranch(projectPath, pushTarget, branch);
        if (remoteState.diverged && !options.force) {
            return {
                success: false,
                diverged: true,
                remoteCommits: remoteState.aheadCount,
                error: `المستودع البعيد يحتوي ${remoteState.aheadCount} التزاماً ليس عندنا على الفرع «${branch}». `
                    + 'الدفعُ سيمحوها نهائياً. اختر فرعاً آخر أو مستودعاً فارغاً، '
                    + 'أو أعد المحاولة مع تأكيد الاستبدال.',
            };
        }

        const push = await runGit(['push', pushTarget, `HEAD:${branch}`, ...forceFlags(branch, remoteState)], projectPath);

        if (!push.success) {
            // لا نُسرّب التوكن في رسالة الخطأ
            const safeError = options.authUrl
                ? (push.error || '').replaceAll(options.authUrl, repoUrl)
                : push.error;
            return { success: false, error: safeError };
        }

        return { success: true, url: repoUrl, branch };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
