/**
 * 🎨 Render Deploy Agent — JAOLA OS
 *
 * ينشر المشروع على Render.com تلقائياً:
 * - يُنشئ render.yaml
 * - يُوفّر تعليمات النشر
 * - يدعم Static Sites وWeb Services
 */

import { slugPart, nameFingerprint } from '../services/hostNames.js';

// ═══════════════════════════════════════════════════════
// 🏷️ اسم خدمة Render — مصدر الاشتقاق الواحد
// ═══════════════════════════════════════════════════════
//
// هذا الاسم **هوية**: يدخل `render.yaml` حرفياً (`generateRenderConfig`
// لا يطهّره)، ويصير اسم المضيف `https://<الاسم>.onrender.com`. وكان
// يُشتقّ في ستة مواضع بصيغتين متعارضتين:
//
//   • `_stageRenderConfig`: `${username}-${slug(project)}` — يطهّر
//     المشروع وحده، فتبقى الشرطة السفلية في اسم المستخدم.
//   • الخمسة الباقية: `slug(`${username}-${project}`)` — تطهّرهما معاً.
//
// وأسماء المستخدمين تسمح بـ`_` (`^[a-zA-Z][a-zA-Z0-9_\-]{2,19}$`)،
// **وضيف النظام اسمه `guest_user` حرفياً** — فالتعارض ليس احتمالاً:
// المسار الأول يكتب `guest_user-…` والباقي يستعمل `guest-user-…`،
// أي هويتان لمشروعٍ واحد.
//
// وكلتاهما كانت تُنتج أسماءً **ليست أسماء مضيف صالحة**: الشرطة السفلية
// ممنوعة في DNS، والاسم العربي يتحوّل إلى شرطات متتالية وطرفية
// (`ali------`). فالتوحيد هنا لا يكفي — لا بدّ من طيّ الشرطات وقصّ
// أطرافها بعد الاقتطاع، وبديلٍ حين لا يبقى محرف صالح.
const MAX_SERVICE_NAME = 50;
const MAX_USER_PART = 20; // سقف تسجيل اسم المستخدم نفسه — فلا يقتطع اسماً حقيقياً

// 🔑 التطهير والبصمة في `services/hostNames.js`: اسمُ مشروع Vercel كان
// يقع في العطب نفسه حرفياً، فلا تُكتب البدائيّتان هنا وهناك.
export function renderServiceName(username, project) {
    const user = slugPart(username).slice(0, MAX_USER_PART) || 'user';
    const proj = slugPart(project) || nameFingerprint(project);
    return `${user}-${proj}`.slice(0, MAX_SERVICE_NAME).replace(/-+$/g, '') || 'jaola-app';
}

// ═══════════════════════════════════════════════════════
// 📄 توليد render.yaml
// ═══════════════════════════════════════════════════════
export function generateRenderConfig(projectName, hasBackend = false) {
    if (!hasBackend) {
        // Static Site
        return `services:
  - type: web
    name: ${projectName}
    env: static
    buildCommand: echo "No build needed"
    staticPublishPath: .
    routes:
      - type: rewrite
        source: /*
        destination: /index.html`;
    }

    // Web Service مع Node.js
    return `services:
  - type: web
    name: ${projectName}
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: MONGODB_URI
        sync: false
      - key: PORT
        value: 10000`;
}

// ═══════════════════════════════════════════════════════
// 🖥️ نقطة تشغيل الخادم الدائم — Express يخدم الواجهة + يركّب دوال api/
// ديناميكياً + يتصل بـ MongoDB. لا حدّ دوال، native يعمل، اتصال DB دائم.
// (يحلّ محلّ Serverless الذي اصطدم بحدّ Vercel Hobby: 12 دالة.)
// ═══════════════════════════════════════════════════════
export function generateServerEntry() {
    return `import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync, readdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// 🛡️ ترويسات الأمان — تُكتب هنا لأن هذا هو مَن يُنشئ الملف.
// (كانت في autoFixSecurity، وهو يعمل في مرحلة الأمان قبل إنشاء هذا
//  الملف بستّ مراحل، فلم تكن تُضاف قطّ — انظر CONTRACTS.md / Sprint 2m)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 🔌 اتصال قاعدة البيانات (اختياري — يعمل الموقع بدونها لكن بلا حفظ)
if (process.env.MONGODB_URI) {
  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (e) { console.error('⚠️ MongoDB error:', e.message); }
}

// 🧩 تركيب كل دوال api/ تلقائياً (بلا حدّ عدد) — كل ملف = مسار /api/<اسمه>
const apiDir = path.join(__dirname, 'api');
const HELPERS = ['db.js', 'schema.js', 'seed.js', 'connection.js', 'index.js'];
if (existsSync(apiDir)) {
  for (const file of readdirSync(apiDir).filter(f => /\\.(js|mjs)$/.test(f) && !HELPERS.includes(f) && !f.startsWith('_'))) {
    try {
      const mod = await import(pathToFileURL(path.join(apiDir, file)).href);
      const handler = mod.default;
      if (typeof handler === 'function') {
        const route = '/api/' + file.replace(/\\.(js|mjs)$/, '');
        app.all(route, (req, res) => handler(req, res));
        app.all(route + '/*', (req, res) => handler(req, res));
      }
    } catch (e) { console.error('⚠️ فشل تحميل', file, e.message); }
  }
}

// 🖼️ الواجهة الثابتة (index.html وأصولها) — نفس الأصل، بلا CORS
app.use(express.static(__dirname));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('🚀 Server running on port ' + PORT));
`;
}

