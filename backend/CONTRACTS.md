# 📐 JAOLA OS — عقود المرحلة الأولى (Phase 1 Contracts)

> الوثيقة المرجعية لعقود النواة. تكمّل `ARCHITECTURE_MIGRATION.md` (سجلّ
> القرارات) ولا تكرّره: هنا **الشكل** — هناك **لماذا**.
>
> **القاعدة الحاكمة** (نفسها): كل عقد هنا مأخوذ من استدعاء حقيقي في الكود
> (مسار + سطر + grep) لا من تصميم نظري. الجزء التشغيلي الوحيد هو
> `core/contracts/index.js`، وفيه فقط ما له مستهلك حيّ اليوم — لا تجريد بلا مستهلك
> (درس `agentOrchestrator.js` المحذوف).

## 🗺️ خريطة الحدود (أين يعيش كل عقد)

```
HTTP  POST /api/chat  (server.js:1952)
  │  verifyToken → aiLimit → validate(schemas.sendMessage) → validateProjectOwnership   ← Permission (كلّها هنا)
  │  agents = { 19 دالة مسطّحة }  (server.js:1960)                                        ← Agent (الحزمة)
  ▼
JaolaCognitiveRuntime.handleUserMessage(null, data, agents, dbStatus)   (jcr.js:2483)
  │  data = { message, roomName, projectPath, username, activeProject, uiLang, track } ← Mission (المدخل)
  │  req  = { message, normalizedMessage, meaningIntent, roomName, projectPath,
  │           username, activeProject, userLang, dbStatus, clarifierState }             ← MissionRequest
  │  _handleX(req, agents) → boolean  × 7 بالترتيب                                      ← HandlerFn
  ▼
executeMission(goal, projectPath, username, activeProject, roomName, agents, dbStatus) (jcr.js:1222)
  │  enqueueMission({ username, project, goal, roomName, run, onWait })   (missionQueue.js:83)
  ▼
_runMissionNow → _understandGoal → _selectBuildStrategy → _enrichBuildContext → JCRContext
  │  transitionState(username, project, STATE, meta)  (stateMachine.js:118)             ← Event
  ▼
runDynamicMultiAgentRuntime(context, roomName, agents)   (jcr.js:293)
  │  assertBuildAgents(agents)                                                          ← Agent (التحقّق)
  │  _stageX(context, roomName, agents) → void  × 15 بالترتيب                            ← StageFn
  │  context.plan.files  ⇄  writePlanFiles(projectPath, files)  (jcr.js:155)            ← Tool (غير مُسمّى بعد)
  ▼
io.to(roomName).emit('log' | 'chat_reply' | 'project_state' | …)                        ← Event (البثّ)
  ▼
frontend/src/hooks/useSocket.js  (19 مستمعاً)
```

---

## 1) Mission

### الشكل الفعلي اليوم (دليل)
- **المدخل** من `server.js:1991`:
  `{ message, roomName, projectPath, username, activeProject, uiLang, track }` — يُتحقَّق
  منه بـ`schemas.sendMessage` (`middleware/security.js:45`: `message` 1..10000،
  `uiLang` ≤5، `track ∈ {site, system}`)، و`projectPath`/`activeProject` يضبطهما
  `validateProjectOwnership` (`server.js:585`) لا العميل.
- **داخل الوقت التشغيلي** يتحوّل إلى `MissionRequest` (`jcr.js` نهاية
  `handleUserMessage`) — الحقول العشرة موثّقة كـ`@typedef` في `core/contracts/index.js`.
  استهلاك كل معالج لها (grep على `= req`):

  | المعالج | الحقول المستهلكة |
  |---|---|
  | `_handlePlanningStage` | message, roomName, projectPath, username, activeProject, userLang, dbStatus, clarifierState |
  | `_handleUndo` | message, roomName, projectPath, username, activeProject, userLang |
  | `_handleBareConfirmations` | + dbStatus |
  | `_handleCeoIntent` | + normalizedMessage, dbStatus |
  | `_handleUnifiedRoute` | + dbStatus |
  | `_handleModifyPattern` | + dbStatus, clarifierState |
  | `_handleClassifiedIntent` | + normalizedMessage, meaningIntent, dbStatus |

- **الهوية**: لا `missionId` مستقلّ. `JCRContext.missionId = mission_<timestamp>`
  (`jcr.js:124`) يظهر في السجل فقط؛ الطابور وآلة الحالة والسجلّ الدائم كلّها
  مفهرسة بـ`username:project` (قرار بنيوي متعمَّد — `ARCHITECTURE_MIGRATION.md`
  قسم «التصحيح الدقيق»).
- **`dbStatus`** يُمرَّر عبر أربع طبقات (`handleUserMessage` → المعالجات →
  `executeMission` → `_runMissionNow` → `buildWorldModel`) ليقرأه سطر واحد:
  `WorldRepresentation.scan` (`jcr.js:85` → `dbState = connected|standby`).

### التصميم المستهدف (Phase 1)
- `MissionRequest` هو **العقد الرسمي** للطبقة الحوارية — ثابت كما هو اليوم.
- **الهوية تبقى `username:activeProject`** حتى إشارة منتجية بسجلّ مهام تاريخي
  (قرار مسجَّل). حين يأتي `missionId` حقيقي يُضاف *حقلاً* إلى `MissionRequest`
  و`enqueueMission` وسجلّ `mission_ledger.json` لا استبدالاً للمفتاح.
- ✅ **Sprint 2b**: المعاملات الموضعية المتكرّرة (`projectPath, username,
  activeProject, roomName, agents, dbStatus`) صارت **`ExecutionContext`** واحداً
  مجمَّداً (`core/runtime/ExecutionContext.js`) في **11 توقيعاً**:
  `executeMission`, `_runMissionNow`, `surgicalEdit`, `_runSurgicalEditNow`,
  `_understandGoal`, `_selectBuildStrategy`, `_enrichBuildContext`,
  `_reportMissionSuccess`, `_buildFromRegistry`, `_buildFromClone`,
  `_buildReactProject`. الهدف/التعليمة يبقى معاملاً أول صريحاً (عملٌ لا بيئة).
  `handleUserMessage` تبنيه مرة واحدة، والمعالجات السبعة عبر
  `contextFromRequest(req, agents)` — نفس الحقول الستة بالضبط (مثبَّت باختبار
  تطابق). `dbStatus` لم يعد يعبر أربع طبقات يدوياً: يركب السياق.

---

## 2) Agent — **ثلاث طبقات وُجدت في الكود، لا واحدة**

### (أ) الحزمة المسطّحة `AgentBundle` — العقد الفعلي بين `server.js` و`jcr.js`
- تُبنى في `server.js:1960` وتُمرَّر حرفياً. جرد الاستدعاءات في `jcr.js` (grep
  `agents\.X`، 37 موضعاً) يعطي ثلاث فئات:

  | الفئة | الأعضاء | الدليل |
  |---|---|---|
  | **إلزامي** (يُستدعى بلا حارس داخل النواة) | `coreGenerateCodePlan` (jcr:434)، `architectReview` (jcr:478)، `qaVerify` (jcr:479) | غيابه = `TypeError` داخل `try` حلقة النقاش → «❌ استثناء» × كل الدورات → `debate_exhausted` كدرس كاذب |
  | **اختياري محروس** | 15 عضواً: `coreEditCodePlan` (`&&`/`?.` في 5 مواضع)، `templateAgent`، `needsBackend`، `generateBackend` (خلف `needsBackend`)، `generateFrontendAPIIntegration`، `startClarification?.`، `processAnswer` (خلف `getState`)، `isConfirmation?.`، `getFinalGoal` (خلف مرحلة planning)، `clearState?.`، `getState?.`، `deleteProject`، `generateAiImages`، `diagnoseAiImages`، `deployProject?.` | كل موضع يتحقّق قبل الاستدعاء |
  | **ميت** | `coreClassifyIntent` | صفر استدعاء في `jcr.js` (التصنيف الفعلي: `classifyIntentFast` من `ceoBrain.js` + `this.classifyIntent`) |

- **التوقيعات غير موحّدة** (الجدول الكامل في `@typedef AgentBundle`): بعضها
  sync (`architectReview`, `qaVerify`, `needsBackend`, `isConfirmation`, `getState`)
  وبعضها async؛ المخرجات ثلاثة أشكال: `{files, error?, aiUnavailable?, details?}`
  (المبرمج)، `{approved, feedback}` / `{passed, logs}` (النقّاد)، `{success, …,
  error?}` (القالب/الخلفية/الحذف). و`deployProject` يستقبل `io` وردّ نداء —
  الوحيد الذي يعرف طبقة النقل.
- **المتلقّون**: الاستراتيجيات (`_buildFromRegistry`, `_buildFromClone`) تمرّر
  `agents` ولا تستدعي عضواً منها؛ `surgicalEdit` و`_verifyAndAutofix` تحتاجان
  `coreEditCodePlan` فقط (محروساً).

### (ب) العقد التصريحي `defineAgent` — ناضج فعلاً في فرق الخلفية والواجهة
`agents/backendTeam/agentSpec.js:61`: `{ id, role, icon, mission, responsibilities,
inputs, outputs, rules, qualityStandards, cooperation[{with, how}], selfReview,
neverDo, dependsOn[], modifier, debugFor }` — يُتحقَّق منه (`validateSpec`)،
ويُصرَّف إلى system prompt ثابت البنية (`compileSpecToPrompt`)، ويُنفَّذ بمنسّق
عام (`runBackendTeam` → `runAgent(agent, {goal, lang, artifacts, fileMap, llm,
byId})`) بنتيجة موحّدة لكل وكيل: `{ agent, role, summary, files[{path, content,
kind, action}], selfReviewPassed, issues[] } | { skipped, reason } | { error }`.
**هذا هو عقد الوكيل الوحيد الموحّد فعلاً في النظام** — 6 وكلاء خلفية + 6 واجهة
(`frontendTeam/specs.js`) يعيشون عليه، لكن `runFrontendTeam` غير موصول بالنواة
(server.js يعرض خطته فقط).

### (ج) الاستيراد المباشر — 20 وحدة وكيل تستوردها `jcr.js` بلا حزمة
`designerAgent, databaseAgent, authAgent, backendAgent, postgresAgent,
renderAgent, deployAgent, dependencyAgent, seoAgent, securityAgent,
refactorAgent, migrationAgent, reviewAgent, testingAgent, gitAgent,
requirementsVerifier, behaviorVerifier, modelLibrary, backendTeam, baseAgent`
(`jcr.js:4–51`) — تُستدعى داخل `_stageX` بتوقيعاتها الخاصة. هذه لا تمرّ بالحزمة
لأنها **مراحل** لا وكلاء قابلة للاستبدال من الخارج.

### التصميم المستهدف (Phase 1)
1. ✅ **الآن**: الحزمة صارت عقداً صريحاً — `BUILD_AGENTS_REQUIRED` (3) /
   `BUILD_AGENTS_OPTIONAL` (15) في `core/contracts/index.js`، والنواة تتحقّق منه
   (`assertBuildAgents`) في أول سطر من `runDynamicMultiAgentRuntime` فيفشل
   البناء **فوراً وباسم العضو الغائب** (`error.contract = 'Agent'`) بدل استنفاد
   الدورات. العضو الميت `coreClassifyIntent` حُذف من الحزمة ومن الـbarrel، ومعه
   `agents/ceoAgent.js` كاملاً (صفر قرّاء بعده — grep).
2. **الخطوة 2 (التالية)**: توحيد شكل *المخرج* أولاً لا التوقيع — كل عضو في
   الحزمة يعيد `{ ok: boolean, …payload, error?: string, aiUnavailable?: boolean }`
   عبر مُهايئات رقيقة في `server.js` (حيث تُبنى الحزمة) لا في الوكلاء أنفسهم؛
   بعدها تُوحَّد المدخلات إلى `(input, ctx)` حيث `ctx = { username, activeProject,
   projectPath, roomName, lang, onChunk }` — وهو نفس ما يُمرَّر اليوم موضعياً.
3. **الاتجاه بعيد المدى**: `defineAgent` هو الشكل القانوني للوكيل. وكلاء الحزمة
   الثلاثة الإلزامية مرشّحة للتحوّل إلى specs تصريحية تعمل تحت منسّق
   `runBackendTeam` العام — لكن ليس قبل Kernel (الخطوة 3)، لأن المنسّق يحتاج
   قائمة مراحل قابلة للتشغيل لا حلقة نقاش مضمّنة.

---

## 3) Tool — **غير موجود كتجريد؛ موجود كثلاثة حرّاس متفرّقين**

### الشكل الفعلي اليوم (دليل)
- لا يوجد ملف/كائن باسم Tool. الوكيل يكتب القرص مباشرة: 24 وحدة في `agents/`
  تستدعي `writeFile|mkdir|exec|spawn|fetch` (أعلى خمس: `jcr.js` 45، `fileManager`
  9، `deployAgent` 7، `pwaAgent` 5، `behaviorVerifier` 5).
- **الحارس الوحيد الموحّد** هو حارس المسار، وهو **مكرَّر ثلاث مرات** بمنطق
  متقارب لا متطابق:
  - `writePlanFiles` (`jcr.js:155`): normalize، يرفض المطلق و`..` والمخفي، ويتأكد
    `fp.startsWith(projectPath)`.
  - `safeRelPath` (`backendTeam/backendTeam.js:20`) داخل `writeBackendTeamFiles`.
  - `sanitizePath` (`middleware/security.js:18`) لمسارات HTTP (حفظ الملف).
