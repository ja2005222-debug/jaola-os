/**
 * 📋 stages/requirementsVerify.js — Requirements Verifier: هل نُفِّذت متطلباتُ
 * المشروع فعلاً؟ يفحص كلَّ مكوّنٍ وظيفيّ من الـBlueprint ضدّ الكود المبنيّ، يُكمل
 * الناقصَ بجولاتٍ محدودة عبر `agents.coreEditCodePlan`، ويعرض قائمةَ تحقّقٍ صادقة.
 *
 * رابعُ مرحلةٍ تخرج من `JaolaCognitiveRuntime` (JCR/8). قِيست قبل النقل: `this` =
 * البثُّ وحدَه (٥ `emitLiveLog` + `reporter.send`)، وتُنادى **بالاسم** من
 * `DELIVERY_STAGES` (`this[stage.run]`) فالمفوِّضُ في `jcr` يُبقي ذلك سليماً.
 *
 * ⚠️ الفرقُ الوحيدُ عن النقل الحرفيّ: `verify` وسيطٌ اختياريٌّ افتراضُه
 *    `verifyRequirements` — بلا LLM تعيد `null` فلا تُطرق حلقةُ الإكمال أبداً في
 *    الاختبار. السابقةُ في الشجرة: `deriveProjectModel(…, { chat })` و
 *    `verifyRequirements(…, llm)`. الافتراضُ لا يغيّر سلوكَ الإنتاج.
 */
import { getUserLanguage } from '../languageDetector.js';
import { transitionState, STATES } from '../stateMachine.js';
import { verifyRequirements, buildFixInstruction, formatChecklist, composeRequirements } from '../requirementsVerifier.js';
import { getDomainModel, addToHistory } from '../projectMemory.js';
import { recordLesson } from '../../services/platformLessons.js';
import { guardFiles, scrubPlaceholders, ensureEditIntegrity } from '../../services/codeGuard.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';
import { recordGateOutcome } from '../../core/contracts/index.js';

