/**
 * 🧠 stages/ceoIntent.js — نوايا CEO الحتميّة قبل أيِّ نموذجٍ لغويّ: حالة / تحيّة / اكمل / انشر / ادفع.
 * محرّكُ النيّة (`classifyIntentFast`) → محرّكُ القرار (`decide`) → تنفيذٌ: ردٌّ فوريّ، أو استئنافُ مهمّةٍ من الذاكرة عبر
 * `ops.executeMission`، أو نشرٌ (Render للـfull-stack، وكيلُ النشر للثابت) أو دفعٌ إلى GitHub — والنيّةُ والقرارُ يظهران في البثّ.
 *
 * يخرج من `JaolaCognitiveRuntime` في JCR/24 بالمنهج نفسِه: المُبلِّغُ يُمرَّر، و`executeMission` — الطريقةُ الوحيدة التي كانت
 * تُستدعى بـ`this` والاختباراتُ تستبدلها على النسخة — تُمرَّر دالّةً في `ops`. `reporter.io` موضعان معلَنان: `deployToRender`
 * ووكيلُ النشر يبثّان بنفسيهما. نقلٌ حرفيّ. يعود `true` إن التُقطت النيّةُ وعولجت، و`false` ليكمل المسارُ.
 */
import { getUserLanguage } from '../languageDetector.js';
import { classifyIntentFast, decide, buildContinuationGoal, buildStatusReply, greetingReply } from '../ceoBrain.js';
import { renderServiceName, deployToRender } from '../renderAgent.js';
import { isFullStackProject } from '../deployAgent.js';
import { pushProject } from '../../services/githubSync.js';
import { getProjectSecrets } from '../../services/projectSecrets.js';
import { contextFromRequest } from '../../core/runtime/ExecutionContext.js';

