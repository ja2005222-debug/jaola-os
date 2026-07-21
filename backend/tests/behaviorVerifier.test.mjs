// 🔬 التحقّق السلوكي: نُشغّل الصفحة فعلاً في jsdom ونتحقّق أن التدفّق يعمل —
// لا "نجاح" أجوف. اختبارات على صفحات حقيقية (عاملة/مكسورة/ميتة/ناقصة دور).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    inlineLocalScripts,
    analyzeStatic,
    summarizeVerdict,
    runBehaviorChecks,
    buildBehaviorFixInstruction,
    detectUndefinedFunctions,
    analyzeProjectStatic,
} from '../agents/behaviorVerifier.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('inlineLocalScripts: يُضمّن السكربت المحلي ويترك الخارجي', () => {
    const html = '<script src="script.js"></script><script src="https://cdn/x.js"></script>';
    const out = inlineLocalScripts(html, { 'script.js': 'window.__ran=1;' });
    assert.match(out, /window\.__ran=1/);
    assert.match(out, /https:\/\/cdn\/x\.js/, 'الخارجي يبقى كما هو');
});

test('analyzeStatic: نموذج متعدّد الأدوار وأحدها غير مبنيّ → fail تغطية الأدوار', () => {
    const checks = analyzeStatic({
        html: '<div id="customer-view"></div>',
        js: 'const orders=[{id:1}];',
        blueprint: { kind: 'webapp' },
        domainModel: { roles: [{ name: 'Customer' }, { name: 'RestaurantOwner' }] },
    });
    const role = checks.find(c => c.name === 'role-coverage');
    assert.equal(role.status, 'fail');
    assert.match(role.detail, /RestaurantOwner/);
});

test('analyzeStatic: كل الأدوار ممثّلة → pass', () => {
    const checks = analyzeStatic({
        html: '<div id="customer"></div><section class="restaurantowner-panel"></section>',
        js: '',
        blueprint: { kind: 'webapp' },
        domainModel: { roles: [{ name: 'customer' }, { name: 'restaurantowner' }] },
    });
    assert.equal(checks.find(c => c.name === 'role-coverage').status, 'pass');
});

test('summarizeVerdict: أي fail → ok=false، والنسبة تُحسب', () => {
    const v = summarizeVerdict([
        { name: 'a', status: 'pass' }, { name: 'b', status: 'warn' }, { name: 'c', status: 'fail' },
    ]);
    assert.equal(v.ok, false);
    assert.ok(v.score < 100 && v.score > 0);
});

test('runBehaviorChecks: صفحة تفاعلية عاملة → لا أخطاء + التفاعل يُحدث تغييراً', async () => {
    const html = `<!doctype html><html><body>
      <input id="q" /><button id="add">أضف</button><ul id="list"></ul>
      <script src="script.js"></script></body></html>`;
    const js = `
      document.getElementById('add').addEventListener('click', () => {
        const li = document.createElement('li');
        li.textContent = document.getElementById('q').value || 'عنصر';
        document.getElementById('list').appendChild(li);
      });
      const data = [{id:1,name:'x'}];`;
    const v = await runBehaviorChecks({
        html, assets: { 'script.js': js },
        blueprint: { kind: 'webapp', functionalComponents: [{ name: 'add' }] },
    });
    assert.equal(v.ran, true, 'شُغّلت في jsdom فعلاً');
    assert.equal(v.checks.find(c => c.name === 'no-js-errors').status, 'pass');
    assert.equal(v.checks.find(c => c.name === 'interactive-wired').status, 'pass', 'الزر يُضيف عنصراً → تغيّر DOM');
    assert.equal(v.ok, true);
});

test('runBehaviorChecks: JS مكسور → فشل no-js-errors (لا نجاح أجوف)', async () => {
    const html = `<!doctype html><html><body><button id="b">x</button>
      <script src="script.js"></script></body></html>`;
    const v = await runBehaviorChecks({
        html, assets: { 'script.js': 'this.will.throw.because.undefined();' },
        blueprint: { kind: 'webapp', functionalComponents: [{ name: 'b' }] },
    });
    assert.equal(v.ran, true);
    assert.equal(v.checks.find(c => c.name === 'no-js-errors').status, 'fail');
    assert.equal(v.ok, false);
});

test('runBehaviorChecks: أزرار ميتة (بلا معالجات) → تحذير interactive-wired', async () => {
    const html = `<!doctype html><html><body>
      <button>لا شيء</button><button>ميت</button>
      <script src="script.js"></script></body></html>`;
    const v = await runBehaviorChecks({
        html, assets: { 'script.js': 'const data=[{id:1}];' },
        blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] },
    });
    assert.equal(v.ran, true);
    const wired = v.checks.find(c => c.name === 'interactive-wired');
    assert.equal(wired.status, 'warn', 'أزرار موجودة لكن بلا استجابة');
});

