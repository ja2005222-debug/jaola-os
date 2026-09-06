# 🗺️ JAOLA OS — الخريطة المعمارية ملفاً بملف (2026-09-03)

> تنفيذ البند 22 من الخط الأساس (`docs/ARCHITECTURE_BASELINE_2026-09-03.md`):
> `CURRENT FILE → RESPONSIBILITY → KEEP/MODIFY/MOVE → NEW CONTRACT → FINAL LOCATION`
> بالأولوية المعتمدة: `server.js` ← `core/*` ← `agents/*` ← `services/*` ← `travel-service/*`.
>
> **كيف بُنيت**: جرد آلي لكل وحدة (سطور، عدد المستوردين بـgrep على اسم الملف في
> backend + frontend/src + .github + tests، وسطر الوصف الأول)، ثم فحص يدوي لكل
> شذوذ (استيراد تأثير جانبي، تطابق اسم كاذب) وتاريخ git لكل مرشّح حذف. الأرقام
> أدناه من هذا الجرد لا من انطباع. المسؤولية مأخوذة من رأس الملف نفسه.

## المفاتيح
| قرار | معناه |
|---|---|
| **KEEP** | يبقى كما هو ومكانه؛ لا عقد جديد يمسّه في v2 أو يستهلكه كما هو |
| **MODIFY** | يبقى مكانه لكن يتغيّر ليستهلك/ينتج عقداً من v2 |
| **MOVE** | ينتقل إلى موقع v2 (Sprint المحدَّد) بلا إعادة كتابة |
| **ADAPT** | منطق مجال يبقى في مكانه ويُعرَض عبر Adapter (Plugin) |
| **DELETE** | صفر قرّاء مؤكَّد (grep + git) — يُحذف في PR مستقل بخط أساس اختباري |

**العقود** (Sprint 1 من الخط الأساس، الستة الأولى مصمَّمة في `CONTRACTS.md`):
Mission، Task، Agent، Tool، Capability، Provider، Event، Transaction، Evidence،
Policy/Permission، Identity، Plugin.

**الإجماليات**: backend 241 وحدة JS (بلا tests/node_modules) — 30 منها **DELETE**
(كلّها من يوم سقالة واحد 2026-08-05، commit واحد، صفر قرّاء)؛ travel-service 49
وحدة src + `server.js` + 7 واجهة + اختبار واحد (8269 سطراً).

---

## A) `backend/server.js` — 3818 سطراً، 158 مساراً، 99 استيراداً محلياً

لا يُفكَّك دفعة واحدة (البند 19). الخريطة **حسب المجال** لأن الملف واحد؛ كل صف = مرشّح
ملف `routes/<domain>.js` مستقبلاً على نمط `routes/billing.js` القائم فعلاً («أول
قطعة تخرج من server.js»).

| المجال (عدد المسارات) | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|
| البنية: express/socket.io/CORS/static/`listen` | إقلاع الخادم | KEEP | — | `server.js` (يبقى نقطة الإقلاع) |
| `setStateEmitter` → `project_state` (سطر 270) | جسر آلة الحالة ↔ Socket | MODIFY | Event (EventBus) | `core/events/EventBus.js` (Sprint 4) |
| `orchestrator.init()` ثم `listen` (سطر 3691) + `onMongoReady → restorePluginsToDisk → reload` | تحميل الإضافات قبل الاستماع | KEEP | Plugin | `server.js` |
| مؤقّت `runTradingBotTickGuarded` كل 5 دقائق (سطر ~3680) | دورة بوت التداول | MOVE | Plugin (finance) | `plugins/finance/` (Sprint 6+) |
| `POST /api/chat` (1) + `verifyToken/aiLimit/validate/validateProjectOwnership` + بناء `agents` | مدخل المهمة الوحيد + حزمة الوكلاء | MODIFY | Mission (MissionRequest) + Agent (Registry بدل الحزمة) + Permission (`req.caps`) | `routes/chat.js` ثم `core/runtime/MissionRuntime.js` (Sprint 2) |
| `api/admin/*` (40) | لوحة الأدمِن: مستخدمون/إضافات/ملفات/دروس/تدقيق | KEEP | Permission (adminOnly كما هو) | `routes/admin.js` (Sprint 7) |
| `api/public/*` (34) | واجهات مواقع العملاء المنشورة (CMS/inbox/newsletter/bot) | KEEP | — | `routes/public.js` (Sprint 7) |
| `api/social/*` (13) + `api/marketing` (2) | قنوات النشر والجدولة | MOVE | Plugin (marketing) | `plugins/marketing/` (Sprint 6+) |
| `api/project/*` (12) + `api/projects` (2) + `api/project-context` (1) + `api/file-content` (2) + `workspace/*` (2) | ملفات المشروع ومساحة العمل | MODIFY | Tool (workspace) + Permission (ownership) | `routes/project.js` + `core/runtime/ToolRuntime.js` |
| `api/site/*` (10) + `api/domains` (3) + `api/deploy` (2) + `api/pwa` (1) + `api/polish` (1) | النشر والنطاقات والتلميع | MODIFY | Tool (deploy = requiresConfirmation) + Policy | `routes/site.js` |
| `api/jaola-bot` (5) + `api/bot-tenants` (4) + `api/agent-chat` (1) | منتج جولا بوت | MOVE | Plugin (bot) | `plugins/bot/` |
| `api/auth` (5) + `api/github` (3) | هوية + ربط GitHub | MODIFY | Identity | `core/identity/` (Sprint 2) |
| `api/agents` (5) | إضافات/وكلاء المستخدم (agentMarket) | MODIFY | Plugin + Agent (Registry) | `core/plugins/PluginRegistry.js` |
| `api/templates`, `api/template`, `api/library` (3) | مكتبة القوالب | KEEP | — | `plugins/coding/` (Sprint 6) |
| `api/platform`, `api/health`, `api/ai`, `api/inbox`, `api/newsletter` (5) | خدمات متفرّقة | KEEP | — | `routes/misc.js` |
| `routes/billing.js` (مستخرَج فعلاً، 139 سطراً) | Stripe للاشتراكات | KEEP | Transaction (لاحقاً، Payment Contract) | `routes/billing.js` |

---

## B) `backend/core/*` + الإضافات

| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `core/PluginLoader.js` | 100 | اكتشاف `.js`/`index.js`، تحقّق manifest (`name` مطلوب، `type`، `enabled`، ✅ `capabilities` بالشكل `domain.action`)، عزل فشل الإضافة | KEEP/MODIFY (Sprint 1 ✅ capabilities) | Plugin + Capability (يتوسّع لاحقاً بـtools/permissions) | `core/PluginLoader.js` |
| `core/PluginOrchestrator.js` | 150 | سجلّ الإضافات + مشغّل hooks + مسجّل وكلاء + `reload/status/setEnabled` + ✅ فهرس القدرات `capabilities()/findByCapability()` | KEEP/MODIFY (Sprint 1 ✅) | Plugin + Capability + Agent (Registry) — يتطوّر لا يُستبدل | `core/PluginOrchestrator.js` |
| `plugins/site-checker.js` | 95 | وكيل فحص موقع حيّ (type: agent, `registerAgent → {name, handler}`) | KEEP | Agent (أول وكيل إضافة حقيقي) | `plugins/site-checker.js` |
| `plugin-templates/AgentPluginTemplate.js` | 48 | قالب إضافة وكيل | KEEP | Plugin | كما هو |
| `services/pluginStore.js` | 132 | تخزين الإضافات في Mongo واستعادتها للقرص | KEEP | Plugin | `core/plugins/` (Sprint 7) |
| ✅ `core/runtime/TaskGraph.js` (جديد، Sprint 2a) | 50 | `orderTasks(items, {key})` — ترتيب طوبولوجي مستقرّ من `dependsOn` + كشف الدورات (خوارزمية `planExecution` حرفياً معمَّمة) | ADDED | Task | مستهلكاه: `runDynamicMultiAgentRuntime` (DELIVERY_STAGES) و`planExecution` (الفرق) |
| ✅ `core/runtime/ExecutionContext.js` (جديد، Sprint 2b) | 67 | `createExecutionContext`/`contextFromRequest`/`withAgents` — بيئة المهمة في كائن مجمَّد (الحقول الستة المتكرّرة) | ADDED | Mission | 11 توقيعاً في `jcr.js` + المعالجات السبعة |
| ✅ `core/runtime/RoomReporter.js` (جديد، JCR/2) | 56 | `send(room, event, payload)`/`liveLog`/`setLang` — بابُ البثّ الواحد إلى غرفة المستخدم؛ فصل ٦٥٪ من ترابط `jcr.js` عن `this`؛ المُترجمُ يُحقَن لا يُستورد (حدُّ core→agents) | ADDED | Event | مستهلكُه: `jcr.js` (١١٣ بثّاً مباشراً + `emitLiveLog` + لغةُ الغرفة)؛ `this.io` يبقى قيمةً لتسعِ تمريراتٍ خارجيّة |
| ✅ `core/runtime/AgentRuntime.js` (جديد، Sprint 2d) | 89 | `runAgent` + `gatherCooperationInputs` — منفّذ الوكيل الواحد: عقدٌ → نداء نموذج → ملفات مُطهَّرة | MOVED (Sprint 2d ✅، حرفياً عدا إسقاط افتراض `TEAM_BY_ID` الميت) | **Agent** | `runBackendTeam` (فريقا الخلفية **والواجهة** معاً) |
| ✅ `core/policy/ConfirmationManager.js` (جديد، Sprint 3) | 82 | بوّابةُ تأكيدٍ واحدة تُميّز الموافقة من السؤال | ADDED | Permission | مستهلكها: مسارُ التأكيد في `jcr.js` |
| ✅ `core/runtime/workspacePaths.js` (جديد، Sprint 2c؛ الكاتبان JCR/7) | 187 | `isInsideRoot`/`resolveInside` + `safeRelPath` + `resolveProjectFile` — نواة احتواء المسار، ومعها الكاتبان المحتويان `writeProjectFile`/`writePlanFiles` (خرجا من jcr كي تستوردهما المراحل بلا دورة) | ADDED | Tool | `jcr` (٢٤ موضعَ نداء)، `writeBackendTeamFiles`، `sanitizePath` |
| ✅ `core/runtime/workspaceRoots.js` (جديد، Sprint 4h) | 43 | `WORKSPACE_ROOT`/`MEMORY_ROOT`/`PLUGINS_ROOT` — **تصريحٌ واحد** لجذور الكتابة الثلاثة (كانت تُشتقّ في ١٢ موضعاً). اشتقاقٌ نقيّ: لا يلمس القرص | ADDED | Tool (شرطُ أيّ بوّابةِ كتابةٍ لاحقة) | مستهلكوه: `server.js` + ٩ وحدات |
| ✅ `core/providers/llm.js` (Sprint 4g، مَنقول من `agents/baseAgent.js`) | 151 (25 مستورداً) | بوّابةُ الـLLM الوحيدة: `smartChat`/`ai`/`groq`/`deepseek` + سلسلة failover Groq → DeepSeek → Gemini → OpenAI + تصنيف الأعطال | MOVED (نقلٌ حرفيّ: لا سطرَ منطقٍ تغيّر) | Provider | `core/providers/llm.js` — لا Registry قبل Model Router (لا تجريد بلا مستهلك) |

### ✅ التحقّق من مسار `orchestrator.init` (البند 21 من الخط الأساس)
مؤكَّد بالكود لا بالفهرس:
- **الإقلاع**: `server.js:3691` — `orchestrator.init().catch(…).finally(() => httpServer.listen(4000))`.
  الإضافات تُحمَّل **قبل** فتح المنفذ، وفشل التحميل لا يمنع الإقلاع (تحذير فقط).
- **إعادة التحميل**: `server.js:3700` عند جاهزية Mongo بعد `restorePluginsToDisk`، و`server.js:2560–2592`
  من مسارات الأدمِن (إنشاء/حذف/تعديل إضافة).
- **الاستهلاك داخل النواة**: `agents/jcr.js:1534` — `runHook('beforeBuild', {goal, username, project, projectPath, blueprint})`
  ونتائجه النصية تُحقن في prompt المولّد كـ«توجيهات وكلاء إضافيين»؛ `jcr.js:1613` — `runHook('afterBuild', {success, goal, …, files})`
  بلا انتظار. **`getAgent`**: `server.js:2598` (`/api/agents/:name/run`).
- **الاختبار**: `tests/siteChecker.test.mjs:106` يستدعي `orchestrator.init()` فعلياً.
- الخلاصة: هذا هو مسار التشغيل الرسمي للإضافات؛ الحدّ الحالي أن hooks البناء
  نصّية (guidance) لا أدوات — وهنا يدخل Tool Runtime.

---

## C) `backend/agents/*` — 136 وحدة (منها 42 قالب كلون)

