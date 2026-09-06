/**
 * 📐 عقود JAOLA OS v2 — Sprint 1 (Contracts) — كما انبثقت من الكود الفعلي.
 *
 * التصميم الكامل بالأدلة في `backend/CONTRACTS.md` (الشكل الفعلي + المستهدف +
 * خطة الهجرة لكل عقد). هذا الملف يحمل **فقط** ما له مستهلك حيّ اليوم:
 *   • تعريفات الأنواع (JSDoc) — توثيق بجوار الكود، صفر تشغيل.
 *   • `assertBuildAgents` — النواة تتحقّق من حزمة الوكلاء قبل حلقة النقاش.
 *   • `DELIVERY_STAGES` — عقد Task: خطّ التسليم كقائمة مراحل مسمّاة مرتّبة
 *     تستهلكها `runDynamicMultiAgentRuntime` (نقل حرفي لترتيب الاستدعاءات).
 *   • `isCapabilityName`/`validateCapabilities` — عقد Capability: يستهلكها
 *     `PluginLoader` عند التحقّق من manifest و`PluginOrchestrator` للفهرسة.
 *
 * القاعدة: لا تجريد بلا مستهلك — أي إضافة هنا يجب أن يستدعيها كود حيّ.
 * Provider وTransaction موثّقان كأنواع فقط (مستهلكوهما الحيّون مسمّون في
 * CONTRACTS.md؛ الـRegistry/Manager في Sprint 2/5).
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
 * الترتيب في `DELIVERY_STAGES` وحده.
 */

/**
 * @typedef {(req: MissionRequest, agents: AgentBundle) => Promise<boolean>} HandlerFn
 * معالج نية: يعيد `true` إن استهلك الرسالة (ردّ أو أطلق مهمة) فتتوقف السلسلة.
 */

/**
 * @typedef {object} Task
 * وحدة عمل مسمّاة داخل مهمة — عقد Task (النموذج المرجعي: مراحل التسليم في
 * `jcr.js` + ترتيب `dependsOn` في `backendTeam.planExecution`).
 * @property {string} name        اسم قانوني ثابت (kebab-case) يظهر في السجل والاختبارات
 * @property {string} run         اسم دالة المرحلة على الكلاس (`_stageX`) — StageFn
 * @property {boolean} [optional] فشلها لا يُسقط المهمة (كل مراحل التسليم اليوم optional)
 * @property {string[]} [dependsOn] أسماء مهام يجب أن تسبقها (Sprint 2: TaskGraph يحسب الترتيب؛ اليوم الترتيب هو ترتيب المصفوفة)
 */

/**
 * @typedef {string} CapabilityName
 * اسم قدرة على شكل `domain.action` (حروف صغيرة/أرقام/شرطات، نقطة واحدة على
 * الأقل): `site.check`, `travel.search`, `travel.booking`. تعلنه الإضافة في
 * `manifest.capabilities`، ويفهرسه `PluginOrchestrator` ليعرف الوكيل النظام
 * عبر القدرات لا أسماء الملفات (المبدأ 4 في الخط الأساس).
 */

/**
 * @typedef {object} Provider
 * مزوّد خارجي خلف قدرة — عقد Provider (النموذج المرجعي:
 * `travel-service/src/providers/index.js`: اختيار بمفتاح البيئة مع احتياط
 * محاكاة؛ و`core/providers/llm.js`: سلسلة failover Groq → DeepSeek → Gemini →
 * OpenAI؛ و`services/aiProviderCheck.js`: فحص صحة `{configured, ok, detail}`).
 * @property {string} name                       `duffel`, `liteapi`, `groq`, `mock-flights`
 * @property {string} kind                       `llm` | `flights` | `stays` | `cars` | `payment` | `email` | …
 * @property {(env: object) => boolean} configured  هل مفاتيحه موجودة (لا استدعاء شبكة)
 * @property {() => Promise<{ok: boolean, detail: string}>} [probe]  فحص حيّ اختياري
 * @property {number} [priority]                 ترتيبه في سلسلة الاحتياط داخل نوعه
 * الوكيل لا يصل إلى Provider مباشرة (المبدأ 3) — عبر Tool Runtime فقط (Sprint 2).
 */

/**
 * @typedef {object} Transaction
 * عملية تجارية/جانبية ذات حالة ومحاولات وأدلّة — عقد Transaction (النموذج
 * المرجعي: `travel-service/src/bookings.js` جدول انتقالات صريح + انتقال ذرّي
 * `store.transitionBooking(id, {from[], to, patch})` داخل UPDATE واحد؛
 * و`services/tradingBotLedger.js` سجلّ append-only `{id, at, kind, status,
 * txHash, error, updatedAt}`).
 * @property {string} id
 * @property {string} [idempotencyKey]   مفتاح يمنع التكرار (المبدأ 8)
 * @property {string} actor              username
 * @property {string} plugin             `travel` | `coding` | `finance`
 * @property {CapabilityName} capability `travel.booking`, `coding.deploy`, `finance.swap`
 * @property {string} status             من آلة حالات **متخصّصة** لكل نوع (المبدأ 9) — لا آلة عالمية
 * @property {string} [provider]
 * @property {string} [providerReference] معرّف الطرف الآخر (order id, tx hash, deployment id)
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number} attempts
 * @property {string|null} error
 * @property {object[]} evidence         `check[]` بنفس شكل Evidence
 * لا مستهلك في backend اليوم — أول مستهلك: Travel Adapter (Sprint 5) عبر `bookings.js`.
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

/**
 * خطّ التسليم بعد قبول الخطة — عقد Task الأول. الترتيب هو ترتيب الاستدعاءات
 * الحرفي الذي كان مضمّناً في `runDynamicMultiAgentRuntime` (الدفعات 1–3)؛
 * كل مرحلة `StageFn` مغلقة على نفسها فكلّها `optional`.
 * @type {ReadonlyArray<Task>}
 */
