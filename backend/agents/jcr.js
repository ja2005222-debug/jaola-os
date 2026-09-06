import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { groq, smartChat } from '../core/providers/llm.js';
import { promises as fsPromises } from 'fs';
import { initUserLanguage, getUserLanguage, detectExplicitLanguageSwitch, hasUserLanguage, LANGUAGE_INFO, resolveGoalLanguage } from './languageDetector.js';
import { addToHistory, getDomainModel } from './projectMemory.js';
import { buildAppSections } from './projectModel.js';
import { localizeLog } from './logLocalizer.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { runDebate } from './stages/debate.js';
import { understandGoal } from './stages/understand.js';
import { enrichBuildContext, resolveProjectType } from './stages/enrich.js';
import { runRequirementsVerify } from './stages/requirementsVerify.js';
import { runRenderConfig } from './stages/renderConfig.js';
import { buildFromRegistry } from './stages/buildFromRegistry.js';
import { reportMissionSuccess } from './stages/reportMissionSuccess.js';
import { buildFromClone } from './stages/buildFromClone.js';
import { runReviewStage, runRefactorStage, runTestingStage, runSeoStage, runSecurityStage, runGitBackupStage } from './stages/quality.js';
import { runDesigner } from './stages/designer.js';
import { runAdvancedModules, runFullStackScaffold, runProjectMemory } from './stages/scaffold.js';
import { readCodeContext, readProjectFiles } from './projectReader.js';
import { runBackendStage } from './stages/backend.js';
import { verifyAndAutofix, runBehaviorVerifyStage } from './stages/verify.js';
import { buildReactProject } from './stages/buildReact.js';
import { selectBuildStrategy } from './stages/selectBuildStrategy.js';
import { runMissionMeta, noteUnknowns } from './stages/missionMeta.js';
import { extractPageName, cleanPageName, readReactContent, findPage, persistReactContent, renamePageNow, deletePageNow, pageNotFound } from './stages/reactPages.js';
import { runSurgicalEdit } from './stages/surgicalEdit.js';
import { addPageNow } from './stages/addPage.js';
import { handleCeoIntent } from './stages/ceoIntent.js';
import { handlePlanningStage, handleModifyPattern, handleBareConfirmations, handleUnifiedRoute, handleClassifiedIntent } from './stages/intentHandlers.js';
import { handleUndo } from './stages/undo.js';
// 🔁 إعادةُ تصدير: `resolveProjectType` بقيت واجهةً من `jcr` لمستورِديها (JCR/6)
export { resolveProjectType };
import { buildFailureChatMessage } from './failureMessages.js';
import { updateLanguage } from './userProfile.js';
import { transitionState, getProjectSummary, STATES } from './stateMachine.js';
import { normalizeText, detectIntentFromMeaning } from './textNormalizer.js';
import { matchDeleteCommand, matchImageCommand, isImageDiagCommand } from './chatCommands.js';
import { missionBriefing } from './ceoBrain.js';
import { setUserLanguage } from './languageDetector.js';
import { assertBuildAgents, DELIVERY_STAGES, deliveryVerdict, recordGateOutcome } from '../core/contracts/index.js';
import { orderTasks } from '../core/runtime/TaskGraph.js';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { writePlanFiles } from '../core/runtime/workspacePaths.js';
import { registerMission, throwIfAborted, clearMission } from '../core/runtime/AbortRegistry.js';
import { guardFiles, ensureEditIntegrity } from '../services/codeGuard.js';
import { recordMissionOutcome, matureLessons, lessonDirective, MIN_COUNT_TO_TEACH } from '../services/platformLessons.js';
import { recordBuild, buildMetricsPayload } from '../services/metricsStore.js';
import { getPendingGoal, consumePendingGoal, clearDialog } from '../services/conversationManager.js';
import { enqueueMission, takeLostMission } from '../core/runtime/ExecutionQueue.js';
import { MEMORY_ROOT } from '../core/runtime/workspaceRoots.js';
import { generateChatResponse as runChatResponse } from './stages/chatResponse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// 🛡️ المكونات المعرفية للـ JCOS v4.0
// ==========================================
class WorldRepresentation {
    constructor(projectPath) {
        this.fileTree = [];
        this.dbState = 'standby';
    }
    scan(projectPath, dbStatus) {
        try {
            this.fileTree = fs.existsSync(projectPath)
                ? fs.readdirSync(projectPath).filter(f => f !== '.backups' && f !== '.next')
                : [];
            this.dbState = dbStatus ? 'connected' : 'standby';
        } catch (e) {}
    }
}

class MentalModel {
    constructor() {
        this.businessGoal = "";
        this.targetAudience = "";
        this.visualIdentity = "";
        this.technicalGoals = [];
        this.successCriteria = [];
        this.risks = [];
    }
}

class JCRContext {
    constructor(userGoal, projectPath, username, activeProject) {
        this.missionId = `mission_${Date.now()}`;
        this.goal = userGoal;
        this.projectPath = projectPath;
        this.username = username;
        this.activeProject = activeProject;
        this.worldModel = new WorldRepresentation(projectPath);
        this.mentalModel = new MentalModel();
        this.budget = null;
        this.metaReasoning = { confidence: 100, unknowns: [], needsUserClarification: false };
        this.internalDebate = { currentConfidence: 100, criticTranscripts: [], specialistPersonality: 'ReactExpert' };
    }
}


// ==========================================
// 🚀 JAOLA Cognitive Runtime
// ==========================================
export class JaolaCognitiveRuntime {
    constructor(ioInstance) {
        this.io = ioInstance;   // يبقى قيمةً: المراحلُ تصل إليه عبر `reporter.io` (JCR/10–24)؛ jcr نفسُه لا يمرّره بعد الآن
        // 📡 البابُ الواحد للبثّ — الشقُّ الذي يفصل ٦٥٪ من ترابط الصنف عن `this`.
        this.reporter = new RoomReporter(ioInstance, { localize: localizeLog });
        this.memoryDir = MEMORY_ROOT;
        this.executiveMemoryPath = path.join(this.memoryDir, 'executive_memory.json');
        // 🔁 كاسر الحلقات: آخر رسالة حُجبت عن التعديل (بوابة الفعل) لكل مستخدم —
        // تكرارها حرفياً = إصرار صريح → تُنفَّذ كتعديل بدل حلقة "اكتب X" اللانهائية.
        this.gatedMessages = new Map();
        if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    }

    emitLiveLog(roomName, layer, agent, message) {
        // 🌐 القمعُ الواحد للسجلّ الحيّ — الترجمةُ ولغةُ الغرفة في المُبلِّغ.
        this.reporter.liveLog(roomName, layer, agent, message);
    }

    emitAgentError(roomName, failedAgentKey) {
        const states = { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'waiting' };
        states[failedAgentKey] = 'error';
        this.reporter.send(roomName, 'agent_states', states);
    }

    async loadExecutiveMemory(username) {
        try {
            if (fs.existsSync(this.executiveMemoryPath)) {
                const data = await fsPromises.readFile(this.executiveMemoryPath, 'utf-8');
                const mem = JSON.parse(data || "{}");
                return mem[username] || { preferredUi: 'Neon Dark', dislikedTech: 'Bootstrap', language: 'Arabic' };
            }
        } catch (e) {}
        return { preferredUi: 'Neon Dark', dislikedTech: 'Bootstrap', language: 'Arabic' };
    }

    async saveExecutiveMemory(username, preferredUi) {
        try {
            let mem = {};
            if (fs.existsSync(this.executiveMemoryPath)) {
                const data = await fsPromises.readFile(this.executiveMemoryPath, 'utf-8');
                mem = JSON.parse(data || "{}");
            }
            mem[username] = { preferredUi, dislikedTech: 'Bootstrap', language: 'Arabic' };
            await fsPromises.writeFile(this.executiveMemoryPath, JSON.stringify(mem, null, 2));
        } catch (e) { console.warn('[saveExecutiveMemory]', 'فشل حفظ الذاكرة التنفيذية:', e.message); }
    }

