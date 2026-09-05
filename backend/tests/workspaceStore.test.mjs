/**
 * 🗄️ اللقطةُ لا تُتلف ما عجزت عن حمله — Sprint 3j
 *
 * قرصُ Render مؤقّت، فهذه اللقطةُ هي النسخةُ الوحيدة الباقية من موقع
 * المستخدم. وكانت تحذف من المخزن **كلَّ ملفٍّ لم تحمله** (`$nin` على
 * المحمولِ لا على المرئيّ)، ثمّ تُرجع `{success:true}`:
 *   • مشروعٌ من ١٠٠ ملف → حُفظ ٨٠ وحُذف ٢٠ من النسخة الدائمة.
 *   • ملفٌّ كبُر فوق ٤٠٠KB → مُحيت نسختُه المحفوظة **لأنّه كبُر**.
 * ثمّ يُقال للمالك عند العودة «استُعيد مشروعك (٣ ملفات)» وقد كُتب اثنان.
 *
 * تُشغَّل الوحدةُ الحقيقية على قرصٍ حقيقيّ، بمخزنٍ بديلٍ عن Mongo يُظهر
 * ما كُتب وما حُذف فعلاً.
 */

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import mongoose from 'mongoose';
import { snapshotWorkspace, restoreWorkspaceIfEmpty } from '../services/workspaceStore.js';
import { quietConsole } from './helpers/quietConsole.mjs';

const Model = mongoose.models.WorkspaceFile;
const realState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
const real = { bulkWrite: Model.bulkWrite, deleteMany: Model.deleteMany, find: Model.find };

let store, quiet;
const dirs = [];
const tmpdir = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); dirs.push(d); return d; };

beforeEach(() => {
    quiet = quiet || quietConsole();   // «🗄️ استُعيد …» عربيٌّ بإيموجي
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => 1, configurable: true });
    store = new Map();
    Model.bulkWrite = async (ops) => {
        for (const o of ops) store.set(o.updateOne.filter.filePath, o.updateOne.update.$set.content);
        return { ok: 1 };
    };
    Model.deleteMany = async (filter) => {
        const keep = new Set(filter.filePath.$nin);
        const gone = [...store.keys()].filter((k) => !keep.has(k));
        gone.forEach((k) => store.delete(k));
        return { deletedCount: gone.length };
    };
    Model.find = () => ({ lean: async () => [...store.entries()].map(([filePath, content]) => ({ filePath, content, encoding: 'utf8' })) });
});

