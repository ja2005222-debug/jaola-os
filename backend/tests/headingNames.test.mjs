// 🏷️ «فطرحتُه وبنيتُ على عناوينك أنت» — التسميةُ من عناوين صاحب المشروع (PM/23).
//
// كُتب في PM/22 أنّ الاستبدال يحتاج تحليلاً صرفيّاً، لأنّ كلماتِ المتن بالتكرار تخلط صدقاً
// («حفظ، آيات، عادة») بضوضاء («تزامه، بكل، ذهب، أتم») — نحوُ ٥٠٪ نظيفة.
//
// ثمّ قِيس أنّ الإشارةَ في مكانٍ آخر: **رأسُ كلِّ عنوانٍ مرقّم**. صاحبُ المشروع يكتبه اسماً لا
// فعلاً، مجرّداً من لواصق الضمائر — فهو تسميتُه هو لأجزاء منتجه. على ستِّ مواصفات:
//   • رأسُ العنوان    : ١٨/١٩ (٩٥٪)
//   • كلُّ كلمات العنوان: ٢٣/٢٨ (٨٢٪)   ← «الورد **اليوميّ**» صفةٌ لا كيان
//   • التكرارُ في المتن : نحوُ ٥٠٪
//
// وقِيس في المسار الحيّ أنّ البوّابة نفسَها كانت لا تقع أصلاً: مواصفةُ «وِرد» كلُّها تُنتج مفهوماً
// واحداً — `account` — من عبارة «بلا **حساب**»، فينقذ الفهمَ المهلوَسَ من الوصم. أي أنّ علّةَ
// `needsBackend` نفسَها كانت تنخر بوّابةَ الفهم الجديدة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { headingEntityNames, goalFidelity, goalWords, deriveProjectModel } from '../agents/projectModel.js';
import { stripNegated } from '../agents/textNormalizer.js';
import { stripNegated as viaBackendNeed } from '../agents/backendNeed.js';
import { understandGoal } from '../agents/stages/understand.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setDomainModel } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const WIRD_SPEC = `# وِرد — متتبّعُ حفظِ القرآن
تطبيقٌ شخصيٌّ يعمل داخل المتصفّح بلا خادم ولا حساب.

