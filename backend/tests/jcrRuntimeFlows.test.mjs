// 🧠 شبكة الأمان الثانية لـ jcr.js — بقية الفروع الحتمية في handleUserMessage
// (ARCHITECTURE_MIGRATION.md، القرار 3: لا تفكيك قبل تغطية هذه الفروع).
// كل اختبار هنا يمرّ بالمسار الحقيقي كاملاً: المصنّفات الحتمية تعمل كما هي،
// ومسارات LLM (الموجّه الموحّد، classifyIntent) تسقط فوراً إلى الاحتياط
// المكتوب لأن لا مزوّد AI في بيئة الاختبار — فنُثبّت *ذلك الاحتياط* تحديداً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { scenario, tempProject, assertNoHeavyPath } from './helpers/jcrScenario.mjs';
import { backupProject } from '../agents/fileManager.js';
import { updateStructure } from '../agents/projectMemory.js';
import { recordTurn } from '../services/conversationStore.js';
import { enqueueMission } from '../core/runtime/ExecutionQueue.js';
import { getPendingGoal } from '../services/conversationManager.js';
import { classifyIntentFast } from '../agents/ceoBrain.js';
import { noteLostMission } from '../core/runtime/ExecutionQueue.js';

// ── Clarifier: مرحلة التوضيح ثم مرحلة الخطة بفروعها ──────────────────────
test('clarifying: الإجابة تُمرَّر لمعالج الحوار ويُعاد ردّه بخياراته — لا بناء', async () => {
    const s = scenario('clar');
    const seen = [];
    await s.send('مطعم بحري في جدة', {
        getState: () => ({ stage: 'clarifying' }),
        processAnswer: async (u, m) => { seen.push([u, m]); return { message: 'ما الأقسام المطلوبة؟', options: ['قائمة', 'حجز'] }; },
    });
    assert.deepEqual(seen, [[s.ctx.username, 'مطعم بحري في جدة']]);
    const reply = s.events.find(e => e.ev === 'chat_reply');
    assert.equal(reply.payload.message, 'ما الأقسام المطلوبة؟');
    assert.deepEqual(reply.payload.options, ['قائمة', 'حجز']);
    assertNoHeavyPath(assert, s.calls, 'clarifying');
});

test('planning + تأكيد: الهدف النهائي يذهب إلى executeMission وتُهيَّأ ذاكرة المشروع', async () => {
    const s = scenario('plan');
    const state = { stage: 'planning', lang: 'ar', originalGoal: 'مطعم بحري', plan: { sections: ['القائمة', 'الحجز'], features: ['حجز طاولة'] }, projectType: 'restaurant', answers: [] };
    await s.send('ابدأ', {
        getState: () => state,
        isConfirmation: (m) => m === 'ابدأ',
        getFinalGoal: () => 'ابنِ موقع مطعم بحري بقائمة وحجز طاولة',
    });
    assert.equal(s.calls.executeMission.length, 1);
    assert.equal(s.calls.executeMission[0][0], 'ابنِ موقع مطعم بحري بقائمة وحجز طاولة');
    assert.match(s.replies().join('\n'), /بدأت البناء الآن/);
    assert.equal(s.calls.surgicalEdit.length, 0);
});

test('planning: سؤال عن الخطة → ملخّصها؛ إيقاف → إلغاء؛ لون → سؤال عن اللون؛ تعديل عام → يُسجَّل في الإجابات', async () => {
    const mk = () => ({ stage: 'planning', lang: 'ar', plan: { sections: ['القائمة', 'الحجز'], features: ['حجز طاولة'] }, answers: [] });

    const q = scenario('planq');
    await q.send('ماهي أقسام الخطة؟', { getState: () => mk(), isConfirmation: () => false });
    assert.match(q.replies().join('\n'), /الخطة الحالية تشمل: الأقسام: القائمة، الحجز \| الميزات: حجز طاولة/);
    assertNoHeavyPath(assert, q.calls, 'سؤال عن الخطة');

    const stop = scenario('plans');
    let cleared = 0;
    await stop.send('لا توقف', { getState: () => mk(), isConfirmation: () => false, clearState: () => { cleared += 1; } });
    assert.equal(cleared, 1);
    assert.match(stop.replies().join('\n'), /تم إلغاء الخطة/);

    const color = scenario('planc');
    const cstate = mk();
    await color.send('خلي الالوان ذهبية', { getState: () => cstate, isConfirmation: () => false });
    assert.match(color.replies().join('\n'), /ما اللون أو التدرج اللوني الذي تفضله/);
    assert.deepEqual(cstate.answers, ['color change requested: خلي الالوان ذهبية']);

    const edit = scenario('plane');
    const estate = mk();
    await edit.send('ضيف قسم آراء العملاء', { getState: () => estate, isConfirmation: () => false });
    assert.match(edit.replies().join('\n'), /فهمت! سأراعي: "ضيف قسم آراء العملاء"/);
    assert.deepEqual(estate.answers, ['edit: ضيف قسم آراء العملاء']);
    assertNoHeavyPath(assert, edit.calls, 'تعديل على الخطة');
});

