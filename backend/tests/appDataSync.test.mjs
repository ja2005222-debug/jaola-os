// 🗄️ مزامنة بيانات القوالب (jaola-data): تخزين ملفّي معزول + حقن idempotent
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readStore, writeKey } from '../services/appData.js';
import { buildDataSyncJS as buildSecureDataSyncJS, injectDataSyncTag, installDataSync } from '../services/dataSync.js';
import { setCloneTrack, getCloneTrack, setCloneIdentity, getCloneId, getProjectMemory } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const buildDataSyncJS = options => buildSecureDataSyncJS({ ...options, requireSession: false });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'appdata-'));

test('appData: كتابة وقراءة، عزل بين المشاريع، ودمج المفاتيح', () => {
    const dir = tmp();
    assert.deepEqual(readStore(dir, 'u', 'p'), {}, 'مشروع جديد → كائن فارغ');
    assert.ok(writeKey(dir, 'u', 'p', 'jvet_owners', '[{"name":"أحمد"}]').ok);
    assert.ok(writeKey(dir, 'u', 'p', 'jvet_pets', '[]').ok);
    const store = readStore(dir, 'u', 'p');
    assert.equal(store.jvet_owners, '[{"name":"أحمد"}]');
    assert.equal(store.jvet_pets, '[]');
    // تحديث مفتاح موجود لا يمسّ البقية
    writeKey(dir, 'u', 'p', 'jvet_owners', '[]');
    assert.equal(readStore(dir, 'u', 'p').jvet_owners, '[]');
    assert.equal(readStore(dir, 'u', 'p').jvet_pets, '[]', 'مفتاح آخر بقي كما هو');
    // مشروع آخر لنفس المستخدم معزول تماماً
    assert.deepEqual(readStore(dir, 'u', 'other'), {});
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appData: يرفض مفتاحاً غير صالح وقيمة أكبر من الحد', () => {
    const dir = tmp();
    assert.ok(writeKey(dir, 'u', 'p', 'bad key!', 'x').error, 'مفتاح بمسافة/رمز خاص مرفوض');
    assert.ok(writeKey(dir, 'u', 'p', 'ok_key', 'x'.repeat(600 * 1024)).error, 'قيمة أكبر من 512KB مرفوضة');
    assert.ok(writeKey(dir, 'u', 'p', 'ok_key', 'fine').ok);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appData: يرفض أسماء مفاتيح محجوزة (تلوّث النموذج الأولي)', () => {
    const dir = tmp();
    assert.ok(writeKey(dir, 'u', 'p', '__proto__', '{"polluted":true}').error);
    assert.ok(writeKey(dir, 'u', 'p', 'constructor', 'x').error);
    assert.ok(writeKey(dir, 'u', 'p', 'prototype', 'x').error);
    assert.deepEqual(readStore(dir, 'u', 'p'), {}, 'لا شيء كُتب فعلاً');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appData: يفرض سقف عدد المفاتيح لكل مشروع', () => {
    const dir = tmp();
    for (let i = 0; i < 60; i++) assert.ok(writeKey(dir, 'u', 'p', 'k' + i, 'v').ok);
    assert.ok(writeKey(dir, 'u', 'p', 'k60', 'v').error, 'المفتاح الـ61 يتجاوز السقف');
    assert.ok(writeKey(dir, 'u', 'p', 'k0', 'updated').ok, 'تحديث مفتاح موجود لا يُحسب جديداً');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('dataSync: الكود يحمل التوكن/العنوان، ويستثني مفاتيح _session من المزامنة', () => {
    const js = buildDataSyncJS({ apiBase: 'https://jaola.example/', token: 'tok.sig' });
    assert.ok(js.includes('"https://jaola.example"'), 'apiBase بلا شرطة أخيرة');
    assert.ok(js.includes('tok.sig'));
    assert.ok(js.includes('/api/public/data'));
    assert.ok(js.includes('_session'), 'استثناء مفاتيح الجلسة موجود بالكود');
    assert.ok(js.includes('window.JAOLA_SYNC'), 'يُعرِّض API/التوكن لـ app.js من أجل المصادقة الحقيقية');
    // بلا توكن/عنوان → لا تفعل شيئاً خطراً (لا تُعطّل تشغيل التطبيق)
    const noop = buildDataSyncJS({ apiBase: '', token: '' });
    assert.ok(noop.includes('loadApp()'));
});

test('dataSync: window.JAOLA_SYNC فعلياً null بلا توكن، وكائن صحيح معه (تنفيذ حقيقي)', async () => {
    const { JSDOM } = await import('jsdom');
    const stubFetch = () => new Promise(() => {}); // معلّقة عمداً — لا حاجة لتسوية شبكة في هذا الاختبار

    const dom1 = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://x.example' });
    dom1.window.fetch = stubFetch;
    dom1.window.eval(buildDataSyncJS({ apiBase: '', token: '' }));
    assert.equal(dom1.window.JAOLA_SYNC, null);

    const dom2 = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://x.example' });
    dom2.window.fetch = stubFetch;
    dom2.window.eval(buildDataSyncJS({ apiBase: 'https://api.example', token: 'tok.sig' }));
    // مقارنة بالقيم لا بالمرجع — الكائن أُنشئ في واقعية (realm) jsdom منفصلة
    assert.equal(dom2.window.JAOLA_SYNC.api, 'https://api.example');
    assert.equal(dom2.window.JAOLA_SYNC.token, 'tok.sig');
});

test('dataSync: حقن الوسم idempotent، ويستبدل app.js لا يضيف بجانبه', () => {
    const html = '<html><body><script src="app.js"></script></body></html>';
    const once = injectDataSyncTag(html);
    assert.ok(once.includes('jaola-data.js'), 'الوسم الجديد أُضيف');
    assert.ok(!once.includes('src="app.js"'), 'وسم app.js الأصلي استُبدل لا أُبقي بجانبه');
    assert.equal(injectDataSyncTag(once), once, 'لا حقن مزدوج عند التكرار');
});

test('dataSync: تجاوز آمن حين لا يوجد app.js بالشكل المتوقَّع', () => {
    const custom = '<html><body><script src="main.js"></script></body></html>';
    assert.equal(injectDataSyncTag(custom), custom, 'مشروع لا يطابق النمط المتوقَّع يبقى كما هو');
});

test('installDataSync: يكتب jaola-data.js ويحقن الوسم في مجلّد مشروع فعلي', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><body><script src="app.js"></script></body></html>');
    const r = installDataSync(dir, { apiBase: 'https://x.y', token: 't.s' });
    assert.ok(r.ok);
    assert.ok(fs.existsSync(path.join(dir, 'jaola-data.js')));
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('jaola-data.js'));
    // تشغيل ثانٍ (نشر جديد) لا يكرّر الحقن
    const r2 = installDataSync(dir, { apiBase: 'https://x.y', token: 't.s' });
    assert.ok(r2.skipped);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('installDataSync: يكتشف type="text/babel" في وسم app.js (قوالب React) ويمرّره', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><body><script type="text/babel" src="app.js"></script></body></html>');
    const r = installDataSync(dir, { apiBase: 'https://x.y', token: 't.s' });
    assert.ok(r.ok);
    const js = fs.readFileSync(path.join(dir, 'jaola-data.js'), 'utf8');
    assert.ok(js.includes('"text/babel"'), 'نوع app.js text/babel انتقل لكود المزامنة');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('dataSync: مسار Babel يجلب app.js ويحوّله عبر Babel.transform وينفّذه (تنفيذ حقيقي)', async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously', url: 'https://x.example' });
    let fetchedUrl = null;
    dom.window.fetch = (url) => { fetchedUrl = url; return Promise.resolve({ text: () => Promise.resolve('window.__ran = 1;') }); };
    dom.window.Babel = { transform: (src) => ({ code: src }) }; // محاكاة بسيطة تكفي لإثبات مسار التنفيذ
    let dispatched = false;
    dom.window.document.addEventListener('DOMContentLoaded', () => { dispatched = true; });

    dom.window.eval(buildDataSyncJS({ apiBase: '', token: '', appScriptType: 'text/babel' }));
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(fetchedUrl, 'app.js', 'جلب app.js عبر fetch مباشرة (لا وسم <script> ديناميكي)');
    assert.equal(dom.window.__ran, 1, 'الكود المحوَّل نُفِّذ فعلياً');
    assert.ok(dispatched, 'DOMContentLoaded الصناعي أُطلق بعد التنفيذ');
});

test('installDataSync: تجاوز آمن حين لا يوجد index.html أو مجلّد المشروع', () => {
    const dir = tmp();
    assert.ok(installDataSync(dir, { apiBase: 'https://x.y', token: 't.s' }).skipped, 'لا index.html');
    assert.ok(installDataSync(path.join(dir, 'nope'), { apiBase: 'https://x.y', token: 't.s' }).error, 'مجلّد غير موجود');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectMemory: يسجّل ويسترجع track الكلون المطبَّق (يحدّد أهلية jaola-data)', () => {
    const user = 'trackuser_' + Date.now(), proj = 'p1';
    assert.equal(getCloneTrack(user, proj), null, 'مشروع لم يُطبَّق عليه كلون قط → null');
    setCloneTrack(user, proj, 'system');
    assert.equal(getCloneTrack(user, proj), 'system');
    setCloneTrack(user, proj, 'site');
    assert.equal(getCloneTrack(user, proj), 'site', 'يُحدَّث عند إعادة التطبيق');
});

test('projectMemory: يحفظ هوية الكلون ويسترجعها للمشاريع القديمة من التاريخ', () => {
    const user = 'cloneid_' + Date.now();
    setCloneIdentity(user, 'new', { id: 'jaola-helpdesk', track: 'system' });
    assert.equal(getCloneId(user, 'new'), 'jaola-helpdesk');
    const old = getProjectMemory(user, 'old');
    old.history = [{ action: 'كلون jaola-events: طلب قديم' }];
    assert.equal(getCloneId(user, 'old'), 'jaola-events', 'ترحيل ضمني للمشاريع السابقة للحقل');
});

test('dataSync: HTTP failures visible, sessionStorage untouched, late hydration preserves edits', async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<body></body>', { runScripts: 'dangerously', url: 'https://x.example' });
    try {
        let resolveLoad;
        const puts = [];
        dom.window.fetch = (url, options) => {
            if (!options) return new Promise(resolve => { resolveLoad = resolve; });
            puts.push(JSON.parse(options.body));
            return Promise.resolve({ ok: false, status: 403 });
        };
        dom.window.eval(buildDataSyncJS({ apiBase: 'https://api.example', token: 't' }));
        dom.window.sessionStorage.setItem('private', 'session');
        dom.window.localStorage.setItem('user_session', 'local');
        dom.window.localStorage.setItem('orders', 'new');
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(puts.length, 1);
        assert.equal(puts[0].value, 'new');
        assert.ok(dom.window.document.querySelector('[role="alert"]'));
        resolveLoad({ ok: true, json: async () => ({ orders: 'old', catalog: 'remote' }) });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(dom.window.localStorage.getItem('orders'), 'new');
        assert.equal(dom.window.localStorage.getItem('catalog'), 'remote');
    } finally { dom.window.close(); }
});

test('dataSync: same-key writes wait for acknowledgement; other keys remain independent', async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<body></body>', { runScripts: 'dangerously', url: 'https://x.example' });
    const tick = () => new Promise(resolve => setImmediate(resolve));
    try {
        const calls = [];
        dom.window.fetch = (url, options) => {
            if (!options) return Promise.resolve({ ok: true, json: async () => ({}) });
            return new Promise((resolve, reject) => calls.push({ url, ...JSON.parse(options.body), resolve, reject }));
        };
        dom.window.eval(buildDataSyncJS({ apiBase: 'https://api.example', token: 't' }));
        dom.window.localStorage.setItem('orders', 'first');
        dom.window.localStorage.setItem('orders', 'second');
        dom.window.localStorage.setItem('catalog', 'independent');
        await tick();
        assert.deepEqual(calls.map(c => c.value), ['first', 'independent']);
        calls[0].resolve({ ok: true });
        await tick();
        assert.equal(calls[2].value, 'second');
        dom.window.localStorage.setItem('orders', 'third');
        calls[2].reject(new Error('offline'));
        await tick();
        assert.equal(calls[3].value, 'third', 'a failed request does not stall subsequent saves');
        assert.ok(dom.window.document.querySelector('[role="alert"]'));
        calls[1].resolve({ ok: true });
        calls[3].resolve({ ok: true });
        await tick();
        assert.equal(dom.window.localStorage.getItem('orders'), 'third');
    } finally { dom.window.close(); }
});

