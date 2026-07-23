// 🛡️ دروس مدفوعة الثمن: أسئلة عدّلت المواقع (#60)، جمل إخبارية عدّلت (#61)،
// أفعال ناقصة خلقت حلقات (#63، #64). كل حالة هنا من سجل مستخدم حقيقي.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isQuestionMessage, hasActionIntent, isExplicitRebuild, isExplicitNewBuild } from '../agents/textNormalizer.js';

test('isExplicitNewBuild: أمر بناء يصف موضوعاً → هوية جديدة', () => {
    assert.equal(isExplicitNewBuild('ابني متجر عطور فخم مع صور'), true);
    assert.equal(isExplicitNewBuild('أنشئ موقع مطعم'), true);
    assert.equal(isExplicitNewBuild('build a perfume store'), true);
    assert.equal(isExplicitNewBuild('أعد بناء الموقع'), true, 'إعادة البناء هوية جديدة أيضاً');
});

test('isExplicitNewBuild: متابعة/تعديل → ليست هوية جديدة', () => {
    assert.equal(isExplicitNewBuild('اكمل'), false);
    assert.equal(isExplicitNewBuild('اكمل المشروع'), false);
    assert.equal(isExplicitNewBuild('غيّر الألوان إلى أزرق'), false);
    assert.equal(isExplicitNewBuild('أضف صفحة تواصل'), false);
    assert.equal(isExplicitNewBuild('ابنِ'), false, 'أمر بلا وصف ليس هوية جديدة');
});

test('isExplicitRebuild: إعادة بناء صريحة فقط', () => {
    assert.equal(isExplicitRebuild('أعد البناء'), true);
    assert.equal(isExplicitRebuild('من جديد'), true);
    assert.equal(isExplicitRebuild('rebuild from scratch'), true);
    assert.equal(isExplicitRebuild('ابني متجر عطور'), false, 'بناء جديد ليس إعادة بناء');
    assert.equal(isExplicitRebuild('اكمل'), false);
});

test('كاشف الأسئلة: رسائل السجلات الحقيقية تُكشف أسئلةً', () => {
    const questions = [
        'ماذا ينقص المشروع',            // عدّلت الموقع قبل #60
        'ماذا يمكن ان نضيف للمشروع؟',
        'ماهي التعديلات التي طبقتها؟',
        'ما اسم المشروع',
        'هل الموقع جاهز',
        'كيف اغير الالوان',
        'وش رايك بالتصميم',
        'كم صفحة في الموقع',
        'لماذا',
        'what is missing',
        'can you explain the structure',
        'هل نفذت التعديل؟',
    ];
    for (const q of questions) assert.equal(isQuestionMessage(q), true, `يجب أن تُكشف سؤالاً: "${q}"`);
});

test('كاشف الأسئلة: الأوامر لا تُحجب', () => {
    const commands = ['غير الالوان الى ازرق', 'اضف قسم تواصل معنا', 'add a contact section', 'تمام استمر'];
    for (const c of commands) assert.equal(isQuestionMessage(c), false, `ليست سؤالاً: "${c}"`);
});

test('بوابة الفعل: الإخباري والآراء لا تُنفَّذ تعديلاً', () => {
    const statements = [
        'ولكن قائمة الاصدقاء موجودة',   // عدّلت الموقع قبل #61
        'الموقع جميل',
        'هذا مشروع تاكسي',
    ];
    for (const s of statements) assert.equal(hasActionIntent(s), false, `إخباري: "${s}"`);
});

test('بوابة الفعل: الأوامر الحقيقية بكل الصيغ تمر', () => {
    const actions = [
        'غير الالوان الى ازرق', 'اضف قسم تواصل معنا', 'اجعل الخط اكبر',
        'خلي الخلفية داكنة', 'أريد صفحة جديدة للمنتجات', 'عايز زر واتساب',
        'اربط الموقع بقاعدة البيانات', 'ترجم الموقع للانجليزية',
        'نسق حجم الموبايل',              // خلقت حلقة قبل #63
        'اضبط التصميم للجوال',
        'قم بانشاء الصفحتين',            // ذهبت للشات قبل #64 (ب الملتصقة)
        'قم بتغيير الالوان',
        'انشئ صفحة للسائق',
        'نفذ التعديلات على الهيدر',
        // صيغة "عدّل: ..." التي يقترحها المساعد نفسه — النقطتان كانتا تكسران الكشف
        // فتدخل حلقة "أعد إرسال نفس الجملة" اللانهائية (سجل موقع التاكسي)
        'عدّل: أزل خانات تسجيل الدخول من الصفحة الرئيسية',
        'عدّل: زر تسجيل الدخول في الهيدر يؤدي إلى صفحة منفصلة',
        'غيّر: الألوان إلى أزرق داكن',
        // أفعال البناء — كانت تُحجب فيقول "اكتب ابني..." (سجل التوصيل الأخير)
        'أبني تطبيق توصيل طعام من مطاعم مختلفة',
        'ابني موقع تاكسي مكتمل',
        'صمم لي متجر إلكتروني',
        'add a contact form', 'i want a dark theme', 'format the mobile layout',
        // أفعال الاستكمال — "اكتب اكمل" كانت تدخل حلقة لأن "اكمل" صُنّفت محادثة
        'اكمل', 'استكمل', 'واصل', 'تابع', 'أكمل بناء الصفحات', 'continue', 'resume',
        'قم باستكمال بقية الصفحات',
    ];
    for (const a of actions) assert.equal(hasActionIntent(a), true, `فعل: "${a}"`);
});
