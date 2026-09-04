import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP = fs.readFileSync(path.join(BACKEND, 'ARCHITECTURE_MAP.md'), 'utf8');

const ROOT = path.resolve(BACKEND, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'memory', 'workspaces', 'tests', 'scripts', 'plugins', '.next', 'dist', 'build']);

// عدُّ الأسطر كما يعدّها wc -l — وهو ما دُوّنت به الخريطة
const countLines = (abs) => {
    const t = fs.readFileSync(abs, 'utf8');
    return t.split('\n').length - (t.endsWith('\n') ? 1 : 0);
};

function modules(dir = BACKEND, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) modules(p, out); }
        else if (e.name.endsWith('.js')) out.push(path.relative(BACKEND, p));
    }
    return out;
}

// الخريطةُ تصف المونوريبو كلَّه (backend وtravel-service وغيرهما)، فالبحثُ
// عن «شبحٍ» يجب أن يمسح الجذر لا مجلّداً واحداً — وإلا صار غيابُ النطاق
// دليلَ غياب، وهو خطأُ القياس نفسه الذي تحرسه هذه الاختبارات.
function allFiles(dir = ROOT, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) allFiles(p, out);
        else if (/\.m?jsx?$/.test(e.name)) out.push(path.basename(e.name));
    }
    return out;
}

