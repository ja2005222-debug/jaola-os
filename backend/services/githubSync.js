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
