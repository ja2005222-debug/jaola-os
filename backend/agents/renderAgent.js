/**
 * 🎨 Render Deploy Agent — JAOLA OS
 *
 * ينشر المشروع على Render.com تلقائياً:
 * - يُنشئ render.yaml
 * - يُوفّر تعليمات النشر
 * - يدعم Static Sites وWeb Services
 */

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
