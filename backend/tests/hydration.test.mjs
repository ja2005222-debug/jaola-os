import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHydrate } from '../services/persistence.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { getProjectState } from '../agents/stateMachine.js';
import { getUserProfile } from '../agents/userProfile.js';

// ═══════════════════════════════════════════════════════
// 🔴 «الأحدثُ يفوز» قاعدةٌ صحيحة — بشرط أن يعني `updatedAt` آخرَ كتابةٍ
//    حقيقيّة. وكانت ثلاثةُ مخازنَ تُنشئ سجلاً **فارغاً** بطابع `Date.now()`
//    عند أوّل قراءة. وعلى Render يُمحى ملفُّ الذاكرة مع كل نشرة، فيصل طلبٌ
//    قبل جهوز Mongo، فيُنشأ الفارغُ بطابع «الآن»، ثم تجهز Mongo فيخسر
//    المحفوظُ الحقيقيُّ لأنه «أقدم» — فيُمحى عملُ المستخدم.
//    القاعدةُ كانت منسوخةً حرفياً في أربعة مواضع؛ صارت واحدةً تُختبر.
// ═══════════════════════════════════════════════════════

test('السجلُّ الفارغُ لا يدّعي حداثة — الثلاثةُ تبدأ بصفر', () => {
    assert.equal(getProjectMemory('hydration-probe', 'p1').updatedAt, 0, 'projectMemory');
    assert.equal(getProjectState('hydration-probe', 'p1').updatedAt, 0, 'stateMachine');
    assert.equal(getUserProfile('hydration-probe-user').updatedAt, 0, 'userProfile');
});

test('المحفوظُ الحقيقيُّ يغلب سجلاً أُنشئ ولم يُكتب — وهذا هو العطب بعينه', () => {
    const placeholder = getProjectMemory('hydration-probe', 'p2'); // updatedAt = 0
    const stored = { updatedAt: Date.now() - 3600e3, design: { colors: 'أزرق داكن' } };
    assert.equal(shouldHydrate(stored, placeholder), true,
        'ذاكرةُ نشرةٍ سابقة يجب أن تفوز على فارغٍ لم يُكتب');
});

test('ولا يغلب ما كُتب في هذه الجلسة', () => {
    const now = Date.now();
    assert.equal(shouldHydrate({ updatedAt: now - 1000 }, { updatedAt: now }), false,
        'تعديلُ الجلسة الحالية لا يُستبدل بمحفوظٍ أقدم');
    assert.equal(shouldHydrate({ updatedAt: now }, { updatedAt: now - 1000 }), true);
});

test('غيابُ الحاضر يعني الترطيب دائماً، والتساوي لا يُبدّل', () => {
    assert.equal(shouldHydrate({ updatedAt: 5 }, null), true);
    assert.equal(shouldHydrate({ updatedAt: 5 }, undefined), true);
    assert.equal(shouldHydrate({ updatedAt: 5 }, { updatedAt: 5 }), false);
    // محفوظٌ بلا طابعٍ لا يغلب شيئاً — ولا يُعطب.
    assert.equal(shouldHydrate({}, { updatedAt: 0 }), false);
    assert.equal(shouldHydrate(null, { updatedAt: 0 }), false);
});

test('حارسُ البناء العالق لا يُخدع بصفر — السجلُّ الجديد خاملٌ لا عالق', () => {
    // `isBuilding` تقرأ `updatedAt` زمناً، لكن بعد شرط «الحالة نشطة».
    // وسجلٌّ جديد حالتُه IDLE، فلا تُقرأ. هذا يحرس ذلك الترتيب.
    const st = getProjectState('hydration-probe', 'p3');
    assert.equal(st.updatedAt, 0);
    assert.equal(st.state, 'idle');
});
