// 🧭 حارسُ السجلَّين — Sprint 4d
//
// العطب: الكشفُ يُرجع نوعاً من `knowledge/design-rules.json`، والقالبُ يأتي من
// `TEMPLATE_LIBRARY`. سجلّان مختلفان، ولا شيء يربطهما. فنوعٌ في الأوّل بلا قالبٍ
// في الثاني كان يُسلَّم قالبَ business تحت ترويسةٍ تحمل اسمَه، وأقسامُ business
// تُعلَن «الأقسام المطلوبة» له.
//
// الحارسُ مُشتقٌّ من السجلَّين نفسيهما: لا قائمةَ أنواعٍ مكتوبةً هنا تتقادم.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getAvailableTemplates, getTemplate, hasTemplate, buildTemplateContext,
} from '../agents/templateLibrary.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ruleTypes = Object.keys(
    JSON.parse(fs.readFileSync(path.join(root, 'knowledge/design-rules.json'), 'utf8')).types,
);

test('الاشتقاقُ ليس فارغاً — حارسٌ لا يجد سجلَّين يمرُّ فراغاً', () => {
    assert.ok(ruleTypes.length >= 20, `أنواعُ design-rules: ${ruleTypes.length}`);
    assert.ok(getAvailableTemplates().length >= 20, `أنواعُ المكتبة: ${getAvailableTemplates().length}`);
});

test('كلُّ نوعٍ يكشفه المحرّك: إمّا له قالبُه، وإمّا يقول السياقُ إنّه بلا قالب', () => {
    // 🔴 لا نسأل `hasTemplate` هنا: هو الدالّةُ محلَّ الفحص، ولو كذبت لصار
    //    جسمُ الحلقة غيرَ قابلٍ للبلوغ فمرَّ الاختبارُ فراغاً (طفرةٌ نجت فعلاً).
    //    الحقيقةُ تُشتقُّ من السجلّ نفسِه.
    const registry = new Set(getAvailableTemplates());
    const lying = [];
    for (const type of ruleTypes) {
        if (registry.has(type)) continue;
        const ctx = buildTemplateContext(type);
        // النوعُ بلا قالب: يجب ألّا يدّعي السياقُ قالباً له، وألّا يفرض أقسامَ غيره
        if (!ctx.includes('لا قالبَ جاهزاً') || ctx.includes('### الأقسام المطلوبة:')) {
            lying.push(type);
        }
    }
    assert.deepStrictEqual(lying, [],
        `أنواعٌ يدّعي السياقُ لها قالباً لا تملكه: ${lying.join(', ')}`);
});

test('النوعُ ذو القالب يُسلَّم قالبَه هو، لا بديلاً', () => {
    const business = getTemplate('business');
    const wrong = getAvailableTemplates()
        .filter((t) => t !== 'business' && getTemplate(t).css_vars === business.css_vars);
    assert.deepStrictEqual(wrong, [], `قوالبُ تُسلَّم لوحةَ business: ${wrong.join(', ')}`);
});

test('hasTemplate يوافق السجلَّ — لا يُصدَّق على نفسه', () => {
    const registry = new Set(getAvailableTemplates());
    const disagree = [...new Set([...ruleTypes, ...registry])]
        .filter((t) => hasTemplate(t) !== registry.has(t));
    assert.deepStrictEqual(disagree, [], `hasTemplate يخالف السجلَّ في: ${disagree.join(', ')}`);
});

test('`tool` هو النوعُ الذي كشف العطب — يبقى مقيساً لا مفترضاً', () => {
    // لا يُثبَّت وجودُ الفجوة: إن أُضيف قالبُ tool غداً فالحارسُ يقبل الحالتين،
    // وإنّما يُثبَّت أنّ السياق صادقٌ أيّاً كانت.
    const ctx = buildTemplateContext('tool');
    const inRegistry = getAvailableTemplates().includes('tool');   // لا `hasTemplate`
    if (inRegistry) assert.ok(ctx.includes('قالب tool'));
    else assert.ok(ctx.includes('لا قالبَ جاهزاً'), 'tool بلا قالبٍ والسياقُ لا يعترف');
});