export const DELIVERY_STAGES = Object.freeze([
    { name: 'guard-and-write',     run: '_stageGuardAndWrite',     optional: true, gate: 'gate' },
    { name: 'review',              run: '_stageReview',            optional: true, gate: 'enhancement' },
    { name: 'refactor',            run: '_stageRefactor',          optional: true, gate: 'enhancement' },
    { name: 'testing',             run: '_stageTesting',           optional: true, gate: 'enhancement' },
    { name: 'requirements-verify', run: '_stageRequirementsVerify', optional: true, gate: 'gate' },
    { name: 'executive-memory',    run: '_stageExecutiveMemory',   optional: true, gate: 'advisory' },
    { name: 'seo',                 run: '_stageSEO',               optional: true, gate: 'enhancement' },
    { name: 'security',            run: '_stageSecurity',          optional: true, gate: 'enhancement' },
    { name: 'git-backup',          run: '_stageGitBackup',         optional: true, gate: 'enhancement' },
    { name: 'project-memory',      run: '_stageProjectMemory',     optional: true, gate: 'advisory' },
    { name: 'backend',             run: '_stageBackend',           optional: true, gate: 'enhancement' },
    { name: 'advanced-modules',    run: '_stageAdvancedModules',   optional: true, gate: 'enhancement' },
    { name: 'fullstack-scaffold',  run: '_stageFullStackScaffold', optional: true, gate: 'enhancement' },
    { name: 'render-config',       run: '_stageRenderConfig',      optional: true, gate: 'enhancement' },
    { name: 'behavior-verify',     run: '_stageBehaviorVerify',    optional: true, gate: 'gate' },
].map(Object.freeze));

// ⚖️ الحكمُ على التسليم (PM/2، `PRODUCT_MIND.md`). `optional` يبقى كما كان: لا مرحلةَ تُسقط
// الحلقة. الجديدُ `gate`: **بوّابة** تحكم على المنتج (كتابةُ الملفّات، المتطلّبات، السلوك)،
// **تحسين** يُغني ولا يحكم (SEO، أمان، خلفيّة…)، **استشاريّ** يتعلّم ويحفظ. قبل هذا كانت الحلقة
// تعيد `success: true` دون أن تقرأ ما وجدته البوّابات — فكان «لم يُتحقَّق» يساوي «نجح».
export const GATE_KINDS = Object.freeze(['gate', 'enhancement', 'advisory']);
export const VERDICT = Object.freeze({ PASS: 'PASS', FAILED: 'FAILED', UNVERIFIED: 'UNVERIFIED' });
const OUTCOME_STATUSES = new Set(['pass', 'fail', 'unverified', 'skipped']);

/** تسجّل مرحلةٌ ما وجدته: `pass` اجتاز، `fail` وجد ثغراتٍ بقيت، `unverified` لم تستطع الحكم، `skipped` لا ينطبق. */
export function recordGateOutcome(context, name, status, detail = '') {
    if (!context || typeof context !== 'object') return null;
    if (!OUTCOME_STATUSES.has(status)) throw new Error(`حالةُ بوّابةٍ غير معروفة: ${status}`);
    const entry = { status, detail: String(detail || '').slice(0, 300) };
    (context.verdicts ||= {})[name] = entry;
    return entry;
}

/**
 * الحكمُ من البوّابات وحدَها (دالّةٌ نقيّة):
 *   ثغرةٌ باقية في أيّ بوّابة → FAILED؛ وإلّا بوّابةٌ لم تستطع الحكم (أو لم تسجّل) → UNVERIFIED؛
 *   وإلّا اجتيازٌ واحد على الأقلّ → PASS؛ وكلُّها «لا ينطبق» → UNVERIFIED (لم يُتحقَّق من شيء).
 */
export function deliveryVerdict(outcomes = {}, stages = DELIVERY_STAGES) {
    const gates = stages.filter(s => s.gate === 'gate').map(s => {
        const o = outcomes?.[s.name];
        return o && OUTCOME_STATUSES.has(o.status)
            ? { name: s.name, status: o.status, detail: o.detail || '' }
            : { name: s.name, status: 'unverified', detail: 'لم تسجّل المرحلةُ حكماً' };
    });
    const has = (st) => gates.some(g => g.status === st);
    const status = has('fail') ? VERDICT.FAILED
        : has('unverified') ? VERDICT.UNVERIFIED
        : has('pass') ? VERDICT.PASS
        : VERDICT.UNVERIFIED;
    const mark = { pass: '✓', fail: '✗', unverified: '?', skipped: '–' };
    const summary = gates.map(g => `${g.name} ${mark[g.status]}`).join('، ');
    return { status, gates, summary };
}

const CAPABILITY_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/** `domain.action` بحروف صغيرة — `site.check` نعم، `SiteCheck`/`site` لا. */
export function isCapabilityName(name) {
    return typeof name === 'string' && CAPABILITY_RE.test(name);
}

/**
 * يتحقّق من قائمة قدرات manifest: يعيد `{ ok, capabilities, invalid }` —
 * القائمة الصالحة مُنقّاة من التكرار، و`invalid` أسماء المرفوض (لرسالة الخطأ).
 */
export function validateCapabilities(list) {
    if (list === undefined || list === null) return { ok: true, capabilities: [], invalid: [] };
    if (!Array.isArray(list)) return { ok: false, capabilities: [], invalid: [String(list)] };
    const invalid = list.filter((c) => !isCapabilityName(c));
    const capabilities = [...new Set(list.filter(isCapabilityName))];
    return { ok: invalid.length === 0, capabilities, invalid };
}
