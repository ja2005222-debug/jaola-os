// 🔄 آلة الحالات المخصبة — وأهم قفلها: GENERATING → COMPLETED كان انتقالاً
// مرفوضاً فيبقى كل بناء ناجح "قيد التنفيذ" 10 دقائق (أصل القفل الوهمي).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    STATES, STATE_EVENTS, transitionState, getProjectState,
    isBuilding, canStartNewBuild, setStateEmitter, resetProjectState,
} from '../agents/stateMachine.js';

const U = 'sm_user';

test('دورة الحياة الصادقة الكاملة: معمارية → كتابة → مراجعة → تحقق → اكتمال', () => {
    const P = 'full_cycle';
    resetProjectState(U, P);
    for (const s of [STATES.ARCHITECTURE, STATES.GENERATING, STATES.REVIEWING, STATES.VERIFYING, STATES.COMPLETED]) {
        assert.equal(transitionState(U, P, s), true, `الانتقال إلى ${s}`);
    }
    assert.equal(getProjectState(U, P).state, STATES.COMPLETED);
    assert.equal(canStartNewBuild(U, P), true, 'بعد الاكتمال يمكن بدء بناء جديد فوراً');
});

test('إصلاح القفل الوهمي: الاكتمال المباشر من GENERATING مسموح', () => {
    const P = 'direct_done';
    resetProjectState(U, P);
    transitionState(U, P, STATES.GENERATING);
    assert.equal(transitionState(U, P, STATES.COMPLETED), true,
        'كان مرفوضاً → المشروع يعلق "قيد البناء" 10 دقائق بعد كل نجاح');
    assert.equal(isBuilding(U, P), false);
});

test('الفشل يحرر القفل فوراً ويسمح بالاستئناف', () => {
    const P = 'fail_resume';
    resetProjectState(U, P);
    transitionState(U, P, STATES.ARCHITECTURE);
    assert.equal(transitionState(U, P, STATES.FAILED, { error: 'x' }), true);
    assert.equal(isBuilding(U, P), false);
    assert.equal(transitionState(U, P, STATES.GENERATING), true, 'الاستئناف من الفشل');
});

test('الانتقالات غير المنطقية ما زالت مرفوضة', () => {
    const P = 'invalid';
    resetProjectState(U, P);
    assert.equal(transitionState(U, P, STATES.DEPLOYING), false, 'لا نشر من العدم');
    assert.equal(getProjectState(U, P).state, STATES.IDLE, 'الحالة لا تتغير عند الرفض');
});

test('isBuilding يغطي المراحل الجديدة (معمارية/تحقق)', () => {
    const P = 'building_states';
    resetProjectState(U, P);
    transitionState(U, P, STATES.ARCHITECTURE);
    assert.equal(isBuilding(U, P), true, 'المعمارية بناء نشط');
    transitionState(U, P, STATES.GENERATING);
    transitionState(U, P, STATES.VERIFYING);
    assert.equal(isBuilding(U, P), true, 'التحقق بناء نشط');
});

test('الناقل الموحد: كل انتقال ناجح يبث حدثه القانوني — والرفض لا يبث', () => {
    const P = 'events';
    resetProjectState(U, P);
    const seen = [];
    setStateEmitter((e) => seen.push(e));
    try {
        transitionState(U, P, STATES.ARCHITECTURE);
        transitionState(U, P, STATES.GENERATING);
        transitionState(U, P, STATES.COMPLETED);
        transitionState(U, P, STATES.DEPLOYING); // مرفوض من COMPLETED
        assert.deepEqual(seen.map(e => e.event),
            ['ArchitectureStarted', 'CodingStarted', 'MissionCompleted']);
        assert.equal(seen[0].username, U);
        assert.equal(seen[0].project, P);
    } finally {
        setStateEmitter(null);
    }
});

test('انهيار الناقل لا يُفشل الانتقال أبداً', () => {
    const P = 'emitter_throw';
    resetProjectState(U, P);
    setStateEmitter(() => { throw new Error('boom'); });
    try {
        assert.equal(transitionState(U, P, STATES.GENERATING), true);
        assert.equal(getProjectState(U, P).state, STATES.GENERATING);
    } finally {
        setStateEmitter(null);
    }
});

test('بداية مهمة جديدة تُصفّر ساعة المدة — لا مدة خيالية (4052 د)', () => {
    const P = 'duration_reset';
    resetProjectState(U, P);
    // مهمة قديمة بدأت قبل يومين
    const st = getProjectState(U, P);
    transitionState(U, P, STATES.ARCHITECTURE);
    st.startedAt = Date.now() - 2 * 24 * 60 * 60 * 1000; // نزيّف بداية قديمة
    transitionState(U, P, STATES.COMPLETED);
    // مهمة جديدة → ARCHITECTURE يجب أن يُصفّر الساعة
    transitionState(U, P, STATES.ARCHITECTURE);
    const fresh = getProjectState(U, P).startedAt;
    assert.ok(Date.now() - fresh < 5000, 'الساعة صُفّرت لبداية المهمة الجديدة');
});

test('كل حالة لها حدث قانوني معرّف', () => {
    for (const s of Object.values(STATES)) {
        assert.ok(STATE_EVENTS[s], `حدث ${s} مفقود`);
    }
});
