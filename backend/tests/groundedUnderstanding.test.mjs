// 🗣️⚖️ «فهمي لا يمسّ طلبَك» — المقارنةُ المفتوحة (PM/22).
//
// مقيسٌ بعد تجربة `from0`: طُلب متتبّعُ حفظِ قرآن فخرج `Student/Teacher/Parent/Grade/ForumPost`،
// و`normalizeProjectModel` تفحص **شكلَ** النموذج ولا تفحص **صلتَه بالطلب** أبداً.
//
// والأدهى: `domainFidelity` (PM/3) لو طُبّقت على الطلب لما ميّزت — المهلوَسُ والصادقُ كلاهما
// `covered:0`؛ لأنّ معجمَ المفاهيم قائمةٌ **مغلقة** من سبعين مفهوماً تجاريّاً. وقِيس أنّه يرى
// **صفرَ مفاهيمَ في ثمانيةٍ من ثمانيةِ** منتجاتٍ ليست موقعاً تجاريّاً (متتبّعُ حفظ، متتبّعُ عادات،
// بطاقاتُ مذاكرة، يوميّات، مترونوم، مواقيتُ صلاة، ميزانيّةٌ شخصيّة، لعبةُ كلمات)، بينما يرى
// خمسةً لمتجرٍ وخمسةً لعيادة. فكلُّ بوّابات عقل المنتج تصمت هناك، ولا يبقى إلّا التخمينُ بلا رقيب.
//
// فالمقارنةُ هنا مفتوحة: جسرُ المعجم **أو** جسرُ اللفظ — كلماتُ الطلب نفسُها.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { goalFidelity, goalWords, labelledRoleNames } from '../agents/projectModel.js';
import { understandGoal } from '../agents/stages/understand.js';
import { runBehaviorVerifyStage } from '../agents/stages/verify.js';
import { recordGateOutcome } from '../core/contracts/index.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setDomainModel, getDomainModel } from '../agents/projectMemory.js';
import { recordModel, getLibraryModel } from '../agents/modelLibrary.js';
import { workingProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const WIRD = `وِرد — متتبّعُ حفظِ القرآن. يتابع الحافظُ وردَه اليوميّ: يحدّد سورةً وآياتٍ ويسجّل ما حفظ.
كلُّ ما حُفظ يعود دورياً للمراجعة، والأقدمُ حفظاً يسبق. شريطُ التقدّم يبيّن كم جزءاً أُتمّ.`;

// النموذجُ الذي خرج فعلاً في `from0` (من سجلّ المالك)
const HALLUCINATED = {
    entities: [{ name: 'Student' }, { name: 'Grade' }, { name: 'ForumPost' }],
    roles: [{ name: 'Student' }, { name: 'Teacher' }, { name: 'Parent' }],
};
const HONEST = {
    entities: [{ name: 'ورد' }, { name: 'سورة' }, { name: 'مراجعة' }],
    roles: [{ name: 'حافظ' }],
};

// ─── ١. الدالّةُ النقيّة ───────────────────────────────────────────────

test('🔴 فهمُ منتجٍ آخر لا يمسُّ الطلبَ — ولا اسمَ واحدٌ منه له أثرٌ في وصف صاحبِه', () => {
    const f = goalFidelity(HALLUCINATED, WIRD);
    assert.equal(f.supported.length, 0, `عبَر جسراً لا يستحقّه: ${f.supported.join('، ')}`);
    assert.equal(f.ungrounded, true, 'الفهمُ المهلوَس مرّ بلا كلمة — وهو عينُ ما حدث في from0');
});

test('🔴 والفهمُ الصادقُ يمرّ كاملاً — وإلّا فالمقياسُ يقول الشيءَ نفسَه للصادق والكاذب', () => {
    const f = goalFidelity(HONEST, WIRD);
    assert.deepEqual(f.groundless, [], 'أُنذر على فهمٍ صادق');
    assert.equal(f.supported.length, 4);
    assert.equal(f.ungrounded, false);
});

test('🔴 جسرُ المعجم يعبر اللغتين — فمجالٌ معروفٌ بأسماءٍ إنجليزيّة على طلبٍ عربيّ لا يُنذَر', () => {
    const shop = 'متجرٌ إلكترونيّ يعرض المنتجات، وتصل الطلباتُ للبائع، وتُصدَر فاتورة.';
    const f = goalFidelity({ entities: [{ name: 'Product' }, { name: 'Order' }, { name: 'Invoice' }], roles: [] }, shop);
    assert.deepEqual(f.groundless, [], 'الجسرُ المعجميّ لا يعمل: كلُّ بناءٍ إنجليزيِّ التسمية سيُنذَر كاذباً');
    assert.equal(f.ungrounded, false);
});

test('🔴 والمهلوَسُ يُلتقَط على المجال المعروف أيضاً — لا على الغريب وحدَه', () => {
    const shop = 'متجرٌ إلكترونيّ يعرض المنتجات، وتصل الطلباتُ للبائع، وتُصدَر فاتورة.';
    assert.equal(goalFidelity({ entities: [{ name: 'Grade' }], roles: [{ name: 'Teacher' }] }, shop).ungrounded, true);
});

test('🔴 سندٌ جزئيٌّ ليس انعدامَ سند — الفهمُ يُوسَّع أحياناً بما لم يُذكَر نصّاً', () => {
    // نموذجٌ صادقٌ يسمّي ما في الطلب («ورد») ويضيف ما استنبطه («Streak», «Setting»)؛
    // لو حكمنا بـ«كلُّ الأسماء مسنودة» لأنذرنا على كلِّ فهمٍ أغنى من حرفِ الطلب.
    const f = goalFidelity({ entities: [{ name: 'ورد' }, { name: 'Streak' }, { name: 'Setting' }], roles: [] }, WIRD);
    assert.equal(f.supported.length, 1, 'الطُّعمُ لا يعزل: لا بدّ من مسنودٍ واحدٍ بالضبط');
    assert.equal(f.ungrounded, false, 'إنذارٌ على فهمٍ مسنودٍ جزئياً — والحكمُ «لا يمسّ» لا «لم يستوعب»');
});

test('🔴 الأسماءُ العامّةُ لا تُحسَب دليلاً ولا تُهمةً — `User`/`Item` لا تسمّي منتجاً', () => {
    const f = goalFidelity({ entities: [{ name: 'Item' }], roles: [{ name: 'User' }] }, WIRD);
    assert.deepEqual(f.names, [], 'العامُّ دخل الميزان');
    assert.equal(f.ungrounded, false, 'فهمٌ عامٌّ صار «لا يمسّ الطلب» — إنذارٌ في كلّ بناءٍ احتياطيّ');
});

test('🔴 واسمٌ واحدٌ لا يكفي للحكم — الواحدُ يُصادَف (عتبةُ domainFidelity نفسُها)', () => {
    const f = goalFidelity({ entities: [{ name: 'Teacher' }], roles: [] }, WIRD);
    assert.equal(f.applicable, false);
    assert.equal(f.ungrounded, false);
});

test('🔴 لا نصَّ طلبٍ = لا حكم — القياسُ بلا مُدخَلٍ يقول «لا أستطيع» لا «مُدان»', () => {
    for (const empty of ['', '   ', null, undefined]) {
        const f = goalFidelity(HALLUCINATED, empty);
        assert.equal(f.applicable, false, `حكمٌ على نصٍّ فارغ (${JSON.stringify(empty)})`);
        assert.equal(f.ungrounded, false, 'فهمٌ أُدين لأنّ الطلبَ غائبٌ عن السياق لا لأنّه غريب');
    }
});

test('🔴 كلماتُ الطلب تُسقط ألفاظَ المنصّة وأدواتِ الربط — وإلّا سنَدَ كلَّ فهمٍ لفظُ «تطبيق»', () => {
    const words = goalWords('تطبيقٌ ونظامٌ وموقعٌ فيه صفحةُ حجزٍ من أجل العملاء');
    for (const noise of ['تطبيق', 'نظام', 'موقع', 'صفحه', 'من', 'اجل']) {
        assert.ok(!words.includes(noise), `لفظُ منصّةٍ/ربطٍ بقي كلمةً دالّة: ${noise}`);
    }
    assert.ok(words.includes('حجز') && words.includes('عملاء'), 'أُسقطت الكلماتُ الدالّةُ نفسُها');
});

// ─── ٢. مستهلكٌ حيٌّ: الفهمُ يُعلَن لصاحب المشروع ──────────────────────

// 🧪 مستخدمٌ فريدٌ لكلِّ تشغيل: **ذاكرةُ المشروع تُكتب على القرص وتبقى بين الجولات**،
//    فمستخدمٌ ثابتُ الاسم يرث نموذجَ الجولة السابقة فيُفسد الطُّعم. (قِيس: هذا الاختبارُ سقط
//    بعد PM/24 لا لعطبٍ بل لأنّه ورث تسميةً كتبَتْها جولةٌ سابقة.) وهي علّةُ العزل نفسُها
//    التي وُجدت في مكتبة الفئة — مصدرا حالةٍ مشتركةٍ لا يملكهما الطُّعم.
const freshUser = (tag) => `__${tag}_${process.pid}_${Math.random().toString(36).slice(2, 8)}__`;

// 🔁 #١٩٤ — كان هذا الاختبارُ يقيس أنّ التوريثَ **يُقال**؛ وصار يقيس أنّه **يُمنَع**.
//
//    السببُ مقيسٌ على سجلّ إنتاجٍ حيّ (٢٠٢٦-٠٩-٠٩): منصّةُ جمعيّةٍ خيريّة بُذرت من فئة
//    `business` فورثت `SalesRep/Customer/Company/Interaction/Workspace/MeetingRoom`،
//    و**طُردت** `Donor` و`Donation` و`Volunteer` من فهمِ مشروعها لأنّ سقفَي التطبيع
//    (٦ كيانات / ٤ أدوار) يقصّان الذيل والبذرةُ تُمرَّر أوّلاً. فالإخبارُ وحدَه لم يكن
//    كافياً: صاحبُ المشروع أُخبر، وبُني له مع ذلك على فهمِ منتجٍ لم يطلبه.
//
//    والشرطُ الذي وضعه هذا الاختبارُ نفسُه — «التحذيرُ لا يسمّي ما لا أثرَ له فلا يُفيد
//    قارئَه» — باقٍ كما هو ومقيسٌ أدناه على السطر الجديد: يُسمّى المُسقَطُ لا يُعدّ.
test('🔴 مسارُ التوريث: فهمٌ مسمومٌ في المكتبة لا يُبذَر أصلاً — ويُسمّى ما أُسقط', async () => {
    const goal = 'متتبّعُ حفظِ القرآن: يحدّد الحافظُ سورةً وآياتٍ ويسجّل ما حفظ، وتعود المراجعةُ دورياً.';
    // لا نموذجَ لغويّ في الاختبارات: البذرةُ من المكتبة هي ما يحقن الأسماءَ الغريبة —
    // وهو **عينُ** آليّةِ التراكم التي حمتها PM/22 من الجهة الأخرى.
    recordModel('business', { entities: [{ name: 'Grade' }, { name: 'ForumPost' }], roles: [{ name: 'Teacher' }, { name: 'Parent' }] }, { verified: true });
    const events = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push(p?.message ?? p) }) });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grounded-'));
    const user = freshUser('pm22_u');
    await understandGoal(goal, { username: user, activeProject: 'p', roomName: 'r', projectPath: dir }, reporter);
    // 🧪 سطرُ «🧩 نموذج المشروع» يطبع الأسماءَ نفسَها — فلو قِسنا على السجلّ كلِّه
    //    لمرّ تحذيرٌ فارغٌ من التسمية. القياسُ على سطر التحذير وحدَه (مقيس: الطفرةُ نجت قبله).
    // 🧪 يُقاس **وقوعُ الإنذار وتسميتُه**, لا لفظُه: PM/24 صارت تُسمّي لهذا الطلب من أداة
    //    التعريف («القرآن»، «الحافظ»، «المراجعة») فتغيّر صدرُ الجملة إلى «لم يمسّ». والمقيسُ
    //    هنا أنّ صاحبَ المشروع أُخبر وسُمّي له ما لا أثرَ له — وذلك ثابتٌ في الحالتين.
    const warning = events.map(String).find(l => /ل[ام] يمسّ طلبَك/.test(l));
    assert.ok(warning, 'بُذر فهمُ مدرسةٍ في متتبّعِ حفظٍ وصاحبُ المشروع لم يُخبَر');
    assert.match(warning, /Grade/, 'التحذيرُ لا يسمّي ما لا أثرَ له — فلا يُفيد قارئَه');
    assert.match(warning, /Teacher/);
    // 🚫 وما لا يكفي فيه القولُ: الأسماءُ الغريبةُ **لا تصل النموذجَ** أصلاً، فلا يُبنى عليها.
    //    الطفرةُ التي تُسقط الغربلةَ وتُبقي التحذيرَ وحدَه تُمسك هنا.
    const stored = getDomainModel(user, 'p');
    const names = [...(stored?.entities || []), ...(stored?.roles || [])].map(e => e.name);
    for (const alien of ['Grade', 'ForumPost', 'Teacher', 'Parent']) {
        assert.ok(!names.includes(alien), `${alien} دخل فهمَ متتبّعِ الحفظ رغم الغربلة: ${names}`);
    }
});

