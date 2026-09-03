/**
 * 📐 عقود المرحلة الأولى — كما انبثقت من الكود الفعلي (لا كما صُمِّمت نظرياً).
 *
 * التصميم الكامل بالأدلة في `backend/CONTRACTS.md`. هذا الملف يحمل فقط ما له
 * مستهلك حقيقي اليوم:
 *   • تعريفات الأنواع (JSDoc) لعقد الطلب `MissionRequest` وحزمة الوكلاء
 *     `AgentBundle` ومرحلة التسليم `StageFn` ومعالج النية `HandlerFn` —
 *     توثيق يعيش بجوار الكود ويقرؤه المحرّر، صفر تكلفة تشغيل.
 *   • `assertBuildAgents(agents)` — أول مستهلك تشغيلي للعقد: النواة تتحقّق من
 *     أعضاء الحزمة الإلزامية قبل إطلاق حلقة النقاش. بدونه كان غياب المبرمج
 *     يُلتقط داخل الحلقة كـ«❌ استثناء: agents.coreGenerateCodePlan is not a
 *     function» ويُعاد المحاولة حتى استنفاد كل الدورات ثم يُسجَّل درساً كاذباً
 *     باسم `debate_exhausted`.
 *
 * القاعدة: لا تجريد بلا مستهلك — أي إضافة هنا يجب أن يستدعيها كود حيّ.
 */

/**
 * @typedef {object} MissionRequest
 * الطلب الموحّد الذي تستقبله معالجات النية `_handleX(req, agents) → boolean`
 * في `jcr.js` (الترتيب المحفوظ: PlanningStage → Undo → BareConfirmations →
 * CeoIntent → UnifiedRoute → ModifyPattern → ClassifiedIntent).
 * @property {string} message           نصّ المستخدم الخام (بعد trim في server.js)
 * @property {string} normalizedMessage  بعد `normalizeText` (همزات/تشكيل/مسافات)
 * @property {object|null} meaningIntent  ناتج `detectIntentFromMeaning` الحتمي
 * @property {string} roomName          `${username}-${activeProject}` — غرفة Socket.io
 * @property {string} projectPath       مسار مجلد المشروع على القرص (مُتحقَّق ملكيته في server.js)
 * @property {string} username
 * @property {string} activeProject     هوية المهمة النشطة الوحيدة (لا missionId مستقل اليوم)
 * @property {'ar'|'en'} userLang       لغة المستخدم المكتشفة
 * @property {boolean|null} dbStatus    اتصال Mongo — يقرؤه `WorldRepresentation.scan` فقط
 * @property {object|null} clarifierState ناتج `agents.getState(username)` — `{ stage }`
 */

