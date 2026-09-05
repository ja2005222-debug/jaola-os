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

---

## Sprint 2r — «تصميم جمالي» يُكتب له schema.prisma، و«نظام محاسبة» يأخذ Prisma بلا خادم

`agents/postgresAgent.js` (355 سطراً، بلا تغطية) — المسار حيّ:
`jcr.js:888` → `needsPostgres(context.originalGoal)` → `generatePrismaSetup`
→ **كتابةُ أربعة ملفات في مشروع المستخدم**.

### العطب الأول: احتواءٌ مجرّد، والعربيةُ لا تحتمله

```js
/postgres|postgresql|prisma|relational|علاقية|مالي|محاسبة|finance|accounting/i
```

«مالي» أربعةُ أحرفٍ تسكن داخل كلماتٍ لا علاقة لها بالمال:

| الهدف | الحكم القديم |
|---|---|
| «أريد موقعاً بتصميم **جمالي** راقٍ» | ✅ Postgres |
| «متجر في الحيّ ال**شمالي**» | ✅ Postgres |
| «عرض أ**عمالي** ومشاريعي» | ✅ Postgres |
| «يعرض الإ**جمالي** والأسعار» | ✅ Postgres |

**خمسٌ من سبعةٍ إيجابياتٌ كاذبة** — و«تصميم جمالي» من أشيع ما يكتبه طالبُ
موقع. والأثر ليس نظرياً: تُكتب في مشروعه `prisma/schema.prisma` و`api/db.js`
و`.env.example` **يطلب `DATABASE_URL`** و`PRISMA_README.md`.

وهي العلّةُ عينها التي عولجت في `detectProjectType` («تطبيق» داخل «طبي»)
وفي `needsBackend` («api» داخل *therapist*) — عادت في موضعٍ ثالث.

### العطب الثاني: قائمةٌ ثالثة أغفلها الاتحاد

`backendNeed.js` يُعرّف نفسه بأنه «اتحاد ما قصده كاتبا القائمتين». وكانت
هناك **ثالثة** لم يرها: `needsPostgres`. فتناقضا:

| الهدف | needsPostgres | needsBackend |
|---|---|---|
| «نظام محاسبة للشركة» | نعم | **لا** |
| «موقع مالي للاستثمار» | نعم | **لا** |
| `accounting software` | نعم | **لا** |
| `relational data model` | نعم | **لا** |

**أربعٌ من أربع.** فنظامُ محاسبةٍ حقيقيّ كان يأخذ schema وطلبَ
`DATABASE_URL` — **ولا خادمَ يُشغّلهما**، ولا نشرَ خلفيةٍ أصلاً.

### العطب الثالث: ملخّصٌ يسمّي ما لم يُكتب

```js
summary: `... ${files.length} ملف (schema, seed, client, readme)`
```

قائمةٌ ثابتة: تقول **seed** ولا seed إلا لأنواعٍ لها قالبٌ جاهز، ولا تذكر
`.env.example` **قطّ** وهو مكتوبٌ دائماً. (وهي عينُ ما عولج في ملخّص
`DatabaseAgent` سابقاً.)

### الإصلاح — واحدٌ يحلّ الثلاثة

1. **كلماتُ العلاقية انتقلت إلى `backendNeed.js`** ودخلت الاتحاد. فصار
   `needsPostgres` تصديرَ `needsRelationalDb` من المصدر نفسه، و
   **`needsPostgres ⟹ needsBackend` بالبناء لا بالصدفة**: كلماتُها
   مجموعةٌ جزئيّة من كلماته، فلا تناقضَ ممكن. واختبارٌ يقيس هذا الاحتواء
   على القائمة نفسها لا على أمثلةٍ منتقاة.
2. **المطابقةُ العربية صارت مقيَّدة بالسابقة**: `[وف]?` ثمّ `[بك]?` ثمّ
   `(لل|ال|ل)?` ثمّ الكلمة — والنهايةُ حرّة كما كانت. فـ«المالية» و«بالمحاسبة»
   و«وللمحاسبة» تُطابق، و«جمالي» و«شمالي» و«أعمالي» لا تُطابق.
   وعقدُ `needsBackend` القديم لم يتغيّر: «الحساب»، «حسابات»،
   «للمستخدمين»، «إدارة المخزون» كلُّها تمرّ كما كانت (اختباراتها الستّة
   خضراءُ بلا تعديل حرفٍ واحد فيها).
3. **الملخّصُ يُشتقّ من `files`** فيسمّي ما كُتب فعلاً.

### الدليل

`tests/postgresAgent.test.mjs` (٨) + الستّة القائمة لـ`backendNeed` —
أُثبت سقوطها **بخمس طفرات**: إعادةُ الاحتواء المجرّد، وإخراجُ العلاقية من
الاتحاد، وإلغاءُ قيد السابقة، وإسقاطُ سابقة «لل» المقبولة، وعودةُ الملخّص
الثابت. **1056/1056.**

---

## Sprint 2s — علّةٌ واحدة في خمسة مواضع: أداةٌ واحدة بدل خمسة إصلاحات

بعد أن أُصلحت علّةُ «الاحتواء المجرّد» ثلاث مرّات في ثلاثة مواضع
(`detectProjectType`، `needsBackend`، `needsPostgres`)، صار السؤالُ: **كم
موضعاً آخر؟** فقِيس بدل أن يُخمَّن.

### وأوّلُ ما قِيس كان مقياسي أنا

مسحٌ أوّل عن «regex عربيّ بلا حدود» أعطى **516 نتيجة**. وكان الرقمُ **صنيعةَ
المِقياس لا حالَ الكود**: نمطي كان يقرأ `</h3>` و`</span>` داخل قوالب HTML
على أنها regex literals. فهو الخطأُ الذي أطارده: **فاحصٌ يصنع ما يُبلّغ عنه**.
ضُيّق المسحُ إلى ما يُستعمل مُطابِقاً فعلاً (`.test(`/`.match(`) → **54**.

### والـ54 ليست أعطاباً — وهذا يُقال لا يُخفى

أكثرُها **سليمٌ عمداً**: مُطبِّعاتُ الحروف (`/[أإآ]/`، `/ة/`) وظيفتُها أن
تطابق **داخل** الكلمة، والعباراتُ الطويلة («بطاقة ائتمان») لا تنسكن في
غيرها. فحارسٌ يقع على الـ54 كان سيكون ضجيجاً يدفع إلى كسر المُطبِّعات.
**فالمسحُ النحويّ أداةٌ خاطئة**؛ العلّةُ سلوكيّة: كلمةٌ عربية قصيرة تسكن
داخل كلمةٍ شائعة لا علاقة لها بها. فقِيست بالتشغيل.

### أربعةُ مواضع حيّة، مقيسةٌ لا مُستنتَجة

| الموضع | الكلمة | تسكن داخل | الأثر |
|---|---|---|---|
| `detectAdvancedFeatures` | «كاش» | «كاشير»، «الكاشمير» | «نظام كاشير للمطعم» يستدعي **Redis** |
| `jcr` حارسُ الارتداد | «شيل» | «تشيلي» | **طلبُ إضافةٍ يُعطّل حارسَ الارتداد** |
| `designerAgent` | «ذهب» | «تذهب»، «المذهب» | وكالةُ سفرٍ تأخذ اللوحة الفاخرة |
| `userProfile` | `app` | *happy*، *wrapper*، *apple* | «make it happy» تُسجَّل رغبةَ PWA |

**وأشدُّها الثاني**: `isRemoval` **يُطفئ** حارسَ الارتداد. فطلبٌ اسمُه «أضف
قسماً عن تشيلي» كان يُقرأ نيّةَ حذف، فإن أسقط التعديلُ ميزتين أو أكثر
**لم يسترجع الحارسُ نسخةَ المستخدم العاملة، وضاع عملُه صامتاً**.

### الإصلاح: `agents/keywordMatch.js` — أداةٌ واحدة

- **العربية**: سابقةٌ مقيَّدة (`[وف]?` ثمّ `[بك]?` ثمّ `لل|ال|ل`) **ولاحقةٌ
  من مجموعةٍ مغلقة** ثمّ حدُّ كلمة.
- **اللاتينية**: حدودُ كلمات + لاحقةُ جمعٍ اختيارية.

**ولمَ لزمت اللاحقةُ المغلقة؟** لأن السابقةَ وحدها لا تكفي: «كاش» في
أوّل «كاشير»، فلا حرفَ يسبقها. واللاحقةُ الحرّة تقبلها. فالفصلُ بين
«حسابات» (حساب + ات) و«كاشير» (كاش + ير) **لا يكون إلا بقائمةِ لواحق**.

📌 **حدُّه المعلوم ويُقال**: التمييزُ صرفيٌّ لا معجميّ، فكلمةٌ تنتهي صدفةً
بلاحقةٍ صحيحة ستمرّ. وهو أضيقُ بكثيرٍ من الاحتواء المجرّد — وهذا ما يُشترى.

و`backendNeed.js` صار **يستورد** القاعدتين بدل أن يحتفظ بنسختهما، فالمصدرُ
واحد. واختباراته الستّة والثمانية لـ`postgresAgent` خضراءُ **بلا تعديل
حرفٍ فيها** رغم تبديل المحرّك تحتها.

### وثغرةٌ في حارس الخريطة كشفها هذا العمل

صفُّ `knowledgeEngine.js` كان `| 299 (7) |` — **عددان لاسمٍ واحد**، فشرطُ
`names.length !== nums.length` كان يتخطّى الصفَّ كلَّه. فانحرف **36 سطراً
(299 ← 335) بلا قياس**. صار الاسمُ الواحد يُقاس بأوّل عددٍ في خانته، وأُثبت
سقوطُ الحارس بإعادة `299 (7)`.

### الدليل

`tests/keywordMatch.test.mjs` (٧) + الستّة لـ`backendNeed` + الثمانية
لـ`postgresAgent` — أُثبت سقوطها **بستّ طفرات**: الاحتواء المجرّد، واللاحقة
الحرّة، وإلغاء قيد السابقة، وإسقاط حدّ الكلمة اللاتيني، وإسقاط «كاش» من
المستهلك الحيّ، وإلغاء لاحقة الجمع. وطفرةٌ سابعة لحارس الخريطة.
**1063/1063.**

### وسقوطٌ في CI ليس من هذا العمل — يُشخَّص ويُسجَّل، ولا يُبتلع

سقط `Vercel` على رؤوس هذا الـPR بنصٍّ صريح:

```
Resource is limited - try again in 1 day (more than 100, "api-deployments-free-per-day")
```

**حصّةُ نشرٍ إدارية** نفدت على مستوى الحساب بعد يومٍ كثيرِ الـPRs — لا عطبَ
في الكود. وثلاثةُ أدلّة لا رأي:

1. الفرقُ كلُّه في `backend/` بلا ملفِ واجهةٍ واحد؛ فـVercel يبني الواجهة
   **نفسَها** التي بناها على `main` قبل دقائق.
2. **وظيفةُ «بناء الواجهة» في Actions نجحت** — فالواجهةُ تُبنى سليمة،
   والعاجزُ هو **نشرُ** المعاينة لا البناء.
3. سائرُ الفحوص خضراء: الوظائفُ الخمس، والمحلّلاتُ الثمانية.

والحجبُ **متقطّع** لا ثابت: حُجب على `bbce373`، ثمّ نجح مرّةً على
`d8ce28c`، ثمّ حُجب على `f2e8f14`. فلا إعادةُ تشغيلٍ تُعوَّل عليها، ولا
إصلاحَ برمجيّاً ممكناً — لا تغييرَ في الكود يُعيد حصّةَ حساب.

عُرض الأمرُ على المالك فأذن بالدمج على **8/9** مع تسجيل السبب.

📌 **ودرسٌ في القياس وقعتُ فيه هنا**: كتبتُ أوّلاً أن الـSprint «دُمج على
8/9» قبل أن يقع الدمج، ثمّ صحّحتُه إلى «زال المانع» فكذّبته الدفعةُ
التالية. فكلُّ دفعةٍ أدفعها لتصحيح السجلّ **تُغيّر الوقائعَ التي يصفها**.
فصار يُكتب بما **لا تُكذّبه دفعةٌ لاحقة**: ما شوهد ومتى، لا ما سيصير.

📌 **والقاعدة**: بارُ «التسعة خضراء» يبقى، ويُستثنى منه فحصٌ **يُثبَت
بالدليل** أنه لا يقيس التغيير ولا يمكن إصلاحه برمجياً — ويُكتب الاستثناءُ
ومُبرِّرُه بإذنٍ من المالك، فلا يصير سابقةً صامتة.

---

## Sprint 2t — `specs.js` فُحص فوُجد سليماً، فثُبِّتت سلامتُه

آخرُ وحدةٍ حيّة بلا تغطية: `agents/backendTeam/specs.js` (334 سطراً) —
عقودُ سبعةِ وكلاء، والترتيبُ والتعاونُ معرَّفان فيها.

### النتيجة: **لا عطب**

فُحصت دعاواها بالتشغيل لا بالقراءة:

| الدعوى | القياس |
|---|---|
| المعرّفات فريدة | ✅ سبعةٌ فريدة، والمفهرسُ لم يبتلع أحداً |
| `dependsOn` تشير إلى وكلاء موجودين | ✅ كلُّها |
| `debugFor` يشير إلى وكيل QA حقيقيّ | ✅ `backend-qa-engineer` |
| الرسمُ بلا دورة ويُرتَّب | ✅ سبعةٌ في ترتيبٍ سليم، وكلُّ تابعٍ بعد متبوعه |

وكذلك `frontendTeam/specs.js` (ستّةُ وكلاء). **فلم يُفتعل عطبٌ من عدم.**

### ولمَ اختباراتٌ إذاً؟

لأن هذه الدعاوى **تنكسر صامتةً** عند إعادة تسمية وكيلٍ أو إضافة تبعيةٍ
لاسمٍ لا وجود له: `Object.fromEntries` يبتلع المكرَّر بلا صوت، وتبعيةٌ
مفقودة تُغيّر الترتيبَ لا تُوقفه. فهي **تثبيتُ سلامةٍ قائمة**، لا إصلاح.

وأُضيفت دعوى لم تكن مكتوبة: **المنقِّحُ يجب أن يعتمد على هدفه**. فلو
`debugFor: 'backend-qa-engineer'` بلا `dependsOn` عليه، جاز أن يُرتَّب
**قبله** فيُنقّح ما لم يجرِ بعد. صحيحةٌ اليوم، ومحروسةٌ من الآن.

### وخطأُ قياسٍ وقعتُ فيه أثناء الفحص — يُقال

فحصتُ `cooperation[].with` بوصفه معرّفاً، فبدت **كلُّها مفقودة** في
الفريقين: «Database Engineer» ليست `database-engineer`. ثمّ تتبّعتُ
المستهلك: `AgentSpec.js` يعرضها نصّاً في الـprompt
(«- مع ${c.with}: ${c.how}») **ولا يبحث عنها أحدٌ كمعرّف**. فهي أسماءُ
أدوارٍ صحيحةٌ في موضعها، وكان مقياسي يقيس توقّعي لا الكود.
فلم تُختبر بوصفها مراجع — ولو اختُبرت لأُجبر أحدُنا يوماً على تشويهها
لإرضاء اختبارٍ خاطئ.

### الدليل

`tests/teamSpecs.test.mjs` (٦) على الفريقين معاً — أُثبت سقوطها **بستّ
طفرات**: تبعيةٌ لاسمٍ لا وجود له، و`debugFor` لوكيلٍ غير موجود، ومنقِّحٌ
لا يعتمد على هدفه، ومعرّفٌ مكرّر، وجذرٌ ثانٍ، وحقلٌ مُفرَّغ من الأقسام
التسعة. **1069/1069.**

### وحصّةُ Vercel — الاستثناءُ الثاني، بإذنٍ ثانٍ

سقط `Vercel` هنا أيضاً بالحصّة نفسها (`api-deployments-free-per-day`).
والحالُ أوضحُ من سابقتها: هذا الـSprint **لا يمسّ الواجهة بحرف** — اختبارٌ
ووثيقةٌ فقط — ووظيفةُ «بناء الواجهة» في Actions نجحت. أربعَ عشرةَ خضراء.

**ولم يُعمَّم إذنُ #479 من تلقاء الوكيل**: عُرض الأمرُ على المالك ثانيةً
فأذن. وهذا هو المقصود بـ«لا يصير سابقةً صامتة» — الإذنُ لواقعةٍ لا لقاعدة،
ويُطلب في كل مرّة ويُكتب في كل مرّة.

---

## Sprint 2u — «a landing page for an author» يأخذ نظامَ مصادقةٍ كاملاً

### العطب

`authAgent.js:26` كان يقول:

```js
export function needsAuth(userGoal) {
    const goal = (userGoal || '').toLowerCase();
    return AUTH_KEYWORDS.some(kw => goal.includes(kw));
}
```

وهذا **سادسُ** موضعٍ من العائلة نفسها التي وحّدها Sprint 2s. وثمنُه هنا
ملموسٌ لا مجازيّ: `jcr.js:910` يسأل `needsAuth`، فإن قالت «نعم» كتب
**خمسةَ ملفات** على قرص المشروع:

```
api/middleware/auth.js · api/models/User.js · api/auth.js · auth.html · AUTH_README.md
```

فمن طلب صفحةً تعريفيّةً لمؤلِّف وجد في مشروعه JWT وقاعدةَ مستخدمين.

### الخمسةُ المقيسة — بتشغيل الدالة، لا بقراءتها

| الهدف | المفتاح | الاحتواء |
|---|---|---|
| `a landing page for an author` | `auth` | ⊂ *author* |
| `a blog about authentic food` | `auth` | ⊂ *authentic* |
| `website for an accountant` | `account` | ⊂ *accountant* |
| `accounting services page` | `account` | ⊂ *accounting* |
| `a page about administration buildings` | `admin` | ⊂ *administration* |

وفُصلت عنها ثلاثةٌ **ليست** من هذا الباب: «قائمة المستخدمين المشاهير»
و«موقع عن إدارة الوقت» و«user profile photos gallery» — تلك سَعَةُ
مفاتيحَ لا احتواءُ حروف، ولم تُدَّعَ عطباً.

### الإصلاح

بالأداة المشتركة نفسها، لا بإصلاحٍ سادسٍ خاصّ:

```js
export function needsAuth(userGoal) {
    return hasKeyword(userGoal, AUTH_KEYWORDS);
}
```

### وإغفالٌ **سابقٌ** للإصلاح لا ناتجٌ عنه

كشفه الفحصُ ولم يُحدثه: أشيعُ صيغتين عربيّتين على الإطلاق —
«تسجيل **ال**دخول» و«إنشاء حساب» — كانتا تفوتان `includes` أيضاً، لأنّ
«ال» تتوسّط الكلمتين. قِيس ذلك على التنفيذ القديم نفسه فسقطتا فيه كذلك.
فمن كتب «أريد موقعاً فيه تسجيل الدخول» لم يُولَّد له شيء. أُضيفتا.

**ولم تُضَفْ `sign up`** رغم أنها تبدو نظيرتَهما: «landing page with
newsletter sign up» هدفٌ مشروعٌ لا مصادقةَ فيه. فالتوسعةُ تُقاس بضررها
كما بنفعها، والقرارُ مكتوبٌ في الاختبار لا في الذاكرة.

### وملخّصٌ ثابتٌ عن ناتجٍ متغيّر

`generateAuth` كان يقول `${files.length} ملف (login, register, middleware, UI)`
— العددُ مشتقٌّ والقائمةُ ثابتة، تسمّي أربعةً لخمسةِ ملفات، فتُسقط نموذجَ
المستخدم ودليلَ التركيب. صار ما يُعلَن يُشتقّ ممّا كُتب، كما في
`postgresAgent` (Sprint 2r). وهي العلّةُ إيّاها: **سجلٌّ يجزم بما لم يقسه.**

### ونتائجُ سلبيّةٌ تُقال كما هي

- **`UserSchema` المولَّد سليم**: bcrypt بـ12 دورة، و`role` لا يُؤخذ من
  `req.body`، و`comparePassword`، و`select('-password')`. لا تغيير.
- **رموزُ اللغة لا خطرَ فيها**: `getUserLanguage` تُعيد رمزين حرفيّين من
  اثنتَي عشرة (`ar en fr …`)، فلا `ar-SA` يسقط إلى الإنجليزية.
- **`generateAuth` لا يكتب على القرص**: يُعيد الملفات، والكتابةُ في
  `jcr.js`. صُحّح وصفي لذلك.

### الدليل

`tests/authAgent.test.mjs` (٧) — أُثبت سقوطها **بخمس طفرات**، كلٌّ منها
أسقطت اختبارَها وحده: عودةُ `includes` حرفيّةً، ونزعُ الصيغتين
العربيّتين، وعودةُ الملخّص الثابت، وجعلُ الاتجاه `rtl` دائماً، وإسقاطُ
`api/models/User.js` من الناتج.

وحارسُ الخريطة أمسك انحرافَه بنفسه: `authAgent.js: الخريطة 333 ← القرص 346`
— لم يُكتشف بالقراءة بل سقط الاختبار. **1076/1076.**

---

## Sprint 2v — «متجر ملابس بتصميم جمالي» يُوصَف postgresql، والملفاتُ مونغو

### العطب الأول: سؤالٌ واحد، قائمتا مفاتيح، جوابان

`databaseAgent.js:21` كان يحمل قائمةً ثانيةً مستقلّة تُطابَق بـ`includes`:

```js
const POSTGRES_KEYWORDS = ['مالي','محاسبة','فاتورة','دفع','payment','finance',
                           'accounting','invoice','bank','بنك','عملات','currency'];
const needsPostgres = POSTGRES_KEYWORDS.some(kw => goal.includes(kw));
```

بينما `needsPostgres` الحقيقيّة — التي يستشيرها `jcr.js:889` قبل توليد
Prisma — تقرأ `RELATIONAL_KEYWORDS` من `backendNeed.js` (مصدرُ الحقيقة
الذي أُنشئ في Sprint 2r). فتباعد الجوابان:

| الهدف | selectDatabase | needsPostgres | النتيجة |
|---|---|---|---|
| `متجر ملابس بتصميم جمالي` | postgresql | false | «مالي» ⊂ «جمالي» — العلّةُ عينها التي أُصلحت في postgresAgent وبقي توأمُها |
| `موقع فواتير ودفع` | postgresql | false | توصيةٌ بلا منفّذ |
| `invoice management system` | postgresql | false | توصيةٌ بلا منفّذ |

فصار الجوابُ من `needsRelationalDb` نفسها: **سؤالٌ واحد، مصدرٌ واحد.**

### العطب الثاني: سجلٌّ يجزم بما لم يقع

`generateDatabase` تكتب **مونغو دائماً**: `api/db.js` يستورد mongoose،
و`.env.example` يضع `MONGODB_URI`، والمخطط من `MONGODB_SCHEMAS`. ومع ذلك
كان `dbType` يحمل ناتج `selectDatabase`، فيُطبع في سجلّ المستخدم الحيّ:

```
✅ postgresql — 4 ملف (api/db.js, api/schema.js, api/seed.js, .env.example)
```

أربعةُ ملفاتٍ مونغويّةٍ تحت عنوان postgresql. فصار `dbType` يصف **المكتوب**،
و`recommended` تُذكر توصيةً — ومنفّذُها PostgresAgent بعد هذه المرحلة
بأسطر، **بالشرط نفسه** بعد التوحيد أعلاه، فلا تَعِد بما لا يقع.

### وثالثةٌ صغيرة

`selectDatabase` كانت مستورَدةً في `jcr.js:31` **ولا تُستدعى فيه قطّ** —
وهي الثغرةُ التي سبق أن سُجّلت: حارسُ الوصول يمسك الوحدات اليتيمة ولا
يمسك **الصادرات** غير المستعملة. أُزيل الاستيراد.

### الدليل

`tests/databaseAgent.test.mjs` صار **٨** (ثلاثةٌ سابقةٌ باقيةٌ كما هي،
وخمسةٌ جديدة). أُثبت سقوطها بخمس طفرات، كلٌّ منها أسقطت واحداً إلى ثلاثة:
عودةُ القائمة الثانية بـ`includes`، و`dbType = recommended`، وحذفُ ذكر
التوصية، وعودةُ الملخّص الثابت، وذكرُ التوصية دائماً. **1081/1081.**

### وخطأٌ فادحٌ وقعتُ فيه أثناء هذا الـSprint — يُقال كما وقع

كتبتُ `tests/databaseAgent.test.mjs` بـ`cat >` **دون أن أنظر هل الملفُّ
موجود** — وكان موجوداً، فيه ثلاثةُ اختباراتٍ سابقة، فمُحيت.

والأسوأُ أنّ **حسابي أخفى المحو**: قرأتُ «1076 ← 1079» فقلتُ «أُضيفت
ثلاثة»، والحقيقةُ أنّ ستّةً أُضيفت وثلاثةً أُبيدت. وهذه علّةُ هذا الـSprint
نفسِها مطبَّقةً عليّ: **عددٌ صحيحٌ يُقرأ دعوى لا يحملها.**

استُعيدت الثلاثةُ من `git show HEAD:` وشُغّلت ضدّ الكود الجديد فنجحت —
وهو دليلٌ زائد على أنّ التغيير لا يكسر العقد القائم — ثم ضُمّت الخمسةُ
إليها. والدرسُ مكتوبٌ لا مُضمَر: **لا `cat >` على مسارٍ لم يُقرأ أوّلاً.**

### وقراران للمالك — يُسجَّلان بنصّهما

