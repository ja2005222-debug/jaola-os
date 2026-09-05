/**
 * 🧭 layerEdges.mjs — اشتقاقُ حواف الاعتماد بين طبقات `backend/` من القرص.
 *
 * وُجد لأنّ `ARCHITECTURE_GAP_AUDIT.md` كان يقول إنّ أوامرَ قياسِه «محفوظةٌ في
 * /tmp أثناء الجلسة» — أي غيرَ موجودةٍ لمن يقرأ. وثيقةٌ تَعِدُ بإعادة إنتاجٍ
 * لا سبيلَ إليها هي نفسُها عطبُ «ادّعاءِ يقينٍ لا يملكه». فصار القياسُ ملفّاً.
 *
 * يقرأ الاستيرادَ الساكنَ **والديناميكيّ** معاً: `services/adminService.js`
 * يصل إلى مزوّد الـLLM بـ`await import(...)` مرّتين، وأولُ جردٍ ساكنٍ لي
 * أسقطه فأخطأتُ عدَّ المستهلكين. المسحُ الساكن لا يرى المسارَ المحسوب،
 * فالأعدادُ **حدٌّ أدنى** لا نهائيّ.
 *
 * التشغيل:  node scripts/layerEdges.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// تُستثنى مجلّداتُ الأثر والاعتماديات — لا مجلّداتُ الكود.
const SKIP = new Set(['node_modules', '.git', 'memory', 'workspaces', '.next', 'dist', 'build']);

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
        else if (/\.m?js$/.test(e.name)) out.push(p);
    }
    return out;
}

// طبقةُ الملفّ = مجلّدُه الأوّل؛ وما في الجذر طبقةُ `root` (أي `server.js`).
const layerOf = (rel) => (rel.includes(path.sep) ? rel.split(path.sep)[0] : 'root');

/** @returns {string[]} كلُّ ملفٍّ مسحَه الاشتقاق، بمسارٍ نسبيّ من `backend/` */
export function scannedFiles() {
    return walk(BACKEND).map((abs) => path.relative(BACKEND, abs));
}

/** @returns {{from:string,to:string,file:string,target:string}[]} حوافُ العبور بين الطبقات */
export function layerEdges() {
    const edges = [];
    for (const abs of walk(BACKEND)) {
        const rel = path.relative(BACKEND, abs);
        const from = layerOf(rel);
        const src = fs.readFileSync(abs, 'utf8');
        const specs = [
            ...src.matchAll(/from\s*['"](\.[^'"]+)['"]/g),
            ...src.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g),
        ].map((m) => m[1]);
        for (const s of specs) {
            const target = path.relative(BACKEND, path.resolve(path.dirname(abs), s));
            if (target.startsWith('..')) continue;          // خارج backend — ليس حافّةَ طبقة
            const to = layerOf(target);
            if (from !== to) edges.push({ from, to, file: rel, target });
        }
    }
    return edges;
}

export const edgesBetween = (edges, from, to) => edges.filter((e) => e.from === from && e.to === to);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const edges = layerEdges();
    const pairs = new Map();
    for (const e of edges) pairs.set(`${e.from} → ${e.to}`, (pairs.get(`${e.from} → ${e.to}`) || 0) + 1);
    console.log(`حوافُ العبور بين الطبقات: ${edges.length}\n`);
    for (const [k, v] of [...pairs].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
    const inv = edgesBetween(edges, 'services', 'agents');
    console.log(`\n🔻 انعكاسُ الطبقات (services → agents): ${inv.length}`);
    for (const e of inv.sort((a, b) => a.file.localeCompare(b.file))) console.log(`   ${e.file} → ${e.target}`);
}
