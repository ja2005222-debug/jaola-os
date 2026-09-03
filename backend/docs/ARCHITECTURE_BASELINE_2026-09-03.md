# JAOLA OS — السجل المعماري الكامل للجلسة (الخط الأساس)

> نسخة داخل المستودع من وثيقة المالك المرجعية
> `JAOLA_OS_Architecture_Session_Reference_20260903.docx` (03 سبتمبر 2026)، محفوظة
> هنا حرفياً في المضمون ليرجع إليها كل عمل لاحق. **هذا المستند Baseline معماري**:
> أي قرار يخالفه يُسجَّل في `../ARCHITECTURE_MIGRATION.md` كقرار معماري (السبب،
> الأثر، البديل المرفوض، وكيفية التراجع) — البند 24 أدناه.

## 1. الهدف والنطاق
هذه الوثيقة تحفظ خلاصة الجلسة المعمارية والتحليل الفني لمشروع JAOLA OS، مع
التركيز على JAOLA Travel الموجود داخل JAOLA OS. المقصود بـTravel هنا ليس المستودع
الخارجي jaola-travel. المستودع المستهدف هو `ja2005222-debug/jaola-os`.

الهدف: إنشاء مرجع ثابت لاتخاذ قرارات التطوير اللاحقة دون إعادة النقاش من الصفر.

## 2. الخلاصة التنفيذية
القرار الأساسي: لا نعيد بناء JAOLA OS أو Travel من الصفر. المشروع يحتوي بالفعل
على مكونات قوية، لكن المشكلة الرئيسية أن هذه المكونات ليست موحدة بعد داخل Runtime
معماري عام.

الرؤية: JAOLA OS يتحول تدريجياً إلى Agentic Operating System، وTravel يصبح أول
Domain/Plugin تجاري حقيقي يستخدم الـCore الجديد، مع الحفاظ على منطق Travel الحالي.

## 3. تقييم الوضع الحالي
| المكوّن | التقييم |
|---|---|
| Travel Domain | قوي |
| Provider abstraction | قوي |
| Booking | جيد جداً |
| Payment | جيد |
| Travel Agent | متقدم |
| Testing | قوي، مع حاجة لتقسيم ملف الاختبارات الكبير |
| Mission Queue | جيد |
| State Machine | جيدة |
| Agent Contracts | تحسن واضح |
| Plugin Loader | بداية جيدة |
| Plugin Orchestrator | يحتاج توسيع دوره |
| Tool Runtime مركزي | غير مكتمل |
| Policy Engine مركزي | غير مكتمل |
| Mission/Task Graph | يحتاج تعميماً |
| Event Bus | يحتاج توحيداً |
| Transaction Layer | يحتاج تعميماً |
| Core ↔ Plugins | أهم نقطة تطوير |

التقدير العام السابق: JAOLA OS حوالي 8.5/10 كأساس معماري؛ المطلوب توحيد الأساس
وليس إعادة اختراعه.

## 4. JAOLA Core — ما تم اكتشافه
- **PluginOrchestrator** (`backend/core/PluginOrchestrator.js`) يحتفظ بالـplugins
  والـagents، يحمل الإضافات، يشغل onLoad وhooks مثل beforeBuild/afterBuild، يعزل
  أخطاء الإضافات، ويوفر reload/status/setEnabled. الاستنتاج: هو Plugin Loader +
  Hook Manager + Agent Registrar أكثر من كونه Agent Runtime شاملاً. لا نحذفه؛ نطوره.
- **PluginLoader** (`backend/core/PluginLoader.js`) يكتشف ملفات .js أو مجلدات
  index.js، يتحقق من manifest الأساسي، ويسجل فشل plugin دون إسقاط البقية.
- **Agent Contracts** (`backend/agents/contracts.js`) يعرّف MissionRequest
  وAgentBundle وStageFn وHandlerFn. الوكلاء الإلزاميون للبناء هم coreGenerateCodePlan
  وarchitectReview وqaVerify. assertBuildAgents يتحقق من وجودها قبل التشغيل.
  المشكلة المستقبلية أن AgentBundle المسطح لن يتوسع جيداً؛ نحتاج Agent Registry
  وAgent Runtime.
- **Mission Queue** (`backend/services/missionQueue.js`) تمنع التوازي للمشروع نفسه،
  تحد التوازي الكلي، وتستخدم mission_ledger.json لاستعادة المهام التي سقطت بعد
  إعادة التشغيل. نحافظ عليها ثم نعممها إلى Execution Queue.
