import test from 'node:test';
import assert from 'node:assert/strict';
import { arabicRequestContext } from '../agents/arabicRequestContext.js';
import { routeMessage } from '../agents/router.js';
import { isQuestionMessage } from '../agents/textNormalizer.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
divertConsoleToStderr();

const constraints = [
    'لا تغيّر القالب، أصلح تسجيل الدخول',
    'غير اللون بس',
    'عدّل العنوان فقط',
    'ضيف لوقن بدون تغيير التصميم',
    'صلح الطلبات بس ما تغير الأسعار',
    'متغيرش شكل الصفحة، زود زر الحفظ',
    'حدّث الصفحة بدون حذف البيانات',
    'لا تبدل اسم JAOLA، غير الخط',
];
test('dialectal negative constraint does not disable genuine question protection', () => {
    assert.equal(isQuestionMessage('صلح الطلبات بس ما تغير الأسعار'), false);
    assert.equal(isQuestionMessage('صلح الطلبات بس ما تغير الأسعار؟'), true);
    assert.equal(isQuestionMessage('ما تغير الأسعار؟'), true);
    assert.equal(isQuestionMessage('عدل الصفحة وكيف نضيف الدفع'), true);
});
for (const message of constraints) test(`preserves original constraint: ${message}`, async () => {
    const evidence = arabicRequestContext(message);
    assert.equal(evidence.original, message);
    assert.ok(evidence.constraints.length > 0);
    const route = await routeMessage(message, { hasProject: true }, async () => JSON.stringify({ action: 'edit', instruction: 'تعديل الصفحة', confidence: 95 }));
    assert.ok(route.instruction.includes(message));
});

test('normalization does not overwrite names, mixed code, or user text', () => {
    const text = 'غيّر title في app.jsx إلى «جُولا»';
    const result = arabicRequestContext(text);
    assert.equal(result.original, text);
    assert.ok(result.normalized.includes('app.jsx'));
    assert.ok(result.normalized.includes('جولا'));
});

test('ambiguous target can never be promoted from clarification to execution', async () => {
    const result = await routeMessage('شيل ده', { hasProject: true }, async () => JSON.stringify({
        action: 'edit', instruction: 'احذف الصفحة', confidence: 99,
        requiresClarification: true, question: 'أي عنصر تقصد؟',
    }));
    assert.equal(result.action, 'chat');
    assert.equal(result.instruction, '');
    assert.equal(result.requiresClarification, true);
});

test('Arabic semantic instructions reach the model without altering the original request', async () => {
    const message = 'عايز لوقن للأدمن';
    await routeMessage(message, {}, async messages => {
        assert.ok(messages[0].content.includes('لا تفترض البلد'));
        assert.ok(messages[1].content.includes(message));
        return JSON.stringify({ action: 'chat', confidence: 80 });
    });
});
