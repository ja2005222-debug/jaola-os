/**
 * 🚪 حارسُ الاستيراد الذي لا يُستدعى — Sprint 3h
 *
 * وحدةٌ تستوردُ اسماً ثم لا تناديه تَعِدُ بما لا تفعل. وأخطرُ أشكالِ هذا
 * الوعدِ حارسٌ: `hasActiveMission` في `server.js`، و`canStartNewBuild`
 * و`markAgentComplete` في `jcr.js` — كلُّها مستوردةٌ ولا سطرَ يناديها،
 * فيبدو الملفُّ كأنّه يحرسُ ما لا يحرس. وواحدٌ منها — `migrateDatabase` —
 * كان المرجعَ الوحيدَ في المستودعِ كلِّه لوحدةٍ من ١٩٣ سطراً.
 *
 * القائمةُ هنا مشتقّةٌ من الشجرةِ لا مكتوبةٌ بيدٍ: كلُّ `.js` حيٍّ في
 * الخادم يُفحَص، فلا ينجو ملفٌّ بأن يُنسى.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'tests', 'workspace', 'memory', 'knowledge', 'plugin-templates', 'docs', 'scripts']);

function liveModules(dir = BACKEND, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) liveModules(p, out);
        else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
}

// جملةُ استيرادٍ حقيقية تبدأ سطرها؛ ونظيرتُها داخل قالبٍ نصّي (كود مولَّد،
// كما في `renderAgent.js`) ليست استيراداً لهذا الملف بل نصٌّ يكتبه.
const IMPORT = /^import\s+([\w$*{}\s,]+?)\s+from\s+['"]([^'"]+)['"]/gm;

function insideTemplate(src, idx) {
    let ticks = 0;
    for (let i = 0; i < idx; i += 1) if (src[i] === '`' && src[i - 1] !== '\\') ticks += 1;
    return ticks % 2 === 1;
}

export function unusedImports(file) {
    const src = fs.readFileSync(file, 'utf8');
    const dead = [];
    IMPORT.lastIndex = 0;
    let m;
    while ((m = IMPORT.exec(src)) !== null) {
        if (insideTemplate(src, m.index)) continue;
        const clause = m[1];
        const names = [];
        const braced = clause.match(/\{([^}]*)\}/);
        if (braced) {
            for (const part of braced[1].split(',')) {
                const t = part.trim();
                if (!t) continue;
                const alias = t.split(/\s+as\s+/);
                names.push((alias[1] || alias[0]).trim());
            }
        }
        const ns = clause.match(/\*\s+as\s+([\w$]+)/);
        if (ns) names.push(ns[1]);
        const def = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[\w$]+/, '').replace(/,/g, ' ').trim();
        if (def) names.push(def);

        // الجسدُ = الملفُّ بلا هذه الجملة. و«...» تُبدَّل فراغاً كي لا تُقرأ
        // نقطتُها الأخيرة وصولاً إلى عضو فيُظنَّ `...getUsage(x)` وصولاً.
        const body = (src.slice(0, m.index) + src.slice(m.index + m[0].length)).replace(/\.\.\./g, ' ');
        for (const n of names) {
            if (!/^[\w$]+$/.test(n)) continue;
            const used = new RegExp(`(?<![\\w$.])${n.replace(/\$/g, '\\$')}(?![\\w$])`).test(body);
            if (!used) dead.push(`${path.relative(BACKEND, file)}: ${n} ← ${m[2]}`);
        }
    }
    return dead;
}

test('الفحصُ يرى سطحاً حقيقياً لا حفنةَ ملفات', () => {
    const mods = liveModules();
    assert.ok(mods.length >= 100, `عدد الوحدات المفحوصة ${mods.length} — الاشتقاقُ انهار`);
    assert.ok(mods.some((f) => f.endsWith('server.js')), 'server.js خارج الفحص');
    assert.ok(mods.some((f) => f.endsWith(path.join('agents', 'jcr.js'))), 'jcr.js خارج الفحص');
});

test('لا وحدةَ تستوردُ اسماً لا تناديه', () => {
    const dead = liveModules().flatMap(unusedImports);
    assert.deepEqual(dead, [], `استيراداتٌ بلا نداء:\n  ${dead.join('\n  ')}`);
});

test('الكاشفُ يقظ: اسمٌ مستوردٌ غيرُ مستعملٍ يُكشَف، ومستعملٌ لا يُتَّهم', () => {
    const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'deadimp-'));
    const live = path.join(dir, 'live.js');
    fs.writeFileSync(live, "import { a, b } from './x.js';\nexport const r = { ...a(1), n: b };\n");
    assert.deepEqual(unusedImports(live), [], 'الانتشارُ «...a» استعمالٌ لا وصولٌ لعضو');

    const dead = path.join(dir, 'dead.js');
    fs.writeFileSync(dead, "import { a, b } from './x.js';\nexport const r = a(1);\n");
    assert.equal(unusedImports(dead).length, 1);
    assert.match(unusedImports(dead)[0], /: b ←/);

    const tpl = path.join(dir, 'tpl.js');
    fs.writeFileSync(tpl, "export const gen = () => `\nimport express from 'express';\nconst app = express();\n`;\n");
    assert.deepEqual(unusedImports(tpl), [], 'استيرادٌ داخل قالبٍ نصّي كودٌ مولَّد لا استيرادُ الملف');

    fs.rmSync(dir, { recursive: true, force: true });
});