test('runBehaviorChecks: تطبيق تفاعلي بلا أي عنصر تفاعل → fail', async () => {
    const html = `<!doctype html><html><body><h1>ثابت</h1><p>نص</p></body></html>`;
    const v = await runBehaviorChecks({
        html, assets: {},
        blueprint: { kind: 'webapp', functionalComponents: [{ name: 'search' }] },
    });
    assert.equal(v.checks.find(c => c.name === 'interactive-wired').status, 'fail');
    assert.equal(v.ok, false);
});

// ─── كشف الدوال المعلّقة: "قشرة بلا منطق" (سجل مستخدم حقيقي — التوصيل) ──
test('detectUndefinedFunctions: يمسك الدوال المُشار إليها وغير المعرّفة', () => {
    // سيناريو المستخدم الفعلي: أزرار + DOMContentLoaded تستدعي دوالّ غير موجودة
    const html = `<button id="submitOrderBtn" onclick="submitOrder()">تقديم الطلب</button>
                  <button id="trackBtn" onclick="trackOrder()">تتبع</button>`;
    const js = `document.addEventListener('DOMContentLoaded', () => {
        renderRestaurantOrders();
        renderDeliveryOrders();
    });
    const orders = [{id:1}];
    function helper(){ return orders.length; }`;
    const missing = detectUndefinedFunctions({ html, js });
    for (const fn of ['submitOrder', 'trackOrder', 'renderRestaurantOrders', 'renderDeliveryOrders'])
        assert.ok(missing.includes(fn), `يجب كشف ${fn} كناقص`);
    assert.ok(!missing.includes('helper'), 'المعرّفة لا تُعدّ ناقصة');
});

test('detectUndefinedFunctions: لا إيجابيات كاذبة (مبنيّات + طرق كائنات + معرّفة)', () => {
    const js = `function submitOrder(){
        const el = document.getElementById('x');
        el.addEventListener('click', () => console.log('ok'));
        const arr = [1,2].map(n => n*2);
        setTimeout(() => submitOrder(), 100);
        JSON.stringify(arr); parseInt('5'); arr.forEach(x => x);
    }`;
    assert.deepEqual(detectUndefinedFunctions({ html: '', js }), [], 'لا مبنيّات ولا طرق كائنات ولا معرّفة');
});

test('detectUndefinedFunctions: لا يُحرّم require/import/class/CSS (إيجابيات سجل المستخدم)', () => {
    // ملف خادم/ESM + قالب CSS — كلّها كانت تُحرَّم خطأً (express/rgba/MenuItem...)
    const js = `import express from 'express';
        import { fileURLToPath, pathToFileURL } from 'url';
        const { existsSync, readdirSync } = require('fs');
        class MenuItem {}
        class Order {}
        const app = express();
        const item = new MenuItem();
        const o = new Order();
        const css = \`color: rgba(0,0,0,.5); background: linear-gradient(90deg,#000,#fff); transform: translateY(10px); width: calc(100% - 2rem);\`;
        export default function handler(req, res) { res.end(); }`;
    assert.deepEqual(detectUndefinedFunctions({ html: '', js }), [], 'استيرادات/أصناف/دوال CSS ليست دوالّ معلّقة');
});

test('analyzeStatic: دوال معلّقة → فشل wiring-complete', () => {
    const checks = analyzeStatic({
        html: `<button onclick="submitOrder()">أرسل</button>`,
        js: `const data=[{id:1}];`,
        blueprint: { kind: 'webapp' },
    });
    const w = checks.find(c => c.name === 'wiring-complete');
    assert.equal(w.status, 'fail');
    assert.match(w.detail, /submitOrder/);
});

test('buildBehaviorFixInstruction: wiring-complete → توجيه بتنفيذ الدوال', () => {
    const ins = buildBehaviorFixInstruction({ checks: [
        { name: 'wiring-complete', status: 'fail', detail: 'دوال غير معرّفة: submitOrder، renderRestaurantOrders' },
    ] });
    assert.match(ins, /عرّف كل دالة/);
    assert.match(ins, /submitOrder/);
});

// ─── جولة الإصلاح التلقائية: من الحكم إلى تعليمة إصلاح مستهدفة ───────
test('buildBehaviorFixInstruction: دور ناقص → تعليمة ببناء واجهته + النموذج', () => {
    const verdict = { checks: [
        { name: 'role-coverage', status: 'fail', detail: 'أدوار بلا واجهة: RestaurantOwner' },
        { name: 'no-js-errors', status: 'pass' },
    ] };
    const ins = buildBehaviorFixInstruction(verdict, { roles: [{ name: 'Customer' }, { name: 'RestaurantOwner' }], entities: [{ name: 'Order' }] });
    assert.match(ins, /RestaurantOwner/);
    assert.match(ins, /واجهة استقبال الطلبات/, 'توجيه ملموس لبناء واجهة الدور');
    assert.match(ins, /Order/, 'يستأنس بالنموذج');
});

