// 🧭 `_handleClassifiedIntent` — الموجّه الأخير بعد النوايا السريعة والموجّه
// الموحّد: build / modify / stop / وإلّا. ١٢١ سطراً بلا اختبارٍ يذكرها.
//
// اختباراتُ **توصيف**. الحتميّةُ هنا كاملة: `meaningIntent.confidence >= 75`
// يطغى على المصنِّف، فنُمرّر النيّةَ من الطلب ونُثبّت `classifyIntent` على
// احتياطه. الحرّاسُ الثلاثةُ المحروسون وُلدوا من بلاغاتٍ حقيقيّة:
//   • «ماذا يمكن أن نضيف للمشروع؟» صُنّفت modify **فعدّلت الموقعَ فعلاً**.
//   • «ولكن قائمة الأصدقاء موجودة» تصحيحٌ إخباريّ لا طلبُ تعديل.
//   • «نحن نعمل على موقع تاكسي» وصفٌ لا أمرُ بناءٍ جديد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario, tempProject, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getPendingGoal, clearDialog } from '../services/conversationManager.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

function classified(prefix, { dir = null, clarification = null } = {}) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    clearDialog(s.ctx.username);
    const projectPath = dir || emptyProject();
    // المصنِّفُ اللغويّ يسقط بلا مزوّد إلى {chat,50} — نُثبّته لنعزل المنطق.
    s.rt.classifyIntent = async () => ({ intent: 'chat', confidence: 50 });
    const cleared = [];
    const agents = {
        getState: () => null,
        clearState: (u) => cleared.push(u),
        startClarification: async () => clarification,
    };
    const req = (message, intent = 'chat', confidence = 95) => ({
        message, normalizedMessage: message, meaningIntent: { intent, confidence },
        ...s.ctx, projectPath, userLang: 'ar',
    });
    const handle = (message, intent, confidence) => s.rt._handleClassifiedIntent(req(message, intent, confidence), agents);
    return { ...s, projectPath, agents, cleared, handle };
}

// ── build ──────────────────────────────────────────────────────────────

test('build غيرُ صريح على مشروعٍ قائم + فعلٌ → تعديلٌ جراحيّ مباشر، لا حلقةَ تأكيد', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('أضف قسم تقييمات للموقع', 'build'), true);
    assert.equal(s.calls.surgicalEdit.length, 1);
    assert.equal(s.calls.surgicalEdit[0][0], 'أضف قسم تقييمات للموقع');
    assert.equal(s.calls.surgicalEdit[0][1].projectPath, s.projectPath);
    assert.match(s.logs(), /تعديل جراحي مباشر \(لا حلقة تأكيد\)/);
    assert.equal(s.replies().length, 0, 'لا سؤالَ تأكيدٍ يُعيد على المستخدم كلماته');
});

test('build غيرُ صريح على مشروعٍ قائم + جملةٌ وصفيّة → محادثةٌ لا بناءٌ جديد', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('نحن نعمل على موقع تاكسي', 'build'), true);
    assert.equal(s.calls.chat.length, 1);
    assert.equal(s.calls.surgicalEdit.length, 0);
    assert.match(s.logs(), /جملة غير آمرة على مشروع قائم/);
});

test('build صريح + حوارٌ استراتيجيّ → خياراتُ التوضيح ولا هدفَ معلّق', async () => {
    const s = classified('cls', { clarification: { type: 'clarification', message: 'ما نوع المتجر؟', options: ['عطور', 'ملابس'] } });
    assert.equal(await s.handle('ابني متجر', 'build'), true);
    const last = s.events.filter((e) => e.ev === 'chat_reply').at(-1).payload;
    assert.equal(last.message, 'ما نوع المتجر؟');
    assert.deepEqual(last.options, ['عطور', 'ملابس']);
    assert.equal(getPendingGoal(s.ctx.username), null);
    assert.match(s.logs(), /بدء حوار التخطيط/);
});

test('build صريح وواضح → سؤالُ تأكيدٍ يسمّي الهدفَ والمشروعَ الحالي، ويُعلّق الهدف', async () => {
    const s = classified('cls');
    assert.equal(await s.handle('ابني متجر عطور فاخر', 'build'), true);
    const last = s.events.filter((e) => e.ev === 'chat_reply').at(-1).payload;
    assert.match(last.message, /هل تريد بناء موقع لـ "متجر عطور فاخر"/, 'فعلُ البناء يُحذف من التلميح');
    assert.ok(last.message.includes(`«${s.ctx.activeProject}»`), 'المشروعُ الهدف يُسمّى صراحةً');
    assert.deepEqual(last.options, ['نعم، ابنه الآن ⚡', 'لا، أخبرني أكثر']);
    assert.equal(last.pendingGoal, 'ابني متجر عطور فاخر');
    assert.equal(getPendingGoal(s.ctx.username), 'ابني متجر عطور فاخر', 'الهدفُ معلّقٌ للتأكيد');
    assert.equal(s.calls.executeMission.length, 0, 'لا بناءَ قبل التأكيد');
});

