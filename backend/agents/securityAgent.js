/**
 * 🔐 Security Agent — JAOLA OS
 *
 * يفحص ويُصلح مشاكل الأمان:
 * - XSS — يكشف innerHTML غير آمن
 * - Secrets في الكود — يكشف API keys مكشوفة
 * - CORS — يتحقق من إعداد صحيح
 * - .env — يتحقق أن الـ secrets في .env وليس في الكود
 * - Headers أمان — يُضيف security headers
 */

// ═══════════════════════════════════════════════════════
// 🔍 فحوصات الأمان
// ═══════════════════════════════════════════════════════
export function runSecurityChecks(files) {
    const issues = [];
    const warnings = [];

    for (const file of files) {
        if (!file.content) continue;
        const content = file.content;
        const name = file.name;

        // فحص XSS
        if (name.endsWith('.js') || name.endsWith('.html')) {
            const xssPatterns = content.match(/innerHTML\s*=\s*[^'"`][^;]*/g) || [];
            if (xssPatterns.length > 0) {
                warnings.push({ file: name, type: 'XSS', msg: `${xssPatterns.length} استخدام لـ innerHTML — قد يُسبب XSS` });
            }

            // eval() خطير
            if (/\beval\s*\(/.test(content)) {
                issues.push({ file: name, type: 'DANGEROUS', msg: 'استخدام eval() — خطير جداً' });
            }
        }

        // فحص Secrets مكشوفة في JS
        if (name.endsWith('.js') && !name.includes('.env')) {
            const secretPatterns = [
                { pattern: /sk_live_[a-zA-Z0-9]+/, name: 'Stripe Live Key' },
                { pattern: /sk_test_[a-zA-Z0-9]+/, name: 'Stripe Test Key' },
                { pattern: /AIza[0-9A-Za-z-_]{35}/, name: 'Google API Key' },
                { pattern: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/, name: 'Firebase Key' },
                { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Token' },
            ];

            for (const { pattern, name: secretName } of secretPatterns) {
                if (pattern.test(content)) {
                    issues.push({ file: name, type: 'SECRET_EXPOSED', msg: `${secretName} مكشوف في الكود!` });
                }
            }

            // كلمات مرور hardcoded
            if (/password\s*=\s*['"][^'"]{4,}['"]/.test(content) && !content.includes('process.env')) {
                warnings.push({ file: name, type: 'HARDCODED_SECRET', msg: 'كلمة مرور hardcoded في الكود' });
            }
        }

        // فحص CORS في الـ API files
        if (name.startsWith('api/') && name.endsWith('.js')) {
            if (!content.includes('cors') && content.includes('res.json')) {
                warnings.push({ file: name, type: 'CORS', msg: 'CORS غير مُضبط في API route' });
            }
        }

        // فحص SQL Injection (إذا كان هناك raw queries)
        if (/\$\{.*req\.(body|params|query)/.test(content)) {
            issues.push({ file: name, type: 'SQL_INJECTION', msg: 'محتمل SQL Injection — استخدم parameterized queries' });
        }
    }

    const score = Math.max(0, 100 - (issues.length * 15) - (warnings.length * 5));
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';

    return { issues, warnings, score, grade };
}

// ═══════════════════════════════════════════════════════
// 📌 كان هنا autoFixSecurity: مُصلِحٌ وحيدُ الفرع، يضيف ترويسات الأمان
// إلى server.js. وقد قِيس بالتشغيل فلم يغيّر شيئاً قطّ — لا لأن منطقه
// خطأ (لو عُرض عليه الملفُّ لأصلحه)، بل لأن **الترتيب** يمنعه: مرحلة
// الأمان رقم 170 في DELIVERY_STAGES، وserver.js لا يُنشأ إلا في
// render-config رقم 176. فالمُصلِح يسبق وجودَ ما يُصلح بستّ مراحل.
//
// فنُقلت الترويسات إلى generateServerEntry في renderAgent — إلى مَن
// يكتب الملف. ولم يُترك مُصلِحٌ يُنادى ولا يفعل، ولا `fixedFiles` تُسنَد
// إلى plan.files وهي نسخةٌ بلا تغيير.
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// 📄 توليد .env.example محسّن
// ═══════════════════════════════════════════════════════
export function generateEnvExample(files) {
    const allCode = files.map(f => f.content || '').join('\n');
    const envVars = new Set();

    // كشف process.env.XXX
    const matches = allCode.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
    for (const match of matches) {
        envVars.add(match[1]);
    }

    if (envVars.size === 0) return null;

    const comments = {
        'JWT_SECRET': '# مفتاح سري للـ JWT — يجب أن يكون عشوائياً وطويلاً',
        'MONGODB_URI': '# رابط MongoDB Atlas: mongodb+srv://...',
        'DATABASE_URL': '# رابط PostgreSQL: postgresql://user:pass@host:5432/db',
        'STRIPE_SECRET_KEY': '# مفتاح Stripe السري: sk_live_... أو sk_test_...',
        'STRIPE_PUBLISHABLE_KEY': '# مفتاح Stripe العام: pk_live_...',
        'GOOGLE_CLIENT_ID': '# من Google Cloud Console',
        'GOOGLE_CLIENT_SECRET': '# من Google Cloud Console',
        'NODE_ENV': '# production أو development',
        'PORT': '# منفذ الخادم (افتراضي: 4000)',
    };

    let content = '# متغيرات البيئة — انسخ هذا الملف إلى .env واملأ القيم\n# لا ترفع .env على GitHub!\n\n';

    for (const varName of envVars) {
        if (comments[varName]) content += `${comments[varName]}\n`;
        content += `${varName}=\n\n`;
    }

    return content;
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function runSecurity(files) {
    const checks = runSecurityChecks(files);

    // توليد .env.example محسّن
    const envExample = generateEnvExample(files);
    const newFiles = [];
    if (envExample) {
        newFiles.push({ name: '.env.example', content: envExample });
    }

    // إضافة .gitignore إذا لم يكن موجوداً
    const hasGitignore = files.some(f => f.name === '.gitignore');
    if (!hasGitignore) {
        newFiles.push({
            name: '.gitignore',
            content: `.env\nnode_modules/\n.DS_Store\n*.log\ndist/\n.next/\n.backups/\nprisma/dev.db`
        });
    }

    return {
        success: true,
        grade: checks.grade,
        score: checks.score,
        issues: checks.issues.length,
        warnings: checks.warnings.length,
        newFiles,
        summary: `Security ${checks.grade} (${checks.score}/100) — ${checks.issues.length} مشكلة، ${checks.warnings.length} تحذير`
    };
}
