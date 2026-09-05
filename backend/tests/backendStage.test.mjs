// ⚙️ مرحلةُ الخلفية تخرج من jcr: `_stageBackend` → `stages/backend.js#runBackendStage(context, roomName, agents, reporter)` (JCR/16).
//
// خطُّ الأساس (`jcrRuntimePipeline`: «مشروع يحتاج خادماً…») يمرّ بها عبر التسليم كلِّه ويثبّت النتيجةَ على القرص.
// هنا التوصيفُ المباشر للدالّة الحرّة بلا LLM: صمتُ `needsBackend=false`، سقوطُ الفريق بسطره، المولّدُ التقليديّ
// وتكاملُ script.js عبر الحارس، قاعدةُ البيانات، Postgres والمصادقة بكلماتهما، فشلُ المولّد بسطره — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runBackendStage } from '../agents/stages/backend.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const agentsOf = (events) => logs(events).map((m) => m.match(/➔ \[([^\]]+)\]/)[1]);
const HTML = '<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>x</h1><script src="script.js"></script></body></html>';
const SCRIPT = 'document.title = "x";';
const project = () => { const d = emptyProject(); fs.writeFileSync(path.join(d, 'index.html'), HTML); fs.writeFileSync(path.join(d, 'script.js'), SCRIPT); return d; };
const context = (s, dir, goal) => ({ ...s.ctx, projectPath: dir, goal, originalGoal: goal, plan: { files: [{ name: 'index.html', content: HTML }, { name: 'script.js', content: SCRIPT }] }, mentalModel: {} });
const stubAgents = (calls, { backend = true } = {}) => ({
    needsBackend: () => true,
    generateBackend: async (goal, frontendContext) => { calls.push({ goal, frontendContext }); return backend ? { success: true, files: [{ name: 'api/items.js', content: 'export default function handler(req,res){res.json([]);}' }] } : { success: false, files: [], error: 'المزوّد صامت' }; },
    generateFrontendAPIIntegration: async (goal, files, script) => `${script}\n// API: ${files.map((f) => '/' + f.name.replace(/\.js$/, '')).join(', ')}`,
});

test('needsBackend=false → صمتٌ تامّ ولا كتابة', async () => {
    const s = scenario('bk0'); const dir = project(); const { events, reporter } = collect();
    await runBackendStage(context(s, dir, 'صفحة هبوط'), s.ctx.roomName, { needsBackend: () => false }, reporter);
    assert.deepEqual(events, []); assert.deepEqual(fs.readdirSync(dir).sort(), ['index.html', 'script.js']);
});

test('بلا مزوّد: الفريقُ يسقط بسطره، المولّدُ التقليديّ يكتب api/ بسياق الواجهة من القرص، script.js يُحدَّث عبر الحارس، ثمّ قاعدةُ بيانات — ولا Prisma ولا مصادقة بلا كلماتهما', async () => {
    const s = scenario('bk1'); setUserLanguage(s.ctx.username, 'ar'); const dir = project(); const calls = [];
    const { events, reporter } = collect();
    await runBackendStage(context(s, dir, 'تطبيق توصيل طلبات مع خادم'), s.ctx.roomName, stubAgents(calls), reporter);
    assert.equal(calls.length, 1); assert.match(calls[0].frontendContext, /--- index\.html ---/);
    const L = logs(events);
    assert.equal(L[0], '[5. RUNTIME] ➔ [BackendAgent]: ⚙️ المشروع يحتاج خادماً — جاري توليد APIs...');
    assert.ok(L.includes('[5. RUNTIME] ➔ [BackendTeam]: ⚠️ لم يُنجز أي وكيل من 7 — الاحتياط: المولّد التقليدي'), L.join('\n'));
    assert.ok(L.includes('[5. RUNTIME] ➔ [BackendAgent]: ✅ تم توليد 1 ملف (api/items.js)'));
    assert.ok(L.includes('[5. RUNTIME] ➔ [BackendAgent]: 🔗 تم تحديث script.js ليستدعي الـ APIs'));
    assert.ok(L.includes('[5. RUNTIME] ➔ [DatabaseAgent]: 🗄️ جاري توليد قاعدة البيانات...'));
    // نوعُ المشروع من mentalModel.designBrief وإلّا 'business' — فقاعدةُ business: اتّصالٌ وبيئةٌ فقط (لا schema/seed)
    assert.ok(L.includes('[5. RUNTIME] ➔ [DatabaseAgent]: ✅ mongodb — 2 ملف (api/db.js, .env.example)'), L.join('\n'));
    assert.ok(!L.some((m) => /\[(PostgresAgent|AuthAgent|BackendVerify)\]/.test(m)), 'لا Postgres ولا مصادقة ولا فحصٌ أجوف');
    assert.match(fs.readFileSync(path.join(dir, 'api', 'items.js'), 'utf8'), /res\.json/);
    assert.match(fs.readFileSync(path.join(dir, 'script.js'), 'utf8'), /\/\/ API: \/api\/items$/);
    for (const f of ['api/db.js', '.env.example']) assert.ok(fs.existsSync(path.join(dir, f)), f);
    assert.ok(!fs.existsSync(path.join(dir, 'api', 'schema.js')), 'لا schema لنوع business');
    assert.ok(!fs.existsSync(path.join(dir, 'BACKEND_TEAM.md')) && !fs.existsSync(path.join(dir, 'prisma')) && !fs.existsSync(path.join(dir, 'auth.html')));
});

