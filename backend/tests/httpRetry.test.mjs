// 🔁 httpRetry: fetch+json مع محاولة ثانية تلقائية عند تعطّل عابر أو 429.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJsonWithRetry } from '../services/httpRetry.js';

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

test('نجاح من أول محاولة → لا محاولة ثانية', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
    const r = await fetchJsonWithRetry('http://x');
    assert.equal(calls, 1);
    assert.deepEqual(r, { ok: true });
});

test('تعطّل شبكي عابر (الأولى تفشل، الثانية تنجح) → محاولة ثانية تلقائية تنقذ الطلب', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; if (calls === 1) throw new Error('ETIMEDOUT'); return { ok: true, status: 200, json: async () => ({ v: 1 }) }; };
    const r = await fetchJsonWithRetry('http://x');
    assert.equal(calls, 2);
    assert.deepEqual(r, { v: 1 });
});

test('429 (حدّ معدّل) بلا كاش سابق → محاولة ثانية تلقائية تنجح', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; if (calls === 1) return { ok: false, status: 429, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ v: 2 }) }; };
    const r = await fetchJsonWithRetry('http://x');
    assert.equal(calls, 2);
    assert.deepEqual(r, { v: 2 });
});

test('فشل مستمر (محاولتان فاشلتان) → يرمي الخطأ الأخير بعد محاولتين بالضبط', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; throw new Error('ECONNREFUSED'); };
    await assert.rejects(() => fetchJsonWithRetry('http://x'), /ECONNREFUSED/);
    assert.equal(calls, 2);
});

test('ردّ HTTP غير 200 وغير 429 (مثل 500) → يرمي بعد محاولتين', async () => {
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: false, status: 500, json: async () => ({}) }; };
    await assert.rejects(() => fetchJsonWithRetry('http://x'), /http 500/);
    assert.equal(calls, 2);
});
