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

---

## Sprint 8/8 — أسرارٌ تُعرَض وهي غير مُسلَّمة، وقيمةٌ تخترع مفاتيح

الوحدة الثانية من جرد «بلا تغطية»: `services/projectSecrets.js`. تحقن مفاتيح
أطراف ثالثة **بيئةً لتشغيل مشروع المستخدم** (`jcr.js`، `server.js`) ومفاتيحَ
لبوت التداول — وكانت بلا اختبار. عطبان، كلاهما أُثبت **بالتشغيل** قبل الإصلاح.

### 🔴 (١) حارسٌ يَعِد بما لا يحفظه

`VALID_KEY = /^[A-Z][A-Z0-9_]{1,48}$/` يضبط **اسم** المفتاح بصرامة. ثم القيمة
تُلصَق كما هي: `` `${k}=${v}` ``. فسطرٌ جديد داخلها يفتح سطراً ثانياً في
`.env` — **مفتاحاً لم يمرّ بالحارس قط**. أُثبت بالتشغيل: قيمةٌ واحدة أنتجت

```
API_KEY=real
INJECTED_KEY=owned
lower_case=also        ← شكلٌ يرفضه VALID_KEY أصلاً
```

والأسماء المعروضة `['API_KEY']` فقط. الإصلاح **منعٌ لا ترميز**: لا هروبَ
قياسياً في `.env` يفهمه كل قارئ، فالرفضُ أصدق من ترميزٍ يقرؤه بعضهم.

### 🔴 (٢) سؤالٌ واحد بمصدرَي حقيقة — ثم محوٌ صامت

«أيُّ أسرارٍ لهذا المشروع؟» تجيبه الأسماء من الخريطة **المشفّرة**، وتجيبه
القيم من فكّ التشفير. و`catch { /* تجاهل التالف */ }` كان يجعلهما يفترقان
بلا إشارة. أُثبت بمحاكاة **تدوير `JWT_SECRET`** (حدثٌ تشغيليّ عاديّ):

```
اللوحة تعرض  : [ STRIPE_KEY, DB_URL ]
التطبيق يستلم: []
.env بعد أيّ حفظٍ لاحق = "NEW_KEY=n\n"     ← السرّان مُحيا من القرص
```

الأخطر ليس الافتراق بل **المحو**: سرٌّ عجزنا عن فكّه ما زال عاملاً في
التطبيق — سطرُه في `.env` صحيحٌ كُتب يوم كان المفتاح يفكّه. فإعادةُ الكتابة
من المفكوك وحده تخسر مفتاح Stripe حيّاً لأننا فقدنا مفتاح التشفير، لا لأن
أحداً طلب حذفه. الآن يُنقَل سطره كما هو من الملف القائم، ويُقال إنه متعذّر
(`getUnreadableSecretNames`، وحقل `unreadable` في المسارات الثلاثة).

📌 **وتأكيدٌ كتبتُه أنا خطأً ثم صحّحته**: أول صياغةٍ للاختبار اشترطت أن
**كل اسمٍ معروضٍ يُسلَّم**. وإرضاؤه حرفياً يعني إخفاء ما عجزنا عن فكّه —
فتقول اللوحة «لا `STRIPE_KEY` لديك» بينما المُعمّى موجودٌ ويُستعاد بإرجاع
المفتاح القديم. كذبةٌ في الاتجاه المعاكس. الشرط الصحيح: **ألّا تكون الفجوة
صامتة** — كلُّ اسمٍ لا يُسلَّم يُقال إنه متعذّر.

**الدليل**: `tests/projectSecrets.test.mjs` (٤)، أُثبت سقوطُ كلٍّ من الثلاثة
بإعادة عطبه حرفياً (نزعُ حارس السطر، إعادةُ الكتابة من المفكوك وحده، إعادةُ
`catch` الصامت) ثم استعادته. **891/891.**

---

## Sprint 8/9 — انتحالُ حسابٍ ببريدٍ لم يُثبَت امتلاكه

الوحدة الثالثة من جرد «بلا تغطية»: `services/oauthLite.js` — تقرّر **من أنت**
لكل داخلٍ عبر GitHub أو Google. **وهذا أخطر ما وجدتُه بعد Sprint 8/4.**

### السلسلة، مُثبتةً بالتشغيل لا بالقراءة

`DB.upsertOAuthUser` (server.js:333) **يربط الحسابات بالبريد**:

```js
let user = await User.findOne({ provider, providerId });
if (!user && email) {
    user = await User.findOne({ email });
    if (user) { user.provider = provider; user.providerId = providerId; await user.save(); }
}
```

فمن وصل ببريدِ مستخدمٍ قائم **يستولي على حسابه**: تُعاد كتابة
`provider`/`providerId` إليه، ثم يُصدَر له توكنٌ باسم الضحية. ولو وقع اسمها
في `ADMIN_USERS` فهي **لوحة الإدارة** بمساراتها الأربعين.

والبريد كان يصل بلا إثباتٍ من موضعين:

| المزوّد | ما كان | ناتجُه المُثبَت بالتشغيل |
|---|---|---|
| Google | لا فحص لـ`email_verified` **إطلاقاً** | `{username:'victim', email:'victim@example.com'}` من حساب مهاجم |
| GitHub | `… || emails[0]` — أولُ عنصرٍ **مهما كان** | نفس البريد من قائمةٍ كلُّها غير مؤكَّدة |

### وليس اجتهاداً أمنياً مني

جوجل توثّق صراحةً ألّا يُوثق بـ`email` بلا `email_verified`. **وخدمة السفر
في هذا المستودع ترفضه لهذا السبب بعينه** (`googleAuth.js`، وموثَّق في
CLAUDE.md: «قبوله يفتح انتحال بريد غيرك عبر حساب Workspace لم يُثبَت
امتلاكه»). فالعطب **انفرادُ خدمةٍ عن عرفٍ قائمٍ في شقيقتها**، لا حكمٌ جديد.

📌 **ولم أنسخ سياستها حرفياً**: هي **ترفض الدخول**، وهذا يصحّ عندها لأن
**البريد هو الهوية** هناك. وهنا الهويةُ معرّفُ المزوّد والبريدُ مفتاحُ ربطٍ
فقط — فإسقاطُه يغلق الانتحال بلا أن يحجب صاحب حسابٍ مؤسّسيّ لم يُثبَت
بريده. نسخُ السياسة بلا نسخِ مقدّمتها كان سيمنع دخولاً مشروعاً بلا مكسب.

**الدليل**: `tests/oauthLite.test.mjs` (٦)، أُثبت سقوط الحارسين بإعادة
عطبيهما حرفياً ثم استعادتهما. **897/897.**

---

## Sprint 8/10 — مفتاحٌ يجمع حقلين بفاصلٍ يحتمله الحقلان (أحد عشر مخزناً)

**البداية**: أول تغطيةٍ لـ`services/siteCms.js`. وقادت قراءةُ مستهلكيها إلى
`siteCreds.js` — الوحدة التي عولجت في Sprint 7/6 — فتبيّن أن المطالبة
الذرّية هناك كانت تحرس الملفّ الصحيح، لكنّ **الملفّ نفسه كان خطأ**.

### الجذر

أحد عشر مخزناً ملفّياً في `services/` يشتقّ اسم ملفّه بالصياغة نفسها:

```js
clean(user) + '__' + clean(project)          // + '__' + clean(slot) في ثلاثة
clean(s) = s.replace(/[^a-zA-Z0-9_-]/g, '_')
```

وهي **ليست اقتراناً متبايناً**. الفاصل مبنيٌّ من `_`، و`_` حرفٌ مشروع داخل
الحقلين نفسيهما: اسم المستخدم يقبله (`^[a-zA-Z][a-zA-Z0-9_\-]{2,19}$`)
واسم المشروع يقبله (`replace(/[^a-z0-9_\-]/g, '-')`). فزوجان مختلفان
يكتبان ملفاً واحداً — **مُثبَتاً بتشغيل الكود لا باستنتاج**:

```
('alice',      'bob__site')  →  alice__bob__site.json
('alice__bob', 'site')       →  alice__bob__site.json     ← الملفّ نفسه
```

### ثمنه في `siteCreds`

مَن يسجّل `alice__bob` (اسمٌ مشروعٌ تماماً) وينشئ مشروع `site` يطالب —
**بمشروعه هو، بلا احتيالٍ ظاهر** — بملفّ اعتماد لوحة `alice/bob__site`.
فتُردّ مطالبةُ صاحبتها بـ«معيّنة سلفاً»، ثم يدخل هو على لوحتها بكلمته
فيأخذ توكناً موقّعاً على `{alice, bob__site}` **صحيحاً تماماً**: يجتاز
`siteAuth`، فيكتب `lib/content.js`، ويعيد توليد صفحاتها، ويرفع ملفّات إلى
`assets/` في مجلّد مشروعها. الحارس سليم، والمفتاح كذب.

وفي `appAssets` بالمثل: صورةٌ رُفعت تحت (`alice__bob`, `site`, `clinicPhoto`)
تُقرأ وتُدهَس تحت (`alice`, `bob__site`, `clinicPhoto`) — والاختبار القائم
كان يؤكّد «مشروعٌ آخر معزول تماماً»، وهو تأكيدٌ صحيحٌ للأسماء البسيطة وحدها.

### ولمَ لا يُطبَّع الالتباس

طيُّ `__` إلى `_` **يستبدل تصادماً بتصادم**: `alice__bob` و`alice_bob`
يلتقيان. والتباسٌ ثانٍ عند الحدود لا يعالجه منعُ `__` وحده — الفاصل جارُ
الحقل، فـ(`a_`, `b`) و(`a`, `_b`) كلاهما `a___b`.

فشرطُ الوضوح ثلاثي: **لا `__` داخل الحقل، ولا `_` في أوّله، ولا `_` في
آخره**. عندئذٍ كل تعاقب `_`ين فاصلٌ حتماً والقسمة وحيدة. و`services/storeKey.js`
يبني المفتاح على هذا: ما استوفى الشرط يُلصَق كما كان **حرفاً بحرف**، وما
التبس يُوسَم بمختصر SHA-256 للحقول بعينها فيبقى مبايناً ومقروءاً معاً.

**ولا يتغيّر اسمٌ قائمٌ على القرص عملياً**: أسماء المستخدمين والمشاريع
اليوم كلها ضمن أبجدية `clean` — التسجيل يفرضها، و`upsertOAuthUser` يطهّر
اسم مستخدم OAuth عند الإنشاء (`replace(/[^a-z0-9_\-]/gi, '_')`) ويفرض
تفرّده. أما السجلّ الملتبس — إن وُجد — فيُيتَّم **عمداً**: هو بالتعريف سجلٌّ
لا يُعرَف صاحبه، وتسليمه لأحد الطرفين أسوأ من إعادة فتحه لصاحبه الحقيقي.

### المخازن العشرة المحوَّلة

`siteCreds` (كلمة مرور اللوحة) · `projectAuth` (اعتماد لوحة التطبيق
المولَّد) · `siteInbox` (رسائل زوّار الموقع) · `newsletterSubscribers`
(بُرد المشتركين) · `appData` · `appCollections` · `appAssets` ·
`budgetAlerts` · `cryptoAlerts` · `agentConversations`.

