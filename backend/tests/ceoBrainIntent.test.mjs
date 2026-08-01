// 🧠 CEO Brain — تصنيف نيّة "استئناف" السريع: يجب ألا يبتلع تعليمات تعديل
// محدّدة (عطل إنتاجي حقيقي: "اكمل صفحة الادمن" حوّل مشروعاً قائماً لآخر
// لأنه صُنِّف "استئناف عام" فأُسقطت التعليمة واستُبدلت بهدف عام من الذاكرة،
// فأعاد الذكاء توليد الموقع كاملاً بلا صلة بالطلب الفعلي).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntentFast } from '../agents/ceoBrain.js';

test('استئناف عام بلا هدف محدّد → intent=continue', () => {
    for (const msg of ['اكمل', 'كمل', 'أكمل', 'واصل', 'تابع', 'استمر', 'اكملها', 'كمله',
        'اكمل من فضلك', 'كمل لو سمحت', 'واصل الآن', 'continue', 'resume', 'do it', 'keep going']) {
        const r = classifyIntentFast(msg);
        assert.equal(r?.intent, 'continue', `"${msg}" يجب أن يُصنَّف continue`);
    }
});

test('استئناف بذكر عام للمشروع/الموقع → intent=continue', () => {
    for (const msg of ['كمل الموقع', 'واصل المشروع', 'أكمل البناء', 'continue the project', 'resume work']) {
        const r = classifyIntentFast(msg);
        assert.equal(r?.intent, 'continue', `"${msg}" يجب أن يُصنَّف continue`);
    }
});

test('🛡️ الانحدار الحرج: تعليمة تعديل محدّدة بعد فعل الاستئناف → ليست continue', () => {
    for (const msg of [
        'اكمل صفحة الادمن',
        'أكمل قسم التقييمات',
        'كمل تطوير السلة',
        'واصل تصميم الهيدر',
        'اكمل صفحة تسجيل الدخول من فضلك بسرعة',
        'continue with the pricing page',
        'resume the checkout flow',
    ]) {
        const r = classifyIntentFast(msg);
        assert.notEqual(r?.intent, 'continue', `"${msg}" لا يجب أن يُصنَّف continue (تعليمة محدّدة)`);
    }
});

test('نيّات أخرى غير مُتأثّرة (status/deploy/greeting/github_push)', () => {
    assert.equal(classifyIntentFast('أين وصلنا؟')?.intent, 'status');
    assert.equal(classifyIntentFast('انشر الموقع الآن')?.intent, 'deploy');
    assert.equal(classifyIntentFast('مرحباً')?.intent, 'greeting');
    assert.equal(classifyIntentFast('ادفع للgithub')?.intent, 'github_push');
});
