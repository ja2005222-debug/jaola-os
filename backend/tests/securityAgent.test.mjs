import test from 'node:test';
import assert from 'node:assert/strict';
import { runSecurityChecks, runSecurity, generateEnvExample } from '../agents/securityAgent.js';
import { generateServerEntry } from '../agents/renderAgent.js';
import { DELIVERY_STAGES } from '../core/contracts/index.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// ═══════════════════════════════════════════════════════
// الترويسات عند مَن يكتب الملف — لا عند مُصلِحٍ يسبقه
// ═══════════════════════════════════════════════════════

test('server.js المولَّد يحمل ترويسات الأمان الأربع', () => {
    const src = generateServerEntry();
    for (const h of ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection', 'Referrer-Policy']) {
        assert.ok(src.includes(h), `ترويسة ${h} مفقودة`);
    }
});

test('الترويسات وسيطٌ يسبق المسارات ويستدعي next', () => {
    const src = generateServerEntry();
    assert.ok(src.indexOf('X-Content-Type-Options') > src.indexOf('app.use(express.json())'), 'قبل express.json');
    const block = src.slice(src.indexOf('X-Content-Type-Options'), src.indexOf('X-Content-Type-Options') + 400);
    assert.match(block, /next\(\);/, 'وسيطٌ لا يمرّر الطلب يوقف الخادم');
    assert.ok(src.indexOf('X-Content-Type-Options') < src.indexOf('const apiDir'), 'بعد تركيب المسارات');
});

test('مرحلةُ الأمان تسبق إنشاء server.js — فلا مُصلِحَ هناك يُنتظر منه شيء', () => {
    const names = DELIVERY_STAGES.map((s) => s.name);
    const sec = names.indexOf('security');
    const render = names.indexOf('render-config');
    assert.ok(sec >= 0 && render >= 0, 'المرحلتان موجودتان');
    assert.ok(sec < render, `الترتيب انقلب: security=${sec} render-config=${render}`);
});

test('لا مُصلِحَ أمنيٍّ مُصدَّر ولا نتيجةٌ تزعم إصلاحاً', async () => {
    const mod = await import('../agents/securityAgent.js');
    assert.equal('autoFixSecurity' in mod, false, 'عاد مُصلِحٌ لا يصل ما يُصلح');
    const r = await runSecurity([{ name: 'index.html', content: '<html></html>' }]);
    assert.equal('fixedFiles' in r, false, 'عاد زعمُ إصلاحٍ لا يقع');
});

// ═══════════════════════════════════════════════════════
// الفحوص نفسها
// ═══════════════════════════════════════════════════════

test('السرُّ المكشوف مشكلةٌ لا تحذير', () => {
    const r = runSecurityChecks([{ name: 'app.js', content: 'const k = "sk_live_abc123XYZ";' }]);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].type, 'SECRET_EXPOSED');
    assert.ok(r.score <= 85);
});

test('eval خطيرٌ، وinnerHTML تحذير', () => {
    const ev = runSecurityChecks([{ name: 'a.js', content: 'eval(x);' }]);
    assert.equal(ev.issues[0].type, 'DANGEROUS');
    const xss = runSecurityChecks([{ name: 'a.js', content: 'el.innerHTML = data;' }]);
    assert.equal(xss.issues.length, 0);
    assert.equal(xss.warnings[0].type, 'XSS');
});

test('حقنُ SQL من مدخلات الطلب يُكشف', () => {
    const r = runSecurityChecks([{ name: 'api/x.js', content: 'db.query(`SELECT * FROM t WHERE id=${req.body.id}`)' }]);
    assert.ok(r.issues.some((i) => i.type === 'SQL_INJECTION'));
});

test('مشروعٌ نظيفٌ يأخذ A', () => {
    const r = runSecurityChecks([{ name: 'index.html', content: '<html><body>مرحباً</body></html>' }]);
    assert.equal(r.grade, 'A');
    assert.equal(r.score, 100);
});

test('runSecurity يضيف .gitignore حين يغيب لا حين يوجد', async () => {
    const without = await runSecurity([{ name: 'a.js', content: 'const x=1;' }]);
    assert.ok(without.newFiles.some((f) => f.name === '.gitignore'));
    const withIt = await runSecurity([{ name: 'a.js', content: 'const x=1;' }, { name: '.gitignore', content: 'node_modules' }]);
    assert.ok(!withIt.newFiles.some((f) => f.name === '.gitignore'));
});

test('.env.example يُشتقّ من process.env المستعملة فعلاً', () => {
    const out = generateEnvExample([{ name: 'api/x.js', content: 'const a = process.env.MY_TOKEN; const b = process.env.OTHER_KEY;' }]);
    assert.match(out, /MY_TOKEN=/);
    assert.match(out, /OTHER_KEY=/);
});