test('🔴 والفهمُ الذي يمسُّ الطلبَ يمرّ بلا تحذير — لا ضجيجَ في كلّ بناء', async () => {
    const events = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push(p?.message ?? p) }) });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grounded-ok-'));
    await understandGoal('متجرٌ إلكترونيّ لبيع المنتجات مع سلّةٍ وطلباتٍ وفاتورة', {
        username: freshUser('pm22_ok'), activeProject: 'p', roomName: 'r', projectPath: dir,
    }, reporter);
    assert.doesNotMatch(events.join('\n'), /لا يمسّ طلبَك/, 'إنذارٌ كاذبٌ على فهمٍ مشتقٍّ من الطلب نفسِه');
});

// ─── ٣. مستهلكٌ حيٌّ: المكتبةُ الدائمة لا ترث المهلوَس ─────────────────

/** يُشغّل مرحلةَ التحقّق على **مشروعٍ حقيقيٍّ يعمل** — فيبقى المتغيّرُ الوحيدُ صلةَ الفهم بالطلب. */
async function deposit(category, model, goal, seq) {
    const user = `__pm22_d${seq}__`, project = `p${seq}`;
    setDomainModel(user, project, model);
    const events = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) });
    const context = {
        projectPath: workingProject(), username: user, activeProject: project,
        blueprint: { category }, originalGoal: goal,
    };
    recordGateOutcome(context, 'requirements-verify', 'pass', 'مقيس');
    await runBehaviorVerifyStage(context, 'room', {}, reporter);
    return {
        stored: getLibraryModel(category),
        behavior: context.verdicts['behavior-verify'],
        logs: events.filter(e => e[0] === 'log').map(e => e[1].message).join('\n'),
    };
}

