import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { backupProject, listSnapshots, restoreSnapshot } from '../agents/fileManager.js';

// ═══════════════════════════════════════════════════════
// 🔴 «تراجع» كان يُعلن «⏪ استُرجعت النسخة (80 ملف)» على مشروعٍ لم يُسترجَع
//    فيه الملفُّ الذي عُدّل أصلاً: السقفُ كان 80 ملفاً يُقتطع بترتيب readdir،
//    فوقع `index.html` في الموضع 98 من 99 فلم يدخل النسخة قطّ.
//    نجاحٌ مُعلَنٌ فوق فعلٍ لم يقع — وهي علّةُ هذه السلسلة كلّها.
// ═══════════════════════════════════════════════════════

const mkProject = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-fm-'));
    for (const [name, content] of Object.entries(files)) {
        const p = path.join(root, name);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content);
    }
    return root;
};

const manyFiles = (n) => Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`file${i + 1}.txt`, `f${i + 1}`]));

test('ملفٌّ متأخّرٌ في ترتيب readdir يدخل النسخة — ويعود بـ«تراجع»', async () => {
    // `index.html` بعد 95 ملفاً اسمُها `file*` — أي في الموضع 96 أبجدياً.
    const root = mkProject({ ...manyFiles(95), 'index.html': 'قديم' });
    await backupProject(root, 'edit');

    fs.writeFileSync(path.join(root, 'index.html'), 'جديد');
    const snaps = await listSnapshots(root);
    const r = await restoreSnapshot(root, snaps.snapshots[0].name);

    assert.equal(r.success, true);
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), 'قديم',
        'الملفُّ المعدَّل لم يُسترجَع — وهذا هو العطب بعينه');
    fs.rmSync(root, { recursive: true, force: true });
});

test('ما لم تشمله النسخةُ يُسمّى في تقرير الاسترجاع لا يُبتلع', async () => {
    const root = mkProject({ 'index.html': 'قديم' });
    await backupProject(root, 'edit');
    fs.writeFileSync(path.join(root, 'pricing.html'), 'أُضيفت بعد النسخة');

    const snaps = await listSnapshots(root);
    const r = await restoreSnapshot(root, snaps.snapshots[0].name);

    assert.deepEqual(r.restored, ['index.html']);
    assert.deepEqual(r.notRestored, ['pricing.html'],
        'الاسترجاعُ ينسخ ولا يحذف — فما بقي يُقال');
    fs.rmSync(root, { recursive: true, force: true });
});

test('النسخةُ تُعلن نقصَها حين يُبلَغ سقفُ العدد', async () => {
    const root = mkProject(manyFiles(420));
    const b = await backupProject(root, 'edit');
    assert.equal(b.saved, 400);
    assert.equal(b.truncated, true, 'نقصٌ صامتٌ هو العطب — فليُعلَن');
    fs.rmSync(root, { recursive: true, force: true });
});

test('ملفٌّ أكبر من الحدّ يسقط **بالاسم** لا صامتاً', async () => {
    const root = mkProject({ 'index.html': 'ok', 'huge.txt': 'a'.repeat(500 * 1024) });
    const b = await backupProject(root, 'edit');
    assert.deepEqual(b.dropped, ['huge.txt']);
    assert.equal(b.truncated, true);
    assert.equal(b.saved, 1);
    fs.rmSync(root, { recursive: true, force: true });
});

test('مشروعٌ عاديّ: لا نقصَ ولا إسقاط', async () => {
    const root = mkProject({ 'index.html': 'a', 'api/db.js': 'b', 'styles.css': 'c' });
    const b = await backupProject(root, 'build');
    assert.equal(b.truncated, false);
    assert.deepEqual(b.dropped, []);
    assert.equal(b.saved, 3);
    fs.rmSync(root, { recursive: true, force: true });
});

test('`.env.example` يُنسخ ويُسترجَع، و`.env` لا يُنسخ أبداً', async () => {
    const root = mkProject({ 'index.html': 'a', '.env.example': 'API_URL=', '.env': 'SECRET=xyz' });
    const b = await backupProject(root, 'edit');
    assert.ok(fs.existsSync(path.join(b.snapshot, '.env.example')), '.env.example يكتبه databaseAgent فيجب حفظه');
    assert.equal(fs.existsSync(path.join(b.snapshot, '.env')), false, 'السرُّ لا يدخل النسخة');
    fs.rmSync(root, { recursive: true, force: true });
});

test('المسارات المتداخلة تُحفظ وتُسترجَع بمواضعها', async () => {
    const root = mkProject({ 'api/models/User.js': 'قديم', 'index.html': 'x' });
    await backupProject(root, 'edit');
    fs.writeFileSync(path.join(root, 'api/models/User.js'), 'جديد');

    const snaps = await listSnapshots(root);
    const r = await restoreSnapshot(root, snaps.snapshots[0].name);
    assert.ok(r.restored.includes('api/models/User.js'));
    assert.equal(fs.readFileSync(path.join(root, 'api/models/User.js'), 'utf8'), 'قديم');
    fs.rmSync(root, { recursive: true, force: true });
});

test('استرجاعُ نسخةٍ غير موجودة يفشل صراحةً', async () => {
    const root = mkProject({ 'index.html': 'a' });
    const r = await restoreSnapshot(root, 'snapshot_لا_وجود_لها');
    assert.equal(r.success, false);
    assert.match(r.error, /غير موجودة/);
    fs.rmSync(root, { recursive: true, force: true });
});
