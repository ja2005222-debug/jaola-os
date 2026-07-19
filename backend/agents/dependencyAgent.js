/**
 * 📦 Dependency Agent — JAOLA OS
 *
 * يُحوّل الوكلاء من "Prompt" إلى "Runtime" حقيقي:
 * - يكشف الـ dependencies من الكود المُنتج
 * - يُولّد package.json كامل
 * - يُولّد install instructions
 * - يعرف ما يحتاجه كل ميزة تلقائياً
 */

// 🚫 حزم تحتاج ترجمة C++ (native) — تفشل على Vercel Serverless (خطأ .lzz/v8).
// نستبعدها؛ البدائل النقية (bcryptjs بدل bcrypt) كافية للنماذج.
const NATIVE_BLOCKLIST = new Set([
    'bcrypt', 'sharp', 'canvas', 'better-sqlite3', 'sqlite3', 'node-sass',
    'grpc', 'bufferutil', 'utf-8-validate', 'node-gyp', 'bignum', 'microtime',
    'sodium', 'sodium-native', 're2', 'zeromq', 'usb', 'serialport',
]);

// 🚫 وحدات Node المدمجة — ليست حزم npm، لا تُضاف للتبعيات أبداً
const NODE_BUILTINS = new Set([
    'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
    'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs',
    'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path',
    'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl',
    'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty',
    'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib', 'async_hooks',
]);

