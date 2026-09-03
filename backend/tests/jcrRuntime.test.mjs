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

test('بنّر: «غير صورة البنر» يُمرَّر بعلم hero إلى المولّد', async () => {
    const s = scenario();
    const seen = [];
    await s.send('غير صورة البنر بصورة حديثة حقيقية', { generateAiImages: async (p) => { seen.push(p); } });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].hero, true);
    assertNoHeavyPath(s.calls, 'بنّر');
});
