/**
 * 🔧 المنظِّفُ لا يكسر ما ينظّفه — Sprint 3k
 *
 * `refactorCode` تُستبدل بنتيجتها ملفاتُ الخطّة (`jcr.js:562`)، فما تكتبه هو
 * ما يُسلَّم للمستخدم. وكانت تُدخل في كودِه خمسةَ أعطاب:
 *   • `console.log(fn(x))` يُحذف نصفُه ويبقى `);` — خطأٌ نحويّ.
 *   • `'use strict'` يُدَسّ فوق `'use client'` فيُبطلها.
 *   • `var` → `let`: خطأٌ صامتٌ في النطاق، وسقوطٌ عند الاستعمال بعد الحلقة.
 *   • تكرارُ CSS يُبقي المتجاوَزة ويحذف النافذة، فينقلب اللون.
 *   • `hreflang=` يُشبع فحصَ `lang=` فلا تنال `<html>` لغةً أبداً.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refactorCode } from '../agents/refactorAgent.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const one = async (name, content, lang = 'en') =>
    (await refactorCode([{ name, content }], lang)).files[0].content;

test('🔴 نداءٌ متشعّبٌ يُحذف كاملاً — لا يبقى قوسٌ يتيمٌ يكسر الملفّ', async () => {
    const src = [
        "console.log('a');", "console.log('b');", "console.log('c');",
        "console.log(JSON.stringify({ ok: 1 }));",
        "console.log(fmt(`${x}`, [1, 2]));",
        "const keep = 1;",
    ].join('\n');
    const out = await one('app.js', src);
    assert.ok(!/^\s*\);/m.test(out), `بقي قوسٌ يتيم:\n${out}`);
    assert.doesNotThrow(() => new Function(out.replace(/^'use strict';\n\n/, '')));
    assert.ok(out.includes('const keep = 1;'), 'الكودُ بعد النداء لم يُبتَر');
    assert.equal((out.match(/console\.log/g) || []).length, 3, 'تُبقى ثلاثةٌ ويُحذف ما بعدها');
});

test('🔴 نصٌّ فيه قوسٌ لا يخدع العدّاد', async () => {
    const src = ["console.log(1);", "console.log(2);", "console.log(3);",
        `console.log('a) not the end', k);`, 'const after = 2;'].join('\n');
    const out = await one('app.js', src);
    assert.ok(out.includes('const after = 2;'));
    assert.doesNotThrow(() => new Function(out.replace(/^'use strict';\n\n/, '')));
});

test('تسجيلُ الأخطاء ليس «زائداً» فلا يُحذف', async () => {
    const src = ["console.log(1);", "console.log(2);", "console.log(3);", "console.log(4);",
        "console.error('فشل الحفظ');", "console.warn('انتبه');"].join('\n');
    const out = await one('app.js', src);
    assert.ok(out.includes("console.error('فشل الحفظ')"), 'حُذف تسجيلُ خطأ المستخدم');
    assert.ok(out.includes("console.warn('انتبه')"));
});

test('🔴 التوجيهُ يبقى أوّلاً: لا يُدَسّ شيءٌ فوق use client', async () => {
    const out = await one('page.js', "'use client';\nimport { useState } from 'react';\nexport default function P(){ return null }\n");
    assert.match(out.trimStart(), /^'use client';/, 'التوجيهُ لم يعد أوّلاً فبطل مفعولُه');
});

test('الوحدةُ صارمةٌ أصلاً فلا تُحشى، والسكربتُ العاديُّ يُحصَّن', async () => {
    const esm = await one('m.js', "import x from './x.js';\nexport const y = x;\n");
    assert.ok(!esm.includes("'use strict'"), 'وحدةُ ESM صارمةٌ بحكم التعريف');
    const plain = await one('p.js', "function greet(){ alert('hi') }\n");
    assert.match(plain.trimStart(), /^'use strict';/);
});

test('🔴 var يبقى var — التحويلُ كان يغيّر المعنى لا الشكل', async () => {
    const redecl = "var mode = 'light';\nif (dark) { var mode = 'dark'; }\nresult = mode;\n";
    const loop = "for (var i = 0; i < list.length; i++) { if (list[i].on) break; }\nresult = i;\n";
    const run = (code, args) => {
        const body = code.replace(/^'use strict';\n\n/, '');
        try { return new Function(...Object.keys(args), `let result; ${body}; return result;`)(...Object.values(args)); }
        catch (e) { return `❌ ${e.constructor.name}`; }
    };
    const list = [{ on: false }, { on: true }];
    const a = await one('a.js', redecl);
    const b = await one('b.js', loop);
    assert.equal(run(a, { dark: true, list }), 'dark', 'انقلب المعنى صامتاً');
    assert.equal(run(b, { dark: true, list }), 1, 'سقط الكودُ بعد التحويل');
});

test('🔴 تكرارُ CSS: تبقى النافذةُ لا المتجاوَزة', async () => {
    const out = await one('s.css', '.card { color: red; padding: 8px; color: blue; }\n');
    assert.ok(out.includes('color: blue'), 'حُذف اللونُ النافذ وبقي المتجاوَز');
    assert.ok(!out.includes('color: red'));
    assert.ok(out.includes('padding: 8px'));
});

test('تكرارُ CSS داخل @media يُنقَّى، والنصُّ المقتبَسُ لا يُمَسّ', async () => {
    const out = await one('s.css', '@media (min-width:0){ .m { top: 1px; top: 2px; } }\n.q { content: "a;b"; content: "c;d"; }\n');
    assert.ok(out.includes('top: 2px') && !out.includes('top: 1px'));
    assert.ok(out.includes('content: "a;b"'), 'الفاصلةُ داخل نصٍّ ليست فاصلَ تصريح');
});

test('المتغيّراتُ المخصّصة لا تُنقَّى (قد تتعمّد التتالي)', async () => {
    const out = await one('s.css', ':root { --brand: #111; --brand: #222; }\n');
    assert.ok(out.includes('--brand: #111') && out.includes('--brand: #222'));
});

test('🔴 hreflang لا يُشبع فحصَ لغةِ الصفحة', async () => {
    const out = await one('i.html', '<!DOCTYPE html>\n<html>\n<head>\n<link rel="alternate" hreflang="ar" href="/ar">\n</head>\n<body></body>\n</html>', 'ar');
    assert.match(out, /<html lang="ar"/, 'الصفحةُ خرجت بلا لغة');
    assert.match(out, /<meta charset="UTF-8">/);
});

test('لغةٌ مصرَّحةٌ سلفاً لا تُكرَّر', async () => {
    const out = await one('i.html', '<!DOCTYPE html>\n<html lang="fr">\n<head></head>\n<body></body>\n</html>', 'ar');
    assert.equal((out.match(/lang=/g) || []).length, 1);
    assert.ok(out.includes('lang="fr"'), 'لغةُ المؤلّف تُحترم');
});

test('الملخّصُ لا يدّعي تنظيفاً لم يقع', async () => {
    const r = await refactorCode([{ name: 'a.js', content: 'const a = 1;\n' }], 'ar');
    assert.equal(r.totalReduction, 0);
    assert.deepEqual(r.improvements, []);
    assert.match(r.summary, /لا يحتاج تنظيفاً/);
});

test('ملفٌّ بلا محتوى أو بامتدادٍ غريب يمرّ كما هو', async () => {
    const r = await refactorCode([
        { name: 'x.js', content: '' },
        { name: 'data.json', content: '{"a":1}' },
        { name: 'no-content.js' },
    ], 'ar');
    assert.equal(r.files[0].content, '');
    assert.equal(r.files[1].content, '{"a":1}');
    assert.equal(r.files[2].content, undefined);
});
