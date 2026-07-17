/**
 * 🛡️ Code Guard — حارس جودة الكود المولّد
 *
 * المشكلة: وكيل البرمجة قد يولّد JavaScript بخطأ syntax يصل للمستخدم
 * (مثال حقيقي: SyntaxError: Unexpected token 'class' في موقع منشور).
 *
 * الحل:
 * - checkJS: تحليل الملف بـ vm.Script (بدون تنفيذ) — يكشف أخطاء الـ syntax بسطرها
 * - checkHTML/checkCSS: فحوص سلامة أساسية (وسوم غير مغلقة، أقواس غير متوازنة)
 * - guardFiles: يفحص كل ملف قبل الحفظ، وعند خطأ JS يجري جولة إصلاح ذاتي
 *   واحدة عبر LLM ثم يعيد الفحص — لا يمر ملف مكسور بصمت أبداً
 */

import vm from 'vm';
import fsPromises from 'fs/promises';
import path from 'path';
import { groq } from '../agents/baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 الفحوص
// ═══════════════════════════════════════════════════════
export function checkJS(content) {
    // vm.Script يحلل CommonJS فقط — لكن ملفات الـ API المولّدة تستخدم ESM
    // (import/export). نحيّد صيغة الوحدة (مع الحفاظ على أرقام الأسطر) حتى
    // نتحقق من صحة المنطق دون إنذار كاذب على export/import صحيحين.
    const isModule = /^\s*(import\s|export\s|export\{|export\s*default)/m.test(content);
    const toCheck = isModule ? neutralizeModuleSyntax(content) : content;

    try {
        new vm.Script(toCheck, { filename: 'generated.js' });
        return { valid: true };
    } catch (e) {
        const lineMatch = /generated\.js:(\d+)/.exec(e.stack || '');
        return {
            valid: false,
            error: `${e.message}${lineMatch ? ` (سطر ${lineMatch[1]})` : ''}`,
        };
    }
}

// تحييد صيغة ESM لأغراض فحص الصياغة فقط (يحافظ على عدد الأسطر)
function neutralizeModuleSyntax(src) {
    return src
        // import ... from '...';  و  import '...';  (سطر واحد)
        .replace(/^\s*import\b[^\n]*$/gm, '')
        // export default ...  →  void ...
        .replace(/^(\s*)export\s+default\s+/gm, '$1void ')
        // export { ... } (from '...')?;
        .replace(/^\s*export\s*\{[^}]*\}[^\n]*$/gm, '')
        // export const|let|var|function|class|async  →  إزالة الكلمة فقط
        .replace(/^(\s*)export\s+(const|let|var|function|class|async|default)\b/gm, '$1$2');
}

export function checkHTML(content) {
    const warnings = [];
    if (!/<\/html>/i.test(content)) warnings.push('وسم </html> مفقود');
    const openScripts = (content.match(/<script\b(?![^>]*src)[^>]*>/gi) || []).length;
    const closeScripts = (content.match(/<\/script>/gi) || []).length;
    if (openScripts > closeScripts) warnings.push('وسم <script> غير مغلق');
    return { valid: warnings.length === 0, warnings };
}

// عدّ الأقواس بعد تجريد التعليقات والسلاسل النصية (content: "{" لا يُحسب)
function stripCssNoise(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')       // تعليقات /* */
        .replace(/"(?:\\.|[^"\\])*"/g, '""')     // سلاسل مزدوجة
        .replace(/'(?:\\.|[^'\\])*'/g, "''");    // سلاسل مفردة
}

export function checkCSS(content) {
    const clean = stripCssNoise(content);
    const open = (clean.match(/{/g) || []).length;
    const close = (clean.match(/}/g) || []).length;
    return {
        valid: open === close,
        open, close,
        warnings: open === close ? [] : [`أقواس غير متوازنة ({: ${open}, }: ${close})`],
    };
}