- الفعل الثاني الحسّاس — **التنفيذ** (`execSync/spawn`) — بلا حارس مشترك
  (`gitAgent`, `deployAgent`, `behaviorVerifier` كلٌّ لنفسه).

### التصميم المستهدف (Phase 1)
- **Tool = الفعل الجانبي المحروس**، لا «كل دالة». عقد أدنى:
  `workspace.writeFiles(projectPath, files) → { written[], rejected[{name, reason}] }`
  و`workspace.readFiles(projectPath, {max}) → files[]` و`workspace.exec(projectPath,
  cmd, {timeout}) → { code, stdout, stderr }`.
- ✅ **Sprint 2c — نُفِّذ، لكن ليس كما خُطِّط أولاً**: الفحص كشف أن الحرّاس
  الثلاثة **ليسوا نفس الدالة**، ودمجهم الأعمى كان سيغيّر سلوك ثلاثة مسارات
  حيّة معاً: `safeRelPath` يرفض بقائمة أحرف بيضاء ويعيد `null` صامتاً؛
  `sanitizePath` يقبل أي أحرف لكنه **يرمي** ويعيد مطلقاً؛ `writePlanFiles`
  يرفض الملفات المخفية ويتخطّى صامتاً. المشترك الحقيقي هو **الاحتواء** وحده.
  فوُحِّد هو فقط في `core/runtime/workspacePaths.js`
  (`isInsideRoot`/`resolveInside` + `safeRelPath` منقولاً حرفياً لموقع محايد)،
  وكل موضع يحتفظ بسياسته الصريحة ويستدعي النواة.
- 🐛 **دفاعٌ معطوب أُصلح**: فحص الاحتواء في `writePlanFiles` كان
  `fp.startsWith(projectPath)` **بلا فاصل مسار** — شقيق باسم `<root>-evil`
  يمرّ منطقياً. لم يكن قابلاً للاستغلال فعلياً (سياسة `..` تسبقه و`path.join`
  يُطبّع)، لكنه دفاعٌ في العمق ضعيف؛ `isInsideRoot` يصلحه.
- 📌 **الحرّاس الثلاثة كانوا بلا اختبار واحد** قبل هذه الدفعة —
  `tests/workspacePaths.test.mjs` (5) أول تغطية لهم، وتثبّت كل سياسة كما هي.
- الوكلاء الـ24 تُهاجَر لاحقاً وحدةً وحدةً (الأثقل أولاً) — كل هجرة PR مستقل
  بخط أساس. **لا كتابة `Tool` عام قبل أن يستهلكه موضعان على الأقل.**

---

## 4) Event — **العقد الوحيد الناضج؛ له طبقتان**

### الشكل الفعلي اليوم (دليل)
- **أحداث الحالة** (`stateMachine.js:49` `STATE_EVENTS`): اسم قانوني واحد لكل
  حالة من عشر (`MissionAccepted … MissionReset`)، يُبَث مع كل `transitionState`
  ناجح عبر `stateEmitter` المسجَّل من `server.js:270` كحدث Socket.io
  `project_state { project, state, event, at }`. الواجهة تستمع له
  (`useSocket.js`). الانتقالات المسموحة جدولٌ صريح؛ الانتقال المرفوض
  `console.warn` ويعيد `false` بلا استثناء.
- **السجل الحي** (الطبقة الثانية، غير مُسمّاة عقداً لكنها الأكثر استهلاكاً):
  `emitLiveLog(roomName, layer, agent, message)` → `emit('log', { message:
  '[layer] ➔ [agent]: msg' })` بعد ترجمة حتمية للغة الغرفة (`logLocalizer`).
  الاختبارات التوصيفية كلّها تُثبّت هذا النصّ (52 اختباراً تطابق `\[Agent\]: …`).
- **مفردات البثّ** من `jcr.js` (11 حدثاً): `chat_reply` ×65، `agent_states` ×13،
  `preview_updated` ×9، `workspace_files` ×8، `project_metrics` ×7، `log` ×4 (+
  كل `emitLiveLog`)، `stream_done` ×3، `code_stream_chunk` ×2، `chat_stream_start/
  chunk/end` ×1. الواجهة تستمع لـ19 (الزائدة: `user_projects, presence,
  chat_history, connect*` من `server.js`).
- **أحداث الفريق** (`runBackendTeam` `onEvent`): `{type: 'agent_done'|'verify_failed',
  …}` — قناة داخلية ثالثة تُترجم إلى `emitLiveLog` في `_stageBackend`.

### التصميم المستهدف (Phase 1)
- **يبقى كما هو.** التغيير الوحيد المقترح لاحقاً (مع Mission Control، الخطوة 6):
  `log` يصبح **منظّماً** `{ message, layer, agent, at }` مع إبقاء `message` بنفس
  النصّ الحالي — إضافة حقول لا تغيير، فلا تنكسر الواجهة ولا الاختبارات الـ52.
- `STATE_EVENTS` + `project_state` هما **الطبقة العامة**؛ `onEvent` الفريق
  **طبقة داخلية** لا تُبَث مباشرة — فصل يُحفَظ.

---

## 5) Evidence — **موجود ومتماسك؛ وحدته «الفحص»**

### الشكل الفعلي اليوم (دليل)
- **وحدة الدليل** هي `check = { name, status: 'pass'|'fail'|'warn', detail }`
  (`behaviorVerifier.js:223, 241, 251, 414, 432–436`) — تنتجها
  `analyzeProjectStatic` (ساكن) و`runBehaviorChecks`/`verifyBehavior` (تشغيل حيّ
  بمهلة 4 ث) تحت `{ hasProject, checks }`.
- **الدماغ** `buildProjectBrain(mem, files)` (`services/projectBrain.js:98`) —
  دالة نقية تعيد `{ filesCount, files, structure, decisions, progress: {done,
  remaining, percent}, lastActivity, updatedAt }`؛ أدلّتها من *أنماط ملفات
  فعلية* (`evidence.frontend/styles/script/backend/database/auth/tests/deploy`).
- **التركيب المتأخّر** (`jcr.js:1098–1118`): `progress.works ∈ {true, false,
  null}` و`progress.remaining` تُصحَّح من `analyzeProjectStatic` **بعد** الإرجاع —
  «المئوية من الملفات، ويعمل فعلاً؟ من التشغيل» ولا يُخترَع أحدهما من الآخر.
- **الذاكرة التعليمية** (`services/platformLessons.js`): `recordMissionOutcome`
  (فئة فشل حتمية من 8) و`recordBehaviorGaps(verdict)` (الفحوص التي بقيت `fail`
  بعد الإصلاح) — الدليل الوحيد الذي يُحقن في prompt المولّد.

### التصميم المستهدف (Phase 1)
- **`check` هو عقد Evidence الرسمي** — يُوثَّق ويُثبَّت شكله باختبار (موجود ضمنياً في
  `behaviorVerifier.test.mjs`)، ولا يُعاد تصميمه.
- التوحيد الوحيد المقترح: `qaVerify` (`{passed, logs[]}`) و`architectReview`
  (`{approved, feedback}`) هما «فحوص» بلغة مختلفة — في الخطوة 2 يُضاف إليهما
  `checks[]` بنفس الشكل **دون إزالة** الحقول القديمة، فيصير للدماغ والدروس مصدر
  دليل واحد من النقّاد أيضاً.

---

## 6) Permission / Capability — **موجود عند الحدّ فقط؛ صفر داخل وقت التشغيل**

### الشكل الفعلي اليوم (دليل)
- كل الحماية في سلسلة HTTP لمسار `/api/chat` (`server.js:1952`):
  `verifyToken` (JWT، `server.js:550`) → `aiLimit` (حدّ معدل، `:442`) →
  `validate(schemas.sendMessage)` (Zod) → `validateProjectOwnership` (`:585`؛
  `sandbox_app` مفتوح، وضع Mongo offline يعتمد عزل المجلد).
- **الإدارة**: `adminOnly`/`isAdminUser` (`middleware/adminOnly.js`) — قائمة
  `ADMIN_USERS` أو علامة التوكن. تصل إلى وقت التشغيل **بطريقة واحدة فقط**:
  مغلقة داخل `agents.generateAiImages` (`server.js:1981`: `isAdmin:
  isAdminUser(req.user)`).
- **الحماية الداخلية**: حارس المسار ×3 (قسم Tool)، وحماية `sandbox_app` من
  الحذف (`deleteProjectCompletely`، `server.js:1103`)، ومهلة التشغيل السلوكي.
- **لا يوجد** أي كائن capability داخل `jcr.js`: كل وكيل يملك كامل القرص وكامل
  الشبكة وكامل الميزانية بمجرّد اجتياز الحدّ.

### التصميم المستهدف (Phase 1)
- **Permission تُشتقّ عند الحدّ وتُحمل في الطلب، لا تُعاد حسابها في الداخل.**
  حقل واحد: `MissionRequest.caps = { isAdmin, canDeploy, canDeleteProject,
  maxApiCalls? }` يبنيه `server.js` من `req.user` وإعدادات المستخدم، ويقرؤه
  المعالجون بدل الإغلاقات (أول مستهلك: `generateAiImages` الذي يحمل `isAdmin`
  مغلقاً اليوم؛ الثاني: `_handleCeoIntent` عند النشر).
- **لا يُنفَّذ الآن**: مستهلك واحد فقط موجود، والقاعدة «موضعان على الأقل». يُنفَّذ
  مع أول ميزة تحتاج قدرة ثانية (مثلاً حدّ ميزانية لكل مستخدم في Model Router،
  الخطوة 4).
- Capability للأدوات (أي وكيل يكتب أين) تأتي **بعد** وجود Tool (قسم 3) — لا
  معنى لصلاحية على فعل غير مُسمّى.

---

## 7) Task — **مراحل التسليم كقائمة مسمّاة (Sprint 1 ✅)**

### الشكل الفعلي (دليل)
- **النموذج المرجعي 1**: خطّ التسليم في `runDynamicMultiAgentRuntime` — 15
  استدعاءً متتالياً `await this._stageX(context, roomName, agents)` بعد قبول
  الخطة (الدفعات 1–3)، كلٌّ مغلق على نفسه («⚠️ تخطّي» لا يُسقط البناء).
- **النموذج المرجعي 2**: `backendTeam.planExecution(team)`
  (`agents/backendTeam/backendTeam.js:50`) — ترتيب طوبولوجي مستقرّ من
  `dependsOn` مع كشف الدورات («دورة اعتمادية … تعذّر ترتيب التنفيذ»). هذا
  **TaskGraph مصغّر يعمل فعلاً** على 6 وكلاء.

### العقد (`core/contracts/index.js`)
```
Task = { name: 'kebab-case', run: '_stageX' (StageFn على الكلاس), optional?: true, dependsOn?: string[] }
DELIVERY_STAGES: ReadonlyArray<Task>  — 15 مرحلة بالترتيب الحرفي السابق
```
- **المستهلك الحيّ**: `runDynamicMultiAgentRuntime` تكرّر على `DELIVERY_STAGES`
  (`for (const stage of DELIVERY_STAGES) await this[stage.run](…)`) — نقل
  حرفي، خط الأساس `jcrRuntimePipeline` (11) مطابق، واختبار يثبّت الأسماء
  والترتيب وأن كل `run` دالة حقيقية على النواة.
- ✅ **Sprint 2a**: `core/runtime/TaskGraph.js` — `orderTasks(items, {key, label})`
  هي خوارزمية `planExecution` حرفياً معمَّمة على أي مفتاح؛ النواة ترتّب
  `DELIVERY_STAGES` بها (بلا `dependsOn` اليوم فالناتج = ترتيب المصفوفة، مثبَّت
  باختبار) و`planExecution` صار غلافاً لها (نفس الناتج والرسالة). 4 اختبارات.
- **التالي (Sprint 2b)**: التشغيل الجزئي/الإيقاف بين المهام فوق الترتيب،
  و`ExecutionContext` بدل المعاملات الموضعية.

---

## 8) Capability — **الإضافة تعلن ما تقدر عليه (Sprint 1 ✅)**

### الشكل الفعلي قبل Sprint 1 (دليل)
لا وجود. الوكيل/المشرف يعرف الإضافة **باسم ملفها** فقط (`orchestrator.getAgent('siteChecker')`
في `server.js`)، والخط الأساس (المبدأ 4) يريد العكس: «Capabilities هي الواجهة
التي يرى بها Agent النظام».

### العقد (`core/contracts/index.js`)
```
CapabilityName = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/   — site.check, travel.booking
manifest.capabilities?: CapabilityName[]
isCapabilityName(name) / validateCapabilities(list) → { ok, capabilities (مُنقّاة), invalid }
```
- **المستهلكون الحيّون**: `core/PluginLoader.validateManifest` (اسم مرفوض يُسقط
  الإضافة بخطأ يسمّيه — كما `name` المفقود، لا بصمت)؛
  `PluginOrchestrator.capabilities()` / `findByCapability(name)` (فهرس يتبع
  التفعيل فوراً) و`status()` يعرضها لكل إضافة ولوحة الأدمِن؛
  `plugins/site-checker.js` يعلن `['site.check']`؛ القالب `AgentPluginTemplate`
  يوثّق الحقل.
