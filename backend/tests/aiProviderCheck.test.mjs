// 🔌 فاحص المزوّدين: مفاتيح مقنّعة لا تتسرب + رصيد DeepSeek + موديل صحيح
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAiProviders } from '../services/aiProviderCheck.js';
import { DEEPSEEK_MODEL } from '../agents/baseAgent.js';

test('الموديل الافتراضي deepseek-chat — القديم deepseek-coder مُلغى', () => {
    assert.equal(DEEPSEEK_MODEL, 'deepseek-chat');
});

test('غير المضبوط يُبلَّغ بوضوح، والمضبوط يُفحص حيّاً بلا تسريب المفتاح', async () => {
    const env = { GROQ_API_KEY: 'gsk_test_key_1234', DEEPSEEK_API_KEY: 'sk-deep-abcd' };
    const fetchImpl = async (url) => {
        if (url.includes('groq')) return { ok: true, status: 200, json: async () => ({ data: [1, 2, 3] }) };
        if (url.includes('deepseek')) return { ok: true, status: 200, json: async () => ({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '9.42' }] }) };
        throw new Error('unexpected ' + url);
    };
    const r = await checkAiProviders({ env, fetchImpl });

    assert.equal(r.gemini.configured, false);
    assert.equal(r.openai.configured, false);

    assert.ok(r.groq.ok && r.groq.detail.includes('3'));
    assert.equal(r.groq.keyTail, '…1234');
    assert.ok(r.deepseek.ok);
    assert.equal(r.deepseek.balance, '9.42 USD', 'الرصيد الفعلي يظهر');

    const dump = JSON.stringify(r);
    assert.ok(!dump.includes('gsk_test_key_1234') && !dump.includes('sk-deep-abcd'), 'لا مفتاح خام في النتيجة');
});

test('المفتاح المرفوض والرصيد المنتهي والشبكة المقطوعة — رسائل مميّزة', async () => {
    const env = { GROQ_API_KEY: 'k'.repeat(20), DEEPSEEK_API_KEY: 'd'.repeat(20), OPENAI_API_KEY: 'o'.repeat(20) };
    const fetchImpl = async (url) => {
        if (url.includes('groq')) return { ok: false, status: 401, json: async () => ({}) };
        if (url.includes('deepseek')) return { ok: true, status: 200, json: async () => ({ is_available: false, balance_infos: [{ currency: 'USD', total_balance: '0.00' }] }) };
        if (url.includes('openai')) throw new Error('ENOTFOUND');
        return { ok: false, status: 500, json: async () => ({}) };
    };
    const r = await checkAiProviders({ env, fetchImpl });
    assert.ok(!r.groq.ok && /مرفوض/.test(r.groq.detail));
    assert.ok(!r.deepseek.ok && /الرصيد غير كافٍ/.test(r.deepseek.detail), 'مفتاح صحيح لكن رصيد صفر');
    assert.ok(!r.openai.ok && /تعذّر الوصول/.test(r.openai.detail));
});