// 🧪 عزلٌ مقصود: كياناتٌ **يمثّلها المشروعُ الحقيقيّ** (صفحةُ مطعمٍ تعمل: «اطلب»، «القائمة»)
//    فيجتاز التحقّقُ السلوكيّ، ولا ذِكرَ لها في طلبِ متتبّعِ الحفظ — فيبقى المتغيّرُ الوحيدُ
//    **صلةَ الفهم بالطلب**. ولو استعملنا `HALLUCINATED` هنا لسقط السلوكُ من تلقائه
//    («أدوارٌ بلا واجهة») فحجب الإيداعَ بغير الشرط المقيس، ومرّ أيُّ عطبٍ فيه (مقيس).
const FOREIGN_BUT_BUILT = { roles: [], entities: [{ name: 'طلب' }, { name: 'صنف' }] };

test('🔴 فهمٌ لا يمسُّ الطلبَ لا يُودَع في المكتبة — ولو نظفت كلُّ البوّابات', async () => {
    const { stored, behavior } = await deposit('__pm22_bad__', FOREIGN_BUT_BUILT, WIRD, 1);
    assert.equal(behavior.status, 'pass', `الطُّعمُ لا يعزل: السلوكُ نفسُه سقط (${behavior.detail})`);
    assert.equal(stored, null, 'فهمُ منتجٍ آخرَ من متتبّعِ حفظٍ صار ميراثاً دائماً لكلّ الفئة');
});