test('كلماتُ postgres والمصادقة → Prisma (٥ ملفّات) ثمّ JWT Auth (٥) بسطورهما وبهذا الترتيب', async () => {
    const s = scenario('bk2'); setUserLanguage(s.ctx.username, 'ar'); const dir = project();
    const { events, reporter } = collect();
    await runBackendStage(context(s, dir, 'متجر إلكتروني مع تسجيل دخول وقاعدة بيانات postgres'), s.ctx.roomName, stubAgents([]), reporter);
    const A = agentsOf(events);
    assert.deepEqual([...new Set(A)], ['BackendAgent', 'BackendTeam', 'CodeGuard', 'DatabaseAgent', 'PostgresAgent', 'AuthAgent'].filter((a) => A.includes(a)));
    assert.ok(A.indexOf('PostgresAgent') > A.lastIndexOf('DatabaseAgent') && A.indexOf('AuthAgent') > A.lastIndexOf('PostgresAgent'), 'الترتيب: قاعدة ← Postgres ← مصادقة');
    assert.ok(logs(events).some((m) => m.startsWith('[5. RUNTIME] ➔ [PostgresAgent]: ✅ PostgreSQL + Prisma — 5 ملف')));
    assert.ok(logs(events).some((m) => m.startsWith('[5. RUNTIME] ➔ [AuthAgent]: ✅ JWT Auth — 5 ملف')));
    for (const f of ['prisma/schema.prisma', 'PRISMA_README.md', 'api/auth.js', 'auth.html', 'AUTH_README.md']) assert.ok(fs.existsSync(path.join(dir, f)), f);
});

test('المولّدُ التقليديّ يفشل → سطرُ «تعذّر توليد الخادم» بسببه، ولا api/، وقاعدةُ البيانات تُولَّد رغم ذلك', async () => {
    const s = scenario('bk3'); const dir = project(); const { events, reporter } = collect();
    await runBackendStage(context(s, dir, 'تطبيق توصيل طلبات مع خادم'), s.ctx.roomName, stubAgents([], { backend: false }), reporter);
    assert.ok(logs(events).includes('[5. RUNTIME] ➔ [BackendAgent]: ⚠️ تعذّر توليد الخادم: المزوّد صامت'));
    assert.ok(!fs.existsSync(path.join(dir, 'api', 'items.js')) && fs.existsSync(path.join(dir, 'api', 'db.js')));
    assert.equal(fs.readFileSync(path.join(dir, 'script.js'), 'utf8'), SCRIPT, 'script.js لا يُمَسّ بلا ملفّات API');
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — بثّاً وقرصاً', async () => {
    const s = scenario('bkq'); setUserLanguage(s.ctx.username, 'ar'); const a = project(); const b = project();
    await s.rt._stageBackend(context(s, a, 'تطبيق توصيل طلبات مع خادم'), s.ctx.roomName, stubAgents([]));
    const { events, reporter } = collect();
    await runBackendStage(context(s, b, 'تطبيق توصيل طلبات مع خادم'), s.ctx.roomName, stubAgents([]), reporter);
    assert.deepEqual(logs(events), s.events.filter((e) => e.ev === 'log').map((e) => e.payload.message));
    const tree = (d) => fs.readdirSync(d, { recursive: true }).map(String).sort();
    assert.deepEqual(tree(b), tree(a));
    assert.equal(fs.readFileSync(path.join(b, 'script.js'), 'utf8'), fs.readFileSync(path.join(a, 'script.js'), 'utf8'));
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد بـagents، والقارئُ يُستورد لا يُفوَّض', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/backend.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/reporter\.io\b/.test(code));
    assert.equal((code.match(/reporter\.liveLog\(/g) || []).length, 28);
    assert.equal((code.match(/\breadCodeContext\(/g) || []).length, 1);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes('\n    async _stageBackend(context, roomName, agents) {\n        return runBackendStage(context, roomName, agents, this.reporter);\n    }\n'));
    assert.equal((jcr.replace(/^import .*$/gm, '').match(/\brunBackendTeam\(|\bgenerateDatabase\(|\bgenerateAuth\(|\bgeneratePrismaSetup\(|\bguardSingleJS\(/g) || []).length, 0);
});
