// 🧠 أول شبكة أمان لـ jcr.js (ARCHITECTURE_MIGRATION.md) — المسار التنفيذي
// الجوهري (3059 سطراً) لم يكن يلمسه أيّ اختبار من الـ735. هذه اختبارات
// *توصيفية* (characterization): تُثبّت سلوك الفروع الحتمية في handleUserMessage
// التي تعمل بلا أي نموذج لغوي (تأكيد البناء، الهدف المعلّق، قفل اللغة، حذف
// المشروع، توليد الصور) — كي يصبح أي تفكيك لاحق للملف قابلاً للتحقق.
//
// المبدأ: io وهمي يلتقط البثّ، وحقيبة agents وهمية، وطرق الإطلاق الثقيلة
// (executeMission/surgicalEdit/generateChatResponse) تُستبدل بمسجِّلات —
// فلا LLM ولا شبكة ولا كتابة مشاريع على القرص.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { setPendingGoal, getPendingGoal } from '../services/conversationManager.js';
import { setUserLanguage, getUserLanguage } from '../agents/languageDetector.js';
import { resetLessons } from '../services/platformLessons.js';

let seq = 0;
function scenario() {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const rt = new JaolaCognitiveRuntime(io);
    const calls = { executeMission: [], surgicalEdit: [], chat: [] };
    rt.executeMission = (...args) => { calls.executeMission.push(args); };
    rt.surgicalEdit = (...args) => { calls.surgicalEdit.push(args); };
    rt.generateChatResponse = async (...args) => { calls.chat.push(args); };
    const ctx = {
        username: `__jcr_t${seq}__`,
        roomName: `jcr_room_${seq}`,
        projectPath: `/nonexistent/jcr_${seq}`,
        activeProject: `proj-${seq}`,
    };
    const replies = () => events.filter(e => e.ev === 'chat_reply').map(e => e.payload.message);
    const send = (message, agents = {}, extra = {}) =>
        rt.handleUserMessage(null, { ...ctx, ...extra, message }, { getState: () => null, ...agents }, null);
    return { rt, events, calls, ctx, replies, send };
}

function assertNoHeavyPath(calls, label) {
    assert.equal(calls.surgicalEdit.length, 0, `${label}: لا تعديل جراحي`);
    assert.equal(calls.chat.length, 0, `${label}: لا ردّ LLM`);
}

test('__CONFIRM_BUILD__ يُطلق executeMission بالهدف الحرفي وبنفس سياق الغرفة', async () => {
    const s = scenario();
    await s.send('__CONFIRM_BUILD__ابنِ متجراً للعطور');

    assert.equal(s.calls.executeMission.length, 1);
    const [goal, projectPath, username, activeProject, roomName] = s.calls.executeMission[0];
    assert.equal(goal, 'ابنِ متجراً للعطور');
    assert.equal(projectPath, s.ctx.projectPath);
    assert.equal(username, s.ctx.username);
    assert.equal(activeProject, s.ctx.activeProject);
    assert.equal(roomName, s.ctx.roomName);
    assert.match(s.replies().join('\n'), /أبني الآن|Building now/);
    assertNoHeavyPath(s.calls, 'تأكيد البناء');
});

test('هدف معلّق + «نعم» → يُستهلك ويُنفَّذ؛ + «لا» → يُلغى بلا تنفيذ', async () => {
    const yes = scenario();
    setPendingGoal(yes.ctx.username, 'موقع لمطعم بحري', yes.ctx.activeProject);
    await yes.send('نعم');
    assert.equal(yes.calls.executeMission.length, 1);
    assert.equal(yes.calls.executeMission[0][0], 'موقع لمطعم بحري');
    assert.equal(getPendingGoal(yes.ctx.username), null, 'الهدف المعلّق استُهلك');
    assertNoHeavyPath(yes.calls, 'نعم');

    const no = scenario();
    setPendingGoal(no.ctx.username, 'موقع لمطعم بحري', no.ctx.activeProject);
    await no.send('لا');
    assert.equal(no.calls.executeMission.length, 0);
    assert.equal(getPendingGoal(no.ctx.username), null, 'الحوار أُلغي');
    assert.match(no.replies().join('\n'), /تم الإلغاء|Cancelled/);
    assertNoHeavyPath(no.calls, 'لا');
});

