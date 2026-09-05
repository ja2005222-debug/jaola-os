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
// حذفُ نداءِ `console` كاملاً بعدّ الأقواس لا بأوّل قوسٍ مغلق.
// 🔴 كان النمط `console\.(log|warn|error)\([^)]*\);?` — و`[^)]*` يقف عند
//    أوّل `)`، فـ`console.log(JSON.stringify({a:1}))` يُحذف نصفُه ويبقى `);`
//    خطأً نحوياً يقتل صفحةَ المستخدم. والنداءاتُ المتشعّبة هي القاعدة لا الشذوذ.
function stripConsoleCall(src, from) {
    let i = src.indexOf('(', from);
    if (i < 0) return -1;
    let depth = 0, quote = null;
    for (; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i += 1; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '(') depth += 1;
        else if (c === ')') {
            depth -= 1;
            if (depth === 0) {
                let end = i + 1;
                if (src[end] === ';') end += 1;
                if (src[end] === '\n') end += 1;
                return end;
            }
        }
    }
    return -1;   // قوسٌ غيرُ مغلق — لا نلمس ما لا نفهم
}

const KEEP_LOGS = 3;
// `warn`/`error` ليست «زائدة»: حذفُ تسجيل أخطاء المستخدم ليس تنظيفاً.
const NOISY = /console\.(log|debug)\s*\(/g;

// ═══════════════════════════════════════════════════════
// 🧹 تنظيف JavaScript
// ═══════════════════════════════════════════════════════
function refactorJS(content) {
    if (!content) return content;
    let result = content;

    // إزالة console.log الزائدة (ما بعد الثالثة) بحدودٍ متوازنة
    let seen = 0, out = '', cursor = 0;
    NOISY.lastIndex = 0;
    let m;
    while ((m = NOISY.exec(result)) !== null) {
        seen += 1;
        if (seen <= KEEP_LOGS) continue;
        const end = stripConsoleCall(result, m.index);
        if (end < 0) continue;
        out += result.slice(cursor, m.index);
        cursor = end;
        NOISY.lastIndex = end;
    }
    result = out + result.slice(cursor);

    // 🔴 حُذف تحويلُ `var` إلى `let`/`const`. لم يكن تجميلاً بل تغييرَ معنى:
    //    `var` نطاقُه الدالة و`let` نطاقُه الكتلة، والفرقُ مقيسٌ بالتشغيل لا
    //    مُفترَضاً — نفس الكود قبل التحويل وبعده:
    //      var mode='light'; if (dark) { var mode='dark' } → "dark"  ثمّ  "light"
    //      for (var i…) {…} return i;                      → 1      ثمّ  ReferenceError
    //    أي خطأٌ صامتٌ في الأولى وسقوطٌ في الثانية. ولم يكن يُنتج `const` قطّ
    //    رغم ما يقوله التعليقُ القديم: فحصُ «هل أُعيد تعيينُها؟» كان يبحث في
    //    النصّ كلِّه فيجد تصريحَها نفسَه، فالجوابُ «نعم» دائماً.
    //    و`var` كودٌ صحيح؛ لا عيبَ يُصلَح هنا، بل عيبٌ يُدخَل.

    // 'use strict' — لا يُدَسّ قبل توجيهٍ ولا في وحدةٍ هي صارمةٌ أصلاً
    if (needsUseStrict(result)) result = `'use strict';\n\n${result}`;

    // تنظيف أسطر فارغة متعددة (أكثر من 2)
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
}

// 🔴 التوجيهُ توجيهٌ ما دام أوّلَ جملة، فإن سبقته جملةٌ صار تعبيراً لا أثرَ له.
//    مقيسٌ لا مفترَض: `1; 'use strict'; undeclared = 1` لا يُمنع، وبالتوجيه
//    أوّلاً يُمنع. فدسُّ `'use strict'` فوق `'use client'` يُبطل الثانية —
//    وهي حدُّ مكوّنِ العميل في Next. والوحداتُ (import/export) صارمةٌ بحكم
//    التعريف، فإضافتُها فيها حشوٌ لا فائدةَ منه.
function needsUseStrict(src) {
    const head = src.replace(/^\uFEFF/, '').trimStart();
    if (/^(['"])use [a-z-]+\1\s*;?/.test(head)) return false;        // توجيهٌ قائم
    if (/^\s*(import|export)\s/m.test(src)) return false;            // وحدة ESM
    if (/^\s*(import\s*\(|await\s)/m.test(src)) return false;
    return true;
}

// ═══════════════════════════════════════════════════════
// 🎨 تنظيف CSS
// ═══════════════════════════════════════════════════════
function refactorCSS(content) {
    if (!content) return content;
    let result = content;

    // 🔴 إزالةُ التكرار كانت تُبقي **الأولى** وتحذف الأخيرة:
    //    `.card { color: red; color: blue }` تصير `color: red`.
    //    وترتيبُ CSS يجعل الأخيرةَ هي النافذة، فكان «التنظيف» يقلب لونَ
    //    موقع المستخدم إلى قيمةٍ كان قد تجاوزها. الأخيرةُ تبقى.
    result = dedupeDeclarations(result);

    // تنظيف أسطر فارغة متعددة
    result = result.replace(/\n{3,}/g, '\n\n');

    // التأكد من وجود newline في نهاية الملف
    if (!result.endsWith('\n')) result += '\n';

    return result;
}

// كتلةٌ بلا أقواسٍ متداخلة (فتشمل قواعدَ @media الداخلية)، وبلا اقتباسٍ
// كي لا تُقطَع `content: "a;b"` على فاصلةٍ داخل نصّ.
const BLOCK = /([^{}]*)\{([^{}]*)\}/g;

function dedupeDeclarations(css) {
    return css.replace(BLOCK, (whole, selector, body) => {
        if (/["']/.test(body)) return whole;
        const parts = body.split(';');
        const tail = parts.pop();                       // ما بعد آخر فاصلة
        const lastIndexOf = new Map();
        parts.forEach((decl, i) => {
            const prop = (decl.split(':')[0] || '').trim().toLowerCase();
            if (prop && !prop.startsWith('--')) lastIndexOf.set(prop, i);
        });
        const kept = parts.filter((decl, i) => {
            const prop = (decl.split(':')[0] || '').trim().toLowerCase();
            if (!prop || prop.startsWith('--')) return true;
            return lastIndexOf.get(prop) === i;         // الأخيرةُ هي النافذة
        });
        if (kept.length === parts.length) return whole;
        return `${selector}{${kept.join(';')};${tail}}`;
    });
}

// ═══════════════════════════════════════════════════════
// 📄 تنظيف HTML
// ═══════════════════════════════════════════════════════
function refactorHTML(content, lang = 'en') {
    if (!content) return content;
    let result = content;
    const code = (lang || 'en').toLowerCase();

    // إزالة attributes فارغة
    result = result.replace(/\s+class=""\s*/g, ' ');
    result = result.replace(/\s+style=""\s*/g, ' ');
    result = result.replace(/\s+id=""\s*/g, ' ');

    // 🔴 `result.includes('lang=')` يُشبعه `hreflang="ar"` في وسمٍ آخر،
    //    فصفحةٌ فيها رابطٌ بديلٌ لا تنال `lang` على `<html>` أبداً. نسأل عن
    //    السمة في وسم `<html>` نفسه.
    if (!/<html[^>]*\slang\s*=/i.test(result)) {
        result = result.replace('<html', `<html lang="${code}"`);
    }

    // تأكد من وجود charset (في وسم meta لا في أيّ موضعٍ من الصفحة)
    if (!/<meta[^>]+charset/i.test(result) && result.includes('<head>')) {
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
export async function refactorCode(files, lang = 'en') {
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
            newContent = refactorHTML(file.content, lang);
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
