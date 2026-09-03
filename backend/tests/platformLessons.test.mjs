// 📚 ذاكرة دروس المنصة — الحلقة التي تجعل كل مشروع يستفيد من كل ما سبقه.
// العبارات في الاختبارات من سجلات مستخدمين حقيقية.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    recordLesson, recordEditLesson, classifyEditInstruction,
    buildLessonsPromptBlock, topLessons, resetLessons,
    classifyMissionFailure, recordMissionOutcome, recordBehaviorGaps, lessonDirective,
} from '../services/platformLessons.js';

beforeEach(() => resetLessons());

test('تصنيف تعديلات ما بعد البناء — عبارات حقيقية من السجلات', () => {
    assert.equal(classifyEditInstruction('نسق حجم الموبايل'), 'responsive');
    assert.equal(classifyEditInstruction('غير الالوان الى ازرق داكن'), 'colors');
    assert.equal(classifyEditInstruction('أضف قسم آراء العملاء'), 'add_section');
    assert.equal(classifyEditInstruction('ضيف زر واتساب'), 'contact');
    assert.equal(classifyEditInstruction('make it responsive on mobile'), 'responsive');
    assert.equal(classifyEditInstruction('عدل العنوان الرئيسي'), 'text_content');
    // ما لا يُصنَّف لا يُسجَّل — لا ضجيج
    assert.equal(classifyEditInstruction('انشر الموقع'), null);
    assert.equal(classifyEditInstruction(''), null);
});

test('التراكم: العدّ يزيد والعينات محدودة بـ 3', () => {
    for (let i = 0; i < 5; i++) recordEditLesson(`نسق حجم الموبايل ${i}`);
    const top = topLessons(5);
    assert.equal(top.length, 1);
    assert.equal(top[0].key, 'responsive');
    assert.equal(top[0].count, 5);
    assert.equal(top[0].samples.length, 3, 'العينات لا تتضخم');
});

test('لا تعليم قبل النضج: أقل من 3 تكرارات → كتلة فارغة تماماً', () => {
    recordEditLesson('نسق الموبايل');
    recordEditLesson('عدل الموبايل');
    assert.equal(buildLessonsPromptBlock(), '', 'درسان ليسا نمطاً بعد');
});

test('الدرس الناضج يتحول لتوجيه جاهز في كتلة الحقن', () => {
    for (let i = 0; i < 3; i++) recordEditLesson('نسق حجم الموبايل');
    const block = buildLessonsPromptBlock();
    assert.match(block, /دروس متراكمة/);
    assert.match(block, /360px/, 'توجيه الموبايل المكتوب يدوياً');
});

test('دروس المتطلبات الناقصة وفشل الجودة تُصاغ في الكتلة', () => {
    for (let i = 0; i < 3; i++) recordLesson('verifier_missing', 'نموذج حجز');
    for (let i = 0; i < 4; i++) recordLesson('qa_failure', 'DOCTYPE مفقود');
    const block = buildLessonsPromptBlock();
    assert.match(block, /نموذج حجز/);
    assert.match(block, /doctype مفقود/i); // المفاتيح تُوحَّد lowercase للتجميع
});

test('الكتلة محدودة: 6 دروس كحد أقصى مرتبة بالتكرار', () => {
    const cats = ['نسق الموبايل', 'غير الالوان', 'حسن الخط', 'رتب المسافات بمحاذاة', 'اضف قسم جديد', 'ضيف واتساب', 'بدل الصورة'];
    cats.forEach((c, idx) => { for (let i = 0; i < 3 + idx; i++) recordEditLesson(c); });
    const block = buildLessonsPromptBlock();
    const lineCount = (block.match(/^- /gm) || []).length;
    assert.ok(lineCount <= 6, `${lineCount} سطراً — يجب ألا يتضخم الحقن`);
    assert.ok(block.length < 1500, 'الكتلة قصيرة دائماً');
});

