// ➕ `stages/addPage.js#addPageNow(instruction, projectPath, username, activeProject, roomName, lang, reporter, ops)` — JCR/23.
//
// `jcrAddPage` (٣) يوصّف التفرّدَ والمساراتِ ذاتَ المعنى عبر المفوِّض، و`addPageFallback` (٢) الاحتياطَ مستبدِلاً `_runMissionNow`
// على النسخة. هذا الملفّ يوصّف ما لم يكن موصَّفاً من الجسد (الملفّاتُ الأربعة المكتوبة، الموقعُ الثابت، البثُّ بترتيبه، الذاكرةُ
// والقياسات، الرسالةُ بلغتها) و**الشقَّ** `{ runMission }`، ثمّ التكافؤَ مع المفوِّض والحدود.
//
// حتميٌّ بلا نموذجٍ لغويّ: `generateSectionContent` يمرّ بـ`smartChat` الذي يرمي بلا مفتاح — محاطٌ بـ`try` → القسمُ الافتراضيّ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { addPageNow } from '../agents/stages/addPage.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;

function nextProject(sections = {}, routes = [{ label: 'الرئيسية', href: '/' }], { nav = true } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addpage-stage-'));
    for (const d of ['lib', 'components', 'app']) fs.mkdirSync(path.join(dir, d), { recursive: true });
    if (nav) { fs.writeFileSync(path.join(dir, 'components/Navbar.jsx'), 'export default function Navbar(){return null}\n'); fs.writeFileSync(path.join(dir, 'components/Footer.jsx'), 'export default function Footer(){return null}\n'); }
    const content = { brand: 'مطعم البحر', hero: { title: 'أهلاً' }, sections, routes };
    fs.writeFileSync(path.join(dir, 'lib/content.js'), `export const content = ${JSON.stringify(content, null, 2)};\n`);
    return dir;
}
const readContent = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'lib/content.js'), 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''));
const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

let seq = 0;
function harness() {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const missions = [];
    const ops = { runMission: async (goal, ctx) => { missions.push({ goal, ctx }); return { success: true, via: 'rebuild' }; } };
    // الاسمُ موسومٌ بالوقت: الذاكرةُ والقياساتُ على القرص تبقى بين الجولات.
    const user = `__addstage_u${seq}_${Date.now()}__`, proj = `addstage-${seq}`, room = `addstage_room_${seq}`;
    const run = (dir, instruction, lang = 'ar') => addPageNow(instruction, dir, user, proj, room, lang, reporter, ops);
    const ev = (name) => events.filter((e) => e.ev === name).map((e) => e.payload);
    return { run, events, ev, missions, user, proj, room, reporter, io };
}