// ── ⏪ التراجع: حتمي، من القرص، بلا أي تفسير ─────────────────────────────
test('تراجع بلا نسخة محفوظة → رسالة واضحة، لا استرجاع ولا مسار ثقيل', async () => {
    const s = scenario('undo0');
    await s.send('تراجع');
    assert.match(s.replies().join('\n'), /لا توجد نسخة سابقة محفوظة بعد/);
    assertNoHeavyPath(assert, s.calls, 'تراجع بلا نسخة');
});

test('تراجع مع نسخة حقيقية → الملفات تعود فعلاً، المعاينة تتحدّث، وقائمة الملفات تُبثّ', async () => {
    const dir = tempProject('<!DOCTYPE html><html><body><h1>النسخة الأولى</h1><p>' + 'x'.repeat(120) + '</p></body></html>');
    const index = path.join(dir, 'index.html');
    const backup = await backupProject(dir, 'test');
    assert.equal(backup.success, true);
    fs.writeFileSync(index, '<!DOCTYPE html><html><body><h1>تعديل خاطئ</h1></body></html>');

    const s = scenario('undo1');
    await s.send('استرجع النسخة السابقة', {}, { projectPath: dir });

    assert.match(fs.readFileSync(index, 'utf-8'), /النسخة الأولى/, 'المحتوى عاد من النسخة');
    assert.match(s.replies().join('\n'), /⏪ تم — استُرجعت النسخة السابقة/);
    assert.ok(s.events.some(e => e.ev === 'preview_updated'), 'المعاينة تتحدّث');
    const files = s.events.find(e => e.ev === 'workspace_files');
    assert.ok(files && files.payload.includes('index.html'), 'قائمة الملفات تُبثّ بلا المخفيّة');
    assert.ok(!files.payload.includes('.backups'));
    assert.match(s.logs(), /⏪ استُرجعت النسخة snapshot_/);
    assertNoHeavyPath(assert, s.calls, 'تراجع');
});

// ── «نعم» و«نفذ» المجرّدتان ─────────────────────────────────────────────
test('«نعم» بعد رسالة محجوبة → تنفيذ *الطلب المحجوب* تعديلاً موضعياً (لا استئناف عام)', async () => {
    const s = scenario('yesg');
    s.rt.gatedMessages.set(s.ctx.username, 'اعطي الادمن صلاحية حذف الطلبات');
    await s.send('نعم');
    assert.equal(s.calls.surgicalEdit.length, 1);
    assert.equal(s.calls.surgicalEdit[0][0], 'اعطي الادمن صلاحية حذف الطلبات');
    assert.equal(s.rt.gatedMessages.has(s.ctx.username), false, 'الحاجز يُصفّى');
    assert.equal(s.calls.executeMission.length, 0, 'لا إعادة توليد كاملة تدهس المشروع');
    assert.match(s.logs(), /"نعم" بعد حجب/);
});

test('«نعم» مع ذاكرة مشروع قابلة للاستئناف → استئناف فعلي بهدف موسوم [استئناف]', async () => {
    const s = scenario('yesr');
    updateStructure(s.ctx.username, s.ctx.activeProject, ['قائمة المطاعم', 'صفحة التتبع'], ['فلترة وبحث']);
    await s.send('تمام');
    assert.equal(s.calls.executeMission.length, 1);
    assert.match(s.calls.executeMission[0][0], /\[استئناف\]/);
    assert.match(s.replies().join('\n'), /أكمل من حيث توقفنا/);
    assert.equal(s.calls.surgicalEdit.length, 0);
});

