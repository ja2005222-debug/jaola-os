// 🤖 استوديو البوت: بيان الإعداد يُكتب مع التركيب ويُقرأ لملء النموذج
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateJaolaBot, readBotManifest } from '../agents/jaolaBot.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bot-'));

test('التركيب يكتب بياناً كاملاً والاستوديو يقرؤه (round-trip)', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><head></head><body>موقعي</body></html>');
    const r = await generateJaolaBot(dir, {
        brandName: 'متجر النور',
        emoji: '🛍️',
        welcome: 'أهلاً بك في متجرنا!',
        quick: ['ما الجديد؟', 'التوصيل'],
        faq: [{ q: 'الشحن، التوصيل', a: 'خلال يومين لكل المدن.' }, { q: '', a: 'ناقص' }],
    });
    assert.ok(r.success, r.error);

    const m = readBotManifest(dir);
    assert.ok(m.installed);
    assert.equal(m.config.brandName, 'متجر النور');
    assert.equal(m.config.emoji, '🛍️');
    assert.equal(m.config.welcome, 'أهلاً بك في متجرنا!');
    assert.deepEqual(m.config.quick, ['ما الجديد؟', 'التوصيل']);
    assert.equal(m.config.faq.length, 1, 'الأسئلة الناقصة تُستبعد');
    assert.equal(m.config.faq[0].a, 'خلال يومين لكل المدن.');
    assert.equal(m.config.ai, false, 'بلا apiBase → لا ذكاء حيّ');
    // لا أسرار في البيان
    const raw = fs.readFileSync(path.join(dir, '.jaola-bot.json'), 'utf-8');
    assert.ok(!raw.includes('token') && !raw.includes('apiBase'));
    // الودجت حُقن في الصفحة
    assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf-8').includes('jaola-bot.js'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('مشروع بلا بوت → installed:false، وتركيب قديم بلا بيان → installed بلا config', () => {
    const dir = tmp();
    assert.deepEqual(readBotManifest(dir), { installed: false, config: null });
    fs.writeFileSync(path.join(dir, 'jaola-bot.js'), '// قديم');
    const m = readBotManifest(dir);
    assert.ok(m.installed && m.config === null);
    fs.rmSync(dir, { recursive: true, force: true });
});
