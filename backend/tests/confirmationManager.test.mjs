// 🛂 بوّابة الموافقة: أخطر ما فيها أن تقرأ موافقةً لم تُقَل.
// أول تغطية اختبارية لبوّابة تبدأ بناءً كاملاً (كانت بلا اختبار واحد).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConsent, isConfirmed, isBareConsent, CONSENT } from '../core/policy/ConfirmationManager.js';
import { isConfirmation } from '../agents/clarifierAgent.js';
import { isBareYes } from '../agents/chatCommands.js';

test('🐛 الحالات الست التي كانت تُقرأ موافقةً وتبدأ بناءً كاملاً', () => {
    // كلها تبدأ بحروف كلمةٍ مُثبِتة، ولا واحدة منها موافقة.
    // (ناتج تشغيل فعلي على النسخة القديمة قبل الإصلاح)
    for (const msg of ['نعمل إيه؟', 'اهلا', 'صحيح؟', 'goodbye', 'okay but wait', 'اكملت المشروع أمس']) {
        assert.equal(readConsent(msg), CONSENT.UNKNOWN, msg);
        assert.equal(isConfirmation(msg), false, `عبر المستدعي الحيّ: ${msg}`);
    }
});

test('الموافقات الحقيقية تبقى مقبولة — الإصلاح في الآلية لا في المفردات', () => {
    for (const msg of ['نعم', 'ابدأ', 'تمام', 'ابدأ البناء الآن', 'yes go ahead', 'ok', 'نفذ', 'يلا', 'اوكي']) {
        assert.equal(readConsent(msg), CONSENT.CONFIRM, msg);
        assert.equal(isConfirmation(msg), true, `عبر المستدعي الحيّ: ${msg}`);
    }
});

test('الرفض يسبق الإثبات: «لا تبدأ» تبدأ بـ«لا» لا بـ«ابدأ»', () => {
    for (const msg of ['لا', 'لا تبدأ', 'stop', 'no', 'الغِ', 'توقف', 'cancel', 'لا نعم']) {
        assert.equal(readConsent(msg), CONSENT.DECLINE, msg);
    }
});

test('التردّد ليس موافقة ولا رفضاً — «نعم لكن انتظر» لا تُنفَّذ ولا تُلغى', () => {
    for (const msg of ['okay but wait', 'نعم بس لحظة', 'تمام لكن', 'ok maybe', 'yes not sure']) {
        assert.equal(readConsent(msg), CONSENT.UNKNOWN, msg);
    }
});

test('حدود Unicode لا ASCII: `\\b` لا تعمل في العربية إطلاقاً', () => {
    // «اهلا» تبدأ بحرفَي «اه»، و«goodbye» بحرفَي «go» — الحدّ وحده يفرّقها
    assert.equal(readConsent('اه'), CONSENT.CONFIRM, 'المجرّدة موافقة');
    assert.equal(readConsent('اهلا'), CONSENT.UNKNOWN, 'وليست بادئتها');
    assert.equal(readConsent('go'), CONSENT.CONFIRM);
    assert.equal(readConsent('goodbye'), CONSENT.UNKNOWN);
    // إثباتٌ مباشر أن الآلية القديمة كانت متعذّرة: \b لا تطابق حتى المجرّدة
    assert.equal(/\bاه\b/.test('اه'), false, 'سبب لجوء الكاتب الأصلي للبادئة');
});

test('الفقرة ليست «نعم»: من يوافق يوجز', () => {
    assert.equal(readConsent('ابدأ لكن غيّر اللون إلى الأزرق وأضف صفحة تواصل'), CONSENT.UNKNOWN);
    assert.equal(readConsent('نعم نعم نعم نعم نعم نعم نعم'), CONSENT.UNKNOWN, 'سبع كلمات');
});

test('المدخلات الفارغة والتالفة: `unknown` لا `confirm`', () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
        assert.equal(readConsent(bad), CONSENT.UNKNOWN, JSON.stringify(String(bad)));
    }
    assert.equal(isConfirmed(null), false);
});

test('isBareYes: سلوكه مطابق لما قبل التوحيد بحرفه', () => {
    for (const yes of ['نعم', 'تمام', 'ok', 'yes', 'يلا', 'go', 'نعم.', ' ok ']) {
        assert.equal(isBareConsent(yes), true, yes);
        assert.equal(isBareYes(yes), true, `عبر المستدعي الحيّ: ${yes}`);
    }
    // «ليست إلا نعم» — فالطلب الإضافي يُخرجها (سؤالٌ مختلف عن readConsent)
    for (const no of ['نعم ابدأ', 'ابدأ', 'goodbye', 'اهلا', '']) {
        assert.equal(isBareConsent(no), false, no);
        assert.equal(isBareYes(no), false, `عبر المستدعي الحيّ: ${no}`);
    }
});
