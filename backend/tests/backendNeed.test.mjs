// 🎯 «هل يحتاج المشروع خادماً؟» — سؤالٌ واحد، إجابةٌ واحدة.
// كان يُسأل مرّتين في المهمة الواحدة من قائمتَين مختلفتَين: `_stageBackend`
// (نسخة knowledgeEngine عبر `agents`) تقرّر توليد ملفات الخلفية، و
// `_stageRenderConfig` (نسخة backendAgent) تقرّر إعداد نشر Render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsBackend, BACKEND_KEYWORDS } from '../agents/backendNeed.js';
import { needsBackend as fromKnowledge } from '../agents/knowledgeEngine.js';
import { needsBackend as fromBackendAgent } from '../agents/backendAgent.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// الأهداف التي كانت تتناقض إجاباتها فعلياً قبل التوحيد
const DIVERGED = [
    'أريد موقعاً يستقبل مدفوعات stripe',   // كان: يولّد خلفية، ويُنشر بلا خادم
    'موقع لعرض منتجات فقط',
    'موقع حجوزات عيادة',
    'landing page for a therapist',
    'a page to restore old photos',
];

test('الموضعان يعطيان الإجابة نفسها — لا مصدرَ ثانٍ للحقيقة', () => {
    for (const goal of [...DIVERGED, 'صفحة دفع عبر paypal', 'موقع تعريفي بسيط', '']) {
        assert.equal(fromKnowledge(goal), fromBackendAgent(goal), `تناقض على: ${goal}`);
        assert.equal(fromKnowledge(goal), needsBackend(goal), `انحراف عن المصدر: ${goal}`);
    }
});

test('يُثبت خادماً حين يطلبه الهدف فعلاً — بالعربية والإنجليزية', () => {
    for (const goal of [
        'أريد موقعاً يستقبل مدفوعات stripe', 'صفحة دفع عبر paypal',
        'متجر إلكتروني بسلة وطلبات', 'موقع حجوزات عيادة', 'لوحة تحكم للمستخدمين',
        'موقع لعرض منتجات فقط', 'رفع صور المنتجات',
        'login and dashboard for orders', 'a booking API with a database',
        'signup with google login', 'inventory management',
    ]) assert.equal(needsBackend(goal), true, goal);
});

test('لا يخترع خادماً لصفحةٍ ساكنة — حدود الكلمات في اللاتينية', () => {
    // الاحتواء المجرّد كان يقرأ api داخل therapist، وauth داخل author،
    // وcart داخل cartoon، وstore داخل restore، وcrud داخل crude.
    for (const goal of [
        'landing page for a therapist', 'portfolio for an author',
        'cartoon animation showcase', 'a page to restore old photos',
        'a simple crude oil price chart', 'a rapid prototype gallery',
        'موقع تعريفي بسيط', '', null, undefined,
    ]) assert.equal(needsBackend(goal), false, String(goal));
});

test('العربية تُطابَق احتواءً — لأن السوابق واللواحق تلتصق بالكلمة', () => {
    for (const goal of ['الحساب الشخصي', 'حسابات العملاء', 'للمستخدمين لوحة', 'إدارة المخزون'])
        assert.equal(needsBackend(goal), true, goal);
});

test('الجمع الإنجليزي مقبول، والاختصار لا يبتلع كلمةً أطول', () => {
    assert.equal(needsBackend('manage orders'), true);
    assert.equal(needsBackend('a public api'), true);
    assert.equal(needsBackend('apis for partners'), true);
    // `auth` وحدها لا تُطابق authentication، ولذلك بقيت الكلمتان في القائمة
    assert.equal(needsBackend('user authentication'), true);
    assert.ok(BACKEND_KEYWORDS.includes('auth') && BACKEND_KEYWORDS.includes('authentication'));
});

test('القائمة مجمّدة — لا يعبث بها مستهلك', () => {
    assert.ok(Object.isFrozen(BACKEND_KEYWORDS));
    assert.ok(BACKEND_KEYWORDS.length > 40);
});
