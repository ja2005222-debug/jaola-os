// 🌐 لغةُ المستخدم تنجو من إعادة تشغيل الخادم.
//
// 🔴 `getUserLanguage` كانت خريطةَ جلسةٍ في الذاكرة فقط، تعود 'en' للمجهول لا
//    null. فبعد إعادة التشغيل يُخاطَب العربيُّ بالإنجليزيّة حتى يتكلّم مجدّداً،
//    و`|| 'ar'` في ثمانيةَ عشرَ موضعاً من jcr لم يُبلَغ قطّ. الملفُّ الدائم كان
//    يعرف اللغةَ طوال الوقت (`updateLanguage` مع كلِّ رسالة) ولا أحدَ يسأله.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUserLanguage, setUserLanguage, clearUserLanguage, hasUserLanguage } from '../agents/languageDetector.js';
import { updateLanguage, getProfileLanguage } from '../agents/userProfile.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
let n = 0; const user = () => `__langmem_u${++n}_${process.pid}__`;

test('مجهولٌ تماماً → en، ولا لغةَ جلسةٍ مسجَّلة', () => {
    const u = user();
    assert.equal(getUserLanguage(u), 'en');
    assert.equal(hasUserLanguage(u), false);
    assert.equal(getProfileLanguage(u), null, 'القراءةُ لا تُنشئ ملفّاً للمجهول');
});

test('بعد إعادة التشغيل (لا جلسة) يعرف الملفُّ الدائم اللغة', () => {
    const u = user();
    updateLanguage(u, 'ar');
    clearUserLanguage(u);                 // = إعادةُ تشغيل: الجلسةُ تُمحى، الملفُّ يبقى
    assert.equal(getUserLanguage(u), 'ar', 'كان يعود en هنا');
    assert.equal(hasUserLanguage(u), false, 'دلالةُ «ضُبطت في هذه الجلسة» لا تتغيّر — لا بذرَ للجلسة من الملفّ');
});

test('الجلسةُ تسبق الملفّ — تبديلٌ صريحٌ في الجلسة يفوز على ما حُفظ', () => {
    const u = user();
    updateLanguage(u, 'ar');
    setUserLanguage(u, 'en');
    assert.equal(getUserLanguage(u), 'en');
    clearUserLanguage(u);
    assert.equal(getUserLanguage(u), 'ar', 'وبزوال الجلسة يعود الملفّ');
});

test('ملفٌّ بلا لغةٍ محفوظة لا يغيّر شيئاً', () => {
    const u = user();
    updateLanguage(u, null);
    assert.equal(getProfileLanguage(u), null);
    assert.equal(getUserLanguage(u), 'en');
});
