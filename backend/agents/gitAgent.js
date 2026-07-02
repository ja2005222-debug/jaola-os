/**
 * 🔀 Git Agent — JAOLA OS
 *
 * مسؤول عن:
 * - إنشاء git repo للمشروع تلقائياً
 * - Commit بعد كل بناء ناجح
 * - حفظ نقاط استرجاع (snapshots)
 * - Rollback لأي نقطة سابقة
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════
// 🔧 دوال مساعدة
// ═══════════════════════════════════════════════════════
async function runGit(command, cwd) {
    try {
        const { stdout, stderr } = await execAsync(`git ${command}`, {
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
    const init = await runGit('init', projectPath);
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
    const add = await runGit('add -A', projectPath);
    if (!add.success) return add;

    // تحقق هل هناك تغييرات
    const status = await runGit('status --porcelain', projectPath);
    if (!status.output) {
        return { success: true, skipped: true, reason: 'لا توجد تغييرات للحفظ' };
    }

    // Commit
    const emoji = buildType === 'build' ? '🏗️' : buildType === 'edit' ? '✏️' : '🔧';
    const commitMsg = `${emoji} ${message || 'JAOLA OS auto-commit'} [${new Date().toLocaleTimeString('ar-SA')}]`;
    const commit = await runGit(`commit -m "${commitMsg}"`, projectPath);

    if (!commit.success) return commit;

    // استخراج الـ hash
    const hashResult = await runGit('rev-parse --short HEAD', projectPath);
    const hash = hashResult.output || 'unknown';

    return { success: true, hash, message: commitMsg };
}

// ═══════════════════════════════════════════════════════
// 📋 قائمة آخر Commits
// ═══════════════════════════════════════════════════════
export async function getCommitHistory(projectPath, limit = 10) {
    const result = await runGit(
        `log --oneline -${limit} --format="%h|%s|%ar"`,
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
    const reset = await runGit(`checkout ${commitHash} -- .`, projectPath);
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

    const countResult = await runGit('rev-list --count HEAD', projectPath);
    const lastCommit = await runGit('log -1 --format="%s|%ar"', projectPath);

    const [lastMsg, lastTime] = (lastCommit.output || '|').split('|');

    return {
        hasRepo: true,
        totalCommits: parseInt(countResult.output) || 0,
        lastCommit: { message: lastMsg, time: lastTime },
    };
}

// ═══════════════════════════════════════════════════════
// 🐙 GitHub Push
// ═══════════════════════════════════════════════════════
export async function pushToGitHub(projectPath, repoUrl, branch = 'main') {
    try {
        // تحقق هل remote موجود
        const remoteCheck = await runGit('remote -v', projectPath);
        
        if (!remoteCheck.output.includes('origin')) {
            // أضف remote
            await runGit(`remote add origin ${repoUrl}`, projectPath);
        } else {
            // حدّث remote
            await runGit(`remote set-url origin ${repoUrl}`, projectPath);
        }

        // تأكد أن كل شيء مُضاف
        await runGit('add -A', projectPath);
        
        const status = await runGit('status --porcelain', projectPath);
        if (status.output) {
            await runGit(`commit -m "🚀 JAOLA OS auto-push [${new Date().toLocaleTimeString()}]"`, projectPath);
        }

        // Push
        const push = await runGit(`push -u origin ${branch} --force`, projectPath);
        
        if (!push.success) return { success: false, error: push.error };
        
        return { success: true, url: repoUrl, branch };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