### C1. النواة (Kernel candidates)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `jcr.js` | 1163 | وقت التشغيل المعرفي: `handleUserMessage` → 7 معالجات نية (كلُّها مفوِّضاتٌ إلى `stages/*` بعد JCR/28) → `executeMission` → `_runMissionNow` → 15 مرحلة | MODIFY (تدريجي، بلا إعادة كتابة) | Mission + Agent + Task (المراحل → TaskGraph) + Event | يبقى؛ يتقلّص مع كل Sprint لصالح `core/runtime/*` |
| ✅ `stages/debate.js` (جديد، JCR/4) | 142 | `runDebate(context, roomName, agents, reporter)` + `runSecurityAudit` — حلقةُ النقاش خرجت من `jcr` نقلاً حرفيّاً؛ المُبلِّغُ وسيطٌ لا `this` | ADDED | Agent + Evidence | أوّلُ مرحلةٍ خارج الصنف؛ `jcr._stageDebate` مفوِّضٌ من سطر |
| ✅ `stages/understand.js` (جديد، JCR/5) | 72 | `understandGoal(goal, ctx, reporter)` — الفهم: ذاكرة/ملفّ ← مخطّط ← نموذج المجال؛ نقلٌ حرفيّ، المُبلِّغُ وسيط | ADDED | Mission | `jcr._understandGoal` مفوِّضٌ من سطر؛ ٧ استيراداتٍ رحلت معها |
| ✅ `stages/enrich.js` (جديد، JCR/6) | 68 | `enrichBuildContext(goal, blueprint, ctx, reporter)` + `resolveProjectType` — متطلّباتٌ ضمنيّة + صور + توجيهاتُ الإضافات؛ نقلٌ حرفيّ، المُبلِّغُ وسيط | ADDED | Mission | `jcr._enrichBuildContext` مفوِّضٌ من سطر؛ `resolveProjectType` يعيد `jcr` تصديرَها لمستورِديها |
| ✅ `stages/requirementsVerify.js` (جديد، JCR/8) | 87 | `runRequirementsVerify(context, roomName, agents, reporter, { verify })` — التحقّقُ من المتطلبات وإكمالُ الناقص بجولاتٍ محدودة؛ نقلٌ حرفيّ إلّا حقنَ `verify` اختياريّاً | ADDED | Evidence + Mission | تُنادى بالاسم من `DELIVERY_STAGES` عبر مفوِّض `jcr._stageRequirementsVerify` |
| ✅ `stages/renderConfig.js` (جديد، JCR/9) | 44 | `runRenderConfig(context, roomName, reporter)` — اسمُ الخدمة من المصدر الواحد، قرارُ الخلفيّة يُحفظ في الذاكرة، `render.yaml` بالشكل المطابق؛ نقلٌ حرفيّ | ADDED | Tool | بالاسم من `DELIVERY_STAGES` عبر مفوِّض `jcr._stageRenderConfig`؛ حارسُ `renderConfigShape` يفحصها |
| ✅ `stages/undo.js` (جديد، JCR/9) | 64 | `handleUndo(req, reporter)` — «تراجع»: استرجاعٌ حتميّ لآخر نسخة، ما لم يُسترجَع يُقال؛ أوّلُ معالجِ نيّة يخرج؛ نقلٌ حرفيّ | ADDED | Tool + Event | مفوِّض `jcr._handleUndo` من `handleUserMessage` |
| ✅ `stages/buildFromRegistry.js` (جديد، JCR/10) | 78 | `buildFromRegistry(goal, ctx, reporter)` — صفحةٌ كاملة من بلوكات Registry + بصمة + تلميع + نشرٌ ثابت؛ أوّلُ بانٍ يخرج؛ `reporter.io` يُمرَّر للدفع التلقائيّ (تسريبٌ معلَن) | ADDED | Mission + Tool | مفوِّض `jcr._buildFromRegistry` من `_selectBuildStrategy` |
| ✅ `stages/reportMissionSuccess.js` (جديد، JCR/11) | 84 | `reportMissionSuccess(goal, ctx, reporter)` — تقريرُ التسليم بلغة المستخدم + الاقتراحات + قائمةُ الملفّات + الدفعُ التلقائيّ (`reporter.io`، موضعٌ واحد معلَن) + اللقطة + المقاييس + hook afterBuild؛ متزامنةٌ كما كانت | ADDED | Mission + Event | مفوِّض `jcr._reportMissionSuccess` من `_runMissionNow` |
| ✅ `stages/buildFromClone.js` (جديد، JCR/12) | 205 | `buildFromClone(clone, goal, ctx, reporter)` — البناءُ من كلونٍ عامل: ملفّاتُ القالب بلغة المستخدم + بصمةٌ موضعيّة (عيّنة/صور/علامة) بتراجعٍ عند الكسر + هويّةٌ ونشرٌ ثابت + نهائيّاتُ النجاح؛ `reporter.io` موضعٌ واحد معلَن | ADDED | Mission + Tool | مفوِّض `jcr._buildFromClone` من `_selectBuildStrategy` |
| ✅ `stages/quality.js` (جديد، JCR/13) | 148 | مراحلُ الجودة الستّ `runReviewStage/runRefactorStage/runTestingStage/runSeoStage/runSecurityStage/runGitBackupStage(context, roomName, reporter)` — مراجعةٌ بإصلاحٍ تلقائيّ ودرجة، تنظيف، اختبار، SEO وأمان بملفّاتٍ جديدة ودرجات، ونسخٌ احتياطيّ + commit | ADDED | Task (مراحل التسليم) + Evidence | ستُّ مفوِّضاتٍ في `jcr` تُستدعى بالاسم من `DELIVERY_STAGES` |
| ✅ `stages/designer.js` (جديد، JCR/14) | 36 | `runDesigner(context, roomName, reporter)` — Design Brief: لوحةٌ حتميّة + تخصيصُ AI إن جرى (والسطرُ يقول إن لم يجرِ ولماذا)، يُحفظ `design-brief.json` ويُثبَّت في `context.mentalModel` | ADDED | Mission + Evidence | مفوِّض `jcr._stageDesigner` من `runDynamicMultiAgentRuntime` |
| ✅ `stages/scaffold.js` (جديد، JCR/14) | 65 | `runAdvancedModules/runFullStackScaffold(context, roomName, reporter)` + `runProjectMemory(context)` — وحداتٌ متقدّمة (Stripe/Upload/OAuth/Travelpayouts بتنبيه env)، سكافولد Next.js+Prisma في `fullstack/`، وذاكرةُ المشروع (بلا بثّ فلا مُبلِّغ) | ADDED | Task (مراحل التسليم) | ثلاثُ مفوِّضاتٍ في `jcr` تُستدعى بالاسم من `DELIVERY_STAGES` |
| ✅ `stages/backend.js` (جديد، JCR/16) | 188 | `runBackendStage(context, roomName, agents, reporter)` — فريقُ الخلفية (best-effort عبر LLM) ← المولّدُ التقليديّ `agents.generateBackend` + تكاملُ script.js عبر الحارس ← قاعدةُ البيانات ← Postgres/Prisma ← المصادقة؛ أكبرُ مرحلةِ تسليم (٢٨ سطرَ بثّ) | ADDED | Task (مراحل التسليم) + Agent | مفوِّض `jcr._stageBackend` يُستدعى بالاسم من `DELIVERY_STAGES` |
| ✅ `stages/verify.js` (جديد، JCR/17–18) | 81 | `verifyAndAutofix({projectPath, blueprint, username, activeProject, roomName, agents, lang, canFix}, reporter)` — التحقّقُ السلوكيّ (jsdom) + جولةُ إصلاحٍ واحدة عبر `agents.coreEditCodePlan` والحارس + تسجيلُ ما بقي درساً؛ و`runBehaviorVerifyStage(context, roomName, agents, reporter)` — مرحلةُ التسليم `behavior-verify`: الميزانيةُ تحسم `canFix`، والنجاحُ يُغني مكتبةَ النماذج | ADDED | Evidence + Tool | مفوِّضان في `jcr`: `_verifyAndAutofix` (ثلاثة مستدعين + استبدالُ `jcrSurgicalEdit`) و`_stageBehaviorVerify` (بالاسم من `DELIVERY_STAGES`) |
| ✅ `stages/buildReact.js` (جديد، JCR/19) | 136 | `buildReactProject(goal, ctx, {sections}, reporter)` — سكافولد Next+Tailwind بمحتوىً مكتوبٍ بالذكاء (best-effort) وتخصيصِ كلِّ صفحةٍ بقيت افتراضيّة، معاينةٌ ثابتة لكلِّ مسار + `dashboard.html`، نهائيّاتُ النجاح، ثمّ تحقّقٌ سلوكيّ بلا إصلاح؛ `reporter.io` موضعٌ واحد معلَن | ADDED | Mission + Tool | مفوِّض `jcr._buildReactProject` من `_selectBuildStrategy` |
| ✅ `stages/selectBuildStrategy.js` (جديد، JCR/29) | 134 | `selectBuildStrategy(goal, blueprint, ctx, reporter, {buildFromRegistry, buildFromClone, buildReactProject, trackOf}) → result \| null` — اختيارُ الاستراتيجيّة قبل النواة: Registry (تسويقيّ) / Clone (تطبيقٌ عامل مطابق) / React-Next (كبيرٌ جديد) بحماياتها الثلاث (الاستئنافُ لا يُعاد بناؤه ولا يُطابَق كلوناً؛ تطبيقٌ يعمل لا يُستبدل دون «أعد البناء»)، وإلّا `null`. البناةُ الثلاثة عبر `ops` (تستبدلها الاختبارات)؛ تلميحُ المسار `trackByRoom` عبر `ops.trackOf` دالّةً مربوطة؛ `readCodeContext` يُستورد؛ لا `io` | ADDED | Mission + Task | مفوِّض `jcr._selectBuildStrategy` من `_runMissionNow` |
| ✅ `stages/reactPages.js` (جديد، JCR/20) | 131 | عمليّاتُ صفحات React القائم: `extractPageName/cleanPageName/readReactContent/findPage` (نقيّة) + `persistReactContent/renamePageNow/deletePageNow/pageNotFound(…, reporter)` (تبثّ؛ `reporter.io` موضعٌ واحد) | ADDED | Tool + Event | ثماني مفوِّضاتٍ في `jcr` تبقى للاختبارات التي تستبدلها؛ `stages/surgicalEdit.js` يستورد `cleanPageName` ويصل الثلاثَ الباقية عبر `ops`، و`stages/addPage.js` يستورد `extractPageName` |
| ✅ `stages/surgicalEdit.js` (جديد، JCR/22) | 241 | `runSurgicalEdit(instruction, ctx, reporter, ops)` — التعديلُ الجراحيّ على مشروعٍ قائم: نسخةٌ احتياطيّة، توجيهُ عمليّات صفحات React، قرارُ «تعديلٌ كبير → بناءٌ كامل»، تعديلٌ موضعيّ ثمّ كامل بعقد الحفظ، الحارسان، المعاينة، حارسُ الارتداد بمرحلتيه، التحقّقُ السلوكيّ، التقرير؛ `ops = {runMission, renamePage, deletePage, addPage, verify}` شقٌّ محقَن من المفوِّض حتّى تبقى استبدالاتُ الاختبارات على النسخة نافذة؛ `reporter.io` موضعٌ واحد | ADDED | Mission + Tool + Event | مفوِّض `jcr._runSurgicalEditNow` (مستدعيه `surgicalEdit` عبر الصفّ) |
| ✅ `stages/addPage.js` (جديد، JCR/23) | 115 | `addPageNow(instruction, projectPath, username, activeProject, roomName, lang, reporter, ops)` — إضافةُ صفحةٍ لمشروع React قائم بلا إعادة بناء: قراءةُ `lib/content.js` (تعذّرُها → `ops.runMission` بسياقٍ من الوسائط)، اسمُ مكوّنٍ ومسارٌ فريدان، قسمٌ قالبيٌّ يخصّصه الذكاء best-effort، كتابةُ المحتوى والمكوّن وصفحة Next، إعادةُ توليد الموقع الثابت، الذاكرةُ والقياساتُ والمعاينةُ والتقرير؛ `ops = {runMission}`؛ `reporter.io` موضعٌ واحد | ADDED | Tool + Event | مفوِّض `jcr._addPageNow` (يصله `runSurgicalEdit` عبر `ops.addPage`، وتستبدله الاختبارات) |
| ✅ `stages/ceoIntent.js` (جديد، JCR/24) | 141 | `handleCeoIntent(req, agents, reporter, ops) → boolean` — نوايا CEO الحتميّة قبل أيِّ نموذج: `classifyIntentFast` → `decide` → حالة/تحيّة (ردٌّ فوريّ)، اكمل (استئنافٌ من الذاكرة عبر `ops.executeMission` بسياق الطلب)، انشر (Render للـfull-stack أو وكيلُ النشر بأسرار المشروع)، ادفع إلى GitHub؛ النيّةُ والقرارُ في البثّ؛ `reporter.io` موضعان معلَنان (`deployToRender` ووكيلُ النشر يبثّان بنفسيهما) | ADDED | Permission + Mission + Event | مفوِّض `jcr._handleCeoIntent` من `handleUserMessage` (أوّلُ المعالجات بعد التأكيدات) |
| ✅ `stages/intentHandlers.js` (جديد، JCR/25–28) | 416 | `handlePlanningStage(req, agents, reporter, {executeMission}) → boolean` — مرحلةُ الخطّة في حوار التوضيح: تأكيدٌ → تهيئةُ ذاكرة المشروع من المُوضِّح وتسجيلُه ثمّ التنفيذ؛ سؤالٌ → ملخّصُ الخطّة؛ إيقاف/لون/تعديل → في إجابات المُوضِّح. `handleModifyPattern(req, agents, reporter, {surgicalEdit}) → boolean` — كشفُ التعديل بالنمط (احتياطُ الموجّه). `handleBareConfirmations(req, agents, reporter, gate, {executeMission, surgicalEdit}) → boolean` (JCR/26) — «نعم» مجرّدةً تنفّذ المحجوبَ (يُقرأ ويُمسح عبر `gate`) أو تستأنف من الذاكرة حين يسمح القرار؛ «نفّذ» مجرّدةً تنفّذ آخرَ ما وصفه المساعد. `handleUnifiedRoute(req, agents, reporter, gate, {surgicalEdit, generateChatResponse}, router = routeMessage) → boolean` (JCR/27) — الموجّهُ الموحَّد (`routeMessage`) بشبكة أمان الحجب/الإصرار: أمرٌ أو إصرارٌ → تعديل، جملةٌ إخباريّة → تُحجَب مرّةً (`gate.set` + `gate.confirmReply`)، سؤالٌ → محادثة، `edit`/`delete_project`/`stop`، و`build` أو فشلُ الموجّه → `false`. الموجّهُ `router` وسيطٌ أخير قابلٌ للحقن (سابقةُ `router.js#routeMessage(…, llm)`)؛ المفوِّضُ لا يمرّره. `handleClassifiedIntent(req, agents, reporter, gate, {classifyIntent, surgicalEdit, generateChatResponse}) → true` (JCR/28) — المصنِّفُ الأخير: `ops.classifyIntent` أو نيّةُ المعنى (ثقة ≥ 75) ثمّ build (غيرُ صريح على مشروعٍ قائم → تعديل/محادثة؛ صريح → حوارُ توضيحٍ أو تأكيدٌ يعلّق الهدف) / modify (سؤالٌ → محادثة، جملةٌ → حجبٌ مرّةً، إصرارٌ/فعلٌ → تعديل) / stop / وإلّا (فعلٌ أو إصرارٌ → تعديل، جملةٌ → حجب، سؤالٌ أو كلامٌ قصير أو بلا مشروع → محادثة). لا `io`؛ حالةُ الحجب تبقى على الصنف وتصل بـ`jcr._gate()` دوالَّ مربوطة — لم يبقَ قارئٌ لها في الصنف غيرَ الشقّ | ADDED | Permission + Mission | خمسةُ مفوِّضات في `jcr` من `handleUserMessage` |
| ✅ `projectReader.js` (جديد، JCR/15) | 55 | `readCodeContext(projectPath)` → نصُّ سياقٍ للـLLM (index/styles/script)؛ `readProjectFiles(projectPath)` → `{name, content}[]`: كلُّ CSS + الصفحةُ وما تُحمّله فعلاً + احتياطُ script.js — قارئان صامتان بلا `this` | ADDED | Tool | مفوِّضان على `jcr` (١٢ مستدعياً + استبدالُ الاختبارات) |
| `contracts.js` → ✅ `core/contracts/index.js` | 99/197 | typedefs الأحد عشر + `assertBuildAgents` + `DELIVERY_STAGES` + مدقّقا Capability | MOVED (Sprint 1 ✅) | Mission/Agent/Task/Capability/Provider/Transaction | `core/contracts/index.js` |
| `stateMachine.js` | 270 | Build State Machine (10 حالات + `STATE_EVENTS` + emitter) | KEEP | Event — تبقى متخصّصة، وMission Lifecycle فوقها | `core/missions/BuildStateMachine.js` (Sprint 2) |
| `ceoBrain.js` | 240 | تصنيف نية سريع، قرار، رسائل إحاطة/حالة | MODIFY | Mission (Intent/CEO في مسار v2) | `core/runtime/` |
| `router.js` | 94 | الموجّه الموحّد للرسائل | MODIFY | Mission | مع `ceoBrain` |
| `chatCommands.js`, `textNormalizer.js`, `languageDetector.js`, `logLocalizer.js`, `failureMessages.js` | 120/275/200/204/25 | أوامر حتمية، تطبيع نص، لغة، ترجمة السجل، رسائل الفشل | KEEP | — | `agents/` (أدوات النواة اللغوية) |
| ~~`baseAgent.js`~~ | 151 | عميل LLM المشترك — **نُقل حرفياً** إلى `core/providers/llm.js` (Sprint 4g) | MOVED | Provider | `core/providers/llm.js` (القسم B) |
| `knowledgeEngine.js` | 335 | كشف نوع المشروع + سياق معرفي + `needsBackend` | KEEP | — | `plugins/coding/` |
| `backendNeed.js` | 68 | **مصدرُ الحقيقة الواحد** لـ«أيحتاج خلفيةً؟» (Sprint 7/1) + العلاقية مجموعةً جزئيّة منه (2r) | KEEP | — | `plugins/coding/` |
| ✅ `keywordMatch.js` (جديد، 2s) | 60 | مطابقةُ كلماتٍ بحدودها لا باحتوائها — سابقةٌ عربية مقيَّدة ولاحقةٌ من مجموعةٍ مغلقة | ADDED | — | `plugins/coding/` |

