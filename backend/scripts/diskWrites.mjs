/**
 * 💾 diskWrites.mjs — جردُ مواضع الكتابة على القرص في `backend/`، مصنَّفةً.
 *
 * وُجد لأنّ `ARCHITECTURE_GAP_AUDIT.md` قدّر «٣٣ كاتباً على القرص» بمطابقةٍ
 * نصّيّةٍ ساذجة، والعددُ المقيسُ بأداةٍ تعرف بنيةَ الملفّ **١٩٨ موضعاً في ٤٦
 * ملفاً**. والفرقُ ليس في الدقّة وحدها: المطابقةُ الساذجة تخلط ثلاثةَ أشياء
 * مختلفةً في الحكم:
 *
 *   1. **كتابةُ الخلفية نفسها** — ما نريد ضبطَه ببوّابة.
 *   2. **كتابةٌ داخل قالبٍ نصّيّ** — كودٌ يُولَّد للمستخدم ويُنفَّذ في مشروعه
 *      لا عندنا (`agents/backendAgent.js`: `process.cwd()/public/uploads`).
 *      عدُّها كتابةً للخلفية خطأٌ في الحكم لا في العدّ.
 *   3. **كتابةٌ في تعليقٍ أو نصّ** — لا تُنفَّذ أصلاً.
 *
 * ── عطبان في هذا الماسح نفسِه، مُصلَحان ومُثبَّتان في `tests/diskWriteScan.test.mjs`:
 *
 * **أ) علامةُ الفتح تُغلق نفسَها.** كان الدخولُ إلى وضع النصّ لا يبتلع علامةَ
 *    الفتح، فيراها فرعُ النصّ في الدورة التالية علامةَ إغلاق — فكلُّ نصٍّ
 *    عاديّ يُقرأ كوداً.
 *
 * **ب) الحرفيّةُ النمطيّة (regex) تُفسد ما بعدها.** `agents/jcr.js:1769` فيه
 *    `/["'«»]/g` — فتُفتح علامةُ نصٍّ لا تُغلق، وينحرف تصنيفُ بقيّة الملفّ.
 *    أبلغ الماسحُ حينها أنّ ٤٤ كتابةً حقيقيّةً «في تعليقٍ أو نصّ»؛ فحصتُ ستّاً
 *    منها بيدي فإذا هي حيّةٌ كلُّها. **حارسٌ يخطئ بثقةٍ أسوأ من لا حارس.**
 *
 * ⚠️ حدٌّ قائم: الاستدلالُ على أنّ `/` بدايةُ نمطٍ لا قسمةٍ استدلالٌ سياقيّ
 *    لا تحليلٌ نحويّ كامل. فالعددُ حدٌّ أدنى موثوقٌ لا برهانٌ نهائيّ.
 *
 * التشغيل:  node scripts/diskWrites.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND = path.resolve(HERE, '..');
const SKIP = new Set(['node_modules', '.git', 'memory', 'workspaces', '.next', 'dist', 'build', 'tests', 'scripts']);

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
        else if (/\.m?js$/.test(e.name)) out.push(p);
    }
    return out;
}

const KEYWORD = /(?:^|[^\w$])(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;
/** أَبعدُ حرفٍ ذي دلالةٍ قبل `i` يقرّر: نمطٌ أم قسمة؟ */
function isRegexStart(src, i) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    if (j < 0) return true;
    const c = src[j];
    if ('=(,:[!&|?{};+-*%^~<>'.includes(c)) return true;
    if (/[\w$)\]]/.test(c)) return KEYWORD.test(src.slice(Math.max(0, j - 12), j + 1));
    return false;
}

