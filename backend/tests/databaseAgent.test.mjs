// 🗄️ DatabaseAgent — الملخّص يعدّد ما كُتب فعلاً
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDatabase, selectDatabase } from '../agents/databaseAgent.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

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

// ═══════════════════════════════════════════════════════
// 🔴 Sprint 2v — السؤالُ الواحد «أيحتاج قاعدةً علاقيّة؟» كان يُسأل مرّتين
//    بقائمتَي مفاتيحَ مختلفتين، فيُجاب جوابَين — والمنفّذُ يتبع أحدهما فقط.
//    (الاختباراتُ الثلاثةُ أعلاه سابقةٌ لهذا الـSprint وباقيةٌ كما هي.)
// ═══════════════════════════════════════════════════════
import { needsPostgres } from '../agents/postgresAgent.js';

test('جوابُ selectDatabase هو جوابُ needsPostgres — مصدرُ حقيقةٍ واحد', () => {
    for (const goal of [
        'نظام محاسبة للشركات', 'a banking finance dashboard', 'accounting software',
        'موقع فواتير ودفع', 'invoice management system', 'a payment page',
        'متجر ملابس بتصميم جمالي', 'متجر إلكتروني', 'مدونة شخصية',
        'prisma relational schema', '', null,
    ]) {
        assert.equal(selectDatabase(goal) === 'postgresql', needsPostgres(goal),
            `تباعدَ الجوابان على: ${goal}`);
    }
});

// «مالي» ⊂ «جمالي» — العلّةُ التي أُصلحت في postgresAgent بـSprint 2r
// وبقي توأمُها هنا يُطابق بـ`includes`.
test('«تصميم جمالي» ليست مشروعاً مالياً', () => {
    assert.equal(selectDatabase('متجر ملابس بتصميم جمالي'), 'mongodb');
    assert.equal(selectDatabase('استوديو تصوير جمالي'), 'mongodb');
    assert.equal(selectDatabase('نظام محاسبة مالي'), 'postgresql');
});

// وسجلٌّ يجزم بما لم يقع: «✅ postgresql — 4 ملف» فوق أربعةِ ملفاتٍ مونغويّة.
test('dbType يصف ما كُتب فعلاً لا ما يُوصى به', async () => {
    const r = await generateDatabase('نظام محاسبة للشركات', 'ecommerce', '/nonexistent');
    assert.equal(r.dbType, 'mongodb', 'الملفاتُ مونغويّة فالوصفُ مونغويّ');
    assert.equal(r.recommended, 'postgresql');
    // والدليلُ على مونغويّتها من محتواها لا من دعوى الحقل:
    assert.match(r.files.find((f) => f.name === 'api/db.js').content, /mongoose/);
    assert.match(r.files.find((f) => f.name === '.env.example').content, /MONGODB_URI/);
});

test('الملخّصُ يذكر التوصية حين تفارق المكتوب، ويسكت حين توافقه', async () => {
    const fin = await generateDatabase('نظام محاسبة للشركات', 'ecommerce', '/nonexistent');
    assert.match(fin.summary, /^mongodb — /);
    assert.match(fin.summary, /التوصية: postgresql/);

    const shop = await generateDatabase('متجر إلكتروني', 'ecommerce', '/nonexistent');
    assert.equal(/التوصية/.test(shop.summary), false, 'لا توصيةَ تُذكر حين لا تفارق');
});

// التوصيةُ الآن مطابقةٌ لشرط التنفيذ في jcr.js:889، فلا تَعِد بما لا يقع.
test('كلُّ توصيةٍ بـpostgresql يقابلها تشغيلٌ فعليّ لـPostgresAgent', async () => {
    for (const goal of ['نظام محاسبة للشركات', 'موقع فواتير ودفع', 'متجر إلكتروني']) {
        const r = await generateDatabase(goal, 'ecommerce', '/nonexistent');
        assert.equal(r.recommended === 'postgresql', needsPostgres(goal), goal);
    }
});
