// 🩺 فحص تحقق Vercel المسبق — يحوّل "Not authorized" الغامضة إلى تشخيص دقيق.
// نضبط التوكن قبل الاستيراد (يُقرأ وقت التحميل) ونحاكي fetch لكل مسار.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL_TOKEN = 'test-token';
delete process.env.VERCEL_TEAM_ID;
const { verifyVercelAuth } = await import('../agents/deployAgent.js');

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

function mockFetch(routes) {
    global.fetch = async (url) => {
        for (const [pattern, resp] of routes) {
            if (url.includes(pattern)) {
                return { ok: resp.ok, status: resp.status || (resp.ok ? 200 : 400), json: async () => resp.body };
            }
        }
        throw new Error(`no mock for ${url}`);
    };
}

test('توكن صالح بلا فريق → جاهز للنشر مع اسم الحساب', async () => {
    delete process.env.VERCEL_TEAM_ID;
    mockFetch([['/v2/user', { ok: true, body: { user: { username: 'nalia' } } }]]);
    const r = await verifyVercelAuth();
    assert.equal(r.ok, true);
    assert.equal(r.account, 'nalia');
    assert.match(r.message, /جاهز للنشر/);
});

test('توكن مرفوض (401) → تشخيص انتهاء/خطأ التوكن لا "Not authorized" غامضة', async () => {
    mockFetch([['/v2/user', { ok: false, status: 401, body: { error: { message: 'Not authorized' } } }]]);
    const r = await verifyVercelAuth();
    assert.equal(r.ok, false);
    assert.equal(r.stage, 'token_invalid');
    assert.match(r.message, /منتهٍ أو خاطئ|Tokens/);
});

test('توكن صالح لكن الفريق مرفوض → يوجّه لإصلاح VERCEL_TEAM_ID تحديداً', async () => {
    process.env.VERCEL_TEAM_ID = 'team_bad';
    // إعادة الاستيراد لالتقاط قيمة الفريق الجديدة
    const mod = await import(`../agents/deployAgent.js?team=${Date.now()}`);
    mockFetch([
        ['/v2/user', { ok: true, body: { user: { username: 'nalia' } } }],
        ['/v2/teams/', { ok: false, status: 403, body: { error: { message: 'forbidden' } } }],
    ]);
    const r = await mod.verifyVercelAuth();
    assert.equal(r.ok, false);
    assert.equal(r.stage, 'team_invalid');
    assert.match(r.message, /VERCEL_TEAM_ID/);
    assert.equal(r.account, 'nalia');
    delete process.env.VERCEL_TEAM_ID;
});

test('عطل الشبكة → لا انهيار، حكم واضح', async () => {
    delete process.env.VERCEL_TEAM_ID;
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
    const r = await verifyVercelAuth();
    assert.equal(r.ok, false);
    assert.equal(r.stage, 'network');
});