📌 استثناءٌ واحدٌ موثَّق: `countSlots` في `appAssets` يبقى على بادئةِ عدٍّ
مسطّحة — بادئةُ عدٍّ لا مفتاحَ قراءة. مفتاح الشريحة الملتبس يبدأ بها أيضاً
(الوسم يُلحَق في آخره) فالعدّ **لا ينقص أبداً**، وإن زاد على اسمٍ ملتبس
فزيادته تشدّد الحصّة ولا ترخّيها. ويحرس `tests/storeKey.test.mjs` أنّ هذا
هو الموضع الوحيد الباقي.

### عطبٌ ثانٍ في `siteCms` — الملكية لا الوراثة

قائمة السماح في `applyContentPatch` تَعِد ببنية موقعٍ ثابتة:

```js
if (!out.sections[key]) continue;   // «لا يُنشئ أقساماً جديدة»
```

لكنها تسأل **السلسلة الأصلية** لا الملكية. فـ`constructor` و`toString`
و`hasOwnProperty` و`valueOf` و`isPrototypeOf` و`toLocaleString`
و`propertyIsEnumerable` تُقرأ كلّها «موجودة» فتمرّ — وتُكتب أقساماً جديدة
باسم المُرسِل في `lib/content.js` (مُثبَتاً بالتشغيل: سبعة مفاتيح خرجت في
`JSON.stringify`، بينما رُفض `newone` كما يجب). الفحص صار
`Object.prototype.hasOwnProperty.call(...)` — وهو **عرفٌ قائمٌ في المستودع
سلفاً** (`appAssets`، `oauthLite`، `cryptoMarket`)، لا حكمٌ جديد. وأُضيف
معه ردُّ تعديلٍ ليس كائناً، فلم يعد `sections.about = null` يُسقط الطلب.

### الدليل

- `tests/storeKey.test.mjs` (٧) — منها مسحٌ شامل لـ٨١ زوجاً من أبجديةٍ فيها
  `_`: لا تصادم واحد. ومرجعٌ يعيد الصياغة القديمة حرفياً ليثبت أن الاختبار
  يقيس فرقاً حقيقياً، وحارسٌ بنيوي يمنع عودة اللصق من بابٍ آخر.
- `tests/siteCms.test.mjs` (١٣) — **أول تغطيةٍ للوحدة**: كلمة المرور،
  التوكن (سرٌّ آخر، حمولةٌ مبدَّلة، انتهاء)، قائمة السماح، الصور.
- `tests/siteCreds.test.mjs` (+٢) و`tests/appAssets.test.mjs` (+٢).

أُثبت سقوط الحرّاس الثلاثة بإعادة أعطابها حرفياً ثم استعادتها. **921/921.**

---

## Sprint 8/11 — الخريطة تقول KEEP عن وحداتٍ لا يصل إليها الخادم

**البداية**: جردُ ما لا تغطية له. وبدل قراءة القائمة ملفاً ملفاً، مشيتُ بيان
الاستيراد من `server.js` نفسه — فتبيّن أن السؤال «هل هذه الوحدة مغطّاة؟»
كان يسبق سؤالاً أولى منه: **هل يصل إليها الخادم أصلاً؟**

### النتيجة

إحدى عشرة وحدة (٧٩٥ سطراً) لا يصل إليها `server.js` بأي استيراد، ثابتاً كان
أو ديناميكياً. وسبعٌ منها **جزيرةٌ مغلقة** جذرها `services/taskExecutor.js`:

```
taskExecutor (٠ مراجع في المستودع كلّه)
  ├── fileEditor · broadcast · knowledgeService
  └── knowledgeService → projectManager → … و twin → logger
```

### ولمَ هذا عطبٌ في الخريطة لا مجرّد كودٍ ميت

`ARCHITECTURE_MAP.md` يعطي `fileEditor.js` و`twin.js` و`knowledgeService.js`
حكم **KEEP**، و`broadcast.js` حكم **MODIFY** — وهي كلّها وراء `taskExecutor.js`،
وهو **غائبٌ عن الخريطة كلّها**. صُنِّفت الأوراق ولم يُمشَ الجذع.

**ووقائع أُثبتت بالتشغيل لا بالاستنتاج:**

| ما ادُّعي | ما ثبت |
|---|---|
| `taskExecutor` وحدةٌ حيّة | يستورد `simple-git` وهي **ليست في `package.json`** → `ERR_MODULE_NOT_FOUND` عند الاستيراد |
| ويستدعي وكيلين | `agents/architect.agent.js` و`agents/projectInitializer.agent.js` **غير موجودَين**؛ الحيّ `architectAgent.js` عبر `agents/index.js` — أُعيدت التسمية ولم يتبعها |
| KEEP لـ`twin`/`knowledgeService` | خمسٌ من الإحدى عشرة **لا تُحمَّل أصلاً** (`uuid`، `better-sqlite3`، `simple-git` غير مثبَّتة) |
| `utils/security.js` وحدةٌ أمنية | يشارك اسمَ `middleware/security.js` الحيّ ويختلف عنه محتوىً — فمن قرأ الاسم قرأ الميت |

### الحكم يُحسَب لا يُكتَب

`tests/moduleReachability.test.mjs` يمشي البيان في كل تشغيل ويقارنه بقائمة
**إقرارٍ** لا وصف: تيتُّمُ وحدةٍ جديدة يُسقط الاختبار، ووصلُ يتيمةٍ يُسقطه
أيضاً، وغيابُ يتيمٍ عن الخريطة يُسقطه ثالثاً. فلا يعود التصنيف قابلاً
للانحراف عن الشيفرة صامتاً.

### حارسٌ يمسك الصوت ويترك الهمس

وفي `fileEditor.js` كان الاحتواء `full.startsWith(base)` — بادئةٌ **بلا فاصل
مسار**. فالمحاولة الصريحة تُمنع (`path.join` يطبّع `..` فيخرج عن البادئة)،
أما الشقيق الذي يبدأ اسمه باسم الجذر فيمرّ. مُثبَتٌ بالتشغيل:

```
JAOLA_PATH=/tmp/fe/base
  '../../etc/hostname'      → Path traversal denied
  '../base-evil/stolen.txt' → قُرئ: "SECRET"          ← خارج الجذر
```

وهو **العطب نفسه** الذي سمّاه `core/runtime/workspacePaths.js` وأصلحه في
`writePlanFiles` («شقيق باسم `<root>-evil` يمرّ منطقياً»). بقي هنا لأن هذه
الوحدة خارج ما يصل إليه الخادم — فلم يمرّ عليها أحد. وتستدعي `isInsideRoot`
الآن، فتُمنع.

📌 **صدقٌ في الحجم**: الوحدة غير مُدرَكة اليوم، فالإصلاح **وقائيٌّ لا علاجُ
تعرّضٍ حيّ**. سببه أن الخريطة تعد `fileEditor.js` بـ`plugins/coding/` — فلا
يُوصَل لاحقاً وهو يحمل عطباً معروفاً مُصلَحاً في موضعٍ آخر.

### ولا حذف في هذا الـPR

شرط المالك «لا نحذف أو نعيد كتابة الأنظمة القوية قبل فهم dependencies»، وهذا
الـPR **هو الفهم**. الحذف قرارٌ مستقلّ بـPR مستقلّ، كما جرى مع الثلاثين ملفاً
سابقاً — والقسم الجديد في `ARCHITECTURE_MAP.md` يحمل ما يلزم لاتخاذه.

### الدليل

- `tests/moduleReachability.test.mjs` (٣) — ماشي البيان + إقرار اليتامى + ربط
  الخريطة بالحساب.
- `tests/fileEditor.test.mjs` (٦) — **أول تغطيةٍ للوحدة**.

أُثبت سقوط الحرّاس بإعادة أعطابها: عودةُ `startsWith` تُسقط حارسَي الاحتواء،
وإيتامُ `routes/billing.js` يُسقط حارس الإدراك (ويتتبّع `stripeService.js`
معه)، وحذفُ قسم اليتامى من الخريطة يُسقط الثالث. **930/930.**

📌 وتصحيحٌ في مساري: أول طفرةٍ جرّبتها لحارس الإدراك كانت **باطلة** — أيتمتُ
`siteCms.js` بحذف استيراده من `server.js`، فبقي مُدرَكاً لأن `appAssets.js`
يستورده أيضاً. الحارس لم يخطئ؛ الطفرة لم تُحدث ما ادّعت. أعدتُها بوحدةٍ
مستوردُها واحد.

---

## Sprint 8/12 — عنوانٌ ناقصٌ محرفاً واحداً، وتأكيدٌ يدويٌّ لا يستطيع رؤيته

**البداية**: الوحدات ذاتُ الأثر المالي المباشر. وأثقلها `pancakeSwapExecutor.js`
— منفذ التفاعل الوحيد مع BNB Chain، ومنه تخرج صفقاتٌ بمالٍ حقيقي.

### العطب

```js
export const PANCAKE_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024';
```

**٣٩ خانةً سِتّ‑عشرية لا ٤٠.** عنوانٌ ناقصٌ محرفاً واحداً في آخره.

ولم يعترض شيء — وهذا هو الجزء الخطر، مُثبَتاً بالتشغيل:

| ما يُتوقَّع | ما حدث فعلاً |
|---|---|
| `ethers.getAddress` ترفضه | ✅ ترفضه — لكن لا أحد كان يناديها |
| `new ethers.Contract` يعترض | ❌ **بُني بلا شكوى** |
| النداء يقول «عنوان فاسد» | ❌ `ENS resolution requires a provider` |

فالعنوان المشوَّه **لا يُرفَض، بل يُعاد تفسيره اسمَ ENS يُبحَث عنه**. ولا يظهر
شيءٌ من ذلك إلا عند أول صفقة — بعد أن يكون المالك قد رفع `addressesVerified`
ومَوَّل المحفظة.

### ولمَ لم يمسكه التأكيد اليدوي

الملفّ نفسه يطلبه: «PANCAKE_ROUTER_V2 لا يزال يحتاج نفس التحقق اليدوي… سجّل
ذلك عبر `addressesVerified`؛ البوت يرفض العمل بدون هذا التأكيد». والبوّابة
موجودةٌ فعلاً وتعمل (`isReadyToEnable`).

لكنها **تسأل إنساناً سؤالاً تعرف الآلةُ جوابه يقيناً**. وإنسانٌ ينظر إلى أربعين
خانةً سِتّ‑عشرية لا يرى واحدةً ناقصة. فكان إقرارٌ واحد كافياً لتفعيل بوتٍ
يتداول بمالٍ حقيقي على عنوانٍ لا يصلح عنواناً. وهذا فرعٌ جديد من العائلة
الموثّقة هنا: **حارسٌ يفوّض إلى إنسانٍ فحصاً تستطيع الآلةُ الجزمَ به، ثم يصدّق
الجواب.**

### الإصلاح

1. **التحقّق البنيوي صار آلة**: `assertChainAddress` يرفض ما لا يصلح عنواناً
   (بنيةً وخانةَ تحقّق) — عند بناء عميل السلسلة، وعلى كل عنوانٍ يأتي من
   المستدعي. وهذا الأخير ليس ترفاً: `autoDiscoveryEnabled` يسجّل عملاتٍ
   بعناوين عقودها **من CoinGecko بلا تحقّق يدوي**.
2. **البوّابة لم تعد تصدّق ما تستطيع فحصه**: `isReadyToEnable` تشترط الآن صحّة
   الثوابت بنيوياً **قبل** أن تنظر إلى `addressesVerified`. ويبقى للإنسان ما
   لا تعرفه الآلة: **مَن** هذا العقد، لا **كم** طولُ عنوانه.
3. **العنوان صُحِّح** إلى `0x10ED43C718714eb63d5aA57B78B54704E256024E`.