test('قفل اللغة: طلب صريح بالإنجليزية يُحفظ ويُؤكَّد فوراً بلا أي مسار ثقيل', async () => {
    const s = scenario();
    setUserLanguage(s.ctx.username, 'ar');
    await s.send('speak english');

    assert.equal(getUserLanguage(s.ctx.username), 'en');
    assert.match(s.replies().join('\n'), /speak English from now on/);
    assert.equal(s.calls.executeMission.length, 0);
    assertNoHeavyPath(s.calls, 'قفل اللغة');
});

test('نية الحذف تطلب تأكيداً حرفياً باسم المشروع — ولا تحذف شيئاً', async () => {
    const s = scenario();
    let deleted = 0;
    await s.send('احذف المشروع', { deleteProject: async () => { deleted += 1; return { success: true }; } },
        { activeProject: 'naya-taxi' });

    assert.equal(deleted, 0, 'النية وحدها لا تحذف');
    assert.match(s.replies().join('\n'), /احذف نهائياً naya-taxi/);
    assert.equal(s.calls.executeMission.length, 0);
    assertNoHeavyPath(s.calls, 'نية الحذف');
});

test('sandbox_app محمي من الحذف حتى عند نية صريحة', async () => {
    const s = scenario();
    let deleted = 0;
    await s.send('امسح المشروع', { deleteProject: async () => { deleted += 1; return { success: true }; } },
        { activeProject: 'sandbox_app' });

    assert.equal(deleted, 0);
    assert.match(s.replies().join('\n'), /sandbox_app/);
    assert.doesNotMatch(s.replies().join('\n'), /احذف نهائياً sandbox_app/, 'لا يُعرض أمر تأكيد لمشروع محمي');
});

test('تأكيد الحذف الحرفي يستدعي deleteProject(username, target) ويُبلّغ النتيجة', async () => {
    const ok = scenario();
    const seen = [];
    await ok.send('احذف نهائياً naya-taxi', { deleteProject: async (u, p) => { seen.push([u, p]); return { success: true }; } });
    assert.deepEqual(seen, [[ok.ctx.username, 'naya-taxi']]);
    assert.match(ok.replies().join('\n'), /🗑️.*naya-taxi/);
    assertNoHeavyPath(ok.calls, 'تأكيد الحذف');

    const fail = scenario();
    await fail.send('احذف نهائياً ghost', { deleteProject: async () => ({ success: false, error: 'لا يوجد مشروع بهذا الاسم' }) });
    assert.match(fail.replies().join('\n'), /❌ لا يوجد مشروع بهذا الاسم/);
});

test('نية توليد الصور تذهب لمولّد الصور مباشرة — لا مهمة تعديل كود', async () => {
    const s = scenario();
    const seen = [];
    await s.send('generate real images', { generateAiImages: async (p) => { seen.push(p); } });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].message, 'generate real images');
    assert.equal(seen[0].hero, false);
    assert.equal(seen[0].target, null);
    assert.equal(s.calls.executeMission.length, 0);
    assertNoHeavyPath(s.calls, 'توليد الصور');
});

// ── النواة: تحليل المهمة بلا «Executive Brain» ──────────────────────────
// runExecutiveBrain حُذف (استدعاء LLM كان يُنتج taskGraph لا يقرؤه أحد).
// هذان الاختباران يثبّتان ما بقي: ميزانية سليمة في مسار الاحتياط، وعرض
// المجاهيل للمستخدم — بلا أي نموذج لغوي (الميزانية المُستنفدة تُجبر الاحتياط).
function kernelContext(over = {}) {
    return {
        username: `__jcr_k${++seq}__`,
        goal: 'موقع لمطعم',
        mentalModel: {},
        metaReasoning: { confidence: 100, unknowns: [], needsUserClarification: false },
        budget: null,
        ...over,
    };
}

test('buildMissionAndMeta: مسار الاحتياط يترك ميزانية كاملة لحلقة الكود (لا وحدة تُحرق بلا فائدة)', async () => {
    const s = scenario();
    const ctx = kernelContext({ budget: { consumeCall: () => false } }); // يُجبر الاحتياط حتمياً
    await s.rt.buildMissionAndMeta(ctx, s.ctx.roomName);

    assert.equal(ctx.budget.maxApiCalls, 7, 'ميزانية "medium"');
    assert.equal(ctx.budget.apiCallsUsed, 0, 'لا استهلاك قبل حلقة الكود');
    assert.equal(ctx.metaReasoning.confidence, 70);
    assert.equal(typeof s.rt.runExecutiveBrain, 'undefined', 'لا مرحلة CEO وهمية بعد الآن');
    const logs = s.events.filter(e => e.ev === 'log').map(e => e.payload.message).join('\n');
    assert.match(logs, /2\. MISSION & META/);
    assert.doesNotMatch(logs, /EXECUTIVE BRAIN/);
});