test('🔴 والفهمُ الذي يمسُّ الطلبَ يُودَع كما كان — لا تشدُّدَ يُجمّد التعلّم', async () => {
    const { stored, behavior, logs } = await deposit('__pm22_good__', HONEST, WIRD, 2);
    assert.equal(behavior.status, 'pass', `الطُّعمُ لا يجتاز السلوكَ (${behavior.detail})`);
    assert.ok(stored, 'الذاكرةُ تجمّدت: لا فهمَ صادقٌ يُغنيها بعد اليوم');
    assert.match(logs, /أُغني فهم فئة/);
});

// ─── #١٩٥: ما أسقط بناءَ جمعيّة عطاء على الإنتاج ────────────────────────
//
// سجلٌّ حيّ (٢٠٢٦-٠٩-٠٩، ١١:٠٨): طُلبت منصّةُ جمعيّةٍ خيريّة، فاشتُقّ لها
// `Campaign/Donor/Donation` — وهو الفهمُ **الصحيح** — ثمّ قال الحارسُ لصاحبها:
//   «⚠️ فهمي لم يمسّ طلبَك (لا أثرَ في وصفِك لـCampaign، Donor، Donation)
//     — فطرحتُه وبنيتُ على عناوينك أنت: تسجيل، ملف، لوحه.»
// فبُني على `تسجيل/ملف/لوحه` وانتهى الحكمُ FAILED.
//
// والعلّةُ مقيسة: `conceptsInText` لم ترَ في الطلب كلِّه إلّا `accountant` و`admin` —
// إذ لم يكن في المعجم **مجالُ العمل الخيريّ إطلاقاً**. فلا الجسرُ المعجميّ يعبر
// (لا «حملة»→campaign) ولا جسرُ اللفظ (`Campaign` لا يلتقي «الحملات» حرفاً).
//
// وهذا هو #١٨٦ بعينه مقيساً حيّاً: «العلّةُ تغطيةُ المعجم لا العتبة».

