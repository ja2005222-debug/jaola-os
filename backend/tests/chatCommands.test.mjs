// 🎛️ أوامر الشات الحتمية (#62، #63، #64) — أخطر أنماط النظام (حذف مشروع،
// تأكيدات، تنفيذ) كانت مدفونة في jcr بلا اختبارات. الآن نقية ومغطاة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDeleteCommand, isBareYes, isBareExecute } from '../agents/chatCommands.js';

test('حذف: النية العامة والمسمّاة والتأكيد — من السجلات الحقيقية', () => {
    // نية عامة → target = المشروع النشط
    assert.deepEqual(matchDeleteCommand('امسح المشروع', 'naya-taxi'), { kind: 'intent', target: 'naya-taxi' });
    assert.equal(matchDeleteCommand('احذف الموقع كله', 'p1').kind, 'intent');
    assert.equal(matchDeleteCommand('delete the project', 'p1').kind, 'intent');
    // مسمّاة → target = الاسم المذكور (كانت تسقط في تعديل المحتوى!)
    assert.deepEqual(matchDeleteCommand('احذف المشروع newline', 'other'), { kind: 'intent', target: 'newline' });
    // تأكيد
    assert.deepEqual(matchDeleteCommand('احذف نهائياً naya-taxi'), { kind: 'confirm', target: 'naya-taxi' });
    assert.deepEqual(matchDeleteCommand('نعم احذف نهائيا hotel-control'), { kind: 'confirm', target: 'hotel-control' });
    assert.deepEqual(matchDeleteCommand('delete permanently my-shop'), { kind: 'confirm', target: 'my-shop' });
});

test('حذف: تعديلات المحتوى المشروعة لا تُلتقط', () => {
    for (const m of ['امسح القسم الاخير', 'احذف الصورة من الهيدر', 'شيل زر الواتساب', 'remove the footer', 'احذف newline']) {
        assert.equal(matchDeleteCommand(m, 'p1'), null, `"${m}" يجب أن تبقى تعديل محتوى`);
    }
});

test('التأكيد المجرّد: يُلتقط وحده فقط', () => {
    for (const m of ['نعم', 'تمام', 'ok', 'اه', 'يلا!']) assert.equal(isBareYes(m), true, m);
    for (const m of ['نعم، لكن غيّر الألوان', 'نعم ابنه الآن', 'لا', 'اكمل']) assert.equal(isBareYes(m), false, m);
});

test('التنفيذ المجرّد: "نفذهما/طبقها/do it" — من سجل صداع', () => {
    for (const m of ['تمام نفذهما', 'نفذ', 'طبقها', 'do it', 'go ahead']) assert.equal(isBareExecute(m), true, m);
    // مع محتوى → ليست مجرّدة (تنفَّذ بمحتواها عبر مسار التعديل)
    for (const m of ['نفذ التعديلات على الهيدر', 'هل نفذت التعديل؟', 'ماذا ستنفذ']) assert.equal(isBareExecute(m), false, m);
});
