// 🧠 الذاكرة طويلة المدى (#52): كامل الحوار محفوظ، نافذة محدودة للنموذج،
// ملخّص متدحرج لا يفقد أول المحادثة، وينجو من إعادة التشغيل.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadForPrompt, recordTurn, clearConversation, CONTEXT_WINDOW } from '../services/conversationStore.js';

const USER = '__stability_test_user__';

test('120 دورة: حفظ كامل + نافذة محدودة + ملخّص يذكر البداية', async () => {
    await clearConversation(USER);
    let calls = 0;
    const summarize = async (prev, older) => {
        calls++;
        const firsts = older.filter(m => m.role === 'user').map(m => m.content).join(';');
        return `${prev ? prev + ' | ' : ''}fold:${firsts}`.slice(0, 800);
    };
    for (let i = 1; i <= 120; i++) await recordTurn(USER, `سؤال ${i}`, `جواب ${i}`, summarize);

    const { window, summary, total } = await loadForPrompt(USER);
    assert.equal(total, 240, 'كل الرسائل محفوظة (لا اقتطاع)');
    assert.equal(window.length, CONTEXT_WINDOW, 'النافذة محدودة');
    assert.ok(calls >= 5, 'الملخّص طُوي عدة مرات');
    assert.ok(summary.includes('سؤال 1'), 'أول المحادثة حاضر في الملخّص — لم يُفقد السياق');
    assert.equal(window.at(-1).content, 'جواب 120', 'أحدث رسالة في النافذة');
    await clearConversation(USER);
});

test('فشل التلخيص لا يُفقد أي رسالة', async () => {
    await clearConversation(USER);
    const failing = async () => { throw new Error('llm down'); };
    for (let i = 1; i <= 40; i++) await recordTurn(USER, `س${i}`, `ج${i}`, failing);
    const { total } = await loadForPrompt(USER);
    assert.equal(total, 80, 'الرسائل كلها محفوظة رغم فشل التلخيص');
    await clearConversation(USER);
});
