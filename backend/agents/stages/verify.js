/**
 * 🔬 stages/verify.js — التحقّقُ السلوكيّ + جولةُ إصلاحٍ واحدة، مشتركةٌ بين البناء (مرحلةُ التسليم `behavior-verify`
 * وبناءُ React) والتعديل الجراحيّ.
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/17 بالمنهج نفسِه: `this` فيها = `emitLiveLog` (٣) + مفوِّضُ القارئ
 * (`readProjectFiles` يُستورد مباشرةً). التوقيعُ الكائنيّ يبقى كما هو + `reporter` وسيطاً أخيراً؛ `agents` داخل الكائن
 * كما كان (`coreEditCodePlan` هو المُصلِح). المستدعون الثلاثة يمرّون بمفوِّضٍ باقٍ في jcr (والاختباراتُ تستبدله). نقلٌ حرفيّ.
 */
import { getDomainModel } from '../projectMemory.js';
import { verifyBehavior, buildBehaviorFixInstruction } from '../behaviorVerifier.js';
import { readProjectFiles } from '../projectReader.js';
import { guardFiles, scrubPlaceholders, ensureEditIntegrity } from '../../services/codeGuard.js';
import { writePlanFiles } from '../../core/runtime/workspacePaths.js';
import { recordBehaviorGaps } from '../../services/platformLessons.js';
import { getUserLanguage } from '../languageDetector.js';
import { recordModel } from '../modelLibrary.js';
import { recordGateOutcome, deliveryVerdict } from '../../core/contracts/index.js';
import { traceRequirements } from '../requirementsVerifier.js';

/** ⚖️ حكمُ بوّابة السلوك من ناتج `verifyBehavior` (PM/2): لم يُشغَّل/تُخطّي = لم يُتحقَّق، لا اجتياز. */
export function behaviorOutcome(verdict) {
    if (!verdict || !verdict.ran || verdict.skipped) return { status: 'unverified', detail: verdict?.summary || 'تعذّر التحقّق السلوكي' };
    if (verdict.ok) return { status: 'pass', detail: verdict.summary || 'اجتاز التحقّق السلوكي' };
    return { status: 'fail', detail: `ثغراتٌ باقية: ${(verdict.checks || []).filter(c => c.status === 'fail').map(c => c.name).join('، ') || verdict.summary || ''}` };
}

/**
 * ⚖️ حكمُ بوّابة المتطلّبات على مسارات الاستراتيجيّة (PM/7) — بلا مزوّد، من أثر المفردات (`traceRequirements`):
 *   لا متطلّباتٍ أو لا ملفّات → `skipped` بالسبب المكتوب؛ كلُّها لا يُتتبَّع (عامّة/تدفّقات/خارج المعجم) → `skipped` بعددها؛
 *   متطلّبٌ بلا أثر → `fail` بأسمائه (الغيابُ قاطع)؛ كلُّ المتتبَّع له أثر → `pass` مكتوباً عليه «أثرٌ لا تنفيذ».
 * قبل هذا كانت البوّابةُ `skipped` حتميّاً على هذه المسارات — فوثيقةٌ من ١٢ متطلّباً مسمّى على كلونٍ يمثّل ٧ منها كانت PASS.
 */
export function requirementsTraceOutcome(requirements, files, note = 'لا محقّقَ متطلّبات على هذا المسار') {
    if (!requirements?.length || !files?.length) return { status: 'skipped', detail: note };
    const t = traceRequirements(requirements, files);
    const traceable = t.traced.length + t.missing.length;
    if (!traceable) return { status: 'skipped', detail: `${note} — ${t.untraceable.length} متطلّب بلا مفردةٍ تُتتبَّع` };
    const tail = `${t.traced.length}/${traceable} له أثر — أثرٌ لا تنفيذ${t.untraceable.length ? `؛ ${t.untraceable.length} لا يُتتبَّع بالمفردات` : ''}`;
    if (t.missing.length) return { status: 'fail', detail: `${t.missing.length} متطلّب بلا أثر: ${t.missing.join('، ')} (${tail})` };
    return { status: 'pass', detail: tail };
}

/**
 * ⚖️ حكمُ مسارات الاستراتيجيّة (PM/2b): Registry/Clone/React تعود قبل حلقة التسليم، فتبني حكمَها بالشكل نفسِه
 * من تحقّقها الداخليّ — الحارسُ اجتاز بالكتابة، والمتطلّباتُ من أثرها في الملفّات (PM/7؛ وبلا متطلّباتٍ «لا ينطبق»
 * بسببٍ مكتوب)، والسلوكُ من `verifyBehavior`. لا حكمَ بلا تحقّقٍ فعليّ.
 */
export function strategyVerdict({ filesCount = 0, behavior = null, requirementsNote = 'لا محقّقَ متطلّبات على هذا المسار', requirements = null, files = null } = {}) {
    const ctx = {};
    recordGateOutcome(ctx, 'guard-and-write', 'pass', `${filesCount} ملفّاً كُتبت`);
    const r = requirementsTraceOutcome(requirements, files, requirementsNote);
    recordGateOutcome(ctx, 'requirements-verify', r.status, r.detail);
    const b = behaviorOutcome(behavior);
    recordGateOutcome(ctx, 'behavior-verify', b.status, b.detail);
    return deliveryVerdict(ctx.verdicts);
}