- **الاختبارات**: `tests/pluginContracts.test.mjs` (3) على مجلد إضافات مؤقّت +
  `siteChecker` التكاملي كما هو.
- **الخطوة التالية**: Tool Runtime (Sprint 2) يختار المنفّذ عبر
  `findByCapability` لا الاسم؛ Policy (Sprint 3) تربط الأذونات بالقدرات
  (`travel.book` ← `travel.booking`).

---

## 9) Provider — **نموذجه المرجعي موجود في خدمة السفر (Sprint 1: نوع موثّق)**

### الشكل الفعلي (دليل)
- **النموذج المرجعي**: `travel-service/src/providers/index.js` — دالة بناء لكل
  نوع (`buildProvider`/`buildStaysProvider`/`buildCarsProvider`/`buildEsimProvider`)
  تختار بمفتاح البيئة (`DUFFEL_API_KEY`, `LITEAPI_API_KEY`) بسلسلة أولوية
  صريحة (LiteAPI → Duffel Stays → mock) واحتياط محاكاة حتمي **دائماً** —
  «نقطة التبديل الوحيدة». المزوّدات الحيّة بلا SDK (`duffelClient`, `liteApiClient`).
- **في الخلفية**: `agents/baseAgent.js` — سلسلة failover مضمّنة
  Groq → DeepSeek → Gemini → OpenAI خلف واجهة `groq.chat.completions.create`
  (25 مستورداً لا يعرفون بالتبديل)، وتصنيف أعطال حتمي `classifyAIError` →
  `quota|auth|ratelimit|config|transient`؛ و`services/aiProviderCheck.js` —
  فحص حيّ لكل مزوّد `{configured, keyTail, ok, detail}` يستهلكه
  `/api/admin/…` (`server.js:2516`) و5 اختبارات.

### العقد (`core/contracts/index.js`، نوع فقط)
```
Provider = { name, kind: 'llm'|'flights'|'stays'|'cars'|'payment'|'email'|…, configured(env) → boolean, probe?() → {ok, detail}, priority? }
```
- **لماذا لا Registry الآن**: المستهلك الوحيد الذي يحتاج «سجلّاً» عاماً هو
  Model Router (الخطوة 4) — بناء `ProviderRegistry` قبله تجريد بلا مستهلك.
  `checkAiProviders` هو `probe` فعلاً و`buildXProvider` هو `configured`
  فعلاً؛ التعميم يعني توحيد الشكلين لا اختراع ثالث.
- **المبدأ 3**: الوكيل لا يصل إلى Provider مباشرة — اليوم `baseAgent` يُخفي
  التبديل عن الوكلاء (جيد)، لكن وكلاء المراحل تستدعي مزوّدات النشر/Git مباشرة
  (`deployAgent`, `gitAgent`) — يُغلق مع Tool Runtime.

---

## 10) Transaction — **نموذجه المرجعي موجود في خدمة السفر (Sprint 1: نوع موثّق)**

### الشكل الفعلي (دليل)
- **النموذج المرجعي 1**: `travel-service/src/bookings.js` — آلة حالات
  **متخصّصة** بجدول صريح (`pending → issued|failed`, `issued → cancelled`،
  النهائيتان بلا إحياء) وانتقال **ذرّي** في المخزن
  (`store.transitionBooking(id, {from[], to, patch})` = `UPDATE … WHERE status
  = ANY(from)` في `postgresStore.js:552`) — «لا كتابة حالة مباشرة في أي مكان
  آخر»، وأثر جانبي واحد عند `issued` (مكافأة الإحالة) من نقطة انتقال واحدة.
- **النموذج المرجعي 2**: `services/tradingBotLedger.js` — سجلّ append-only
  لكل فرصة اعتُبرت (حتى المتجاهَلة) `{id, at, kind, status: 'pending'→…,
  txHash, gasCostBnb, realizedPnlBnb, error, updatedAt}` + `findStalePending`
  (المعلّق العالق) + heartbeat — هذا **Audit + Idempotency** عاملان.
- **في الخلفية**: لا Transaction عام. النشر (`deployAutomation`) والاشتراكات
  (`stripeService`) كلٌّ بحالته الخاصة.

### العقد (`core/contracts/index.js`، نوع فقط)
```
Transaction = { id, idempotencyKey?, actor, plugin, capability, status, provider?, providerReference?, createdAt, updatedAt, attempts, error, evidence: check[] }
```
- **قرار**: `status` من آلة حالات **متخصّصة لكل نوع** (Booking/Payment/
  Fulfillment — البند 13 من الخط الأساس، المبدأ 9) لا آلة عالمية؛ الانتقال
  ذرّي بنمط `{from[], to, patch}`؛ `evidence` بنفس شكل Evidence (`check`).
- **أول مستهلك**: Travel Adapter (Sprint 5) يعرض `bookings.js` عبر هذا
  الشكل. المستهلك الثاني المرشّح في الخلفية: `deployAutomation` (نشر = عملية
  ذات محاولات ومرجع خارجي) — بعد أن يثبت الشكل على الحجز.

---

## 📋 ملخّص القرارات

| العقد | الحالة قبل | القرار | أوّل مستهلك |
|---|---|---|---|
| Mission | شكل ضمني في 7 معالجات | ثُبِّت كـ`MissionRequest` (typedef) — الهوية `username:project` تبقى | المعالجات السبعة (قائم) |
| Agent | 19 دالة بلا تصنيف + عضو ميت | إلزامي 3 / اختياري 15 / حُذف 1 + `assertBuildAgents` | `runDynamicMultiAgentRuntime` (✅ الآن) |
| Tool | لا شيء + 3 حرّاس مكرّرة | `workspaceGuard` موحّد أولاً، ثم Tool بعد موضعين | الحرّاس الثلاثة (الخطوة التالية في هذا المحور) |
| Event | ناضج بطبقتين | يبقى؛ `log` منظّم لاحقاً بإضافة حقول | قائم |
| Evidence | `check` متماسك | يُثبَّت؛ النقّاد يُضيفون `checks[]` في الخطوة 2 | قائم |
| Permission | عند الحدّ فقط | `req.caps` مشتقّ عند الحدّ — مؤجَّل لمستهلك ثانٍ | `generateAiImages` (مغلق حالياً) |
| Task | 15 استدعاءً مضمّناً | `DELIVERY_STAGES` قائمة مسمّاة مرتّبة (+ `planExecution` نموذج TaskGraph) | `runDynamicMultiAgentRuntime` (✅ Sprint 1) |
| Capability | لا شيء (الوكيل باسم الملف) | `manifest.capabilities` + فهرس في المنسّق | `PluginLoader`/`PluginOrchestrator`/`site-checker` (✅ Sprint 1) |
| Provider | تبديل مضمّن في مكانين | نوع موثّق من `providers/index.js` + `baseAgent` + `aiProviderCheck` — Registry مع Model Router | `checkAiProviders` (probe) قائم |
| Transaction | لا شيء عام | نوع موثّق من `bookings.js` + `tradingBotLedger` — آلات حالات متخصّصة + انتقال ذرّي | Travel Adapter (Sprint 5) |

## 🔗 الترتيب المعتمد للخطوات التالية (يقود الخطة)
1. ✅ هذه الوثيقة + `assertBuildAgents` + حذف العضو الميت.
1b. ✅ **Sprint 1 (Contracts) مكتمل**: العقود في `core/contracts/index.js` — Task
   (`DELIVERY_STAGES`) وCapability (loader/orchestrator) بمستهلك حيّ، Provider
   وTransaction نوعان موثّقان بنماذجهما المرجعية ومستهلكهما المسمّى.
2. توحيد **مخرجات** الحزمة (`{ok, …}`) عبر مُهايئات في `server.js`، ثم المدخلات
   `(input, ctx)`؛ نقل `dbStatus` إلى `JCRContext`؛ `checks[]` للنقّاد.
3. Kernel: `runDynamicMultiAgentRuntime` من قائمة استدعاءات إلى مصفوفة مراحل
   `[{ name, run: StageFn, optional }]` قابلة للتشغيل الجزئي والإيقاف.
4. Model Router (يحتاج 3). 5. Verification طبقةً (يحتاج `check`). 6. Mission
   Control (يحتاج 3+5، ومعه `log` المنظّم). 7. Plugin Runtime 2.0.
- بالتوازي، مستقلّ عن الترتيب: `workspaceGuard` (Tool، خطوة أولى).

## Sprint 2d — AgentRuntime: منفّذ الوكيل الواحد

`runAgent` هو **الموضع الوحيد** الذي يتحوّل فيه عقدُ وكيلٍ إلى نداء نموذج ثم
إلى ملفات. انتقل حرفياً من `agents/backendTeam/backendTeam.js` إلى
`core/runtime/AgentRuntime.js` — والمستهلكان **اثنان اليوم لا واحد**:
`runFrontendTeam` يمرّ عبر `runBackendTeam` نفسه بفريقٍ آخر
(`agents/frontendTeam/index.js:16`)، فالتجريد له مستهلكٌ حقيقي بالمعنى
الذي يشترطه مبدأ «لا تجريد بلا مستهلك حقيقي».

### ثلاثة افتراضات صامتة أُسقطت (كلها من عائلة واحدة)

كلٌّ منها كان يجعل الكود **يجيب من مصدرٍ لا يخصّ السؤال**:

1. **`byId || TEAM_BY_ID`** في `runAgent`: منفّذٌ عامٌّ يسقط على خريطة فريق
   الخلفية حين لا يمرَّر شيء — فلو نُودي بلا `byId` من فريق الواجهة لَسمّى
   وكلاء الخلفية في رسالة التعاون. الاستدعاءان الحيّان يمرّران `byId`
   صراحةً، فالافتراض كان شيفرةً ميتة وإسقاطه لا يغيّر سلوكاً.

2. **`TEAM_BY_ID[id] || team.find(...)`** في `teamPlan`: خريطة الخلفية
   تُستشار أولاً حتى لخطة فريق الواجهة. لا أثر اليوم — تحقّقتُ بتشغيل
   المعرّفين: لا تصادم بين الفريقين — لكنه فخّ مؤجَّل: وكيل واجهةٍ يُسمّى
   باسم وكيل خلفيةٍ يُعرض بدور الخلفية ومخرجاتها بصمت. الخريطة تُبنى الآن
   من الفريق الممرَّر وحده.

3. **`spec.id ? spec : defineAgent(spec)`** في `compileSpecToPrompt`: وجود
   `id` وحده دليلاً على أن العقد مُطبَّع. عقدٌ نصفيٌّ بـ`id` كان يعبر ثم
   ينهار داخلاً بـ«Cannot read properties of undefined» لا يذكر الحقل
   الناقص. `defineAgent` مُتساوي القوى، والعقود الحيّة الأربعة عشر تجتازه
   جميعاً — فالتطبيع الدائم مطابقٌ سلوكياً ويعطي غيرَها رسالة العقد الصريحة.

## Sprint 3 (Policy) — ConfirmationManager وحده، وPermissionEngine مؤجَّل بسبب

خطة المالك تضع في Sprint 3 ثلاثة: `PermissionEngine + RiskPolicy +
ConfirmationManager`. نُفِّذ **الثالث وحده**، والسبب مسجَّل لا مسكوت عنه.

### لماذا لم يُبنَ PermissionEngine الآن
المبدأ العاشر: «لا تجريد بلا مستهلك حقيقي». أعدتُ التحقّق من الكود: لا كائن
capability داخل `jcr.js` إطلاقاً، والمستهلك الوحيد لا يزال `isAdmin` مغلقاً
في `generateAiImages`. (نتائج `isAdmin` في `agents/` كلها داخل **قوالب
مولَّدة** — كود التطبيقات التي يكتبها المولّد، لا صلاحيات وقت التشغيل.)
يُبنى مع أول ميزة تحتاج قدرة ثانية.

### العطب الذي أُصلح
`isConfirmation` (`agents/clarifierAgent.js`) كانت مطابقةَ **بادئةٍ** بلا حدود
كلمات. ناتج تشغيل فعلي قبل الإصلاح:

| الرسالة | كانت تُقرأ |
|---|---|
| «نعمل إيه؟» | ✅ موافقة → بناء كامل |
| «اهلا» | ✅ موافقة |
| «صحيح؟» | ✅ موافقة |
| «goodbye» | ✅ موافقة |
| «okay but wait» | ✅ موافقة |
| «اكملت المشروع أمس» | ✅ موافقة |

بوّابةٌ تبدأ بناءً كاملاً، **بلا اختبار واحد** يغطّيها — كحال حرّاس المسار
الثلاثة في Sprint 2c.

### ولماذا وقع الكاتب الأصلي فيه
لأن `\b` في JavaScript مبنيّة على ASCII فلا تعمل مع العربية: `/\bاه\b/` لا
تطابق حتى «اه» المجرّدة (مُثبَت باختبار صريح في المجموعة). فلم تكن أمامه أداة
حدودٍ سهلة. البديل الصحيح قطات Unicode
`(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` مع الراية `u`.

