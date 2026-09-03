// 🗄️ DatabaseAgent — الملخّص يعدّد ما كُتب فعلاً
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDatabase, selectDatabase } from '../agents/databaseAgent.js';

test('نوع خارج القوالب بلا مزوّد → اتصال + .env فقط، والملخّص يسمّيهما (لا schema/seed مزعومين)', async () => {
    const r = await generateDatabase('أداة حاسبة زكاة', 'business', '/nonexistent');
    assert.equal(r.success, true);
    assert.deepEqual(r.files.map(f => f.name), ['api/db.js', '.env.example']);
    assert.equal(r.summary, 'mongodb — 2 ملف (api/db.js, .env.example)');
    assert.doesNotMatch(r.summary, /schema|seed/);
});

test('نوع مغطّى بقالب → schema + seed حاضران ومُسمّيان في الملخّص', async () => {
    const r = await generateDatabase('متجر إلكتروني', 'ecommerce', '/nonexistent');
    assert.deepEqual(r.files.map(f => f.name), ['api/db.js', 'api/schema.js', 'api/seed.js', '.env.example']);
    assert.equal(r.summary, 'mongodb — 4 ملف (api/db.js, api/schema.js, api/seed.js, .env.example)');
});

test('selectDatabase: كلمات علاقية → postgresql وإلا mongodb', () => {
    assert.equal(selectDatabase('نظام محاسبة مالي', 'business'), 'postgresql');
    assert.equal(selectDatabase('مدونة بسيطة', 'blog'), 'mongodb');
});