    async buildWorldModel(context, roomName, dbStatus) {
        this.emitLiveLog(roomName, '1. PERCEPTION', 'World Scanner', '👁️ استكشاف العالم...');
        context.worldModel.scan(context.projectPath, dbStatus);
        this.emitLiveLog(roomName, '1. PERCEPTION', 'World Scanner', `✓ الملفات: [${context.worldModel.fileTree.join(', ')}]`);
    }

    // 🔍 مرحلةُ المهمّة والوعي الذاتيّ خرجت إلى `stages/missionMeta.js#runMissionMeta` (JCR/30) — تفويضٌ يُبقي المستدعيَ والاختباراتِ كما هي؛
    // المُبلِّغُ يُمرَّر، وذاكرةُ التفضيلات عبر `ops`، وعميلُ النموذج بافتراضيّه في المرحلة.
    async buildMissionAndMeta(context, roomName) {
        return runMissionMeta(context, roomName, this.reporter, {
            loadExecutiveMemory: (u) => this.loadExecutiveMemory(u),
        });
    }

    _noteUnknowns(context, roomName) {
        return noteUnknowns(context, roomName, this.reporter);
    }

    async runDynamicMultiAgentRuntime(context, roomName, agents) {
        // 📐 عقد الوكلاء (contracts.js): الأعضاء الإلزامية قبل إطلاق الحلقة — غيابها
        // خطأ تهيئة يُعلَن فوراً، لا «استثناء» يُعاد حتى استنفاد الدورات كدرسٍ كاذب
        assertBuildAgents(agents);
        this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', '💻 إطلاق حلقة النقاش...');
        context.initialCodeContext = await this.readCurrentCodeContextAsync(context.projectPath);
        const maxDebateCycles = context.budget.maxApiCalls;

        await this._stageTemplate(context, roomName, agents);
        await this._stageDesigner(context, roomName, agents);
        const plan = await this._stageDebate(context, roomName, agents);
        if (plan) {
            // ✅ الخطة مقبولة — من هنا خطّ التسليم: مراحل بتوقيع موحّد
            // (context, roomName, agents) تقرأ/تكتب context.plan.files (عقد Agent الأول)
            context.plan = plan;
            // 📐 عقد Task: TaskGraph يرتّب المراحل من dependsOn (اليوم كلّها خطّية
            // فالناتج = ترتيب المصفوفة الحرفي) — نفس الاستدعاءات، الواحدة تلو الأخرى
            for (const stage of orderTasks(DELIVERY_STAGES, { key: 'name', label: 'مراحل التسليم' })) {
                await this[stage.run](context, roomName, agents);
            }

            // ⚖️ الحكمُ من البوّابات (PM/2): كانت الحلقة تعيد النجاحَ دون أن تقرأ ما وجدته
            // مراحلُ التحقّق — فكان «لم يُتحقَّق» يساوي «نجح». الحالةُ تبقى COMPLETED (المهمّةُ
            // اكتملت)؛ الحكمُ على *المنتج* يصل التقريرَ والمستدعي.
            const verdict = deliveryVerdict(context.verdicts);
            this.emitLiveLog(roomName, '7. VERDICT', 'Judge', `⚖️ الحكم: ${verdict.status} — ${verdict.summary}`);
            return { success: true, verdict };
        }

        const lastCritiques = context.internalDebate.criticTranscripts.slice(-3);
        const reasonsText = lastCritiques.length > 0
            ? lastCritiques.map(c => `• [${c.agent}] ${c.critique}`).join('\n')
            : 'لم يتم تسجيل أسباب محددة.';

        this.emitLiveLog(roomName, '5. RUNTIME', 'Orchestrator',
            `❌ فشل بناء الموقع بعد ${maxDebateCycles} محاولة. الأسباب الأخيرة:\n${reasonsText}`
        );
        this.emitLiveLog(roomName, '5. RUNTIME', 'Orchestrator',
            `💡 جرّب صياغة طلبك بشكل أبسط أو أوضح، أو حاول مرة أخرى — أحياناً يكون السبب ضغطاً مؤقتاً على خدمة الذكاء الاصطناعي.`
        );

        throw new Error(`فشل الفريق بعد ${maxDebateCycles} دورات. آخر الانتقادات: ${JSON.stringify(lastCritiques)}`);
    }

