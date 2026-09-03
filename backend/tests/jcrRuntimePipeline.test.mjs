// 🧠 شبكة الأمان الرابعة لـ jcr.js — النواة نفسها: runDynamicMultiAgentRuntime
// (حلقة النقاش + خطّ التسليم) عبر المسار الحقيقي كاملاً من _runMissionNow.
// خط الأساس قبل استخراج المراحل إلى دوال بتوقيع موحّد (context, roomName, agents):
// ما يُثبَّت هنا يجب أن يبقى مطابقاً حرفياً بعد الاستخراج.
// الوكلاء الثقيلة (المبرمج/المعماري/الجودة) وهمية؛ بقية المراحل حقيقية —
// الحتمية منها تعمل (SEO/Security/Git/Render/التحقّق السلوكي)، ومراحل LLM
// (المراجعة/المصمّم/محقّق المتطلبات) تسقط فوراً إلى «⚠️ تخطّي» لغياب المزوّد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { getProjectState, STATES } from '../agents/stateMachine.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { resetLessons, topLessons } from '../services/platformLessons.js';

const GOAL = 'أداة حاسبة زكاة بسيطة';
const HTML = `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>حاسبة الزكاة</title>
<link rel="stylesheet" href="styles.css"></head><body><main><h1>حاسبة الزكاة</h1>
<input id="amount" type="number" placeholder="المبلغ"><button id="calc">احسب</button><p id="out"></p></main>
<script src="script.js"></script></body></html>`;
const CSS = 'body{font-family:sans-serif;margin:0} main{max-width:640px;margin:2rem auto;padding:1rem}';
const JS = `const rates=[{name:'زكاة المال',rate:0.025}];
document.getElementById('calc').addEventListener('click',()=>{const v=Number(document.getElementById('amount').value)||0;document.getElementById('out').textContent=(v*rates[0].rate).toFixed(2);});`;
const PLAN_FILES = () => [
    { name: 'index.html', content: HTML },
    { name: 'styles.css', content: CSS },
    { name: 'script.js', content: JS },
];

function kernelScenario(prefix, { coder, architect, qa, extraAgents = {} } = {}) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    const dir = emptyProject();
    const calls = { coder: [], architect: [], qa: [] };
    const agents = {
        getState: () => null,
        coreGenerateCodePlan: async (prompt, codeContext, visual, images, onChunk, sections, lang) => {
            calls.coder.push({ prompt, codeContext, sections, lang });
            return coder ? coder(calls.coder.length) : { files: PLAN_FILES() };
        },
        architectReview: async (plan) => { calls.architect.push(plan); return architect ? architect(calls.architect.length) : { approved: true, feedback: '' }; },
        qaVerify: async (plan) => { calls.qa.push(plan); return qa ? qa(calls.qa.length) : { passed: true, logs: [] }; },
        needsBackend: () => false,
        ...extraAgents,
    };
    const run = () => s.rt._runMissionNow(GOAL, dir, s.ctx.username, s.ctx.activeProject, s.ctx.roomName, agents, null);
    const state = () => getProjectState(s.ctx.username, s.ctx.activeProject).state;
    const logAt = (re) => s.logs().split('\n').findIndex(l => re.test(l));
    return { ...s, dir, agentCalls: calls, run, state, logAt };
}