### التصميم
`readConsent(message)` بثلاث نتائج لا اثنتين: `confirm` / `decline` /
`unknown` — و«لا أعرف» ليست «نعم»، وهي وحدها التي تمنع تحويل الغموض إلى إذن.
الترتيب: رفضٌ صريح ← سؤال ← تردّد («okay but **wait**») ← طول الجملة ←
إثباتٌ في البداية بحدّ كلمة. **المفردات منقولة حرفياً** من النمط القديم:
الإصلاح في الآلية لا في تضييق ما يُقبل.

مستهلكان حيّان: `isConfirmation` (مرحلة الخطة في `jcr.js:2649`) و`isBareYes`
(`_handleBareConfirmations`) — كلاهما يحتفظ باسمه المُصدَّر فلا يتغيّر أي
مستدعٍ، و`isBareConsent` يحمل مفردات `BARE_YES` بحرفها لأنه يجيب سؤالاً
مختلفاً: «هل الرسالة *ليست إلا* نعم؟».

## Sprint 4 (Event/Audit) — ما وُجد قائماً، وما كان معطوباً

خطة المالك تضع في Sprint 4 ثلاثة: `EventBus + AuditLog + EvidenceStore`.
الجرد قبل البناء (المبدأ العاشر) أعطى نتيجة مختلفة عن التوقّع:

| المكوَّن | ما وجدته | القرار |
|---|---|---|
| **AuditLog** | `services/adminAudit.js` قائم و**دائم** (persist إلى Mongo + hydrate)، بـ10+ مواضع تسجيل حيّة تغطّي قرارات تمسّ مالاً | لا يُبنى — بناء ثانٍ تكرار |
| **EventBus** | Socket.IO هو الناقل: 15 نوع حدث، 114 بثّاً في `jcr.js` وحده عبر 6 ملفات | لا يُبنى — **وتحقّقتُ من سلامة العقد**: الخمسة عشر نوعاً كلها مستمَعٌ إليها في الواجهة، لا بثٌّ ميت ولا مستمعٌ يتيم |
| **EvidenceStore** | الشكل قائم (`{name, status, detail}` في `behaviorVerifier`) — لكن **الناقدَين خارجه**، وذلك كان يُنتج عطبين | يُوحَّد الشكل وحده |

### العطبان (كلاهما مُثبَت بالتشغيل)

**١) `qaVerify` كان يمحو الفرق بين العطب والتحذير عند الإرجاع.** داخلياً
`failures` و`logs` منفصلان، لكن العقد يعيد `logs: passed ? logs :
[...failures, ...logs]` — مصفوفة مسطّحة. و`jcr.js` يسجّل **كل** سطر فيها
درساً باسم `qa_failure`. ناتج تشغيل فعلي: عطبٌ صلب واحد («أقواس غير
متوازنة») يُسجَّل معه ثلاثة تحذيرات («بلا viewport»، «title مفقود»، «لا يوجد
footer») **بوصفها أسباب فشل بناء** — في الذاكرة التعليمية التي تُحقن في
prompt المولّد مستقبلاً. أي أن النظام كان **يتعلّم من وصفٍ غير صحيح لما جرى**.

**٢) `architectReview` كان يعود عند أول مشكلة.** خطةٌ بها ثلاث مشاكل بنيوية
تُبلَّغ بواحدة، فتُصلَح واحدةً كل جولة — وكل جولة تحرق `budget.consumeCall()`.
بميزانية محدودة قد لا تتقارب خطةٌ كل عيوبها كانت معروفة من الجولة الأولى.

### التصميم
`core/evidence/Check.js`: مصدرٌ واحد لبناء الفحص وفرزه بالشكل **القائم**
لا شكلٍ جديد. والناقدان يعيدان `checks[]` **مع إبقاء حقولهما القديمة
مشتقّةً منها** (`passed`/`logs`/`approved`/`feedback`) — فلا يتغيّر شيء لأي
مستهلك قائم.

📌 **وسقوطٌ صريح لمزوّدٍ بلا `checks`** (مُحاكٍ، إضافة، نسخة أقدم): تُسجَّل
`logs` كما كانت تماماً. بلا دليلٍ على التمييز لا نخترعه — والأسوأ من خلط
التحذيرات بالأعطاب أن نصمت عنها جميعاً لأن الحقل الجديد غائب. كشف هذا
اختبارُ خط الأساس نفسه، ولم يُعدَّل الاختبار.

### 🔬 عطب اختبارات متقطّع — مُسمّى الآن ولم يُصلَح بعد
`tests/siteChecker.test.mjs` يسقط أحياناً في التشغيل **المتوازي الكامل**
وحده بـ`uncaughtException: Unable to deserialize cloned data due to invalid
or unsupported version` — خطأ في نقل بيانات مُشغّل اختبارات Node بين العملية
الأم والابن، لا في منطق الاختبار. يمرّ 8/8 منفرداً (ثلاث مرات)، والمجموعة
الكاملة مرّت 845/845 في ثلاث تشغيلات متتالية بعده.

هذا **هو** المجهول الذي ظهر في Sprint 2d (826 اختباراً بفشل واحد ثم 830
نظيفة): ملفٌ يُجهَض عند التحميل فلا تُسجَّل اختباراته. لم يكن قد حُفظ مخرَجه
وقتها فتعذّر تسميته؛ الآن سُمّي. **ليس من هذا التغيير**: التعديل يمسّ ثلاثة
ملفات لا يستورد أيٌّ منها siteChecker أو ما يستورده. يبقى مفتوحاً بصدق بدل
أن يُسمّى «تذبذباً» ويُمضى عنه.

## Sprint 5 (Travel Adapter) — الشرط غير متحقّق، والسبب مسجَّل

خطة المالك: «جعل Travel أول Plugin حقيقي دون إعادة كتابة المجال»، ومعها
قيداه في §19: **لا نعيد كتابة Travel** و**لا ندمج قواعد بيانات Core وTravel**.
الجرد قبل البناء أعطى ثلاث حقائق:

1. **لا ارتباط تشغيلي إطلاقاً** بين `backend` و`travel-service`. الذكر
   الوحيد في `core/contracts/index.js` **توثيقي**: أسماء نماذج مرجعية لا
   استيراد ولا نداء. الخدمتان منفصلتان بخادمَيهما وقاعدتَي بياناتهما —
   وهذا ما يريده المالك نفسه.

2. **مسار استهلاك وكلاء الإضافات واحدٌ فقط**:
   `POST /api/admin/agents/:name/run` — **زرّ تجربة في لوحة المشرف**
   (`AdminPanel.jsx:391`). لا مسار مستخدم، ولا استدعاء من `jcr.js`.
   والإضافة الوحيدة المركّبة `site-checker`.

3. **فبناء «إضافة سفر» اليوم يُنتج إضافةً مستهلكها زرُّ تجربة** — لا
   «مستهلك حقيقي» بالمعنى الذي يشترطه المبدأ العاشر. وهي مراسم تجريد،
   وهو ما رفضناه لـPermissionEngine في Sprint 3 بنفس الحجّة.

**متى يصير الشرط متحقّقاً؟** حين يوجد طالبٌ فعلي لقدرة `travel.*` من داخل
النواة — موجِّه قدرات، أو مسار مستخدم، أو وكيل يحتاج نتيجة سفر. عندها
يكون المحوّل غلافاً رفيعاً فوق HTTP لخدمة السفر: بلا إعادة كتابة مجال،
وبلا دمج قواعد بيانات، وأول مستهلك حقيقي لعقد Transaction.

### 🪞 وتصحيحٌ لكودي أنا

طبّقتُ المبدأ العاشر على غيري في Sprints 3 و4، فوجب تطبيقه على ما كتبتُه:
`findByCapability(name)` شُحنت في Sprint 1 و**مستهلكها اختبارها وحده** —
لا سطر إنتاجي واحد يناديها. حُذفت. وتعود يوم يوجد الموجِّه الذي يسأل «من
يقدر على X؟» فعلاً، وهي سطرٌ واحد فوق `capabilities()` القائمة.

تمييزٌ دقيق حفظاً للصدق: أختاها من نفس Sprint **ليستا** كذلك —
`validateCapabilities` حيّةٌ في `PluginLoader` (تُسقط إضافةً بمعرّف قدرة
غير صالح بخطأ مسمّى)، و`capabilities()` تصل إلى `/api/admin/plugins` عبر
`status()`. المحذوف واحدٌ بعينه لا العقد.

---

## Sprint 6 (Coding Adapter) — البوابة مغلقة بنصّ الخطة نفسها

الخط الأساس §18 بند 6 حرفياً: «Sprint 6 — Coding Adapter: تحويل Coding إلى
Plugin **بعد نجاح Travel**». وSprint 5 لم يتحقّق شرطه (القسم أعلاه: لا مستهلك
حقيقي لقدرة `travel.*` من داخل النواة). فالشرط الذي وضعه المالك للبند 6 غير
متحقّق — لا برأيٍ منّي بل بنصّ البند.

وحتى لو فُتحت البوابة، الجرد يقول إنّ «تحويل Coding إلى Plugin» اليوم نقلُ
ملفاتٍ لا أكثر: `templateLibrary` و`templateLocalizer` مستهلكوها الأحياء
`jcr.js` و`server.js` و`knowledgeEngine` **باستيرادٍ مباشر**، ولن يمرّ أيٌّ
منها عبر سجلّ الإضافات بعد النقل — لأن مسار الاستهلاك الوحيد للسجلّ ما يزال
`POST /api/admin/agents/:name/run`. فالنقل يغيّر المسارات ويخاطر بمسار البناء
الحيّ، ولا يجعل شيئاً «إضافة» بأي معنى تشغيلي.

---

## Sprint 7 (Refactoring) — أول دفعة: سؤالٌ واحد كان له مصدرا حقيقة

Sprint 7 في الخطة: «إزالة التكرار ونقل الوظائف المشتركة إلى Core». مسحُ
التكرار الحقيقي في `agents/` و`services/` و`core/` أعطى مرشّحاً واحداً
ذا أثرٍ سلوكي مُثبَت (والباقي أسماء متشابهة داخل قوالب مولَّدة، لا تكرار).

### العطب

`needsBackend(goal)` كانت **مُعرَّفةً مرّتين بقائمتَي كلماتٍ مختلفتَين**،
والمهمة الواحدة تسأل السؤال في موضعين وتأخذ الإجابة من نسختين مختلفتين:

| الموضع | النسخة المستدعاة | ما يقرّره |
|---|---|---|
| `jcr.js:_stageBackend` | `knowledgeEngine` (تصل عبر `agents` من `server.js:63`) | هل تُولَّد ملفات الخلفية فعلاً |
| `jcr.js:_stageRenderConfig` | `backendAgent` (استيراد مباشر `jcr.js:32`) | هل يُعدّ نشر Render مشروعاً بخادم |

قياسٌ فعليٌّ قبل الإصلاح: **خمسة أهداف من سبعة** تحصل على إجابتين
متناقضتين. أخطرها «أريد موقعاً يستقبل مدفوعات stripe» → تُولَّد ملفات
الخلفية، ثم يُعدّ النشر مشروعاً **بلا خادم**: فواجهة الدفع لا تعمل في
الإنتاج أصلاً، والمستخدم يرى مشروعاً «مكتملاً».

### الإصلاح

`agents/backendNeed.js`: قائمةٌ واحدة (اتحاد ما قصده الكاتبان) ودالةٌ
واحدة، والملفّان السابقان يُعيدان تصديرها **بأسمائها كما كانت** فلم يتغيّر
سطرٌ واحد عند أي مستدعٍ (`server.js:63`، `jcr.js:32`، عقد Agent في
`core/contracts/index.js:132`).

**موضع الملف مقصود — `agents/` لا `core/`**: المبدأ السادس «Core يملك
orchestration وليس منطق Travel أو Coding»، وقائمةُ كلماتٍ تصف متى يحتاج
مشروعٌ مولَّدٌ خادماً هي منطق مجال البرمجة. فليس كل مشتركٍ يذهب إلى Core.

### ولماذا لم يكن الاتحادُ وحده كافياً

الاحتواء المجرّد (`goal.includes(kw)`) كان يقرأ `api` داخل *therapist*،
و`auth` داخل *author*، و`cart` داخل *cartoon*، و`store` داخل *restore*،
و`crud` داخل *crude*. هذه المطابقات الخاطئة كانت في نسخة `backendAgent`
وحدها؛ فالاتحادُ بلا إصلاحٍ كان **سيُدخلها إلى المولّد** فيبني خادماً
لصفحةٍ ساكنة ويحرق ميزانية نداءات المستخدم. لذلك:

- **اللاتينية**: حدود كلمات `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` مع لاحقة
  جمعٍ إنجليزية اختيارية (`order` تُطابق `orders`، و`auth` لا تبتلع
  `authentication` — ولهذا بقيت الكلمتان في القائمة).
- **العربية**: احتواءٌ كما كان — السوابق واللواحق تلتصق بالكلمة
  («الحساب»، «حسابات»، «للمستخدمين»)، فحدود الكلمات تُسقط الصحيح لا الخطأ.
  وهو نفس الدرس المسجَّل في `ConfirmationManager`: `\b` لا تعمل للعربية.

**ثمنٌ معلوم ومقبول**: «bookstore» لم تعد تُطابق `store`. يغطّيها
`cart`/`order`/`checkout`/«متجر» في أي هدف تسوّقٍ حقيقي.

