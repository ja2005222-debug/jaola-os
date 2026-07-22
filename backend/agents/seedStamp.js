/**
 * 🌱 بصمة بيانات العيّنة — الحلّ الجذري لـ«التخصيص لا يحدث».
 *
 * بدل إعادة كتابة app.js كاملاً (يُبتَر على الملفات الكبيرة فتُفقد الدوال ويُرتدّ)،
 * نحصر التخصيص في *مصفوفة البيانات* وحدها: نستخرجها، نطلب من الذكاء نسخةً بنفس
 * البنية تطابق المجال (مخرَج صغير محدود = لا بتر)، نتحقّق من صحّتها ثبنياً، ثم
 * نلصقها مكانها. الدوال والبنية لا تُمَسّ إطلاقاً.
 */

/** يجد مصفوفات البذور `const NAME = [ ... ]` (بمطابقة أقواس متوازنة، تتخطّى النصوص). */
export function findSeedArrays(js = '') {
    const out = [];
    const declRe = /const\s+([A-Za-z_$][\w$]*)\s*=\s*\[/g;
    let m;
    while ((m = declRe.exec(js))) {
        const name = m[1];
        const litStart = js.indexOf('[', m.index);
        let depth = 0, i = litStart, inStr = null, esc = false, ok = false;
        for (; i < js.length; i++) {
            const ch = js[i];
            if (inStr) {
                if (esc) esc = false;
                else if (ch === '\\') esc = true;
                else if (ch === inStr) inStr = null;
                continue;
            }
            if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
            if (ch === '[') depth++;
            else if (ch === ']') { depth--; if (depth === 0) { i++; ok = true; break; } }
        }
        if (!ok) { declRe.lastIndex = litStart + 1; continue; }
        const literal = js.slice(litStart, i);
        // نهتمّ بمصفوفات الكائنات (بيانات فعلية) لا مصفوفات النصوص البسيطة
        if (/\{/.test(literal)) out.push({ name, declStart: m.index, litStart, end: i, literal });
        declRe.lastIndex = i;
    }
    return out;
}

/** يختار المصفوفة الأغنى (أكثر عناصر) — عادةً المنتجات/الأصناف الرئيسية. */
export function primarySeedArray(js = '') {
    const arrays = findSeedArrays(js);
    if (!arrays.length) return null;
    const count = (lit) => (lit.match(/\{/g) || []).length;
    return arrays.reduce((best, s) => (count(s.literal) > count(best.literal) ? s : best));
}

/** يقيّم نصّاً كمصفوفة JS بأمان نسبيّ (للتحقّق فقط، لا نُنفّذ النتيجة). */
function evalArray(lit) {
    // eslint-disable-next-line no-new-func
    return Function('"use strict";return (' + lit + ');')();
}

/** يستخرج أوّل حتى آخر قوس مصفوفة من ردّ الذكاء (يتجاهل أي شرح حوله). */
export function extractArrayLiteral(raw = '') {
    const s = raw.indexOf('[');
    const e = raw.lastIndexOf(']');
    if (s < 0 || e <= s) return null;
    return raw.slice(s, e + 1);
}

/**
 * يتحقّق أن المصفوفة الجديدة صالحة بنيوياً وتحمل نفس مفاتيح الأصل — فيبقى app.js
 * سليماً بعد اللصق. يرفض أي شيء ينقص حقلاً أو ليس مصفوفة كائنات غير فارغة.
 */
export function validateSeedLiteral(newLit = '', origLit = '') {
    const nt = (newLit || '').trim();
    if (!nt.startsWith('[') || !nt.endsWith(']')) return false;
    let arr, orig;
    try { arr = evalArray(nt); } catch { return false; }
    if (!Array.isArray(arr) || !arr.length) return false;
    try { orig = evalArray(origLit); } catch { orig = null; }
    const need = Array.isArray(orig) && orig[0] && typeof orig[0] === 'object' ? Object.keys(orig[0]) : [];
    return arr.every(o => o && typeof o === 'object' && !Array.isArray(o) && need.every(k => k in o));
}

/** يلصق مصفوفة جديدة مكان الأصل مع إبقاء `const NAME = ` و`;`. */
export function spliceSeed(js, seed, newLit) {
    return js.slice(0, seed.litStart) + newLit + js.slice(seed.end);
}

/**
 * يخصّص مصفوفة البذور الرئيسية في app.js لتطابق الهدف — عبر نداء ذكاء *محدود
 * المخرَج* (المصفوفة فقط). يعيد {ok, files:[{name:'app.js',content}], name} أو {ok:false}.
 * @param {Array} files [{name, content}]
 * @param {string} goal
 * @param {{chat, category}} opts chat: (messages, options)=>Promise<string>
 */
export async function stampSeed(files = [], goal = '', { chat, category = '' } = {}) {
    const app = files.find(f => f.name === 'app.js');
    if (!app || typeof chat !== 'function' || !goal) return { ok: false };
    const seed = primarySeedArray(app.content);
    if (!seed) return { ok: false };

    const prompt = `لديك مصفوفة بيانات عيّنة في تطبيق ${category || 'ويب'} (JavaScript). أعد كتابتها لتطابق: "${goal}".
قواعد صارمة:
- حافظ على *نفس المفاتيح والبنية* في كل عنصر تماماً (نفس أسماء الحقول وأنواعها).
- أبقِ نفس عدد العناصر تقريباً.
- غيّر القيم فقط (الأسماء/الأوصاف/الأسعار/الرموز) لتناسب المطلوب، بمحتوى واقعيّ.
أعد *مصفوفة JavaScript صالحة فقط* (تبدأ بـ [ وتنتهي بـ ]) — بلا أي شرح أو نصّ آخر.

${seed.literal}`;

    let raw;
    try {
        raw = await chat(
            [{ role: 'system', content: 'تعيد مصفوفة JavaScript صالحة فقط، بلا أسوار كود أو شرح.' },
             { role: 'user', content: prompt }],
            { max_tokens: 1800, temperature: 0.4 });
    } catch { return { ok: false }; }

    const lit = extractArrayLiteral(raw || '');
    if (!lit || !validateSeedLiteral(lit, seed.literal)) return { ok: false };
    return { ok: true, name: seed.name, files: [{ name: 'app.js', content: spliceSeed(app.content, seed, lit) }] };
}
