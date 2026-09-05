// 🗂️ بوّابةُ الكتابة على سجلّ المشروع.
//
// 🔴 العطبُ المُثبَّت هنا: `sandbox_app` — المشروعُ الافتراضيّ — لا مستندَ له
//    في Mongo (استثناه `join_project`، ورفض اسمَه مسارُ الإنشاء، وعاد
//    `validateProjectOwnership` قبل الإنشاء). وثلاثةُ مواضعَ كانت تكتب
//    حقائقَه بلا `upsert`: صفرُ مطابقاتٍ، صفرُ كتابة، **وصمت**. فالرابطُ
//    الحيّ يضيع، وتكاملُ GitHub بتوكنه المعمّى يضيع ويُعلَن ناجحاً.
import { test } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import { saveProjectFields, projectLocalPath } from '../services/projectRecord.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

/** يجعل الوحدةَ تظنّ نفسَها متّصلة، ويعترض `updateOne` بمراقب. */
function harness({ result = { matchedCount: 0, upsertedCount: 1 }, throws = null, online = true } = {}) {
    Object.defineProperty(mongoose.connection, 'readyState', { value: online ? 1 : 0, configurable: true });
    const calls = [];
    const real = Project.updateOne.bind(Project);
    let n = 0;
    Project.updateOne = async (filter, update, options) => {
        calls.push({ filter, update, options });
        n++;
        if (throws && n === 1) throw throws;
        return typeof result === 'function' ? result(n) : result;
    };
    return { calls, restore() {
        Project.updateOne = real;
        Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
    } };
}

test('الكتابةُ تحمل upsert — وهذا نفسُه ما كان غائباً فيضيع الرابط', async () => {
    const h = harness();
    try {
        const ok = await saveProjectFields('sami', 'sandbox_app', { vercelUrl: 'https://x.vercel.app' });
        assert.strictEqual(ok, true, 'الإدخالُ نجاحٌ');
        assert.strictEqual(h.calls.length, 1);
        const { filter, update, options } = h.calls[0];
        assert.deepStrictEqual(filter, { name: 'sandbox_app', owner: 'sami' });
        assert.strictEqual(options?.upsert, true, 'بلا upsert يطابق صفراً ويكتب صفراً');
        assert.deepStrictEqual(update.$set, { vercelUrl: 'https://x.vercel.app' });
    } finally { h.restore(); }
});

test('الإدخالُ يحمل localPath — الحقلُ مطلوبٌ في المخطّط فبدونه يفشل الإدخال', async () => {
    const h = harness();
    try {
        await saveProjectFields('sami', 'shop', { vercelUrl: 'u' });
        assert.strictEqual(h.calls[0].update.$setOnInsert.localPath, 'workspace/sami/shop');
        assert.strictEqual(projectLocalPath('sami', 'shop'), 'workspace/sami/shop', 'صيغةٌ واحدةٌ لا صيغتان');
    } finally { h.restore(); }
});

test('الناتجُ صادق: صفرُ مطابقاتٍ وصفرُ إدخالٍ = false لا true', async () => {
    const h = harness({ result: { matchedCount: 0, upsertedCount: 0 } });
    try {
        assert.strictEqual(await saveProjectFields('sami', 'shop', { vercelUrl: 'u' }), false,
            '«لم أرمِ استثناءً» ليست «كتبتُ» — وهذا ما كانت deployAutomation تقوله');
    } finally { h.restore(); }
});

test('غيرُ متّصل: لا كتابةَ ولا انتظارَ عشرِ ثوانٍ في مخزن mongoose المؤقّت', async () => {
    const h = harness({ online: false });
    try {
        assert.strictEqual(await saveProjectFields('sami', 'shop', { vercelUrl: 'u' }), false);
        assert.strictEqual(h.calls.length, 0, 'لا يُلمس النموذجُ أصلاً وهو غيرُ متّصل');
    } finally { h.restore(); }
});

test('حقلُ هويّةٍ من المتصل يُرفض — لا يُبتلع ولا يُكتب', async () => {
    for (const bad of [{ name: 'other' }, { owner: 'someone' }, { localPath: '/etc' }, { _id: 'x' }]) {
        const h = harness();
        try {
            assert.strictEqual(await saveProjectFields('sami', 'shop', { vercelUrl: 'u', ...bad }), false,
                `\`${Object.keys(bad)[0]}\` يُشتقّ ولا يُمرَّر`);
            assert.strictEqual(h.calls.length, 0);
        } finally { h.restore(); }
    }
});

test('سباقُ الفهرس الفريد (11000) يسقط إلى تحديثٍ عاديّ لا إلى فشل', async () => {
    const err = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const h = harness({ throws: err, result: (n) => (n === 2 ? { matchedCount: 1 } : {}) });
    try {
        assert.strictEqual(await saveProjectFields('sami', 'shop', { vercelUrl: 'u' }), true);
        assert.strictEqual(h.calls.length, 2, 'محاولةُ الإدخال ثمّ التحديث');
        assert.strictEqual(h.calls[1].options?.upsert, undefined, 'الثانيةُ تحديثٌ لا إدخال');
    } finally { h.restore(); }
});

test('خطأٌ آخرُ لا يُبتلع صامتاً — يعود false', async () => {
    const h = harness({ throws: new Error('network') });
    try {
        assert.strictEqual(await saveProjectFields('sami', 'shop', { vercelUrl: 'u' }), false);
    } finally { h.restore(); }
});

test('مدخلاتٌ فارغة أو ناقصة تُرفض قبل لمسِ القاعدة', async () => {
    const h = harness();
    try {
        assert.strictEqual(await saveProjectFields('', 'shop', { a: 1 }), false);
        assert.strictEqual(await saveProjectFields('sami', '', { a: 1 }), false);
        assert.strictEqual(await saveProjectFields('sami', 'shop', {}), false);
        assert.strictEqual(await saveProjectFields('sami', 'shop', null), false);
        assert.strictEqual(h.calls.length, 0);
    } finally { h.restore(); }
});
