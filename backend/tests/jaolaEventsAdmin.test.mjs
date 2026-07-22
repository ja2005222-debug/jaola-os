// 🎟️ لوحة أدمن jaola-events (بعد الإكمال): تسجيل دخول أدمن يملأ اللوحات الجديدة
// (المناسبات المُثراة + المنظّمون + أحدث المبيعات) فعلاً في jsdom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { jaolaEvents } from '../agents/cloneTemplates/jaolaEvents.js';

function mountAdmin() {
    const c = jaolaEvents();
    const html = c.files.find(f => f.name === 'index.html').content;
    const app = c.files.find(f => f.name === 'app.js').content;
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
    const { window } = dom;
    const doc = window.document;
    // شغّل app.js ثم أطلق DOMContentLoaded يدوياً (أُضيف المستمع بعد التحميل)
    const s = doc.createElement('script'); s.textContent = app; doc.body.appendChild(s);
    doc.dispatchEvent(new window.Event('DOMContentLoaded'));
    const click = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    // دخول كأدمن
    click(doc.getElementById('authBtn'));
    doc.getElementById('auName').value = 'admin';
    doc.getElementById('auPass').value = '1234';
    click(doc.querySelector('[data-action="submitAuth"]'));
    return { doc, window, click };
}

test('أدمن jaola-events: اللوحات الجديدة تُملأ بعد الدخول', () => {
    const { doc } = mountAdmin();
    // لوحة الأدمن ظاهرة
    assert.equal(doc.getElementById('view-admin').classList.contains('hidden'), false, 'لوحة الأدمن ظاهرة بعد توجيه الدور');
    // إحصاء «الملغاة» الجديد
    assert.ok(doc.getElementById('adminStats').textContent.includes('الملغاة'), 'إحصاء الملغاة أُضيف');
    // المناسبات المُثراة: بيع/متبقّي
    const evHtml = doc.getElementById('adminEvents').innerHTML;
    assert.ok(evHtml.includes('متبقّي') && evHtml.includes('بيع'), 'صفوف المناسبات تعرض البيع/المتبقّي');
    // المنظّمون: لوحة جديدة مملوءة بالمنظّم البذرة
    assert.ok(doc.getElementById('adminOrganizers').innerHTML.includes('شركة الفعّاليات'), 'لوحة المنظّمين مملوءة');
    // أحدث المبيعات: لوحة جديدة موجودة (لا مبيعات بعد → رسالة فارغة سليمة)
    assert.ok(doc.getElementById('adminSales').innerHTML.length > 0, 'لوحة المبيعات تُعرَض');
});

test('أدمن jaola-events: بحث المناسبات يفلتر القائمة حيّاً', () => {
    const { doc, window } = mountAdmin();
    const search = doc.getElementById('adminSearch');
    search.value = 'كأس'; // يطابق «نهائي كأس المدينة»
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    const html = doc.getElementById('adminEvents').innerHTML;
    assert.ok(html.includes('كأس'), 'النتيجة المطابقة ظاهرة');
    assert.ok(!html.includes('ليلة الطرب'), 'غير المطابق مُستبعَد');
});
