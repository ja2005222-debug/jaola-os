import { randomUUID } from 'node:crypto';
import { getBuildDecision, updateBuildDecision } from './projectMemory.js';
import { routeMessage } from './router.js';

export function rememberReference(username, project, original, question) {
    const reference = { id: randomUUID(), original, question, createdAt: Date.now() };
    updateBuildDecision(username, project, { reference });
    return reference;
}

/** Handle a reference answer before generic confirmations can execute anything. */
export async function resumeReference(message, ctx, reporter, edit, router = routeMessage) {
    const { username, activeProject, roomName } = ctx;
    const pending = getBuildDecision(username, activeProject)?.reference;
    if (!pending) return false;
    const send = text => reporter.send(roomName, 'chat_reply', { message: text });
    const clear = () => updateBuildDecision(username, activeProject, { reference: null });
    if (/^(إلغاء|الغاء|توقف|cancel|stop)$/iu.test(message.trim())) {
        clear(); send('تم إلغاء طلب التعديل المعلّق.'); return true;
    }
    if (Date.now() - pending.createdAt > 24 * 60 * 60 * 1000) {
        clear(); send('انتهت صلاحية طلب التوضيح. أعد وصف التعديل والعنصر المقصود.'); return true;
    }
    if (/^(نعم|تمام|نفذ|نفّذ|yes|ok)$/iu.test(message.trim())) {
        send(pending.question); return true;
    }
    let decision;
    try {
        decision = await router(message, {
            projectName: activeProject, hasProject: true, reference: pending,
        });
    } catch { decision = null; }
    // Another answer or cancellation won while the model was resolving this one.
    if (getBuildDecision(username, activeProject)?.reference?.id !== pending.id) return true;
    if (decision?.requiresClarification && typeof decision.question === 'string' && decision.question.trim()) {
        const answers = [...(pending.answers || []), { question: pending.question, answer: message }];
        if (answers.length > 8) {
            clear(); send('لنحدد الطلب من جديد: اكتب اسم الصفحة والعنصر والتغيير المطلوب معًا.'); return true;
        }
        updateBuildDecision(username, activeProject, { reference: {
            ...pending, id: randomUUID(), question: decision.question.trim().slice(0, 500), answers,
        } });
    }
    if (!decision || decision.requiresClarification || decision.action !== 'edit' || decision.confidence < 60 || !decision.instruction) {
        send(decision?.question || pending.question); return true;
    }
    clear(); // Same-process answer consumption, before launching the edit.
    edit(`${decision.instruction}\n\nالطلب الأصلي:\n${pending.original}\nالتوضيحات السابقة:\n${JSON.stringify(pending.answers || [])}\nتحديد المستخدم للعنصر:\n${message}`, ctx);
    return true;
}
