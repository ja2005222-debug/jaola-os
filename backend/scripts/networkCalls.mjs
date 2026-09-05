/**
 * 🌐 networkCalls.mjs — جردُ النداء الشبكيّ الصادر من `backend/`، ومهلةِ كلٍّ.
 *
 * وُجد لأنّ `ARCHITECTURE_GAP_AUDIT.md` قدّر «٣٩ نداءً شبكيّاً: agents 30».
 * والمقيس: **١٥ في كودِ الخلفية، منها ٦ في `agents/`** — و**٨١ مطابقةً داخلَ
 * قوالبَ نصّية**: `fetch` في كودٍ نولّده لموقع المستخدم، يُنفَّذ في متصفّحه
 * لا عندنا. عدُّها نداءاتِ خلفيةٍ خطأٌ في الحكم لا في العدّ، وهي وحدَها
 * تفسّر الفجوة.
 *
 * ── ما يقيسه هذا الماسحُ فوق العدّ: **المهلة**
 *
 * `fetch` في Node **لا تنتهي مهلتُها أبداً** بلا `AbortSignal`. فموضعٌ بلا
 * مهلةٍ ليس أسلوباً أردأ، بل تعليقٌ غيرُ محدود. ولذلك يفصل الماسحُ
 * `timed` عن `untimed` بدل أن يعدّ الجميع سواء.
 *
 * ── حدٌّ عولج: الأقواسُ داخلَ النصوص
 *
 * تحديدُ نطاقِ وسائطِ النداء يحتاج موازنةَ أقواس، و`)` داخلَ سلسلةٍ نصّيّة
 * ليست قوسَ إغلاق. تُوزن الأقواسُ على حالاتِ المحارف من `diskWrites.mjs`
 * (كودٌ فقط)، لا على النصّ الخام.
 *
 * التشغيل:  node scripts/networkCalls.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { charStates } from './diskWrites.mjs';

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

/** نداءاتٌ تحمل مهلتَها بحكم تعريفها — البوّابةُ تفرضها. */
export const TIMED_CALLERS = Object.freeze(['fetchWithTimeout', 'fetchJsonWithRetry']);

const CALL = new RegExp(
    `\\b(${TIMED_CALLERS.join('|')}|fetch|axios(?:\\.(?:get|post|put|patch|delete|head|request))?|https?\\.(?:request|get))\\s*\\(`,
    'g',
);

/** نطاقُ وسائطِ نداءٍ يبدأ قوسُه عند `open` — بموازنةٍ تتجاهل النصوصَ. */
export function argSpan(src, open, st = charStates(src)) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (st[i] !== 0) continue;              // 🔴 `)` داخلَ نصٍّ ليست إغلاقاً
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) return src.slice(open, i + 1);
    }
    return src.slice(open);
}

/** @returns {{timed:string[], untimed:string[], generated:string[], inert:string[]}} */
export function scanNetworkCalls(root = BACKEND) {
    const timed = [], untimed = [], generated = [], inert = [];
    for (const abs of walk(root)) {
        const rel = path.relative(root, abs);
        const src = fs.readFileSync(abs, 'utf8');
        const st = charStates(src);
        CALL.lastIndex = 0;
        let m;
        while ((m = CALL.exec(src))) {
            const at = `${rel}:${src.slice(0, m.index).split('\n').length} → ${m[1]}`;
            const s = st[m.index];
            if (s === 3) { generated.push(at); continue; }
            if (s !== 0) { inert.push(at); continue; }
            const open = m.index + m[0].length - 1;
            const hasTimeout = TIMED_CALLERS.includes(m[1]) || /\bsignal\s*:/.test(argSpan(src, open, st));
            (hasTimeout ? timed : untimed).push(at);
        }
    }
    return { timed, untimed, generated, inert };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { timed, untimed, generated, inert } = scanNetworkCalls();
    console.log(`نداءٌ شبكيٌّ في كودِ الخلفية: ${timed.length + untimed.length} موضعاً\n`);
    console.log(`بمهلة: ${timed.length}`);
    for (const t of timed) console.log(`     ${t}`);
    console.log(`\n🔴 بلا مهلة: ${untimed.length}`);
    for (const u of untimed) console.log(`     ${u}`);
    console.log(`\nداخل قوالبَ نصّية (كودٌ لموقع المستخدم): ${generated.length}`);
    console.log(`في تعليقٍ أو نصّ: ${inert.length}`);
}