// 🔬 التحقّق السلوكي + جولة إصلاح تلقائية — مشتركة بين البناء والتعديل.
// نُشغّل الصفحة فعلاً؛ إن كُشفت ثغرة (خطأ JS/زر ميت/دور بلا واجهة) وأُتيح
// الإصلاح، نبني تعليمة مستهدفة ونُصلح ونُعيد التحقّق. جولة واحدة (لا حلقة).
export async function verifyAndAutofix({ projectPath, blueprint = null, username, activeProject, roomName, agents, lang = 'ar', canFix = true }, reporter) {
    try {
        const domainModel = getDomainModel(username, activeProject);
        const emitVerdict = (v, note = '') => {
            const gaps = v.checks.filter(c => c.status !== 'pass')
                .map(c => `${c.status === 'fail' ? '❌' : '⚠️'} ${c.detail}`);
            reporter.liveLog(roomName, '6. VERIFY', 'BehaviorVerifier',
                v.ok
                    ? `🔬 التحقّق السلوكي: يعمل (${v.summary})${note}${gaps.length ? '\n' + gaps.join('\n') : ''}`
                    : `🔬 ثغرات سلوكية (${v.summary})${note} — لم يُعلَن النجاح أجوفاً:\n${gaps.join('\n')}`);
        };

        let verdict = await verifyBehavior({ projectPath, blueprint, domainModel });
        if (!verdict.ran || verdict.skipped) return verdict;
        emitVerdict(verdict);

        if (!verdict.ok && canFix && agents?.coreEditCodePlan) {
            const instruction = buildBehaviorFixInstruction(verdict, domainModel);
            if (instruction) {
                reporter.liveLog(roomName, '6. VERIFY', 'BehaviorVerifier', '🔧 جولة إصلاح سلوكية مستهدفة...');
                const files = await readProjectFiles(projectPath);
                const fixPlan = await agents.coreEditCodePlan(instruction, files, lang);
                if (fixPlan?.files?.length && !fixPlan.error) {
                    const emitG = (m) => reporter.liveLog(roomName, '6. VERIFY', 'CodeGuard', m);
                    const guarded = await ensureEditIntegrity(
                        await guardFiles(scrubPlaceholders(fixPlan.files, activeProject), emitG),
                        projectPath, emitG);
                    await writePlanFiles(projectPath, guarded);
                    verdict = await verifyBehavior({ projectPath, blueprint, domainModel });
                    emitVerdict(verdict, verdict.ok ? ' (أُصلح تلقائياً)' : ' (بعد الإصلاح — يحتاج مراجعتك)');
                }
            }
        }
        recordBehaviorGaps(verdict); // 📚 ما بقي من ثغرات بعد الإصلاح = ما يستلمه المستخدم = درس للمنصة
        return verdict;
    } catch (e) { console.warn('[BehaviorVerify]', 'تعذّر التحقّق السلوكي:', e.message); return null; }
}

// 🔬 التحقّق السلوكي + جولة إصلاح تلقائية (طريقة مشتركة مع مسار التعديل)
// محاط بحارس: خطأ في التحقّق يجب ألّا يُسقط بناءً ناجحاً أبداً.
export async function runBehaviorVerifyStage(context, roomName, agents, reporter) {
    try {
        const verdict = await verifyAndAutofix({
            projectPath: context.projectPath, blueprint: context.blueprint,
            username: context.username, activeProject: context.activeProject, roomName, agents,
            lang: getUserLanguage(context.username),
            canFix: !!context.budget?.consumeCall?.(),
        }, reporter);
        // ⚖️ البوّابة تقول ما وجدت (PM/2): لم يُشغَّل/تُخطّي = لم يُتحقَّق، لا اجتياز.
        const outcome = behaviorOutcome(verdict);
        recordGateOutcome(context, 'behavior-verify', outcome.status, outcome.detail);
        // 📚 مساهمة في مكتبة النماذج — فهم مُجرَّب (مرّ بالتحقّق) يُغني فئته
        // فيبدأ كل مشروع لاحق من نضجٍ أعلى. نساهم فقط بما نجح تحقّقه.
        if (verdict?.ok && context.blueprint?.category) {
            const contributed = recordModel(
                context.blueprint.category,
                getDomainModel(context.username, context.activeProject),
                { verified: true }
            );
            if (contributed) reporter.liveLog(roomName, '6. VERIFY', 'ModelLibrary',
                `📚 أُغني فهم فئة «${context.blueprint.category}» بنموذج مُجرَّب — يستفيد منه كل مشروع لاحق.`);
        }
    } catch (e) {
        recordGateOutcome(context, 'behavior-verify', 'unverified', e.message);
        console.warn('[BehaviorVerify]', 'تخطّي التحقّق (لا يُسقط البناء):', e.message);
    }
}
