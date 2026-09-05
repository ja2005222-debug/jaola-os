// 💾 ماسحُ الكتابة على القرص — يُقاس بعيّنةٍ حقيقتُها معروفةٌ سلفاً
//
// الماسحُ أداةُ قياسٍ، وأداةُ القياس تُعايَر قبل أن يُوثَق بأرقامها. وقد أخطأ
// هذا الماسحُ مرّتين قبل أن يصحّ، وكلتاهما مُثبَّتةٌ هنا بحالةٍ صريحة:
//
//   • علامةُ الفتح كانت تُغلق نفسَها، فيُقرأ كلُّ نصٍّ عاديّ كوداً.
//   • الحرفيّةُ النمطيّة `/["'«»]/` كانت تفتح نصّاً لا يُغلق، فينحرف تصنيفُ
//     كلِّ ما بعدها. أبلغ الماسحُ حينها أنّ ٤٤ كتابةً حيّةً «لا تُنفَّذ».
//
// فلو عاد أحدُ العطبين لسقطت هذه الحالاتُ بأسمائها لا بعددٍ مجمل.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { scanDiskWrites, charStates } from '../scripts/diskWrites.mjs';

divertConsoleToStderr();

const FIXTURE = `import fs from 'fs';
fs.writeFileSync('a', 1);
const gen = \`
  fs.writeFileSync('b', 2);
\`;
const nested = \`x \${ (() => { fs.mkdirSync('c'); })() } y\`;
const deep = \`outer \${ \`inner \${ 1 }\` } fs.appendFileSync('d')\`;
// fs.rmSync('e')
const s = "fs.unlinkSync('f')";
/* fs.copyFileSync('g') */
const re = /["'«»]/g;
fs.writeFileSync('after-regex', 1);
const div = 10 / 2 / 1;
fs.mkdirSync('after-div');
`;

function withFixture(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-writescan-'));
    try { fs.writeFileSync(path.join(dir, 'case.js'), FIXTURE); return fn(dir); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('التصنيفُ يطابق الحقيقةَ المعروفة سطراً بسطر', () => {
    const { own, generated, inert } = withFixture((d) => scanDiskWrites(d));
    const at = (l) => `case.js:${l}`;
    assert.deepEqual(own, [at(2), at(6), at(12), at(14)],
        'كتابةُ الكود: السطرُ ٦ داخل `${}` كودٌ حقيقيّ، و١٢ بعد نمطٍ فيه علامتا نصّ، و١٤ بعد قسمة');
    assert.deepEqual(generated, [at(4), at(7)], 'ما داخل القالب النصّيّ — ٧ قالبٌ يُفتح ويُغلق في سطره');
    assert.deepEqual(inert, [at(8), at(9), at(10)], 'تعليقٌ سطريّ، ونصٌّ عاديّ، وتعليقٌ كتليّ');
});

test('النصُّ العاديّ ليس كوداً — علامةُ الفتح تُبتلع', () => {
    const st = charStates(`const s = "x";`);
    assert.equal(st['const s = '.length], 2, 'علامةُ الفتح نفسُها يجب أن تُعَدَّ نصّاً');
    assert.equal(st['const s = "'.length], 2, 'ما بعدها نصّ');
});

test('النمطُ الحرفيُّ لا يفتح نصّاً — وما بعده يبقى كوداً', () => {
    const src = `const re = /["'«»]/g;\nfs.writeFileSync('x', 1);`;
    const st = charStates(src);
    assert.equal(st[src.indexOf('writeFileSync')], 0, 'انحرف التصنيفُ بعد النمط — العطبُ (ب) عاد');
});

test('الماسحُ يرى الخلفيةَ الحقيقية — لا نتيجةَ على مجموعةٍ خاوية', () => {
    const { own, inert } = scanDiskWrites();
    assert.ok(own.length > 100, `مواضعُ الكتابة ${own.length} — الماسحُ لا يرى الشجرة`);
    assert.ok(own.some((s) => s.startsWith('server.js:')), 'لم يُمسح `server.js`');
    assert.ok(own.some((s) => s.startsWith('services/')), 'لم تُمسح `services/`');
    // صفرٌ هنا **نتيجةٌ** لا افتراض: أيُّ ارتفاعٍ يعني انحرافَ التصنيف من جديد.
    assert.deepEqual(inert, [], `مواضعُ صُنّفت «لا تُنفَّذ» — افحصها بيدك قبل تصديقها:\n  ${inert.join('\n  ')}`);
});
