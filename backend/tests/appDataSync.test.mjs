// 🗄️ مزامنة بيانات القوالب (jaola-data): تخزين ملفّي معزول + حقن idempotent
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readStore, writeKey } from '../services/appData.js';
import { buildDataSyncJS, injectDataSyncTag, installDataSync } from '../services/dataSync.js';

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
    // بلا توكن/عنوان → لا تفعل شيئاً خطراً (لا تُعطّل تشغيل التطبيق)
    const noop = buildDataSyncJS({ apiBase: '', token: '' });
    assert.ok(noop.includes('loadApp()'));
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

test('installDataSync: تجاوز آمن حين لا يوجد index.html أو مجلّد المشروع', () => {
    const dir = tmp();
    assert.ok(installDataSync(dir, { apiBase: 'https://x.y', token: 't.s' }).skipped, 'لا index.html');
    assert.ok(installDataSync(path.join(dir, 'nope'), { apiBase: 'https://x.y', token: 't.s' }).error, 'مجلّد غير موجود');
    fs.rmSync(dir, { recursive: true, force: true });
});
