/**
 * 🐙 GitHub Sync — ربط المشروع بمستودع GitHub + الدفع التلقائي
 *
 * يعتمد على إعدادات التكامل المخزنة في Project.github (Mongoose)
 * والتوكن المشفر عبر secretVault. يُستدعى من:
 * - jcr.js بعد نجاح البناء (autoCommit)
 * - server.js من مسار /api/github/push
 */

import mongoose from 'mongoose';
import Project from '../models/Project.js';
import { decryptSecret } from '../utils/secretVault.js';
import { pushToGitHub } from '../agents/gitAgent.js';

function dbOnline() {
    return mongoose.connection.readyState === 1;
}

// جلب إعدادات التكامل (بدون التوكن الخام)
export async function getIntegration(username, projectName) {
    if (!dbOnline()) return null;
    try {
        const project = await Project.findOne({ name: projectName, owner: username }).lean();
        return project?.github || null;
    } catch (e) {
        return null;
    }
}

// 🛡️ حارس أمان حاسم: يمنع الدفع إلى مستودع المنصّة نفسه.
// الدفع يتم بـ "HEAD:main --force" — فربط مشروع مستخدم بمستودع المنصّة
// (jaola-os) يمحو كودها بالكامل عند أول دفعة. كل مشروع يحتاج مستودعه المنفصل.
export function isPlatformRepo(repoUrl) {
    const slug = (url) => {
        const m = /github\.com[:/]+([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url || '');
        return m ? `${m[1]}/${m[2]}`.toLowerCase() : '';
    };
    const target = slug(repoUrl);
    if (!target) return false;
    const platformSlug = (process.env.PLATFORM_REPO_SLUG || 'ja2005222-debug/jaola-os').toLowerCase();
    if (target === platformSlug) return true;
    // احتياط ضد الـ forks: أي مستودع بنفس الاسم الأساسي للمنصّة يُمنع أيضاً
    return target.split('/')[1] === platformSlug.split('/')[1];
}

const PLATFORM_REPO_ERROR = 'لا يمكن ربط مشروعك بمستودع المنصّة نفسه (jaola-os) — الدفع سيمحو كود المنصّة بالكامل. أنشئ مستودعاً جديداً فارغاً خاصاً بمشروعك على GitHub واربطه به.';

// بناء رابط push مُصادق عليه بالتوكن — لا يُخزَّن أبداً في .git/config
export function buildAuthUrl(repoUrl, patEncrypted) {
    if (!patEncrypted || !repoUrl?.startsWith('https://')) return null;
    try {
        const pat = decryptSecret(patEncrypted);
        const url = new URL(repoUrl);
        url.username = 'x-access-token';
        url.password = pat;
        return url.toString();
    } catch (e) {
        return null;
    }
}

// تنفيذ الدفع باستخدام الإعدادات المخزنة (أو overrides صريحة)
export async function pushProject(username, projectName, projectPath, overrides = {}) {
    const integration = await getIntegration(username, projectName);

    const repoUrl = overrides.repoUrl || integration?.repoUrl;
    const branch = overrides.branch || integration?.branch || 'main';

    if (!repoUrl) {
        return { success: false, error: 'لا يوجد مستودع مرتبط. اربط المشروع بـ GitHub أولاً.' };
    }

    // 🛡️ لا نسمح أبداً بالدفع إلى مستودع المنصّة (force على main يمحو كل شيء)
    if (isPlatformRepo(repoUrl)) {
        return { success: false, error: PLATFORM_REPO_ERROR };
    }

    const authUrl = buildAuthUrl(repoUrl, integration?.patEncrypted);
    const result = await pushToGitHub(projectPath, repoUrl, branch, { authUrl });

    if (result.success && dbOnline()) {
        try {
            await Project.updateOne(
                { name: projectName, owner: username },
                { $set: { 'github.lastCommit': new Date() } }
            );
        } catch (e) { /* تحديث اختياري */ }
    }

    return result;
}

// الدفع التلقائي بعد نجاح البناء — يُستدعى من jcr.js (fire-and-forget آمن)
export async function autoPushIfEnabled(username, projectName, projectPath, io, roomName) {
    try {
        const integration = await getIntegration(username, projectName);
        if (!integration?.autoCommit || !integration?.repoUrl) return;

        io.to(roomName).emit('log', { message: '🐙 [GitHub]: Auto-push — جاري رفع التغييرات...' });
        const result = await pushProject(username, projectName, projectPath);

        io.to(roomName).emit('log', {
            message: result.success
                ? `✅ [GitHub]: تم الدفع التلقائي إلى ${integration.repoUrl} (${integration.branch || 'main'})`
                : `⚠️ [GitHub]: فشل الدفع التلقائي — ${result.error}`
        });
    } catch (e) {
        io.to(roomName).emit('log', { message: `⚠️ [GitHub]: خطأ في الدفع التلقائي — ${e.message}` });
    }
}
