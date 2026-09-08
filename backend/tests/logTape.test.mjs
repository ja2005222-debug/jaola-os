// 📼🗂️ «ما فاتك من سجلّ البناء» — الصمتُ عند العودة (2026-09-08).
//
// `Socket.IO` يبثّ **لحظةً**: من أعاد تحميلَ الصفحة أثناء البناء يعود إلى سجلٍّ فارغ
// والمهمّةُ ماضيةٌ على الخادم. فما يراه ليس مهمّةً متوقّفة بل مهمّةً لم يصله خبرُها.
//
// وقِيس عطبٌ ثانٍ بجواره: استعادةُ `chat_history` كانت تسأل Mongo مباشرةً داخل
// `if (isDbConnected …)`. ولهذا المخزن **مصدران**: Mongo وملفٌّ على القرص ينجو من إعادة
// التشغيل. فبلا Mongo كان صاحبُ المشروع لا يرى شيئاً — ومنه **تقريرُ التسليم** الذي
// جُعل باقياً أصلاً لئلّا يضيع. أي أنّ ما حُفظ لأجل ألّا يضيع، كان يضيع في العرض.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { loadRecent, rememberMissionNote, clearConversation } from '../services/conversationStore.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const spyIo = () => { const sent = []; return { sent, io: { to: (room) => ({ emit: (ev, p) => sent.push([room, ev, p]) }) } }; };

// ─── ١. الشريط: ما بُثّ يبقى ────────────────────────────────────────

test('🔴 ما بُثّ في السجلّ يبقى لمن عاد — وإلّا فالمهمّةُ تمضي وخبرُها لا يصل', () => {
    const { io } = spyIo();
    const r = new RoomReporter(io);
    r.liveLog('room-a', '1. UNDERSTAND', 'Analyst', 'أفهم طلبَك');
    r.send('room-a', 'log', { message: 'سطرٌ مباشرٌ لا عبر liveLog' });
    const tape = r.recentLogs('room-a');
    assert.equal(tape.length, 2, 'ضاع ما بُثّ — والعائدُ يرى شاشةً فارغة');
    assert.match(tape[0].message, /أفهم طلبَك/);
    assert.match(tape[1].message, /سطرٌ مباشر/, 'البابُ واحد: `send` تُقيَّد كما تُقيَّد `liveLog`');
});

test('🔴 وأحداثُ غيرِ السجلّ لا تُقيَّد — الشريطُ سجلٌّ لا أرشيفُ كلِّ شيء', () => {
    const { io } = spyIo();
    const r = new RoomReporter(io);
    r.send('room-b', 'chat_reply', { message: 'ردُّ محادثة' });
    r.send('room-b', 'project_metrics', { files: 3 });
    assert.deepEqual(r.recentLogs('room-b'), []);
});

test('🔴 والغرفُ لا تختلط — لكلِّ مشروعٍ شريطُه', () => {
    const { io } = spyIo();
    const r = new RoomReporter(io);
    r.liveLog('room-x', 'L', 'A', 'سطرُ إكس');
    r.liveLog('room-y', 'L', 'A', 'سطرُ واي');
    assert.equal(r.recentLogs('room-x').length, 1);
    assert.match(r.recentLogs('room-y')[0].message, /واي/);
});

test('🔴 والشريطُ محدودٌ — ذاكرةٌ على خادمٍ طويل العمر لا تنمو بلا حدّ', () => {
    const { io } = spyIo();
    const r = new RoomReporter(io);
    for (let i = 0; i < 260; i++) r.liveLog('room-c', 'L', 'A', `سطر ${i}`);
    const tape = r.recentLogs('room-c');
    assert.ok(tape.length <= 200, `الشريطُ ينمو بلا حدّ (${tape.length})`);
    assert.match(tape.at(-1).message, /سطر 259/, 'حُفظ الأقدمُ وضاع الأحدث — والعكسُ هو المطلوب');
    assert.ok(!tape.some(l => /سطر 0\b/.test(l.message)), 'لم يُقتطع الأقدم');
});

