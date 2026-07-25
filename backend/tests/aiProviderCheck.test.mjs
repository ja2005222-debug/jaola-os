// 🔌 فاحص المزوّدين: مفاتيح مقنّعة لا تتسرب + رصيد DeepSeek + موديل صحيح
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAiProviders } from '../services/aiProviderCheck.js';
import { DEEPSEEK_MODEL } from '../agents/baseAgent.js';

test('الموديل الافتراضي deepseek-v4-pro — الأسماء الأقدم (chat/coder) مُلغاة', () => {
    assert.equal(DEEPSEEK_MODEL, 'deepseek-v4-pro');
});

test('غير المضبوط يُبلَّغ بوضوح، والمضبوط يُفحص حيّاً بلا تسريب المفتاح', async () => {
    const env = { GROQ_API_KEY: 'gsk_test_key_1234', DEEPSEEK_API_KEY: 'sk-deep-abcd' };
    const fetchImpl = async (url) => {
        if (url.includes('groq')) return { ok: true, status: 200, json: async () => ({ data: [1, 2, 3] }) };
        if (url.includes('/user/balance')) return { ok: true, status: 200, json: async () => ({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '9.42' }] }) };
        if (url.includes('deepseek.com/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'deepseek-v4-pro' }, { id: 'deepseek-v4-flash' }] }) };
        throw new Error('unexpected ' + url);
    };
    const r = await checkAiProviders({ env, fetchImpl });

    assert.equal(r.gemini.configured, false);
    assert.equal(r.openai.configured, false);

    assert.ok(r.groq.ok && r.groq.detail.includes('3'));
    assert.equal(r.groq.keyTail, '…1234');
    assert.ok(r.deepseek.ok);
    assert.equal(r.deepseek.balance, '9.42 USD', 'الرصيد الفعلي يظهر');
    assert.ok(r.deepseek.detail.includes('deepseek-v4-pro'), 'الموديل المضبوط يظهر');

    const dump = JSON.stringify(r);
    assert.ok(!dump.includes('gsk_test_key_1234') && !dump.includes('sk-deep-abcd'), 'لا مفتاح خام في النتيجة');
});

test('المفتاح المرفوض والرصيد المنتهي والشبكة المقطوعة — رسائل مميّزة', async () => {
    const env = { GROQ_API_KEY: 'k'.repeat(20), DEEPSEEK_API_KEY: 'd'.repeat(20), OPENAI_API_KEY: 'o'.repeat(20) };
    const fetchImpl = async (url) => {
        if (url.includes('groq')) return { ok: false, status: 401, json: async () => ({}) };
        if (url.includes('/user/balance')) return { ok: true, status: 200, json: async () => ({ is_available: false, balance_infos: [{ currency: 'USD', total_balance: '0.00' }] }) };
        if (url.includes('deepseek.com/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'deepseek-v4-pro' }] }) };
        if (url.includes('openai')) throw new Error('ENOTFOUND');
        return { ok: false, status: 500, json: async () => ({}) };
    };
    const r = await checkAiProviders({ env, fetchImpl });
    assert.ok(!r.groq.ok && /مرفوض/.test(r.groq.detail));
    assert.ok(!r.deepseek.ok && /الرصيد غير كافٍ/.test(r.deepseek.detail), 'مفتاح صحيح لكن رصيد صفر');
    assert.ok(!r.openai.ok && /تعذّر الوصول/.test(r.openai.detail));
});

test('فحص Gemini يكشف نماذج الصور المتاحة على المفتاح — أو يحذّر لو لا شيء من سلّمنا', async () => {
    const env = { GEMINI_API_KEY: 'AIzaTest1234' };
    const listOf = (names) => ({ ok: true, status: 200, json: async () => ({ models: names.map(n => ({ name: `models/${n}` })) }) });

    const withImage = await checkAiProviders({
        env,
        fetchImpl: async (url) => url.includes('generativelanguage') ? listOf(['gemini-2.5-pro', 'gemini-2.5-flash-image']) : { ok: false, status: 500, json: async () => ({}) },
    });
    assert.ok(withImage.gemini.ok);
    assert.deepEqual(withImage.gemini.imageModels, ['gemini-2.5-flash-image']);
    assert.ok(withImage.gemini.detail.includes('نماذج الصور المتاحة: gemini-2.5-flash-image'));

    const noImage = await checkAiProviders({
        env,
        fetchImpl: async (url) => url.includes('generativelanguage') ? listOf(['gemini-2.5-pro']) : { ok: false, status: 500, json: async () => ({}) },
    });
    assert.deepEqual(noImage.gemini.imageModels, []);
    assert.ok(/لا يظهر أي نموذج صور/.test(noImage.gemini.detail), 'تحذير واضح حين لا نموذج صور على المفتاح');
});

test('موديل DeepSeek ملغى يُكشف فوراً باقتراح المدعوم، وخطأ الموديل يصنَّف دائماً', async () => {
    const env = { DEEPSEEK_API_KEY: 'd'.repeat(20), DEEPSEEK_MODEL_TEST: '1' };
    const fetchImpl = async (url) => {
        if (url.includes('/user/balance')) return { ok: true, status: 200, json: async () => ({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '5.00' }] }) };
        if (url.includes('deepseek.com/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'deepseek-v9-ultra' }] }) };
        return { ok: false, status: 500, json: async () => ({}) };
    };
    const r = await checkAiProviders({ env, fetchImpl });
    assert.equal(r.deepseek.ok, false, 'الموديل المضبوط غير موجود في قائمتهم');
    assert.ok(/غير مدعوم/.test(r.deepseek.detail) && r.deepseek.detail.includes('deepseek-v9-ultra'), 'يقترح المدعوم فعلاً');

    const { classifyAIError, isPermanentAIError } = await import('../agents/baseAgent.js');
    const modelErr = { status: 400, message: 'The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you provided deepseek-chat' };
    assert.equal(classifyAIError(modelErr), 'config');
    assert.ok(isPermanentAIError(modelErr), 'موديل ملغى = عطل دائم لا يُهدر عليه دورات');
    assert.equal(classifyAIError({ message: 'Request had invalid authentication credentials.' }), 'auth', 'خطأ Gemini 401 يصنَّف دائماً');
});
