// 🎯 PM/5 — «النموذجُ إلى المصمّم والخلفيّة» (`PRODUCT_MIND.md`): الفهمُ الذي بُني في PM/1 وأُغني في PM/4
// كان يصل الكودرَ والمحقّقَ ولا يصل **مَن يقرّر الشكلَ والبيانات**. المصمّمُ لا يراه أصلاً، والخلفيّةُ
// تشتقّ نوعَ المشروع من بريف التصميم باحتياطَين مكتوبَين: 'business' و'ecommerce'. و'ecommerce'
// **مفتاحٌ موجود** في `PRISMA_SCHEMAS` — فنظامُ تاكسي بلا نوعٍ في البريف كان يأخذ Product/OrderItem/Review
// حتميّاً بلا مزوّد. وأعمقُ من ذلك: `catch` في المولّد الديناميكيّ كان يعيد مخطّطَ المتجر نفسَه صامتاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { modelProjectType, normalizeProjectModel } from '../agents/projectModel.js';
import { matchBlueprint, referenceModel } from '../agents/referenceBlueprints.js';
import { generatePrismaSetup } from '../agents/postgresAgent.js';
import { generateDesignBrief } from '../agents/designerAgent.js';
import { runBackendStage } from '../agents/stages/backend.js';
import { runDesigner } from '../agents/stages/designer.js';
import { setDomainModel } from '../agents/projectMemory.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const refModel = (goal) => normalizeProjectModel(referenceModel(matchBlueprint(goal)));

test('نوعُ المشروع من الفهم: مفهومان دالّان فأكثر، والتعادلُ يُكسر باسمٍ مستقرّ، و«لا أعرف» جوابٌ صحيح', () => {
    assert.equal(modelProjectType(refModel('نظام إدارة وتشغيل تاكسي')), 'travel', 'رحلة + حجز');
    assert.equal(modelProjectType({ roles: [{ name: 'نزيل' }], entities: [{ name: 'غرفة' }, { name: 'حجز' }] }), 'hotel');
    assert.equal(modelProjectType({ roles: [{ name: 'مريض' }], entities: [{ name: 'طبيب' }, { name: 'زيارة' }] }), 'medical');
    // 🔎 الحدود الرقميّة على حدّها: مطابقةٌ واحدة لا تكفي مهما تعدّدت المفاهيم
    assert.equal(modelProjectType({ entities: [{ name: 'غرفة' }, { name: 'رحلة' }] }), null,
        'غرفةٌ (فندق ١) ورحلةٌ (سفر ١) — لا توقيعَ بلغ اثنتين');
    assert.equal(modelProjectType({ roles: [], entities: [{ name: 'غرفة' }] }), null);
    // التعادلُ يُكسر باسمٍ مستقرّ لا بترتيب المصفوفة: طبيبٌ + مريضٌ يطابقان clinic وmedical معاً
    assert.equal(modelProjectType({ roles: [{ name: 'مريض' }], entities: [{ name: 'طبيب' }] }), 'clinic',
        'التعادلُ للأصغر اسماً — clinic قبل medical');
    // والأدوارُ تُقرأ لا الكياناتِ وحدَها: «نزيل» دورٌ، وبدونه «غرفة» وحدَها لا تكفي
    assert.equal(modelProjectType({ roles: [{ name: 'نزيل' }], entities: [{ name: 'غرفة' }] }), 'hotel');
    assert.equal(modelProjectType({ roles: [], entities: [{ name: 'غرفة' }] }), null, 'بلا الدورِ لا حكم');
    assert.equal(modelProjectType({ roles: [{ name: 'User' }], entities: [{ name: 'Item' }] }), null, 'العامُّ لا يسمّي نوعاً');
    assert.equal(modelProjectType(null), null);
    assert.equal(modelProjectType({}), null);
});

