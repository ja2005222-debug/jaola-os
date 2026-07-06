/**
 * 🔄 State Machine — JAOLA OS
 *
 * كل مشروع له state واضح:
 * IDLE → PLANNING → GENERATING → REVIEWING → TESTING → DEPLOYING → COMPLETED
 *
 * يُمكّن:
 * - استئناف مشروع متوقف
 * - معرفة أين توقف كل مشروع
 * - منع التنفيذ المتوازي
 * - تتبع تقدم كل مرحلة
 */

// ═══════════════════════════════════════════════════════
// 📋 States المتاحة
// ═══════════════════════════════════════════════════════
export const STATES = {
    IDLE:       'idle',        // لا يوجد مشروع نشط
    PLANNING:   'planning',    // Clarifier يسأل
    GENERATING: 'generating',  // Coder يكتب
    REVIEWING:  'reviewing',   // Review + Testing
    DEPLOYING:  'deploying',   // Deploy على Vercel
    COMPLETED:  'completed',   // اكتمل بنجاح
    FAILED:     'failed',      // فشل
    PAUSED:     'paused',      // متوقف بأمر المستخدم
};

// الانتقالات المسموح بها
const TRANSITIONS = {
    [STATES.IDLE]:       [STATES.PLANNING, STATES.GENERATING],
    [STATES.PLANNING]:   [STATES.GENERATING, STATES.IDLE],
    [STATES.GENERATING]: [STATES.REVIEWING, STATES.FAILED, STATES.PAUSED],
    [STATES.REVIEWING]:  [STATES.DEPLOYING, STATES.GENERATING, STATES.FAILED],
    [STATES.DEPLOYING]:  [STATES.COMPLETED, STATES.FAILED],
    [STATES.COMPLETED]:  [STATES.GENERATING, STATES.IDLE],
    [STATES.FAILED]:     [STATES.GENERATING, STATES.IDLE],
    [STATES.PAUSED]:     [STATES.GENERATING, STATES.IDLE],
};

// ═══════════════════════════════════════════════════════
// 💾 تخزين حالات المشاريع
// ═══════════════════════════════════════════════════════
import { persistEntry, hydrateStore, onMongoReady } from '../services/persistence.js';

const projectStates = new Map(); // key: `${username}:${project}` → ProjectState

// 💾 استرجاع الحالات الدائمة من MongoDB عند توفر الاتصال
onMongoReady(() => hydrateStore('projectStates', (key, value) => {
    const current = projectStates.get(key);
    if (!current || (value?.updatedAt || 0) > (current.updatedAt || 0)) {
        projectStates.set(key, value);
    }
}));

function createProjectState(username, project) {
    return {
        username,
        project,
        state: STATES.IDLE,
        previousState: null,
        startedAt: null,
        updatedAt: Date.now(),
        progress: {
            planning: false,
            designing: false,
            coding: false,
            reviewing: false,
            testing: false,
            deploying: false,
        },
        completedAgents: [],
        currentAgent: null,
        deployUrl: null,
        error: null,
    };
}

// ═══════════════════════════════════════════════════════
// 🔑 دوال أساسية
// ═══════════════════════════════════════════════════════
const getKey = (username, project) => `${username}:${project}`;

export function getProjectState(username, project) {
    const key = getKey(username, project);
    if (!projectStates.has(key)) {
        projectStates.set(key, createProjectState(username, project));
    }
    return projectStates.get(key);
}

export function transitionState(username, project, newState, meta = {}) {
    const state = getProjectState(username, project);
    const allowed = TRANSITIONS[state.state] || [];

    if (!allowed.includes(newState)) {
        console.warn(`[StateMachine] انتقال غير مسموح: ${state.state} → ${newState}`);
        return false;
    }

    state.previousState = state.state;
    state.state = newState;
    state.updatedAt = Date.now();

    if (newState === STATES.GENERATING && !state.startedAt) {
        state.startedAt = Date.now();
    }

    if (meta.agent) state.currentAgent = meta.agent;
    if (meta.deployUrl) state.deployUrl = meta.deployUrl;
    if (meta.error) state.error = meta.error;
    if (meta.completedAgent) state.completedAgents.push(meta.completedAgent);

    // تحديث التقدم
    const progressMap = {
        [STATES.PLANNING]:   'planning',
        [STATES.GENERATING]: 'coding',
        [STATES.REVIEWING]:  'reviewing',
        [STATES.DEPLOYING]:  'deploying',
    };
    if (progressMap[newState]) {
        state.progress[progressMap[newState]] = true;
    }

    projectStates.set(getKey(username, project), state);
    persistEntry('projectStates', getKey(username, project), state);
    return true;
}

export function markAgentComplete(username, project, agentName) {
    const state = getProjectState(username, project);
    if (!state.completedAgents.includes(agentName)) {
        state.completedAgents.push(agentName);
    }
    state.currentAgent = null;
    state.updatedAt = Date.now();
    persistEntry('projectStates', getKey(username, project), state);
}

export function resetProjectState(username, project) {
    const key = getKey(username, project);
    const fresh = createProjectState(username, project);
    projectStates.set(key, fresh);
    persistEntry('projectStates', key, fresh);
}

// ═══════════════════════════════════════════════════════
// 📊 معلومات للواجهة
// ═══════════════════════════════════════════════════════
export function getProjectSummary(username, project) {
    const state = getProjectState(username, project);
    const completedCount = Object.values(state.progress).filter(Boolean).length;
    const totalStages = Object.keys(state.progress).length;

    return {
        state: state.state,
        progress: Math.round((completedCount / totalStages) * 100),
        completedAgents: state.completedAgents,
        currentAgent: state.currentAgent,
        deployUrl: state.deployUrl,
        duration: state.startedAt
            ? Math.round((Date.now() - state.startedAt) / 1000)
            : 0,
    };
}

// ═══════════════════════════════════════════════════════
// 🔍 التحقق من الحالة
// ═══════════════════════════════════════════════════════
export function isBuilding(username, project) {
    const state = getProjectState(username, project);
    return [STATES.GENERATING, STATES.REVIEWING, STATES.DEPLOYING].includes(state.state);
}

export function canStartNewBuild(username, project) {
    const state = getProjectState(username, project);
    return [STATES.IDLE, STATES.COMPLETED, STATES.FAILED, STATES.PAUSED].includes(state.state);
}
