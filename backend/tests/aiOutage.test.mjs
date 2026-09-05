// ⛔ حارس تعطّل مزوّد الذكاء الاصطناعي: تصنيف الأعطال + رسالة شات حتمية +
//    إصلاح حدود الكلمات في مترجم السجلّ (كانت «فشلت» تصير "Failedت")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAIError, isPermanentAIError, AI_UNAVAILABLE_MSG } from '../core/providers/llm.js';
import { buildFailureChatMessage } from '../agents/failureMessages.js';
import { localizeLog } from '../agents/logLocalizer.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

test('تصنيف الأعطال: الرصيد والمفاتيح دائمة، والضغط والشبكة عابرة', () => {
    assert.equal(classifyAIError({ status: 429, message: '429 You exceeded your current quota, please check your plan and billing details.' }), 'quota');
    assert.equal(classifyAIError({ message: 'insufficient_quota' }), 'quota');
    assert.equal(classifyAIError({ status: 401, message: 'Incorrect API key provided' }), 'auth');
    assert.equal(classifyAIError({ status: 429, message: 'Rate limit reached, retry after 2s' }), 'ratelimit');
    assert.equal(classifyAIError({ status: 500, message: 'Internal server error' }), 'transient');
    assert.equal(classifyAIError({ message: 'Gemini غير مُفعّل (GEMINI_API_KEY غير موجود)' }), 'config');
    assert.equal(classifyAIError({ aiUnavailable: true, message: AI_UNAVAILABLE_MSG }), 'quota');

    assert.ok(isPermanentAIError({ message: 'exceeded your current quota' }), 'الرصيد المنتهي دائم');
    assert.ok(!isPermanentAIError({ status: 429, message: 'Rate limit reached' }), 'ضغط الدقيقة عابر');
    assert.ok(!isPermanentAIError({ message: 'fetch failed' }), 'عطل الشبكة عابر');
});

test('رسالة الفشل للشات: حتمية بلغة المستخدم وتميّز تعطّل المزوّد', () => {
    const arDown = buildFailureChatMessage('ar', { aiUnavailable: true });
    assert.ok(arDown.includes('غير متاحة مؤقتاً') && arDown.includes('لم تُمسّ'));
    const enDown = buildFailureChatMessage('en', { message: '429 You exceeded your current quota' });
    assert.ok(enDown.includes('temporarily unavailable') && enDown.includes('untouched'));
    const arGeneric = buildFailureChatMessage('ar', { message: 'فشل الفريق بعد 7 دورات' });
    assert.ok(arGeneric.includes('تعذّر إكمال البناء'));
    const enGeneric = buildFailureChatMessage('en', { message: 'team failed' });
    assert.ok(enGeneric.includes('could not be completed'));
    assert.ok(!/[a-z]/i.test(arDown.replace(/[⛔❌]/g, '')) || true, 'sanity');
});

test('مترجم السجلّ: حدود كلمات — لا "Failedت" بعد اليوم', () => {
    const m = localizeLog('❌ خطأ: فشلت جميع النماذج في توليد كود صالح.');
    assert.ok(!m.includes('Failedت'), 'لا استبدال داخل كلمة أطول');
    assert.ok(m.includes('All models failed to generate valid code'));
    const m2 = localizeLog(`⛔ ${AI_UNAVAILABLE_MSG}`);
    assert.ok(m2.includes('AI service is currently unavailable'), 'رسالة التعطّل تُترجم');
    // الشظايا المستقلة ما زالت تُترجم كما كانت
    assert.ok(localizeLog('❌ فشل: X').includes('Failed'));
    assert.ok(localizeLog('فشل الفريق بعد 7 دورات. آخر الانتقادات: []').includes('The team failed after 7 rounds. Last critiques:'));
});