after(() => {
    quiet?.restore();
    Object.assign(Model, real);
    if (realState) Object.defineProperty(mongoose.connection, 'readyState', realState);
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

test('🔴 ملفٌّ كبُر فوق الحدّ تبقى نسختُه المحفوظة — لا تُمحى لأنّه كبُر', async () => {
    const dir = tmpdir('ws-big-');
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hi</h1>');
    fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
    await snapshotWorkspace('omar', 'site', dir);
    assert.ok(store.has('app.js'), 'المقدّمة: app.js محفوظ');

    fs.writeFileSync(path.join(dir, 'app.js'), 'x'.repeat(500 * 1024));   // نما فوق ٤٠٠KB
    const r = await snapshotWorkspace('omar', 'site', dir);

    assert.ok(store.has('app.js'), 'نسخةُ app.js السابقة أُتلفت — ومعها كلُّ أثرٍ للملف بعد مسح القرص');
    assert.equal(r.skipped, 1, 'التقريرُ يذكر ما تعذّر حملُه');
    assert.equal(r.count, 1);
});

test('🔴 مشروعٌ يتجاوز السقف لا تُنقَّى لقطتُه بجردٍ ناقص', async () => {
    const dir = tmpdir('ws-many-');
    for (let i = 0; i < 100; i += 1) {
        fs.writeFileSync(path.join(dir, `page${String(i).padStart(3, '0')}.html`), `<h1>${i}</h1>`);
    }
    store.set('page099.html', '<h1>99</h1>');   // كان محفوظاً من لقطةٍ سابقة

    const r = await snapshotWorkspace('omar', 'site', dir);

    assert.equal(r.truncated, true, 'التقريرُ يعترف بأنّ الجرد ناقص');
    assert.ok(store.has('page099.html'), 'ملفٌّ لم يبلغه الجردُ حُذف من النسخة الدائمة');
});

test('الحذفُ يقع على ما حُذف من القرص حقاً', async () => {
    const dir = tmpdir('ws-del-');
    fs.writeFileSync(path.join(dir, 'a.html'), 'a');
    fs.writeFileSync(path.join(dir, 'b.html'), 'b');
    await snapshotWorkspace('omar', 'site', dir);
    assert.deepEqual([...store.keys()].sort(), ['a.html', 'b.html']);

    fs.rmSync(path.join(dir, 'b.html'));
    const r = await snapshotWorkspace('omar', 'site', dir);
    assert.deepEqual([...store.keys()], ['a.html'], 'المحذوفُ من القرص يُنقَّى من اللقطة');
    assert.equal(r.truncated, false);
    assert.equal(r.skipped, 0);
});

test('مجلدٌ فارغٌ أو غيرُ مقروء لا يمسّ اللقطة', async () => {
    store.set('index.html', '<h1>hi</h1>');
    const r = await snapshotWorkspace('omar', 'site', tmpdir('ws-empty-'));
    assert.equal(r.success, false);
    assert.ok(store.has('index.html'), 'خللٌ عابرٌ في القرص كان سيمحو نسخة المستخدم كلَّها');

    const gone = await snapshotWorkspace('omar', 'site', path.join(os.tmpdir(), 'لا-وجود-له-' + Date.now()));
    assert.equal(gone.success, false);
    assert.ok(store.has('index.html'));
});

test('جردٌ كاملٌ بلا محمولٍ واحد يبقى جرداً صحيحاً — يُنقّى به المحذوف', async () => {
    // مجلدٌ رأيناه كلَّه وكلُّ ملفاته أكبرُ من الحدّ: لا شيءَ يُحمَل، لكنّ
    // الجردَ صحيحٌ فيُحذف به ما زال من القرص. (الحارسُ على الرؤية لا الحمل:
    // لو كان على الحمل لبقي المحذوفُ في اللقطة إلى الأبد.)
    const dir = tmpdir('ws-seen-');
    fs.writeFileSync(path.join(dir, 'huge.js'), 'x'.repeat(500 * 1024));
    store.set('old.html', 'صفحةٌ حُذفت من القرص');

    const r = await snapshotWorkspace('omar', 'site', dir);
    assert.equal(r.success, true, 'المجلدُ مقروءٌ ومرئيّ — ليس «لا ملفات»');
    assert.equal(r.count, 0);
    assert.equal(r.seen, 1);
    assert.ok(!store.has('old.html'), 'المحذوفُ من القرص بقي في اللقطة رغم صحّة الجرد');
});

test('المجلداتُ الفرعية والثنائيّاتُ تُحفظ بترميزها', async () => {
    const dir = tmpdir('ws-nest-');
    fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'api', 'auth.js'), 'export const x = 1;');
    fs.writeFileSync(path.join(dir, 'node_modules', 'junk.js'), 'skip me');
    fs.writeFileSync(path.join(dir, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]));

    const r = await snapshotWorkspace('omar', 'site', dir);
    assert.ok(store.has('api/auth.js'), 'المسارُ النسبيُّ بشرطةٍ أمامية');
    assert.ok(!store.has('node_modules/junk.js'), 'node_modules مستثنى');
    assert.equal(store.get('icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]).toString('base64'));
    assert.equal(r.count, 2);
});

test('🔴 الاستعادةُ تعدُّ المكتوبَ لا المقروء', async () => {
    store = new Map([['index.html', '<h1>hi</h1>'], ['../../../etc/evil', 'x'], ['a/b.css', 'body{}']]);
    const dir = tmpdir('ws-restore-');
    const r = await restoreWorkspaceIfEmpty('omar', 'site', dir);

    const written = fs.readdirSync(dir, { recursive: true })
        .filter((f) => fs.statSync(path.join(dir, f)).isFile());
    assert.equal(written.length, 2);
    assert.equal(r.restored, 2, 'العددُ المُبلَّغ للمالك يجب أن يطابق ما كُتب');
    assert.equal(r.blocked, 1);
    assert.equal(r.total, 3);
});

test('الاستعادةُ لا تدهس مشروعاً قائماً', async () => {
    store = new Map([['index.html', 'من اللقطة']]);
    const dir = tmpdir('ws-live-');
    fs.writeFileSync(path.join(dir, 'index.html'), 'الأحدثُ على القرص');
    const r = await restoreWorkspaceIfEmpty('omar', 'site', dir);
    assert.equal(r.restored, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), 'الأحدثُ على القرص');
});

test('الجولةُ كاملة: لقطة ← مسحُ القرص ← استعادة', async () => {
    const dir = tmpdir('ws-cycle-');
    fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>موقعي</h1>');
    fs.writeFileSync(path.join(dir, 'api', 'auth.js'), 'export const k = 2;');
    await snapshotWorkspace('omar', 'site', dir);

    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });                    // كما يفعل getProjectPath بعد النشر

    const r = await restoreWorkspaceIfEmpty('omar', 'site', dir);
    assert.equal(r.restored, 2);
    assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), '<h1>موقعي</h1>');
    assert.equal(fs.readFileSync(path.join(dir, 'api', 'auth.js'), 'utf8'), 'export const k = 2;');
});

test('قاعدةٌ غير متصلة: لا لقطةَ ولا استعادةَ ولا ادّعاء', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => 0, configurable: true });
    const dir = tmpdir('ws-off-');
    fs.writeFileSync(path.join(dir, 'index.html'), 'hi');
    assert.equal((await snapshotWorkspace('omar', 'site', dir)).success, false);
    assert.equal(store.size, 0);
    assert.equal((await restoreWorkspaceIfEmpty('omar', 'site', tmpdir('ws-off2-'))).restored, 0);
});