### والعنوان أُثبت من السلسلة لا من ذاكرة

هذا موضعٌ لا يُتصرَّف فيه بيقينٍ غير مملوك: عنوانٌ خاطئ يعني مالاً يذهب إلى
لا مكان. فلم أكتبه استرجاعاً، بل استعلمتُ عقدة BSC عامة:

| الاستعلام | الناتج |
|---|---|
| `eth_getCode` | بايتكود منشور على BSC mainnet |
| `WETH()` | `0xbb4cdb9c…bc095c` — **بعينه** ثابت WBNB الذي تحقّق منه المالك يدوياً |
| `factory()` | `0xca143ce3…50c73` (مصنع PancakeSwap V2) |

فالمرساة **قولُ المالك المتحقَّق منه، لا قولي**: العقد الذي وضعتُ عنوانه يعلن
أن عملته الملفوفة هي نفسها التي أكّدها هو على bscscan.

📌 **ولم أرفع `addressesVerified` نيابةً عنه**: ذلك الحقل معناه «نظرتُ بنفسي»،
وهو إقرارُ المالك لا إقراري.

### الدليل

`tests/pancakeSwapExecutor.test.mjs` (٥) — **أول تغطيةٍ للوحدة**: صحّة كل ثابت
عقد، والفخّ نفسه (أن ethers **لا** ترفض المشوَّه — وهو ما يجعل حارسنا لازماً)،
ورفضُ عناوين المستدعي، وهامش الانزلاق.

أُثبت سقوط الحرّاس بإعادة العطب حرفياً: إرجاعُ العنوان إلى ٣٩ خانة أسقط ٣
اختبارات جديدة **و٥ من اختبارات المحرّك القائمة** (لأن البوّابة صارت تفحص) —
وهي بذاتها شهادةٌ على أن الثابت المشوَّه كان يمرّ بالمجموعة كلّها قبل اليوم.
ونزعُ حارس عناوين المستدعي أسقط ثالثاً. **935/935.**

---

## Sprint 2e — نوعُ المشروع كان يُحسم بترتيب مفاتيح JSON لا بدليل

**التوجيه**: العودة إلى قلب جولا وفق الخريطة الإرشادية. §18 بند 2 يطلب
`MissionRuntime + AgentRuntime + ToolRuntime + ExecutionContext`، وأُنجزت
ثلاثة (2a/2b/2d) وبقي **ToolRuntime** وحده.

### ولمَ لم يُبنَ ToolRuntime — جردٌ أعطى نتيجةً سلبية صادقة

المبدأ الأول «Agent يقترح؛ Runtime ينفذ» يبدو غير محقَّق في أهمّ فعلٍ يقوم به
النظام: كتابة ملفات المشروع. لكن الجرد (١٠٢ موضع كتابة) قال غير ذلك:

| الموضع | يأخذ اسماً من الـLLM؟ | محروس؟ |
|---|---|---|
| `jcr.js: writePlanFiles` | نعم | ✅ سياسة + `isInsideRoot` |
| `backendTeam` | نعم | ✅ `safeRelPath` |
| `pwaAgent`/`seoPack`/`designerAgent`/`template.agent` | لا (أسماء ثابتة) | لا يلزم |
| `fileManager.writeFile` وأخواتها | — | **لا مستهلك لها أصلاً** (`jcr.js` يستورد النسخ الاحتياطي فقط) |

فبناء ToolRuntime اليوم **تجريدٌ بلا مستهلك** — نفس سبب تأجيل
`PermissionEngine` في Sprint 3 (المبدأ العاشر). يُبنى حين يوجد كاتبٌ ثالث
يحتاج سياسةً لا يملكها.

### والعطب الذي وجده القياس بدلاً منه

`detectProjectType` — **أوّلُ قرارٍ يتّخذه النظام عن طلب المستخدم**، ومنه
تُشتقّ قواعد التصميم والمكوّنات واستراتيجية البناء — كان يحكم بـ**عددٍ خام**
للكلمات المطابقة:

```js
const score = keywords.filter(kw => keywordMatches(goal, kw)).length;
if (score > bestScore) { … }        // التعادل يفوز به الأسبق في الملفّ
```

فالتعادل يُحسم بترتيب مفاتيح `design-rules.json` — ترتيبٌ لا يعرفه أحد ولا
يعني شيئاً. **قياسٌ فعليّ على عشرة أهدافٍ واقعية: أربعةٌ يقرّرها الترتيب:**

| الهدف | كان | الصواب |
|---|---|---|
| صالون تجميل مع حجز مواعيد | `booking` | `beauty` |
| موقع عقارات للبيع والإيجار | `ecommerce` | `realestate` |
| نادي رياضي مع اشتراكات ومواعيد | `saas` (تعادلٌ رباعيّ عند 1) | `gym` |
| عيادة أسنان مع حجز مواعيد | `clinic` (صحّ بالمصادفة) | `clinic` |

### الإصلاح: وزنٌ مشتقٌّ من البيانات، لا تنسيقٌ يدويٌّ جديد

- **ندرة الكلمة**: الوزن = ١ ÷ عدد الأنواع التي تضمّها. «صالون» في نوعٍ واحد
  دليلٌ قاطع، و«حجز» في ستّة دليلٌ ضعيف. يقرأ الخريطة نفسها فلا رأي لي فيه.
- **موضعها في الهدف**: العربية والإنجليزية تقدّمان الموضوع — «**متجر** ملابس
  مع معرض أعمال» متجرٌ أولاً. علاوةٌ تصل إلى النصف وتتلاشى نحو آخر الجملة.
- **والتعادل الباقي يُكسر باسم النوع** — ترتيبٌ معلَنٌ ومستقرّ، لا ترتيب ملفّ.

القياس على أربعة عشر هدفاً كُتبت **قبل** رؤية الأثر: **٨ إصابات → ١٢**.

📌 **وهدفان يبقيان غامضَين، ولم أُعدّل الوزن لأجلهما**: «متجر ملابس مع معرض
أعمال المصمم» و«منصة دورات أونلاين باشتراك شهري» — كلاهما يحتمل قراءتين،
وملاحقةُ حالتين تفصيلٌ على مقاسِ اختباري لا تحسين. مُثبَتان في المجموعة
بوصفهما غموضاً معروفاً.

### واختبارٌ جديد كشف هشاشةً لم يصنعها

إضافة ملفّ الاختبار أسقطت `siteChecker` مرّةً و`adminAgentGrounding` مرّة —
وكلٌّ منهما يمرّ منفرداً. ولم يكن حِملاً ولا «تذبذباً»، بل سبباً يُقرأ في
الكود:

- `adminAgentGrounding` يكتب وكيلاً مولَّداً في `plugins/` **الحقيقي** ثم
  يُعيد تحميل **المنسّق المفرد المشترك**.
- `siteChecker` ينادي `init()` على المجلّد نفسه ويؤكّد على ما حُمِّل.
- وnode يشغّل ملفّات الاختبار **بالتوازي**.

فاخضرارُ الحزمة كان يعتمد على الجدولة — وهو نفسه العطب الذي تلاحقه هذه
الوثيقة: **تأكيدٌ يقيس ما لا يملكه**. العزل: مجلّدٌ خاصّ بالاختبار
(`.plugins-test-<pid>`، شقيقٌ لـ`plugins/` بالعمق نفسه عمداً لأن الوكيل
المولَّد يستورد `../agents/…`) ومنسّقٌ خاصّ (`new PluginOrchestrator()`).
والدليل: عدد الاختبارات كان يتذبذب (935/938/941/942) وصار **943 ثابتاً**.

### الدليل

`tests/projectTypeDetection.test.mjs` (٨). أُثبت سقوط نصفَي الوزن كلٍّ على
حدة: نزعُ مقسوم الندرة يُسقط «الندرة دليلٌ مستقلٌّ عن الموضع»، ونزعُ الموضع
يُسقط اثنين، والعودةُ إلى العدّ الخام تُسقط ثلاثة. **943/943** في ثلاث دورات
متتالية.

📌 **ونتيجةٌ نظيفة تُقال كما هي**: ٣١ نوعاً في `design-rules.json` و٣١ في
خريطة الكلمات، بلا فرقٍ في الطرفين — لا معرفةَ ميتة ولا نوعَ يتعذّر بلوغه.
كان ذلك أوّل ما بحثتُ عنه ولم يوجد.

---

## Sprint 2f — لفظُ العميل ينقض لفظَ المنتج، فيُبنى المتجرُ بروشوراً

**البداية**: ملاحظةٌ مسجَّلة في `ARCHITECTURE_MIGRATION.md` بلا إصلاح —
«تحت المخطّط الاحتياطي كلُّ هدفٍ غير تطبيقيّ يُصنَّف `brochure`… نتيجة
تصميم `staticKind` لا خطأ، **لكنها تستحق مراجعة عند العمل على المولّد**».
هذه هي المراجعة، وبدأت بالقياس لا بالرأي.

### ما يقرّره هذا التصنيف فعلاً

`kind` ليس تسميةً: `behaviorVerifier` يقرؤه ليقرّر **هل يفحص التفاعل
أصلاً** (`interactiveExpected`)، و`blockRegistry` لاختيار الكتل، و`jcr`
لعرض النوع للمستخدم. فخطؤه يُسلّم تطبيقاً بلا ميزةٍ عاملة **وبلا فحصٍ
يكشف ذلك**.

### عطبان مستقلّان في أربعة أسطر

**١) كلماتُ العميل تنقض كلماتِ المنتج.** كانت `شركة` و`مؤسسة` و`عيادة`
في قائمة البروشور، والشرط `app && !brochure` يجعلها **نقضاً مطلقاً** مهما
قويت إشارة التطبيق. وهي تصف **مَن يطلب** لا **ما يُطلَب** — وكلُّ طلبٍ
تجاريّ يذكرها تقريباً:

| الهدف | كان | الصواب |
|---|---|---|
| متجر إلكتروني **لشركة** ملابس | `brochure` | `webapp` |
| نظام حجز مواعيد **لعيادة** أسنان | `brochure` | `webapp` |
| منصة إدارة موظفي **شركة** | `brochure` | `webapp` |
| لوحة تحكم مبيعات **لمؤسسة** تجارية | `brochure` | `webapp` |
| أداة حساب قروض **لشركة** تمويل | `brochure` | `webapp` |

**٥ من ١٠** أهدافٍ عربية واقعية.

**٢) مطابقةُ احتواءٍ بلا حدود كلمات** — `app` داخل «h**app**y» و«**app**le»،
و`اب ` بمسافةٍ لاصقة. **٣ من ٦** أهدافٍ إنجليزية.

### الإصلاح

- بقيت في قائمة النقض **ألفاظُ المنتج وحدها**: `تعريفي`، `بروشور`،
  `brochure`، `صفحة هبوط بسيطة`. و«موقع تعريفي لشركة محاماة» يبقى بروشوراً
  بلفظه هو لا بلفظ عميله.
- والمطابقة صارت بـ`keywordMatches` — **نفس** الدالّة التي يستعملها كشف
  نوع المشروع: حدود Unicode مع سوابق العربية اللاصقة. رابعُ موضعٍ في هذا
  المستودع يُصلَح بهذه الآلية بعينها (`backendNeed`، `ConfirmationManager`،
  `detectProjectType`) — فلم أكتب رابعةً بل استوردتُ القائمة.

القياس بعد الإصلاح: **١٥/١٥** على المجموعتين معاً.

### والاختبار يمرّ بالدالّة الحقيقية

