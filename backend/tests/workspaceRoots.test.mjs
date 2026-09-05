// 🗂️ جذورُ القرص تُصرَّح مرّةً واحدة
//
// قبل Sprint 4h كانت الجذورُ الثلاثة التي تكتب فيها الخلفية (`workspace`،
// `memory`، `plugins`) تُشتقّ في **اثني عشر موضعاً** مستقلاًّ، كلٌّ بعدِّ `..`
// خاصٍّ به. حلَّت كلُّها إلى المسارات نفسها يومَها — لكنّ ذلك حظٌّ لا ضمانة،
// ولا يمكن ضبطُ ما لا مكانَ واحداً يسمّيه.
//
// 🔴 يُقاس بنصِّ الملفّات لا بقيمةِ الثوابت: لو سألنا الوحداتِ عن جذورها
//    لأجابت جميعُها الجوابَ الصحيح **حتى لو اشتقّه كلٌّ منها بيده** — فيمرّ
//    الحارسُ على العطب الذي وُجد له. (خطأُ `templateRegistrySync` في 4d.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECLARER = 'core/runtime/workspaceRoots.js';
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

// اشتقاقُ جذرٍ = حرفيّةُ مسارٍ صاعدةٌ بـ`..` تنتهي إلى أحد الأسماء الثلاثة.
const DERIVES = /(['"])(?:\.\.\/)+(?:workspace|memory|plugins)(?:\/[^'"]*)?\1/;

const files = walk(BACKEND);

test('المسحُ وصل الطبقاتِ فعلاً — لا حارسَ على مجموعةٍ خاوية', () => {
    assert.ok(files.length > 150, `ملفّاتٌ ممسوحة: ${files.length}`);
    for (const layer of ['agents', 'services', 'core', 'routes', 'middleware']) {
        assert.ok(files.some((f) => f.startsWith(layer + path.sep)), `لم يُمسح \`${layer}/\``);
    }
    assert.ok(files.includes('server.js'), 'لم يُمسح `server.js`');
});

test('النمطُ قادرٌ على المطابقة — يلتقط المُصرِّحَ نفسه', () => {
    // لولا هذا لَمرَّ الاختبارُ التالي بنمطٍ لا يطابق شيئاً أبداً.
    const src = fs.readFileSync(path.join(BACKEND, DECLARER), 'utf8');
    assert.match(src, DERIVES, 'النمطُ لا يطابق حتى ملفَّ التصريح — فهو معطوب');
});

test('لا أحدَ يشتقّ جذراً غير ملفِّ التصريح', () => {
    const offenders = files.filter((f) => f !== DECLARER
        && DERIVES.test(fs.readFileSync(path.join(BACKEND, f), 'utf8')));
    assert.deepEqual(offenders, [],
        `اشتقاقٌ ثانٍ لجذرٍ مُصرَّح — استورده من \`${DECLARER}\`:\n  ${offenders.join('\n  ')}`);
});

test('الجذورُ المُصرَّحة تطابق ما كانت تحلّ إليه الاشتقاقاتُ القديمة', async () => {
    const r = await import('../core/runtime/workspaceRoots.js');
    assert.equal(r.WORKSPACE_ROOT, path.resolve(BACKEND, '../workspace'));
    assert.equal(r.MEMORY_ROOT, path.resolve(BACKEND, 'agents', '../memory'));
    assert.equal(r.PLUGINS_ROOT, path.resolve(BACKEND, 'services', '../plugins'));
    assert.equal(r.memoryFile('x.json'), path.join(r.MEMORY_ROOT, 'x.json'));
});

test('التصريحُ اشتقاقٌ نقيّ — لا يُنشئ شيئاً على القرص', () => {
    const src = fs.readFileSync(path.join(BACKEND, DECLARER), 'utf8');
    assert.doesNotMatch(src, /mkdirSync|writeFileSync|\bfs\b/,
        'ملفُّ التصريح لمس القرص — وخلطُ الاشتقاقِ بالإنشاء هو عطبُ `getProjectPath` بعينه');
});