**الدليل**: `tests/backendNeed.test.mjs` (6 اختبارات) يثبت تطابق الموضعين
على الأهداف الخمسة المتناقضة سابقاً، ويحرس الإيجابيات الصحيحة
والخاطئة في اللغتين. الحزمة: **851/851**.

---

## Sprint 7/2 — اسم خدمة النشر: ستة اشتقاقات، صيغتان، ونواتج ليست أسماء مضيف

اسم خدمة Render **هوية**، لا سلسلة عرض: يدخل `render.yaml` حرفياً
(`generateRenderConfig` لا يطهّره)، ويصير اسم المضيف
`https://<الاسم>.onrender.com`. وكان يُشتقّ في **ستة مواضع** بصيغتين:

| المواضع | الصيغة | الأثر |
|---|---|---|
| `jcr.js:_stageRenderConfig` | `` `${username}-${slug(project)}` `` | يطهّر المشروع **وحده** |
| `jcr.js` ×3 + `server.js` ×2 | `` slug(`${username}-${project}`) `` | يطهّرهما معاً |

### لماذا التعارض مضمون لا محتمل

تسجيل المستخدم يسمح بالشرطة السفلية (`^[a-zA-Z][a-zA-Z0-9_\-]{2,19}$`)،
و**ضيف النظام اسمه `guest_user` حرفياً** (`server.js:572,579`). فكل بناء
ضيفٍ كان يكتب في `render.yaml` الاسم `guest_user-…` بينما تستعمل بقية
المسارات `guest-user-…`: هويتان لمشروعٍ واحد، إحداهما تحوي شرطةً سفلية
**ممنوعة في DNS** أصلاً.

### وعطبٌ ثانٍ في الصيغتين معاً

الطبقة الأعلى تطهّر اسم المشروع إلى `[a-z0-9_-]` (`server.js:588`)، فاسمٌ
عربي مثل «متجري» يصل جترافا شرطاتٍ خالصة. فتُنتج الصيغتان `ali------`:
شرطات متتالية وطرفية — ليس اسم مضيف صالح. أي أن **كل مشروع باسم عربي**
كان يُكتب له إعداد نشرٍ لا يعمل.

### الإصلاح

`renderServiceName(username, project)` في `agents/renderAgent.js` مصدر
الاشتقاق الواحد للمواضع الستّة: تطهير الطرفين معاً، وطيّ الشرطات، وقصّ
أطرافها **بعد** الاقتطاع (الاقتطاع نفسه قد يترك شرطة)، وسقف 50.

وفيه قرارٌ لم يكن في أيٍّ من الصيغتين: اسمٌ لا يترك محرفاً لاتينياً
يُختصر إلى **بصمة ثابتة** من نصّه الأصلي (`p275ba8`) لا إلى فراغ. بدونها
تنطوي كل مشاريع المستخدم العربية على خدمةٍ واحدة — ونشرٌ **يدهس** مشروعاً
آخر أسوأ من نشرٍ يفشل.

**الحالة السائدة لم تتغيّر**: `ali`/`shop` تبقى `ali-shop` بحرفها، وهي
مخرَج الصيغتين القديمتين معاً. التغيير محصورٌ فيما كان باطلاً أو متعارضاً
— أي فيما لم يكن ينشر أصلاً.

### نسخة ثانية أخرى وُحِّدت بلا مساسٍ بالناتج

صيغة اسم مشروع **Vercel** كانت مكتوبةً مرّتين: `deployAgent.js:412` و
`customDomains.js:vercelProjectNameOf` — متطابقتين اليوم، وتعليق الثانية
يعلن أنها «نفس صياغة deployAgent». نسختان لهويةٍ واحدة تنتظران أن تفترقا،
فيُربط النطاق المخصّص بمشروعٍ غير الذي نُشر. `deployAgent` صار يستدعي
الدالة، والناتج لم يتغيّر بحرف.

### 📌 حدٌّ مفتوح عمداً

`vercelProjectNameOf` ما تزال تترك شرطةً طرفية للاسم العربي
(`guest-user-`). **لم أُصلحها**: اسم مشروع Vercel هويةٌ حيّة مرتبطة
بنطاقاتٍ مخصّصة منشورة، وتغيير صيغته يُعيد توجيهها — وذلك قرار المالك لا
قراري. مثبَّتٌ باختبارٍ يوثّق السلوك الحالي كما هو.

**الدليل**: `tests/renderServiceName.test.mjs` (6 اختبارات). الحزمة:
**857/857**.

---

## Sprint 7/3 — حارسٌ يُنشئ ما يفحصه، فلا يقع أبداً

`getProjectPath` في `server.js` كانت تفعل أمرين في نداءٍ واحد: تشتقّ المسار
**وتُنشئ المجلد** (`mkdirSync`) قبل أن تعيده. وهذا يُبطل كل فحص وجودٍ مبنيّ
عليها. وموضعه الحيّ:

```js
app.post('/api/site/password', (req, res) => {          // ⚠️ بلا مصادقة
    if (!fs.existsSync(getProjectPath(username, project)))
        return res.status(404).json({ error: 'المشروع غير موجود' });
```

الفحص يُنشئ ما يفحصه فيراه موجوداً **دائماً**. قياسٌ فعلي: مساحة عمل فارغة،
نداء واحد باسم مشروعٍ لا وجود له → الحارس يمرّ، ومجلدٌ جديد على القرص.

### السلسلة كاملة

هذا المسار يُعيَّن به **أول كلمة مرور للوحة موقعٍ منشور**، وحمايتاه اثنتان:
«المشروع موجود» و«لا كلمة مرور سابقة». الأولى مكسورة، فيبقى:

1. أيُّ أحد يرسل `username`/`project` كيفما شاء → لا 404.
2. لا كلمة مرور سابقة → يمرّ.
3. تُكتب بيانات الاعتماد ويُعاد **توكن موقعٍ صالح**.

فمن يعرف اسم مستخدمٍ ويخمّن اسم مشروعٍ **قبل إنشائه** يملك لوحته سلفاً: حين
يبنيه صاحبه وينشره، تكون كلمة مرور اللوحة عند غيره — يقرأ محتوى الموقع
ويعدّله ويرفع أصولاً. ومعها كتابةٌ غير مصادَقة على القرص لأي اسم.

### الإصلاح

`projectPathOf(baseWorkspace, username, activeProject)` في
`core/runtime/workspacePaths.js` — **اشتقاقٌ نقيّ بلا أثر على القرص**، ثم:

| الموضع | قبل | بعد |
|---|---|---|
| `/api/site/password` (الحارس) | `getProjectPath` (يُنشئ) | `projectDir` (نقيّ) — يقع الحارس فعلاً |
| `/api/site/content` (GET) | `getProjectPath` | `projectDir` |
| `/workspace` (معاينة) | `getProjectPath` | `projectDir` |
| `/preview/:file` | `getProjectPath` | `projectDir` |
| كل مسارات الكتابة | `getProjectPath` | كما هي — تُنشئ عن قصد |

والتطهير **منقولٌ حرفياً** والمحرف البديل `_` لم يُغيَّر، كي لا يتغيّر أيُّ
مسارٍ قائم على القرص.

ومعها استُبدل في `/preview/:file` فحصُ الاحتواء `filePath.startsWith(projectPath)`
بـ`isInsideRoot` — نفس عطب «البادئة بلا فاصل مسار» الذي بُنيت النواة لإصلاحه
في Sprint 2c، ولم يكن قد طُبّق هنا.

### 📌 حدٌّ باقٍ — قرار المالك

حتى بعد الإصلاح، من يعرف اسم مشروعٍ **موجود** لم تُعيَّن كلمة مرور لوحته بعد
يستطيع تعيينها أولاً («أوّل من يعيّن يفوز»). هذا اختيارُ تصميمٍ في المسار
الأصلي لا عطبٌ أدخلتُه، وتغييره (ربطه بحساب المالك، أو رابط تعيينٍ لمرّة
واحدة) قرارٌ منتَجيّ لا أتّخذه وحدي.

### 🪞 وخطأٌ ارتكبتُه هنا وأصلحتُه

كتبتُ الإصلاح أولاً في ملفٍ جديد `core/workspacePaths.js` واختباراً باسم
`tests/workspacePaths.test.mjs` — و**كلاهما كان موجوداً سلفاً**:
`core/runtime/workspacePaths.js` يملك اختصاص المسارات منذ Sprint 2c، وملف
الاختبار فيه خمسة اختبارات لحرّاس الاحتواء. فكتبتُ فوق اختباراتٍ قائمة
وأنشأتُ نسخةً ثانية من نواةٍ موجودة — عين ما يمنعه هذا السبرنت. كشفه عدُّ
الاختبارات (856 حيث يجب 861)، فاستُعيد الملف الأصلي بحرفه، وحُذفت نسختي،
ووُضعت الدالة في النواة القائمة، والاختبارات الجديدة في
`tests/projectPath.test.mjs`.

**الدليل**: `tests/projectPath.test.mjs` (4 اختبارات: الاشتقاق لا يلمس
القرص، الحارس يقع فعلاً، منع اجتياز المسار، وثبات التطهير حرفياً).
الحزمة: **861/861**.

---

## Sprint 7/4 — سرُّ التوقيع في التطبيقات المولَّدة: قيمتان لسرٍّ واحد

مسحُ الثوابت المعرَّفة في أكثر من ملف أعطى مرشّحين حقيقيَّين (وأغلبَ الباقي
اختلافاً مقصوداً: أسهم مقابل عملات، مهلٌ بحسب الغرض…).

### ١) `JWT_SECRET` في القوالب المولَّدة — عطبٌ وظيفيّ وأمنيّ معاً

قيمة السقوط كانت مكتوبة حرفياً في **ثلاثة قوالب بقيمتين**:

| الملف المولَّد | القيمة | الدور |
|---|---|---|
| `api/auth.js` | `jaola-secret-key-change-in-production` | يُصدر التوكن |
| `api/middleware/auth.js` | `jaola-secret-key-change-in-production` | يتحقّق منه |
| `api/auth/google.js` | `jaola-secret` | يُصدر التوكن |

فالمشروع الذي فيه دخولُ Google ولم يُضبط له `JWT_SECRET`: كل توكن يصدره
دخول Google يوقَّع بسرٍّ ويتحقّق منه الوسيط بسرٍّ آخر — **فيُرفَض فوراً**.
ميزةٌ مكتملة لا تعمل، وسببها قيمةٌ كُتبت مرّتين لا مرّة.

وقيمة السقوط نفسها **معروفة علناً** في هذا المستودع: أي تطبيق مولَّد يُنشر
بلا `JWT_SECRET` يمكن تزوير توكناته.

**الإصلاح**: `agents/generatedAppSecrets.js` مصدرٌ واحد —
`JWT_SECRET_SNIPPET` يُدرَج في القوالب الثلاثة، فلا تعود القيمة تُكتب في
أكثر من موضع. والسقوط الآمن **يبقى** (حذفه يُسقط تطبيقات تعمل اليوم — قرار
منتَجٍ لا قرار إصلاح)، لكن **الصمت عنه أُزيل**: الكود المولَّد صار يُنذر عند
الإقلاع حين لا يجد المتغيّر. نفس مبدأ حارس النِسَب في خدمة السفر.

**📌 قرارٌ للمالك**: هل يُحذف السقوط أصلاً فيفشل التطبيق المولَّد بصوتٍ عالٍ
حين لا `JWT_SECRET`؟ أو يُولَّد سرٌّ عشوائيّ لكل مشروع عند التوليد؟ كلاهما
أقوى ممّا هو قائم، وكلاهما يغيّر سلوك التطبيقات المولَّدة — فليس قراري.

### ٢) `AI_DOWN_HINT` — تكرارٌ كامنٌ لا عطبٌ حيّ

نفس التعبير في `failureMessages.js` و`platformLessons.js` بقيمتين: الأولى
تنقصها «رصيد المزوّد». **ولم أجد له أثراً حياً**، وأقولها صراحةً: الرسالة
الفعلية (`AI_UNAVAILABLE_MSG` في `baseAgent`) تحمل «غير متاحة حالياً»
و«رصيد المزوّد» معاً فتُطابق النسختين. لكنه سؤالٌ واحد بجوابين ينتظر أن
يفترقا، فوُحِّد في `isAiDownMessage` — والنسخة الأوسع هي المحفوظة.

**الدليل**: `tests/generatedAppSecrets.test.mjs` (4 اختبارات: سرٌّ واحد عبر
كل الملفات، صحّة نحوية للكود المولَّد، وجود الإنذار في كل ملف يحمل السرّ،
ووحدةُ مُميِّز تعطّل المزوّد). الحزمة: **865/865**.

---

## Sprint 7/5 — القرار المعلَّق نُفِّذ: سرٌّ لكل مشروع، وحكمٌ يقوله الخادم عن نفسه

عملان: أحدهما يُغلق سؤالاً تركته Sprint 7/4 مفتوحاً، والآخر يخصّ الاستضافة.

### ١) سرُّ التطبيق المولَّد صار مشتقّاً لكل مشروع

Sprint 7/4 وحّدت القيمة في مصدرٍ واحد وتركت سؤالاً للمالك: القيمة الموحَّدة
**معروفة علناً** في هذا المستودع، فأي تطبيق يُنشر بلا `JWT_SECRET` تُزوَّر
توكناته بمعرفة سطرٍ من كودٍ مفتوح. الخيارات كانت ثلاثة: يبقى كما هو، أو
يُحذف السقوط فيفشل التطبيق بصوتٍ عالٍ، أو يُشتقّ سرٌّ لكل مشروع.