### C2. وكلاء الحزمة (AgentBundle — `CONTRACTS.md` §2أ)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `coderAgent.js` | 388 | `coreGenerateCodePlan` / `coreEditCodePlan` (إلزامي) | MODIFY | Agent (spec تصريحي تحت Agent Runtime) | `plugins/coding/agents/` |
| `architectAgent.js` | 43 | `architectReview` حتمي (إلزامي) | MODIFY | Agent + Evidence (`checks[]`) | `plugins/coding/agents/` |
| `qaAgent.js` | 115 | `qaVerify` حتمي (إلزامي) | MODIFY | Agent + Evidence (`checks[]`) | `plugins/coding/agents/` |
| `core/evidence/Check.js` | 55 | عقدُ الدليل الذي يتكلّمه الناقدان (Sprint 4) | KEEP | Evidence | `core/evidence/` |
| `clarifierAgent.js` | 448 | حوار التوضيح (`startClarification/processAnswer/getFinalGoal/…`) | KEEP | Mission (Planning) | `plugins/coding/` |
| `template.agent.js` | 38 | `applyTemplate` | KEEP | — | `plugins/coding/` |
| `backendAgent.js` | 329 | `generateBackend`, `generateFrontendAPIIntegration`, `generateAdvancedModules` | KEEP | Agent | `plugins/coding/agents/` |
| `deployAgent.js` | 522 | نشر Vercel (يستقبل `io`) | MODIFY | Tool (`deploy`, requiresConfirmation, riskLevel: high) | `plugins/coding/tools/` |
| `agents/index.js` | 9 | barrel للحزمة | MODIFY | Agent (Registry يحلّ محلّه) | يُلغى عند Registry |

