// 🧩 PM/6 — الاحتياطُ يقرأ معجمَه: بلا نموذجٍ لغويّ كان الفهمُ `User/Item` لكلِّ طلبٍ بلا فئةٍ مجدولة، بينما
// `conceptsInText` (PM/3) على النصّ نفسِه ترى المنتج. قِيس على مواصفة نقاط البيع: ١٦ مفهوماً ← دورٌ واحد وكيانٌ واحد،
// وأربعُ متطلّباتٍ عامّة لأربعةٍ وأربعين بنداً، و`domain-fidelity` معطَّل (`applicable: false`).
//
// الدرسُ من PM/5 مطبَّقٌ هنا من البداية: الدالّةُ النقيّة **والمرحلةُ التي تستهلكها** معاً — `understandGoal` تخزّن
// النموذجَ وتبثّ ملخّصَه، و`composeRequirements` تقرؤه، و`domainFidelity` تُحاكِم إليه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { conceptFrequencies, lexiconModel, deriveProjectModel, domainFidelity, conceptsInText, mergeProjectModel } from '../agents/projectModel.js';
import { composeRequirements } from '../agents/requirementsVerifier.js';
import { understandGoal } from '../agents/stages/understand.js';
import { getDomainModel, setDomainModel } from '../agents/projectMemory.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const BP = { kind: 'webapp', category: 'business', functionalComponents: [{ name: 'الميزة الأساسية التفاعلية' }], _source: 'fallback' };
const names = (list) => (list || []).map((x) => x.name);

test('التكرارُ إشارةُ الأهمّيّة: «منتج» و«فاتورة» أوّلاً في مواصفة نقاط البيع، و«عملة» عابرة — والعامُّ لا يُعدّ', () => {
    const f = conceptFrequencies(SPEC);
    assert.ok(f.get('product') >= 10 && f.get('invoice') >= 10, `${f.get('product')}/${f.get('invoice')}`);
    assert.ok(f.get('product') > f.get('staff') && f.get('staff') > f.get('currency'), 'ترتيبٌ بالتكرار لا بطول المرادف');
    assert.equal(f.has('user'), false, 'المفاهيمُ العامّة لا تُعدّ');
    assert.equal(conceptFrequencies('').size, 0); assert.equal(conceptFrequencies(null).size, 0);
    // عدُّ كلماتٍ كاملة: «طلب» داخل «طلبات» لا يُعدّ مرّتين بمرادفَين مختلفَي الطول إلّا إن كانا مرادفَين فعلاً
    assert.equal(conceptFrequencies('طلب طلب طلب').get('order'), 3);
});

test('نموذجُ المعجم: الأدوارُ والكياناتُ مرتّبةً بالتكرار ثمّ بالاسم، بلا تدفّقات، وفارغٌ لنصٍّ بلا مفاهيم', () => {
    const m = lexiconModel(SPEC);
    assert.equal(m._source, 'lexicon');
    assert.deepEqual(names(m.roles).slice(0, 3), ['staff', 'customer', 'admin'], 'الأكثرُ ذكراً أوّلاً — لا الأطولُ مرادفاً');
    assert.deepEqual(names(m.entities).slice(0, 2), ['product', 'invoice']);
    assert.ok(names(m.roles).includes('admin') && names(m.entities).includes('payment'), 'ما كانت السقوفُ تُسقطه صار في المقدّمة');
    assert.deepEqual(m.flows, []);
    assert.deepEqual(lexiconModel('كيف الحال'), { roles: [], entities: [], flows: [], _source: 'lexicon' });
    // الترتيبُ الثانويّ بالاسم يجعل النتيجةَ حتميّة عند تساوي التكرار
    const tie = lexiconModel('فاتورة منتج');
    assert.deepEqual(names(tie.entities), ['invoice', 'product']);
});

test('الاحتياطُ بلا مزوّد: المواصفةُ تخرج ٤ أدوار و٦ كيانات وتدفّقاً فاعلُه أهمُّ الأدوار — والقصيرُ بلا مفاهيم يبقى User/Item', async () => {
    const m = await deriveProjectModel(SPEC, BP);
    assert.equal(m._source, 'lexicon');
    assert.deepEqual(names(m.roles), ['staff', 'customer', 'admin', 'tenant']);
    assert.deepEqual(names(m.entities), ['product', 'invoice', 'currency', 'payment', 'shift', 'account']);
    assert.deepEqual(m.flows.map((f) => [f.name, f.actor, f.touches]), [['الفعل الأساسي', 'staff', ['product']]], 'التدفّقُ من مكوّنات المخطّط كما كان، وفاعلُه من الفهم لا User المكتوب');
    const plain = await deriveProjectModel('أداة حاسبة زكاة بسيطة', BP);
    assert.deepEqual([plain._source, names(plain.roles), names(plain.entities)], ['fallback', ['User'], ['Item']], 'لا مفاهيمَ → الحدُّ الأدنى القديم بعينه');
    // فئةٌ مجدولة تبقى أولى من المعجم — جدولُ المطعم منسَّقٌ بيد إنسان
    const rest = await deriveProjectModel(SPEC, { ...BP, category: 'restaurant' });
    assert.equal(rest._source, 'fallback'); assert.ok(names(rest.roles).includes('Customer'));
});

