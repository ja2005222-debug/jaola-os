// 🤖 جولا بوت: إضافة «عند الطلب» — تكتب ملفات، تحقن الوسوم (idempotent)،
// بلا دوال معلّقة، وتُحقن في قالب عامل دون كسره (jsdom).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateJaolaBot, _internals } from '../agents/jaolaBot.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';
import { verifyBehavior, detectUndefinedFunctions } from '../agents/behaviorVerifier.js';

function tmpProject(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbot-'));
    for (const f of files) fs.writeFileSync(path.join(dir, f.name), f.content);
    return dir;
}
const MINIMAL = [
    { name: 'index.html', content: '<!DOCTYPE html><html lang="ar"><head><title>t</title><link rel="stylesheet" href="styles.css"></head><body><h1>مرحبا</h1></body></html>' },
    { name: 'styles.css', content: ':root{--brand:#e11d48}body{color:#111}' },
];

test('generateJaolaBot: يكتب الملفات ويحقن الوسوم', async () => {
    const dir = tmpProject(MINIMAL);
    const r = await generateJaolaBot(dir, { brandName: 'متجري', emoji: '🛍️' });
    assert.equal(r.success, true, r.error);
    assert.ok(fs.existsSync(path.join(dir, 'jaola-bot.js')), 'ملف js');
    assert.ok(fs.existsSync(path.join(dir, 'jaola-bot.css')), 'ملف css');
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.ok(html.includes('jaola-bot.css'), 'وسم css محقون');
    assert.ok(html.includes('jaola-bot.js'), 'وسم js محقون');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateJaolaBot: يرث لون العلامة من CSS المشروع', async () => {
    const dir = tmpProject(MINIMAL);
    await generateJaolaBot(dir, {});
    const css = fs.readFileSync(path.join(dir, 'jaola-bot.css'), 'utf-8');
    assert.ok(css.includes('#e11d48'), 'استُخرج لون --brand من المشروع');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateJaolaBot: idempotent — لا يكرّر الوسوم', async () => {
    const dir = tmpProject(MINIMAL);
    await generateJaolaBot(dir, {});
    await generateJaolaBot(dir, {});
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.equal(html.split('jaola-bot.js').length - 1, 1, 'وسم js مرّة واحدة');
    assert.equal(html.split('jaola-bot.css').length - 1, 1, 'وسم css مرّة واحدة');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateJaolaBot: يفشل بلطف إن غاب index.html', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbot-empty-'));
    const r = await generateJaolaBot(dir, {});
    assert.equal(r.success, false);
    assert.match(r.error, /index\.html/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('ودجت البوت: لا دوال معلّقة (كل مرجع معرّف)', () => {
    const cfg = _internals.buildConfig({ brandName: 'x' }, '#0ea5e9');
    const js = _internals.generateWidgetJS(cfg);
    assert.deepEqual(detectUndefinedFunctions({ html: '', js }), [], 'كل الدوال معرّفة');
});

test('البوت: API-ready + قاعدة معرفة مضمّنة + faq مخصّص يظهر', () => {
    const cfg = _internals.buildConfig({ faq: [{ q: 'التوصيل، الشحن', a: 'نوصّل خلال 24 ساعة.' }], apiBase: 'https://api.x/chat' }, '#000000');
    assert.equal(cfg.apiBase, 'https://api.x/chat', 'apiBase مضبوط');
    assert.ok(cfg.kb.length > 5, 'قاعدة المعرفة الافتراضية موجودة');
    assert.ok(cfg.kb[0].k.includes('التوصيل') && cfg.kb[0].a.includes('24'), 'faq المخصّص مُدمج أولاً');
    const js = _internals.generateWidgetJS(cfg);
    assert.ok(js.includes('نوصّل خلال 24 ساعة'), 'faq مضمّن في الودجت');
});

test('البوت الحيّ: apiBase + token يُضمَّنان في الودجت، والافتراضي offline', () => {
    const off = _internals.buildConfig({}, '#000');
    assert.equal(off.apiBase, null, 'بلا apiBase → offline');
    assert.equal(off.token, null);

    const on = _internals.buildConfig({ apiBase: 'https://x/api/jaola-bot/chat', token: 'sig.tok' }, '#000');
    assert.equal(on.apiBase, 'https://x/api/jaola-bot/chat');
    assert.equal(on.token, 'sig.tok');
    const js = _internals.generateWidgetJS(on);
    assert.ok(js.includes('https://x/api/jaola-bot/chat'), 'apiBase مضمّن');
    assert.ok(js.includes('sig.tok'), 'token مضمّن');
    assert.ok(js.includes('token: CFG.token'), 'الودجت يرسل التوكن مع كل رسالة');
});

test('تكامل: حقن البوت في قالب عامل (jaola-store) لا يكسره (jsdom)', async () => {
    const c = jaolaStore();
    const dir = tmpProject(c.files);
    const r = await generateJaolaBot(dir, { brandName: c.name, emoji: '🛍️' });
    assert.equal(r.success, true, r.error);
    const v = await verifyBehavior({
        projectPath: dir,
        blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] },
        domainModel: c.model,
    });
    assert.equal(v.ran, true, 'شُغّل في jsdom');
    const byName = Object.fromEntries(v.checks.map(x => [x.name, x.status]));
    assert.notEqual(byName['no-js-errors'], 'fail', 'البوت لا يسبّب أخطاء JS في الصفحة المضيفة');
    assert.equal(v.ok, true, 'القالب المضيف ما زال يعمل بعد إضافة البوت — ' + v.summary);
    fs.rmSync(dir, { recursive: true, force: true });
});
