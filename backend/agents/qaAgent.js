/**
 * ✅ QA Agent — فاحص اكتمال حقيقي (حتمي، بلا LLM)
 *
 * كان الفحص صورياً (DOCTYPE + توازن أقواس فقط) فتمرّ مواقع ناقصة أو معطوبة.
 * نتيجة هذا الفاحص تُغذّي حلقة إعادة التوليد في jcr: خطة مرفوضة تُعاد
 * صياغتها مع النقد المحدد — لذا كل فحص هنا يرفع جودة الموقع النهائي مباشرة.
 *
 * فشل صلب (passed=false → إعادة توليد): أشياء معطوبة فعلاً فقط —
 *   placeholders متبقية، دوال onclick غير معرّفة، أقواس غير متوازنة،
 *   HTML هيكلي فارغ. الباقي تحذيرات تُسجَّل ولا تعلّق الحلقة.
 */

// أسماء الدوال المعرَّفة في نص JS (function fn / const fn = / window.fn =)
function collectDefinedFunctions(js) {
    const defined = new Set();
    for (const m of js.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
    for (const m of js.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function)/g)) defined.add(m[1]);
    for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
    return defined;
}

// أسماء الدوال المستدعاة من onclick/onsubmit/onchange في HTML
function collectHandlerCalls(html) {
    const called = new Set();
    for (const m of html.matchAll(/on(?:click|submit|change|input|keyup)\s*=\s*["']\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/g)) {
        called.add(m[1]);
    }
    return called;
}

export function qaVerify(plan) {
    const logs = [];
    const failures = [];

    const files = (plan && Array.isArray(plan.files)) ? plan.files : [];
    const htmlFiles = files.filter(f => f.name.endsWith('.html'));
    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const jsFiles = files.filter(f => f.name.endsWith('.js'));

    // كل JS المتاح (ملفات + <script> المضمّنة) — لفحص onclick handlers
    const inlineScripts = htmlFiles
        .map(f => [...(f.content || '').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n'))
        .join('\n');
    const allJS = jsFiles.map(f => f.content || '').join('\n') + '\n' + inlineScripts;
    const definedFns = collectDefinedFunctions(allJS);

    for (const file of htmlFiles) {
        const html = file.content || '';
        const name = file.name;

        // ── فشل صلب: هيكل معطوب أو ناقص جوهرياً ──
        if (!html.includes('<!DOCTYPE html>')) {
            failures.push(`${name}: DOCTYPE مفقود.`);
        }
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const bodyContent = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').trim() : '';
        if (!bodyMatch || bodyContent.length < 500) {
            failures.push(`${name}: محتوى <body> شبه فارغ (${bodyContent.length} حرف) — الصفحة هيكل بلا مضمون. ابنِ محتوى كاملاً.`);
        }

        // ── فشل صلب: placeholders قوالب متبقية تظهر للمستخدم حرفياً ──
        const placeholders = [...new Set([...html.matchAll(/\{[؀-ۿ][^}\n]{0,40}\}/g)].map(m => m[0]))];
        if (placeholders.length) {
            failures.push(`${name}: بقايا placeholders لم تُستبدل بمحتوى حقيقي: ${placeholders.slice(0, 5).join('، ')} — استبدلها باسم/محتوى المشروع الفعلي.`);
        }

        // ── فشل صلب: أزرار تستدعي دوال غير موجودة (ميزات مكسورة) ──
        const missing = [...collectHandlerCalls(html)].filter(fn => !definedFns.has(fn));
        if (missing.length) {
            failures.push(`${name}: أزرار تستدعي دوال غير معرّفة في أي JS: ${missing.join('، ')} — عرّف هذه الدوال في script.js لتعمل الميزات فعلاً.`);
        }

        // ── تحذيرات (تُسجَّل ولا توقف) ──
        if (!/<meta[^>]+viewport/i.test(html)) logs.push(`${name}: بلا meta viewport — التجاوب على الجوال سيتأثر.`);
        if (!/<title>\s*\S/.test(html)) logs.push(`${name}: <title> مفقود أو فارغ.`);
        if (!/<(header|nav)\b/i.test(html)) logs.push(`${name}: لا يوجد header/nav.`);
        if (!/<footer\b/i.test(html)) logs.push(`${name}: لا يوجد footer.`);
        const sectionCount = (html.match(/<section\b/gi) || []).length;
        if (name === 'index.html' && sectionCount < 3) logs.push(`${name}: ${sectionCount} أقسام فقط — موقع مكتمل يحتاج 3+ أقسام.`);
        const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
        const noAlt = imgs.filter(m => !/alt\s*=/.test(m[0])).length;
        if (noAlt) logs.push(`${name}: ${noAlt} صورة بلا alt.`);
        if (/lorem ipsum/i.test(html)) logs.push(`${name}: نص lorem ipsum placeholder — استبدله بمحتوى حقيقي.`);
    }

    for (const file of cssFiles) {
        const css = file.content || '';
        if (css.trim().length < 300) logs.push(`${file.name}: CSS هزيل جداً (${css.trim().length} حرف).`);
        if (!/@media/i.test(css)) logs.push(`${file.name}: لا يوجد @media — التصميم غير متجاوب.`);
    }

    for (const file of jsFiles) {
        const js = file.content || '';
        const open = (js.match(/\{/g) || []).length;
        const close = (js.match(/\}/g) || []).length;
        if (open !== close) {
            failures.push(`${file.name}: أقواس {} غير متوازنة (${open} فتح مقابل ${close} إغلاق) — الملف مكسور syntax.`);
        }
    }

    const passed = failures.length === 0;
    return {
        passed,
        logs: passed
            ? (logs.length ? logs : ['جميع فحوصات الاكتمال والجودة مرت بنجاح.'])
            : [...failures, ...logs],
    };
}
