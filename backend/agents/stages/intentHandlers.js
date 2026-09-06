/**
 * 🧭 stages/intentHandlers.js — معالجا نيّةٍ من `handleUserMessage` بلا حالةٍ على النسخة:
 *  - `handlePlanningStage`: مرحلةُ الخطّة في حوار التوضيح — تأكيدٌ → تهيئةُ ذاكرة المشروع من المُوضِّح وتسجيلُه ثمّ
 *    `ops.executeMission` بالهدف النهائيّ؛ سؤالٌ → ملخّصُ الخطّة؛ إيقاف/لون/تعديل → تُسجَّل في إجابات المُوضِّح.
 *  - `handleModifyPattern`: كشفُ التعديل المباشر بالنمط (احتياطُ الموجّه) — في مرحلة الخطّة تعديلٌ عليها، وإلّا
 *    `ops.surgicalEdit` بسياق الطلب.
 * كلاهما يعود `true` إن التُقط الطلبُ وعولج، و`false` ليكمل المسارُ.
 *
 * يخرجان من `JaolaCognitiveRuntime` في JCR/25 بالمنهج نفسِه: المُبلِّغُ يُمرَّر، والطريقةُ الوحيدة التي كان كلٌّ منهما
 * يستدعيها بـ`this` (`executeMission` / `surgicalEdit` — تستبدلهما الاختباراتُ على النسخة) تُمرَّر دالّةً في `ops`.
 * لا `io` هنا. نقلٌ حرفيّ. المعالجاتُ الأربعةُ الباقية تحمل `gatedMessages` — قرارُها يُكتب قبل نقلها.
 */
import { initFromClarifier } from '../projectMemory.js';
import { recordProject } from '../userProfile.js';
import { normalizeArabic } from '../textNormalizer.js';
import { contextFromRequest } from '../../core/runtime/ExecutionContext.js';

// مرحلة الخطة في حوار التوضيح: تأكيد → بناء، سؤال → ملخّص الخطة، إيقاف/لون/تعديل → تسجيل في الإجابات.
export async function handlePlanningStage(req, agents, reporter, ops) {
    const { message, roomName, username, activeProject, userLang, clarifierState } = req;
    // إذا كنا في مرحلة الخطة — ننتظر تأكيد أو تعديل
    if (clarifierState?.stage === 'planning') {
        if (agents.isConfirmation?.(message)) {
            const clarifierData = agents.getState(username);
            const finalGoal = agents.getFinalGoal(username);
            const lang = clarifierState.lang || userLang;
            const startMsg = lang === 'ar' ? '🚀 ممتاز! بدأت البناء الآن...' : '🚀 Great! Building now...';
            reporter.send(roomName, 'chat_reply', { message: startMsg });

            // 🆕 تهيئة Project Memory من نتائج Clarifier
            if (clarifierData?.plan) {
                initFromClarifier(username, activeProject, {
                    originalGoal: clarifierData.originalGoal,
                    plan: clarifierData.plan,
                });
                // تسجيل المشروع في ملف المستخدم
                recordProject(username, activeProject, clarifierData.projectType || 'business');
            }

            ops.executeMission(finalGoal, contextFromRequest(req, agents));
        } else {
            // تمييز: هل هو سؤال عن الخطة أم تعديل عليها؟
            const lang = clarifierState.lang || userLang;
            const isQuestion = /\?|ماهي|ماذا|كيف|هل|what|how|why|when|can you|tell me/i.test(message);

            if (isQuestion) {
                // أجب على السؤال بسياق الخطة
                const plan = clarifierState.plan;
                const planSummary = plan
                    ? `الأقسام: ${(plan.sections||[]).join('، ')} | الميزات: ${(plan.features||[]).join('، ')}`
                    : 'لم تُبنَ خطة بعد';
                const replyMsg = lang === 'ar'
                    ? `الخطة الحالية تشمل: ${planSummary}\n\nاكتب **"ابدأ"** للتنفيذ أو أخبرني بأي تعديل.`
                    : `Current plan includes: ${planSummary}\n\nType **"start"** to build or tell me any changes.`;
                reporter.send(roomName, 'chat_reply', { message: replyMsg });
            } else {
                // كشف أوامر الإيقاف في مرحلة Planning
                const isStop = /^(لا|توقف|الغ|إلغاء|cancel|stop|no|لا تبد|وقف)/i.test(message.trim());
                if (isStop) {
                    agents.clearState?.(username);
                    const stopMsg = lang === 'ar'
                        ? 'تم إلغاء الخطة. يمكنك البدء من جديد متى شئت.'
                        : 'Plan cancelled. You can start over anytime.';
                    reporter.send(roomName, 'chat_reply', { message: stopMsg });
                    return true;
                }

                // كشف طلبات تغيير اللون
                // «الالوان» بلا همزة هي الكتابة الشائعة — كانت تسقط في «تعديل عام»
                const isColorChange = /color|لون|colour|ألوان|الوان|colors/i.test(message);
                if (isColorChange) {
                    const colorMsg = lang === 'ar'
                        ? 'ما اللون أو التدرج اللوني الذي تفضله؟ (مثال: أزرق داكن، أخضر طبيعي، ذهبي فاخر...)'
                        : 'What color or theme do you prefer? (e.g., dark blue, natural green, luxury gold...)';
                    reporter.send(roomName, 'chat_reply', { message: colorMsg });
                    const state = agents.getState(username);
                    if (state) state.answers.push(`color change requested: ${message}`);
                    return true;
                }

                // تعديل عام على الخطة
                const editMsg = lang === 'ar'
                    ? `فهمت! سأراعي: "${message}"\n\nاكتب **"ابدأ"** عندما تكون جاهزاً.`
                    : `Got it! I'll include: "${message}"\n\nType **"start"** when ready.`;
                reporter.send(roomName, 'chat_reply', { message: editMsg });
                const state = agents.getState(username);
                if (state) state.answers.push(`edit: ${message}`);
            }
        }
        return true;
    }
    return false;
}

