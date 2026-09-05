// ═══════════════════════════════════════════════════════════════════
// 📱 `agents/pwaAgent.js` — يحوّل موقع المستخدم تطبيقاً قابلاً للتثبيت.
//
// 🔴 عاملُ الخدمة كان يحمل قائمةً مكتوبةً بيد:
//        FILES_TO_CACHE = ['index.html','styles.css','script.js','icon.svg']
//    ويُخزّنها بـ`cache.addAll` — وهي **ذرّيّة**: يفشل ملفٌّ واحد فلا يُخزَّن
//    أيُّ ملف. والـ`catch` حولها يبتلع الخطأ، وتعليقُها يقول «تجاهل الملفات
//    غير الموجودة (مثل عدم وجود script.js)» — وهو يتجاهل **الخطأ** لا الملف.
//
//    فقِيس بتشغيل معالج `install` في بيئةٍ مُحاكاة: مشروعٌ بلا `script.js` —
//    الحالةُ التي يسمّيها التعليقُ نفسه — يُخزّن **صفرَ ملفات**، والمستخدمُ
//    يُقال له إنّ التطبيق أُضيف. فلا عملَ دون اتصال البتّة.
//
//    وصفحاتُ الموقع المتعدّدة (`about.html` وأخواتُها) لم تكن في القائمة أصلاً.
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { generatePWA } from '../agents/pwaAgent.js';

const HTML = '<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>مطعم البحر</title>'
    + '<link rel="stylesheet" href="styles.css"></head><body><h1>مطعم البحر</h1></body></html>';

function project(extra = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-'));
    fs.writeFileSync(path.join(dir, 'index.html'), HTML);
    for (const [name, content] of Object.entries(extra)) fs.writeFileSync(path.join(dir, name), content);
    return dir;
}
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });

/** يُشغّل معالجَ install من عامل الخدمة المولَّد ويُعيد ما خُزِّن فعلاً. */
async function runInstall(dir) {
    const sw = fs.readFileSync(path.join(dir, 'service-worker.js'), 'utf8');
    const stored = [];
    const waits = [];
    const cache = {
        // ذرّيّة كما في المتصفّح: يفشل واحدٌ فلا يُخزَّن شيء
        addAll: async (list) => {
            for (const f of list) if (!fs.existsSync(path.join(dir, f))) throw new Error('404 ' + f);
            stored.push(...list);
        },
        add: async (f) => {
            if (!fs.existsSync(path.join(dir, f))) throw new Error('404 ' + f);
            stored.push(f);
        },
    };
    runInNewContext(sw, {
        caches: { open: async () => cache, keys: async () => [], delete: async () => {}, match: async () => null },
        self: {
            skipWaiting() {}, clients: { claim() {} },
            addEventListener: (ev, fn) => { if (ev === 'install') fn({ waitUntil: (p) => waits.push(p) }); },
        },
        fetch: async () => ({}), console,
    });
    await Promise.allSettled(waits);
    return stored;
}

test('مشروعٌ بلا script.js يُخزّن ملفاته فعلاً — لا صفراً', async () => {
    const dir = project({ 'styles.css': ':root{--primary:#0ea5e9}' });
    const r = await generatePWA(dir, { appName: 'مطعم البحر' });
    assert.equal(r.success, true);

    const stored = await runInstall(dir);
    assert.ok(stored.length >= 3, `خُزّن ${stored.length} ملفاً فقط — الكاشُ شبه فارغ`);
    assert.ok(stored.includes('index.html'), 'الرئيسيةُ نفسها لم تُخزَّن');
    assert.ok(stored.includes('styles.css'));
    rm(dir);
});

test('صفحاتُ الموقع المتعدّدة تُخزَّن — لا الرئيسيةُ وحدها', async () => {
    const dir = project({
        'styles.css': 'body{margin:0}',
        'about.html': '<!DOCTYPE html><html><body>عن</body></html>',
        'contact.html': '<!DOCTYPE html><html><body>اتصل</body></html>',
    });
    await generatePWA(dir, { appName: 'مطعم البحر' });
    const stored = await runInstall(dir);
    assert.ok(stored.includes('about.html') && stored.includes('contact.html'),
        `صفحاتُ الموقع غائبةٌ عن الكاش: ${stored.join(', ')}`);
    rm(dir);
});

test('ملفٌّ غائبٌ لا يُسقط الباقين', async () => {
    const dir = project({ 'styles.css': 'body{margin:0}' });
    await generatePWA(dir, { appName: 'تطبيقي' });
    // نحذف ملفاً بعد التوليد: العاملُ يطلبه ولن يجده
    fs.unlinkSync(path.join(dir, 'styles.css'));
    const stored = await runInstall(dir);
    assert.ok(stored.includes('index.html'), 'غيابُ ملفٍّ واحد أفرغ الكاش');
    assert.ok(!stored.includes('styles.css'));
    rm(dir);
});

test('القائمةُ لا تشمل عاملَ الخدمة نفسه ولا الملفات المخفيّة', async () => {
    const dir = project({ 'styles.css': 'body{}', '.env': 'SECRET=1' });
    const r = await generatePWA(dir, { appName: 'تطبيقي' });
    assert.ok(!r.cached.includes('service-worker.js'), 'العاملُ يُخزّن نفسه');
    assert.ok(!r.cached.some((f) => f.startsWith('.')), `ملفٌّ مخفيٌّ في الكاش: ${r.cached.join(', ')}`);
    assert.ok(!r.cached.includes('.env'), '⛔ .env في قائمة التخزين');
    rm(dir);
});

test('manifest صالحُ JSON ويحمل اسمَ التطبيق كما هو', async () => {
    const dir = project({ 'styles.css': ':root{--primary:#123456}' });
    await generatePWA(dir, { appName: 'مطعم "البحر" & الشاطئ' });
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.equal(m.name, 'مطعم "البحر" & الشاطئ');
    assert.equal(m.theme_color, '#123456');
    assert.ok(m.icons.length >= 1);
    rm(dir);
});

test('لا index.html ⇒ لا يدّعي نجاحاً', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-empty-'));
    const r = await generatePWA(dir, { appName: 'تطبيقي' });
    assert.equal(r.success, false);
    assert.equal(fs.existsSync(path.join(dir, 'service-worker.js')), false, 'كتب عاملاً لمشروعٍ لا صفحةَ له');
    rm(dir);
});
