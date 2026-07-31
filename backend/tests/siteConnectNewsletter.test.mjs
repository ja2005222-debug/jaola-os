// 🔗 وصلة الموقع: اشتراك النشرة — نُشغّل الكود المحقون فعلاً في jsdom ونتحقّق
// أنه يميّز نموذج/زرّ الاشتراك عن نموذج التواصل ويبعث لنقطة site-subscribe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildConnectJS } from '../services/siteConnect.js';

async function run(html) {
    const calls = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
    const { window } = dom;
    window.fetch = (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve({ ok: true }); };
    const js = buildConnectJS({ apiBase: 'https://jaola.example', token: 'tok.sig' });
    window.eval(js);
    await new Promise(r => setTimeout(r, 30));
    return { window, calls };
}

test('نموذج مُعلَّم صراحة data-jaola-newsletter ببريد وحيد → site-subscribe لا site-message', async () => {
    const { window, calls } = await run(`<html><body>
        <form id="f" data-jaola-newsletter><input type="email" id="mail" value="a@b.com"><button type="submit">اشترك</button></form>
    </body></html>`);
    window.document.getElementById('f').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 30));
    const subCalls = calls.filter(c => c.url.includes('site-subscribe'));
    assert.equal(subCalls.length, 1, 'استُدعيت site-subscribe مرّة واحدة');
    assert.equal(subCalls[0].body.email, 'a@b.com');
    assert.equal(calls.filter(c => c.url.includes('site-message')).length, 0, 'لا رسالة تواصل');
});

test('نموذج تواصل عادي (اسم+رسالة) → site-message لا site-subscribe', async () => {
    const { window, calls } = await run(`<html><body>
        <form id="f">
          <input id="name" value="أحمد">
          <textarea id="msg">مرحباً، أريد الاستفسار</textarea>
          <button type="submit">أرسل</button>
        </form>
    </body></html>`);
    window.document.getElementById('f').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 30));
    assert.equal(calls.filter(c => c.url.includes('site-message')).length, 1);
    assert.equal(calls.filter(c => c.url.includes('site-subscribe')).length, 0);
});

test('نمط القوالب الجاهزة: زرّ data-action داخل data-jaola-newsletter (لا <form>) → site-subscribe', async () => {
    const { window, calls } = await run(`<html><body>
        <div data-jaola-newsletter>
          <input type="email" id="nlEmail" value="x@y.com">
          <button data-action="nlSubscribe">اشترك</button>
        </div>
    </body></html>`);
    window.document.querySelector('[data-action=nlSubscribe]').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    const subCalls = calls.filter(c => c.url.includes('site-subscribe'));
    assert.equal(subCalls.length, 1);
    assert.equal(subCalls[0].body.email, 'x@y.com');
});

test('زرّ بلا بريد مُدخَل → لا يُرسَل شيء', async () => {
    const { window, calls } = await run(`<html><body>
        <div data-jaola-newsletter>
          <input type="email" id="nlEmail" value="">
          <button data-action="nlSubscribe">اشترك</button>
        </div>
    </body></html>`);
    window.document.querySelector('[data-action=nlSubscribe]').dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    assert.equal(calls.filter(c => c.url.includes('site-subscribe')).length, 0);
});