test('الإضافة: أربعةُ ملفّاتٍ تُكتب (المحتوى، المكوّن، صفحة Next، الموقع الثابت)، والوجهةُ تُلحَق، والقسمُ افتراضيٌّ بلا ذكاء', async () => {
    const dir = nextProject({ Hero: {} });
    try {
        const h = harness();
        const r = await h.run(dir, 'أضف صفحة من نحن');
        assert.deepEqual(r, { success: true, addedPage: 'about', label: 'من نحن' });
        const content = readContent(dir);
        assert.deepEqual(content.routes.at(-1), { label: 'من نحن', href: '/about' });
        assert.ok(content.sections.About?.heading, 'القسمُ الافتراضيّ له عنوان');
        assert.ok(fs.existsSync(path.join(dir, 'components/About.jsx')));
        const page = fs.readFileSync(path.join(dir, 'app/about/page.jsx'), 'utf8');
        assert.match(page, /Navbar/); assert.match(page, /Footer/); assert.match(page, /About/);
        assert.ok(fs.existsSync(path.join(dir, 'about.html')), 'الموقعُ الثابت أُعيد توليدُه بالصفحة الجديدة');
        assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /about\.html/, 'شريطُ التنقّل في الرئيسية يحمل الوجهةَ الجديدة');
        // البثّ بترتيبه: حالتان للوكلاء تحيطان بالعمل، ثمّ المعاينة والقياسات والملفّات ثمّ الردّ بزرَّيه الثلاثة.
        assert.deepEqual(h.events.map((e) => e.ev), ['agent_states', 'log', 'log', 'agent_states', 'preview_updated', 'project_metrics', 'workspace_files', 'chat_reply']);
        assert.deepEqual(h.ev('agent_states')[1], { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        assert.ok(h.ev('workspace_files')[0].includes('about.html'));
        assert.equal(h.ev('project_metrics')[0].totalEdits, 1, 'عدّادُ التعديلات يُحدَّث قبل البثّ');
        const reply = h.ev('chat_reply')[0];
        assert.match(reply.message, /✅ أضفت صفحة \*\*من نحن\*\* \(`about\.html`\)/);
        assert.deepEqual(reply.options, ['➕ أضف صفحة أخرى', '✏️ عدّل محتواها', '🚀 انشر الآن']);
        assert.ok(getProjectMemory(h.user, h.proj).history.some((x) => x.action === 'إضافة صفحة: من نحن'), 'الذاكرةُ تؤرّخ الإضافة');
        assert.equal(h.missions.length, 0);
    } finally { cleanup(dir); }
});

test('بلا Navbar/Footer: صفحةُ Next تحمل المكوّنَ وحدَه؛ وبالإنجليزيّة الردُّ إنجليزيّ والرئيسيةُ الافتراضيّة "Home" حين لا وجهات', async () => {
    const dir = nextProject({}, undefined, { nav: false });
    try {
        fs.writeFileSync(path.join(dir, 'lib/content.js'), `export const content = ${JSON.stringify({ brand: 'x', sections: {} })};\n`);
        const h = harness();
        const r = await h.run(dir, 'add a page for pricing', 'en');
        assert.equal(r.success, true); assert.equal(r.label, 'pricing');
        const page = fs.readFileSync(path.join(dir, `app/${r.addedPage}/page.jsx`), 'utf8');
        assert.doesNotMatch(page, /Navbar|Footer/);
        assert.deepEqual(readContent(dir).routes[0], { label: 'Home', href: '/' }, 'routes غائبة → تُنشأ بالرئيسية بلغة النداء');
        const reply = h.ev('chat_reply')[0];
        assert.match(reply.message, /^✅ Added page \*\*pricing\*\*/);
        assert.deepEqual(reply.options, ['➕ Add another page', '✏️ Edit its content', '🚀 Deploy now']);
    } finally { cleanup(dir); }
});

test('التفرّد: وجهةٌ في routes بلا قسمٍ يقابلها (محتوىً حُرّر يدويّاً) → المسارُ يُلحَق بلاحقة، والمكوّنُ باسمه الأوّل', async () => {
    // `existingSlugs` من routes و`existingComps` من sections — مصدران قد يفترقان؛ حلقةُ المسار تُمسك ما فات حلقةَ المكوّن.
    const dir = nextProject({}, [{ label: 'الرئيسية', href: '/' }, { label: 'قديمة', href: '/about' }]);
    try {
        const h = harness();
        const r = await h.run(dir, 'أضف صفحة من نحن');
        assert.equal(r.addedPage, 'about-2'); assert.ok(fs.existsSync(path.join(dir, 'components/About.jsx')));
        assert.ok(fs.existsSync(path.join(dir, 'app/about-2/page.jsx')));
        assert.deepEqual(readContent(dir).routes.at(-1), { label: 'من نحن', href: '/about-2' });
    } finally { cleanup(dir); }
});

test('الشقّ: تعذّرُ المحتوى → ops.runMission(instruction, ctx مجمَّد من الوسائط) وناتجُه يُعاد كما هو — بعد حالةِ الوكلاء وسطرَي السجلّ', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addpage-empty-'));
    try {
        const h = harness();
        const r = await h.run(dir, 'أضف صفحة الأسعار');
        assert.deepEqual(r, { success: true, via: 'rebuild' });
        assert.equal(h.missions.length, 1); assert.equal(h.missions[0].goal, 'أضف صفحة الأسعار');
        assert.deepEqual(h.missions[0].ctx, { username: h.user, activeProject: h.proj, projectPath: dir, roomName: h.room, agents: {}, dbStatus: null });
        assert.ok(Object.isFrozen(h.missions[0].ctx));
        assert.deepEqual(h.events.map((e) => e.ev), ['agent_states', 'log', 'log']);
        assert.match(h.ev('log')[1].message, /⚠️ تعذّر قراءة المحتوى — عودة للبناء: /);
        assert.ok(!fs.existsSync(path.join(dir, 'lib')), 'لا كتابةَ على مشروعٍ لم يُقرأ');
    } finally { cleanup(dir); }
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — بثّاً وقرصاً وناتجاً، واستبدالُ _runMissionNow على النسخة يصل عبر ops', async () => {
    const a = nextProject({ Hero: {} }); const b = nextProject({ Hero: {} });
    try {
        const free = harness();
        const viaFree = await free.run(a, 'أضف صفحة اتصل بنا');
        const events = [];
        const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
        let rebuilds = 0; rt._runMissionNow = async () => { rebuilds += 1; };
        const viaClass = await rt._addPageNow('أضف صفحة اتصل بنا', b, `__addstage_cls_${Date.now()}__`, 'addstage-cls', 'addstage_room_cls', 'ar');
        assert.deepEqual(viaFree, viaClass);
        const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload?.message === 'string' ? e.payload.message : (Array.isArray(e.payload) ? [...e.payload].sort() : null)]);
        assert.deepEqual(shape(free.events), shape(events));
        for (const f of ['lib/content.js', `components/${viaFree.addedPage[0].toUpperCase()}`, `${viaFree.addedPage}.html`]) {
            if (f.startsWith('components/')) continue;
            assert.equal(fs.readFileSync(path.join(a, f), 'utf8'), fs.readFileSync(path.join(b, f), 'utf8'), f);
        }
        assert.equal(rebuilds, 0);
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'addpage-cls-empty-'));
        try { await rt._addPageNow('أضف صفحة الأسعار', empty, '__addstage_cls2__', 'p', 'r', 'ar'); assert.equal(rebuilds, 1, 'الاستبدالُ على النسخة نافذ'); }
        finally { cleanup(empty); }
    } finally { cleanup(a); cleanup(b); }
});

