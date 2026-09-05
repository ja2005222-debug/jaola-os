// 🧭 وكلاء لوحة الأدمِن كانوا يتعاملون مع الموقع كغريب عند أي سؤال — لا سياق
// حقيقي مُحقَن، فقط تعليمات المستخدم. هذه الاختبارات تتحقّق من buildPlatformContext
// (سياق حقيقي، لا اختلاق) ومن أن الوكيل المُولَّد (generateAgentPluginCode) يبقى
// كوداً صالحاً نحوياً لأي تعليمات (حتى ذات backtick/${}) ويُوصِّل السياق فعلياً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPlatformContext } from '../agents/platformContext.js';
import { generateAgentPluginCode } from '../services/adminService.js';
import { PluginOrchestrator } from '../core/PluginOrchestrator.js';
import { listClones } from '../agents/cloneTemplates/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function serve(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

test('buildPlatformContext: بلا FRONTEND_URL → يحوي عدد القوالب الحقيقي فقط', async () => {
    const prev = process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL;
    try {
        const ctx = await buildPlatformContext();
        assert.ok(ctx.includes(String(listClones().length)), 'عدد القوالب الحقيقي حاضر');
        assert.ok(!ctx.includes('الرابط المباشر'), 'لا رابط بلا FRONTEND_URL');
    } finally {
        if (prev !== undefined) process.env.FRONTEND_URL = prev;
    }
});

test('buildPlatformContext: مع FRONTEND_URL يعمل → لقطة حيّة حقيقية (عنوان + وصف)', async () => {
    const server = await serve((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>JAOLA OS</title><meta name="description" content="شركتك الذكية"></head><body></body></html>');
    });
    const { port } = server.address();
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = `http://127.0.0.1:${port}`;
    try {
        const ctx = await buildPlatformContext();
        assert.ok(ctx.includes('JAOLA OS'), 'العنوان الحيّ حاضر');
        assert.ok(ctx.includes('شركتك الذكية'), 'الوصف الحيّ حاضر');
    } finally {
        server.close();
        if (prev === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prev;
    }
});

test('buildPlatformContext: FRONTEND_URL معطوب (لا استجابة) → لا انهيار، سياق جزئي فقط', async () => {
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'http://127.0.0.1:1'; // منفذ مرفوض دوماً
    try {
        const ctx = await buildPlatformContext();
        assert.ok(ctx.includes(String(listClones().length)));
        assert.ok(!ctx.includes('لقطة حيّة'));
    } finally {
        if (prev === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prev;
    }
});

test('generateAgentPluginCode: كود صالح نحوياً (ESM حقيقي) لتعليمات فيها backtick و ${} وباكسلاش', async () => {
    const tricky = [
        'تعليمات فيها ` backtick مفردة',
        'تعليمات فيها ${متغير خطر} تشبه استيفاء JS',
        'باكسلاش \\ وسطر جديد\nوثانٍ',
        `مزيج: \` \${x} \\ "quotes" 'more'`,
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-gen-'));
    let i = 0;
    for (const instructions of tricky) {
        for (const runsOnBuild of [false, true]) {
            const code = generateAgentPluginCode({ name: 'edge-agent', description: 'د', instructions, runsOnBuild });
            const file = path.join(dir, `edge-${i++}.mjs`);
            fs.writeFileSync(file, code);
            await assert.doesNotReject(() => import(pathToFileURL(file).href),
                `runsOnBuild=${runsOnBuild} تعليمات: ${JSON.stringify(instructions).slice(0, 40)}`);
        }
    }
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateAgentPluginCode: يستورد ويُحقن buildPlatformContext في كل وكيل', () => {
    const code = generateAgentPluginCode({ name: 'grounded-agent', description: 'د', instructions: 'أنت مساعد' });
    assert.ok(code.includes("import('../agents/platformContext.js')"), 'يستورد سياق المنصّة');
    assert.ok(code.includes('siteContext'), 'يستخدم متغير السياق');
});

test('تكامل حقيقي: وكيل مُولَّد يُحمَّل فعلياً عبر PluginOrchestrator ويصل حتى استدعاء smartChat محقوناً بالسياق', async () => {
    const server = await serve((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><title>موقع الاختبار</title></head><body></body></html>');
    });
    const { port } = server.address();
    const prevUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = `http://127.0.0.1:${port}`;

    // 🔒 مجلّدٌ خاصٌّ بهذا الاختبار ومنسّقٌ خاصٌّ به — لا `plugins/` الحقيقي
    // ولا المنسّق المفرد المشترك.
    //
    // 🔴 كان يكتب وكيلَه في `plugins/` نفسه ويُعيد تحميل المنسّق المفرد،
    // بينما `siteChecker.test.mjs` ينادي `init()` على المجلّد ذاته ويؤكّد
    // على ما حُمِّل. وnode يشغّل ملفّات الاختبار **بالتوازي**، فالتقاطعُ
    // يُسقط أيّهما سبق: أحدهما يرى وكيلَ الآخر، أو يُعيد التهيئة تحت قدميه.
    // مُثبَتٌ بالتشغيل: سقط `adminAgentGrounding` مرّةً و`siteChecker` مرّة،
    // وكلٌّ منهما يمرّ منفرداً — واخضرارُ الحزمة كان يعتمد على الجدولة.
    //
    // والمجلّد شقيقٌ لـ`plugins/` بالعمق نفسه عمداً: الوكيل المولَّد يستورد
    // `../core/providers/llm.js`، فلو وُضع في `os.tmpdir()` لانكسر الاستيراد.
    const isolatedDir = path.resolve(__dirname, `../.plugins-test-${process.pid}`);
    const target = path.join(isolatedDir, 'grounding-test-agent.js');
    fs.mkdirSync(isolatedDir, { recursive: true });
    fs.writeFileSync(target, generateAgentPluginCode({ name: 'grounding-test-agent', description: 'د', instructions: 'أنت مساعد اختباري' }));
    const privateOrchestrator = new PluginOrchestrator();

    try {
        await privateOrchestrator.init(isolatedDir);
        const handler = privateOrchestrator.getAgent('groundingTestAgent');
        assert.ok(handler, 'الوكيل مسجَّل');
        // بلا مفاتيح AI في هذه البيئة: smartChat يفشل حتماً — لكن الفشل يجب أن
        // يكون تحديداً "لا مزوّد AI"، أي أن السياق (fetch + listClones) نُفّذ
        // بنجاح ووصل الكود حتى استدعاء smartChat الخارجي، لا خطأ استيراد/نحو.
        await assert.rejects(
            () => handler({ text: 'ما هو موقعنا؟' }),
            (err) => /مزود AI/.test(err.message),
            'الفشل الوحيد المتوقع هو غياب مزوّد AI — أي أن السياق بُني بنجاح',
        );
    } finally {
        fs.rmSync(isolatedDir, { recursive: true, force: true });
        server.close();
        if (prevUrl === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prevUrl;
    }
});