**نُفِّذ الثالث** (بالتفويض القائم). `projectJwtSecret(projectPath, env)`:

```
'jaola_' + HMAC-SHA256(env.JWT_SECRET, projectPath).base64url.slice(0, 43)
```

ولماذا الاشتقاق لا التوليد العشوائي — وهذا بيت القصيد:

- **ثابتٌ للمشروع الواحد**: مولِّدان منفصلان (`authAgent` و`backendAgent`)
  يصلان القيمة نفسها بلا تمرير حالةٍ بينهما — أي بلا إعادة إنتاج العطب
  الذي أصلحته 7/4 من بابٍ آخر. وإعادة توليد المشروع **لا تُسقط جلسات
  مستخدميه**، وهو ما كان سيفعله سرٌّ عشوائيّ جديد في كل توليد.
- **مختلفٌ بين مشروعين**: لا يُفتح مشروعٌ بسرّ آخر.
- **غير متوقَّعٍ من الخارج**: الملح مفتاح جاولا نفسه وهو غير منشور.

والسقوط **لا يُغني عن ضبط `JWT_SECRET`** في بيئة التطبيق المنشور: السرّ
المشتقّ يعيش في شيفرة المشروع ومن يقرأ الشيفرة يقرأه. لذلك `process.env`
يبقى الأولوية، والإنذار عند الإقلاع (من 7/4) يبقى كما هو. الحدُّ الأدنى
ارتفع، والقرار المنتَجيّ (حذف السقوط أصلاً) بقي للمالك كما كان.

**تفصيلة اختبارية تستحق التسجيل**: أول تشغيلٍ للاختبار سقط لأن `JWT_SECRET`
غير مضبوطٍ في بيئة الاختبار، فسقط المشروعان على الثابت المعلن وتساويا.
**العطب في الاختبار لا في الكود** — الخادم يرفض الإقلاع بلا `JWT_SECRET`،
فالاشتقاق في الإنتاج مملَّحٌ دائماً. الاختبار يضبط ملحاً صريحاً ويختبر
السقوط بفرعه الخاص.

**الدليل**: `tests/generatedAppSecrets.test.mjs` (6 اختبارات — منها:
مشروعان مختلفان لا يتشاركان سرّاً، والمشروع الواحد ثابتٌ عبر إعادة
التوليد). الحزمة: **867/867**.

### ٢) جاهزية الإطلاق التجاري تُقال في سجلّ الاستضافة (travel-service)

المالك طلب التصرّف بشأن Render. لا مفتاح Render ولا CLI في هذه البيئة
(تُحُقِّق لا افتُرض) — فما يُنجَز من الكود هو **أن تقول الخدمة عن نفسها ما
ينقصها**، بدل أن تبقى القائمة في محادثةٍ أو في رأس أحد.

`travel-service/src/launchReadiness.js` يُطبع آخرَ سطورِ الإقلاع، مغذّىً
بـ`app.locals.launchState` — أي **حالة الحارس نفسها** لا حساباً موازياً
(`liveProducts` مرشِّحٌ معاكس لـ`nonLiveProducts` القائمة، من نفس المصدر).

**والدرس هنا أهم من الملف**: أول نسخةٍ كتبتها عدّت كل منتجٍ غير حيٍّ
مانعاً، فأعلنت على بيئة تطويرٍ كلّها محاكاة «⛔ ٧ موانع». إنذارٌ يصرخ حيث
لا خطر يُدرَّب قارئه على تجاهله — وهو **نفس عطب** هذا السبرنت كلّه: نظامٌ
يدّعي يقيناً لا يملكه. كشفه **تشغيل الخدمة فعلاً** لا قراءة الكود.

فالقاعدة صارت **تعارضاً لا «غير حيّ»**: مالٌ حقيقي بجانب مزوّدٍ تجريبي
(يدفع المسافر مقابل حجزٍ لا وجود له)، أو حجزٌ حقيقي بلا تحصيل (تُصدر
التذكرة ولا يصلك ثمنها). وحين لا مالَ ولا حجزَ حقيقيَّين فهي بيئة تطوير:
`info` تُوصف ولا يُنذَر منها.

🔒 ولا تُطبع قيمة سرٍّ واحدة — الأوضاع والأسماء فقط، واختبارٌ يحرس ذلك
صراحةً (نفس عرف `formatPercentIssue`).

**الدليل**: `travel-service/tests/launchReadiness.test.mjs` (12 اختباراً)،
وثلاث تشغيلات فعلية للخدمة. حزمة السفر: **479/479** مع Postgres.

---

## Sprint 7/6 — حارسان يَعِدان بما لا يفعلان

آخرُ ما بقي من هذه المرحلة: عطبان يتشاركان شكل السبرنت كلّه — **نظامٌ
يدّعي يقيناً لا يملكه** — لكنّهما هنا في **حارسَين** لا في مصدرَي حقيقة.

### ١) «أول من يعيّن كلمة مرور اللوحة يفوز» — وعدٌ يجتازه اثنان معاً

`POST /api/site/password` **بلا مصادقة** بحكم تصميمه: لوحة الموقع المنشور
يفتحها صاحبُ الموقع لا صاحبُ حساب جولا، فلا هوية تُتحقَّق. حارسُه كله هو
«أول من يعيّن يفوز». وSprint 7/3 أصلحت نصفه (الحارس كان يُنشئ المشروع الذي
يفحصه فلا يقع أبداً)؛ هذا نصفه الآخر:

```js
if (readSiteCred(username, project)?.password) return res.status(409)…
…
writeSiteCred(username, project, { password: hash });   // ← تدهس ما تجد
```

بين القراءة والكتابة فاصلٌ زمني، والكتابة غير حصرية. فطلبان متزامنان على
موقعٍ لم تُعيَّن كلمته بعد **يجتازان الفحص معاً**.

**والثمن أثقل من «يفوز آخرُ من يكتب»**: توكن اللوحة موقَّعٌ على
`{user, project}` وحدهما و**لا يرتبط بكلمة المرور إطلاقاً**. فكلا
المتسابقَين يخرج بتوكنٍ صالحٍ **ثماني ساعات**، ومن خسر الكتابة يحتفظ
بصلاحية تحرير محتوى الموقع ورفع ملفّاته كاملةً. حارسٌ يعلن فائزاً واحداً
ويسلّم المفاتيح لاثنين.

**الإصلاح**: `services/siteCreds.js` — المطالبة **إنشاءٌ حصري**
(`flag: 'wx'`) يقرّره نظام الملفات لا الكود المستدعي: يفوز كاتبٌ واحد
ويأخذ الباقي `EEXIST` بلا توكن. نفس عرف «أول كتابةٍ تفوز» في رمز
الاستعادة بخدمة السفر، ونفس مبدأ «الذرّية في المخزن لا في مُستدعيه».

نُقلت الأسطر الأربعة من `server.js` إلى وحدةٍ خاصة **لأنها لم تكن قابلة
للاختبار داخله** — وهو حارسٌ يستحقّ اختباراً. وهذا نقلٌ محتوى لا تفكيكاً:
`server.js` يحتفظ بغلافين رفيعين مربوطين بـ`SITECMS_DIR`.

📌 والدالّة **لا تُفتح لتعديلٍ لاحق عمداً**: تغيير كلمة المرور ميزةٌ
مستقلة تحتاج قراراً عن **من** يملك تغييرها، لا فرعاً في هذه الدالّة.

### ٢) اسم مشروع Vercel — التأجيل المرفوع

Sprint 7/2 أصلحت اسم خدمة Render وتركت اسم مشروع Vercel صراحةً، واختبارها
كان **يحرس القيمة المكسورة** بتعليقٍ يقول لماذا: هويةٌ حيّة مرتبطة بنطاقات
مخصّصة منشورة، فتغيير صيغتها قرارُ المالك. رُفع التأجيل.

```
('ali', 'متجري')  →  'ali-'
('ali', 'دكاني')  →  'ali-'      ← الاسم نفسه
```

عطبان في ناتجٍ واحد: شَرطةٌ طرفية **يرفضها Vercel** فالنشر يفشل؛ ولو قُبل
لكان أسوأ — مشروعان بهويةِ نشرٍ واحدة، و`customDomains.js` نفسه يربط
النطاقات بهذا الاسم في ثلاثة مواضع، فنطاق أحدهما يشير إلى موقع الآخر.

**الشرط الذي جعل الإصلاح آمناً**: **لا يتغيّر ناتجٌ كان صالحاً**. الصيغة
الجديدة مبنيّة على `services/hostNames.js` (نفس بدائيّتي Render — العطب
كان واحداً فلا يُصلَح مرّتين)، ونواتجها مطابقةٌ حرفياً للقديمة في كل مُدخَلٍ
كانت تُنتج له اسماً صالحاً؛ لا يتغيّر إلا ما كان **مرفوضاً عند Vercel
أصلاً**. واختبارٌ يقارن الصيغتين على مجموعة مُدخلات ويسقط عند أي انحراف —
لا التعليق وحده.

### 🪞 وملاحظة عن سلامة الحزمة

`tests/adminAgentGrounding.test.mjs` سقط مرّةً في تشغيلٍ متوازٍ برسالة
`Unable to deserialize cloned data` (عطبُ نقلٍ في مُشغّل اختبارات Node،
لا في الاختبار)، ونجح ٦/٦ منفرداً وفي التشغيل التالي. نفس صنف التذبذب
الموثَّق أصلاً لـ`siteChecker.test.mjs` — يُقال ولا يُدفن.

**الدليل**: `tests/siteCreds.test.mjs` (٥ اختبارات، منها سباقُ عشرة
متسابقين على مشروعٍ واحد، ومرجعٌ يُعيد إنتاج دهس الصيغة القديمة ليثبت أن
الاختبار يقيس شيئاً) و`tests/hostNames.test.mjs` (٥ اختبارات، منها حارسُ
عدم إعادة التسمية). الحزمة: **877/877**.

---

## Sprint 8 — العائلة نفسها بثوبٍ ثالث: شرطٌ لا يقع، وتأكيدٌ لا يملك يقينه

انتهت المرحلة السابقة على صيغتين من العطب الواحد: **سؤالٌ له مصدرا حقيقة
متناقضان**، و**حارسٌ يَعِد بما لا يفعل**. وهذه صيغةٌ ثالثة: **شرطٌ يُفترض
أنه يقع وهو مستحيل**.

### ١) تعريف الخدمة لزائرٍ جديد لم يره زائرٌ جديد قط (خدمة السفر)

كتلة `introBlock` تشرح ما تبيعه الخدمة لمن يصل `jatrava.com` أول مرّة.
مُظهِرها الوحيد `showGate()`، وهي لا تقع إلا حين **يُرفض توكنٌ قائم** — أي
جلسةٌ منتهية. ولمّا فُتح التصفّح بلا حساب صار `/api/travel/config` **ينجح
للزائر أيضاً**: فلا 401، ولا `showGate()`، و`boot()` يُخفيها عند كل نجاح.

**ولم يُكسَر سطرٌ واحد من كودها.** العالمُ حولها تغيّر فصار شرطُها لا يقع —
وهذا ما يجعل هذا الصنف عصيّاً على المراجعة: لا يظهر في diff، ولا يكسر
اختباراً، ولا يرمي خطأً. يظهر فقط حين **تُشغّل الشيء وتنظر**.

الشرط الآن **وجود الجلسة لا فشلُها**، والموضع صار **بعد** البحث لا قبله
(كُتبت يوم كانت الصفحة لا تُري إلا حقل توكن؛ اليوم البحث أمامه ويعمل).

🐞 **وميزةٌ ميتة تُخفي عيوبها**: أول ما أُحييت انكشف أن الكتلة **كلّها بلا
ترجمة** — عشرة نصوص، صفرٌ منها في الجدول، ولم يظهر ذلك قطّ لأنها لا تُعرض.
إحياؤها بلا ترجمة كان سيُري زائر `/en/` بطاقةً عربية كاملة.

⚠️ **ودرسٌ عن أداة الفحص نفسها**: `grep -F` لنصٍّ في `i18n.js` **كذب** —
قال «مترجَم» لأنه طابق النصّ **جزءاً من مفتاحٍ آخر**. الفحص الصحيح على
**عقدة النصّ كاملةً** كما يقرؤها المترجم. فحصٌ خاطئ أخطرُ من لا فحص: يعطي
طمأنينةً بلا سند.

### ٢) تذبذب `siteChecker` مُشخَّصٌ لا مُحتمَل

كان موثَّقاً «سقوطٌ متقطّع في التشغيل المتوازي». السبب الآن معروف:

```js
if (ms > 3000) issues.push(`زمن استجابة بطيء نسبياً: ${ms}ms`);   // في المنتج
assert.deepEqual(r.issues, []);                                   // في الاختبار
```

`ms` **زمنُ جدارٍ لجلبٍ حقيقي**، لا خاصيةٌ للصفحة. وحين تُشغَّل الحزمة كلها
بالتوازي على معالجٍ مشبع يتجاوز الجلبُ المحلي ٣ ثوانٍ فعلاً — فتظهر ملاحظة،
ويسقط التأكيد. **يسقط في التوازي وحده وينجح منفرداً**، وهو بالضبط شكل
التذبذب الموصوف.