- **State Machine** الحالية تدير مراحل البناء (IDLE, PLANNING, ARCHITECTURE,
  GENERATING, REVIEWING, VERIFYING, DEPLOYING, COMPLETED, FAILED, PAUSED). نحافظ
  عليها كـBuild State Machine ونضيف فوقها Mission Lifecycle عامة.

## 5. JAOLA Travel — ما تم اكتشافه
- travel-service مصمم كخدمة مستقلة عن JAOLA الرئيسية مع SSO عبر JWT مشترك. هذا
  العزل جيد ويجب الحفاظ عليه.
- **Provider Architecture**: Duffel للرحلات عند توفر DUFFEL_API_KEY، LiteAPI
  للفنادق أولاً ثم Duffel Stays ثم mock، Duffel Cars للسيارات، وmock لـeSIM حالياً.
  نموذج جيد جداً يجب تعميم فكرته داخل JAOLA.
- **Booking**: حالات واضحة pending → issued → failed وissued → cancelled،
  والانتقالات تمر عبر آلية مركزية/ذرية.
- **PostgreSQL Store**: Persistence واسعة، NUMERIC للأموال، عمليات ذرية لبعض عمليات
  الحجز/التخصيص، كيانات متعددة (bookings, price watches, notifications, profiles,
  packages, reviews, wishlist).
- **Authentication**: JWT SSO، verifyToken وoptionalToken وadminOnly، مع دعم السر
  الحالي والسابق.
- **Stripe**: Hosted Checkout، تحقق من webhooks، HMAC وتحقق زمني آمن، رفض الأحداث
  القديمة، دعم توقيعات متعددة، وإمكانية reconciliation عند فقدان webhook. لا ننقل
  Stripe إلى Core؛ نعرّف Payment Contract عام ويظل تنفيذ Stripe داخل Travel.
- **Travel Agent**: يستخدم الأدوات فوق منطق الخدمة. أهم قرار أمني: أدوات الحجز لا
  تنفذ الحجز مباشرة؛ تنشئ signed booking intent يحتاج تأكيداً من مسار موثوق. توجد
  حدود لعدد جولات الأدوات، حجم النتائج، وإعادة المحاولة، وقواعد تمنع اختراع
  الأسعار وتطلب التأكيد للعمليات الحساسة.
- **CI والاختبارات**: CI يشغل backend وvideo-service وtravel-service وlogo-service
  وfrontend build. ملف travelService.test.mjs كبير جداً، لذلك تقسيم الاختبارات
  لاحقاً مهم.

## 6. الرؤية المستهدفة JAOLA OS v2
المسار المستهدف:
`User → Intent/CEO → Mission → Task Graph → Agent Runtime → Tool Runtime → Policy → Provider/Execution → Evidence → Verification → Result`

Core المقترح: Identity، Mission Runtime، Task Graph، Agent Runtime، Tool Runtime،
Policy Engine، Permission Engine، Event Bus، Transaction Manager، Audit، Evidence،
Verification، Memory، Plugin Registry، Capability Registry، Provider Registry.

## 7. Plugin Contract المقترح
كل Plugin يعلن بحسب حاجته: manifest، capabilities، permissions، agents، tools،
providers، events، routes، UI، persistence، tests، verification.

مثال Travel: capabilities مثل travel.search وtravel.booking وtravel.payment؛ agents
مثل travel-agent؛ tools مثل search_flights وsearch_hotels وcreate_booking_intent؛
providers مثل Duffel وLiteAPI؛ permissions مثل travel.read وtravel.book.

## 8. Tool Runtime
المسار: `Agent → Tool Request → Policy → Permission → Confirmation إن لزم → Tool Runtime → Provider → Result → Evidence`

عقد الأداة المقترح: name, description, inputSchema, outputSchema, riskLevel,
permissions, idempotent, requiresConfirmation, timeout, retryPolicy, auditLevel.

قاعدة: Agent لا يصل إلى Provider مباشرة.

## 9. Policy Engine
الـLLM يقترح، Runtime يقرر، Policy تسمح أو تمنع.

أمثلة: قراءة ملف: منخفضة المخاطر. تعديل ملف: حسب السياسة. حذف مشروع: تأكيد. حجز
رحلة: تأكيد. دفع: تأكيد. Refund: تأكيد. Production Deploy: تأكيد. إرسال رسالة
خارجية: حسب السياسة والقناة.

