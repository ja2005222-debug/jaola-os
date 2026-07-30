// 💰 budgetStats: تلخيص معاملات (دخل/مصروف) وحساب حالة الميزانيات الشهرية.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthKey, lastMonths, summarize, budgetStatus } from '../services/budgetStats.js';

test('monthKey: يستخرج YYYY-MM بتوقيت UTC', () => {
    assert.equal(monthKey('2026-07-15T10:00:00Z'), '2026-07');
    assert.equal(monthKey(new Date(Date.UTC(2026, 0, 1))), '2026-01');
    assert.equal(monthKey('ليس تاريخاً'), null);
});

test('lastMonths: آخر N شهراً تصاعدياً من شهر مرجعي', () => {
    const from = new Date(Date.UTC(2026, 6, 15)); // يوليو 2026
    assert.deepEqual(lastMonths(3, from), ['2026-05', '2026-06', '2026-07']);
    assert.deepEqual(lastMonths(1, from), ['2026-07']);
    // عبور حدّ السنة
    const jan = new Date(Date.UTC(2026, 0, 10));
    assert.deepEqual(lastMonths(2, jan), ['2025-12', '2026-01']);
});

test('summarize: يجمع الدخل والمصروف ويفصّل حسب الفئة تنازلياً، ويتجاهل الأشهر الأخرى', () => {
    const records = [
        { type: 'income', amount: 5000, month: '2026-07' },
        { type: 'expense', amount: 800, category: 'طعام', month: '2026-07' },
        { type: 'expense', amount: 200, category: 'طعام', month: '2026-07' },
        { type: 'expense', amount: 1500, category: 'سكن', month: '2026-07' },
        { type: 'expense', amount: 999, category: 'أخرى شهر ماضٍ', month: '2026-06' }, // يُتجاهل
    ];
    const r = summarize(records, ['2026-07']);
    assert.equal(r.income, 5000);
    assert.equal(r.expense, 2500);
    assert.equal(r.net, 2500);
    assert.deepEqual(r.categories, [{ category: 'سكن', amount: 1500 }, { category: 'طعام', amount: 1000 }]);
});

test('summarize: عدّة أشهر مجتمعة (مثل آخر 3 أشهر)', () => {
    const records = [
        { type: 'income', amount: 100, month: '2026-05' },
        { type: 'income', amount: 200, month: '2026-06' },
        { type: 'expense', amount: 50, category: 'أ', month: '2026-05' },
        { type: 'expense', amount: 30, category: 'أ', month: '2026-06' },
    ];
    const r = summarize(records, ['2026-05', '2026-06', '2026-07']);
    assert.equal(r.income, 300);
    assert.equal(r.expense, 80);
    assert.deepEqual(r.categories, [{ category: 'أ', amount: 80 }]);
});

test('summarize: سجلات ناقصة/فاسدة تُتجاهل بصمت بلا رمي خطأ', () => {
    const records = [null, {}, { type: 'expense', amount: 'ليس رقماً', month: '2026-07' }, { type: 'expense', amount: -5, month: '2026-07' }, { type: 'weird', amount: 10, month: '2026-07' }];
    const r = summarize(records, ['2026-07']);
    assert.equal(r.income, 0);
    assert.equal(r.expense, 0);
    assert.deepEqual(r.categories, []);
});

test('summarize: فئة فارغة/غائبة تُصنَّف "أخرى"', () => {
    const r = summarize([{ type: 'expense', amount: 10, category: '', month: '2026-07' }], ['2026-07']);
    assert.deepEqual(r.categories, [{ category: 'أخرى', amount: 10 }]);
});

test('budgetStatus: يحسب المصروف الفعلي مقابل السقف لكل فئة، ويعلِّم التجاوز', () => {
    const budgets = [{ id: 'b1', category: 'طعام', monthlyLimit: 1000 }, { id: 'b2', category: 'ترفيه', monthlyLimit: 300 }];
    const records = [
        { type: 'expense', amount: 700, category: 'طعام', month: '2026-07' },
        { type: 'expense', amount: 400, category: 'طعام', month: '2026-07' }, // مجموع 1100 > 1000
        { type: 'expense', amount: 100, category: 'ترفيه', month: '2026-07' },
        { type: 'expense', amount: 5000, category: 'طعام', month: '2026-06' }, // شهر آخر، يُتجاهل
    ];
    const st = budgetStatus(budgets, records, '2026-07');
    const food = st.find(s => s.category === 'طعام');
    const fun = st.find(s => s.category === 'ترفيه');
    assert.equal(food.spent, 1100);
    assert.equal(food.over, true);
    assert.equal(fun.spent, 100);
    assert.equal(fun.over, false);
    assert.equal(fun.pct, Math.round((100 / 300) * 1000) / 10);
});

test('budgetStatus: فئة بلا أي مصروف هذا الشهر → spent صفر لا خطأ', () => {
    const st = budgetStatus([{ id: 'b1', category: 'مواصلات', monthlyLimit: 500 }], [], '2026-07');
    assert.equal(st[0].spent, 0);
    assert.equal(st[0].over, false);
    assert.equal(st[0].pct, 0);
});

test('budgetStatus: ميزانيات فاسدة (بلا سقف موجب) تُستبعَد', () => {
    const budgets = [{ id: 'b1', category: 'أ', monthlyLimit: 0 }, { id: 'b2', category: 'ب', monthlyLimit: -5 }, null, {}];
    const st = budgetStatus(budgets, [], '2026-07');
    assert.deepEqual(st, []);
});
