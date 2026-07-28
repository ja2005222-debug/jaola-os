// 🩺 سجل أخطاء الإنتاج: حلقة محدودة، الأحدث أولاً، لا يرمي أبداً
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordError, recentErrors, resetErrors } from '../services/errorLog.js';

test('errorLog: يسجّل ويعيد الأحدث أولاً', () => {
    resetErrors();
    recordError({ source: 'a', message: 'أول' });
    recordError({ source: 'b', message: 'ثاني' });
    const recent = recentErrors(10);
    assert.equal(recent.length, 2);
    assert.equal(recent[0].message, 'ثاني', 'الأحدث أولاً');
    assert.equal(recent[1].message, 'أول');
    resetErrors();
});

test('errorLog: يفرض سقف عدد الأخطاء المحفوظة', () => {
    resetErrors();
    for (let i = 0; i < 210; i++) recordError({ source: 's', message: 'e' + i });
    assert.equal(recentErrors(1000).length, 200, 'سقف 200 خطأ');
    assert.equal(recentErrors(1000)[0].message, 'e209', 'الأحدث محفوظ لا يُهمَل');
    resetErrors();
});

test('errorLog: يقصّ الحقول الطويلة ولا يرمي مع مدخلات ناقصة', () => {
    resetErrors();
    const e = recordError({ message: 'x'.repeat(1000), stack: 'y'.repeat(3000) });
    assert.ok(e.message.length <= 500);
    assert.ok(e.stack.length <= 2000);
    assert.doesNotThrow(() => recordError({}));
    assert.equal(recentErrors(10).length, 2);
    resetErrors();
});
