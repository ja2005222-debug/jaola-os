/**
 * 🩹 محرّر موضعي (Patch-based) — الحلّ الجذري للتعديل على المشاريع الكبيرة.
 *
 * المشكلة: التعديل بإعادة كتابة الملف كاملاً يصطدم بحدّ الرموز على الملفات
 * الكبيرة → مخرَج مبتور → فقدان ميزات (سجل المستخدم: حُذفت المحاسبة).
 *
 * الحلّ: المولّد يُعيد **كتل بحث/استبدال** فقط (الجزء المتغيّر)، تُطبَّق على
 * الملف الموجود. فلا يُعاد إخراج الملف كاملاً (لا بتر)، وما لا يُذكر لا يُلمس
 * (حفظ حتمي للميزات). هذا هو النمط النموذجي لكل المشاريع.
 *
 * الصيغة (مثبّتة في التلقين):
 *   اسم_الملف
 *   <<<<<<< SEARCH
 *   <أسطر موجودة حرفياً>
 *   =======
 *   <الأسطر الجديدة>
 *   >>>>>>> REPLACE
 */

import { smartChat } from './baseAgent.js';

// ── تحليل كتل التعديل من مخرَج النموذج (دالة نقية) ─────────────────────
export function parseEditBlocks(text = '') {
    const blocks = [];
    const re = /(^|\n)([^\n]*?)\n<<<<<<<\s*SEARCH\s*\n([\s\S]*?)\n=======\s*\n([\s\S]*?)\n>>>>>>>\s*REPLACE/g;
    let m;
    while ((m = re.exec(text))) {
        const file = cleanFileName(m[2]);
        if (!file) continue;
        blocks.push({ file, search: m[3], replace: m[4] });
    }
    return blocks;
}

