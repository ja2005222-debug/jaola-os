// ✏️ أول تغطيةٍ لـ`services/fileEditor.js`.
//
// 🔴 حارس الاحتواء كان `full.startsWith(base)` — بادئةٌ **بلا فاصل
// مسار**. فيمنع الصريح (`path.join` يطبّع `..` فيخرج عن البادئة) ويمرّر
// الهمس: شقيقٌ يبدأ اسمه باسم الجذر. وهو العطب نفسه الذي سمّاه
// `workspacePaths.js` وأصلحه في `writePlanFiles` — بقي هنا لأن الوحدة
// خارج ما يصل إليه الخادم (انظر `tests/moduleReachability.test.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fileeditor-'));
const BASE = path.join(tmp, 'jaola');
const SIBLING = path.join(tmp, 'jaola-evil');          // يبدأ اسمه باسم الجذر
fs.mkdirSync(BASE, { recursive: true });
fs.mkdirSync(SIBLING, { recursive: true });
fs.writeFileSync(path.join(SIBLING, 'stolen.txt'), 'SECRET');
fs.writeFileSync(path.join(BASE, 'inside.txt'), 'MINE');

process.env.JAOLA_PATH = BASE;                          // يُقرأ عند كل نداء لا عند التحميل
const { readFile, createFile, editFile, deleteFile } = await import('../services/fileEditor.js');

test('🛡️ الشقيق ذو البادئة نفسها لا يُقرأ — العطب الأصلي', async () => {
    await assert.rejects(() => readFile('../jaola-evil/stolen.txt'), /Path traversal denied/,
        'كان يُقرأ: البادئة تطابق والفاصل غائب');
});

test('🛡️ ولا يُكتَب فيه ولا يُحذَف منه — الحارس واحدٌ لكل الأبواب', async () => {
    await assert.rejects(() => createFile('../jaola-evil/planted.txt', 'x'), /Path traversal denied/);
    await assert.rejects(() => editFile('../jaola-evil/stolen.txt', 'x'), /Path traversal denied/);
    await assert.rejects(() => deleteFile('../jaola-evil/stolen.txt'), /Path traversal denied/);
    assert.equal(fs.readFileSync(path.join(SIBLING, 'stolen.txt'), 'utf8'), 'SECRET', 'لم يُمسّ');
    assert.equal(fs.existsSync(path.join(SIBLING, 'planted.txt')), false, 'ولم يُزرع فيه شيء');
});

test('🛡️ الخروج الصريح ممنوعٌ كما كان', async () => {
    for (const p of ['../../etc/hostname', '../..', '..']) {
        await assert.rejects(() => readFile(p), /Path traversal denied/, p);
    }
});

test('✅ وما بالداخل يعمل — الحارس لا يقفل الباب على أهله', async () => {
    assert.equal(await readFile('inside.txt'), 'MINE');
    assert.equal(await readFile('/inside.txt'), 'MINE', 'الشرطة البادئة تُزال لا تُطلِق المسار');
    await createFile('sub/dir/new.txt', 'NEW');
    assert.equal(await readFile('sub/dir/new.txt'), 'NEW');
    const r = await editFile('inside.txt', 'EDITED');
    assert.equal(await readFile('inside.txt'), 'EDITED');
    assert.equal(fs.readFileSync(r.backupPath, 'utf8'), 'MINE', 'النسخة الاحتياطية تحمل القديم');
});

test('🚫 مسارٌ ليس نصاً يُردّ برسالة لا برمية TypeError غامضة', async () => {
    for (const bad of [42, null, undefined, {}, ['a']]) {
        await assert.rejects(() => readFile(bad), /Path must be a string/, JSON.stringify(bad) ?? 'undefined');
    }
});

test('🚫 بلا JAOLA_PATH لا يُشتقّ مسارٌ أصلاً', async () => {
    const keep = process.env.JAOLA_PATH;
    delete process.env.JAOLA_PATH;
    try { await assert.rejects(() => readFile('inside.txt'), /JAOLA_PATH not set/); }
    finally { process.env.JAOLA_PATH = keep; }
});
