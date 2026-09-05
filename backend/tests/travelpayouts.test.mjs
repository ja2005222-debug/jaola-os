/**
 * ✈️ العمولةُ هي الغرض، وغيابُها كان صامتاً — Sprint 3m
 *
 * الوحدةُ تولّد وسيطَ بحث طيرانٍ يُكتب في مشروع المستخدم، وغرضُها المعلَن في
 * الـREADME أنّ «روابط bookingUrl تحمل marker الخاص بك — منها تُحتسب عمولتك».
 * وكانت:
 *   • بلا `TRAVELPAYOUTS_MARKER` تعمل بالكامل و`success: true` بلا حرفِ تحذير —
 *     فكلُّ حجزٍ على موقع المستخدم بلا عمولة، ولا شيءَ يُنبئه.
 *   • نتيجةٌ بلا `link` تُنتج `https://www.aviasales.com` وحدَها: زرُّ حجزٍ يقود
 *     إلى الصفحة الرئيسية، بلا وجهةٍ وبلا إحالة.
 *   • `env` المُصرَّحة لا يقرؤها أحد.
 *
 * يُشغَّل الوسيطُ المولَّد نفسُه (يُكتب على القرص ويُستورَد) بـ`fetch` مُستبدَل.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateTravelpayoutsModule, needsTravelpayouts } from '../agents/integrations/travelpayouts.js';
import { quietConsole } from './helpers/quietConsole.mjs';

let dir, proxyPath, quiet;
const realFetch = globalThis.fetch;
const savedEnv = ['TRAVELPAYOUTS_TOKEN', 'TRAVELPAYOUTS_MARKER'].map((k) => [k, process.env[k]]);

before(() => {
    quiet = quietConsole();            // سجلُّ الوسيط عربيٌّ — يكسر قناة التقرير
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-test-'));
    proxyPath = path.join(dir, 'search.mjs');
    const mod = generateTravelpayoutsModule();
    fs.writeFileSync(proxyPath, mod.files.find((f) => f.name.endsWith('search.js')).content);
});

after(() => {
    quiet?.restore();
    globalThis.fetch = realFetch;
    for (const [k, v] of savedEnv) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true });
});

const FLIGHTS = [
    { origin: 'RUH', destination: 'DXB', price: 420, airline: 'EK', link: '/search/RUH0101DXB1' },
    { origin: 'RUH', destination: 'DXB', price: 380, airline: 'FZ' },                 // بلا link
    { origin: 'RUH', destination: 'DXB', price: 500, airline: 'SV', link: '/x?a=1' }, // فيه ? سلفاً
];

// ملاحظةٌ للقارئ: لا تُمرَّر `token: undefined` لنزعِه — القيمةُ المعدومة
// تُفعّل القيمةَ الافتراضية للمعامل فيعود التوكن. `noToken` صريحةٌ لا تلتبس.
async function call({ token = 't', noToken = false, marker, query = { origin: 'ruh', destination: 'dxb' }, api = { success: true, data: FLIGHTS }, fetchImpl } = {}) {
    if (noToken) delete process.env.TRAVELPAYOUTS_TOKEN; else process.env.TRAVELPAYOUTS_TOKEN = token;
    if (marker === undefined) delete process.env.TRAVELPAYOUTS_MARKER; else process.env.TRAVELPAYOUTS_MARKER = marker;
    let calledUrl = null;
    globalThis.fetch = fetchImpl || (async (u) => { calledUrl = u; return { json: async () => api }; });
    const { default: handler } = await import(`${proxyPath}?v=${Math.random()}`);
    let out;
    await handler({ query }, {
        status(c) { this._c = c; return this; },
        json(o) { out = { code: this._c || 200, body: o }; },
    });
    return { ...out, calledUrl };
}

test('🔴 بلا marker: البحثُ يعمل والعمولةُ صفر — فيُقال ذلك لا يُسكَت', async () => {
    const r = await call({ marker: undefined });
    assert.equal(r.code, 200, 'غيابُ الإحالة لا يكسر البحث');
    assert.equal(r.body.markerConfigured, false, 'الردُّ لا يُعلن أنّ الإحالة غائبة');
    assert.ok(!r.body.results.some((f) => String(f.bookingUrl).includes('marker=')));
    assert.ok(quiet.lines.some((l) => l.includes('TRAVELPAYOUTS_MARKER')), 'لا تحذيرَ على الخادم');
});

test('بالـmarker: يُلحَق بالرابط ويُحترم وجودُ ? سلفاً', async () => {
    const r = await call({ marker: '12345' });
    assert.equal(r.body.markerConfigured, true);
    assert.equal(r.body.results[0].bookingUrl, 'https://www.aviasales.com/search/RUH0101DXB1?marker=12345');
    assert.equal(r.body.results[2].bookingUrl, 'https://www.aviasales.com/x?a=1&marker=12345');
});

test('🔴 نتيجةٌ بلا link لا رابطَ حجزٍ لها — لا رابطُ صفحةٍ رئيسية', async () => {
    const r = await call({ marker: '12345' });
    assert.equal(r.body.results[1].bookingUrl, null, 'رابطٌ مُلفَّقٌ يقود إلى لا مكان');
    assert.equal(r.body.count, 3);
    assert.equal(r.body.bookableCount, 2, 'العددُ القابل للحجز يُقال صراحةً');
});

test('التوكن مطلوب، ولا يُنادى المزوّدُ بدونه', async () => {
    let called = false;
    const r = await call({ noToken: true, fetchImpl: async () => { called = true; return { json: async () => ({}) }; } });
    assert.equal(r.code, 500);
    assert.match(r.body.error, /TRAVELPAYOUTS_TOKEN/);
    assert.equal(called, false);
});

test('origin/destination مطلوبان ويُطبَّعان إلى IATA', async () => {
    const bad = await call({ query: { origin: 'ruh' } });
    assert.equal(bad.code, 400);

    const ok = await call({ marker: 'm', query: { origin: 'ruhx', destination: 'dxb', currency: 'sarx' } });
    const u = new URL(ok.calledUrl);
    assert.equal(u.searchParams.get('origin'), 'RUH', 'يُقصّ إلى ثلاثة محارف ويُرفع');
    assert.equal(u.searchParams.get('destination'), 'DXB');
    assert.equal(u.searchParams.get('currency'), 'sar');
});

test('فشلُ المزوّد يُنقل ٥٠٢ لا يُقدَّم نجاحاً', async () => {
    const failed = await call({ api: { success: false } });
    assert.equal(failed.code, 502);

    const threw = await call({ fetchImpl: async () => { throw new Error('ECONNRESET'); } });
    assert.equal(threw.code, 502);
    assert.match(threw.body.error, /ECONNRESET/);
});

test('نتائجُ فارغةٌ ليست فشلاً', async () => {
    const r = await call({ marker: 'm', api: { success: true, data: [] } });
    assert.equal(r.code, 200);
    assert.deepEqual({ count: r.body.count, bookableCount: r.body.bookableCount }, { count: 0, bookableCount: 0 });
});

test('التوكن لا يظهر في أيّ ملفٍّ يصل المتصفّح', async () => {
    const mod = generateTravelpayoutsModule();
    const widget = mod.files.find((f) => f.name === 'flights-widget.js').content;
    assert.ok(!/TRAVELPAYOUTS_TOKEN|process\.env/.test(widget), 'سرٌّ في ملفِّ الواجهة');
    assert.match(widget, /\/api\/flights\/search/);
    assert.ok(/f\.bookingUrl \?/.test(widget), 'مثالُ الواجهة يرسم زرَّ حجزٍ لرابطٍ معدوم');
});

test('🔴 env المُصرَّحة تصل المستدعي', async () => {
    const mod = generateTravelpayoutsModule();
    assert.deepEqual(mod.env, ['TRAVELPAYOUTS_TOKEN', 'TRAVELPAYOUTS_MARKER']);
    const { generateAdvancedModules } = await import('../agents/backendAgent.js');
    const adv = await generateAdvancedModules('أريد موقع حجز طيران', dir);
    assert.deepEqual(adv.requiredEnv, ['TRAVELPAYOUTS_TOKEN', 'TRAVELPAYOUTS_MARKER'],
        'المتغيّراتُ المطلوبة تُعلَن ولا يقرؤها أحد');
    assert.equal(adv.features.needsTravelpayouts, true);
});

test('الكشفُ يتبع الهدف: طيرانٌ نعم، ومطعمٌ لا', () => {
    for (const g of ['أريد موقع حجز طيران', 'flight booking site', 'موقع رحلات جوية', 'travelpayouts integration']) {
        assert.equal(needsTravelpayouts(g), true, g);
    }
    for (const g of ['موقع مطعم', 'متجر إلكتروني', 'a blog about cats']) {
        assert.equal(needsTravelpayouts(g), false, g);
    }
});
