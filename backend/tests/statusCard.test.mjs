/**
 * 📊 بطاقةُ الحالة تُخبر عمّا جرى — Sprint 3h
 *
 * ثلاثةُ حقولٍ كانت تقولُ ما لا يقعُ حين يسألُ المالكُ «أين وصلنا»:
 *   • «🤖 الوكيل الحالي: Requirements» عن مشروعٍ فرغ بناؤه — لأنّ
 *     `currentAgent` يُكتَب عند كلّ انتقالٍ ولا يُمحى عند النهاية.
 *   • «✅ أنجز: …» لا يظهرُ أبداً — كاتبا `completedAgents` نداءان لا
 *     مستدعيَ لهما: `markAgentComplete` و`meta.completedAgent`.
 *   • «مكتمل ✅ — 67%» — المقامُ ستُّ مراحلَ ثابتة، والبناءُ الناجحُ يتخطّى
 *     التخطيطَ والنشرَ فلا يبلغُ المئةَ أبداً.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionState, getProjectSummary, resetProjectState, STATES } from '../agents/stateMachine.js';
import { buildStatusReply } from '../agents/ceoBrain.js';

// تسلسلُ البناءِ الحقيقيُّ كما في jcr.js (١٢٧٨ ← ٤١٢ ← ٥٣٩ ← ٦٠٦ ← ١٣٢٣)
function runBuild(u, p, { fail = false } = {}) {
    resetProjectState(u, p);
    transitionState(u, p, STATES.ARCHITECTURE, { agent: 'Architect' });
    transitionState(u, p, STATES.GENERATING, { agent: 'Coder' });
    if (fail) {
        transitionState(u, p, STATES.FAILED, { error: 'build_failed' });
        return;
    }
    transitionState(u, p, STATES.REVIEWING, { agent: 'ReviewAgent' });
    transitionState(u, p, STATES.VERIFYING, { agent: 'Requirements' });
    transitionState(u, p, STATES.COMPLETED);
}

test('لا وكيلَ «حالياً» بعد اكتمال البناء', () => {
    runBuild('omar', 'shop');
    assert.equal(getProjectSummary('omar', 'shop').currentAgent, null);
    assert.doesNotMatch(buildStatusReply('omar', 'shop', 'ar'), /الوكيل الحالي/);
});

test('«أنجز» تحملُ الوكلاءَ الذين مرّوا فعلاً بالترتيب', () => {
    runBuild('omar', 'shop2');
    assert.deepEqual(
        getProjectSummary('omar', 'shop2').completedAgents,
        ['Architect', 'Coder', 'ReviewAgent', 'Requirements'],
    );
    assert.match(buildStatusReply('omar', 'shop2', 'ar'), /✅ أنجز: Architect، Coder، ReviewAgent، Requirements/);
});

test('المكتملُ مئةٌ لا سبعةٌ وستون', () => {
    runBuild('omar', 'shop3');
    const s = getProjectSummary('omar', 'shop3');
    assert.equal(s.state, STATES.COMPLETED);
    assert.equal(s.progress, 100);
    assert.match(buildStatusReply('omar', 'shop3', 'ar'), /مكتمل ✅ — 100%/);
});

test('الفشلُ لا يُكافَأ: الساقطُ لا يُعدُّ منجِزاً ولا تُقفَز نسبتُه', () => {
    runBuild('sara', 'blog', { fail: true });
    const s = getProjectSummary('sara', 'blog');
    assert.deepEqual(s.completedAgents, ['Architect'], 'المعماريُّ أنجز، والمبرمجُ سقط');
    assert.equal(s.currentAgent, null, 'لا أحدَ يعمل بعد الفشل');
    assert.ok(s.progress < 100, `نسبةُ الفاشل ${s.progress}% — لا تُرفَع إلى مئة`);
});

test('لا تكرارَ في «أنجز» حين يعودُ البناءُ لوكيلٍ سبق', () => {
    const u = 'omar', p = 'loop';
    resetProjectState(u, p);
    transitionState(u, p, STATES.GENERATING, { agent: 'Coder' });
    transitionState(u, p, STATES.REVIEWING, { agent: 'ReviewAgent' });
    transitionState(u, p, STATES.GENERATING, { agent: 'Coder' });   // إصلاحُ ملاحظات
    transitionState(u, p, STATES.REVIEWING, { agent: 'ReviewAgent' });
    transitionState(u, p, STATES.COMPLETED);
    assert.deepEqual(getProjectSummary(u, p).completedAgents, ['Coder', 'ReviewAgent']);
});

test('انتقالٌ مرفوضٌ لا يُغيّر شيئاً من البطاقة', () => {
    const u = 'omar', p = 'guard';
    resetProjectState(u, p);
    transitionState(u, p, STATES.GENERATING, { agent: 'Coder' });
    const before = JSON.stringify(getProjectSummary(u, p));
    assert.equal(transitionState(u, p, STATES.IDLE), false, 'generating → idle غير مسموح');
    assert.equal(JSON.stringify(getProjectSummary(u, p)), before);
});