## 10. Mission وTask Graph
Mission تصبح كياناً عاماً لأي مهمة: بناء موقع، حجز رحلة، تخطيط سفر، تحليل مستودع،
نشر تطبيق، حملة تسويقية وغيرها.

Mission المقترحة تحتوي: Goal, Actor, Plugin, Tasks, Dependencies, Agents, Tools,
Policy, Evidence, Verification, Status, Result.

بدلاً من Pipeline ثابت، نستخدم Task Graph يسمح بالتفرع والاعتماد بين المهام.

## 11. ExecutionContext
بدلاً من تمرير username/project/roomName/agents/projectPath/lang وغيرها بشكل مسطح،
نستخدم Context موحداً يحتوي على: mission, actor, project, plugin, task,
permissions, tools, memory, policy, metadata.

## 12. Transaction Layer
العقد العام المقترح: id, idempotencyKey, actor, plugin, capability, status,
provider, providerReference, createdAt, updatedAt, attempts, error, evidence.

يستخدم في Booking وPayment وRefund وFulfillment وغيرها.

## 13. State Machines
- Booking: `pending → issued → cancelled/failed`
- Payment: `created → pending → paid/failed/expired`، `paid → refunded/partially_refunded`
- Fulfillment: `reserved → confirmed → ticketed/failed`
- العلاقة: `Booking → Payment + Fulfillment`

## 14. فصل قواعد البيانات
- JAOLA Core DB: users, missions, tasks, agents, plugins, tools, permissions, audit, events.
- Travel DB: bookings, offers, passengers, payments, hotels, packages, reviews, loyalty, provider data.
- الربط عبر Core User ID وPlugin identity وEvents وreferences، وليس بدمج كل الجداول.

## 15. شجرة JAOLA OS v2 المقترحة
```
backend/
├── core/
│   ├── identity/
│   ├── missions/
│   ├── runtime/
│   │   ├── MissionRuntime.js
│   │   ├── AgentRuntime.js
│   │   ├── ToolRuntime.js
│   │   ├── ExecutionContext.js
│   │   └── TaskGraph.js
│   ├── policy/
│   │   ├── PolicyEngine.js
│   │   ├── PermissionEngine.js
│   │   └── RiskPolicy.js
│   ├── plugins/
│   │   ├── PluginRegistry.js
│   │   ├── CapabilityRegistry.js
│   │   └── ProviderRegistry.js
│   ├── events/
│   │   ├── EventBus.js
│   │   └── EventStore.js
│   ├── transactions/
│   │   ├── TransactionManager.js
│   │   └── IdempotencyStore.js
│   ├── audit/
│   │   └── AuditLog.js
│   ├── verification/
│   │   └── VerificationEngine.js
│   ├── PluginLoader.js
│   └── PluginOrchestrator.js
├── agents/
├── services/
├── plugins/
│   ├── travel/
│   └── coding/
└── server.js
```

## 16. Travel Plugin المقترح
```
backend/plugins/travel/
├── manifest.js
├── capabilities.js
├── agents.js
├── tools.js
├── events.js
├── policies.js
└── index.js
```
هذا Adapter وليس إعادة كتابة Travel. منطق المجال يبقى داخل travel-service في البداية.

## 17. ماذا يبقى وماذا يتغير
- **KEEP**: Travel domain logic، providers، booking logic، Stripe، Agent safety guard، tests وCI.
- **KEEP/MODIFY**: PluginLoader، PluginOrchestrator، Agent Contracts، Mission Queue، State Machine.
- **ADD**: MissionRuntime، AgentRuntime، ToolRuntime، ExecutionContext، TaskGraph،
  PolicyEngine، PermissionEngine، EventBus، TransactionManager،
  Audit/Evidence/Verification، Registries.
- **LATER**: نقل الوظائف المشتركة تدريجياً من Travel وCoding إلى Core بعد إثبات العقود الجديدة.

