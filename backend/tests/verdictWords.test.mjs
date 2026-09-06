// ⚖️ PM/10 — «حالةُ المهمّة ≠ حكمُ المنتج» لفظاً أيضاً:
//   (٢) سطرُ النواة الختاميّ كان «✨ نجاح» حتميّاً — يُبثّ قبل «⚖️ الحكم: FAILED» في البناة الثلاثة، وبعد
//       «⚖️ الحكم: UNVERIFIED» في حلقة التسليم — فيقرأ المستخدمُ نجاحاً وفشلاً في سطرين متجاورين.
//   (٣) حكمُ بوّابة السلوك كان يسمّي الفحصَ لا الفجوة («ثغراتٌ باقية: role-coverage») بينما الفحصُ يعرف
//       الأدوارَ الغائبة بأسمائها — فتصل الشاتَ معرّفاتٌ إنجليزيّة لا ما طُلب ولم يُبنَ.
// مقيسٌ على مواصفة نقاط البيع عبر المسار كاملاً بلا مزوّد (PRODUCT_MIND «قياسٌ بعد»).
process.env.MISSION_LEDGER_PATH = `${process.env.TMPDIR || '/tmp'}/jaola-verdict-words-${process.pid}.json`;
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
const HERE = import.meta.dirname;
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { setDomainModel } = await import('../agents/projectMemory.js');
const { resetProjectState } = await import('../agents/stateMachine.js');
const { behaviorOutcome } = await import('../agents/stages/verify.js');
const { kernelOutcomeLine } = await import('../agents/stages/reportMissionSuccess.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const gate = (v, name) => v.gates.find(g => g.name === name);
const lines = (s) => s.logs().split('\n');

test('kernelOutcomeLine: «✨ نجاح» لما اجتاز أو لما لا حكمَ له فقط؛ FAILED/UNVERIFIED يقولان أنّ المهمّةَ اكتملت والمنتجَ لم يجتز/لم يُتحقَّق — والملحقُ يبقى', () => {
    assert.equal(kernelOutcomeLine(null), '✨ نجاح');
    assert.equal(kernelOutcomeLine(undefined, ' (قالب jaola عامل)'), '✨ نجاح (قالب jaola عامل)');
    assert.equal(kernelOutcomeLine({ status: 'PASS' }, ' (إعادة تركيب من Registry)'), '✨ نجاح (إعادة تركيب من Registry)');
    assert.equal(kernelOutcomeLine({ status: 'FAILED' }, ' (قالب jaola عامل)'), '⚠️ اكتملت المهمّة — ولم يجتز المنتجُ التحقّق (قالب jaola عامل)');
    assert.equal(kernelOutcomeLine({ status: 'UNVERIFIED' }), '☑️ اكتملت المهمّة — ولم يكتمل التحقّق');
    assert.equal(kernelOutcomeLine({ status: 'weird' }), '☑️ اكتملت المهمّة — ولم يكتمل التحقّق', 'حالةٌ مجهولة = لم يُتحقَّق، لا نجاح');
});

test('behaviorOutcome: الفجوةُ باسمها لا باسم فحصها — تفصيلُ الفحص حتّى الشرح («—»)، بلا نقطةٍ ختاميّة، والفحصُ بلا تفصيلٍ يبقى باسمه؛ الفاصلُ بين الفحوص «؛» لأنّ التفاصيلَ تحوي «،»', () => {
    const roleGap = { name: 'role-coverage', status: 'fail', detail: 'أدوار بلا واجهة/تمثيل: customer، tenant — النموذج متعدّد الأدوار لكن بعضها غير مبنيّ.' };
    const jsErr = { name: 'no-js-errors', status: 'fail', detail: 'أخطاء JS وقت التشغيل: ReferenceError: x is not defined' };
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [roleGap, { name: 'data-presence', status: 'pass', detail: 'يوجد' }] }),
        { status: 'fail', detail: 'ثغراتٌ باقية: أدوار بلا واجهة/تمثيل: customer، tenant' });
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [jsErr, roleGap] }),
        { status: 'fail', detail: 'ثغراتٌ باقية: أخطاء JS وقت التشغيل: ReferenceError: x is not defined؛ أدوار بلا واجهة/تمثيل: customer، tenant' });
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [{ name: 'wiring-complete', status: 'fail' }, roleGap] }),
        { status: 'fail', detail: 'ثغراتٌ باقية: wiring-complete؛ أدوار بلا واجهة/تمثيل: customer، tenant' });
    const dead = { name: 'interactive-wired', status: 'fail', detail: 'تطبيق تفاعلي بلا أي عنصر تفاعل (أزرار/نماذج/حقول).' };
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [dead] }), { status: 'fail', detail: 'ثغراتٌ باقية: تطبيق تفاعلي بلا أي عنصر تفاعل (أزرار/نماذج/حقول)' }, 'بلا «—»: النقطةُ وحدَها تُسقَط');
    assert.deepEqual(behaviorOutcome({ ran: true, ok: false, checks: [], summary: 'sum' }), { status: 'fail', detail: 'ثغراتٌ باقية: sum' });
});