test('🔴 وعددُ الغرف محدودٌ أيضاً — بإخراج الأقدم لا بالتوقّف عن التسجيل', () => {
    const { io } = spyIo();
    const r = new RoomReporter(io);
    for (let i = 0; i < 60; i++) r.liveLog(`r${i}`, 'L', 'A', `سطر ${i}`);
    assert.ok(r.roomLogs.size <= 50, `الغرفُ تتراكم (${r.roomLogs.size})`);
    assert.equal(r.recentLogs('r59').length, 1, 'الأحدثُ هو من خرج — والأقدمُ أولى بالخروج');
    assert.deepEqual(r.recentLogs('r0'), [], 'بقي الأقدم');
});

test('🔴 والقارئُ يعود بنسخةٍ لا بمرجع — لا يُعدّل مستهلكٌ شريطَ غيره', () => {
    const { io } = spyIo();
    const r = new RoomReporter(io);
    r.liveLog('room-d', 'L', 'A', 'سطر');
    r.recentLogs('room-d').push({ message: 'دخيل' });
    assert.equal(r.recentLogs('room-d').length, 1);
});

test('🔴 والبثُّ نفسُه لم يتغيّر — التقييدُ إضافةٌ لا اعتراض', () => {
    const { sent, io } = spyIo();
    const r = new RoomReporter(io);
    r.liveLog('room-e', 'L', 'Agent', 'رسالة');
    assert.deepEqual(sent, [['room-e', 'log', { message: '[L] ➔ [Agent]: رسالة' }]]);
});

// ─── ٢. الحوارُ يُقرأ من حيث هو ─────────────────────────────────────

test('🔴 تقريرُ التسليم المحفوظُ على القرص يصل العائدَ ولو غابت Mongo', async () => {
    const key = `__tape_${process.pid}__::p`;
    const [user, project] = key.split('::');
    await clearConversation(key);
    await rememberMissionNote(user, project, '✅ اكتملت المهمّة — تقريرُ التسليم');
    // Mongo غيرُ متّصلةٍ في الاختبارات: هذا هو المسارُ الذي كان يعود فارغاً
    const got = await loadRecent(key, 50);
    assert.equal(got.length, 1, 'ما حُفظ لئلّا يضيع، ضاع في العرض');
    assert.match(got.at(-1).content, /اكتملت المهمّة/);
    await clearConversation(key);
});

test('🔴 والحدُّ يُحترَم — آخرُ N لا أوّلُها', async () => {
    const key = `__tape2_${process.pid}__::p`;
    const [user, project] = key.split('::');
    await clearConversation(key);
    for (let i = 0; i < 8; i++) await rememberMissionNote(user, project, `خبر ${i}`);
    const got = await loadRecent(key, 3);
    assert.equal(got.length, 3);
    assert.match(got.at(-1).content, /خبر 7/, 'أُعيد الأقدمُ بدل الأحدث');
    await clearConversation(key);
});

test('🔴 وقاعدةٌ متّصلةٌ لكنّها فارغة تسقط إلى القرص — لا تُعلن الفراغَ نيابةً عنه', async () => {
    // 🧪 الاختباراتُ تعمل بلا Mongo، فهذا الفرعُ لا يُبلَغ إلّا بحقن: قاعدةٌ تجيب
    //    «لا شيء» بينما القرصُ يحمل تقريرَ التسليم. وهو حالُ ما بعد انقطاعٍ واستئناف.
    const key = `__tape3_${process.pid}__::p`;
    const [user, project] = key.split('::');
    await clearConversation(key);
    await rememberMissionNote(user, project, '✅ تقريرٌ على القرص');
    const got = await loadRecent(key, 50, { fromDb: async () => null });
    assert.equal(got.length, 1, 'أُعلن الفراغُ والقرصُ يحمل الخبر');
    assert.match(got.at(-1).content, /تقريرٌ على القرص/);
    await clearConversation(key);
});

test('🔴 وحوارٌ فارغٌ يعود فارغاً لا يرمي', async () => {
    assert.deepEqual(await loadRecent(`__none_${process.pid}__::p`, 10), []);
});