// ═══════════════════════════════════════════════════════
// 📚 خريطة الميزات → dependencies
// ═══════════════════════════════════════════════════════
const FEATURE_DEPENDENCIES = {
    // Authentication
    'jsonwebtoken':     { packages: ['jsonwebtoken'], devPackages: ['@types/jsonwebtoken'], trigger: /jwt|jsonwebtoken|JWT_SECRET/i },
    'bcryptjs':         { packages: ['bcryptjs'], devPackages: ['@types/bcryptjs'], trigger: /bcrypt|hashPassword|comparePassword/i },
    'passport':         { packages: ['passport', 'passport-local'], trigger: /passport\.use|passport\.authenticate/i },

    // Database
    'mongoose':         { packages: ['mongoose'], trigger: /mongoose|Schema|mongoose\.connect/i },
    'prisma':           { packages: ['@prisma/client'], devPackages: ['prisma'], trigger: /PrismaClient|prisma\./i },
    'pg':               { packages: ['pg'], devPackages: ['@types/pg'], trigger: /Pool|Client.*pg|require.*pg/i },

    // Payment
    'stripe':           { packages: ['stripe'], trigger: /stripe|Stripe|STRIPE_SECRET/i },
    'paypal':           { packages: ['@paypal/checkout-server-sdk'], trigger: /paypal|PayPal|PAYPAL/i },

    // File Upload
    'formidable':       { packages: ['formidable'], devPackages: ['@types/formidable'], trigger: /formidable|multipart|file.*upload/i },
    'multer':           { packages: ['multer'], devPackages: ['@types/multer'], trigger: /multer|upload\.single|upload\.fields/i },
    'sharp':            { packages: ['sharp'], trigger: /sharp\(|image.*resize|resize.*image/i },

    // OAuth
    'google-auth':      { packages: ['google-auth-library'], trigger: /OAuth2Client|google-auth|GOOGLE_CLIENT/i },
    'passport-google':  { packages: ['passport-google-oauth20'], trigger: /GoogleStrategy|passport-google/i },

    // Email
    'nodemailer':       { packages: ['nodemailer'], devPackages: ['@types/nodemailer'], trigger: /nodemailer|createTransport|sendMail/i },

    // Caching
    'redis':            { packages: ['redis', 'ioredis'], trigger: /redis|createClient|ioredis/i },

    // Utilities
    'cors':             { packages: ['cors'], devPackages: ['@types/cors'], trigger: /cors\(\)|app\.use.*cors/i },
    'dotenv':           { packages: ['dotenv'], trigger: /dotenv|process\.env|\.config\(\)/i },
    'express':          { packages: ['express'], devPackages: ['@types/express'], trigger: /express\(\)|Router\(\)|app\.get|app\.post/i },
    'axios':            { packages: ['axios'], trigger: /axios\.|axios\.get|axios\.post/i },
    'joi':              { packages: ['joi'], trigger: /Joi\.|joi\.object|joi\.string/i },
    'zod':              { packages: ['zod'], trigger: /z\.|zod|\.parse\(|\.safeParse/i },

    // Real-time
    'socket.io':        { packages: ['socket.io'], trigger: /socket\.io|io\.on|socket\.emit/i },
    'socket.io-client': { packages: ['socket.io-client'], trigger: /io\(|connect.*socket/i },

    // GraphQL
    'graphql':          { packages: ['graphql', 'graphql-http'], trigger: /GraphQL|gql`|typeDefs|resolvers/i },
    'apollo':           { packages: ['@apollo/server'], trigger: /ApolloServer|apollo-server/i },
};

// ═══════════════════════════════════════════════════════
// 🔍 كشف الـ dependencies من الكود
// ═══════════════════════════════════════════════════════
export function detectDependencies(files) {
    const detected = new Set();
    const detectedDev = new Set();

    // دمج كل محتوى الملفات
    const allCode = files
        .filter(f => f.name.endsWith('.js') || f.name.endsWith('.ts'))
        .map(f => f.content || '')
        .join('\n');

    // فحص كل ميزة
    for (const [name, config] of Object.entries(FEATURE_DEPENDENCIES)) {
        if (config.trigger.test(allCode)) {
            config.packages.forEach(p => detected.add(p));
            (config.devPackages || []).forEach(p => detectedDev.add(p));
        }
    }

    // كشف import/require مباشر
    const importMatches = allCode.matchAll(/(?:import\s+.*?from\s+['"]|require\s*\(\s*['"])([^'"./][^'"]*)['"]/g);
    for (const match of importMatches) {
        const spec = match[1];
        // 🚫 وحدات Node المدمجة (crypto/fs/path/node:*) ليست حزم npm — إضافتها
        // للتبعيات تُفشل "npm install" (exit 1) وتُسقط النشر كله.
        if (spec.startsWith('node:') || NODE_BUILTINS.has(spec.split('/')[0])) continue;
        const pkg = spec.split('/')[0]; // مثال: @prisma/client → @prisma
        if (!pkg.startsWith('.') && pkg.length > 1) {
            detected.add(spec.includes('/') ? spec.split('/').slice(0, 2).join('/') : pkg);
        }
    }

    return {
        dependencies: [...detected],
        devDependencies: [...detectedDev],
    };
}

// ═══════════════════════════════════════════════════════
// 📄 توليد package.json
// ═══════════════════════════════════════════════════════
export function generatePackageJson(projectName, files, projectType = 'web') {
    const { dependencies, devDependencies } = detectDependencies(files);

    // إضافة الـ base dependencies
    const baseDeps = {
        'express': '^4.18.2',
        'dotenv': '^16.3.1',
        'cors': '^2.8.5',
    };

    // تحويل قائمة الـ packages إلى object مع versions
    const VERSIONS = {
        'express': '^4.18.2',
        'mongoose': '^8.0.0',
        'jsonwebtoken': '^9.0.2',
        'bcryptjs': '^2.4.3',
        'cors': '^2.8.5',
        'dotenv': '^16.3.1',
        'stripe': '^14.0.0',
        '@prisma/client': '^5.7.0',
        'prisma': '^5.7.0',
        'pg': '^8.11.3',
        'formidable': '^3.5.1',
        'multer': '^1.4.5-lts.1',
        'nodemailer': '^6.9.7',
        'redis': '^4.6.11',
        'ioredis': '^5.3.2',
        'axios': '^1.6.2',
        'joi': '^17.11.0',
        'zod': '^3.22.4',
        'socket.io': '^4.6.2',
        'socket.io-client': '^4.6.2',
        'graphql': '^16.8.1',
        '@apollo/server': '^4.9.5',
        'google-auth-library': '^9.4.1',
        'passport': '^0.7.0',
        'passport-local': '^1.0.0',
        'passport-google-oauth20': '^2.0.0',
        'sharp': '^0.33.1',
        '@paypal/checkout-server-sdk': '^1.0.3',
        'graphql-http': '^1.22.0',
        '@types/express': '^4.17.21',
        '@types/cors': '^2.8.17',
        '@types/jsonwebtoken': '^9.0.5',
        '@types/bcryptjs': '^2.4.6',
        '@types/multer': '^1.4.11',
        '@types/nodemailer': '^6.4.14',
        '@types/pg': '^8.10.9',
        '@types/formidable': '^3.4.5',
    };

    const depsObj = { ...baseDeps };
    dependencies.forEach(pkg => {
        // 🚫 حزم native تحتاج ترجمة C++ — تفشل على Serverless (خطأ .lzz/v8)
        if (NATIVE_BLOCKLIST.has(pkg)) return;
        // ✅ معروفة فقط — تجاهل المجهولة بدل "latest" (قد تكون غير موجودة/native
        // فتُفشل npm install وتُسقط النشر كله)
        if (VERSIONS[pkg]) depsObj[pkg] = VERSIONS[pkg];
    });

    const devDepsObj = { 'nodemon': '^3.0.2' };
    devDependencies.forEach(pkg => {
        if (NATIVE_BLOCKLIST.has(pkg)) return;
        if (VERSIONS[pkg]) devDepsObj[pkg] = VERSIONS[pkg];
    });

    const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    return JSON.stringify({
        name: safeName,
        version: '1.0.0',
        description: `JAOLA OS — ${projectName}`,
        main: 'server.js',
        type: 'module',
        scripts: {
            start: 'node server.js',
            dev: 'nodemon server.js',
            ...(depsObj['prisma'] ? {
                'db:push': 'npx prisma db push',
                'db:seed': 'node prisma/seed.js',
                'db:studio': 'npx prisma studio',
            } : {}),
        },
        dependencies: depsObj,
        devDependencies: devDepsObj,
        engines: { node: '>=18.0.0' },
    }, null, 2);
}

// ═══════════════════════════════════════════════════════
// 📋 توليد install instructions
// ═══════════════════════════════════════════════════════
export function generateInstallInstructions(files, hasPrisma = false) {
    const { dependencies } = detectDependencies(files);

    let instructions = `# تثبيت المشروع

## 1. تثبيت الـ packages
\`\`\`bash
npm install
\`\`\`

## 2. إعداد متغيرات البيئة
\`\`\`bash
cp .env.example .env
# عدّل القيم في .env
\`\`\`
`;

    if (hasPrisma || dependencies.includes('@prisma/client')) {
        instructions += `
## 3. إعداد قاعدة البيانات (Prisma)
\`\`\`bash
npx prisma db push
npx prisma db seed
\`\`\`
`;
    }

    if (dependencies.includes('stripe')) {
        instructions += `
## إعداد Stripe
1. أنشئ حساباً على [stripe.com](https://stripe.com)
2. أضف \`STRIPE_SECRET_KEY\` في .env
3. أضف \`STRIPE_PUBLISHABLE_KEY\` في .env
`;
    }

    if (dependencies.includes('google-auth-library')) {
        instructions += `
## إعداد Google OAuth
1. افتح [Google Cloud Console](https://console.cloud.google.com)
2. أنشئ OAuth 2.0 credentials
3. أضف \`GOOGLE_CLIENT_ID\` في .env
`;
    }

    instructions += `
## 4. تشغيل المشروع
\`\`\`bash
npm run dev
\`\`\`
`;

    return instructions;
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function generateDependencies(files, projectName, projectType) {
    const { dependencies, devDependencies } = detectDependencies(files);
    const hasPrisma = dependencies.includes('@prisma/client') || dependencies.includes('prisma');

    const packageJson = generatePackageJson(projectName, files, projectType);
    const instructions = generateInstallInstructions(files, hasPrisma);

    return {
        success: true,
        files: [
            { name: 'package.json', content: packageJson },
            { name: 'INSTALL.md', content: instructions },
        ],
        detected: dependencies,
        summary: `package.json جاهز — ${dependencies.length} dependency مكتشفة`
    };
}