### C3. وكلاء المراحل (StageFn — تُستورد مباشرة في jcr.js)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `designerAgent.js` | 300 | ملخّص تصميم + احتياط حتمي + تخصيصُ AI ناطقٌ بسبب تخلّفه (2p) | KEEP | Task | `plugins/coding/stages/` |
| `reviewAgent.js`, `refactorAgent.js`, `testingAgent.js` | 240/239/244 | مراجعة/إعادة هيكلة/اختبارات مولَّدة | KEEP | Task | `plugins/coding/stages/` |
| `seoAgent.js`, `seoPack.js`, `securityAgent.js`, `polishPack.js`, `pwaAgent.js` | 178/118/158/63/234 | حزم حتمية عند التسليم | KEEP | Task | `plugins/coding/stages/` |
| `gitAgent.js` | 261 | commit/init/stats (ينفّذ git) | MODIFY | Tool (`git` عبر `execFile` بمصفوفة وسائط — لا صدفة) | `plugins/coding/tools/` |
| `databaseAgent.js`, `postgresAgent.js`, `authAgent.js`, `generatedAppSecrets.js`, `dependencyAgent.js` | 272/362/345/56/288 | كتلة الخلفية | KEEP | Task | `plugins/coding/stages/` |
| `renderAgent.js` | 262 | نشر Render | MODIFY | Tool (deploy) | `plugins/coding/tools/` |
| `requirementsVerifier.js` | 101 | هل نُفِّذت المتطلبات؟ | KEEP | Evidence | `core/verification/` (Sprint 4) |
| `behaviorVerifier.js` | 511 | تحقّق ساكن + تشغيل حيّ (وحدة الدليل `check`) | MOVE | Evidence + Verification | `core/verification/VerificationEngine.js` (Sprint 4) |
| `modelLibrary.js` | 69 | معرفة تراكمية | KEEP | Memory | `core/memory/` (لاحقاً) |
| `fileManager.js`, `patchEditor.js` | 319/187 | كتابة/ترقيع ملفات مباشرة | MODIFY | Tool (workspace.writeFiles) | `core/runtime/ToolRuntime.js` |
| `imageForge.js` | 140 | صور مضمونة | KEEP | Provider | `plugins/coding/` |

### C4. الفرق التصريحية (العقد الوحيد الموحّد اليوم — `CONTRACTS.md` §2ب)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `backendTeam/agentSpec.js` → ✅ `core/runtime/AgentSpec.js` | 133 | `defineAgent/validateSpec/compileSpecToPrompt` | MOVED (Sprint 2a ✅، حرفياً) | **Agent** (الشكل القانوني للوكيل في v2) | `core/runtime/AgentSpec.js` |
| `backendTeam/backendTeam.js` | 174 | منسّق عام `runBackendTeam/runAgent` + `safeRelPath/writeBackendTeamFiles`؛ ✅ `planExecution` صار غلافاً لـ`TaskGraph.orderTasks` | MOVE (المنسّق) / MODIFY (الكتابة → Tool) | Agent Runtime + Task + Tool | `core/runtime/AgentRuntime.js` (Sprint 2b) |
| `backendTeam/backendVerify.js` | 57 | فحص syntax تنفيذي | KEEP | Evidence | `core/verification/` |
| `backendTeam/specs.js`, `frontendTeam/specs.js` | 334/167 | 6+6 وكلاء تصريحيين | KEEP | Agent | `plugins/coding/agents/` |
| `backendTeam/index.js`, `frontendTeam/index.js` | 7/19 | barrels (`runFrontendTeam` غير موصول بالنواة) | KEEP | — | كما هي |

### C5. مكدّس التوليد والقوالب (منطق مجال Coding)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `templateLibrary.js`, `templateLibraryExtended.js`, `templateLocalizer.js` | 1061/1382/1943 | مكتبة القوالب وترجمتها | KEEP | — | `plugins/coding/templates/` (Sprint 6) |
| `cloneTemplates/*` (42 ملفاً، 17,406 سطر؛ `jaolaClinic.js` يُستورد من 27 قالباً كأساس مشترك) | — | قوالب تطبيقات عاملة | KEEP | — | `plugins/coding/templates/clones/` |
| `cloneAssets.js`, `seedStamp.js`, `fullstackTemplates.js`, `reactGenerator.js`, `blockRegistry.js`, `starterRegistry.js`, `starterFetch.js`, `libraryRegistry.js`, `referenceBlueprints.js`, `appBlueprint.js`, `requirementAnalyzer.js` | 74/116/603/432/259/74/171/78/195/146/198 | استراتيجيات البناء ومخططاته | KEEP | Task (استراتيجية = Task Graph مختلف) | `plugins/coding/` |
| `projectModel.js`, `projectMemory.js`, `userProfile.js` | 247/258/248 | ذاكرة المشروع والمستخدم | KEEP | Memory | `core/memory/` (لاحقاً) |
| `componentMarketplace.js`, `platformContext.js` | 278/42 | مكوّنات جاهزة (markupها يُحقن بميزانية، 2q) + معلومات المنصّة | KEEP | — | `plugins/coding/` |

### C6. منتجات تعيش في `agents/` وليست وكلاء نواة
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `jaolaBot.js`, `jaolaBotToken.js` | 295/45 | منتج جولا بوت (ودجت + توكن HMAC) | MOVE | Plugin (bot) | `plugins/bot/` |
| `marketingAgent.js` | 163 | المساعد التسويقي | MOVE | Plugin (marketing) | `plugins/marketing/` |
| `integrations/travelpayouts.js` | 166 | تكامل Travelpayouts لمواقع العملاء | MOVE | Provider | `plugins/travel/providers/` (أو يبقى مع coding — يُقرَّر عند Sprint 5) |
| `systemDoctorAgent.js` | 209 | فحص صحة النظام | KEEP | Evidence | `core/audit/` |