function cleanFileName(line) {
    return (line || '')
        .replace(/^\s*(?:FILE|الملف|file)\s*[:=]\s*/i, '')
        .replace(/[`'"*#>]/g, '')
        .trim()
        .split(/\s+/).pop() || '';
}

// تطبيع نسخ اللقط الصغيرة التي لا تُغيّر المعنى (فروق طباعة النموذج الشائعة):
// علامات اقتباس ذكية → مستقيمة، ومسافات متكرّرة → مسافة واحدة. للمقارنة فقط
// (لا يُستخدم الناتج المطبَّع في الاستبدال — الأسطر الأصلية من الملف تبقى).
function normLine(s) {
    return s.trim()
        .replace(/[“”‟]/g, '"').replace(/[‘’‛]/g, "'")
        .replace(/\s+/g, ' ');
}

// ── تطبيق كتلة واحدة: تطابق حرفي، ثم تطابق أسطر مُطبَّعة (تسامح المسافات
// وعلامات الاقتباس الذكية — أكثر أسباب فشل نسخ النموذج للنصّ حرفياً) ──
function applyOne(content, search, replace) {
    if (search === '') return { content, ok: false };
    // 1) تطابق حرفي (الأدقّ)
    if (content.includes(search)) {
        return { content: content.replace(search, () => replace), ok: true };
    }
    // 2) تطابق أسطر مُطبَّعة (يتسامح مع فروق المسافة/الاقتباس)
    const cLines = content.split('\n');
    const sLines = search.split('\n');
    const sN = sLines.map(normLine).filter((s, i) => !(i === sLines.length - 1 && s === '')); // تجاهل سطر أخير فارغ
    if (!sN.length) return { content, ok: false };
    for (let i = 0; i + sN.length <= cLines.length; i++) {
        let match = true;
        for (let j = 0; j < sN.length; j++) {
            if (normLine(cLines[i + j]) !== sN[j]) { match = false; break; }
        }
        if (match) {
            const newLines = [...cLines.slice(0, i), ...replace.split('\n'), ...cLines.slice(i + sN.length)];
            return { content: newLines.join('\n'), ok: true };
        }
    }
    return { content, ok: false };
}

/**
 * يطبّق كتل التعديل على مصفوفة ملفات [{name, content}]. دالة نقية.
 * @returns {{files, all, applied, failed}} `files` = المتغيّرة فقط (مقارنةً
 * بالمُدخَل)، `all` = كل الملفات بحالتها المحدَّثة (لتمرير سلسلة تصحيح لاحقة).
 */
export function applyEdits(files = [], blocks = []) {
    const out = files.map(f => ({ ...f }));
    let applied = 0;
    const failed = [];
    for (const b of blocks) {
        const f = out.find(x => x.name === b.file || x.name.endsWith('/' + b.file) || b.file.endsWith('/' + x.name));
        if (!f) { failed.push({ ...b, reason: 'ملف غير موجود' }); continue; }
        const r = applyOne(f.content, b.search, b.replace);
        if (r.ok) { f.content = r.content; applied++; }
        else failed.push({ ...b, reason: 'لم يُطابَق نصّ البحث' });
    }
    // نُرجع فقط الملفات التي تغيّرت فعلاً (+ الحالة الكاملة لتسلسل التصحيح)
    const changed = out.filter((f, i) => f.content !== files[i].content);
    return { files: changed, all: out, applied, failed };
}

const SYSTEM = `أنت محرّر شفرة دقيق. تُعدّل ملفات *موجودة* بأقلّ تغيير ممكن عبر كتل بحث/استبدال فقط.
قواعد صارمة:
- لا تُعِد الملف كاملاً أبداً. أخرج كتل التعديل فقط.
- نصّ SEARCH يجب أن يُطابق **حرفياً** أسطراً موجودة في الملف — انسخها كما هي بالضبط (مع المسافات).
- **اجعل SEARCH أقصر ما يمكن**: سطر أو سطران فريدان يكفيان كمرجع (لا فقرة كاملة) —
  كلما طال النصّ المنسوخ زاد احتمال خطأ نسخ بسيط يُفشل المطابقة بالكامل.
- REPLACE هو البديل الكامل لتلك الأسطر. كل ما لا تذكره يبقى دون تغيير.
- للإضافة: اجعل SEARCH سطراً مرجعياً موجوداً، وREPLACE = نفسه + الإضافة الجديدة.
- لا تحذف دوالّ أو ميزات موجودة إلا إن طُلب صراحةً.

الصيغة الحرفية لكل تغيير:
اسم_الملف
<<<<<<< SEARCH
<الأسطر الموجودة حرفياً>
=======
<الأسطر الجديدة>
>>>>>>> REPLACE

أخرج الكتل فقط، بلا أي شرح أو نصّ خارجها.`;

// ── جولة تصحيح واحدة لِما فشل من كتل: نعرض على النموذج محاولته الفاشلة +
// المحتوى الفعلي الحالي للملفات المعنيّة، ونطلب كتلاً مصحَّحة بنسخ حرفي دقيق.
async function retryFailedBlocks(chat, workingFiles, failedBlocks) {
    const names = new Set(failedBlocks.map(b => b.file));
    const relevant = workingFiles.filter(f => names.has(f.name)
        || [...names].some(n => f.name.endsWith('/' + n) || n.endsWith('/' + f.name)));
    if (!relevant.length) return [];
    const fileDump = relevant.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n');
    const attemptsDump = failedBlocks.map(b =>
        `الملف: ${b.file}\nنصّ SEARCH الذي حاولته سابقاً (لم يُطابَق أي نصّ فعلي):\n${b.search}`).join('\n\n');
    const user = `بعض كتل التعديل السابقة **لم تُطابِق** المحتوى الفعلي (على الأرجح نسخت النصّ بتصرّف بسيط).
إليك محاولاتك الفاشلة، ثم **المحتوى الفعلي الحالي** للملفات المعنيّة. أعِد كتل
SEARCH/REPLACE **مصحّحة فقط لهذه الأجزاء**، بنسخ حرفي دقيق من المحتوى الفعلي أدناه لتحقيق نفس الهدف:

${attemptsDump}

---
المحتوى الفعلي الحالي:

${fileDump}`;
    let raw = '';
    try {
        raw = await chat([
            { role: 'system', content: SYSTEM },
            { role: 'user', content: user },
        ], { max_tokens: 2000, temperature: 0.1 });
    } catch { return []; }
    return parseEditBlocks(raw);
}

/**
 * يطلب من النموذج تعديلاً موضعياً ويطبّقه. يقبل chat مُحقَناً للاختبار.
 * عند فشل مطابقة بعض الكتل، يمنح النموذج **جولة تصحيح واحدة** (maxRetries)
 * بعرض محاولته الفاشلة + المحتوى الفعلي، قبل الإقرار بالفشل النهائي.
 * @returns {Promise<{files, applied, failed, ok, partial, retried, raw}>}
 */
export async function patchEditPlan(instruction, files = [], lang = 'ar', { chat = smartChat, maxRetries = 1 } = {}) {
    const fileDump = files.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n');
    const user = `الملفات الحالية:\n\n${fileDump}\n\n---\nالمطلوب (عدّل موضعياً، لا تُعِد الملف كاملاً، لا تحذف ما هو موجود):\n${instruction}`;
    let raw = '';
    try {
        raw = await chat([
            { role: 'system', content: SYSTEM },
            { role: 'user', content: user },
        ], { max_tokens: 4000, temperature: 0.1 });
    } catch (e) {
        return { files: [], applied: 0, failed: [], ok: false, error: e.message, raw: '' };
    }
    const blocks = parseEditBlocks(raw);
    if (!blocks.length) return { files: [], applied: 0, failed: [], ok: false, raw };

    let { all: working, applied, failed } = applyEdits(files, blocks);
    let retries = 0;
    while (failed.length && retries < maxRetries) {
        retries++;
        const retryBlocks = await retryFailedBlocks(chat, working, failed);
        if (!retryBlocks.length) break;
        const r2 = applyEdits(working, retryBlocks);
        applied += r2.applied;
        failed = r2.failed;
        working = r2.all;
    }

    // الفرق الحقيقي مقابل المُدخَل الأصلي (بعد كل الجولات)
    const changed = working.filter((f, i) => f.content !== files[i].content);
    // نقبل التطبيق ما دام تغيّر شيء فعلاً — الكتل غير المطابِقة لا تُسقط الباقي
    // (البتر يستحيل هنا؛ ما لا يُطبَّق لا يُلمس، فلا فقدان). partial ⇒ نُبلغ.
    return { files: changed, applied, failed, ok: applied > 0, partial: failed.length > 0, retried: retries > 0, raw };
}