test('الدمجُ بعد PM/6: مفتاحُ معجمٍ لا يُطفئ لقبَ المرجع ولا وصفَه — والوصفُ الجديدُ غيرُ الفارغ يُحدّث كما كان', () => {
    const ref = { roles: [{ name: 'Admin', description: 'الإدارة' }, { name: 'Passenger', description: 'العميل' }], entities: [{ name: 'Trip', description: 'رحلة' }], flows: [], _source: 'reference' };
    const m = mergeProjectModel(ref, lexiconModel('الإدارة تراجع كلَّ رحلة والمدير يعتمدها'));
    const admin = m.roles.find((r) => r.name.toLowerCase() === 'admin');
    assert.equal(admin.name, 'Admin', 'الاسمُ القائم يبقى — لا admin بالحروف الصغيرة');
    assert.equal(admin.description, 'الإدارة', 'الوصفُ الفارغُ من المعجم لا يمحو وصفَ المرجع (طفرةٌ نجت حتّى كُتب هذا)');
    assert.equal(m.roles.length, 2, 'لا تكرارَ للدور نفسِه بحالتَين');
    const upd = mergeProjectModel(ref, { roles: [{ name: 'admin', description: 'مدير النظام' }], entities: [], flows: [] });
    assert.equal(upd.roles.find((r) => r.name === 'Admin').description, 'مدير النظام', 'وصفٌ جديدٌ غيرُ فارغ يُحدّث القائمَ كما كان الدمجُ يعد');
});

test('المستهلكون: ١٢ متطلّباً مسمّى بدل ٤، وdomain-fidelity يصير قابلاً للتطبيق بلا مفقود — المعجمُ يرى ما يُطلب', async () => {
    const m = await deriveProjectModel(SPEC, BP);
    const reqs = composeRequirements(BP, m);
    assert.equal(reqs.length, 12, reqs.map((r) => r.name).join(' | '));
    assert.ok(reqs.some((r) => r.name === 'شاشة staff') && reqs.some((r) => r.name === 'بيانات invoice'));
    const fid = domainFidelity(m, SPEC);
    assert.equal(fid.applicable, true); assert.deepEqual(fid.missing, []); assert.equal(fid.contaminated, false);
    assert.ok(fid.expected.length >= 8, `متوقَّع: ${fid.expected.length}`);
});

test('المرحلةُ تستهلكه: understandGoal على المواصفة يخزّن الفهمَ المعجميّ ويبثّ ملخّصاً بأربعة أدوار — لا «1 كيان (Item) • 1 دور (User)»', async () => {
    const s = scenario('lexund');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] }); // لا وراثةَ من جولةٍ سابقة
    const logs = []; const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => { if (ev === 'log') logs.push(p.message); } }) });
    await understandGoal(SPEC, { ...s.ctx, projectPath: emptyProject() }, reporter);
    const stored = getDomainModel(s.ctx.username, s.ctx.activeProject);
    assert.ok(names(stored.roles).includes('staff') && names(stored.entities).includes('invoice'), JSON.stringify({ r: names(stored.roles), e: names(stored.entities) }));
    assert.ok(!names(stored.roles).includes('User'), 'لا User مكتوب حين يرى المعجمُ المنتج');
    const line = logs.find((l) => l.includes('نموذج المشروع:'));
    assert.match(line, /6 كيان/); assert.match(line, /4 دور/);
    assert.ok(!/1 كيان \(Item\)/.test(line), line);
    // وما يراه المعجمُ في النصّ يُغطّيه الفهمُ الآن — الفجوةُ التي كشفها القياسُ أُغلقت من طرفها
    const seen = conceptsInText(SPEC);
    const understood = new Set([...names(stored.roles), ...names(stored.entities)]);
    assert.ok([...understood].every((c) => seen.has(c)), 'كلُّ ما في الفهم منطوقٌ في النصّ');
});
