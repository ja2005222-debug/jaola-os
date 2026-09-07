// ✍️ PM/16 — «النموذجُ يصل كاتبَ كلِّ صفحة، لا الدفعةَ وحدَها»: PM/5 أوصل نموذجَ المجال إلى المصمّم والخلفيّة،
// وJCR/19 أوصله إلى كاتب المحتوى **الدفعيّ** (`modelAwareGoal`). لكنّ الكاتبَ **الإفراديّ** — وهو الاحتياطُ الذي
// يقع على كلِّ قسمٍ تركه الدفعيُّ افتراضيّاً، أي أكثرَ الصفحات عرضةً للمحتوى العامّ — يُمرَّر له `goal` الخام.
//
// قِيس بحقن مسجّلٍ مكانَ النموذج اللغويّ (لا مفتاح ولا شبكة): الدفعيُّ يصله ١٣٦٨ حرفاً فيها «أمين المكتبة»
// و«إعارة» و«حجز» و«كتاب»؛ والإفراديُّ ٣٩٦ حرفاً بصفرٍ من الأربعة. وفي `addPage` أسوأ: «سياقُ المشروع» هو
// `content.hero.title` — أي **«ابنِ شيئاً رائعاً»** على سكافولدٍ افتراضيّ، فيُطلب محتوىً «غيرُ عامّ» بأعمِّ سياق.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { addPageNow } from '../agents/stages/addPage.js';
import { setDomainModel } from '../agents/projectMemory.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { transitionState, STATES } from '../agents/stateMachine.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const quiet = () => new RoomReporter({ to: () => ({ emit: () => {} }) });
const MODEL = { roles: [{ name: 'أمين المكتبة' }, { name: 'مدير' }, { name: 'عضو' }],
    entities: [{ name: 'كتاب' }, { name: 'عضو' }, { name: 'إعارة' }, { name: 'حجز' }], flows: [] };
const WORDS = ['أمين المكتبة', 'كتاب', 'إعارة', 'حجز'];

// مسجّلٌ مكانَ النموذج اللغويّ: يحفظ ما وصله ثمّ يفشل — فيبقى المسارُ على احتياطه المعتاد
const recorder = (sink) => async (messages) => { sink.push(messages.map(m => m.content).join('\n')); throw new Error('مسجّل'); };

test('كاتبُ الصفحة الواحدة يعرف مجالَ المشروع كما يعرفه الكاتبُ الدفعيّ', async () => {
    const s = scenario('pm16a'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    setDomainModel(s.ctx.username, s.ctx.activeProject, MODEL);
    const sent = [];
    await buildReactProject('نظام إدارة مكتبة عامة', { ...s.ctx, projectPath: dir },
        { sections: ['الرئيسية', 'الأعضاء', 'الكتب', 'الإعارة'], llm: recorder(sent) }, quiet());
    assert.ok(sent.length >= 2, `نداءاتٌ مسجّلة: ${sent.length} — الدفعيُّ والإفراديُّ`);
    for (const [i, call] of sent.entries()) {
        const missing = WORDS.filter(w => !call.includes(w));
        assert.deepEqual(missing, [], `النداءُ ${i + 1} بلا: ${missing.join('، ')}`);
    }
});

test('إضافةُ صفحةٍ لمشروعٍ قائم: السياقُ مجالُ المشروع لا عنوانُ البطل القالبيّ', async () => {
    const s = scenario('pm16b'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    setDomainModel(s.ctx.username, s.ctx.activeProject, MODEL);
    // مشروعٌ قائمٌ حقيقيّ بلا مزوّد — فعنوانُ بطله يبقى القالبيَّ «ابنِ شيئاً رائعاً»:
    // هي بعينها الحالةُ التي كان يُؤخذ منها «سياقُ المشروع».
    await buildReactProject('نظام إدارة مكتبة عامة', { ...s.ctx, projectPath: dir }, { sections: ['الرئيسية'] }, quiet());
    const before = JSON.parse(fs.readFileSync(path.join(dir, 'lib/content.js'), 'utf8').match(/\{[\s\S]*\}/)[0]);
    assert.equal(before.hero.title, 'ابنِ شيئاً رائعاً', 'خطُّ الأساس: عنوانُ البطل قالبيّ');
    const sent = [];
    await addPageNow('أضف صفحة الإعارة', dir, s.ctx.username, s.ctx.activeProject, 'room', 'ar', quiet(),
        { runMission: async () => ({ success: false }), llm: recorder(sent) });
    assert.equal(sent.length, 1, 'نداءٌ واحدٌ لكاتب الصفحة');
    const missing = WORDS.filter(w => !sent[0].includes(w));
    assert.deepEqual(missing, [], `بلا: ${missing.join('، ')}`);
    assert.doesNotMatch(sent[0], /ابنِ شيئاً رائعاً/, 'عنوانُ البطل القالبيُّ ما زال هو «سياق المشروع»');
});