test('المصمّمُ يقبل تلميحَ النوع: الفهمُ يغلب كشفَ الكلمات، وبلا تلميحٍ يبقى الكشفُ كما كان', async () => {
    const goal = 'منصّة لإدارة الوحدات والمستأجرين وعقود الإيجار';
    const typeOf = async (hint) => (await generateDesignBrief(goal, 'pm5a', 'p', 'ar', hint)).brief.projectType;
    const withoutHint = await typeOf(undefined);
    assert.equal(await typeOf('hotel'), 'hotel', 'التلميحُ يغلب');
    assert.notEqual(withoutHint, 'hotel', 'وبدونه الكشفُ بالكلمات');
    // تلميحٌ لا يعرفه ملفُّ القواعد لا يُفرض
    assert.equal(await typeOf('not-a-real-type'), withoutHint, 'تلميحٌ مجهول يسقط للكشف');
});

test('Prisma: نوعٌ بلا قالبٍ وبلا مزوّد لا يُسلَّم — لا يُكتب مخطّطُ متجرٍ لمشروعٍ ليس متجراً', async () => {
    const r = await generatePrismaSetup('نظام إدارة وتشغيل تاكسي', 'travel');
    assert.equal(r.success, false, 'كان يعود بـtrue فوق Product/OrderItem/Review');
    assert.deepEqual(r.files, []);
    assert.ok(r.reason.includes('travel') && r.reason.includes('لا مخطّطَ Prisma'), r.reason);
    assert.doesNotMatch(JSON.stringify(r), /Product|OrderItem|Review/, 'ولا أثرَ لمفردات المتجر');
    // والأنواعُ التي لها قوالبُ تبقى كما كانت تماماً
    for (const t of ['ecommerce', 'hotel', 'medical']) {
        const ok = await generatePrismaSetup('مشروع', t);
        assert.equal(ok.success, true, t);
        assert.ok(ok.files.some((f) => f.name === 'prisma/schema.prisma'), t);
    }
});

