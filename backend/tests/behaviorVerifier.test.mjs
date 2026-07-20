// 🔬 التحقّق السلوكي: نُشغّل الصفحة فعلاً في jsdom ونتحقّق أن التدفّق يعمل —
// لا "نجاح" أجوف. اختبارات على صفحات حقيقية (عاملة/مكسورة/ميتة/ناقصة دور).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    inlineLocalScripts,
    analyzeStatic,
    summarizeVerdict,
    runBehaviorChecks,
} from '../agents/behaviorVerifier.js';

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