test('المسار السعيد: دورة واحدة → الملفات على القرص، مراحل التسليم بترتيبها، وCOMPLETED', async () => {
    const s = kernelScenario('pipe');
    const r = await s.run();

    assert.equal(r.success, true);
    assert.equal(s.agentCalls.coder.length, 1, 'دورة نقاش واحدة');
    assert.equal(s.agentCalls.architect.length, 1);
    assert.equal(s.agentCalls.qa.length, 1);
    assert.equal(s.state(), STATES.COMPLETED);

    // الملفات الثلاثة كُتبت فعلاً (SEO قد يُغني index.html بوسوم — المحتوى الجوهري يبقى)
    for (const f of ['index.html', 'styles.css', 'script.js']) assert.ok(fs.existsSync(path.join(s.dir, f)), f);
    assert.match(fs.readFileSync(path.join(s.dir, 'index.html'), 'utf-8'), /حاسبة الزكاة/);
    assert.match(fs.readFileSync(path.join(s.dir, 'script.js'), 'utf-8'), /rates\[0\]\.rate/);

    // سياق المبرمج: الهدف المُثرى + اللغة + لا انتقادات في الدورة الأولى
    const first = s.agentCalls.coder[0];
    assert.equal(first.lang, 'ar');
    assert.match(first.prompt, /حاسبة زكاة/);
    assert.doesNotMatch(first.prompt, /انتقادات يجب معالجتها/);

    // ترتيب خطّ التسليم كما هو اليوم (خط الأساس للاستخراج)
    const order = [
        /كتابة الشفرة \(دورة 1\/\d+\)/,
        /\[ReviewAgent\]/,
        /\[SEOAgent\]/,
        /\[SecurityAgent\]/,
        /\[GitAgent\].*تم الحفظ/,
        /\[RenderAgent\]/,
        /\[BehaviorVerifier\]/,
        /✨ نجاح/,
    ];
    const idx = order.map(re => s.logAt(re));
    idx.forEach((i, k) => assert.ok(i >= 0, `مرحلة مفقودة: ${order[k]}`));
    for (let k = 1; k < idx.length; k++) assert.ok(idx[k] > idx[k - 1], `ترتيب خاطئ عند ${order[k]}`);

    // المصمّم والمراجع يملكان احتياطاً حتمياً خاصاً (لوحة minimal / درجة جودة إرشادية) — لا صمت
    assert.match(s.logs(), /\[DesignerAgent\]: ✅ Design Brief — minimal palette/);
    assert.match(s.logs(), /\[ReviewAgent\]: .*الجودة: [ABC] \(\d+\/100\)/);
    assert.match(s.logs(), /\[TestingAgent\]: /);
    assert.match(s.logs(), /\[SecurityAgent\]: ✅ Security/);
    // محقّق المتطلبات يبدأ (المخطط الاحتياطي لأداة يحمل مكوّناً وظيفياً) ثم يصمت
    // بغياب المزوّد — لا قائمة تحقق ولا «تخطّي» (verifyRequirements تُرجع null)
    assert.match(s.logs(), /\[Requirements\]: 📋 التحقق من تنفيذ متطلبات المشروع/);
    assert.doesNotMatch(s.logs(), /متطلب منفّذ|تخطّي التحقق/);
    assert.doesNotMatch(s.logs(), /\[BackendAgent\]/, 'needsBackend=false → لا مرحلة خلفية');
    // تقرير التسليم للمستخدم
    assert.match(s.replies().join('\n'), /اكتملت المهمة — تقرير التسليم/);
    assert.ok(s.events.some(e => e.ev === 'stream_done'));
});

test('رفض المعماري في الدورة الأولى → دورة ثانية تحمل النقد في الـprompt ثم نجاح', async () => {
    const s = kernelScenario('pipe2', {
        architect: (n) => n === 1 ? { approved: false, feedback: 'الهيدر بلا تنقّل واضح' } : { approved: true, feedback: '' },
    });
    const r = await s.run();
    assert.equal(r.success, true);
    assert.equal(s.agentCalls.coder.length, 2, 'دورتان');
    assert.match(s.agentCalls.coder[1].prompt, /انتقادات يجب معالجتها/);
    assert.match(s.agentCalls.coder[1].prompt, /الهيدر بلا تنقّل واضح/);
    assert.match(s.logs(), /رُفض من 1 متخصص/);
    assert.match(s.logs(), /كتابة الشفرة \(دورة 2\/\d+\)/);
});

test('رفض الجودة يسجّل دروساً للمنصة بأسباب الرفض الحرفية', async () => {
    resetLessons();
    try {
        const s = kernelScenario('pipe3', {
            qa: (n) => n === 1 ? { passed: false, logs: ['DOCTYPE مفقود', 'alt مفقود في الصور'] } : { passed: true, logs: [] },
        });
        await s.run();
        const keys = topLessons(10).filter(l => l.type === 'qa_failure').map(l => l.key);
        assert.ok(keys.includes('doctype مفقود'), keys.join(','));
        assert.ok(keys.includes('alt مفقود في الصور'));
    } finally { resetLessons(); }
});

test('فشل المبرمج في كل الدورات → يستنفد الدورات ثم FAILED برسالة أسباب صادقة ودرس debate_exhausted', async () => {
    resetLessons();
    try {
        const s = kernelScenario('pipe4', { coder: () => ({ error: true, details: 'رد غير صالح' }) });
        const r = await s.run();
        assert.equal(r.success, false);
        assert.equal(s.state(), STATES.FAILED);
        assert.ok(s.agentCalls.coder.length >= 3, `استُهلكت الدورات (${s.agentCalls.coder.length})`);
        assert.equal(s.agentCalls.architect.length, 0, 'لا نقّاد بلا خطة');
        assert.match(s.logs(), /فشل بناء الموقع بعد \d+ محاولة/);
        assert.match(s.logs(), /\[CODER_ERROR\] رد غير صالح/);
        assert.match(s.logs(), /درس مسجَّل: debate_exhausted/);
        assert.match(s.replies().join('\n'), /❌|⛔|تعذّر|فشل/);
    } finally { resetLessons(); }
});

test('عطل مزوّد دائم من المبرمج → إيقاف فوري بلا حرق الدورات الباقية، ودرس ai_unavailable', async () => {
    resetLessons();
    try {
        const s = kernelScenario('pipe5', {
            coder: () => { const e = new Error('خدمة الذكاء الاصطناعي غير متاحة حالياً'); e.aiUnavailable = true; throw e; },
        });
        const r = await s.run();
        assert.equal(r.success, false);
        assert.equal(s.agentCalls.coder.length, 1, 'دورة واحدة فقط — لا عبث بالدورات الباقية');
        assert.equal(s.state(), STATES.FAILED);
        assert.match(s.logs(), /⛔ خدمة الذكاء الاصطناعي غير متاحة/);
        assert.match(s.logs(), /درس مسجَّل: ai_unavailable/);
    } finally { resetLessons(); }
});