// إصلاح CSS: إضافة/تصحيح الأقواس. أولاً محاولة LLM (وضع دقيق)،
// ثم احتياط حتمي (إلحاق } الناقصة في النهاية) — أفضل من ملف مكسور
async function repairCSS(name, content, check) {
    // احتياط حتمي فوري للحالة الشائعة: } واحدة أو اثنتان ناقصة في النهاية
    const deterministic = () => {
        const diff = check.open - check.close;
        if (diff > 0 && diff <= 3) return content.replace(/\s*$/, '') + '\n' + '}'.repeat(diff) + '\n';
        return null;
    };

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            max_tokens: 8000,
            messages: [
                { role: 'system', content: 'You are a CSS repair tool. The file has unbalanced braces. Return ONLY the complete corrected CSS — no markdown fences, no explanations. Preserve every rule and value; only fix the brace structure by placing the missing/extra brace where it belongs.' },
                { role: 'user', content: `File: ${name}\nIssue: ${check.warnings[0]}\n\n--- CSS ---\n${content}` },
            ],
        });
        let fixed = (completion.choices[0]?.message?.content || '')
            .replace(/^```(?:css)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        if (fixed && checkCSS(fixed).valid) return fixed;
    } catch { /* ننتقل للاحتياط */ }

    return deterministic();
}

// ═══════════════════════════════════════════════════════
// 🔧 الإصلاح الذاتي عبر LLM (جولة واحدة)
// ═══════════════════════════════════════════════════════
async function repairJS(name, content, error) {
    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 8000,
        messages: [
            {
                role: 'system',
                content: 'You are a JavaScript syntax repair tool. You receive a JS file with a syntax error. Return ONLY the complete corrected file content — no markdown fences, no explanations, no comments about the fix. Preserve all original logic and behavior.',
            },
            {
                role: 'user',
                content: `File: ${name}\nSyntax error: ${error}\n\n--- FILE CONTENT ---\n${content}`,
            },
        ],
    });
    let fixed = completion.choices[0]?.message?.content || '';
    // إزالة أسوار markdown إن وُجدت رغم التعليمات
    fixed = fixed.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return fixed;
}

// ═══════════════════════════════════════════════════════
// 🧹 منظّف placeholders القوالب — شبكة أمان حتمية قبل الكتابة
// القوالب تحوي رموزاً مثل {اسم المتجر}؛ إن نسخها المولّد رغم رفض QA
// (نفدت محاولات إعادة التوليد) نستبدلها هنا باسم المشروع كي لا تظهر
// للمستخدم حرفياً في موقعه.
// ═══════════════════════════════════════════════════════
export function scrubPlaceholders(files, projectName = '') {
    const pretty = (projectName || '').replace(/[-_]+/g, ' ').trim();
    if (!pretty) return files;
    return files.map(f => {
        if (!f || typeof f.content !== 'string' || !/\.(html|htm)$/.test(f.name || '')) return f;
        // {اسم ...} وأشباهها بحروف عربية داخل أقواس معقوصة
        const scrubbed = f.content.replace(/\{[؀-ۿ][^}\n]{0,40}\}/g, pretty);
        return scrubbed === f.content ? f : { ...f, content: scrubbed };
    });
}

// ═══════════════════════════════════════════════════════
// 🧷 حارس سلامة التعديلات الجراحية — حتمي، بلا LLM
//
// المشكلة الحقيقية (مشروع test17-7-5): تعديل جراحي «أضف نظام جلسات فيديو»
// أعاد index.html بدون <link rel="stylesheet"> فظهر الموقع HTML خاماً.
// guardFiles يفحص الـ syntax فقط — لا يعرف أن رابط التنسيق سقط.
//
// هذا الحارس يقارن كل ملف HTML معدَّل بنسخته على القرص (قبل الكتابة):
// - DOCTYPE سقط → يُعاد
// - روابط stylesheet المحلية سقطت (بلا <style> بديل) → تُعاد إلى <head>
// - وسم <script src> محلي سقط → يُعاد قبل </body>
// - مرجع محلي (css/js) يشير لملف غير موجود → يُصحَّح إن وُجد مرشح وحيد،
//   وإلا يُبلَّغ تحذير ظاهر
// يجب استدعاؤه قبل الكتابة — فالقرص لحظتها ما يزال يحمل النسخة السابقة.
// ═══════════════════════════════════════════════════════
const STYLESHEET_LINK = /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi;
const SCRIPT_SRC = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi;

function localHrefOf(linkTag) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(linkTag)?.[1];
    if (!href || /^(?:https?:)?\/\//i.test(href) || href.startsWith('data:')) return null;
    return href;
}

function normalizeRef(ref) {
    return ref.replace(/^\.\//, '').split(/[?#]/)[0];
}

export async function ensureEditIntegrity(files, projectPath, emit = () => { }) {
    let diskFiles = [];
    try {
        diskFiles = (await fsPromises.readdir(projectPath, { recursive: true }))
            .map(f => f.split(path.sep).join('/'));
    } catch { /* مشروع جديد — لا نسخة سابقة للمقارنة */ }
    const changedNames = new Set(files.map(f => f?.name).filter(Boolean));
    const refExists = (ref) => {
        const clean = normalizeRef(ref);
        return changedNames.has(clean) || diskFiles.includes(clean);
    };
    // مرشحو CSS من الدفعة المتغيّرة نفسها ومن القرص معاً — في البناء الأول
    // القرص فارغ والملفات كلها في الدفعة، فلا بد من عدّها
    const cssCandidates = [...new Set([
        ...files.map(f => f?.name).filter(n => n && n.endsWith('.css')),
        ...diskFiles.filter(f => f.endsWith('.css') && !f.includes('node_modules/')),
    ])];

    const out = [];
    for (const file of files) {
        if (!file || typeof file.content !== 'string' || !/\.(html|htm)$/i.test(file.name || '')) {
            out.push(file);
            continue;
        }
        let content = file.content;
        const fixes = [];

        let oldContent = '';
        try { oldContent = await fsPromises.readFile(path.join(projectPath, file.name), 'utf8'); } catch { }

        // 1) DOCTYPE سقط من مستند كامل
        if (!/^\s*<!doctype/i.test(content) && /<html[\s>]/i.test(content)) {
            content = '<!DOCTYPE html>\n' + content;
            fixes.push('DOCTYPE');
        }

        // 2) روابط التنسيق المحلية سقطت — وهي جوهر عطل «الموقع بلا تصميم»
        const newLinks = (content.match(STYLESHEET_LINK) || []).map(localHrefOf).filter(Boolean);
        if (newLinks.length === 0 && !/<style[\s>]/i.test(content) && /<\/head>/i.test(content)) {
            const oldLinks = (oldContent.match(STYLESHEET_LINK) || []).map(localHrefOf).filter(Boolean);
            let restore = oldLinks.filter(refExists);
            if (!restore.length) {
                // لا نسخة سابقة يُستدل بها → المرشح المعتاد أو ملف CSS الوحيد
                const candidate = cssCandidates.find(c => /^(?:css\/)?styles?\.css$/.test(c))
                    || (cssCandidates.length === 1 ? cssCandidates[0] : null);
                if (candidate) restore = [candidate];
            }
            if (restore.length) {
                const tags = restore.map(h => `    <link rel="stylesheet" href="${h}">`).join('\n');
                content = content.replace(/<\/head>/i, `${tags}\n</head>`);
                fixes.push(`رابط التنسيق (${restore.join('، ')})`);
            }
        }

        // 3) وسم <script src> محلي كان موجوداً وسقط كلياً → يُعاد قبل </body>
        if (oldContent && /<\/body>/i.test(content)) {
            const collectScripts = (html) => {
                const found = [];
                for (const m of html.matchAll(SCRIPT_SRC)) {
                    const src = m[1];
                    if (!/^(?:https?:)?\/\//i.test(src) && !src.startsWith('data:')) found.push(normalizeRef(src));
                }
                return found;
            };
            const newScripts = new Set(collectScripts(content));
            const lost = collectScripts(oldContent).filter(s => !newScripts.has(s) && refExists(s));
            if (lost.length) {
                const tags = [...new Set(lost)].map(s => `    <script src="${s}"></script>`).join('\n');
                content = content.replace(/<\/body>/i, `${tags}\n</body>`);
                fixes.push(`سكربتات (${[...new Set(lost)].join('، ')})`);
            }
        }

        // 4) مراجع محلية لملفات غير موجودة — تصحيح المرشح الوحيد أو تحذير
        const brokenRefs = [];
        for (const m of content.matchAll(/<(?:link\b[^>]*\bhref|script\b[^>]*\bsrc)\s*=\s*["']([^"']+)["']/gi)) {
            const ref = m[1];
            if (/^(?:https?:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue;
            if (!refExists(ref)) brokenRefs.push(ref);
        }
        for (const ref of [...new Set(brokenRefs)]) {
            if (ref.endsWith('.css') && cssCandidates.length === 1) {
                content = content.split(ref).join(cssCandidates[0]);
                fixes.push(`مسار CSS: ${ref} ← ${cssCandidates[0]}`);
            } else {
                emit(`⚠️ ${file.name} يشير إلى "${ref}" وهو غير موجود في المشروع.`);
            }
        }

        if (fixes.length) emit(`🧷 حارس التعديل أصلح ${file.name}: ${fixes.join('، ')}`);
        out.push(content === file.content ? file : { ...file, content });
    }
    return out;
}

// ═══════════════════════════════════════════════════════
// 🚦 نقطة الدخول: فحص (وإصلاح) قائمة ملفات قبل الحفظ
// files: [{ name, content }] — يُرجع نفس الشكل مع محتوى مُصلح عند الحاجة
// ═══════════════════════════════════════════════════════
export async function guardFiles(files, emit = () => {}) {
    const result = [];

    for (const file of files) {
        if (!file || typeof file.content !== 'string') { result.push(file); continue; }
        const name = file.name || '';

        if (name.endsWith('.js') || name.endsWith('.mjs')) {
            const check = checkJS(file.content);
            if (check.valid) {
                result.push(file);
                continue;
            }

            emit(`🛡️ خطأ syntax في ${name}: ${check.error} — جاري الإصلاح الذاتي...`);
            try {
                const fixed = await repairJS(name, file.content, check.error);
                const recheck = checkJS(fixed);
                if (recheck.valid && fixed.length > 20) {
                    emit(`✅ أُصلح ${name} تلقائياً وتم التحقق منه.`);
                    result.push({ ...file, content: fixed });
                    continue;
                }
                emit(`⚠️ فشل الإصلاح الذاتي لـ ${name} (${recheck.error || 'ناتج فارغ'}) — يُحفظ الأصل مع تحذير.`);
            } catch (e) {
                emit(`⚠️ تعذّر الإصلاح الذاتي لـ ${name}: ${e.message}`);
            }
            result.push(file); // الأصل أفضل من لا شيء — مع تحذير ظاهر للمستخدم

        } else if (name.endsWith('.html') || name.endsWith('.htm')) {
            const check = checkHTML(file.content);
            if (!check.valid) emit(`⚠️ تحذير HTML في ${name}: ${check.warnings.join('، ')}`);
            result.push(file);

        } else if (name.endsWith('.css')) {
            const check = checkCSS(file.content);
            if (check.valid) { result.push(file); continue; }

            emit(`🛡️ CSS غير متوازن في ${name}: ${check.warnings[0]} — جاري الإصلاح الذاتي...`);
            try {
                const fixed = await repairCSS(name, file.content, check);
                if (fixed && checkCSS(fixed).valid) {
                    emit(`✅ أُصلح ${name} تلقائياً وتم التحقق من توازن الأقواس.`);
                    result.push({ ...file, content: fixed });
                    continue;
                }
                emit(`⚠️ تعذّر إصلاح ${name} تلقائياً — يُحفظ الأصل مع تحذير.`);
            } catch (e) {
                emit(`⚠️ تعذّر إصلاح ${name}: ${e.message}`);
            }
            result.push(file);

        } else {
            result.push(file);
        }
    }

    return result;
}

// فحص محتوى JS مفرد (لتحديثات script.js المنفصلة)
export async function guardSingleJS(name, content, emit = () => {}) {
    const [guarded] = await guardFiles([{ name, content }], emit);
    return guarded.content;
}
