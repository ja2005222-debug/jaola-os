// 🔐 قيودُ التفرّد: ما تُعلنه النماذجُ ليس ما تضمنه القاعدة.
//
// `dbConfig.js` يضبط `autoIndex: false`، ولا نداءَ `createIndexes` في
// المستودع كلِّه — فالتطبيقُ لا يُنشئ فهرساً فريداً أبداً. وتسجيلُ الحساب
// `findUser` ثمّ `createUser`: فحصٌ ثمّ فعل، والفهرسُ هو ما يُغلق سباقَهما.
// هذه الوحدةُ تقرأ ولا تكتب، وتقول الغائبَ بدل أن تفترضه قائماً.
import { test } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { declaredUniqueIndexes, checkUniqueIndexes, formatIndexReport } from '../services/indexHealth.js';

// نماذجُ التطبيق الحقيقيّة — الحارسُ مشتقٌّ منها لا من قائمةٍ بيدي.
await import('../models/User.js');
await import('../models/Project.js');
await import('../models/Conversation.js');

const fake = (defs) => {
    const models = {};
    for (const [name, { collection, indexes = [], paths = {} }] of Object.entries(defs)) {
        models[name] = { collection: { name: collection }, schema: { indexes: () => indexes, paths } };
    }
    return models;
};

test('القيودُ تُشتقّ من النماذج الحيّة — لا تُكتب بيد', () => {
    const found = declaredUniqueIndexes(mongoose.models);
    const names = found.map((d) => `${d.collection}:${Object.keys(d.keys).join('+')}`);
    assert.ok(names.includes('users:username'), `لم يُلتقط قيدُ اسم المستخدم — ${names.join(', ')}`);
    assert.ok(names.some((n) => n.startsWith('projects:name+owner')), 'لم يُلتقط قيدُ المشروع');
    // مُعلَنٌ حقلاً وفهرساً معاً (User.username) يُعَدّ مرّةً واحدة
    assert.strictEqual(names.filter((n) => n === 'users:username').length, 1, 'عُدّ القيدُ مرّتين');
});

test('الغائبُ يُقال غائباً — لا يُفترَض قائماً', async () => {
    const models = fake({ User: { collection: 'users', paths: { username: { options: { unique: true } } } } });
    const r = await checkUniqueIndexes({ models, listIndexes: async () => [{ key: { _id: 1 }, name: '_id_' }] });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.missing.length, 1);
    assert.match(formatIndexReport(r), /غائبة: users\(username\)/);
});

test('القائمُ يُقال قائماً', async () => {
    const models = fake({ User: { collection: 'users', paths: { username: { options: { unique: true } } } } });
    const r = await checkUniqueIndexes({
        models,
        listIndexes: async () => [{ key: { _id: 1 } }, { key: { username: 1 }, unique: true }],
    });
    assert.strictEqual(r.ok, true);
    assert.match(formatIndexReport(r), /1\/1 مضمونة/);
});

// 🔑 فهرسٌ بنفس الحقل بلا `unique` يبدو مطابقاً وهو لا يضمن شيئاً.
test('فهرسٌ غيرُ فريدٍ على نفس الحقل لا يُحسب ضماناً', async () => {
    const models = fake({ User: { collection: 'users', paths: { username: { options: { unique: true } } } } });
    const r = await checkUniqueIndexes({ models, listIndexes: async () => [{ key: { username: 1 } }] });
    assert.strictEqual(r.ok, false, 'حُسب فهرسٌ عاديٌّ ضماناً للتفرّد');
});

test('الفهرسُ المركّب لا يُطابقه فهرسٌ على جزءٍ منه', async () => {
    const models = fake({ P: { collection: 'projects', indexes: [[{ name: 1, owner: 1 }, { unique: true }]] } });
    const partial = await checkUniqueIndexes({ models, listIndexes: async () => [{ key: { name: 1 }, unique: true }] });
    assert.strictEqual(partial.ok, false, 'جزءُ المفتاح قُبل كاملاً');
    const full = await checkUniqueIndexes({ models, listIndexes: async () => [{ key: { name: 1, owner: 1 }, unique: true }] });
    assert.strictEqual(full.ok, true);
    // والترتيبُ جزءٌ من هويّة الفهرس المركّب
    const swapped = await checkUniqueIndexes({ models, listIndexes: async () => [{ key: { owner: 1, name: 1 }, unique: true }] });
    assert.strictEqual(swapped.ok, false, 'مفتاحٌ مقلوبُ الترتيب قُبل مطابقاً');
});

test('تعذُّرُ القراءة يُقال ولا يُبتلَع نجاحاً', async () => {
    const models = fake({ User: { collection: 'users', paths: { username: { options: { unique: true } } } } });
    const r = await checkUniqueIndexes({ models, listIndexes: async () => { throw new Error('لا تجميعة'); } });
    assert.strictEqual(r.ok, false, 'العجزُ عن القراءة قُرئ سلامة');
    assert.strictEqual(r.unreadable.length, 1);
    assert.match(formatIndexReport(r), /تعذّرت قراءتها/);
});

test('التقريرُ لا يُسرّب بياناتِ مستخدمين — أسماءُ تجميعاتٍ وحقولٍ فقط', async () => {
    const models = fake({ User: { collection: 'users', paths: { username: { options: { unique: true } } } } });
    const line = formatIndexReport(await checkUniqueIndexes({ models, listIndexes: async () => [] }));
    assert.ok(!/[{}]/.test(line), 'التقريرُ يحمل كائناتٍ خاماً');
    assert.ok(line.split('\n').length === 1, 'التقريرُ أكثرُ من سطر');
});
