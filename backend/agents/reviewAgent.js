/**
 * 🔍 Review Agent — JAOLA OS
 *
 * يراجع الكود المُنتج بعد البناء ويتحقق من:
 * - Clean Code (لا كود مكرر، لا متغيرات غير مستخدمة)
 * - Accessibility (alt للصور، labels للنماذج)
 * - Performance (تحسين الصور، lazy loading)
 * - Security (لا XSS، لا بيانات حساسة مكشوفة)
 * - Arabic RTL (dir=rtl، خطوط عربية، محاذاة صحيحة)
 *
 * يُنتج تقرير مختصر ويُصلح المشاكل البسيطة تلقائياً.
 */

import { groq, smartChat } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔎 فحوصات ثابتة (بدون AI)
// ═══════════════════════════════════════════════════════
export function runStaticReview(files) {
    const issues = [];
    const fixes = [];

    for (const file of files) {
        if (!file.content) continue;
        const content = file.content;
        const name = file.name;

        if (name === 'index.html' || name.endsWith('.html')) {
            // فحص RTL
            if (!content.includes('dir="rtl"') && !content.includes("dir='rtl'")) {
                issues.push({ file: name, type: 'rtl', msg: 'مفقود dir="rtl" على <html>' });
            }

            // فحص viewport
            if (!content.includes('viewport')) {
                issues.push({ file: name, type: 'responsive', msg: 'مفقود meta viewport' });
            }

            // فحص charset
            if (!content.includes('charset')) {
                issues.push({ file: name, type: 'charset', msg: 'مفقود meta charset' });
            }

            // فحص alt للصور
            const imgWithoutAlt = (content.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
            if (imgWithoutAlt > 0) {
                issues.push({ file: name, type: 'accessibility', msg: `${imgWithoutAlt} صورة بدون alt` });
            }

            // فحص Google Fonts
            if (!content.includes('fonts.googleapis.com')) {
                issues.push({ file: name, type: 'fonts', msg: 'لا يوجد خط عربي من Google Fonts' });
            }

            // فحص title
            if (!content.includes('<title>') || content.includes('<title></title>')) {
                issues.push({ file: name, type: 'seo', msg: 'عنوان الصفحة فارغ أو مفقود' });
            }
        }

        if (name === 'styles.css') {
            // فحص تباين الألوان — نص فاتح على خلفية فاتحة
            const hasDarkBg = content.includes('--bg: #0') || content.includes('--bg:#0') || content.includes('background: #0') || content.includes('background:#0');
            const hasDarkText = content.includes('color: #0') || content.includes('color:#0') || content.includes('--text: #0');
            if (hasDarkBg && hasDarkText) {
                issues.push({ file: name, type: 'contrast', msg: 'تباين ألوان ضعيف — نص داكن على خلفية داكنة' });
            }
            // فحص CSS Variables
            if (!content.includes(':root') || !content.includes('--')) {
                issues.push({ file: name, type: 'maintainability', msg: 'لا يستخدم CSS Variables في :root' });
            }

            // فحص responsive
            if (!content.includes('@media')) {
                issues.push({ file: name, type: 'responsive', msg: 'لا يوجد @media queries للتجاوب' });
            }
        }

        if (name === 'script.js') {
            // فحص console.log في الإنتاج
            const consoleLogs = (content.match(/console\.log/g) || []).length;
            if (consoleLogs > 3) {
                issues.push({ file: name, type: 'cleanup', msg: `${consoleLogs} console.log يجب إزالتها` });
            }

            // فحص var (استخدم let/const)
            const varCount = (content.match(/\bvar\b/g) || []).length;
            if (varCount > 0) {
                issues.push({ file: name, type: 'modern-js', msg: `استخدام var (${varCount} مرة) — استخدم let/const` });
            }
        }
    }

    // حساب النتيجة
    const score = Math.max(0, 100 - (issues.length * 8));
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';

    return { issues, score, grade, fixable: issues.filter(i => ['rtl', 'charset', 'viewport'].includes(i.type)) };
}

// ═══════════════════════════════════════════════════════
// 🤖 مراجعة AI للجودة العامة
// ═══════════════════════════════════════════════════════
export async function runAIReview(files, projectGoal) {
    const htmlFile = files.find(f => f.name === 'index.html');
    const cssFile = files.find(f => f.name === 'styles.css');

    if (!htmlFile) return null;

    // نرسل فقط أول 2000 حرف لتوفير الـ tokens
    const snippet = `HTML:\n${htmlFile.content?.slice(0, 1000)}\n\nCSS:\n${cssFile?.content?.slice(0, 800) || ''}`;

    try {
        const _aiRes = await smartChat([
            { role: 'system', content: 'أنت مراجع كود ويب خبير. أجب بـ JSON فقط.' },
            { role: 'user', content: `راجع هذا الكود للمشروع: "${projectGoal}"\n\n${snippet}\n\nأعطني JSON: { "strengths": ["قوة"], "improvements": ["تحسين"], "overallQuality": "ممتاز" }` }
        ], { max_tokens: 300, temperature: 0.3, json: true });

        return JSON.parse(_aiRes);
    } catch (e) {
        return null;
    }
}

// ═══════════════════════════════════════════════════════
// 🔧 إصلاح تلقائي للمشاكل البسيطة
// ═══════════════════════════════════════════════════════
export function autoFix(files) {
    return files.map(file => {
        if (!file.content) return file;
        let content = file.content;

        if (file.name === 'index.html' || file.name.endsWith('.html')) {
            // إضافة dir=rtl إذا مفقود
            if (!content.includes('dir="rtl"') && !content.includes("dir='rtl'")) {
                content = content.replace('<html', '<html dir="rtl" lang="ar"');
            }

            // إضافة viewport إذا مفقود
            if (!content.includes('viewport') && content.includes('<head>')) {
                content = content.replace('<head>', '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
            }

            // إضافة charset إذا مفقود
            if (!content.includes('charset') && content.includes('<head>')) {
                content = content.replace('<head>', '<head>\n    <meta charset="UTF-8">');
            }

            // إضافة alt للصور بدون alt
            content = content.replace(/<img(?![^>]*alt=)([^>]*)>/gi, '<img$1 alt="صورة">');
        }

        if (file.name === 'script.js') {
            // إزالة console.log الزائدة (أكثر من 3)
            let logCount = 0;
            content = content.replace(/console\.log\([^)]*\);?\n?/g, (match) => {
                logCount++;
                return logCount > 3 ? '' : match;
            });
        }

        return { ...file, content };
    });
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function reviewCode(files, projectGoal) {
    // الفحص الثابت السريع
    const staticResult = runStaticReview(files);

    // الإصلاح التلقائي للمشاكل البسيطة
    const fixedFiles = autoFix(files);

    // مراجعة AI للجودة العامة (اختيارية)
    const aiResult = await runAIReview(fixedFiles, projectGoal);

    return {
        score: staticResult.score,
        grade: staticResult.grade,
        issues: staticResult.issues,
        fixedCount: staticResult.fixable.length,
        strengths: aiResult?.strengths || [],
        improvements: aiResult?.improvements || [],
        overallQuality: aiResult?.overallQuality || (staticResult.grade === 'A' ? 'ممتاز' : 'جيد'),
        fixedFiles,
    };
}