### C7. DELETE — سقالة ميتة (صفر قرّاء، commit واحد 2026-08-05)
| الملف | سطور | الدليل |
|---|---|---|
| `deployer.agent.js`, `qa.agent.js` | 6/6 | سطر prompt واحد، لا export مستهلَك |
| `git.agent.js`, `github.agent.js` | 34/67 | نسخ قديمة من `gitAgent.js` (الحيّ) |
| `serverBuilder.js` + `spec/AgentSpec.js` + `spec/servercraft.spec.js` | 234/140/57 | سلسلة ميتة كاملة: لا أحد يستورد `serverBuilder`؛ و`spec/AgentSpec.js` يحوي **نصّ سكربت shell** مضمّناً (`cat > spec/servercraft.spec.js << 'EOF'`) — ملف مولَّد بالخطأ. البديل الحيّ `backendTeam/agentSpec.js` |

---

## D) `backend/services/*` — 72 وحدة

### D1. وقت التشغيل (مرشّحة لـ`core/`)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `missionQueue.js` → ✅ `core/runtime/ExecutionQueue.js` | 155 | طابور المهام + سجلّ دائم للساقطة (نفس الصادرات) | MOVED (Sprint 2a ✅، حرفياً) | Mission (Execution Queue عامة) | `core/runtime/ExecutionQueue.js` |
| `abortRegistry.js` → ✅ `core/runtime/AbortRegistry.js` | 84 | إيقاف مهمة جارية | MOVED (Sprint 2a ✅، حرفياً) | Mission | `core/runtime/AbortRegistry.js` |
| `platformLessons.js` | 187 | دروس الفشل + ثغرات السلوك (التعلّم الحقيقي) | MOVE | Evidence + Memory | `core/verification/` أو `core/memory/` |
| `projectBrain.js` | 203 | دماغ المشروع (دالة نقية) | MOVE | Evidence | `core/verification/` (Sprint 4) |
| `codeGuard.js` | 389 | حارس جودة الكود المولَّد | KEEP | Verification | `plugins/coding/` |
| `indexHealth.js` (1 مستورد) | 81 | فحصُ قيود التفرّد قراءةً (autoIndex=false ولا createIndexes) | KEEP | — | `core/` |
| `persistence.js` (11 مستورداً) | 114 | طبقة الحفظ (Mongo + احتياط) | KEEP | — | `core/` (Sprint 7) |
| `workspaceStore.js` | 173 | نسخ ملفات المشاريع إلى Mongo | KEEP | Tool (workspace) | `core/runtime/` |
| `conversationStore.js`, `conversationManager.js` | 171/80 | ذاكرة الحوار | KEEP | Memory | `core/memory/` |
| `metricsStore.js`, `usageMeter.js`, `errorLog.js`, `logger.js`, `adminAudit.js` | 120/78/45/36/41 | قياس واستهلاك وتدقيق | MODIFY | Audit (AuditLog يوحّدها) | `core/audit/` (Sprint 4) |
| `presence.js` | 12 | حضور | MODIFY | Event (EventBus) | `core/events/` |
| `httpRetry.js` | 70 | البابُ المشترك للنداء الصادر: مهلةٌ دائماً + إعادةُ محاولةٍ حيث تصحّ | KEEP | Provider (سياسةُ المهلة وإعادة المحاولة) | `core/` |
| `aiProviderCheck.js` | 99 | فاحص مزوّدي الذكاء | MODIFY | Provider Registry | `core/plugins/ProviderRegistry.js` |

### D2. التسليم والنشر (مجال Coding)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `deployAutomation.js`, `customDomains.js`, `hostNames.js`, `githubSync.js`, `githubFiles.js`, `projectExport.js`, `projectManager.js` | 239/207/37/111/136/37/99 | نشر ونطاقات وGitHub وتصدير | MODIFY | Tool (كل واحدة أداة بـriskLevel) + Transaction (للنشر) | `plugins/coding/tools/` |
| `projectRecord.js` | 97 | بوّابةُ الكتابة على سجلّ المشروع (upsert + حارسُ اتّصالٍ + ناتجٌ صادق) | KEEP | Repository | `plugins/coding/tools/` |
| `reactPreview.js`, `twin.js` | 477/69 | معاينة وتعديل | KEEP | Tool | `plugins/coding/` |
| `siteConnect.js`, `siteCms.js`, `siteInbox.js`, `siteCreds.js`, `newsletterSubscribers.js`, `projectAuth.js`, `projectSecrets.js`, `storeKey.js`, `dataSync.js`, `appData.js`, `appCollections.js`, `appAssets.js` | 128/118/97/65/60/76/138/63/138/51/82/76 | خدمات مواقع العملاء المنشورة | KEEP | — | `plugins/coding/runtime-services/` |
| `imageService.js`, `aiImages.js` | 92/433 | صور | KEEP | Provider | `plugins/coding/` |
| `platformKnowledge.js` | 89 | معرفة للمساعد | KEEP | Memory | كما هي |

### D3. التجارة والهوية
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `stripeService.js`, `subscriptionService.js`, `config/plans.js`, `routes/billing.js` | 141/138/140/139 | اشتراكات المنصّة (Stripe) | MODIFY | Transaction (Payment Contract العام؛ التنفيذ يبقى Stripe) | `core/transactions/` (العقد) + `routes/billing.js` (التنفيذ) |
| `oauthLite.js`, `utils/auth.js`, `middleware/adminOnly.js` | 137/40/33 | OAuth + JWT + أدمِن | MODIFY | Identity + Permission | `core/identity/` (Sprint 2–3) |
| `mailer.js` | 46 | Resend | KEEP | Provider | `core/plugins/ProviderRegistry.js` |

### D4. الإدارة وسوق الوكلاء
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `adminService.js`, `adminUsers.js` | 234/66 | إدارة الإضافات والملفات والمستخدمين | KEEP | Permission | `routes/admin.js` |
| `agentMarket.js`, `agentConversations.js` | 90/75 | المستخدم يصنع وكلاءه + محادثاتهم | MODIFY | Plugin + Agent (Registry) | `core/plugins/PluginRegistry.js` |
| `botTenants.js` | 37 | مستأجرو جولا بوت | MOVE | Plugin (bot) | `plugins/bot/` |

### D5. أعمدة منتجات تعيش في `services/` (ليست نواة)
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `postScheduler.js`, `socialChannels.js`, `telegramPublisher.js` | 80/126/89 | نشر اجتماعي | MOVE | Plugin (marketing) + Tool (send = حسب السياسة والقناة) | `plugins/marketing/` |
| `budgetAlerts.js`, `budgetCommentary.js`, `budgetStats.js` | 59/56/71 | مستشار الميزانية | MOVE | Plugin (finance) | `plugins/finance/budget/` |
| `cryptoAlerts.js`, `cryptoCommentary.js`, `cryptoMarket.js`, `signalTrackRecord.js` | 62/63/326/108 | مستشار الكريبتو | MOVE | Plugin (finance) + Provider (CoinGecko) | `plugins/finance/crypto/` |
| `stockCommentary.js`, `stockMarket.js` | 62/186 | مستشار الأسهم | MOVE | Plugin (finance) + Provider (Yahoo) | `plugins/finance/stocks/` |
| `tradingBotEngine.js`, `tradingBotConfig.js`, `tradingBotCoins.js`, `tradingBotLedger.js`, `tradingBotStats.js`, `tradingBotCircuitBreaker.js`, `chainProvider.js`, `pancakeSwapExecutor.js` | 479/92/189/165/57/55/54/167 | بوت PancakeSwap: تنفيذ حقيقي على BNB Chain، سجلّ append-only، قاطع يومي | MOVE | Plugin (finance) + **Transaction** (`tradingBotLedger` نموذج جاهز لـIdempotency/Audit) + Tool (`swap` = requiresConfirmation/riskLevel: critical) + Provider (RPC) | `plugins/finance/trading/` (Sprint 6+) |