test('public data handlers reject invalid identity before touching storage', async () => {
    const vm = await import('node:vm');
    const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
    const start = source.indexOf("app.get('/api/public/data',");
    const end = source.indexOf('// 🔐 مصادقة حقيقية', start);
    assert.ok(start >= 0 && end > start);
    const handlers = {};
    let reads = 0, writes = 0;
    vm.runInNewContext(source.slice(start, end), {
        app: { post: () => {}, get: (p, limit, fn) => { handlers.get = fn; }, put: (p, limit, fn) => { handlers.put = fn; } },
        appDataLimit: () => {}, requireProjectSession: () => {}, APPDATA_DIR: 'unused',
        verifyBotToken: token => token === 'valid' ? { u: 'alice', p: 'shop' } : null,
        transactionStore: () => ({ snapshot: async () => { reads++; throw new Error('database unavailable'); } }),
        writeAppDataKey: () => { writes++; return { ok: true }; },
    });
    const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
    for (const method of ['get', 'put']) {
        const res = response();
        await handlers[method]({ query: {}, body: {}, params: { key: 'orders' } }, res);
        assert.equal(res.code, 401);
    }
    assert.equal(reads, 0);
    assert.equal(writes, 0);
    const unavailable = response();
    await handlers.get({ query: { token: 'valid' } }, unavailable);
    assert.equal(unavailable.code, 503);
    const saved = response();
    handlers.put({ body: { token: 'valid', value: '[]' }, params: { key: 'orders' } }, saved);
    assert.equal(saved.code, 428);
    assert.equal(saved.body.error, 'TRANSACTION_REQUIRED');
    assert.equal(writes, 0);
});

