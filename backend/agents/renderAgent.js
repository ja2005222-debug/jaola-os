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
