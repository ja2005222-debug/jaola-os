// 🌐🛡️ ملاحظتا الإنتاج: (1) سجلّ البناء بلغة المستخدم (2) لا فرض قالب بفئة مهلوسة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeLog } from '../agents/logLocalizer.js';
import { matchCloneTemplate } from '../agents/cloneTemplates/index.js';

test('العطل: فئة مهلوسة (travel) وحدها لا تفرض قالب السفر بعد اليوم', () => {
    // نظام مخزون صُنّف خطأً travel — كان يتحول لقالب سفر كاملاً.
    // منذ jaola-erp: طلب نظام المخزون يجد قالبه الصحيح (سيستم) لا السفر —
    // وهذا هو السلوك المرغوب، والحماية من الفئة المهلوسة باقية.
    const r = matchCloneTemplate('نظام إدارة مخزون للمستودعات', { category: 'travel', kind: 'webapp' }, null);
    assert.equal(r?.id, 'jaola-erp', 'نظام المخزون → قالب السيستم لا قالب السفر المهلوس');
    const r2 = matchCloneTemplate('لوحة تحكم داخلية للموظفين', { category: 'travel', kind: 'webapp' }, null);
    assert.ok(r2 === null || r2.id !== 'jaola-travel', 'الفئة المهلوسة لا تفرض السفر أبداً');
    assert.equal(matchCloneTemplate('مدونة شخصية بسيطة', { category: 'ridehailing', kind: 'webapp' }, null), null);
});

test('المطابقة الصحيحة تبقى: كلمة مفتاحية + فئة/كلمة ثانية → القالب المناسب', () => {
    assert.equal(matchCloneTemplate('منصة حجز طيران وفنادق', { category: 'travel', kind: 'webapp' }, null)?.id, 'jaola-travel');
    assert.equal(matchCloneTemplate('متجر إلكتروني لبيع المنتجات', { category: 'ecommerce', kind: 'webapp' }, null)?.id, 'jaola-store');
    assert.equal(matchCloneTemplate('تطبيق توصيل طعام من مطاعم', { category: 'restaurant', kind: 'webapp' }, null)?.id, 'jaola-delivery');
});

test('localizeLog: رسائل السجلّ الشائعة تُترجم والقيم المُقحمة تبقى', () => {
    const m0 = localizeLog('🧩 قالب jaola عامل: متجر (jaola-store) — نبدأ من تطبيق يعمل فعلاً (لا توليد من الصفر)');
    assert.ok(m0.includes('Working jaola template:') && m0.includes('jaola-store'), m0);
    const m1 = localizeLog('🌱 خُصّصت بيانات العيّنة (PRODUCTS) لتطابق طلبك — بلا مساس بالدوال.');
    assert.ok(m1.includes('Seed data customized (PRODUCTS)'), m1);
    assert.ok(m1.includes('functions untouched'), m1);
    const m2 = localizeLog('🔬 التحقّق السلوكي: يعمل (4 ✅ / 0 ⚠️ / 0 ❌ (100%))');
    assert.ok(m2.includes('Behavior check: working'), m2);
    assert.ok(m2.includes('100%'), 'القيم تبقى');
    const m3 = localizeLog('↩️ التخصيص أدخل عطلاً (فقد دوال (init، render)) — استرجاع الكلون العامل النظيف.');
    assert.ok(m3.includes('Customization introduced a defect') && m3.includes('restoring the clean working clone'), m3);
});

test('localizeLog: لا فواصل عليا مفردة في المخرجات (حماية أي سياق)', () => {
    const samples = [
        'وضع البصمة — تخصيص المحتوى ليطابق طلبك...',
        'المشروع يحتاج خادماً — جاري توليد server.js',
        'وجدت المشروع في الذاكرة — الفريق يستأنف من حيث توقف...',
    ];
    for (const s of samples) {
        const out = localizeLog(s);
        assert.ok(!out.includes("'"), `فاصلة عليا في: ${out}`);
        assert.ok(!/[؀-ۿ]/.test(out), `عربية متبقية في: ${out}`);
    }
});
