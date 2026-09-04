// 🔐 بوّابة المسارات الإدارية: أول تغطية اختبارية لها على الإطلاق.
//
// `adminOnly` تحرس ٤٠ مساراً منها **كتابة الملفات وحذفها**، وكتابة كود
// الإضافات، وملفات GitHub، وإعداد بوت التداول — أقوى بوابةٍ في الخادم،
// وكانت بلا اختبارٍ واحد. نفس اكتشاف Sprint 2c حرفياً (حرّاس المسار
// الثلاثة كانوا بلا تغطية وهم طبقة الأمان أمام الكتابة).
//
// ⚠️ `ADMIN_USERS` تُقرأ **وقت تحميل الوحدة** في ثابت، فتُضبط البيئة هنا
// قبل الاستيراد الديناميكي. كل ملف اختبار يعمل في عمليةٍ مستقلة
// (`node --test`) فلا يتسرّب هذا الضبط إلى غيره.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.ADMIN_USERS = 'Owner, second_admin ,';
const { adminOnly, isAdminUser } = await import('../middleware/adminOnly.js');

/** ردٌّ وهميّ يلتقط الحالة والجسم بدل شبكةٍ حقيقية. */
function fakeRes() {
    const r = { statusCode: null, body: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
}
const run = (user) => {
    const res = fakeRes();
    let passed = false;
    adminOnly({ user }, res, () => { passed = true; });
    return { res, passed };
};

test('adminOnly: بلا مستخدم مُثبَت → 401 ولا يمرّ', () => {
    for (const nobody of [undefined, null]) {
        const { res, passed } = run(nobody);
        assert.equal(passed, false, 'مرّ بلا مستخدم');
        assert.equal(res.statusCode, 401);
    }
});

// 📌 **403 لا 404 هنا عمداً، خلافاً لعرف خدمة السفر** («لا نؤكد وجود ما
// لا يخصّك»). ذاك عرفُ بوابةٍ تجارية عامة يتصفّحها الغرباء؛ وهذه لوحةٌ
// داخلية، و`frontend/src/pages/AdminPanel.jsx` تعتمد على 403 صراحةً
// (`setDenied`/`setForbidden`) لتعرض رسالةً مفهومة بدل «غير موجود».
// الاختلاف مبرَّرٌ موثَّق لا سهو — والدليل تبعيّة الواجهة لا رأيي.
test('adminOnly: مستخدمٌ مصادَقٌ غير مدرَج → 403 ولا يمرّ', () => {
    const { res, passed } = run({ username: 'regular_user' });
    assert.equal(passed, false, 'غير مشرفٍ دخل لوحة الإدارة');
    assert.equal(res.statusCode, 403);
});

test('adminOnly: المدرَج في ADMIN_USERS يمرّ — والمطابقة بلا حساسية حالة', () => {
    for (const name of ['Owner', 'owner', 'OWNER', 'second_admin']) {
        assert.equal(run({ username: name }).passed, true, name);
    }
});

test('isAdminUser: الضيف ليس مشرفاً، والقيم الفارغة لا ترفع الصلاحية', () => {
    // نفس كائن الضيف الذي يبنيه `verifyTokenOrGuest` في server.js حرفياً
    assert.equal(isAdminUser({ id: 'guest', username: 'guest_user' }), false);
    for (const u of [null, undefined, {}, { username: '' }, { username: 'owner ' }]) {
        assert.equal(isAdminUser(u), false, JSON.stringify(u));
    }
});

// 🔒 حارسٌ بنيويّ: من يضيف المسار الإداريّ رقم ٤١ ناسياً `adminOnly`
// يفتح كتابةَ ملفاتٍ للجميع بلا أن يكسر شيئاً ظاهراً. أُحصي فعلياً
// اليوم: ٤٠/٤٠ محروسة — وهذا يثبّتها.
test('🔒 كل مسار /api/admin/ يحمل adminOnly — بلا استثناء', () => {
    const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
    const routes = src.match(/app\.(?:get|post|put|delete|patch)\('\/api\/admin\/[^\n]*/g) || [];
    assert.ok(routes.length >= 40, `مسارات إدارية موجودة: ${routes.length}`);
    const naked = routes.filter(r => !r.includes('adminOnly'));
    assert.deepEqual(naked, [], 'مسارٌ إداريٌّ بلا حارس');
});

// 🔒 وحارسٌ ثانٍ على بابٍ مغلقٍ بالصدفة: `isAdminUser` يمنح الصلاحية
// لِـ`user.isAdmin === true`، **ولا مسارَ إصدارِ توكنٍ واحد يوقّع هذا
// الحقل اليوم** — الحمولات الأربع كلها قائمة بيضاء `{id, username,
// email, plan}`. فالباب مغلقٌ بحكم الواقع لا بحكم شرطٍ يحرسه: يكفي أن
// يضيف أحدٌ حقلاً من جسم الطلب إلى الحمولة ليصير تصعيدَ صلاحية صامتاً.
// هذا الاختبار يحوّل الصدفة إلى ثابت.
test('🔒 لا مسارَ إصدارِ توكنٍ يوقّع isAdmin — الباب يبقى مغلقاً', () => {
    const files = ['../server.js', '../agents/authAgent.js', '../routes/billing.js'];
    for (const f of files) {
        const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
        for (const call of src.match(/jwt\.sign\([\s\S]{0,400}?\)/g) || []) {
            assert.ok(!/isAdmin/.test(call), `${f}: توكنٌ يحمل isAdmin`);
        }
    }
});