test('buildBehaviorFixInstruction: أخطاء JS + أزرار ميتة → توجيهان', () => {
    const verdict = { checks: [
        { name: 'no-js-errors', status: 'fail', detail: 'ReferenceError: x' },
        { name: 'interactive-wired', status: 'warn', detail: 'أزرار بلا استجابة' },
    ] };
    const ins = buildBehaviorFixInstruction(verdict);
    assert.match(ins, /أخطاء JavaScript/);
    assert.match(ins, /معالجات/);
});

test('buildBehaviorFixInstruction: لا ثغرات → نص فارغ (لا جولة إصلاح)', () => {
    assert.equal(buildBehaviorFixInstruction({ checks: [{ name: 'a', status: 'pass' }] }), '');
    assert.equal(buildBehaviorFixInstruction({ checks: [] }), '');
});

// ─── تأريض «ماذا تبقى»: تحليل ساكن للمشروع الفعلي على القرص ──────────
test('analyzeProjectStatic: يقرأ الملفات ويكشف فجوات حقيقية (دور بلا واجهة)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-gaps-'));
    fs.writeFileSync(path.join(dir, 'index.html'),
        `<!doctype html><html><body><div id="customer-view"></div><script src="script.js"></script></body></html>`);
    fs.writeFileSync(path.join(dir, 'script.js'), `const orders=[{id:1}];`);
    const { hasProject, checks } = await analyzeProjectStatic({
        projectPath: dir,
        domainModel: { roles: [{ name: 'Customer' }, { name: 'RestaurantOwner' }] },
    });
    assert.equal(hasProject, true);
    const role = checks.find(c => c.name === 'role-coverage');
    assert.equal(role.status, 'fail', 'RestaurantOwner بلا واجهة يُكشف من الكود الفعلي');
    assert.match(role.detail, /RestaurantOwner/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('analyzeProjectStatic: لا مشروع → hasProject=false (لا يخترع فجوات)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-empty-'));
    const r = await analyzeProjectStatic({ projectPath: dir, domainModel: null });
    assert.equal(r.hasProject, false);
    assert.deepEqual(r.checks, []);
    fs.rmSync(dir, { recursive: true, force: true });
});

// ─── سكربت مُشار إليه لكنه مفقود (سجل مستخدم: index.html→app.js غير موجود) ──
test('analyzeProjectStatic: index.html يشير إلى سكربت مفقود → fail missing-script', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-miss-'));
    fs.writeFileSync(path.join(dir, 'index.html'),
        `<!doctype html><html><body><button onclick="submitOrder()">أرسل</button><script src="app.js"></script></body></html>`);
    // app.js غير مكتوب عمداً
    const { hasProject, checks } = await analyzeProjectStatic({ projectPath: dir });
    assert.equal(hasProject, true);
    const ms = checks.find(c => c.name === 'missing-script');
    assert.equal(ms.status, 'fail', 'app.js المفقود يُكشف');
    assert.match(ms.detail, /app\.js/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('buildBehaviorFixInstruction: missing-script → توجيه بإنشاء الملف', () => {
    const ins = buildBehaviorFixInstruction({ checks: [
        { name: 'missing-script', status: 'fail', detail: 'سكربت مفقود: app.js' },
    ] });
    assert.match(ins, /أنشئ ملف السكربت المفقود/);
    assert.match(ins, /app\.js/);
});

// ─── jsdom لا يطبّق requestSubmit → كان يُحسب خطأ JS كاذباً ──────────
test('runBehaviorChecks: form.requestSubmit() لا يُحسب خطأ JS (بديل jsdom)', async () => {
    const html = `<!doctype html><html><body>
      <form id="f"><input name="q"><button type="submit">إرسال</button></form>
      <button id="go">go</button><script src="app.js"></script></body></html>`;
    const js = `
      document.getElementById('go').addEventListener('click', () => {
        document.getElementById('f').requestSubmit();
      });
      const data = [{id:1}];`;
    const v = await runBehaviorChecks({
        html, assets: { 'app.js': js },
        blueprint: { kind: 'webapp', functionalComponents: [{ name: 'submit' }] },
    });
    assert.equal(v.ran, true);
    assert.notEqual(v.checks.find(c => c.name === 'no-js-errors').status, 'fail', 'requestSubmit ليس عطلاً');
});

// ─── عقد الحفظ: استخراج الدوال الحالية (لمنع التعديل من حذف ميزات سابقة) ──
test('extractDefinedFunctions: يجمع الدوال المعرّفة لعقد الحفظ', async () => {
    const { extractDefinedFunctions } = await import('../agents/behaviorVerifier.js');
    const js = `function renderAdmin(){} const finalizeOrder = () => {}; function renderDriverOrders(){} let x=1;`;
    const fns = extractDefinedFunctions(js);
    for (const n of ['renderAdmin', 'finalizeOrder', 'renderDriverOrders'])
        assert.ok(fns.has(n), `يجمع ${n}`);
});