// ── modify ─────────────────────────────────────────────────────────────

test('modify + سؤال → محادثة أبداً، لا تعديل («ماذا يمكن أن نضيف؟» عدّلت الموقع فعلاً)', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('ماذا يمكن أن نضيف للمشروع؟', 'modify'), true);
    assert.equal(s.calls.chat.length, 1);
    assert.equal(s.calls.surgicalEdit.length, 0);
    assert.match(s.logs(), /سؤال — رد محادثة/);

    // 🔴 طفرةٌ نجت: الرسالةُ أعلاه بلا فعلِ أمرٍ أصلاً، فحارسُ **الفعل** يحميها لا
    //    حارسُ **السؤال** — والاختبارُ كان يمرّ بالسبب الخطأ. سؤالٌ يحمل فعلاً
    //    («ممكن تضيف» إشارةُ فعلٍ مُعلَنة) يُثبت أنّ علامةَ الاستفهام وحدَها تكفي.
    assert.equal(await s.handle('ممكن تضيف قسم تقييمات؟', 'modify'), true);
    assert.equal(s.calls.surgicalEdit.length, 0, 'سؤالٌ بفعلٍ يبقى سؤالاً');
    assert.equal(s.calls.chat.length, 2);
});

test('modify + جملةٌ إخباريّة → حجبٌ مرّةً واحدة، والتكرارُ إصرارٌ يُنفَّذ', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('ولكن قائمة الأصدقاء موجودة', 'modify'), true);
    assert.equal(s.calls.surgicalEdit.length, 0, 'حُجبت');
    assert.ok(s.rt.gatedMessages.has(s.ctx.username));
    assert.equal(s.replies().at(-1), s.rt.gateConfirmReply('ar'));

    assert.equal(await s.handle('ولكن قائمة الأصدقاء موجودة', 'modify'), true);
    assert.equal(s.calls.surgicalEdit.length, 1, 'الرسالةُ المُعادة إصرار');
    assert.equal(s.rt.gatedMessages.has(s.ctx.username), false, 'الحجبُ يُرفع بعد التنفيذ');
    assert.match(s.logs(), /إصرار المستخدم → تنفيذ التعديل/);
});

test('modify + فعلٌ صريح → تعديلٌ جراحيّ مباشرةً', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('غيّر لون الزر إلى أخضر', 'modify'), true);
    assert.equal(s.calls.surgicalEdit.length, 1);
    assert.equal(s.replies().length, 0);
});

// ── stop ───────────────────────────────────────────────────────────────

test('stop → تنظيفُ الحالة والحوار، ولا مسارٌ ثقيل', async () => {
    const s = classified('cls');
    assert.equal(await s.handle('توقف', 'stop', 98), true);
    assert.deepEqual(s.cleared, [s.ctx.username]);
    assert.match(s.logs(), /أمر إيقاف/);
    assert.equal(s.calls.surgicalEdit.length + s.calls.chat.length + s.calls.executeMission.length, 0);
});

// ── وإلّا: محادثة/استعلام ──────────────────────────────────────────────

test('نيّةٌ عامّة على مشروعٍ قائم + فعل → تعديلٌ تلقائيّ (لا «عدّل على نفس الموقع» كلَّ مرّة)', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('قم بربط الصفحات ببعضها', 'chat', 40), true);
    assert.equal(s.calls.surgicalEdit.length, 1);
    assert.match(s.logs(), /طلب على مشروع قائم → تعديل جراحي/);
});

test('نيّةٌ عامّة على مشروعٍ قائم بلا فعل → حجبٌ، ثمّ أيُّ رسالةٍ تاليةٍ غيرِ سؤالٍ تُنفَّذ', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('الصفحة الرئيسية جميلة جداً', 'chat', 40), true);
    assert.equal(s.calls.surgicalEdit.length, 0);
    assert.equal(s.replies().at(-1), s.rt.gateConfirmReply('ar'));

    // 🔁 الإصرارُ لا يشترط تطابقاً حرفيّاً — أيُّ رسالةٍ محجوبةٍ سابقاً تكفي
    assert.equal(await s.handle('الترويسة أيضاً', 'chat', 40), true);
    assert.equal(s.calls.surgicalEdit.length, 1);
    assert.match(s.logs(), /رسالة بعد حجب — إصرار/);
});

test('سؤالٌ على مشروعٍ قائم → محادثة', async () => {
    const s = classified('cls', { dir: tempProject() });
    assert.equal(await s.handle('هل الموقع متجاوب مع الجوال؟', 'chat', 40), true);
    assert.equal(s.calls.chat.length, 1);
    assert.equal(s.calls.surgicalEdit.length, 0);
});

test('بلا مشروعٍ قائم → محادثةٌ مهما كان الفعل', async () => {
    const s = classified('cls', { dir: emptyProject() });
    assert.equal(await s.handle('أضف قسم تقييمات', 'chat', 40), true);
    assert.equal(s.calls.chat.length, 1);
    assert.equal(s.calls.surgicalEdit.length, 0);
});
