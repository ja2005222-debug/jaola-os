/**
 * 🗣️ stages/debate.js — حلقةُ النقاش: المبرمجُ يكتب، والمعماريُّ والأمنُ والجودةُ
 * ينقدون، والخطّةُ تُقبل أو تُعاد بدورةٍ أخرى في حدود الميزانيّة.
 *
 * أوّلُ طريقةٍ تخرج من `JaolaCognitiveRuntime` بعد الشقّ (JCR/2) وخطِّ الأساس
 * (JCR/1). قِيست قبل النقل: لا تلمس من `this` إلّا البثَّ (٨ `emitLiveLog` +
 * `reporter.send` واحدة)، ولها مستدعٍ واحد، و`runSecurityAudit` لا يستعمله
 * غيرُها في الملفّ كلِّه — فانتقل معها. نقلٌ حرفيّ: `this.emitLiveLog` →
 * `reporter.liveLog`، ولا شيءَ سواه.
 *
 * تعيش في `agents/` لا `core/`: تستورد من `services/` و`agents/`، و
 * `core → agents = []` حارسٌ صريح. `jcr.js` يُبقي `_stageDebate` مفوِّضاً من
 * سطرٍ — فالمستدعي والاختباراتُ الأربعةَ عشرَ لم تتغيّر، وهي خطُّ الأساس.
 */
import { renderCritique, failures as evidenceFailures } from '../../core/evidence/Check.js';
import { scrubPlaceholders } from '../../services/codeGuard.js';
import { recordLesson } from '../../services/platformLessons.js';
import { getUserLanguage } from '../languageDetector.js';
import { transitionState, STATES } from '../stateMachine.js';

/** تدقيقُ أمنٍ حتميّ (بلا نموذج): innerHTML بلا textContent في index.html = XSS محتمل. */
export function runSecurityAudit(files) {
    let isSafe = true, critique = "";
    files.forEach(file => {
        if (file.name === 'index.html' && file.content.includes('innerHTML') && !file.content.includes('textContent')) {
            isSafe = false;
            critique = "تنبيه أمني: استخدام innerHTML بشكل مباشر قد يسمح بـ XSS. يرجى استبداله بـ textContent.";
        }
    });
    return { isSafe, critique };
}

/**
 * المبرمج ← (المعماري ∥ الجودة ∥ تدقيق الأمن) حتى القبول أو استنفاد الدورات.
 * تُرجع الخطة المقبولة، أو null عند الاستنفاد/الميزانية. عطل مزوّد دائم
 * (aiUnavailable) يُرمى فوراً — الدورات الباقية عبث.
 */