    // 📥 مرحلة القالب — على مجلد فارغ فقط: يطبّق قالباً جاهزاً، يحقن توجيهاته
    // في الهوية البصرية، ويستبدل أقسامه التعريفية بشاشات الأدوار للتطبيقات،
    // ثم يُعيد قراءة السياق الأولي (context.initialCodeContext) ليراه المبرمج.
    async _stageTemplate(context, roomName, agents) {
        try {
            const dirFiles = await fsPromises.readdir(context.projectPath);
            const currentFilesCount = dirFiles.filter(f => f !== '.backups' && f !== 'template.zip').length;
            if (currentFilesCount <= 1 && agents.templateAgent) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent', '📥 جاري تحميل القالب...');
                const result = await agents.templateAgent(context.goal, context.projectPath, context.blueprint?.category);
                if (result && result.success) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent', `✅ تم تطبيق قالب ${result.template} (${result.source})`);
                    // 🆕 حقن توجيهات القالب في الهوية البصرية لـ coderAgent
                    if (result.context) {
                        context.mentalModel.visualIdentity = result.context.visualGuide || context.mentalModel.visualIdentity;
                        context.mentalModel.templateSections = result.context.sections || [];
                    }

                    // 🧩 تصحيح جوهري: أقسام القالب "التعريفية" (قائمة/عنّا/حجز طاولة/
                    // آراء) خاطئة لتطبيق تفاعلي متعدّد الأدوار — كانت تحوّل تطبيق
                    // توصيل الطعام إلى بروشور مطعم. للتطبيقات نستبدلها بشاشات الأدوار
                    // والتدفّقات من نموذج المجال (واجهة زبون/مطعم/توصيل/تتبّع).
                    const dm = getDomainModel(context.username, context.activeProject);
                    const isApp = context.blueprint?.kind === 'webapp' || context.blueprint?.kind === 'tool'
                        || (Array.isArray(dm?.roles) && dm.roles.length > 1);
                    if (isApp && dm) {
                        const appSections = buildAppSections(dm);
                        if (appSections.length) {
                            context.mentalModel.templateSections = appSections;
                            this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent',
                                `🧩 تطبيق تفاعلي — استُبدلت أقسام البروشور بشاشات الأدوار: ${appSections.join('، ')}`);
                        }
                    }
                    context.initialCodeContext = await this.readCurrentCodeContextAsync(context.projectPath);
                } else {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent', `❌ فشل: ${result?.error || 'سبب غير معروف'}`);
                }
            }
        } catch (e) {
            this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent', `❌ خطأ: ${e.message}`);
        }
    }

    // خرجت إلى `stages/designer.js#runDesigner` (JCR/14) — تفويضٌ يُبقي المستدعيَ كما هو.
    async _stageDesigner(context, roomName) {
        return runDesigner(context, roomName, this.reporter);
    }

    // 🗣️ حلقةُ النقاش خرجت إلى `stages/debate.js` (JCR/4) — تفويضٌ يُبقي المستدعيَ
    // والاختباراتِ كما هي؛ المُبلِّغُ يُمرَّر وسيطاً لا `this`.
    async _stageDebate(context, roomName, agents) {
        return runDebate(context, roomName, agents, this.reporter);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 🧩 مراحل خطّ التسليم — عقد Agent الأول (ARCHITECTURE_MIGRATION.md)
    // التوقيع الموحّد: async _stageX(context, roomName, agents) → void
    //   - المدخل/المخرج المشترك: context.plan.files (تُقرأ وتُستبدل في مكانها)
    //   - كل مرحلة مغلقة على نفسها: فشلها يُسجَّل «⚠️ تخطّي» ولا يُسقط البناء
    //   - لا مرحلة تعرف ما قبلها أو بعدها؛ الترتيب في runDynamicMultiAgentRuntime وحده
    // نُقلت حرفياً من جسد الحلقة (الدفعة 1) — التنظيف الداخلي يأتي لاحقاً.
    // ══════════════════════════════════════════════════════════════════════

    // 🛡️ Code Guard — فحص syntax وإصلاح ذاتي قبل أي حفظ، ثم سلامة المراجع
    // (رابط تنسيق مفقود/مكسور كان يصل للمستخدم موقعاً خاماً بلا تصميم)، ثم الكتابة
    async _stageGuardAndWrite(context, roomName) {
        const plan = context.plan;
        plan.files = await guardFiles(plan.files,
            (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));
        plan.files = await ensureEditIntegrity(plan.files, context.projectPath,
            (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));
        await writePlanFiles(context.projectPath, plan.files);
        recordGateOutcome(context, 'guard-and-write', 'pass', `${plan.files.length} ملفّاً كُتبت بعد الحراسة`);
    }

    // 🧪 خرجت إلى `stages/quality.js#runReviewStage` (JCR/13) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageReview(context, roomName) {
        return runReviewStage(context, roomName, this.reporter);
    }

    // 🧪 خرجت إلى `stages/quality.js#runRefactorStage` (JCR/13) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageRefactor(context, roomName) {
        return runRefactorStage(context, roomName, this.reporter);
    }

    // 🧪 خرجت إلى `stages/quality.js#runTestingStage` (JCR/13) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageTesting(context, roomName) {
        return runTestingStage(context, roomName, this.reporter);
    }

    // 📋 التحقّقُ من المتطلبات خرج إلى `stages/requirementsVerify.js` (JCR/8) — تفويضٌ
    // يُبقي النداءَ بالاسم من `DELIVERY_STAGES` كما هو؛ المُبلِّغُ يُمرَّر وسيطاً.
    async _stageRequirementsVerify(context, roomName, agents) {
        return runRequirementsVerify(context, roomName, agents, this.reporter);
    }

    // 🧠 الذاكرة التنفيذية للمستخدم (الهوية البصرية المفضّلة) + إتاحة الملفات للسياق
    async _stageExecutiveMemory(context) {
        const plan = context.plan;
        await this.saveExecutiveMemory(context.username, context.mentalModel.visualIdentity);
        context.files = plan?.files || [];
    }

    // 🧪 خرجت إلى `stages/quality.js#runSeoStage` (JCR/13) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageSEO(context, roomName) {
        return runSeoStage(context, roomName, this.reporter);
    }

    // 🧪 خرجت إلى `stages/quality.js#runSecurityStage` (JCR/13) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageSecurity(context, roomName) {
        return runSecurityStage(context, roomName, this.reporter);
    }

    // 🧪 خرجت إلى `stages/quality.js#runGitBackupStage` (JCR/13) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageGitBackup(context, roomName) {
        return runGitBackupStage(context, roomName, this.reporter);
    }

    // خرجت إلى `stages/scaffold.js#runProjectMemory` (JCR/14) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageProjectMemory(context) {
        return runProjectMemory(context);
    }

    // ⚙️ مرحلةُ الخلفية خرجت إلى `stages/backend.js#runBackendStage` (JCR/16) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`؛
    // `agents` وسيطاً كما كان، والمُبلِّغُ يُمرَّر.
    async _stageBackend(context, roomName, agents) {
        return runBackendStage(context, roomName, agents, this.reporter);
    }

    // خرجت إلى `stages/scaffold.js#runAdvancedModules` (JCR/14) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageAdvancedModules(context, roomName) {
        return runAdvancedModules(context, roomName, this.reporter);
    }

    // خرجت إلى `stages/scaffold.js#runFullStackScaffold` (JCR/14) — تفويضٌ يُبقي النداءَ بالاسم من `DELIVERY_STAGES`.
    async _stageFullStackScaffold(context, roomName) {
        return runFullStackScaffold(context, roomName, this.reporter);
    }

    // 🚀 إعدادُ النشر خرج إلى `stages/renderConfig.js` (JCR/9) — تفويضٌ يُبقي
    // النداءَ بالاسم من `DELIVERY_STAGES`؛ المُبلِّغُ يُمرَّر وسيطاً.
    async _stageRenderConfig(context, roomName) {
        return runRenderConfig(context, roomName, this.reporter);
    }

    // 🔬 مرحلةُ التحقّق خرجت إلى `stages/verify.js#runBehaviorVerifyStage` (JCR/18) — تفويضٌ يُبقي النداءَ بالاسم
    // من `DELIVERY_STAGES`؛ `agents` وسيطاً كما كان، والمُبلِّغُ يُمرَّر.
    async _stageBehaviorVerify(context, roomName, agents) {
        return runBehaviorVerifyStage(context, roomName, agents, this.reporter);
    }

    // 📚 التعلّم الحقيقي بعد كل مهمة — عبر ذاكرة دروس المنصة (platformLessons).
    // حلّ محلّ «runReflectionAndSelfImprovement» (كانت تكتب JSON لا يقرؤه أحد)
    // و«runCuriosityInBackground» (سطر سجل عن حجم CSS). لا LLM: سبب الفشل يُصنَّف
    // حتمياً ويتراكم، وبعد MIN_COUNT_TO_TEACH تكرارات يصبح توجيهاً دائماً في
    // prompt المولّد (coderAgent ← buildLessonsPromptBlock) إن كان مما يستطيع
    // المولّد تجنّبه، وإلا بقي نمطاً مرئياً للمشرف. السجل صادق: يظهر فقط حين
    // يُسجَّل درس فعلاً أو يُبنى المشروع بدروس ناضجة.
    _learnFromOutcome(roomName, { success = false, error = null } = {}) {
        try {
            const entry = recordMissionOutcome({ success, error });
            if (entry) {
                const matured = entry.count >= MIN_COUNT_TO_TEACH;
                const tail = !matured ? ''
                    : lessonDirective(entry) ? ' — أصبح توجيهاً دائماً للمولّد'
                    : ' — نمطٌ متكرر يظهر للمشرف';
                this.emitLiveLog(roomName, '6. LEARNING', 'Lessons', `📚 درس مسجَّل: ${entry.key} (تكرار ${entry.count})${tail}`);
                return entry;
            }
            if (success) {
                const n = matureLessons().filter(lessonDirective).length;
                if (n) this.emitLiveLog(roomName, '6. LEARNING', 'Lessons', `📚 بُني هذا المشروع بـ${n} درساً متراكماً من مشاريع سابقة`);
            }
        } catch (e) { console.warn('[Lessons]', 'تعذّر تسجيل الدرس:', e.message); }
        return null;
    }

    async classifyIntent(userMessage, username) {
        const execMemory = await this.loadExecutiveMemory(username);

        // 🆕 كشف مباشر بالكلمات المفتاحية القوية — يتفادى استشارة النموذج لحالات واضحة
        const strongBuildPattern = /^(ابني|اصنع|انشئ|أنشئ|ابدأ|اعمل|صمم|طور|build|create|start building|go ahead|نفذ|ابدأ البناء|ابدأ التنفيذ)\b/i;
        if (strongBuildPattern.test(userMessage.trim())) {
            return { intent: 'build', confidence: 100 };
        }

        try {
            const _intentRes = await smartChat([
                { role: "system", content: 'صنف نية المستخدم. أعد JSON فقط: { "intent": "build|modify|query|chat|stop|acknowledge", "confidence": 0-100 }' },
                { role: "user", content: `الرسالة: "${userMessage}"` }
            ], { max_tokens: 80, temperature: 0.1, json: true });
            const result = JSON.parse(_intentRes);
            if (result.confidence && result.confidence <= 1) {
                result.confidence = Math.round(result.confidence * 100);
            }
            return result;
        } catch (e) {
            return { intent: "chat", confidence: 50 };
        }
    }

    // 🧠 يطوي رسائل قديمة (خرجت من نافذة السياق) داخل ملخّص متدحرج —
    // بهذا يبقى موضوع المحادثة حاضراً مهما طالت، بلا فقدان للسياق.
    async summarizeConversation(previousSummary, olderMessages, userLang = 'ar') {
        const transcript = olderMessages
            .map(m => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`)
            .join('\n');
        const instruction = userLang === 'ar'
            ? 'حدّث ملخّص الذاكرة التالي بدمج الرسائل الجديدة. احتفظ بكل الحقائق الدائمة (اسم المشروع، القرارات، التفضيلات، الالتزامات، ما يريده المستخدم وما رفضه). ⚠️ لا تسجّل ادّعاءات المساعد عن عمليات نفّذها أو فشلت (مثل "أضفت ملف X" أو "لم يعمل الحذف") — قد تكون خاطئة وتلوّث الذاكرة؛ سجّل طلبات المستخدم وقراراته فقط. اكتب فقرة مركّزة بالعربية دون تحية أو مقدمات.'
            : 'Update the memory summary below by merging the new messages. Preserve all durable facts (project name, decisions, preferences, commitments, what the user wants and rejected). ⚠️ Do NOT record assistant claims about operations it performed or that failed (e.g. "I added file X", "the delete didn\'t work") — they may be wrong and would poison memory; record only user requests and decisions. Write one focused paragraph, no greeting.';
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: instruction },
                    { role: 'user', content: `الملخّص الحالي:\n${previousSummary || '(لا يوجد)'}\n\nرسائل جديدة:\n${transcript}` }
                ],
                model: 'llama-3.3-70b-versatile',
                max_tokens: 400,
                temperature: 0.3
            });
            return completion.choices?.[0]?.message?.content || previousSummary;
        } catch (e) {
            return previousSummary; // فشل التلخيص لا يُفقد أي رسالة — تبقى مخزّنة كاملة
        }
    }

    // 💬 مفوِّضٌ إلى `stages/chatResponse.js` (JCR/31): البثُّ يصل `reporter`، والطريقتان
    // اللتان تستبدلهما الاختباراتُ على النسخة تصلان دوالَّ مربوطة في `ops`.
    async generateChatResponse(userMessage, username, roomName, userLang = 'en') {
        return runChatResponse(userMessage, username, roomName, userLang, this.reporter, {
            loadExecutiveMemory: (u) => this.loadExecutiveMemory(u),
            summarizeConversation: (p, o, l) => this.summarizeConversation(p, o, l),
        });
    }
    emitChatReply(roomName, replyMessage) {
        this.reporter.send(roomName, 'chat_reply', { message: replyMessage });
    }

    // 🚦 كل المهام تمر عبر صف التنفيذ: لا توازي لنفس المشروع + حد توازٍ كلي
    // يحمي حصة الـ LLM — كل مواقع الاستدعاء تبقى كما هي
    executeMission(goal, ctx) {
        const { username, activeProject, roomName } = ctx;
        const lang = resolveGoalLanguage(goal, getUserLanguage(username)); // لا ردّ إنجليزي على طلب عربيّ
        const result = enqueueMission({
            username,
            project: activeProject,
            goal, roomName, // 🧾 للسجلّ الدائم — كي لا تسقط المهمة صامتة عند إعادة التشغيل
            run: () => this._reportIfCrashed(this._runMissionNow(goal, ctx), roomName, lang),
            onWait: (position) => {
                const msg = lang === 'ar'
                    ? `⏳ الفريق مشغول بمهمة أخرى — مهمتك في الصف (المركز ${position}) وستبدأ تلقائياً.`
                    : `⏳ The team is busy — your mission is queued (position ${position}) and will start automatically.`;
                this.reporter.send(roomName, 'chat_reply', { message: msg });
            },
        });

        if (!result.accepted) {
            const busyMsg = lang === 'ar'
                ? '⚙️ يوجد بناء جارٍ لهذا المشروع بالفعل — تابع التقدم الحي أو اضغط ⏹ لإيقافه أولاً.'
                : '⚙️ A build is already running for this project — watch the progress or press ⏹ to stop it first.';
            this.reporter.send(roomName, 'chat_reply', { message: busyMsg });
        }
        return result;
    }

    async _runMissionNow(goal, ctx) {
        const { projectPath, username, activeProject, roomName, agents, dbStatus } = ctx;
        const { enrichedGoal, blueprint, blueprintContext, domainModelContext } =
            await this._understandGoal(goal, ctx);

        // 🔄 المهمة تبدأ بمرحلة المعمارية (نموذج العالم + المخطط + القرار) —
        // GENERATING تُعلن لاحقاً عند دخول حلقة كتابة الشفرة فعلاً.
        // 🔴 كان هذا الانتقالُ **بعد** اختيار الاستراتيجيّة، فكانت خمسةُ نداءاتِ
        //    COMPLETED في فرعها (حارسا «يعمل» والبُناةُ الثلاثة) تُدخَل من
        //    IDLE/COMPLETED/FAILED/PAUSED وتُرفض صامتةً: بناءٌ ناجحٌ بكلونٍ يترك
        //    بطاقةَ الحالة على «خامل». مقيسٌ في JCR/1، ومُثبَتٌ باختبارٍ هنا.
        transitionState(username, activeProject, STATES.ARCHITECTURE, { agent: 'Architect' });

        const strategyResult = await this._selectBuildStrategy(goal, blueprint, ctx);
        if (strategyResult) {
            // ⚖️ حكمُ مسار الاستراتيجيّة يُقال كما يُقال حكمُ الحلقة (PM/2b) — «يعمل/تخطّي» بلا حكمٍ لأنّ شيئاً لم يُبنَ.
            if (strategyResult.verdict) this.emitLiveLog(roomName, '7. VERDICT', 'Judge', `⚖️ الحكم: ${strategyResult.verdict.status} — ${strategyResult.verdict.summary}`);
            return strategyResult;
        }

        const { requirementsContext, imageContext, pluginContext } =
            await this._enrichBuildContext(goal, blueprint, ctx);

        const finalGoalWithRequirements = `${enrichedGoal}${blueprintContext}${domainModelContext}\n${requirementsContext}${imageContext}${pluginContext}`;

        // تسجيل هذا الطلب في تاريخ المشروع
        addToHistory(username, activeProject, goal.slice(0, 80));

        const context = new JCRContext(finalGoalWithRequirements || enrichedGoal, projectPath, username, activeProject);
        context.originalGoal = goal;
        context.blueprint = blueprint;   // متاح للـ template agent وباقي المراحل
        // ⏹️ تسجيل المهمة في سجل الإيقاف — تسمح للمستخدم بإيقافها من الواجهة
        registerMission(roomName);

        // 🧠 CEO Personality — إحاطة مهمة كاملة: تحليل + تعيين وكلاء + وقت متوقع
        const existingFiles = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
        const hasExistingProject = existingFiles && existingFiles.trim().length > 100;
        const userLangForMsg = getUserLanguage(username);

        this.reporter.send(roomName, 'chat_reply', {
            message: missionBriefing({ lang: userLangForMsg, goal, hasExisting: hasExistingProject })
        });

        this.emitLiveLog(roomName, 'JCOS', 'Kernel', `🏁 بدء المهمة: ${context.missionId}`);
        try {
            await this.buildWorldModel(context, roomName, dbStatus);
            throwIfAborted(roomName);
            await this.buildMissionAndMeta(context, roomName);
            throwIfAborted(roomName);

            let execResult;
            try {
                execResult = await this.runDynamicMultiAgentRuntime(context, roomName, agents);
            } catch (runtimeError) {
                if (runtimeError.aborted) throw runtimeError; // الإيقاف ليس فشلاً — يُعالج في الأسفل
                // الحالة تتحول FAILED فوراً — كانت تبقى GENERATING فيُحجب المستخدم
                // بقفل "مهمة تعمل" حتى ينقذه مؤقت العشر دقائق
                transitionState(username, activeProject, STATES.FAILED, { error: runtimeError.message });
                this.emitAgentError(roomName, 'coder');
                this._learnFromOutcome(roomName, { success: false, error: runtimeError });
                this.emitLiveLog(roomName, 'JCOS', 'Kernel', `❌ فشل نهائياً: ${runtimeError.message}`);
                // 💬 الشات لا يصمت عند الفشل — رسالة حتمية بلغة المستخدم (بلا نموذج)
                this.reporter.send(roomName, 'chat_reply', {
                    message: buildFailureChatMessage(getUserLanguage(username), runtimeError),
                });
                return { success: false, error: runtimeError.message };
            }

            if (execResult.success) {
                this.reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
            }

            this._learnFromOutcome(roomName, { success: execResult.success });
            if (execResult.success) {
                transitionState(username, activeProject, STATES.COMPLETED);
                this._reportMissionSuccess(goal, ctx, execResult.verdict);
            }
            if (!execResult.success) {
                // الحالة FAILED فوراً — لا انتظار لمؤقت القفل العالق
                transitionState(username, activeProject, STATES.FAILED, { error: execResult.error || 'build_failed' });
                // 📊 البنايات الفاشلة تُسجل أيضاً — التاريخ الصادق جزء من الذكاء
                recordBuild(username, activeProject, {
                    success: false,
                    durationSec: getProjectSummary(username, activeProject).duration || 0,
                    filesCount: 0, goal: goal || '',
                });
                this.reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));
            }
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', execResult.success ? '✨ نجاح' : '❌ فشل');
            return execResult;
        } catch (error) {
            // ⏹️ إيقاف بطلب المستخدم — ليس فشلاً
            if (error.aborted) {
                transitionState(username, activeProject, STATES.PAUSED);
                this.reporter.send(roomName, 'agent_states', {
                    planner: 'waiting', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting'
                });
                const langAbort = getUserLanguage(username);
                const abortMsg = langAbort === 'ar'
                    ? '⏹️ تم إيقاف المهمة بناءً على طلبك.\nأخبرني بما تريد فعله الآن.'
                    : '⏹️ Mission stopped at your request.\nTell me what you want to do next.';
                this.reporter.send(roomName, 'chat_reply', { message: abortMsg });
                this.emitLiveLog(roomName, 'JCOS', 'Kernel', '⏹️ المهمة أُوقفت من قبل المستخدم');
                return { success: false, aborted: true };
            }
            this.emitAgentError(roomName, 'planner');
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', `❌ تعطلت المهمة: ${error.message}`);
            this._learnFromOutcome(roomName, { success: false, error });
            return { success: false, error: error.message };
        } finally {
            clearMission(roomName);
            // 🛠️ إنهاء بث الكود دائماً (نجاح/فشل/إيقاف) — بدونها تبقى طبقة
            // "يكتب الكود الآن" تغطي المعاينة للأبد عند أي فشل أو إيقاف
            this.reporter.send(roomName, 'stream_done', { timestamp: Date.now() });
        }
    }

    // ── مراحل _runMissionNow (نُقلت حرفياً — الدفعة 4) ────────────────────
    // 🧭 الفهمُ خرج إلى `stages/understand.js` (JCR/5) — تفويضٌ يُبقي المستدعيَ
    // واختباراتِ الاستبدال على النسخة كما هي؛ المُبلِّغُ يُمرَّر وسيطاً.
    async _understandGoal(goal, ctx) {
        return understandGoal(goal, ctx, this.reporter);
    }

    // 🧭 اختيارُ الاستراتيجيّة خرج إلى `stages/selectBuildStrategy.js#selectBuildStrategy` (JCR/29) — تفويضٌ يُبقي المستدعيَ كما هو؛
    // المُبلِّغُ يُمرَّر، والبناةُ الثلاثة عبر `ops` (تستبدلها الاختبارات على النسخة)، وتلميحُ المسار `trackByRoom` دالّةً مربوطة.
    async _selectBuildStrategy(goal, blueprint, ctx) {
        return selectBuildStrategy(goal, blueprint, ctx, this.reporter, {
            buildFromRegistry: (g, c) => this._buildFromRegistry(g, c),
            buildFromClone: (clone, g, c) => this._buildFromClone(clone, g, c),
            buildReactProject: (g, c, o) => this._buildReactProject(g, c, o),
            trackOf: (room) => this.trackByRoom?.get(room),
        });
    }

    // 🧩 الإثراءُ خرج إلى `stages/enrich.js` (JCR/6) — تفويضٌ يُبقي المستدعيَ كما هو؛
    // المُبلِّغُ يُمرَّر وسيطاً.
    async _enrichBuildContext(goal, blueprint, ctx) {
        return enrichBuildContext(goal, blueprint, ctx, this.reporter);
    }

    // 📣 تقريرُ التسليم خرج إلى `stages/reportMissionSuccess.js` (JCR/11) — تفويضٌ يُبقي
    // المستدعيَ كما هو؛ المُبلِّغُ يُمرَّر وسيطاً ويحمل `io` للدفع التلقائيّ.
    _reportMissionSuccess(goal, ctx, verdict = null) {
        return reportMissionSuccess(goal, ctx, this.reporter, verdict);
    }

    // خرج إلى `projectReader.js#readCodeContext` (JCR/15) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    async readCurrentCodeContextAsync(projectPath) {
        return readCodeContext(projectPath);
    }

    // 🔬 التحقّقُ السلوكيّ + الإصلاحُ خرجا إلى `stages/verify.js#verifyAndAutofix` (JCR/17) — تفويضٌ يُبقي
    // المستدعين الثلاثة (والاستبدالَ في الاختبارات) كما هم؛ المُبلِّغُ يُمرَّر وسيطاً.
    async _verifyAndAutofix(opts) {
        return verifyAndAutofix(opts, this.reporter);
    }

    // 🚪 ردّ حتمي عند حجب رسالة غامضة — لا يطلب "إعادة إرسال نفس الجملة"
    // (كان الـ LLM يهلوس ذلك فيدخل حلقة لا تنتهي). أي رسالة تالية ستُنفَّذ.
    gateConfirmReply(lang) {
        return lang === 'ar'
            ? '📝 لو كنت تقصد تعديلاً على المشروع، أكّد بإرسال «نعم» أو أعد صياغة طلبك كأمر — وسأطبّقه فوراً. ولو كان سؤالاً، اسألني مباشرة.'
            : '📝 If you meant a change to the project, confirm by sending "yes" or rephrase it as a command — I\'ll apply it right away. If it was a question, just ask.';
    }

    // خرج إلى `projectReader.js#readProjectFiles` (JCR/15) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    async readProjectFilesArray(projectPath) {
        return readProjectFiles(projectPath);
    }

    // ✂️ التعديل الجراحي — يمرّ عبر صف التنفيذ كالبناء (حماية التوازي)
    //
    // 🔇 كان هذا **المُطلِقَ الصامتَ الوحيد**: كلُّ مسارٍ آخرَ يبدأ عملاً طويلاً يقول كلمةً أوّلاً
    //    («⚡ ممتاز! أبني الآن...»، رسالةُ الصفّ، نصُّ الحجب) — أمّا هذا فيُدرِج المهمّةَ ويعود،
    //    فلا يصل الشاتَ شيء. ثلاثةُ مواضعَ في `handleClassifiedIntent` وحدَها تناديه هكذا، وأحدُها
    //    هو الذي ابتلع مواصفةَ نظامِ نقاطِ البيع كاملةً: سطرا سجلٍّ وصفرُ ردود (قِيس بإعادة إنتاج).
    //    الإقرارُ هنا لا هناك: موضعٌ واحدٌ يغطّي كلَّ مستدعٍ حاضرٍ ولاحق.
    surgicalEdit(instruction, ctx) {
        const { username, activeProject, roomName } = ctx;
        const lang = getUserLanguage(username);
        const result = enqueueMission({
            username, project: activeProject,
            // 🧾 التعديلُ كان يُسجَّل بهدفٍ فارغ، فإشعارُ «مهمّةٌ سقطت مع إعادة التشغيل» يخرج بلا تلميحٍ
            //    يعرّف المستخدمَ بما ضاع. النصُّ نفسُه هو الهدف.
            goal: instruction, roomName,
            run: () => this._reportIfCrashed(this._runSurgicalEditNow(instruction, ctx), roomName, lang),
            onWait: (position) => this.reporter.send(roomName, 'chat_reply', {
                message: lang === 'ar' ? `⏳ مهمتك في الصف (المركز ${position}).` : `⏳ Queued (position ${position}).`,
            }),
        });
        // بدأ فوراً (لا انتظارَ في الصفّ، فرسالةُ `onWait` لم تُقَل) → قل إنّك تسلّمت وبدأت.
        if (result.accepted && !result.waited) {
            this.reporter.send(roomName, 'chat_reply', {
                message: lang === 'ar'
                    ? '✂️ تسلّمتُ طلبك وبدأتُ العمل عليه الآن — تابع السجلّ الحيّ، وسأعود إليك بالنتيجة.'
                    : "✂️ Got your request — I've started working on it now. Follow the live log; I'll report back with the result.",
            });
        }
        if (!result.accepted) {
            this.reporter.send(roomName, 'chat_reply', {
                message: lang === 'ar' ? '⚙️ يوجد عمل جارٍ لهذا المشروع — انتظر أو اضغط ⏹.' : '⚙️ A task is already running — wait or press ⏹.',
            });
        }
        return result;
    }

    /**
     * 🔇 انهيارُ المهمّة يُقال حيث يَنظر المستخدم.
     *
     * `ExecutionQueue#pump` يلتقط رفضَ `run` بـ`console.error` ثمّ يُنهي المهمّة بهدوء — سطرٌ في
     * سجلّ الخادم لا يراه صاحبُ الطلب، فينتظر رداً لن يأتي أبداً. نلفُّ الوعدَ هنا: نقول العطبَ
     * في الشات ثمّ **نعيد رميَه** كي يبقى سطرُ الصفّ في السجلّ كما هو (لا نُخفي أثراً، نُضيف صوتاً).
     */
    _reportIfCrashed(promise, roomName, lang) {
        return Promise.resolve(promise).catch((e) => {
            const detail = String(e?.message || e || '').slice(0, 160);
            this.reporter.send(roomName, 'chat_reply', {
                message: lang === 'ar'
                    ? `❌ توقّف العمل بخطأ غير متوقّع${detail ? ` (${detail})` : ''} — لم يكتمل طلبك. أعد إرساله، وإن تكرّر فجزّئه إلى طلبَين أصغر.`
                    : `❌ The work stopped with an unexpected error${detail ? ` (${detail})` : ''} — your request did not complete. Send it again; if it repeats, split it into two smaller requests.`,
            });
            throw e;
        });
    }

    // خرجت إلى `stages/reactPages.js#extractPageName` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    _extractPageName(instruction, lang) {
        return extractPageName(instruction, lang);
    }

    // ➕ إضافةُ الصفحة خرجت إلى `stages/addPage.js#addPageNow` (JCR/23) — تفويضٌ يُبقي المستدعيَ كما هو؛ المُبلِّغُ
    // يُمرَّر، و`_runMissionNow` تُمرَّر دالّةً (`ops`) حتّى يبقى استبدالُ الاختبارات على النسخة نافذاً.
    async _addPageNow(instruction, projectPath, username, activeProject, roomName, lang) {
        return addPageNow(instruction, projectPath, username, activeProject, roomName, lang, this.reporter, {
            runMission: (goal, c) => this._runMissionNow(goal, c),
        });
    }

    // خرجت إلى `stages/reactPages.js#cleanPageName` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    _cleanPageName(s) {
        return cleanPageName(s);
    }

    // خرجت إلى `stages/reactPages.js#readReactContent` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    async _readReactContent(projectPath) {
        return readReactContent(projectPath);
    }

    // خرجت إلى `stages/reactPages.js#findPage` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    _findPage(content, name) {
        return findPage(content, name);
    }

    // خرجت إلى `stages/reactPages.js#persistReactContent` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    async _persistReactContent(projectPath, content, username, activeProject, roomName, lang, historyMsg) {
        return persistReactContent(projectPath, content, username, activeProject, roomName, lang, historyMsg, this.reporter);
    }

    // خرجت إلى `stages/reactPages.js#renamePageNow` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    async _renamePageNow(projectPath, username, activeProject, roomName, lang, oldName, newName) {
        return renamePageNow(projectPath, username, activeProject, roomName, lang, oldName, newName, this.reporter);
    }

    // خرجت إلى `stages/reactPages.js#deletePageNow` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    async _deletePageNow(projectPath, username, activeProject, roomName, lang, name) {
        return deletePageNow(projectPath, username, activeProject, roomName, lang, name, this.reporter);
    }

    // خرجت إلى `stages/reactPages.js#pageNotFound` (JCR/20) — مفوِّضٌ يُبقي المستدعين (والاستبدالَ في الاختبارات) كما هم.
    _pageNotFound(content, roomName, lang, name) {
        return pageNotFound(content, roomName, lang, name, this.reporter);
    }

    // ✂️ التعديلُ الجراحيّ خرج إلى `stages/surgicalEdit.js#runSurgicalEdit` (JCR/22) — تفويضٌ يُبقي المستدعيَ كما هو؛
    // المُبلِّغُ يُمرَّر، وطرائقُ الصنف الخمس التي كانت تُستدعى بـ`this` تُمرَّر دوالَّ (`ops`) حتّى تبقى استبدالاتُ
    // الاختبارات على النسخة نافذة.
    async _runSurgicalEditNow(instruction, ctx) {
        return runSurgicalEdit(instruction, ctx, this.reporter, {
            runMission: (goal, c) => this._runMissionNow(goal, c),
            renamePage: (...a) => this._renamePageNow(...a),
            deletePage: (...a) => this._deletePageNow(...a),
            addPage: (...a) => this._addPageNow(...a),
            verify: (opts) => this._verifyAndAutofix(opts),
        });
    }

    // 🍔 البناءُ من كلونٍ عامل خرج إلى `stages/buildFromClone.js` (JCR/12) — تفويضٌ يُبقي
    // المستدعيَ كما هو؛ المُبلِّغُ يُمرَّر وسيطاً ويحمل `io` للدفع التلقائيّ.
    async _buildFromClone(clone, goal, ctx) {
        return buildFromClone(clone, goal, ctx, this.reporter);
    }

    // 🧱 بناءُ Registry خرج إلى `stages/buildFromRegistry.js` (JCR/10) — تفويضٌ يُبقي
    // المستدعيَ كما هو؛ المُبلِّغُ يُمرَّر وسيطاً ويحمل `io` للدفع التلقائيّ.
    async _buildFromRegistry(goal, ctx) {
        return buildFromRegistry(goal, ctx, this.reporter);
    }

    // ⚛️ بناءُ React/Next خرج إلى `stages/buildReact.js#buildReactProject` (JCR/19) — تفويضٌ يُبقي المستدعيَ
    // كما هو؛ المُبلِّغُ يُمرَّر وسيطاً أخيراً ويحمل `io` للدفع التلقائيّ.
    async _buildReactProject(goal, ctx, opts = {}) {
        return buildReactProject(goal, ctx, opts, this.reporter);
    }

    async handleUserMessage(socket, data, agents, dbStatus) {
        const { message, roomName, projectPath, username, activeProject, uiLang, track } = data;
        // 🧭 سياق التنفيذ (core/runtime/ExecutionContext): بيئة هذه الرسالة كاملةً
        // في كائن واحد مجمَّد — يُمرَّر لكل إطلاق مهمة/تعديل بدل ستة معاملات موضعية.
        // معالجات النية تبنيه من `req` بـ`contextFromRequest` (نفس الحقول الستة).
        const ctx = createExecutionContext({ username, activeProject, projectPath, roomName, agents, dbStatus });

        // 🧭 مسار البناء (موقع/سيستم داخلي) — يصل من زر الواجهة مع كل رسالة
        // ويُحفظ للغرفة كي تلتزم به تأكيدات المتابعة («نعم ابنه الآن»)
        if (track === 'site' || track === 'system') (this.trackByRoom ||= new Map()).set(roomName, track);

        // ── 0. Language Detector — تسجيل اللغة من أول رسالة ────────────
        // لغة الواجهة (uiLang) بذرة أولية: إذا لم تُسجَّل لغة بعد والرسالة قصيرة
        // (غامضة يصعب كشفها)، نبدأ بلغة الواجهة — ثم تفوز لغة الكتابة الفعلية لاحقاً.
        if (uiLang && !hasUserLanguage(username) && LANGUAGE_INFO[uiLang] && message.trim().length < 6) {
            setUserLanguage(username, uiLang);
        }
        const userLang = initUserLanguage(username, message);
        // 🌐 لغة الغرفة — يقرؤها قمع emitLiveLog ليترجم سجلّ البناء الحي
        this.reporter.setLang(roomName, userLang);

        // 🧾 مهمة سقطت مع إعادة تشغيل الخادم قبل اكتمالها؟ نقولها بصدق مرة واحدة
        // (كانت تختفي بلا أثر: لا رسالة ولا سجل — المستخدم ينتظر بناءً لن يأتي)
        const lost = takeLostMission(username, activeProject);
        if (lost) {
            const goalHint = (lost.goal || '').slice(0, 60);
            this.emitLiveLog(roomName, 'QUEUE', 'Ledger', `🧾 مهمة سابقة (${lost.state === 'running' ? 'كانت جارية' : 'كانت منتظرة'}) سقطت مع إعادة تشغيل الخادم: ${goalHint}`);
            this.reporter.send(roomName, 'chat_reply', {
                message: userLang === 'en'
                    ? `⚠️ Heads-up: your previous mission${goalHint ? ` ("${goalHint}")` : ''} was interrupted by a server restart before it finished. Type "continue" to resume it, or send the request again.`
                    : `⚠️ تنبيه: مهمتك السابقة${goalHint ? ` («${goalHint}»)` : ''} انقطعت بإعادة تشغيل الخادم قبل اكتمالها. اكتب «اكمل» لاستئنافها، أو أعد إرسال الطلب.`,
            });
        }

        // 🆕 Conversation Manager — فحص الهدف المعلق (دائم، ينجو من إعادة النشر)
        if (getPendingGoal(username)) {
            // "نفذ/كمل" وغيرها من أوامر التنفيذ تؤكد الهدف المعلق أيضاً
            const isYes = /^(نعم|yes|ok|okay|يلا|ايوه|اه|go|نعم ✓|yes.*build|ابنه|ابدأ|start|sure|yep|نفذ|نفّذ|كمل|أكمل|اكمل|تمام)/i.test(message.trim());
            const isNo = /^(لا|no|cancel|لا.*|not now)/i.test(message.trim()) && message.trim().length < 10;
            if (isYes) {
                const pendingGoal = consumePendingGoal(username);
                const lang = getUserLanguage(username) || userLang;
                const msg = lang === 'ar' ? '⚡ ممتاز! أبني الآن...' : '⚡ Building now...';
                this.reporter.send(roomName, 'chat_reply', { message: msg });
                this.executeMission(pendingGoal, ctx);
                return;
            } else if (isNo) {
                clearDialog(username);
                const msg = userLang === 'ar' ? 'تم الإلغاء. أخبرني بما تريد.' : 'Cancelled. Tell me what you need.';
                this.reporter.send(roomName, 'chat_reply', { message: msg });
                return;
            }
        }

        // معالجة تأكيد البناء
        if (message.startsWith('__CONFIRM_BUILD__')) {
            const goal = message.replace('__CONFIRM_BUILD__', '');
            const lang = getUserLanguage(username) || userLang;
            const msg = lang === 'ar' ? '⚡ ممتاز! أبني الآن...' : '⚡ Building now...';
            this.reporter.send(roomName, 'chat_reply', { message: msg });
            this.executeMission(goal, ctx);
            return;
        }

        const normalizedMessage = normalizeText(message);
        const meaningIntent = detectIntentFromMeaning(message);

        // 🆕 تحديث لغة ملف المستخدم
        updateLanguage(username, userLang);

        // ── 🌐 Language Lock — تبديل صريح للغة يُحفظ ويُطبّق فوراً ────────
        const explicitLang = detectExplicitLanguageSwitch(message);
        if (explicitLang && explicitLang !== getUserLanguage(username)) {
            setUserLanguage(username, explicitLang);
            updateLanguage(username, explicitLang);
            const confirmMsg = explicitLang === 'ar'
                ? 'تم. سأتحدث معك بالعربية من الآن فصاعداً. 🇸🇦'
                : 'Done. I will speak English from now on. 🇬🇧';
            this.reporter.send(roomName, 'chat_reply', { message: confirmMsg });
            return;
        }

        // ── 🗑️ نية حذف المشروع — قبل أي تصنيف/تعديل ─────────────────────
        // الأنماط في chatCommands.js (نقية ومغطاة باختبارات). فعل مدمّر →
        // تأكيد صريح باسم المشروع (stateless — لا حالة تُفقد مع إعادة التشغيل).
        const delCmd = matchDeleteCommand(message, activeProject);
        if (delCmd?.kind === 'confirm' && agents.deleteProject) {
            // كتابة الاسم الحرفي هي التأكيد — sandbox_app محمي في المنفّذ.
            const lang = getUserLanguage(username) || userLang;
            const result = await agents.deleteProject(username, delCmd.target);
            this.reporter.send(roomName, 'chat_reply', {
                message: result.success
                    ? (lang === 'ar'
                        ? `🗑️ تم حذف المشروع «${delCmd.target}» نهائياً (الملفات والسجل).\nبدّل لمشروع آخر أو أنشئ واحداً جديداً من القائمة.`
                        : `🗑️ Project "${delCmd.target}" permanently deleted (files + record).\nSwitch to another project or create a new one from the list.`)
                    : `❌ ${result.error}`,
            });
            return;
        }
        if (delCmd?.kind === 'intent') {
            const target = delCmd.target || activeProject;
            const lang = getUserLanguage(username) || userLang;
            this.emitLiveLog(roomName, 'INTENT', 'Engine', `🗑️ نية حذف مشروع (${target}) — طلب تأكيد صريح (لا تعديل محتوى).`);
            this.reporter.send(roomName, 'chat_reply', {
                message: target === 'sandbox_app'
                    ? (lang === 'ar'
                        ? '⚠️ لا يمكن حذف المشروع الافتراضي sandbox_app.'
                        : '⚠️ The default sandbox_app project cannot be deleted.')
                    : (lang === 'ar'
                        ? `⚠️ حذف المشروع «${target}» **نهائي** — الملفات والسجل، ولا يمكن التراجع.\nللتأكيد اكتب حرفياً: **احذف نهائياً ${target}**`
                        : `⚠️ Deleting "${target}" is **permanent** — files and record, no undo.\nTo confirm, type exactly: **delete permanently ${target}**`),
            });
            return;
        }

        // ── 🔬 تشخيص الصور — يقرأ ملفات المشروع الفعلية ويطبع الحقيقة ──
        if (isImageDiagCommand(message) && agents.diagnoseAiImages) {
            await agents.diagnoseAiImages();
            return;
        }

        // ── 🎨 نية توليد صور — مسار حتمي قبل الموجّه واللغويات ──────────
        // «انشئ صورة حقيقية» كان يسقط في «لا أستطيع إنشاء صور»، و«غير صورة
        // البنر» كان يُطلق مهمة تعديل كود كاملة. الآن: مولّد الصور مباشرة.
        const imgCmd = matchImageCommand(message);
        if (imgCmd && agents.generateAiImages) {
            this.emitLiveLog(roomName, 'INTENT', 'Engine', `🎨 نية توليد صور${imgCmd.hero ? ' (بنر)' : imgCmd.target ? ` (عنصر: ${imgCmd.target})` : ''} — تُنفَّذ عبر مولّد الصور مباشرة (لا تعديل كود).`);
            await agents.generateAiImages({ message, hero: imgCmd.hero, target: imgCmd.target });
            return;
        }

        // ── 1. تحقق من حالة Clarifier ────────────────────────────────────
        const clarifierState = agents.getState?.(username);

        // إذا كنا في مرحلة التوضيح — معالجة الإجابة (مع أزرار الخيارات إن وُجدت)
        if (clarifierState?.stage === 'clarifying') {
            const result = await agents.processAnswer(username, message);
            if (result) {
                this.reporter.send(roomName, 'chat_reply', { message: result.message, options: result.options });
            }
            return;
        }

        // 📨 طلب المستخدم كاملاً — العقد الموحّد لمعالجات النية أدناه:
        // async _handleX(req, agents) → true إن تولّى الرسالة (وانتهى)، false ← المعالج التالي.
        const req = { message, normalizedMessage, meaningIntent, roomName, projectPath, username, activeProject, userLang, dbStatus, clarifierState };

        if (await this._handlePlanningStage(req, agents)) return;
        if (await this._handleUndo(req, agents)) return;
        if (await this._handleBareConfirmations(req, agents)) return;
        if (await this._handleCeoIntent(req, agents)) return;
        if (await this._handleUnifiedRoute(req, agents)) return;
        if (await this._handleModifyPattern(req, agents)) return;
        if (await this._handleClassifiedIntent(req, agents)) return;
    }

    // 🧭 مرحلةُ الخطّة خرجت إلى `stages/intentHandlers.js#handlePlanningStage` (JCR/25) — تفويضٌ يُبقي المستدعيَ كما هو؛
    // المُبلِّغُ يُمرَّر، و`executeMission` تُمرَّر دالّةً (`ops`) حتّى يبقى استبدالُ الاختبارات على النسخة نافذاً.
    async _handlePlanningStage(req, agents) {
        return handlePlanningStage(req, agents, this.reporter, {
            executeMission: (goal, c) => this.executeMission(goal, c),
        });
    }

    // ⏪ «تراجع» خرج إلى `stages/undo.js` (JCR/9) — تفويضٌ يُبقي المستدعيَ كما هو؛
    // `agents` لم يكن يُقرأ فلا يُمرَّر.
    async _handleUndo(req, agents) {
        return handleUndo(req, this.reporter);
    }

    // 🧭 التأكيداتُ المجرّدة خرجت إلى `stages/intentHandlers.js#handleBareConfirmations` (JCR/26) — تفويضٌ يُبقي المستدعيَ
    // كما هو؛ المُبلِّغُ يُمرَّر، وحالةُ الحجب تبقى هنا وتصل دوالَّ مربوطة (`gate`)، و`executeMission`/`surgicalEdit` عبر `ops`.
    async _handleBareConfirmations(req, agents) {
        return handleBareConfirmations(req, agents, this.reporter, this._gate(), {
            executeMission: (goal, c) => this.executeMission(goal, c),
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
        });
    }

    // 🚪 شقُّ حالة الحجب للمراحل: دوالُّ مربوطةٌ بخريطة النسخة نفسِها (الاختباراتُ تقرؤها وتكتبها على `rt.gatedMessages`)
    // ونصُّ الحجب من `gateConfirmReply` — لا نسخةَ ولا كائنَ جديد (قرارُ JCR/26).
    _gate() {
        return {
            has: (u) => this.gatedMessages.has(u),
            get: (u) => this.gatedMessages.get(u),
            set: (u, m) => this.gatedMessages.set(u, m),
            delete: (u) => this.gatedMessages.delete(u),
            confirmReply: (lang) => this.gateConfirmReply(lang),
        };
    }

    // 🧠 نوايا CEO خرجت إلى `stages/ceoIntent.js#handleCeoIntent` (JCR/24) — تفويضٌ يُبقي المستدعيَ كما هو؛ المُبلِّغُ
    // يُمرَّر، و`executeMission` تُمرَّر دالّةً (`ops`) حتّى يبقى استبدالُ الاختبارات على النسخة نافذاً.
    async _handleCeoIntent(req, agents) {
        return handleCeoIntent(req, agents, this.reporter, {
            executeMission: (goal, c) => this.executeMission(goal, c),
        });
    }

    // 🧭 الموجّهُ الموحَّد خرج إلى `stages/intentHandlers.js#handleUnifiedRoute` (JCR/27) — تفويضٌ يُبقي المستدعيَ كما هو؛ المُبلِّغُ
    // يُمرَّر، وحالةُ الحجب تصل دوالَّ مربوطة (`gate`)، و`surgicalEdit`/`generateChatResponse` عبر `ops` (تستبدلهما الاختبارات).
    async _handleUnifiedRoute(req, agents) {
        return handleUnifiedRoute(req, agents, this.reporter, this._gate(), {
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
            generateChatResponse: (...a) => this.generateChatResponse(...a),
        });
    }

    // 🧭 كشفُ التعديل بالنمط خرج إلى `stages/intentHandlers.js#handleModifyPattern` (JCR/25) — تفويضٌ يُبقي المستدعيَ
    // كما هو؛ المُبلِّغُ يُمرَّر، و`surgicalEdit` تُمرَّر دالّةً (`ops`) حتّى يبقى استبدالُ الاختبارات على النسخة نافذاً.
    async _handleModifyPattern(req, agents) {
        return handleModifyPattern(req, agents, this.reporter, {
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
        });
    }

    // 🧭 المصنِّفُ الأخير خرج إلى `stages/intentHandlers.js#handleClassifiedIntent` (JCR/28) — آخرُ معالجِ نيّةٍ يغادر الصنف؛ المُبلِّغُ
    // يُمرَّر، وحالةُ الحجب تصل دوالَّ مربوطة (`gate`)، و`classifyIntent`/`surgicalEdit`/`generateChatResponse` عبر `ops` (تستبدلها الاختبارات).
    async _handleClassifiedIntent(req, agents) {
        return handleClassifiedIntent(req, agents, this.reporter, this._gate(), {
            classifyIntent: (m, u) => this.classifyIntent(m, u),
            surgicalEdit: (goal, c) => this.surgicalEdit(goal, c),
            generateChatResponse: (...a) => this.generateChatResponse(...a),
        });
    }
}