test('الحدود: لا this، لا استيرادَ من jcr، ops.runMission مرّةً ولا غيرَه، reporter.io واحد، المفوِّضُ بنصّه، واليتيماتُ العشر غائبةٌ عن jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/addPage.js'), 'utf8');
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    const count = (re) => (code.match(re) || []).length;
    assert.equal(count(/ops\.runMission\(/g), 1); assert.equal(count(/\bops\.\w+/g), 1, 'لا نداءَ على ops غيرَ runMission');
    assert.equal(count(/reporter\.io\b/g), 1); assert.equal(count(/reporter\.liveLog\(/g), 3); assert.equal(count(/reporter\.send\(/g), 6);
    assert.equal(count(/\bextractPageName\(/g), 1);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _addPageNow(instruction, projectPath, username, activeProject, roomName, lang) {
        return addPageNow(instruction, projectPath, username, activeProject, roomName, lang, this.reporter, {
            runMission: (goal, c) => this._runMissionNow(goal, c),
        });
    }\n`), 'المفوِّضُ سطرُ نداءٍ واحد بدالّةٍ مربوطةٍ بالنسخة');
    assert.ok(jcr.includes("import { addPageNow } from './stages/addPage.js';"));
    for (const n of ['autoPushIfEnabled', 'buildStaticSite', 'compName', 'componentSource', 'defaultSection', 'generateSectionContent', 'pageFileSource', 'slugify', 'snapshotWorkspace', 'writeProjectFile']) {
        assert.ok(!new RegExp(`\\b${n}\\b`).test(jcr.replace(/^\s*\/\/.*$/gm, '')), `${n} ما زال في jcr`);
    }
    // `pushProject` كان هنا يومَ JCR/23 — خرج بعدها مع نوايا CEO (JCR/24)؛ القائمةُ تتبع القياس.
    for (const n of ['smartChat', 'createExecutionContext', 'extractPageName', 'projectPathOf', 'writePlanFiles']) {
        assert.ok(new RegExp(`\\b${n}\\b`).test(jcr), `${n} بقي له مستهلكٌ في jcr`);
    }
});