export async function runRequirementsVerify(context, roomName, agents, reporter, { verify = verifyRequirements } = {}) {
    const plan = context.plan;
    try {
        // 🧩 PM/4: البوّابةُ تفتح على **ما فُهم** لا على قائمة المخطّط وحدَها. كان الشرطُ
        // `blueprint.functionalComponents.length` فتُتخطّى المرحلةُ كلَّما خرج المخطّطُ
        // رقيقاً (بلا مزوّدٍ يخرج بمكوّنٍ عامٍّ واحد) ولو كان الفهمُ يعرف أدوارَه وكياناتِه.
        const domainModel = getDomainModel(context.username, context.activeProject);
        if (composeRequirements(context.blueprint, domainModel).length && plan?.files?.length) {
            const lang = getUserLanguage(context.username);
            transitionState(context.username, context.activeProject, STATES.VERIFYING, { agent: 'Requirements' });
            reporter.liveLog(roomName, '6. VERIFY', 'Requirements', '📋 التحقق من تنفيذ متطلبات المشروع...');
            let verdict = await verify(context.blueprint, plan.files, undefined, domainModel);
            const fixedNames = [];

            // 📚 المتطلبات التي تُسلَّم ناقصة دروسٌ متراكمة للمنصة
            for (const m of verdict?.missing || []) recordLesson('verifier_missing', m.name);

            // 🏗️ إكمال الشاشات الناقصة — بناءُ الشاشات هو *جوهر* المشروع، فلا
            // نتركه رهين ميزانية النقاش (تُستنزف قبله بفريق الخلفية والمراجعة).
            // جولات محدودة (احتياطي مخصّص) تبني شاشةً فشاشة مدفوعةً بالنموذج،
            // وتتوقّف عند اكتمالها أو انعدام التقدّم. سجل المستخدم: 4 شاشات
            // ناقصة (طلب/مطعم/توصيل/تتبّع) لم تُبنَ لأن الجولة الواحدة تعذّرت.
            const MAX_COMPLETION_ROUNDS = 3;
            for (let round = 1; round <= MAX_COMPLETION_ROUNDS && verdict?.missing?.length && agents.coreEditCodePlan; round++) {
                const beforeCount = verdict.missing.length;
                reporter.liveLog(roomName, '6. VERIFY', 'Requirements',
                    `🏗️ إكمال الشاشات ${round}/${MAX_COMPLETION_ROUNDS} — ${beforeCount} ناقصة: ${verdict.missing.map(m => m.name).join('، ')}`);
                const fixPlan = await agents.coreEditCodePlan(
                    buildFixInstruction(verdict.missing, domainModel), plan.files, lang
                );
                if (!fixPlan?.files?.length || fixPlan.error) break;

                const emitFixGuard = (m) => reporter.liveLog(roomName, '6. VERIFY', 'CodeGuard', m);
                const guardedFix = await ensureEditIntegrity(
                    await guardFiles(
                        scrubPlaceholders(fixPlan.files, context.activeProject),
                        emitFixGuard
                    ),
                    context.projectPath, emitFixGuard);
                // دمج الملفات المُصلحة في الخطة وكتابتها على القرص
                for (const f of guardedFix) {
                    if (!f?.name || typeof f.content !== 'string') continue;
                    const idx = plan.files.findIndex(p => p.name === f.name);
                    if (idx >= 0) plan.files[idx] = f; else plan.files.push(f);
                    await writeProjectFile(context.projectPath, f.name, f.content);
                }
                const before = new Set(verdict.missing.map(m => m.name));
                verdict = await verify(context.blueprint, plan.files, undefined, domainModel);
                for (const r of verdict.results.filter(r => r.implemented && before.has(r.name))) {
                    if (!fixedNames.includes(r.name)) fixedNames.push(r.name);
                }
                // توقّف إن لم يتقدّم شيء (تجنّب جولات بلا فائدة)
                if (verdict.missing.length >= beforeCount) break;
            }

            // ⚖️ البوّابة تقول ما وجدت (PM/2): محقّقٌ صامت (لا مزوّد/ردٌّ غير صالح) ليس اجتيازاً.
            if (!verdict) recordGateOutcome(context, 'requirements-verify', 'unverified', 'المحقّقُ لم يُجب (لا مزوّد أو ردٌّ غير صالح)');
            else if (verdict.missing?.length) recordGateOutcome(context, 'requirements-verify', 'fail', `${verdict.missing.length} متطلّب ناقص: ${verdict.missing.map(m => m.name).join('، ')}`);
            else recordGateOutcome(context, 'requirements-verify', 'pass', `${verdict.implementedCount}/${verdict.results.length} متطلّب منفّذ`);
            if (verdict) {
                const checklist = formatChecklist(verdict, lang, fixedNames);
                reporter.liveLog(roomName, '6. VERIFY', 'Requirements',
                    `📋 ${verdict.implementedCount}/${verdict.results.length} متطلب منفّذ${fixedNames.length ? ` (+${fixedNames.length} أُصلح تلقائياً)` : ''}`);
                if (checklist) reporter.send(roomName, 'chat_reply', { message: checklist });
                addToHistory(context.username, context.activeProject,
                    `تحقق المتطلبات: ${verdict.implementedCount}/${verdict.results.length} منفّذ`);
            }
        } else {
            recordGateOutcome(context, 'requirements-verify', 'skipped', 'لا متطلّباتٍ (لا مكوّناتٍ في المخطّط ولا فهمَ) أو لا ملفّات');
        }
    } catch (e) {
        recordGateOutcome(context, 'requirements-verify', 'unverified', e.message);
        reporter.liveLog(roomName, '6. VERIFY', 'Requirements', `⚠️ تخطّي التحقق: ${e.message}`);
    }
}
