// 🏷️ PM/11 — «الاسمُ الحرفيّ للمنتج»: الكلمةُ التي ترفع فيتو الفهم في اختيار الكلون (PM/1) يجب أن تكون
//   (١) كلمةً كاملة — لا «جرد» داخل «مجرد» (كان `includes`)؛
//   (٢) تسميةَ منتجٍ لا عبارةَ مسار — «كاشير/نقطة بيع/pos/صيدلية» تسمّي منتجاً؛ «نظام إدارة/سيستم داخلي» لا.
//       كان `isTrackPhrase` يقرأ `SYSTEM_INTENT_RE` كلَّه فيبتلع ١١٦ من ٦٤٦ كلمةَ كلون — كلَّ أسماء منتجات السيستم؛
//   (٣) من رأس الوثيقة (ما قبل أوّل بندٍ مرقّم) لا من متنها — وثيقةُ مكتبةٍ من ١٠ بنود صارت كلونَ نقاط بيع بكلمة «إيصال» في البند ١٠.
//   والمخطّطُ الاحتياطيّ يسمّي التطبيقَ برأس الوثيقة مقطوعاً على حدّ كلمة — لا بأوّل ستّين حرفاً وفيها سطرٌ جديد و«1.».
process.env.MISSION_LEDGER_PATH = `${process.env.TMPDIR || '/tmp'}/jaola-product-naming-${process.pid}.json`;
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
const HERE = import.meta.dirname;
const { matchCloneTemplateDetailed, isTrackPhrase, getCloneById, listClones } = await import('../agents/cloneTemplates/index.js');
const { specHead, numberedSections } = await import('../agents/textNormalizer.js');
const { generateBlueprint } = await import('../agents/appBlueprint.js');
const { deriveProjectModel } = await import('../agents/projectModel.js');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { setDomainModel, clearProjectMemory } = await import('../agents/projectMemory.js');
const { resetProjectState } = await import('../agents/stateMachine.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const POS_SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const POS_HEAD = POS_SPEC.split('\n')[0];
const LIB_SPEC = `أريد بناء نظام إدارة مكتبة عامة متكامل للاستخدام الفعلي.

1. الأعضاء: تسجيل الأعضاء وبطاقة عضوية ورقم عضو.
2. الكتب: فهرس الكتب بالعنوان والمؤلف والتصنيف ورقم ISBN.
3. الإعارة: إعارة كتاب لعضو بتاريخ استحقاق.
4. الإرجاع: إرجاع الكتاب وحساب الغرامة عند التأخير.
5. الحجز: حجز كتاب معار حالياً وإشعار العضو عند توفره.
6. البحث: بحث موحد في الكتب والأعضاء.
7. التقارير: أكثر الكتب إعارة والأعضاء المتأخرون.
8. الصلاحيات: أمين مكتبة ومدير وعضو.
9. الإعدادات: مدة الإعارة وقيمة الغرامة اليومية.
10. الطباعة: طباعة بطاقة العضو وإيصال الإعارة.`;
const APP = { kind: 'webapp', category: 'business' };
const understood = async (text) => { const bp = await generateBlueprint(text); return { bp, model: await deriveProjectModel(text, bp) }; };

test('isTrackPhrase: عبارةُ المسار ما لا يبقى منها شيءٌ بعد كلمات المسار العامّة — «كاشير/نقطة بيع/pos/صيدلية/إدارة مصنع» تسمّي منتجاً؛ وما يبتلعه من كلمات الكلونات ينزل من ١١٦', () => {
    for (const t of ['نظام إدارة', 'نظام ادارة', 'سيستم داخلي', 'سيستم', 'نظام داخلي', 'نظام إداري', 'management system', 'internal system']) assert.equal(isTrackPhrase(t), true, t);
    for (const p of ['كاشير', 'نقطة بيع', 'pos', 'صيدلية', 'محاسبة', 'إدارة مصنع', 'رواتب', 'إدارة عقارات', 'مستودع', 'تاكسي', 'مخزون', 'erp', 'hr']) assert.equal(isTrackPhrase(p), false, p);
    assert.equal(isTrackPhrase(''), false, 'الفارغُ ليس عبارةَ مسار — «كلُّ كلماتها من المسار» على لا كلمةَ فيها صحيحةٌ منطقاً وكاذبةٌ هنا');
    const swallowed = listClones().flatMap(m => (getCloneById(m.id).keywords || []).filter(isTrackPhrase));
    assert.ok(swallowed.length <= 12, `كلماتُ الكلونات التي تُعدّ عبارةَ مسار: ${swallowed.length} — ${swallowed.join('، ')}`);
    assert.ok(swallowed.every(k => !/كاشير|بيع|صيدل|محاسب|مصنع|رواتب|عقار|مستودع/.test(k)), swallowed.join('، '));
});

test('الكلمةُ كلمةٌ كاملة: رأسُ وثيقة نقاط البيع وحدَه → كلونُ نقاط البيع باسمه (كاشير/نقطة بيع) — لا ERP بـ«جرد» داخل «مجرد»', async () => {
    const { bp, model } = await understood(POS_SPEC);
    const r = matchCloneTemplateDetailed(POS_HEAD, bp, model, { track: 'system' });
    assert.equal(r.clone?.id, 'jaola-pos', JSON.stringify({ reason: r.reason, rejected: r.rejected.map(x => x.id) }));
    assert.ok(r.clone.matchReason.hits.includes('كاشير') && r.clone.matchReason.hits.includes('نقطة بيع'), r.clone.matchReason.hits.join('/'));
    assert.equal(r.clone.matchReason.explicit, true, 'اسمُ المنتج الحرفيّ يرفع الفيتو (الأدوارُ ٥٠٪ فقط)');
    assert.ok(!r.rejected.some(x => x.id === 'jaola-pos'));
    const bare = matchCloneTemplateDetailed('نظام لمتابعة الإنتاج وليس مجرد عرض', APP, null, { track: 'system' });
    assert.ok(!(bare.clone?.matchReason?.hits || []).includes('جرد'), `«مجرد» ليست «جرد»: ${JSON.stringify(bare.clone?.matchReason)}`);
    // والسندُ الثانويّ (أسماءُ نموذج الفهم) بالحدود نفسِها: «مبيعات» ليست «بيع» — وكانت تعبر بوّابةَ «دليلٍ كافٍ»
    // (كلمةٌ واحدة + مجموع ≥ ٢) فتُبنى من كلون المتجر بلا كلمةٍ من المستخدم أصلاً.
    const ECOM = { kind: 'webapp', category: 'ecommerce' };
    assert.equal(matchCloneTemplateDetailed('اكمل', ECOM, { roles: [{ name: 'Admin' }], entities: [{ name: 'مبيعات' }], flows: [] }).clone, null);
    assert.equal(matchCloneTemplateDetailed('اكمل', ECOM, { roles: [{ name: 'Admin' }], entities: [{ name: 'بيع' }], flows: [] }).clone?.id, 'jaola-store',
        'الكلمةُ الكاملة في النموذج تبقى سنداً — الحدُّ لم يُسقط مطابقةً صحيحة');
});

test('الوثيقةُ تُسمّي منتجَها في رأسها: وثيقةُ مكتبةٍ من ١٠ بنود لا تصير نقاطَ بيعٍ بكلمة «إيصال» في البند ١٠ — لا كلون (رُفض بالفهم)؛ ووثيقةُ نقاط البيع تبقى نقاطَ بيع باسمها', async () => {
    const lib = await understood(LIB_SPEC);
    assert.ok(numberedSections(LIB_SPEC) >= 3);
    const r = matchCloneTemplateDetailed(LIB_SPEC, lib.bp, lib.model, { track: 'system' });
    assert.equal(r.clone, null, JSON.stringify(r.clone?.matchReason));
    assert.equal(r.reason, 'rejected-by-understanding');
    const pos = r.rejected.find(x => x.id === 'jaola-pos');
    assert.deepEqual(pos, { id: 'jaola-pos', missingRoles: ['member'] }, 'نقاطُ البيع بلا عضو — و«إيصال» في المتن لا ترفع الفيتو');
    const p = await understood(POS_SPEC);
    const rp = matchCloneTemplateDetailed(POS_SPEC, p.bp, p.model, { track: 'system' });
    assert.equal(rp.clone?.id, 'jaola-pos'); assert.equal(rp.clone.matchReason.explicit, true);
    assert.ok(rp.clone.matchReason.hits.includes('كاشير'), rp.clone.matchReason.hits.join('/'));
});

test('specHead: ما قبل أوّل بندٍ مرقّم — الجملةُ كما هي، والوثيقةُ رأسُها، والقائمةُ المرقّمة من أوّلها بلا رأس', () => {
    assert.equal(specHead(POS_SPEC), POS_HEAD);
    assert.equal(specHead(LIB_SPEC), 'أريد بناء نظام إدارة مكتبة عامة متكامل للاستخدام الفعلي.');
    assert.equal(specHead('متجر عطور بسلة'), 'متجر عطور بسلة');
    assert.equal(specHead('1. أحمر\n2. أزرق'), '');
    assert.equal(specHead(''), '');
});

test('المخطّطُ الاحتياطيّ يسمّي التطبيقَ برأس الوثيقة مقطوعاً على حدّ كلمة — لا سطرَ جديد ولا «1.» ولا كلمةً مبتورة', async () => {
    const lib = await generateBlueprint(LIB_SPEC);
    assert.equal(lib._source, 'fallback');
    assert.equal(lib.appType, 'أريد بناء نظام إدارة مكتبة عامة متكامل للاستخدام الفعلي.');
    const pos = await generateBlueprint(POS_SPEC);
    assert.ok(!pos.appType.includes('\n') && pos.appType.length <= 61, pos.appType);
    assert.ok(pos.appType.endsWith('…'), pos.appType);
    const stem = pos.appType.slice(0, -1);
    assert.ok(POS_HEAD.startsWith(stem) && POS_HEAD[stem.length] === ' ', `قطعٌ على حدّ كلمة: «${pos.appType}»`);
    assert.equal(pos.appType, 'أريد منك بناء نظام كاشير ونقطة بيع POS System متكامل وقابل…');
});

test('المسارُ كاملاً: وثيقةُ المكتبة → لا كلونَ نقاط بيع؛ حلقةُ التسليم تبنيها، والسطرُ «🧭» يسمّيها برأسها', async () => {
    const s = scenario('pm11lib'); setUserLanguage(s.ctx.username, 'ar');
    await clearProjectMemory(s.ctx.username, s.ctx.activeProject); // ذاكرةُ المشروع تُحفَظ على القرص باسم المستخدم — لا وراثةَ من جولةٍ سابقة
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
    const HTML = `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>المكتبة</title><link rel="stylesheet" href="styles.css"></head>
<body><main><h1>نظام المكتبة</h1><ul id="list"></ul><input id="q"><button id="add">أضف</button></main><script src="script.js"></script></body></html>`;
    const JS = `const books=[{title:'كتاب'}];const ul=document.getElementById('list');function render(f=''){ul.innerHTML='';books.filter(b=>b.title.includes(f)).forEach(b=>{const li=document.createElement('li');li.textContent=b.title;ul.appendChild(li);});}
document.getElementById('q').addEventListener('input',e=>render(e.target.value));document.getElementById('add').addEventListener('click',()=>{books.push({title:'جديد'});render();});render();`;
    const agents = {
        getState: () => null,
        coreGenerateCodePlan: async () => ({ files: [{ name: 'index.html', content: HTML }, { name: 'styles.css', content: 'body{margin:0}' }, { name: 'script.js', content: JS }] }),
        architectReview: async () => ({ approved: true, feedback: '' }),
        qaVerify: async () => ({ passed: true, logs: [] }),
        needsBackend: () => false,
    };
    try {
        const r = await s.rt._runMissionNow(LIB_SPEC, createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents }));
        assert.equal(r.clone, undefined, 'لا كلون');
        assert.equal(r.success, true);
        assert.doesNotMatch(s.logs(), /قالب jaola عامل|اختيارٌ بالفهم/);
        assert.match(s.logs(), /\[AppAnalyzer\]: 🧭 أريد بناء نظام إدارة مكتبة عامة متكامل للاستخدام الفعلي\. — تطبيق تفاعلي/);
        assert.match(s.logs(), /استُبعد بالفهم: .*jaola-pos \(بلا member\)/);
        // PM/13: النوعُ صار صادقاً (`saas` لا `construction` — «بناء» كانت تُقرأ صناعةَ مقاولات)، وnظامُ إدارةٍ من
        // الأنواع الكبيرة، فالمسارُ React/Next لا الحلقةَ الفانيلا. البناءُ من وثيقته لا من كلونٍ — وهو المقصود هنا.
        assert.match(s.logs(), /🧰 مشروع كبير → React\/Next/, 'نظامُ إدارةٍ (saas) مشروعٌ كبير');
        assert.doesNotMatch(s.replies().join('\n'), /نقطة بيع|كاشير/);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});