test('رد بلا ملفات → إعادة المحاولة بدرس CODER_EMPTY_RESPONSE في النقد، ثم نجاح', async () => {
    const s = kernelScenario('pipe6', { coder: (n) => n === 1 ? { files: [] } : { files: PLAN_FILES() } });
    const r = await s.run();
    assert.equal(r.success, true);
    assert.equal(s.agentCalls.coder.length, 2);
    assert.match(s.logs(), /لم يتم استخراج أي ملفات من رد النموذج/);
    assert.match(s.agentCalls.coder[1].prompt, /CODER_EMPTY_RESPONSE/);
});

test('مشروع يحتاج خادماً: فريق الخلفية يسقط بلا مزوّد → المولّد التقليدي يكتب api/ ويحدّث script.js، ثم قاعدة بيانات', async () => {
    const calls = { generateBackend: [], integrate: [] };
    const s = kernelScenario('pipe7', {
        extraAgents: {
            needsBackend: () => true,
            generateBackend: async (goal, frontendContext) => {
                calls.generateBackend.push({ goal, frontendContext });
                return { success: true, files: [{ name: 'api/items.js', content: 'export default function handler(req,res){res.json([]);}' }] };
            },
            generateFrontendAPIIntegration: async (goal, files, script) => {
                calls.integrate.push({ goal, files, script });
                return `${script}\n// API: /api/items`;
            },
        },
    });
    const r = await s.run();
    assert.equal(r.success, true);
    assert.equal(s.state(), STATES.COMPLETED);

    // المولّد التقليدي استُدعي مرة بسياق الواجهة الحقيقي من القرص، والتكامل مرة بملفاته
    assert.equal(calls.generateBackend.length, 1);
    assert.match(calls.generateBackend[0].frontendContext, /--- index\.html ---/);
    assert.equal(calls.integrate.length, 1);
    assert.equal(calls.integrate[0].files[0].name, 'api/items.js');
    assert.match(calls.integrate[0].script, /rates\[0\]\.rate/);

    // على القرص: ملف الـAPI، script.js المحدَّث، اتصال قاعدة البيانات، ووثيقة الفريق
    assert.match(fs.readFileSync(path.join(s.dir, 'api', 'items.js'), 'utf-8'), /res\.json/);
    assert.match(fs.readFileSync(path.join(s.dir, 'script.js'), 'utf-8'), /\/\/ API: \/api\/items/);
    assert.ok(fs.existsSync(path.join(s.dir, 'api', 'db.js')), 'api/db.js');
    assert.ok(fs.existsSync(path.join(s.dir, '.env.example')), '.env.example');
    // حقيقة اليوم (لا تصميم): وثيقة الفريق تُكتب حتى حين لا يُنجز أحد
    assert.match(fs.readFileSync(path.join(s.dir, 'BACKEND_TEAM.md'), 'utf-8'), /0\/7 وكيل أنجز/);
    assert.ok(!fs.existsSync(path.join(s.dir, 'prisma')), 'لا Prisma لهدف بلا كلمات علاقية');
    assert.ok(!fs.existsSync(path.join(s.dir, 'login.html')) && !fs.existsSync(path.join(s.dir, 'api', 'auth.js')), 'لا مصادقة لهدف بلا كلماتها');

    // ترتيب الخلفية داخل خطّ التسليم: بعد Git وقبل Render
    const order = [
        /\[GitAgent\].*تم الحفظ/,
        /\[BackendAgent\]: ⚙️ المشروع يحتاج خادماً/,
        /\[BackendTeam\]: 🏛️ Backend Architect يعمل/,
        /\[BackendTeam\]: ⚠️ Backend Architect: /,
        /\[BackendTeam\]: ⏭️ Backend Debug Agent/,
        /\[BackendVerify\]: ✅ الكود المولّد اجتاز الفحص/,
        /\[BackendAgent\]: ✅ تم توليد 1 ملف \(api\/items\.js\)/,
        /\[BackendAgent\]: 🔗 تم تحديث script\.js/,
        /\[DatabaseAgent\]: 🗄️ جاري توليد قاعدة البيانات/,
        /\[DatabaseAgent\]: ✅ mongodb — 2 ملف/,
        /\[RenderAgent\]/,
        /✨ نجاح/,
    ];
    const idx = order.map(re => s.logAt(re));
    idx.forEach((i, k) => assert.ok(i >= 0, `سطر مفقود: ${order[k]}`));
    for (let k = 1; k < idx.length; k++) assert.ok(idx[k] > idx[k - 1], `ترتيب خاطئ عند ${order[k]}`);
    assert.doesNotMatch(s.logs(), /\[PostgresAgent\]|\[AuthAgent\]|تعذّر توليد الخادم|خطأ في BackendAgent/);
});