1. **«أوقف طلب الإذن... وارجعه لاحقاً»**: كنتُ أستأذن في كل مرّةٍ تسقط
   فيها Vercel بالحصّة (#479 و#480 و#481). أُوقف الاستئذانُ **مؤقّتاً**
   بطلب المالك، على أن يعود. فالقاعدةُ لم تُلغَ، بل عُلّقت بإذنٍ صريح.
2. **«افصل Vercel عن فحوص الـPR»**: بوّابةُ الدمج صارت **ثلاثةَ عشرَ**
   فحصاً — خمسُ وظائف Actions وثمانيةُ محلّلات DeepSource — ولا تدخل
   Vercel فيها.

### وتصحيحٌ لقياسٍ كنتُ أُكرّره

`#481` دُمج و Vercel **حمراء**، بلا تجاوزٍ إداريّ ولا قوّة. و`rulesets`
فارغة. أي أنّ Vercel **لم تكن قطّ فحصاً مطلوباً** يمنع الدمج على GitHub —
كان المانعُ قاعدتي أنا: «لا أدمج إلا على تسعةٍ خضراء». فما كنتُ أسمّيه
«مانعاً» كان قراري، لا سياسةَ المستودع. يُقال كما هو.

**ولم تُغيَّر `frontend/vercel.json`**: الطريقُ المستودعيّ لإيقاف نشرات
المعاينة هو `git.deploymentEnabled`، وتوثيقُ Vercel محجوبٌ عن هذه الجلسة
بوكيل الشبكة، فلم أتحقّق من شكله. وكتابةُ تهيئةٍ غير متحقَّقٍ منها في ملفٍّ
يقرؤه بناءُ الإنتاج مخاطرةٌ على موقعٍ حيّ لا أملك إبطالها. الإيقافُ اليقينيّ
في لوحة Vercel (Settings ← Git ← تعطيل نشرات المعاينة للفروع)، وهي للمالك.

---

## Sprint 2w — «تراجع» يقول «⏪ استُرجعت النسخة» وهو لم يُرجع الملفَّ المعدَّل

### العطب — بأشدّ صوره

`fileManager.js` كان يجمع ملفات النسخة بسقفٍ **عدديّ**:

```js
const BACKUP_MAX_FILES = 80;
if (acc.length >= BACKUP_MAX_FILES) break;   // بترتيب readdir — أي أبجديّاً
```

فمشروعٌ فيه 98 ملفاً، اسمُ 95 منها `file*.txt`، وقع فيه `index.html` في
**الموضع 98 من 99**. فلم يدخل النسخةَ أصلاً. ثم جاء أمرُ «تراجع» — الذي
يصفه الكودُ نفسه بأنه «شبكةُ أمانٍ مكافئة لـVersion Restore عند المنافسين» —
فأعاد ثمانين ملفاً **ليس منها الملفُّ الذي عُدّل**، وأعلن:

```
⏪ استُرجعت النسخة snapshot_… (80 ملف)
```

قِيس ذلك بتشغيلٍ فعليّ: بعد «تراجع»، `index.html` ما زال يقرأ «جديد».
**نجاحٌ مُعلَنٌ فوق فعلٍ لم يقع** — وهي علّةُ هذه السلسلة كلّها، وقد بلغت
هنا أخطرَ مواضعها: آخرُ شبكةِ أمانٍ للمستخدم.

### وعلّتان أصغرُ في الطريق نفسه

- **الاسترجاعُ ينسخ ولا يحذف**: ملفٌّ أُنشئ بعد النسخة يبقى على القرص
  بينما يقرأ المستخدم «✅ استُرجعت النسخة». لا يُحذف — فالحذفُ التلقائيّ
  خطرٌ أكبر — لكنّه **يُسمّى** الآن في التقرير وفي سطر الشات.
- **`.env.example` لم يكن يُنسخ قطّ**: يكتبه `databaseAgent` في كل مشروع،
  وكان يسقط مع سائر الملفات المنقوطة. وليس فيه سرّ — السرُّ في `.env` وهو
  مستثنى، ويبقى مستثنى (وله اختبارٌ يحرسه).

### الإصلاح

السقفُ صار على **الحجم** — وهو ما كان يُراد حمايته أصلاً — لا على العدد
وحده: `400` ملفاً و`8MB` إجمالاً. وما يسقط رغم ذلك **يُعلَن ولا يُبتلع**:
`backupProject` تُعيد `saved` و`truncated` و`dropped`، و`restoreSnapshot`
تُعيد `notRestored`، وسطرُ «تراجع» في `jcr.js` يقولها للمستخدم بالاسم.

### نتائجُ سلبيّةٌ تُقال كما هي

- **ترتيبُ النسخ سليم**: ظننتُ أنّ `backupProject` قد تقع **بعد** التعديل
  فيصير «تراجع» بلا أثر. قِيس: `jcr.js:1959` قبل التعديل و`727` قبل البناء.
  الترتيبُ صحيح، والفرضيّةُ سقطت.
- **ثغرةُ `path.join` غير المحروسة في `readFile`/`writeFile`/`deleteFile`/
  `renameFile` وأخواتها ليست عطباً حيّاً**: من صادرات `fileManager` الأحد
  عشر، **ثلاثةٌ فقط** يبلغها الخادم (`backupProject`، `listSnapshots`،
  `restoreSnapshot`). السبعةُ الباقية لا يستدعيها أحد. فلا يُدّعى عطبٌ
  أمنيٌّ في كودٍ لا يصل إليه طلب — وإنما يُسجَّل أنّ **سبعَ صادراتٍ ميتة**
  في وحدةٍ حيّة، وهي الثغرةُ المعروفة: حارسُ الوصول يمسك الوحدات اليتيمة
  ولا يمسك الصادرات اليتيمة.
- **فرزُ حذف النسخ القديمة سليم**: `.sort()` نصّيٌّ على
  `snapshot_<13 رقماً>[_label]`، والطولُ ثابتٌ حتى عام 2286، فالفرزُ
  النصّيُّ يطابق العدديّ. لا تغيير.

### الدليل

`tests/fileManager.test.mjs` (٨) — أُثبت سقوطها **بستّ طفرات**: عودةُ
السقف إلى 80 (وهي تُسقط اختبارَين، لأنها العطبُ عينه)، وإخفاءُ
`notRestored`، ونقصٌ صامتٌ عند السقف، وإسقاطُ الكبير صامتاً، ونزعُ
`.env.example`، وإدخالُ كلّ الملفات المنقوطة ومنها `.env`.

وحارسُ الخريطة أمسك انحرافَي `jcr.js` (3216 ← 3220) و`fileManager.js`
(284 ← 318). **1089/1089.**

### وقبل الكتابة — الدرسُ المُطبَّق

فُحص وجودُ `tests/fileManager.test.mjs` **قبل** إنشائه، لأنّ Sprint 2v
سبق أن محا ملفَّ اختبارٍ قائماً بـ`cat >` بلا نظر. الدرسُ لا يُكتب فقط،
بل يُعمل به في الـSprint التالي مباشرة.

---

## Sprint 2x — كلُّ نشرةٍ على Render قد تمحو ذاكرة مشروعِ المستخدم

### العطب

أربعةُ مخازنَ دائمة تُرطَّب من Mongo بقاعدةٍ **منسوخةٍ حرفياً** في كلٍّ منها:

```js
if (!current || (value?.updatedAt || 0) > (current.updatedAt || 0)) …
```

«الأحدثُ يفوز» — وهي صحيحةٌ **بشرط أن يعني `updatedAt` آخرَ كتابةٍ حقيقيّة**.
وثلاثةٌ من الأربعة تُنشئ سجلاً **فارغاً** بطابع `Date.now()` عند أوّل قراءة:

| الوحدة | دالّةُ الإنشاء عند القراءة | الطابع |
|---|---|---|
| `projectMemory.js` | `getProjectMemory` | `Date.now()` |
| `stateMachine.js` | `getProjectState` | `Date.now()` |
| `userProfile.js` | `getUserProfile` | `Date.now()` |
| `modelLibrary.js` | — لا مسارَ إنشاءٍ فارغ | — |

والتسلسلُ الذي يقع **مع كل نشرةٍ على Render**: يُمحى ملفُّ الذاكرة، فتبدأ
فارغة؛ يصل طلبُ مستخدمٍ قبل جهوز Mongo، فيُنشأ سجلٌّ فارغٌ بطابع «الآن»؛
ثم تجهز Mongo فيُقارَن المحفوظُ (عمرُه ساعة) بالفارغ (عمرُه لحظة) — **فيخسر
المحفوظ**. ثم يكتب `saveToFile` الفارغَ فوقه في Mongo. فتذهب ألوانُ المشروع
وأقسامُه ونموذجُ مجاله بلا أثر.

قِيس بإعادة تشغيل المقارنة (سطر 99) حرفياً على القيمتين: **الفائزُ الفارغُ.**

### الإصلاح

السجلُّ الذي لم يُكتب لا يدّعي حداثة: `updatedAt: 0`. وكلُّ مُحدِّثٍ حقيقيّ
يرفعه إلى `Date.now()` — والصفرُ يعني «لم يُكتب» لا «كُتب سنة 1970».

ومُسلكان كانا يكتبان محتوىً حقيقياً ولا يرفعان الطابع، فيبدوان «لم يُكتبا»:
- `initFromClarifier` — يكتب الأقسام والميزات والألوان.
- `resetProjectState` — تصفيرٌ **مقصود** لا سجلٌّ لم يُكتب؛ ولولا رفعُه لما
  رُطِّب أبداً بعد إعادة تشغيل.

وصارت القاعدةُ نفسها في موضعٍ واحد: `shouldHydrate(stored, current)` في
`services/persistence.js`، تستعملها المخازنُ الأربعة. فتُختبر مرّةً بدل أن
تُقرأ أربعاً — كما صنع Sprint 2s بمطابقة الكلمات.

### نتائجُ سلبيّةٌ تُقال كما هي

- **`modelLibrary` سليمةٌ أصلاً**، ولسببٍ مكتوبٍ في الكود:
  `if (!norm.entities.length && !norm.roles.length) return null; // لا نحفظ فراغاً`.
  فالمبدأُ الصحيح كان معروفاً في المشروع، ومطبَّقاً في موضعٍ واحدٍ من أربعة.
- **حارسُ البناء العالق لا يُخدع بالصفر**: `isBuilding` تقرأ `updatedAt`
  زمناً، لكن **بعد** شرط «الحالة نشطة»؛ والسجلُّ الجديد `IDLE`. رُتِّب
  اختبارٌ يحرس هذا الترتيب تحديداً.
- **`updatedAt` لا يُعرض للواجهة**: فحص `server.js` و`frontend/src` — لا
  استعمال. فتغييرُ الصفر لا يُظهر «1970» لأحد.
- **مسحي أنا أخطأ ثلاث مرّات**: عدّ `buildMemoryContext` و`buildProfileContext`
  و`setStateEmitter` «تغيّر ولا ترفع الطابع» — والثلاثةُ للقراءة فقط
  (النمطُ التقط `parts.push(...)` على مصفوفةٍ محلّية). فُحصت واحدةً واحدة
  ولم تُدَّعَ عطباً. المسحُ يدلّ، ولا يحكم.

### الدليل

`tests/hydration.test.mjs` (٥) — أُثبت سقوطها **بخمس طفرات**: عودةُ طابع
«الآن» للفارغ في كلٍّ من المخازن الثلاثة، وترطيبٌ دائمٌ يمحو تعديل الجلسة،
والتساوي يُبدّل. والتسعةُ القائمة في `stateMachine.test.mjs` بقيت خضراء بلا
تعديلِ حرف — دليلٌ زائدٌ على أنّ التغيير لا يمسّ السلوك القائم.

**1094/1094.**

---

## Sprint 2y — صورةُ الفندق تنزل على أوّل غرفة، وثِنتان تُدفَعان ثم تُرمَيان

### العطب

`applyAiImages` تجمع أهدافها من الكائنات المتداخلة أيضاً (غرفٌ داخل فندق،
أطباقٌ داخل قسم) — ثم تستبدل بـ:

```js
const span = spans[job.itemIndex];        // نطاقُ **العنصر الأب**
const re = imgValueRe(job.oldImg);        // أوّلُ `img` قيمتُه مطابقة
lit = ... seg.replace(re, ...) ...        // ثم يُعدَّل lit والنطاقاتُ محسوبةٌ سلفاً
```

وفي هذا ثلاثُ علل مجتمعة:

1. **الهدفُ يُحدَّد بنطاق أبيه**: أوّلُ `img` داخل الفندق هو حقلُ الغرفة
   الأولى لا حقلُ الفندق — فتنزل صورةُ الفندق على «غرفة عادية».
2. **النطاقاتُ تَبلى**: `spans` تُحسب مرّةً ثم يُعدَّل `lit` داخل الحلقة،
   فبعد أوّل استبدالٍ في العنصر يصير `span[1]` قصيراً فتسقط بقيةُ أهدافه.
3. **وقد دُفع ثمنُ الساقط**: نداءُ التوليد يقع لكل هدف قبل الاستبدال.

قِيس على فندقٍ بغرفتين — **ثلاثُ صورٍ وُلّدت** («فندق النخيل»، «غرفة
عادية»، «جناح ملكي»)، **واحدةٌ طُبّقت**، وهي صورةُ الفندق على أوّل غرفة:

```
{ id: 1, name: 'فندق النخيل', rooms: [ { name: 'غرفة عادية', img: 'images/ai-1-S.png' },
                                        { name: 'جناح ملكي', img: '' } ], img: '' }
```

### الإصلاح

- `targetSpan` يُعطي كلَّ هدفٍ **نطاقه هو**: العنصرُ نفسه، أو الكائنُ
  المتداخل بعينه (يُبلغ إليه بمفتاح المصفوفة وموضعه فيها).
- `blankNested` يُفرّغ الكائنات المتداخلة **مع حفظ الإزاحات**، فيُبحث عن
  حقول الكائن نفسه لا حقول أبنائه.
- تُحسب المواضعُ كلُّها أوّلاً ثم تُطبَّق **تنازلياً بالإزاحة المطلقة**،
  فلا يُفسد سابقٌ إزاحةَ لاحق.

بعده: ثلاثُ صورٍ وُلّدت، **ثلاثٌ طُبّقت**، كلٌّ على صاحبها.

### وعطبٌ صنعتُه أنا في أثناء الإصلاح — يُقال

بنيتُ `targetSpan` صحيحةً وأثبتُّها بالتشغيل المنفصل، ثم **نسيتُ حمل
`sub` إلى `generated`** — فعاد كلُّ هدفٍ إلى نطاق أبيه، وتراكبت التعديلات،
ورفض حارسُ البنية النتيجة. ولولا **حارسُ البنية القائم** لخرج ملفٌّ تالف.
فالحارسُ الذي بُني في Sprintٍ سابق أمسك خطأً في Sprintٍ لاحق — وهذا
تحديداً ما تُبنى الحُرّاس له.

### الدليل

`tests/aiImagesPlacement.test.mjs` (٥) — أُثبت سقوطها **بأربع طفرات**:
إسقاطُ `sub` (عطبي أنا)، ونطاقُ الأب لكل هدف (العطبُ الأصليّ)، وتركُ
التفريغ، والتطبيقُ تصاعديّاً (وهذه تُسقط سبعةً من ثمانيةٍ وعشرين — أي
تكسر اختباراتِ الصور القائمة أيضاً). والاختباراتُ القائمة في
`aiImagesLogo` و`imageForge` بقيت خضراء بلا تعديل.

**1099/1099.**

### ورصدٌ مُعلَّقٌ للـSprint التالي — تذبذبٌ حقيقيٌّ في السويت

`tests/siteChecker.test.mjs` يسقط أحياناً بـ:

```
not ok 111 - tests/siteChecker.test.mjs
  error: 'Unable to deserialize cloned data due to invalid or unsupported version.'
  code: 'ERR_TEST_FAILURE'
```

وهذا خطأُ قناةِ IPC في مُشغّل اختبارات Node لا دعوى اختبارٍ سقطت.
وقِيس أنّه **سابقٌ لهذا الـSprint**: أُزيلت تغييراتي كلُّها وأُعيد
الاختبارُ على شجرةٍ نظيفةٍ عند main المدموج، فسقط في الجولة السادسة من ست.
فهو ليس «تذبذباً» يُتجاوز بل عطبٌ يُشخَّص — ويُعالَج في Sprintٍ خاصّ به،
لا يُخلط بهذا.

---

## Sprint 2z — تذبذبُ السويت: سببٌ مُرجَّحٌ بقرينةٍ قويّة، لا مُثبَت بعد

### ما قِيس يقيناً

`tests/*.test.mjs` تسقط أحياناً بـ:

```
not ok NN - tests/<ملف>.test.mjs
  failureType: 'uncaughtException'
  error: 'Unable to deserialize cloned data due to invalid or unsupported version.'
  code: 'ERR_TEST_FAILURE'
  stack: #processRawBuffer (node:internal/test_runner/runner:354)
         FileTest.parseMessage (node:internal/test_runner/runner:290)
```

- **ليست دعوى اختبارٍ سقطت**: المكدّسُ في `parseMessage` داخل مُشغّل Node —
  العمليةُ الأمّ عجزت عن فكّ ما أرسله الابن.
- **سابقةٌ لكلّ عملي**: أُزيلت تغييراتي وأُعيد الاختبارُ على شجرةٍ نظيفةٍ عند
  main المدموج، فسقط في الجولة السادسة من ست.
- **ليست في الملفّ منفرداً**: `siteChecker` وحده ٠ من ٢٠. في التزاحم وحده.
- **ليست ضائقةَ موارد**: ١٦ج ذاكرةً و١٥ متاحة، ٤ أنوية.
- **أثرُها على البوّابة صفر**: ٦٠ تشغيلاً متتالياً في Actions بلا إخفاق واحد.

### القرينة — والحدُّ الذي تقف عنده

مُشغّلُ اختبارات Node يُرسل نتائج كل ملفٍ **مُسلسَلةً على المخرَج القياسيّ**.
و`PluginOrchestrator.init()` يطبع بياناً على تلك القناة. والملتقَط عند السقوط:

```
# 🔌 [Plugins]: حُمّلت 1 إضافة        ← السطرُ المطبوع
not ok 1 - tests/adminAgentGrounding.test.mjs   ← ثم السقوط مباشرةً
```

و**الملفّان الوحيدان اللذان سقطا بهذا الخطأ هما الوحيدان اللذان يستدعيان
`init()`**: `siteChecker` و`adminAgentGrounding`. اثنان من اثنين.

**لكنّ هذه قرينةٌ لا إثبات.** المخرَجُ في التشغيل المتزاحم مُشتبك، فالسطرُ
الظاهرُ قبل السقوط قد يكون من ابنٍ آخر. ولا يُثبت السببَ إلا قياسُ ما بعد
الإصلاح.

### الإصلاح المقترح

يُحجب البيانُ عن مُشغّل الاختبارات وحده (`NODE_TEST_CONTEXT` يضبطه Node في
أبناء الاختبار حصراً). **لم يُخطَّ اختبار، ولم يُعطَّل، ولم يُخفَ شيءٌ في
الإنتاج** — قِيس: البيان يظهر خارج المُشغّل (١) ويُحجب داخله (٠).

### وخطأُ قياسٍ ثالثٌ وقعتُ فيه — يُقال

أعلنتُ أوّلاً «الإصلاح لم ينجح: ٥ من ٥ سقطت». وكان الساقطُ **حارسَ الخريطة
عندي**: أضفتُ أسطراً إلى `PluginOrchestrator.js` ولم أُحدّث عددها. وحلقةُ
تحقّقي كانت تعدّ **أيَّ** سقوط، فعدّت انحرافي عطباً في الكود.

وهي العلّةُ التي تطاردها هذه السلسلةُ كلُّها، مطبَّقةً عليّ **للمرّة الثالثة**:
«1076 ← 1079» قُرئت «أُضيفت ثلاثة» وقد مُحيت ثلاثة؛ ومسحي عدّ ثلاثَ دوالِّ
قراءةٍ «تغيّر الحالة»؛ والآن «٥ من ٥» وليس فيها سقوطٌ واحد من النوع المقصود.
**عددٌ صحيحٌ يُقرأ دعوى لا يحملها.** فصارت الحلقةُ تفصل نصَّ الخطأ بعينه.

### النتيجة — وقد عادت

| الحال | التزاحم | عطبُ القناة |
|---|---|---|
| قبل الإصلاح، شجرةٌ نظيفة عند main | ٤ (الافتراضيّ) | **١ من ٦** |
| قبل الإصلاح | ٨ | **١ من ٦** (سقط في السادسة) |
| **بعد الإصلاح** | ٨ | **٠ من ١٦** — ولا سقوطَ من أيّ نوعٍ آخر |

**فالدعوى ثبتت.** ولو بقي المعدّلُ على حاله (١/٦) لكان احتمالُ ستَّ عشرةَ
جولةً نظيفةً متتاليةً `(5/6)^16 ≈ 0.05` — أي واحداً من عشرين. ليس يقيناً
رياضياً، وهو أقوى ما يُنتزع من عطبٍ احتماليّ بهذا العدد من الجولات، ويُقال
بحدّه لا فوقه.

### الحالة

رُفعت المسودّة بعد كتابة هذه الأرقام، لا قبلها. وبوّابةُ الـPR كانت خضراء
قبل ذلك (٧ Actions + ٨ DeepSource بدرجة A) — **وتلك شهادةُ سلامةٍ لا شهادةُ
صحّةِ سبب**، والخلطُ بينهما هو العطبُ الذي تطارده هذه السلسلة نفسها.

---

## Sprint 3a — حارسُ القناة: المخرَجُ القياسيّ في الاختبار ليس شاشةً بل قناةَ بيانات

الـSprint السابق (#486) شخّص تذبذباً وأصلحه. وبقي عندي دَينٌ مُعلَن: **حارسٌ
يمنع عودتَه**. هذا هو.

### العطبُ الذي يحرسه

مُشغّلُ اختبارات Node يُشغّل كلَّ ملفِ اختبارٍ في عمليةٍ ابنة، ويُرسل نتائجَه
إلى الأمّ **مُسلسَلةً بترميز V8 على المخرَج القياسيّ**. فالمخرَجُ هناك ليس
شاشةً يقرؤها إنسان، بل قناةَ بيانات ثنائية. وأيُّ كتابةٍ أخرى عليها تُقحِم
بايتاتٍ وسط الدفق، فيسقط فكُّ التسلسل بخطأٍ **لا يذكر سببَه ولا الوحدةَ التي
طبعت**:

```
ERR_TEST_FAILURE: Unable to deserialize cloned data due to invalid or unsupported version.
```

وهذه العلّة لا تظهر إلا في التزاحم، فتُقرأ «تذبذباً» — وكلفةُ تشخيصها في
#486 كانت ساعة. الحارسُ يجعلها تسقط **حتماً، بالاسم، وبالبايتات المطبوعة**.

### ما كُشف أثناء بنائه — موضعٌ ثانٍ كان كامناً

قياسُ شكلِ المخرَج قبل كتابة الحارس أظهر سطراً لم يكن معلوماً:

```
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
```

`dotenv@17` يطبع لافتةً ترويجية على المخرَج القياسيّ عند **كل** تحميل. وهو
مُحمَّلٌ في موضعين (`agents/baseAgent.js`، `utils/aiProvider.js`) يستوردهما
معظمُ الاختبارات. أي أنّ القناة كانت مُلوَّثةً بمصدرٍ ثانٍ، مستقلٍّ عن #486،
لم يُوقِع سقوطاً بعد. أُسكِت بالخيار الذي تقترحه المكتبةُ نفسها في نصّ
لافتتها: `dotenv.config({ quiet: true })`.

**لولا أنّ الحارس قِيس قبل أن يُكتَب لما ظهر.**

### الحارس — ثلاثةُ اختبارات

`tests/helpers/stdoutProbe.mjs` مِجَسٌّ يُشغَّل ابناً، عقدُه أن يكتب **صفرَ
بايت** على المخرَج القياسيّ. يستنبط قائمةَ الوحدات **من الاختبارات نفسها**
لا من قائمةٍ مكتوبةٍ بيد، فتشمل الحراسةُ كلَّ وحدةٍ تُضاف غداً بلا أن يتذكّرها
أحد (١٥٧ وحدةً اليوم). ثم يسلك مسارَ التشغيل الذي طبع في #486
(`orchestrator.init()`). تقريرُه يذهب إلى **مَخرَج الأخطاء** عمداً — القناةُ
المحروسة تبقى صامتة.

و`tests/stdoutChannel.test.mjs`:

1. **المِجَسّ يغطّي سطحاً حقيقياً لا فراغاً** — حارسٌ يمسح صفراً ينجح دائماً،
   وهو أسوأ من لا حارس لأنّه يمنح طمأنينةً لا يقابلها قياس.
2. **لا وحدةٌ تستوردها الاختبارات تكتب على المخرَج القياسيّ** — العقدُ نفسه،
   تحت `NODE_TEST_CONTEXT` المُحاكى كي يُقاس ما يقع فعلاً لا حالةٌ أهدأ منه.
3. **كلُّ تحميلٍ لـdotenv في المستودع صامتٌ** — حارسٌ ساكن يمسك الصنفَ كلَّه،
   أيّ موضعِ تحميلٍ في المونوريبو حتى في وحدةٍ لا اختبارَ لها بعد.

### برهانُ الطفرات — أربعٌ، كلُّها أُعيدت

| الطفرة | المُلتقِط | الدليل |
|---|---|---|
| إرجاع `dotenv.config()` الصاخبة | ٢ و٣ معاً | ٧٣ بايتاً على القناة |
| نزعُ حارس `NODE_TEST_CONTEXT` — **عطبُ #486 حرفياً** | ٢ | `"🔌 [Plugins]: حُمّلت 1 إضافة\n"` بنصّها في رسالة السقوط |
| المِجَسّ يرى ٥ وحداتٍ فقط | ١ | «سطحُ المِجَسّ انهار إلى 5 وحدة» |
| استيرادٌ جزئيّ (١٠ ثم توقّف) | ٢ | عددُ التغطية لا يطابق |

الطفرةُ الثالثة درسٌ في ذاتها: تحتها **نجح** الاختبارُ الثاني وهو يغطّي خمسَ
وحدات. الصمتُ كان صادقاً والتغطيةُ جوفاء. ولهذا لا يكفي الاختبارُ الثاني وحده.

### عطبٌ في المِجَسّ صنعتُه ثم أمسكتُه

أوّلُ نسخةٍ كانت تُبلغ عن `mods.length` — أي **طولَ القائمة التي نوى
استيرادها**، لا ما استورده. فلو توقّف في منتصف الطريق لأبلغ تغطيةً كاملة.
وهذه بعينها العلّةُ التي تطاردها السلسلة: **نظامٌ يؤكّد يقيناً لا يملكه.**
صُحّح إلى عدّادٍ يزيد عند كل استيرادٍ فعليّ — والطفرةُ الرابعة تُثبت الفرق.

### أخطاءُ قياسٍ وقعتُ فيها — تُقال

**١. النمطُ سحب نصّاً حرفياً من تجهيزةِ اختبار.** التقط `models/Order.js`
وهو مكتوبٌ داخل نصٍّ في `dependencyAgent.test.mjs` لا استيراداً. صُفّي
بوجود الملف على القرص. «المسحُ يدلّ ولا يحكم» — رابعُ مرّة.

**٢. رسالةُ الحارس حملت النمطَ الذي يبحث عنه**، فبلّغ عن ملفّ نفسه. صِيغت
الرسالةُ بلفظٍ آخر.

**٣. `execFileSync` يُعيد المخرَجَ القياسيّ لا الأخطاء.** طلبتُ منه تقريرَ
المِجَسّ وقد أطفأتُ القناةَ التي يُعيدها، فعاد `null`. وُحِّد النداءان في
`spawnSync` واحد.

**٤. `git checkout --` على ملفٍّ إصلاحُه غيرُ مُودَع أتلف الإصلاح.** أردتُ
إلغاءَ طفرةٍ في `agents/baseAgent.js` فأعدتُ الملفَّ إلى آخر إيداع — وفيه
`dotenv.config()` الصاخبة الأصلية. عاد العطبُ الذي أصلحتُه قبل ساعة، صامتاً.
وهو أخو خطأِ `cat >` على مسارٍ لم يُقرأ: **أداةٌ تُلغي «تغييري الأخير» في
ذهني وتُلغي «كلَّ تغييرٍ غير مُودَع» في الواقع.** القاعدة: طفراتُ ملفٍّ غيرِ
مُودَعٍ تُلغى بنسخةٍ احتياطية مأخوذةٍ قبلها، لا بـ`git checkout`.

**٥. طفرةٌ لم تُطبَّق تُنتج خضرةً تُشبه البرهان.** أوّلُ محاولةٍ للطفرة الثالثة
سقطت في تهريب `sed` بصمت، فطبعت الحلقةُ «٣ ok» — وهي لا تقيس شيئاً. أمسكها
مؤشّرُ `[فشل تطبيق الطفرة]` الذي كان في الحلقة. **فليكن في كل حلقةِ طفراتٍ
تأكيدٌ أنّ الطفرة وقعت، وإلا صار غيابُ الأثر دليلَ سلامة.**

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١٠٩٩ | **١١٠٢** (١١٠٢ ناجحة، ٠ ساقطة) |
| مواضعُ كتابةٍ على القناة أثناء الاختبار | ٢ (أحدهما كان يُسقط) | **٠** |
| وحداتٌ تحت الحراسة | — | **١٥٧** |

`agents/baseAgent.js` ١٤٧ ← ١٥١، `utils/aiProvider.js` ٣٨ ← ٤٢ (الخريطة
حُدّثت في ثلاثة مواضع).

---

## Sprint 3b — كلُّ اسمِ قسمٍ عربيّ ينهار إلى `SectionN`، وموقعُ المستخدم يخرج بمسارات عمياء

### العطب

`compName` في `agents/reactGenerator.js` يشتقّ اسمَ المكوّن هكذا:

```js
const latin = key.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(cap).join('');
return latin && /^[A-Za-z]/.test(latin) ? latin : `Section${i + 1}`;
```

الحرفُ العربيّ ليس في `[a-z0-9]`، فيُمحى كلُّ الاسم ولا يبقى منه شيء — ويقع
الاشتقاقُ على الملاذ الأخير: رقمُ القسم. وجولا **عربيّةٌ أوّلاً**.

### القياس — قبل

| المدخل | المكوّن | المسار |
|---|---|---|
| «من نحن» | `Section4` | `/section4` |
| «اتصل بنا» | `Section4` | `/section4` |
| «خدماتنا» | `Section4` | `/section4` |
| «سياسة الخصوصية» | `Section4` | `/section4` |
| `About Us` | `AboutUs` | `/about-us` |

**كلُّ** اسمٍ عربيّ يعطي القيمة نفسها. وعلى مستوى الموقع كلّه:

```
موقعٌ عربيّ:    /navbar /hero /section3 /section4 /section5 /section6 /section7 /section8 /footer
نظيرُه الإنجليزيّ: /navbar /hero /home   /about    /services /gallery  /testimonials /contact /footer
```

ويُقال للمستخدم في المحادثة حرفياً: «✅ أضفت صفحة **من نحن** (`section4.html`)».

### وحارسٌ كان يُثبِّت العطبَ عقداً

في `tests/reactGenerator.test.mjs` اختبارٌ عنوانه «compName: الخريطة، ثمّ
اللاتيني، **ثمّ رقمُ القسم للعربي**» يؤكّد `compName('من نحن', 2) === 'Section3'`.
لم يكن يصف عقداً يخدم أحداً، بل يصف التنفيذ كما هو. **حارسٌ يُثبّت العطبَ
أخطرُ من غياب الحارس**: يجعل إصلاحَه يبدو كسراً.

### الإصلاح

قاموسُ أقسامٍ عربيّ (٤٥ مدخلاً) يترجم الاسم إلى كلمته الإنجليزية المتعارفة،
ثمّ يُمرَّر الناتج على خطّ الاشتقاق القائم بلا تغيير — فالمكسبُ بلا مسارٍ ثانٍ.
المطابقةُ **على الاسم كاملاً** بعد التطبيع، لا على جزءٍ منه: المطابقةُ داخل
الكلمات هي العلّةُ التي عولجت سبع مرّات في هذا المستودع. ومحاولةٌ واحدةٌ بعد
نزع «ال» من أوّل كلمة، وإخفاقُها غيرُ ضارّ لأنّه يسقط إلى النقحرة.

وما لا يعرفه القاموسُ **يُنقحَر** لا يُرقَّم. والفرقُ ليس تجميلاً:

> `SectionN` يجعل المسارَ دالّةَ **الموضع** — فالصفحةُ نفسها تأخذ رابطاً
> مختلفاً باختلاف ترتيبها في المخطّط. والنقحرةُ تجعله دالّةَ **الاسم**، فهو
> ثابتٌ ومُشارَكٌ وقابلٌ للأرشفة.

والنقحرةُ تقريبيّةٌ ويُقال ذلك: «عروض رمضان» → `/arwd-rmdan` (العربيةُ لا تكتب
الحركات القصيرة). والرقمُ يبقى ملاذاً أخيراً لِما لا حرفَ فيه أصلاً.

### القياس — بعد

```
موقعٌ عربيّ:    /navbar /hero /home /about /services /works /testimonials /contact /footer
نظيرُه الإنجليزيّ: مطابقٌ حرفاً بحرف
```

### انحدارٌ خطيرٌ صنعتُه ثمّ أمسكتُه — يُقال

في `jcr.js` حلقةُ تفرّدٍ للمكوّن الجديد:

```js
let n = existingComps.size + 1;
let comp = compName(pageLabel, n);
while (existingComps.has(comp)) comp = compName(pageLabel, ++n);   // ⛔
```

شرطُ انتهائها أنّ `compName` يعطي قيمةً مختلفة كلّما تغيّر `n` — وهو صحيحٌ
فقط ما دام الاسمُ مشتقّاً من **الموضع**. ولمّا صار مشتقّاً من **المعنى**
ثبتت القيمةُ فصارت الحلقةُ **لا تنتهي**: مستخدمٌ يضيف صفحةً باسمٍ يُنتج
مكوّناً موجوداً ⇒ **الخادمُ يتجمّد**.

قِيس يقيناً: ألفُ دورةٍ والقيمةُ `About` ثابتة. والإصلاح لاحقةٌ رقمية على
أساسٍ محسوبٍ مرّة (`About` → `About2` → `About3`).

وهذا هو الدرسُ الأعمق في هذا الـSprint: **تحسينُ دالّةٍ كسر عقداً ضمنياً لم
يكن مكتوباً في أيّ مكان** — أنّ `compName` تابعةٌ لمعاملها الثاني. لا اختبارَ
كان يحرسه، لأنّ المسار كلَّه (`_addPageNow`) كان بلا تغطية.

### الاختبارات — ٧ جديدة، والمسارُ الأعمى غُطّي

`tests/reactGenerator.test.mjs` (١٣ ← ٢٠): القاموس العربي، **تطابقُ الموقع
العربيّ والإنجليزيّ حرفاً بحرف**، النقحرةُ واستقلالُها عن الموضع، والرقمُ
ملاذاً أخيراً. وصُحّح الاختبارُ الذي كان يُثبّت العطب.

`tests/jcrAddPage.test.mjs` (جديد، ٣): مشروع Next حقيقيّ على القرص، و`_addPageNow`
يُنادى فعلاً — الصفحةُ العربية تُكتب في `components/About.jsx` و`app/about/`،
والوجهةُ `{ label: 'من نحن', href: '/about' }`، وإضافةُ صفحةٍ باسمٍ موجود **تنتهي**.

### برهانُ الطفرات — ثلاثٌ، كلُّها أُعيدت

| الطفرة | المُلتقِط | الدليل |
|---|---|---|
| نزعُ القاموس العربي (العطبُ الأصلي) | ٦ اختبارات | عودةُ `/section4` |
| إعادةُ حلقة الاشتقاق في `jcr.js` | `jcrAddPage` | **الاختبارُ يتجمّد** — أُنهي بـSIGTERM بعد ٤٥ ثانية، وهو عرضُ الإنتاج بعينه |
| نزعُ النقحرة | «اسمٌ عربيّ خارج القاموس يُنقحَر» | `Section1` بدل اسمٍ يُقرأ |

### أخطاءُ قياسٍ وقعتُ فيها — تُقال

**١. تصادُمُ اسمٍ أدخلتُه** (`let comp = base, k = 1` و`k` مُعلَنٌ بعد سطرين)
أسقط تحميلَ `jcr.js` كلِّه بـ`SyntaxError`. أمسكه أوّلُ تشغيلٍ للاختبار
الجديد — ولو لم أكتب اختباراً للمسار لَما ظهر إلا في السويت الكاملة.

**٢. فلتَرُ بحثٍ أسقط الاختبارَ المقصود.** رشّحتُ نتائجَ الطفرة الثالثة بـ`نقحر`
وعنوانُ الاختبار «يُنقحَر» بحركةٍ بين الحاء والراء، فلم يطابق — وكادت الطفرةُ
تُقرأ «لم تُلتقَط». أُعيدت بلا ترشيح. وهي أخت درسِ الـSprint السابق: **غيابُ
الأثر في مِرشَحٍ ليس غيابَ الأثر.**

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٠٢ | **١١٠٩** (١١٠٩ ناجحة، ٠ ساقطة) |
| أسماءُ أقسامٍ عربية تنهار إلى رقم | كلُّها | **٠** من الشائعة، ونقحرةٌ لِما عداها |
| تغطيةُ `_addPageNow` | ٠ | ٣ اختبارات على مشروعٍ حقيقيّ |

`agents/reactGenerator.js` ٣٦٧ ← ٤٣٢، `agents/jcr.js` ٣٢٢٠ ← ٣٢٢٣.

---

## Sprint 3c — خريطةُ الموقع تُعلن صفحةً واحدة مهما بلغ عددُ صفحاته، ودرجةٌ لا تقيس شيئاً

### كيف وُصل إليه — وثلاثُ نتائجَ سلبيّة تُقال أوّلاً

الثغرةُ المسجَّلة كانت: «حارسُ الوصول يمسك الوحداتِ اليتيمة لا **الصادراتِ**
غير المستعملة». فمُسحت الصادرات: **٧٣** صادراً لا يذكره ملفٌّ آخر. ثمّ:

**١. سبعُ وحداتٍ منها ميتةٌ بأسرها — و`tests/moduleReachability.test.mjs`
يُقرّها بالاسم أصلاً.** ظننتُها اكتشافاً فلم تكن؛ الحارسُ أشملُ ممّا حسبت.
بعد طرحها: ٥٥ صادراً في ٣١ وحدةً حيّة.

**٢. صادراتُ `seoAgent` الأربع (`generateRobotsTxt`, `generateSitemap`,
`generateMetaTags`, `injectMetaTags`) تناديها `runSEO` داخلياً** — مساعِداتٌ
صُدّرت بلا داعٍ، لا ميزةٌ بُنيت ولم تُوصَل. لا عطبَ هناك.

**٣. `_stageSEO` يكتب `newFiles` على القرص فعلاً** — فـrobots.txt وsitemap.xml
يصلان المشروع. لا عطبَ هناك أيضاً.

لكنّ قراءةَ المسار للتحقّق من (٢) و(٣) كشفت عطبَين حقيقيَّين.

### العطب الأوّل — خريطةُ موقعٍ برابطٍ واحد

```js
export function generateSitemap(siteUrl, pages = ['']) { … }
// وفي runSEO:
content: generateSitemap(url)        // ⛔ بلا صفحات
```

فتبقى `pages` على قيمتها الافتراضية ويخرج الملفُّ برابطٍ واحد: الجذر. وموقعٌ
من ثماني صفحات يُنشَر وخريطتُه تُعلن صفحةً واحدة — و`robots.txt` يشير إليها
بـ`Sitemap:`. فلا تعرف محرّكاتُ البحث ببقيّة الصفحات من هذا الطريق.

والمفارقةُ أنّ هذا يقع مباشرةً بعد Sprint 3b الذي جعل تلك الصفحاتِ تأخذ
مساراتٍ ذاتَ معنى (`/about` بدل `/section4`): مساراتٌ حسنةٌ لا يعلنها أحد.

**الإصلاح**: `sitePages(files)` تشتقّ الصفحات من الملفات المسلَّمة — الرئيسيةُ
جذرٌ (`''`)، وما عداها باسم ملفّه، وما ليس `.html` لا يدخل. وإن لم يكن ثمّة
HTML بقي الجذرُ وحده (لا خريطةٌ فارغة).

### العطب الثاني — درجةٌ ثابتةٌ بين درجتين مقيستين

```js
recordScore(username, project, 'quality',  reviewResult);          // مُشتقّة
recordScore(username, project, 'security', secResult);             // مُشتقّة
recordScore(username, project, 'seo', { grade: 'A', score: 100 }); // ⛔ ثابت
```

`runSEO` تعيد `success: true` دائماً، فالشرطُ فوقها لا يمنع شيئاً: **كلُّ
مشروعٍ يأخذ SEO درجةَ A و١٠٠ من ١٠٠، أيّاً كان ما جرى.** وتُعرَض في لوحة
المستخدم بجوار درجتين تُشتقّان من نتائجهما فعلاً — فلا يميّز المقياسَ من
الثابت. وكانت الخريطةُ حتى الآن ترسم صفحةً واحدة والدرجةُ تقول «مئة».

**الإصلاح**: `runSEO` تشتقّ `grade`/`score` من واقعتين مقيستين — أدُخلت
الوسومُ في صفحةٍ فعلية؟ وكم صفحةً في الخريطة؟ — والمستدعي يمرّر النتيجة كما
يمرّر أختيها. **ويُقال حدُّها**: درجةٌ خشنة، لا قياسَ جودةِ SEO؛ فضلُها أنّها
تقيس ما جرى بدل أن تدّعيه.

وثالثةٌ في السياق نفسه: الملخّصُ كان يقول `robots.txt + sitemap.xml + meta
tags` حتى حين لا `index.html` فلا وسومَ تُدخَل. صار يذكر ما طُبِّق وحده،
ويقول العددَ ويقول سببَ النقص.

### الاختبارات — ٨ جديدة، والوحدةُ كانت بلا تغطية

`tests/seoAgent.test.mjs`: الخريطةُ تُعلن كلَّ صفحةٍ سُلِّمت؛ ما ليس صفحةً لا
يدخلها؛ بلا صفحاتٍ تبقى على الجذر؛ موقعٌ بلا رئيسيةٍ لا يُخترَع له جذر؛
الدرجةُ مُشتقّة؛ الملخّصُ لا يذكر وسوماً لم تُدخَل؛ `robots.txt` يشير إلى
خريطةٍ كُتبت فعلاً.

### برهانُ الطفرات — اثنتان، كلتاهما أُعيدت

| الطفرة | المُلتقِط | الدليل |
|---|---|---|
| `generateSitemap(url)` بلا صفحات | اختباران | الخريطةُ تعود إلى رابطٍ واحد |
| إعادةُ `grade: 'A', score: 100` ثابتاً | «الدرجةُ مُشتقّة» | A على مشروعٍ بلا وسوم |

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٠٩ | **١١١٧** (ناجحة كلُّها) |
| روابطُ خريطةِ موقعٍ من ٤ صفحات | ١ | **٤** |
| درجاتُ المشروع المشتقّة من نتيجتها | ٢ من ٣ | **٣ من ٣** |
| تغطيةُ `agents/seoAgent.js` | ٠ | ٨ اختبارات |

`agents/seoAgent.js` ١٥٠ ← ١٧٨.

### وما بقي من المسح — يُقال ولا يُعمَل به الآن

بقيت **٥٥ صادراً** في وحداتٍ حيّة لا يذكرها ملفٌّ آخر. معظمها — كصادرات
`seoAgent` الأربع — مساعِداتٌ داخلية صُدّرت بلا داعٍ؛ إزالةُ كلمة `export`
عنها تنظيفٌ آمن. لكنّ حذفَ ٥٥ موضعاً في دفعةٍ واحدة يخالف «تدريجي ومُتحقَّقٌ
دوماً»، ولا يخدم مستخدماً. فالقياسُ مسجَّلٌ هنا خطَّ أساسٍ لسبرنتٍ لاحق، ولم
يُبنَ له حارسٌ بقائمةِ إقرارٍ من ٥٥ مدخلاً — قائمةٌ بهذا الطول تُقرأ ختماً
مطاطياً لا حراسة.

---

## Sprint 3d — تدقيقُ التغطية: ثلاثُ دعاوى كانت عندي وسقطت بالقياس

Sprint بلا كود. كلُّ ما فيه تصحيحُ ما كنتُ أقوله عن حالة المستودع.

### الدعوى الأولى — «اثنتا عشرة وحدةً حيّة بلا تغطية»

كنتُ أُعيد هذه القائمة في كل تقرير: `coderAgent`، `ceoBrain`، `deployAgent`،
`backendAgent`، `knowledgeEngine`، `adminService`، `testingAgent`،
`logLocalizer`، `pwaAgent`… **قِيست فإذا معظمُها مغطّى**. `ceoBrain` له
`ceoBrainIntent.test.mjs`، و`coderAgent` له `coderAgentPrompt.test.mjs`.
كانت القائمةُ صحيحةً يوم كُتبت، ثمّ نقلتُها بعد ذلك نقلاً لا قياساً.

### الدعوى الثانية — «تسعةٌ وعشرون قالباً بلا حراسة»

المقياسُ الأوّل («هل يستوردها اختبار؟») أعطى ٥٢ وحدة، منها ٢٢ قالبَ استنساخ.
وكنتُ على وشك أن أقول إنّ سطحَ حراسة القوالب قائمةٌ مكتوبةٌ بيد (١٣ من ٤٢).
والقراءةُ قبل الدعوى أرَت أنّ في `cloneTemplates.test.mjs` تدقيقَين شاملَين
يشتقّان قائمتَهما من **`listClones()`** — أي من السجلّ لا من يد. فالقوالبُ
الاثنان وأربعون محروسةٌ سلوكياً كلُّها (jsdom، بلا دوال معلّقة، تغطيةُ أدوار).

**والدرس في المقياس نفسه**: «لا يستوردها اختبار» ≠ «بلا تغطية». الوحداتُ
التي تُحمَّل عبر سجلٍّ تُغطّى من خلاله، فمقياسُ الاستيراد يقيس شيئاً آخر.

بعد الطرح: **٣٠** وحدةً حيّةً بلا تغطيةٍ فعلية، أكبرُها بفارقٍ هائل
`agents/templateLibraryExtended.js` (١٣٨٣ سطراً) — وهي وجهةُ الـSprint التالي.

### الدعوى الثالثة — إنذارٌ أمنيّ بنيتُه على فرضٍ لم أقِسه

`utils/auth.js` (٤١ سطراً، بلا تغطية، يستوردها `server.js` لخمسة مداخل منها
مصادقةُ الـsocket وحالةُ OAuth):

```js
export function getJwtSecret() {
    return process.env.JWT_SECRET || 'jaola-dev-secret-change-me';
}
```

ثابتٌ منشورٌ في مستودعٍ **عامّ** (تحقّقت: `visibility: public`). ورأيتُ أنّ
`runSystemDiagnostics` لا يُنادى إلا من مسارٍ إداريّ، وأنّ الإقلاع يطبع سطراً
واحداً. فبنيتُ الرواية: خادمٌ يقلع صامتاً ويوقّع كلَّ توكن بمفتاحٍ يقرؤه أيُّ
أحد.

**وهي كاذبة.** `server.js:160`:

```js
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET غير مضبوط في ملف .env — لا يمكن التشغيل بأمان.');
    process.exit(1);
}
```

فالاحتياطيُّ لا يُبلَغ أصلاً، والتعليقُ في `jaolaBotToken.js` («الخادم يرفض
التشغيل بدونه») صادقٌ حرفياً. وكنتُ على وشك أن أكتب فيه دعوى كذب.

**الخطأ في الترتيب**: بحثتُ عن `runSystemDiagnostics` و`listen(` و«جاهز» في
`server.js`، ولم أبحث فيه عن **`JWT_SECRET` نفسه** قبل أن أستنتج غيابَ الحارس.
ثمّ راكمتُ فوق الفرض قرائنَ (المستودع عامّ، الطبيب خلف مسار) فبدا الفرضُ
مُثبَتاً بها وهي لا تمسّه. **قرائنُ حول الفرض ليست قياساً للفرض.** وهذا رابعُ
خطأِ قياسٍ أُسجّله على نفسي في هذه السلسلة، وأشدُّها: الثلاثةُ السابقة أخطأت في
قراءة رقم؛ وهذا كاد يُنتج **اتّهاماً أمنياً باطلاً** لكودٍ سليم.

### ما عُمل

سطرُ الحالة في `ARCHITECTURE_MIGRATION.md` كان يقول «اختبارات الخادم **959**»
وقد تجاوزه الكودُ بمئةٍ ونصف. صار **1117** مؤرَّخاً، مع قاعدةٍ مكتوبة: لا رقمَ
في ذلك الملفّ إلا مؤرَّخاً، والقياسُ الحيّ في هذا الملفّ عند آخر Sprint.

وهي العلّةُ نفسها التي عولجت في Sprint 8/11 — خريطةٌ تصف حالةً تجاوزها الكود —
واقعةً هذه المرّة على الوثيقة التي تُعلن أنّها عالجتها.

### الخط الأساس

بلا تغيير: **1117** اختباراً. لا كودَ مسّه هذا الـSprint.

---

## Sprint 3e — تنفيذُ أوامرَ عن بُعد على الخادم من نصِّ هدفِ المستخدم

أخطرُ ما وجدته هذه السلسلة. مُثبَتٌ **بالتشغيل** لا بالقراءة.

### العطب

`agents/gitAgent.js` كان يبني سطرَ أمرٍ نصّياً ويُمرّره على `exec` — أي على
`/bin/sh`:

```js
const commitMsg = `${emoji} ${message || 'JAOLA OS auto-commit'} [${time}]`;
await runGit(`commit -m "${commitMsg}"`, projectPath);   // ⛔ exec → /bin/sh
```

و`message` يأتي من `jcr.js:_stageGitBackup`:

```js
await commitBuild(context.projectPath, context.originalGoal?.slice(0, 60) || …, 'build');
```

**`originalGoal` هو نصُّ المستخدم الحرّ** — ما يكتبه في المحادثة ليُبنى له
موقع. فداخل نصٍّ محصورٍ باقتباسٍ مزدوج تبقى فعّالةً: `"` و`` ` `` و`$(…)`
و`$VAR` و`\`. أيُّ مستخدمٍ مُصادَق يكتب هدفاً مثل:

```
موقع" $(…) "
```

يُنفَّذ أمرُه على خادم جولا بحساب الخدمة — حيث `JWT_SECRET` و`DATABASE_URL`
ومفاتيحُ المزوّدين في البيئة.

### الدليل — تشغيلٌ لا استنتاج

مستودعٌ مؤقّت، وحمولةٌ غيرُ ضارّة تكتب ملفاً شاهداً:

```
نتيجة commitBuild: {"success":false,"error":"Command failed: git commit -m \"🏗️ موقع\" $(touch …
⛔ نعم — الملفُّ PWNED أُنشئ. تنفيذُ أوامرَ عن بُعد مؤكَّد.
```

وبعد الإصلاح، الحمولةُ نفسها:

```
نجح الحفظ: true | hash: c07e6e2
الرسالة المحفوظة: "🏗️ موقع\" $(touch …) `touch …` \" [١٢:٠٩:٣١ ص]"
✅ لم يُنفَّذ شيء — النصُّ حُفظ رسالةً لا أمراً
```

### وانحدارٌ وظيفيّ كان قائماً معه

لاحِظ `success:false` في القياس الأوّل: الأمرُ **فشل**. أي أنّ أيّ هدفٍ فيه
اقتباسٌ مزدوج — «ابنِ موقعاً باسم "مطعم البحر"» — كان يكسر أمرَ `git commit`
فيسقط النسخُ الاحتياطيّ كلُّه. وصمتاً: المستدعي يلفّه في `try/catch` فارغ
تعليقُه «Git اختياري — لا يوقف البناء». فالمستخدمُ يظنّ مشروعَه محفوظاً وهو
ليس كذلك. عطبٌ أمنيٌّ وعطبُ فقدِ بياناتٍ في السطر نفسه.

### الإصلاح — إزالةُ الصدفة لا تهريبُ النصّ

التهريبُ يُنسى ويُخترَق. فـ`runGit` تأخذ الآن `string[]` وتُنادي
`execFileAsync('git', args, …)`: الوسائطُ تصل `git` مصفوفةً ولا مُفسِّرَ
بينهما يقرأ رموزاً. حُوِّلت **أربعة عشر** موضعَ نداء، ولم يبقَ في الملفّ
أمرٌ يُبنى بالدمج.

ومعها: `getCommitHistory(limit)` كان يدمج `-${limit}` — قُسِر عدداً صحيحاً
موجباً محدوداً (١..٢٠٠)، فوسيطٌ نصّيٌّ هناك يصير **خياراً** لـgit لا عدداً.

### نتائجُ سلبيّةٌ تُقال — حدودُ العطب

- **مسارُ `rollback` مُحصَّن أصلاً**: `server.js:2377` يتحقّق
  `/^[0-9a-f]{6,40}$/i` قبل النداء، فـ`checkout ${commitHash}` غيرُ المقتبَس
  لم يكن قابلاً للاستغلال من هناك. (وقد صار آمناً بالبنية الآن لا بالحارس
  البعيد وحده.)
- **`getCommitHistory` يُنادى بـ`20` حرفياً** في `server.js:2174` — لا مدخلَ
  مستخدم.
- **الصنفُ محصورٌ في هذا الملفّ**: مسحُ المستودع كلِّه لم يجد موضعاً ثانياً
  يبني أمرَ صدفةٍ بالدمج (`services/db.js` سطرُ SQLite في وحدةٍ يتيمةٍ مُقرّة).
- **تسريبُ التوكن مُعالَجٌ سلفاً**: رسالةُ خطأ الدفع تستبدل `authUrl` بالرابط
  النظيف، وما زالت تفعل.

### ما لم يُلمَس عمداً — يُقال للمالك

`pushToGitHub` تدفع بـ`--force` إلى مستودع المستخدم على GitHub، فتدهس تاريخه.
هذا سلوكُ المنتج القائم للمزامنة التلقائية، وتغييرُه قرارُ منتجٍ لا إصلاحُ
عطب. لم أوسّع الـPR به؛ يُذكر هنا ليُقرّر.

### الاختبارات — ٩ جديدة، والوحدةُ كانت بلا تغطية

`tests/gitAgent.test.mjs`: الحقنُ لا يُنفَّذ والنصُّ يُحفظ حرفياً؛ اقتباسٌ
عاديّ يُحفظ (الانحدار أعلاه)؛ لا دعوى حفظٍ لم يقع؛ السجلّ يُعرب حقولَه
والعددُ يُقسَر؛ الاسترجاع يُعيد المحتوى؛ تعديلٌ غيرُ محفوظ لا يضيع؛ الإحصاءات
تُميّز «لا مستودع»؛ التهيئة لا تُعيد الإنشاء. والتاسع **حارسُ الصنف**: لا
`exec` في الملفّ، والنداءُ بمصفوفة، وكلُّ موضعِ نداءٍ يمرّر مصفوفة.

### برهانُ الطفرة

إعادةُ `exec` النصّيّ تُسقط **ستّة** اختبارات، أوّلُها الحقن نفسه.

### وخطآ قياسٍ في اختباريَّ أنا — يُقالان

**١.** حارسُ الصنف كان يلتقط **تعريف** الدالّة (`function runGit(args, cwd)`)
ويحسبه نداءً لا يمرّر مصفوفة. صُحّح إلى `await runGit(` وأُضيف تأكيدٌ أنّ عددَ
المواضع الملتقَطة لم ينهَر — فنمطٌ يلتقط صفراً يمرّ صامتاً.

**٢.** أكّدتُ أنّ الاسترجاع يحفظ «قبل الاسترجاع» على شجرةٍ **نظيفة** — ولا شيءَ
فيها ليُحفظ، فالتخطّي صوابٌ لا نقص. كدتُ أقرأ سلوكاً صحيحاً عطباً. صُحّح
الاختبارُ إلى الحالة ذات المعنى: شجرةٌ فيها تعديلٌ غيرُ محفوظ — وهناك يقع
الحفظُ فعلاً.

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١١٧ | **١١٢٦** (ناجحة كلُّها) |
| مواضعُ تبني أمرَ صدفةٍ بالدمج | ١٤ | **٠** |
| تغطيةُ `agents/gitAgent.js` | ٠ | ٩ اختبارات |

`agents/gitAgent.js` ١٨٧ ← ١٩٧. وحكمُ الخريطة كان يقول «`git`، exec **محروس**»
— وهي دعوى لم تكن صحيحة؛ صار «`execFile` بمصفوفة وسائط — لا صدفة».

---

## Sprint 3f — درجةُ الاختبارات كانت تكافئ النقصان: كلُّ ملفٍّ تحذفه يرفع درجتك

### العطب

`calculateScore` يقسم على عدد الفحوص **المُنفَّذة**:

```js
const score = Math.max(0, Math.round((passed / total) * 100) - (warnings * 2));
```

و`runTests` كان يستبدل الملفَّ الغائب بسقوطٍ **واحد**:

```js
...(cssFile ? testCSS(cssFile.content || '') : [new TestResult('CSS','css').fail('styles.css مفقود')]),
```

فالملفُّ الغائب يُسهم بسقوطٍ واحد، ويحذف من المقام فحوصَه كلَّها (٣–٤)، ويحذف
معها تحذيراتِها (كلُّ تحذيرٍ −٢). **الغيابُ أرخصُ من النقص.**

### القياس — انقلابٌ مُطّرِد

| الحالة | الفحوص | الدرجة (قبل) |
|---|---|---|
| كامل (html+css+js) | ١٩ | ٨٣ |
| بلا `script.js` | ١٦ | **٨٤** ⬆ |
| بلا `styles.css` | ١٥ | **٨٥** ⬆ |
| `index.html` وحده | ١٢ | **٨٦** ⬆ |

**كلُّ ملفٍّ يُحذَف يرفع الدرجة.** وموقعٌ بلا تنسيقٍ ولا سكربت — لا يُعرَض ولا
يعمل — يُقال لصاحبه في سجلّ البناء الحيّ: «🟡 B (86/100)».

وقياسٌ ثانٍ يُبيّن الطريق: ملفّاتٌ **فارغة** المحتوى تُعطي **٦٥ (C)** بينما
**غائبة** تُعطي **٧٧ (B)**. أي أنّ الفحوصَ نفسها تُنصف حين تُنفَّذ.

### الإصلاح

الملفُّ الغائب يُقاس **بفحوصه على محتوىً فارغ** لا بسقوطٍ واحد، فيبقى المقامُ
ثابتاً ويصير الغيابُ أسوأَ من النقص لا أهون.

**وشرطُ العقوبة دليلٌ من الصفحة نفسها**: `<link rel=stylesheet>` أو
`<script src>` موجودٌ في الـHTML ثمّ الملفُّ غائب ⇒ رابطٌ مكسور، يُقاس كاملاً.
أمّا موقعٌ تعريفيّ لا يربط سكربتاً أصلاً فلا يُعاقَب على غيابه — قاعدةٌ عمياء
كانت ستُخطئ في حقّه.

| الحالة | قبل | بعد |
|---|---|---|
| كامل | ٨٣ | **٨٣** |
| بلا `script.js` | ٨٤ ⬆ | **٧٨** ⬇ |
| بلا `styles.css` | ٨٥ ⬆ | **٦٨** ⬇ |
| `index.html` وحده | ٨٦ ⬆ | **٦٢** ⬇ |
| تعريفيّ بلا سكربت (مشروع) | — | **٨٢** (لا يُعاقَب) |

### وحقلٌ واحدٌ بمعنيين

```js
const summary = calculateScore(allResults);   // summary.passed = عددُ الناجحة
return {
    ...summary,                                // ينشر passed: <عدد>
    passed: summary.errors === 0,              // ثمّ يدهسه بمنطقيّ
    report: `… ${summary.passed}/${summary.total} …`,
};
```

العددُ يضيع صامتاً في الناتج، ومن يقرأ `result.passed` ظانّاً أنّه عدد يأخذ
`true`. صار `passedCount` عدداً و`passed` نتيجةً — حقلان متمايزان.

(لم يكن ضارّاً اليوم: `jcr.js:_stageTesting` يقرأ `grade` و`report` و
`failedTests` وحدها. عطبٌ كامنٌ يُغلق قبل أن يقع، ويُقال أنّه كان كامناً.)

### نتيجةٌ سلبيّةٌ تُقال

**الدرجةُ مُشتقّةٌ فعلاً، لا صوريّة**: موقعٌ سليم ٨٣ ومعطوبٌ ٤٥ (D). دخلتُ
أفتّش عن «درجةٍ ثابتة» كالتي وُجدت في SEO (Sprint 3c) فلم أجدها — العطبُ كان
في **شكل** المقياس لا في غيابه.

### الاختبارات — ٦ جديدة، والوحدةُ كانت بلا تغطية

حذفُ ملفٍّ لا يرفع الدرجة؛ الموقعُ التعريفيّ لا يُعاقَب؛ الغائبُ يُقاس بفحوصه؛
الدرجةُ تُميّز السليمَ من المعطوب (فرقٌ ≥ ٢٥)؛ العددُ والنتيجةُ حقلان؛ مشروعٌ
فارغٌ لا يدّعي نجاحاً.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| إعادةُ سقوطٍ واحد للملفّ الغائب | اختباران |
| إعادةُ ازدواج `passed` | «العددُ والنتيجةُ حقلان» |

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٢٦ | **١١٣٢** (ناجحة كلُّها) |
| فرقُ الدرجة بين موقعٍ كامل وآخر بلا CSS وJS | **−٣** (الناقصُ أعلى) | **+٢١** (الكاملُ أعلى) |
| تغطيةُ `agents/testingAgent.js` | ٠ | ٦ اختبارات |

`agents/testingAgent.js` ٢٢٤ ← ٢٤٤.

---

## Sprint 3g — عاملُ الخدمة يُخزّن صفرَ ملفات، والتعليقُ يقول إنّه يتجاهل الغائب

### العطب

`generateServiceWorker` كان يكتب قائمةً مكتوبةً بيد ويُخزّنها دفعةً واحدة:

```js
const FILES_TO_CACHE = ['index.html', 'styles.css', 'script.js', 'icon.svg'];
…
return cache.addAll(FILES_TO_CACHE).catch(() => {
    // تجاهل الملفات غير الموجودة (مثل عدم وجود script.js في بعض المشاريع)
});
```

و`cache.addAll` **ذرّيّة بالمواصفة**: يفشل طلبٌ واحد فلا يُضاف **أيُّ** مدخل.
والـ`catch` يبتلع الخطأ — **فيتجاهل الخطأ لا الملف**. التعليقُ يصف سلوكاً
لا يفعله الكود، ويسمّي بنفسه الحالةَ التي تكسره: «عدم وجود script.js».

### الدليل — تشغيلٌ لا استنتاج

شُغّل معالجُ `install` من الملفّ المولَّد في بيئةٍ مُحاكاة (`node:vm` مع
`caches`/`self` مزيَّفَين، و`add`/`addAll` تُخفقان على ما ليس على القرص)، على
مشروعٍ فيه `index.html` و`styles.css` و`about.html` وبلا `script.js`:

```
نتيجة generatePWA: true | الملفات: manifest.json, icon.svg, service-worker.js
الملفاتُ المطلوبة في SW: ['index.html', 'styles.css', 'script.js', 'icon.svg']
ما خُزِّن فعلاً: ⛔ لا شيء — الكاشُ فارغ
```

فالمستخدمُ يُقال له إنّ التطبيق أُضيف، ولا عملَ دون اتصال البتّة.

**وعطبٌ ثانٍ في القائمة نفسها**: `about.html` وأخواتُها لم تكن مذكورةً أصلاً.
وهو يزداد أثراً بعد #488 و#489: المواقعُ صارت متعدّدةَ الصفحات بمساراتٍ ذاتِ
معنى، وعاملُ الخدمة لا يعرف منها إلا الرئيسية.

### الإصلاح

1. **القائمةُ تُشتقّ من ملفات المشروع** (`listCacheableFiles`): ملفّاتُ الجذر
   ذاتُ الامتدادات المفيدة، الرئيسيةُ أوّلاً ثمّ الباقي مرتّباً (ترتيبٌ ثابت
   يجعل ملفَّ العامل نفسه ثابتاً بين البناءات)، بسقف ٦٠ ملفاً، ولا مخفيّات
   (فلا `.env`)، ولا العاملُ نفسه.
2. **التخزينُ ملفاً ملفاً**: `Promise.all(FILES.map(f => cache.add(f).catch(() => {})))`
   — فيُخزَّن كلُّ موجود ويُتخطّى الغائب. وهو ما كان التعليقُ يدّعيه.

بعد الإصلاح، على المشروع نفسه:

```
القائمةُ المُشتقّة: index.html, about.html, contact.html, styles.css, manifest.json, icon.svg
ما خُزِّن فعلاً: 6 ملفاً
```

### نتائجُ سلبيّةٌ تُقال — ثلاثُ فرضيّاتٍ سقطت

دخلتُ الوحدةَ أبحث عن حقنٍ في ثلاث لغاتٍ تُولَّد من اسم التطبيق، فلم أجد:

- **SVG**: لا يُحقن منه إلا **حرفٌ واحد** (`appName[0]`) — لا وسمَ يُبنى بحرف.
- **manifest.json**: يُبنى بـ`JSON.stringify` — لا كسرَ باقتباس.
- **عاملُ الخدمة**: اسمُ الكاش يُصفّى بـ`(...).replace(/[^a-z0-9]/g, '-')`
  — فلا يبقى محرفٌ فعّال.

الوحدةُ كانت محروسةً في مواضع الحقن، ومكسورةً في موضع الوعد.

**وملاحظةٌ لم أُصلحها** (خارج نطاق العطب، ولا يستحقّ توسيع الـPR):
`extractThemeColor` يقبل `#[0-9a-fA-F]{3,8}` — أي يقبل ٤ و٨ خانات (بشفافية) —
و`adjustColorBrightness` لا يعالج إلا ٣ و٦. فمشروعٌ لونُه `#0ea5e9cc` يُنتج
تدرّجاً بلونٍ ثانٍ خاطئ. أثرٌ تجميليٌّ في الأيقونة وحدها؛ مسجَّلٌ هنا.

### الاختبارات — ٦ جديدة، والوحدةُ كانت بلا تغطية

`tests/pwaAgent.test.mjs` يُشغّل معالجَ `install` فعلاً في `node:vm` بـ`addAll`
ذرّيّةٍ كما في المتصفّح: مشروعٌ بلا `script.js` يُخزّن ملفاته؛ صفحاتُ الموقع
المتعدّدة تُخزَّن؛ ملفٌّ غائبٌ لا يُسقط الباقين؛ لا `.env` ولا العاملُ نفسه في
القائمة؛ الـmanifest صالحُ JSON باسمٍ فيه اقتباساتٌ ومحارفُ خاصّة؛ ومشروعٌ بلا
`index.html` لا يدّعي نجاحاً ولا يكتب عاملاً.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| إعادةُ `addAll` الذرّيّة | «ملفٌّ غائبٌ لا يُسقط الباقين» |
| إعادةُ القائمة المكتوبة بيد | «صفحاتُ الموقع المتعدّدة تُخزَّن» |

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٣٢ | **١١٣٨** (ناجحة كلُّها) |
| ملفّاتٌ تُخزَّن لمشروعٍ بلا `script.js` | **٠** | **٦** |
| تغطيةُ `agents/pwaAgent.js` | ٠ | ٦ اختبارات |

`agents/pwaAgent.js` ٢٠٢ ← ٢٣٤.

---

## Sprint 3h — بطاقةُ الحالة تُخبر عمّا لم يقع، والاستيرادُ يَعِد بما لا يُنادى (2026-09-05)

### العطب الأوّل: ثلاثةُ حقولٍ في بطاقة الحالة تكذب

حين يسأل المالكُ «أين وصلنا» يستدعي `ceoBrain.buildStatusReply` بطاقةً من
`stateMachine.getProjectSummary`. شغّلتُ التسلسلَ الحقيقيَّ الذي يمشيه `jcr.js`
(الأسطر ١٢٧٨ ← ٤١٢ ← ٥٣٩ ← ٦٠٦ ← ١٣٢٣) على الكود قبل اللمس:

```
الحالة        : completed
الوكيل الحالي : "Requirements"
أنجز          : []

📊 تقرير حالة المشروع (shop)
⚙️ المرحلة: مكتمل ✅ — 67%
🤖 الوكيل الحالي: Requirements
```

ثلاثُ دعاوى في أربعة أسطر:

1. **«🤖 الوكيل الحالي: Requirements»** عن مشروعٍ فرغ بناؤه. `currentAgent`
   يُكتَب عند كل انتقالٍ يحمل `meta.agent`، ولا يُمحى عند بلوغ حالةٍ نهائية.
   فيبقى على آخرِ من عُيِّن إلى أن يبدأ بناءٌ جديد.
2. **«✅ أنجز: …» لا يظهر أبداً.** لـ`completedAgents` كاتبان اثنان لا ثالث
   لهما: `markAgentComplete` — و**لا سطرَ في المستودع كلِّه يستدعيها** —
   و`meta.completedAgent` — و**لا نداءَ يمرّرها**. فالحقلُ فارغٌ بنيةً لا
   عرَضاً، والشرطُ `if (summary.completedAgents.length)` شرطٌ مستحيل.
3. **«مكتمل ✅ — 67%»**. المقامُ ستُّ مراحلَ ثابتة، والبناءُ الناجح يتخطّى
   اثنتين اختياريتين (التخطيط والنشر)، فلا يبلغ المئةَ أبداً. مشروعٌ اكتمل
   يُقال لصاحبه إنّه ثلثاه.

**الإصلاح — الاشتقاق من الانتقال نفسه** لا من نداءٍ منتظَر: المغادِرُ أنجز
(إلا أن يكون المصيرُ فشلاً فلا يُحسب إنجازاً)، والحالةُ النهائية لا وكيلَ فيها
يعمل، والاكتمالُ مئةٌ ببلوغه. ولم أُقلّص المقام هرباً من النسبة — تلك علّةُ
#492 بعينها (كلُّ ملفٍّ تحذفه يرفع درجتك)، ولا تُداوى علّةٌ بأختها.

بعد الإصلاح، على التسلسل نفسه:

```
⚙️ المرحلة: مكتمل ✅ — 100%
✅ أنجز: Architect، Coder، ReviewAgent، Requirements
```

وعلى مسار الفشل: `أنجز = ["Architect"]` (المعماريُّ أتمّ، والمبرمجُ سقط فلا
يُكافأ)، و`الوكيل الحالي = null`، والنسبةُ ٣٣٪ لا تُقفَز إلى مئة.

### العطب الثاني: الاستيرادُ الذي لا يُنادى — ٢٣ موضعاً

`markAgentComplete` لم تكن شاذّةً. مسحتُ **كلَّ** وحدةِ `.js` حيّةٍ في الخادم
(١٤٧ وحدة) عن اسمٍ يُستورَد ولا يُستعمل، فوجدتُ ٢٣ في ٨ ملفات — منها ١١ في
`jcr.js` وحدها وخمسةٌ في `server.js`. وأخطرُها ما كان **حارساً**:
`hasActiveMission` و`canStartNewBuild` و`markAgentComplete` مستوردةٌ كلُّها ولا
سطرَ يناديها، فيبدو الملفُّ كأنّه يحرس ما لا يحرس.

وواحدٌ منها كان أكثرَ من وعدٍ فارغ: `migrateDatabase` كانت **المرجعَ الوحيد في
المستودع كلِّه** لـ`agents/migrationAgent.js` (١٩٣ سطراً)، و`getLanguageDecision`
و`buildLanguagePrompt` المرجعَ الوحيد لـ`agents/languageManager.js` (٨٩ سطراً).
سطرا استيرادٍ ميّتان كانا يُبقيان وحدتين ميّتتين تبدوان حيّتين لكلّ ماشٍ على
الرسم البياني.

### لماذا حُذفت `migrationAgent.js` ولم تُصلَح

لأنّ ما تَعِدُ به لا تفعله، وتقول إنّها فعلته. شغّلتُ مخرَجَها:

```
أسطرُ نقلِ بياناتٍ غيرُ معلَّقة: 0
ما يطبعه السكربت: '✅ Migration اكتملت بنجاح'
```

سكربتُ الترحيل الذي تُسلّمه للمستخدم يتّصل بـMongoDB، ثمّ **كلُّ** سطرِ نقلٍ
فيه معلَّق، ثمّ يطبع أنّ الترحيل اكتمل بنجاح. ومَن رأى هذه الرسالةَ قد يُسقط
قاعدتَه القديمة. ومحوّلُها الحتميُّ `mongooseToPrisma` يُنتج لحقلٍ
`required: true`:

```
email    String    ?
```

اختياريّاً — لأنّ الشرطَ فيه `mongooseSchema.includes(\`${name}.*required.*true\`)`،
أي **نمطُ regex مرَّر إلى `String.prototype.includes`** فلا يُطابق شيئاً أبداً؛
وبمسافةٍ قبل `?` لا يقبلها Prisma أصلاً. وحدةٌ لا يبلغها نداءٌ خيرٌ من وحدةٍ
تُسلّم شهادةَ نجاحٍ على عملٍ لم يقع. الحذفُ هنا إزالةُ فخٍّ لا إزالةُ ميزة.

### الحارس — مشتقٌّ من الشجرة لا مكتوبٌ بيد

`tests/deadImports.test.mjs` يمشي على كلّ `.js` حيٍّ في الخادم ويؤكّد أن لا اسمَ
مستوردٍ بلا نداء. وثلاثةُ فخاخٍ وقعتُ فيها وأنا أبنيه، وكلُّها في الكاشف لا في
الكود — سجّلتُها لأنّ أوّلَ نسخةٍ منه أنتجت **١١ اتّهاماً باطلاً**:

| ما أخطأتُ فيه | الأثر | العلاج في الكاشف |
|---|---|---|
| عددتُّ `import` داخل قالبٍ نصّي | `renderAgent.js` يكتب كوداً مولَّداً فيه `import express` — فاتُّهمت خمسةُ أسماء | تُتخطّى المطابقةُ إن سبقها عددٌ فرديٌّ من العلامات الخلفية |
| `(?<!\.)` قبل الاسم | `...getUsage(x)` انتشارٌ لا وصولٌ لعضو، فاتُّهم ٤ أسماء حيّة (`getUsage`، `readTelegramConfig`، `failures`، `EXTENDED_TEMPLATES`) | تُبدَّل `...` فراغاً قبل العدّ |
| مسحتُ التعليقاتِ بـ`/\*[\s\S]*?\*/` | سلسلةٌ فيها `/*` ابتلعت منطقةً من `jcr.js`، فاتُّهم اسمان حيّان | لا تُمسح التعليقاتُ أصلاً — الاتّجاهُ الآمن أن يُعدَّ ذكرُ الاسم استعمالاً |

ولهذا لم أُصدّق الكاشفَ على أيٍّ من الـ٢٣ حتى أكّدها `grep` مستقلٌّ يعدُّ
ظهورَ كلّ اسمٍ في ملفه: **واحدٌ لكلٍّ منها — سطرُ الاستيراد نفسه**.

وللحارس اختبارُ يقظةٍ يمنع أن يصير خَتماً: ملفٌّ فيه اسمٌ ميّتٌ يُكشَف، وملفٌّ
فيه انتشارٌ لا يُتَّهم، واستيرادٌ داخل قالبٍ نصّيّ لا يُحسَب.

### ما لم أفعله وأُقرّ به

- **DeepSource لا يُغني عن هذا الحارس.** ثمانيةُ محلّلاتٍ خضراءُ على كل PR
  وهذه الـ٢٣ قائمةٌ منذ زمن. والسببُ موثَّقٌ في `.deepsource.toml` بخطّ من
  سبقني: محلّلُ JavaScript يعجز عن قراءة ESM (JS-0833)، والقاعدةُ متجاهَلةٌ
  على مستوى المستودع. فخضرةُ المحلّل لا تقول عن ملفّات ESM ما يبدو أنّها تقول.
- **`hasActiveMission` و`canStartNewBuild` لم تُحذفا**، رُفع عنهما وعدُ
  الاستيراد فقط. الأولى استعلامٌ صالح، والثانية سؤالٌ ثانٍ عن أمرٍ يجيب عنه
  `isBuilding` الحيّ — توحيدُ مصدرِ الحقيقة سِبرِنتٌ قائمٌ بذاته لا ذيلٌ لهذا.
- **`generateDependencies` و`generateInstallInstructions`** صارتا بلا مستدعٍ
  بعد رفع استيراد `jcr.js`؛ الوحدةُ نفسها تبقى حيّةً عبر
  `deployAgent → generatePackageJson`. لم أحذفهما في هذا الـPR.
- **`markAgentComplete` حُذفت** — صفرُ مستدعين، وقد أغنى عنها الاشتقاق.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| `currentAgent` لا يُمحى عند الحالة النهائية | «لا وكيلَ حالياً بعد اكتمال البناء» (٢ سقطا) |
| `completedAgents` بلا اشتقاق | «أنجز تحملُ الوكلاءَ الذين مرّوا فعلاً» (٣ سقطت) |
| النسبةُ على ستّ مراحلَ دائماً | «المكتملُ مئةٌ لا سبعةٌ وستون» |
| الساقطُ يُحسب منجِزاً | «الفشلُ لا يُكافَأ» |
| عودةُ استيرادٍ لا يُنادى إلى `jcr.js` | «لا وحدةَ تستوردُ اسماً لا تناديه» — وسمّت الجاني بعينه |

كلُّ طفرةٍ أُكِّد وقوعُها قبل قراءة نتيجتها.

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٣٨ | **١١٤٧** (ناجحة كلُّها) |
| استيراداتٌ بلا نداء | ٢٣ | **٠** (محروسة) |
| «أنجز» في بطاقة مشروعٍ اكتمل | `[]` أبداً | الوكلاءُ الأربعة |
| نسبةُ مشروعٍ مكتمل | ٦٧٪ | ١٠٠٪ |
| وحدات `agents/` | ١١٧ | **١١٥** |

`agents/stateMachine.js` ٢٤٤ ← ٢٥٧، `agents/jcr.js` ٣٢٢٣ ← ٣٢٢٠،
`agents/migrationAgent.js` (١٩٣) و`agents/languageManager.js` (٨٩) محذوفتان.

---

## Sprint 3i — «استُلم» عن دفعٍ لم يُطبَّق (2026-09-05)

### العطب: ثلاثةُ طرقٍ يضيع فيها اشتراكٌ مدفوع بلا أثر

في عقد webhooks، الرمزُ 2xx ليس مجاملة — إنّه إقرارٌ يقول لـStripe **«اشطب هذا
الحدثَ من قائمتك»**. وكان معالجُ `/api/billing/webhook` يقوله في ثلاث حالاتٍ لم
يُكتب فيها حرفٌ واحد. شغّلتُ الراوتر الحقيقيَّ خلف `express.raw` كما في
`server.js`، بحمولةٍ موقّعةٍ بتوقيع Stripe صحيح (`generateTestHeaderString` —
لا محاكاةَ للتوقيع)، على الكود قبل اللمس:

```
١) مونغو مقطوعة    → 200 {"received":true}  | كتابات: 0
٢) الكتابة تفشل    → 200 {"received":true}
٣) لا مستخدمَ مطابق → 200 {"received":true}
   💳 [Billing] تحديث اشتراك omar → pro (active)     ← سطرُ نجاحٍ على صفر كتابات
```

**والحالةُ الأولى ليست نظرية**: Mongo في هذا الخادم تتّصل **بعد** الإقلاع لا
معه (`onMongoReady` وترطيبُ المخازن مبنيّان على ذلك)، وقرصُ Render يُمسح مع كل
نشر. فكلُّ نافذةِ اتّصالٍ أو انقطاعٍ عابر هي نافذةٌ يدفع فيها مستخدمٌ ويبقى على
الخطّة المجانية **إلى الأبد** — لأنّ Stripe أُخبر أنّ الحدثَ وصل وطُبِّق.

والثالثةُ أسوأُ في بابها: `User.updateOne` تُرجع `matchedCount`، ولم يكن
يُقرأ. فيُطبع «💳 تحديث اشتراك …» عن كتابةٍ لم تطابق أحداً — سطرُ سجلٍّ يشهد
بما لم يقع.

### الإصلاح: ما يزول بالإعادة يُطلَب، وما لا يزول يُستلَم بصدق

| الحالة | قبل | بعد |
|---|---|---|
| قاعدةٌ غير متصلة | `200 {received:true}` | `503 {received:false, retry:true}` |
| الكتابةُ ترمي | `200 {received:true}` | `500 {received:false, retry:true}` |
| لا مستخدمَ مطابق | `200` + سطرُ نجاح | `200 {applied:false}` + تحذيرٌ باسمه |
| حدثٌ لا يعنينا | `200 {received:true}` | `200 {received:true, applied:false}` |
| طُبِّق فعلاً | `200 {received:true}` | `200 {received:true, applied:true}` |

الفرقُ الحاكم: **الخطأ العابر يزول بالإعادة فتُطلَب؛ وغيابُ المستخدم لا يزول
بها فلا تُطلَب**. والتطبيقُ مُحايدُ التكرار (`$set` بالقيم ذاتها)، فإعادةُ
الحدث لا تُنتج أثراً ثانياً — وهذا مُختبَرٌ لا مفترَض.

**وتصحيحٌ لتعليقٍ كان في الملف**: كان يبرّر إرجاع 200 على الخطأ الداخلي بأنّ
البديل «يعيد Stripe المحاولة **إلى ما لا نهاية**». وهذا ليس سلوكَ Stripe:
الإعادةُ بتراجعٍ أُسّيّ ضمن مهلةٍ محدودة، ثمّ تتوقّف وتُعلَّم النقطةُ معطّلة.
فالمقايضةُ الحقيقية ليست «إعادةٌ أبدية مقابل ضياعٍ واحد»، بل **«إنذارٌ مرئيّ
في لوحة Stripe مقابل ضياعٍ صامتٍ لا يعلمه أحد»** — والصامتُ أسوأ.

### نتيجةٌ سلبيّة: فرضيّةٌ سقطت قبل أن تُقال

دخلتُ أتوقّع عطباً ثانياً: أنّ أحداث `customer.subscription.*` تقرأ
`obj.metadata?.username`، وStripe **لا** ينسخ بيانات جلسة الـCheckout الوصفية
إلى كائن الاشتراك — فتكون كلُّ عمليات التجديد والإلغاء عبر البوّابة بلا اسمِ
مستخدم، فتُهمَل. قرأتُ `createCheckoutSession` قبل أن أكتب الدعوى، فإذا فيها:

```js
subscription_data: { metadata: { username, planId } },
```

الوسمُ مضبوطٌ عند الإنشاء صراحةً، والاشتراكُ يحمله بعدها. الفرضيّةُ باطلة،
ولم تُذكر إلا هنا نتيجةً سلبيّة.

### الاختبارات — ٨ جديدة، والراوتر كان بلا تغطية

`tests/billing.test.mjs` القائم يغطّي `config/plans.js` و`subscriptionService`
و`interpretWebhookEvent` — أي **المفسِّر** لا **المطبِّق**. والعطب كلُّه في
المطبِّق. `tests/billingWebhook.test.mjs` يشغّل الراوتر نفسه على منفذٍ حقيقيّ:
توقيعٌ فاسدٌ يُرفَض قبل أي كتابة، والدفعُ يُطبَّق بالحقول الصحيحة، والحالاتُ
الثلاث أعلاه، والإلغاءُ يُنزل الخطّة إلى `free`، والإعادةُ محايدةُ التكرار.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| قاعدةٌ مقطوعة تُجيب 200 | «قاعدةٌ مقطوعة: لا نقول استُلم بل نطلب الإعادة» |
| الكتابةُ ترمي فنقول «استُلم» | «الكتابةُ ترمي: نطلب الإعادة لا الشطب» |
| إسقاطُ فحص `matchedCount` | «لا مستخدمَ مطابق: يُستلَم بصدقٍ ولا يُدّعى تطبيق» |

كلٌّ منها أسقطت اختباراً واحداً بعينه — لا أكثرَ ولا أقلّ، فالحرّاسُ مفصولون.

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٤٧ | **١١٥٥** (ناجحة كلُّها) |
| تغطيةُ `routes/billing.js` | ٠ | ٨ اختبارات على الراوتر الحيّ |
| اشتراكٌ مدفوعٌ يضيع صامتاً | ٣ مسارات | **٠** |

`routes/billing.js` ١١٢ ← ١٣٩.

---

## Sprint 3j — اللقطةُ تُتلف ما عجزت عن حمله، والسجلُّ العربيُّ يكسر قناةَ الاختبار (2026-09-05)

### العطب الأوّل: نسخةٌ احتياطيةٌ تحذف ما لم تستطع حمله

قرصُ Render مؤقّت، فلقطةُ `workspaceStore` هي **النسخةُ الوحيدة الباقية** من
موقع المستخدم. وكان التنقيةُ بعد كل لقطة `$nin` على **المحمول** لا على
**المرئيّ**، فكلُّ ملفٍّ رآه الجردُ ولم يستطع حملَه كانت نسختُه المحفوظة
تُمحى. شغّلتُ الوحدةَ الحقيقية على قرصٍ حقيقيّ بمخزنٍ يُظهر ما حُذف:

```
١) ١٠٠ ملفٍّ على القرص  → {"success":true,"count":80}   | المحفوظ: 80
٢أ) قبل النموّ           → المحفوظ: app.js, index.html
٢ب) app.js نما فوق 400KB → {"success":true,"count":1}    | المحفوظ: index.html
```

الحالةُ الثانية هي الأخطر: ملفٌّ كان محفوظاً بأمان، **كبُر**، فمُحيت نسختُه
المحفوظة **لأنّه كبُر** — والتقريرُ `success: true`. ومع أوّل إعادة نشرٍ تمسح
القرصَ لا يبقى منه أثر. أمّا الأولى فسقفُ ٨٠ ملفاً: الجردُ يتوقّف عنده ثمّ
يُحذَف بقائمةٍ ناقصة كلُّ ما لم يبلغه.

**الإصلاح**: الجردُ يُرجع ثلاثةَ أشياء لا واحداً — `files` (ما حُمل)، `seen`
(ما رُئي على القرص ولو لم يُحمَل)، `truncated` (هل توقّف قبل أن يرى الكلّ؟).
والتنقيةُ بـ`seen`، ولا تقع أصلاً إن كان الجردُ ناقصاً: **الحذفُ بجردٍ ناقصٍ
إتلافٌ لا تنظيف**. وحارسُ «لا تمسّ اللقطة» صار على الرؤية لا الحمل، فمجلدٌ
فارغٌ أو تعذّرت قراءتُه لا يمسّ شيئاً، ومجلدٌ رُئي كاملاً يُنقَّى منه المحذوفُ
حقاً ولو لم يُحمَل منه ملفٌّ واحد.

**والاستعادةُ تعدُّ المكتوبَ لا المقروء**: كانت تُرجع `docs.length` وتطبعه،
فيُقال للمالك «استُعيد مشروعك (٣ ملفات)» وقد كُتب اثنان والثالثُ رُدَّ لخروج
مساره عن الجذر. وسقطةُ ملفٍّ واحدٍ كانت تُجهض الباقين وتُرجع صفراً وقد كُتب
بعضُهم. الآن: `{ restored, blocked, failed, total }`، وكلُّ كتابةٍ في
`try` مستقلّ.

### العطب الثاني: سجلٌّ عربيٌّ يُسقط ملفَّ اختبارٍ كاملاً

بعد إضافة اختبارات `workspaceStore` بدأ `npm test` يسقط بـ
`Unable to deserialize cloned data` على `tests/billingWebhook.test.mjs` —
**٣ من ٦ تشغيلات**. أي أنّ فرعَ main كان أحمرَ في نصف الجولات، بسببي (#495).

طاردتُه بأربعَ عشرةَ تجربةً مضبوطة. **وسبعُ فرضياتٍ سقطت** قبل الصحيحة:

| الفرضية | القياس |
|---|---|
| طبعُ الكود داخل الابن | ٠/٢٤ (لاتينيّ) |
| كتابةٌ على stdout عند الاستيراد | ٠ بايت |
| نمطُ «خادم + fetch» نفسه | ٠/٣٢ |
| الاستيراداتُ الخمسة مجتمعةً | ٠/٢٤ |
| توقيعُ Stripe وتحقّقُه | ٠/٢٤ |
| تجاوزُ `readyState` على mongoose | ٠/٢٤ |
| مقابسُ keep-alive عند التفكيك | ١٥/٢٤ بعد الإغلاق المحسوم |

وضابطٌ مهمّ: خمسةُ ملفاتِ اختبارٍ سابقة — منها الأثقلان — **٠/٢٤** تحت الحِمل
نفسه. فالعطبُ ملفّي أنا، لا خاصّيةُ بيئة.

**الآليّة**، وجدتُها في مخرَجٍ كاملٍ غيرِ مُرشَّح:

```
# 💳 [Billing] تحديث اشتراك omar → pro (active)
not ok 22 - tests/billingWebhook.test.mjs
  error: 'Unable to deserialize cloned data…'
```

مشغّلُ Node يمرّر ما يطبعه الابنُ عبر **قناة التقرير نفسها** (V8-serialized
على stdout). ومع الحِمل تنكسر أُطُرُ الرسائل عند المحارف متعددة البايت.
تجربةٌ ضابطة، بنيةٌ واحدة وحجمٌ واحد:

```
console.log لاتينيٌّ بحت        → ٠/٢٤
console.log فيه إيموجي وعربية  → ١٢/٢٤
```

وسجلُّ هذا المستودع عربيٌّ كلُّه. فالعطبُ ليس في اختباري وحده — إنّه فئةٌ.

**الإصلاح**: `tests/helpers/quietConsole.mjs` يكتم سجلَّ الإنتاج داخل ابن
الاختبار **ويحتفظ بالسطور** فلا يُخفي شيئاً. بعده:

```
٣٢ تشغيلاً متزامناً → ٠   (كان ١٦/٢٤)
npm test ستّ مرّات  → ٠   (كان ٣ من ٦)
```

**وأُقرّ بخطأين في طريقي**: أوّلاً جرّبتُ فرضيةَ «الطبع» تسلسلياً لا تحت
تزامنٍ — فبرّأتُ المتّهمَ الصحيح لأنّ الشرطَ الذي يُظهره لم يكن قائماً.
وثانياً قارنتُ نسخةً من الملفّ في مجلدٍ آخر وبنيتُ عليها استنتاجاً، ثمّ
تبيّن أنّ تلك النسخة **تسقط قبل أن تُشغّل اختباراً واحداً** — فكان «٠/٢٤»
منها قياساً للا شيء. (وهي علّةُ «قرائنُ حول الفرض ليست قياساً للفرض» نفسها،
للمرّة الخامسة في هذه السلسلة.)

**وما لم أفعله**: مسحٌ للمستودع أظهر **٢٤ وحدةً** تطبع سجلاً غيرَ لاتينيّ،
و**٣٢ ملفَّ اختبارٍ** يستورد إحداها بلا كتم. لم أُلزمها كلَّها بالكاتم في
هذا الـPR: تغييرُ ٣٢ ملفاً يخالف «تدريجيٌّ ومُتحقَّقٌ دوماً»، وأكثرُها لا
يُشغّل مسارَ الطباعة أصلاً. الرقمُ مسجَّلٌ هنا خطَّ أساسٍ لسِبرِنتٍ لاحق.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| الحذفُ بقائمة المحمولِ لا المرئيّ | «ملفٌّ كبُر تبقى نسختُه المحفوظة» |
| الحذفُ ولو كان الجردُ ناقصاً | «مشروعٌ يتجاوز السقف لا تُنقَّى لقطتُه» |
| الاستعادةُ تعدُّ المقروء | «الاستعادةُ تعدُّ المكتوبَ لا المقروء» |
| الحارسُ على الحملِ لا الرؤية | «جردٌ كاملٌ بلا محمولٍ واحد يُنقّى به المحذوف» |

**والرابعةُ نجت أوّلَ مرّة**: طفرةٌ طبّقتُها فلم يسقط شيء — أي أنّ تحسيناً
أدخلتُه لم يكن يحرسه أحد. فكتبتُ الاختبارَ الذي يميّز الحالتين ثمّ أعدتُ
الطفرة فسقط. تحسينٌ بلا حارسٍ دعوى.

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٥٥ | **١١٦٦** (ناجحة كلُّها) |
| `npm test` يسقط بإفساد القناة | ٣ من ٦ | **٠ من ٦** |
| تغطيةُ `services/workspaceStore.js` | ٠ | ١٠ اختبارات |
| ملفٌّ كبُر تُمحى نسختُه المحفوظة | نعم | لا |

`services/workspaceStore.js` ١١٥ ← ١٥٣.

---

## Sprint 3k — المنظِّفُ يكسر ما ينظّفه: خمسةُ أعطابٍ تدخل كودَ المستخدم (2026-09-05)

`refactorCode` ليست تحسيناً اختيارياً: `jcr.js:562` يفعل
`plan.files = refactorResult.files`، فما تكتبه **هو** ما يُكتب على القرص
ويُسلَّم. وهي بلا تغطية. وجدتُ فيها خمسةَ أعطاب، كلُّها تُدخل في كود المستخدم
ما لم يكن فيه.

### ١. نداءٌ متشعّبٌ يُبتَر فيبقى قوسٌ يتيم

النمطُ كان `console\.(log|warn|error)\([^)]*\);?` — و`[^)]*` يقف عند **أوّل**
`)`. فشغّلتُ الوحدةَ على كودٍ فيه `console.log(JSON.stringify({ ok: 1 }));`:

```
console.log('a'); console.log('b'); console.log('c');
);                                    ← ما تبقّى من النداء الرابع
```

خطأٌ نحويٌّ يقتل الملفَّ كلَّه. والنداءُ المتشعّب هو القاعدة لا الشذوذ. الآن
تُعدّ الأقواسُ عدّاً مع احترام النصوص، ونداءٌ غيرُ مغلقٍ لا يُمَسّ.

**وحُصر الحذفُ في `log`/`debug`**: حذفُ `console.error` من كود المستخدم ليس
تنظيفاً — هو إسكاتُ تشخيصه. وتوصيفُ الوحدة نفسِه يقول «إزالة console.log
الزائدة».

### ٢. `'use strict'` يُدَسّ فوق `'use client'` فيُبطلها

التوجيهُ توجيهٌ ما دام **أوّلَ جملة**؛ فإن سبقته جملةٌ صار تعبيراً بلا أثر.
مقيسٌ لا مفترَض:

```
'use strict' أوّلاً        → التعيينُ لمتغيّرٍ غير مصرَّح: مُنع ✅
سبقته جملة (1;)           → لم يُمنع ❌
```

وكلُّ ملفِّ `.js` كان يناله. فمكوّنُ عميلٍ في Next يبدأ بـ`'use client'`
يخرج وقد بطلت حدودُه. والشرطُ القديم كان يستثني `type="module"` — وهي سمةُ
HTML لا تظهر في `.js` قطّ، أي استثناءٌ لا يقع أبداً.

الآن: لا يُدَسّ فوق توجيهٍ قائم، ولا في وحدةِ ESM (وهي صارمةٌ بحكم التعريف).

### ٣. `var` → `let` — تغييرُ معنًى لا شكل

هذا أخطرُها، ومقيسٌ **بالتشغيل** لا بالقراءة. نفسُ الكود قبل التحويل وبعده:

```
var mode='light'; if (dark) { var mode='dark' } → قبل: "dark"   بعد: "light"
for (var i…) { … break } … return i;            → قبل: 1        بعد: ReferenceError
```

الأولى **خطأٌ صامت**: مبدّلُ السمة الداكنة في موقع المستخدم يعود للفاتح ولا
يشتكي أحد. والثانية سقوط. و`var` نطاقُه الدالةُ و`let` نطاقُه الكتلة —
والفرقُ لا يُحسم بتعبيرٍ نمطيّ.

وكان الفحصُ نفسُه معطوباً: `new RegExp('\\b'+name+'\\s*=(?!=)').test(result)`
يبحث في **النصّ كلِّه** فيجد تصريحَ المتغيّر نفسَه، فالجوابُ «أُعيد تعيينُها»
**دائماً** — أي أنّه لم يُنتج `const` قطّ رغم التعليق الذي يشرح كيف يختار
بينهما.

**حُذف التحويل.** `var` كودٌ صحيح؛ لم يكن هنا عيبٌ يُصلَح، بل عيبٌ يُدخَل.

### ٤. تكرارُ CSS: تُحذف النافذةُ وتبقى المتجاوَزة

`'$1$2$4'` كان يُبقي **الأولى**. وترتيبُ CSS يجعل الأخيرةَ هي النافذة:

```
.card { color: red; padding: 8px; color: blue; }
        ← بعد «التنظيف»: color: red
```

فلونُ موقع المستخدم ينقلب إلى قيمةٍ كان قد تجاوزها. الآن تبقى الأخيرة،
والمتغيّراتُ المخصّصة (`--x`) لا تُنقَّى (قد يُتعمّد تتاليها)، والكتلةُ التي
فيها اقتباسٌ لا تُمَسّ (`content: "a;b"` فاصلتُها ليست فاصلَ تصريح).

### ٥. `hreflang=` يُشبع فحصَ `lang=`

`!result.includes('lang=')` — وصفحةٌ فيها
`<link rel="alternate" hreflang="ar">` تحتوي `lang=`، فلا تنال `<html>` سمةَ
لغةٍ أبداً. صار السؤالُ عن السمة في وسم `<html>` نفسه. ومثلُه `charset`:
كانت تُفحص في الصفحة كلِّها، فصارت في وسم `meta`.

### نتيجةٌ سلبيّةٌ تُقال — فرضيّتان سقطتا

توقّعتُ أنّ `var` → `let` يُنتج **خطأً نحوياً** عند إعادة التصريح
(`var x; var x;` قانونيّ و`let x; let x;` ليس كذلك). حلّلتُ الناتجَ فعلاً:
**يُحلَّل بلا خطأ** في الحالتين اللتين جرّبتُهما، لأنّ التصريحَ الثاني كان في
كتلةٍ فصار نطاقاً آخر. فالعطبُ أخبثُ ممّا ظننتُ لا أهون: لا رسالةَ تُنذر، بل
نتيجةٌ مختلفة. لم أُثبت العطبَ إلا حين **شغّلتُ** الكودَ بدل أن أُحلّله.

### الاختبارات — ١٣ جديدة، والوحدةُ كانت بلا تغطية

`tests/refactorAgent.test.mjs` يُشغّل الوحدةَ ثمّ **يُحلّل ناتجَها ويُنفّذه**:
لا قوسَ يتيماً، والنصُّ الذي فيه `)` لا يخدع العدّاد، وتسجيلُ الأخطاء باقٍ،
والتوجيهُ أوّلٌ، والوحدةُ لا تُحشى، و`var` يُنتج ما كان يُنتجه، واللونُ النافذ
يبقى، و@media تُنقَّى، والمقتبَسُ لا يُمَسّ، والصفحةُ تنال لغتَها، ولغةُ
المؤلّف تُحترم.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| الوقوفُ عند أوّل قوسٍ مغلق | «نداءٌ متشعّبٌ يُحذف كاملاً» |
| حذفُ `warn`/`error` أيضاً | «تسجيلُ الأخطاء ليس زائداً» |
| دسُّ `'use strict'` بلا شرط | «التوجيهُ يبقى أوّلاً» + «الوحدةُ صارمةٌ أصلاً» |
| إبقاءُ الأولى في CSS | «تبقى النافذةُ لا المتجاوَزة» + «@media» |
| فحصُ `lang=` في الصفحة كلِّها | «hreflang لا يُشبع فحصَ اللغة» |
| عودةُ تحويل `var` | «var يبقى var» |

ستٌّ، كلُّها أُكِّد وقوعُها، وكلٌّ أسقطت حارسَها.

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٦٦ | **١١٧٩** (ناجحة كلُّها) |
| تغطيةُ `agents/refactorAgent.js` | ٠ | ١٣ اختباراً |
| تحويلاتٌ تُدخل عطباً في كود المستخدم | ٥ | **٠** |

`agents/refactorAgent.js` ١٤٦ ← ٢٣٤.

---

## Sprint 3l — فحصٌ لا يستطيع أن يفشل ليس فحصاً (2026-09-05)

`runSystemDiagnostics` هي ما يراه المشرف على `/api/admin/health`، وهي بلا
تغطية. ثلاثةُ مواضع فيها تقول «سليم» بلا أن تنظر.

### ١. الذاكرة: مقامٌ لا يُبلَغ

المقامُ كان `os.totalmem()` — ذاكرةَ **المضيف** لا حدَّ الحاوية. قياسٌ فعليّ
في هذه البيئة:

```
rss (العملية)        : 79 MB
os.totalmem (المضيف) : 16075 MB          → 0.49٪
عتبةُ التحذير (70٪)  : 11253 MB في عمليةٍ واحدة
```

وحاويةُ Render النموذجية ٥١٢ MB: تُقتل العمليةُ عند ٥١٢، فلا يبلغ المؤشّرُ
عتبتَه أبداً. الفحصُ الموضوعُ لالتقاط ضغط الذاكرة **عاجزٌ عن الوقوع في
المنصّة التي كُتب لها**.

الآن يُقرأ حدُّ الحاوية من cgroup (v2 `memory.max` وv1
`memory.limit_in_bytes`)، وتُرفض قيمةُ «بلا حدّ» في الصيغتين، ويُعلَن المصدرُ
في نصّ التقرير (`… من 512 MB (الحاوية)`) فلا يُخمَّن.

### ٢. القرص: يَعُدُّ عناصرَ ويقول «سليم»

ترويسةُ الملفّ تَعِد بـ«الذاكرة والقرص (استهلاك)»، والصفُّ كان
`check('مساحة العمل', OK, …)` — حالةٌ **مكتوبة** لا مشتقّة، وقياسُه عددَ
عناصر المجلّد لا مساحةً. الآن `fs.statfsSync` يقيس المساحة الحرّة فعلاً،
والحالةُ تُشتقّ (≥٨٥٪ تحذير، ≥٩٥٪ حرجة). وأوّلُ تشغيلٍ بعد الإصلاح التقط
شيئاً حقيقياً في هذه الحاوية نفسها: **مستخدَم ٨٩٪ → تحذير**.

### ٣. الإضافات: الصفُّ يختفي في الحالة التي وُضع لها

```js
if (orchestrator.initialized) { checks.push(…) }   // وإلا: لا صفَّ إطلاقاً
```

و`init()` يُستدعى قبل `listen` لكنّ **فشلَه لا يمنع الإقلاع**. أي أنّ حالةَ
إخفاق نظام الإضافات هي بالضبط الحالةُ التي يختفي فيها صفُّه — ويقول الملخّصُ
«كل الأنظمة سليمة ✅». والغيابُ لا يُقرأ سلامةً: الصفُّ الآن حاضرٌ دائماً،
وحين لا يُهيَّأ المنسّقُ يقول `warn` ويشير إلى سجلّ الإقلاع.

### نتيجةٌ سلبيّة: `MONGO_URI` صحيحة

دخلتُ متوقّعاً عطباً رابعاً: إرشادُ القاعدة يقول «اضبط `MONGO_URI`» بينما
المستودعُ مليءٌ بـ`MONGODB_URI`. قرأتُ اتصالَ الخادم نفسِه قبل الدعوى:

```js
server.js:277  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jaola_os';
```

الإرشادُ صحيحٌ للمنصّة، و`MONGODB_URI` تخصّ **التطبيقات المولَّدة** لا
الخادم. الفرضيّةُ باطلة. (يبقى تجاورُ الاسمين مصدرَ لبسٍ محتمل — مسجَّلٌ هنا
ولم يُغيَّر: تغييرُ اسمِ متغيّرِ بيئةٍ في الإنتاج قرارُ المالك.)

### طفرةٌ نجت — ففُصل القرار

طفرةُ «المقامُ ذاكرةُ المضيف دائماً» **نجت أوّلَ مرّة**: هذه الآلةُ بلا حدِّ
حاوية، فالعطبُ والصوابُ يُنتجان الجوابَ نفسَه هنا. أي أنّ الإصلاحَ كان بلا
حارسٍ حيث يهمّ.

فصُلَ القرارُ عن القرص في `resolveMemoryLimit(rawCandidates, hostMb)` — دالّةٌ
نقيّةٌ مستهلكُها الإنتاجيُّ `memoryLimitMb` نفسُها — فصار يمكن إثباتُ سلوكها
بحاويةٍ مفترضةٍ ٥١٢ MB دون أن نملك واحدة. ثمّ أُعيدت الطفرةُ فسقط اختباران.

هذه ثاني مرّةٍ في هذه السلسلة تنجو فيها طفرةٌ فتكشف تحسيناً بلا حارس. والقاعدةُ
تتأكّد: **تحسينٌ لا تُسقطه طفرتُه دعوى، لا إصلاح.**

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| المقامُ ذاكرةُ المضيف دائماً | «حدُّ الحاوية يغلب» + «٥١٢ MB: ٤٠٠ تحذير و٤٦٠ حرجة» |
| حذفُ صفّ الإضافات عند عدم التهيئة | «صفُّ الإضافات حاضرٌ ولو لم يُهيّأ» + «التقريرُ يحمل زمنَه» |
| القرصُ سليمٌ دائماً | «القرصُ يُقاس لا يُعَدّ» |

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٧٩ | **١١٨٨** (ناجحة كلُّها) |
| تغطيةُ `agents/systemDoctorAgent.js` | ٠ | ٩ اختبارات |
| فحوصٌ لا تستطيع الفشل | ٣ | **٠** |
| صفوفُ التقرير | ٦ (وقد تصير ٥) | **٧ دائماً** |

`agents/systemDoctorAgent.js` ١٤٣ ← ٢٠٢.

---

## Sprint 3m — العمولةُ هي الغرض، وغيابُها كان صامتاً (2026-09-05)

`integrations/travelpayouts.js` تولّد وسيطَ بحث طيرانٍ يُكتب في مشروع المستخدم
(`backendAgent:299` ← `jcr:931` ← يُكتب على القرص). وغرضُها المعلَن في
الـREADME الذي تكتبه بنفسها: «روابط `bookingUrl` تحمل `marker` الخاص بك — منها
تُحتسب عمولتك». وهي بلا تغطية. ثلاثةُ أعطاب، كلُّها تمسّ الغرضَ نفسَه.

### ١. بلا `TRAVELPAYOUTS_MARKER`: كلُّ حجزٍ بلا عمولة، ولا حرفَ تحذير

الوسيطُ يرفض العملَ بلا `TOKEN` (500)، ولا يقول شيئاً عن `MARKER`. شغّلتُ
الوسيطَ المولَّد نفسَه (كُتب على القرص واستُورد) بـ`fetch` مُستبدَل:

```
بالتوكن بلا marker → الرمز 200 | success: true
   [0] https://www.aviasales.com/search/RUH0101DXB1
   [2] https://www.aviasales.com/x?a=1
   ← أيُّ تحذيرٍ في الردّ؟ لا شيء
```

موقعٌ يعمل بالكامل، وبحثٌ يُرجع نتائج، وأزرارُ حجزٍ تعمل — وصفرُ عمولة. ومن
يضبط التوكن وينسى الـmarker لا يعلم إلا حين ينظر في كشف حسابه بعد شهر.

الآن: `markerConfigured` في كل ردّ، وتحذيرٌ يُسجَّل على الخادم **مرّةً واحدة**
(لا مع كل طلب)، وسطرٌ في الـREADME يقول الأمرَ صراحة.

### ٢. نتيجةٌ بلا `link` تُنتج رابطَ الصفحة الرئيسية

```js
'https://www.aviasales.com' + (f.link || '') + …
```

فإن لم يُرجع المزوّدُ رابطاً، الناتجُ `https://www.aviasales.com` وحدَها:
زرُّ حجزٍ يقود المسافرَ إلى صفحةٍ رئيسية — بلا وجهةٍ ولا تاريخٍ ولا إحالة.
والنتيجةُ تبقى في القائمة كأنّها قابلةٌ للحجز.

الآن `bookingUrl: null`، ومثالُ الواجهة لا يرسم زرّاً لما لا رابطَ له،
و`bookableCount` يقول كم نتيجةً قابلةً للحجز فعلاً من `count`.

### ٣. `env` المُصرَّحة لا يقرؤها أحد

الوحدةُ تُرجع `env: ['TRAVELPAYOUTS_TOKEN', 'TRAVELPAYOUTS_MARKER']`،
و`generateAdvancedModules` تأخذ `tp.files` وتُسقط الباقي. أي أنّ الوحدةَ تقول
ما تحتاجه ولا يسمعها أحد — وهي **المتغيّراتُ نفسُها** التي يعني غيابُ أحدها
صفرَ عمولة. الآن تُرفَع في `requiredEnv` ويقولها سطرُ البناء الحيّ للمالك:
«✅ Travelpayouts (٣ ملف) — يتطلّب ضبط: TRAVELPAYOUTS_TOKEN، TRAVELPAYOUTS_MARKER».

### ما لم أفعله وأُقرّ به

الوسيطُ يمرّر التوكن في **مسار الاستعلام** (`?token=…`) لا في ترويسة. وضعُه
في ترويسةٍ أفضلُ عادةً (لا يظهر في سجلّات الوسطاء)، لكنّ توثيق Travelpayouts
محجوبٌ عن وكيل الخروج هنا، فلا أستطيع التأكّد أنّ الترويسةَ مقبولةٌ لهذه
النقطة. **وتغييرٌ لا أستطيع التحقّق منه قد يكسر تكاملَ المستخدم** — فتُرك،
ومسجَّلٌ هنا لمن يملك التوثيق.

### خطأٌ في اختباري أنا، لا في الكود

اختبارُ «التوكن مطلوب» سقط أوّلَ مرّة بالرمز 200. والسببُ في المِرْقاة لا في
المقيس: مرّرتُ `{ token: undefined }` لنزع التوكن، والقيمةُ المعدومة **تُفعّل
القيمةَ الافتراضية للمعامل** (`token = 't'`) فعاد التوكن. صارت `noToken: true`
صريحةً، ومعها سطرُ تعليقٍ يمنع تكرارها.

### برهانُ الطفرات

| الطفرة | المُلتقِط |
|---|---|
| رابطُ الصفحة الرئيسية لنتيجةٍ بلا `link` | «نتيجةٌ بلا link لا رابطَ حجزٍ لها» |
| صمتٌ تامٌّ عن غياب الـmarker | «بلا marker: يُقال ذلك لا يُسكَت» + «بالـmarker» |
| إسقاطُ `requiredEnv` | «env المُصرَّحة تصل المستدعي» |

### الخط الأساس

| القياس | قبل | بعد |
|---|---|---|
| اختبارات backend | ١١٨٨ | **١١٩٨** (ناجحة كلُّها) |
| تغطيةُ `integrations/travelpayouts.js` | ٠ | ١٠ اختبارات |
| مساراتٌ تُنتج حجزاً بلا عمولةٍ صامتاً | ٢ | **٠** |

`integrations/travelpayouts.js` ١٣٢ ← ١٥٧، `backendAgent.js` ٣٢٤ ← ٣٢٩،
`jcr.js` ٣٢٢٠ ← ٣٢٢٣.

---

## Sprint 3n — النصيحةُ التي تُتلِف: خزنةُ الأسرار تعرف الاحتياط عند الكتابة وتجهله عند القراءة

`utils/secretVault.js` (٣٩ سطراً، ستةُ مستوردين، **بلا اختبارٍ واحد**) هي التي
تحمي كلَّ توكن يودعه المستخدم: GitHub PAT، بوت تليجرام، صفحة فيسبوك، مفاتيح X
الأربعة، وكلَّ سرٍّ في `projectSecrets`.

### العطبُ الأوّل — الطبيبُ يوصي بما يُتلِف

ترويسةُ الوحدة تقول: «مفتاح مشتق من `PAT_ENCRYPTION_KEY` (أو `JWT_SECRET`
كاحتياط)». و`systemDoctorAgent.js:119` يرفع تحذيراً حين يغيب المخصَّص، ونصيحتُه:
«اضبط المتغيرات الناقصة في بيئة الاستضافة». و`.env.example` يجعله اختيارياً.

فالمسارُ الذي يرسمه النظامُ لمالكه بنفسه هو: أقلِع بـ`JWT_SECRET` وحده، ثمّ
أضِف `PAT_ENCRYPTION_KEY` حين ينبّهك الطبيب.

لكنّ `getKey()` كانت تعيد **مفتاحاً واحداً** — الأوّلَ المتاح — في التشفير
والفكّ معاً. فالاحتياطُ لم يكن احتياطاً، بل تبديلاً كاملاً. القياس:

```
خُزِّن تحت JWT_SECRET وحده.
بعد اتّباع نصيحة الطبيب → استثناء: Unsupported state or unable to authenticate data
```

كلُّ سرٍّ مخزَّن يموت في اللحظة نفسِها. لا رسالةَ تحذير، ولا ترحيل، ولا رجعة.

### العطبُ الثاني — سرٌّ لا تستطيع الخزنةُ إعادته

`encryptSecret('')` كانت تنجح وتُخرِج `iv:tag:` — نصٌّ غيرُ فارغ يمرّ كلَّ
حراس المستدعين (`if (pat)`، `if (t?.tokenEnc)`)، ثمّ تقول عنه `decryptSecret`
«صيغة السر المشفر غير صالحة»: تُتَّهم البياناتُ بالتلف وهي لم تتلف قط.

```
المُدخَل ""    → المخزون: 480c302a…:2275c016…:
   يبدو مضبوطاً للمستدعي (truthy)؟ true
   القراءة → استثناء: صيغة السر المشفر غير صالحة.
```

المسارُ الحيّ: `server.js:2137` — `if (pat) github.patEncrypted = encryptSecret(pat)`.
والمخطَّطُ `githubConnect` يشترط `min(10)` فقط، وعشرُ مسافاتٍ تجتازه.
و`deployAutomation.js:108` تنادي `encryptSecret(token)` بلا حارسٍ أصلاً.

### العطبُ الثالث — ثلاثةُ أحوالٍ بمخرجٍ واحد

قياسٌ مباشر: تدويرُ المفتاح والعبثُ بالبيانات يخرجان برسالةِ عقدةٍ واحدة
(`Unsupported state or unable to authenticate data`)، والصيغةُ المكسورة برسالةٍ
ثانية. و`server.js:380` كانت `catch { return null }` — فـ«لا توكن مربوط»
و«توكنٌ مربوطٌ لا نقرؤه» شيءٌ واحد، فيُطلَب من المستخدم أن يربط ما هو مربوطٌ أصلاً.

### الإصلاح

| الموضع | قبل | بعد |
|---|---|---|
| `candidateSecrets()` | — | `[PAT_ENCRYPTION_KEY, JWT_SECRET]` مرتَّبةً بلا تكرار |
| التشفير | `getKey()` | `deriveKey(secrets[0])` — المخصَّصُ أوّلاً، كما كان |
| الفكّ | مفتاحٌ واحد | يجرّب المرشَّحين بالترتيب |
| فحصُ الشكل | `!ivHex \|\| !tagHex \|\| !dataHex` | أطوالُ hex الفعلية (24/32/زوجيّ) |
| `encryptSecret('')` | تنجح | ترمي `reason: 'empty'` |
| سببُ الفشل | رسالةُ عقدةٍ مبهمة | `reason`: `empty` / `malformed` / `key-mismatch` / `no-key` |
| `getGithubToken` | `catch { return null }` | `null` نفسُه + سطرُ سجلٍّ يسمّي السبب |
| نصيحةُ الطبيب | «اضبط الناقص» | تُضيف أنّ الإضافة **آمنة** على المخزون |

**الصيغةُ المخزَّنة لم تتغيّر** (`iv:tag:data` بالـhex) — فلا ترحيلَ ولا سرٌّ
قديمٌ يُفقَد. وذلك مقصودٌ ومحروسٌ باختبار.

### الدليل

```
بعد اتّباع نصيحة الطبيب → "ghp_realtoken"
الكتابةُ الجديدة تستعمل المفتاح المخصَّص؟ نعم
استبدالٌ كامل → key-mismatch
صيغةٌ مكسورة  → malformed
سرٌّ فارغ     → empty
```

### الطفرات — كلُّ حارسٍ أُسقِط بإعادة عطبه

| الطفرة | النتيجة |
|---|---|
| الفكُّ بمفتاحٍ واحد (`secrets.slice(0,1)`) | فشلٌ واحد |
| قبولُ السرّ الفارغ (`if (false)`) | فشلٌ واحد |
| حذفُ فحص الشكل | فشلٌ واحد — التلفُ الحقيقيّ يخرج «تدويرَ مفتاح» |
| التشفير بالاحتياط لا بالمخصَّص | فشلٌ واحد |

### خطئي في هذا السباق

كتبتُ الفحوصَ بـ`assert.throws(fn)` ثمّ قرأتُ `e.reason` من ناتجها — و`throws`
لا تُعيد الاستثناء. ثلاثةُ اختباراتٍ سقطت بـ`Cannot read properties of undefined`،
والعطبُ في المِرْقاة لا في المقيس. أُصلح بمِلقاطٍ صريح `grab()`.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `utils/secretVault.js` | ٠ | ٨ اختبارات |
| أسرارٌ تموت باتّباع نصيحة النظام | كلُّها | **٠** |
| أحوالُ فشلٍ متمايزة | ٠ | ٤ (`reason`) |

`utils/secretVault.js` ٣٩ ← ٨٥، `server.js` ٣٧٥٢ ← ٣٧٥٨،
`systemDoctorAgent.js` ٢٠٢ ← ٢٠٨. الحصيلة ١١٩٨ ← ١٢٠٦.

---

## Sprint 3o — «صحّة الموقع» تُفتي في كودٍ لم تفحصه، ومقاييسُ المحذوف تُورَّث

`services/metricsStore.js` (٩٧ سطراً، مستهلكان، **بلا تغطية**) هي مصدرُ لوحةٍ
عنوانُها `siteHealth` — «صحّة الموقع».

### العطبُ الأوّل — الدرجةُ تبقى بعد أن يتغيّر الكود

`recordScore` يُستدعى داخل `try` في `jcr.js`، ووكيلا SEO والأمن يُخطَّيان
بصمت («⚠️ تخطّي») إن أخفقا أو لم يُنتجا ملفات. فالمسارُ الواقعيّ:

١. بناءٌ أوّل → `SEOAgent` ينجح → `seo: A/100`.
٢. بناءٌ ثانٍ لهدفٍ آخر → `SEOAgent` يُخطَّى → لا `recordScore`.
٣. اللوحة تعرض **SEO A 100%** عن موقعٍ لم يُفحص قط.

الحمولةُ كانت تحمل الطابع `at`، لكنّ الواجهة **لا تقرؤه في أيّ موضع**
(تحقُّقٌ بالبحث في `frontend/src` كلِّه)، و`fmtScore` تطبع `A 100%` بلا عمر:

```
بعد البناء:     seo= {"grade":"A","score":100,"at":…}
بعد ٢٠ تعديلاً: seo= {"grade":"A","score":100,"at":…}  ← نفسُ الدرجة، كودٌ مختلف
```

### العطبُ الثاني — حذفُ المشروع لا يمحو مقاييسه

`deleteProjectCompletely` يمحو ملفاتِ القرص وسجلَّ Mongo، ولا يمسّ
`metricsStore`. فمشروعٌ جديد بالاسم نفسه يرث درجاتِ المحذوف وعددَ بنائاته
و**نصوصَ أهدافه** (أوّل ٨٠ حرفاً من كلام المستخدم).

### الإصلاح

| الموضع | قبل | بعد |
|---|---|---|
| `withAge(score, lastBuildAt)` | — | `stale` مشتقٌّ من بياناتٍ موجودة أصلاً |
| `buildMetricsPayload` | `seo: m.seo` | `seo: withAge(m.seo, lastBuildAt)` |
| `clearMetrics(u, p)` | — | يمحو الذاكرةَ والمحفوظَ معاً |
| `deleteProjectCompletely` | لا يمسّ المقاييس | `await clearMetrics(...)` |
| `persistence.removeEntry` | — | نقيضُ `persistEntry`، **يُلغي المؤجَّل أوّلاً** |
| `fmtScore` | `A 100%` | `A 100% · قبل آخر بناء` |

`removeEntry` دقيقةٌ في موضعٍ واحد: `persistEntry` يؤجّل الكتابة ١٥٠٠ms،
فمحوٌ لا يُلغي المؤجَّلَ يُمحى بدوره — يعود المدخلُ من طابور الكتابة كأنّ
الحذف لم يقع. مُثبَتٌ باختبارٍ يُبدّل `readyState` ويعترض عمليّتَي `KV`.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| حذفُ وسم القِدَم | **٥** فشل |
| `clearMetrics` لا يمحو الذاكرة (`has` بدل `delete`) | فشلٌ واحد |
| `removeEntry` لا يُلغي المؤجَّل | فشلٌ واحد |
| درجةٌ غائبة تصير كائناً بدل `null` | فشلان |

### نتائجُ سلبية — فروضٌ سقطت بالقياس

- **`recordScore` بمفتاحٍ غير مُتحقَّق منه**: `m[kind] = …` بلا فحص، فظننتُ
  أنّ `kind` خاطئاً يُفسد `builds` أو `totalBuilds`. الاستدعاءاتُ الثلاثة
  كلُّها حرفيّة (`'quality'`، `'seo'`، `'security'`) — غيرُ قابلٍ للبلوغ.
- **`success` حقلٌ لا يكون إلّا `true`**: ظننتُه من عائلة «فحصٌ لا يفشل».
  `jcr.js:1331` يمرّر `success: false` فعلاً. حارسٌ مُضاف يمنع انحساره.
- **`cpuPct` من `os.loadavg()`**: في حاويةٍ يقرأ حِملَ المضيف ونواه لا
  الحاوية — كعطب الذاكرة في Sprint 3l. لكنّ هذه الآلة **بلا حدٍّ للمعالج**
  (`cpu.max` غير موجود، `cfs_quota_us = -1`)، فلا أستطيع إسقاطَ الفرض
  بقياس. تُرك موصوفاً لا مُصلَحاً: «قرائنُ حول الفرض ليست قياساً للفرض».

### خطُّ أساسٍ لسباقٍ لاحق

الفجوةُ الثانية ليست في هذه الوحدة وحدها: `deleteProjectCompletely` لا يمسّ
أيَّ مخزنٍ من المخازن المفاتيحُها `user:project` (أُحصيت أحدَ عشرَ في
Sprint 8/10). أُصلح هنا واحدٌ لأنّ أحدَ عشرَ في PR واحدٍ يخالف «تدريجي».

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `metricsStore.js` | ٠ | ٩ اختبارات |
| تغطيةُ `removeEntry` | — | ٣ اختبارات |
| درجاتٌ تُعرض بلا إشارةٍ إلى قِدَمها | كلُّها | **٠** |
| مقاييسُ مشروعٍ محذوف تُورَّث | نعم | **لا** |

`metricsStore.js` ٩٧ ← ١٢٠، `persistence.js` ٩٤ ← ١١٤،
`server.js` ٣٧٥٨ ← ٣٧٦٢. الحصيلة ١٢٠٦ ← ١٢١٨.

---

## Sprint 3p — «دائم في MongoDB» تعليقٌ لا فحص، والساعةُ ليست دليلاً على مَن كتب الملف

`services/pluginStore.js` (٨٧ سطراً، مستهلكان، **بلا تغطية**) هي التي تُبقي
وكلاء المالك المصنوعين من اللوحة أحياءً عبر إعادة نشر Render — قرصُه يُمسح
مع كلّ نشر.

### العطبُ الأوّل — الساعةُ لا تسجّل مَن كتب المحتوى

`restorePluginsToDisk` كانت تقرّر: `doc.updatedAt > mtime` القرص. وmtime
لا يقول مَن كتب المحتوى بل متى لُمس الملف — **ونشرُ Render يعيد سحبَ كلّ
ملفٍ متتبَّعٍ في git بطابعٍ جديد**.

```
$ git ls-files backend/plugins/
plugins/.gitkeep
plugins/site-checker.js      ← متتبَّع
```

فالمسارُ الواقعيّ: المالك يعدّل `site-checker.js` من اللوحة أمس → Mongo
`updatedAt = أمس`. نشرٌ اليوم → mtime القرص = الآن. `أمس > الآن` كاذب →
**تعديلُ المالك يُطرح صامتاً**، ويُبلَّغ `restored: 0` كأنّ لا شيء ينتظر.

الساعةُ ليست دليلاً، فالمقارنةُ صارت **بالمحتوى**. ومَن في Mongo لم يصل
إليها إلّا عبر اللوحة، فهي مرادُ المالك. وهذا يعني — بصراحة — أنّ نسخةً
مشحونةً أحدثَ قد تُغطَّى بتعديلٍ أقدمَ للمالك؛ تعارضٌ حقيقيّ لا يحسمه
الكود، فيُقال في السجلّ بدل أن يُبتلَع، مع بيانِ كيفيّة تفضيل نسخة المستودع.

### العطبُ الثاني — «دائم في MongoDB» تعليقٌ لا فحص

`persistPlugin` كانت `return;` صامتةً في كلّ إخفاق — بلا اتصالٍ أو باستثناء
— بينما يعلّق `adminService.js:121` «🗄️ دائم في MongoDB» ويردّ `created: true`،
والمسارُ يردّ `{ success: true, ... }`. فيرى المالكُ وكيلَه «أُنشئ» ويمحوه
أوّلُ نشر. الديمومةُ الآن ناتجٌ يُقال (`durable`, `durableReason`).

### العطبُ الثالث — تقريرٌ بأنّ شيئاً لم يقع بينما وقع ما لا يُستردّ

`deletePluginFile` كانت تنادي `removePlugin` (فتمحو النسخةَ الدائمة) ثمّ
تردّ `{ deleted: false }` إن غاب الملفُ عن القرص. صارت تفصل:
`{ deleted, durableRemoved, durable }`.

### العطبُ الرابع — «صفرٌ مُستعاد» جوابُ ثلاث حالات

بلا اتصال، وباستثناء، ولا شيء ينتظر — كلُّها `{restored: 0}`، والمستدعي
يعيد التحميل عند `restored > 0` فقط، فيمرّ العجزُ صامتاً. `ok` تفصل العجزَ
عن عدم الحاجة، والإقلاع يقول أيَّهما وقع.

### العطبُ الخامس — اسمان ينهاران إلى مفتاحٍ واحد

`safeFile` كانت **تمحو** الحروف غير المسموحة بدل أن ترفض الاسم:

```
"شاعر-عربي.js" → "-.js"        "وكيل.js" → ".js"        ".js".endsWith(".js") === true
```

فمفتاحان مختلفان يصيران واحداً في Mongo ويطمس أحدُهما الآخر. صار الشكلُ
مطابقاً لمخرَج `toPluginFileName` نفسِه: `/^[a-z0-9_][a-z0-9\-_.]*\.js$/i`.

### الدليل — سيناريو النشر بالكود الحيّ

```
🗄️ [PluginStore] استُعيد 1 إضافة من MongoDB
🗄️ [PluginStore] نسخةُ اللوحة غطّت نسخةَ القرص في: site-checker.js — …
النتيجة: {"ok":true,"restored":1,"unchanged":0,"failed":0,"skipped":0,"available":1}
هل نجا تعديلُ المالك؟ نعم
بلا اتصال → {"ok":false,"reason":"قاعدة البيانات غير متصلة",…}
حفظٌ بلا اتصال → {"durable":false,"reason":"قاعدة البيانات غير متصلة"}
```

### الطفرات

| الطفرة | النتيجة |
|---|---|
| عودةُ قاعدة mtime | فشلان |
| العجزُ يُبلَّغ `ok: true` | فشلٌ واحد |
| الحفظُ بلا اتصالٍ يدّعي `durable` | فشلان |
| عودةُ المحو بدل الرفض في `safeFile` | فشلان |
| الحذفُ يدّعي `removed: true` دائماً | فشلٌ واحد |

### خطئي في هذا السباق

اخترتُ لمِلقاطي أسماءَ ملفاتٍ عربية (`موجود.js`)، فسقط اختبارٌ بسببِ
تعقيمِ الوحدة لها لا بسببِ عطب. ومنه خرجت الفائدة: تتبُّعُ سببِ السقوط كشف
العطبَ الخامس — انهيارَ اسمين إلى مفتاح. الخللُ كان في المِرْقاة، والقياسُ
دلّ على غيره.

### نتيجةٌ سلبية

ظننتُ أنّ إضافةً باسمٍ عربيّ تصل إلى `safeFile` من مسار الإنشاء.
`toPluginFileName` يرفضها قبلَه صراحةً («إنجليزي/أرقام»). فالانهيارُ لم يكن
قابلاً للبلوغ من تلك الجهة — لكنّه فخٌّ كامنٌ في وحدةٍ عامّة، فشُدَّ.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `pluginStore.js` | ٠ | ٧ اختبارات |
| تعديلاتُ لوحةٍ تُطرح بعد النشر | كلُّها على ملفٍّ متتبَّع | **٠** |
| دعاوى «دائم» بلا سند | ٣ مواضع | **٠** |
| حالاتُ إخفاقٍ صامتة | ٤ | **٠** |

`pluginStore.js` ٨٧ ← ١٣١، `adminService.js` ٢٢٩ ← ٢٣٣،
`server.js` ٣٧٦٢ ← ٣٧٦٦. الحصيلة ١٢١٨ ← ١٢٢٥.

---

## Sprint 3q — زرُّ ⏹ لا يبلغ ما تَعِد به رسائلُ النظام نفسِه

`core/runtime/AbortRegistry.js` (٤٩ سطراً، **بلا تغطية**) هي ما وراء زرّ الإيقاف.

### العطب — النظامُ يُنكِر المهمةَ التي أخبر بها للتوّ

`abortMission` لا ترى إلّا مهمةً بلغت `registerMission` — وهو `jcr.js:1281`،
داخلَ `_runMissionNow`. ومسارُ المهمة قبله طويل:

```
executeMission → enqueueMission (jcr.js:1235)
   ├─ الصفُّ ممتلئ → «⏳ مهمتك في الصف (المركز N) وستبدأ تلقائياً»
   └─ pump() → Promise.resolve().then(job.run) → … → registerMission (1281)
```

ففي طورَين اثنين لا يجد الزرُّ شيئاً ويردّ **«لا توجد مهمة نشطة»**:

| الطور | ما يقوله النظام | ما يقوله الزرّ |
|---|---|---|
| منتظرةٌ في الصفّ | «مهمتك في الصف (المركز N)» | «لا توجد مهمة نشطة» ثمّ تبدأ وتُكمل |
| بدأت ولم تُسجَّل بعد | «يوجد بناء جارٍ… اضغط ⏹ لإيقافه أولاً» | «لا توجد مهمة نشطة» |

والرسالةُ الثانية تُحيل المستخدمَ صراحةً إلى زرٍّ لا يبلغ ما تَعِد به.

### الإصلاح

| الموضع | قبل | بعد |
|---|---|---|
| `ExecutionQueue.cancelWaiting` | — | يزيل مهمةً منتظرةً من الصفّ وسجلِّه |
| `AbortRegistry.requestAbortOnStart` | — | طلبٌ يُستهلَك عند أوّل `registerMission` |
| `registerMission` | يُنشئ متحكّماً حرّاً | يستهلك الطلبَ المعلَّق فيولد مُلغىً |
| `clearMission` | يمحو المهمة | ويمحو الطلبَ المعلَّق معها |
| `stopMission(u, p, room)` | — | مصدرٌ واحد: `aborted` / `cancelled` / `pending` / `none` |
| المساران (`/api/ai/abort` والـsocket) | `abortMission` وحدها | `stopMission` + رسالةٌ لكلّ طور |

`socket.username` لم يكن يُضبط عند الانضمام — أُضيف، وإلّا عاد مسارُ الـsocket
لا يسأل الصفَّ صامتاً.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| الزرُّ لا يبلغ الصفَّ | **٣** فشل |
| الطلبُ المعلَّق لا يُستهلَك عند التسجيل | فشلٌ واحد |
| حذفُ معالجة النافذة العمياء | فشلٌ واحد |
| `clearMission` لا يمحو الطلبَ المعلَّق | **نجت أوّلاً** — انظر أدناه |
| `cancelWaiting` لا يزيلها من الصفّ | فشلان |

**طفرةٌ نجت، للمرّة الثالثة في هذا العمل.** حارسُ «التنظيف يمحو الطلبَ
المعلَّق» لم يكن له اختبارٌ يميّزه: اختباري كان يمرّ بحالة `cancelled` لا
`pending`، فلا يُسلَّح طلبٌ أصلاً. كُتب اختبارٌ يُدخِل المهمةَ النافذةَ
العمياء ثمّ يُميتها **قبل** التسجيل، فيبقى الطلبُ مسلَّحاً ويُمتحَن التنظيف.
أُعيدت الطفرة → سقطت. **تحسينٌ لا تُسقطه طفرتُه دعوى، لا إصلاح.**

### نتيجةٌ سلبية — فرضٌ سقط بالقياس

ظننتُ أنّ `clearMission` لمهمةٍ قديمة يمحو قيدَ مهمةٍ أحدثَ حلّت محلَّها
(`registerMission` يستبدل القيد، و`finally` القديم يحذفه) فتصير الجديدةُ
غيرَ قابلةٍ للإيقاف. غيرُ قابلٍ للبلوغ: `enqueueMission` يرفض
`already_running` لنفس `username:project`، والمواضعُ الأربعة التي تنادي
`_runMissionNow` مباشرةً كلُّها احتياطاتٌ داخل تدفّقٍ واحدٍ جارٍ، لا توازياً.

### خطئي في هذا السباق (مرّتان في المِرْقاة)

١. ملأتُ خانات التوازي بمهامٍّ لا تنتهي في اختبار، فبقيت مشغولةً للاختبار
   التالي — فقِستُ «مهمةٌ في الصفّ» وأنا أحسبني أقيس «مهمةٌ بدأت».
٢. جمعتُ دوالَّ التحرير فورَ الاستدعاء، و`pump` يبدأ المهمة عبر
   `Promise.resolve().then(job.run)` — أي في دورةٍ لاحقة. فكانت المصفوفةُ
   فارغةً والتحريرُ لا يُحرّر شيئاً.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `AbortRegistry.js` | ٠ | ٧ اختبارات |
| أطوارٌ لا يبلغها زرُّ ⏹ | ٢ من ٣ | **٠** |
| أجوبةُ الزرّ المتمايزة | ٢ | ٤ |

`AbortRegistry.js` ٤٩ ← ٨٤، `ExecutionQueue.js` ١٣٥ ← ١٥٥،
`server.js` ٣٧٦٦ ← ٣٧٨١. الحصيلة ١٢٢٥ ← ١٢٣٢.

---

## Sprint 3r — قراراتُ المالك الثلاثة المعلَّقة (٥ سبتمبر ٢٠٢٦)

كانت ثلاثةٌ موقوفةً على المالك منذ سباقاتٍ سابقة. جاء جوابُه: ١ «لو في طريقة
قم بذلك أو انتظر حتى أستطيع فعلها بنفسي»، ٢ «افعل ما هو صحيح»، ٣ «دعه وصححه».

### ١) معاينات Vercel — طريقةٌ وُجدت، فلم يُنتظَر

الحصّةُ المجانية (١٠٠ نشرة/يوم) نفدت **ثلاث مرّات** في هذا العمل، فصار كلُّ
PR يحمل فحصاً أحمرَ لا علاقة له بالكود. وكنتُ سجّلتُ سابقاً أنّ وثائق Vercel
محجوبةٌ خلف وكيل الخروج — لكنّي لم أكن جرّبتُ **المخطَّط** نفسَه:

```
$ curl https://openapi.vercel.sh/vercel.json  →  200
git.deploymentEnabled:
  "Specifies the branches that will not trigger an auto-deployment…
   Any non specified branch is `true` by default."
  oneOf: boolean | { [branch]: boolean }
```

فأُضيف إلى `frontend/vercel.json`:

```json
"git": { "deploymentEnabled": { "claude/performance-review-optimization-4czwh2": false } }
```

`main` غيرُ مذكور ⇒ يبقى `true` بحكم المخطَّط ⇒ **نشرُ الإنتاج لا يتأثّر**.

**المصادقة قبل الدفع** (والملفُّ حسّاس: `additionalProperties: false`، ومفتاحٌ
زائدٌ أفشل النشرَ كلَّه في ٢٥ أغسطس):

```
vercel.json صالحٌ على مخطَّط Vercel الرسميّ؟ نعم ✅
حارسُ النقيض — مفتاحٌ مخترَع يُرفض؟ نعم ✅
وقيمةٌ خاطئة تُرفض؟ نعم ✅
```

وحارسُ `spaFallback.test.mjs` وُسّع بمفتاحٍ واحدٍ مع تسجيلِ **كيف** صودق، مع
اختبارٍ جديدٍ يثبّت أنّ فرعَ الوكيل معطَّلٌ و`main` غيرُ مذكور.

### ٢) `--force` يمحو تاريخ مستودع المستخدم — «افعل ما هو صحيح»

مستودعُ المشروع يُنشأ بـ`git init` محلّيّاً، فلا تاريخَ مشتركاً له مع البعيد.
والدفعُ كان `--force` **دائماً وبلا شرط**: أيُّ عملٍ في مستودع المستخدم —
التزاماتُ زملائه، ما كتبه بيده — يُمحى في لحظة، بلا سؤالٍ ولا أثر.

الدفعُ صار يسأل البعيدَ أوّلاً (`ls-remote` ثمّ `fetch` لذلك المرجع وحده ثمّ
`merge-base --is-ancestor`):

| الحال | قبل | بعد |
|---|---|---|
| الفرعُ غيرُ موجود | `--force` | دفعٌ عاديّ بلا قوّة |
| البعيدُ سلفٌ لِما عندنا | `--force` | دفعٌ عاديّ (تقدّمٌ سريع) |
| تاريخٌ مفترق | **يمحوه صامتاً** | **يرفض** ويقول كم التزاماً كان سيُمحى |
| تاريخٌ مفترق + إذنٌ صريح | — | يستبدل (`overwriteRemote: true`) |
| عجزٌ عن الحكم (الجلب يخفق) | `--force` | يُعامَل افتراقاً — لا يُدفع على جهل |

والقوّةُ حين تلزم صارت `--force-with-lease=<فرع>:<sha>`: ترفض إن تحرّك
البعيدُ بين الفحص والدفع.

**الدليل** (مستودعاتٌ حقيقيّةٌ على القرص):

```
── فرعٌ فيه عملُ المستخدم، بلا إذن ──
{"success":false,"diverged":true,"remoteCommits":1,"error":"…سيمحوها نهائياً…"}
   أنجا عملُ المستخدم؟ c4d09c2 التزامُ المستخدم
── فرعٌ غيرُ موجود ── {"success":true,"branch":"fresh-branch"}
── الآن بإذنٍ صريح ── تاريخُ main بعد الإذن: 44ae047 توليد
```

### ٣) ترويسةُ `refactorAgent` — «دعه وصححه»

بقي محافظاً كما أوصيتُ، وصُحّحت الترويسةُ: كانت تَعِد بأربعةٍ لا يفعلها
(«إزالة الكود المكرر»، «تنظيم CSS Variables»، «تحسين أسماء المتغيرات»،
«تقسيم الدوال الطويلة»). وتلك دعاوى تُقرأ عقداً: مَن يقرؤها يظنّ الوكيلَ
يُعيد الهيكلة فلا يفحص ما بقي.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| عودةُ الدفع بلا سؤال | فشلٌ واحد |
| قوّةٌ عمياء دائماً بدل الحيازة المشروطة | **نجت أوّلاً** ↓ |
| كلُّ بعيدٍ يُعدّ سلفاً | فشلٌ واحد |
| عجزُ الجلب يُقرأ أماناً | **نجت أوّلاً** ↓ |

**طفرتان نجتا.** «عجزُ الجلب» لم يكن له اختبار لأنّي لم أعرف كيف أبني تلك
الحالة؛ بُنيت بحذف `objects/` من مستودعٍ بعيدٍ بعد الدفع إليه من مستودعٍ
**آخر** — فيقرأ `ls-remote` المرجعَ ويعجز الجلب. و«القوّةُ العمياء» لم يكن
لها اختبارٌ لأنّ حارسي أثبت خاصّيةَ git لا أنّ كودي يستعملها؛ استُخرج القرارُ
إلى `forceFlags(branch, remoteState)` فصار يُقاس. أُعيدت الطفرتان → سقطتا.

### حارسان قائمان التقطا تغييري — وكلاهما كان محقّاً

- `gitAgent.test.mjs`: «كلُّ نداءِ `runGit` مصفوفةٌ حرفيّة». مِفصلي الأوّل
  (`buildPushArgs(...)`) كسره. لم يُضعَّف الحارس؛ غُيِّر المِفصل ليُعيد
  **لاحقةً** تُنشر داخل المصفوفة الحرفيّة.
- `spaFallback.test.mjs`: قائمةُ مفاتيح `vercel.json` البيضاء، من درسٍ حيّ
  في ٢٥ أغسطس. وُسّعت بمفتاحٍ واحدٍ مُصادَق، لا بإلغاء القائمة.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ دفع GitHub | ٣ اختبارات (gitAgent) | +٩ |
| مسالكُ تمحو تاريخَ المستخدم بلا إذن | ١ | **٠** |
| فحوصٌ حمراءُ لا علاقة لها بالكود | Vercel في كلّ PR | **٠** (على هذا الفرع) |
| دعاوى في ترويسة `refactorAgent` لا يفعلها | ٤ | **٠** |

`gitAgent.js` ١٩٧ ← ٢٦١، `refactorAgent.js` ٢٣٤ ← ٢٣٩،
`githubSync.js` ١١٠ ← ١١١، `security.js` ٩٤ ← ٩٦، `server.js` ٣٧٨١ ← ٣٧٨٢.
الحصيلة ١٢٣٢ ← ١٢٤٢.

---

## Sprint 3s — محرِّرُ ملفات GitHub يعرض ما ليس نصّاً، وحفظُه يُتلف مستودعَ المستخدم

`services/githubFiles.js` (٨٣ سطراً، **بلا تغطية**) تُغذّي متصفّحَ ملفات
GitHub في لوحة الأدمِن. وكلُّ ما يعود من `getFile` يدخل مربّعَ نصٍّ في
`AdminPanel.jsx:1104`، ثمّ يكتبه `putFile` في مستودع المستخدم — فهو ادّعاءٌ
بأنّه «نصُّ الملف».

### العطبُ الأوّل — الملفُّ الثنائيّ يُعرض نصّاً، وحفظُه يُتلفه

**قياسٌ حقيقيٌّ على واجهة GitHub الحيّة** (المستودع نفسُه، بتوكن الجلسة):

```
الملف: frontend/public/apple-touch-icon.png
الحجم الحقيقيّ : 8235 بايت | encoding = base64
بعد decode utf8: 14763 بايت
أَتطابق الجولةُ كاملةً؟ لا — الملفُّ يتلف عند الحفظ
```

الأدمِن يفتح صورةً في المحرّر فيرى محارفَ استبدال، وضغطةُ «حفظ» تكتب هذا
التلفَ التزاماً في مستودع المستخدم. الجولةُ هي الحَكَم الآن: ما لا يعود من
utf8 كما دخل ليس نصّاً، فيُرفض بـ415 ورسالةٍ تقول لماذا.

### العطبُ الثاني — محتوىً لم تُرسله الواجهة يُعرض ملفاً فارغاً

`Buffer.from(data.content || '', data.encoding === 'base64' ? 'base64' : 'utf8')`
— حين لا يكون الترميزُ base64 (وهو ما توثّقه GitHub للملفات الكبيرة:
`encoding: "none"` و`content` فارغ) يخرج `''`. فيُعرض **ملفٌّ فارغ** على أنّه
المحتوى، وحفظُه يمحو الأصل.

لم أستطع قياسَ سلوك GitHub للملفات فوق الميغابايت: وكيلُ الخروج يمنع
مستودعاتٍ خارج نطاق الجلسة، ولا ملفَّ بهذا الحجم في المستودع المتاح. فالمقيسُ
هو **عقدُ الوحدة نفسِها** (بـfetch مُستبدَل): أيُّ ردٍّ بلا `content` من نوع
base64 كان يُقدَّم نصّاً فارغاً — وهذا كافٍ للحكم، وسلوكُ GitHub ذُكر دافعاً
موثَّقاً لا قياساً لي.

### العطبُ الثالث — قائمةٌ مبتورةٌ تُعرض قائمةً كاملة

`listRepos` كانت صفحةً واحدة (`per_page=100`). فمن له أكثرُ من مئة مستودع لا
يجد مستودعَه، ولا شيء يقول إنّ القائمة مبتورة — يقرؤها «ليس لي هذا المستودع».
صارت تُرقّم حتى خمس صفحات وتُعلن `truncated`، والواجهةُ تقولها للأدمِن.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| الثنائيُّ يُقدَّم نصّاً | فشلٌ واحد |
| المحتوى الغائب يُقدَّم فارغاً | فشلٌ واحد |
| عودةُ الصفحة الواحدة | فشلان |
| البترُ لا يُعلَن | فشلٌ واحد |

### خطئي في هذا السباق

أوّلُ جردٍ للمستدعين قال «`githubFiles.js` بلا مستدعٍ واحد»، وكدتُ أبني عليه
دعوى «وحدةٌ ميتة والترويسةُ تكذب». والسببُ مُرشِّحي:
`grep -v 'services/githubFiles.js'` يستبعد كلَّ **سطرٍ يذكر المسار** — ومنه
سطرُ الاستيراد نفسُه في `server.js:78`. أداةُ القياس حجبت ما جئتُ أقيسه.
هذه ثالثةُ مرّةٍ يكون فيها الخللُ في المِرْقاة لا في المقيس؛ والدرسُ نفسُه:
لا يُبنى حكمٌ على غيابٍ حتى يُفحص المُرشِّح.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `githubFiles.js` | ٠ | ٨ اختبارات |
| مسالكُ تُتلف ملفَّ المستخدم من المحرّر | ٢ | **٠** |
| قوائمُ مبتورةٌ تُعرض كاملة | ١ | **٠** |

`githubFiles.js` ٨٣ ← ١٣٤، `server.js` ٣٧٨٢ ← ٣٧٨٣. الحصيلة ١٢٤٢ ← ١٢٥٠.

---

## Sprint 3t — واحدٌ وعشرون نوعاً من واحدٍ وثلاثين تُبنى بصور المكاتب

`services/imageService.js` (٦٩ سطراً، **بلا تغطية**) تحقن في سياق البناء
روابطَ يضعها وكيلُ البرمجة في `img src` مباشرةً — فهي ما يراه زائرُ الموقع
المولَّد.

### العطب — خريطةٌ يدويّةٌ انجرفت عن سجلّها

`TYPE_QUERIES[projectType] || TYPE_QUERIES.business`: عشرةُ مفاتيحَ مكتوبةٍ
بيد، مقابل أنواعٍ يُنتجها `detectProjectType` من `knowledge/design-rules.json`.
قياسُ التقاطع:

```
أنواعُ design-rules (31): agency, automotive, beauty, blog, booking, business,
  clinic, construction, crypto, ecommerce, education, entertainment, finance,
  gaming, gym, hotel, interior, law, medical, music, news, nonprofit,
  photography, portfolio, realestate, restaurant, saas, startup, tool, travel, wedding
مفاتيحُ TYPE_QUERIES (10): business, clinic, ecommerce, education, gym,
  hotel, medical, portfolio, realestate, restaurant

بلا كلمةِ بحث → صورُ «business office team»: 21 نوعاً
```

عرسٌ وصالونُ تجميل ومكتبُ محاماة ووكالةُ سيارات وموقعُ سفرٍ ومعرضُ تصوير —
كلُّها تُبنى بصور مكاتبَ وفرقِ عمل. والسياقُ المحقون يقول للوكيل «صور حقيقية
جاهزة للاستخدام… استخدمها في img src مباشرة».

### الإصلاح — اشتقاقٌ من السجلّ لا قائمةٌ ثانية

أسماءُ الأنواع في `design-rules.json` **إنجليزيةٌ أصلاً**. فصار:

```js
export function queryForType(projectType) {
    const type = String(projectType || '').trim().toLowerCase() || 'business';
    const hint = QUERY_HINTS[type];
    return hint ? `${type} ${hint}` : type;      // wedding → "wedding"
}
```

`QUERY_HINTS` تُبقي إثراءَ العشرة الموجودة (`restaurant food gourmet`)، وما
عداها يُبحث باسمه. **لم أضف إثراءً لم أقِسه**: `saas` و`tool` و`startup` أسماءٌ
ضعيفةٌ بحثاً، لكنّ أيَّ إضافةٍ منّي دعوى بلا قياس — وقد تُقاس لاحقاً بمفتاح
Pexels حيّ.

وسطرُ العنوان المحقون صار يفرّق: صورُ Pexels «مطابقة لموضوع «{query}»»،
وصورُ picsum «غير مطابقة للموضوع — استخدمها خلفياتٍ بلا تسمياتٍ موضوعيّة»،
كي لا يبني الوكيلُ عليها تسمياتٍ كاذبة («فريقنا»، «طبقُ اليوم»).

### الطفرات

| الطفرة | النتيجة |
|---|---|
| عودةُ السقوط إلى business | **٤** فشل |
| الاحتياطُ يُقدَّم مطابقاً للموضوع | فشلٌ واحد |
| بلا تطبيعٍ ولا افتراضيّ | فشلٌ واحد |
| روابطُ فارغةٌ تُحقن (`filter(Boolean)` محذوف) | فشلٌ واحد |

الحارسُ الأوّل **مشتقٌّ من `design-rules.json` نفسِه**: كلُّ نوعٍ فيه يجب أن
يظهر اسمُه في استعلامه، ولا نوعَ غيرُ `business` يُبحث بكلمات المكاتب. فلا
تعود القائمتان تنجرفان — أضِف نوعاً غداً وهو مغطّىً بحكم الاشتقاق.

### نتيجةٌ سلبية

بدأتُ بفرضٍ أضيق: «الأنواعُ لا تتطابق أصلاً». عيّنةٌ من اثني عشر هدفاً واقعياً
أعطت أحدَ عشرَ نوعاً، عشرةٌ منها في الخريطة (`blog` وحدَه ساقط) — فبدا العطبُ
هامشياً. القراءةُ من السجلّ الكامل بدل العيّنة قلبت الحكم: ٢١ من ٣١.
**العيّنةُ قاست ما اخترتُه أنا، لا ما يُنتجه النظام.**

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `imageService.js` | ٠ | ٧ اختبارات |
| أنواعٌ تُبنى بصورٍ لا تخصّها | ٢١ من ٣١ | **٠** |
| دعوى «مطابقة للموضوع» على صورٍ عشوائية | نعم | **لا** |

`imageService.js` ٦٩ ← ٩٢. الحصيلة ١٢٥٠ ← ١٢٥٧.

---

## Sprint 3u — توثيقٌ يَعِد بإعادة الضبط وكودٌ يفعل نقيضَه

آخرُ وحدتين حيّتين صغيرتين بلا تغطية: `services/chainProvider.js` (٤٠) و
`services/adminUsers.js` (٦٦). الأولى فيها عطبٌ حقيقيّ، والثانية سليمةٌ —
وكِلا الحُكمين مقيسٌ لا مُفترَض.

### العطب

`_setProviderForTest` توثيقُها: «يفرض مزوّداً وهمياً (**أو null لإعادة
الضبط**)». وفي السطر ١٦ من الملفّ نفسِه تعليقٌ يقول عكسَها: «undefined = لا
تجاوز، أي قيمة أخرى (**بما فيها null**) تُستخدَم كما هي». مصدرا حقيقةٍ
يتناقضان في أربعين سطراً — والكودُ كان يتبع الثاني.

المقياس (تشغيلٌ لا قراءة):

```
بعد حقنِ وهميّ                → {"fake":1}
بعد _setProviderForTest(null) → null
أَعادَ الضبطَ كما يعد التوثيق؟  لا — صار المزوّدُ null دائماً
```

و«دائماً» حرفيّةٌ: التجاوزُ يبقى مخزَّناً لبقيّة عمر العملية. فمَن نظّف
باتّباع العقد المكتوب سمَّم كلَّ اختبارٍ بعده في الملفّ نفسِه، ثمّ يستلم
`tradingBotEngine.js:54` مزوّداً `null` فيسقط بخطأٍ لا يدلّ على سببه —
والسببُ في اختبارٍ سابقٍ اتّبع التوثيق. لا مستهلكَ يحقن `null` عمداً
(مزوّدٌ فارغٌ يكسر كلَّ نداء)، فرُجّح العقدُ المكتوب وحُذفت الدعوى المخالفة.

بعد الإصلاح: «null → مزوّدٌ حقيقيّ ✅ (أُعيد الضبط كما يَعِد التوثيق)».

### `adminUsers.js` — ثلاثةُ فروضٍ سقطت، والتغطيةُ بقيت مستحقّة

الوحدةُ تمسّ الفوترة، وترويستُها تحذّر بنفسها أنّ اقترانَ الخطة بالحالة سهلُ
الخطأ. بحثتُ عن عطبٍ فلم أجد:

| الفرض | لماذا سقط |
|---|---|
| المنحةُ اليدويّة تُبطَل بـ`currentPeriodEnd: null` | `subscriptionService.js:23`: `!sub.currentPeriodEnd \|\| …` — الفارغُ «بلا انتهاء» |
| `listUsers` تُظهر اسماً لا يجده `setUserPlan` بعد `.toLowerCase()` | `models/User.js:14` يُصرّح `lowercase: true` فالمُخزَّنُ مُصغَّرٌ أصلاً |
| `{offline: true}` تبتلعه الواجهةُ فتُقرأ «لا مستخدمين» | `AdminPanel.jsx` يفحصه صراحةً ويعرض `admDbOffline` |

**ونتيجةٌ سلبيّةٌ رابعة**: الخدمةُ تُصغّر ولا تُشذّب، فيخرج منها
`'  ahmed  '`. بدا عطباً؛ والقياسُ نفاه — صبُّ mongoose يُطبّق `trim`
و`lowercase` من النموذج على فلتر الاستعلام:

```
فلترٌ مصبوب (findOneAndUpdate): {"username":"ahmed"}
```

فلا إصلاحَ في الخدمة. لكنّ الحمايةَ صارت في النموذج لا حيث يظنّها القارئ،
فثُبِّت **الطريقُ كاملاً**: اختبارٌ يقول إنّ الخدمةَ تُخرج الفراغَ، وآخرُ
يقول إنّ الصبَّ يُغلقه. لو رُفع `trim` غداً ظنّاً أنّ الخدمةَ تُشذّب، سقط.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| `null` يعود تجاوزاً كما كان | فشلٌ واحد |
| الحالةُ لا تُضبط مع الخطة (`status='none'`) | فشلٌ واحد |
| المجانيّةُ تُفعَّل (`status='active'`) | فشلٌ واحد |
| لا تصغيرَ قبل الاستعلام | **٢** فشل |
| رُفع `trim` عن `models/User.js` | فشلٌ واحد |
| البحثُ بلا تهريب (`new RegExp(search)`) | فشلٌ واحد |
| الانقطاعُ يُبتلَع صامتاً (`offline` محذوفة) | فشلٌ واحد |

الاختبارُ الأوّل لا يكتفي بقراءة الحقل الراجع، بل يمرّره إلى المستهلك
الحقيقيّ `getUserSubscription` ويسأل: أتُقرأ المنحةُ خطّةً سارية فعلاً؟ —
لأنّ العطبَ الذي تحذّر منه الترويسةُ يظهر هناك لا هنا.

### خطأٌ في المِرْقاة لا في المقيس

ثلاثةٌ من اختبارات `adminUsers` سقطت أوّلَ تشغيل. السببُ كلَّه في يدي: مرّرتُ
`withDb({ username: 'u' })` — كائنَ المستخدم مكانَ حقيبةِ الخيارات، فبقي
`found` على `null` وسلكت كلُّ نداءٍ فرعَ «المستخدم غير موجود». لو صدّقتُ
السقوطَ لكتبتُ «عطباً» في وحدةٍ سليمة.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `chainProvider.js` | ٠ | ٥ اختبارات |
| تغطيةُ `adminUsers.js` | ٠ | ٨ اختبارات |
| `_setProviderForTest(null)` | يُسمّم العمليّة | يُعيد الضبط |
| مصادرُ الحقيقة في `chainProvider` | ٢ متناقضان | ١ |

`chainProvider.js` ٤٠ ← ٥٤. الحصيلة ١٢٥٧ ← ١٢٧٠.

---

## Sprint 3v — الجالبُ الذي يسحب كودَ الغرباء: حارسُه في ما لا يَطلبه

`agents/starterFetch.js` (١٧١) وحدةٌ حيّةٌ خلف `/api/admin/starters/import`،
تسحب كودَ مستودعاتٍ خارجيّة إلى داخل المنصّة، وكانت بلا تغطية. **لم يُوجد
فيها عطب** — فرضان سقطا بالقياس — وغُطّيت لأنّ خطرَها ليس في منطقها بل في
**ما قد تسحبه**.

### فرضان سقطا

**الأوّل**: `encodeURIComponent(o.ref)` يكسر الفروعَ ذاتَ الشرطة
(`feature/x`)، فيُلام المستودعُ على خطأٍ في صيغة المرجع. القياسُ على فرعٍ
حقيقيّ ذي شرطة نفاه — GitHub يفكّ `%2F` ويطابق الفرع:

```
git/trees/claude%2Fperformance-review-optimization-4czwh2 → 200
git/trees/claude/performance-review-optimization-4czwh2  → 200
```

**الثاني**: `o.ref` يدخل رابطَ `raw` **بلا ترميز**، فيخرج من المستودع الذي
تدّعيه `meta`. التطبيعُ يؤكّد الخروج فعلاً:

```
.../vercel/commerce/HEAD/../../../facebook/react/HEAD/README.md
  → https://raw.githubusercontent.com/facebook/react/HEAD/README.md
```

لكنّه **غيرُ قابلٍ للبلوغ**: نداءُ الشجرة يسبق كلَّ جلبٍ خام ويجب أن يُحلّ
مرجعاً حقيقياً، و`git` نفسُه يمنع `..` في أسماء المراجع:

```
main/../../x/y/main → مرفوض      git branch 'tmp/../../x' → fatal: not a valid branch name
```

**وخطأٌ في المِرْقاة يُسجَّل**: حاولتُ أوّلاً إثباتَ المنع بضرب واجهة GitHub
بمراجعَ متسلّقة فجاء `403` — وليس ذلك جوابَ GitHub بل فحصَ وكيل الشبكة
لنطاق المستودعات. **قياسٌ لم يُثبت شيئاً**، والحاسمُ هو قاعدةُ `git` أعلاه.

### ما ثُبِّت

الحارسُ الأهمّ ليس «ما يرجع» بل **ما لا يُطلَب**: السرُّ (`.env`,
`apps/web/.env`) والثنائيّ (`png`, `woff2`) والأقفال والضخم — لا تُفتح لها
الشبكةُ أصلاً. الاختبارُ يسأل سجلَّ الطلبات لا قائمةَ النتائج.

| الطفرة | النتيجة |
|---|---|
| `SKIP_FILE` مُعطَّل (الأسرارُ والأقفال تُجلَب) | فشلٌ واحد |
| لا حصرَ للامتدادات (الثنائيّاتُ تُجلَب) | فشلٌ واحد |
| حجمُ الشجرة يُتجاهَل | فشلٌ واحد |
| لا إعادةَ فحصٍ بعد التنزيل | فشلٌ واحد |
| سقفُ العدد مرفوع | فشلٌ واحد |
| سقفُ المجموع مرفوع | فشلٌ واحد |
| `truncated` تُكتَم | فشلٌ واحد |
| حالةُ الشجرة تُطمَس (٤٠٤ ← ٥٠٠) | فشلٌ واحد |
| الملفُّ الساقط يُسلَّم فارغاً | فشلٌ واحد |
| القالبُ الداخليّ يُرجع فراغاً بلا قول | فشلٌ واحد |

طفرةُ «إعادة الفحص بعد التنزيل» تستحقّ اسمَها: الشجرةُ قد تكذب في الحجم أو
تسكت عنه، فحدُّ الملف يُعاد فحصُه على المُنزَّل لا على ما ادّعته الشجرة.
وطفرةُ `truncated` تحرس الصدقَ نفسَه: الشجرةُ المقصوصة تُقال مقصوصةً، فلا
يُقرأ القالبُ الناقص كاملاً.

### ملاحظةٌ مسجَّلة لا مُصلَحة

لو سقط كلُّ جلبٍ خام (مرجعٌ خطأ مثلاً) رجع المسارُ `success: true` مع
`files: []` و`skipped: N`. الفرقُ مقروءٌ في `meta` لمن يقرؤها، ولا مستهلكَ
اليومَ يقرأ غير `success` — ولا واجهةَ تستدعي المسار أصلاً. فتُسجَّل ولا
تُصلَح: «لا تغييرَ بلا مستهلكٍ حقيقيّ».

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `starterFetch.js` | ٠ | ١٠ اختبارات |
| ما يُطلب من الشبكة لملفٍّ ممنوع | غيرُ محروس | **٠ طلبات**، محروسٌ بطفرة |

الوحدةُ لم تتغيّر (١٧١ سطراً كما هي). الحصيلة ١٢٧٠ ← ١٢٨٠.

---

## Sprint 3w — تقريرُ التسليم يسمّي قالباً لم يدخل منه سطرٌ واحد

في كلّ بناءِ React كان المستخدم يقرأ في تقرير التسليم:

```
⚛️ Next.js + Tailwind · ٥ صفحة · ٨ مكوّن · قالب: Next.js SaaS + Stripe
```

والقالبُ المسمَّى لم يُقرأ في البناء إطلاقاً. مقيسٌ لا مفترَض — من خصائصه
الأربع التي يَعِد بها اسمُه، **صفرٌ** في السبعة عشر ملفاً المُسلَّمة:

```
subscriptions → غير موجود      stripe    → غير موجود
auth          → غير موجود      dashboard → غير موجود
ولا ملفَّ واحداً من github.com/vercel/nextjs-subscription-payments
```

`generateNextScaffold` لا يستقبل قالباً أصلاً؛ توقيعُه
`{projectName, sections, features, lang, title, content}`. و`starter` كان
يُمرَّر إلى `_buildReactProject` ولا يُقرأ فيها **إلا في سطرَي التقرير**.

الضررُ ليس تجميلياً: مَن قرأ «قالب: Next.js SaaS + Stripe» بنى توقّعاً أنّ
مشروعه يحوي اشتراكاتٍ ومصادقةً ودفعاً، فيكتشف الفراغَ بعد أن يكون قد وعد
عملاءه. **دعوى مصدرٍ بلا مصدر.**

وأسوأُ صورِها مقيسةٌ أيضاً: `restaurant` أو `portfolio` بنطاقٍ «متكامل»
يُوجَّه إلى `react-next` بينما `selectStarter` يُرجع قالباً **Vanilla**
(`repo: null`)، فيُكتب في السجلّ الحيّ: «🧰 مشروع كبير → React/Next
(Restaurant (Vanilla))» — مسارٌ ثقيلٌ باسم قالبٍ خفيف.

### الإصلاح

يُحذف ذكرُ القالب من التقرير ومن سجلّ الموجّه، ويُحذف اختيارُه من مسار
البناء. المسارُ يُقرّره `resolveStack` وحدَه — وهو حقيقيّ. حين يُجلب قالبٌ
حقيقيّ فعلاً (عبر `fetchStarter`، وهي مغطّاةٌ من Sprint 3v) يعود ذكرُه
مسنوداً بكوده. السجلُّ نفسُه لم يُمَسّ: `listStarters` و`STARTERS` ما زالتا
تخدمان مسارَي الأدمِن.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| الدعوى الفارغة تعود إلى تقرير التسليم | فشلٌ واحد |
| `selectStarter` يعود إلى مسار البناء بلا جلب | فشلٌ واحد |
| السكافولد يحمل أثرَ القالب (فتصير الدعوى صادقة) | فشلٌ واحد |
| `listStarters` تُعيد السجلَّ نفسَه لا نسخة | فشلٌ واحد |
| كلُّ مشروعٍ يُوجَّه إلى React | فشلٌ واحد |
| رخصةٌ غيرُ MIT في قالبٍ خارجيّ | فشلٌ واحد |

الطفرةُ الثالثة مقصودةٌ **تنبيهاً لا منعاً**: لو صار السكافولد يحمل القالبَ
فعلاً سقط الحارس، فيُحدَّث ويعود الاسمُ إلى التقرير — صادقاً هذه المرّة.

### خطأٌ في المِرْقاة

كتبتُ الحارسَ النصّيّ `!/selectStarter/` فأسقطه **تعليقي أنا** الذي يشرح
سببَ الحذف. القاعدةُ نداءٌ لا ذِكر: `/selectStarter\s*\(/`. شرحُ العطب لا
يجوز أن يُقرأ عودةً له.

### ملاحظةٌ مسجَّلة

`selectStarter` بلا مستهلكٍ الآن (بقيت `resolveStack` و`listStarters`
و`STARTERS`). لم تُحذف: هي واجهةُ السجلّ للمسار الهجين القادم، وحذفُ واجهةٍ
قرارٌ مستقلّ — يُسجَّل ولا يُنفَّذ ضمناً.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `starterRegistry.js` | ٠ | ٦ اختبارات |
| دعوى «قالب: X» في تقرير React | في كلّ بناء | **٠** |
| خصائصُ القالب المزعوم في المُسلَّم | ٠ من ٤ | ٠ من ٤ (ولا تُدّعى) |

`jcr.js` ٣٢٢٣ ← ٣٢٢٩. الحصيلة ١٢٨٠ ← ١٢٨٦.

---

## Sprint 3x — وكيلُ القالب: قاعدةُ دهسٍ غيرُ بديهيّة على ملفّ المستخدم

`agents/template.agent.js` (٣٨) يكتب أوّلَ ملفَّين في مشروع المستخدم على
المجلد الفارغ ثمّ يُغذّي الهويةَ البصرية للمبرمج. **لا عطبَ فيه** — فرضان
سقطا — وغُطّي لأنّه يكتب في مشروعٍ حقيقيّ بقاعدةٍ لا يحزرها القارئ:
يستبدل `styles.css` القائمَ إن كان أقصرَ من خمسين محرفاً.

### فرضان سقطا

**الأوّل**: الأساسُ يستعمل `var(--font)` و`var(--text)` و`var(--bg)`، فهل
يعرّفها كلُّ نوع؟ المقياسُ على السجلّ كلِّه — لا على عيّنةٍ أختارها أنا،
وهو الخطأُ الذي وقعتُ فيه في Sprint 3t:

```
عددُ الأنواع: 31    ينقصها متغيّرٌ يستعمله القالب: 0
```

**الثاني**: `:root` يحوي `--bg` و`--text` مرّتين (يُلحقهما البناءُ فوق ما
جاء من ألوان النوع)، فهل تختلف القيمتان يوماً فتفوز الأخيرةُ صامتةً؟

```
مفاتيحُ مكرّرةٌ بقيمتين مختلفتين: 0 (في الأنواع الواحد والثلاثين)
```

تكرارٌ لا أثرَ له — يُسجَّل ولا يُلاحَق.

### ما ثُبِّت

الحارسُ الأهمّ **مشتقٌّ من النصّ المكتوب** لا من قائمةٍ بيدي: يُستخرج كلُّ
`var(--x)` من `styles.css` المكتوب فعلاً ويُطلب تعريفُه في الملفّ نفسِه. فلو
أُعيدت تسميةُ متغيّرٍ غداً في طرفٍ دون الآخر سقط الحارس — ولا يشيخ حين
تتغيّر القاعدة.

| الطفرة | النتيجة |
|---|---|
| أنماطُ المستخدم تُدهَس دائماً | فشلٌ واحد |
| الفارغُ لا يُستبدَل | فشلٌ واحد |
| صفحةُ المستخدم `index.html` تُدهَس | فشلٌ واحد |
| متغيّرٌ يُستعمل ولا يُعرَّف | فشلٌ واحد |
| الأقسامُ تُفرَّغ (تُغذّي `templateSections`) | فشلٌ واحد |
| الفشلُ يُقال نجاحاً | فشلٌ واحد |

الطفرتان الأولى والثانية تحرسان **طرفَي** القاعدة معاً: لا دهسَ لعملِ
المستخدم، ولا امتناعَ عن استبدال الفارغ. حارسُ طرفٍ واحدٍ يُرضيه النقيضان.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `template.agent.js` | ٠ | ٧ اختبارات |
| قاعدةُ الدهس | غيرُ محروسة | محروسةٌ من طرفيها |

الوحدةُ لم تتغيّر (٣٨ سطراً كما هي). الحصيلة ١٢٨٦ ← ١٢٩٣.

---

## Sprint 3y — ستّةُ قيودِ تفرّدٍ تُعلنها النماذج ولا يُنشئها التطبيق

`dbConfig.js` ستّةُ أسطر، ويضبط `autoIndex: false`. وهو **الصواب** في
الإنتاج: بناءُ الفهارس عند كلّ إقلاع مكلفٌ وقد يُعطّل التجميعة. لكنّ
المستودعَ كلَّه لا ينادي `createIndexes` ولا `syncIndexes` في أيّ موضع.

مقيسٌ لا مفترَض:

```
autoIndex عالمياً : false        bufferCommands : false
إعلاناتُ التفرّد في النماذج: 8 — وهي 6 قيودٍ متمايزة
  User(username) · Project(name+owner) · Conversation(username)
  BotTenant(tenantId) · MemoryKV(store+key) · WorkspaceFile(username+project+filePath)
ولا نداءَ createIndexes/syncIndexes في المستودع كلِّه.
```

**تصحيحُ عددٍ قلتُه أوّلاً**: عددتُ الإعلاناتِ ثمانيةً وسمّيتُها «ثمانية
قيود». و`User.username` و`BotTenant.tenantId` مُعلَنٌ كلٌّ منهما مرّتين
(حقلاً وفهرساً) فهما قيدٌ واحدٌ لا اثنان. القيودُ المتمايزة **ستّة** —
والفرزُ نفسُه محروسٌ بطفرةٍ («القيدُ يُعَدّ مرّتين»).

فالتطبيقُ **لا يُنشئ فهرساً فريداً أبداً**. وجودُ القيد من عدمه حالةٌ في
القاعدة لا يعرفها الكود ولا يُخبر بها أحداً.

### لماذا هذا ليس تفصيلاً

تسجيلُ الحساب (`server.js:899`) `findUser` ثمّ `createUser` — **فحصٌ ثمّ
فعل**، والفهرسُ الفريد هو ما يُغلق السباقَ بينهما. فإن غاب، مرّ متسابقان
بالفحص كلاهما وأنشآ اسمَ مستخدمٍ واحداً، ثمّ يُرجع `findOne` أحدَهما اعتباطاً
— ومشاريعُ المستخدم مفتاحُها `owner: username`. وهو نفسُ نمط TOCTOU الذي
عولج في Sprint 7/6 لتوكن CMS، إلا أنّ حارسَه هنا خارج الكود.

### ما فُعل وما لم يُفعل

**لم يُنشأ فهرس.** إنشاءُ فهرسٍ فريدٍ على قاعدةٍ حيّة قرارٌ لا رجعةَ فيه
بسهولة: قد يُقفل التجميعةَ أثناء البناء، ويسقط أصلاً إن كانت فيها تكراراتٌ
سابقة — ولا سبيلَ لي إلى قياس حالة قاعدة الإنتاج من هنا. فالقرارُ للمالك.

**وفُعل ما لا يعتمد على قراره**: `services/indexHealth.js` — يقرأ ولا يكتب،
ويقول في سجلّ الخادم عند كلّ إقلاعٍ ما هو مضمونٌ وما هو غائب، على نسق
«🚦 جاهزية الإطلاق التجاري» الذي أقرّه المالكُ في Sprint 7:

```
🔐 [قيود التفرّد]: 4/6 مضمونة · ❌ غائبة: users(username)، projects(name+owner)
   · التطبيقُ لا يُنشئ الفهارس (autoIndex=false) — الغائبُ غيرُ مضمونٍ ولو أعلنه النموذج.
```

القائمةُ **مشتقّةٌ من النماذج المسجّلة** لا مكتوبةٌ بيد، فنموذجٌ يُضاف غداً
بقيدِ تفرّدٍ يدخل الفحصَ بحكم الاشتقاق. والتقريرُ أسماءُ تجميعاتٍ وحقولٍ
فقط — لا بياناتِ مستخدمين ولا قيمَ إعدادات.

### الطفرات

| الطفرة | النتيجة |
|---|---|
| فهرسٌ عاديٌّ يُحسب ضماناً للتفرّد | فشلٌ واحد |
| جزءُ المفتاح المركّب يُقبل كاملاً | فشلٌ واحد |
| تعذُّرُ القراءة يُقرأ سلامة | فشلٌ واحد |
| التقريرُ يقول «سليم» دائماً | **٤** فشل |
| القيدُ المُعلَن حقلاً وفهرساً يُعَدّ مرّتين | فشلٌ واحد |

الطفرتان الأولى والثانية تحرسان الفرقَ الذي يخدع العين: فهرسٌ على
`username` بلا `unique`، أو على `name` وحدَه بدل `name+owner`، يبدو مطابقاً
ولا يضمن شيئاً. وترتيبُ المفتاح المركّب جزءٌ من هويّته — `owner+name` ليس
`name+owner`.

### قرارُ المالك

سُئل المالكُ فاختار **الإنشاءَ اليدويّ على القاعدة**. فلا يُنشئ التطبيقُ
شيئاً، وتبقى هذه الوحدةُ قارئةً فقط. وأوامرُ الإنشاء الستّة مشتقّةٌ من
النماذج نفسِها (لا مكتوبةٌ من الذاكرة):

```js
db.users.createIndex({ username: 1 }, { unique: true });
db.projects.createIndex({ name: 1, owner: 1 }, { unique: true });
db.conversations.createIndex({ username: 1 }, { unique: true });
db.bottenants.createIndex({ tenantId: 1 }, { unique: true });
db.memorykvs.createIndex({ store: 1, key: 1 }, { unique: true });
db.workspacefiles.createIndex({ username: 1, project: 1, filePath: 1 }, { unique: true });
```

وترتيبُ المفتاح المركّب جزءٌ من هويّته: `name+owner` ليس `owner+name`.
وإن سقط أمرٌ بـ`E11000` فتلك تكراراتٌ قائمةٌ في القاعدة تُنظَّف قبل الإنشاء —
وهي بذاتها الدليلُ على أنّ القيدَ لم يكن مضموناً.

| قياس | قبل | بعد |
|---|---|---|
| قيودُ تفرّدٍ يُنشئها التطبيق | ٠ من ٦ | ٠ من ٦ (بلا تغيير) |
| قيودٌ يعرف المالكُ حالَها | ٠ | **٦**، في كلّ إقلاع |

`server.js` ٣٧٨٣ ← ٣٧٩٦، و`indexHealth.js` جديدٌ (٨١). الحصيلة ١٢٩٣ ← ١٣٠٠.

---

## Sprint 3z — مسارُ التحقق من التوكن: تدويرٌ سليم، وحارسٌ كان أضيقَ من دعواه

بدأتُ هذا السبرنت **بتصحيح دعوى قلتُها أنا**. كنتُ أُعدّد «وحداتٍ حيّةً بلا
تغطية» من الذاكرة. فاشتُقّت القائمةُ من القرص بدل ترديدها:

```
وحدات backend: 216 — بلا استيرادٍ مباشرٍ من اختبار: 9
  agents/cloneTemplates: 4 · agents: 2 · models: 1 · plugin-templates: 1 · utils/auth.js: 1
```

تسعٌ لا القائمةُ الطويلة التي كنتُ أُكرّرها. ومنها ما ليس ثغرةً أصلاً:
`templateLibraryExtended.js` بياناتٌ خلف واجهةٍ مغطّاة، و`templates.test.mjs`
يشترط **٣٠** قالباً — فتصادمُ مفتاحٍ بين العشرة الأساسية والعشرين الموسَّعة
يظهر ٢٩ ويُسقط الاختبار. محروسٌ بالفعل.

بقي `utils/auth.js`: مسارُ التحقق الذي يمرّ به كلُّ طلبٍ مُصادَق وكلُّ اتصال
socket (`server.js` 581، 599، 707، 826، 1037)، بلا تغطية.

### فرضان سقطا

**الأوّل**: `getJwtSecret()` يسقط إلى سرٍّ مكتوبٍ في المستودع
(`jaola-dev-secret-change-me`) — فتُزوَّر التوكناتُ إن غاب `JWT_SECRET`.
ساقط: `server.js:161` يقتل العمليّة قبل أيّ طلب (`process.exit(1)`)،
و`utils/auth.js` مستوردٌ من ملفٍّ واحدٍ فقط. الاحتياطُ غيرُ قابلٍ للبلوغ في
المدخل الحيّ الوحيد.

**الثاني**: موضعُ تحقّقٍ يلتفّ على قائمة أسرار التدوير فيقبل طريقٌ ما يرفضه
آخر. `agents/authAgent.js:122` فيه `jwt.verify(token, JWT_SECRET)` بسرٍّ
مفرد — لكنّه **داخل نصٍّ** يُكتب في تطبيق المستخدم (`api/middleware/auth.js`)
لا في مصادقة جولا. المواضعُ الخمسة الحقيقيّة كلُّها تنادي `verifyJwt`.

### طفرتان نجتا، وثالثةٌ كشفت حارساً أضيقَ من دعواه

**الأولى والثانية**: `if (!token)` بدل فحص المخطّط، و`catch { next() }`.
نجتا لأنّ حالاتي كلَّها كانت تُردّ عند فحص المخطّط فلا تبلغ الـ`catch`، ولأنّي
أكتفي بـ`401` دون تمييز سببها. فكُتب المميِّز: **الردُّ قبل التحقّق لا بعده**
(«Bearer مطلوب» لا «توكن فاسد»)، و`Bearer <فاسد>` يُردّ ولا يمرّ.

**والثالثة أهمّ**: حارسي النصّيّ يمنع «تحقّقاً يلتفّ على `verifyJwt`» —
وكتبتُه يبحث عن `jwt.verify` **بالاسم**. فطفرةٌ تستورد المكتبةَ باسمٍ آخر
(`import jwtX from 'jsonwebtoken'`) مرّت من تحته وهو يُعلن المنع. القاعدةُ
صارت على المكتبة لا على الاسم: مَن استورد `jsonwebtoken` ثمّ نادى `.verify(`
فهو موضعُ تحقّق مهما سمّى متغيّره. وأُعيدت الطفرةُ بالاسمين فسقطت بهما.

**حارسٌ يمنع نمطاً واحداً من كتابة العطب ليس منعاً — هو دعوى منع.**

### الطفرات

| الطفرة | النتيجة |
|---|---|
| التدويرُ مُعطَّل (السابقُ يُهمَل) | فشلٌ واحد |
| السابقُ يُجرَّب قبل الحالي | فشلٌ واحد |
| `jwt.decode` بدل `verify` (فكٌّ بلا تحقّقٍ من التوقيع) | **٦** فشل |
| أيُّ مخطّطٍ يمرّ (`Basic` مثلاً) | فشلٌ واحد |
| التوكنُ الفاسد يمرّ (`catch { next() }`) | فشلٌ واحد |
| موضعُ تحقّقٍ جديد — باسم `jwt` وباسم `jwtX` | فشلٌ واحد لكلٍّ |

### وخطأٌ ثالثٌ في المِرْقاة

طفرةُ «موضع تحقّقٍ جديد» أضفتُها أوّلاً إلى `services/security.js` — وهو
مسارٌ لا وجودَ له (الملفُّ في `utils/`). فأنشأ `>>` ملفاً جديداً، وطبع
مِقياسي «طُبِّقت ✔» بلا فحص. **إعلانُ تطبيقِ الطفرة ليس تطبيقَها**؛ صار كلُّ
تطبيقٍ يُثبَت بـ`grep` قبل قراءة النتيجة، وحُذف الملفُّ الدخيل.

| قياس | قبل | بعد |
|---|---|---|
| تغطيةُ `utils/auth.js` | ٠ | ٩ اختبارات |
| مواضعُ تحقّقٍ تلتفّ على التدوير | ٠ | ٠ (محروسٌ الآن بالمكتبة لا بالاسم) |
| وحداتٌ حيّةٌ بلا استيرادٍ من اختبار | ٩ | **٨** |

الوحدةُ لم تتغيّر (٤٠ سطراً كما هي). الحصيلة ١٣٠٠ ← ١٣٠٩.

---

## Sprint 4a — دعوى «كلّ القوالب» فوق حلقةٍ تدور على ثلاثة عشر (والنتيجةُ سلبيّة)

في `tests/cloneTemplates.test.mjs` تعليقٌ يقول «**كل** قوالب jaola يجب أن
تجتاز التحقّق السلوكي»، وتحته حلقةٌ تدور على **قائمةٍ مكتوبةٍ بيد** من ثلاثة
عشر. والسجلُّ يحوي **41**. فبدا الأمرُ نسخةً من عطب Sprint 3t: عيّنةٌ اخترتُها
أنا مكانَ ما يُنتجه النظام.

### القياس أوّلاً

بُني كلُّ قالبٍ غيرِ مذكورٍ بالاسم وشُغِّل عليه `verifyBehavior` كاملاً:

```
في السجلّ: 41 | تُسمّيها الحلقة: 12
غيرُ المسمّاة: 28 | منها ساقطةٌ فعلاً: 0
```

لا قالبَ مكسورٌ يُسلَّم للمستخدمين. ثمّ بُدِّلت الحلقةُ لتُشتقّ من
`listClones()` (66 ← 122 اختباراً، 37 ← 54 ثانية)، وأُسقطت بها طفرتان في
قالبٍ خارج القائمة اليدوية (معالجٌ غير معرّف، وخطأُ JS عند الإقلاع).

### ثمّ سقط التغييرُ نفسُه

قبل الدفع، سُئل السؤالُ الذي يجب أن يُسأل: **هل يلتقط الحارسُ القديم هذه
الطفرة؟** شُغِّلت النسخةُ القديمة من `HEAD` على الطفرة نفسِها:

```
الحارسُ القديم (قائمةٌ يدويّة) : # pass 65 # fail 1
الحارسُ الجديد (مشتقٌّ)        : # pass 120 # fail 2
```

القديمُ يلتقطها. والسببُ أنّ أسفلَ الملفّ اختباراً اسمُه «تدقيق سلوكي شامل»
يدور على `listClones()` كلِّه ويؤكّد `v.ok` لكلّ قالبٍ **باسمه**. فالشمولُ
قائمٌ منذ البداية، والحلقةُ اليدويّة طبقةُ تسميةٍ فوقه لا الضمانَ نفسَه.

فكان تغييري يُضيف **صفرَ تغطية** ويُضاعف واحداً وأربعين تشغيلَ jsdom (+١٧
ثانية في كلّ فحص). فرُدّ. **تحسينٌ لا يُسقط طفرةً لا يُسقطها القائمُ ليس
تحسيناً؛ هو كلفةٌ باسم التحسين.**

### ما بقي

الدعوى وحدَها كانت خاطئة، فصُحّحت في موضعها: التعليقُ يقول الآن إنّ هذه
الحلقةَ تُسمّي ثلاثةَ عشر، وإنّ الشمولَ في «تدقيق سلوكي شامل» أسفلَه. سطرُ
توثيقٍ بلا كلفةِ تشغيل.

| قياس | قبل | بعد |
|---|---|---|
| قوالبُ يشملها التحقّق السلوكي | ٤١ | ٤١ (كما كانت) |
| قوالبُ ساقطةٌ فعلاً | ٠ | ٠ |
| زمنُ ملفّ الكلونات | ٣٧ ث | ٣٧ ث (رُدَّ التغيير) |
| دعوى «كلّ القوالب» فوق حلقةِ الثلاثةَ عشر | قائمة | **مُصحَّحة** |

الحصيلة ١٣٠٩ كما هي — ولا اختبارَ أُضيف، وهذا هو الصواب هنا.

---

## Sprint 4b — «حذفٌ كامل» يترك مفتاحَ الدفع حيّاً، ويرثه مشروعٌ بالاسم نفسه

`deleteProjectCompletely` كان يمسح القرصَ وصفَّ `Project` والمقاييس (Sprint
3n) ويترك ما سواه. مقيسٌ بالتشغيل لا بالقراءة:

```
قبل الحذف — أسماءُ الأسرار : [ 'STRIPE_SECRET_KEY', 'DB_PASSWORD' ]
بعد «الحذف الكامل»          : [ 'STRIPE_SECRET_KEY', 'DB_PASSWORD' ]
أَتُقرأ قيمُها؟ نعم · أَيرثها مشروعٌ جديدٌ بالاسم نفسه؟ نعم
```

**مفتاحُ دفعٍ حيٌّ يبقى مقروءاً لمشروعٍ ظنّ صاحبُه أنّه أزاله**، ويُشغَّل به
مشروعٌ آخرُ يحمل الاسمَ نفسَه. والمستخدمُ حذف ليُزيل لا ليُخفي. وليست
الأسرارُ وحدَها: الذاكرة (الخطّة ونموذجُ المجال والتاريخ) والحالةُ كذلك —
فيُبنى الجديدُ على متطلّبات مشروعٍ آخر وصاحبُه يظنّ أنّه بدأ من بياض.

الإصلاح: `clearProjectSecrets` و`clearProjectMemory` و`clearProjectState`،
كلٌّ يمسح الذاكرةَ **والسجلَّ المحفوظ** (`removeEntry`، وهي تُلغي الكتابةَ
المؤجَّلة أوّلاً وإلا عاد المحذوفُ من طابور الكتابة — Sprint 3n).

### الحارسُ المشتقّ

القائمةُ لا تُكتب بيد: يُمسح المصدرُ بحثاً عن كلّ مخزنٍ مفتاحُه
`${user}:${project}`، ثمّ يُطلب لكلٍّ منه ماسحٌ **منادىً في دالّة الحذف**،
وأن يبلغ ذلك الماسحُ `removeEntry` لا الذاكرةَ وحدَها. فمخزنٌ خامسٌ يُضاف
غداً يدخل الفحصَ بحكم الاشتقاق ويسقط حتى يُمحى.

وهو الذي كشف أنّ الأسرارَ ليست وحدَها: سمّى `projectMemory` و`projectStates`
في أوّل تشغيل.

| الطفرة | النتيجة |
|---|---|
| الأسرارُ تبقى في السجلّ المحفوظ (الذاكرةُ وحدَها تُمسح) | فشلٌ واحد |
| الأسرارُ تبقى في الذاكرة | **٣** فشل |
| يُدّعى مسحٌ لم يقع | فشلٌ واحد |
| الذاكرةُ تُورَّث | فشلٌ واحد |
| الحالةُ تُورَّث | فشلٌ واحد |
| الحالةُ تبقى في السجلّ المحفوظ | فشلٌ واحد |
| المفتاحُ من المستخدم وحدَه (يمسح كلَّ مشاريعه) | **٤** فشل |
| مخزنٌ جديدٌ بمفتاح المشروع بلا ماسح — باسمٍ صريحٍ وبأليَاس | فشلٌ واحد لكلٍّ |

### ثلاثةُ عيوبٍ في اختباراتي أنا، كشفتها الطفرات

**الأوّل**: `transitionState(…, 'building')` — و`idle → building` **انتقالٌ
ممنوع**. فلم تُكتب حالةٌ قطّ ومرّ الاختبارُ على فراغ. الآن `'planning'`
(مسموحٌ من `idle`)، ويُؤكَّد أنّ الحالةَ كُتبت **قبل** فحص محوها.

**الثاني**: كلُّ تأكيداتي كانت تقرأ الذاكرةَ وحدَها، فطفرةُ «أزِل
`removeEntry`» نجت — وهي الأخطر: السجلُّ المحفوظ هو ما يعود بعد الإقلاع.
فصار الحارسُ المشتقّ يشترط بلوغَ `removeEntry` داخل الماسح.

**والثالث — نفسُ عيبِ حارس `jwt.verify` بعده بساعة**: بحثتُ عن
`persistEntry(` **بالاسم**، فمخزنٌ يستورده بأليَاس (`persistEntry as pe`)
مرّ من تحته. ثمّ لمّا صحّحتُه بقي ناقصاً: `exec` يأخذ **أوّلَ** استيرادٍ من
`persistence.js` في الملفّ، وملفٌّ قد يستورد منه مرّتين. الآن تُجمع الأسماءُ
المحلّيّة كلُّها من كلّ استيراد. **الضِّيقُ يعود من حيث لا تتوقّعه، فلا
يُصدَّق حارسٌ حتى تُعاد طفرتُه بكلّ صياغةٍ يقبلها الكود.**

### وعيبٌ رابع: الحارسُ نفسُه كان أضيقَ ممّا يُعلن

سألتُ الحارسَ الجديدَ عمّا يراه، فأجاب بأربعةٍ فقط — كلُّها مخازنُ
`persistEntry`. و`workspaceStore` يحفظ **شيفرةَ المستخدم نفسَها** في نموذج
mongoose خاصٍّ بحقلَي `username`+`project`، فمرّ من تحت حارسٍ يُعلن الشمول.

وليس بقايا خاملة: `restoreWorkspaceIfEmpty` يكتب اللقطةَ في أيّ مجلدِ مشروعٍ
**فارغ** — وذلك بعينه حالُ مشروعٍ جديدٍ يُنشأ بالاسم نفسه. فتعود ملفاتُ
المشروع المحذوف داخل مشروعٍ آخر. أُضيف `clearWorkspaceSnapshot` ونودي في
الحذف، ووُسِّع الحارسُ ليشمل نماذجَ mongoose ذاتَ الحقلين.

**ثمّ سقط توسيعي مرّتين قبل أن يصحّ**:
- كتبتُ النمطَ كسولاً `Schema\(\{([\s\S]{0,700}?)\}` — فينتهي عند أوّل
  `}` وهو نهايةُ حقل `username` لا نهايةُ المخطّط، فلا يُرى `project` قطّ.
  وجد الحارسُ **صفراً** ومرّ خضراءَ وهو لا يفحص شيئاً. نافذةٌ ثابتةٌ بعد
  رأس المخطّط بدلاً منه.
- ثمّ اشترطتُ `removeEntry` داخل الماسح، ونموذجُ mongoose يمحو بـ`deleteMany`
  — فرُدَّ ماسحٌ صحيحٌ لأنّه كُتب بأداةٍ أخرى. الشرطُ على **الأثر** لا على
  اسم الدالّة: `removeEntry|deleteMany|deleteOne`.

| الطفرة | النتيجة |
|---|---|
| لقطةُ ملفات المستخدم لا تُمسح عند الحذف | فشلٌ واحد |
| الماسحُ لا يبلغ القاعدة (`deletedCount: 0` ثابتاً) | فشلٌ واحد |

| قياس | قبل | بعد |
|---|---|---|
| مخازنُ المشروع التي ينظّفها الحذف | ١ من ٥ | **٥ من ٥** |
| مفتاحُ دفعٍ يبقى بعد الحذف | نعم | **لا** |
| شيفرةُ المستخدم تعود في مشروعٍ آخر | نعم | **لا** |
| مخزنٌ جديدٌ يُنسى صامتاً | ممكن | يسقط الحارسُ باشتقاقه |

`server.js` ٣٧٩٦ ← ٣٨٠٣، `projectSecrets` ١٢١ ← ١٣٨، `projectMemory` ٢٤١ ←
٢٥٤، `stateMachine` ٢٥٧ ← ٢٧٠، `workspaceStore` ١٥٣ ← ١٧٣. الحصيلة ١٣٠٩ ← ١٣١٥.

---

## Sprint 4c — قناةُ التقرير: تعليلٌ مقروءٌ من المصدر بدل تعليلٍ مُستنتَجٍ من التذبذب

**الإشارة.** فشلٌ في `اختبارات الخادم` على `26465c5` (أوّلُ التزامٍ في #510)،
لم يكن تأكيداً ساقطاً بل انهيارَ ملفٍّ كامل:

```
not ok 100 - tests/pluginStore.test.mjs
  failureType: 'uncaughtException'
  error: 'Unable to deserialize cloned data due to invalid or unsupported version.'
  stack: '#processRawBuffer (node:internal/test_runner/runner:354:20)'
# tests 1300 / # pass 1299 / # fail 1
```

`83aec32` (وهو ما دُمج فعلاً) نجح، فـ`main` سليم. لكنّ الملفَّ بقي مكشوفاً.

**التعليلُ القديم كان خطأً.** كان مكتوباً في `helpers/quietConsole.mjs` أنّ
«أُطُرَ الرسائل تنكسر عند المحارف متعددة البايت»، وأنّ تجربةً ضابطة أعطت
١٢/٢٤ للعربيّ و٠/٢٤ للاتينيّ. الأمران لم يصمدا:

1. ترويسةُ التسلسل هي `0xFF 0x0F`، والبايت `0xFF` **لا يظهر في UTF-8 صالحٍ
   قطُّ** (قِيس: أقصى بايتٍ في السطر العربيّ `0xF0`). فلا يستطيع نصٌّ عربيٌّ
   اصطناعَ ترويسةٍ كاذبة، ولا «كسرَ إطار».
2. لم أُعِد إنتاجَ التجربة: **٩٨ تشغيلاً** في أربع صيغ — تسلسليّ (٢٤)،
   متزامنٌ تحت حِمل (٢٤)، كثيفُ الإخراج ٢٠٠٠٠ سطر (٢٤)، والمجموعةُ كاملةً
   ٦ مرّات تحت ٦ عمليّاتِ حِملٍ صناعيّ — **٠ انهياراً في كلّ الحالات**،
   للعربيّ وللاتينيّ سواءً.

**التعليلُ الصحيح، مقروءاً من `internal/test_runner/runner` (v22.22.2).**
الأبُ يفصل في stdout الابنِ رسائلَ التقرير المُسلسَلة عن نصِّ الطباعة، ثمّ:

```js
const fullMessageSize = (b[2] << 24 | b[3] << 16 | b[4] << 8 | b[5]) + 6;
if (this.#rawBufferSize < fullMessageSize) break;   // انتظرْ بقيّةَ الرسالة
…
deserializer.readHeader();                          // السطر ٣٥٤ — إطارُ الانهيار
```

و`<<` في JavaScript عمليّةٌ على عدد صحيحٍ **ذي إشارة**. فبايتٌ قيمتُه ≥ 0x80
في الموضع `b[2]` يجعل الطولَ **سالباً**، فلا يقع `break`، فيُمرَّر نصُّ
الطباعة نفسُه إلى مُفكِّك التسلسل. قِيس الحسابُ مباشرةً:

| النصّ | `b[2]` | `fullMessageSize` | النتيجة |
|---|---|---|---|
| لاتينيّ | `0x73` | `+1937010552` | يقع `break` — سليم |
| عربيّ | `0x97` | `−1752895554` | لا يقع — انهيار |

فالخلاصةُ القديمة (اللاتينيّ آمنٌ والعربيُّ خطر) **صحيحةٌ بالحساب**، لا بتلك
التجربة. واللاتينيُّ محصَّنٌ **بنيةً** لا احتمالاً: كلُّ بايتاته < 0x80.

وفرقُ التعليل عمليّ لا لفظيّ: لو كان الكسرُ في التأطير لأفاد الهروبُ من
المحارف؛ وإذ هو في حساب الطول، فالمُصلِحُ الوحيدُ إخلاءُ stdout.

**العلاج.** `tests/helpers/reportChannel.mjs` — تحويلُ `console.log/info/debug`
إلى stderr. وstderr قناةٌ أخرى تماماً: يقرؤها الأبُ سطراً سطراً عبر `readline`
ويكتبها كما هي (السطور ٤٠٣–٤٠٦)، ولا تمرُّ بمُفكِّك تسلسلٍ أصلاً. وهذا فرقُها
عن الكتم: **الكتمُ يُخفي التشخيص، والتحويلُ يُبقيه**.

قِيس على الابن مباشرةً (لا على الأب، إذ يطبع الأبُ القناتين معاً على stdout
فلا يُميّز بينهما — وهذا خطأُ قياسٍ وقعتُ فيه أوّلاً):

| | stdout الابن | stderr الابن |
|---|---|---|
| قبل | ١ | ٠ |
| بعد | ٠ | ١ |

**النطاق، مُشتقّاً لا مُستذكَراً.** ٢١ وحدةً تطبع نصّاً غير لاتينيّ، و**٣٢**
ملفَّ اختبارٍ يستوردها بلا إخلاء القناة — وهو العددُ نفسُه الذي كان معلَّقاً
منذ سبرنتات، لكنّه الآن مُشتقٌّ من القرص. طُبِّق على الاثنين والثلاثين جميعاً.

**الحارس.** `tests/reportChannel.test.mjs` يشتقُّ الوحداتِ الطابعةَ
والاستيراداتِ من المصدر، فيقع من نفسه على أيّ وحدةٍ أو اختبارٍ جديد.

**الطفرات — كلٌّ مُثبَتُ التطبيق بـ`grep` قبل قراءة نتيجتها:**

| الطفرة | النتيجة |
|---|---|
| نزعُ إخلاء القناة من `pluginStore.test.mjs` | ✔ سقط، وسمّى الملفَّ والوحدة |
| الوسيلةُ تكتب على stdout بدل stderr | ✔ سقط: «تسرّب سطرٌ إلى stdout» |
| تعطيلُ الاشتقاق كلِّه (`SCANNED` فارغة) | ✔ سقط حارسُ الفراغ: «وُجدت 0 وحدةً طابعة» |

**أخطائي في هذا السبرنت، مسجَّلةً:**
- قِستُ التجربةَ الضابطة **تسلسليّاً** أوّلاً بينما نصُّها «متزامناً»؛ شرطٌ خطأ
  كاد يُسجَّل نتيجةً سلبيّة.
- قِستُ أثرَ العلاج على **stdout الأب**، والأبُ يطبع القناتين معاً هناك؛ فبدا
  العلاجُ فاشلاً وهو ناجح. القياسُ الصحيح على الابن.
- طبّقتُ الطفرةَ الثالثة بـ`sed` فبدّلت **مجلّداً واحداً من ثمانية**، فنجا
  الحارسُ ظاهريّاً. أثبتُّ تغيُّرَ النصّ لا تحقُّقَ العطب: **إثباتُ التطبيق
  شرطٌ لازمٌ لا كافٍ — على الطفرة أن تُعبّر عن العطب فعلاً.**
- كتبتُ ثالثَ الاختبارات فارغاً أوّلاً (يُفكِّك `null` ويؤكّد على مصفوفةٍ
  فارغةٍ بداهةً) فمرَّ خضراءَ بلا فحص؛ استُبدل بواحدٍ يُشغّل الوسيلةَ فعلاً.

**نتيجةٌ سلبيّة مسجَّلة.** جُرّبت وسيلةٌ عامّة (`--import` ثمّ `NODE_OPTIONS`)
لإخلاء القناة في كلّ الأبناء دفعةً واحدة: لا تصل الأبناءَ تحت `--test`، بل لم
تُحمَّل في الأب أصلاً. فرُفضت — ولم تُفرض بحيلةٍ أذكى: آليّةٌ هشّةٌ في CI
أسوأُ من سطرٍ صريحٍ في كلّ ملفّ.

**الصدقُ في الحدّ.** لم أُعِد إنتاجَ الانهيار ولا مرّةً في ٩٨ تشغيلاً. فما
أدّعيه مُثبَتٌ بالحساب وبقراءة المصدر وبقياس القناتين، لا بإعادة إنتاج العطب.
وإخلاءُ stdout يُزيل **الشرطَ الضروريّ** للانهيار (وجودُ بايتٍ ≥ 0x80 في نصٍّ
مُتداخِلٍ على قناة التقرير) — وهذا أقوى ما يصحُّ ادّعاؤه هنا.

---

## Sprint 4d — سجلَّان لا يعرف أحدُهما الآخر: نوعٌ يُكشَف بلا قالبٍ يُسلَّم

**كيف وُجد.** اشتقاقُ الوحدات غير المغطّاة من القرص أعطى **٤** لا ٣ كما كنت
أُعدِّد — وأكبرُها `agents/templateLibraryExtended.js` (١٣٨٣ سطراً) لم يكن في
قائمتي أصلاً. خطأُ العيّنة بدل الاشتقاق، مرّةً أخرى، وفي الجملة نفسِها التي
ادّعيتُ فيها العدّ.

(وتبيّن أنّ الوحدة مغطّاةٌ عبر `templates.test.mjs` بالانتقال — الاشتقاقُ
يَسِمُ ما لا يُذكَر بالاسم، لا ما لا يُختبَر. نتيجةٌ سلبيّةٌ في الوحدة نفسِها،
لكنّ الطريقَ إليها كشف العطبَ التالي.)

**العطب.** الكشفُ والقالبُ يقرآن **سجلَّين مختلفين**:

| السجلّ | المصدر | العدد |
|---|---|---|
| أنواعُ الكشف | `knowledge/design-rules.json` → `types` | ٣١ |
| أنواعُ القوالب | `TEMPLATE_LIBRARY` | ٣٠ |

ولا شيء يربطهما. والفارقُ نوعٌ واحد: **`tool`**. و`getTemplate` يُرجع قالبَ
`business` لكلِّ نوعٍ مجهول، فكان `buildTemplateContext('tool')` يُسلّم الـCoder:

```
## Template Library — قالب tool:
### CSS Variables الإلزامية (انسخها في :root):
<متغيّراتُ business>
### الأقسام المطلوبة: hero، services
```

ترويسةٌ تحمل اسمَ النوع، ومحتوىً من نوعٍ آخر، **مُعلَنٌ إلزاميّاً**. والوصولُ
إليه بأهدافٍ عاديّةٍ تماماً — قِيس: «أداة تحويل الصور إلى PDF»، «أداة حاسبة
ضريبية أونلاين»، «a free online tool to compress files» → كلُّها `tool`.
و«services» ليست قسماً لموقع أداة.

**الإصلاح.** لا اختراعَ قالبٍ لم يُطلَب منّي تصميمُه، بل **صدقُ السياق**: إن
لم يكن للنوع قالبٌ، يقول السياقُ ذلك، ويعرض اللوحةَ «للانطلاق» لا «قالباً
لهذا النوع»، ويطلب اشتقاقَ الأقسام من هدف المستخدم بدل فرضِ أقسام غيره.
و`hasTemplate()` تُميّز الموجودَ من البديل — وهو تمييزٌ لم يكن ممكناً بـ
`getTemplate` وحدها لأنّها تُرجع بديلاً دائماً.

**الطفرات — كلٌّ مُثبَتُ التطبيق وأنّه عبّر عن العطب:**

| الطفرة | النتيجة |
|---|---|
| إزالةُ الفرع الصادق (عودةُ العطب) | ✔ سقط، وسمّى `tool` |
| `hasTemplate` يكذب فيزعم قالباً لكلّ نوع | ✘ **نجا أوّلاً** — ثمّ ✔ بعد الإصلاح |
| قالبٌ يُسلَّم لوحةَ business خِلسةً (`travel`) | ✔ سقط، وسمّى `travel` |

**الطفرةُ الناجية، وهي درسُ هذا السبرنت.** كان الحارسُ يكتب
`if (hasTemplate(type)) continue;` — أي **يسأل الدالّةَ محلَّ الفحص عن نفسها**.
فلمّا كذبت وأرجعت `true` دائماً، صار جسمُ الحلقة غيرَ قابلٍ للبلوغ، فمرَّ
الاختبارُ **فراغاً** لا صحّةً. وهذا أعمقُ أشكال العائلة المتكرّرة: لا حارسٌ
ضيّقُ الهجاء فحسب، بل حارسٌ **يستمدُّ حقيقتَه ممّن يحرسه**. أُصلح باشتقاق
الحقيقة من السجلّ (`getAvailableTemplates()`)، وأُضيف اختبارٌ خامسٌ يقابل
`hasTemplate` بالسجلّ فلا تُصدَّق على نفسها. وبعد الإصلاح تسقط الطفرةُ في
ثلاثةِ اختباراتٍ من خمسة.

**قاعدةٌ تُضاف.** *لا يُشتقُّ مرجعُ الحارس من الوحدة التي يحرسها.* إن كان
الفحصُ على `f`، فمصدرُ «الصواب» شيءٌ آخر — سجلٌّ، أو قرصٌ، أو حسابٌ مستقلّ.

**الخريطة.** `templateLibrary.js` ١٠٣٤ ← ١٠٦١ سطراً؛ أوقعها حارسُ الخريطة من
نفسه قبل الدفع.

**الاختبارات.** ١٣١٨ ← ١٣٢٣، كلُّها خضراء.

### ملحقُ 4d — تدقيقُ القاعدة على حرّاسي أنفسِهم

القاعدةُ الجديدة («لا يُشتقُّ مرجعُ الحارس من الوحدة التي يحرسها») نثرٌ في هذا
الملفّ، ولا شيءَ يفرضها — وهو عينُ الضعف الذي أُطارده في هذا المستودع. فدُقِّقت
يدوياً على الحرّاس الثمانية المكتوبة في هذه السلسلة (starterFetch،
starterRegistry، templateAgent، authUtils، projectDeletionResidue،
reportChannel، templateRegistrySync، adminUsers).

**النتيجة: لا موضعَ آخر.** والماسحُ **مُثبَتٌ أنّه ليس فارغاً**: أُعيدت الصيغةُ
المعيبة (`if (hasTemplate(type)) continue;`) فرآها وسمّاها، ثمّ اُسترجعت فصمت.

**ولم يُشحن الماسحُ حارساً دائماً، عمداً**، لسببَين كلاهما درسٌ دُفع ثمنُه:

1. قائمةُ ملفّاته **مكتوبةٌ باليد** (ثمانية أسماء) — وهو عينُ «العيّنة بدل
   الاشتقاق» الذي أخطأتُ فيه مرّتين اليوم.
2. تعبيرُه النمطيّ يمسك **هجاءً واحداً** (`if (fn(...)) continue|return`)،
   وللقاعدة هجاءاتٌ كثيرة. فماسحٌ ضيّقٌ يُعلَن «فارضاً للقاعدة» يصير هو نفسُه
   «حارساً يُحرّم هجاءً ويدّعي أنّه تحريم» — العائلةُ التي وُضعت القاعدةُ لها.

فبقي **تدقيقاً موثَّقَ النتيجة**، لا حارساً يمنح طمأنينةً كاذبة. وهذا تطبيقُ
«لا تجريد بلا مستهلك حقيقي» على أدواتي أنا.

---

## Sprint 4e — تعليقُ المحمِّل يَعِدُ بأوسعَ ممّا يفعل

**كيف وُجد.** تدقيقُ الوحدات غير المذكورة في أيّ اختبار: كانت
`plugin-templates/AgentPluginTemplate.js` بصفر مستهلكٍ في المستودع كلِّه.

**نتيجةٌ سلبيّة أوّلاً.** ليست شيفرةً ميتة: الملفُّ **قالبٌ يُنسَخ**، ونصُّه
يقول «انسخ هذا الملف إلى backend/plugins/ وعدّله». فصفرُ المستهلكين صحيحٌ
بالتصميم، و`KEEP` في الخريطة في محلِّه. لا عطبَ هنا.

**لكنّ الطريقَ كشف دعوىً.** تعليقُ `core/PluginLoader.js` يقول:

```js
// نتخطى الملفات المخفية والقوالب
if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
```

«والقوالب» دعوى أوسعُ من الآليّة: الآليّةُ بادئتان لا غير. والقالبُ الوحيدُ
في المستودع لا يحمل بادئة — نجاتُه سببُها أنّه في مجلَّدٍ لا يُمسح، لا أنّ
هذا الشرطَ يمسكه.

**قِيس على المحمِّل الحقيقيّ، لا استُنتج:**

| ما وُضع في `plugins/` | النتيجة |
|---|---|
| `AgentPluginTemplate.js` (نسخةٌ حرفيّة) | **حُمِّل** — سُجِّل `example-agent` بـ`enabled: true` |
| `_Prefixed.js` (النصُّ نفسُه) | تُخطّي |

**حدُّ الدعوى، صراحةً.** ليس عطباً في الإنتاج: `plugins/` لا يحوي إلّا
`site-checker.js`، ونصُّ القالب يقول «وعدّله» — فنافذةُ تسجيل وكيلِ المثال
حالةٌ محليّةٌ بين النسخ والتعديل. الخللُ في **التعليق** لا في السلوك: مَن وثق
به وسمّى قالباً بلا بادئةٍ داخل `plugins/`، حُمِّل قالبُه. وهي عينُ عائلة
`quietConsole` في 4c: تعليقٌ يصف آليّةً أوسعَ من الموجودة فيُضلّل مَن يُصلح.

**الإصلاح.** التعليقُ يقول ما تفعله الآليّة، ومعه القياسُ أعلاه.
و`tests/pluginLoaderSkip.test.mjs` يثبّت القاعدةَ كما تعمل.

**الطفرات:**

| الطفرة | النتيجة |
|---|---|
| إسقاطُ بادئة `_` (تضييق) | ✔ سقط الاختباران ١ و٣ |
| توسيعُ التخطّي لكلّ اسمٍ فيه `Template` | ✔ سقط الاختبار ١ |

**ثغرةٌ في حارسي، مسجَّلة.** الاختبارُ الثالث (فحصُ التعليق) نجا من طفرةِ
**التوسيع**: هو يتأكّد أنّ البادئتين مذكورتان، ولا يرى شرطاً **مضافاً**.
فالسلوكُ يحرسه الاختبارُ الأوّل، لا الثالث. لم أُوسّع الثالثَ لأنّ فحصَ
«لا شرطَ زائد» نصّاً هشٌّ؛ والأصحُّ أنّ الحارسَ السلوكيَّ هو الحارس.

**الخريطة.** `core/PluginLoader.js` ٩٤ ← ١٠٠ سطراً (أوقعه حارسُ الخريطة).
**الاختبارات.** ١٣٢٣ ← ١٣٢٦، خضراء.

---

## Sprint 4f — الملفُّ يَعِدُ باسمٍ لا يقرؤه الاتّصال

**كيف وُجد.** لا بتدقيقٍ منّي، بل من **سجلّ المالك**: أمرٌ كتبتُه له فشل بـ
`MongooseError: uri … got "undefined"`. فقاس البيئةَ فظهر `MONGO_URI` لا
`MONGODB_URI`.

**العطب.** `server.js:278` يقرأ:

```js
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jaola_os';
```

و`.env.example` **لا يذكر `MONGO_URI` إطلاقاً**؛ يذكر `MONGODB_URI` وحده — وهو
اسمٌ لنظامٍ آخر (`databaseAgent`/`renderAgent` يتّصلان به بقواعد المشاريع
المولَّدة، لا بقاعدة جولا). فمَن هيّأ جولا محليّاً متّبعاً الملفّ ضبط الاسمَ
الخطأ، فسقط التطبيقُ إلى الافتراضيّ المحليّ **صامتاً** وهو يظنّ نفسه متّصلاً.

وهي العائلةُ نفسُها التي طاردتُها في 4c و4e: **مستندٌ يَعِدُ بما لا ينفّذه
الكود**. لكنّ هذه أوضحُها أثراً: لا لبسَ في تعليق، بل اسمٌ غائبٌ تماماً.

**الإصلاح.** أُضيف `MONGO_URI` في موضعه مع سطرين يُميّزانه عن `MONGODB_URI`،
وسببِ الخطأ لمن يقرأ لاحقاً.

**أخطاءُ قياسٍ لي في هذا السبرنت، مسجَّلة:**

1. **خمسةُ إنذاراتٍ كاذبة.** اشتقاقي لـ«أسماءٍ مُعلَنةٍ لا يقرؤها الكود» أعطى
   ٥ (`GITHUB_PLATFORM_TOKEN`, `RENDER_API_KEY`, …). وكلُّها **حيّة**: تُقرأ
   بصيغة `env.NAME` لا `process.env.NAME`، وتعبيري النمطيُّ لم يرَ إلّا
   الثانية. لولا أنّي تحقّقتُ من واحدٍ منها قبل الإبلاغ لأخبرتُ المالكَ عن
   كودٍ ميّتٍ وهو عامل. **الاشتقاقُ الضيّقُ يُنتج أشباحاً كما يُنتج ثغرات.**

2. **إنذارُ تسريبٍ نفيتُه بنفسي.** ثلاثةُ أسطرٍ في `.env.example` غيرُ فارغة،
   وأحدها `mongodb+srv:` بطول ٩٤ — فاحتملتُ بيانات اعتمادٍ منشورة. فحصتُ
   **الشكلَ دون القيمة** (طول، بادئة، وجودُ `...` و`#`) فتبيّن أنّه
   `mongodb+srv://...` وتعليقٌ عربيّ: قالبٌ لا سرّ. النتيجةُ سلبيّة،
   والطريقةُ هي المهمّة: **يُفحص السرُّ المشتبَهُ بشكله لا بمحتواه.**

**نتيجةٌ أخرى مسجَّلة.** أوّلُ ما ظنّه المالكُ أنّ إعادةَ النشر تُنشئ الفهارس؛
وهي لا تفعل ولن تفعل — `autoIndex=false` قرارٌ صريح. والسجلُّ يقول ذلك في
سطره. فالتقريرُ الصادقُ أدّى وظيفتَه: لم يَعِدْ بما لا يفعل.

**الأثر.** توثيقٌ فقط. الاختبارات ١٣٢٦، خضراء.

---

## Sprint 4g — بوّابةُ الـLLM تنزل تحت الوكلاء (الخطوة ١ من ترتيب التدقيق)

**المدخل.** قال المالك «ابدا»، والخطوةُ الأولى في `ARCHITECTURE_GAP_AUDIT.md`
هي إنزالُ بوّابة الـLLM: أرخصُ حركةٍ بأكبر أثرٍ بنيويّ، ولا تمسّ منطقَ وكيل.

**العطب البنيويّ (لا عطبَ سلوكيّ هنا).** `agents/baseAgent.js` كان **بوّابةَ
الـLLM الوحيدة** في المشروع كلِّه، ويسكن `agents/`. فكلُّ خدمةٍ تحتاج نموذجاً
مضطرّةٌ لاستيراد وكيل: ٧ من ١٤ حافّةِ انعكاسِ طبقاتٍ (`services → agents`)
سببُها هذا الموضعُ وحده، لا حاجةٌ حقيقيّةٌ إلى منطقِ وكيل.

**القياس قبل.** `services → agents` = **١٤**، `core → agents` = ٠،
`root → core` = ٤. مستهلكو `baseAgent`: ٢٦ موضعَ استيرادٍ في ٢٥ ملفاً.

**الإصلاح.** `git mv agents/baseAgent.js core/providers/llm.js` — ١٥١ سطراً،
**لا سطرَ منطقٍ واحدٍ تغيّر** (`git show --stat` يُظهر R100). ثمّ إعادةُ
توجيه ٢٦ مواضعِ الاستيراد، وتصحيحُ ٥ تعليقاتٍ ووثيقتين كنّ يسمّين المسارَ القديم.

**لماذا `core/providers/llm.js` لا `core/plugins/ProviderRegistry.js`؟**
الخريطةُ تُعلن الثانيَ وِجهةً (سطر ٩٩)، لكنّ `ARCHITECTURE_MIGRATION.md` نفسَها
تقول إنّ مستهلكَ الـRegistry الوحيد هو Model Router — وهو غيرُ موجود. فبناؤه
اليوم يخالف «لا تجريد بلا مستهلك حقيقي»، ويُسمّي نقلاً حرفيّاً باسمٍ أوسعَ
ممّا هو — وهي عينُ عائلةِ العطب التي نطاردها منذ 4c. فالاسمُ يصف ما هو:
مزوّدُ LLM يسكن تحت الوكلاء. والوِجهةُ المُعلَنةُ باقيةٌ في الخريطة كنيّة.

**القياس بعد (بـ`node scripts/layerEdges.mjs`).**

| الحافّة | قبل | بعد |
|---|---|---|
| `services → agents` | ١٤ | **٧** |
| `services → core` | ٠ | ٧ |
| `core → agents` | ٠ | ٠ |
| `root → core` / `root → agents` | ٤ / ٣١ | ٥ / ٣٠ |

والسبعُ الباقيةُ كلُّها اعتمادٌ على **منطقِ وكيلٍ حقيقيّ** لا على نموذج:
صور (`imageForge`/`seedStamp`)، توضيح (`clarifierAgent`)، حالة (`stateMachine`)،
نشر (`renderAgent`)، git (`gitAgent`)، سياقُ المنصّة (`platformContext`).

**خطأٌ لي في هذا السبرنت، مسجَّلٌ لأنّه مُعلِّم.** كتبتُ إعادةَ التوجيه بتعبيرٍ
نمطيّ `[^'"]*baseAgent\.js` — فطابق **`databaseAgent.js`** أيضاً (لاحقةٌ لا
اسم). فأُعيد توجيهُ موضعين خطأً إلى مزوّد الـLLM، فانكسر ٦ ملفّاتِ اختبار
بـ`does not provide an export named 'generateDatabase'`. أوقعتْه الحزمةُ في
أوّل تشغيل. **الدرس**: مطابقةُ اسمِ ملفٍّ بلاحقتِه تبتلع كلَّ اسمٍ ينتهي بها؛
والحدُّ (`/` قبله) شرط. وعددي «٢٨ موضعاً» كان خطأً: الصحيحُ **٢٦**.

**حارسٌ جديد: `tests/layerInversion.test.mjs` (٤ اختبارات).** يشتقّ الحوافَ من
القرص (`scripts/layerEdges.mjs`) ويثبّت السبعَ الباقيةَ **بأسمائها**، ويؤكّد
`core → agents/services` = صفر، وأنّ `agents/baseAgent.js` لم يعد يُستورد.
والتوقّعُ مكتوبٌ بيدٍ عمداً: لو اشتُقّ من الاشتقاق نفسِه لسأل المفحوصَ عن
نفسِه — وهو خطأُ `templateRegistrySync` الذي نجت منه طفرةٌ في 4d.

**جدولُ الطفرات (كلُّها طُبِّقت وشُوهد أثرُها، ثمّ استُعيد الأصل):**

| # | الطفرة | المتوقَّع | الواقع |
|---|---|---|---|
| ١ | ملفُّ خدمةٍ جديدٌ يستورد `agents/router.js` | يسقط ٢ | ✅ سقط ٢ |
| ٢ | ملفٌّ في `core/` يستورد وكيلاً | يسقط ٣ | ✅ سقط ٣ |
| ٣ | إعادةُ `agents/baseAgent.js` وخدمةٍ تستورده | يسقط ٢ و٤ | ✅ سقطا |
| ٤ | إسقاطُ `services/` من نطاق المسح | يسقط حارسُ الخواء | ⚠️ **نجا أوّلاً** |
| ٥ | إسقاطُ الاستيراد الديناميكيّ من الاشتقاق | — | ٢٦ ← ٢٣ مستهلكاً؛ سقط ٢ |
| ٦ | إسقاطُ `core/` من نطاق المسح | يسقط حارسُ الخواء | ✅ بعد التصحيح |

**الطفرةُ ٤ كشفت عطباً في حارسي أنا.** كتبتُ حارسَ الخواء يسأل
`root → services > 20` — والحافّةُ تُحسب من **مصدرها**، فإسقاطُ مجلّدٍ من
المسح يُخفي ما يخرج منه لا ما يدخل إليه: نجا. ثمّ صحّحتُه ليسأل «أيُّ الطبقات
مُسحت»، فسقط — لكنّه سقط على الكود السليم أيضاً، لأنّ `core/` له **صفرُ حوافَ
خارجة** فعلاً (لا يستورد ما فوقه، وهو المطلوب). فصار القياسُ على **ما مُسح**
(`scannedFiles()`) لا على **ما نتج**، وإلا صار الصمتُ الصحيحُ دليلَ عطب.
حارسٌ لا يقع أسوأ من لا حارس — والطريقُ إليه مرَّ بحارسَين خاطئين.

**نتيجةٌ سلبيّةٌ مسجَّلة.** الطفرةُ ٥ أثبتت أنّ بندَ الاستيراد الديناميكيّ في
الاشتقاق **حامل**: `services/adminService.js` وغيرُه يصلون إلى المزوّد
بـ`await import(...)`، وإسقاطُ البند يُنقص ٣ مستهلكين. المسحُ الساكن لا يرى
المسارَ المحسوب، فأعدادُ التدقيق **حدٌّ أدنى** لا نهائيّ — وهذا مكتوبٌ في
رأسِ `layerEdges.mjs` لا في الذاكرة.

**وثيقةٌ صارت قابلةً لإعادة الإنتاج.** كان §٧ من التدقيق يقول إنّ أوامرَ
القياس «محفوظةٌ في `/tmp` أثناء الجلسة» — أي غيرُ موجودةٍ لمن يقرأ. فصار
الاشتقاقُ ملفّاً مُودَعاً يُشغَّل بأمرٍ واحد.

**الأثر.** الاختبارات ١٣٢٦ ← **١٣٣٠**، خضراء. لا تغييرَ سلوكيّ: النقلُ حرفيّ.

---

## Sprint 4h — جذورُ القرص تُصرَّح مرّةً واحدة (الخطوة ٢، الشطرُ الأوّل)

**المدخل.** اختار المالك «ابدا بـ٢ ثم اكمل البقية» — وهي بوّابةُ الكتابة على
القرص، أوسعُ ما في ترتيب التدقيق.

**أوّلُ ما فعلتُه: أعدتُ القياس — فسقط الرقم.** قال التدقيقُ «٣٣ كاتباً»؛
المقيسُ **١٩٨ موضعاً في ٤٦ ملفاً**. الفرقُ أكثرُ من خمسة أضعاف، لأنّ الرقمَ
الأوّل مطابقةٌ نصّيّةٌ ساذجةٌ لا تعرف بنيةَ الملفّ.

**عطبان في أداةِ القياس نفسِها — والأهمُّ أنّهما كُشفا بالفحص اليدويّ:**

1. **علامةُ الفتح تُغلق نفسَها.** الدخولُ إلى وضع النصّ لم يكن يبتلع علامةَ
   الفتح، فيراها فرعُ النصّ في الدورة التالية علامةَ إغلاق — فكلُّ نصٍّ عاديّ
   يُقرأ كوداً. كشفَتْه عيّنةٌ حقيقتُها معروفةٌ سلفاً.
2. **الحرفيّةُ النمطيّة تُفسد ما بعدها.** `agents/jcr.js:1769` فيه
   `/["'«»]/g`؛ والماسحُ لا يعرف الأنماط، فيفتح نصّاً لا يُغلق وينحرف تصنيفُ
   بقيّة الملفّ. أبلغ حينها أنّ **٤٤ كتابةً حيّةً «في تعليقٍ أو نصّ»**.
   فحصتُ **ستّاً** منها بيدي — كلُّها كتاباتٌ حقيقيّة. لولا الفحصُ اليدويُّ
   لبنيتُ الخطوةَ كلَّها على رقمٍ كاذب.

   **القاعدة**: أداةُ القياس تُعايَر بعيّنةٍ حقيقتُها معروفةٌ **قبل** أن يُوثَق
   برقمها. `tests/diskWriteScan.test.mjs` يثبّت العطبين بحالتيهما.

**العطبُ البنيويّ.** الـ١٩٨ تنتهي كلُّها إلى **ثلاثة جذور**:
`workspace/` و`memory/` و`plugins/`. وكانت تُشتقّ في **اثني عشر موضعاً
مستقلاًّ**، كلٌّ بعدِّ `..` خاصٍّ به:

| الجذر | اشتقاقات | المواضع |
|---|---|---|
| `workspace` | ٤ | `server.js`، `jcr.js`، `systemDoctorAgent.js`، `adminService.js` |
| `memory` | ٥ | `jcr.js`، `projectMemory.js`، `userProfile.js`، `conversationStore.js`، `ExecutionQueue.js` |
| `plugins` | ٣ | `pluginStore.js`، `adminService.js`، `PluginOrchestrator.js` |

**نتيجةٌ سلبيّةٌ مسجَّلة**: الاثنا عشر تحلّ **جميعاً** إلى المسارات نفسها
اليوم — لا عطبَ سلوكيّاً في الجذور. وهذا حظٌّ لا ضمانة: سؤالٌ واحدٌ باثني
عشر جواباً، أحدُها يكفي أن ينحرف. وهي عائلةُ 7/1 (`needsBackend`) و7/2
(اسمُ خدمة النشر بستّة اشتقاقات) نفسُها.

**الانحرافُ الوحيد المُكتشَف — وكان في مسار المشروع لا الجذر.** `jcr.js:1110`
كان يبني `<ws>/<user>/<project>` بيده: نفسُ التطهير، لكن **بلا** احتياطَي
`projectPathOf` (`guest_user`/`sandbox_app`). فلو خلا أحدُ الاسمين لأشار هذا
إلى مسارٍ غيرِ الذي يراه بقيّةُ النظام. نُقل إلى `projectPathOf`.

**الإصلاح.** `core/runtime/workspaceRoots.js` (٤٣ سطراً) يصرّح الجذورَ الثلاثة
مرّةً، مشتقّةً من موقعه. و**لا يلمس القرص**: إنشاءُ `workspace/` يبقى في
`server.js` عند الإقلاع — خلطُ الاشتقاق بالإنشاء هو بعينه عطبُ `getProjectPath`
القديم (فحصُ وجودٍ يُنشئ ما يفحصه فلا يقع أبداً).

**وهذه ليست البوّابة.** تسميتُها «بوّابةَ كتابة» تسميةٌ أوسعُ ممّا هي — وهو
العطبُ الذي نطارده. هي **الشرطُ الذي بدونه لا بوّابةَ أصلاً**: لا يُضبط ما لا
مكانَ واحداً يسمّيه.

**حارسان جديدان (٩ اختبارات):**
- `tests/workspaceRoots.test.mjs` (٥) — يُقاس **بنصِّ الملفّات** لا بقيمة
  الثوابت: لو سألنا الوحداتِ عن جذورها لأجابت الجوابَ الصحيح **حتى لو اشتقّه
  كلٌّ منها بيده**، فيمرّ الحارسُ على العطب الذي وُجد له. وفيه اختبارٌ يتحقّق
  أنّ النمطَ يلتقط ملفَّ التصريح نفسَه — وإلا لمرّ بنمطٍ لا يطابق شيئاً.
- `tests/diskWriteScan.test.mjs` (٤) — معايرةُ الماسح بعيّنةٍ معروفة.

**جدولُ الطفرات (كلُّها طُبِّقت وشُوهد أثرُها ثمّ استُعيد الأصل):**

| # | الطفرة | الواقع |
|---|---|---|
| ١ | خدمةٌ جديدةٌ تشتقّ `../plugins` | ✅ سقط حارسُ الاشتقاق |
| ٢ | `server.js` يشتقّ `../workspace` ثانيةً | ✅ سقط |
| ٣ | `MEMORY_ROOT` إلى جذرٍ خطأ | ✅ سقط حارسُ المطابقة |
| ٤ | التصريحُ يُنشئ المجلّد | ✅ سقط حارسُ النقاء |
| ٥ | نمطٌ لا يطابق شيئاً | ✅ سقط حارسُ قدرةِ النمط |
| ٦ | إعادةُ عطبِ «علامةُ الفتح» للماسح | ✅ سقط ١ و٢ |
| ٧ | إسقاطُ معالجة النمط الحرفيّ | ✅ سقط ١ و٣ و٤ — بنفسِ عَرَضِه الحقيقيّ |

**خطأٌ آخرُ لي، مسجَّل.** حدّثتُ عنوانَ القسم A في الخريطة بسكربت Python
استعمل `[^]*?` — وهو في JavaScript «أيُّ حرف» وفي Python صنفُ أحرفٍ معطوب.
فكتبتُ «١ استيراداً محلياً» بدل ٩٨. أوقعه حارسُ الخريطة في الحال. **تعبيرٌ
نمطيٌّ صحيحٌ في لغةٍ ليس صحيحاً في أخرى.**

**الأثر.** الاختبارات ١٣٣٠ ← **١٣٣٩**، خضراء. لا تغييرَ سلوكيّ إلا الاحتياطان
في مسار `jcr.js`. أدواتٌ مُودَعة: `scripts/diskWrites.mjs`.

---

## Sprint 4i — الخطوتان ٣ و٤: إحداهما كان اقتراحي فيها خطأً

**المدخل.** «ثم اكمل البقية»: الخطوة ٣ (بابُ النشر الواحد) والخطوة ٤ (تناقضُ
الخريطة). وكلتاهما خرجت عن التوقّع، في اتّجاهين متعاكسين.

### الخطوة ٣ — قرأتُ الكودَ قبل أن ألمسه، فسقط اقتراحي

كتبتُ في التدقيق: «النشر: بابان من `server.js`… توحيدُ مدخلَي
`/api/template/apply` و`/api/deploy`». والمقروءُ من الكود:

- `/api/template/apply` **لا ينشر**: `prepareRenderDeploy` دالّةُ **كتابةِ
  ملفّات** (`render.yaml` + README)، لا نشر.
- `autoDeployFullStack` **تستدعي `prepareRenderDeploy` بنفسها**
  (`deployAutomation.js:212`) — مستهلكُها لا طريقٌ ثانٍ إليها.
- **موضعٌ واحدٌ في المشروع يخاطب واجهة Render**: `deployAutomation.js:24`.
  و`deployToRender` **لا ينشر أصلاً**: يجهّز، يدفع إلى GitHub، ويعيد رابطَ
  نشرٍ بضغطةٍ واحدة.

فما بدا «بابين» **مسارٌ آليٌّ واحد واحتياطٌ يدويّ**، و`/api/deploy` يسقط من
الأوّل إلى الثاني عمداً. ولو نفّذتُ اقتراحي لجعلتُ «تطبيقَ قالبٍ» يَنشر.

**الدرس**: التدقيقُ الساكن يرى الحوافَ لا المعاني. حافّةٌ من `server.js` إلى
`renderAgent` وأخرى إلى `deployAutomation` تبدوان بابين — وقراءةُ الجسدين
تقول إنّ إحداهما تجهيزٌ والأخرى نشر. **الاقتراحُ المبنيُّ على مصفوفةٍ يُراجَع
بالقراءة قبل التنفيذ.**

### والعطبُ الحقيقيُّ ظهر مكانَه

`prepareRenderDeploy` يقلب `render.yaml` رأساً على عقب بحسب `hasBackend`:
**موقعٌ ثابت** (`env: static`) مقابل **خدمةِ Node** (`npm install` +
`node server.js` + `MONGODB_URI`). والسؤالُ «أيحتاج خلفيةً؟» له **مصدرُ حقيقةٍ
واحد** منذ 7/1 — ويُجاب في **ستّة مواضع**:

| الموضع | الجواب | الحكم |
|---|---|---|
| `jcr.js:983` | `needsBackend(...)` | ✅ المصدرُ الواحد |
| `jcr.js:2321`، `jcr.js:2383` | `false` ثابتاً | مسارُ الكلون الثابت — مقصودٌ وموثَّقٌ في موضعه |
| `server.js:2382` | `false` ثابتاً | `/api/template/apply` — مقصود |
| `server.js:2517` (`deployToRender`) | `true` ثابتاً | يُلغي ما سبق |
| `deployAutomation.js:213` | `true` ثابتاً | يُلغي ما سبق |

**المقيس**: كلُّ نشرٍ يُعيد توليدَ `render.yaml` بـ`true`، فيمحو قرارَ «موقعٌ
ثابت» المتَّخذَ عند التجهيز. مشروعٌ ثابتٌ يُنشَر خدمةَ Node.

**ولم أُصلحه.** أهذا مقصودٌ («خادمٌ دائم» كما يقول سجلُّ النشر) أم انحراف؟
قرارُ سلوكٍ يمسّ **مواقعَ منشورةً حيّة**، ولا يملكه تدقيق. ثُبِّتت الحالةُ
المقيسة بأسمائها في `tests/renderConfigShape.test.mjs` (٤ اختبارات) كي لا
تنزلق أكثر ويصير أيُّ تغييرٍ قراراً واعياً. **أربعُ طفراتٍ طُبِّقت، كلٌّ
أوقعها الحارسُ المقصود وحده.**

### الخطوة ٤ — كانت أوسعَ من «سطرٍ واحد»

توقّعتُ تناقضاً في سطرٍ عن `utils/aiProvider.js`. المقيس: الصفُّ ٢٤٠ يسمّي
**خمسَ** وحداتٍ «أدواتٍ صغيرةً حيّة» بحكم KEEP، و**ثلاثٌ منها يتيمةٌ بصفرِ
مستوردين**: `utils/aiProvider.js`، `utils/performance.js`، `utils/security.js`.
وكلُّها **مُقرَّةٌ يتيمةً في §اليتامى من الخريطة نفسِها** (أسطر ٣٣٥–٣٣٧) منذ
8/11. فالخريطةُ كانت تناقض نفسَها في موضعين لا واحد.

وفحصتُ الخمسةَ جميعاً لا المذكورَ وحده — وهو ما كشف الاثنين الآخرين:
`corsErrors.js` (٢ مستوردَين) و`spaFallback.js` (١) حيّتان فعلاً. قُسم الصفُّ
بصدق، والحكمُ KEEP بقي على اليتامى لأنّه **قرارُ إبقاءٍ واعٍ** (8/11) لا وصفُ
استعمال — والفرقُ بينهما هو كلُّ ما في الأمر.

**الأثر.** الاختبارات ١٣٣٩ ← **١٣٤٣**، خضراء. لا سطرَ منطقٍ تغيّر: تصحيحُ
وثائق + حارسٌ يثبّت حالةً مقيسة.

---

## Sprint 4j — سحبُ دعوىً كتبتُها، والعطبُ الذي ظهر مكانَها

**المدخل.** رفع المالكُ القيدَ: «كل المواقع كانت للتجربة… افعل كل شي يكون
الأفضل تقنيا». فعدتُ إلى ما أوقفتُه في 4i — شكلِ `render.yaml` — لأنفّذه.

### أوّلاً: الدعوى كانت خاطئة، ولم تكن بحاجةٍ إلى قرارٍ أصلاً

قلتُ في 4i إنّ مسارَي النشر يفرضان `hasBackend: true` فيُلغيان قرارَ التجهيز،
وإنّ «مشروعاً ثابتاً يُنشَر خدمةَ Node». وكتبتُ ذلك في التدقيق وجسم الـPR
وهذا الملفّ، وطلبتُ قرارَ المالك.

**والمواضعُ الثلاثة كلُّها داخل حارسٍ لم أقرأه**: `isFullStackProject(projectPath)`
(`server.js:2484`، `jcr.js:2937`)، وهو يشترط **دالّةً حقيقيّةً** في `api/` —
لا `db.js`/`schema.js`/`seed.js`/`connection.js`. فالموقعُ الثابتُ **لا يبلغ
تلك الأسطر**، و`true` عندها **نتيجةٌ مثبتةٌ لا ترميزٌ صلب**.

**وهذا غلطي مرّتين في المسار نفسِه**، والعلّةُ واحدة:

| # | ما قرأتُ | ما أغفلتُ | الحكمُ الخاطئ |
|---|---|---|---|
| 4i | حافّتين من `server.js` إلى وحدتَي نشر | أنّ إحداهما تجهيزٌ لا نشر | «بابان» |
| 4j | قيمةً ثابتةً في سطرِ نداء | **الشرطَ المحيط بالسطر** | «انحرافٌ في النشر» |

**القاعدة**: *الحارسُ جزءٌ من المعنى.* قيمةٌ ثابتةٌ داخل شرطٍ صحيحٍ ليست
ترميزاً صلباً؛ وقراءةُ السطر معزولاً تُنتج عطباً غيرَ موجودٍ كما تُخفي عطباً
موجوداً. والفارقُ العمليّ: **ما نجّاني هنا أنّي قرأتُ قبل أن أُعدّل** — الطفرةُ
لم تكن لتكشفه، لأنّ الحارسَ لم يكن في الاختبار.

`tests/renderConfigShape.test.mjs` أُعيدت صياغتُه: لم يعد يثبّت «حالةً تنتظر
قراراً»، بل **الاقترانَ الذي يجعل `true` صحيحة** — لو زال الحارسُ صار الثابتُ
عطباً. وأُضيف اختبارٌ يثبّت أنّ الحارسَ يعني ما يقول.

### ثانياً: العطبُ الحقيقيُّ في المنطقة نفسِها — حقلان يُقرآن ولا يُكتبان

ظهر عند التحقّق: `tech.hasBackend` و`tech.apis` في ذاكرة المشروع لهما
**ثلاثةُ قرّاء وصفرُ كُتّاب** إنتاجيّين (`updateTech` لم يستدعِها إلا اختبار):

| القارئ | ما يفعله | أثرُ الغياب |
|---|---|---|
| `projectMemory:244` | يطبع «APIs موجودة: …» في سياق النموذج | النموذجُ لا يعرف واجهاتِ مشروعه أبداً |
| `projectBrain:109` | يضيف «خادم/API» إلى **المُنجَز** | بندٌ ميّت (الدليلُ من القرص يحمله) |
| `projectBrain:136` | «قاعدة بيانات للخادم» في **المتبقّي** | لا تظهر أبداً |

وحين وصلتُهما ظهر خلطٌ أعمق كان الغيابُ يُخفيه: **النيّةُ ليست الدليل.**
`hasBackend` نيّةٌ مشتقّةٌ من نصّ الهدف؛ `apis` دليلٌ مجرودٌ من القرص. فوضعُ
النيّة في «المُنجَز» يجعل المشروعَ **يدّعي خادماً لم يُكتب فيه سطر** — وهي
عائلةُ العطب التي نطاردها منذ 4c بعينها. ولو وصلتُ الحقلَ بلا هذا التمييز
لأصلحتُ فرعاً ميّتاً بأن جعلتُه يكذب.

**الإصلاح:**
1. `deployAgent`: `listApiModules()` تُجرد الدوالّ الحقيقية، و`isFullStackProject`
   صار **يستدعيها** — قائمةُ استثناءٍ واحدة لا نسختان (عائلة 7/1 و7/2 و4h).
2. `jcr._stageRenderConfig`: يحفظ النيّةَ والدليلَ معاً بـ`updateTech`.
3. `projectBrain:109`: أُسقط `|| !!tech.hasBackend` — **المُنجَز دليلٌ لا نيّة**.
4. `projectMemory:244`: الشرطُ صار على `apis.length` — **يُشترط ما يُطبع**، وإلا
   طُبع «APIs موجودة: » خاوياً حين تصدق النيّةُ وتفرغ القائمة.

**جدولُ الطفرات (خمسٌ، كلٌّ أوقعها الحارسُ المقصود وحده):**

| # | الطفرة | الواقع |
|---|---|---|
| ١ | الجردُ لا يستثني ملفّاتِ البيانات | ✅ سقط ١ |
| ٢ | الحارسُ ينسخ القائمةَ بدل اتّباع الجرد | ✅ سقط ١ |
| ٣ | عودةُ خلطِ النيّة بالدليل في «المُنجَز» | ✅ سقط ٣ |
| ٤ | «المتبقّي» يفقد النيّة | ✅ سقط ٤ |
| ٥ | الشرطُ يعود يسأل عن غير ما يطبع | ✅ سقط ٥ |

**الأثر.** الاختبارات ١٣٤٣ ← **١٣٤٩**، خضراء. وتصحيحُ الدعوى مثبتٌ في
`ARCHITECTURE_GAP_AUDIT.md` §٥ و§٨ — لأنّها دُمجت في `main` قبل أن أكتشف خطأها.

---

## Sprint 4k — البوّابةُ كانت موجودةً، وتسعةَ عشرَ موضعاً يتخطّونها

**المدخل.** فوّض المالك: «افعل كل شي يكون الأفضل تقنيا». فبدأتُ الشطرَ الثاني
من الخطوة ٢ — بوّابةَ الكتابة على القرص.

**وأوّلُ ما وجدتُه أنّها لا تحتاج بناءً: هي موجودةٌ منذ Sprint 2c.**
`writePlanFiles` في `jcr.js` يطهّر الاسمَ ويتحقّق من الاحتواء عبر
`resolveInside`. لكنّ `jcr.js` يكتب ملفّات المشروع في **عشرين موضعاً**،
و**تسعةَ عشرَ** منها تكتب `path.join(root, f.name)` مباشرةً — بلا احتواء.

فالعملُ لم يكن «ابنِ تجريداً» بل **«طبّق ما بُني»**. وهذا فرقٌ في الحكم لا في
الجهد: لو بنيتُ بوّابةً جديدةً لصارت الحادية والعشرين.

**أخطرُ المتخطّين: مسارُ التعديل** (`jcr.js:2092` سابقاً). أسماءُ ملفّاته من
**مخرجات النموذج**، ويمرّ بـ`guardFiles` و`ensureEditIntegrity` — وكلاهما
يفحص **المحتوى** لا الاسم. فاسمٌ مثل `../../<مستخدمٍ آخر>/index.html` يخرج من
مشروع صاحبه. (عائلةُ 8/10: مفتاحٌ مسطّحٌ يخلط مشروعَي مستخدمَين.)

**الفخُّ الذي كاد يوقعني.** سياسةُ `writePlanFiles` ترفض **كلَّ** اسمٍ منقوط
بحجّةٍ مكتوبةٍ في الكود: «لن تُخدَّم أصلاً». وهي **حجّةُ خدمةٍ لا حجّةُ كتابة**.
وأربعةُ مولّدات تُخرج `.env.example` و`.gitignore`. فلو عمّمتُ السياسةَ كما هي
على المواضع التسعةَ عشرَ **لحذفتُ `.env.example` من كل مشروعٍ صامتاً** — ولوقع
`jcrRuntimePipeline` الذي يؤكّد وجودَه على القرص. الحدُّ بين «ما يُكتب» و«ما
يُخدَّم» ليس واحداً، وخلطُهما يُنتج حذفاً صامتاً.

**وقائمةُ الاستثناء كانت مكرّرةً ومتضاربة**: `fileManager` يسمح بـ`.gitignore`
و`.env.example`؛ `projectBrain` بـ`.env.example` وحده. فملفٌّ يُحفَظ في النسخة
الاحتياطيّة ولا يراه «دماغُ المشروع». صارت `PROJECT_DOTFILES` مصدراً واحداً،
مغلقاً **عن قياسِ مخرجات المولّدات** لا عن حدس: لا اسمَ منقوطٍ غيرهما، ولا
مجلّدَ منقوطٍ إطلاقاً.

**الإصلاح.**
- `core/runtime/workspacePaths.js`: `resolveProjectFile(root, name)` +
  `PROJECT_DOTFILES`. **لم تُدمَج الحُرّاسُ الثلاثة** التي وثّق الملفُّ عمداً
  إبقاءَها متفرّقة (`safeRelPath`/`sanitizePath`/`writePlanFiles`) — هذه
  **السياسةُ الرابعة**: ملفّاتُ المشروع المولَّدة.
- `jcr.js`: `writeProjectFile()` كاتباً مفرداً محتوىً، و**عشرون موضعاً** تمرّ
  به. و`writePlanFiles` صار يُرجع `{written, rejected}` — الرفضُ يُحصى لا يُبتلع.
- `fileManager` و`projectBrain` يتبعان القائمة الواحدة.

**نتيجةٌ مقيسةٌ عن الاحتواء — والطريقُ إليها أهمُّ من النتيجة:**

| # | الطفرة | النتيجة |
|---|---|---|
| ١ | إلغاءُ فحص `..` في الحلقة | **نجت** |
| ٢ | إلغاءُ فحص المسار المطلق | **نجت** |
| ٧ | `isInsideRoot` يقول «نعم» دائماً | **نجت** |
| ٨ | `resolveInside` يعيد المسارَ بلا فحص | **نجت** |
| ٩ | **الطبقتان معاً** | ✅ **سقط** حارسُ الأسماء العدائيّة |
| ٣ | عودةُ رفضِ كلِّ منقوط | ✅ سقط ٣ |
| ٤ | `.env` يصير مسموحاً | ✅ سقط ٣ |
| ٥ | عودةُ موضعٍ غيرِ محتوى في `jcr.js` | ✅ سقط ٥ |
| ٦ | عودةُ القائمة المنقوصة | ✅ سقط ٤ |

أربعُ طفراتٍ نجت. والقراءةُ الساذجة: «الاختبارُ ضعيف». والتجربةُ الحاسمة
(الطفرة ٩) تقول غيرَ ذلك: **الطبقتان تغطّيان الحالاتِ العدائيّةَ كلٌّ على
حدة**، فلا تكشف إزالةُ إحداهما شيئاً لأنّ الخاصّيّةَ **لم تُنتهك**. ولمّا
أُزيلتا معاً سقط الاختبارُ في الحال.

**القاعدة**: *طفرةٌ ناجيةٌ ليست بالضرورة اختباراً ضعيفاً — قد تكون دفاعاً في
العمق. والفرقُ بين التفسيرين لا يُحسم بالتأمّل بل بتجربةٍ تُزيل الطبقات معاً.*
والاختبارُ يقيس **الخاصّيّة** (لا يُكتب خارج الجذر) لا التطبيق — وهذا صوابُه.

**الأثر.** الاختبارات ١٣٤٩ ← **١٣٥٥**، خضراء. لا تغييرَ سلوكيّ للأسماء
المشروعة؛ والعدائيّةُ كانت تُكتب فصارت تُرفض.