## 18. خطة التنفيذ
1. Sprint 1 — Contracts: تثبيت Mission/Task/Agent/Tool/Capability/Provider/Event/Transaction/Evidence.
2. Sprint 2 — Runtime: MissionRuntime + AgentRuntime + ToolRuntime + ExecutionContext.
3. Sprint 3 — Policy: PermissionEngine + RiskPolicy + ConfirmationManager.
4. Sprint 4 — Event/Audit: EventBus + AuditLog + EvidenceStore.
5. Sprint 5 — Travel Adapter: جعل Travel أول Plugin حقيقي دون إعادة كتابة المجال.
6. Sprint 6 — Coding Adapter: تحويل Coding إلى Plugin بعد نجاح Travel.
7. Sprint 7 — Refactoring: إزالة التكرار ونقل الوظائف المشتركة إلى Core.

## 19. ما لا يجب فعله الآن
لا نعيد كتابة Travel. لا نغير Providers بلا سبب. لا نغير Stripe بلا سبب. لا نضيف
عشرات Agents قبل تثبيت Runtime. لا ندمج قواعد بيانات Core وTravel. لا نجعل إعادة
تصميم frontend أولوية معمارية الآن. لا نفكك server.js دفعة واحدة. لا نهدم State
Machine الحالية.

## 20. المبادئ المعمارية
1. Agent يقترح؛ Runtime ينفذ؛ Policy تقرر.
2. العمليات عالية الخطورة تحتاج Human Confirmation.
3. Agent لا يعرف أسرار Provider ولا يتصل به مباشرة.
4. Capabilities هي الواجهة التي يرى بها Agent النظام.
5. Business logic يبقى داخل Domain Plugin.
6. Core يملك orchestration وليس منطق Travel أو Coding.
7. العمليات المهمة قابلة للتتبع عبر Transaction/Audit/Evidence.
8. Idempotency أساسي في العمليات التجارية الحساسة.
9. State Machines متخصصة أفضل من State Machine عالمية ضخمة.
10. لا تجريد بلا مستهلك حقيقي.
11. التطوير تدريجي ويحافظ على النظام العامل.

## 21. نقاط تحتاج تحققاً إضافياً
- المراجعة كانت Static Code Review عبر GitHub وليست اختبار تشغيل Production شاملاً.
- البحث عن `orchestrator.init` لم يعط نتيجة واضحة في فهرس البحث الحالي. هذا لا يثبت
  أن الاستدعاء غير موجود قطعاً؛ يجب التحقق من مسار التكامل مباشرة قبل اعتباره مسار
  التشغيل الرسمي. *(تحقُّق 2026-09-03: راجع `../ARCHITECTURE_MAP.md` قسم core —
  الاستدعاء موجود ومؤكَّد.)*
- أي تغيير حرج يجب أن يتبعه build/tests/runtime verification.

## 22. الخطوة التالية المعتمدة
إعداد Architecture Mapping حقيقي ملفاً بملف داخل jaola-os:
`CURRENT FILE → RESPONSIBILITY → KEEP/MODIFY/MOVE → NEW CONTRACT → FINAL LOCATION`

الأولوية: `backend/server.js`، `backend/core/*`، `backend/agents/*`،
`backend/services/*`، `travel-service/*`.

بعد ذلك يمكن البدء بالتنفيذ الفعلي لـJAOLA OS v2 دون هدم النظام الحالي.
*(نُفِّذت: `../ARCHITECTURE_MAP.md`.)*

## 23. الملفات التي تمت مراجعتها أو الاستناد إليها
backend/core/PluginOrchestrator.js، backend/core/PluginLoader.js،
backend/agents/contracts.js، backend/services/missionQueue.js،
backend/agents/stateMachine.js، travel-service/package.json،
travel-service/server.js، travel-service/src/providers/index.js،
travel-service/src/bookings.js، travel-service/src/store/postgresStore.js،
travel-service/src/auth.js، travel-service/src/payments/stripeClient.js،
travel-service/src/agent/agent.js، travel-service/tests/travelService.test.mjs،
.github/workflows/ci.yml، .github/workflows/travel-cron.yml.

## 24. سجل القرار
هذا المستند هو Baseline معماري للجلسة. أي قرار لاحق يخالفه يجب تسجيله كـArchitecture
Decision مع السبب، الأثر، البديل المرفوض، وكيفية التراجع عنه عند الحاجة.

## 25. ملاحظة مرجعية مختصرة
الخلاصة في جملة واحدة: لا نهدم JAOLA OS ولا Travel؛ نوحّد ما تم بناؤه حول Core
Runtime يحتوي Mission/Task/Agent/Tool/Policy/Event/Transaction، ثم نجعل Travel أول
Plugin تجاري يثبت المعمارية.
