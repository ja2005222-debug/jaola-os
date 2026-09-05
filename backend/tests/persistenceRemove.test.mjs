// 💾 removeEntry — نقيضُ persistEntry.
//
// 🔴 الكتابةُ مؤجَّلةٌ ١٥٠٠ms. فمحوٌ لا يُلغي المؤجَّلَ أوّلاً يُمحى بدوره:
//    يعود المدخلُ من طابور الكتابة بعد لحظةٍ كأنّ الحذف لم يقع. هذا
//    الاختبار يُثبت الإلغاء بلا Mongo: نُبدّل `readyState` ونعترض الكتابة.
import { test } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { persistEntry, removeEntry } from '../services/persistence.js';

/** يجعل الطبقةَ تظنّ أنّها متصلة، ويستبدل عمليّتَي KV بمراقبَين. */
function fakeOnline() {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
    const KV = mongoose.models.MemoryKV;
    const calls = { writes: [], deletes: [] };
    const realUpdate = KV.updateOne.bind(KV);
    const realDelete = KV.deleteOne.bind(KV);
    KV.updateOne = async (filter) => { calls.writes.push(filter.key); return { acknowledged: true }; };
    KV.deleteOne = async (filter) => { calls.deletes.push(filter.key); return { deletedCount: 1 }; };
    return { calls, restore() {
        KV.updateOne = realUpdate; KV.deleteOne = realDelete;
        Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
    } };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('المحوُ يُلغي الكتابةَ المؤجَّلة فلا يعود المدخل', async () => {
    const f = fakeOnline();
    try {
        persistEntry('projectMetrics', 'u:p', { totalBuilds: 3 });   // يُجدوَل بعد 1500ms
        const removed = await removeEntry('projectMetrics', 'u:p');
        assert.strictEqual(removed, true);
        await wait(1700);                                            // تجاوزُ موعد الكتابة
        assert.deepStrictEqual(f.calls.writes, [], 'لا كتابةَ بعد المحو');
        assert.deepStrictEqual(f.calls.deletes, ['u:p']);
    } finally { f.restore(); }
});

test('المحوُ لا يمسّ مفتاحاً آخر مؤجَّلاً', async () => {
    const f = fakeOnline();
    try {
        persistEntry('projectMetrics', 'u:يبقى', { totalBuilds: 1 });
        await removeEntry('projectMetrics', 'u:يُمحى');
        await wait(1700);
        assert.deepStrictEqual(f.calls.writes, ['u:يبقى']);
    } finally { f.restore(); }
});

test('بلا اتصالٍ: المحوُ لا يرمي ويُعيد false', async () => {
    assert.strictEqual(mongoose.connection.readyState, 0);
    assert.strictEqual(await removeEntry('projectMetrics', 'أيّ-مفتاح'), false);
});