### D6. DELETE — سقالة ميتة (صفر قرّاء، commit واحد 2026-08-05)
`architectureExplorer.js` (22)، `contextBuilder.js` (22)، `fileBridge.js` (17)،
`fileService.js` (92)، `git.service.js` (67)، `intentEngine.js` (27)،
`monaco.service.js` (54 — كود متصفّح داخل الخادم)، `orchestrator.js` (50 — لا علاقة
بـ`core/PluginOrchestrator`)، `portManager.js` (29)، `scanner.js` (77)،
`systemPrompt.js` (22)، `taskWorker.js` (74) ← يستورد `taskQueue.js` (**0 سطر**،
ملف فارغ)، `vercelDeploy.js` (25 — البديل الحيّ `deployAgent.js`)،
`vision.service.js` (37 — Gemini بلا مستدعٍ)، `websocket.js` (20)،
`workspace.service.js` (17)، `lib/templateGenerator.js` (227)،
`utils/api.js` (35)، `utils/hooks.js` (55)، `utils/realtime.js` (56)،
`websocket/server.js` (37)، `websocket/socketManager.js` (12).
**23 ملفاً** + 7 في `agents/` = **30**.

---

## E) بقية `backend/`
| الملف | سطور | المسؤولية | القرار | العقد الجديد | الموقع النهائي |
|---|---|---|---|---|---|
| `middleware/security.js` | 96 | `sanitizePath` + Zod schemas + `validate` | MODIFY | Tool (workspace guard موحّد — `CONTRACTS.md` §3) + Permission | `core/policy/` |
| `utils/secretVault.js` (6 مستوردين) | 85 | تشفير الأسرار | KEEP | Identity | `core/identity/` |
| `utils/corsErrors.js`, `utils/spaFallback.js` | 15/19 | أدوات صغيرة **حيّة** (٢ و١ مستورداً) | KEEP | — | كما هي |
| `utils/security.js`, `utils/performance.js`, `utils/aiProvider.js` | 21/60/48 | 🔴 **يتيمة: صفرُ مستوردين** — لا «أدواتٌ حيّة» كما كان هذا الصفُّ يقول. مُقرَّةٌ في §اليتامى أدناه (أسطر ٣٣٥–٣٣٧) منذ 8/11، وهذا الصفُّ كان يناقضها. و`utils/security.js` يشارك اسمَ `middleware/security.js` **الحيّ** ويختلف عنه — وهو مصدرُ اللبس | KEEP (قرارُ إبقاءٍ واعٍ، لا وصفُ استعمال) | — | كما هي |
| `models/User.js`, `Project.js`, `Conversation.js`, `BotTenant.js` | 26/27/22/21 | مخطّطات Mongo (Core DB) | KEEP | Identity/Mission (Core DB — البند 14) | `models/` |
| `dbConfig.js` | 6 | إعداد mongoose (استيراد تأثير جانبي `server.js:2`) | KEEP | — | كما هو |
| `scripts/harvestTemplateScreenshots.mjs` | 102 | أداة تطوير | KEEP | — | كما هو |

---

## F) `travel-service/*` — أول Plugin تجاري (Sprint 5: Adapter لا إعادة كتابة)

**المبدأ** (البند 16): منطق المجال يبقى في `travel-service/` بعزله وSSO الحالي؛
`backend/plugins/travel/` يُضاف كـAdapter يعلن capabilities/tools/providers/
permissions ويستدعي الخدمة عبر HTTP بنفس JWT. لا شيء هنا **MOVE** الآن.

### F1. `travel-service/server.js` — 3942 سطراً، 90 مساراً تحت `/api/travel/*`
| المجال (عدد) | المسؤولية | القرار | العقد الجديد (عبر الـAdapter) |
|---|---|---|---|
| `admin` (17) | إدارة العقود/الباقات/المستخدمين | KEEP | Permission (`travel.admin`) |
| `fixed-packages` (8), `packages` (3) | منتج الباقات + ساغا طيران+فندق | KEEP | Capability `travel.packages` + Transaction |
| `bookings` (7) | إنشاء/إصدار/إلغاء | KEEP | Capability `travel.booking` + Transaction + State Machine (Booking) |
| `flights` (3), `stays` (5), `cars` (4), `esim` (3) | بحث وعروض | KEEP | Capability `travel.search` + Provider |
| `auth` (6) | حسابات/دخول/Google/استعادة | KEEP | Identity (SSO كما هو) |
| `agent` (3) | الايجنت الحاجز + تأكيد النية الموقّعة | KEEP | Agent + Tool (`create_booking_intent` requiresConfirmation) + Policy |
| `webhooks` (2) | Stripe | KEEP | Transaction (Payment) — التنفيذ يبقى Stripe |
| `profile` (5), `notifications` (5), `wishlist` (2), `loyalty` (1), `referral` (1), `reviews` (ضمن bookings) | ذاكرة المسافر وتنبيهاته | KEEP | Event (تنبيهات → EventBus لاحقاً) |
| `calendar` (3), `share` (1), `fx` (2), `airports` (2), `destinations` (1), `insights` (1), `discounts` (1), `quote-requests` (1), `config` (1), `health` (1), `cron` (1) | خدمات مساندة | KEEP | — |
| صفحات `/`, `/en`, `/nl`, `/ur`, `/legal`, `sitemap.xml`, `robots.txt` | واجهة عامة | KEEP | — |

### F2. `travel-service/src/*`
| الملف | سطور | المسؤولية | القرار | العقد الجديد |
|---|---|---|---|---|
| `providers/index.js` | 66 | نقطة التبديل الوحيدة للمزوّدين (Duffel/LiteAPI/mock) | ADAPT | **Provider Registry** — النموذج المرجعي الذي يعمّمه Core |
| `providers/duffelClient.js`, `duffelProvider.js`, `duffelStaysProvider.js`, `duffelCarsProvider.js`, `liteApiClient.js`, `liteApiStaysProvider.js`, `contractedStaysProvider.js` | 42/343/162/139/35/259/209 | مزوّدون حقيقيون (بلا SDK) | KEEP | Provider |
| `providers/mock*.js` + `mockUtils.js` | 213/127/99/106/14 | محاكاة حتمية للاختبار | KEEP | Provider |
| `bookings.js` | 63 | آلة حالات الحجز (`pending → issued → cancelled/failed`) | ADAPT | Transaction + State Machine (Booking) — النموذج المرجعي للبند 13 |
| `bookingIntent.js` | 97 | نية حجز موقّعة (HMAC) تُخرج الحجز من يد النموذج | ADAPT | **Tool** (`create_booking_intent`, `requiresConfirmation: true`) + Policy — النموذج المرجعي للبند 8 |
| `agent/agent.js`, `agent/insights.js` | 1017/463 | الايجنت الحاجز (أدوات فوق الخدمة، حدود جولات/حجم/إعادة) + قراءات النتائج | ADAPT | Agent (تحت Agent Runtime) — يبقى منطقه هنا |
| `payments/stripeClient.js` | 153 | Stripe يدوي: Checkout + webhook HMAC + reconciliation | KEEP | Transaction (Payment Contract عام؛ التنفيذ هنا) |
| `packages.js`, `fixedPackages.js` | 291/348 | ساغا الباقات + الباقات المجدولة | KEEP | Transaction (ساغا = Fulfillment) |
| `store/index.js`, `fileStore.js`, `postgresStore.js` | 23/804/1447 | المخزنان بعقد متطابق (NUMERIC للأموال، عمليات ذرية) | KEEP | Travel DB (البند 14 — لا دمج) |
| `auth.js`, `accounts.js`, `googleAuth.js` | 40/227/75 | SSO JWT (سرّان) + حسابات ذاتية + Google | KEEP | Identity (Core User ID هو الرابط) |
| `notifications.js`, `mailer.js`, `whatsapp.js`, `tripReminders.js`, `balanceReminders.js`, `priceWatchPoller.js`, `priceWatches.js` | 214/46/127/136/88/106/30 | نقطة تسليم التنبيهات + قنواتها + الدوريات | KEEP | Event (تُبَث لاحقاً عبر EventBus) |
| `pricing.js`, `discounts.js`, `fareConditions.js`, `passengerAges.js`, `itinerary.js`, `fx.js`, `airports.js`, `travelInfo.js`, `topDestinations.js`, `calendarFeed.js`, `shareLinks.js`, `loyalty.js`, `referrals.js`, `reviews.js`, `profile.js`, `contracts.js` | — | منطق مجال نقيّ | KEEP | — |
| `public/*` (index.html 5462، admin.html 646، i18n.js 575، …) | — | واجهة Jatrava | KEEP | — (البند 19: لا إعادة تصميم) |
| `tests/travelService.test.mjs` | 8269 | 333 اختباراً في ملف واحد | MODIFY | — تقسيم حسب المجال (auth/bookings/packages/agent/providers/…) — عمل مستقل بلا تغيير سلوك |