📌 **تصحيحٌ في مساري يُقال**: أول نسخةٍ من الاختبار كانت تقرأ القائمتين من
المصدر وتُعيد بناء المطابِق بنفسها — **فتختبر نسختي لا الدالّة**. كشفَته
الطفرة: إعادةُ المطابقة إلى `includes` لم تُسقط شيئاً. فأُعيد الاختبار
ليمرّ بـ`generateBlueprint` نفسها: بلا مفاتيح AI يسقط `smartChat` حتماً،
وهذا **هو** المسار الاحتياطي بعينه — فالمقيس ما يجري فعلاً عند عطل المزوّد،
والدليل أن كل نتيجة تؤكّد `_source === 'fallback'`.

### الدليل

`tests/appBlueprintKind.test.mjs` (٧). أُثبت سقوط النصفين كلٍّ على حدة:
إعادةُ «شركة» ناقضةً تُسقط اثنين (منهما أثرُ التصنيف: اختفاء المكوّن
التفاعلي)، وإعادةُ `includes` تُسقط حارس حدود الكلمات. **950/950.**

---

## Sprint 2g — الوحدة التي تبني كل صفحة، وكانت تُميت الموقع صامتاً

**البداية**: `services/reactPreview.js` — ٤٥٢ سطراً، **صفرُ اختباراتٍ
مباشرة**، وهي التي تحوّل `lib/content.js` إلى الصفحات التي يراها المستخدم.

### نتيجتان سلبيتان تُقالان أولاً

بدأ التدقيق بفرضيّتين، وسقطتا بالقياس فلا أصنع منهما اكتشافاً:

1. **`slugify` مُعرَّفة مرّتين** (`reactGenerator.js` و`reactPreview.js`)،
   والتعليق يدّعي «نفس اشتقاق المسار في المولّد». اختُبرتا على ١٥ مدخلاً:
   **لا اختلاف واحد**. الادّعاء صحيح.
2. **`slugify` تُرجع `'page'` لكل اسمٍ عربيّ** — فيبدو أن أقساماً عربية عدّة
   تتصادم على مفتاحٍ واحد. لكن `compName('من نحن', 3)` يعطي `Section3`:
   الأسماء العربية **لا تصل** إلى `content.sections` أصلاً. غير قابلٍ للوقوع.

### والعطب الحقيقي

`parseContent` تحليلٌ **صارم** بـ`JSON.parse` على ما بين أول `{` وآخر `}`.
فيردّ `null` لكل ما هو **JS صالحٌ وليس JSON صارماً**. ثم:

```js
export function buildStaticSiteFromSource(src, lang) {
    return buildStaticSite(parseContent(src), lang);   // null → صفحةُ زخرفٍ فارغة
}
```

و`buildStaticSite(null)` يعيد **صفحةً واحدة كاملة الهيكل** (شريط، تذييل،
أنماط — ٦١٠٠ بايت) و`<main>` **فارغ**. ويكتبها المستدعي **فوق `index.html`**.

**مُثبَتٌ بالتشغيل:**

| مصدر `lib/content.js` | صفحات | `<main>` |
|---|---|---|
| JSON صارم بمسارين | **2** (`index` + `about`) | المحتوى |
| فاصلةٌ زائدة | **1** | **فارغ** |
| اقتباسٌ مفرد | **1** | **فارغ** |
| تعليقٌ فيه `{` | **1** | **فارغ** |
| مفتاحٌ بلا اقتباس | **1** | **فارغ** |

والمسار حيّ: `jcr.js:2061` يقرأ الملفّ بعد أن يكتب المولّد `plan.files` —
وقد يكون `lib/content.js` منها — ثم يكتب النواتج. الـ`try/catch` هناك يلتقط
فشل **القراءة** فقط؛ والبناء **لا يرمي**. فتُدهس الصفحة الرئيسية، وتبقى
بقيّة الصفحات يتيمةً بمحتوى قديم، **ويُقال للمستخدم «تمّ»**.

### الإصلاح: يُفرَّق الصمتُ من العطل

الدرس المتكرّر في هذه الوثيقة، بثوبٍ سابع:

- **مصدرٌ فارغ** (لا محتوى بعد) → `[]`: لا شيء يُبنى فلا شيء يُكتب.
- **مصدرٌ موجودٌ لا يُقرأ** → **رمية** برسالةٍ تسمّي السبب. والمستدعون
  الثلاثة **كلّهم يلتقطونها سلفاً**: `jcr` يسجّلها للمستخدم
  («⚠️ تعذّر تحديث المعاينة»)، والخادم يردّ 500. فلا يكتب أحدهم شيئاً،
  ويبقى الموقع القائم سليماً، ويُقال العطل بدل أن يُدفَن.

📌 **ولم يُوسَّع المحلّل ليقبل JS**: تحويل `parseContent` إلى مُقيِّمٍ لكودٍ
يكتبه نموذجٌ لغويّ يفتح تنفيذاً لا يُراد. الصرامة تبقى؛ ما تغيّر أن فشلها
صار **مسموعاً وغير مُتلِف**.

### الدليل

`tests/reactPreview.test.mjs` (٩) — **أول تغطيةٍ للوحدة**: صفحةٌ لكل مسار،
وكلُّ رابطٍ في الشريط يقابل ملفاً بُني فعلاً، والاتجاه واللغة، وتهريبُ محتوى
المستخدم (وسمٌ في اسم العلامة، وخروجٌ من سمة العنوان والصورة)، وصفحةُ المتجر
التلقائية، والصمت/العطل، ولوحة العميل.

أُثبت سقوط الحارسين: العودةُ إلى الصيغة القديمة حرفياً تُسقط اثنين، ونزعُ
`esc` يُسقط اثنين. **959/959.**

---

## Sprint 2h — حارسُ الكود يُعلن الصحيحَ مكسوراً فيُسلّمه لنموذجٍ يعيد كتابته

`services/codeGuard.js` هو آخرُ بوّابةٍ قبل الحفظ: كلُّ ملفٍ يولّده وكيلُ
البرمجة يمرّ به (`jcr.js` يستدعيه في **تسعة** مواضع). عقدُه المُعلن أنّه
«لا يمرّ ملفٌ مكسورٌ بصمت». والذي وجدناه أنّه يفعل العكس أيضاً: **يُعلن
السليمَ مكسوراً**.

### القياس — بجسمٍ مرجعيّ لا يقبل الجدل

الوحداتُ التي يُشغّلها Node في هذا الريبو كلَّ يوم صحيحةٌ **قطعاً**. فأيُّ
إنذارٍ عليها إنذارٌ كاذبٌ بالتعريف. مرّرنا الحارسَ عليها:

| الجسم | ملفات | «مكسورة» بحسب الحارس |
|---|---|---|
| `services/` + `agents/` + `core/` | 202 | **13 (6.4%)** |
| الخدمات الثلاث الأخرى | 84 | 0 |

وأسبابُ الثلاثة عشر ثلاثة، كلُّها صيغٌ يوميّة في ESM:

| السبب | الأثر | مثالٌ حيّ |
|---|---|---|
| `import.meta` | «Cannot use 'import.meta' outside a module» | 11 ملفاً منها `jcr.js` نفسه |
| استيرادٌ ممتدٌّ على أسطر | «Unexpected token '}'» | `tradingBotEngine.js:35` |
| `await` على المستوى الأعلى | «await is only valid in…» | `postgresAgent.js` |

سببُها واحد: `neutralizeModuleSyntax` كان يمحو الاستيراد بنمطٍ **سطريّ**
(`/^\s*import\b[^\n]*$/gm`)، فيمحو `import {` وحدَه ويترك `} from 'react';`
معلّقاً — فيصنع بيده الخطأَ الذي يبلّغ عنه.

### لماذا هذا أخطر من إنذارٍ مزعج

`guardFiles` لا يكتفي بالتبليغ. عند «غير صالح» يستدعي `repairJS` فيُرسل
الملفَّ إلى نموذجٍ لغويّ ليعيد كتابته، ثمّ يقبل الناتج إن مرّ الفحصَ نفسه.
فالملفُّ **الصحيح** — إن حوى استيراداً على أسطر أو `import.meta` — يُسلَّم
إلى نموذج، ويُستبدل بما يكتبه، ويُقال للمستخدم «✅ أُصلح تلقائياً وتم
التحقق منه». إصلاحُ ما لم يُكسَر.

### العقد الجديد: **سليمٌ لا كامل**

«غير صالح» هنا ليس رأياً بل **حكمٌ يُتلف ملفاً**. فمِن عدم التماثل في
التكلفة يتبع عدمُ تماثلٍ في الحكم:

> عند الشكّ نقول «صالح». تفويتُ خطأٍ نادرٍ أهونُ من إعادة كتابة الصحيح.

وعليه:

- **الاستيراد يُمحى بحالةٍ لا بسطر**: أسطرُه تُفرَّغ ولا تُحذف، فيبقى ترقيمُ
  الأسطر مطابقاً للأصل ويبقى الخطأُ المُبلَّغ على سطره الحقيقي. وسقفُ
  `MAX_IMPORT_LINES` يمنع استيراداً مبتوراً من ابتلاع بقيّة الملف.
- **`import(` و`import.meta` ليسا تصريحَي استيراد** فلا يُمحيان؛ و`import.meta`
  يُبدَّل بكائنٍ مكافئ الشكل على السطر نفسه.
- **`await` العلويّ**: تُعاد المحاولةُ ملفوفةً في دالةٍ غير متزامنة، والبادئةُ
  على السطر الأول كي لا تنزاح الأرقام — **ولا يُلَفّ إلا على هذا الخطأ بعينه**،
  فلا تُستَر أخطاءٌ أخرى بالتساهل.

النتيجة بالقياس نفسه: **13 → 0**، والخطأُ الحقيقيّ ما يزال يُكشف على سطره.

### وعطبٌ ثانٍ في `checkHTML`: طرفان من مجتمعَين

```js
const openScripts = (content.match(/<script\b(?![^>]*src)[^>]*>/gi) || []).length;  // بلا src
const closeScripts = (content.match(/<\/script>/gi) || []).length;                  // كلّها
```

المفتوحُ يستثني السكربتات الخارجية، والمغلقُ يعدّ إغلاقاتها. فسكربتٌ خارجيٌّ
واحدٌ يمنح المقارنةَ إغلاقاً زائداً **يستُر سكربتاً داخلياً غير مغلق**:

| الصفحة | الحكم قبل | بعد |
|---|---|---|
| `<script>x=1;` وحده | تحذير | تحذير |
| `<script src=a.js></script><script>x=1;` | **سليم** | تحذير |

الإصلاح: تُسقَط الأزواجُ الخارجية الكاملة أولاً، ثمّ يُعدّ الطرفان من
البقيّة نفسها — مجتمعٌ واحد للعدّتين.

### الدليل

`tests/codeGuard.test.mjs` (١١) — **أول تغطيةٍ لـ`checkJS`/`checkHTML`/
`guardFiles`**: الصيغُ الثلاث اليوميّة، وثباتُ ترقيم الأسطر بعد استيرادٍ
متعدد الأسطر، و`import()` الديناميكيّ لا يُبتلع، والاستيرادُ المبتور لا يبتلع
الملف، وسترُ السكربت، والصفحةُ السليمة. ومنها اختباران يقيسان **النتيجة**
لا الآلية: `guardFiles` لا يُصدر إنذاراً ولا يبدّل حرفاً في ملف ESM صحيح،
ويظلّ يبلّغ عن خطأٍ حقيقي.