export async function runDebate(context, roomName, agents, reporter) {
    const maxDebateCycles = context.budget.maxApiCalls;
    transitionState(context.username, context.activeProject, STATES.GENERATING, { agent: 'Coder' });
    for (let cycle = 0; cycle < maxDebateCycles; cycle++) {
        if (context.budget.isExhausted()) {
            reporter.liveLog(roomName, '5. RUNTIME', 'Orchestrator', '❌ الميزانية استنفدت.');
            break;
        }

        // آخر 3 انتقادات فقط — حقن المصفوفة كاملة كان يضخّم الـ prompt مع كل
        // دورة فشل (تكلفة + تشتيت للنموذج) دون فائدة من النقد القديم المُعالج
        const recentCritiques = context.internalDebate.criticTranscripts.slice(-3);
        const critiquesText = recentCritiques.length > 0
            ? `\n⚠️ انتقادات يجب معالجتها:\n${JSON.stringify(recentCritiques, null, 2)}\n`
            : '';
        const prompt = `${context.goal}\n${critiquesText}\nالسياق الحالي:\n${context.initialCodeContext}`;

        reporter.liveLog(roomName, '5. RUNTIME & DEBATE', 'Coder', `كتابة الشفرة (دورة ${cycle+1}/${maxDebateCycles})...`);
        if (!context.budget.consumeCall()) break;

        let plan;
        try {
            plan = await agents.coreGenerateCodePlan(
                prompt,
                context.initialCodeContext,
                context.mentalModel.visualIdentity,
                [],
                (chunk) => reporter.send(roomName, 'code_stream_chunk', chunk),
                context.mentalModel.templateSections || [],
                getUserLanguage(context.username)
            );
        } catch (e) {
            // ⛔ عطل مزوّد دائم (رصيد منتهٍ/مفاتيح) — الدورات الباقية عبث، نوقف فوراً
            if (e.aiUnavailable) {
                reporter.liveLog(roomName, '5. RUNTIME', 'Orchestrator', `⛔ ${e.message}`);
                const err = new Error(e.message); err.aiUnavailable = true; throw err;
            }
            reporter.liveLog(roomName, '5. RUNTIME', 'Coder', `❌ استثناء: ${e.message}`);
            context.internalDebate.criticTranscripts.push({ agent: 'CODER_EXCEPTION', critique: e.message });
            continue;
        }

        if (plan.error) {
            if (plan.aiUnavailable) {
                reporter.liveLog(roomName, '5. RUNTIME', 'Orchestrator', `⛔ ${plan.details}`);
                const err = new Error(plan.details); err.aiUnavailable = true; throw err;
            }
            reporter.liveLog(roomName, '5. RUNTIME', 'Coder', `❌ خطأ: ${plan.details}`);
            context.internalDebate.criticTranscripts.push({ agent: 'CODER_ERROR', critique: plan.details });
            continue;
        }

        if (!plan.files || plan.files.length === 0) {
            reporter.liveLog(roomName, '5. RUNTIME', 'Coder', `⚠️ لم يتم استخراج أي ملفات من رد النموذج. إعادة المحاولة...`);
            context.internalDebate.criticTranscripts.push({
                agent: 'CODER_EMPTY_RESPONSE',
                critique: 'النموذج أعاد رداً لم يحتوِ على ملفات بالتنسيق المتوقع (// FILE: name)'
            });
            continue;
        }

        // 🧹 تنظيف حتمي أولاً: placeholders القوالب تُستبدل باسم المشروع
        // قبل فحص النقّاد — إصلاح مجاني لا يحرق دورة إعادة توليد.
        plan.files = scrubPlaceholders(plan.files, context.activeProject);

        const secAudit = runSecurityAudit(plan.files);
        const archPromise = context.budget.consumeCall() ? agents.architectReview(plan) : Promise.resolve({ approved: true, feedback: '' });
        const qaPromise = context.budget.consumeCall() ? agents.qaVerify(plan) : Promise.resolve({ passed: true, logs: [] });
        const [archResult, qaResult] = await Promise.all([archPromise, qaPromise]);

        const newCritiques = [];
        if (!archResult.approved) {
            // النقد صار **كل** ما وجده المعماري لا أوّله: كان يعود عند
            // أول مشكلة فتُصلَح واحدةً واحدة، وكل جولة تحرق نداءً من
            // الميزانية. `feedback` يبقى احتياطاً لمزوّدٍ بلا `checks`.
            newCritiques.push({ agent: 'Architect', critique: renderCritique(archResult.checks) || archResult.feedback });
        }
        if (!secAudit.isSafe) newCritiques.push({ agent: 'Security', critique: secAudit.critique });
        if (!qaResult.passed) {
            newCritiques.push({ agent: 'QA', critique: renderCritique(qaResult.checks) || qaResult.logs.join(' | ') });
            // 📚 درس الفشل من **الأعطاب وحدها**. كان يسجّل كل سطر في
            // `logs` باسم `qa_failure` — و`logs` عند الفشل تخلط الأعطاب
            // بالتحذيرات، فكان «لا يوجد footer» يُحفظ في ذاكرة المنصة
            // بوصفه سبب فشل بناء، ثم يُحقن في prompt المولّد مستقبلاً.
            // أي أن النظام كان يتعلّم من وصفٍ غير صحيح لما جرى.
            // ⚠️ وسقوطٌ صريح لمزوّدٍ لا يعيد `checks` (مُحاكٍ، إضافة، نسخة
            // أقدم): بلا دليلٍ على التمييز **لا نخترعه** — تُسجَّل `logs`
            // كما كانت تماماً. الأسوأ من خلط التحذيرات بالأعطاب أن نصمت
            // عنها جميعاً لأن الحقل الجديد غائب.
            const qaLessons = Array.isArray(qaResult.checks)
                ? evidenceFailures(qaResult.checks).map((c) => c.detail)
                : (qaResult.logs || []);
            for (const detail of qaLessons) recordLesson('qa_failure', detail);
        }

        if (newCritiques.length > 0) {
            context.internalDebate.criticTranscripts.push(...newCritiques);
            reporter.liveLog(roomName, '5. RUNTIME', 'Specialists', `❌ رُفض من ${newCritiques.length} متخصص.`);
            continue;
        }

        return plan;
    }
    return null;
}