### F3. `backend/plugins/travel/` (يُضاف في Sprint 5)
`manifest.js` (name, version, type: 'service') · `capabilities.js` (`travel.search`,
`travel.booking`, `travel.payment`, `travel.packages`) · `tools.js`
(`search_flights`, `search_hotels`, `create_booking_intent` …) · `providers.js`
(Duffel, LiteAPI — أسماء لا أسرار) · `permissions.js` (`travel.read`, `travel.book`,
`travel.admin`) · `events.js` · `policies.js` · `index.js`. كلّه يستدعي
`travel-service` عبر HTTP + JWT المشترك.

---

## 📌 ما يترتّب على الخريطة (بالترتيب)
1. **PR مستقل: حذف الـ30 ملفاً الميتة** (خط أساس 807/807 قبل وبعد) — تنظيف بلا
   مخاطر يقلّل `services/` من 90 إلى 67 و`agents/` من 123 إلى 116.
2. **Sprint 1 (Contracts)** يبدأ من `CONTRACTS.md` ويضيف Task/Capability/Provider/
   Transaction بنماذجها المرجعية الموجودة فعلاً: `bookings.js` (Transaction)،
   `bookingIntent.js` (Tool مع تأكيد)، `providers/index.js` (Provider Registry)،
   `backendTeam/agentSpec.js` (Agent)، `tradingBotLedger.js` (Audit/Idempotency).
3. **Sprint 2 (Runtime)** يبدأ بنقل `missionQueue`/`abortRegistry`/`agentSpec`/
   `runAgent` إلى `core/runtime/` بلا تغيير سلوك، ثم `ExecutionContext` يحلّ محلّ
   المعاملات السبعة المكرّرة في 5 توقيعات.
4. الأعمدة المنتجية (finance/marketing/bot) تُنقل إلى `plugins/` **بعد** نجاح
   Travel Adapter (Sprint 5) لا قبله — حتى لا نبني Plugin Contract على مجال داخلي.

---

## 🧭 اليتامى — ما لا يصل إليه `server.js`

هذا القسم **محسوبٌ لا موصوف**: `tests/moduleReachability.test.mjs` يمشي بيان
الاستيراد من `server.js` (ثابتاً وديناميكياً) ويقارن الناتج بالقائمة أدناه.
تيتُّمُ وحدةٍ جديدة يُسقط الاختبار، ووصلُ يتيمةٍ يُسقطه أيضاً.

🔴 **ولمَ لزم هذا القسم**: الجدول أعلاه صنّف الوحدات ورقةً ورقة ولم يمشِ
البيان. فأعطى `fileEditor.js` و`twin.js` و`knowledgeService.js` حكم **KEEP**
و`broadcast.js` حكم **MODIFY** — وهي كلّها وراء `services/taskExecutor.js`،
وهو **غائبٌ عن هذا الملف كلّه** ولا يستورده شيء. أحكامٌ على وحداتٍ لا يصل
إليها الخادم، والملفّ الذي كان سيصل إليها لم يُذكر أصلاً.

✅ **وقد حُذفت جزيرةُ `taskExecutor` (Sprint 2o)** — أربعةُ ملفات، 441 سطراً.
الجدول أدناه يبقى **سِجلّاً** لما كان، لأن الفهم هو ما أجاز الحذف.

| الملف | سطور | لا يصل إليه إلا | يُحمَّل؟ | الحال |
|---|---|---|---|---|
| ~~`services/taskExecutor.js`~~ | 225 | **لا شيء** (جذر الجزيرة) | ❌ `simple-git` غير مثبَّت | **DELETED** (2o) |
| ~~`services/fileEditor.js`~~ | 73 | `taskExecutor` | ✅ | **DELETED** (2o) |
| ~~`services/broadcast.js`~~ | 42 | `taskExecutor` (استيراد ديناميكي) | ✅ | **DELETED** (2o) |
| ~~`services/knowledgeService.js`~~ | 101 | `taskExecutor` (استيراد ديناميكي) | ❌ عبر `projectManager` | **DELETED** (2o) |
| `services/projectManager.js` | 99 | `knowledgeService` و`twin` (كلاهما يتيم) | ❌ `uuid` غير مثبَّت | باقٍ |
| `services/twin.js` | 69 | `knowledgeService` (يتيم) | ❌ عبر `projectManager` | باقٍ |
| `services/logger.js` | 36 | `twin` (يتيم) | ✅ | باقٍ |
| `services/db.js` | 58 | لا شيء | ❌ `better-sqlite3` غير مثبَّت | باقٍ |
| `utils/aiProvider.js` | 48 | لا شيء | ✅ | باقٍ |
| `utils/performance.js` | 60 | لا شيء | ✅ | باقٍ |
| `utils/security.js` | 21 | لا شيء | ✅ | باقٍ |

**وقائع أُثبتت بالتشغيل، لا استنتاجات:**

1. `taskExecutor.js` يستورد `simple-git` وهي **ليست في `package.json`** — فلا
   يُستورَد الملفّ أصلاً (`ERR_MODULE_NOT_FOUND`). لم يظهر ذلك يوماً لأن لا
   أحد يستورده.
2. ويستورد ديناميكياً `agents/architect.agent.js` و
   `agents/projectInitializer.agent.js` — **وكلاهما غير موجود**. الحيّ اسمه
   `agents/architectAgent.js` ويُصدَّر عبر `agents/index.js`؛ أُعيدت التسمية
   ولم يتبعها هذا الملف.
3. خمسٌ من الإحدى عشرة لا تُحمَّل (اعتماداتٌ غير مثبَّتة). فحكم **KEEP** على
   `twin.js` و`knowledgeService.js` حكمٌ على وحدتين ترميان عند الاستيراد.
4. `utils/security.js` يشارك اسمَ `middleware/security.js` الحيّ ويختلف عنه
   محتوىً (`escapeHtml` مقابل `sanitizePath`/`schemas`/`validate`). فمن قرأ
   الاسم قرأ الميتَ ظانّاً أنه الحيّ.

📌 **الحذف وقع، وشرطُه استُوفي.** «لا نحذف قبل فهم dependencies» — وهذا
القسم كان الفهم. فلمّا اكتمل، حُذفت الجزيرةُ بـPR مستقلّ كما جرى مع
الثلاثين ملفاً سابقاً، لا ضمن Sprint آخر.

**ولمَ الجزيرةُ وحدها دون بقيّة اليتامى؟** لأنها الوحدةُ المتماسكة: جذرٌ
واحد وثلاثةٌ لا يصل إليها سواه، فحذفُها كلٌّ أو لا شيء. أما `db.js` و
`logger.js` و`utils/*` فكلٌّ يتيمٌ قائمٌ بذاته، ولكلٍّ حكمُه على حِدة —
تُترك ليُنظر فيها منفردة، لا لتُجرَف مع غيرها.

**والحكم KEEP لم يكن حجّةً للإبقاء**، لأنه بعينه ما كشفه Sprint 8/11: حكمٌ
أُعطي بالقراءة لا بمشي البيان. حجّةُ الحذف أن الخادم لا يبلغها، وأن جذرها
لا يُحمَّل أصلاً (`simple-git` غير مثبَّتة)، وأن التاريخ يحفظها.
