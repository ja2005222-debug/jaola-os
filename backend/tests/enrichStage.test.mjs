// 🧩 ثالثُ استخراجٍ من jcr: `_enrichBuildContext` → `stages/enrich.js#enrichBuildContext`،
// ومعها `resolveProjectType` التي كانت تصديراً من jcr (بقيت واجهةً منه بإعادة تصدير).
//
// خطُّ الأساس القائم: jcrRuntimePipeline (المسارُ كاملاً) وjcrMissionStrategy (الهدفُ
// المُثرى يحوي المتطلبات) وjcrRuntime (`resolveProjectType` من jcr). هنا: التكافؤُ بمُبلِّغٍ
// مُحقَن (صورُ picsum مبذورةٌ باسم المشروع فالمقارنةُ حرفيّة)، وسطرُ البثّ بحروفه،
// وهويّةُ إعادة التصدير، ومسارُ الإضافات الذي لا تطرقه بقيّةُ الاختبارات، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { enrichBuildContext, resolveProjectType } from '../agents/stages/enrich.js';
import { resolveProjectType as viaJcr } from '../agents/jcr.js';
import { orchestrator } from '../core/PluginOrchestrator.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const GOAL = 'أداة حاسبة بسيطة';
const FALLBACK_BP = { kind: 'webapp', category: 'business', _source: 'fallback' };
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) }) }; };

test('الدالّةُ الحرّةُ بمُبلِّغٍ مُحقَن ≡ المفوِّضُ في الصنف — ناتجاً وبثّاً', async () => {
    const s = scenario('enr'); const dir = emptyProject();
    const viaClass = await s.rt._enrichBuildContext(GOAL, FALLBACK_BP, { ...s.ctx, projectPath: dir });
    const classEvents = s.events.map((e) => [e.ev, e.payload?.message ?? e.payload]);
    const { events, reporter } = collect();
    const viaFree = await enrichBuildContext(GOAL, FALLBACK_BP, { ...s.ctx, username: s.ctx.username + '_free', projectPath: dir }, reporter);
    assert.deepEqual(viaFree, viaClass);
    assert.deepEqual(events, classEvents, 'حدثاً بحدث');
    assert.match(viaFree.requirementsContext, /## تحليل المتطلبات/);
    assert.match(viaFree.imageContext, /picsum\.photos\/seed\//, 'بلا مفتاح صور: picsum مبذورة');
    assert.equal(viaFree.pluginContext, '', 'لا إضافاتٍ محمّلة → لا توجيهات');
});

test('سطرُ البثّ بحروفه — والتكافؤُ وحدَه أعمى عن تغيّر النصّ', async () => {
    const { events, reporter } = collect(); const s = scenario('enrtxt');
    await enrichBuildContext(GOAL, FALLBACK_BP, { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.deepEqual(events, [['log', '[ASSETS] ➔ [ImageService]: 🖼️ جُهزت 6 صور (picsum)']]);
});

test('resolveProjectType: إعادةُ التصدير من jcr هي الدالّةُ نفسُها، والحكمُ لم يتغيّر', () => {
    assert.equal(viaJcr, resolveProjectType, 'مرجعٌ واحد لا نسخة');
    assert.equal(resolveProjectType('متجر عطور', { category: 'ecommerce', _source: 'llm' }), 'ecommerce');
    assert.equal(resolveProjectType('متجر عطور', FALLBACK_BP), 'ecommerce', 'الاحتياطُ لا يُعتمد — كشفُ الكلمات');
});

test('نوعُ المشروع يوجّه المتطلبات: متجرٌ (بمخطّطٍ احتياطيّ) يأخذ متطلباتِ التجارة لا العامّة', async () => {
    // طفرةُ «النوعُ business دائماً» نجت على هدف الأداة (متطلباتُ tool = business)؛ هنا لا تنجو.
    const { reporter } = collect(); const s = scenario('enrtype');
    const r = await enrichBuildContext('متجر عطور', FALLBACK_BP, { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.match(r.requirementsContext, /سلة تسوق تفاعلية/, 'ecommerce عبر كشف الكلمات لا فئةِ الاحتياط');
    assert.match(r.requirementsContext, /صفحة إتمام الشراء/);
});

test('توجيهاتُ وكلاء الإضافات (beforeBuild) تُحقن وتُبثّ — مسارٌ لا تطرقه بقيّةُ الاختبارات', async () => {
    // لا إضافاتٍ في بيئة الاختبار؛ نسجّل واحدةً في السجلّ الحيّ ونزيلها حتماً.
    const name = '__enrich_test_plugin__';
    orchestrator.plugins.set(name, { name, enabled: true, source: 'test', hooks: {
        beforeBuild: ({ goal }) => (goal === GOAL ? 'التزم بلوحة ألوانٍ زرقاء' : { guidance: 'x' }),
    } });
    // إضافةٌ ثانية تعيد كائناً بلا guidance/reply — تُسقطها المصفاة؛ بدونها يُحقن «undefined»
    const mute = name + '_mute';
    orchestrator.plugins.set(mute, { name: mute, enabled: true, source: 'test', hooks: { beforeBuild: () => ({ other: 1 }) } });
    try {
        const { events, reporter } = collect(); const s = scenario('enrplug');
        const r = await enrichBuildContext(GOAL, FALLBACK_BP, { ...s.ctx, projectPath: emptyProject() }, reporter);
        assert.equal(r.pluginContext, '\n## 🔌 توجيهات وكلاء إضافيين (التزم بها):\n- التزم بلوحة ألوانٍ زرقاء');
        assert.ok(events.some(([, m]) => m === '[PLUGINS] ➔ [beforeBuild]: 🔌 شارك 1 وكيل إضافي في التوجيه'), JSON.stringify(events));
    } finally { orchestrator.plugins.delete(name); orchestrator.plugins.delete(mute); }
});

test('الحدود: لا this في الوحدة، لا استيرادَ من jcr، والمفوِّضُ سطرٌ واحد والأسماءُ الثلاثةُ رحلت من jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/enrich.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code), 'الدالّةُ الحرّة لا تعرف this');
    assert.ok(!/jcr\.js/.test(code), 'لا دورةَ عودةٍ إلى jcr');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _enrichBuildContext\(goal, blueprint, ctx\) \{\n\s+return enrichBuildContext\(goal, blueprint, ctx, this\.reporter\);\n\s+\}/);
    assert.match(jcr, /^export \{ resolveProjectType \};$/m, 'إعادةُ التصدير قائمة');
    assert.ok(!/^export function resolveProjectType/m.test(jcr), 'التعريفُ رحل');
    for (const n of ['detectProjectType', 'analyzeRequirements', 'buildRequirementsContext', 'buildImageContext']) {
        assert.equal((jcr.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length, 0, `${n} لم يعد لـjcr به شأن`);
    }
});
