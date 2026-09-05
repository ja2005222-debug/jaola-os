import test from 'node:test';
import assert from 'node:assert/strict';
import { hasKeyword, isLatin, arabicMatcher, latinMatcher } from '../agents/keywordMatch.js';
import { detectAdvancedFeatures } from '../agents/knowledgeEngine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// ═══════════════════════════════════════════════════════
// 🔴 علّةٌ واحدة وقعت في **خمسة** مواضع مستقلّة، ولها في كلٍّ إصلاحٌ منفصل:
//   • «طبي» داخل «تطبيق»            (detectProjectType)
//   • `api` داخل *therapist*         (needsBackend)
//   • «مالي» داخل «جمالي»            (needsPostgres)
//   • «كاش» داخل «كاشير»             (detectAdvancedFeatures)
//   • «شيل» داخل «تشيلي»             (حارسُ الارتداد في jcr)
// فصارت الأداةُ واحدة، وهذه الاختباراتُ عقدُها.
// ═══════════════════════════════════════════════════════

test('السابقةُ العربية المعروفة تُقبل، وما عداها حرفٌ أصليّ', () => {
    // تُقبل: ال، لل، بال، وال، ل، ب، ك، و، ف
    for (const t of ['الحساب الشخصي', 'للمستخدمين لوحة', 'بالمحاسبة نبدأ', 'وللمحاسبة قسم', 'ومالية الشركة'])
        assert.ok(hasKeyword(t, ['حساب', 'مستخدمين', 'محاسبة', 'مالي']), t);
    // تُرفض: حرفٌ أصليّ يسبق
    for (const [t, kw] of [['تصميم جمالي', 'مالي'], ['الحيّ الشمالي', 'مالي'],
        ['عرض أعمالي', 'مالي'], ['وكالة تذهب بك', 'ذهب'], ['المذهب المالكي', 'ذهب']])
        assert.equal(hasKeyword(t, [kw]), false, `${t} ← ${kw}`);
});

test('اللاحقةُ من مجموعةٍ مغلقة — وهذا ما يفصل «حسابات» عن «كاشير»', () => {
    // لواحقُ صحيحة تمرّ
    assert.ok(hasKeyword('حسابات العملاء', ['حساب']));
    assert.ok(hasKeyword('التقارير المالية', ['مالي']));
    assert.ok(hasKeyword('تخزين كاشي', ['كاش']));
    // وما ليس لاحقةً يُبطل المطابقة
    assert.equal(hasKeyword('نظام كاشير للمطعم', ['كاش']), false);
    assert.equal(hasKeyword('موقع لبيع الكاشمير', ['كاش']), false);
    assert.equal(hasKeyword('أضف قسماً عن تشيلي', ['شيل']), false);
});

test('اللاتينيةُ بحدود كلمات وجمعٍ اختياري', () => {
    for (const t of ['a pwa app', 'build an app', 'manage orders', 'a public api', 'apis for partners'])
        assert.ok(hasKeyword(t, ['app', 'order', 'api']), t);
    for (const t of ['make it happy', 'wrapper for docs', 'apple store clone', 'landing page for a therapist'])
        assert.equal(hasKeyword(t, ['app', 'api']), false, t);
});

test('تصنيفُ اللغة يختار القاعدة الصحيحة', () => {
    assert.equal(isLatin('app'), true);
    assert.equal(isLatin('كاش'), false);
    assert.ok(latinMatcher('app').test('an app here'));
    assert.equal(latinMatcher('app').test('happy'), false);
    assert.ok(arabicMatcher('كاش').test('كاش'));
    assert.equal(arabicMatcher('كاش').test('كاشير'), false);
});

test('النصُّ الفارغ أو المعدوم لا يطابق شيئاً', () => {
    for (const t of ['', null, undefined, '   ']) assert.equal(hasKeyword(t, ['كاش', 'app']), false, String(t));
});

test('المستهلكُ الحيّ: «كاشير» لم تعد تستدعي Redis', () => {
    assert.equal(detectAdvancedFeatures('نظام كاشير للمطعم').needsRedis, false);
    assert.equal(detectAdvancedFeatures('موقع لبيع الكاشمير').needsRedis, false);
    // ولم يُفقد الإيجابيّ الصادق
    assert.equal(detectAdvancedFeatures('نحتاج كاش سريع').needsRedis, true);
    assert.equal(detectAdvancedFeatures('use redis for cache').needsRedis, true);
});

test('الكلمةُ ذاتُ المحارف الخاصّة لا تُفسد النمط', () => {
    assert.ok(hasKeyword('السعر 10$ فقط', ['10$']));
    assert.equal(hasKeyword('نصٌّ عاديّ', ['a.c']), false);
});
