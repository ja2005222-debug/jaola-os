// 🛡️ «اكمل» تستأنف ولا تدهس: العطل الإنتاجي الحقيقي — هدف الاستئناف كان يحوي
// «لا تبدأ من الصفر» فطابقت «من الصفر» إشارةَ إعادة البناء، فبُني مشروع جديد
// باسم «اكمل المشروع» ومُحي المحتوى. هذه الاختبارات تُثبّت الجذر وطبقات الدفاع.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExplicitRebuild, isExplicitNewBuild, isContinuationGoal } from '../agents/textNormalizer.js';
import { classifyIntentFast, buildContinuationGoal } from '../agents/ceoBrain.js';
import { updateStructure, getProjectMemory } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

test('العطل الأصلي: «لا تبدأ من الصفر» لا تعود تُصنَّف إعادةَ بناء', () => {
    assert.equal(isExplicitRebuild('لا تبدأ من الصفر — طوّر الموجود'), false);
    assert.equal(isExplicitRebuild('أكمل من حيث توقفت دون إعادة البناء'), false);
    assert.equal(isExplicitRebuild("don't start over, improve what exists"), false);
    assert.equal(isExplicitNewBuild('لا تبدأ من الصفر — طوّر الموجود'), false);
});

test('الإيجابيات الحقيقية تبقى: طلبات إعادة البناء الصريحة تُلتقط', () => {
    assert.equal(isExplicitRebuild('أعد البناء'), true);
    assert.equal(isExplicitRebuild('ابدأ من الصفر'), true);
    assert.equal(isExplicitRebuild('ابنِه من جديد'), true);
    assert.equal(isExplicitRebuild('rebuild the site'), true);
    assert.equal(isExplicitRebuild('start over from scratch'), true);
});

test('وسم [استئناف] يحصّن الهدف مهما احتوى نصّه', () => {
    const g = '[استئناف] تابع تطوير المشروع. الهدف الأصلي: ابنِ متجراً من الصفر';
    assert.equal(isContinuationGoal(g), true);
    assert.equal(isExplicitRebuild(g), false, 'حتى مع «من الصفر» داخل السياق');
    assert.equal(isExplicitNewBuild(g), false, 'حتى مع أمر «ابنِ» داخل السياق');
    assert.equal(isContinuationGoal('ابنِ متجراً'), false);
});

test('السيناريو الكامل: «اكمل» → نية استئناف → هدف موسوم لا يُصنَّف بناءً جديداً', () => {
    // نفس رسالة المستخدم في السجلّ الإنتاجي
    const intent = classifyIntentFast('اكمل');
    assert.equal(intent?.intent, 'continue');

    // ذاكرة مشروع دنيا (delev21-مثيل) حتى يُبنى هدف الاستئناف
    updateStructure('t-user', 'delev21', ['قائمة المطاعم', 'صفحة التتبع'], ['فلترة وبحث']);
    assert.ok(getProjectMemory('t-user', 'delev21').structure.sections.length >= 2);

    const goal = buildContinuationGoal('t-user', 'delev21');
    assert.ok(goal, 'هدف استئناف مبنيّ من الذاكرة');
    assert.equal(isContinuationGoal(goal), true, 'موسوم [استئناف]');
    assert.equal(isExplicitRebuild(goal), false, 'ليس إعادة بناء');
    assert.equal(isExplicitNewBuild(goal), false, 'ليس بناءً جديداً — لا استبدال هوية ولا دهس');
    assert.ok(!/لا\s+تبدأ\s+من\s+الصفر/.test(goal), 'العبارة المسمومة أُزيلت من الصياغة');
});

test('صيغ «اكمل» الشائعة كلّها تُصنَّف استئنافاً لا بناءً', () => {
    for (const msg of ['اكمل', 'أكمل', 'كمل', 'واصل', 'تابع', 'اكمل المشروع', 'continue', 'resume']) {
        assert.equal(classifyIntentFast(msg)?.intent, 'continue', msg);
        assert.equal(isExplicitNewBuild(msg), false, `«${msg}» ليست أمر بناء جديد`);
    }
});