وحارسٌ حيّ: **الجسمُ المرجعيّ نفسه اختبارٌ دائم** — «لا يُعلن الحارسُ وحدةً
من وحدات الريبو مكسورة»، يمرّ على المئتين ملفاً في كلّ تشغيل.

أُثبت سقوط الحرّاس بست طفراتٍ متتالية، كلٌّ منها إعادةُ العطب الأصلي حرفياً:
عودةُ الاستيراد السطريّ (٤ سقطات)، ونزعُ تبديل `import.meta` (٣)، ونزعُ لفّ
`await` (٢)، وعودةُ عدّ HTML من مجتمعَين (١)، ومعاملةُ `import()` تصريحاً (١)،
ونزعُ سقف الاستيراد (١). **970/970.**

---

## Sprint 2i — قفلٌ يحرس المشروع وهو يَعِد بحراسة الحصة

```js
const aiImagesBusyRooms = new Set(); // 🔒 طلبات متكررة متزامنة لا تحرق الحصة مرتين
```

تعليقٌ يقول ما لا يفعله الكود. المفتاح `roomName` وهو
`` `${username}-${safeProject}` `` — **بالمشروع**. والحصة `aiImagesQuota(owner)`
— **بالمستخدم**. فصاحبُ مشروعَين يفلت من قفلٍ يظنّ أنه يحرسه.

### القياس — بنقلٍ حرفيٍّ لمنطق موضعَي الاستدعاء

مُرِّر عدّادُ الاستهلاك الحقيقي (`services/usageMeter.js`) على منطق
`server.js` كما هو: اقرأ العدّ → احسب المسموح → ولّد (`await`) → عُدّ.
خطة «مجاني»: **٦ صور شهرياً**.

| التزامن | مولَّد | الحصة |
|---|---|---|
| طلبان على المشروع نفسه | 6 + 0 = **6** | 6 ✅ |
| طلبان على مشروعَين لصاحبٍ واحد | 6 + 6 = **12** | 6 ❌ |
| مسار HTTP (**بلا قفلٍ أصلاً**) مع مسار المحادثة | 6 + 6 = **12** | 6 ❌ |
| ثلاثة مشاريع | 6 + 6 + 6 = **18** | 6 ❌ |

وكلُّ وحدةٍ من هذا الفائض نداءٌ مدفوعٌ لمزوّد صور، يُحتسب على مالك المنصّة.

### العطب تحت العطب: «اسأل ثم خُذ»

القفلُ عرَضٌ لا سبب. السببُ أن الحصة تُقرأ ثمّ يُعمَل ثمّ تُعدّ:

```js
const allowed = q.monthly - getUsageCount(...);   // اسأل
const r = await applyAiImages(..., { maxCount: allowed });   // اعمل — نداءاتٌ مدفوعة
for (let i = 0; i < r.count; i++) bumpUsage(...);            // ثمّ عُدّ
```

بين السطر الأول والأخير `await` طويل. كلُّ تدفّقٍ يدخل تلك الفجوة يقرأ العدّ
**قبل** أن يكتب فيه أحد، فيظنّ كامل المتبقي له وحده.

### الإصلاح: «خُذ ثم اعمل» — و قفلٌ بمفتاح ما يحرسه

**١) الحجز في `usageMeter`.** `reserveUsage(dir, user, metric, {limit, want})`
يقرأ ويحجز ويكتب **في نَفَسٍ واحدٍ متزامن** — لا `await` بين القراءة والكتابة،
فلا يتخلّلها تدفّقٌ آخر في هذه العملية. ويعود بما مُنح فعلاً.
و`releaseUsage` يعيد ما حُجز ولم يُنفق، في `finally` — مهما كان سبب الخروج.

**٢) القفل صار بالمستخدم**، وهو ما كان تعليقُه يدّعيه، وطُبّق على
**المسارَين** (مسار HTTP لم يكن له قفلٌ قط، فصار يردّ 409).

بالقياس نفسه: **12 → 6**، و**18 → 6**. ومن حجز ٨ وأنفق ٢ يعود عدّه إلى ٢.

### خاصّيةٌ تُقال ولا تُخفى

الحاجزُ يأخذ ما بقي كلَّه حين يكون `want` أكبر من المتبقي (٨ مقابل ٦). فلو
تزامن اثنان لَحُرِم الثاني وإن لم يُنفق الأولُ إلا واحدة. **ولهذا صار القفل
بالمستخدم**: يُسلسَل التوليد فلا يقع ذلك التزامن أصلاً، والحجزُ ضمانةٌ تحته
لا حارسٌ وحده. الاختبار يقول هذه الخاصّية صراحةً بدل أن يتجنّبها.

### وحدٌّ يُقال أيضاً

المخزن ملفٌّ على قرصٍ محلّي. نُسختان من الخادم على قرصَين تعدّان كلٌّ لنفسها.
هذا **قائمٌ سلفاً في كل استعمالات هذا العدّاد** — لا يزيده الحجز ولا ينقصه —
ولم يُدَّعَ أن هذا الـSprint عالجه.

📌 **وما لم يُلمَس**: الفجوةُ نفسها («اسأل ثم خُذ») قائمةٌ في `botAi` و
`socialPosts` و`emails` و`notifyMail`. لكنّها هناك تعدّ **وحدةً واحدة لكل
طلب**، فالفائض محدودٌ بعدد المتزامنين وتحته حدُّ معدّل؛ وفي `aiImages` وحدها
يبلغ الفائضُ ثماني صورٍ مدفوعة للتدفّق الواحد. تُركت عن قصدٍ لا عن سهو،
والأداة (`reserveUsage`) صارت جاهزةً لها متى استحقّت Sprint‑اً خاصاً بها.

### الدليل

`tests/usageMeter.test.mjs` (١٣) — **أول تغطيةٍ للوحدة**: العدّ لكل مستخدمٍ
ولكل مقياسٍ ولكل شهرٍ على حدة، والحجز والقصّ على الحصة والخطة بلا سقف
والإفراج وأرضيّة الصفر وحجزُ الصفر.

ومنها ثلاثة تقيس **السلوك المتزامن** بتشغيلٍ حقيقي: اختبارٌ يُعيد إنتاج العطب
حرفياً ويؤكّد **12** (فإن لم يقع العطب فالاختبار لا يقيس شيئاً)، وآخر يؤكّد أن
ثلاثة تدفّقاتٍ بالحجز لا تتجاوز الحصة، وثالثٌ يقول خاصّية الحجز الكامل صراحةً.

أُثبت سقوط الحرّاس بأربع طفرات: حجزٌ بلا تقييدٍ فوري (٧ سقطات)، وحجزٌ بلا
قصٍّ على الحصة (٥)، وإفراجٌ لا يعيد شيئاً (٤)، ونزعُ أرضيّة الصفر (١).
**983/983.**

---

## Sprint 2j — مفتاحان مختلفان لسؤالٍ واحد، فيحطّ محتوى «خدماتنا» على «الرئيسية»

`agents/reactGenerator.js` هو نصفُ القلب الآخر: `reactPreview` **يعرض**،
وهذا **يبني**. ٣٤٣ سطراً، صفرُ تغطية. والمستدعي واحد:

```js
content = await generateContentModel(goal, { sections, lang, llm });   // jcr.js:2401
const scaffold = generateNextScaffold({ projectName, sections, lang, content });  // 2405
```

**المصفوفة نفسها** تُمرَّر للدالّتين. وكلٌّ منهما تشتقّ مفاتيح الأقسام
**بقواعد أخرى**:

| | `generateContentModel` | `generateNextScaffold` |
|---|---|---|
| حقنُ الهيكل (navbar/hero/footer) | **لا** | نعم — فتنزاح الفهارس |
| فضُّ تكرار الأسماء | **لا** | نعم (`About` ← `About4`) |

### الأثر — بتشغيلٍ حقيقي

أقسامٌ سمّاها صاحب المشروع: «الرئيسية، من نحن، خدماتنا، تواصل معنا».

| صفحةُ المستخدم | مفتاح البناء | المحتوى الذي حطّ عليها |
|---|---|---|
| **الرئيسية** | `Section3` | «محتوى **خدماتنا**» |
| **من نحن** | `Section4` | «محتوى **تواصل معنا**» |
| خدماتنا | `Section5` | (افتراضيٌّ عامّ) |
| تواصل معنا | `Section6` | (افتراضيٌّ عامّ) |

ليس ضياعاً فحسب: **إزاحةٌ بموضعَين**. نصفُ المحتوى يُكتب ويُرمى، والنصف
الآخر يحطّ على الصفحة الخطأ — ولا أحد يعلم، فالبناء «نجح».

وفي حالة التكرار (`about, about, contact`): الطلبُ يحوي **مفتاحاً مكرّراً**
(`"About"` مرّتين في شكل JSON واحد)، والبناء يصنع `About4` الذي **لم يُطلب
له محتوى قطّ**.

### وعطبٌ ثانٍ في الطلب نفسه

```
اكتب محتوى واقعياً ومقنعاً لمشروع المستخدم (لا نصوصاً عامة).
"sections": { "Section1": {...}, "Section2": {...} }
```

يُطلب محتوىً **غير عامّ** لأقسامٍ لا يُقال للنموذج ما هي. «من نحن» صارت
`Section2` قبل أن تصل إليه؛ المعنى حُذف ثمّ طُلبت نتيجتُه. والمفارقة أن
الدالّة الشقيقة `generateSectionContent` **تمرّر `label`** — فالنمط الصحيح
كان في الملفّ نفسه.

### الإصلاح: اشتقاقٌ واحد

`planSections(sections)` — نقلٌ حرفيٌّ لمنطق البناء (الحقن ثمّ `compName`
ثمّ فضّ التكرار مع حفظ التسمية) — صار المصدر الوحيد، تستهلكه الدالّتان.
و`generateContentModel` يضيف سطراً يحمل المعنى:

```
كلُّ مفتاحٍ في "sections" يقابل قسماً سمّاه صاحب المشروع هكذا:
"Section3" = "الرئيسية"، "Section4" = "من نحن"، …
```

المفتاح يبقى لاتينياً بالضرورة (اسمُ مكوّنٍ ومسارُ ملفّ)، والمعنى يسافر معه.

بعد الإصلاح: المطلوب == المبنيّ في الحالات الثلاث، ولا مفتاحَ مكرّر، وكلُّ
صفحةٍ تحمل محتواها هي.

### نتيجةٌ سلبيةٌ تُقال

فُحصت بنيةُ الناتج على ستّ مجموعاتٍ من الأقسام (إنجليزي، عربيّ كلُّه، مختلط،
بلا أقسام، متكرّر، متجر): **لا وجهةَ بلا صفحة، ولا وجهتان متطابقتان، ولا
ملفّان بالاسم نفسه، ولا مكوّنٌ يُستورَد وهو غير موجود**. البنية سليمة؛ العطب
كان في **إسناد المحتوى** لا في الهيكل. فثُبّتت السلامة حرّاساً بدل أن تُصاغ
اكتشافاً.

### الدليل

`tests/reactGenerator.test.mjs` (١٦) — **أول تغطيةٍ للوحدة**: الاشتقاق الواحد
(الحقن، فضّ التكرار، وألّا يُمسّ مصفوفة المستدعي — فالنداءان لا يحقنان مرّتين)،
وتطابقُ المطلوب بالمبنيّ في ثلاث حالات، وخلوُّ الطلب من التكرار، وحملُه تسمية
صاحب المشروع لكل مفتاح، و**حطُّ المحتوى على صفحته**، وألّا يُبنى قسمٌ بلا طلب.
ومعها حرّاسُ البنية السليمة، وحتميّةُ الوجهات (نموذجٌ يحاول حقن `/hacked`
فتُهمَل وتُقبل علامتُه)، والاتجاه، و`compName`/`slugify`.

