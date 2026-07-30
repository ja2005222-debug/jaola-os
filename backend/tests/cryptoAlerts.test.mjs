// 🔔 cryptoAlerts: فهرس قوائم متابعة + حالة إخطار الفرص القوية (بلا إغراق بريدي).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveWatchlistIndex, listWatchlistIndex, markAlerted, shouldAlert } from '../services/cryptoAlerts.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cryptoalerts-'));

test('saveWatchlistIndex + listWatchlistIndex: يُفهرس المشروع ويظهر في القائمة', () => {
    const dir = tmp();
    saveWatchlistIndex(dir, 'nalia', 'crypto1', ['bitcoin', 'ethereum']);
    const list = listWatchlistIndex(dir);
    assert.equal(list.length, 1);
    assert.equal(list[0].user, 'nalia');
    assert.equal(list[0].project, 'crypto1');
    assert.deepEqual(list[0].watchlist, ['bitcoin', 'ethereum']);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('saveWatchlistIndex: يحدّ القائمة بسقف 20 عملة', () => {
    const dir = tmp();
    const big = Array.from({ length: 30 }, (_, i) => 'coin' + i);
    saveWatchlistIndex(dir, 'u', 'p', big);
    const [entry] = listWatchlistIndex(dir);
    assert.equal(entry.watchlist.length, 20);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('saveWatchlistIndex: تحديث قائمة المتابعة لا يفقد سجل التنبيهات السابق', () => {
    const dir = tmp();
    saveWatchlistIndex(dir, 'u', 'p', ['bitcoin']);
    markAlerted(dir, 'u', 'p', 'bitcoin', 'buy');
    saveWatchlistIndex(dir, 'u', 'p', ['bitcoin', 'ethereum']); // تحديث القائمة
    const [entry] = listWatchlistIndex(dir);
    assert.equal(entry.alerted.bitcoin.signal, 'buy', 'سجل التنبيه بقي رغم تحديث القائمة');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('listWatchlistIndex: مجلد فارغ/غير موجود → مصفوفة فارغة بلا رمي خطأ', () => {
    const dir = path.join(os.tmpdir(), 'does-not-exist-' + Date.now());
    assert.deepEqual(listWatchlistIndex(dir), []);
});

test('shouldAlert: لا سجل سابق → يستحق الإخطار', () => {
    assert.equal(shouldAlert(null, 'bitcoin', 'buy'), true);
    assert.equal(shouldAlert({ alerted: {} }, 'bitcoin', 'buy'), true);
});

test('shouldAlert: نفس الإشارة ضمن الفجوة الزمنية → لا يستحق (يمنع الإغراق)', () => {
    const entry = { alerted: { bitcoin: { signal: 'buy', notifiedAt: Date.now() } } };
    assert.equal(shouldAlert(entry, 'bitcoin', 'buy'), false);
});

test('shouldAlert: تغيّرت الإشارة (buy → sell) → يستحق فوراً بلا انتظار الفجوة', () => {
    const entry = { alerted: { bitcoin: { signal: 'buy', notifiedAt: Date.now() } } };
    assert.equal(shouldAlert(entry, 'bitcoin', 'sell'), true);
});

test('shouldAlert: نفس الإشارة لكن بعد انقضاء الفجوة الزمنية → يستحق مجدداً', () => {
    const entry = { alerted: { bitcoin: { signal: 'buy', notifiedAt: Date.now() - 13 * 3600 * 1000 } } };
    assert.equal(shouldAlert(entry, 'bitcoin', 'buy', 12 * 3600 * 1000), true);
});

test('markAlerted: مشروع غير موجود أصلاً (لم يُفهرس بعد) → لا يرمي خطأ، لا يُنشئ ملفاً وهمياً', () => {
    const dir = tmp();
    markAlerted(dir, 'ghost', 'proj', 'bitcoin', 'buy'); // لا throw
    assert.deepEqual(listWatchlistIndex(dir), []);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('markAlerted: يعزل بين المشاريع (لا تسريب حالة إخطار بين مشروعين)', () => {
    const dir = tmp();
    saveWatchlistIndex(dir, 'u', 'p1', ['bitcoin']);
    saveWatchlistIndex(dir, 'u', 'p2', ['bitcoin']);
    markAlerted(dir, 'u', 'p1', 'bitcoin', 'buy');
    const list = listWatchlistIndex(dir);
    const p1 = list.find(e => e.project === 'p1'), p2 = list.find(e => e.project === 'p2');
    assert.ok(p1.alerted.bitcoin);
    assert.ok(!p2.alerted.bitcoin, 'المشروع الآخر لم يتأثر');
    fs.rmSync(dir, { recursive: true, force: true });
});
