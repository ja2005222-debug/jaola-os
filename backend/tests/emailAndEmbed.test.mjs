// 📧🔗 البريد الفعلي + المقتطف المُستضاف: مُرسل آمن بحصص + حزمة تضمين لأي موقع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mailReady, sendMail, isEmail } from '../services/mailer.js';
import { emailQuota } from '../services/subscriptionService.js';
import { UNLIMITED } from '../config/plans.js';
import { buildEmbedBundle } from '../agents/jaolaBot.js';

test('المُرسل: غير مُفعّل → notConfigured صريح، وبريد مشوّه يُرفض', async () => {
    assert.equal(mailReady({}), false);
    const r = await sendMail({ to: 'a@b.co', subject: 's', text: 't' }, { env: {} });
    assert.ok(r.notConfigured && /RESEND_API_KEY/.test(r.error));
    const bad = await sendMail({ to: 'ليس-بريداً', text: 't' }, { env: { RESEND_API_KEY: 'k' } });
    assert.ok(bad.error && !bad.notConfigured);
    assert.ok(isEmail('user@site.com') && !isEmail('user@@x') && !isEmail(''));
});

test('المُرسل: الحمولة الصحيحة لـ Resend مع reply_to وأسقف الطول', async () => {
    let captured = null;
    const fetchImpl = async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ id: 'em_1' }) }; };
    const r = await sendMail(
        { to: 'client@x.com', subject: 'س'.repeat(300), text: 'مرحباً', replyTo: 'owner@y.com' },
        { env: { RESEND_API_KEY: 'k', MAIL_FROM: 'JAOLA <no-reply@jaola.app>' }, fetchImpl });
    assert.ok(r.ok && r.id === 'em_1');
    const body = JSON.parse(captured.opts.body);
    assert.deepEqual(body.to, ['client@x.com']);
    assert.equal(body.from, 'JAOLA <no-reply@jaola.app>');
    assert.equal(body.reply_to, 'owner@y.com');
    assert.equal(body.subject.length, 150, 'الموضوع مسقوف');
    assert.equal(captured.opts.headers.Authorization, 'Bearer k');
    // فشل الخدمة → خطأ صريح لا انهيار
    const fail = await sendMail({ to: 'a@b.co', text: 't' },
        { env: { RESEND_API_KEY: 'k' }, fetchImpl: async () => ({ ok: false, status: 422 }) });
    assert.ok(/422/.test(fail.error));
});

test('حصة البريد بالخطة: مجاني 20، Pro 500، مؤسسات بلا حدود', () => {
    assert.equal(emailQuota(null).monthly, 20);
    assert.equal(emailQuota({ subscription: { plan: 'pro', status: 'active' } }).monthly, 500);
    assert.equal(emailQuota({ subscription: { plan: 'enterprise', status: 'active' } }).monthly, UNLIMITED);
});

test('حزمة التضمين: ملف واحد يحقن CSS ويحمل الهوية، والذكاء حسب البيان', () => {
    const manifest = {
        brandName: 'متجر النور', emoji: '🛍️', welcome: 'أهلاً!', color: '#16a34a',
        quick: ['التوصيل'], faq: [{ q: 'الشحن', a: 'يومان' }], ai: true,
    };
    const js = buildEmbedBundle(manifest, { apiBase: 'https://jaola.app/api/jaola-bot/chat', token: 'tok.sig' });
    assert.ok(js.includes("document.createElement('style')"), 'CSS يُحقن ذاتياً');
    assert.ok(js.includes('#16a34a'), 'لون العلامة');
    assert.ok(js.includes('متجر النور') && js.includes('أهلاً!'));
    assert.ok(js.includes('https://jaola.app/api/jaola-bot/chat') && js.includes('tok.sig'), 'الذكاء الحيّ موصول');

    const noAi = buildEmbedBundle({ ...manifest, ai: false }, { apiBase: 'https://jaola.app/api/jaola-bot/chat', token: 'tok.sig' });
    assert.ok(!noAi.includes('https://jaola.app/api/jaola-bot/chat'), 'بلا ذكاء → لا نقطة دردشة في الكود');
    assert.ok(noAi.includes('متجر النور'), 'القاعدة الداخلية تعمل دائماً');
});
