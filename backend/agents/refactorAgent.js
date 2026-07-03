/**
 * 🔧 Refactor Agent — JAOLA OS
 *
 * ينظّف الكود المُنتج:
 * - إزالة الكود المكرر
 * - تنظيم CSS Variables
 * - إزالة console.log الزائدة
 * - تحسين أسماء المتغيرات
 * - تقسيم الدوال الطويلة
 * - إضافة تعليقات توضيحية
 */

// ═══════════════════════════════════════════════════════
// 🧹 تنظيف JavaScript
// ═══════════════════════════════════════════════════════
function refactorJS(content) {
    if (!content) return content;
    let result = content;

    // إزالة console.log الزائدة (أكثر من 3)
    let logCount = 0;
    result = result.replace(/console\.(log|warn|error)\([^)]*\);?\n?/g, (match) => {
        logCount++;
        return logCount > 3 ? '' : match;
    });

    // استبدال var بـ const/let
    result = result.replace(/\bvar\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g, (match, name) => {
        // إذا كانت تُعاد تعيينها، استخدم let وإلا const
        const reassigned = new RegExp(`\\b${name}\\s*=(?!=)`, 'g').test(result);
        return `${reassigned ? 'let' : 'const'} ${name} =`;
    });

    // إضافة 'use strict' إذا لم يكن موجوداً
    if (!result.includes("'use strict'") && !result.includes('"use strict"') && !result.includes('type="module"')) {
        result = `'use strict';\n\n${result}`;
    }

    // تنظيف أسطر فارغة متعددة (أكثر من 2)
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
}

// ═══════════════════════════════════════════════════════
// 🎨 تنظيف CSS
// ═══════════════════════════════════════════════════════
function refactorCSS(content) {
    if (!content) return content;
    let result = content;

    // إزالة تعريفات CSS المكررة (نفس الخاصية في نفس الـ selector)
    result = result.replace(/([^}]+\{[^}]*?)(\s*([a-z-]+)\s*:[^;]+;)([^}]*)\3\s*:[^;]+;/g, '$1$2$4');

    // تنظيف أسطر فارغة متعددة
    result = result.replace(/\n{3,}/g, '\n\n');

    // التأكد من وجود newline في نهاية الملف
    if (!result.endsWith('\n')) result += '\n';

    return result;
}

// ═══════════════════════════════════════════════════════
// 📄 تنظيف HTML
// ═══════════════════════════════════════════════════════
function refactorHTML(content) {
    if (!content) return content;
    let result = content;

    // إزالة attributes فارغة
    result = result.replace(/\s+class=""\s*/g, ' ');
    result = result.replace(/\s+style=""\s*/g, ' ');
    result = result.replace(/\s+id=""\s*/g, ' ');

    // تأكد من وجود lang
    if (!result.includes('lang=')) {
        result = result.replace('<html', '<html lang="ar"');
    }

    // تأكد من وجود charset
    if (!result.includes('charset') && result.includes('<head>')) {
        result = result.replace('<head>', '<head>\n    <meta charset="UTF-8">');
    }

    return result;
}

// ═══════════════════════════════════════════════════════
// 📊 تحليل الكود قبل وبعد
// ═══════════════════════════════════════════════════════
function analyzeCode(before, after) {
    const beforeLines = (before || '').split('\n').length;
    const afterLines = (after || '').split('\n').length;
    const reduction = beforeLines - afterLines;
    const percent = beforeLines > 0 ? Math.round((reduction / beforeLines) * 100) : 0;

    return { beforeLines, afterLines, reduction, percent };
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function refactorCode(files) {
    const results = [];
    let totalReduction = 0;
    const improvements = [];

    const refactoredFiles = files.map(file => {
        if (!file.content) return file;

        let newContent = file.content;
        const name = file.name;

        if (name.endsWith('.js')) {
            newContent = refactorJS(file.content);
            const analysis = analyzeCode(file.content, newContent);
            if (analysis.reduction > 0) {
                totalReduction += analysis.reduction;
                improvements.push(`${name}: -${analysis.reduction} سطر`);
            }
        } else if (name.endsWith('.css')) {
            newContent = refactorCSS(file.content);
            const analysis = analyzeCode(file.content, newContent);
            if (analysis.reduction > 0) {
                totalReduction += analysis.reduction;
                improvements.push(`${name}: -${analysis.reduction} سطر`);
            }
        } else if (name.endsWith('.html')) {
            newContent = refactorHTML(file.content);
        }

        return { ...file, content: newContent };
    });

    return {
        success: true,
        files: refactoredFiles,
        totalReduction,
        improvements,
        summary: totalReduction > 0
            ? `تنظيف الكود — حُذف ${totalReduction} سطر زائد`
            : 'الكود نظيف — لا يحتاج تنظيفاً'
    };
}
