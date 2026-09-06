/**
 * 🧭 stages/intentHandlers.js — معالجا نيّةٍ من `handleUserMessage` بلا حالةٍ على النسخة:
 *  - `handlePlanningStage`: مرحلةُ الخطّة في حوار التوضيح — تأكيدٌ → تهيئةُ ذاكرة المشروع من المُوضِّح وتسجيلُه ثمّ
 *    `ops.executeMission` بالهدف النهائيّ؛ سؤالٌ → ملخّصُ الخطّة؛ إيقاف/لون/تعديل → تُسجَّل في إجابات المُوضِّح.
 *  - `handleModifyPattern`: كشفُ التعديل المباشر بالنمط (احتياطُ الموجّه) — في مرحلة الخطّة تعديلٌ عليها، وإلّا
 *    `ops.surgicalEdit` بسياق الطلب.
 *  - `handleBareConfirmations` (JCR/26): «نعم/تمام» مجرّدةً — تنفيذُ الرسالة **المحجوبة** تعديلاً موضعيّاً إن وُجدت (تُمسح من الحاجز)،
 *    وإلّا استئنافٌ فعليّ من الذاكرة حين يسمح القرار؛ و«نفّذ/طبّق» مجرّدةً — تنفيذُ آخر ما وصفه المساعدُ في المحادثة كتعديل، أو سؤالٌ محدَّد.
 * كلُّها تعود `true` إن التُقط الطلبُ وعولج، و`false` ليكمل المسارُ.
 *
 * تخرج من `JaolaCognitiveRuntime` بالمنهج نفسِه (JCR/25–26): المُبلِّغُ يُمرَّر، وطرائقُ الصنف التي كانت تُستدعى بـ`this`
 * (`executeMission` / `surgicalEdit` — تستبدلهما الاختباراتُ على النسخة) تُمرَّر دوالَّ في `ops`. وحالةُ الحجب `gatedMessages`
 * (خريطةٌ **مشتركة** بين المعالجات عبر الرسائل، تملكها الاختباراتُ على النسخة) تبقى على الصنف وتصل كشقٍّ `gate` من دوالَّ مربوطةٍ
 * بالنسخة — لا كائنَ جديد (قرارُ JCR/26 في CONTRACTS). لا `io` هنا. نقلٌ حرفيّ.
 */
import { getUserLanguage } from '../languageDetector.js';
import { initFromClarifier } from '../projectMemory.js';
import { recordProject, recordEdit } from '../userProfile.js';
import { normalizeArabic } from '../textNormalizer.js';
import { isBareYes, isBareExecute } from '../chatCommands.js';
import { decide, buildContinuationGoal } from '../ceoBrain.js';
import { loadForPrompt as loadConversation } from '../../services/conversationStore.js';
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

// «نعم» و«نفذ» المجرّدتان: تنفيذ الطلب المحجوب/الاستئناف/آخر ما نوقش — لا ارتجال شات.
export async function handleBareConfirmations(req, agents, reporter, gate, ops) {
    const { message, roomName, username, activeProject, userLang } = req;
    // 🆕 "نعم/تمام/ok" مجرّدة بلا هدف معلق ولا clarifier: موافقة على
    // المتابعة — إن وُجد مشروع قابل للاستئناف نكمله فعلياً بدل إسقاطها
    // في الشات ليرتجل حواراً (سجل تاكسي: "نعم" كانت تدور بلا فعل).
    const bareYes = isBareYes(message); // النمط في chatCommands.js (مُختبَر)
    if (bareYes) {
        // 🛡️ رسالة محجوبة معلّقة أولاً — الحاجز نفسه قال للمستخدم حرفياً
        // «أكّد بإرسال "نعم"»، فيجب أن تنفّذ "نعم" *ذلك الطلب المحجوب*
        // تعديلاً موضعياً. بدون هذا كانت تسقط لمسار الاستئناف العام أدناه
        // فتُشعل إعادة توليد كاملة تدهس المشروع (عطل إنتاجي: "اعطي الادمن
        // صلاحية..." حُجبت، ثم "نعم" حوّلت المشروع لموقع آخر كلياً).
        const gated = gate.get(username);
        if (gated) {
            gate.delete(username);
            reporter.liveLog(roomName, 'INTENT', 'Engine',
                '✅ "نعم" بعد حجب → تنفيذ الطلب المحجوب تعديلاً موضعياً (لا استئناف عام).');
            recordEdit(username, gated);
            ops.surgicalEdit(gated, contextFromRequest(req, agents));
            return true;
        }
        const contGoal = buildContinuationGoal(username, activeProject);
        const d = decide('continue', username, activeProject);
        if (contGoal && d.action === 'execute') {
            const lang = getUserLanguage(username) || userLang;
            reporter.liveLog(roomName, 'INTENT', 'Engine',
                `🎯 ${JSON.stringify({ intent: 'continue', project: activeProject, confidence: 90 })} — تأكيد مجرّد → استئناف فعلي`);
            reporter.send(roomName, 'chat_reply', {
                message: lang === 'ar' ? '⚡ تمام — أكمل من حيث توقفنا...' : '⚡ Alright — resuming where we left off...'
            });
            ops.executeMission(contGoal, contextFromRequest(req, agents));
            return true;
        }
    }

    // 🆕 "نفذ/نفذهما/طبقها/do it" مجرّدة: أمر تنفيذ يشير لما نوقش للتو في
    // الشات — ننفّذ آخر ما وصفه المساعد كتعليمة تعديل فعلية بدل وعود
    // "سيقوم نظام البناء..." المتكررة (سجل: "تمام نفذهما" دارت بلا فعل ×3).
    const bareExecute = isBareExecute(message); // النمط في chatCommands.js (مُختبَر)
    if (bareExecute) {
        const lang = getUserLanguage(username) || userLang;
        try {
            const { window: hist } = await loadConversation(`${username}::${activeProject}`);
            const lastAssistant = [...hist].reverse().find(m => m.role === 'assistant' && !/^⚠️|^⚡|^🗑️/.test(m.content || ''));
            if (lastAssistant?.content) {
                reporter.liveLog(roomName, 'INTENT', 'Engine', '⚡ أمر تنفيذ مجرّد → تنفيذ ما نوقش للتو كتعديل فعلي.');
                reporter.send(roomName, 'chat_reply', {
                    message: lang === 'ar' ? '⚡ تمام — أنفّذ ما اتفقنا عليه الآن...' : '⚡ On it — executing what we just discussed...'
                });
                const instruction = (lang === 'ar'
                    ? `نفّذ على الموقع الحالي ما تم الاتفاق عليه في المحادثة التالية (طلب المستخدم الأصلي ثم وصف المساعد):\n"${message.trim()}" يشير إلى:\n${lastAssistant.content.slice(0, 600)}`
                    : `Apply to the current site what was agreed in chat:\n"${message.trim()}" refers to:\n${lastAssistant.content.slice(0, 600)}`);
                recordEdit(username, instruction.slice(0, 100));
                ops.surgicalEdit(instruction, contextFromRequest(req, agents));
                return true;
            }
        } catch (e) { /* سقوط آمن للشات */ }
        reporter.send(roomName, 'chat_reply', {
            message: lang === 'ar'
                ? 'ماذا تريد أن أنفّذ بالضبط؟ صِف التغيير بجملة (مثال: "اضف صفحة للسائق وصفحة للعميل").'
                : 'What exactly should I execute? Describe the change in one sentence.'
        });
        return true;
    }
    return false;
}