أُثبت سقوط الحرّاس بخمس طفرات: اشتقاقٌ موازٍ في نداء المحتوى (**٧ سقطات**)،
ونزعُ المعنى من الطلب (٢)، ونزعُ فضّ التكرار (٣)، ومسُّ مصفوفة المستدعي (١)،
وجعلُ الوجهات بيد الذكاء (١). **999/999.**

---

## Sprint 2k — «المحلّل الذكي» يَعِد بأربعةٍ ويُسلّم اثنين

`agents/requirementAnalyzer.js` — الحلقةُ التي تسبق البناء: تُثري هدف
المستخدم بما لم يقله. ترويستُها تقول إنها تستخرج **أربعة**: المتطلبات
الصريحة، والضمنية، والتعقيد التقني، والتحذيرات (زائد الاقتراحات).

مُرِّرت على تشغيلٍ حقيقي، وقيس **ما يصل سياقَ البناء فعلاً**:

| الحقل | يُملأ؟ | يُقرأ في الريبو كلّه؟ |
|---|---|---|
| `implicitRequirements` | نعم (جدولٌ حسب النوع) | **نعم** |
| `suggestions` | نعم | **نعم** |
| `explicitRequirements` | **لا — `[]` دائماً** | لا |
| `technicalComplexity` | نعم (مسحُ كلمات) | **لا — ولا مرّة** |
| `warnings` | نعم (ثلاث رسائل) | **لا — `buildRequirementsContext` لا يمسّها** |

الحقولُ الثلاثة الأخيرة تُحسب في كلّ بناء ثمّ تُرمى. والعمودُ الأخير قيس
بمسحٍ للريبو كلّه، لا باستنتاج.

### والمسحُ الذي يغذّيها كان `includes` خاماً

| الطلب | ما استنتجه | لماذا |
|---|---|---|
| «سلسلة مطاعم» | تعقيدٌ `medium` | «سلسلة» تحوي «سلة» |
| «شركة capital للاستثمار» | تعقيدٌ `medium` | «capital» تحوي «api» |
| «مطعم وجبات سريعة في جدة» | «طلبٌ سريع — قد تكون الأقسام مختصرة» | لفظُ المنتج قُرئ عَجَلةَ الطالب |

### ما فُعل — ولكلِّ قطعةٍ سببها

لا يُوصَّل المهمَل لمجرّد أنه موجود، ولا يُحذف لمجرّد أنه مهمَل:

- **`explicitRequirements`** حُذف: لم يُملأ قطّ، و«ما قاله المستخدم صراحةً»
  هو ما يستخرجه `keyFeatures` من مسار الذكاء سلفاً.
- **`technicalComplexity`** حُذف: توصيلُه اليوم يصنع **إشارةَ تعقيدٍ ثانية**
  بجانب `needsBackend` — وهو المصدر الواحد الذي وُحِّد في Sprint 7/1. لا
  نُعيد بناء العطب الذي عولج.
- **«طلبٌ سريع»** حُذف: يستنتج عَجَلةَ الطالب من لفظٍ يصف المنتج. هو بعينه
  عطبُ Sprint 2f («لفظُ العميل ينقض لفظَ المنتج»)، ثالثَ مرّة.
- **«يحتاج قاعدة بيانات»** حُذف: حكمٌ يملكه `needsBackend` وحده.
- **«الوصف قصير»** حُذف: صحيحٌ في ذاته، لكن قناته كانت **prompt المبرمج**،
  وهي ليست مكان مخاطبة المستخدم. 📌 إن أُريد قولُه له فمن قناة السجلّ الحيّ،
  وذلك **قرارُ منتجٍ لم يُتَّخذ هنا** — لا يُخترع سلوكٌ ظاهرٌ للمستخدم في
  Sprint تنظيف.

### وعطبٌ كامنٌ ظهر بالتشغيل لا بالقراءة

الدالّتان مُصدَّرتان، وتركيبُهما الطبيعيّ **كان يرمي**:

```js
buildRequirementsContext(staticAnalysis(goal, type));
// TypeError: Cannot read properties of undefined (reading 'length')
```

لأن `keyFeatures` و`contentSuggestions` لا يضيفهما إلا مسارُ الذكاء. غيرُ
قابلٍ للوقوع من المستدعي الوحيد اليوم (يمرّ دائماً عبر `analyzeRequirements`)
— **يُقال كما هو: فخٌّ كامنٌ لا عطبٌ حيّ**. صار كلُّ حقلٍ يُقرأ بحارسه،
و`buildRequirementsContext()` بلا وسيطٍ يعطي نصاً فارغاً لا انهياراً.

### واقترانٌ صامت في `jcr.js`

إثراءان **مستقلّان** — المحلّل والصور — كانا في `try` واحدة بـ`catch` صامت.
فسقوطُ المحلّل يُسقط الصورَ معه ولا يعلم أحد. فُصلا، ولكلٍّ احتياطه.

### نتيجتان سلبيتان تُقالان

1. **إجاباتُ المُوضِّح ليست ضائعة.** بدا أن `clarifierAnswers` مُعامَلٌ
   مُمرَّرٌ في ثلاثة توقيعات ولا يُملأ قطّ — فظُنّ أن جواب المستخدم لا يصل
   المحلّل. لكن التتبّع إلى `getFinalGoal` أظهر أنه **يدمج «س/ج» في نصّ
   الهدف نفسه**، وهو ما يُمرَّر مهمّةً. فالمعلومة تصل؛ المُعامَلُ سباكةٌ
   ميتة لا فقدانَ بيانات. أُزيل من `staticAnalysis` (لم يستعمله قطّ) وبقي في
   `deepAnalysis` (يستعمله فعلاً).
2. **بوّابات الاقتراحات سليمة.** `!goal.includes('seo')` وأخواتها كوابحُ لا
   محفّزات، وفُحصت فلم يظهر لها إخفاقٌ واقعيّ. تُركت.

### الدليل

`tests/requirementAnalyzer.test.mjs` (٩) — **أول تغطيةٍ للوحدة**: ما تُسلّمه
فعلاً (الضمنيّ حسب النوع، والأساسياتُ لنوعٍ مجهول، وكبحُ الاقتراح المذكور
سلفاً)، وتركيبُ المُصدَّرَين لا يرمي، والكائنُ الناقص/الفارغ، والحقول الذكية
حين تُوجد، وغيابُ الذكاء لا يُضيع الجزء الحتميّ.

وحارسٌ حيّ: **«لا مصدرَ ثانياً للتعقيد في الريبو»** — يمرّ على `agents/` و
`services/` و`core/` في كلّ تشغيل. وهو يميّز **استعمالَ** الحقل من **ذِكرِ**
اسمه، فالتعليقُ الذي يشرح سبب حذفه لا يُسقطه.

أُثبت سقوط الحرّاس بثلاث طفرات: عودةُ حقلٍ لا يُقرأ (٢ سقطتان)، ونزعُ حارس
الحقول (٢)، ونوعٌ مجهولٌ بلا أساسيات (١). **1008/1008.**

---

## Sprint 2l — عدَّادُ الإصلاح يعدّ تنبّؤاً، والكتابةُ معلّقةٌ عليه

`agents/reviewAgent.js` — المراجعُ الذي **يكتب فوق ملفات المستخدم**. في
`jcr._stageReview`:

```js
const reviewResult = await reviewCode(plan.files, ...);
if (reviewResult.fixedCount > 0) {              // ← الشرط
    await writePlanFiles(context.projectPath, reviewResult.fixedFiles);
    plan.files = reviewResult.fixedFiles;
}
```

فـ`fixedCount` يحكم **هل تُحفظ الإصلاحات**. ومن أين يأتي؟

```js
const staticResult = runStaticReview(files, lang);
const fixedFiles = autoFix(files, lang);        // ← العمل
fixedCount: staticResult.fixable.length,        // ← العدّ، من دالّةٍ أخرى
```

**العدُّ من دالّة، والعملُ من دالّةٍ أخرى.** و`fixable` تصفية على ثلاثة
أنواع (`rtl`/`charset`/`viewport`)، بينما `autoFix` يُصلح **ستّة**: هذه
الثلاثة، و`alt` للصور، و`console.log` الزائدة، ولونَ نصٍّ على خلفيةٍ داكنة.

### الأثر — باتجاهَين، مُثبَتَين بالتشغيل

| الحالة | `fixedCount` | ما غيّره `autoFix` | النتيجة |
|---|---|---|---|
| صورٌ بلا `alt`، الوسومُ كاملة | **0** | `index.html` | ❌ **الإصلاحُ يُحسب ويُرمى** |
| `console.log` زائدة، الوسومُ كاملة | **0** | `script.js` | ❌ يُرمى |
| `lang` موجودٌ و`dir` مفقود | **1** | لا شيء | ❌ يُقال «تم إصلاح 1 مشكلة» ولم يقع شيء |

الاتجاه الأول أسوأ: عملٌ صحيحٌ يُنجَز ثمّ يُلقى لأن **مُتنبِّئاً** قال إنه
لن يقع. والثاني كذبٌ ظاهرٌ للمستخدم.

### الإصلاح: يقول ما فعله، لا ما يُتوقّع أن يفعله

`autoFix` صار يعيد `{ files, fixes }`، و`fixes` تُملأ **عند وقوع كلّ إصلاح
فعلاً** (بمقارنة النصّ قبل/بعد حيث لا يقين). و`reviewCode` يبلّغ
`fixedCount: fixes.length`. و`fixable` **أُزيلت**: التنبّؤ بسلوك دالّةٍ
أخرى هو العطب نفسه، فلا يبقى منه شيء.

بالقياس نفسه: الحالتان الأولى والثانية صارتا **2** فتُحفظان، والثالثة **0**
فلا يُقال إصلاحٌ لم يقع.

### وعطبٌ ثانٍ في الدالّة نفسها: سمةٌ تشهد لأخرى

```js
if (!/\bdir\s*=/.test(content) && !/<html[^>]*\blang\s*=/.test(content)) {
    content = content.replace('<html', `<html dir="${dir}" lang="${code}"`);
}
```

«لا تلمس شيئاً إن وُجدت **إحداهما**». فصفحةٌ عربية كتب لها المولّد
`lang="ar"` ولم يكتب `dir` تبقى **بلا اتجاه** — تُعرَض من اليسار — و
`runStaticReview` يراها عطباً (`rtl`) و`autoFix` يمتنع عن إصلاحه. **وجودُ
`lang` ليس دليلاً على أن `dir` قُصد.** صارت كلُّ سمةٍ تُفحص وتُضاف على حِدة،
واختيارُ المولّد حين يصرّح لا يُداس.

### وثالثٌ صغير: الشرطةُ المُغلِقة

`/<img(?![^>]*alt=)([^>]*)>/` كان يبتلع الشرطة، فيصير `<img src="a"/>` →
`<img src="a"/ alt="صورة">`. صار النمط يلتقط الإغلاق ويعيده في محلّه.

### نتيجتان سلبيتان تُقالان

1. **`runTests` لا يمنع شيئاً.** بدا أن درجةَ الاختبارات تحكم التسليم، لكن
   `_stageTesting` **يسجّل فقط** — `testResult.passed` لا يُقرأ. فبقيت
   خارج هذا الـSprint: لا حارسَ يُصلَح حيث لا حكم.
