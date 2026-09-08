// 🏷️ حارسُ حدودٍ لمفرداتِ الوسم — لا اختبارُ سلوك.
//
// **لماذا حارسٌ لا اختبارات**: وُسِمت أربعةٌ وعشرون موضعَ نداء. الحسّاسةُ منها قِيست سلوكيّاً
// حيث الخطرُ حقيقيّ (تصريفُ التدفّق في `chatResponseStage`، حلقتا المولّد في
// `providerSelection` بعمليّةٍ ابنة، وكلاءُ العقود في `agentRuntime`). أمّا البقيّةُ فلفٌّ
// مباشرٌ حول نداءٍ واحد: طفرةُ إسقاطِ أيٍّ منها **نجت** من الحزمة كلِّها — وثمنُ قتلها
// سلوكيّاً ثمانيةَ عشرَ اختبارَ عمليّةٍ ابنة لأجل عدّادٍ لا يغيّر سلوكاً. فالثمنُ لا يُدفع،
// والفجوةُ **تُقال ولا تُخفى**: هذا الحارسُ يقع إن سقط وسمٌ أو تبدّل اسمُه، ولا يدّعي أكثر.
//
// وحين يقع: صحِّح القائمةَ **واكتب فوق التصحيح لماذا تغيّرت** (قاعدةُ حارس الحدود).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dirname, '..');
const DIRS = ['agents', 'services', 'core'];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return e.isFile() && p.endsWith('.js') ? [p] : [];
});
const FILES = [...DIRS.flatMap((d) => walk(path.join(ROOT, d))), path.join(ROOT, 'server.js')];

/** كلُّ وسمٍ حرفيٍّ مكتوبٍ في الشجرة، ووسمُ وكلاء العقود المشتقُّ من `agent.id`. */
function labelsInSource() {
    const found = new Set();
    for (const f of FILES) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(/withUsageLabel\('([^']+)'/g)) found.add(m[1]);
        if (src.includes('withUsageLabel(`agent:${agent.id}`')) found.add('agent:<id>');
    }
    return [...found].sort();
}

// 📌 المفرداتُ المثبّتة — أربعةٌ وعشرون موضعاً تُنتج اثنين وعشرين وسماً (المولّدُ موضعان
//    لوسمَين، والمراجعُ والمسوّقُ وحارسُ الكود يتكرّر وسمُ كلٍّ منها في موضعَين).
const PINNED = [
    'agent:<id>',          // كلُّ وكلاء العقود عبر runAgent — نقطةُ نسبٍ واحدة
    'backend', 'blueprint', 'bot:agent', 'bot:site', 'chat', 'clarifier',
    'codeguard', 'coder:edit', 'coder:generate', 'db:postgres', 'db:schema',
    'designer', 'marketing', 'memory:summarize', 'page:section', 'patch',
    'product-model', 'requirements', 'review', 'router', 'verify:requirements',
];

test('🔴 مفرداتُ الوسم كما ثُبِّتت — وسمٌ ساقطٌ يعني نداءً يذهب إلى «بلا وسم» بلا خبر', () => {
    assert.deepEqual(labelsInSource(), PINNED);
});

test('الحدّ: لا وسمَ فارغاً ولا وسمَ بمسافاتٍ وحدَها — يفتح نطاقاً لا يُنسَب إليه شيء', () => {
    for (const label of PINNED) assert.ok(label.trim().length >= 2, `وسمٌ أعرج: «${label}»`);
});
