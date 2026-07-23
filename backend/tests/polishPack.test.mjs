// ✨ باقة التلميع: إضافيّة، idempotent، وآمنة (لا تكسر القالب المضيف في jsdom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { polishHtml, isPolished } from '../agents/polishPack.js';
import { verifyBehavior, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

test('polishHtml: يحقن الخطّ + AOS + التحسينات ويعلّم', () => {
    const base = '<!DOCTYPE html><html><head><title>t</title></head><body><h1>x</h1></body></html>';
    const out = polishHtml(base);
    assert.ok(out.includes('family=Cairo'), 'خطّ Cairo');
    assert.ok(out.includes('aos.css') && out.includes('aos.js'), 'AOS محقون');
    assert.ok(out.includes('scroll-behavior:smooth'), 'تحسينات أساسية');
    assert.ok(out.includes('data-jaola-polish'), 'علامة التلميع');
    assert.equal(isPolished(out), true);
    assert.equal(isPolished(base), false);
});

test('polishHtml: idempotent — لا تكرار', () => {
    const base = '<html><head></head><body></body></html>';
    const once = polishHtml(base);
    const twice = polishHtml(once);
    assert.equal(twice, once, 'الاستدعاء الثاني لا يغيّر شيئاً');
    assert.equal((once.match(/aos\.js/g) || []).length, 1, 'AOS مرّة واحدة');
});

test('polishHtml: بلا وسوم head/body يبقى صالحاً (fallback)', () => {
    const out = polishHtml('<div>محتوى فقط</div>');
    assert.ok(out.includes('data-jaola-polish'));
    assert.ok(out.includes('محتوى فقط'));
});

test('تكامل: قالب عامل مُلمَّع ما زال يعمل بلا أخطاء (jsdom)', async () => {
    const c = jaolaStore();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jpolish-'));
    for (const f of c.files) {
        const content = f.name === 'index.html' ? polishHtml(f.content) : f.content;
        fs.writeFileSync(path.join(dir, f.name), content);
    }
    const v = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] }, domainModel: c.model });
    assert.equal(v.ran, true, 'شُغّل في jsdom');
    const byName = Object.fromEntries(v.checks.map(x => [x.name, x.status]));
    assert.notEqual(byName['no-js-errors'], 'fail', 'التلميع لا يسبّب أخطاء JS');
    assert.equal(v.ok, true, 'القالب المُلمَّع ما زال يعمل — ' + v.summary);
    // لا يُدخل التلميع دوالّ معلّقة
    const app = c.files.find(f => f.name === 'app.js').content;
    assert.deepEqual(detectUndefinedFunctions({ html: polishHtml(c.files.find(f => f.name === 'index.html').content), js: app }), []);
    fs.rmSync(dir, { recursive: true, force: true });
});