test('المجاهيل تُعرض للمستخدم عند ثقة منخفضة فقط — وبلا LLM', () => {
    const shown = scenario();
    const ctx = kernelContext({ metaReasoning: { confidence: 30, unknowns: ['أي مدينة؟', 'أي لغة؟'], needsUserClarification: true } });
    assert.equal(shown.rt._noteUnknowns(ctx, shown.ctx.roomName), true);
    const logs = shown.events.filter(e => e.ev === 'log').map(e => e.payload.message).join('\n');
    assert.match(logs, /توجد مجاهيل/);
    assert.match(logs, /1\. أي مدينة؟\n2\. أي لغة؟/);

    const quiet = scenario();
    assert.equal(quiet.rt._noteUnknowns(kernelContext(), quiet.ctx.roomName), false);
    assert.equal(quiet.events.length, 0, 'لا ضجيج عند غياب المجاهيل');
});

// ── التعلّم بعد المهمة: platformLessons بدل «التأمل» و«الفضول» الوهميين ──
test('التعلّم بعد المهمة: الفشل يُسجَّل درساً بسجلٍّ صادق، والإيقاف والنجاح بلا دروس صامتان', () => {
    resetLessons();
    try {
        const s = scenario();
        const logs = () => s.events.filter(e => e.ev === 'log').map(e => e.payload.message).join('\n');

        const aborted = new Error('MISSION_ABORTED'); aborted.aborted = true;
        assert.equal(s.rt._learnFromOutcome(s.ctx.roomName, { success: false, error: aborted }), null);
        assert.equal(s.rt._learnFromOutcome(s.ctx.roomName, { success: true }), null);
        assert.equal(logs(), '', 'لا سجل بلا درس');

        // عطل مزوّد ×3 → ناضج لكنه ليس توجيهاً للمولّد — السجل لا يدّعي ذلك
        const ai = new Error('x'); ai.aiUnavailable = true;
        s.rt._learnFromOutcome(s.ctx.roomName, { success: false, error: ai });
        s.rt._learnFromOutcome(s.ctx.roomName, { success: false, error: ai });
        const third = s.rt._learnFromOutcome(s.ctx.roomName, { success: false, error: ai });
        assert.equal(third.count, 3);
        assert.match(logs(), /6\. LEARNING/);
        assert.match(logs(), /درس مسجَّل: ai_unavailable \(تكرار 3\) — نمطٌ متكرر يظهر للمشرف/);

        // فشل يستطيع المولّد تجنّبه ×3 → توجيه دائم
        const noFiles = new Error('لم يتم استخراج أي ملفات من رد النموذج');
        for (let i = 0; i < 3; i++) s.rt._learnFromOutcome(s.ctx.roomName, { success: false, error: noFiles });
        assert.match(logs(), /درس مسجَّل: no_files \(تكرار 3\) — أصبح توجيهاً دائماً للمولّد/);

        // نجاح بعد نضج توجيه واحد → سطر صادق بعدد الدروس المحقونة فقط (لا يعدّ عطل المزوّد)
        const ok = scenario();
        ok.rt._learnFromOutcome(ok.ctx.roomName, { success: true });
        assert.match(ok.events.map(e => e.payload?.message || '').join('\n'), /بُني هذا المشروع بـ1 درساً متراكماً/);

        assert.equal(typeof s.rt.runReflectionAndSelfImprovement, 'undefined', 'لا «تأمل» وهمي');
        assert.equal(typeof s.rt.runCuriosityInBackground, 'undefined', 'لا «فضول» وهمي');
    } finally {
        resetLessons();
    }
});

test('بنّر: «غير صورة البنر» يُمرَّر بعلم hero إلى المولّد', async () => {
    const s = scenario();
    const seen = [];
    await s.send('غير صورة البنر بصورة حديثة حقيقية', { generateAiImages: async (p) => { seen.push(p); } });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].hero, true);
    assertNoHeavyPath(s.calls, 'بنّر');
});
