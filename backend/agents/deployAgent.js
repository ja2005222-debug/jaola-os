import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import Project from '../models/Project.js';
import { generatePackageJson } from './dependencyAgent.js';

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
async function collectProjectFiles(projectPath, { includeApi = false } = {}) {
    const files = [];

    async function walk(dir, relativePath = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            // تجاهل مجلدات النظام الداخلية وليست جزءاً من الموقع المنشور.
            // 🆕 full-stack: نُبقي api/ (دوال Serverless) — كانت تُجرَّد فلا يُنشر خادم.
            const skipApi = !includeApi && entry.name === 'api';
            if (entry.name === '.backups' || entry.name === 'node_modules' || entry.name.startsWith('.') || skipApi || entry.name === 'AUTH_README.md') {
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
 * 🧩 يضمن نشراً ثابتاً صحيحاً — يمنع عطل 404 من محاولة Vercel بناء مشروع
 * فيه package.json بدل خدمة صفحات HTML الجاهزة. دالة نقية قابلة للاختبار:
 * تُرجع قائمة الملفات مع vercel.json الثابت مضافاً (إن لزم).
 * @throws إذا لم يوجد أي HTML في الجذر
 */
export function ensureStaticDeploy(files) {
    const rootHtml = files.filter(f => /^[^/]+\.html$/i.test(f.file));
    const hasIndex = rootHtml.some(f => f.file.toLowerCase() === 'index.html');
    if (!hasIndex && rootHtml.length === 0) {
        throw new Error('لا يوجد ملف HTML في جذر المشروع لنشره — تأكد من بناء الموقع أولاً.');
    }
    if (files.some(f => f.file === 'vercel.json')) return files;

    const cfg = { version: 2, builds: [{ src: '**/*', use: '@vercel/static' }] };
    if (!hasIndex) cfg.routes = [{ src: '/', dest: `/${rootHtml[0].file}` }];
    return [...files, {
        file: 'vercel.json',
        data: Buffer.from(JSON.stringify(cfg)).toString('base64'),
        encoding: 'base64',
    }];
}

/**
 * 📦 يضمن package.json بتبعيات الخادم — بدونه تفشل دوال Serverless في
 * البناء على Vercel (import mongoose/express بلا تعريف) → DEPLOYMENT_NOT_FOUND.
 * يكتشف التبعيات من كود المشروع فعلياً.
 * يُعيد توليد ملفنا التلقائي (يحمل بصمة "JAOLA OS —") ليلتقط إصلاحات الكشف؛
 * لكن يحترم package.json كتبه المستخدم/قالب حقيقي.
 * @returns {Promise<boolean>} true إن وُلّد/جُدّد
 */
export async function ensurePackageJson(projectPath, projectName) {
    const pkgPath = path.join(projectPath, 'package.json');
    if (fsSync.existsSync(pkgPath)) {
        // ملفنا التلقائي فقط يُعاد توليده (قد يكون من محاولة سابقة مكسورة)؛
        // ملف حقيقي (Next/قالب) يُترك — نشره كدوال ليس مساره أصلاً.
        try {
            const existing = JSON.parse(fsSync.readFileSync(pkgPath, 'utf8'));
            const isOurs = typeof existing.description === 'string' && existing.description.includes('JAOLA OS');
            if (!isOurs) return false;
        } catch { return false; } // JSON تالف — لا نلمسه بأمان
    }

    const codeFiles = [];
    async function walk(dir, rel = '') {
        let entries = [];
        try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (e.name === 'node_modules' || e.name === '.backups' || e.name.startsWith('.')) continue;
            const fp = path.join(dir, e.name);
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) await walk(fp, r);
            else if (/\.(js|mjs)$/.test(e.name)) {
                try { codeFiles.push({ name: r, content: await fs.readFile(fp, 'utf8') }); } catch { }
            }
        }
    }
    await walk(projectPath);

    const pkg = generatePackageJson(projectName || 'jaola-app', codeFiles, 'web');
    await fs.writeFile(pkgPath, pkg);
    return true;
}

/**
 * ⚙️ هل المشروع full-stack؟ — يملك دوال Serverless حقيقية في api/.
 * (ملفات البيانات db.js/schema.js/seed.js وحدها ليست دوالاً — نتجاهلها.)
 */
export function isFullStackProject(projectPath) {
    const apiDir = path.join(projectPath, 'api');
    if (!fsSync.existsSync(apiDir)) return false;
    try {
        return fsSync.readdirSync(apiDir)
            .some(f => /\.(js|mjs|ts)$/.test(f) && !['db.js', 'schema.js', 'seed.js', 'connection.js'].includes(f));
    } catch { return false; }
}

/**
 * 🧩 يضمن نشر full-stack صحيحاً — يبقي api/ كدوال Serverless ولا يفرض
 * @vercel/static (الذي يعطّل الدوال). دالة نقية قابلة للاختبار:
 * - يتطلب index.html في الجذر (وإلا خطأ واضح)
 * - يحترم vercel.json موجوداً (المولّد يُنتج rewrites صحيحة)
 * - وإلا يضيف vercel.json برواسم توجيه: /api/* للدوال، والباقي للصفحات
 *   (rewrites الحديثة تُطبَّق بعد الملفات الثابتة، فلا تُكسر styles.css/الصفحات)
 * @throws إذا لم يوجد index.html في الجذر
 */
export function ensureFullStackDeploy(files) {
    const hasIndex = files.some(f => /^index\.html$/i.test(f.file));
    if (!hasIndex) {
        throw new Error('لا يوجد index.html في جذر المشروع — الواجهة مطلوبة مع الخادم.');
    }
    if (files.some(f => f.file === 'vercel.json')) return files;

    // توجيه صالح في Vercel (path-to-regexp): الدوال في api/ تُطابَق أولاً
    // تلقائياً، والملفات الثابتة تُخدَم قبل الـ rewrites، فهذا مجرد fallback
    // للمسارات غير الموجودة. (النمط السابق بـ negative-lookahead كان يرفضه
    // Vercel فيفشل البناء → DEPLOYMENT_NOT_FOUND.)
    const cfg = {
        rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    };
    return [...files, {
        file: 'vercel.json',
        data: Buffer.from(JSON.stringify(cfg)).toString('base64'),
        encoding: 'base64',
    }];
}

/**
 * 🔎 يجلب أسطر الخطأ الفعلية من سجلّ بناء Vercel — يحوّل "exited with 1"
 * الغامضة إلى السبب الحقيقي (أي حزمة/سطر فشل).
 */
async function fetchBuildErrorLogs(deploymentId) {
    const teamQuery = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : '';
    try {
        const res = await fetch(`${VERCEL_API}/v3/deployments/${deploymentId}/events?direction=backward&limit=200${teamQuery}`, {
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        });
        const body = await res.json().catch(() => null);
        const events = Array.isArray(body) ? body : (body?.events || []);
        const lines = events
            .map(e => (e?.payload?.text || e?.text || '').toString().trim())
            .filter(Boolean)
            .filter(t => /error|err!|npm err|not found|cannot find|failed|no matching version|E404|ENOENT/i.test(t));
        // آخر 4 أسطر خطأ ذات دلالة (بلا تكرار)، مختصرة
        const uniq = [...new Set(lines)].slice(-4);
        return uniq.join(' | ').slice(0, 500);
    } catch { return ''; }
}

/**
 * ⏳ يراقب حالة بناء النشر حتى READY أو ERROR (أو مهلة). يمنع تسليم رابط
 * لنشرة ما زالت تُبنى أو فشلت (سبب DEPLOYMENT_NOT_FOUND).
 * @returns {Promise<{readyState:string, errorMessage?:string}|null>}
 */
async function waitForDeployment(deploymentId, roomName, io, { attempts = 30, intervalMs = 4000 } = {}) {
    const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    for (let i = 0; i < attempts; i++) {
        await new Promise(r => setTimeout(r, intervalMs));
        try {
            const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery}`, {
                headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
            });
            const d = await res.json().catch(() => ({}));
            const state = d?.readyState || d?.status;
            if (state === 'READY') return { readyState: 'READY' };
            if (state === 'ERROR' || state === 'CANCELED') {
                // نجلب سجلّ البناء الحقيقي — "exited with 1" وحدها لا تكفي للتشخيص
                const logDetail = await fetchBuildErrorLogs(deploymentId).catch(() => '');
                return { readyState: 'ERROR', errorMessage: [d?.errorMessage || d?.error?.message, logDetail].filter(Boolean).join(' — ') };
            }
            // QUEUED / BUILDING / INITIALIZING → نواصل الانتظار
        } catch { /* شبكة — نعيد المحاولة */ }
    }
    return null; // مهلة — لا نُفشل، نترك الرابط (قد يكتمل بعد قليل)
}

/**
 * 🔗 يختار الرابط النظيف الثابت للموقع المنشور.
 *
 * مشكلة الرابط الطويل: ردّ Vercel الفوري يعطي غالباً رابط النشرة المُجزّأ
 * (name-<hash>-<team>.vercel.app) الذي يتغيّر كل نشرة، بينما نطاق الإنتاج
 * الثابت (<name>.vercel.app) يُسنَد لاحقاً وقد لا يصل في الرد.
 * الحل: نفضّل alias إنتاج نظيفاً إن وصل، وإلا نبنيه حتمياً من اسم المشروع.
 *
 * @param {object} result رد Vercel (قد يحوي alias[] و url)
 * @param {string} projectName اسم مشروع Vercel المعروف
 * @returns {string} النطاق النظيف (بلا https://)
 */
export function cleanDeployUrl(result, projectName) {
    // رابط نشرة مُجزّأ: يحوي مقطع hash طويلاً بين شرطتين
    const isHashed = (u) => /-[a-z0-9]{8,}-/i.test(u);
    const aliases = Array.isArray(result?.alias) ? result.alias.filter(a => typeof a === 'string') : [];
    const cleanAlias = aliases.find(a => !isHashed(a));
    if (cleanAlias) return cleanAlias;
    // لا alias نظيف في الرد → نطاق الإنتاج الحتمي من اسم المشروع
    if (projectName) return `${projectName}.vercel.app`;
    return result?.url || '';
}

/**
 * 🚀 نشر مشروع على Vercel عبر REST API مباشرة (بدون CLI، بدون exec)
 * @param {object} params - { projectPath, activeProject, currentUser }
 * @param {object} io - Socket.io instance للبث الحي
 * @param {function} emitUserProjects - دالة لإعادة بث قائمة مشاريع المستخدم بعد التحديث
 */
export async function deployProject({ projectPath, activeProject, currentUser, env = {} }, io, emitUserProjects) {
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
        // ⚙️ full-stack؟ → نُبقي api/ ونستخدم إعداد Serverless بدل الثابت
        const fullStack = isFullStackProject(projectPath);
        if (fullStack) {
            // 📦 ضمان package.json بالتبعيات — بدونه تفشل الدوال في البناء
            const created = await ensurePackageJson(projectPath, `${currentUser}-${activeProject}`).catch(() => false);
            if (created) io.to(roomName).emit('log', { message: '📦 [DEPLOY]: وُلّد package.json بتبعيات الخادم (كان مفقوداً).' });
        }
        const files = await collectProjectFiles(projectPath, { includeApi: fullStack });

        if (files.length === 0) {
            throw new Error('لا توجد ملفات قابلة للنشر في هذا المشروع.');
        }

        // full-stack: يبقي دوال Serverless (api/) ولا يفرض @vercel/static.
        // static: يثبّت الخدمة الثابتة (إصلاح 404 من محاولة Vercel بناء المشروع).
        const deployFiles = fullStack ? ensureFullStackDeploy(files) : ensureStaticDeploy(files);
        if (fullStack) {
            io.to(roomName).emit('log', { message: '⚙️ [DEPLOY]: مشروع full-stack — نشر الخادم (Serverless) مع الواجهة.' });
            if (!env.MONGODB_URI && !env.DATABASE_URL) {
                io.to(roomName).emit('log', { message: '⚠️ [DEPLOY]: لا يوجد MONGODB_URI في أسرار المشروع — الواجهة والخادم سيعملان، لكن حفظ البيانات (الطلبات/الأصناف) لن يعمل حتى تضيف رابط قاعدة MongoDB. أنشئ قاعدة مجانية من MongoDB Atlas وأضِف MONGODB_URI في أسرار المشروع.' });
            } else {
                io.to(roomName).emit('log', { message: '🗄️ [DEPLOY]: قاعدة البيانات مربوطة — البيانات ستُحفظ فعلياً.' });
            }
        }

        // اسم مشروع صالح في Vercel: أحرف صغيرة وأرقام وشرطات فقط
        const vercelProjectName = `${currentUser}-${activeProject}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 100);

        io.to(roomName).emit('log', { message: `📡 [DEPLOY]: جاري الرفع إلى Vercel (${deployFiles.length} ملف)...` });

        const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
        const response = await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: vercelProjectName,
                files: deployFiles,
                target: 'production',
                // متغيّرات البيئة للنشر (مثل MONGODB_URI لمشاريع full-stack) —
                // تُحقن في دوال Serverless. v13 يقبلها كـ key-value مباشر.
                ...(Object.keys(env).length ? { env } : {}),
                projectSettings: {
                    framework: null, // لا framework — الثابت يُخدَم كما هو، ودوال api/ تُكتشف تلقائياً
                }
            })
        });

        const result = await response.json();

        // ⏳ ننتظر اكتمال البناء فعلياً — v13 يقبل النشر (200) ثم يبني لاحقاً،
        // وقد يفشل (خاصة full-stack بدوال Serverless). بلا انتظار نعطي رابطاً
        // لنشرة فاشلة → DEPLOYMENT_NOT_FOUND. نراقب readyState حتى READY/ERROR.
        if (response.ok && result?.id && fullStack) {
            io.to(roomName).emit('log', { message: '⏳ [DEPLOY]: جاري بناء الخادم على Vercel (قد يستغرق دقيقة)...' });
            const build = await waitForDeployment(result.id, roomName, io);
            if (build && build.readyState === 'ERROR') {
                throw new Error(`فشل بناء النشر على Vercel: ${build.errorMessage || 'راجع سجلّ Vercel'}. `
                    + 'غالباً دالة Serverless بها خطأ أو تبعية ناقصة في package.json.');
            }
        }

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

        // الرابط النظيف الثابت — يبقى ثابتاً عبر عمليات النشر المتتالية
        const vercelProductionUrl = `https://${cleanDeployUrl(result, vercelProjectName)}`;

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
