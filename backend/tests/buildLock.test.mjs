// 🔓 القفل الوهمي (#53): "مهمة تعمل بالفعل" كانت تحجب "أكمل" للأبد بعد
// تعطّل/إعادة تشغيل. القرار يعتمد على البناء الفعلي الجاري لا الحالة المخزّنة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, classifyIntentFast } from '../agents/ceoBrain.js';
import { transitionState, getProjectState, STATES, isBuilding } from '../agents/stateMachine.js';
import { enqueueMission, isMissionActive } from '../services/missionQueue.js';

const U = '__lock_test__', P = 'stale-project';

test('بناء عالق قديم → تحرير تلقائي و"أكمل" تُنفَّذ', () => {
    transitionState(U, P, STATES.GENERATING);
    getProjectState(U, P).updatedAt = Date.now() - 20 * 60 * 1000; // 20 دقيقة

    assert.equal(isBuilding(U, P), false, 'القفل العالق يتحرر ذاتياً');
    assert.equal(getProjectState(U, P).state, STATES.FAILED, 'يتحول لحالة قابلة للاستئناف');
    assert.equal(decide('continue', U, P).action, 'execute', '"أكمل" لا تُحجب');
});

test('بناء فعلي جارٍ → حجب صحيح، وبعد الانتهاء → تحرر فوري', async () => {
    let release;
    const running = new Promise(r => { release = r; });
    enqueueMission({ username: U, project: P, run: () => running });

    assert.equal(isMissionActive(U, P), true);
    assert.equal(decide('continue', U, P).action, 'reply', 'أثناء بناء فعلي: لا تنفيذ متوازٍ');

    release();
    await running;
    await new Promise(r => setTimeout(r, 20));

    assert.equal(isMissionActive(U, P), false);
    assert.equal(decide('continue', U, P).action, 'execute', 'بعد الانتهاء: "أكمل" تعمل');
});

test('الاستئناف يلتقط اللواحق: "اكملها/اكمله/كملوا" (سجل التوصيل)', () => {
    for (const m of ['اكملها', 'اكمله', 'كملوا', 'اكمل', 'واصلها', 'تابعها']) {
        assert.equal(classifyIntentFast(m)?.intent, 'continue', `"${m}" استئناف`);
    }
    // لا يُكسر: كلمات لا علاقة لها
    assert.notEqual(classifyIntentFast('اكتب رسالة')?.intent, 'continue');
});