**أُعيد إنتاجه لا استُنتج**: خادمٌ يتأخّر ٣٫٢ ثانية يخدم **نفس صفحة الاختبار
السليمة حرفياً** → `issues = ["زمن استجابة بطيء نسبياً: 3222ms"]`.

**والإصلاح في الاختبار لا في المنتج**: عتبة الـ٣ ثوانٍ إشارةٌ حقيقية —
موقعٌ بطيء يستحق الملاحظة. المُصلَح هو **ادّعاء الاختبار**: صار يؤكّد على
ملاحظات المحتوى (ما تملكه الصفحة فعلاً) لا على غيابٍ مطلقٍ لكل ملاحظة.

**وأُثبت أنه لم يضعف**: صفحةٌ ناقصةُ الوصف **وبطيئة** ما تزال تُسقط
الاختبار. الجدول الذي يثبت الأمرين:

| الحال | التأكيد القديم | الجديد |
|---|---|---|
| سليمة وسريعة | ✅ | ✅ |
| سليمة والآلةُ بطيئة | ❌ **تذبذب** | ✅ |
| ناقصةُ وصفٍ وبطيئة | ❌ | ❌ **ما زال يمسك** |

### ٣) مسحٌ لم يجد شيئاً — ويُقال

بعد إصلاح `introBlock` مسحتُ واجهة السفر كلها عن عناصر أخرى **لا يمكن أن
تظهر**: ٦١ عنصراً مخفيّاً ابتداءً، **كلّها لها مسار إظهارٍ حقيقي**.

وأولُ مسحٍ كتبتُه أعطى ٢٢ «ميتاً» — كلّها **كاذبة**: العناصر تُظهَر عبر
اسمٍ وسيط (`const box = $('filterChips'); box.classList.toggle(...)`) أو
معرّفٍ مبنيٍّ في قالبٍ نصّي (`` $(`${prefix}DiscountNote`) ``). أداةُ فحصٍ
ساذجة تُنتج قائمة عملٍ وهمية.

📌 **و`introBlock` لم يجده المسح** — وجدَته قراءةُ ملاحظةٍ مكتوبة في
`CLAUDE.md` تقول إن العطب موجود ولم يُصلَح. الفهرسُ الصادق للعيوب المعروفة
أنفعُ من ماسحٍ آلي، والنتيجة الفارغة تُقال كما تُقال النتيجة المليئة.

### ⚠️ وتذبذبٌ ثانٍ لم يُصلَح، ويُقال صراحةً

`tests/adminAgentGrounding.test.mjs` سقط **مرّةً واحدة** في تشغيلٍ متوازٍ
برسالة `Unable to deserialize cloned data` — عطبُ نقلٍ في مُشغّل اختبارات
Node لا في الاختبار. ثم نجح ٦/٦ منفرداً، و**ثلاث تشغيلات كاملة متتالية
للحزمة (877/877 في كلٍّ)** لم تُعِد إنتاجه. لم أُصلحه: لا أملك سبباً
مُثبتاً، و«إصلاح» ما لا أستطيع إعادة إنتاجه هو تخمينٌ يُسمّى إصلاحاً — وهو
عين ما تعالجه هذه المراحل. يبقى مرصوداً.

**الدليل**: `travel-service` **480/480** مع Postgres حقيقي (اختبارٌ جديد
بأربعة فحوص، أُثبت سقوطه بإعادة العطب الأصلي حرفياً)، و`backend`
**877/877** في ثلاث تشغيلات متتالية.

---

## Sprint 8/3 — «صفرٌ متاح» يُقرأ «لم يُصرَّح»، فيُباع ما لا يوجد

عطبٌ في خدمة السفر يمسّ **مالاً حقيقياً**، ووجدَه مسحٌ عن القيم الافتراضية
الرقمية التي قد تبتلع صفراً مشروعاً.

حدُّ كمية الأمتعة الإضافية كان:

```js
const maxQty = Math.min(Number(svc.maxQuantity) || 1, MAX_SERVICE_QTY_PER_LINE);
```

فمزوّدٌ يقول `maxQuantity: 0` — أي **لا شيء متاح** — يصير حدُّه **واحداً**،
فتُباع للمسافر حقيبةٌ قال الناقل إنه لا يملكها ويُقبض ثمنها، ثم يرفضها
المزوّد عند إنشاء الطلب.

**والتعليق فوق الحارس كان يَعِد صراحةً**: «دفاعٌ مستقل عن `maxQuantity` الذي
يزعمه المزوّد؛ **الأدنى بينهما هو الفعلي**». و`|| 1` يكسر هذا الوعد عند
الصفر بالضبط — الأدنى بين `(0, 10)` صفرٌ لا واحد. حارسٌ يقول ما لا يفعل،
نفس صيغة Sprint 7/6.

**وطبقتان تختلفان على معنى الصفر**: محوّل Duffel يكتب
`Number.isFinite(Number(s.maximum_quantity)) ? … : 1` — أي يحفظ الصفر
**عمداً** ويميّزه عن الغياب. ثم تُلغي الطبقةُ فوقه هذا التمييز. العناية في
مكانٍ واحد لا تنفع حين تُهدَر في الذي يليه.

### 🪞 والاتجاه المعاكس وقع في إصلاحي أنا

أول ما كتبتُه كان `Number.isFinite(Number(svc.maxQuantity))` — و**`Number(null)`
صفر**. فسكوتُ المزوّد الصريح (`null`) صار «صفر متاح» فمنع بيعاً مشروعاً:
نفس العطب مقلوباً، في الكود الذي يُصلحه.

**كشفه اختباري نفسه قبل الدفع** — لأنه اختبر الحالتين لا الحالة التي
أصلحتُها. وهذا هو الفرق بين اختبارٍ يحرس وآخر يصادق.

فصارت القاعدة في `src/declaredNumber.js` **مصدراً واحداً يستعمله المحوّل
والحارس معاً**: لا يُعدّ مصرَّحاً به إلا عددٌ فعليّ أو نصٌّ رقميٌّ غير فارغ،
والصفر **قيمةٌ مصرَّح بها** لا غياب. نفس انضباط `roundMoney` في `pricing.js`،
مكتوباً مرّة لا مرّتين.

📌 **وهذه ثالث مرّة** يظهر فيها هذا الالتباس بعينه في هذه الخدمة: استرداد
المزوّد (صمتٌ قُرئ صفراً فلم يُرَدَّ للمسافر شيء)، وجمع المبالغ غير المقرَّبة،
والآن حدُّ الكمية. ولهذا كُتبت القاعدة في ملفٍّ باسمها لا في تعليقٍ ثالث.

**الدليل**: `travel-service` **484/484** مع Postgres حقيقي — منها اختبارٌ
للحارس (صفرٌ يمنع، وسكوتٌ يسقط على واحدة، وسقف المنصة فوق الجميع) واختبارٌ
للقاعدة نفسها في الاتجاهين.

---

## Sprint 8/4 — استيلاءٌ على لوحة كل تطبيقٍ منشور، بتوكنٍ مكتوبٍ في صفحته

أخطرُ ما وجدتُه في هذه المراحل. وجدَه مسحٌ عن **رمزٍ مُصدَّرٍ من أكثر من
وحدة** (`verifyPassword` مرّتين) — تبيّن أنهما اختصاصان مختلفان لا تعارض
بينهما، لكن قراءة الثاني كشفت ما هو أسوأ.

### السلسلة

`/api/public/auth/set-password` كان محروساً بـ`verifyBotToken` وحده — أي
بتوكن **المشروع**، لا بهوية **الشخص**. وذلك التوكن ليس سرّاً:

```js
// services/dataSync.js — يُكتب في jaola-data.js داخل الموقع المنشور
var TOKEN = "…";
window.JAOLA_SYNC = (API && TOKEN) ? { api: API, token: TOKEN } : null;
```

فأي زائرٍ لأي موقعٍ مولَّد يفتح الطرفية، يقرأ `window.JAOLA_SYNC.token`،
ويرسل طلباً واحداً — فيستبدل كلمة مرور لوحة التحكم **بلا معرفة القديمة**.
أُثبت بالتشغيل، لا استُنتج:

```
١) المالك يضبط كلمة مرور حقيقية   → الدخول بها: true
٢) مهاجمٌ يرسل set-password بلا أي إثبات → {"ok":true}
٣) المهاجم يدخل: true   |   المالك يدخل: false  ← أُقصي من لوحته
```

**ووجودُ `/auth/login` نفسه هو الدليل على أن هذا عطب**: رأس `projectAuth.js`
يقول إن الغرض استبدالُ مقارنةٍ محلية بكلمة مرور مُجزَّأة «لا يغادر التجزيء
الخادم أبداً». فالتصميم يَعُدّ كلمة المرور اعتماداً حقيقياً — ومسارٌ شقيق
كان يسلّمه لمن طلبه. **حارسٌ يَعِد بما ينقضه جارُه** — نفس صيغة Sprint 7/6،
لكن الثمن هنا لوحةُ تحكّمٍ لعملٍ حقيقي (عيادة، صيدلية، محاسبة، مخزن).

### الإصلاح

الشرط في `projectAuth.setPassword` — الوحدةِ التي تملك الاختصاص، لا في
المسار: **استبدالُ اعتمادٍ قائم يتطلّب إثباتَه**. و١٩ قالباً تُرسل
`currentPassword` الآن، ولكلٍّ حقلٌ يجمعها (وحالةٌ في نسخة React).

### 📌 وما لا يُصلحه هذا — يُقال ولا يُدَّعى خلافُه

مشروعٌ **لم تُضبط له كلمة مرور بعد** يبقى على القيمة الافتراضية
(`DEFAULT_PASSWORD` في `projectAuth.js`) — معلنةٌ في المصدر ويعرفها
الجميع، فلا إثباتَ فيها يُطلَب. اشتراطُها كان
سيمنع أصحاب التطبيقات المنشورة سلفاً من أول تغيير **بلا أن يمنع مهاجماً
يعرفها أصلاً** — كلفةٌ بلا مكسب. الحماية الحقيقية لتلك الحالة **قرارُ
منتَج** (إلزام ضبط كلمة مرور عند أول نشر) لا شرطٌ يُضاف في هذه الطبقة.

⚠️ **وأثرٌ على المنشور سلفاً**: تطبيقٌ نُشر بالقالب القديم **وضُبطت له**
كلمة مرور سيفشل تغييرُها حتى يُعاد تطبيق القالب — فشلٌ **مغلَق** لا مفتوح،
وهو الاتجاه الصحيح في إصلاحٍ أمني.

### 🪞 وعطبٌ ثانٍ كشفته الاختبارات في عملي أنا

نصوصي العربية الجديدة كسرت اختبار تغطية الترجمة: القوالب تُبنى بالإنجليزية
عبر قاموس `templateLocalizer.js`، وما ليس فيه **يتسرّب عربياً**. وهذا
حرفياً عطب Sprint 8/1 (كتلة بلا ترجمة) — لكنه هنا **سقط في CI فوراً** لأن
ذلك القاموس محروسٌ باختبار، وذاك لم يكن. الفرق بين عطبٍ يُكتشَف في دقيقة
وآخر يعيش شهوراً هو وجود الحارس، لا ذكاء من كتب الكود.

**الدليل**: `tests/projectAuth.test.mjs` (٣ اختبارات جديدة **أُضيفت إلى
الخمسة القائمة لا فوقها**: الاستيلاء يُرفض، الحدّ المعلوم يُقال، والقوالب
الـ19 تُفحص واحداً واحداً). وأُثبت سقوطُها بإعادة العطب حرفياً (٦/٨) ثم
استعادة الإصلاح (٨/٨). الحزمة: **880/880**.

### 🧪 وحارسٌ خارجيّ أوقف الدمج — وثلاثةُ تشخيصاتٍ قبل أن أقرأ الدليل

`DeepSource: Secrets` سقط أربع مرّات. وخمّنتُ ثلاثاً بلا دليل: أن السبب
كلماتُ مرور اختبارية حرفية (والملف **مُعرَّفٌ اختباراً** أصلاً في
`.deepsource.toml`، فلم يكن سبباً قط)، ثم أن السبب اقتباسُ القيمة
الافتراضية في تعليق، ثم — بعد أن قرأتُ الملاحظة أخيراً — استنتاجٌ خاطئ
عن **شكل** ما يُطلق الماسح. ثلاثتها خطأ. وهو حرفياً العطب الذي أطارده في
هذه المراحل كلها: **تصرّفٌ بيقينٍ غير مملوك**.

والدليل كان متاحاً طوال الوقت بلا اعتماد: صفحة التشغيل في DeepSource
تُقرأ بـ`curl`، وفيها اسمُ الملف ونصُّ الملاحظة (`SCT-A000 · MINOR`).
كان يكفي أن أقرأها قبل أول تخمين.

**والسطر المُبلَّغ عنه لم ألمسه**: `clinicPhotoSrc()` في
`jaolaVetClinic.js`. جرَّه إلى نافذة الفرق سطران أضفتُهما فوقه بمئتَي
سطر. كان يلصق اسمَ معامل الاستعلام بتعبيرٍ يُشفّر `sync.token`، فيقرأ
الماسحُ ما بعد الاسم **قيمةً مكتوبة في المصدر**. وجرّبتُ أولاً إعادةَ
ترتيب المعاملات فبقي ساقطاً — الشكلُ لم يكن هو الشرط.

