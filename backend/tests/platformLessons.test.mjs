// 📚 ذاكرة دروس المنصة — الحلقة التي تجعل كل مشروع يستفيد من كل ما سبقه.
// العبارات في الاختبارات من سجلات مستخدمين حقيقية.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    recordLesson, recordEditLesson, classifyEditInstruction,
    buildLessonsPromptBlock, topLessons, resetLessons,
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

test('مفاتيح شاذة لا تنهار ولا تُسجَّل', () => {
    assert.equal(recordLesson('qa_failure', ''), null);
    assert.equal(recordLesson('qa_failure', null), null);
    assert.equal(topLessons().length, 0);
});
