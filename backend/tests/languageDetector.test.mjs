// 🌐 لغة الردّ على البناء: لا نردّ بالإنجليزية على طلب عربيّ واضح.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGoalLanguage, detectLanguage } from '../agents/languageDetector.js';

test('resolveGoalLanguage: طلب عربيّ + جلسة en (غير مضبوطة) → ar', () => {
    // الجذر: getUserLanguage تعود en افتراضياً بعد إعادة التشغيل
    assert.equal(resolveGoalLanguage('ابني متجر عطور فخم', 'en'), 'ar');
    assert.equal(resolveGoalLanguage('أبني موقع تعريفي لشركة', undefined), 'ar');
});

test('resolveGoalLanguage: لا يمسّ اللغات المضبوطة الأخرى', () => {
    assert.equal(resolveGoalLanguage('ابني متجر', 'fr'), 'fr', 'لا يغيّر الفرنسية');
    assert.equal(resolveGoalLanguage('ابني متجر', 'ar'), 'ar');
    assert.equal(resolveGoalLanguage('build a store', 'en'), 'en', 'طلب إنجليزي يبقى en');
});

test('detectLanguage: عربيّ/إنجليزي', () => {
    assert.equal(detectLanguage('ابني متجر عطور'), 'ar');
    assert.equal(detectLanguage('build a modern store'), 'en');
});
