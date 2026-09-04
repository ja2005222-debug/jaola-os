// 🗺️ حارسُ الإدراك: أيّ وحدةٍ يصل إليها الخادم فعلاً؟
//
// 🔴 `ARCHITECTURE_MAP.md` صنّف الوحدات ورقةً ورقة ولم يمشِ البيان. فأعطى
// وحداتٍ وراء `taskExecutor.js` حكم KEEP/MODIFY، وهو **غائبٌ عن الخريطة
// كلّها** ولا يستورده شيء. أحكامٌ على وحداتٍ لا يصل إليها الخادم.
// وقد حُذفت تلك الجزيرة (Sprint 2o)؛ وبقي هذا الحارس لأن العلّة ليست
// الملفات بل الطريقة: حكمٌ يُكتَب في وثيقة تُصدَّق بدل أن يُحسَب.
//
// فالحكم هنا لا يُكتَب في وثيقة تُصدَّق: يُحسَب. الماشي يبدأ من `server.js`
// ويتبع كل `import` نصّيّ (ثابتاً وديناميكياً)، والقائمة أدناه **إقرارٌ**
// لا وصف: تيتُّمُ وحدةٍ جديدة يُسقط الاختبار، ووصلُ يتيمةٍ يُسقطه أيضاً —
// فلا يمرّ أيٌّ من الأمرين صامتاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SPEC = /(?:^|[^\w.])(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
const SCANNED = ['services', 'agents', 'core', 'middleware', 'routes', 'config', 'models', 'utils'];

// 📌 اليتامى المُقرّون — ما بقي بعد حذف جزيرة `taskExecutor` (Sprint 2o).
// `projectManager` و`twin` كانا يصلان عبرها، فصارا قائمَين بذاتهما.
// ومنها `utils/security.js` الذي يشارك اسمَ `middleware/security.js` الحيّ
// ويختلف عنه محتوىً (escapeHtml مقابل sanitizePath)، فيَقرأ القارئُ الميتَ
// ظانّاً أنه الحيّ. وثلاثةٌ منهم **لا تُحمَّل أصلاً** (اعتمادٌ غير مثبَّت:
// uuid، better-sqlite3) — مُثبَتٌ بمحاولة استيراد كلٍّ منها.
const DECLARED_ORPHANS = [
    'services/db.js',
    'services/logger.js',
    'services/projectManager.js',
    'services/twin.js',
    'utils/aiProvider.js',
    'utils/performance.js',
    'utils/security.js',
];

function importsOf(file) {
    const out = new Set();
    for (const m of fs.readFileSync(file, 'utf8').matchAll(SPEC)) {
        const abs = path.resolve(path.dirname(file), m[1]);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) out.add(abs);
        else if (fs.existsSync(abs + '.js')) out.add(abs + '.js');
    }
    return out;
}

function reachableFrom(entry) {
    const seen = new Set([entry]);
    const stack = [entry];
    while (stack.length) for (const d of importsOf(stack.pop())) if (!seen.has(d)) { seen.add(d); stack.push(d); }
    return seen;
}

function allModules() {
    const out = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) out.push(p);
    } };
    for (const d of SCANNED) { const p = path.join(ROOT, d); if (fs.existsSync(p)) walk(p); }
    return out;
}

const reached = reachableFrom(path.join(ROOT, 'server.js'));
const orphans = allModules().filter((f) => !reached.has(f))
    .map((f) => path.relative(ROOT, f).replace(/\\/g, '/')).sort();

test('🗺️ اليتامى هم المُقرّون بهم — لا وحدةٌ تيتّمت صامتةً ولا يتيمةٌ وُصلت صامتةً', () => {
    const surprises = orphans.filter((f) => !DECLARED_ORPHANS.includes(f));
    const revived = DECLARED_ORPHANS.filter((f) => !orphans.includes(f));
    assert.deepEqual(surprises, [], `تيتّمت بلا إقرار: ${surprises.join('، ')}`);
    assert.deepEqual(revived, [], `وُصلت وبقي إقرارها: ${revived.join('، ')} — احذفها من القائمة`);
});

test('🗺️ الماشي يقيس شيئاً: الخادم نفسه مُدرَك، ونواةٌ حيّة معه', () => {
    assert.ok(reached.size > 100, `مُدرَك ${reached.size} ملف فقط — الماشي لم يمشِ`);
    for (const live of ['services/siteCms.js', 'services/storeKey.js', 'middleware/adminOnly.js',
        'core/runtime/workspacePaths.js', 'routes/billing.js']) {
        assert.ok(reached.has(path.join(ROOT, live)), `${live} حيٌّ ولم يُدرَك — الماشي أعمى`);
    }
});

test('🗺️ الخريطة تذكر كل يتيمٍ باسمه — لا حكمَ KEEP على ما لا يُدرَك', () => {
    const map = fs.readFileSync(path.join(ROOT, 'ARCHITECTURE_MAP.md'), 'utf8');
    const missing = DECLARED_ORPHANS.filter((f) => !map.includes(path.basename(f)));
    assert.deepEqual(missing, [], `يتامى لا تذكرهم الخريطة: ${missing.join('، ')}`);
    assert.match(map, /## 🧭 اليتامى/, 'قسم اليتامى غائبٌ عن الخريطة');
});
