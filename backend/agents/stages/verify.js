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
    } catch (e) { console.warn('[BehaviorVerify]', 'تخطّي التحقّق (لا يُسقط البناء):', e.message); }
}
