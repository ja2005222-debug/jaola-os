import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import Project from '../models/Project.js';

const VERCEL_API = 'https://api.vercel.com';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // اختياري — فقط إذا كان الحساب ضمن team

// 🛡️ منع التكرار: يتتبع المشاريع التي يجري نشرها حالياً لمنع طلبات متوازية
// لنفس المشروع، وهو السبب الأرجح لمشكلة "الإرسال المتكرر" السابقة.
const deploysInProgress = new Set();

/**
 * 📦 قراءة جميع ملفات المشروع وتحويلها لتنسيق Vercel Deployment API
 * Vercel يتطلب كل ملف كـ { file: "اسم", data: "base64 content" }
 */
async function collectProjectFiles(projectPath) {
    const files = [];

    async function walk(dir, relativePath = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            // تجاهل مجلدات النظام الداخلية وليست جزءاً من الموقع المنشور
            if (entry.name === '.backups' || entry.name === 'node_modules' || entry.name.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(dir, entry.name);
            const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                await walk(fullPath, relPath);
            } else {
                const content = await fs.readFile(fullPath);
                files.push({
                    file: relPath,
                    data: content.toString('base64'),
                    encoding: 'base64'
                });
            }
        }
    }

    await walk(projectPath);
    return files;
}

/**
 * 🚀 نشر مشروع على Vercel عبر REST API مباشرة (بدون CLI، بدون exec)
 * @param {object} params - { projectPath, activeProject, currentUser }
 * @param {object} io - Socket.io instance للبث الحي
 * @param {function} emitUserProjects - دالة لإعادة بث قائمة مشاريع المستخدم بعد التحديث
 */
export async function deployProject({ projectPath, activeProject, currentUser }, io, emitUserProjects) {
    const deployKey = `${currentUser}-${activeProject}`;
    const roomName = deployKey;

    // 🛡️ منع النشر المتكرر لنفس المشروع أثناء وجود عملية جارية
    if (deploysInProgress.has(deployKey)) {
        io.to(roomName).emit('log', {
            message: '⏳ [DEPLOY]: يوجد عملية نشر جارية بالفعل لهذا المشروع. انتظر اكتمالها قبل المحاولة مجدداً.'
        });
        return;
    }

    if (!VERCEL_TOKEN) {
        io.to(roomName).emit('log', {
            message: '❌ [DEPLOY]: لم يُضبط VERCEL_TOKEN في إعدادات الخادم. تواصل مع المسؤول لتفعيل النشر السحابي.'
        });
        return;
    }

    if (!fsSync.existsSync(projectPath)) {
        io.to(roomName).emit('log', { message: '❌ [DEPLOY]: مسار المشروع غير موجود.' });
        return;
    }

    deploysInProgress.add(deployKey);
    io.to(roomName).emit('log', { message: '🚀 [DEPLOY]: جاري تجميع ملفات المشروع...' });

    try {
        const files = await collectProjectFiles(projectPath);

        if (files.length === 0) {
            throw new Error('لا توجد ملفات قابلة للنشر في هذا المشروع.');
        }

        // اسم مشروع صالح في Vercel: أحرف صغيرة وأرقام وشرطات فقط
        const vercelProjectName = `${currentUser}-${activeProject}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 100);

        io.to(roomName).emit('log', { message: `📡 [DEPLOY]: جاري الرفع إلى Vercel (${files.length} ملف)...` });

        const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
        const response = await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: vercelProjectName,
                files,
                target: 'production',
                projectSettings: {
                    framework: null, // موقع ثابت بدون framework
                }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            const errorMsg = result?.error?.message || `خطأ HTTP ${response.status}`;
            throw new Error(errorMsg);
        }

        const vercelProductionUrl = `https://${result.url}`;

        // تحديث قاعدة البيانات
        try {
            await Project.findOneAndUpdate(
                { name: activeProject, owner: currentUser },
                { vercelUrl: vercelProductionUrl }
            );
        } catch (e) {
            // فشل تحديث DB لا يجب أن يُفشل عملية النشر نفسها
        }

        io.to(roomName).emit('log', {
            message: `✨ [DEPLOY]: مبروك! الموقع منشور الآن على: ${vercelProductionUrl}`
        });

        if (typeof emitUserProjects === 'function') {
            await emitUserProjects();
        }

        return { success: true, url: vercelProductionUrl };

    } catch (error) {
        io.to(roomName).emit('log', {
            message: `❌ [DEPLOY]: فشل النشر — ${error.message}. الكود محفوظ محلياً بأمان.`
        });
        return { success: false, error: error.message };

    } finally {
        // إزالة القفل دائماً، حتى عند الفشل، للسماح بمحاولة لاحقة
        deploysInProgress.delete(deployKey);
    }
}
