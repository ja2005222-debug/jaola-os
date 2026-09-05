/**
 * ⏹️ Abort Registry — إيقاف مهام الـ AI الجارية
 *
 * سجل مركزي لـ AbortController لكل غرفة (roomName = username-project).
 * - server.js يستدعي abortMission() من مسار /api/ai/abort أو حدث socket.
 * - jcr.js يسجّل المهمة عند بدايتها ويفحص throwIfAborted() بين المراحل.
 */

import { cancelWaiting, isMissionActive } from './ExecutionQueue.js';

const missions = new Map(); // roomName -> { controller, startedAt }
const pendingAborts = new Set(); // غرفٌ طُلب إيقافها قبل أن تُسجَّل مهمتُها

// تسجيل مهمة جديدة — يلغي أي مهمة سابقة لنفس الغرفة
export function registerMission(roomName) {
    const existing = missions.get(roomName);
    if (existing) existing.controller.abort();

    const controller = new AbortController();
    // 🔴 نافذةٌ عمياء: بين قبول الصفِّ للمهمة وبلوغها هذا السطر لا يجد
    //    `abortMission` شيئاً، فيُجاب المستخدمُ «لا توجد مهمة نشطة» وتُكمل
    //    المهمة. فصار الطلبُ المبكِّر يُحفَظ ويُستهلَك هنا.
    if (pendingAborts.delete(roomName)) controller.abort();
    missions.set(roomName, { controller, startedAt: Date.now() });
    return controller.signal;
}

/** طلبُ إيقافٍ لمهمةٍ بدأت ولم تبلغ `registerMission` — يُستهلَك عند أوّل تسجيل. */
export function requestAbortOnStart(roomName) {
    pendingAborts.add(roomName);
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
    // طلبٌ معلَّقٌ لم يُستهلَك لا يبقى ليقتل مهمةً لاحقةً لا علاقة له بها.
    pendingAborts.delete(roomName);
}

/**
 * ⏹ إيقافُ ما يعمل لهذا المشروع، أيّاً كان طورُه — المصدرُ الواحد لزرّ ⏹.
 *
 * 🔴 كان الزرّ يمرّ بـ`abortMission` وحدها، وهي لا ترى إلّا مهمةً بلغت
 *    `registerMission`. فالمهمةُ في الصفّ — التي قال لها النظامُ للتوّ
 *    «⏳ مهمتك في الصف (المركز N) وستبدأ تلقائياً» — يُجاب عنها «لا توجد
 *    مهمة نشطة» ثمّ تبدأ وتُكمل. ورسالةُ الانشغال نفسُها تقول «اضغط ⏹
 *    لإيقافه أولاً»، فتُحيل إلى زرٍّ لا يبلغ ما تَعِد به.
 *
 * @returns {'aborted'|'cancelled'|'pending'|'none'}
 */
export function stopMission(username, project, roomName) {
    if (abortMission(roomName)) return 'aborted';              // مسجَّلةٌ وتعمل
    if (cancelWaiting(username, project)) return 'cancelled';   // في الصفّ، لم تبدأ
    if (isMissionActive(username, project)) {                   // بدأت ولم تُسجَّل بعد
        requestAbortOnStart(roomName);
        return 'pending';
    }
    return 'none';
}

export function hasActiveMission(roomName) {
    const mission = missions.get(roomName);
    return !!mission && !mission.controller.signal.aborted;
}