2. **قوالبُ الملفات الثابتة ليست عطباً حيّاً.** `runTests` و`runAIReview`
   يبحثان عن `index.html`/`styles.css`/`script.js` بأسمائها، فبدا أن مشاريع
   React ترسب كلُّها. لكن مسار React **يعود من `_selectBuildStrategy` قبل
   هذه المراحل** (`if (strategyResult) return strategyResult;`)، فلا يبلغها
   أصلاً. الفرضية سقطت بالتتبّع، فلا تُصاغ اكتشافاً.

### الدليل

`tests/reviewAgent.test.mjs` (١١) — **أول تغطيةٍ للوحدة**: العدُّ من العمل
(إصلاحٌ خارج الأنواع الثلاثة يُعَدّ، وامتناعٌ لا يُعَدّ، و`console.log`
بعدد ما حُذف)، و`reviewCode` يبلّغ الواقع، وصفحةٌ سليمة لا تُكتب، وزوالُ
التنبّؤ، والسمتان كلٌّ على حِدة (ثلاث حالات)، والشرطةُ المُغلِقة، وصورةٌ
لها `alt` لا تُمَسّ.

أُثبت سقوط الحرّاس بأربع طفرات: العدُّ من تنبّؤٍ لا من عمل (١)، ووجودُ
`lang` يمنع `dir` (٢)، ودهسُ الشرطة (١)، وكائنٌ جديدٌ دائماً (١).
**1019/1019.**

---

## Sprint 2m — مُصلِحٌ أمنيٌّ يسبق وجودَ ما يُصلح بستّ مراحل

`agents/securityAgent.js` — يفحص الكود المولَّد أمنياً، ويُبلّغ درجةً تُسجَّل
في لوحة الذكاء (`recordScore(... 'security' ...)`). وفيه مُصلِحٌ تلقائي واحد:

```js
export function autoFixSecurity(files) {
    // ... الفرع الوحيد:
    if (file.name === 'server.js' && !content.includes('X-Content-Type-Options')) {
        content = content.replace(/app\.use\(express\.json\(\)\)/, ...securityHeaders);
    }
}
```

### القياس

مُرِّر على طقم ملفاتٍ كما يُنتجه المولّد وقتَ مرحلة الأمان:

| | |
|---|---|
| ملفات المولّد | `index.html`، `styles.css`، `script.js`، `api/products.js`، `vercel.json` |
| ما غيّره `autoFixSecurity` | **لا شيء** |
| ما يُقال للمستخدم | `Security A (90/100)` |

**والعطبُ ترتيبٌ لا منطق.** لو عُرض عليه `server.js` لأصلحه — جُرّب فأضاف
الترويسات صحيحةً. لكنّه لا يراه أبداً:

| المرحلة في `DELIVERY_STAGES` | الرقم |
|---|---|
| `security` (حيث يعمل المُصلِح) | **170** |
| `render-config` (حيث يُنشَأ `server.js`) | **176** |

المُصلِحُ يسبق وجودَ ما يُصلح **بستّ مراحل**. فكلُّ خادمٍ يُنشر على Render من
جولا يخرج **بلا ترويسات أمانٍ قطّ** — لا لأن أحداً نسي، بل لأن الحارس وُضع
قبل أن يُولَد ما يحرسه.

### الإصلاح: الترويسات عند مَن يكتب الملف

`generateServerEntry()` في `renderAgent` قالبٌ حتميٌّ نملكه، وفيه
`app.use(express.json());` — المرساةُ نفسها. فنُقلت الترويسات إليه: تُكتب
مع الملف، لا تُضاف إليه لاحقاً بمُصلِحٍ قد يسبقه أو يفوته.

و`autoFixSecurity` **أُزيل**: مُصلِحٌ وحيدُ الفرع لا يبلغ فرعُه أبداً. ومعه
أُزيل `fixedFiles` من نتيجة `runSecurity`، والإسنادُ في `jcr`:

```js
plan.files = secResult.fixedFiles;   // نسخةٌ بلا تغيير، تبدو إصلاحاً
```

فلا يبقى في المسار شيءٌ يُوهم بإصلاحٍ لا يقع — وهو الدرس نفسه الذي حكم
Sprint 2l، في موضعٍ آخر.

### نتيجةٌ سلبيةٌ تُقال

**بقيّةُ الوحدة سليمة.** فحوصُ `runSecurityChecks` (السرّ المكشوف، و`eval`،
و`innerHTML`، وحقن SQL من `req.*`، وCORS) وُجدت تعمل كما تدّعي، و
`generateEnvExample` يشتقّ من `process.env` المستعملة فعلاً. فُحصت وثُبّتت
حرّاساً، ولم يُصنع منها اكتشاف.

### الدليل

`tests/securityAgent.test.mjs` (١٠) — **أول تغطيةٍ للوحدة**: الترويسات الأربع
في القالب، وموضعُها وسيطاً يسبق المسارات ويستدعي `next()`، و**ترتيبُ
المرحلتين نفسه اختبارٌ** يقرأ `DELIVERY_STAGES` (فإن انقلب الترتيب يوماً
عُلم)، وألّا يعود مُصلِحٌ مُصدَّرٌ ولا نتيجةٌ تزعم إصلاحاً، وفحوصُ الأمان
الخمسة، و`.gitignore` حين يغيب لا حين يوجد، و`.env.example`.

أُثبت سقوط الحرّاس بثلاث طفرات: القالبُ بلا ترويسات (٢ سقطتان)، ووسيطٌ بلا
`next()` (١)، وعودةُ المُصلِح والزعم (١). **1029/1029.**

---

## Sprint 2n — الخريطةُ نفسها تجاوزها الكود

Sprint 8/11 عالج خريطةً تقول `KEEP` عن وحداتٍ لا يصل إليها الخادم. وبعد
عشرة Sprints، سُئلت الخريطةُ السؤال نفسه عن نفسها — **بالقياس لا بالقراءة**.

| الدعوى | النتيجة |
|---|---|
| أعدادُ الأسطر المُعلَنة | **58 من 178 خطأ (33%)** |
| وحداتٌ موجودةٌ والخريطةُ لا تعرفها | **7** |
| ملفاتٌ تسمّيها الخريطةُ ولا وجود لها | 0 |

والسبعةُ ليست عشوائية — **كلُّها من صنع الـSprints نفسها**:

| الوحدة | من |
|---|---|
| `agents/backendNeed.js` | Sprint 7/1 |
| `agents/generatedAppSecrets.js` | Sprint 7/4 |
| `core/evidence/Check.js` | Sprint 4 |
| `core/policy/ConfirmationManager.js` | Sprint 3 |
| `services/hostNames.js` | Sprint 7/2 |
| `services/storeKey.js` | Sprint 8/10 |
| `services/siteCreds.js` | — |

الهجرةُ كتبت كوداً، والخريطةُ التي تقودها لم تعلم به. صُحّح الكلُّ: الأعداد
من القرص، والسبعةُ أُدخلت كلٌّ في صفّه بحكمه.

### والأهمُّ: حارسٌ يمنع العودة

خريطةٌ تُصحَّح بيدٍ تعود إلى الانحراف بعد Sprint. فصار كلُّ دعوى فيها
**تُقاس** في كل تشغيل:

1. كلُّ وحدةٍ في `backend/` مذكورةٌ في الخريطة — **حارسُ الإغفال**، وهو
   الذي يمنع تكرار السبعة. ولا يقع إلا عند إضافة وحدةٍ جديدة، فلا يُثقل
   التعديل اليوميّ.
2. كلُّ ملفٍ تسمّيه بحكمٍ حيّ (`KEEP`/`MODIFY`) موجودٌ على القرص.
   و`DELETE`/`MOVED` سِجلٌّ تاريخيٌّ لا يُقاس.
3. الأعدادُ تطابق القرص.
4. عددُ القوالب المُعلَن جملةً (`cloneTemplates/*` — 42) يطابق ما عليه.

### وخطآن في الحارس نفسه، قِيسا وأُصلحا قبل أن يُقال إنه يعمل

- **حارسُ الإغفال كان جوفاء.** كان يقبل التغطية الجمليّة (`x/*`) من أيّ
  موضعٍ في الوثيقة، وفي المقدّمة سطرُ نثرٍ يقول «`core/*` ← `agents/*` ←
  `services/*`» — فعُدّ تغطيةً لكل خدمةٍ وكل وكيل. أُنشئت وحدةٌ وهميّة
  فلم يقع الحارس. صارت التغطيةُ تُقبل من **الخانة الأولى في صفّ جدول**
  وحدها — أي من جردٍ فعليّ. وعندها ظهر `ConfirmationManager` السابع.
  **حارسٌ لا يقع أسوأ من لا حارس**، لأنه يشتري طمأنينةً بلا مقابل.
- **عدُّ الأسطر اختلف عن `wc -l`** بواحد (الفاصلُ الأخير)، فبدت أربعةُ
  صفوفٍ سليمةٍ منحرفة. وُحِّد العدّ.

### ونتيجةٌ سلبيةٌ تُقال

**41 ملفَ قوالبٍ بدت غائبةً وليست كذلك**: الخريطةُ تجملها في صفٍّ واحد
(`cloneTemplates/*`)، وعددُه المُعلَن (42) **صحيح**. وستّةُ أسماءٍ أخرى بدت
أشباحاً فإذا هي في `travel-service` و`plugins/` — خارج نطاق مسحي لا خارج
الواقع. **غيابُ النطاق ليس دليلَ الغياب** — وهو خطأُ القياس نفسه الذي
تحرسه هذه الاختبارات، وقعتُ فيه مرّتين وأُصلح.

### الدليل

`tests/architectureMap.test.mjs` (٤) — أُثبت سقوط كلٍّ منها بطفرته: وحدةٌ
جديدةٌ غير مذكورة، وعددٌ قديم، واسمٌ لملفٍ غير موجود، وعددُ قوالبٍ خطأ.
**1033/1033.**

---

## Sprint 2o — جزيرةُ `taskExecutor`: 441 سطراً لا يبلغها الخادم، وجذرُها لا يُحمَّل

Sprint 8/11 **شخّص** الجزيرة ولم يحذفها، لأن الشرط الذي وضعه المالك صريح:
«لا نحذف أو نعيد كتابة الأنظمة القوية قبل فهم dependencies». فكان القسم
🧭 اليتامى هو الفهم. ولمّا اكتمل، وقع الحذف.

### ما حُذف، وبأيّ حجّة

| الملف | سطور | لا يصل إليه إلا | يُحمَّل؟ |
|---|---|---|---|
| `services/taskExecutor.js` | 225 | **لا شيء** — جذرُ الجزيرة، بلا مرجعٍ واحد | ❌ `simple-git` غير مثبَّتة |
| `services/fileEditor.js` | 73 | `taskExecutor` | ✅ |
| `services/broadcast.js` | 42 | `taskExecutor` (استيراد ديناميكي) | ✅ |
| `services/knowledgeService.js` | 101 | `taskExecutor` (استيراد ديناميكي) | ❌ عبر `projectManager` |

**وقائع أُثبتت بالتشغيل لا بالقراءة**، قبل الحذف:

1. الماشي من `server.js` يبلغ **208 وحدة**؛ **ولا واحدةً من الأربع**.
2. `simple-git` **ليست في `package.json`** — فلو استورد شيءٌ الجذرَ لرمى
   `ERR_MODULE_NOT_FOUND`. لم يظهر ذلك يوماً لأن لا أحد يستورده.
