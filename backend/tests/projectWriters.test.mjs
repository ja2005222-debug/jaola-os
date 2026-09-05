// ✍️ كاتبا ملفّات المشروع (`writeProjectFile`/`writePlanFiles`) خرجا من jcr إلى
// `core/runtime/workspacePaths.js` بجوار `resolveProjectFile` الذي يحتويهما (JCR/7).
//
// لماذا: أيُّ مرحلةٍ تخرج من jcr وتكتب ملفّات (أوّلُها `_stageRequirementsVerify`)
// كانت ستستوردهما من jcr — دورةٌ يمنعها الحارس. `projectWriteContainment` كان يثبّت
// وجودَ الكاتب في jcr نفسِه؛ أُعيد تثبيتُه على البيت الجديد وعلى استيراد jcr منه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeProjectFile, writePlanFiles } from '../core/runtime/workspacePaths.js';

const HERE = import.meta.dirname;
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-writers-'));

test('writeProjectFile: يكتب المتداخلَ داخل الجذر ويعيد true؛ ويرفض الهروبَ بـfalse بلا أثر', async () => {
    const r = root();
    assert.equal(await writeProjectFile(r, 'css/styles.css', 'body{}'), true);
    assert.equal(fs.readFileSync(path.join(r, 'css', 'styles.css'), 'utf8'), 'body{}');
    for (const bad of ['../escape.html', '/etc/passwd', '.env', 'a/../../b.js']) {
        assert.equal(await writeProjectFile(r, bad, 'x'), false, `قُبل ${bad}`);
    }
    assert.ok(!fs.existsSync(path.join(r, '..', 'escape.html')), 'لا كتابةَ خارج الجذر');
    assert.deepEqual(fs.readdirSync(r), ['css'], 'لا أثرَ للمرفوض داخل الجذر');
});

test('writePlanFiles: الرفضُ يُحصى لا يُبتلع — والمحتوى غيرُ النصّيّ لا يُكتب', async () => {
    const r = root();
    const res = await writePlanFiles(r, [
        { name: 'index.html', content: '<h1>x</h1>' },
        { name: '../out.html', content: 'x' },
        { name: 'script.js', content: 42 },
        { name: '', content: 'x' },
        null,
        { name: '.env.example', content: 'KEY=' },
    ]);
    assert.deepEqual(res, { written: 2, rejected: ['../out.html', 'script.js'] });
    assert.deepEqual(fs.readdirSync(r).sort(), ['.env.example', 'index.html']);
});

test('الحدود: jcr يستورد الكاتبَين ولا يعرّفهما؛ وبيتُهما في core لا يستورد من agents/services', () => {
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(!/async function writeProjectFile\(|async function writePlanFiles\(/.test(jcr), 'التعريفُ رحل');
    assert.match(jcr, /import \{[^}]*\bwriteProjectFile\b[^}]*\} from '\.\.\/core\/runtime\/workspacePaths\.js'/);
    assert.match(jcr, /import \{[^}]*\bwritePlanFiles\b[^}]*\} from '\.\.\/core\/runtime\/workspacePaths\.js'/);
    const wp = fs.readFileSync(path.join(HERE, '../core/runtime/workspacePaths.js'), 'utf8');
    assert.match(wp, /^export async function writeProjectFile\(root, name, content\) \{$/m);
    assert.match(wp, /^export async function writePlanFiles\(projectPath, files\) \{$/m);
    assert.ok(!/from '\.\.\/\.\.\/(agents|services)\//.test(wp), 'core لا يستورد من agents/services');
});
