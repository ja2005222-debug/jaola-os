// 🔍 site-checker: فحص حقيقي (fetch فعلي) لخادم محلي مُتحكَّم به — بلا اعتماد
// على الإنترنت أو الذكاء الاصطناعي، مطابقاً لروح behaviorVerifier (تحقّق لا تخمين).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import plugin, { checkSite } from '../plugins/site-checker.js';
import { orchestrator } from '../core/PluginOrchestrator.js';

function serve(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

test('checkSite: صفحة سليمة (title + meta description + viewport + gzip) → بلا ملاحظات', async () => {
    const server = await serve((req, res) => {
        const body = zlib.gzipSync(Buffer.from('<html><head><title>متجري</title><meta name="description" content="وصف"><meta name="viewport" content="width=device-width"></head><body><img src="a.jpg" alt="صورة"></body></html>', 'utf8'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'gzip' });
        res.end(body);
    });
    const { port } = server.address();
    try {
        const r = await checkSite(`http://127.0.0.1:${port}/`);
        assert.equal(r.ok, true);
        assert.equal(r.status, 200);
        assert.equal(r.title, 'متجري');
        assert.equal(r.hasDesc, true);
        assert.equal(r.hasViewport, true);
        assert.equal(r.imgsNoAlt, 0);
        assert.equal(r.compressed, true);
        // ⏱️ زمن الاستجابة **ليس خاصيةً للصفحة** بل قياسٌ لحِمل الآلة:
        // `checkSite` يضيف ملاحظة «بطيء» فوق 3000ms، والجلبُ المحلي يتجاوزها
        // فعلاً حين تُشغَّل الحزمة كلها بالتوازي على معالجٍ مشبع. فتأكيدُ
        // «بلا ملاحظاتٍ إطلاقاً» كان يدّعي يقيناً لا يملكه — يسقط في
        // التوازي وحده وينجح منفرداً، وهو التذبذب الموثَّق. أُعيد إنتاجه
        // بخادمٍ يتأخّر 3.2s: صفحةٌ سليمةٌ حرفياً وissues غير فارغة.
        //
        // 📌 والعتبة تبقى في المنتج كما هي — موقعٌ حقيقي بطيء يستحق
        // الملاحظة. المُصلَح هو ادّعاء الاختبار لا سلوك الفاحص.
        const contentIssues = r.issues.filter(i => !i.includes('زمن استجابة'));
        assert.deepEqual(contentIssues, [], `ملاحظات محتوى غير متوقَّعة: ${r.issues.join(' | ')}`);
    } finally { server.close(); }
});

test('checkSite: صفحة ناقصة (بلا description/viewport/alt/ضغط) → ملاحظات دقيقة', async () => {
    const server = await serve((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>ص</title></head><body><img src="a.jpg"><img src="b.jpg"></body></html>');
    });
    const { port } = server.address();
    try {
        const r = await checkSite(`http://127.0.0.1:${port}/`);
        assert.equal(r.ok, true);
        assert.equal(r.hasDesc, false);
        assert.equal(r.hasViewport, false);
        assert.equal(r.imgsNoAlt, 2);
        assert.equal(r.compressed, false);
        assert.ok(r.issues.some(i => i.includes('وصف meta')));
        assert.ok(r.issues.some(i => i.includes('viewport')));
        assert.ok(r.issues.some(i => i.includes('2 صورة')));
        assert.ok(r.issues.some(i => i.includes('غير مضغوطة')));
    } finally { server.close(); }
});

test('checkSite: رمز 500 → يُسجَّل كملاحظة و ok=false', async () => {
    const server = await serve((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body>error</body></html>');
    });
    const { port } = server.address();
    try {
        const r = await checkSite(`http://127.0.0.1:${port}/`);
        assert.equal(r.ok, false);
        assert.equal(r.status, 500);
        assert.ok(r.issues.some(i => i.includes('500')));
    } finally { server.close(); }
});

test('checkSite: مضيف غير موجود → خطأ واضح بلا انهيار', async () => {
    const r = await checkSite('http://127.0.0.1:1/');
    assert.equal(r.ok, false);
    assert.ok(r.error && r.error.includes('تعذّر الوصول'));
});

test('manifest: يُصدّر وكيلاً باسم siteChecker يعمل عند الطلب', async () => {
    assert.equal(plugin.name, 'site-checker');
    assert.equal(plugin.type, 'agent');
    const reg = await plugin.hooks.registerAgent();
    assert.equal(reg.name, 'siteChecker');
    assert.equal(typeof reg.handler, 'function');
});

test('handler: بلا رابط → يطلب رابطاً بدل التخمين', async () => {
    const reg = await plugin.hooks.registerAgent();
    const out = await reg.handler({ text: 'افحص موقعي' });
    assert.ok(out.reply.includes('أرسل رابط'));
});

test('handler: رابط داخل نص حر يُستخرج ويُفحص فعلياً', async () => {
    const server = await serve((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>t</title><meta name="description" content="d"><meta name="viewport" content="w"></head><body></body></html>');
    });
    const { port } = server.address();
    try {
        const reg = await plugin.hooks.registerAgent();
        const out = await reg.handler({ text: `افحص لي http://127.0.0.1:${port}/ من فضلك` });
        assert.ok(out.reply.includes('✅'));
        assert.equal(out.details.ok, true);
    } finally { server.close(); }
});

test('تكامل: PluginOrchestrator الحقيقي يحمّل site-checker من مجلد plugins/ فعلياً ويُسجّل siteChecker', async () => {
    const status = await orchestrator.init();
    assert.equal(status.errors.filter(e => e.source.includes('site-checker')).length, 0, 'لا أخطاء تحميل');
    assert.ok(status.registeredAgents.includes('siteChecker'), 'الوكيل مسجَّل فعلياً في المنسّق');
});