/** حالةُ كلِّ حرف: 0 كود · 1 تعليق · 2 نصٌّ عاديّ · 3 داخل قالبٍ نصّيّ. */
export function charStates(src) {
    const st = new Uint8Array(src.length);
    const set = (a, b, v) => { for (let k = a; k < b && k < src.length; k++) st[k] = v; };
    let i = 0, mode = 'code';
    const tpl = [];                       // لكل قالبٍ مفتوح: 1 إن كنّا داخل ${}
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        const inTpl = tpl.length > 0 && tpl[tpl.length - 1] === 0;
        if (mode === 'line-comment') { if (c === '\n') { mode = 'code'; st[i] = 0; } else st[i] = 1; i++; continue; }
        if (mode === 'block-comment') { if (c === '*' && n === '/') { set(i, i + 2, 1); mode = 'code'; i += 2; } else { st[i] = 1; i++; } continue; }
        if (mode === 'sq' || mode === 'dq') {
            if (c === '\\') { set(i, i + 2, 2); i += 2; continue; }
            st[i] = 2;
            if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"')) mode = 'code';
            i++; continue;
        }
        if (inTpl) {
            if (c === '\\') { set(i, i + 2, 3); i += 2; continue; }
            if (c === '$' && n === '{') { set(i, i + 2, 3); tpl[tpl.length - 1] = 1; i += 2; continue; }
            if (c === '`') { st[i] = 3; tpl.pop(); i++; continue; }
            st[i] = 3; i++; continue;
        }
        if (c === '\\') { set(i, i + 2, 0); i += 2; continue; }
        if (c === '/' && n === '/') { mode = 'line-comment'; continue; }
        if (c === '/' && n === '*') { mode = 'block-comment'; continue; }
        if (c === '/' && isRegexStart(src, i)) {
            let j = i + 1, cls = false;
            while (j < src.length) {
                const d = src[j];
                if (d === '\\') { j += 2; continue; }
                if (d === '\n') break;                    // غيرُ مُغلَقة: قسمةٌ لا نمط
                if (d === '[') cls = true; else if (d === ']') cls = false;
                else if (d === '/' && !cls) { j++; break; }
                j++;
            }
            while (j < src.length && /[a-z]/.test(src[j])) j++;   // الرايات
            set(i, j, 0); i = j; continue;
        }
        // 🔴 (أ) تُبتلع علامةُ الفتح هنا — وإغفالُها كان يجعل كلَّ نصٍّ كوداً.
        if (c === "'") { mode = 'sq'; st[i] = 2; i++; continue; }
        if (c === '"') { mode = 'dq'; st[i] = 2; i++; continue; }
        if (c === '`') { st[i] = 3; tpl.push(0); i++; continue; }
        if (c === '}' && tpl.length && tpl[tpl.length - 1] === 1) { st[i] = 3; tpl[tpl.length - 1] = 0; i++; continue; }
        st[i] = 0; i++;
    }
    return st;
}

const WRITE = /\b(writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|mkdir|createWriteStream|copyFileSync|renameSync|rmSync|rmdirSync|unlinkSync|unlink|cpSync)\s*\(/g;

/** @returns {{own:string[], generated:string[], inert:string[]}} `ملفّ:سطر` لكل موضع */
export function scanDiskWrites(root = BACKEND) {
    const own = [], generated = [], inert = [];
    for (const abs of walk(root)) {
        const rel = path.relative(root, abs);
        const src = fs.readFileSync(abs, 'utf8');
        const st = charStates(src);
        WRITE.lastIndex = 0;
        let m;
        while ((m = WRITE.exec(src))) {
            const at = `${rel}:${src.slice(0, m.index).split('\n').length}`;
            const s = st[m.index];
            if (s === 3) generated.push(at); else if (s === 0) own.push(at); else inert.push(at);
        }
    }
    return { own, generated, inert };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { own, generated, inert } = scanDiskWrites();
    const byFile = (l) => { const m = new Map(); for (const s of l) { const f = s.split(':')[0]; m.set(f, (m.get(f) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
    console.log(`كتابةٌ في كودِ الخلفية: ${own.length} موضعاً / ${byFile(own).length} ملفاً\n`);
    for (const [f, n] of byFile(own)) console.log(`  ${String(n).padStart(3)}  ${f}`);
    console.log(`\nداخل قوالبَ نصّية (كودٌ مولَّدٌ للمستخدم): ${generated.length}`);
    for (const g of generated) console.log(`     ${g}`);
    console.log(`\nفي تعليقٍ أو نصٍّ عاديّ (لا يُنفَّذ): ${inert.length}`);
    for (const d of inert) console.log(`     ${d}`);
}
