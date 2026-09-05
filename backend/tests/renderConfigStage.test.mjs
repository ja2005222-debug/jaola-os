// 🚀 خامسُ استخراجٍ من jcr: `_stageRenderConfig` → `stages/renderConfig.js#runRenderConfig`.
// تُنادى بالاسم من `DELIVERY_STAGES`؛ المفوِّضُ يُبقيها (contracts.test يُثبت النموذج).
// هنا: تكافؤٌ ناتجاً وبثّاً وملفّاً، والشكلُ (static/node) من نيّة الهدف مع حفظِ القرار
// في ذاكرة المشروع، والحدود. حارسُ `renderConfigShape` يتبع الموضعَ إلى بيته الجديد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runRenderConfig } from '../agents/stages/renderConfig.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { getProjectMemory } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) }) }; };
const ctxOf = (s, dir, goal) => ({ originalGoal: goal, username: s.ctx.username, activeProject: s.ctx.activeProject, projectPath: dir });
const yamlOf = (dir) => fs.readFileSync(path.join(dir, 'render.yaml'), 'utf8');

test('الدالّةُ الحرّةُ بمُبلِّغٍ مُحقَن ≡ المفوِّضُ — بثّاً وملفّاً', async () => {
    const s = scenario('rcq'); const a = emptyProject(); const b = emptyProject();
    await s.rt._stageRenderConfig(ctxOf(s, a, 'موقع تعريفي لمطعم'), s.ctx.roomName);
    const classEvents = s.events.map((e) => [e.ev, e.payload?.message ?? e.payload]);
    const { events, reporter } = collect();
    await runRenderConfig(ctxOf(s, b, 'موقع تعريفي لمطعم'), s.ctx.roomName, reporter);
    assert.deepEqual(events, classEvents);
    assert.equal(yamlOf(b), yamlOf(a), 'render.yaml حرفاً بحرف');
});

test('الشكلُ من نيّة الهدف: موقعٌ تعريفيّ static وتطبيقٌ بحسابات node — والقرارُ يُحفظ في ذاكرة المشروع', async () => {
    const s = scenario('rcshape'); const dir = emptyProject();
    const { events, reporter } = collect();
    await runRenderConfig(ctxOf(s, dir, 'موقع تعريفي لمطعم'), s.ctx.roomName, reporter);
    assert.match(yamlOf(dir), /env: static/);
    assert.deepEqual(events, [['log', '[5. RUNTIME] ➔ [RenderAgent]: ✅ Render config جاهز — 2 ملف']]);
    assert.equal(getProjectMemory(s.ctx.username, s.ctx.activeProject)?.tech?.hasBackend, false, 'النيّةُ تُحفظ لا تُنسى');

    const t = scenario('rcnode'); const d2 = emptyProject();
    const c2 = collect();
    await runRenderConfig(ctxOf(t, d2, 'تطبيق توصيل طعام مع تسجيل دخول وحسابات'), t.ctx.roomName, c2.reporter);
    assert.match(yamlOf(d2), /env: node/);
    assert.deepEqual(c2.events, [['log', '[5. RUNTIME] ➔ [RenderAgent]: ✅ Render config جاهز — 3 ملف']]);
    const tech = getProjectMemory(t.ctx.username, t.ctx.activeProject)?.tech;
    assert.equal(tech?.hasBackend, true);
    assert.deepEqual(tech?.apis, [], 'الدليلُ من القرص: لا وحدات api');
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد باسم المرحلة، والحارسُ يفحص البيتَ الجديد', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/renderConfig.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _stageRenderConfig\(context, roomName\) \{\n\s+return runRenderConfig\(context, roomName, this\.reporter\);\n\s+\}/);
    for (const n of ['updateTech', 'listApiModules']) assert.equal((jcr.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length, 0, `${n} لم يعد لـjcr به شأن`);
    assert.match(fs.readFileSync(path.join(HERE, '../core/contracts/index.js'), 'utf8'), /run: '_stageRenderConfig'/);
    assert.match(fs.readFileSync(path.join(HERE, 'renderConfigShape.test.mjs'), 'utf8'), /'agents\/stages\/renderConfig\.js'/, 'قائمةُ مسح الحارس تشمل البيتَ الجديد');
});