1. الورد اليوميّ
يحدّد الحافظ سورةً وآياتٍ ويسجّل ما حفظ.
2. المراجعة
كلُّ ما حُفظ يعود دورياً للمراجعة.
3. شريط التقدّم
كم جزءاً أُتمّ من الثلاثين.
4. الإعدادات
عددُ الآيات ودورةُ المراجعة.`;

const HALLUCINATED = {
    entities: [{ name: 'Grade' }, { name: 'ForumPost' }, { name: 'account' }],
    roles: [{ name: 'Teacher' }, { name: 'Parent' }],
};

// ─── ١. التسمية من العناوين ─────────────────────────────────────────

test('🔴 رأسُ كلِّ عنوانٍ اسمُ كيان — والوصفُ بعده يسقط', () => {
    assert.deepEqual(headingEntityNames(WIRD_SPEC), ['ورد', 'مراجعه', 'شريط'],
        'إمّا لم يُقرأ رأسُ العنوان، أو دخلت الصفةُ «اليوميّ» كأنّها كيان');
});

test('🔴 عناوينُ إطارِ الوثيقة لا تسمّي منتجاً — «الإعدادات» ليست كياناً', () => {
    const names = headingEntityNames(WIRD_SPEC);
    for (const frame of ['اعدادات', 'الاعدادات', 'غايه', 'شاشات']) {
        assert.ok(!names.includes(frame), `لفظُ إطارٍ صار كياناً: ${frame}`);
    }
});

test('🔴 طلبٌ بلا بنودٍ مرقّمة لا يُسمّي شيئاً — لا عناوينَ فلا تسمية', () => {
    assert.deepEqual(headingEntityNames('اصنع لي متجراً إلكترونياً جميلاً'), []);
});

test('🔴 الأرقامُ العربيّة ليست كلماتٍ — «٢٤٠» ليست كياناً ولا كلمةً دالّة', () => {
    assert.deepEqual(headingEntityNames('1. ٢٤٠ نبضة\nx\n2. السرعة\nx'), ['نبضه', 'سرعه']);
    assert.ok(!goalWords('السرعة من ٤٠ إلى ٢٤٠').includes('٢٤٠'),
        'رقمٌ عربيٌّ مرّ كأنّه كلمةٌ دالّة — الحارسُ يعرف اللاتينيّةَ وحدَها');
});

// ─── ٢. النفيُ يُطوى قبل الحكم — ومصدرُه واحد ──────────────────────

test('🔴 ما نفاه صاحبُ المشروع ليس دليلاً على أنّ طلبَه ينطق به', () => {
    // بلا طيِّ النفي: `account` من «بلا حساب» يسنُد الفهمَ المهلوَس فينجو من الوصم (مقيس حيّاً)
    assert.deepEqual([...new Set(goalFidelity(HALLUCINATED, WIRD_SPEC).supported)], [],
        'أنقذ النفيُ نفسُه فهمَ منتجٍ آخر — وهي علّةُ needsBackend بوجهٍ ثانٍ');
    assert.equal(goalFidelity(HALLUCINATED, WIRD_SPEC).ungrounded, true);
});

test('🔴 وطيُّ النفي مصدرُه واحد — لا نسختان تفترقان', () => {
    assert.equal(viaBackendNeed, stripNegated, 'نسختان لعلّةٍ واحدة — وهي العلّةُ التي وُحّدت من أجلها');
    assert.equal(stripNegated('متجرٌ بلا حساب').includes('حساب'), false);
    assert.equal(stripNegated('متجرٌ بلا تسجيل دخول لكنّ فيه دفعاً').includes('دفع'), true,
        'ابتلع النفيُ الاستدراك');
});

test('🔴 والاحتياطُ لا يفهم ما نفاه صاحبُه — ثالثُ موضعٍ للعلّة نفسِها', async () => {
    // بلا مزوّد يسقط الفهمُ إلى `fallbackModel`، وهي تقرأ المعجمَ على النصّ الخام. فكانت
    // مواصفةُ متتبّعِ الحفظ كاملةً تُنتج كياناً واحداً — `account` من «بلا **حساب**»؛ أي أنّ
    // فهمَ جولا للمنتج كلِّه كان الشيءَ الذي نفاه صاحبُه. (كشفه الجناحُ لا المراجعة.)
    const model = await deriveProjectModel(WIRD_SPEC, null, { chat: async () => { throw new Error('لا مزوّد'); } });
    assert.ok(!model.entities.some(e => e.name === 'account'),
        'صار المنفيُّ كياناً — والاحتياطُ يقرأ ما لم يُطوَ نفيُه');
});

// ─── ٣. المستهلكُ الحيّ ─────────────────────────────────────────────

// 🧪 البذرةُ عبر **ذاكرة المشروع** لا عبر مكتبة الفئة: المكتبةُ مشتركةٌ بين ملفّات الجناح
//    كلِّها ويُعاد ضبطُها في غيرِ هذا الملفّ، فكان الاختبارُ يمرّ منفرداً ويسقط في الجناح
//    (مقيس). وذاكرةُ المشروع معزولةٌ بـ(مستخدم، مشروع) — فالطُّعمُ يملك ما يقيسه.
async function understand(goal, user, seed = null) {
    const events = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push(p?.message ?? p) }) });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm23-'));
    if (seed) setDomainModel(user, 'p', seed);
    const out = await understandGoal(goal, { username: user, activeProject: 'p', roomName: 'r', projectPath: dir }, reporter);
    return { logs: events.map(String).join('\n'), ...out };
}

test('🔴 فهمٌ لا يمسُّ الطلبَ يُطرَح ويحلُّ محلَّه ما سمّاه صاحبُ المشروع — لا يُبنى على المهلوَس', async () => {
    const { logs, domainModelContext } = await understand(WIRD_SPEC, '__pm23_a__', HALLUCINATED);
    assert.match(logs, /بنيتُ على عناوينك أنت/, 'قيل «لا أثق» ثمّ بُني على ما لا يُوثَق به');
    for (const name of ['ورد', 'مراجعه']) {
        assert.ok(domainModelContext.includes(`**${name}**`), `اسمُ صاحب المشروع «${name}» لم يصل البُناة`);
    }
    for (const ghost of ['Grade', 'ForumPost', 'Teacher', 'Parent']) {
        assert.ok(!domainModelContext.includes(ghost), `فهمُ منتجٍ آخر «${ghost}» ما زال يوجّه البناء`);
    }
});

test('🔴 ولا عناوينَ = لا تسمية — يُقال ولا يُختلق بديل', async () => {
    const { logs, domainModelContext } = await understand('أريد أداةً تتابع حفظي للقرآن بلا حساب', '__pm23_b__', HALLUCINATED);
    assert.match(logs, /لا يمسّ طلبَك/, 'صمتَ عن فهمٍ لا يمسّ الطلب');
    assert.doesNotMatch(logs, /بنيتُ على عناوينك/, 'ادّعى تسميةً من عناوينَ لا وجودَ لها');
    assert.ok(domainModelContext.includes('Grade'), 'استُبدل النموذجُ بلا بديلٍ مقيس');
});

test('🔴 والفهمُ الذي يمسُّ الطلبَ لا يُطرَح — لا نُصلح ما لم يُقَس كسرُه', async () => {
    const { logs } = await understand('متجرٌ إلكترونيّ لبيع المنتجات مع سلّةٍ وطلباتٍ وفاتورة', '__pm23_c__');
    assert.doesNotMatch(logs, /لا يمسّ طلبَك|بنيتُ على عناوينك/, 'طُرح فهمٌ مشتقٌّ من الطلب نفسِه');
});

test('🔴 ووجودُ العناوين وحدَه لا يُبيح الطرح — الشرطُ أن يكون الفهمُ بلا أثرٍ في الطلب', async () => {
    // 🧪 الطُّعمُ يعزل شرطَ `ungrounded` وحدَه: مواصفةٌ **بعناوين** (فالتسميةُ ممكنة)، وفهمٌ
    //    **مسنودٌ** فيها («منتج» مذكور) يحمل معه ما لا تذكره العناوين («مخزون»). فلو طُرح الفهمُ
    //    كلَّما أمكنت التسمية لضاع «مخزون». وبلا هذا الطُّعم تمرّ الطفرةُ صامتة (مقيس).
    const SHOP = `# متجرُ الحسن\n\n1. المنتج\nاسمٌ وسعرٌ وصورة.\n2. الفاتورة\nتُصدَر بعد الدفع.`;
    const { logs, domainModelContext } = await understand(SHOP, '__pm23_d__',
        { entities: [{ name: 'منتج' }, { name: 'مخزون' }], roles: [], flows: [] });
    assert.doesNotMatch(logs, /بنيتُ على عناوينك/, 'طُرح فهمٌ مسنودٌ لمجرّد وجود عناوين');
    assert.ok(domainModelContext.includes('**مخزون**'),
        'ضاع ما لم تذكره العناوينُ من فهمٍ صحيح — الطرحُ أوسعُ من العطب');
});