test('appData: corrupt stores are preserved instead of silently replaced', () => {
    const dir = tmp();
    try {
        for (const invalid of ['{broken', 'null', '[]']) {
            const file = path.join(dir, 'u__p.json');
            fs.writeFileSync(file, invalid);
            assert.throws(() => readStore(dir, 'u', 'p'));
            assert.throws(() => writeKey(dir, 'u', 'p', 'orders', 'new'));
            assert.equal(fs.readFileSync(file, 'utf8'), invalid);
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('appData: atomic replacement preserves independent keys and leaves no temporary files', () => {
    const dir = tmp();
    try {
        writeKey(dir, 'u', 'p', 'orders', 'old');
        writeKey(dir, 'u', 'p', 'catalog', 'kept');
        writeKey(dir, 'u', 'p', 'orders', 'new');
        assert.deepEqual(readStore(dir, 'u', 'p'), { orders: 'new', catalog: 'kept' });
        assert.deepEqual(fs.readdirSync(dir), ['u__p.json']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('installDataSync: upgrades generated scripts and retains React script type', () => {
    const dir = tmp();
    try {
        fs.writeFileSync(path.join(dir, 'index.html'), '<body><script type="text/babel" src="app.js"></script></body>');
        installDataSync(dir, { apiBase: 'https://old.example', token: 'old' });
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        const result = installDataSync(dir, { apiBase: 'https://new.example', token: 'new' });
        assert.equal(result.updated, true);
        const script = fs.readFileSync(path.join(dir, 'jaola-data.js'), 'utf8');
        assert.ok(script.includes('var APP_TYPE = "text/babel";'));
        assert.ok(script.includes('https://new.example'));
        assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), html);
        assert.equal(installDataSync(dir, { apiBase: 'https://new.example', token: 'new' }).skipped, true);
        fs.writeFileSync(path.join(dir, 'jaola-data.js'), '// custom client');
        assert.equal(installDataSync(dir, { apiBase: 'https://new.example', token: 'new' }).skipped, true);
        assert.equal(fs.readFileSync(path.join(dir, 'jaola-data.js'), 'utf8'), '// custom client');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
