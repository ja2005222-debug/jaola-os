// 📖 القارئان يخرجان من jcr: `readCurrentCodeContextAsync` → `projectReader.js#readCodeContext`،
// `readProjectFilesArray` → `projectReader.js#readProjectFiles` (JCR/15). لا `this` فيهما أصلاً؛ المفوِّضان
// يبقيان على الصنف لأنّ ١٢ مستدعياً و`jcrSurgicalEdit` يمرّون بهما. التوصيفُ الأوّل: ما يُقرأ وما يُهمَل،
// الترتيب، احتياطُ `script.js`، السلوكُ عند الغياب — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { readCodeContext, readProjectFiles } from '../agents/projectReader.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const write = (dir, files) => { for (const [n, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), c); } return dir; };
const PAGE = '<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>x</h1><script src="app.js"></script></body></html>';

test('سياقُ الكود: الثلاثةُ المعروفة فقط، بترتيب القرص، بفواصلها بحروفها — وapp.js أعمى هنا', async () => {
    const dir = write(emptyProject(), { 'index.html': PAGE, 'styles.css': 'body{}', 'script.js': 'x()', 'app.js': 'y()', 'extra.css': 'p{}', 'README.md': '#' });
    const ctx = await readCodeContext(dir);
    assert.equal(ctx, `\n--- index.html ---\n${PAGE}\n\n--- script.js ---\nx()\n\n--- styles.css ---\nbody{}\n`);
    assert.ok(!ctx.includes('y()') && !ctx.includes('p{}'), 'app.js وextra.css لا يدخلان سياقَ الكود (القارئُ القديم)');
});

test('سياقُ الكود: مجلّدٌ غائب أو فارغ → نصٌّ فارغ بلا رمي', async () => {
    assert.equal(await readCodeContext(path.join(emptyProject(), 'nope')), '');
    assert.equal(await readCodeContext(emptyProject()), '');
});

test('مصفوفةُ الملفّات: كلُّ CSS أوّلاً، ثمّ الصفحةُ وما تُحمّله فعلاً (app.js)، ثمّ احتياطُ script.js غير المُشار إليه', async () => {
    const dir = write(emptyProject(), { 'index.html': PAGE, 'styles.css': 'body{}', 'extra.css': 'p{}', 'app.js': 'y()', 'script.js': 'x()', 'other.js': 'z()' });
    const files = await readProjectFiles(dir);
    assert.deepEqual(files.map((f) => f.name), ['extra.css', 'styles.css', 'index.html', 'app.js', 'script.js']);
    assert.equal(files.find((f) => f.name === 'app.js').content, 'y()');
    assert.ok(!files.some((f) => f.name === 'other.js'), 'سكربتٌ لا تُحمّله الصفحة لا يُقرأ');
});

test('مصفوفةُ الملفّات: script.js المُشار إليه لا يُكرَّر؛ وبلا index.html تبقى CSS وحدَها + احتياطُ script.js', async () => {
    const a = write(emptyProject(), { 'index.html': PAGE.replace('app.js', 'script.js'), 'script.js': 'x()' });
    assert.deepEqual((await readProjectFiles(a)).map((f) => f.name), ['index.html', 'script.js']);
    const b = write(emptyProject(), { 'styles.css': 'body{}', 'script.js': 'x()' });
    assert.deepEqual((await readProjectFiles(b)).map((f) => f.name), ['styles.css', 'script.js']);
    assert.deepEqual(await readProjectFiles(path.join(emptyProject(), 'nope')), []);
});

test('الدالّتان الحرّتان ≡ المفوِّضان على النسخة', async () => {
    const s = scenario('rdr'); const dir = write(emptyProject(), { 'index.html': PAGE, 'styles.css': 'body{}', 'app.js': 'y()' });
    assert.equal(await s.rt.readCurrentCodeContextAsync(dir), await readCodeContext(dir));
    assert.deepEqual(await s.rt.readProjectFilesArray(dir), await readProjectFiles(dir));
});

test('الحدود: لا this، لا استيرادَ من jcr، مفوِّضان بسطرٍ واحد، وreadPageCode لم يعد في jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/projectReader.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/reporter/.test(code), 'قارئان صامتان — لا مُبلِّغ');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes('\n    async readCurrentCodeContextAsync(projectPath) {\n        return readCodeContext(projectPath);\n    }\n'));
    assert.ok(jcr.includes('\n    async readProjectFilesArray(projectPath) {\n        return readProjectFiles(projectPath);\n    }\n'));
    assert.equal((jcr.replace(/^import .*$/gm, '').match(/\breadPageCode\b/g) || []).length, 0);
});