test('«نفذ» مجرّدة: مع سجل محادثة → تنفيذ ما وصفه المساعد تعديلاً؛ بلا سجل → سؤال محدّد', async () => {
    const withHist = scenario('exec1');
    await recordTurn(`${withHist.ctx.username}::${withHist.ctx.activeProject}`,
        'اقترح تحسينات للهيدر', 'أقترح: إضافة زر واتساب في الهيدر وتكبير الشعار.');
    await withHist.send('نفذ');
    assert.equal(withHist.calls.surgicalEdit.length, 1);
    assert.match(withHist.calls.surgicalEdit[0][0], /زر واتساب في الهيدر/);
    assert.match(withHist.replies().join('\n'), /أنفّذ ما اتفقنا عليه/);

    const noHist = scenario('exec0');
    await noHist.send('طبقها');
    assert.match(noHist.replies().join('\n'), /ماذا تريد أن أنفّذ بالضبط/);
    assertNoHeavyPath(assert, noHist.calls, 'نفذ بلا سجل');
});

// ── 🧠 CEO Brain: النوايا الإدارية قبل أي LLM ───────────────────────────
test('نوايا CEO الحتمية: حالة وتحية تُجابان مباشرة، مع نية وقرار ظاهرَين في السجل', async () => {
    const st = scenario('ceo1');
    await st.send('أين وصلنا؟');
    assert.equal(st.replies().length, 1);
    assert.ok(st.replies()[0].length > 10);
    assert.match(st.logs(), /"intent":"status"/);
    assert.match(st.logs(), /\[DECISION\]/);
    assertNoHeavyPath(assert, st.calls, 'status');

    const hi = scenario('ceo2');
    await hi.send('مرحباً');
    assert.equal(hi.replies().length, 1);
    assert.match(hi.logs(), /"intent":"greeting"/);
    assertNoHeavyPath(assert, hi.calls, 'greeting');
});

test('«اكمل»: بلا ذاكرة → سؤال محدّد؛ بذاكرة → استئناف؛ ومهمة نشطة → رسالة انشغال بلا تنفيذ', async () => {
    assert.equal(classifyIntentFast('اكمل')?.intent, 'continue', 'شرط الاختبار: «اكمل» نية استئناف');

    const none = scenario('cont0');
    await none.send('اكمل');
    assert.match(none.replies().join('\n'), /لا أجد مشروعاً سابقاً/);
    assertNoHeavyPath(assert, none.calls, 'اكمل بلا ذاكرة');

    const mem = scenario('cont1');
    updateStructure(mem.ctx.username, mem.ctx.activeProject, ['الرئيسية', 'القائمة'], ['سلة']);
    await mem.send('اكمل');
    assert.equal(mem.calls.executeMission.length, 1);
    assert.match(mem.calls.executeMission[0][0], /\[استئناف\]/);
    assert.match(mem.replies().join('\n'), /وجدت المشروع في الذاكرة/);

    const busy = scenario('cont2');
    updateStructure(busy.ctx.username, busy.ctx.activeProject, ['الرئيسية'], []);
    enqueueMission({ username: busy.ctx.username, project: busy.ctx.activeProject, run: () => new Promise(() => {}) });
    await busy.send('اكمل');
    assert.match(busy.replies().join('\n'), /الفريق يعمل على المشروع الآن بالفعل/);
    assertNoHeavyPath(assert, busy.calls, 'اكمل أثناء مهمة نشطة');
});

test('«انشر»: مشروع ثابت → أمر النشر يُمرَّر لوكيل النشر بسياق المستخدم والمشروع', async () => {
    const s = scenario('deploy');
    const seen = [];
    await s.send('انشر الموقع الآن', { deployProject: async (opts) => { seen.push(opts); } });
    assert.match(s.replies().join('\n'), /أمر النشر مقبول/);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].currentUser, s.ctx.username);
    assert.equal(seen[0].activeProject, s.ctx.activeProject);
    assert.equal(seen[0].projectPath, s.ctx.projectPath);
    assertNoHeavyPath(assert, s.calls, 'deploy');
});

// ── الاحتياط عند غياب الموجّه: نمط التعديل المباشر + الحاجز والإصرار ──────
test('«عدل: …» يُلتقط بقاعدة مباشرة → تعديل جراحي فوري بثقة 100% (لا LLM)', async () => {
    const dir = tempProject();
    const s = scenario('mod');
    await s.send('عدل: غير لون الهيدر الى ازرق', {}, { projectPath: dir });
    assert.equal(s.calls.surgicalEdit.length, 1);
    assert.equal(s.calls.surgicalEdit[0][0], 'عدل: غير لون الهيدر الى ازرق');
    assert.match(s.logs(), /نية: modify \(ثقة: 100%\) - قاعدة مباشرة/);
    assert.equal(s.calls.chat.length, 0);
});