test('الحدود: النوعُ يُشتقّ بالدليل في ثلاث مراتب، والاحتياطُ ليس نوعاً مكتوباً', () => {
    const bk = fs.readFileSync(path.join(HERE, '../agents/stages/backend.js'), 'utf8');
    assert.match(bk, /function resolveType\(context\) \{/);
    assert.equal((bk.match(/resolveType\(context\)/g) || []).length, 3, 'التعريفُ ونداءان (القاعدة وPrisma)');
    assert.ok(bk.includes('|| detectProjectType(context.originalGoal);'), 'آخرُ المراتب: الهدفُ نفسُه');
    assert.ok(!/\|\| 'ecommerce'/.test(bk) && !/\|\| 'business'/.test(bk), 'لا نوعَ مكتوباً احتياطاً');
    const pg = fs.readFileSync(path.join(HERE, '../agents/postgresAgent.js'), 'utf8');
    assert.ok(!/return PRISMA_SCHEMAS\.ecommerce/.test(pg), 'الاحتياطُ الصامتُ في catch أُزيل');
    const ds = fs.readFileSync(path.join(HERE, '../agents/stages/designer.js'), 'utf8');
    assert.ok(ds.includes('modelProjectType(getDomainModel('), 'المصمّمُ يرى الفهم');
    // 🔎 الضمانُ الذي حلّ محلّ إسقاط العامّ: لا توقيعَ يحوي مفهوماً عامّاً أصلاً
    const pm = fs.readFileSync(path.join(HERE, '../agents/projectModel.js'), 'utf8');
    const sigs = pm.slice(pm.indexOf('const TYPE_SIGNATURES = ['), pm.indexOf('];', pm.indexOf('const TYPE_SIGNATURES = [')));
    for (const g of ['user', 'item', 'employee']) assert.ok(!sigs.includes(`'${g}'`), `توقيعٌ يحوي المفهومَ العامّ «${g}»`);
});

const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const TAXI_UNDERSTANDING = { roles: [{ name: 'راكب' }, { name: 'سائق' }], entities: [{ name: 'رحلة' }, { name: 'حجز' }], flows: [] };

test('المصمّحُ في المرحلة: الفهمُ المخزّن يقرّر النوعَ والسطرُ يقول إنّه من الفهم؛ وبلا فهمٍ يقول إنّه من الكلمات', async () => {
    const s = scenario('pm5d'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, TAXI_UNDERSTANDING);
    const { events, reporter } = collect();
    await runDesigner({ ...s.ctx, projectPath: emptyProject(), goal: 'ابنِ ما طلبتُ', mentalModel: {} }, s.ctx.roomName, reporter);
    const line = logs(events).find((m) => m.includes('✅ Design Brief'));
    assert.match(line, /النوع: travel \(من الفهم\)/, line);

    const t = scenario('pm5e'); setUserLanguage(t.ctx.username, 'ar');
    const u = collect();
    await runDesigner({ ...t.ctx, projectPath: emptyProject(), goal: 'مطعم البحر للمأكولات البحرية', mentalModel: {} }, t.ctx.roomName, u.reporter);
    assert.match(logs(u.events).find((m) => m.includes('✅ Design Brief')), /\(من كلمات الهدف\)/);
});

test('الخلفيّةُ في المرحلة: البريفُ يغلب الفهمَ، والفهمُ يغلب كشفَ الهدف، وفشلُ Prisma يُقال لا يُبتلع', async () => {
    const s = scenario('pm5b'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, TAXI_UNDERSTANDING);
    const goal = 'نظام تشغيل تاكسي مع قاعدة بيانات postgres';
    const agents = { needsBackend: () => true, generateBackend: async () => ({ success: false, files: [], error: 'لا مزوّد' }) };

    // الفهمُ (travel) لا قالبَ له → يُقال إنّه لم يُولَّد، ولا يُكتب مخطّطُ متجر
    const { events, reporter } = collect(); const dir = emptyProject();
    await runBackendStage({ ...s.ctx, projectPath: dir, goal, originalGoal: goal, plan: { files: [] }, mentalModel: {} }, s.ctx.roomName, agents, reporter);
    const warn = logs(events).find((m) => m.includes('لم يُولَّد Prisma'));
    assert.ok(warn, logs(events).join('\n'));
    assert.ok(warn.includes('travel') && warn.includes('لم يُكتب قالبُ مجالٍ آخر'), warn);
    assert.ok(!fs.existsSync(path.join(dir, 'prisma', 'schema.prisma')), 'لا مخطّطَ مجالٍ آخر على القرص');

    // والبريفُ يغلب: نوعٌ له قالبٌ → يُكتب فعلاً
    const b = collect(); const dir2 = emptyProject();
    await runBackendStage({ ...s.ctx, projectPath: dir2, goal, originalGoal: goal, plan: { files: [] }, mentalModel: { designBrief: { projectType: 'hotel' } } }, s.ctx.roomName, agents, b.reporter);
    assert.ok(logs(b.events).some((m) => m.includes('✅ PostgreSQL + Prisma')), logs(b.events).join('\n'));
    assert.ok(fs.existsSync(path.join(dir2, 'prisma', 'schema.prisma')));

    // وبلا فهمٍ ولا بريف: الهدفُ نفسُه يُقرأ — «متجر» له قالبٌ فيُكتب
    const t = scenario('pm5c'); setUserLanguage(t.ctx.username, 'ar');
    const c = collect(); const dir3 = emptyProject();
    const shop = 'متجر إلكتروني مع قاعدة بيانات postgres';
    await runBackendStage({ ...t.ctx, projectPath: dir3, goal: shop, originalGoal: shop, plan: { files: [] }, mentalModel: {} }, t.ctx.roomName, agents, c.reporter);
    assert.ok(logs(c.events).some((m) => m.includes('✅ PostgreSQL + Prisma')), 'الهدفُ دليلٌ حين يصمت ما قبله');
});
