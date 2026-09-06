// 📏 قياسُ مواصفةِ نقاطِ البيع (٤٤ بنداً) عبر المسار كاملاً — بأمر المالك «ابدا به».
//
// المواصفةُ في `fixtures/pos_spec.txt` أُعيد تركيبُها من البنود الأربعة والأربعين المسجَّلة (النصُّ الحرفيّ
// لم ينجُ من ضغط السجلّ) — والشكلُ هو ما يُقاس لا الحرف. كلُّ رقمٍ هنا **مقيسٌ لا مُفترَض**، وهذا الملفّ
// يثبّته حتّى لا يعود انطباعاً: ما يفهمه جولا من الوثيقة، وإلى أين يوجّهها، وما يُعلنه عنها.
//
// النتيجةُ المقيسة قبل الإصلاح (2026-09-06): الوثيقةُ كلُّها تذهب إلى **صفحةِ هبوطٍ تسويقيّة** من
// الـRegistry (nav · hero · logos · testimonials · cta) بسبب كلمةٍ واحدة — «شركة» في بند «تعدد المستأجرين» —
// ويُعلَن «✅ اكتمل — صفحة احترافية كاملة» بحكم PASS، وثلاثةٌ من أربعةٍ وثلاثين بنداً لها أثرٌ (ضجيج).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
process.env.MISSION_LEDGER_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-ledger-')), 'mission_ledger.json');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { isMarketingPageGoal } = await import('../agents/blockRegistry.js');
const { isFullSpecification } = await import('../agents/textNormalizer.js');
const { conceptsInText, deriveProjectModel } = await import('../agents/projectModel.js');
const { generateBlueprint } = await import('../agents/appBlueprint.js');
const { matchCloneTemplateDetailed, inferTrack } = await import('../agents/cloneTemplates/index.js');
const { strategyVerdict } = await import('../agents/stages/verify.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const HERE = import.meta.dirname;
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');

function missionScenario(prefix) {
    const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar');
    const strat = { registry: [], clone: [], react: [], kernel: [] };
    s.rt._buildFromRegistry = async (...a) => { strat.registry.push(a); return { success: true, registry: true }; };
    s.rt._buildFromClone = async (clone, ...a) => { strat.clone.push([clone, ...a]); return { success: true, clone: clone.id }; };
    s.rt._buildReactProject = async (...a) => { strat.react.push(a); return { success: true, react: true }; };
    s.rt.runDynamicMultiAgentRuntime = async (context) => { strat.kernel.push(context); return { success: true }; };
    const run = (goal, projectPath) => s.rt._runMissionNow(goal, createExecutionContext({ ...s.ctx, projectPath, agents: {} }));
    const chosen = () => Object.entries(strat).filter(([, v]) => v.length).map(([k]) => k);
    return { ...s, strat, run, chosen };
}

test('الحقيقةُ المقيسة ١: كلمةٌ واحدة («شركة» في بند تعدّد المستأجرين) تجعل وثيقةَ نظامٍ «صفحةً تسويقيّة» — والمعجمُ يرى ١٦ مفهوماً للمنتج', async () => {
    assert.ok(isFullSpecification(SPEC), 'وثيقةٌ لا جملة (≥١٢٠٠ حرفاً و≥٦ بنود)');
    assert.equal(inferTrack(SPEC), 'system', 'والمسارُ سيستم بكلماتها');
    // الاختصارُ التسويقيّ يُصيبها بمطابقةِ احتواءٍ على «شركة» — وهذه هي الكلمةُ بعينها، مقيسةً:
    assert.equal(isMarketingPageGoal(SPEC, { kind: 'webapp' }), true, 'إصابةٌ زائفة قائمة (تُقال كما هي — ديْنٌ مكتوب: نسخةٌ ثانية من قائمةٍ أصلحها appBlueprint)');
    assert.equal((SPEC.match(/شركة/g) || []).length, 2, 'تظهر مرّتين: «كل شركة مستأجر» و«إعدادات الشركة»');
    assert.equal(isMarketingPageGoal(SPEC.replaceAll('شركة', 'جهة'), { kind: 'webapp' }), false, 'بلا «شركة» لا إصابة — فهي اللفظُ الوحيدُ المُصيب من ٢٨');
    const seen = conceptsInText(SPEC);
    assert.ok(seen.size >= 14, `المعجمُ يرى المنتج: ${seen.size} مفهوماً`);
    for (const c of ['product', 'invoice', 'customer', 'payment', 'shift', 'tenant', 'accountant', 'storekeeper']) assert.ok(seen.has(c), c);
});

test('الحقيقةُ المقيسة ٢ (أُغلق نصفُها في PM/6): المخطّطُ الاحتياطيُّ ما زال يسمّي المشروعَ بأوّل ستّين حرفاً — أمّا الفهمُ فصار يقرأ معجمَه', async () => {
    const bp = await generateBlueprint(SPEC);
    assert.equal(bp._source, 'fallback');
    assert.equal(bp.appType, SPEC.slice(0, 60), 'الاسمُ المعروضُ للمستخدم = مستهلُّ الوثيقة — ديْنٌ باقٍ');
    assert.deepEqual(bp.functionalComponents.map(c => c.name), ['الميزة الأساسية التفاعلية'], 'مكوّنٌ واحدٌ عامّ لأربعةٍ وأربعين بنداً');
    // كان: roles ['User'] / entities ['Item'] — الاحتياطُ لا يستشير conceptsInText. PM/6: يستشيرها بترتيب التكرار.
    const model = await deriveProjectModel(SPEC, bp);
    assert.equal(model._source, 'lexicon');
    assert.deepEqual({ roles: model.roles.map(r => r.name), entities: model.entities.map(e => e.name).slice(0, 2) },
        { roles: ['staff', 'customer', 'admin', 'tenant'], entities: ['product', 'invoice'] });
});

test('الحقيقةُ المقيسة ٣: على مسارات الاستراتيجيّة «المتطلّبات» تُتخطّى دائماً — فالحكمُ PASS مهما بلغت الوثيقة', () => {
    const v = strategyVerdict({ filesCount: 3, behavior: { ran: true, ok: true, checks: [{ status: 'pass', name: 'x' }], summary: '1 ✅' } });
    assert.equal(v.status, 'PASS');
    assert.equal(v.gates.find(g => g.name === 'requirements-verify').status, 'skipped', 'لا محقّقَ متطلّبات على هذا المسار — بندٌ واحدٌ أو أربعةٌ وأربعون سواء');
});

test('التوجيه بعد الإصلاح: الوثيقةُ على مجلّدٍ فارغ تذهب إلى كلون نقاط البيع لا إلى صفحة الهبوط — والاختصارُ التسويقيّ لا يسبق الفهم', async () => {
    const s = missionScenario('posm');
    const r = await s.run(SPEC, emptyProject());
    assert.deepEqual(s.chosen(), ['clone'], `المسارُ المختار: ${JSON.stringify(s.chosen())}`);
    assert.equal(r.clone, 'jaola-pos');
    assert.ok(!/JaolaRegistry/.test(s.logs()), 'لا ذكرَ للـRegistry في السجلّ');
    assert.match(s.logs(), /📋 وثيقةٌ\/سيستم — الاختصارُ التسويقيّ لا ينطبق/);
});

test('ولا يُصادَر البروشور: «موقع تعريفي لشركة محاماة» و«صفحة هبوط لمطعم» يبقيان Registry، والجملةُ القصيرة بكلمة «شركة» كما كانت', async () => {
    for (const goal of ['موقع تعريفي لشركة محاماة', 'صفحة هبوط لمطعم بحري']) {
        const s = missionScenario('posb');
        await s.run(goal, emptyProject());
        assert.deepEqual(s.chosen(), ['registry'], goal);
    }
    assert.equal(isMarketingPageGoal('موقع شركة تجارية', { kind: 'brochure' }), true, 'القائمةُ لم تُمَسّ — الديْنُ مكتوبٌ لا مُخفى');
});

test('المقياسُ الحقيقيّ: كلون نقاط البيع يمثّل ١١ من ٣٤ بندَ ميزةٍ بأثرٍ (لا اكتمال) — ويُعلن PASS. هذا الرقمُ هو نقطةُ الانطلاق لا خطُّ النهاية', async () => {
    const { clone } = matchCloneTemplateDetailed(SPEC, { kind: 'webapp', category: 'business' }, { roles: [{ name: 'User' }], entities: [{ name: 'Item' }], flows: [] });
    assert.equal(clone?.id, 'jaola-pos');
    const corpus = clone.files.filter(f => /\.(html|js)$/.test(f.name)).map(f => f.content).join('\n').toLowerCase();
    const FEATURES = [
        ['RBAC/خمسة أدوار', ['مالك', 'مدير الفرع', 'أمين المخزن', 'محاسب']], ['منتجات/فئات/SKU', ['فئة', 'sku', 'وحدة', 'جملة']], ['باركود', ['باركود', 'barcode']],
        ['شاشة الكاشير', ['سلة', 'cart']], ['دفعٌ متعدّد/مقسّم', ['محفظة', 'تحويل', 'مقسّم', 'split']], ['فواتير PDF/ضريبيّة', ['pdf', 'ضريبي']], ['مرتجعات', ['مرتجع', 'refund', 'return']],
        ['دفتر مخزون', ['مخزون', 'stock', 'inventory']], ['مشتريات', ['شراء', 'مشتريات', 'purchase']], ['موردون', ['مورد', 'supplier']], ['عملاء/آجل/ولاء', ['عميل', 'ولاء', 'آجل']],
        ['خصومات/كوبونات', ['خصم', 'كوبون', 'coupon']], ['ضريبة', ['ضريبة', 'vat']], ['درج/وردية', ['وردية', 'shift']], ['لوحة تحكّم', ['dashboard', 'لوحة']], ['تقارير/تصدير', ['تقرير', 'excel', 'تصدير']],
        ['تعدّد فروع', ['فرع', 'branch']], ['تعدّد مستأجرين', ['مستأجر', 'tenant']], ['سجلّ تدقيق', ['تدقيق', 'audit']], ['أوفلاين/مزامنة', ['offline', 'مزامنة', 'sync', 'serviceworker']],
        ['إشعارات', ['إشعار', 'تنبيه', 'notif']], ['بحث موحّد', ['بحث', 'search']], ['UX', ['dir="rtl"', 'keydown', 'dark']], ['أمان', ['bcrypt', 'csrf', 'xss', 'قفل']],
        ['قاعدة بيانات', ['schema', 'prisma', 'migration', 'ترحيل']], ['REST API', ['/api/', 'fetch(']], ['معالجة أخطاء', ['try', 'catch']], ['أداء/ترقيم', ['pagination', 'ترقيم']],
        ['اختبارات', ['test(', 'assert']], ['بيانات أوّليّة', ['seed', 'بيانات تجريبية']], ['تعريب/عملات', ['lang', 'عملة', 'currency']], ['إعدادات', ['settings', 'إعدادات']],
        ['طابعة حراريّة', ['print', 'طباعة', '80mm']], ['معماريّة', ['service', 'layer', 'طبقة']],
    ];
    const present = FEATURES.filter(([, keys]) => keys.some(k => corpus.includes(k.toLowerCase()))).map(([n]) => n);
    assert.equal(FEATURES.length, 34);
    assert.equal(present.length, 11, `أثرٌ في: ${present.join('، ')}`);
    for (const n of ['شاشة الكاشير', 'درج/وردية', 'طابعة حراريّة', 'مرتجعات']) assert.ok(present.includes(n), n);
    for (const n of ['RBAC/خمسة أدوار', 'باركود', 'دفتر مخزون', 'ضريبة', 'تعدّد فروع', 'سجلّ تدقيق', 'موردون', 'مشتريات']) assert.ok(!present.includes(n), `${n} بلا أثر`);
});
