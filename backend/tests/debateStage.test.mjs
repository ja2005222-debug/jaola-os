// 🗣️ أوّلُ استخراجٍ من jcr: `_stageDebate` → `stages/debate.js#runDebate`.
//
// اختباراتُ JCR/1 الأربعةَ عشرَ (jcrDebateLoop) تمرّ عبر المفوِّض فتُثبت
// التكافؤ. هذا الملفّ يُثبت ثلاثةَ أشياءَ أُخرى: أنّ الدالّةَ الحرّةَ تُنتج البثَّ
// نفسَه بمُبلِّغٍ مُحقَن بلا صنف، وأنّ التدقيقَ الأمنيّ انتقل سليماً، وأنّ
// الحدودَ صامدة (لا this في الوحدة، لا دورةَ إلى jcr، المفوِّضُ سطرٌ واحد).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runDebate, runSecurityAudit } from '../agents/stages/debate.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { resetLessons } from '../services/platformLessons.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;

function debateInputs(username, activeProject, { rejectFirst = false } = {}) {
    const calls = [];
    const agents = {
        coreGenerateCodePlan: async () => { calls.push('coder'); return { files: [{ name: 'index.html', content: '<h1>{اسم}</h1>' }] }; },
        architectReview: async () => { calls.push('arch'); return calls.filter((c) => c === 'arch').length === 1 && rejectFirst ? { approved: false, feedback: 'عنوانٌ ناقص' } : { approved: true, feedback: '' }; },
        qaVerify: async () => { calls.push('qa'); return { passed: true, logs: [] }; },
    };
    let used = 0;
    const context = {
        goal: 'g', initialCodeContext: '', username, activeProject,
        budget: { maxApiCalls: 5, isExhausted: () => used >= 5, consumeCall: () => (used < 5 ? (++used, true) : false) },
        internalDebate: { criticTranscripts: [] }, mentalModel: { visualIdentity: '', templateSections: [] },
    };
    return { agents, context, calls };
}

test('الدالّةُ الحرّةُ بمُبلِّغٍ مُحقَن تُنتج البثَّ نفسَه الذي يُنتجه المفوِّضُ في الصنف', async () => {
    resetLessons();
    const s = scenario('dbg'); setUserLanguage(s.ctx.username, 'ar');
    const a = debateInputs(s.ctx.username, s.ctx.activeProject);
    const viaClass = await s.rt._stageDebate(a.context, s.ctx.roomName, a.agents);
    const classEvents = s.events.map((e) => [e.ev, e.payload?.message ?? e.payload]);

    const free = []; const reporter = new RoomReporter({ to: (room) => ({ emit: (ev, p) => free.push([ev, p?.message ?? p]) }) });
    const b = debateInputs(s.ctx.username + '_free', s.ctx.activeProject);
    const viaFree = await runDebate(b.context, s.ctx.roomName, b.agents, reporter);

    assert.deepEqual(viaFree, viaClass);
    assert.deepEqual(free, classEvents, 'حدثاً بحدث');
    assert.deepEqual(a.calls, b.calls);
});

test('سطرُ الرفض بحروفه عبر المُبلِّغ المُحقَن — التكافؤُ وحدَه أعمى عن تغيّر النصّ', async () => {
    // طفرةٌ نجت: `Specialists` → `Specialist` مرّت لأنّ اختبارَ التكافؤ يقارن
    // المسارَين ببعضهما، وكلاهما يمرّ في الكود نفسِه. النصُّ الظاهرُ للمستخدم
    // يُثبَّت هنا بحروفه — لا في الاختبار المتماثل.
    resetLessons();
    const events = []; const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) });
    const { context, agents, calls } = debateInputs('dbg_reject', 'p', { rejectFirst: true });
    const plan = await runDebate(context, 'room', agents, reporter);
    assert.ok(plan?.files?.length, 'الدورةُ الثانية تُقبل');
    // الميزانيّةُ ٥ نداءات: السادسُ (QA الثانية) لا يُستهلَك فتُقبل الجودةُ افتراضاً — كما كان.
    assert.deepEqual(calls, ['coder', 'arch', 'qa', 'coder', 'arch']);
    assert.ok(events.some(([ev, m]) => ev === 'log' && m === '[5. RUNTIME] ➔ [Specialists]: ❌ رُفض من 1 متخصص.'), JSON.stringify(events));
    assert.ok(events.some(([ev, m]) => ev === 'log' && m === '[5. RUNTIME & DEBATE] ➔ [Coder]: كتابة الشفرة (دورة 2/5)...'));
    assert.deepEqual(context.internalDebate.criticTranscripts, [{ agent: 'Architect', critique: 'عنوانٌ ناقص' }]);
});

test('runSecurityAudit انتقل سليماً: XSS في index.html وحدَه، وtextContent يعفي', () => {
    assert.equal(runSecurityAudit([{ name: 'index.html', content: 'x.innerHTML = y' }]).isSafe, false);
    assert.match(runSecurityAudit([{ name: 'index.html', content: 'x.innerHTML = y' }]).critique, /XSS/);
    assert.equal(runSecurityAudit([{ name: 'index.html', content: 'x.innerHTML = y; z.textContent = w' }]).isSafe, true);
    assert.equal(runSecurityAudit([{ name: 'script.js', content: 'x.innerHTML = y' }]).isSafe, true, 'غيرُ index.html لا يُفحص — كما كان');
    assert.deepEqual(runSecurityAudit([]), { isSafe: true, critique: '' });
});

test('الحدود: لا this في الوحدة، لا استيرادَ من jcr، والمفوِّضُ في jcr سطرٌ واحد بلا CognitiveCapabilities', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/debate.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // التعليقُ يذكر التاريخ؛ الكودُ لا
    assert.ok(!/\bthis\./.test(code), 'الدالّةُ الحرّة لا تعرف this');
    assert.ok(!/jcr\.js/.test(code), 'لا دورةَ عودةٍ إلى jcr');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(!/CognitiveCapabilities/.test(jcr), 'الكائنُ رحل مع مستهلكه الوحيد');
    assert.match(jcr, /async _stageDebate\(context, roomName, agents\) \{\n\s+return runDebate\(context, roomName, agents, this\.reporter\);\n\s+\}/, 'المفوِّضُ سطرٌ واحد');
    assert.equal((jcr.match(/runSecurityAudit/g) || []).length, 0, 'التدقيقُ لا يُستدعى من jcr مباشرةً');
});