// نوايا CEO الحتمية (حالة/تحية/اكمل/انشر/ادفع) قبل أي LLM.
export async function handleCeoIntent(req, agents, reporter, ops) {
    const { message, normalizedMessage, roomName, projectPath, username, activeProject, userLang } = req;
    // ── 🧠 CEO Brain: Intent Engine → Decision Engine → Execution ─────
    // النوايا الإدارية (كمل/أين وصلنا/انشر/ادفع/تحية) تُعالج هنا قبل أي LLM
    const fastIntent = classifyIntentFast(normalizedMessage || message);
    if (fastIntent) {
        const lang = getUserLanguage(username) || userLang;
        const decision = decide(fastIntent.intent, username, activeProject);

        // النية والقرار يظهران للمستخدم في بث المهمة — شفافية كاملة
        reporter.liveLog(roomName, 'INTENT', 'Engine',
            `🎯 ${JSON.stringify({ intent: fastIntent.intent, project: activeProject, confidence: fastIntent.confidence })}`);
        reporter.liveLog(roomName, 'DECISION', 'Engine', `⚙️ ${decision.action} — ${decision.reason}`);

        switch (fastIntent.intent) {
            case 'status': {
                reporter.send(roomName, 'chat_reply', { message: buildStatusReply(username, activeProject, lang) });
                return true;
            }

            case 'greeting': {
                reporter.send(roomName, 'chat_reply', { message: greetingReply(username, activeProject, lang) });
                return true;
            }

            case 'continue': {
                if (decision.action === 'reply') {
                    const busyMsg = lang === 'ar'
                        ? '⚙️ الفريق يعمل على المشروع الآن بالفعل — تابع التقدم الحي هنا.'
                        : '⚙️ The team is already working on it — watch the live progress here.';
                    reporter.send(roomName, 'chat_reply', { message: busyMsg });
                    return true;
                }
                const continuationGoal = buildContinuationGoal(username, activeProject);
                if (!continuationGoal) {
                    // لا ذاكرة — نعرض الحالة ونسأل سؤالاً محدداً بدل "ماذا تقصد؟"
                    const noMemMsg = lang === 'ar'
                        ? `لا أجد مشروعاً سابقاً في (${activeProject}) لأكمله.\nأخبرني: ماذا تريد أن نبني؟ (مثال: "متجر بيض بلدي مع سلة وطلب أونلاين")`
                        : `I don't find a previous project in (${activeProject}) to continue.\nTell me: what should we build? (e.g., "an egg store with cart and online ordering")`;
                    reporter.send(roomName, 'chat_reply', { message: noMemMsg });
                    return true;
                }
                const resumeMsg = lang === 'ar'
                    ? '📂 وجدت المشروع في الذاكرة — الفريق يستأنف من حيث توقف...'
                    : '📂 Project found in memory — the team is resuming where it left off...';
                reporter.send(roomName, 'chat_reply', { message: resumeMsg });
                ops.executeMission(continuationGoal, contextFromRequest(req, agents));
                return true;
            }

            case 'deploy': {
                if (decision.action === 'reply') {
                    const waitMsg = lang === 'ar'
                        ? '⏳ البناء جارٍ الآن — سأنشر تلقائياً بعد اكتماله، أو اطلب النشر لاحقاً.'
                        : '⏳ Build in progress — deploy after it completes.';
                    reporter.send(roomName, 'chat_reply', { message: waitMsg });
                    return true;
                }
                // 🧭 المشاريع full-stack (فيها دوال api/ حقيقية) تُنشر على Render
                // كخادم دائم — يزيل حدّ Vercel Hobby (12 دالة) ويُبقي DB متصلة.
                // المواقع الثابتة تبقى على Vercel (أسرع وأبسط).
                if (isFullStackProject(projectPath)) {
                    const renderMsg = lang === 'ar'
                        ? '🖥️ مشروع full-stack — سأجهّزه لخادم دائم على Render (بلا حدّ دوال)...'
                        : '🖥️ Full-stack project — preparing a persistent server on Render...';
                    reporter.send(roomName, 'chat_reply', { message: renderMsg });
                    const projectSlug = renderServiceName(username, activeProject);
                    deployToRender(
                        { projectPath, projectName: projectSlug, username, activeProject, hasBackend: true },
                        reporter.io, roomName
                    ).then(r => {
                        if (r.success) {
                            const okMsg = lang === 'ar'
                                ? `✅ جاهز للنشر على Render (خادم دائم). اضغط الزر لإنشائه بضغطة واحدة — سيقرأ الإعداد تلقائياً ويطلب MONGODB_URI:\n\n👉 ${r.deployUrl}\n\nبعدها يُعيد Render النشر تلقائياً مع كل تعديل.`
                                : `✅ Ready for Render (persistent server). One click to create it:\n\n👉 ${r.deployUrl}`;
                            reporter.send(roomName, 'chat_reply', { message: okMsg });
                        } else if (r.needsGitHub) {
                            const ghMsg = lang === 'ar'
                                ? `🔗 لنشر خادم دائم على Render نحتاج ربط المشروع بمستودع GitHub أولاً (Render ينشر من GitHub). افتح ⋯ → GitHub في الداش واربط المستودع، ثم اطلب النشر مجدداً.`
                                : `🔗 Render deploys from GitHub — connect a repo first (⋯ → GitHub), then deploy again.`;
                            reporter.send(roomName, 'chat_reply', { message: ghMsg });
                        } else {
                            reporter.send(roomName, 'log', { message: `❌ [Render]: ${r.error}` });
                        }
                    }).catch(err => {
                        reporter.send(roomName, 'log', { message: `❌ [Render]: ${err.message}` });
                    });
                    return true;
                }

                const deployMsg = lang === 'ar'
                    ? '🚀 أمر النشر مقبول — جاري الرفع للإنتاج الآن...'
                    : '🚀 Deploy order accepted — shipping to production...';
                reporter.send(roomName, 'chat_reply', { message: deployMsg });
                agents.deployProject?.(
                    { projectPath, activeProject, currentUser: username, env: getProjectSecrets(username, activeProject) },
                    reporter.io,
                    () => {}
                ).catch(err => {
                    reporter.send(roomName, 'log', { message: `❌ [DEPLOY]: ${err.message}` });
                });
                return true;
            }

            case 'github_push': {
                const pushMsg = lang === 'ar'
                    ? '🐙 جاري الدفع إلى GitHub...'
                    : '🐙 Pushing to GitHub...';
                reporter.send(roomName, 'chat_reply', { message: pushMsg });
                pushProject(username, activeProject, projectPath).then(result => {
                    const doneMsg = result.success
                        ? (lang === 'ar' ? `✅ تم الدفع إلى ${result.url} (${result.branch})` : `✅ Pushed to ${result.url} (${result.branch})`)
                        : (lang === 'ar' ? `❌ فشل الدفع — ${result.error}` : `❌ Push failed — ${result.error}`);
                    reporter.send(roomName, 'chat_reply', { message: doneMsg });
                }).catch(err => {
                    reporter.send(roomName, 'chat_reply', { message: `❌ GitHub: ${err.message}` });
                });
                return true;
            }
        }
    }
    return false;
}
