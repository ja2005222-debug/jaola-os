import test from 'node:test';
import assert from 'node:assert/strict';
import { needsAuth, generateAuth } from '../agents/authAgent.js';

// ═══════════════════════════════════════════════════════
// 🔴 سادسُ موضعٍ من عائلةٍ واحدة: `goal.includes(kw)`.
//    سبقه: «طبي» في «تطبيق»، و`api` في *therapist*، و«مالي» في «جمالي»،
//    و«كاش» في «كاشير»، و«شيل» في «تشيلي». وهنا `auth` في *author*.
//    والثمنُ هنا ملموس: خمسةُ ملفاتِ مصادقةٍ تُكتب في مشروعٍ لم يطلبها
//    (jcr.js:910 يستدعي needsAuth ثم يكتب ما يُعيده generateAuth).
// ═══════════════════════════════════════════════════════

test('لا تُولَّد مصادقةٌ لكلمةٍ تحوي المفتاح حرفاً لا معنى', () => {
    const falsePositives = [
        ['a landing page for an author', 'auth ⊂ author'],
        ['a blog about authentic food', 'auth ⊂ authentic'],
        ['website for an accountant', 'account ⊂ accountant'],
        ['accounting services page', 'account ⊂ accounting'],
        ['a page about administration buildings', 'admin ⊂ administration'],
    ];
    for (const [goal, why] of falsePositives) assert.equal(needsAuth(goal), false, `${why} — ${goal}`);
});

test('الطلبُ الصريحُ للمصادقة ما زال يُلتقط بالعربية والإنجليزية', () => {
    for (const goal of [
        'موقع فيه تسجيل دخول', 'a site with login and signup',
        'لوحة تحكم للمستخدمين', 'user authentication required',
        'عضوية شهرية', 'admin panel', 'a dashboard for members',
        'متجر مع حسابات المستخدمين',
    ]) assert.ok(needsAuth(goal), goal);
});

// إغفالٌ سابقٌ للإصلاح لا ناتجٌ عنه: `includes` كان يفوّتهما أيضاً، لأنّ «ال»
// تتوسّط الكلمتين في أشيع صيغةٍ عربيّة على الإطلاق.
test('أشيعُ صيغتين عربيّتين — «تسجيل الدخول» و«إنشاء حساب» — تُلتقطان', () => {
    for (const goal of ['أريد موقعاً فيه تسجيل الدخول', 'صفحة تسجيل الدخول', 'منصة فيها إنشاء حساب'])
        assert.ok(needsAuth(goal), goal);
});

// التوسعةُ تُقاس بضررها كما بنفعها: 'sign up' لم تُضَفْ لأنّ النشرةَ البريدية
// تُطلب بها، ولا مصادقةَ فيها. هذا الاختبار يوثّق القرار لا العطب.
test('هدفٌ لا يطلب مصادقةً لا يُولّدها', () => {
    for (const goal of [
        'مدونة بسيطة', 'متجر ملابس', 'a portfolio website',
        'مطعم مع قائمة طعام', 'landing page with newsletter sign up',
        '', null, undefined,
    ]) assert.equal(needsAuth(goal), false, String(goal));
});

test('generateAuth يُعيد الملفات الخمسة، ولا يكتب شيئاً بنفسه', async () => {
    const r = await generateAuth('موقع فيه تسجيل دخول', '/tmp/jaola-auth-probe', 'ar');
    assert.equal(r.success, true);
    assert.deepEqual(r.files.map((f) => f.name).sort(), [
        'AUTH_README.md', 'api/auth.js', 'api/middleware/auth.js', 'api/models/User.js', 'auth.html',
    ]);
    // الكتابةُ مسؤوليةُ المستدعي (jcr.js) — فلا أثرَ على القرص من هنا.
    for (const f of r.files) assert.ok(f.content.length > 0, f.name);
});

test('الملخّصُ يُشتقّ من الملفات المكتوبة لا من نصٍّ ثابت', async () => {
    const r = await generateAuth('login', '/tmp/jaola-auth-probe', 'en');
    for (const f of r.files) assert.ok(r.summary.includes(f.name), `الملخّص لا يذكر ${f.name}`);
    assert.ok(r.summary.includes(`${r.files.length} ملف`));
});

test('اللغةُ تُغيّر اتجاهَ صفحة المصادقة ونصوصَها', async () => {
    const ar = await generateAuth('تسجيل دخول', '/tmp/p', 'ar');
    const en = await generateAuth('login', '/tmp/p', 'en');
    const html = (r) => r.files.find((f) => f.name === 'auth.html').content;
    assert.match(html(ar), /dir="rtl"/);
    assert.match(html(en), /dir="ltr"/);
    // لغةٌ بلا نصوصٍ مترجمة تعود إلى الإنجليزية صراحةً — لا إلى العربية.
    const fr = await generateAuth('login', '/tmp/p', 'fr');
    assert.match(html(fr), /dir="ltr"/);
});
