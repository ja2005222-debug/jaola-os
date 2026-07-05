/**
 * ⏹️ Abort Registry — إيقاف مهام الـ AI الجارية
 *
 * سجل مركزي لـ AbortController لكل غرفة (roomName = username-project).
 * - server.js يستدعي abortMission() من مسار /api/ai/abort أو حدث socket.
 * - jcr.js يسجّل المهمة عند بدايتها ويفحص throwIfAborted() بين المراحل.
 */

const missions = new Map(); // roomName -> { controller, startedAt }

// تسجيل مهمة جديدة — يلغي أي مهمة سابقة لنفس الغرفة
export function registerMission(roomName) {
    const existing = missions.get(roomName);
    if (existing) existing.controller.abort();

    const controller = new AbortController();
    missions.set(roomName, { controller, startedAt: Date.now() });
    return controller.signal;
}

// طلب إيقاف — يُرجع true إذا كانت هناك مهمة نشطة فعلاً
export function abortMission(roomName) {
    const mission = missions.get(roomName);
    if (!mission || mission.controller.signal.aborted) return false;
    mission.controller.abort();
    return true;
}

export function isAborted(roomName) {
    return missions.get(roomName)?.controller.signal.aborted ?? false;
}

// نقطة فحص — تُستدعى بين مراحل التنفيذ في jcr.js
export function throwIfAborted(roomName) {
    if (isAborted(roomName)) {
        const err = new Error('MISSION_ABORTED');
        err.aborted = true;
        throw err;
    }
}

export function clearMission(roomName) {
    missions.delete(roomName);
}

export function hasActiveMission(roomName) {
    const mission = missions.get(roomName);
    return !!mission && !mission.controller.signal.aborted;
}