// كشف التعديل المباشر بالنمط (احتياط الموجّه) — وفي مرحلة الخطة يُعامَل كتعديل عليها.
export async function handleModifyPattern(req, agents, reporter, ops) {
    const { message, roomName, username, userLang, clarifierState } = req;
    // ── 1. كشف التعديل المباشر (مسار احتياطي عند فشل الموجّه) ─────────
    // النمط مكتوب بدون همزات لأننا نفحص النص المطبّع (اضف = أضف = إضف)
    // يقبل النقطتين بعد الفعل ("عدّل: ..." التي يقترحها المساعد نفسه) لا المسافة فقط
    const modifyPattern = /^(غير|عدل|بدل|اضف|ضف|زود|احذف|امسح|شيل|صحح|اصلح|تعديل|حول|اجعل|ضع|حط|زد|كبر|صغر|change|modify|update|add|remove|put|fix|make|delete)[\s:：]+/i;
    const normalizedForModify = normalizeArabic(message.trim());
    if (modifyPattern.test(message.trim()) || modifyPattern.test(normalizedForModify)) {
        // إذا كنا في مرحلة Planning — عالج كتعديل على الخطة وليس بناء
        if (clarifierState?.stage === 'planning') {
            const lang = clarifierState.lang || userLang;
            const isColorChange = /color|لون|colour|ألوان|الوان/i.test(message);
            if (isColorChange) {
                const colorMsg = lang === 'ar'
                    ? 'ما اللون المفضل؟ (مثال: أزرق داكن، أخضر، ذهبي...)'
                    : 'What color do you prefer? (e.g., dark blue, green, gold...)';
                reporter.send(roomName, 'chat_reply', { message: colorMsg });
            } else {
                const editMsg = lang === 'ar'
                    ? `فهمت! سأراعي: "${message}"\n\nاكتب **"ابدأ"** عندما تكون جاهزاً.`
                    : `Got it! I'll include: "${message}"\n\nType **"start"** when ready.`;
                reporter.send(roomName, 'chat_reply', { message: editMsg });
                const state = agents.getState(username);
                if (state) state.answers.push(`edit: ${message}`);
            }
            return true;
        }
        reporter.liveLog(roomName, 'INTENT', 'Classifier', 'نية: modify (ثقة: 100%) - قاعدة مباشرة');
        ops.surgicalEdit(message, contextFromRequest(req, agents));
        return true;
    }
    return false;
}
