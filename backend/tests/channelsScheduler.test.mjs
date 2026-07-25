// 📡📅 قنوات فيسبوك/X + المجدول: تشفير بلا تسرب، توقيع OAuth1، ودورة جدولة كاملة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.JWT_SECRET ||= 'test-only-secret';

const {
    saveFacebookConfig, deleteFacebookConfig, checkFacebookToken, sendFacebookPost,
    saveXConfig, sendXPost, oauth1Header, channelsStatus,
} = await import('../services/socialChannels.js');
const {
    schedulePosts, claimDuePosts, markResult, cancelSchedule, readSchedules,
} = await import('../services/postScheduler.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ch-'));

test('فيسبوك: توكن مشفّر لا يتسرب، والنشر يستدعي /feed بالصفحة الصحيحة', async () => {
    const dir = tmp();
    saveFacebookConfig(dir, 'ali', { pageId: '123456789', pageToken: 'EAAB-secret-page-token-abcdefgh', pageName: 'متجر النور' });
    const st = channelsStatus(dir, 'ali');
    assert.ok(st.facebook.configured && st.facebook.pageName === 'متجر النور');
    assert.ok(!JSON.stringify(st).includes('EAAB-secret'));
    assert.ok(!fs.readFileSync(path.join(dir, 'ali.json'), 'utf8').includes('EAAB-secret'), 'لا توكن خام على القرص');

    let captured = null;
    const r = await sendFacebookPost(dir, 'ali', 'عرض اليوم', {
        fetchImpl: async (url, opts) => { captured = { url, opts }; return { json: async () => ({ id: 'post_1' }) }; },
    });
    assert.ok(r.ok);
    assert.ok(captured.url.includes('/123456789/feed'));
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.message, 'عرض اليوم');
    assert.equal(body.access_token, 'EAAB-secret-page-token-abcdefgh', 'يُفكّ للاستدعاء فقط');

    const bad = await checkFacebookToken('1', 'x', { fetchImpl: async () => ({ json: async () => ({ error: { message: 'bad' } }) }) });
    assert.ok(/غير صالح/.test(bad.error));
    deleteFacebookConfig(dir, 'ali');
    assert.equal(channelsStatus(dir, 'ali').facebook.configured, false);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('X: توقيع OAuth1 حتمي وصحيح البنية، والنشر مسقوف 280', async () => {
    const h = oauth1Header('https://api.twitter.com/2/tweets', 'POST',
        { k: 'ck', s: 'cs', t: 'at', ts: 'as' }, { nonce: 'fixednonce', timestamp: 1700000000 });
    assert.ok(h.startsWith('OAuth '));
    assert.ok(h.includes('oauth_consumer_key="ck"') && h.includes('oauth_token="at"'));
    assert.ok(h.includes('oauth_signature_method="HMAC-SHA1"') && h.includes('oauth_signature="'));
    // حتمي: نفس المدخلات → نفس التوقيع
    const h2 = oauth1Header('https://api.twitter.com/2/tweets', 'POST',
        { k: 'ck', s: 'cs', t: 'at', ts: 'as' }, { nonce: 'fixednonce', timestamp: 1700000000 });
    assert.equal(h, h2);

    const dir = tmp();
    assert.ok(saveXConfig(dir, 'ali', { apiKey: 'short' }).error, 'مفاتيح ناقصة تُرفض');
    saveXConfig(dir, 'ali', { apiKey: 'k'.repeat(20), apiSecret: 's'.repeat(20), accessToken: 't'.repeat(20), accessSecret: 'x'.repeat(20) });
    assert.ok(!fs.readFileSync(path.join(dir, 'ali.json'), 'utf8').includes('k'.repeat(20)), 'المفاتيح مشفّرة');
    let captured = null;
    const r = await sendXPost(dir, 'ali', 'م'.repeat(500), {
        fetchImpl: async (url, opts) => { captured = { url, opts }; return { json: async () => ({ data: { id: 'tw1' } }) }; },
    });
    assert.ok(r.ok);
    assert.equal(JSON.parse(captured.opts.body).text.length, 280, 'مسقوف بحدّ X');
    assert.ok(captured.opts.headers.Authorization.startsWith('OAuth '));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('المجدول: جدولة → التقاط المستحق → تعليم النتيجة، والإلغاء للمعلّق فقط', () => {
    const dir = tmp();
    const future = Date.now() + 3600000;
    assert.ok(schedulePosts(dir, 'ali', [{ text: 'غداً', at: future, channels: ['telegram'] }]).ok);
    assert.ok(schedulePosts(dir, 'ali', [{ text: '', at: future, channels: ['telegram'] }]).error, 'نص فارغ يُرفض');
    assert.ok(schedulePosts(dir, 'ali', [{ text: 'بلا قناة', at: future, channels: ['bad'] }]).error, 'قناة مجهولة تُرفض');

    // مستحق الآن
    schedulePosts(dir, 'ali', [{ text: 'الآن', at: Date.now(), channels: ['telegram', 'facebook'] }]);
    const due = claimDuePosts(dir, 'ali');
    assert.equal(due.length, 1);
    assert.equal(due[0].text, 'الآن');
    assert.equal(claimDuePosts(dir, 'ali').length, 0, 'لا يُلتقط مرتين (sending)');

    markResult(dir, 'ali', due[0].id, { ok: true });
    const list = readSchedules(dir, 'ali');
    assert.equal(list.find(p => p.id === due[0].id).status, 'sent');

    const pending = list.find(p => p.status === 'pending');
    assert.ok(cancelSchedule(dir, 'ali', pending.id).ok);
    assert.ok(cancelSchedule(dir, 'ali', due[0].id).error, 'المنفَّذ لا يُلغى');
    fs.rmSync(dir, { recursive: true, force: true });
});
