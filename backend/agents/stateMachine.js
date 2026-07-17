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
    IDLE:         'idle',         // لا يوجد مشروع نشط
    PLANNING:     'planning',     // Clarifier يسأل
    ARCHITECTURE: 'architecture', // نموذج العالم + المخطط + القرار التنفيذي
    GENERATING:   'generating',   // Coder يكتب (حلقة النقاش)
    REVIEWING:    'reviewing',    // Review + Refactor + Testing
    VERIFYING:    'verifying',    // التحقق من متطلبات المشروع (المرحلة 6)
    DEPLOYING:    'deploying',    // Deploy على Vercel
    COMPLETED:    'completed',    // اكتمل بنجاح
    FAILED:       'failed',       // فشل
    PAUSED:       'paused',       // متوقف بأمر المستخدم
};

// الانتقالات المسموح بها — صادقة مع المسار الفعلي: المراحل الاختيارية
// (مراجعة/تحقق/نشر) قد تُتخطى عند استنفاد الميزانية، فالوصول المباشر
// للاكتمال مسموح. (كان GENERATING → COMPLETED مرفوضاً فيبقى المشروع
// عالقاً "قيد البناء" 10 دقائق بعد كل بناء ناجح — أصل القفل الوهمي.)
const TRANSITIONS = {
    [STATES.IDLE]:         [STATES.PLANNING, STATES.ARCHITECTURE, STATES.GENERATING],
    [STATES.PLANNING]:     [STATES.ARCHITECTURE, STATES.GENERATING, STATES.IDLE],
    [STATES.ARCHITECTURE]: [STATES.GENERATING, STATES.COMPLETED, STATES.FAILED, STATES.PAUSED, STATES.IDLE],
    [STATES.GENERATING]:   [STATES.REVIEWING, STATES.VERIFYING, STATES.DEPLOYING, STATES.COMPLETED, STATES.FAILED, STATES.PAUSED],
    [STATES.REVIEWING]:    [STATES.VERIFYING, STATES.GENERATING, STATES.DEPLOYING, STATES.COMPLETED, STATES.FAILED, STATES.PAUSED],
    [STATES.VERIFYING]:    [STATES.DEPLOYING, STATES.GENERATING, STATES.COMPLETED, STATES.FAILED, STATES.PAUSED],
    [STATES.DEPLOYING]:    [STATES.COMPLETED, STATES.FAILED],
    [STATES.COMPLETED]:    [STATES.PLANNING, STATES.ARCHITECTURE, STATES.GENERATING, STATES.IDLE],
    [STATES.FAILED]:       [STATES.PLANNING, STATES.ARCHITECTURE, STATES.GENERATING, STATES.IDLE],
    [STATES.PAUSED]:       [STATES.ARCHITECTURE, STATES.GENERATING, STATES.IDLE],
};

// 📡 أسماء الأحداث القانونية لكل حالة — لغة موحدة للواجهة والسجلات
// بدل الصياغات المتفرقة في كل نقطة بث
export const STATE_EVENTS = {
    [STATES.PLANNING]:     'MissionAccepted',
    [STATES.ARCHITECTURE]: 'ArchitectureStarted',
    [STATES.GENERATING]:   'CodingStarted',
    [STATES.REVIEWING]:    'ReviewStarted',
    [STATES.VERIFYING]:    'VerificationStarted',
    [STATES.DEPLOYING]:    'DeployStarted',
    [STATES.COMPLETED]:    'MissionCompleted',
    [STATES.FAILED]:       'MissionFailed',
    [STATES.PAUSED]:       'MissionPaused',
    [STATES.IDLE]:         'MissionReset',
};

// ناقل حالة اختياري: يُسجَّل مرة عند الإقلاع (server.js) فيُبَث كل انتقال
// ناجح للواجهة كحدث موحد — دون أن تعرف آلة الحالات شيئاً عن Socket.io
let stateEmitter = null;
export function setStateEmitter(fn) { stateEmitter = typeof fn === 'function' ? fn : null; }

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

    if ((newState === STATES.ARCHITECTURE || newState === STATES.GENERATING) && !state.startedAt) {
        state.startedAt = Date.now();
    }

    if (meta.agent) state.currentAgent = meta.agent;
    if (meta.deployUrl) state.deployUrl = meta.deployUrl;
    if (meta.error) state.error = meta.error;
    if (meta.completedAgent) state.completedAgents.push(meta.completedAgent);

    // تحديث التقدم
    const progressMap = {
        [STATES.PLANNING]:     'planning',
        [STATES.ARCHITECTURE]: 'designing',
        [STATES.GENERATING]:   'coding',
        [STATES.REVIEWING]:    'reviewing',
        [STATES.VERIFYING]:    'testing',
        [STATES.DEPLOYING]:    'deploying',
    };
    if (progressMap[newState]) {
        state.progress[progressMap[newState]] = true;
    }

    projectStates.set(getKey(username, project), state);
    persistEntry('projectStates', getKey(username, project), state);
    try {
        stateEmitter?.({
            username, project,
            state: newState,
            previous: state.previousState,
            event: STATE_EVENTS[newState] || newState,
        });
    } catch { /* البث لا يُفشل الانتقال أبداً */ }
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
// بناء لم تتغيّر حالته منذ هذه المدة يُعتبر ميتاً (تعطّلت العملية أو أُعيد
// تشغيلها وتُركت الحالة عالقة عند GENERATING) — نحرّر القفل تلقائياً كي لا
// يبقى المستخدم محجوباً بـ "مهمة تعمل بالفعل" إلى الأبد.
const BUILD_STALE_MS = 10 * 60 * 1000; // 10 دقائق

export function isBuilding(username, project) {
    const state = getProjectState(username, project);
    const active = [STATES.ARCHITECTURE, STATES.GENERATING, STATES.REVIEWING, STATES.VERIFYING, STATES.DEPLOYING].includes(state.state);
    if (!active) return false;

    // قفل عالق: حرّره واعتبره فشلاً قابلاً للاستئناف
    if (Date.now() - (state.updatedAt || 0) > BUILD_STALE_MS) {
        console.warn(`[StateMachine] بناء عالق لـ ${getKey(username, project)} — تحرير تلقائي.`);
        state.previousState = state.state;
        state.state = STATES.FAILED;
        state.error = 'stale_build_auto_recovered';
        state.currentAgent = null;
        state.updatedAt = Date.now();
        projectStates.set(getKey(username, project), state);
        persistEntry('projectStates', getKey(username, project), state);
        return false;
    }
    return true;
}

export function canStartNewBuild(username, project) {
    const state = getProjectState(username, project);
    return [STATES.IDLE, STATES.COMPLETED, STATES.FAILED, STATES.PAUSED].includes(state.state);
}
