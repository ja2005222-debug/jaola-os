// ✈️ ناشر تيليجرام: صيغ صارمة + توكن مشفّر لا يتسرب + إرسال قابل للفحص + حصص
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.JWT_SECRET ||= 'test-only-secret';

const {
    validBotToken, validChatId, readTelegramConfig, saveTelegramConfig,
    deleteTelegramConfig, checkTelegramToken, sendTelegramMessage, formatPost,
} = await import('../services/telegramPublisher.js');
const { socialQuota } = await import('../services/subscriptionService.js');
const { UNLIMITED } = await import('../config/plans.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tg-'));
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw1';

test('الصيغ: توكن BotFather ومعرّف قناة فقط', () => {
    assert.ok(validBotToken(TOKEN));
    assert.ok(!validBotToken('not-a-token') && !validBotToken('123:short'));
    assert.ok(validChatId('@mychannel') && validChatId('-1001234567890'));
    assert.ok(!validChatId('mychannel') && !validChatId('@ab') && !validChatId('حقن'));
});

test('التخزين: التوكن مشفّر على القرص ولا يظهر في الحالة، والحذف يمسح', () => {
    const dir = tmp();
    assert.equal(readTelegramConfig(dir, 'ali').configured, false);
    saveTelegramConfig(dir, 'ali', { botToken: TOKEN, chatId: '@shop', botName: '@shopbot' });
    const st = readTelegramConfig(dir, 'ali');
    assert.ok(st.configured && st.chatId === '@shop' && st.botName === '@shopbot');
    assert.ok(!JSON.stringify(st).includes(TOKEN), 'الحالة بلا توكن');
    const raw = fs.readFileSync(path.join(dir, 'ali.json'), 'utf8');
    assert.ok(!raw.includes(TOKEN), 'الملف على القرص لا يحوي التوكن الخام');
    deleteTelegramConfig(dir, 'ali');
    assert.equal(readTelegramConfig(dir, 'ali').configured, false);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('الإرسال: يفكّ التوكن ويستدعي sendMessage بالقناة والنص، وأخطاء تيليجرام تصل واضحة', async () => {
    const dir = tmp();
    saveTelegramConfig(dir, 'ali', { botToken: TOKEN, chatId: '@shop', botName: '@shopbot' });
    let captured = null;
    const fetchImpl = async (url, opts) => { captured = { url, opts }; return { json: async () => ({ ok: true }) }; };
    const r = await sendTelegramMessage(dir, 'ali', 'عرض اليوم 🎉', { fetchImpl });
    assert.ok(r.ok);
    assert.ok(captured.url.includes(`/bot${TOKEN}/sendMessage`), 'التوكن فُكّ للاستدعاء فقط');
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.chat_id, '@shop');
    assert.equal(body.text, 'عرض اليوم 🎉');

    const denied = await sendTelegramMessage(dir, 'ali', 'x', {
        fetchImpl: async () => ({ json: async () => ({ ok: false, description: 'CHAT_ADMIN_REQUIRED' }) }),
    });
    assert.ok(/CHAT_ADMIN_REQUIRED/.test(denied.error) && /مشرف/.test(denied.error));

    const none = await sendTelegramMessage(dir, 'ghost', 'x', { fetchImpl });
    assert.ok(none.notConfigured);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('getMe يتحقق ويعيد اسم البوت، وformatPost يجمع النص والهاشتاقات', async () => {
    const ok = await checkTelegramToken(TOKEN, { fetchImpl: async () => ({ json: async () => ({ ok: true, result: { username: 'shopbot' } }) }) });
    assert.equal(ok.botName, '@shopbot');
    const bad = await checkTelegramToken('x', { fetchImpl: async () => ({ json: async () => ({ ok: false }) }) });
    assert.ok(/غير صالح/.test(bad.error));
    assert.equal(formatPost({ text: 'مرحبا', hashtags: ['#متجر', '#عرض'] }), 'مرحبا\n\n#متجر #عرض');
    assert.equal(formatPost({ text: 'مرحبا' }), 'مرحبا');
});

test('حصة النشر المباشر بالخطة: مجاني 10، Pro 300، مؤسسات بلا حدود', () => {
    assert.equal(socialQuota(null).monthly, 10);
    assert.equal(socialQuota({ subscription: { plan: 'pro', status: 'active' } }).monthly, 300);
    assert.equal(socialQuota({ subscription: { plan: 'enterprise', status: 'active' } }).monthly, UNLIMITED);
});
