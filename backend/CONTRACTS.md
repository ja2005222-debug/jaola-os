# 📐 JAOLA OS — عقود المرحلة الأولى (Phase 1 Contracts)

> الوثيقة المرجعية لعقود النواة. تكمّل `ARCHITECTURE_MIGRATION.md` (سجلّ
> القرارات) ولا تكرّره: هنا **الشكل** — هناك **لماذا**.
>
> **القاعدة الحاكمة** (نفسها): كل عقد هنا مأخوذ من استدعاء حقيقي في الكود
> (مسار + سطر + grep) لا من تصميم نظري. الجزء التشغيلي الوحيد هو
> `agents/contracts.js`، وفيه فقط ما له مستهلك حيّ اليوم — لا تجريد بلا مستهلك
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
  `handleUserMessage`) — الحقول العشرة موثّقة كـ`@typedef` في `agents/contracts.js`.
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
- `dbStatus` مرشَّح للنقل إلى **سياق وقت التشغيل** (`JCRContext`) بدل التمرير
  اليدوي — تغيير توقيع 6 دوال، يُؤجَّل إلى الخطوة 2 (توحيد التوقيعات) ليُنفَّذ
  دفعة واحدة مع بقية المعاملات الموضعية (`goal, projectPath, username,
  activeProject, roomName, agents, dbStatus` تتكرّر حرفياً في 5 توقيعات).

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
   `BUILD_AGENTS_OPTIONAL` (15) في `agents/contracts.js`، والنواة تتحقّق منه
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
- **أول خطوة قابلة للاختبار**: توحيد الحرّاس الثلاثة في دالة واحدة
  (`services/workspaceGuard.js`) تستهلكها المواضع الثلاثة — استخراج حرفي بخط
  أساس (اختبارات المسارات الموجودة في `backendTeam.test.mjs` + اختبار جديد
  لـ`writePlanFiles`). لا يُلمس أي وكيل آخر في هذه الخطوة.
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

## 📋 ملخّص القرارات

| العقد | الحالة قبل | القرار | أوّل مستهلك |
|---|---|---|---|
| Mission | شكل ضمني في 7 معالجات | ثُبِّت كـ`MissionRequest` (typedef) — الهوية `username:project` تبقى | المعالجات السبعة (قائم) |
| Agent | 19 دالة بلا تصنيف + عضو ميت | إلزامي 3 / اختياري 15 / حُذف 1 + `assertBuildAgents` | `runDynamicMultiAgentRuntime` (✅ الآن) |
| Tool | لا شيء + 3 حرّاس مكرّرة | `workspaceGuard` موحّد أولاً، ثم Tool بعد موضعين | الحرّاس الثلاثة (الخطوة التالية في هذا المحور) |
| Event | ناضج بطبقتين | يبقى؛ `log` منظّم لاحقاً بإضافة حقول | قائم |
| Evidence | `check` متماسك | يُثبَّت؛ النقّاد يُضيفون `checks[]` في الخطوة 2 | قائم |
| Permission | عند الحدّ فقط | `req.caps` مشتقّ عند الحدّ — مؤجَّل لمستهلك ثانٍ | `generateAiImages` (مغلق حالياً) |

## 🔗 الترتيب المعتمد للخطوات التالية (يقود الخطة)
1. ✅ هذه الوثيقة + `assertBuildAgents` + حذف العضو الميت.
2. توحيد **مخرجات** الحزمة (`{ok, …}`) عبر مُهايئات في `server.js`، ثم المدخلات
   `(input, ctx)`؛ نقل `dbStatus` إلى `JCRContext`؛ `checks[]` للنقّاد.
3. Kernel: `runDynamicMultiAgentRuntime` من قائمة استدعاءات إلى مصفوفة مراحل
   `[{ name, run: StageFn, optional }]` قابلة للتشغيل الجزئي والإيقاف.
4. Model Router (يحتاج 3). 5. Verification طبقةً (يحتاج `check`). 6. Mission
   Control (يحتاج 3+5، ومعه `log` المنظّم). 7. Plugin Runtime 2.0.
- بالتوازي، مستقلّ عن الترتيب: `workspaceGuard` (Tool، خطوة أولى).