// أسماءُ الملفات المذكورة نصّاً، والمجلّداتُ المذكورة جملةً (`x/*`)
const named = new Set([...MAP.matchAll(/`([^`]+\.m?js)`/g)].map((m) => path.basename(m[1])));

// التغطيةُ الجمليّة (`x/*`) تُقبل من **الخانة الأولى في صفّ جدول** وحدها —
// أي من جردٍ فعليّ. وقد كانت تُلتقط من النثر أيضاً، وفي المقدّمة سطرٌ يقول
// «`core/*` ← `agents/*` ← `services/*`»، فكان يُعَدّ تغطيةً لكل الخدمات
// ويجعل حارسَ الإغفال جوفاء. حارسٌ لا يقع أسوأ من لا حارس.
const globbed = MAP.split('\n')
    .filter((l) => l.startsWith('|'))
    .flatMap((l) => [...l.replace(/^\|/, '').split('|')[0].matchAll(/`([^`]+)\/\*`/g)].map((m) => m[1]));
const isCovered = (p) => named.has(path.basename(p)) || globbed.some((g) => p.includes(g + '/'));

// ═══════════════════════════════════════════════════════
// خريطةٌ تصف حالةً تجاوزها الكود هي عين العطب (Sprint 8/11).
// فتُقاس دعاواها بالقرص، لا تُقرأ.
// ═══════════════════════════════════════════════════════

// النطاق: backend وحده — وهو ما تفصّله الخريطة ملفاً بملف.
test('كل وحدةٍ في backend مذكورةٌ في الخريطة', () => {
    const orphans = modules().filter((p) => !isCovered(p));
    assert.deepEqual(orphans, [],
        `وحداتٌ موجودةٌ والخريطةُ لا تعرفها — أضِفها بحكمها:\n  ${orphans.join('\n  ')}`);
});

test('كل ملفٍ تسمّيه الخريطةُ حكماً حيّاً موجودٌ على القرص', () => {
    const live = [];
    for (const line of MAP.split('\n')) {
        if (!line.startsWith('|')) continue;
        const cells = line.split('|').map((c) => c.trim());
        // الحكمُ الحيّ: KEEP أو MODIFY. أما DELETE/MOVED فسِجلٌّ تاريخيّ.
        if (!cells.some((c) => c === 'KEEP' || c === 'MODIFY')) continue;
        for (const m of cells[1]?.matchAll(/`([^`]+\.m?js)`/g) || []) live.push(m[1]);
    }
    assert.ok(live.length > 50, `صفوفُ الأحكام الحيّة قليلةٌ على غير المتوقع: ${live.length}`);
    const all = new Set(allFiles());
    const ghosts = [...new Set(live.filter((n) => !n.includes('*') && !all.has(path.basename(n))))];
    assert.deepEqual(ghosts, [], `الخريطةُ تسمّي ملفاتٍ غيرَ موجودة: ${ghosts.join('، ')}`);
});

test('أعدادُ الأسطر المُعلَنة تطابق القرص', () => {
    const byName = new Map();
    for (const p of modules()) {
        const b = path.basename(p);
        if (!byName.has(b)) byName.set(b, []);
        byName.get(b).push(p);
    }
    const wrong = [];
    for (const line of MAP.split('\n')) {
        if (!line.startsWith('|')) continue;
        const cells = line.replace(/^\||\|$/g, '').split('|');
        const names = [...(cells[0]?.matchAll(/`([^`]+\.m?js)`/g) || [])].map((m) => m[1]);
        const nums = cells[1]?.match(/\d+/g) || [];
        if (!names.length || names.length !== nums.length) continue;
        names.forEach((n, i) => {
            const cands = byName.get(path.basename(n)) || [];
            const p = cands.length === 1 ? cands[0] : cands.filter((c) => c.endsWith(n))[0];
            if (!p) return;
            const actual = countLines(path.join(BACKEND, p));
            if (actual !== Number(nums[i])) wrong.push(`${p}: الخريطة ${nums[i]} ← القرص ${actual}`);
        });
    }
    assert.deepEqual(wrong, [], `أعدادٌ تجاوزها الكود:\n  ${wrong.join('\n  ')}`);
});

test('عددُ القوالب المُعلَن جملةً يطابق ما على القرص', () => {
    const m = /`cloneTemplates\/\*` \((\d+) ملفاً/.exec(MAP);
    assert.ok(m, 'صفُّ القوالب لم يعد يُعلن عدداً');
    const onDisk = fs.readdirSync(path.join(BACKEND, 'agents/cloneTemplates')).filter((f) => f.endsWith('.js')).length;
    assert.equal(Number(m[1]), onDisk);
});

// ═══════════════════════════════════════════════════════
// Sprint 2n قاس صفوفَ الجدول ولم يقس **عناوينَ الأقسام**. فبقيت تقول
// «`services/*` — 90 وحدة» وعلى القرص 70، و«server.js — 3702 سطراً» وهو
// 3753. عددٌ في عنوانٍ دعوى كعددٍ في صفّ، ولا يُصدَّق إلا محسوباً.
// ═══════════════════════════════════════════════════════

const dirCount = (prefix) => modules().filter((p) => p.startsWith(prefix + path.sep)).length;

test('أعدادُ عناوين الأقسام تطابق القرص', () => {
    const src = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8');
    const lines = src.split('\n');
    // الاستيرادُ المحلّيّ: ساكنٌ من مسارٍ نسبيّ — وهو ما عنته الخريطة.
    const localImports = lines.filter((l) => /^\s*import\s[^]*?from\s*['"]\./.test(l) || /^\s*import\s*['"]\./.test(l)).length;
    const routes = lines.filter((l) => /^\s*app\.(get|post|put|patch|delete|all)\(/.test(l)).length;

    const head = /^## A\)[^\n]*$/m.exec(MAP)[0];
    const [decLines, decRoutes, decImports] = (head.match(/\d+/g) || []).map(Number);
    assert.equal(decLines, countLines(path.join(BACKEND, 'server.js')), `عنوان A: أسطر server.js`);
    assert.equal(decRoutes, routes, 'عنوان A: عدد المسارات');
    assert.equal(decImports, localImports, 'عنوان A: عدد الاستيرادات المحلّية');

    const agents = /^## C\)[^—]*— (\d+) وحدة \(منها (\d+) قالب/m.exec(MAP);
    assert.ok(agents, 'عنوان C لم يعد يُعلن عدداً');
    assert.equal(Number(agents[1]), dirCount('agents'), 'عنوان C: وحدات agents');
    assert.equal(Number(agents[2]),
        fs.readdirSync(path.join(BACKEND, 'agents/cloneTemplates')).filter((f) => f.endsWith('.js')).length,
        'عنوان C: عدد القوالب');

    const services = /^## D\)[^—]*— (\d+) وحدة/m.exec(MAP);
    assert.ok(services, 'عنوان D لم يعد يُعلن عدداً');
    assert.equal(Number(services[1]), dirCount('services'), 'عنوان D: وحدات services');
});