// ═══════════════════════════════════════════════════════
// 🔗 رابط "Deploy to Render" بضغطة واحدة (نصف-أتمتة، بلا مفتاح API)
// Render ينشر من مستودع GitHub فقط ويقرأ render.yaml تلقائياً، ويُعيد
// النشر مع كل دفعة جديدة. هذا يزيل حدّ Vercel Hobby (12 دالة) نهائياً.
// ═══════════════════════════════════════════════════════
export function buildRenderDeployUrl(repoUrl, branch = 'main') {
    if (!repoUrl || !/^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(repoUrl)) return null;
    // نطاق GitHub نظيف بلا .git ولا شرطة أخيرة
    const clean = repoUrl.replace(/\.git$/i, '').replace(/\/+$/, '');
    let url = `https://render.com/deploy?repo=${encodeURIComponent(clean)}`;
    if (branch && branch !== 'main') url += `&branch=${encodeURIComponent(branch)}`;
    return url;
}

// ═══════════════════════════════════════════════════════
// 🖥️ نشر full-stack على Render (خادم دائم): يجهّز الملفات، يدفع إلى
// GitHub، ثم يُعطي رابط النشر بضغطة واحدة. حقن التبعيات (pushProject/
// getIntegration) يُبقي الدالة قابلة للاختبار بلا قاعدة بيانات.
// ═══════════════════════════════════════════════════════
export async function deployToRender(
    { projectPath, projectName, username, activeProject, hasBackend = true },
    io,
    roomName,
    deps = {}
) {
    const emit = (message) => { try { io?.to?.(roomName)?.emit('log', { message }); } catch { /* بث اختياري */ } };

    // 1) جهّز server.js + render.yaml فعلياً في مجلد المشروع
    const prep = await prepareRenderDeploy(projectPath, projectName, hasBackend);
    if (!prep.success) return { success: false, error: `تعذّر تجهيز إعداد Render: ${prep.error}` };
    emit(`🖥️ [Render]: جُهّز الخادم الدائم (${prep.summary})`);

    // 2) Render ينشر من GitHub — تأكّد من وجود مستودع مرتبط ثم ادفع
    const githubSync = (deps.pushProject && deps.getIntegration)
        ? deps
        : await import('../services/githubSync.js');
    const integration = await githubSync.getIntegration(username, activeProject);
    if (!integration?.repoUrl) {
        return {
            success: false,
            needsGitHub: true,
            error: 'اربط المشروع بمستودع GitHub أولاً — Render ينشر من GitHub. افتح إعدادات GitHub في الداش.',
        };
    }

    emit('🐙 [Render]: رفع أحدث نسخة إلى GitHub قبل النشر...');
    const push = await githubSync.pushProject(username, activeProject, projectPath);
    if (!push.success) return { success: false, error: `فشل الدفع إلى GitHub: ${push.error}` };

    // 3) رابط النشر بضغطة واحدة
    const deployUrl = buildRenderDeployUrl(integration.repoUrl, integration.branch);
    if (!deployUrl) return { success: false, error: 'رابط مستودع GitHub غير صالح.' };

    return { success: true, deployUrl, repoUrl: integration.repoUrl, branch: integration.branch || 'main' };
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function prepareRenderDeploy(projectPath, projectName, hasBackend = false) {
    const fs = await import('fs');
    const path = await import('path');

    const files = [];

    // render.yaml
    files.push({
        name: 'render.yaml',
        content: generateRenderConfig(projectName, hasBackend)
    });

    // 🖥️ server.js — نقطة التشغيل (فقط للخادم؛ الموقع الثابت لا يحتاجه)
    // render.yaml يستدعي "node server.js"، فبدونه يفشل التشغيل.
    if (hasBackend) {
        files.push({ name: 'server.js', content: generateServerEntry() });
    }

    // README للنشر
    files.push({
        name: 'RENDER_README.md',
        content: `# نشر على Render

## خطوات النشر:
1. ارفع المشروع على GitHub
2. افتح [render.com](https://render.com)
3. اضغط **"New +"** → **"Web Service"**
4. اربطه بـ GitHub repo
5. اختر المجلد: \`/\`
6. Render سيكتشف \`render.yaml\` تلقائياً

## متغيرات البيئة:
- \`MONGODB_URI\` — رابط MongoDB Atlas
- \`JWT_SECRET\` — مفتاح سري للـ JWT
- \`STRIPE_SECRET_KEY\` — مفتاح Stripe (إذا مطلوب)

## رابط مجاني:
سيُعطيك Render رابطاً مثل: \`https://${projectName}.onrender.com\``
    });

    // حفظ الملفات
    try {
        const { promises: fsp } = fs;
        const pathMod = path.default || path;

        for (const file of files) {
            const filePath = pathMod.join(projectPath, file.name);
            await fsp.mkdir(pathMod.dirname(filePath), { recursive: true });
            await fsp.writeFile(filePath, file.content);
        }

        return {
            success: true,
            files: files.map(f => f.name),
            summary: `Render config جاهز — ${files.length} ملف`
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