/**
 * @typedef {object} AgentBundle
 * حزمة الدوال المسطّحة التي يبنيها `server.js` (`POST /api/chat`) ويمرّرها
 * حرفياً إلى `runtime.handleUserMessage`. ثلاثة أعضاء إلزامية للنواة (تُستدعى
 * بلا حارس في `_stageDebate`)، والباقي اختياري محروس بـ`agents.X &&` أو `?.`.
 * @property {(prompt: string, codeContext: string, visualIdentity: object|null, images: [], onChunk: (c: string) => void, templateSections: string[], lang: string) => Promise<{files?: {name: string, content: string}[], error?: boolean, aiUnavailable?: boolean, details?: string}>} coreGenerateCodePlan إلزامي
 * @property {(plan: {files: object[]}) => {approved: boolean, feedback: string} | Promise<{approved: boolean, feedback: string}>} architectReview إلزامي
 * @property {(plan: {files: object[]}) => {passed: boolean, logs: string[]} | Promise<{passed: boolean, logs: string[]}>} qaVerify إلزامي
 * @property {(instruction: string, files: object[], lang: string, onChunk?: (c: string) => void) => Promise<{files?: object[], error?: boolean}>} [coreEditCodePlan]
 * @property {(goal: string, projectPath: string, typeHint?: string|null) => Promise<{success: boolean, template?: string, source?: string, error?: string}>} [templateAgent]
 * @property {(goal: string) => boolean} [needsBackend]
 * @property {(goal: string, frontendContext: string) => Promise<{success: boolean, files: object[], error?: string}>} [generateBackend]
 * @property {(goal: string, apiFiles: object[], currentScript: string) => Promise<string|null>} [generateFrontendAPIIntegration]
 * @property {(username: string, goal: string) => Promise<{type: 'clarification'|'build_direct', message: string, options?: string[]}>} [startClarification]
 * @property {(username: string, answer: string) => Promise<{type: string, message: string, options?: string[]} | null>} [processAnswer]
 * @property {(message: string) => boolean} [isConfirmation]
 * @property {(username: string) => string|null} [getFinalGoal]
 * @property {(username: string) => void} [clearState]
 * @property {(username: string) => {stage: string, lang?: string} | null} [getState]
 * @property {(username: string, project: string) => Promise<{success: boolean, deleted?: string, error?: string}>} [deleteProject]
 * @property {(opts: {message: string, hero?: boolean, target?: string|null}) => Promise<void>} [generateAiImages]
 * @property {() => Promise<void>} [diagnoseAiImages]
 * @property {(args: {projectPath: string, activeProject: string, currentUser: string, env: object}, io: object, emitUserProjects: () => void) => Promise<unknown>} [deployProject]
 */

/**
 * @typedef {(context: object, roomName: string, agents: AgentBundle) => Promise<void>} StageFn
 * مرحلة تسليم في النواة: تقرأ/تستبدل `context.plan.files` في مكانها، مغلقة على
 * نفسها (فشلها «⚠️ تخطّي» لا يُسقط البناء)، ولا تعرف ما قبلها أو بعدها —
 * الترتيب في `runDynamicMultiAgentRuntime` وحده.
 */

/**
 * @typedef {(req: MissionRequest, agents: AgentBundle) => Promise<boolean>} HandlerFn
 * معالج نية: يعيد `true` إن استهلك الرسالة (ردّ أو أطلق مهمة) فتتوقف السلسلة.
 */

/** الأعضاء التي تستدعيها النواة بلا حارس — غيابها خطأ تهيئة لا فشل بناء. */
export const BUILD_AGENTS_REQUIRED = Object.freeze(['coreGenerateCodePlan', 'architectReview', 'qaVerify']);

/** الأعضاء الاختيارية المعروفة (كلّها محروسة في jcr.js) — للتوثيق والفحص. */
export const BUILD_AGENTS_OPTIONAL = Object.freeze([
    'coreEditCodePlan', 'templateAgent', 'needsBackend', 'generateBackend',
    'generateFrontendAPIIntegration', 'startClarification', 'processAnswer',
    'isConfirmation', 'getFinalGoal', 'clearState', 'getState', 'deleteProject',
    'generateAiImages', 'diagnoseAiImages', 'deployProject',
]);

/** أسماء الأعضاء الإلزامية الغائبة أو غير القابلة للاستدعاء (فارغة = العقد سليم). */
export function missingBuildAgents(agents) {
    return BUILD_AGENTS_REQUIRED.filter((k) => typeof agents?.[k] !== 'function');
}

/**
 * يرمي خطأً واضحاً (`error.contract = 'Agent'`) إن نقصت الحزمة عضواً إلزامياً.
 * يُستدعى في أول سطر من `runDynamicMultiAgentRuntime`.
 */
export function assertBuildAgents(agents) {
    const missing = missingBuildAgents(agents);
    if (missing.length === 0) return;
    const err = new Error(`عقد الوكلاء ناقص — أعضاء إلزامية غائبة: ${missing.join(', ')}`);
    err.contract = 'Agent';
    err.missing = missing;
    throw err;
}
