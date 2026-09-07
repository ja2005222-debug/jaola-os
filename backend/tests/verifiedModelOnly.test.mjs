// 📚⚖️ «يستفيد منه كل مشروع لاحق» — بعد أن قال القاضي FAILED.
//
// مقيسٌ من أوّل بناءٍ حرٍّ حيٍّ في تاريخ المنصّة (مشروع `from0`): طُلب متتبّعُ حفظِ قرآن،
// فُهم منصّةَ تعليمٍ مدرسيّة (`student, teacher, parent, admin, forumpost, grade`)،
// وانتهى الحكمُ إلى `FAILED — requirements-verify ✗`. ومع ذلك طُبع في السجلّ:
//
//     📚 أُغني فهم فئة «education» بنموذج مُجرَّب — يستفيد منه كل مشروع لاحق.
//
// والشرطُ كان `if (verdict?.ok …)` — و`verdict` هنا نتيجةُ **المحقّق السلوكيّ وحدَه**،
// لا حكمُ المنتج. فبناءٌ يعمل زرُّه ولا يمثّل ما طُلب منه كان يُودِع فهمَه المهلوَس في
// ذاكرةٍ دائمة تُغذّي كلَّ مشروعٍ تالٍ في فئته.
//
// والتعليقُ فوق السطر يقول: «نساهم فقط بما نجح تحقّقه» — **دعوى لا يضمنها الشرط**.
// وهو عينُ عطبِ اليوم بوجهٍ آخر: النصُّ صادقٌ والحالةُ ليست كذلك. والفارقُ أنّ هذا
// **يتراكم**: خطأٌ واحدٌ يُورَّث لكلِّ ما بعده.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBehaviorVerifyStage } from '../agents/stages/verify.js';
import { recordGateOutcome } from '../core/contracts/index.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setDomainModel } from '../agents/projectMemory.js';
import { workingProject } from './helpers/jcrScenario.mjs';
import { getLibraryModel } from '../agents/modelLibrary.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// 🧪 عزلٌ مقصود: النموذجُ **يمثّله المشروعُ الحقيقيّ** (صفحةُ مطعمٍ تعمل) في كلِّ الحالات،
// فيجتاز التحقّقَ السلوكيّ دائماً — ويبقى المتغيّرُ الوحيدَ **حكمَ البوّابة السابقة**.
// بغير هذا العزل يحجب فشلُ السلوكِ الإيداعَ من تلقائه، فيمرّ أيُّ عطبٍ في شرط البوّابات.
// (وفي `from0` كان النموذجُ مهلوَساً أيضاً — لكنّ ذلك عطبُ فهمٍ آخر، لا موضوعَ هذا الملفّ.)
const MODEL = { roles: [], entities: [{ name: 'طلب' }] };

/**
 * يُشغّل المرحلةَ على **مشروعٍ حقيقيٍّ يعمل** على القرص (لا حقنَ ولا شقّ) — فالتحقّقُ
 * السلوكيّ يمرّ فعلاً، ويبقى المتغيّرُ الوحيد هو حكمُ البوّابة السابقة.
 */
async function runStage(category, requirementsStatus, seq) {
    const user = `__mlib_u${seq}__`, project = `p${seq}`;
    setDomainModel(user, project, MODEL);
    const events = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) });
    const context = {
        projectPath: workingProject(), username: user, activeProject: project,
        blueprint: { category },
    };
    // البوّابةُ السابقة في ترتيب `DELIVERY_STAGES` مُسجَّلةٌ فعلاً حين تصل هذه المرحلة
    recordGateOutcome(context, 'requirements-verify', requirementsStatus, 'مقيس');
    await runBehaviorVerifyStage(context, 'room', {}, reporter);
    const logs = events.filter(e => e[0] === 'log').map(e => e[1].message).join('\n');
    return { logs, stored: getLibraryModel(category), behavior: context.verdicts['behavior-verify'] };
}

test('🔴 فهمٌ من بناءٍ حكمُه FAILED لا يدخل الذاكرة الدائمة — ولا يُعلَن «مُجرَّباً»', async () => {
    const { logs, stored, behavior } = await runStage('__cat_failed__', 'fail', 1);
    assert.equal(behavior.status, 'pass', `الطُّعمُ لا يعزل: السلوكُ نفسُه سقط (${behavior.detail})`);
    assert.equal(stored, null,
        'أُودع فهمٌ مهلوَس في ذاكرةٍ يرثها كلُّ مشروعٍ تالٍ — والقاضي قال FAILED');
    assert.doesNotMatch(logs, /أُغني فهم فئة/, 'وأُعلن للمستخدم أنّه «مُجرَّب»');
});

test('🔴 ولا من بناءٍ لم يكتمل تحقّقُ متطلّباته — «لم يُتحقَّق» ليس «تحقَّق»', async () => {
    const { stored, behavior } = await runStage('__cat_unver__', 'unverified', 2);
    assert.equal(behavior.status, 'pass', `الطُّعمُ لا يعزل: السلوكُ نفسُه سقط (${behavior.detail})`);
    assert.equal(stored, null, 'أثرٌ لفظيٌّ وحدَه صار فهماً «مُجرَّباً» يُورَّث');
});

test('🔴 وبناءٌ اجتاز بوّاباتِه يُغني فئتَه كما كان — لا تشدُّدَ يُجمّد التعلّم', async () => {
    const { logs, stored, behavior } = await runStage('__cat_pass__', 'pass', 3);
    assert.equal(behavior.status, 'pass', `الطُّعمُ لا يجتاز السلوكَ أصلاً (${behavior.detail}) — فلا يقيس شيئاً`);
    assert.ok(stored, 'الذاكرةُ تجمّدت: لا مشروعَ ناجحٌ يُغنيها بعد اليوم');
    assert.deepEqual(stored.entities.map(e => e.name), ['طلب']);
    assert.match(logs, /أُغني فهم فئة/);
});

test('🔴 وبوّابةٌ متخطّاةٌ لا تمنع — التخطّي ليس فشلاً', async () => {
    const { stored } = await runStage('__cat_skip__', 'skipped', 4);
    assert.ok(stored, 'التخطّي عومل معاملةَ الفشل');
});
