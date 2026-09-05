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

import { smartChat } from '../core/providers/llm.js';

// اللغات ذات الاتجاه من اليمين لليسار
const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);
const isRTLLang = (lang) => RTL_LANGS.has((lang || 'en').toLowerCase());

// ═══════════════════════════════════════════════════════
// 🔎 فحوصات ثابتة (بدون AI)
// ═══════════════════════════════════════════════════════
export function runStaticReview(files, lang = 'en') {
    const issues = [];
    const fixes = [];
    const rtl = isRTLLang(lang);

    for (const file of files) {
        if (!file.content) continue;
        const content = file.content;
        const name = file.name;

        if (name === 'index.html' || name.endsWith('.html')) {
            // فحص الاتجاه — فقط للّغات RTL (لا نفرض rtl على الإنجليزية وغيرها)
            if (rtl && !content.includes('dir="rtl"') && !content.includes("dir='rtl'")) {
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

    // 📌 كان هنا `fixable` — تنبّؤٌ بما سيُصلحه autoFix. والتنبّؤ بسلوك دالّةٍ
    // أخرى هو العطب نفسه: autoFix يقول اليوم ما فعله، فلا حاجة لمن يخمّنه.
    return { issues, score, grade };
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
/**
 * 🔧 الإصلاح التلقائي — ويقول **ما فعله**، لا ما يُتوقّع أن يفعله.
 *
 * كان `reviewCode` يبلّغ `fixedCount` من `runStaticReview().fixable`، وهي
 * تنبّؤٌ بسلوك دالّةٍ أخرى. والدالّتان تختلفان: `fixable` ثلاثة أنواع
 * (rtl/charset/viewport) و`autoFix` يُصلح ستّة. فكان يقع الأمران:
 * إصلاحٌ يُحسب ويُرمى، وإصلاحٌ يُبلَّغ ولم يقع. القياسُ في CONTRACTS (2l).
 *
 * @returns {{ files: {name,content}[], fixes: {file:string,type:string}[] }}
 */
export function autoFix(files, lang = 'en') {
    const rtl = isRTLLang(lang);
    const code = (lang || 'en').toLowerCase();
    const dir = rtl ? 'rtl' : 'ltr';
    const altText = rtl ? 'صورة' : 'image';
    const fixes = [];
    const out = files.map(file => {
        if (!file.content) return file;
        let content = file.content;
        const note = (type) => fixes.push({ file: file.name, type });

        // 🆕 إصلاح تباين CSS تلقائياً
        if (file.name === 'styles.css') {
            const hasDarkBg = /--bg[^:]*:\s*#(0[0-2])/i.test(content) || content.includes('--bg-dark');
            if (hasDarkBg && !content.includes('color: #f') && !content.includes('color: white')) {
                const before = content;
                content = content.replace(/(body\s*\{)/, (m) => m + "\n    color: #f1f5f9;");
                if (content !== before) note('contrast');
            }
        }
        if (file.name === 'index.html' || file.name.endsWith('.html')) {
            // ضبط الاتجاه واللغة — كلُّ سمةٍ على حِدة، فقط إن غابت هي.
            // 📌 كان الشرط: لا تلمس شيئاً إن وُجدت **إحداهما**. فصفحةٌ عربية
            // كتب لها المولّد lang="ar" ولم يكتب dir كانت تبقى بلا اتجاه —
            // تُعرَض من اليسار — ويراها المراجعُ عطباً ويمتنع عن إصلاحه.
            // وجودُ lang ليس دليلاً على أن dir قُصد.
            const hasDir = /<html[^>]*\bdir\s*=/.test(content);
            const hasLang = /<html[^>]*\blang\s*=/.test(content);
            if (!hasDir || !hasLang) {
                const add = `${hasDir ? '' : ` dir="${dir}"`}${hasLang ? '' : ` lang="${code}"`}`;
                const before = content;
                content = content.replace(/<html/i, `<html${add}`);
                if (content !== before) note(hasDir ? 'lang' : 'rtl');
            }

            // إضافة viewport إذا مفقود
            if (!content.includes('viewport') && content.includes('<head>')) {
                content = content.replace('<head>', '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
                note('viewport');
            }

            // إضافة charset إذا مفقود
            if (!content.includes('charset') && content.includes('<head>')) {
                content = content.replace('<head>', '<head>\n    <meta charset="UTF-8">');
                note('charset');
            }

            // إضافة alt للصور بدون alt (بلغة المستخدم)
            let altAdded = 0;
            content = content.replace(/<img(?![^>]*alt=)([^>]*?)(\s*\/?)>/gi, (m, attrs, close) => {
                altAdded++;
                return `<img${attrs} alt="${altText}"${close}>`;   // الشرطةُ المُغلِقة تبقى في محلّها
            });
            for (let i = 0; i < altAdded; i++) note('accessibility');
        }

        if (file.name === 'script.js') {
            // إزالة console.log الزائدة (أكثر من 3)
            let logCount = 0;
            content = content.replace(/console\.log\([^)]*\);?\n?/g, (match) => {
                logCount++;
                if (logCount > 3) { note('cleanup'); return ''; }
                return match;
            });
        }

        return content === file.content ? file : { ...file, content };
    });
    return { files: out, fixes };
}

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function reviewCode(files, projectGoal, lang = 'en') {
    // الفحص الثابت السريع
    const staticResult = runStaticReview(files, lang);

    // الإصلاح التلقائي للمشاكل البسيطة — والعدُّ من الإصلاحات الواقعة نفسها
    const { files: fixedFiles, fixes } = autoFix(files, lang);

    // مراجعة AI للجودة العامة (اختيارية)
    const aiResult = await runAIReview(fixedFiles, projectGoal);

    return {
        score: staticResult.score,
        grade: staticResult.grade,
        issues: staticResult.issues,
        fixedCount: fixes.length,
        fixes,
        strengths: aiResult?.strengths || [],
        improvements: aiResult?.improvements || [],
        overallQuality: aiResult?.overallQuality || (staticResult.grade === 'A' ? 'ممتاز' : 'جيد'),
        fixedFiles,
    };
}
