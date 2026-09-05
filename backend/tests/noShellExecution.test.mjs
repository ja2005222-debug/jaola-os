// 🐚 لا صدفةَ في الخلفية — والعددُ المُعلَن كان مبالغاً فيه
//
// قال `ARCHITECTURE_GAP_AUDIT.md`: «تشغيلُ أمرِ صدفة — ١٦ موضعاً». والمقيس
// أنّ النمطَ التقط `.exec()` **للتعابير النمطيّة** فعدَّها تشغيلَ أوامر.
// والحقيقةُ من `child_process` نفسِه:
//
//   • `agents/gitAgent.js` → `execFile` (مصفوفة، بلا صدفة).
//   • `agents/backendTeam/backendVerify.js` → `spawn(process.execPath, [...])`.
//   • `services/projectManager.js` → **`exec`** — الوحيدُ الذي كان يستعمل صدفة.
//   • `agents/dependencyAgent.js` → السلسلة `'child_process'` داخل قائمةِ
//     وحداتِ Node المدمجة. **ذِكرٌ لا استيراد.**
//
// والوحيدُ كان يُركّب مدخلاتٍ في سلسلةِ الأمر: اسمَ مشروعٍ من المستخدم ومسارَه.
// وهو **غيرُ قابلٍ للتحميل** اليوم (`uuid` و`better-sqlite3` غيرُ مثبَّتَين)،
// فالعطبُ خاملٌ لا حيّ — لكنّ خمولَه اليومَ ليس أماناً غداً: مَن يُحييه يرث
// الثغرة. أُزيلت الصدفةُ منه، وهذا الحارسُ يمنع عودتها في أيِّ وحدة.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'memory', 'workspaces', '.next', 'dist', 'build', 'tests']);

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
        else if (/\.m?js$/.test(e.name)) out.push(path.relative(BACKEND, p));
    }
    return out;
}

const files = walk(BACKEND);
const read = (f) => fs.readFileSync(path.join(BACKEND, f), 'utf8');

// الاستيرادُ الحقيقيّ من `child_process` — لا مجرّدُ ذكرِ الاسم في نصّ.
const IMPORTS_CP = /(?:import[^;]*from\s*['"](?:node:)?child_process['"]|require\(\s*['"](?:node:)?child_process['"]\s*\))/;

test('المسحُ ليس خاوياً', () => {
    assert.ok(files.length > 150, `ملفّاتٌ ممسوحة: ${files.length}`);
    assert.ok(files.includes('services/projectManager.js'), 'الملفُّ محلُّ الفحص غائب');
});

test('مَن يستورد child_process معروفٌ بالاسم — لا يزيد صامتاً', () => {
    const users = files.filter((f) => IMPORTS_CP.test(read(f))).sort();
    assert.deepEqual(users, [
        'agents/backendTeam/backendVerify.js',
        'agents/gitAgent.js',
        'services/projectManager.js',
    ], 'وحدةٌ جديدةٌ تستورد `child_process` — قرارٌ يُتّخذ لا ينزلق');
});

test('لا وحدةَ تستورد `exec` أو `execSync` — الصدفةُ تُفسّر ما لا نقصده', () => {
    const shellUsers = files.filter((f) => {
        const src = read(f);
        if (!IMPORTS_CP.test(src)) return false;
        return /\b(?:exec|execSync)\b\s*(?:,|\})/.test(src.match(/import\s*\{[^}]*\}\s*from\s*['"](?:node:)?child_process['"]/)?.[0] || '');
    });
    assert.deepEqual(shellUsers, [],
        `استيرادُ \`exec\`/\`execSync\` عاد — استعمل \`execFile\`/\`spawn\` بمصفوفةِ معاملات:\n  ${shellUsers.join('\n  ')}`);
});

test('لا تركيبَ مدخلاتٍ في سلسلةِ أمر', () => {
    const bad = [];
    for (const f of files) {
        const src = read(f);
        if (!IMPORTS_CP.test(src)) continue;
        // سلسلةٌ نصّيّةٌ فيها `${...}` وتُمرَّر إلى مُشغِّل
        for (const m of src.matchAll(/(?:exec|execSync|execFile|spawn)\w*\(\s*`[^`]*\$\{/g)) {
            bad.push(`${f}: ${m[0].slice(0, 40)}…`);
        }
    }
    assert.deepEqual(bad, [], `أمرٌ يُبنى بتركيبِ نصّ — هذا مدخلُ الحقن:\n  ${bad.join('\n  ')}`);
});

test('`projectManager` لا يستدعي صدفةً بعد الإصلاح', () => {
    const src = read('services/projectManager.js');
    // 🔴 كان هنا `/execFile/` وحده — ويمرّ حتى لو زال **النداء**، لأنّ سطرَ
    //    الاستيراد وحدَه يحمل الاسم. نجت منه طفرةٌ أسقطت `execFileAsync(`.
    //    فيُطلب النداءُ نفسُه بمعاملاتٍ مصفوفة.
    assert.match(src, /await execFileAsync\(\s*'npx',\s*\[/,
        'نداءُ `execFileAsync` بمصفوفةٍ اختفى — قد يكون عاد إلى صدفة');
    assert.match(src, /spawn\('npm',\s*\[/, 'نداءُ `spawn` بمصفوفةٍ اختفى');
    assert.doesNotMatch(src, /cd "\$\{/, 'عاد `cd` داخل سلسلةِ أمر');
    assert.doesNotMatch(src, /npx create-next-app@latest \$\{/, 'عاد تركيبُ اسم المشروع في الأمر');
});