فالإصلاح ألّا يبقى في المصدر لصقُ نصٍّ باسم معامل أصلاً:

```js
var q = new URLSearchParams({ t: String(Date.now()), token: sync.token });
return sync.api + '/api/public/assets/clinicPhoto?' + q;
```

الرابط الناتج نفسه حرفاً بحرف (وأُثبت بالتشغيل: التوكن يعود من التحليل
كما دخل، بما فيه `+` و`/` و`=`)، والقيمة صارت **مُعرِّفاً لا نصّاً**.
ولا `skipcq` يُشحَن داخل كل موقع عميل مولَّد.

⚠️ **وأعدتُ الوقوع في الفخّ الموثَّق في `.deepsource.toml` نفسه**: أولُ
صياغةٍ لهذا الشرح اقتبست السطرَ المعيب حرفياً، فولّدت **ملاحظةً ثانية في
`CONTRACTS.md`**. التوثيق يُصاب بما يوثّقه. فوصفُ الشكل هنا بالكلمات لا
بنسخه.

### 🪞 وعطبٌ ثالثٌ في عملي، كشفته قراءة الملف لا الاختبار

`jaolaVetClinic.js` خرج بحقل `stPassCur` **مرّتين**: مُعرِّفٌ مكرَّر لا
يبلغ `getElementById` ثانيَه، وصاحب اللوحة يرى الحقل مضاعفاً. ومرّ لأن
حارسي قال «موجود» ولم يقل «واحد» — اختبارُ وجودٍ يصدُق على واحدٍ وعلى
اثنين. صار يعدّ: `assert.equal(fields, 1)`، وأُثبت سقوطُه بإعادة التكرار
(٧/٨) ثم استعادته (٨/٨). الحزمة: **880/880**.

### 📐 ثم تبيّن أنه صنفٌ لا حادثة — ٢١ موضعاً لا سطراً

بعد أن سقطت الملاحظة الأولى، ظهرت تحتها ملاحظةٌ أشدّ (`SCT-1000`، لا
`SCT-A000`) على **٢١ موضعاً** في قوالب المستشارين الثلاثة: كلّها تكتب
اسم مُعامل الاستعلام نصّاً ثم تلصق به تعبير التوكن. لم يُبلَّغ عنها من
قبلُ لأن أحداً لم يمسّ تلك الملفات؛ ومسُّها الآن — بحقلٍ أُضيف في أعلى
الملف — جرّها كلَّها إلى نافذة الفرق دفعةً واحدة.

فمعالجتها موضعاً بموضع كانت ستأخذ جولات CI بعدد الصفحات. عولجت صنفاً:
دالّةٌ واحدة في كل قالب تبني المُعامل بـ`URLSearchParams`، و٢١ نداءً
تستدعيها. أُثبت أن الرابط لا يتغيّر: التوكن يعود من التحليل كما دخل في
كل الحالات الحدّية (`+` و`/` و`=` والمسافة والاقتباس)، وapp.js لكل قالب
يُفحص نحوياً بـ`vm.Script` فيمرّ. وحارسٌ يمنع العودة:
`cloneTemplates.test.mjs` — أُثبت سقوطه بإعادة موضعٍ واحد. **881/881**.

📌 **ويبقى مفتوحاً ما لا يحلّه هذا**: التوكن في مسار الاستعلام يتسرّب في
سجلّات الخادم وتاريخ المتصفح وترويسة الإحالة. نقلُه إلى ترويسة `Authorization`
يحتاج تغيير عقد الخادم، و`<img src>` لا تحمل ترويسةً أصلاً — فذاك قرارُ
تصميمٍ لمرحلةٍ مستقلّة، لا تُدَّعى هنا.

---

## Sprint 8/5 — حارسٌ قائمٌ يُلتَفُّ عليه: صفرُ الأدمن يصير هديّةً للجميع

مسحٌ عن نفس عائلة Sprint 8/3 (`صفرٌ يُقرأ سكوتاً`) في الخدمات الحقيقية
لا القوالب. ٢١ موضعاً كان فيها الافتراضيّ **صفراً** — أي لا فرق، فتُركت.
وموضعان فيهما الافتراضيّ **غير صفري**، أخطرهما:

```js
const percent = Number(req.body?.discountPercent) || 15;   // حملة الإطلاق
```

و`normalizeDiscountCode` **ترفض ما دون ١ صراحةً** («نسبة الخصم رقم بين 1
و100») — لكنها لا ترى القيمة أصلاً: `|| 15` يبتلع الصفر والنصّ الفارغ
وnull قبلها. **حارسٌ موجودٌ يُلتَفُّ عليه**، لا حارسٌ غائب.

وثمنُه أن هذه الحملة **تُنفَق مرّة**: `liveAnnouncementSentAt` يمنع إعادة
الإرسال لمن استلم، فالكودُ الذي وصل الجميع نهائيٌّ لا يُصحَّح بتشغيلٍ
ثانٍ. أدمنُ كتب صفراً كان يُهدي ١٥٪ لكل حساب، بلا رجعة.

الإصلاح `declaredNumber` — القاعدة نفسها التي كُتبت في Sprint 8/3، لا
قاعدةً ثانية: الغيابُ وحده يأخذ الافتراضيّ، والمُعلَنُ يبلغ المُحقِّق
فيحكم فيه. و`expiresInDays: 0` صار يعني «منتهٍ الآن» — والمخزن يقبله
و`computeDiscount` يرفضه لاحقاً بصدق، بدل أن يصير ثلاثين يوماً صامتة.

📌 **وحدٌّ يبقى ويُقال**: مُدخَلٌ غير قابل للتحليل (`"abc"`) ما زال يسقط
إلى الافتراضيّ — هذا عقدُ `declaredNumber` في المستودع كلّه، وتغييره
يمسّ Sprint 8/3 معه، فلم يُهرَّب هنا.

**الدليل**: اختبارٌ يقطع الاتجاهات الثلاثة (صفرٌ يُرفَض ولا يُنشئ كوداً،
صفرُ أيّامٍ ينتهي فوراً، والغيابُ يبقى على ١٥٪/٣٠ يوماً)، أُثبت سقوطه على
الكود القائم برسالته الصحيحة قبل الإصلاح. **486/486 مع Postgres حقيقي.**

### 🔎 وثلاثةُ مسوحٍ رجعت فارغة — تُقال كما هي

- **مُعرِّفٌ مكرَّر في HTML** (شكلُ العطب الذي وقعتُ فيه في 8/4): صفرُ
  حالات في كل صفحات الخدمات والقوالب الـ37.
- **`Number(x) || D` بافتراضيٍّ غير صفري**: موضعان فقط، عولج أخطرهما.
- ⚠️ **وأولُ تشغيلٍ لهذين المسحين كذب**: صدرا من مجلّدٍ خاطئ (الصدفة
  تحتفظ بمجلّدها بين النداءات) فأعادا «نظيف» عن كل شيء. كشفه أن
  `grep "Number("` في `backend/services` أعطى **صفراً** — وهو مستحيل.
  نفس درس 8/1: **فحصٌ خاطئ أخطرُ من لا فحص**، والرقم المستحيل هو ما
  يكشفه.

---

## Sprint 8/6 — وعدُ صلاحيةٍ يُختلق حين يسكت المزوّد

آخرُ موضعٍ من العائلة في مسار بيعٍ حيّ. `liteApiStaysProvider` كان يكتب:

```js
const expiresAt = new Date(now + (Number(hotelEntry.et) || 10800) * 1000)…
```

والواجهة تطبعه سطراً جازماً تحت العرض: **«⏳ صلاحية السعر حتى …»**. فحين
يسكت المزوّد عن المدّة — أو يقول صفراً — يُمنَح المسافرُ **ثلاث ساعاتٍ
مؤكَّدة لم يقلها أحد**.

**ولم يكن هذا اجتهاداً في معنى `et`**: المزوّدون الأربعة الآخرون في المجلّد
نفسه يفعلون الصواب أصلاً — `raw.expires_at || null` في مزوّدي Duffel
الثلاثة، و`expiresAt: null` بتعليقٍ صريح في مزوّد العقود. فهذا **انفرادُ
ملفٍّ واحد عن عرفٍ قائم**، لا عرفٌ جديد يُفرَض. والقاعدة المطبَّقة هي
`declaredNumber` نفسها للمرّة الثالثة: مدّةٌ **مُعلَنةٌ موجبة** تُعرَض،
وما عداها لا يُقال فيه شيء.

📌 **وما لا يقرّره هذا صراحةً**: ماذا يعني `et: 0` عند LiteAPI. لا توثيق
مؤكَّداً لدينا، **والتخمين هو العطب الذي تطارده هذه المراحل كلها** — فلم
يُمَسّ `OFFER_TTL_MS` الذي يحكم بقاء العرض قابلاً للحجز. المتغيّر الوحيد
أننا كففنا عن ادّعاء مدّةٍ لا نملكها. نفس عرف شروط التذكرة حرفياً:
«الصمت عند الجهل — لا يُكتب سطرٌ أصلاً».

**الدليل**: اختبارٌ يقطع أربع حالات (سكوت، صفر، null، ومدّةٌ حقيقية ٩٠٠
ثانية تُحترَم كما هي لا تُقرَّب لثلاث ساعات)، أُثبت سقوطه على الكود
القائم برسالته الصحيحة. **487/487 مع Postgres حقيقي.**

---

## Sprint 8/7 — أقوى بوّابةٍ في الخادم كانت بلا اختبارٍ واحد

بدايةُ مسارٍ جديد بعد اكتمال Sprints 1–7: أعدتُ سؤالَ Sprint 2c — الذي كان
أنجحَ اكتشافٍ في الخطة كلها («حرّاس كتابة الملفات الثلاثة بلا تغطية») — على
المستودع كلّه: **أيُّ وحدةٍ تمسّ مالاً أو اعتماداً أو ملفات، ولا يذكرها أيُّ
اختبار؟** الجواب: **٤١ وحدة**. أخطرها بفارقٍ واضح `middleware/adminOnly.js`.

### ما فُحص ورجع سليماً — يُقال كما هو

قبل كتابة أي سطر، أربعةُ فحوصٍ كان يمكن لأيٍّ منها أن يكون ثغرةً حقيقية:

| الفحص | النتيجة |
|---|---|
| مسارات `/api/admin/*` بلا حارس | **٤٠/٤٠ محروسة** — صفر |
| توقيع webhook الدفع | يرمي بلا `STRIPE_WEBHOOK_SECRET` → 400. **لا باب خلفي** |
| `/checkout` يقبل خطةً من الطلب | يتحقّق `∈ {pro, enterprise}` قبل التسعير — لا «ادفع رخيصاً وخُذ غالياً» |
| `isAdmin` في التوكن | **لا مسارَ إصدارٍ واحد يوقّعه** — الحمولات الأربع قوائم بيضاء |

### والفجوة الحقيقية: غيابُ الحارس نفسه

`adminOnly` تحرس ٤٠ مساراً منها **كتابة الملفات وحذفها**، وكتابة كود
الإضافات، وملفات GitHub، وإعداد بوت التداول — وكانت بلا اختبار.
`tests/adminOnly.test.mjs` أول تغطية: ٤٠١ بلا مستخدم، ٤٠٣ لغير المدرَج،
المطابقة بلا حساسية حالة، والضيف ليس مشرفاً. **وحارسان بنيويّان**:

1. **كل مسار `/api/admin/` يحمل `adminOnly`** — من يضيف المسار رقم ٤١ ناسياً
   الحارس يفتح كتابةَ ملفاتٍ للجميع بلا أن يكسر شيئاً ظاهراً.
2. **لا مسارَ إصدارِ توكنٍ يوقّع `isAdmin`** — الباب مغلقٌ اليوم **بحكم
   الواقع لا بحكم شرطٍ يحرسه**: يكفي أن يضيف أحدٌ حقلاً من جسم الطلب إلى
   الحمولة ليصير تصعيدَ صلاحية صامتاً. الاختبار يحوّل الصدفة إلى ثابت.

الثلاثة أُثبت سقوطها بإعادة العطب فعلياً (نزعُ الحارس من مسار، توقيعُ
`isAdmin: req.body.isAdmin`، وتعطيلُ شرط البوابة) ثم استعادتها. **887/887.**

### 📌 واختلافٌ عن عرفٍ موثَّق — فُحص فلم يُغيَّر

عرفُ خدمة السفر صريح: «مسارات الأدمن لغير المخوَّل **404 لا 403** (لا نؤكد
وجود ما لا يخصّك)». و`adminOnly` تردّ **403**. ولم أوحّدهما: ذاك عرفُ بوابةٍ
تجارية عامة يتصفّحها الغرباء، وهذه لوحةٌ داخلية —
و`frontend/src/pages/AdminPanel.jsx` **تعتمد على 403 صراحةً**
(`setDenied`/`setForbidden`) لتعرض رسالةً مفهومة بدل «غير موجود».
**الدليل تبعيّة الواجهة لا رأيي**، ولولا فحصُها لكان «التوحيد» كسراً صامتاً
للوحة الإدارة. مكتوبٌ في الاختبار نفسه كي لا يُوحَّد لاحقاً بحسن نية.