const CHARITY_GOAL = `أبغى منصّة لجمعية خيرية.
1. تسجيل الحملات مع هدف كل حملة والمبلغ المتحقق
2. ملف متبرع فيه سجل تبرعاته وإيصالاته
3. تسجيل المتطوعين وتوزيعهم على الحملات
الأدوار: (مدير الجمعية، مسؤول الحملات، محاسب، متطوع)`;

test('🔴 #١٩٥ الفهمُ الصحيحُ لجمعيّةٍ خيريّة يمرّ — لا يُطرح ويُستبدَل بعناوين', () => {
    const honest = { entities: [{ name: 'Campaign' }, { name: 'Donor' }, { name: 'Donation' }], roles: [] };
    const f = goalFidelity(honest, CHARITY_GOAL);
    assert.deepEqual(f.groundless, [], `طُرح فهمٌ صحيح: ${f.groundless.join('، ')}`);
    assert.equal(f.ungrounded, false, 'هذا هو ما أسقط بناءَ جمعيّة عطاء على الإنتاج');
});

// 🧬 طفرةٌ نجت: حذفُ صيغِ «متطوّع» العربيّة كلِّها من المعجم لم يُسقط اختباراً — لأنّ
//    الطُّعمَ أعلاه يقيس الكياناتِ الثلاثة ولا يقيس الدور. و«متطوّع» مذكورٌ في طلب صاحب
//    المشروع مرّتين، والمتحقّقُ السلوكيّ شكا في السجلّ الحيّ من غيابه بعينه.
test('🔴 #١٩٥ والدورُ «متطوّع» والفئةُ «جمعية خيرية» مسنودان أيضاً — لا الكياناتُ وحدَها', () => {
    const withRoles = { entities: [{ name: 'Charity' }], roles: [{ name: 'Volunteer' }] };
    const f = goalFidelity(withRoles, CHARITY_GOAL);
    assert.deepEqual(f.groundless, [], `لم يُسنَد: ${f.groundless.join('، ')}`);
    assert.equal(f.supported.length, 2);
});

test('🔴 #١٩٥ والحارسُ لم يُسكَت: المهلوَسُ ما زال مرفوضاً على الطلب نفسِه', () => {
    // لو صار كلُّ شيءٍ مسنوداً لضاعت فائدةُ الحارس — والطُّعمُ هنا فهمُ منتجٍ آخرَ تماماً
    const alien = { entities: [{ name: 'Grade' }, { name: 'ForumPost' }], roles: [{ name: 'Teacher' }] };
    assert.equal(goalFidelity(alien, CHARITY_GOAL).ungrounded, true, 'أُسكت الحارس');
    // ولا تُقبل مفاهيمُ الخير على طلبٍ لا يذكرها
    assert.equal(goalFidelity({ entities: [{ name: 'Campaign' }, { name: 'Donor' }], roles: [] }, WIRD).ungrounded,
        true, 'صارت مفاهيمُ الخير تُقبل في كلِّ طلب');
});

test('🔴 #١٩٥ الأدوارُ بين قوسَين تُلتقط **بلا قوس** — وإلّا استحال نجاحُ role-coverage', () => {
    const roles = labelledRoleNames(CHARITY_GOAL);
    assert.deepEqual(roles, ['مدير الجمعية', 'مسؤول الحملات', 'محاسب', 'متطوع'],
        `قوسٌ داخلَ اسمِ دور — والمتحقّقُ يفتّش الشفرةَ عن «${roles[0]}» فلا يجده أبداً`);
    for (const r of roles) assert.doesNotMatch(r, /[()（）[\]{}]/u, `قوسٌ باقٍ في «${r}»`);
});