test('جملة إخبارية على مشروع قائم تُحجب مرة واحدة بردّ حتمي، والرسالة التالية إصرار → تعديل', async () => {
    const dir = tempProject();
    const s = scenario('gate');
    await s.send('الالوان في الهيدر حلوة', {}, { projectPath: dir });
    assert.equal(s.rt.gatedMessages.get(s.ctx.username), 'الالوان في الهيدر حلوة', 'حُجبت مرة واحدة');
    assert.match(s.replies().join('\n'), /أكّد بإرسال «نعم» أو أعد صياغة طلبك كأمر/);
    assertNoHeavyPath(assert, s.calls, 'الحجب الأول');

    await s.send('الخلفية داكنة جدا', {}, { projectPath: dir });
    assert.equal(s.calls.surgicalEdit.length, 1, 'رسالة بعد حجب = إصرار → تنفيذ');
    assert.equal(s.calls.surgicalEdit[0][0], 'الخلفية داكنة جدا');
    assert.equal(s.rt.gatedMessages.has(s.ctx.username), false);
    assert.match(s.logs(), /إصرار المستخدم → تنفيذ التعديل/);
});

test('سؤال على مشروع قائم لا يُعامل تعديلاً أبداً → ردّ محادثة', async () => {
    const dir = tempProject();
    const s = scenario('ask');
    await s.send('هل الموقع يدعم الجوال؟', {}, { projectPath: dir });
    assert.equal(s.calls.chat.length, 1, 'ردّ محادثة');
    assert.equal(s.calls.surgicalEdit.length, 0);
    assert.equal(s.rt.gatedMessages.has(s.ctx.username), false, 'الأسئلة لا تُحجب');
});

// ── طلب بناء صريح: تأكيد سريع بهدف معلّق، أو حوار توضيح إن كان واسعاً ──────
test('«ابني موقع…» واضح → سؤال تأكيد يُظهر المشروع الهدف ويُعلّق الهدف؛ ثم «نعم» تنفّذه', async () => {
    const s = scenario('build');
    await s.send('ابني موقع لمطعم بحري', { startClarification: async () => null });
    const reply = s.events.find(e => e.ev === 'chat_reply');
    assert.match(reply.payload.message, /هل تريد بناء موقع لـ "موقع لمطعم بحري"/);
    assert.match(reply.payload.message, new RegExp(s.ctx.activeProject), 'المشروع الهدف ظاهر صراحةً');
    assert.ok(reply.payload.options?.length === 2);
    assert.equal(getPendingGoal(s.ctx.username), 'ابني موقع لمطعم بحري');
    assert.equal(s.calls.executeMission.length, 0, 'لا بناء قبل التأكيد');

    await s.send('نعم');
    assert.equal(s.calls.executeMission.length, 1);
    assert.equal(s.calls.executeMission[0][0], 'ابني موقع لمطعم بحري');
    assert.equal(getPendingGoal(s.ctx.username), null);
});

test('طلب بناء واسع → حوار التوضيح أولاً (خيارات) بلا هدف معلّق', async () => {
    const s = scenario('buildc');
    await s.send('ابني منصة', {
        startClarification: async () => ({ type: 'clarification', message: 'ما نوع المنصة؟', options: ['تعليمية', 'تجارية'] }),
    });
    const reply = s.events.find(e => e.ev === 'chat_reply');
    assert.equal(reply.payload.message, 'ما نوع المنصة؟');
    assert.deepEqual(reply.payload.options, ['تعليمية', 'تجارية']);
    assert.equal(getPendingGoal(s.ctx.username), null);
    assertNoHeavyPath(assert, s.calls, 'توضيح');
});

test('مهمة سقطت مع إعادة تشغيل الخادم → إشعار صادق مرة واحدة في أول رسالة، ثم يمضي المسار الطبيعي', async () => {
    const s = scenario('lost');
    noteLostMission({ username: s.ctx.username, project: s.ctx.activeProject, goal: 'ابني متجر عطور فاخر', roomName: s.ctx.roomName, state: 'running' });
    await s.send('مرحبا');
    const replies = s.replies();
    assert.match(replies[0], /انقطعت بإعادة تشغيل الخادم/);
    assert.match(replies[0], /ابني متجر عطور فاخر/);
    assert.match(s.logs(), /\[Ledger\]: 🧾 مهمة سابقة \(كانت جارية\) سقطت/);
    assert.ok(replies.length >= 2, 'ثم رُدّ على التحية نفسها');
    // الرسالة التالية بلا إشعار — أُخذت مرة واحدة
    await s.send('مرحبا');
    assert.equal(s.replies().filter(r => /انقطعت بإعادة تشغيل/.test(r)).length, 1);
});