3. الجذرُ يستورد ديناميكياً `agents/architect.agent.js` و
   `agents/projectInitializer.agent.js` — **وكلاهما غير موجود**؛ الحيُّ اسمه
   `agents/architectAgent.js`. أُعيدت التسمية ولم يتبعها هذا الملف.

### والحكم `KEEP` لم يكن حجّةً للإبقاء

ثلاثةٌ من الأربعة تحمل في الخريطة حكماً حيّاً (`KEEP`/`MODIFY`). وهذا
بعينه ما كشفه Sprint 8/11: حكمٌ أُعطي **بقراءة الملف** لا **بمشي بيان
الاستيراد**. فالاستشهادُ به هنا استشهادٌ بالعطب على نفسه.

### ولمَ الجزيرةُ وحدها دون بقيّة اليتامى السبعة

لأنها **الوحدةُ المتماسكة**: جذرٌ واحد وثلاثةٌ لا يصل إليها سواه، فحذفُها
كلٌّ أو لا شيء. أما `db.js` و`logger.js` و`utils/*` فكلٌّ يتيمٌ قائمٌ
بذاته ولكلٍّ حكمُه على حِدة — تُترك ليُنظر فيها منفردة، لا لتُجرَف مع
غيرها. والتاريخُ يحفظ المحذوف، فالحذف قابلٌ للنقض.

### وحارسُ الإدراك بقي

حُذفت الأربعُ من `DECLARED_ORPHANS`، **ولم يُحذف الحارس**: العلّةُ ليست
هذه الملفات بل **الطريقة** — حكمٌ يُكتَب في وثيقةٍ تُصدَّق بدل أن يُحسَب.
فتيتُّمُ وحدةٍ جديدة يُسقط الاختبار، ووصلُ يتيمةٍ يُسقطه أيضاً.

### وخطأٌ في الخريطة كشفه حارسُ Sprint 2n في وجهي

بعد الحذف سقط الاختبار: «الخريطةُ تسمّي ملفاتٍ غيرَ موجودة: `broadcast.js`،
`knowledgeService.js`» — كانا في صفَّين بحكمٍ حيّ خارج قسم اليتامى. صُحّح
الصفّان (`presence.js` وحده، `platformKnowledge.js` وحده) بأعدادٍ من القرص.
هذا ما يُنتظر من حارس: أن يقع.

### وثغرةٌ في Sprint 2n نفسه، ظهرت هنا

Sprint 2n قاس **صفوف الجدول** ولم يقس **عناوين الأقسام**. فكانت تقول:

| العنوان | كان يقول | والقرص |
|---|---|---|
| A) `server.js` | 3702 سطراً، 157 مساراً، 96 استيراداً | 3753، 158، 97 |
| C) `agents/*` | 123 وحدة | 116 |
| D) `services/*` | 90 وحدة | 70 |

عددٌ في عنوانٍ دعوى كعددٍ في صفّ. صُحّحت الثلاثة، وصار **العنوانُ يُقاس**
كما يُقاس الصفّ — الأسطرُ والمساراتُ والاستيراداتُ المحلّية من `server.js`
نفسه، وعددُ الوحدات من مسح المجلّد.

### الدليل

- `tests/moduleReachability.test.mjs` — الماشي يؤكّد أن ما بقي من اليتامى
  سبعةٌ لا أحد عشر، وأن الأربع لم تعد موجودة.
- `tests/architectureMap.test.mjs` (٥، بزيادة حارس العناوين) — أُثبت سقوطه
  بخمس طفرات: إعادةُ كلٍّ من الأعداد الخمسة القديمة أسقطته، ثم رُدّت.
- **1028/1028** (كانت 1033 قبل حذف `tests/fileEditor.test.mjs`، وهو اختبارُ
  ملفٍ محذوف: 6 حالات؛ ثم +1 لحارس العناوين).

---

## Sprint 2p — «✅ Design Brief» فوق تخصيصٍ لم يقع قطّ

`agents/designerAgent.js` (256 سطراً، بلا تغطية) وحدةٌ حيّة في المسار
الكلاسيكيّ: `runDynamicMultiAgentRuntime` → `_stageDesigner`. أي أنها تعمل
في **كل بناءٍ غير React**.

### العطب

السطر 139 كان يستدعي `groq.chat.completions.create(...)` — و`groq`
**غير مستوردٍ في هذا الملف**. والمستورد في السطر 12 هو `smartChat`،
**ويُستعمل صفر مرّة**. بصمةُ هجرةٍ إلى الاستدعاء الموحَّد بدأت ولم تكتمل.

> ملحوظةُ دقّة: `baseAgent.js` **يُصدِّر** `groq` فعلاً. فالعلّة ليست غياب
> المزوّد بل غياب الاستيراد في هذا النطاق. وهي أيضاً سببُ أن الاستيراد
> وحده ما كان ليكفي: `groq` يكون `null` حين لا مزوّد مُهيَّأ.

والنداء داخل `try { … } catch (e) { /* تجاهل أخطاء AI */ }` **فارغ**، فكان
الخطأ يُبتلع كاملاً:

```
node -e "groq.chat" → ReferenceError: groq is not defined
```

### الأثر، مقيساً بالتشغيل على هدفٍ حقيقيّ (62 حرفاً، فالفرع يُدخَل فعلاً)

| الحقل | كان يُنتَج | المقصود |
|---|---|---|
| `heroSlogan` | `null` | شعار hero مخصَّص |
| `uniqueTouch` | `null` | لمسةٌ مميّزة لهذا الموقع |
| `animations` | القيمتان الثابتتان | أنيميشن مقترَح |

### والأسوأ من الصمت: الإعلان فوقه

`jcr.js:_stageDesigner` يفحص `designResult.success` — وهي `true` لأن الدالة
نجحت **شكلاً** — فيبثّ للمستخدم `✅ Design Brief — medical palette`. نظامٌ
يعلن نجاح ما لم يجرِ. وهي العائلة نفسها: **دعوى يقينٍ لا يملكه**.

### الإصلاح

1. الاستدعاء صار عبر `smartChat` المستورد أصلاً — وهو نفسه سلسلةُ الـfailover.
2. استُخرج إلى `requestAiEnhancements(...)` **مُصدَّرةً بمزوّدٍ مُحقَّن**،
   فتُختبر بلا شبكة، وتُرجع `{ ok, data }` أو `{ ok, reason }` — **السبب
   يُقال ولا يُبتلع**.
3. `sanitizeEnhancements` تُسقط الحقلَ المشوَّه: رقمٌ مكان نصّ، أو نصٌّ مكان
   قائمة، لا يمرّ إلى الـbrief.
4. الـbrief يحمل `aiEnhanced` و`aiSkipReason` — **جزءٌ من الناتج لا استنتاجٌ
   من فراغه**. والسطرُ المبثوث صار يقول ما جرى: `+ تخصيص AI` أو
   `(بلا تخصيص AI: <السبب>)`.
5. **الوصفُ القصير تخطٍّ مقصود لا فشل** — يُميَّز بسببه، ولا يُنادى المزوّد.

### الدليل

`tests/designerAgent.test.mjs` (١٢) — أُثبت سقوطها **بثماني طفرات**، أوّلُها
**إعادةُ العطب الأصلي حرفياً** (`groq` غير مستورد داخل `catch` يبتلع): وأُعيد
كلٌّ منها بعد إثبات السقوط.

وحارسُ الخريطة (Sprint 2n/2o) وقع في وجهي مرّةً أخرى: تغيّرُ حجم الملفّين
أسقطه، فصُحّحت الأعدادُ من القرص. **1040/1040.**

---

## Sprint 2q — قائمةُ طعامٍ بلا طعام: المكتبة تُرسل الأسماء وتحجب الـmarkup

`agents/componentMarketplace.js` (251 سطراً، بلا تغطية) ترويستُه تقول:
«يُحقن مباشرة في الـ prompt عند الحاجة». والمسارُ حيّ:
`coderAgent` → `buildContextPrompt` → `buildMarketplaceContext`.

### العطب، مقيساً بالحرف

| | |
|---|---|
| markup منسَّق مخزَّنٌ في الملف | **9,719 حرفاً** |
| ما كان يبلغ النموذج منه | **صفر** |
| ما كان يبلغه فعلاً (أسماء) | 362 حرفاً |
| هل في المحقون وسمٌ واحد `<…>`؟ | **لا** |

والنصُّ المرافق كان يقول للنموذج: «استخدم هذه الـ components **كمرجع**» —
ومرجعٌ لم يره قطّ. ثمانيةُ أسماءٍ كـ`- **navbar-modern**: Navbar عصري`،
والـmarkup الذي هو **كلُّ قيمة الوحدة** باقٍ في الملف لا يغادره.

فهي العائلة نفسها بوجهٍ جديد: **نصٌّ يُحيل إلى ما لم يُرسَل**.

### الإصلاح

يُحقن الـmarkup نفسه، **بميزانيّةٍ محدودة** (`MARKETPLACE_CHAR_BUDGET`
= 9000 حرف) لئلّا ينتفخ الـprompt كلّما كبرت المكتبة. وما لا تتّسع له
الميزانيةُ **يُصرَّح بغيابه** نصّاً («لم يُرسَل markup هذه — استوحِ منها
بأسلوبك») بدل أن يُذكر بين الحاضر. فالقاعدة: *ما يُذكر حاضراً يُرسَل، وما
لا يُرسَل يُقال إنه لم يُرسَل* — وهي تصمد مهما كبرت المكتبة.

الأثر على الميزانية: سياق Knowledge Engine 3,337 حرفاً → 8,770 من نصيب
المكتبة. كلفةٌ مقصودة: هذا **prompt توليدِ كود**، وقيمةُ المكتبة كلُّها في
markupها.

### واستيرادٌ ميت

`jcr.js` كان يستورد `buildMarketplaceContext` **ولا يستدعيه** (المسار الحيّ
عبر `knowledgeEngine`). حُذف الاستيراد.

### نتيجتان سلبيّتان تُقالان

1. **الترشيح بالنوع أرقُّ ممّا يبدو، وليس عطباً**: سبعةٌ من الثمانية موسومةٌ
   `all`، فكلُّ نوعٍ يصيبها؛ و`pricing-modern` وحده نوعيّ (saas/gym/education).
   فالمكتبةُ غيرُ مُنتقاة بالنوع فعلياً — لكنها **لا تدّعي** ذلك، فلا دعوى
   كاذبة. تُترك كما هي.
2. **القائمة الثانية في `buildContextPrompt`** (من `COMPONENTS.components`)
   أسماءٌ وأوصافٌ بلا markup أيضاً — **لكن نصّها يقول «استخدم CSS patterns
   مشابهة لها»**، وهذا يُنفَّذ من الاسم والوصف. دعوىً صادقة، فلم تُمَسّ.

### وتصحيحُ توقّعٍ لي، لا تصحيحُ كود

كتبتُ اختباراً يفترض أن نوعاً مجهولاً يُرجع فراغاً — فسقط. والسبب أن وسم
`all` يُصيب كل نوع، فحارسُ `length === 0` لا يقع إلا لو **فرغت المكتبة**.
صُحّح الاختبارُ ليقول ما قاسه، لا ما تمنّيته.

### الدليل

`tests/componentMarketplace.test.mjs` (٨) — أُثبت سقوطها **بستّ طفرات**،
أوّلُها **إعادةُ الدالة القديمة حرفياً** (أسماءٌ + «استخدم كمرجع»). وحارسُ
الخريطة أسقط البناء على تغيّر حجم الملفّين فصُحّحت الأعداد. **1048/1048.**