test('المسارُ كاملاً (كلون نقاط البيع بوثيقة، بلا مزوّد): لا «✨ نجاح» في السجلّ؛ سطرُ النواة يسبق الحكمَ ويقول ما يقول؛ والشاتُ يسمّي الأدوارَ الغائبة لا «role-coverage»', async () => {
    const s = scenario('pm10pos'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
    try {
        const r = await s.rt._runMissionNow(SPEC, createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents: {} }));
        assert.equal(r.clone, 'jaola-pos'); assert.equal(r.verdict.status, 'FAILED');
        const L = lines(s);
        assert.doesNotMatch(s.logs(), /✨ نجاح/, 'لا سطرَ نجاحٍ بجوار حكم FAILED');
        const j = L.findIndex(l => l.includes('[Judge]: ⚖️ الحكم: FAILED'));
        assert.ok(j > 0, s.logs());
        assert.equal(L[j - 1], '[JCOS] ➔ [Kernel]: ⚠️ اكتملت المهمّة — ولم يجتز المنتجُ التحقّق (قالب jaola عامل)');
        assert.equal(gate(r.verdict, 'behavior-verify').detail, 'ثغراتٌ باقية: أدوار بلا واجهة/تمثيل: staff، tenant');
        const msg = s.replies().find(m => m.includes('بدأنا من قالب'));
        assert.match(msg, / • behavior-verify: ثغراتٌ باقية: أدوار بلا واجهة\/تمثيل: staff، tenant\n⚖️ التحقّق: /);
        assert.doesNotMatch(msg, /role-coverage/);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

const HTML = `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>حاسبة الزكاة</title>
<link rel="stylesheet" href="styles.css"></head><body><main><h1>حاسبة الزكاة</h1>
<input id="amount" type="number" placeholder="المبلغ"><button id="calc">احسب</button><p id="out"></p></main>
<script src="script.js"></script></body></html>`;
const JS = `const rates=[{name:'زكاة المال',rate:0.025}];
document.getElementById('calc').addEventListener('click',()=>{const v=Number(document.getElementById('amount').value)||0;document.getElementById('out').textContent=(v*rates[0].rate).toFixed(2);});`;

test('حلقةُ التسليم (بلا مزوّد → UNVERIFIED): السطرُ الختاميّ «☑️ اكتملت المهمّة — ولم يكتمل التحقّق» بعد الحكم — لا «✨ نجاح»', async () => {
    const s = scenario('pm10loop'); setUserLanguage(s.ctx.username, 'ar');
    const agents = {
        getState: () => null,
        coreGenerateCodePlan: async () => ({ files: [{ name: 'index.html', content: HTML }, { name: 'styles.css', content: 'body{margin:0}' }, { name: 'script.js', content: JS }] }),
        architectReview: async () => ({ approved: true, feedback: '' }),
        qaVerify: async () => ({ passed: true, logs: [] }),
        needsBackend: () => false,
    };
    try {
        const r = await s.rt._runMissionNow('أداة حاسبة زكاة بسيطة', createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents }));
        assert.equal(r.success, true); assert.equal(r.verdict.status, 'UNVERIFIED', JSON.stringify(r.verdict));
        const L = lines(s);
        assert.doesNotMatch(s.logs(), /✨ نجاح/, 'لا سطرَ نجاحٍ على حكمٍ لم يكتمل');
        assert.ok(L.findIndex(l => l.includes('⚖️ الحكم: UNVERIFIED')) < L.length - 1);
        assert.equal(L.at(-1), '[JCOS] ➔ [Kernel]: ☑️ اكتملت المهمّة — ولم يكتمل التحقّق');
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});
