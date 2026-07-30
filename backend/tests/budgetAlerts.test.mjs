// 🔔 budgetAlerts: فهرس مشاريع مستشار الميزانية + حالة إخطار التجاوز (بلا إغراق بريدي).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerBudgetProject, listBudgetProjects, markBudgetAlerted, shouldAlertBudget } from '../services/budgetAlerts.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'budgetalerts-'));

test('registerBudgetProject + listBudgetProjects: يُفهرس المشروع ويظهر في القائمة', () => {
    const dir = tmp();
    registerBudgetProject(dir, 'nalia', 'budget1');
    const list = listBudgetProjects(dir);
    assert.equal(list.length, 1);
    assert.equal(list[0].user, 'nalia');
    assert.equal(list[0].project, 'budget1');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('registerBudgetProject: إعادة التسجيل لا يفقد سجل التنبيهات السابق', () => {
    const dir = tmp();
    registerBudgetProject(dir, 'u', 'p');
    markBudgetAlerted(dir, 'u', 'p', 'طعام', '2026-07');
    registerBudgetProject(dir, 'u', 'p'); // إعادة تسجيل (كما يحدث عند كل حفظ ميزانية)
    const [entry] = listBudgetProjects(dir);
    assert.ok(entry.alerted['طعام|2026-07'], 'سجل التنبيه بقي رغم إعادة التسجيل');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('listBudgetProjects: مجلد فارغ/غير موجود → مصفوفة فارغة بلا رمي خطأ', () => {
    const dir = path.join(os.tmpdir(), 'does-not-exist-' + Date.now());
    assert.deepEqual(listBudgetProjects(dir), []);
});

test('shouldAlertBudget: لا سجل سابق → يستحق الإخطار', () => {
    assert.equal(shouldAlertBudget(null, 'طعام', '2026-07'), true);
    assert.equal(shouldAlertBudget({ alerted: {} }, 'طعام', '2026-07'), true);
});

test('shouldAlertBudget: نفس (فئة، شهر) سبق إخطارها → لا تكرار', () => {
    const entry = { alerted: { 'طعام|2026-07': { notifiedAt: Date.now() } } };
    assert.equal(shouldAlertBudget(entry, 'طعام', '2026-07'), false);
});

test('shouldAlertBudget: نفس الفئة لكن شهر جديد → يستحق إخطاراً جديداً', () => {
    const entry = { alerted: { 'طعام|2026-07': { notifiedAt: Date.now() } } };
    assert.equal(shouldAlertBudget(entry, 'طعام', '2026-08'), true);
});

test('shouldAlertBudget: فئة أخرى لنفس الشهر → مستقلة، تستحق إخطارها', () => {
    const entry = { alerted: { 'طعام|2026-07': { notifiedAt: Date.now() } } };
    assert.equal(shouldAlertBudget(entry, 'ترفيه', '2026-07'), true);
});

test('markBudgetAlerted: مشروع غير مسجَّل أصلاً → لا يرمي خطأ، لا يُنشئ ملفاً وهمياً', () => {
    const dir = tmp();
    markBudgetAlerted(dir, 'ghost', 'proj', 'طعام', '2026-07');
    assert.deepEqual(listBudgetProjects(dir), []);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('markBudgetAlerted: يعزل بين المشاريع (لا تسريب حالة إخطار بين مشروعين)', () => {
    const dir = tmp();
    registerBudgetProject(dir, 'u', 'p1');
    registerBudgetProject(dir, 'u', 'p2');
    markBudgetAlerted(dir, 'u', 'p1', 'طعام', '2026-07');
    const list = listBudgetProjects(dir);
    const p1 = list.find(e => e.project === 'p1'), p2 = list.find(e => e.project === 'p2');
    assert.ok(p1.alerted['طعام|2026-07']);
    assert.ok(!p2.alerted['طعام|2026-07'], 'المشروع الآخر لم يتأثر');
    fs.rmSync(dir, { recursive: true, force: true });
});
