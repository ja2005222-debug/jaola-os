import test from 'node:test';
import assert from 'node:assert/strict';
import { needsPostgres, generatePrismaSetup } from '../agents/postgresAgent.js';
import { needsBackend, RELATIONAL_KEYWORDS_LIST, BACKEND_KEYWORDS } from '../agents/backendNeed.js';

// ═══════════════════════════════════════════════════════
// 🔴 ثلاثةُ أعطابٍ في قرارٍ واحد:
//
// 1) مطابقةُ احتواءٍ مجرّدة: «مالي» داخل *جمالي* و*أعمالي* و*الشمالي*
//    و*الإجمالي*. فطلبٌ اسمُه «تصميم جمالي راقٍ» كان يُكتب فيه
//    `prisma/schema.prisma` و`.env.example` يطلب DATABASE_URL.
// 2) قائمةٌ **ثالثة** تُجيب سؤال «هل يحتاج خادماً؟» مستقلّةً عن الاتحاد،
//    فتقول «نعم» حيث يقول «لا»: Prisma بلا خادمٍ يُشغّلها.
// 3) الملخّصُ يقول «seed» دائماً ولا يذكر `.env.example` قطّ.
// ═══════════════════════════════════════════════════════

test('«مالي» لا تُقرأ داخل كلمةٍ أصلُها غير ماليّ', () => {
    for (const goal of [
        'أريد موقعاً بتصميم جمالي راقٍ',
        'متجر في الحيّ الشمالي من الرياض',
        'صفحة لعرض أعمالي ومشاريعي',
        'موقع يعرض الإجمالي والأسعار',
        'معرض للفنون الجمالية',
    ]) assert.equal(needsPostgres(goal), false, goal);
});

test('السوابقُ العربية المعروفة تُقبل، وما عداها حرفٌ أصليّ', () => {
    for (const goal of ['التقارير المالية', 'نظام مالي', 'بالمحاسبة نبدأ', 'وللمحاسبة قسم'])
        assert.equal(needsPostgres(goal), true, goal);
});

test('الدلائل الصريحة تُثبت القاعدة العلاقية', () => {
    for (const goal of [
        'نظام محاسبة للشركة', 'I need PostgreSQL', 'use prisma orm',
        'a relational data model', 'accounting software', 'قاعدة علاقية',
    ]) assert.equal(needsPostgres(goal), true, goal);
});

test('كلماتُ العلاقية مجموعةٌ جزئيّة من اتحاد الخادم — بالبناء لا بالصدفة', () => {
    for (const kw of RELATIONAL_KEYWORDS_LIST) {
        assert.ok(BACKEND_KEYWORDS.includes(kw), `«${kw}» خارج الاتحاد`);
    }
});

test('needsPostgres ⟹ needsBackend — لا Prisma بلا خادمٍ يُشغّلها', () => {
    const goals = [
        'نظام محاسبة للشركة', 'موقع مالي للاستثمار', 'accounting software',
        'a relational data model', 'I need PostgreSQL', 'use prisma',
        'التقارير المالية الشهرية', 'قاعدة علاقية للمنتجات',
        // وأهدافٌ لا علاقة لها — لا تُثبت أياً منهما عبر هذه القائمة
        'أريد موقعاً بتصميم جمالي', 'معرض أعمالي',
    ];
    for (const g of goals) {
        if (needsPostgres(g)) assert.ok(needsBackend(g), `Prisma بلا خادم: ${g}`);
    }
});

test('الملخّصُ يسمّي الملفات المكتوبة فعلاً لا قائمةً ثابتة', async () => {
    const r = await generatePrismaSetup('نظام محاسبة', 'business');
    assert.equal(r.success, true);
    const names = r.files.map((f) => f.name);
    assert.equal(r.summary.includes(`${names.length} ملف`), true);
    for (const n of names) assert.ok(r.summary.includes(n), `«${n}» كُتب ولم يُذكر`);
    // ولا يُسمّى ما لم يُكتب
    if (!names.some((n) => n.includes('seed'))) {
        assert.ok(!/\bseed\b/.test(r.summary), 'ذُكر seed ولم يُكتب');
    }
});

test('كل ملفٍ مولَّد له اسمٌ ومحتوى غير فارغ', async () => {
    const r = await generatePrismaSetup('نظام محاسبة', 'business');
    for (const f of r.files) {
        assert.ok(f.name && f.name.trim(), 'ملفٌّ بلا اسم');
        assert.ok(f.content && f.content.trim(), `«${f.name}» بمحتوى فارغ`);
    }
    assert.ok(r.files.some((f) => f.name === 'prisma/schema.prisma'), 'لا schema');
});

test('الهدفُ الفارغ أو المعدوم لا يُثبت قاعدةً', () => {
    for (const g of ['', null, undefined, '   ']) assert.equal(needsPostgres(g), false, String(g));
});
