/**
 * 🧭 ExecutionContext — بيئة تنفيذ المهمة الواحدة (Sprint 2b / Runtime).
 *
 * البند 11 من الخط الأساس: «بدلاً من تمرير username/project/roomName/agents/
 * projectPath بشكل مسطّح، نستخدم Context موحّداً». الحقول هنا **ليست تصميماً
 * نظرياً**: هي الستة التي كانت تتكرّر حرفياً في عشرة توقيعات داخل `jcr.js`
 * (`executeMission`, `_runMissionNow`, `surgicalEdit`, `_runSurgicalEditNow`,
 * `_understandGoal`, `_selectBuildStrategy`, `_enrichBuildContext`,
 * `_reportMissionSuccess`, `_buildFromRegistry`, `_buildFromClone`) — بنفس
 * الأسماء والمعاني، لا حقل واحد اختُرع.
 *
 * ما **لا** يدخل السياق: الهدف/التعليمة (`goal`/`instruction`) — هو *العمل*
 * لا *البيئة*، ويختلف بين استدعاءين في نفس السياق (مثال: «اكمل» يبني هدف
 * استئناف جديد على نفس المشروع). يبقى معاملاً أول صريحاً.
 *
 * السياق **مجمَّد**: مهمة واحدة لا تعيد تعريف مشروعها أو غرفتها في منتصفها.
 */

/**
 * @typedef {object} ExecutionContext
 * @property {string} username
 * @property {string} activeProject   هوية المهمة النشطة (مع username = المفتاح)
 * @property {string} projectPath     مجلد المشروع على القرص (مُتحقَّق ملكيته في server.js)
 * @property {string} roomName        `${username}-${activeProject}` — غرفة Socket.io
 * @property {import('../contracts/index.js').AgentBundle} agents
 * @property {boolean|null} dbStatus  اتصال Mongo — يقرؤه `WorldRepresentation.scan`
 */

/**
 * يبني سياق تنفيذ مجمَّداً. الحقول الناقصة تأخذ قيماً محايدة (لا رمي) — نفس
 * تسامح المسار الحالي مع استدعاءات داخلية تمرّر `{}` كحزمة وكلاء أو `null`
 * كحالة قاعدة بيانات.
 * @returns {ExecutionContext}
 */
export function createExecutionContext({ username, activeProject, projectPath, roomName, agents = {}, dbStatus = null } = {}) {
    return Object.freeze({
        username,
        activeProject,
        projectPath,
        roomName,
        agents: agents || {},
        dbStatus: dbStatus ?? null,
    });
}

/**
 * السياق من `MissionRequest` + حزمة الوكلاء — الشكل الذي تستعمله معالجات النية
 * السبعة (`_handleX(req, agents)`): `req` يحمل أصلاً الحقول الخمسة الأولى.
 * @param {import('../contracts/index.js').MissionRequest} req
 * @param {import('../contracts/index.js').AgentBundle} agents
 * @returns {ExecutionContext}
 */
export function contextFromRequest(req = {}, agents = {}) {
    return createExecutionContext({
        username: req.username,
        activeProject: req.activeProject,
        projectPath: req.projectPath,
        roomName: req.roomName,
        agents,
        dbStatus: req.dbStatus,
    });
}

/** نسخة بحزمة وكلاء مختلفة (المسار الوحيد الذي يفعلها اليوم: تراجع بلا وكلاء). */
export function withAgents(ctx, agents) {
    return createExecutionContext({ ...ctx, agents });
}
