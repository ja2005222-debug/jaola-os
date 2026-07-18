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
 * 🩺 فحص تحقق مسبق لصلاحية Vercel — يحوّل "Not authorized" الغامضة إلى
 * تشخيص دقيق قابل للتنفيذ قبل أي محاولة نشر:
 * - هل VERCEL_TOKEN مضبوط أصلاً؟
 * - هل التوكن صالح وغير منتهٍ؟ (يُختبر ضد GET /v2/user)
 * - إن ضُبط VERCEL_TEAM_ID: هل التوكن يملك صلاحية ذلك الفريق؟
 * لا يكشف التوكن أبداً — يعيد حكماً واضحاً فقط.
 */
export async function verifyVercelAuth() {
    if (!VERCEL_TOKEN) {
        return {
            ok: false, stage: 'token_missing',
            message: 'VERCEL_TOKEN غير مضبوط في إعدادات الخادم (Render → Environment). أضِفه ثم أعد النشر.',
        };
    }

    // 1) صلاحية التوكن نفسه
    let account = null;
    try {
        const res = await fetch(`${VERCEL_API}/v2/user`, {
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            return {
                ok: false, stage: 'token_invalid', status: res.status,
                message: `التوكن مرفوض من Vercel (${res.status}: ${body?.error?.message || 'غير مصرّح'}). التوكن غالباً منتهٍ أو خاطئ — أنشئ توكناً جديداً من Vercel → Account Settings → Tokens.`,
            };
        }
        account = body?.user?.username || body?.user?.email || 'unknown';
    } catch (e) {
        return { ok: false, stage: 'network', message: `تعذّر الوصول إلى Vercel: ${e.message}` };
    }

    // 2) صلاحية الفريق (إن ضُبط)
    if (VERCEL_TEAM_ID) {
        try {
            const res = await fetch(`${VERCEL_API}/v2/teams/${VERCEL_TEAM_ID}`, {
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                return {
                    ok: false, stage: 'team_invalid', status: res.status, account,
                    message: `التوكن صالح (الحساب: ${account}) لكن VERCEL_TEAM_ID=${VERCEL_TEAM_ID} مرفوض `
                        + `(${res.status}). تحقّق أن المعرّف صحيح وأن التوكن يملك صلاحية هذا الفريق، أو احذف المتغير إن لم يكن حسابك ضمن Team.`,
                };
            }
            return {
                ok: true, account, team: body?.name || VERCEL_TEAM_ID,
                message: `✅ جاهز للنشر — الحساب: ${account}، الفريق: ${body?.name || VERCEL_TEAM_ID}.`,
            };
        } catch (e) {
            return { ok: false, stage: 'network', account, message: `تعذّر التحقق من الفريق: ${e.message}` };
        }
    }

    return { ok: true, account, message: `✅ جاهز للنشر — الحساب: ${account} (بلا فريق).` };
}

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
            if (entry.name === '.backups' || entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'api' || entry.name === 'AUTH_README.md') {
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

    // 🩺 تحقق مسبق: افشل مبكراً برسالة دقيقة بدل رفعٍ كامل ينتهي بـ "Not authorized"
    const auth = await verifyVercelAuth();
    if (!auth.ok) {
        io.to(roomName).emit('log', { message: `❌ [DEPLOY]: ${auth.message}` });
        return { success: false, error: auth.message };
    }

    if (!fsSync.existsSync(projectPath)) {
        io.to(roomName).emit('log', { message: '❌ [DEPLOY]: مسار المشروع غير موجود.' });
        return;
    }

    deploysInProgress.add(deployKey);
    io.to(roomName).emit('log', { message: '🚀 [DEPLOY]: جاري تجميع ملفات المشروع...' });

    try {
        // 🆕 دمج API files إذا تجاوزت 12 (حد Vercel Hobby)
        const apiDir = path.join(projectPath, 'api');
        const { existsSync } = await import('fs');
        if (existsSync(apiDir)) {
            const apiFiles = (await fs.readdir(apiDir)).filter(f => f.endsWith('.js') && !['db.js','schema.js','seed.js'].includes(f));
            if (apiFiles.length > 10) {
                // ادمج كل الـ routes في ملف واحد
                let combined = `import express from 'express';\nconst router = express.Router();\n`;
                for (const file of apiFiles) {
                    const name = file.replace('.js','');
                    combined += `\n// === ${name} ===\n`;
                    try {
                        const content = await fs.readFile(path.join(apiDir, file), 'utf-8');
                        combined += content.replace(/export default.*router/g, '').replace(/import express.*\n/g,'') + '\n';
                    } catch(e) {}
                }
                combined += '\nexport default router;';
                await fs.writeFile(path.join(apiDir, 'routes.js'), combined);
                // احذف الملفات القديمة واحتفظ فقط بـ routes.js و db.js
                for (const file of apiFiles) {
                    if (file !== 'routes.js') {
                        try { await fs.unlink(path.join(apiDir, file)); } catch(e) {}
                    }
                }
                io.to(roomName).emit('log', { message: `📦 [DEPLOY]: تم دمج ${apiFiles.length} API في ملف واحد` });
            }
        }
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
            let errorMsg = result?.error?.message || `خطأ HTTP ${response.status}`;
            // 🩺 تشخيص أوضح لأخطاء الصلاحية بدل "Not authorized" الغامضة
            if (response.status === 401 || response.status === 403 || /not authorized|forbidden|invalid token/i.test(errorMsg)) {
                errorMsg = `${errorMsg} — صلاحية Vercel مرفوضة. تحقّق أن VERCEL_TOKEN صالح وغير منتهٍ، `
                    + (VERCEL_TEAM_ID
                        ? `وأن التوكن يملك صلاحية الفريق (VERCEL_TEAM_ID=${VERCEL_TEAM_ID}).`
                        : `وإن كان حسابك ضمن Team فاضبط VERCEL_TEAM_ID (وإلا احذفه).`);
            }
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
