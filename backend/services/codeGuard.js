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
import { groq } from '../agents/baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 الفحوص
// ═══════════════════════════════════════════════════════
export function checkJS(content) {
    try {
        new vm.Script(content, { filename: 'generated.js' });
        return { valid: true };
    } catch (e) {
        const lineMatch = /generated\.js:(\d+)/.exec(e.stack || '');
        return {
            valid: false,
            error: `${e.message}${lineMatch ? ` (سطر ${lineMatch[1]})` : ''}`,
        };
    }
}

export function checkHTML(content) {
    const warnings = [];
    if (!/<\/html>/i.test(content)) warnings.push('وسم </html> مفقود');
    const openScripts = (content.match(/<script\b(?![^>]*src)[^>]*>/gi) || []).length;
    const closeScripts = (content.match(/<\/script>/gi) || []).length;
    if (openScripts > closeScripts) warnings.push('وسم <script> غير مغلق');
    return { valid: warnings.length === 0, warnings };
}

export function checkCSS(content) {
    const open = (content.match(/{/g) || []).length;
    const close = (content.match(/}/g) || []).length;
    return {
        valid: open === close,
        warnings: open === close ? [] : [`أقواس غير متوازنة ({: ${open}, }: ${close})`],
    };
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
            if (!check.valid) emit(`⚠️ تحذير CSS في ${name}: ${check.warnings.join('، ')}`);
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
