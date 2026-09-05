// 🗄️ مخزن الإضافات — الوحدة التي تُبقي وكلاء المالك أحياءً عبر إعادة نشر
// Render. كانت بلا تغطية، وثلاثةُ أعطابها من عائلةٍ واحدة: دعوى نجاحٍ
// لا سند لها.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import mongoose from 'mongoose';
import { persistPlugin, removePlugin, restorePluginsToDisk } from '../services/pluginStore.js';

const mkdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-plugins-'));
const setReady = (v) => Object.defineProperty(mongoose.connection, 'readyState', { value: v, configurable: true });

/** يجعل الطبقةَ تظنّ أنّها متصلة، ويستبدل عمليّات المجموعة بمراقبات. */
function withDb(docs, { failFind = false, failWrite = false } = {}) {
    const Doc = mongoose.models.CustomPlugin;
    const real = { find: Doc.find, updateOne: Doc.updateOne, deleteOne: Doc.deleteOne };
    const seen = { writes: [], deletes: [] };
    Doc.find = () => ({ lean: async () => { if (failFind) throw new Error('انقطع الاتصال'); return docs; } });
    Doc.updateOne = async (f, u) => {
        if (failWrite) throw new Error('امتلأ المخزن');
        seen.writes.push(f.file); return { acknowledged: true };
    };
    Doc.deleteOne = async (f) => {
        seen.deletes.push(f.file);
        return { deletedCount: docs.some((d) => d.file === f.file) ? 1 : 0 };
    };
    setReady(1);
    return { seen, restore() { Object.assign(Doc, real); setReady(0); } };
}

test('العطب: تعديلُ المالك كان يُطرح لأنّ النشر يُجدّد طابعَ الملف', async () => {
    const dir = mkdir();
    const edited = '// نسخةُ المالك من اللوحة';
    // القرارُ القديم: doc.updatedAt (أمس) > mtime القرص (الآن) ← لا استعادة.
    const db = withDb([{ file: 'site-checker.js', code: edited, updatedAt: new Date(Date.now() - 86400000) }]);
    try {
        // نشرُ Render يسحب النسخةَ المتتبَّعة في git بطابعٍ جديد
        fs.writeFileSync(path.join(dir, 'site-checker.js'), '// نسخةُ المستودع');
        const r = await restorePluginsToDisk(dir);
        assert.strictEqual(r.restored, 1);
        assert.strictEqual(fs.readFileSync(path.join(dir, 'site-checker.js'), 'utf8'), edited);
    } finally { db.restore(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('محتوىً مطابقٌ لا يُعاد كتابته — يُعدّ `unchanged` لا `restored`', async () => {
    const dir = mkdir();
    const db = withDb([{ file: 'a.js', code: 'نفسُه', updatedAt: new Date() }]);
    try {
        fs.writeFileSync(path.join(dir, 'a.js'), 'نفسُه');
        const r = await restorePluginsToDisk(dir);
        assert.deepStrictEqual(
            { ok: r.ok, restored: r.restored, unchanged: r.unchanged }, { ok: true, restored: 0, unchanged: 1 });
    } finally { db.restore(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('العطب: «صفرٌ مُستعاد» كان جوابَ العجز كما هو جوابُ عدم الحاجة', async () => {
    const dir = mkdir();
    try {
        setReady(0);
        const offline = await restorePluginsToDisk(dir);
        assert.strictEqual(offline.ok, false, 'بلا اتصالٍ: عجز');
        assert.match(offline.reason, /غير متصلة/);

        const db = withDb([], { failFind: true });
        const broken = await restorePluginsToDisk(dir);
        db.restore();
        assert.strictEqual(broken.ok, false, 'باستثناء: عجز');

        const db2 = withDb([]);
        const nothing = await restorePluginsToDisk(dir);
        db2.restore();
        assert.strictEqual(nothing.ok, true, 'لا شيء ينتظر: ليس عجزاً');
        assert.strictEqual(nothing.restored, 0);
        // الثلاثةُ كانت تُعطي restored:0 وحدَه — فلا تُميَّز
        assert.notStrictEqual(offline.ok, nothing.ok);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('العطب: الحفظُ كان يعود صامتاً فيُقال للمالك «دائم» وهو ليس كذلك', async () => {
    setReady(0);
    assert.deepStrictEqual(await persistPlugin('a.js', 'كود'),
        { durable: false, reason: 'قاعدة البيانات غير متصلة' });

    const db = withDb([], { failWrite: true });
    const failed = await persistPlugin('a.js', 'كود');
    db.restore();
    assert.strictEqual(failed.durable, false);
    assert.match(failed.reason, /امتلأ/);

    const ok = withDb([]);
    assert.deepStrictEqual(await persistPlugin('a.js', 'كود'), { durable: true });
    assert.deepStrictEqual(ok.seen.writes, ['a.js']);
    ok.restore();
});

test('العطب: اسمان مختلفان كانا ينهاران إلى المفتاح `.js` نفسِه', async () => {
    const db = withDb([]);
    try {
        // كانت `safeFile` تمحو الحروف غير المسموحة: «شاعر.js» و«وكيل.js»
        // تصيران `.js` معاً، فيطمس أحدُهما الآخر في Mongo.
        for (const bad of ['شاعر.js', 'وكيل.js', '.js', 'a.txt', '', null]) {
            const r = await persistPlugin(bad, 'كود');
            assert.strictEqual(r.durable, false, `قُبل: ${bad}`);
            assert.strictEqual(r.reason, 'اسم ملفٍ غير صالح');
        }
        assert.deepStrictEqual(db.seen.writes, [], 'لم تُكتب واحدةٌ منها');
    } finally { db.restore(); }
});

test('الاستعادةُ تتخطّى مدخلاً باسمٍ غير صالحٍ ولا تسقط بسببه', async () => {
    const dir = mkdir();
    const db = withDb([
        { file: 'bad.txt', code: 'x', updatedAt: new Date() },
        { file: 'good.js', code: 'كود صالح', updatedAt: new Date() },
    ]);
    try {
        const r = await restorePluginsToDisk(dir);
        assert.strictEqual(r.skipped, 1);
        assert.strictEqual(r.restored, 1);
        assert.strictEqual(fs.readFileSync(path.join(dir, 'good.js'), 'utf8'), 'كود صالح');
    } finally { db.restore(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('الحذفُ يقول أوقع فعلاً أم لا', async () => {
    const db = withDb([{ file: 'present.js', code: 'x', updatedAt: new Date() }]);
    try {
        assert.deepStrictEqual(await removePlugin('present.js'), { durable: true, removed: true });
        assert.deepStrictEqual(await removePlugin('absent.js'), { durable: true, removed: false });
    } finally { db.restore(); }
    setReady(0);
    const off = await removePlugin('any.js');
    assert.strictEqual(off.durable, false, 'بلا اتصالٍ لا يُدّعى الحذف');
});