// ─── دروس مآلات المهام (بديل «التأمل» و«الفضول» الوهميين في jcr) ────────
test('تصنيف الفشل حتمي بفئات ثابتة — والإيقاف بطلب المستخدم ليس درساً', () => {
    assert.equal(classifyMissionFailure(new Error('خدمة الذكاء الاصطناعي غير متاحة حالياً (رصيد المزوّد منتهٍ)')), 'ai_unavailable');
    const flagged = new Error('anything'); flagged.aiUnavailable = true;
    assert.equal(classifyMissionFailure(flagged), 'ai_unavailable');
    assert.equal(classifyMissionFailure(new Error('لم يتم استخراج أي ملفات من رد النموذج')), 'no_files');
    assert.equal(classifyMissionFailure(new Error('فشل الفريق بعد 7 دورات. آخر الانتقادات: []')), 'debate_exhausted');
    assert.equal(classifyMissionFailure(new Error('Budget exhausted')), 'budget_exhausted');
    assert.equal(classifyMissionFailure(new Error('SyntaxError: Unexpected token }')), 'syntax');
    assert.equal(classifyMissionFailure(new Error('Request timed out')), 'timeout');
    assert.equal(classifyMissionFailure(new Error('شيء غير متوقع')), 'other');
    const aborted = new Error('MISSION_ABORTED'); aborted.aborted = true;
    assert.equal(classifyMissionFailure(aborted), null);
    assert.equal(classifyMissionFailure(null), null);
});

test('recordMissionOutcome: النجاح ليس درساً، والفشل يتراكم بفئته، والإيقاف يُهمَل', () => {
    assert.equal(recordMissionOutcome({ success: true }), null);
    const e = new Error('فشل الفريق بعد 7 دورات.');
    recordMissionOutcome({ success: false, error: e });
    const entry = recordMissionOutcome({ success: false, error: e });
    assert.equal(entry.type, 'mission_failure');
    assert.equal(entry.key, 'debate_exhausted');
    assert.equal(entry.count, 2);
    const aborted = new Error('MISSION_ABORTED'); aborted.aborted = true;
    assert.equal(recordMissionOutcome({ success: false, error: aborted }), null);
    assert.equal(topLessons().length, 1);
});

test('حقن انتقائي: فشل المولّد يصبح توجيهاً بعد النضج، وعطل المزوّد لا يلوّث الـ prompt أبداً', () => {
    const noFiles = new Error('لم يتم استخراج أي ملفات من رد النموذج');
    const ai = new Error('x'); ai.aiUnavailable = true;
    for (let i = 0; i < 3; i++) {
        recordMissionOutcome({ success: false, error: noFiles });
        recordMissionOutcome({ success: false, error: ai });
    }
    const block = buildLessonsPromptBlock();
    assert.match(block, /قابل للاستخراج/, 'توجيه no_files المكتوب يدوياً');
    assert.doesNotMatch(block, /ai_unavailable|رصيد/);
    const aiLesson = topLessons().find(l => l.key === 'ai_unavailable');
    assert.equal(aiLesson.count, 3, 'يبقى مرئياً للمشرف');
    assert.equal(lessonDirective(aiLesson), null, 'لكنه ليس توجيهاً للمولّد');
});

test('ثغرات التحقّق السلوكي المتبقية (fail فقط) تُسجَّل باسم الفحص وتُحقن بعيّنة', () => {
    const verdict = { ran: true, checks: [
        { name: 'undefined_functions', status: 'fail', detail: 'دوال مُشار إليها وغير معرّفة: openModal' },
        { name: 'runtime', status: 'pass' },
        { name: 'data_source', status: 'warn', detail: 'لا دليل على مصدر بيانات' },
    ] };
    for (let i = 0; i < 3; i++) recordBehaviorGaps(verdict);
    assert.equal(topLessons().length, 1, 'fail فقط — لا pass ولا warn');
    assert.match(buildLessonsPromptBlock(), /undefined_functions.*openModal/);
    assert.deepEqual(recordBehaviorGaps({ ran: false, checks: [{ name: 'x', status: 'fail' }] }), [], 'تحقّق لم يُجرَ = لا درس');
    assert.deepEqual(recordBehaviorGaps({ ran: true, skipped: true, checks: [{ name: 'x', status: 'fail' }] }), []);
    assert.deepEqual(recordBehaviorGaps(null), []);
});

test('مفاتيح شاذة لا تنهار ولا تُسجَّل', () => {
    assert.equal(recordLesson('qa_failure', ''), null);
    assert.equal(recordLesson('qa_failure', null), null);
    assert.equal(topLessons().length, 0);
});
