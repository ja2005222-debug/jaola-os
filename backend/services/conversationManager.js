/**
 * 💬 Conversation Manager — مدير الحوار الموحد
 *
 * كانت حالة الحوار مشتتة على 3 أماكن: _pendingGoals داخل jcr (تضيع مع
 * إعادة التشغيل)، وconversationState في clarifier، وstateMachine.
 * هذا المدير هو المصدر الوحيد لحالة حوار كل مستخدم، دائم عبر MongoDB:
 *
 * - الهدف المعلق (بانتظار تأكيد المستخدم) ينجو من إعادة النشر
 * - getDialogState: صورة موحدة (الهدف المعلق + مرحلة الموضّح + حالة البناء)
 *   يستهلكها محرك القرار
 */

import { persistEntry, hydrateStore, onMongoReady } from './persistence.js';
import { getState as getClarifierState } from '../agents/clarifierAgent.js';
import { getProjectSummary, isBuilding } from '../agents/stateMachine.js';

const sessions = new Map(); // username → { pendingGoal, project, mode, updatedAt }

function getSession(username) {
    if (!sessions.has(username)) {
        sessions.set(username, { pendingGoal: null, project: null, mode: 'idle', updatedAt: Date.now() });
    }
    return sessions.get(username);
}

function save(username) {
    const s = getSession(username);
    s.updatedAt = Date.now();
    persistEntry('chatSessions', username, s);
}

// ─── الهدف المعلق (بانتظار "نعم/نفذ") ──────────────────────────────
export function setPendingGoal(username, goal, project = null) {
    const s = getSession(username);
    s.pendingGoal = goal;
    s.project = project;
    s.mode = 'awaiting_confirm';
    save(username);
}

export function getPendingGoal(username) {
    return getSession(username).pendingGoal;
}

// يُرجع الهدف ويمسحه — للاستهلاك الذري عند التأكيد
export function consumePendingGoal(username) {
    const s = getSession(username);
    const goal = s.pendingGoal;
    s.pendingGoal = null;
    s.mode = 'idle';
    save(username);
    return goal;
}

export function clearDialog(username) {
    const s = getSession(username);
    s.pendingGoal = null;
    s.mode = 'idle';
    save(username);
}

// ─── الصورة الموحدة لمحرك القرار ────────────────────────────────────
export function getDialogState(username, project) {
    const s = getSession(username);
    const clarifier = getClarifierState?.(username);
    return {
        pendingGoal: s.pendingGoal,
        clarifierStage: clarifier?.stage || null,   // clarifying | planning | null
        building: isBuilding(username, project),
        projectState: getProjectSummary(username, project).state,
    };
}

// 💾 استرجاع جلسات الحوار الدائمة — الهدف المعلق ينجو من إعادة النشر
onMongoReady(() => hydrateStore('chatSessions', (key, value) => {
    const current = sessions.get(key);
    if (!current || (value?.updatedAt || 0) > (current.updatedAt || 0)) {
        sessions.set(key, value);
    }
}));
