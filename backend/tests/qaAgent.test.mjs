// ✅ فاحص الاكتمال (#56): يصطاد الأزرار المكسورة وبقايا placeholders
// والهياكل الفارغة — نتيجته تغذّي حلقة إعادة التوليد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qaVerify } from '../agents/qaAgent.js';
import { scrubPlaceholders } from '../services/codeGuard.js';

const fullHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>نايا تاكسي</title></head>
<body>
<header><nav><a href="#home">الرئيسية</a></nav></header>
<section id="home"><h1>نايا تاكسي</h1><p>${'خدمة توصيل موثوقة. '.repeat(30)}</p><button onclick="bookRide()">احجز</button></section>
<section id="services"><h2>خدماتنا</h2><p>${'مشاوير بأسعار ثابتة. '.repeat(20)}</p><img src="a.jpg" alt="سيارة"></section>
<section id="contact"><form onsubmit="return sendContact()"><button>أرسل</button></form></section>
<footer><p>©</p></footer>
</body></html>`;
const goodJS = `function bookRide() { alert('تم'); }\nconst sendContact = () => false;`;
const goodCSS = `:root{--p:#333}\n${'section{padding:2rem}\n'.repeat(20)}@media(max-width:768px){body{font-size:14px}}`;

test('موقع مكتمل وسليم → passed', () => {
    const r = qaVerify({ files: [
        { name: 'index.html', content: fullHTML },
        { name: 'script.js', content: goodJS },
        { name: 'style.css', content: goodCSS },
    ]});
    assert.equal(r.passed, true);
});

test('بقايا placeholders → فشل صلب بنقد محدد', () => {
    const r = qaVerify({ files: [{ name: 'index.html', content: fullHTML.replace('نايا تاكسي</h1>', '{اسم الموقع}</h1>') }, { name: 'script.js', content: goodJS }] });
    assert.equal(r.passed, false);
    assert.ok(r.logs.some(l => l.includes('placeholders')));
});

test('زر يستدعي دالة غير معرّفة → فشل باسم الدالة', () => {
    const r = qaVerify({ files: [{ name: 'index.html', content: fullHTML }, { name: 'script.js', content: 'function other(){}' }] });
    assert.equal(r.passed, false);
    assert.ok(r.logs.some(l => l.includes('bookRide')));
});

test('body شبه فارغ → فشل', () => {
    const r = qaVerify({ files: [{ name: 'index.html', content: '<!DOCTYPE html><html><body><h1>هيكل</h1></body></html>' }] });
    assert.equal(r.passed, false);
});

test('نواقص ثانوية (footer/viewport) → تحذير بلا فشل — لا تعليق للحلقة', () => {
    const noExtras = fullHTML.replace(/<footer[\s\S]*?<\/footer>/, '').replace(/<meta name="viewport"[^>]*>/, '');
    const r = qaVerify({ files: [{ name: 'index.html', content: noExtras }, { name: 'script.js', content: goodJS }] });
    assert.equal(r.passed, true);
    assert.ok(r.logs.some(l => l.includes('footer')));
});

test('أقواس غير متوازنة → فشل', () => {
    const r = qaVerify({ files: [{ name: 'index.html', content: fullHTML }, { name: 'script.js', content: 'function bookRide(){ if(1){ }' }] });
    assert.equal(r.passed, false);
});

test('دوال داخل <script> مضمّن تُحتسب — لا إنذار كاذب', () => {
    const inline = fullHTML.replace('</body>', '<script>function bookRide(){} const sendContact=()=>false;</script></body>');
    const r = qaVerify({ files: [{ name: 'index.html', content: inline }] });
    assert.equal(r.passed, true);
});

test('scrubPlaceholders: يستبدل في HTML باسم المشروع ولا يلمس CSS', () => {
    const out = scrubPlaceholders([
        { name: 'index.html', content: '<h1>{اسم المتجر}</h1>' },
        { name: 'style.css', content: 'body{color:red}' },
    ], 'naya-taxi');
    assert.equal(out[0].content, '<h1>naya taxi</h1>');
    assert.equal(out[1].content, 'body{color:red}');
});
