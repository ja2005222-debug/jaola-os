import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { groq, smartChat } from './baseAgent.js';
import { runBackendTeam, writeBackendTeamFiles } from './backendTeam/index.js';
import { scanProjectFiles, buildProjectBrain, summarizeBrain } from '../services/projectBrain.js';
import { selectStarter, resolveStack } from './starterRegistry.js';
import { generateNextScaffold, generateContentModel, generateSectionContent, compName, slugify, componentSource, defaultSection, pageFileSource } from './reactGenerator.js';
import { buildStaticSite, buildStaticSiteFromSource, buildDashboardPage } from '../services/reactPreview.js';
import { promises as fsPromises } from 'fs';
import { initUserLanguage, getUserLanguage, getLangInfo, getReplyLanguage, detectExplicitLanguageSwitch, hasUserLanguage, LANGUAGE_INFO } from './languageDetector.js';
import { getLanguageDecision, buildLanguagePrompt } from './languageManager.js';
import { getProjectMemory, initFromClarifier, addToHistory, buildMemoryContext, updateDesign, updateStructure, setDomainModel, getDomainModel } from './projectMemory.js';
import { deriveProjectModel, mergeProjectModel, buildProjectModelContext, summarizeModel, buildAppSections } from './projectModel.js';
import { getLibraryModel, recordModel } from './modelLibrary.js';
import { matchCloneTemplate } from './cloneTemplates/index.js';
import { verifyBehavior, buildBehaviorFixInstruction, analyzeProjectStatic, readPageCode, extractDefinedFunctions } from './behaviorVerifier.js';
import { detectProjectType } from './knowledgeEngine.js';
import { getUserProfile, updateLanguage, recordProject, recordEdit, buildProfileContext } from './userProfile.js';
import { generateDesignBrief, saveDesignBrief } from './designerAgent.js';
import { generateDatabase, selectDatabase } from './databaseAgent.js';
import { generateAuth, needsAuth } from './authAgent.js';
import { generateAdvancedModules, needsBackend } from './backendAgent.js';
import { generatePrismaSetup, needsPostgres } from './postgresAgent.js';
import { prepareRenderDeploy, deployToRender } from './renderAgent.js';
import { isFullStackProject } from './deployAgent.js';
import { generateDependencies } from './dependencyAgent.js';
import { transitionState, markAgentComplete, getProjectSummary, STATES, isBuilding, canStartNewBuild } from './stateMachine.js';
import { runSEO } from './seoAgent.js';
import { runSecurity } from './securityAgent.js';
import { refactorCode } from './refactorAgent.js';
import { migrateDatabase } from './migrationAgent.js';
import { buildMarketplaceContext } from './componentMarketplace.js';
import { reviewCode } from './reviewAgent.js';
import { runTests } from './testingAgent.js';
import { commitBuild, initProjectRepo, getProjectStats } from './gitAgent.js';
import { backupProject, listSnapshots } from './fileManager.js';
import { analyzeRequirements, buildRequirementsContext } from './requirementAnalyzer.js';
import { normalizeText, normalizeArabic, detectIntentFromMeaning, isQuestionMessage, hasActionIntent } from './textNormalizer.js';
import { routeMessage } from './router.js';
import { matchDeleteCommand, isBareYes, isBareExecute } from './chatCommands.js';
import { verifyRequirements, buildFixInstruction, formatChecklist } from './requirementsVerifier.js';
import { classifyIntentFast, decide, buildContinuationGoal, buildStatusReply, missionBriefing, greetingReply } from './ceoBrain.js';
import { setUserLanguage } from './languageDetector.js';
import { registerMission, throwIfAborted, clearMission } from '../services/abortRegistry.js';
import { autoPushIfEnabled, pushProject } from '../services/githubSync.js';
import { snapshotWorkspace } from '../services/workspaceStore.js';
import { orchestrator } from '../core/PluginOrchestrator.js';
import { guardFiles, guardSingleJS, scrubPlaceholders, ensureEditIntegrity } from '../services/codeGuard.js';
import { recordLesson } from '../services/platformLessons.js';
import { getPlatformKnowledge } from '../services/platformKnowledge.js';
import { getProjectSecrets } from '../services/projectSecrets.js';
import { buildImageContext } from '../services/imageService.js';
import { generateBlueprint, buildBlueprintContext } from './appBlueprint.js';
import { recommendFullStack, buildFullStackProject } from './fullstackTemplates.js';
import { recordScore, recordBuild, recordEditAction, buildMetricsPayload } from '../services/metricsStore.js';
import { setPendingGoal, getPendingGoal, consumePendingGoal, clearDialog } from '../services/conversationManager.js';
import { enqueueMission } from '../services/missionQueue.js';
import { loadForPrompt as loadConversation, recordTurn } from '../services/conversationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// 🛡️ المكونات المعرفية للـ JCOS v4.0
// ==========================================
class WorldRepresentation {
    constructor(projectPath) {
        this.fileTree = [];
        this.gitState = 'clean';
        this.dbState = 'standby';
        this.previousBuilds = [];
        this.resources = { cpu: 14, ram: 42, latency: 12 };
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

class CognitiveBudget {
    constructor(complexity = 'medium') {
        this.maxTokens = complexity === 'complex' ? 100000 : 30000;
        this.tokensUsed = 0;
        this.maxApiCalls = complexity === 'complex' ? 15 : 7;
        this.apiCallsUsed = 0;
        this.timeLimitMs = 180000;
        this.startTime = Date.now();
    }
    isExhausted() {
        return this.tokensUsed >= this.maxTokens ||
               this.apiCallsUsed >= this.maxApiCalls ||
               (Date.now() - this.startTime) >= this.timeLimitMs;
    }
    consumeCall() {
        if (this.isExhausted()) return false;
        this.apiCallsUsed++;
        return true;
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
        this.executiveDecision = { actionType: 'EXECUTE', taskGraph: [], priorityQueue: [] };
        this.internalDebate = { currentConfidence: 100, criticTranscripts: [], specialistPersonality: 'ReactExpert' };
        this.reflection = { failurePatterns: [], successfulStrategies: [], tokensUsed: 0, learningTakeaway: "" };
    }
}

const CognitiveCapabilities = {
    runSecurityAudit(files) {
        let isSafe = true, critique = "";
        files.forEach(file => {
            if (file.name === 'index.html' && file.content.includes('innerHTML') && !file.content.includes('textContent')) {
                isSafe = false;
                critique = "تنبيه أمني: استخدام innerHTML بشكل مباشر قد يسمح بـ XSS. يرجى استبداله بـ textContent.";
            }
        });
        return { isSafe, critique };
    },
    runPerformanceAudit(files) {
        let score = 95, recommendations = [];
        files.forEach(file => {
            if (file.name === 'styles.css' && file.content.length > 5000) {
                score = 80;
                recommendations.push("حجم ملف CSS كبير نسبياً، يرجى اختصاره وتفادي التكرار.");
            }
        });
        return { score, recommendations };
    }
};

async function generateAIImage(prompt, projectPath, fileName) {
    try {
        const placeholderContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
  <rect width="100%" height="100%" fill="#1a1a2e"/>
  <text x="50%" y="50%" fill="#e94560" text-anchor="middle" dy=".3em" font-size="24">
    🖼️ صورة ذكاء اصطناعي: ${prompt.substring(0, 50)}
  </text>
</svg>`;
        await fsPromises.writeFile(path.join(projectPath, fileName), placeholderContent);
    } catch (error) { console.error('[IMAGE] فشل:', error); }
}

// 💾 كتابة آمنة لكل ملفات الخطة — القائمة البيضاء القديمة
// ['index.html','styles.css','script.js'] كانت تُسقط بصمت أي ملف باسم مختلف
// (style.css بلا s، css/styles.css، صفحات إضافية) فيصل الموقع للمستخدم
// خاماً بلا تصميم. الآن يُكتب كل ملف بعد تعقيم مساره فقط.
async function writePlanFiles(projectPath, files) {
    for (const f of files || []) {
        if (!f?.name || typeof f.content !== 'string') continue;
        const safe = path.normalize(f.name).replace(/\\/g, '/');
        // لا مسارات مطلقة، لا صعود خارج المشروع، لا ملفات مخفية (لن تُخدَّم أصلاً)
        if (path.isAbsolute(safe) || safe.split('/').some(p => p === '..' || p.startsWith('.'))) continue;
        const fp = path.join(projectPath, safe);
        if (!fp.startsWith(projectPath)) continue;
        await fsPromises.mkdir(path.dirname(fp), { recursive: true });
        await fsPromises.writeFile(fp, f.content);
    }
}

// ==========================================
// 🚀 JAOLA Cognitive Runtime
// ==========================================
export class JaolaCognitiveRuntime {
    constructor(ioInstance) {
        this.io = ioInstance;
        this.memoryDir = path.resolve(__dirname, '../memory');
        this.reflectionPath = path.join(this.memoryDir, 'reflection_knowledge_graph.json');
        this.executiveMemoryPath = path.join(this.memoryDir, 'executive_memory.json');
        // 🔁 كاسر الحلقات: آخر رسالة حُجبت عن التعديل (بوابة الفعل) لكل مستخدم —
        // تكرارها حرفياً = إصرار صريح → تُنفَّذ كتعديل بدل حلقة "اكتب X" اللانهائية.
        this.gatedMessages = new Map();
        if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    }

    emitLiveLog(roomName, layer, agent, message) {
        this.io.to(roomName).emit('log', { message: `[${layer}] ➔ [${agent}]: ${message}` });
    }

    emitAgentError(roomName, failedAgentKey) {
        const states = { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'waiting' };
        states[failedAgentKey] = 'error';
        this.io.to(roomName).emit('agent_states', states);
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

    async buildMissionAndMeta(context, roomName) {
        this.emitLiveLog(roomName, '2. MISSION & META', 'Mission+Meta', '🔍 تفكيك الهدف والوعي الذاتي...');
        const execMemory = await this.loadExecutiveMemory(context.username);
        try {
            if (!context.budget) context.budget = new CognitiveBudget();
            if (!context.budget.consumeCall()) throw new Error('Budget exhausted');
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "أنتج JSON: mission: { businessGoal, technicalGoal, uxGoal, successCriteria, risks }, meta: { confidence: رقم, unknowns: مصفوفة, priority: 'Critical'|'High'|'Medium'|'Low' }" },
                    { role: "user", content: `تفضيلات: ${JSON.stringify(execMemory)}\nالهدف: "${context.goal}"` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });
            const result = JSON.parse(completion.choices[0].message.content);
            context.mentalModel.businessGoal = result.mission.businessGoal || '';
            context.mentalModel.technicalGoal = result.mission.technicalGoal || '';
            context.mentalModel.visualIdentity = result.mission.uxGoal || '';
            context.mentalModel.successCriteria = Array.isArray(result.mission.successCriteria) ? result.mission.successCriteria : [];
            context.mentalModel.risks = Array.isArray(result.mission.risks) ? result.mission.risks : [];

            let confidence = result.meta.confidence;
            if (typeof confidence === 'number' && confidence <= 1) {
                confidence = Math.round(confidence * 100);
            }
            context.metaReasoning.confidence = confidence || 70;
            context.metaReasoning.unknowns = Array.isArray(result.meta.unknowns) ? result.meta.unknowns : [];
            context.metaReasoning.needsUserClarification = (context.metaReasoning.confidence < 45) && (context.metaReasoning.unknowns.length > 0);

            const allowed = ['Critical', 'High', 'Medium', 'Low'];
            const priority = allowed.includes(result.meta.priority) ? result.meta.priority : 'Medium';
            context.budget = new CognitiveBudget(priority === 'Critical' || priority === 'High' ? 'complex' : 'medium');
            context.budget.apiCallsUsed = 1;
            this.emitLiveLog(roomName, '2. MISSION & META', 'Mission+Meta', `✓ الأولوية: ${priority}, الميزانية: ${context.budget.maxApiCalls} استدعاءات.`);
        } catch (e) {
            context.mentalModel.businessGoal = "بناء كود الموقع";
            context.metaReasoning.confidence = 70;
            context.budget = new CognitiveBudget('medium');
            this.emitLiveLog(roomName, '2. MISSION & META', 'Mission+Meta', `⚠️ فشل الاستدعاء الموحد: ${e.message}`);
        }
    }

    async runExecutiveBrain(context, roomName, agents) {
        this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', '🎯 تفكيك الأهداف...');
        const unknowns = Array.isArray(context.metaReasoning.unknowns) ? context.metaReasoning.unknowns : [];

        if (context.metaReasoning.needsUserClarification && unknowns.length > 0) {
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', '🟡 ملاحظة: توجد مجاهيل، لكننا سنحاول المتابعة.');
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', `الأسئلة المحتملة:\n${unknowns.map((u,i)=>`${i+1}. ${u}`).join('\n')}`);
        }

        if (!context.budget.consumeCall()) {
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', '❌ الميزانية استنفدت.');
            context.executiveDecision.actionType = 'STOP_AND_ASK';
            return;
        }
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "أنت مخطط مهام. أعد كائن JSON يحتوي على 'taskGraph' (مصفوفة من سلاسل تصف المهام الفرعية) و 'priorityQueue' (مصفوفة من كائنات تحتوي على 'taskName' و 'priority' و 'estimatedTime'). مثال: {\"taskGraph\": [\"تصميم الهيكل\", \"كتابة الكود\"], \"priorityQueue\": [{\"taskName\": \"تصميم الهيكل\", \"priority\": \"High\", \"estimatedTime\": 2}]}"
                    },
                    { role: "user", content: `المشروع: ${JSON.stringify(context.mentalModel)}` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                temperature: 0.2
            });
            const result = JSON.parse(completion.choices[0].message.content);
            context.executiveDecision.taskGraph = result.taskGraph || [];
            context.executiveDecision.priorityQueue = result.priorityQueue || [];
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', `✓ ${context.executiveDecision.taskGraph.length} مهام فرعية.`);
        } catch (e) {
            context.executiveDecision.taskGraph = ["بناء وتحديث كود الواجهة"];
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', `⚠️ فشل التفكيك: ${e.message}`);
        }
    }

    async runDynamicMultiAgentRuntime(context, roomName, agents) {
        this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', '💻 إطلاق حلقة النقاش...');
        let initialCodeContext = await this.readCurrentCodeContextAsync(context.projectPath);
        const maxDebateCycles = context.budget.maxApiCalls;

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
                    initialCodeContext = await this.readCurrentCodeContextAsync(context.projectPath);
                } else {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent', `❌ فشل: ${result?.error || 'سبب غير معروف'}`);
                }
            }
        } catch (e) {
            this.emitLiveLog(roomName, '5. RUNTIME', 'TemplateAgent', `❌ خطأ: ${e.message}`);
        }

        // 🆕 مرحلة Designer Agent — قرار بصري قبل Coder
        try {
            this.emitLiveLog(roomName, '5. RUNTIME', 'DesignerAgent', '🎨 جاري توليد الـ Design Brief...');
            const designResult = await generateDesignBrief(
                context.goal,
                context.username,
                context.activeProject,
                getUserLanguage(context.username) || 'en'
            );
            if (designResult.success) {
                const brief = designResult.brief;
                saveDesignBrief(context.projectPath, brief);
                context.mentalModel.visualIdentity = brief.coderInstructions;
                context.mentalModel.designBrief = brief;
                this.emitLiveLog(roomName, '5. RUNTIME', 'DesignerAgent',
                    `✅ Design Brief — ${brief.paletteName} palette`
                );
            }
        } catch (e) {
            this.emitLiveLog(roomName, '5. RUNTIME', 'DesignerAgent', `⚠️ تخطّي: ${e.message}`);
        }

        transitionState(context.username, context.activeProject, STATES.GENERATING, { agent: 'Coder' });
        for (let cycle = 0; cycle < maxDebateCycles; cycle++) {
            if (context.budget.isExhausted()) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'Orchestrator', '❌ الميزانية استنفدت.');
                break;
            }

            // آخر 3 انتقادات فقط — حقن المصفوفة كاملة كان يضخّم الـ prompt مع كل
            // دورة فشل (تكلفة + تشتيت للنموذج) دون فائدة من النقد القديم المُعالج
            const recentCritiques = context.internalDebate.criticTranscripts.slice(-3);
            const critiquesText = recentCritiques.length > 0
                ? `\n⚠️ انتقادات يجب معالجتها:\n${JSON.stringify(recentCritiques, null, 2)}\n`
                : '';
            const prompt = `${context.goal}\n${critiquesText}\nالسياق الحالي:\n${initialCodeContext}`;

            this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Coder', `كتابة الشفرة (دورة ${cycle+1}/${maxDebateCycles})...`);
            if (!context.budget.consumeCall()) break;

            let plan;
            try {
                plan = await agents.coreGenerateCodePlan(
                    prompt,
                    initialCodeContext,
                    context.mentalModel.visualIdentity,
                    [],
                    (chunk) => this.io.to(roomName).emit('code_stream_chunk', chunk),
                    context.mentalModel.templateSections || [],
                    getUserLanguage(context.username) || 'en'
                );
            } catch (e) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'Coder', `❌ استثناء: ${e.message}`);
                context.internalDebate.criticTranscripts.push({ agent: 'CODER_EXCEPTION', critique: e.message });
                continue;
            }

            if (plan.error) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'Coder', `❌ خطأ: ${plan.details}`);
                context.internalDebate.criticTranscripts.push({ agent: 'CODER_ERROR', critique: plan.details });
                continue;
            }

            if (!plan.files || plan.files.length === 0) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'Coder', `⚠️ لم يتم استخراج أي ملفات من رد النموذج. إعادة المحاولة...`);
                context.internalDebate.criticTranscripts.push({
                    agent: 'CODER_EMPTY_RESPONSE',
                    critique: 'النموذج أعاد رداً لم يحتوِ على ملفات بالتنسيق المتوقع (// FILE: name)'
                });
                continue;
            }

            // 🧹 تنظيف حتمي أولاً: placeholders القوالب تُستبدل باسم المشروع
            // قبل فحص النقّاد — إصلاح مجاني لا يحرق دورة إعادة توليد.
            plan.files = scrubPlaceholders(plan.files, context.activeProject);

            const secAudit = CognitiveCapabilities.runSecurityAudit(plan.files);
            const archPromise = context.budget.consumeCall() ? agents.architectReview(plan) : Promise.resolve({ approved: true, feedback: '' });
            const qaPromise = context.budget.consumeCall() ? agents.qaVerify(plan) : Promise.resolve({ passed: true, logs: [] });
            const [archResult, qaResult] = await Promise.all([archPromise, qaPromise]);

            const newCritiques = [];
            if (!archResult.approved) newCritiques.push({ agent: 'Architect', critique: archResult.feedback });
            if (!secAudit.isSafe) newCritiques.push({ agent: 'Security', critique: secAudit.critique });
            if (!qaResult.passed) {
                newCritiques.push({ agent: 'QA', critique: qaResult.logs.join(' | ') });
                // 📚 كل سبب رفض درسٌ للمنصة — الأنماط المتكررة تُحقن مستقبلاً في المولّد
                for (const log of qaResult.logs || []) recordLesson('qa_failure', log);
            }

            if (newCritiques.length > 0) {
                context.internalDebate.criticTranscripts.push(...newCritiques);
                this.emitLiveLog(roomName, '5. RUNTIME', 'Specialists', `❌ رُفض من ${newCritiques.length} متخصص.`);
                continue;
            }

            // 🛡️ Code Guard — فحص syntax وإصلاح ذاتي قبل أي حفظ
            plan.files = await guardFiles(plan.files,
                (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));
            // 🧷 سلامة المراجع قبل الكتابة: رابط تنسيق مفقود/مكسور (href="/styles.css"
            // أو style.css غير الموجود) كان يصل للمستخدم موقعاً خاماً بلا تصميم
            plan.files = await ensureEditIntegrity(plan.files, context.projectPath,
                (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));

            await writePlanFiles(context.projectPath, plan.files);

            // 🆕 Review Agent — يراجع ويُصلح تلقائياً قبل العرض النهائي
            transitionState(context.username, context.activeProject, STATES.REVIEWING, { agent: 'ReviewAgent' });
            try {
                this.emitLiveLog(roomName, '5. RUNTIME', 'ReviewAgent', '🔍 مراجعة جودة الكود...');
                const reviewResult = await reviewCode(plan.files, context.originalGoal, getUserLanguage(context.username) || 'en');

                if (reviewResult.fixedCount > 0) {
                    // حفظ الملفات المُصلحة — كل الملفات، لا القائمة البيضاء
                    await writePlanFiles(context.projectPath, reviewResult.fixedFiles);
                    plan.files = reviewResult.fixedFiles;
                }

                const statusEmoji = reviewResult.grade === 'A' ? '✅' : reviewResult.grade === 'B' ? '🟡' : '🟠';
                this.emitLiveLog(roomName, '5. RUNTIME', 'ReviewAgent',
                    `${statusEmoji} الجودة: ${reviewResult.grade} (${reviewResult.score}/100) — ${reviewResult.overallQuality}${reviewResult.fixedCount > 0 ? ` — تم إصلاح ${reviewResult.fixedCount} مشكلة` : ''}`
                );
                // 📊 تسجيل درجة الجودة الفعلية للوحة الذكاء
                recordScore(context.username, context.activeProject, 'quality', reviewResult);
            } catch (e) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'ReviewAgent', `⚠️ تخطّي: ${e.message}`);
            }
            // 🆕 Refactor Agent — تنظيف الكود
            try {
                const refactorResult = await refactorCode(plan.files, getUserLanguage(context.username) || 'en');
                if (refactorResult.success) {
                    plan.files = refactorResult.files;
                    if (refactorResult.totalReduction > 0) {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'RefactorAgent',
                            `✅ ${refactorResult.summary}`
                        );
                    }
                }
            } catch (e) { console.warn('[RefactorAgent]', 'فشل التحسين (تخطٍّ):', e.message); }

            // 🆕 Testing Agent — اختبار شامل للكود المُنتج
            try {
                if (!plan?.files) throw new Error('plan is not defined');
                const testResult = await runTests(plan.files, getUserLanguage(context.username) || 'en');
                const emoji = testResult.grade === 'A' ? '✅' : testResult.grade === 'B' ? '🟡' : '🟠';
                this.emitLiveLog(roomName, '5. RUNTIME', 'TestingAgent',
                    `${emoji} ${testResult.report}`
                );
                // إذا كان هناك اختبارات فاشلة — سجّلها كتحذير
                if (testResult.failedTests.length > 0) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'TestingAgent',
                        `⚠️ اختبارات فاشلة: ${testResult.failedTests.join(' | ')}`
                    );
                }
            } catch (e) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'TestingAgent', `⚠️ تخطّي: ${e.message}`);
            }

            // 📋 Requirements Verifier — الأهم: هل نُفِّذت متطلبات المشروع فعلاً؟
            // يفحص كل مكوّن وظيفي من الـ Blueprint ضد الكود المبني، يُصلح الناقص
            // تلقائياً (جولة واحدة مستهدفة)، ويعرض قائمة تحقق صادقة للمستخدم.
            try {
                if (context.blueprint?.functionalComponents?.length && plan?.files?.length) {
                    const lang = getUserLanguage(context.username) || 'ar';
                    transitionState(context.username, context.activeProject, STATES.VERIFYING, { agent: 'Requirements' });
                    this.emitLiveLog(roomName, '6. VERIFY', 'Requirements', '📋 التحقق من تنفيذ متطلبات المشروع...');
                    let verdict = await verifyRequirements(context.blueprint, plan.files);
                    const fixedNames = [];

                    // 📚 المتطلبات التي تُسلَّم ناقصة دروسٌ متراكمة للمنصة
                    for (const m of verdict?.missing || []) recordLesson('verifier_missing', m.name);

                    // 🏗️ إكمال الشاشات الناقصة — بناءُ الشاشات هو *جوهر* المشروع، فلا
                    // نتركه رهين ميزانية النقاش (تُستنزف قبله بفريق الخلفية والمراجعة).
                    // جولات محدودة (احتياطي مخصّص) تبني شاشةً فشاشة مدفوعةً بالنموذج،
                    // وتتوقّف عند اكتمالها أو انعدام التقدّم. سجل المستخدم: 4 شاشات
                    // ناقصة (طلب/مطعم/توصيل/تتبّع) لم تُبنَ لأن الجولة الواحدة تعذّرت.
                    const domainModel = getDomainModel(context.username, context.activeProject);
                    const MAX_COMPLETION_ROUNDS = 3;
                    for (let round = 1; round <= MAX_COMPLETION_ROUNDS && verdict?.missing?.length && agents.coreEditCodePlan; round++) {
                        const beforeCount = verdict.missing.length;
                        this.emitLiveLog(roomName, '6. VERIFY', 'Requirements',
                            `🏗️ إكمال الشاشات ${round}/${MAX_COMPLETION_ROUNDS} — ${beforeCount} ناقصة: ${verdict.missing.map(m => m.name).join('، ')}`);
                        const fixPlan = await agents.coreEditCodePlan(
                            buildFixInstruction(verdict.missing, domainModel), plan.files, lang
                        );
                        if (!fixPlan?.files?.length || fixPlan.error) break;

                        const emitFixGuard = (m) => this.emitLiveLog(roomName, '6. VERIFY', 'CodeGuard', m);
                        const guardedFix = await ensureEditIntegrity(
                            await guardFiles(
                                scrubPlaceholders(fixPlan.files, context.activeProject),
                                emitFixGuard
                            ),
                            context.projectPath, emitFixGuard);
                        // دمج الملفات المُصلحة في الخطة وكتابتها على القرص
                        for (const f of guardedFix) {
                            if (!f?.name || typeof f.content !== 'string') continue;
                            const idx = plan.files.findIndex(p => p.name === f.name);
                            if (idx >= 0) plan.files[idx] = f; else plan.files.push(f);
                            const fp = path.join(context.projectPath, f.name);
                            await fsPromises.mkdir(path.dirname(fp), { recursive: true });
                            await fsPromises.writeFile(fp, f.content);
                        }
                        const before = new Set(verdict.missing.map(m => m.name));
                        verdict = await verifyRequirements(context.blueprint, plan.files);
                        for (const r of verdict.results.filter(r => r.implemented && before.has(r.name))) {
                            if (!fixedNames.includes(r.name)) fixedNames.push(r.name);
                        }
                        // توقّف إن لم يتقدّم شيء (تجنّب جولات بلا فائدة)
                        if (verdict.missing.length >= beforeCount) break;
                    }

                    if (verdict) {
                        const checklist = formatChecklist(verdict, lang, fixedNames);
                        this.emitLiveLog(roomName, '6. VERIFY', 'Requirements',
                            `📋 ${verdict.implementedCount}/${verdict.results.length} متطلب منفّذ${fixedNames.length ? ` (+${fixedNames.length} أُصلح تلقائياً)` : ''}`);
                        if (checklist) this.io.to(roomName).emit('chat_reply', { message: checklist });
                        addToHistory(context.username, context.activeProject,
                            `تحقق المتطلبات: ${verdict.implementedCount}/${verdict.results.length} منفّذ`);
                    }
                }
            } catch (e) {
                this.emitLiveLog(roomName, '6. VERIFY', 'Requirements', `⚠️ تخطّي التحقق: ${e.message}`);
            }
            await this.saveExecutiveMemory(context.username, context.mentalModel.visualIdentity);
            context.files = plan?.files || [];
            context.images = plan?.images || [];

            // 🆕 SEO Agent
            try {
                const projectName = context.originalGoal?.split(' ').slice(0, 3).join(' ') || context.activeProject;
                const seoResult = await runSEO(plan.files, {
                    name: projectName,
                    description: context.originalGoal?.slice(0, 150) || projectName,
                    url: `https://${context.username}-${context.activeProject}.vercel.app`,
                    lang: getUserLanguage(context.username) || 'ar',
                });
                if (seoResult.success) {
                    plan.files = seoResult.files;
                    // حفظ robots.txt و sitemap.xml
                    const { promises: fsp } = await import('fs');
                    const pathMod = await import('path');
                    for (const file of seoResult.newFiles) {
                        await fsp.writeFile(pathMod.default.join(context.projectPath, file.name), file.content);
                    }
                    this.emitLiveLog(roomName, '5. RUNTIME', 'SEOAgent', `✅ ${seoResult.summary}`);
                    // 📊 حزمة SEO كاملة طُبقت (robots + sitemap + meta + schema)
                    recordScore(context.username, context.activeProject, 'seo', { grade: 'A', score: 100 });
                }
            } catch (e) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'SEOAgent', `⚠️ تخطّي: ${e.message}`);
            }

            // 🆕 Security Agent
            try {
                const secResult = await runSecurity(plan.files);
                if (secResult.success) {
                    plan.files = secResult.fixedFiles;
                    const { promises: fsp } = await import('fs');
                    const pathMod = await import('path');
                    for (const file of secResult.newFiles) {
                        await fsp.writeFile(pathMod.default.join(context.projectPath, file.name), file.content);
                    }
                    const secEmoji = secResult.grade === 'A' ? '✅' : secResult.grade === 'B' ? '🟡' : '🟠';
                    this.emitLiveLog(roomName, '5. RUNTIME', 'SecurityAgent',
                        `${secEmoji} ${secResult.summary}`
                    );
                    // 📊 تسجيل درجة الأمان الفعلية
                    recordScore(context.username, context.activeProject, 'security', secResult);
                }
            } catch (e) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'SecurityAgent', `⚠️ تخطّي: ${e.message}`);
            }

            // 🆕 Refactor Agent
            // 🆕 Git Agent — commit تلقائي + نسخة احتياطية
            try {
                await backupProject(context.projectPath, 'build');
                const commitResult = await commitBuild(
                    context.projectPath,
                    context.originalGoal?.slice(0, 60) || context.goal.slice(0, 60),
                    'build'
                );
                if (commitResult.success && !commitResult.skipped) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'GitAgent',
                        `✅ تم الحفظ [${commitResult.hash}]`
                    );
                }
            } catch (e) {
                // Git اختياري — لا يوقف البناء
            }

            // 🆕 تحديث Project Memory بهيكل الموقع المبني
            if (context.mentalModel?.templateSections?.length) {
                updateStructure(context.username, context.activeProject,
                    context.mentalModel.templateSections,
                    context.executiveDecision?.subTasks?.map(t => t.description) || []
                );
            }
            if (context.mentalModel?.visualIdentity) {
                updateDesign(context.username, context.activeProject, { style: context.mentalModel.visualIdentity });
            }

            // 🆕 مرحلة Backend — إذا كان المشروع يحتاج خادماً
            if (agents.needsBackend && agents.needsBackend(context.goal)) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', '⚙️ المشروع يحتاج خادماً — جاري توليد APIs...');

                // 👥 فريق الوكلاء الخلفي المتخصص — ينتج ملفات الخلفية الحقيقية تعاونياً (best-effort)
                let teamGuidance = '';
                let teamWroteFiles = 0;
                try {
                    const buildLang = getUserLanguage(context.username) || 'en';
                    const team = await runBackendTeam(context.goal, {
                        lang: buildLang,
                        verify: true, // فحص تنفيذي حقيقي + إصلاح Debug تلقائي
                        llm: (messages, options) => smartChat(messages, options),
                        onEvent: (evt) => {
                            if (evt.type === 'agent_start') this.emitLiveLog(roomName, '5. RUNTIME', 'BackendTeam', `${evt.icon} ${evt.role} يعمل...`);
                            else if (evt.type === 'agent_done') this.emitLiveLog(roomName, '5. RUNTIME', 'BackendTeam', `✅ ${evt.role}: ${evt.summary} (${evt.files} ملف)`);
                            else if (evt.type === 'agent_skipped') this.emitLiveLog(roomName, '5. RUNTIME', 'BackendTeam', `⏭️ ${evt.role} (${evt.reason})`);
                            else if (evt.type === 'verify_failed') this.emitLiveLog(roomName, '5. RUNTIME', 'BackendVerify', `🔎 فحص: ${evt.failures} خطأ — Debug يصلح (جولة ${evt.round})...`);
                            else if (evt.type === 'verify_done') this.emitLiveLog(roomName, '5. RUNTIME', 'BackendVerify', evt.ok ? `✅ الكود المولّد اجتاز الفحص` : `⚠️ بقي ${evt.failures} خطأ بعد ${evt.rounds} جولة`);
                            else if (evt.type === 'agent_error') this.emitLiveLog(roomName, '5. RUNTIME', 'BackendTeam', `⚠️ ${evt.role}: ${evt.error}`);
                        },
                    });
                    if (team.mode === 'execute') {
                        // احفظ وثيقة مرجعية موجزة
                        const doc = [`# Backend Team\n`, `> ${team.summary}\n`,
                            ...team.results.filter(r => !r.skipped && !r.error).map(r => `## ${r.role}\n${r.summary}\n`)].join('\n');
                        await fsPromises.writeFile(path.join(context.projectPath, 'BACKEND_TEAM.md'), doc).catch(() => {});

                        // اكتب ملفات الفريق الحقيقية عبر CodeGuard (فحص/إصلاح قبل الحفظ)
                        if (team.files.length > 0) {
                            const guarded = await guardFiles(
                                team.files.map(f => ({ name: f.path, content: f.content })),
                                (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m)
                            );
                            const byPath = Object.fromEntries(guarded.map(g => [g.name, g.content]));
                            teamWroteFiles = await writeBackendTeamFiles(
                                team.files.map(f => ({ ...f, content: byPath[f.path] ?? f.content })),
                                context.projectPath
                            ).then(w => w.length);
                            this.emitLiveLog(roomName, '5. RUNTIME', 'BackendTeam', `📦 كتب الفريق ${teamWroteFiles} ملف خلفية`);
                        }
                        teamGuidance = `\n\n## توجيهات فريق الخلفية المتخصص (اتبعها ولا تكرّر ملفاته):\n${team.results.filter(r => r.summary).map(r => `- ${r.role}: ${r.summary}`).join('\n')}`;
                    }
                } catch (e) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'BackendTeam', `⚠️ تخطّي فريق الخلفية: ${e.message}`);
                }

                // إن أنتج الفريق ملفات كافية، نكتفي بها؛ وإلا نُكمل بالمولّد التقليدي (fallback)
                try {
                    if (teamWroteFiles >= 2) {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', `✅ اعتمد ملفات فريق الخلفية (${teamWroteFiles})`);
                    }
                    const frontendContext = await this.readCurrentCodeContextAsync(context.projectPath);
                    const backendResult = teamWroteFiles >= 2
                        ? { success: false, files: [] }   // الفريق كفى — تخطّى المولّد التقليدي
                        : await agents.generateBackend(context.goal + teamGuidance, frontendContext);

                    if (backendResult.success && backendResult.files.length > 0) {
                        // 🛡️ فحص ملفات الـ Backend قبل الحفظ
                        backendResult.files = await guardFiles(backendResult.files,
                            (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));

                        // حفظ ملفات الـ Backend
                        for (const file of backendResult.files) {
                            const filePath = path.join(context.projectPath, file.name);
                            // تأكد من وجود المجلد (مثل api/)
                            await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
                            await fsPromises.writeFile(filePath, file.content);
                        }
                        this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent',
                            `✅ تم توليد ${backendResult.files.length} ملف (${backendResult.files.map(f => f.name).join(', ')})`
                        );

                        // تحديث script.js ليستدعي الـ APIs
                        if (agents.generateFrontendAPIIntegration) {
                            const updatedScript = await agents.generateFrontendAPIIntegration(
                                context.goal,
                                backendResult.files,
                                plan.files.find(f => f.name === 'script.js')?.content || ''
                            );
                            if (updatedScript) {
                                // 🛡️ فحص script.js المحدَّث قبل الحفظ
                                const guardedScript = await guardSingleJS('script.js', updatedScript,
                                    (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));
                                await fsPromises.writeFile(
                                    path.join(context.projectPath, 'script.js'),
                                    guardedScript
                                );
                                this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', '🔗 تم تحديث script.js ليستدعي الـ APIs');
                            }
                        }
                    } else if (teamWroteFiles < 2) {
                        // إنذار حقيقي فقط حين يفشل المولّد التقليدي فعلاً — لا حين
                        // يكون الفريق قد كفى (كنا نطبع "undefined" في تلك الحالة)
                        this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', `⚠️ تعذّر توليد الخادم: ${backendResult.error || 'لم يُنتج ملفات صالحة'}`);
                    }
                } catch (e) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', `❌ خطأ في BackendAgent: ${e.message}`);
                }

                // 🆕 DatabaseAgent — يُولّد Schema + Seed Data مع Backend.
                // ⛔ فقط إن لم يتكفّل فريق الخلفية بطبقة البيانات — وإلا نُنتج
                // قاعدتَي بيانات متضاربتين (SQLite من الفريق + MongoDB من هنا).
                if (teamWroteFiles < 2) {
                  try {
                    const projectType = context.mentalModel?.designBrief?.projectType || 'business';
                    this.emitLiveLog(roomName, '5. RUNTIME', 'DatabaseAgent', '🗄️ جاري توليد قاعدة البيانات...');
                    const dbResult = await generateDatabase(context.originalGoal, projectType, context.projectPath);
                    if (dbResult.success) {
                        const { promises: fsp } = await import('fs');
                        const pathMod = await import('path');
                        for (const file of dbResult.files) {
                            const filePath = pathMod.default.join(context.projectPath, file.name);
                            await fsp.mkdir(pathMod.default.dirname(filePath), { recursive: true });
                            await fsp.writeFile(filePath, file.content);
                        }
                        this.emitLiveLog(roomName, '5. RUNTIME', 'DatabaseAgent',
                            `✅ ${dbResult.summary}`
                        );
                    }
                  } catch (e) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'DatabaseAgent', `⚠️ تخطّي: ${e.message}`);
                  }
                } else {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'DatabaseAgent', 'ℹ️ فريق الخلفية تكفّل بقاعدة البيانات — تخطّي المولّد المستقل.');
                }

                // 🆕 PostgreSQL + Prisma — للمشاريع التي تحتاج قاعدة علاقية
                // (أيضاً فقط إن لم يتكفّل الفريق — منعاً لتكدّس قواعد البيانات)
                if (teamWroteFiles < 2 && needsPostgres(context.originalGoal)) {
                    try {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'PostgresAgent', '🐘 جاري توليد Prisma Schema...');
                        const projectType = context.mentalModel?.designBrief?.projectType || 'ecommerce';
                        const pgResult = await generatePrismaSetup(context.originalGoal, projectType);
                        if (pgResult.success) {
                            const { promises: fsp } = await import('fs');
                            const pathMod = await import('path');
                            for (const file of pgResult.files) {
                                const filePath = pathMod.default.join(context.projectPath, file.name);
                                await fsp.mkdir(pathMod.default.dirname(filePath), { recursive: true });
                                await fsp.writeFile(filePath, file.content);
                            }
                            this.emitLiveLog(roomName, '5. RUNTIME', 'PostgresAgent',
                                `✅ ${pgResult.summary}`
                            );
                        }
                    } catch (e) {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'PostgresAgent', `⚠️ تخطّي: ${e.message}`);
                    }
                }

                // 🆕 Auth Agent — يُضيف نظام تسجيل دخول إذا احتاجه المشروع
                if (needsAuth(context.originalGoal)) {
                    try {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'AuthAgent', '🔐 جاري توليد نظام المصادقة...');
                        const authResult = await generateAuth(context.originalGoal, context.projectPath, getUserLanguage(context.username) || 'en');
                        if (authResult.success) {
                            const { promises: fsp } = await import('fs');
                            const pathMod = await import('path');
                            for (const file of authResult.files) {
                                const filePath = pathMod.default.join(context.projectPath, file.name);
                                await fsp.mkdir(pathMod.default.dirname(filePath), { recursive: true });
                                await fsp.writeFile(filePath, file.content);
                            }
                            this.emitLiveLog(roomName, '5. RUNTIME', 'AuthAgent',
                                `✅ ${authResult.summary}`
                            );
                        }
                    } catch (e) {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'AuthAgent', `⚠️ تخطّي: ${e.message}`);
                    }
                }
            }

            // 🆕 Advanced Modules — Stripe, Upload, OAuth
            try {
                const advResult = await generateAdvancedModules(context.originalGoal, context.projectPath);
                if (advResult.files.length > 0) {
                    const { promises: fsp } = await import('fs');
                    const pathMod = await import('path');
                    for (const file of advResult.files) {
                        const filePath = pathMod.default.join(context.projectPath, file.name);
                        await fsp.mkdir(pathMod.default.dirname(filePath), { recursive: true });
                        await fsp.writeFile(filePath, file.content);
                    }
                    const features = Object.entries(advResult.features)
                        .filter(([, v]) => v)
                        .map(([k]) => k.replace('needs', ''))
                        .join(', ');
                    this.emitLiveLog(roomName, '5. RUNTIME', 'AdvancedAgent',
                        `✅ ${features} (${advResult.files.length} ملف)`
                    );
                }
            } catch (e) { console.warn('[AdvancedModules]', 'فشل كتابة الوحدات المتقدمة:', e.message); }

            // 🏗️ Full-Stack Scaffold — للفئات المتقدمة (متجر/حجوزات/عقارات…)
            // يُولّد مشروع Next.js + API + Prisma كامل في مجلد fullstack/ بجانب
            // الموقع الثابت (لا يتعارض معه) — نقطة انطلاق جاهزة للتشغيل والنشر.
            try {
                const fsRec = recommendFullStack(
                    context.originalGoal, context.blueprint?.category, context.blueprint?.kind
                );
                if (fsRec.fullstack) {
                    const { promises: fsp } = await import('fs');
                    const pathMod = await import('path');
                    const { category, files } = buildFullStackProject(fsRec.category, context.activeProject);
                    for (const file of files) {
                        const filePath = pathMod.default.join(context.projectPath, 'fullstack', file.name);
                        await fsp.mkdir(pathMod.default.dirname(filePath), { recursive: true });
                        await fsp.writeFile(filePath, file.content);
                    }
                    this.emitLiveLog(roomName, '5. RUNTIME', 'FullStackAgent',
                        `🏗️ نسخة Full-Stack (${category}) في مجلد fullstack/ — Next.js + API + Prisma (${files.length} ملف)`
                    );
                }
            } catch (e) { console.warn('[FullStack]', 'فشل كتابة سكافولد fullstack/:', e.message); }

            // 🆕 Render Deploy Config — يُعدّ المشروع للنشر على Render
            try {
                const projectName = context.activeProject
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '-')
                    .slice(0, 50);
                const hasBackend = needsBackend(context.originalGoal);
                const renderResult = await prepareRenderDeploy(
                    context.projectPath,
                    `${context.username}-${projectName}`,
                    hasBackend
                );
                if (renderResult.success) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'RenderAgent',
                        `✅ ${renderResult.summary}`
                    );
                }
            } catch (e) { console.warn('[RenderDeploy]', 'فشل إعداد النشر:', e.message); }

            // 🔬 التحقّق السلوكي + جولة إصلاح تلقائية (طريقة مشتركة مع مسار التعديل)
            // محاط بحارس: خطأ في التحقّق يجب ألّا يُسقط بناءً ناجحاً أبداً.
            try {
                const verdict = await this._verifyAndAutofix({
                    projectPath: context.projectPath, blueprint: context.blueprint,
                    username: context.username, activeProject: context.activeProject, roomName, agents,
                    lang: getUserLanguage(context.username) || 'ar',
                    canFix: !!context.budget?.consumeCall?.(),
                });
                // 📚 مساهمة في مكتبة النماذج — فهم مُجرَّب (مرّ بالتحقّق) يُغني فئته
                // فيبدأ كل مشروع لاحق من نضجٍ أعلى. نساهم فقط بما نجح تحقّقه.
                if (verdict?.ok && context.blueprint?.category) {
                    const contributed = recordModel(
                        context.blueprint.category,
                        getDomainModel(context.username, context.activeProject),
                        { verified: true }
                    );
                    if (contributed) this.emitLiveLog(roomName, '6. VERIFY', 'ModelLibrary',
                        `📚 أُغني فهم فئة «${context.blueprint.category}» بنموذج مُجرَّب — يستفيد منه كل مشروع لاحق.`);
                }
            } catch (e) { console.warn('[BehaviorVerify]', 'تخطّي التحقّق (لا يُسقط البناء):', e.message); }

            return { success: true };
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

    async runCuriosityInBackground(context, roomName) {
        try {
            this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity', '🧩 فضول تلقائي...');
            const perf = CognitiveCapabilities.runPerformanceAudit(context.files);
            if (perf.score < 90 && perf.recommendations.length) {
                this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity', `🔎 تحسين الأداء (${perf.score}%)...`);
            }
        } catch (e) {}
    }

    async runReflectionAndSelfImprovement(context, roomName, isSuccess) {
        const node = {
            missionId: context.missionId, timestamp: new Date().toISOString(), goal: context.goal,
            success: isSuccess, retries: context.internalDebate.criticTranscripts.length,
            takeaways: isSuccess ? 'نجحت' : 'فشلت'
        };
        try {
            let kg = [];
            if (fs.existsSync(this.reflectionPath)) {
                kg = JSON.parse(await fsPromises.readFile(this.reflectionPath, 'utf-8') || "[]");
            }
            kg.push(node);
            await fsPromises.writeFile(this.reflectionPath, JSON.stringify(kg.slice(-50), null, 2));
            this.emitLiveLog(roomName, '6. REFLECTION', 'Learning', '✓ تم الحفظ.');
        } catch (e) { console.warn('[Reflection]', 'فشل حفظ رسم المعرفة:', e.message); }
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

    async generateChatResponse(userMessage, username, roomName, userLang = 'en') {
        const langInfo = getLangInfo(userLang);
        const execMemory = await this.loadExecutiveMemory(username);

        // 🧠 نافذة السياق الأخيرة + الملخّص طويل المدى — يبقي الموضوع حاضراً
        // مهما طالت المحادثة بدل اقتطاعها لآخر 30 رسالة وفقدان السياق.
        const { window: history, summary: convSummary } = await loadConversation(username);

        // 🧠 Project Brain — يفهم كامل المشروع (ملفات + قرارات + أُنجز/متبقٍّ) لا الرسالة الأخيرة فقط
        let brainContext = '';
        // 🔬 الدماغ يُؤرَّض على الكود الفعلي (المتبقّي/يعمل) لا على خطة مخزّنة —
        // المستخدم: الردّ كان يقرأ الخطة لا الملفات فيجهل ما يجب عمله ويخترع 67%.
        const project = roomName.startsWith(username + '-') ? roomName.slice(username.length + 1) : null;
        try {
            if (project) {
                const safeUser = username.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
                const safeProject = project.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
                const projectPath = path.resolve(__dirname, '../../workspace', safeUser, safeProject);
                const files = await scanProjectFiles(projectPath, { maxFiles: 300 });
                const brain = buildProjectBrain(getProjectMemory(username, project), files);

                // 🔬 فحص ساكن حقيقي على الكود قبل التلخيص — نُصحّح «المتبقّي»
                // و«النسبة» في الدماغ نفسه ليكون صادقاً (لا يكفي إلحاق قسم؛
                // النموذج يثق بأرقام الدماغ الواثقة فيردّدها). الكود هو الحكم.
                const { hasProject, checks } = await analyzeProjectStatic({
                    projectPath, domainModel: getDomainModel(username, project),
                });
                if (hasProject) {
                    const fails = checks.filter(c => c.status === 'fail');
                    const gapDetails = checks.filter(c => c.status !== 'pass').map(c => c.detail);
                    if (gapDetails.length) {
                        brain.progress.remaining = gapDetails;      // فجوات حقيقية بدل الخطة
                        brain.progress.works = fails.length === 0;  // fail = لا يعمل → لا نسبة مطمئنة
                    } else {
                        brain.progress.works = true;                // اجتاز التحقّق
                    }
                }
                brainContext = summarizeBrain(brain, userLang);
            }
        } catch { /* الشات يعمل حتى لو تعذّر بناء الصورة */ }

        // 🧠 معرفة المنصة الحيّة — قدرات ثابتة + حقائق المستخدم اللحظية
        // (الخطة، الاستهلاك، هل المشروع منشور ورابطه). لا يرمي أبداً.
        const platformKnowledge = await getPlatformKnowledge(username, project, userLang);

        const messages = [
            { role: "system", content: `You are JAOLA — the chat assistant of an AI web-building platform. (You are a TEXT chat assistant — never describe yourself as a "voice assistant" / "مساعد صوتي".)

CRITICAL LANGUAGE RULE: The user's language is "${userLang}" (${langInfo.label}). You MUST reply ONLY in this language for the entire conversation. Never switch languages even if the user writes a word in another language.

⛔ HARD BOUNDARIES — you are the CHAT voice, NOT the builder:
- You CANNOT build, edit, or write code yourself. A separate build system does that. NEVER role-play building ("let's start with the Navbar...") or announce work you cannot do.
- NEVER collect specs step-by-step (asking for site name, then menu items, then hero text...). The build system gathers everything itself from one request.
- NEVER invent progress numbers or remaining-parts lists. ONLY state what the Project Brain below explicitly says. If it shows files/sections, they EXIST — do not claim they are missing. If unsure, say you're not sure.
- NEVER fabricate a list of "changes applied" or files you edited. If asked what changed, cite ONLY edit history explicitly present in the Project Brain below; if none is listed, say you have no record of specific changes.
- Your own earlier replies in this conversation may contain MISTAKES. NEVER repeat a past claim (e.g. "I added api.js") unless the Project Brain below confirms it — the Project Brain ALWAYS overrides conversation history. If you previously claimed something the Brain doesn't show, admit the earlier reply was wrong.
- Do NOT append "type build [name]" (or similar) to every reply. Mention what to type ONLY when the user is actually asking to build, continue, or change something.
- NEVER tell the user to type the exact same words they just sent — that creates an infinite loop. If their message already describes a change, tell them to send it again once to confirm, or rephrase it starting with an action verb (e.g. "${userLang === 'ar' ? 'غيّر / اضف / نسّق' : 'change / add / format'}").
- When the user wants to build, continue, or change something: tell them in ONE sentence what to type — "${userLang === 'ar' ? 'اكمل' : 'continue'}" to resume the build, "${userLang === 'ar' ? 'ابني [وصف الموقع]' : 'build [site description]'}" for a new site, or simply describe the specific change (e.g. "${userLang === 'ar' ? 'غيّر الألوان إلى أزرق' : 'change the colors to blue'}") and the build system executes it directly.
- To DELETE the current project: the user types "${userLang === 'ar' ? 'احذف المشروع' : 'delete the project'}" and the system will ask for explicit confirmation. These are the ONLY commands that exist — NEVER invent or promise any other command or capability.
- RENAMING a project is NOT supported. If asked to rename, say so honestly and suggest creating a new project with the desired name from the projects list. NEVER promise "the project will be named X".

${platformKnowledge}

RESPONSE RULES:
- Keep replies SHORT: 1-3 sentences maximum
- Be direct and friendly
- Answer about the WHOLE project using the state below — not just the last message. If asked what's done or remaining, use ONLY it.
- The current project's NAME is "${project || 'sandbox_app'}" — if asked the project name, answer with it directly.

## Current project state (Project Brain — the ONLY source of truth; its "Remaining" and working-status come from the ACTUAL code, so report them verbatim — never invent a percentage or a different remaining list):
${brainContext || 'No project files yet.'}
${convSummary ? `\n## LONG-TERM CONVERSATION MEMORY (do not lose this context; never contradict earlier decisions or re-ask known facts):\n${convSummary}\n` : ''}
User preferences: ${JSON.stringify(execMemory)}` },
            ...history,
            { role: 'user', content: userMessage }
        ];
        // رسالة صادقة بدل "حدث خطأ" الغامضة — السبب الشائع هو ضغط حصة الذكاء (rate limit)
        let reply = userLang === 'ar'
            ? '⚠️ خدمة الذكاء مشغولة مؤقتاً (ضغط طلبات بعد البناء) — أعد إرسال رسالتك بعد ثوانٍ قليلة وسأنفذها فوراً.'
            : '⚠️ AI service is momentarily busy (rate limited after the build) — resend your message in a few seconds.';

        // محاولتان مع مهلة قصيرة — أغلب حالات rate limit تنجح في الثانية
        // 🔴 بثّ حيّ: الرد يظهر حرفاً-بحرف بدل دفعة واحدة (إحساس بالحياة)
        let streamed = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const stream = await groq.chat.completions.create({
                    messages,
                    model: "llama-3.3-70b-versatile",
                    max_tokens: 200,
                    temperature: 0.6,
                    stream: true,
                });
                this.io.to(roomName).emit('chat_stream_start', {});
                let acc = '';
                for await (const chunk of stream) {
                    const delta = chunk.choices?.[0]?.delta?.content || '';
                    if (delta) { acc += delta; this.io.to(roomName).emit('chat_stream_chunk', { delta }); }
                }
                if (acc.trim()) { reply = acc; streamed = true; }
                break;
            } catch (e) {
                console.error(`Chat error (attempt ${attempt}):`, e.message || e);
                this.emitLiveLog(roomName, 'CHAT', 'Groq', `⚠️ محاولة ${attempt}/2 فشلت: ${(e.message || '').slice(0, 120)}`);
                if (attempt < 2) await new Promise(r => setTimeout(r, 2500));
            }
        }
        // 🧠 نحفظ الدورة (ونطوي الملخّص) فقط عند نجاح الرد — لا نلوّث الذاكرة
        // برسائل خطأ الـ rate-limit. conversationStore يحفظ كامل الحوار دائماً.
        if (streamed) {
            await recordTurn(
                username, userMessage, reply,
                (prev, older) => this.summarizeConversation(prev, older, userLang)
            );
        }
        // أنهِ البثّ بالنسخة النهائية (يستبدل النص المتراكم ويثبّته)؛
        // وإن لم ينجح البثّ (rate limit) أرسل الرد دفعة واحدة كالمعتاد
        if (streamed) this.io.to(roomName).emit('chat_stream_end', { message: reply });
        else this.emitChatReply(roomName, reply);
        this.emitLiveLog(roomName, '💬 Assistant', 'Chat Reply', reply);
        return reply;
    }

    emitChatReply(roomName, replyMessage) {
        this.io.to(roomName).emit('chat_reply', { message: replyMessage });
    }

    // 🚦 كل المهام تمر عبر صف التنفيذ: لا توازي لنفس المشروع + حد توازٍ كلي
    // يحمي حصة الـ LLM — كل مواقع الاستدعاء تبقى كما هي
    executeMission(goal, projectPath, username, activeProject, roomName, agents, dbStatus) {
        const lang = getUserLanguage(username) || 'ar';
        const result = enqueueMission({
            username,
            project: activeProject,
            run: () => this._runMissionNow(goal, projectPath, username, activeProject, roomName, agents, dbStatus),
            onWait: (position) => {
                const msg = lang === 'ar'
                    ? `⏳ الفريق مشغول بمهمة أخرى — مهمتك في الصف (المركز ${position}) وستبدأ تلقائياً.`
                    : `⏳ The team is busy — your mission is queued (position ${position}) and will start automatically.`;
                this.io.to(roomName).emit('chat_reply', { message: msg });
            },
        });

        if (!result.accepted) {
            const busyMsg = lang === 'ar'
                ? '⚙️ يوجد بناء جارٍ لهذا المشروع بالفعل — تابع التقدم الحي أو اضغط ⏹ لإيقافه أولاً.'
                : '⚙️ A build is already running for this project — watch the progress or press ⏹ to stop it first.';
            this.io.to(roomName).emit('chat_reply', { message: busyMsg });
        }
        return result;
    }

    async _runMissionNow(goal, projectPath, username, activeProject, roomName, agents, dbStatus) {
        // 🆕 دمج Project Memory + User Profile في سياق الهدف
        const memoryContext = buildMemoryContext(username, activeProject);
        const profileContext = buildProfileContext(username);
        const enrichedGoal = (memoryContext || profileContext)
            ? `${goal}\n${memoryContext}${profileContext}`
            : goal;

        // 🧭 App Blueprint — يفهم نوع التطبيق ومكوّناته الوظيفية (أول وأهم خطوة)
        // يمنع تحويل كل شيء لبروشور ويضمن بناء ميزات عاملة (بحث/فلترة/حجز...)
        let blueprintContext = '';
        let blueprint = null;
        try {
            blueprint = await generateBlueprint(goal);
            blueprintContext = buildBlueprintContext(blueprint);
            const kindLabel = { webapp: 'تطبيق تفاعلي', tool: 'أداة', landing: 'صفحة هبوط', brochure: 'موقع تعريفي' }[blueprint.kind] || blueprint.kind;
            this.emitLiveLog(roomName, 'BLUEPRINT', 'AppAnalyzer',
                `🧭 ${blueprint.appType} — ${kindLabel}${blueprint.functionalComponents?.length ? ` (${blueprint.functionalComponents.length} مكوّن وظيفي)` : ''}`);

            // تحديث ذاكرة المشروع بأقسام المخطط الحقيقية — يمنع بقاء أقسام قديمة
            // خاطئة في تقرير التسليم (كانت تظهر أقسام طبية لمشروع طيران)
            if (blueprint.keySections?.length) {
                updateStructure(username, activeProject, blueprint.keySections,
                    (blueprint.functionalComponents || []).map(c => c.name));
            }
        } catch (e) { console.warn('[ProjectMemory]', 'فشل تحديث هيكل المشروع:', e.message); }

        // 🧩 نموذج المشروع (طبقة الفهم) — يستخلص كيانات + أدوار + تدفّقات،
        // يُدمج مع النموذج المحفوظ (فهم متراكم لا يُستبدل)، ويُحقن في التوليد
        // ليبني الفريق على نظام متماسك لا على تخمين. لا يفشل أبداً (احتياطي مفيد).
        let domainModelContext = '';
        try {
            // 📚 بذرة من مكتبة النماذج: فهم فئة المشروع المتراكم عبر كل المشاريع
            // السابقة الناجحة — فلا نبدأ من الصفر. الأولوية: المشروع نفسه > اشتقاق
            // هذه الجولة > مكتبة الفئة العامة.
            const seed = getLibraryModel(blueprint?.category);
            const derived = await deriveProjectModel(goal, blueprint);
            const prior = getDomainModel(username, activeProject);
            let model = seed ? mergeProjectModel(seed, derived) : derived;
            if (prior) model = mergeProjectModel(model, prior);
            setDomainModel(username, activeProject, model);
            domainModelContext = buildProjectModelContext(model);
            this.emitLiveLog(roomName, 'MODEL', 'DomainAnalyst',
                `🧩 نموذج المشروع: ${summarizeModel(model)}${seed ? ' (مبذور من مكتبة الفئة)' : ''}`);
        } catch (e) { console.warn('[ProjectModel]', 'فشل استخلاص نموذج المشروع:', e.message); }

        // 🍔 كلون عامل — للتطبيقات المعقّدة المطابقة نبدأ من *تطبيق يعمل فعلاً*
        // (يجتاز التحقّق السلوكي) بدل التوليد من الصفر الذي يفشل (app.js لا يُكتب،
        // أدوار ناقصة)، ثم نضع البصمة. هذا يضمن أن يعمل مشروع التوصيل من أول مرة.
        try {
            const existingCtx = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
            const isFreshBuild = !existingCtx || existingCtx.trim().length < 80;
            const explicitRebuild = /أعد البناء|اعد البناء|أعد بناء|اعد بناء|من جديد|من الصفر|rebuild|from scratch|start over|أعد التصميم|اعد التصميم/i.test(goal);
            const clone = matchCloneTemplate(goal, blueprint, getDomainModel(username, activeProject));
            if (clone) {
                // نبدأ من الكلون العامل إن: (أ) بناء جديد، أو (ب) إعادة بناء صريحة،
                // أو (ج) المشروع القائم معطّل فعلاً (نُصلح المكسور).
                let apply = isFreshBuild || explicitRebuild;
                let worksNow = false;
                if (!apply) {
                    const chk = await analyzeProjectStatic({
                        projectPath, domainModel: getDomainModel(username, activeProject),
                    });
                    const broken = !chk.hasProject || chk.checks.some(c => c.status === 'fail');
                    worksNow = chk.hasProject && !broken;
                    apply = broken;
                }
                if (apply) {
                    return await this._buildFromClone(clone, goal, projectPath, username, activeProject, roomName, agents);
                }
                // 🛡️ المشروع القائم يعمل وليس طلب إعادة بناء صريح → لا نُعيد البناء
                // الكامل (كان مسار Vanilla يدهس الكلون العامل عند «اكمل»). نُبلغ
                // ونتوقّف — التعديلات المحدّدة تمرّ عبر التعديل الجراحي.
                if (worksNow) {
                    const okMsg = getUserLanguage(username) === 'en'
                        ? '✅ Your app is already working (customer + staff panels with role-based login). Tell me a specific change to add (e.g. "add a ratings section"), or "rebuild" to start fresh.'
                        : '✅ تطبيقك يعمل بالفعل (واجهة الزبون + لوحات الطاقم بدخول موجَّه حسب الصلاحية). أخبرني بتعديل محدّد لإضافته (مثل: «أضف قسم تقييمات»)، أو اكتب «أعد البناء» للبدء من جديد.';
                    this.io.to(roomName).emit('chat_reply', { message: okMsg });
                    transitionState(username, activeProject, STATES.COMPLETED);
                    this.emitLiveLog(roomName, 'STACK', 'CloneTemplate', 'ℹ️ المشروع يعمل — تفادينا إعادة بناء تدهسه.');
                    return { success: true, skipped: 'works' };
                }
                this.emitLiveLog(roomName, 'STACK', 'CloneTemplate', 'ℹ️ يوجد كلون مطابق لكن المشروع القائم يعمل — لا نكلبره.');
            }
        } catch (e) { console.warn('[Clone]', 'تعذّر مطابقة الكلون:', e.message); }

        // 🧰 المسار الهجين — مشروع كبير → React/Next حقيقي بمعاينة حيّة؛ غيره → Vanilla سريع
        try {
            const ptype = blueprint?.category && blueprint.category !== 'other' ? blueprint.category : detectProjectType(goal);
            const scope = getProjectMemory(username, activeProject)?.plan?.scope || '';
            const stack = resolveStack({ projectType: ptype, scope });
            const starter = selectStarter({ projectType: ptype, scope });
            // فقط لبناء جديد (لا تعديل على مشروع قائم)
            const existingCtx = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
            const isFreshBuild = !existingCtx || existingCtx.trim().length < 80;
            if (stack === 'react-next' && isFreshBuild) {
                this.emitLiveLog(roomName, 'STACK', 'HybridRouter', `🧰 مشروع كبير → React/Next${starter ? ` (${starter.name})` : ''}`);
                return await this._buildReactProject(goal, projectPath, username, activeProject, roomName, {
                    sections: blueprint?.keySections || [], starter,
                });
            }
            this.emitLiveLog(roomName, 'STACK', 'HybridRouter', `🧰 مسار سريع → Vanilla${starter ? ` (قالب: ${starter.name})` : ''}`);
        } catch (e) { /* اختياري — نُكمل بالمسار الافتراضي */ }

        // 🆕 Smart Requirement Analyzer — يُثري الهدف بمتطلبات ضمنية
        let requirementsContext = '';
        let imageContext = '';
        try {
            // نوع المشروع من المخطط الذكي (أدق من كشف الكلمات المفتاحية) مع احتياط
            const projectType = blueprint?.category && blueprint.category !== 'other'
                ? blueprint.category
                : detectProjectType(goal);
            const reqAnalysis = await analyzeRequirements(goal, projectType);
            requirementsContext = buildRequirementsContext(reqAnalysis);

            // 🖼️ صور حقيقية مطابقة للموضوع تُحقن في سياق البناء
            const img = await buildImageContext(goal, projectType, activeProject);
            imageContext = img.context;
            this.emitLiveLog(roomName, 'ASSETS', 'ImageService', `🖼️ جُهزت ${img.count} صور (${img.source})`);
        } catch (e) { /* اختياري */ }

        // 🔌 وكلاء الإضافات: hook beforeBuild — يشاركون فعلياً في البناء
        // كل وكيل يُرجع نصاً يُحقن في سياق البناء (توجيهات، متطلبات إضافية...)
        let pluginContext = '';
        try {
            const hookResults = await orchestrator.runHook('beforeBuild', {
                goal, username, project: activeProject, projectPath, blueprint,
            });
            const guidance = hookResults
                .map(r => (typeof r.result === 'string' ? r.result : r.result?.guidance || r.result?.reply))
                .filter(Boolean);
            if (guidance.length) {
                pluginContext = `\n## 🔌 توجيهات وكلاء إضافيين (التزم بها):\n${guidance.map(g => `- ${g}`).join('\n')}`;
                this.emitLiveLog(roomName, 'PLUGINS', 'beforeBuild',
                    `🔌 شارك ${guidance.length} وكيل إضافي في التوجيه`);
            }
        } catch (e) { /* الإضافات اختيارية */ }

        const finalGoalWithRequirements = `${enrichedGoal}${blueprintContext}${domainModelContext}\n${requirementsContext}${imageContext}${pluginContext}`;

        // تسجيل هذا الطلب في تاريخ المشروع
        addToHistory(username, activeProject, goal.slice(0, 80));

        const context = new JCRContext(finalGoalWithRequirements || enrichedGoal, projectPath, username, activeProject);
        context.originalGoal = goal;
        context.blueprint = blueprint;   // متاح للـ template agent وباقي المراحل
        // 🔄 المهمة تبدأ بمرحلة المعمارية (نموذج العالم + المخطط + القرار) —
        // GENERATING تُعلن لاحقاً عند دخول حلقة كتابة الشفرة فعلاً
        transitionState(username, activeProject, STATES.ARCHITECTURE, { agent: 'Architect' });

        // ⏹️ تسجيل المهمة في سجل الإيقاف — تسمح للمستخدم بإيقافها من الواجهة
        registerMission(roomName);

        // 🧠 CEO Personality — إحاطة مهمة كاملة: تحليل + تعيين وكلاء + وقت متوقع
        const existingFiles = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
        const hasExistingProject = existingFiles && existingFiles.trim().length > 100;
        const userLangForMsg = getUserLanguage(username) || 'ar';

        this.io.to(roomName).emit('chat_reply', {
            message: missionBriefing({ lang: userLangForMsg, goal, hasExisting: hasExistingProject })
        });

        this.emitLiveLog(roomName, 'JCOS', 'Kernel', `🏁 بدء المهمة: ${context.missionId}`);
        try {
            await this.buildWorldModel(context, roomName, dbStatus);
            throwIfAborted(roomName);
            await this.buildMissionAndMeta(context, roomName);
            throwIfAborted(roomName);
            await this.runExecutiveBrain(context, roomName, agents);
            throwIfAborted(roomName);
            if (context.executiveDecision.actionType !== 'EXECUTE') {
                await this.runReflectionAndSelfImprovement(context, roomName, true);
                this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
                return { success: true };
            }

            let execResult;
            try {
                execResult = await this.runDynamicMultiAgentRuntime(context, roomName, agents);
            } catch (runtimeError) {
                if (runtimeError.aborted) throw runtimeError; // الإيقاف ليس فشلاً — يُعالج في الأسفل
                // الحالة تتحول FAILED فوراً — كانت تبقى GENERATING فيُحجب المستخدم
                // بقفل "مهمة تعمل" حتى ينقذه مؤقت العشر دقائق
                transitionState(username, activeProject, STATES.FAILED, { error: runtimeError.message });
                this.emitAgentError(roomName, 'coder');
                await this.runReflectionAndSelfImprovement(context, roomName, false);
                this.emitLiveLog(roomName, 'JCOS', 'Kernel', `❌ فشل نهائياً: ${runtimeError.message}`);
                return { success: false, error: runtimeError.message };
            }

            if (execResult.success) {
                this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
                this.runCuriosityInBackground(context, roomName);
                if (context.images?.length) {
                    await Promise.all(context.images.map(img => generateAIImage(img.prompt, projectPath, img.fileName)));
                }
            }

            await this.runReflectionAndSelfImprovement(context, roomName, execResult.success);
            if (execResult.success) {
                transitionState(username, activeProject, STATES.COMPLETED);
                const langMsg = getUserLanguage(username) || 'ar';

                // 9️⃣ تقرير التسليم التنفيذي — ماذا أُنجز بالضبط
                let builtFiles = [];
                try {
                    builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules');
                } catch (e) {}
                const durationSec = getProjectSummary(username, activeProject).duration || 0;
                const durText = durationSec >= 60
                    ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')} د`
                    : `${durationSec} ث`;
                const memSections = getProjectMemory(username, activeProject)?.structure?.sections || [];

                const reportLines = langMsg === 'ar'
                    ? [
                        '✅ اكتملت المهمة — تقرير التسليم:',
                        `⏱️ مدة التنفيذ: ${durText}`,
                        builtFiles.length ? `📁 الملفات (${builtFiles.length}): ${builtFiles.slice(0, 8).join('، ')}` : null,
                        memSections.length ? `🧱 الأقسام: ${memSections.join('، ')}` : null,
                        '',
                        '🖥️ المعاينة الحية تحدّثت وفُتحت تلقائياً — راجعها الآن.',
                        'ما الخطوة التالية؟',
                    ].filter(Boolean)
                    : [
                        '✅ Mission complete — Delivery report:',
                        `⏱️ Duration: ${durText}`,
                        builtFiles.length ? `📁 Files (${builtFiles.length}): ${builtFiles.slice(0, 8).join(', ')}` : null,
                        memSections.length ? `🧱 Sections: ${memSections.join(', ')}` : null,
                        '',
                        '🖥️ Live preview updated and opened automatically.',
                        'What is the next step?',
                    ].filter(Boolean);

                // 🔟 اقتراحات استباقية — أزرار الخطوة التالية داخل الشات
                const suggestions = langMsg === 'ar'
                    ? ['🚀 انشر الآن', '🐙 ادفع إلى GitHub', '📊 أين وصلنا']
                    : ['🚀 Deploy now', '🐙 Push to GitHub', '📊 Status'];

                this.io.to(roomName).emit('chat_reply', {
                    message: reportLines.join('\n'),
                    options: suggestions,
                });

                // 🛠️ تحديث قائمة الملفات في الواجهة بعد البناء (كانت تبقى فارغة)
                this.io.to(roomName).emit('workspace_files', builtFiles);

                // 🐙 الدفع التلقائي لـ GitHub إذا كان مفعلاً لهذا المشروع
                autoPushIfEnabled(username, activeProject, projectPath, this.io, roomName).catch(() => {});

                // 🗄️ لقطة دائمة لملفات المشروع في MongoDB — تنجو من إعادة نشر Render
                snapshotWorkspace(username, activeProject, projectPath)
                    .then(r => { if (r.success) this.emitLiveLog(roomName, 'STORAGE', 'Snapshot', `🗄️ حُفظت نسخة دائمة (${r.count} ملف)`); })
                    .catch(() => {});

                // 📊 تسجيل البناء + بث المقاييس الحقيقية للوحة الذكاء
                recordBuild(username, activeProject, {
                    success: true, durationSec, filesCount: builtFiles.length, goal: goal || '',
                });
                this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));

                // 🔌 وكلاء الإضافات: hook afterBuild — تنفيذ ما بعد البناء
                orchestrator.runHook('afterBuild', {
                    success: true, goal, username, project: activeProject, projectPath, files: builtFiles,
                }).catch(() => {});
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
                this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));
            }
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', execResult.success ? '✨ نجاح' : '❌ فشل');
            return execResult;
        } catch (error) {
            // ⏹️ إيقاف بطلب المستخدم — ليس فشلاً
            if (error.aborted) {
                transitionState(username, activeProject, STATES.PAUSED);
                this.io.to(roomName).emit('agent_states', {
                    planner: 'waiting', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting'
                });
                const langAbort = getUserLanguage(username) || 'ar';
                const abortMsg = langAbort === 'ar'
                    ? '⏹️ تم إيقاف المهمة بناءً على طلبك.\nأخبرني بما تريد فعله الآن.'
                    : '⏹️ Mission stopped at your request.\nTell me what you want to do next.';
                this.io.to(roomName).emit('chat_reply', { message: abortMsg });
                this.emitLiveLog(roomName, 'JCOS', 'Kernel', '⏹️ المهمة أُوقفت من قبل المستخدم');
                return { success: false, aborted: true };
            }
            this.emitAgentError(roomName, 'planner');
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', `❌ تعطلت المهمة: ${error.message}`);
            await this.runReflectionAndSelfImprovement(context, roomName, false);
            return { success: false, error: error.message };
        } finally {
            clearMission(roomName);
            // 🛠️ إنهاء بث الكود دائماً (نجاح/فشل/إيقاف) — بدونها تبقى طبقة
            // "يكتب الكود الآن" تغطي المعاينة للأبد عند أي فشل أو إيقاف
            this.io.to(roomName).emit('stream_done', { timestamp: Date.now() });
        }
    }

    async readCurrentCodeContextAsync(projectPath) {
        let context = "";
        try {
            const files = await fsPromises.readdir(projectPath);
            const relevant = files.filter(f => ['index.html', 'styles.css', 'script.js'].includes(f));
            const contents = await Promise.all(relevant.map(async f => ({
                name: f, content: await fsPromises.readFile(path.join(projectPath, f), 'utf-8')
            })));
            contents.forEach(f => { context += `\n--- ${f.name} ---\n${f.content}\n`; });
        } catch (e) {}
        return context;
    }

    /** يقرأ الملفات الأساسية كمصفوفة {name, content} للتعديل الجراحي */
    // 🔬 التحقّق السلوكي + جولة إصلاح تلقائية — مشتركة بين البناء والتعديل.
    // نُشغّل الصفحة فعلاً؛ إن كُشفت ثغرة (خطأ JS/زر ميت/دور بلا واجهة) وأُتيح
    // الإصلاح، نبني تعليمة مستهدفة ونُصلح ونُعيد التحقّق. جولة واحدة (لا حلقة).
    async _verifyAndAutofix({ projectPath, blueprint = null, username, activeProject, roomName, agents, lang = 'ar', canFix = true }) {
        try {
            const domainModel = getDomainModel(username, activeProject);
            const emitVerdict = (v, note = '') => {
                const gaps = v.checks.filter(c => c.status !== 'pass')
                    .map(c => `${c.status === 'fail' ? '❌' : '⚠️'} ${c.detail}`);
                this.emitLiveLog(roomName, '6. VERIFY', 'BehaviorVerifier',
                    v.ok
                        ? `🔬 التحقّق السلوكي: يعمل (${v.summary})${note}${gaps.length ? '\n' + gaps.join('\n') : ''}`
                        : `🔬 ثغرات سلوكية (${v.summary})${note} — لم يُعلَن النجاح أجوفاً:\n${gaps.join('\n')}`);
            };

            let verdict = await verifyBehavior({ projectPath, blueprint, domainModel });
            if (!verdict.ran || verdict.skipped) return verdict;
            emitVerdict(verdict);

            if (!verdict.ok && canFix && agents?.coreEditCodePlan) {
                const instruction = buildBehaviorFixInstruction(verdict, domainModel);
                if (instruction) {
                    this.emitLiveLog(roomName, '6. VERIFY', 'BehaviorVerifier', '🔧 جولة إصلاح سلوكية مستهدفة...');
                    const files = await this.readProjectFilesArray(projectPath);
                    const fixPlan = await agents.coreEditCodePlan(instruction, files, lang);
                    if (fixPlan?.files?.length && !fixPlan.error) {
                        const emitG = (m) => this.emitLiveLog(roomName, '6. VERIFY', 'CodeGuard', m);
                        const guarded = await ensureEditIntegrity(
                            await guardFiles(scrubPlaceholders(fixPlan.files, activeProject), emitG),
                            projectPath, emitG);
                        await writePlanFiles(projectPath, guarded);
                        verdict = await verifyBehavior({ projectPath, blueprint, domainModel });
                        emitVerdict(verdict, verdict.ok ? ' (أُصلح تلقائياً)' : ' (بعد الإصلاح — يحتاج مراجعتك)');
                    }
                }
            }
            return verdict;
        } catch (e) { console.warn('[BehaviorVerify]', 'تعذّر التحقّق السلوكي:', e.message); return null; }
    }

    // 🚪 ردّ حتمي عند حجب رسالة غامضة — لا يطلب "إعادة إرسال نفس الجملة"
    // (كان الـ LLM يهلوس ذلك فيدخل حلقة لا تنتهي). أي رسالة تالية ستُنفَّذ.
    gateConfirmReply(lang) {
        return lang === 'ar'
            ? '📝 لو كنت تقصد تعديلاً على المشروع، أكّد بإرسال «نعم» أو أعد صياغة طلبك كأمر — وسأطبّقه فوراً. ولو كان سؤالاً، اسألني مباشرة.'
            : '📝 If you meant a change to the project, confirm by sending "yes" or rephrase it as a command — I\'ll apply it right away. If it was a question, just ask.';
    }

    // ملفات الواجهة للتعديل/الإصلاح: index.html + كل CSS + سكربتات الواجهة
    // التي يشير إليها index.html فعلاً (لا server.js). كان مثبّتاً على
    // "script.js" فقط، فمشروع يستخدم app.js كان *أعمى* للتعديل والإصلاح.
    async readProjectFilesArray(projectPath) {
        try {
            const out = [];
            const files = await fsPromises.readdir(projectPath);
            // كل ملفات CSS (سياق التنسيق للتعديل)
            for (const f of files) {
                if (/\.css$/i.test(f)) {
                    out.push({ name: f, content: await fsPromises.readFile(path.join(projectPath, f), 'utf-8') });
                }
            }
            // index.html + السكربتات التي تُحمّلها الصفحة (نفس تحديد المُتحقّق)
            const page = await readPageCode(projectPath);
            if (page) {
                out.push({ name: 'index.html', content: page.html });
                for (const [name, content] of Object.entries(page.assets)) {
                    if (!out.some(x => x.name === name)) out.push({ name, content });
                }
            }
            // احتياط: script.js موجود لكن لم يشِر إليه index.html
            if (files.includes('script.js') && !out.some(x => x.name === 'script.js')) {
                out.push({ name: 'script.js', content: await fsPromises.readFile(path.join(projectPath, 'script.js'), 'utf-8') });
            }
            return out;
        } catch { return []; }
    }

    // ✂️ التعديل الجراحي — يمرّ عبر صف التنفيذ كالبناء (حماية التوازي)
    surgicalEdit(instruction, projectPath, username, activeProject, roomName, agents, dbStatus) {
        const lang = getUserLanguage(username) || 'ar';
        const result = enqueueMission({
            username, project: activeProject,
            run: () => this._runSurgicalEditNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus),
            onWait: (position) => this.io.to(roomName).emit('chat_reply', {
                message: lang === 'ar' ? `⏳ مهمتك في الصف (المركز ${position}).` : `⏳ Queued (position ${position}).`,
            }),
        });
        if (!result.accepted) {
            this.io.to(roomName).emit('chat_reply', {
                message: lang === 'ar' ? '⚙️ يوجد عمل جارٍ لهذا المشروع — انتظر أو اضغط ⏹.' : '⚙️ A task is already running — wait or press ⏹.',
            });
        }
        return result;
    }

    // يستخرج اسم الصفحة من أمر "أضف صفحة …" (عربي/إنجليزي)
    _extractPageName(instruction, lang) {
        let s = String(instruction || '').trim();
        s = s.replace(/^[^\p{L}]+/u, '');   // أزل الرموز/الإيموجي في البداية (زر "➕ أضف صفحة")
        s = s.replace(/^\s*(?:من فضلك|رجاء[ًا]?|please)\s+/i, '');
        s = s.replace(/^\s*(?:أضف|اضف|أضِف|ضيف|زد|أنشئ|انشئ|اضافة|إضافة|add|create|make)\s+/i, '');
        s = s.replace(/^\s*(?:لي|me)\s+/i, '');
        s = s.replace(/^\s*(?:a|an)\s+/i, '');
        s = s.replace(/^\s*(?:جديدة|جديد|new)\s+/i, '');
        s = s.replace(/^\s*(?:صفحة|صفحه|page)\s+/i, '');
        s = s.replace(/^\s*(?:جديدة|جديد|new)\s+/i, '');
        s = s.replace(/^\s*(?:اسمها|بعنوان|باسم|تسمى|عنوانها|بـ|called|named|titled|about|for)\s+/i, '');
        s = s.replace(/["'«»]/g, '').replace(/[.،,!?]+$/g, '').trim();
        // بقايا من كلمات دالّة فقط (زر "أضف صفحة" بلا اسم) → افتراضي
        s = s.replace(/^(?:صفحة|صفحه|page|جديدة|جديد|new)(?:\s+(?:صفحة|صفحه|page|جديدة|جديد|new))*$/i, '').trim();
        if (!s || s.length > 60) return lang === 'ar' ? 'صفحة جديدة' : 'New Page';
        return s;
    }

    // ➕ يضيف صفحة جديدة لمشروع React قائم دون إعادة بناء — يحفظ المحتوى الحالي:
    //    قسم + وجهة في lib/content.js، مكوّن، صفحة Next، ثم إعادة توليد الموقع الثابت.
    async _addPageNow(instruction, projectPath, username, activeProject, roomName, lang) {
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
        this.emitLiveLog(roomName, 'EDIT', 'AddPage', '➕ إضافة صفحة جديدة (بلا إعادة بناء)...');

        // اقرأ المحتوى الحالي (lib/content.js: export const content = {...})
        let content;
        try {
            const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
            content = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
        } catch (e) {
            this.emitLiveLog(roomName, 'EDIT', 'AddPage', `⚠️ تعذّر قراءة المحتوى — عودة للبناء: ${e.message}`);
            return this._runMissionNow(instruction, projectPath, username, activeProject, roomName, {}, null);
        }

        const pageLabel = this._extractPageName(instruction, lang);

        // اسم مكوّن + مسار (slug) فريدان
        const existingComps = new Set(Object.keys(content.sections || {}));
        const existingSlugs = new Set((content.routes || []).map(r => (r.href || '').replace(/^\//, '')));
        let n = existingComps.size + 1;
        let comp = compName(pageLabel, n);
        while (existingComps.has(comp)) comp = compName(pageLabel, ++n);
        let slug = slugify(comp), k = 1;
        while (existingSlugs.has(slug) || slug === '' ) { slug = slugify(comp) + '-' + (++k); }

        // محتوى الصفحة: قالبي افتراضياً، ويخصّصه الذكاء بمحتوى واقعي (best-effort)
        let section = defaultSection(pageLabel, lang);
        try {
            this.emitLiveLog(roomName, 'EDIT', 'ContentWriter', '✍️ تخصيص محتوى الصفحة بالذكاء...');
            const model = await generateSectionContent(pageLabel, {
                brand: content.brand || activeProject,
                goal: content.hero?.title || content.hero?.subtitle || '',
                lang, llm: (m, o) => smartChat(m, o),
            });
            if (model) section = {
                heading: model.heading || section.heading,
                subheading: model.subheading || section.subheading,
                items: (model.items && model.items.length) ? model.items : section.items,
            };
        } catch { /* الافتراضي */ }

        // حدّث المحتوى: قسم جديد + وجهة تنقّل
        content.sections = content.sections || {};
        content.sections[comp] = section;
        content.routes = content.routes || [{ label: lang === 'ar' ? 'الرئيسية' : 'Home', href: '/' }];
        content.routes.push({ label: pageLabel, href: '/' + slug });

        // اكتب: content.js + مكوّن القسم + صفحة Next
        await fsPromises.writeFile(path.join(projectPath, 'lib/content.js'),
            `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(content, null, 2)};\n`);
        await fsPromises.writeFile(path.join(projectPath, `components/${comp}.jsx`), componentSource(comp, lang));
        await fsPromises.mkdir(path.join(projectPath, `app/${slug}`), { recursive: true });
        const hasNav = fs.existsSync(path.join(projectPath, 'components/Navbar.jsx'));
        const hasFooter = fs.existsSync(path.join(projectPath, 'components/Footer.jsx'));
        const body = [hasNav ? 'Navbar' : null, comp, hasFooter ? 'Footer' : null].filter(Boolean);
        await fsPromises.writeFile(path.join(projectPath, `app/${slug}/page.jsx`), pageFileSource('/' + slug, `${comp}Page`, body, 2));

        // أعِد توليد الموقع الثابت كله (الصفحة الجديدة + الشريط المحدَّث في كل صفحة)
        for (const pg of buildStaticSite(content, lang)) {
            await fsPromises.writeFile(path.join(projectPath, pg.name), pg.content);
        }

        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        addToHistory(username, activeProject, `إضافة صفحة: ${pageLabel}`);
        recordEdit(username, instruction);
        recordEditAction(username, activeProject); // عدّاد تعديلات اللوحة

        this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));
        let builtFiles = [];
        try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
        this.io.to(roomName).emit('workspace_files', builtFiles);
        snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
        autoPushIfEnabled(username, activeProject, projectPath, this.io, roomName).catch(() => {});

        const msg = lang === 'ar'
            ? `✅ أضفت صفحة **${pageLabel}** (\`${slug}.html\`) وربطتها بشريط التنقّل في كل الصفحات — المعاينة تحدّثت. اضغط رابطها لفتحها.`
            : `✅ Added page **${pageLabel}** (\`${slug}.html\`), linked in the nav across all pages — preview updated. Click its link to open it.`;
        this.io.to(roomName).emit('chat_reply', {
            message: msg,
            options: lang === 'ar' ? ['➕ أضف صفحة أخرى', '✏️ عدّل محتواها', '🚀 انشر الآن'] : ['➕ Add another page', '✏️ Edit its content', '🚀 Deploy now'],
        });
        return { success: true, addedPage: slug, label: pageLabel };
    }

    // ينظّف اسم صفحة ملتقَط من أمر (يزيل الاقتباس/الترقيم/كلمة صفحة الزائدة)
    _cleanPageName(s) {
        return String(s || '')
            .replace(/["'«»]/g, '')
            .replace(/^\s*(?:صفحة|صفحه|the|page)\s+/i, '')
            .replace(/[.،,!?\s]+$/g, '')
            .trim();
    }

    // يقرأ محتوى مشروع React من القرص (أو null)
    async _readReactContent(projectPath) {
        try {
            const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
            return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
        } catch { return null; }
    }

    // يجد صفحة بالاسم (تطابق تسمية الوجهة، ثم تضمين، ثم المسار)
    _findPage(content, name) {
        const t = String(name || '').trim().toLowerCase();
        const routes = (content.routes || []).filter(r => r.href !== '/');
        const compBySlug = {};
        for (const c of Object.keys(content.sections || {})) compBySlug[slugify(c)] = c;
        const route = routes.find(r => (r.label || '').trim().toLowerCase() === t)
            || routes.find(r => (r.label || '').trim().toLowerCase().includes(t) && t.length >= 2)
            || routes.find(r => r.href.replace(/^\//, '') === slugify(t));
        if (!route) return null;
        const slug = route.href.replace(/^\//, '');
        return { route, slug, comp: compBySlug[slug] };
    }

    // كتابة المحتوى + إعادة توليد الموقع الثابت + بثّ التحديث (مشترك لعمليات الصفحات)
    async _persistReactContent(projectPath, content, username, activeProject, roomName, lang, historyMsg) {
        await fsPromises.writeFile(path.join(projectPath, 'lib/content.js'),
            `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(content, null, 2)};\n`);
        for (const pg of buildStaticSite(content, lang)) {
            await fsPromises.writeFile(path.join(projectPath, pg.name), pg.content);
        }
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        addToHistory(username, activeProject, historyMsg);
        this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        let builtFiles = [];
        try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
        this.io.to(roomName).emit('workspace_files', builtFiles);
        snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
        autoPushIfEnabled(username, activeProject, projectPath, this.io, roomName).catch(() => {});
    }

    // 🖊️ إعادة تسمية صفحة (تسمية الوجهة + عنوان القسم) — تحفظ المسار والملفات
    async _renamePageNow(projectPath, username, activeProject, roomName, lang, oldName, newName) {
        const content = await this._readReactContent(projectPath);
        if (!content) return this.io.to(roomName).emit('chat_reply', { message: lang === 'ar' ? '⚠️ تعذّر قراءة المشروع.' : '⚠️ Could not read project.' });
        const found = this._findPage(content, oldName);
        if (!found || !found.comp) return this._pageNotFound(content, roomName, lang, oldName);
        found.route.label = newName;
        if (content.sections[found.comp]) content.sections[found.comp].heading = newName;
        await this._persistReactContent(projectPath, content, username, activeProject, roomName, lang, `إعادة تسمية صفحة: ${oldName} → ${newName}`);
        this.io.to(roomName).emit('chat_reply', {
            message: lang === 'ar' ? `✅ أعدت تسمية الصفحة إلى **${newName}** — حُدِّث الشريط في كل الصفحات.` : `✅ Renamed the page to **${newName}** — nav updated across all pages.`,
            options: lang === 'ar' ? ['➕ أضف صفحة', '🚀 انشر الآن'] : ['➕ Add a page', '🚀 Deploy now'],
        });
        return { success: true, renamed: found.slug, label: newName };
    }

    // 🗑️ حذف صفحة (الوجهة + القسم + الملفات) — لا يمكن حذف الرئيسية
    async _deletePageNow(projectPath, username, activeProject, roomName, lang, name) {
        const content = await this._readReactContent(projectPath);
        if (!content) return this.io.to(roomName).emit('chat_reply', { message: lang === 'ar' ? '⚠️ تعذّر قراءة المشروع.' : '⚠️ Could not read project.' });
        const found = this._findPage(content, name);
        if (!found || !found.comp) return this._pageNotFound(content, roomName, lang, name);
        // احذف من المحتوى
        content.routes = (content.routes || []).filter(r => r.href !== found.route.href);
        delete content.sections[found.comp];
        // احذف الملفات (المكوّن + صفحة Next + صفحة المعاينة)
        await fsPromises.rm(path.join(projectPath, `components/${found.comp}.jsx`), { force: true });
        await fsPromises.rm(path.join(projectPath, `app/${found.slug}`), { recursive: true, force: true });
        await fsPromises.rm(path.join(projectPath, `${found.slug}.html`), { force: true });
        await this._persistReactContent(projectPath, content, username, activeProject, roomName, lang, `حذف صفحة: ${found.route.label}`);
        this.io.to(roomName).emit('chat_reply', {
            message: lang === 'ar' ? `✅ حذفت صفحة **${found.route.label}** وأزلتها من شريط التنقّل — المعاينة تحدّثت.` : `✅ Deleted page **${found.route.label}** and removed it from the nav — preview updated.`,
            options: lang === 'ar' ? ['➕ أضف صفحة', '🚀 انشر الآن'] : ['➕ Add a page', '🚀 Deploy now'],
        });
        return { success: true, deleted: found.slug };
    }

    _pageNotFound(content, roomName, lang, name) {
        const names = (content.routes || []).filter(r => r.href !== '/').map(r => r.label).join('، ');
        this.io.to(roomName).emit('chat_reply', {
            message: lang === 'ar'
                ? `⚠️ لم أجد صفحة باسم «${name}». الصفحات الحالية: ${names || '—'}`
                : `⚠️ No page named "${name}". Current pages: ${names || '—'}`,
        });
        return { success: false, notFound: name };
    }

    async _runSurgicalEditNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus) {
        const lang = getUserLanguage(username) || 'ar';
        const files = await this.readProjectFilesArray(projectPath);

        // مشروع React؟ (يحوي lib/content.js أو app/page.jsx)
        const isReact = files.some(f => f.name === 'lib/content.js' || f.name === 'app/page.jsx');

        // 🗂️ عمليات الصفحات لمشروع React (تزايدية، تحفظ باقي المحتوى) — قبل فحص
        // "التغيير الكبير" (الذي يلتقط "صفحة/صفحات" ويعيد البناء بالكامل).
        if (isReact) {
            // إعادة تسمية: "أعد تسمية صفحة X إلى Y" / "rename page X to Y"
            const ren = instruction.match(/(?:أعد\s*تسمية|اعد\s*تسمية|غيّر\s*اسم|غير\s*اسم|rename)\s+(?:صفحة|صفحه|page\s+)?(.+?)\s+(?:إلى|الى|to)\s+(.+)/i);
            if (ren) return this._renamePageNow(projectPath, username, activeProject, roomName, lang, this._cleanPageName(ren[1]), this._cleanPageName(ren[2]));
            // حذف: "احذف صفحة X" / "delete page X"
            const del = instruction.match(/(?:احذف|امسح|إحذف|delete|remove)\s+(?:صفحة|صفحه|page)\s+(.+)/i);
            if (del) return this._deletePageNow(projectPath, username, activeProject, roomName, lang, this._cleanPageName(del[1]));
            // إضافة: "أضف صفحة …"
            const wantsAddPage = /(?:أضف|اضف|أضِف|ضيف|زد|أنشئ|انشئ|اضافة|إضافة)\s+(?:لي\s+)?(?:صفحة|صفحه)|صفحة\s*جديدة|add\s+(?:a\s+|an\s+)?page|new\s+page|create\s+(?:a\s+)?page/i.test(instruction);
            if (wantsAddPage) return this._addPageNow(instruction, projectPath, username, activeProject, roomName, lang);
        }

        // لا مشروع قائم، أو تعديل كبير (إعادة تصميم/بناء) → البناء الكامل بدل الجراحي
        // أوامر البناء الصريحة ("ابنِ تطبيق...") تعني بناءً كاملاً لا تعديلاً
        // جراحياً على المشروع الحالي — منعاً لتشويه مشروع بنمط مختلف تماماً.
        // إعادة بناء كاملة فقط لطلب صريح — لا لمجرّد ذكر «صفحات» (كان تحسينٌ
        // على تطبيق يعمل «فعّل الخدمات مع صفحات خاصة» يُعيد البناء من الصفر
        // فيدهس الكلون العامل). إضافة الصفحات/الميزات تبقى تعديلاً جراحياً.
        const bigChange = /أعد التصميم|اعد التصميم|أعد البناء|اعد البناء|أعد بناء|اعد بناء|من جديد|من الصفر|ابنِ?\s|ابن\s|أبنِ?\s|تطبيق\s+جديد|موقع\s+جديد|redesign|rebuild|from scratch|start over/i.test(instruction);
        if (files.length === 0 || bigChange || !agents.coreEditCodePlan) {
            return this._runMissionNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus);
        }

        // نوجّه التعديل للمصدر (lib/content.js، المكوّنات) لا لصفحات HTML المولّدة
        // (index.html/*.html) — فتلك نُعيد توليدها من المحتوى بعد التعديل.
        const editFiles = isReact ? files.filter(f => !/^[^/]+\.html$/.test(f.name)) : files;

        this.emitLiveLog(roomName, 'EDIT', 'SurgicalEditor', '✂️ تعديل دقيق (لا إعادة بناء كاملة)...');
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });

        // 🧩 نحقن نموذج المشروع في التعديل — يبقى التعديل متماسكاً مع كيانات
        // وأدوار وتدفّقات النظام (لا رقعة نصّية معزولة تكسر التماسك).
        const editModelCtx = buildProjectModelContext(getDomainModel(username, activeProject));

        // 🔒 عقد الحفظ — التعديلات ليست تراكمية بطبيعتها: «أضف 3 مطاعم» أعاد
        // كتابة app.js فحذف التفاصيل المالية السابقة (سجل المستخدم). نُلزم
        // المولّد بقائمة الدوال/الميزات الحالية: احتفظ بها كلّها، أضِف فقط المطلوب.
        const currentJs = editFiles.filter(f => /\.(m?js)$/i.test(f.name)).map(f => f.content).join('\n');
        const existingFns = [...extractDefinedFunctions(currentJs)].filter(n => n.length > 2);
        const preserveCtx = existingFns.length
            ? `\n\n🔒 عقد الحفظ (إلزامي): الكود الحالي يعرّف هذه الدوال/الميزات — **احتفظ بها جميعاً كاملةً** ولا تحذف ولا تُبسّط أياً منها (خاصةً الميزات المُضافة سابقاً كالتقارير المالية). أضِف المطلوب فوقها، وأعِد الملف **كاملاً** بكل دواله السابقة + الإضافة الجديدة:\n${existingFns.join('، ')}`
            : '';

        const editInstruction = `${instruction}${editModelCtx || ''}${preserveCtx}`;

        let plan;
        try {
            plan = await agents.coreEditCodePlan(editInstruction, editFiles, lang,
                (chunk) => this.io.to(roomName).emit('code_stream_chunk', chunk));
        } catch (e) {
            this.emitLiveLog(roomName, 'EDIT', 'SurgicalEditor', `⚠️ تعذّر — عودة للبناء الكامل: ${e.message}`);
            this.io.to(roomName).emit('stream_done', {});
            return this._runMissionNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus);
        }
        this.io.to(roomName).emit('stream_done', {});

        // فشل الجراحي → عودة آمنة للبناء الكامل
        if (!plan || plan.error || !plan.files?.length) {
            this.emitLiveLog(roomName, 'EDIT', 'SurgicalEditor', '⚠️ بلا نتيجة — عودة للبناء الكامل');
            return this._runMissionNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus);
        }

        // فحص الملفات المتغيّرة عبر CodeGuard ثم كتابتها فقط
        // (مع تنظيف أي placeholder قوالب تسرّب أثناء التعديل).
        // ensureEditIntegrity قبل الكتابة حتماً — يقارن بالنسخة السابقة على
        // القرص ويعيد ما أسقطه التعديل (رابط التنسيق، DOCTYPE، السكربتات).
        const emitGuard = (m) => this.emitLiveLog(roomName, 'EDIT', 'CodeGuard', m);
        const guarded = await ensureEditIntegrity(
            await guardFiles(scrubPlaceholders(plan.files, activeProject), emitGuard),
            projectPath, emitGuard);
        for (const file of guarded) {
            await fsPromises.writeFile(path.join(projectPath, file.name), file.content);
        }

        // React: أعِد توليد صفحات المعاينة الثابتة من المحتوى المحدَّث — فينعكس
        // التعديل على كل الصفحات (لا على index وحده).
        if (isReact) {
            try {
                const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
                for (const pg of buildStaticSiteFromSource(src, lang)) {
                    await fsPromises.writeFile(path.join(projectPath, pg.name), pg.content);
                }
            } catch (e) { this.emitLiveLog(roomName, 'EDIT', 'Preview', `⚠️ تعذّر تحديث المعاينة: ${e.message}`); }
        }
        // 🔬 تحقّق سلوكي بعد التعديل — يمسك إن كسر التعديل تشغيل الصفحة أو
        // ترك دوراً بلا واجهة، ويُصلح جولةً واحدة قبل إعلان النجاح.
        try {
            await this._verifyAndAutofix({
                projectPath, blueprint: null, username, activeProject, roomName, agents, lang, canFix: true,
            });
        } catch (e) { console.warn('[BehaviorVerify]', 'تخطّي التحقّق بعد التعديل:', e.message); }

        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });

        const changedNames = guarded.map(f => f.name).join('، ');
        recordEdit(username, instruction);
        recordEditAction(username, activeProject); // عدّاد تعديلات اللوحة — كان لا يُستدعى أبداً
        addToHistory(username, activeProject, `تعديل: ${instruction.slice(0, 60)}`);

        // تحديث المعاينة + قائمة الملفات + لقطة دائمة
        this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));
        let builtFiles = [];
        try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
        this.io.to(roomName).emit('workspace_files', builtFiles);
        snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
        autoPushIfEnabled(username, activeProject, projectPath, this.io, roomName).catch(() => {});

        const msg = lang === 'ar'
            ? `✅ طبّقت التعديل على: **${changedNames}** فقط (بلا إعادة بناء الموقع) — المعاينة تحدّثت.`
            : `✅ Applied the change to **${changedNames}** only (no full rebuild) — preview updated.`;
        this.io.to(roomName).emit('chat_reply', { message: msg, options: lang === 'ar' ? ['🚀 انشر الآن', '📊 أين وصلنا'] : ['🚀 Deploy now', '📊 Status'] });
        return { success: true, edited: guarded.map(f => f.name) };
    }

    // 🍔 بناء من كلون عامل — يكتب تطبيقاً يعمل فعلاً، يضع البصمة (تخصيص محتوى
    // آمن مع تراجع عند الكسر)، يتحقّق سلوكياً، ويُنهي كبناءٍ ناجح.
    async _buildFromClone(clone, goal, projectPath, username, activeProject, roomName, agents) {
        const lang = getUserLanguage(username) || 'ar';
        const t0 = Date.now();
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
        this.emitLiveLog(roomName, '5. RUNTIME', 'CloneTemplate', `🍔 كلون عامل: ${clone.name} — نبدأ من تطبيق يعمل فعلاً (لا توليد من الصفر)`);

        // 1) اكتب ملفات الكلون العامل
        for (const f of clone.files) {
            await fsPromises.writeFile(path.join(projectPath, f.name), f.content);
        }
        // احفظ نموذج الكلون (يُدمج + يُغني المكتبة)
        const model = mergeProjectModel(getDomainModel(username, activeProject) || {}, clone.model);
        setDomainModel(username, activeProject, model);

        // 2) البصمة — تخصيص المحتوى/العلامة فقط، مع تراجع آمن إن كسر التطبيق
        if (agents?.coreEditCodePlan) {
            try {
                this.emitLiveLog(roomName, '5. RUNTIME', 'CloneTemplate', '🎨 وضع البصمة — تخصيص المحتوى ليطابق طلبك...');
                const baseFiles = clone.files.map(f => ({ name: f.name, content: f.content }));
                const instruction = `خصّص *المحتوى والعلامة التجارية فقط* ليطابق: "${goal}". يمكنك تغيير: اسم التطبيق/العلامة، أسماء المطاعم وأصنافها وأسعارها، النصوص، ولوحة الألوان في styles.css إن لزم. **حافظ حرفياً على كل الدوال في app.js وبنية index.html ومعرّفات العناصر (id وdata-action) وتفويض الأحداث** — لا تحذف أي دالة ولا تكسر أي تفاعل. أعِد الملفات الثلاثة كاملةً.`;
                const fixPlan = await agents.coreEditCodePlan(instruction, baseFiles, lang);
                if (fixPlan?.files?.length && !fixPlan.error) {
                    const emitG = (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m);
                    const guarded = await ensureEditIntegrity(
                        await guardFiles(scrubPlaceholders(fixPlan.files, activeProject), emitG), projectPath, emitG);
                    await writePlanFiles(projectPath, guarded);
                    const verdict = await verifyBehavior({ projectPath, blueprint: { kind: 'webapp' }, domainModel: model });
                    if (verdict.ran && !verdict.ok) {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'CloneTemplate', '↩️ التخصيص كسر التطبيق — استرجاع الكلون العامل النظيف.');
                        for (const f of clone.files) await fsPromises.writeFile(path.join(projectPath, f.name), f.content);
                    } else {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'CloneTemplate', `✅ البصمة وُضعت والتطبيق يعمل (${verdict.summary || 'تحقّق سلوكي'}).`);
                    }
                }
            } catch (e) { this.emitLiveLog(roomName, '5. RUNTIME', 'CloneTemplate', `⚠️ تخطّي التخصيص (الكلون العامل محفوظ): ${e.message}`); }
        }

        // 3) إعداد النشر (موقع ثابت — لا خادم مطلوب للكلون التجريبي)
        try {
            const projectName = `${username}-${activeProject}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
            await prepareRenderDeploy(projectPath, projectName, false);
        } catch { /* اختياري */ }

        // 4) نهائيات كبناءٍ ناجح
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        transitionState(username, activeProject, STATES.COMPLETED);
        updateStructure(username, activeProject,
            (clone.model.roles || []).map(r => `واجهة ${r.name}`),
            (clone.model.flows || []).map(f => f.name));
        addToHistory(username, activeProject, `كلون ${clone.id}: ${(goal || '').slice(0, 60)}`);
        this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        let builtFiles = [];
        try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
        this.io.to(roomName).emit('workspace_files', builtFiles);
        snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
        autoPushIfEnabled(username, activeProject, projectPath, this.io, roomName).catch(() => {});
        const durationSec = Math.round((Date.now() - t0) / 1000);
        recordBuild(username, activeProject, { success: true, durationSec, filesCount: builtFiles.length, goal: goal || '' });
        this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));
        try { recordModel(clone.category, model, { verified: true }); } catch {}

        const msg = lang === 'ar'
            ? `✅ اكتمل — بدأنا من كلون **${clone.name}** يعمل فعلاً (واجهات: زبون · مطعم · سائق · تتبّع) ووضعنا بصمتك. جرّب التبويبات في المعاينة: أضِف للسلة، قدّم طلباً، ثم افتح تبويب المطعم لتراه يصل. اطلب أي تعديل.`
            : `✅ Done — started from a working **${clone.name}** clone (customer · restaurant · driver · tracking) and applied your brand. Try the tabs in the preview.`;
        this.io.to(roomName).emit('chat_reply', { message: msg });
        this.emitLiveLog(roomName, 'JCOS', 'Kernel', '✨ نجاح (كلون عامل)');
        return { success: true, clone: clone.id };
    }

    // ⚛️ بناء مشروع React/Next حقيقي + معاينة حيّة في الـ iframe + خيار النشر
    async _buildReactProject(goal, projectPath, username, activeProject, roomName, { sections = [], starter } = {}) {
        const lang = getUserLanguage(username) || 'ar';
        const t0 = Date.now();
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
        this.emitLiveLog(roomName, '5. RUNTIME', 'ReactGen', '⚛️ توليد مشروع Next.js + Tailwind...');

        // 🧩 نموذج المشروع يُثري هدف كتابة المحتوى — فيَعِي الكيانات والأدوار
        // والتدفّقات حتى في مسار React (كان يُشتقّ ويُحفظ لكن لا يُحقن هنا).
        const reactModelCtx = buildProjectModelContext(getDomainModel(username, activeProject));
        const modelAwareGoal = reactModelCtx ? `${goal}\n${reactModelCtx}` : goal;

        // 🧠 محتوى بالذكاء (best-effort) يملأ الهيكل بمحتوى المشروع الفعلي
        let content = null;
        try {
            this.emitLiveLog(roomName, '5. RUNTIME', 'ContentWriter', '✍️ كتابة محتوى المشروع...');
            content = await generateContentModel(modelAwareGoal, { sections, lang, llm: (m, o) => smartChat(m, o) });
        } catch { /* افتراضي */ }

        // 1) سكافولد Next الحقيقي (للنشر/التنزيل) — بمحتوى مخصّص
        const scaffold = generateNextScaffold({ projectName: activeProject, sections, lang, content });
        for (const f of scaffold.files) {
            const p = path.join(projectPath, f.name);
            await fsPromises.mkdir(path.dirname(p), { recursive: true });
            await fsPromises.writeFile(p, f.content);
        }

        // 1.5) تخصيص محتوى **كل صفحة** بالذكاء: النموذج الدفعي قد يترك أقساماً
        //      افتراضية (خاصة مع كثرة الصفحات). نملأ كل قسم بقي افتراضياً فردياً
        //      (best-effort، تراجع آمن للافتراضي) — فلا صفحة بمحتوى قالبي.
        const finalContent = scaffold.meta.content;
        try {
            const CHROME = new Set(['Navbar', 'Hero', 'Footer']);
            const pageComps = (scaffold.meta.components || []).filter((c) => !CHROME.has(c));
            const routes = scaffold.meta.pages || [];
            for (const comp of pageComps) {
                const cur = finalContent.sections?.[comp];
                if (!cur) continue;
                const label = (routes.find((r) => r.href === '/' + slugify(comp)) || {}).label || cur.heading;
                // لم يخصّصه النموذج الدفعي؟ (لا يزال مطابقاً للافتراضي) → خصّصه فردياً
                if (JSON.stringify(cur) !== JSON.stringify(defaultSection(label, lang))) continue;
                this.emitLiveLog(roomName, '5. RUNTIME', 'ContentWriter', `✍️ محتوى صفحة: ${label}...`);
                const model = await generateSectionContent(label, {
                    brand: finalContent.brand || activeProject, goal, lang, llm: (m, o) => smartChat(m, o),
                });
                if (model) finalContent.sections[comp] = {
                    heading: model.heading || cur.heading,
                    subheading: model.subheading || cur.subheading,
                    items: (model.items && model.items.length) ? model.items : cur.items,
                };
            }
            // أعِد كتابة lib/content.js بالمحتوى المُثرى (المكوّنات تقرأ منه)
            await fsPromises.writeFile(path.join(projectPath, 'lib/content.js'),
                `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(finalContent, null, 2)};\n`);
        } catch (e) { this.emitLiveLog(roomName, '5. RUNTIME', 'ContentWriter', `⚠️ تخصيص جزئي: ${e.message}`); }

        // 2) معاينة ثابتة متعدّدة الصفحات: صفحة HTML حقيقية لكل مسار بروابط تعمل
        //    (index.html + <slug>.html) — بلا CDN، فالتنقّل يفتح صفحات فعلية.
        const staticPages = buildStaticSite(finalContent, lang);
        for (const pg of staticPages) {
            await fsPromises.writeFile(path.join(projectPath, pg.name), pg.content);
        }
        // 🛠️ لوحة تحكم يديرها العميل لموقعه (dashboard.html) — يضبط كلمة مرورها أول مرة
        await fsPromises.writeFile(path.join(projectPath, 'dashboard.html'),
            buildDashboardPage(finalContent, { project: activeProject, username, lang }));

        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        transitionState(username, activeProject, STATES.COMPLETED);
        updateStructure(username, activeProject, sections, scaffold.meta.components);
        addToHistory(username, activeProject, `بناء React/Next: ${(goal || '').slice(0, 60)}`);

        // 3) تحديث المعاينة + قائمة الملفات + لقطة
        this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        let builtFiles = [];
        try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
        this.io.to(roomName).emit('workspace_files', builtFiles);
        snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
        autoPushIfEnabled(username, activeProject, projectPath, this.io, roomName).catch(() => {});
        // 🔬 تحقّق سلوكي على المعاينة (تقرير صادق؛ بلا إصلاح تلقائي لأن بنية
        // React تختلف عن ملفات vanilla الثلاثة التي يعدّلها المُصلِح). لا يوجد
        // agents في هذا المسار (canFix=false) — نمرّر null صراحةً.
        try {
            await this._verifyAndAutofix({
                projectPath, blueprint: null, username, activeProject, roomName, agents: null, lang, canFix: false,
            });
        } catch (e) { console.warn('[BehaviorVerify]', 'تخطّي تحقّق React:', e.message); }

        const durationSec = Math.round((Date.now() - t0) / 1000);
        recordBuild(username, activeProject, { success: true, durationSec, filesCount: builtFiles.length, goal: goal || '' });
        this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));

        const pageCount = scaffold.meta.pages?.length || staticPages.length;
        const report = lang === 'ar'
            ? [
                '✅ مشروع React/Next جاهز — معاينة متعدّدة الصفحات تعمل الآن.',
                `⚛️ Next.js + Tailwind · ${pageCount} صفحة · ${scaffold.meta.components.length} مكوّن${starter ? ` · قالب: ${starter.name}` : ''}`,
                '🖥️ اضغط روابط الشريط للتنقّل بين صفحات حقيقية — كل تعديل ينعكس فوراً.',
                '🛠️ لوحة إدارة موقعك: افتح `dashboard.html` وعيّن كلمة مرور — تدير بها النصوص والصور والمنتجات بنفسك.',
                '⬇️ للتشغيل محلياً: npm install && npm run dev · وجاهز للنشر على Vercel.',
              ].join('\n')
            : [
                '✅ React/Next project ready — multi-page preview running now.',
                `⚛️ Next.js + Tailwind · ${pageCount} pages · ${scaffold.meta.components.length} components${starter ? ` · template: ${starter.name}` : ''}`,
                '🖥️ Click the nav links to move between real pages — every edit reflects instantly.',
                '⬇️ Local run: npm install && npm run dev · Ready to deploy on Vercel.',
              ].join('\n');
        this.io.to(roomName).emit('chat_reply', {
            message: report,
            options: lang === 'ar' ? ['➕ أضف صفحة', '🚀 انشر على Vercel', '🐙 ادفع إلى GitHub', '✏️ عدّل قسماً'] : ['➕ Add a page', '🚀 Deploy to Vercel', '🐙 Push to GitHub', '✏️ Edit a section'],
        });
        this.emitLiveLog(roomName, 'JCOS', 'Kernel', '✨ نجاح');
        return { success: true, stack: 'react-next', files: builtFiles };
    }

    async handleUserMessage(socket, data, agents, dbStatus) {
        const { message, roomName, projectPath, username, activeProject, uiLang } = data;

        // ── 0. Language Detector — تسجيل اللغة من أول رسالة ────────────
        // لغة الواجهة (uiLang) بذرة أولية: إذا لم تُسجَّل لغة بعد والرسالة قصيرة
        // (غامضة يصعب كشفها)، نبدأ بلغة الواجهة — ثم تفوز لغة الكتابة الفعلية لاحقاً.
        if (uiLang && !hasUserLanguage(username) && LANGUAGE_INFO[uiLang] && message.trim().length < 6) {
            setUserLanguage(username, uiLang);
        }
        const userLang = initUserLanguage(username, message);
        const langInfo = getLangInfo(userLang);

        // 🆕 Conversation Manager — فحص الهدف المعلق (دائم، ينجو من إعادة النشر)
        if (getPendingGoal(username)) {
            // "نفذ/كمل" وغيرها من أوامر التنفيذ تؤكد الهدف المعلق أيضاً
            const isYes = /^(نعم|yes|ok|okay|يلا|ايوه|اه|go|نعم ✓|yes.*build|ابنه|ابدأ|start|sure|yep|نفذ|نفّذ|كمل|أكمل|اكمل|تمام)/i.test(message.trim());
            const isNo = /^(لا|no|cancel|لا.*|not now)/i.test(message.trim()) && message.trim().length < 10;
            if (isYes) {
                const pendingGoal = consumePendingGoal(username);
                const lang = getUserLanguage(username) || userLang;
                const msg = lang === 'ar' ? '⚡ ممتاز! أبني الآن...' : '⚡ Building now...';
                this.io.to(roomName).emit('chat_reply', { message: msg });
                this.executeMission(pendingGoal, projectPath, username, activeProject, roomName, agents, dbStatus);
                return;
            } else if (isNo) {
                clearDialog(username);
                const msg = userLang === 'ar' ? 'تم الإلغاء. أخبرني بما تريد.' : 'Cancelled. Tell me what you need.';
                this.io.to(roomName).emit('chat_reply', { message: msg });
                return;
            }
        }

        // معالجة تأكيد البناء
        if (message.startsWith('__CONFIRM_BUILD__')) {
            const goal = message.replace('__CONFIRM_BUILD__', '');
            const lang = getUserLanguage(username) || userLang;
            const msg = lang === 'ar' ? '⚡ ممتاز! أبني الآن...' : '⚡ Building now...';
            this.io.to(roomName).emit('chat_reply', { message: msg });
            this.executeMission(goal, projectPath, username, activeProject, roomName, agents, dbStatus);
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
            this.io.to(roomName).emit('chat_reply', { message: confirmMsg });
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
            this.io.to(roomName).emit('chat_reply', {
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
            this.io.to(roomName).emit('chat_reply', {
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

        // ── 1. تحقق من حالة Clarifier ────────────────────────────────────
        const clarifierState = agents.getState?.(username);

        // إذا كنا في مرحلة التوضيح — معالجة الإجابة (مع أزرار الخيارات إن وُجدت)
        if (clarifierState?.stage === 'clarifying') {
            const result = await agents.processAnswer(username, message);
            if (result) {
                this.io.to(roomName).emit('chat_reply', { message: result.message, options: result.options });
            }
            return;
        }

        // إذا كنا في مرحلة الخطة — ننتظر تأكيد أو تعديل
        if (clarifierState?.stage === 'planning') {
            if (agents.isConfirmation?.(message)) {
                const clarifierData = agents.getState(username);
                const finalGoal = agents.getFinalGoal(username);
                const lang = clarifierState.lang || userLang;
                const startMsg = lang === 'ar' ? '🚀 ممتاز! بدأت البناء الآن...' : '🚀 Great! Building now...';
                this.io.to(roomName).emit('chat_reply', { message: startMsg });

                // 🆕 تهيئة Project Memory من نتائج Clarifier
                if (clarifierData?.plan) {
                    initFromClarifier(username, activeProject, {
                        originalGoal: clarifierData.originalGoal,
                        plan: clarifierData.plan,
                    });
                    // تسجيل المشروع في ملف المستخدم
                    recordProject(username, activeProject, clarifierData.projectType || 'business');
                }

                this.executeMission(finalGoal, projectPath, username, activeProject, roomName, agents, dbStatus);
            } else {
                // تمييز: هل هو سؤال عن الخطة أم تعديل عليها؟
                const lang = clarifierState.lang || userLang;
                const isQuestion = /\?|ماهي|ماذا|كيف|هل|what|how|why|when|can you|tell me/i.test(message);

                if (isQuestion) {
                    // أجب على السؤال بسياق الخطة
                    const plan = clarifierState.plan;
                    const planSummary = plan
                        ? `الأقسام: ${(plan.sections||[]).join('، ')} | الميزات: ${(plan.features||[]).join('، ')}`
                        : 'لم تُبنَ خطة بعد';
                    const replyMsg = lang === 'ar'
                        ? `الخطة الحالية تشمل: ${planSummary}\n\nاكتب **"ابدأ"** للتنفيذ أو أخبرني بأي تعديل.`
                        : `Current plan includes: ${planSummary}\n\nType **"start"** to build or tell me any changes.`;
                    this.io.to(roomName).emit('chat_reply', { message: replyMsg });
                } else {
                    // كشف أوامر الإيقاف في مرحلة Planning
                    const isStop = /^(لا|توقف|الغ|إلغاء|cancel|stop|no|لا تبد|وقف)/i.test(message.trim());
                    if (isStop) {
                        agents.clearState?.(username);
                        const stopMsg = lang === 'ar'
                            ? 'تم إلغاء الخطة. يمكنك البدء من جديد متى شئت.'
                            : 'Plan cancelled. You can start over anytime.';
                        this.io.to(roomName).emit('chat_reply', { message: stopMsg });
                        return;
                    }

                    // كشف طلبات تغيير اللون
                    const isColorChange = /color|لون|colour|ألوان|colors/i.test(message);
                    if (isColorChange) {
                        const colorMsg = lang === 'ar'
                            ? 'ما اللون أو التدرج اللوني الذي تفضله؟ (مثال: أزرق داكن، أخضر طبيعي، ذهبي فاخر...)'
                            : 'What color or theme do you prefer? (e.g., dark blue, natural green, luxury gold...)';
                        this.io.to(roomName).emit('chat_reply', { message: colorMsg });
                        const state = agents.getState(username);
                        if (state) state.answers.push(`color change requested: ${message}`);
                        return;
                    }

                    // تعديل عام على الخطة
                    const editMsg = lang === 'ar'
                        ? `فهمت! سأراعي: "${message}"\n\nاكتب **"ابدأ"** عندما تكون جاهزاً.`
                        : `Got it! I'll include: "${message}"\n\nType **"start"** when ready.`;
                    this.io.to(roomName).emit('chat_reply', { message: editMsg });
                    const state = agents.getState(username);
                    if (state) state.answers.push(`edit: ${message}`);
                }
            }
            return;
        }

        // 🆕 "نعم/تمام/ok" مجرّدة بلا هدف معلق ولا clarifier: موافقة على
        // المتابعة — إن وُجد مشروع قابل للاستئناف نكمله فعلياً بدل إسقاطها
        // في الشات ليرتجل حواراً (سجل تاكسي: "نعم" كانت تدور بلا فعل).
        const bareYes = isBareYes(message); // النمط في chatCommands.js (مُختبَر)
        if (bareYes) {
            const contGoal = buildContinuationGoal(username, activeProject);
            const d = decide('continue', username, activeProject);
            if (contGoal && d.action === 'execute') {
                const lang = getUserLanguage(username) || userLang;
                this.emitLiveLog(roomName, 'INTENT', 'Engine',
                    `🎯 ${JSON.stringify({ intent: 'continue', project: activeProject, confidence: 90 })} — تأكيد مجرّد → استئناف فعلي`);
                this.io.to(roomName).emit('chat_reply', {
                    message: lang === 'ar' ? '⚡ تمام — أكمل من حيث توقفنا...' : '⚡ Alright — resuming where we left off...'
                });
                this.executeMission(contGoal, projectPath, username, activeProject, roomName, agents, dbStatus);
                return;
            }
        }

        // 🆕 "نفذ/نفذهما/طبقها/do it" مجرّدة: أمر تنفيذ يشير لما نوقش للتو في
        // الشات — ننفّذ آخر ما وصفه المساعد كتعليمة تعديل فعلية بدل وعود
        // "سيقوم نظام البناء..." المتكررة (سجل: "تمام نفذهما" دارت بلا فعل ×3).
        const bareExecute = isBareExecute(message); // النمط في chatCommands.js (مُختبَر)
        if (bareExecute) {
            const lang = getUserLanguage(username) || userLang;
            try {
                const { window: hist } = await loadConversation(username);
                const lastAssistant = [...hist].reverse().find(m => m.role === 'assistant' && !/^⚠️|^⚡|^🗑️/.test(m.content || ''));
                if (lastAssistant?.content) {
                    this.emitLiveLog(roomName, 'INTENT', 'Engine', '⚡ أمر تنفيذ مجرّد → تنفيذ ما نوقش للتو كتعديل فعلي.');
                    this.io.to(roomName).emit('chat_reply', {
                        message: lang === 'ar' ? '⚡ تمام — أنفّذ ما اتفقنا عليه الآن...' : '⚡ On it — executing what we just discussed...'
                    });
                    const instruction = (lang === 'ar'
                        ? `نفّذ على الموقع الحالي ما تم الاتفاق عليه في المحادثة التالية (طلب المستخدم الأصلي ثم وصف المساعد):\n"${message.trim()}" يشير إلى:\n${lastAssistant.content.slice(0, 600)}`
                        : `Apply to the current site what was agreed in chat:\n"${message.trim()}" refers to:\n${lastAssistant.content.slice(0, 600)}`);
                    recordEdit(username, instruction.slice(0, 100));
                    this.surgicalEdit(instruction, projectPath, username, activeProject, roomName, agents, dbStatus);
                    return;
                }
            } catch (e) { /* سقوط آمن للشات */ }
            this.io.to(roomName).emit('chat_reply', {
                message: lang === 'ar'
                    ? 'ماذا تريد أن أنفّذ بالضبط؟ صِف التغيير بجملة (مثال: "اضف صفحة للسائق وصفحة للعميل").'
                    : 'What exactly should I execute? Describe the change in one sentence.'
            });
            return;
        }

        // ── 🧠 CEO Brain: Intent Engine → Decision Engine → Execution ─────
        // النوايا الإدارية (كمل/أين وصلنا/انشر/ادفع/تحية) تُعالج هنا قبل أي LLM
        const fastIntent = classifyIntentFast(normalizedMessage || message);
        if (fastIntent) {
            const lang = getUserLanguage(username) || userLang;
            const decision = decide(fastIntent.intent, username, activeProject);

            // النية والقرار يظهران للمستخدم في بث المهمة — شفافية كاملة
            this.emitLiveLog(roomName, 'INTENT', 'Engine',
                `🎯 ${JSON.stringify({ intent: fastIntent.intent, project: activeProject, confidence: fastIntent.confidence })}`);
            this.emitLiveLog(roomName, 'DECISION', 'Engine', `⚙️ ${decision.action} — ${decision.reason}`);

            switch (fastIntent.intent) {
                case 'status': {
                    this.io.to(roomName).emit('chat_reply', { message: buildStatusReply(username, activeProject, lang) });
                    return;
                }

                case 'greeting': {
                    this.io.to(roomName).emit('chat_reply', { message: greetingReply(username, activeProject, lang) });
                    return;
                }

                case 'continue': {
                    if (decision.action === 'reply') {
                        const busyMsg = lang === 'ar'
                            ? '⚙️ الفريق يعمل على المشروع الآن بالفعل — تابع التقدم الحي هنا.'
                            : '⚙️ The team is already working on it — watch the live progress here.';
                        this.io.to(roomName).emit('chat_reply', { message: busyMsg });
                        return;
                    }
                    const continuationGoal = buildContinuationGoal(username, activeProject);
                    if (!continuationGoal) {
                        // لا ذاكرة — نعرض الحالة ونسأل سؤالاً محدداً بدل "ماذا تقصد؟"
                        const noMemMsg = lang === 'ar'
                            ? `لا أجد مشروعاً سابقاً في (${activeProject}) لأكمله.\nأخبرني: ماذا تريد أن نبني؟ (مثال: "متجر بيض بلدي مع سلة وطلب أونلاين")`
                            : `I don't find a previous project in (${activeProject}) to continue.\nTell me: what should we build? (e.g., "an egg store with cart and online ordering")`;
                        this.io.to(roomName).emit('chat_reply', { message: noMemMsg });
                        return;
                    }
                    const resumeMsg = lang === 'ar'
                        ? '📂 وجدت المشروع في الذاكرة — الفريق يستأنف من حيث توقف...'
                        : '📂 Project found in memory — the team is resuming where it left off...';
                    this.io.to(roomName).emit('chat_reply', { message: resumeMsg });
                    this.executeMission(continuationGoal, projectPath, username, activeProject, roomName, agents, dbStatus);
                    return;
                }

                case 'deploy': {
                    if (decision.action === 'reply') {
                        const waitMsg = lang === 'ar'
                            ? '⏳ البناء جارٍ الآن — سأنشر تلقائياً بعد اكتماله، أو اطلب النشر لاحقاً.'
                            : '⏳ Build in progress — deploy after it completes.';
                        this.io.to(roomName).emit('chat_reply', { message: waitMsg });
                        return;
                    }
                    // 🧭 المشاريع full-stack (فيها دوال api/ حقيقية) تُنشر على Render
                    // كخادم دائم — يزيل حدّ Vercel Hobby (12 دالة) ويُبقي DB متصلة.
                    // المواقع الثابتة تبقى على Vercel (أسرع وأبسط).
                    if (isFullStackProject(projectPath)) {
                        const renderMsg = lang === 'ar'
                            ? '🖥️ مشروع full-stack — سأجهّزه لخادم دائم على Render (بلا حدّ دوال)...'
                            : '🖥️ Full-stack project — preparing a persistent server on Render...';
                        this.io.to(roomName).emit('chat_reply', { message: renderMsg });
                        const projectSlug = `${username}-${activeProject}`
                            .toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
                        deployToRender(
                            { projectPath, projectName: projectSlug, username, activeProject, hasBackend: true },
                            this.io, roomName
                        ).then(r => {
                            if (r.success) {
                                const okMsg = lang === 'ar'
                                    ? `✅ جاهز للنشر على Render (خادم دائم). اضغط الزر لإنشائه بضغطة واحدة — سيقرأ الإعداد تلقائياً ويطلب MONGODB_URI:\n\n👉 ${r.deployUrl}\n\nبعدها يُعيد Render النشر تلقائياً مع كل تعديل.`
                                    : `✅ Ready for Render (persistent server). One click to create it:\n\n👉 ${r.deployUrl}`;
                                this.io.to(roomName).emit('chat_reply', { message: okMsg });
                            } else if (r.needsGitHub) {
                                const ghMsg = lang === 'ar'
                                    ? `🔗 لنشر خادم دائم على Render نحتاج ربط المشروع بمستودع GitHub أولاً (Render ينشر من GitHub). افتح ⋯ → GitHub في الداش واربط المستودع، ثم اطلب النشر مجدداً.`
                                    : `🔗 Render deploys from GitHub — connect a repo first (⋯ → GitHub), then deploy again.`;
                                this.io.to(roomName).emit('chat_reply', { message: ghMsg });
                            } else {
                                this.io.to(roomName).emit('log', { message: `❌ [Render]: ${r.error}` });
                            }
                        }).catch(err => {
                            this.io.to(roomName).emit('log', { message: `❌ [Render]: ${err.message}` });
                        });
                        return;
                    }

                    const deployMsg = lang === 'ar'
                        ? '🚀 أمر النشر مقبول — جاري الرفع للإنتاج الآن...'
                        : '🚀 Deploy order accepted — shipping to production...';
                    this.io.to(roomName).emit('chat_reply', { message: deployMsg });
                    agents.deployProject?.(
                        { projectPath, activeProject, currentUser: username, env: getProjectSecrets(username, activeProject) },
                        this.io,
                        () => {}
                    ).catch(err => {
                        this.io.to(roomName).emit('log', { message: `❌ [DEPLOY]: ${err.message}` });
                    });
                    return;
                }

                case 'github_push': {
                    const pushMsg = lang === 'ar'
                        ? '🐙 جاري الدفع إلى GitHub...'
                        : '🐙 Pushing to GitHub...';
                    this.io.to(roomName).emit('chat_reply', { message: pushMsg });
                    pushProject(username, activeProject, projectPath).then(result => {
                        const doneMsg = result.success
                            ? (lang === 'ar' ? `✅ تم الدفع إلى ${result.url} (${result.branch})` : `✅ Pushed to ${result.url} (${result.branch})`)
                            : (lang === 'ar' ? `❌ فشل الدفع — ${result.error}` : `❌ Push failed — ${result.error}`);
                        this.io.to(roomName).emit('chat_reply', { message: doneMsg });
                    }).catch(err => {
                        this.io.to(roomName).emit('chat_reply', { message: `❌ GitHub: ${err.message}` });
                    });
                    return;
                }
            }
        }

        // ── 🧭 الموجّه الموحّد — نداء LLM منظّم واحد بدل شبكة الـ regex ────
        // المسارات الحتمية الحسّاسة (الحذف، القفل، اكمل، اللغة، clarifier)
        // عملت أعلاه. فشل الموجّه → يسقط بصمت للمسار القديم أدناه (احتياط كامل).
        if (!agents.getState?.(username)?.stage) { // ليس داخل حوار clarifier
            try {
                const existingCode = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
                const { window: hist } = await loadConversation(username);
                const lastAssistant = [...hist].reverse().find(m => m.role === 'assistant')?.content || '';
                const route = await routeMessage(message, {
                    projectName: activeProject,
                    hasProject: existingCode.trim().length > 100,
                    lastAssistant,
                    lang: userLang,
                });
                if (route) {
                    this.emitLiveLog(roomName, 'ROUTER', 'Unified',
                        `🧭 ${route.action} (${route.confidence}%)${route.reason ? ` — ${route.reason}` : ''}`);
                    if (route.action === 'chat') {
                        // 🛡️ شبكة أمان: الموجّه قد يصنّف تعديلاً صريحاً كمحادثة (حدث فعلاً مع
                        // "عدّل: ..."). أمرٌ صريح أو تكرار مُصِرّ على مشروع قائم يُنفَّذ تعديلاً
                        // بدل الدخول في حلقة "أعد إرسال نفس الجملة" التي يهلوسها الـ LLM.
                        const hasProj = existingCode.trim().length > 100;
                        // 🔁 أي رسالة محجوبة سابقاً = إصرار (لا نطابق النصّ حرفياً —
                        // المساعد قد يقترح صياغة مختلفة فلا يتطابق الحرفي أبداً → حلقة).
                        const pendingGate = this.gatedMessages.has(username);
                        if (hasProj && !isQuestionMessage(message) && (hasActionIntent(message) || pendingGate)) {
                            this.gatedMessages.delete(username);
                            recordEdit(username, message);
                            recordEditAction(username, activeProject);
                            this.surgicalEdit(message, projectPath, username, activeProject, roomName, agents, dbStatus);
                            return;
                        }
                        if (hasProj && !isQuestionMessage(message)) {
                            // نحجب مرة واحدة بردّ حتمي (لا LLM يهلوس "أعد الإرسال")
                            this.gatedMessages.set(username, message.trim());
                            this.io.to(roomName).emit('chat_reply', { message: this.gateConfirmReply(userLang) });
                            return;
                        }
                        await this.generateChatResponse(message, username, roomName, userLang);
                        return;
                    }
                    if (route.action === 'edit') {
                        recordEdit(username, message);
                        this.surgicalEdit(route.instruction || message, projectPath, username, activeProject, roomName, agents, dbStatus);
                        return;
                    }
                    if (route.action === 'delete_project') {
                        const lang = getUserLanguage(username) || userLang;
                        this.io.to(roomName).emit('chat_reply', {
                            message: activeProject === 'sandbox_app'
                                ? (lang === 'ar' ? '⚠️ لا يمكن حذف المشروع الافتراضي sandbox_app.' : '⚠️ The default sandbox_app project cannot be deleted.')
                                : (lang === 'ar'
                                    ? `⚠️ حذف المشروع «${activeProject}» **نهائي** — الملفات والسجل، ولا يمكن التراجع.\nللتأكيد اكتب حرفياً: **احذف نهائياً ${activeProject}**`
                                    : `⚠️ Deleting "${activeProject}" is **permanent**.\nTo confirm, type exactly: **delete permanently ${activeProject}**`),
                        });
                        return;
                    }
                    if (route.action === 'stop') {
                        agents.clearState?.(username);
                        clearDialog(username);
                        const lang = getUserLanguage(username) || userLang;
                        this.io.to(roomName).emit('chat_reply', {
                            message: lang === 'ar' ? '🛑 تم الإيقاف. أخبرني بما تريد.' : '🛑 Stopped. Tell me what you need.',
                        });
                        return;
                    }
                    // 'build' → يسقط عمداً للمسار القديم (حوار التوضيح + التأكيد بالهدف)
                }
            } catch (e) { /* فشل الموجّه → المسار القديم أدناه */ }
        }

        // ── 1. كشف التعديل المباشر (مسار احتياطي عند فشل الموجّه) ─────────
        // النمط مكتوب بدون همزات لأننا نفحص النص المطبّع (اضف = أضف = إضف)
        // يقبل النقطتين بعد الفعل ("عدّل: ..." التي يقترحها المساعد نفسه) لا المسافة فقط
        const modifyPattern = /^(غير|عدل|بدل|اضف|ضف|زود|احذف|امسح|شيل|صحح|اصلح|تعديل|حول|اجعل|ضع|حط|زد|كبر|صغر|change|modify|update|add|remove|put|fix|make|delete)[\s:：]+/i;
        const normalizedForModify = normalizeArabic(message.trim());
        if (modifyPattern.test(message.trim()) || modifyPattern.test(normalizedForModify)) {
            // إذا كنا في مرحلة Planning — عالج كتعديل على الخطة وليس بناء
            if (clarifierState?.stage === 'planning') {
                const lang = clarifierState.lang || userLang;
                const isColorChange = /color|لون|colour|ألوان/i.test(message);
                if (isColorChange) {
                    const colorMsg = lang === 'ar'
                        ? 'ما اللون المفضل؟ (مثال: أزرق داكن، أخضر، ذهبي...)'
                        : 'What color do you prefer? (e.g., dark blue, green, gold...)';
                    this.io.to(roomName).emit('chat_reply', { message: colorMsg });
                } else {
                    const editMsg = lang === 'ar'
                        ? `فهمت! سأراعي: "${message}"\n\nاكتب **"ابدأ"** عندما تكون جاهزاً.`
                        : `Got it! I'll include: "${message}"\n\nType **"start"** when ready.`;
                    this.io.to(roomName).emit('chat_reply', { message: editMsg });
                    const state = agents.getState(username);
                    if (state) state.answers.push(`edit: ${message}`);
                }
                return;
            }
            this.emitLiveLog(roomName, 'INTENT', 'Classifier', 'نية: modify (ثقة: 100%) - قاعدة مباشرة');
            this.surgicalEdit(message, projectPath, username, activeProject, roomName, agents, dbStatus);
            return;
        }

        // ── 2. تصنيف النية ───────────────────────────────────────────────
        const intentResult = await this.classifyIntent(normalizedMessage || message, username);
        // إذا كشف Text Normalizer النية بثقة عالية — استخدمها
        const finalIntent = meaningIntent.confidence >= 75
            ? { intent: meaningIntent.intent, confidence: meaningIntent.confidence }
            : intentResult;
        this.emitLiveLog(roomName, 'INTENT', 'Classifier', `نية: ${finalIntent.intent} (ثقة: ${finalIntent.confidence}%)`);

        // 🛡️ حارس (ب): جملة وصفية على مشروع قائم ليست طلب بناء جديد.
        // "نحن نعمل على موقع تاكسي" وصف لا أمر — أمر البناء يبدأ بفعل صريح.
        // بدونه كان المصنّف يعرض "هل تريد بناء موقع لـ..." في منتصف العمل.
        if (finalIntent.intent === 'build') {
            // ملاحظة: \b لا يعمل مع الحروف العربية في JS — نستخدم lookahead يونيكود
            const explicitBuild = /^\s*(?:ابني|ابن|اصنع|أنشئ|انشئ|صمم|طوّر|طور|بني|سوّي|سوي|اعمل\s+لي|ابدأ\s+البناء|build|create|make|design|develop|generate|start\s+building)(?=\s|$|[^\p{L}\p{N}])/iu
                .test((normalizedMessage || message).trim());
            if (!explicitBuild) {
                const existingCode = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
                if (existingCode && existingCode.trim().length > 100) {
                    this.emitLiveLog(roomName, 'INTENT', 'Classifier',
                        '🛡️ جملة غير آمرة على مشروع قائم — ليست بناءً جديداً؛ رد محادثة بدل تأكيد بناء.');
                    await this.generateChatResponse(message, username, roomName, userLang);
                    return;
                }
            }
        }

        if (finalIntent.intent === 'build') {
            const userGoal = normalizedMessage || message;
            const lang = getUserLanguage(username) || userLang;

            // 🎯 طلب واسع وغامض → حوار استراتيجي أولاً (لا يبدأ مباشرة)
            const clar = await agents.startClarification?.(username, userGoal);
            if (clar?.type === 'clarification') {
                this.emitLiveLog(roomName, 'INTENT', 'Clarifier', '🎯 طلب استراتيجي — بدء حوار التخطيط');
                this.io.to(roomName).emit('chat_reply', { message: clar.message, options: clar.options });
                return;
            }

            // ⚡ طلب واضح → تأكيد سريع ثم بناء
            const projectHint = userGoal.replace(/^(ابني|اصنع|انشئ|بني|سوي|build|create|make)\s+/i, '').trim();
            // 🏷️ (أ) نُظهر المشروع الهدف صراحةً كي لا يُبنى المحتوى في مشروع
            // باسم مختلف دون أن ينتبه المستخدم (مثل بناء تاكسي داخل hotel-control).
            const confirmQ = lang === 'ar'
                ? `هل تريد بناء موقع لـ "${projectHint}"؟\n📂 سيُبنى داخل المشروع الحالي: «${activeProject}» — لمشروع منفصل أنشئ واحداً جديداً أولاً.`
                : `Do you want me to build a website for "${projectHint}"?\n📂 It will build into your current project: "${activeProject}" — create a new project first if you want it separate.`;
            const opts = lang === 'ar'
                ? ['نعم، ابنه الآن ⚡', 'لا، أخبرني أكثر']
                : ['Yes, build it now ⚡', 'No, tell me more'];
            this.io.to(roomName).emit('chat_reply', { message: confirmQ, options: opts, pendingGoal: userGoal });
            setPendingGoal(username, userGoal, activeProject);
        } else if (finalIntent.intent === 'modify') {
            // 🛡️ السؤال لا يُعامل أبداً كأمر تعديل حتى لو صنّفه النموذج modify —
            // (سجل حقيقي: "ماذا يمكن أن نضيف للمشروع؟" عدّلت الموقع فعلاً!)
            // 🛡️ والجملة الإخبارية بلا فعل أمر/رغبة كذلك — ("ولكن قائمة
            // الأصدقاء موجودة" تصحيحٌ من المستخدم، ليست طلب تعديل).
            const repeatedGated = this.gatedMessages.has(username); // أي رسالة محجوبة = إصرار
            if (!repeatedGated && (isQuestionMessage(message) || !hasActionIntent(message))) {
                if (!isQuestionMessage(message)) {
                    this.gatedMessages.set(username, message.trim());
                    this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🛡️ صُنّفت modify لكنها جملة إخبارية — حجب لمرة واحدة (الرسالة التالية تُنفَّذ).');
                    this.io.to(roomName).emit('chat_reply', { message: this.gateConfirmReply(userLang) });
                    return;
                }
                this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🛡️ سؤال — رد محادثة (لا تعديل).');
                await this.generateChatResponse(message, username, roomName, userLang);
                return;
            }
            // 🔁 رسالة مُعادة بعد حجبها = إصرار → نفّذ (يمنع حلقة "اكتب X")
            if (repeatedGated) {
                this.gatedMessages.delete(username);
                this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🔁 تكرار رسالة محجوبة — إصرار المستخدم → تنفيذ التعديل.');
            }
            recordEdit(username, message);
            this.surgicalEdit(message, projectPath, username, activeProject, roomName, agents, dbStatus);
            // Git commit للتعديل يحدث داخل المهمة بعد النجاح
        } else if (finalIntent.intent === 'stop') {
            this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🛑 أمر إيقاف.');
            agents.clearState?.(username);
            clearDialog(username);
        } else {
            // 🆕 على مشروع قائم: أي طلب غير استفهامي يُعامَل كتعديل تلقائياً
            // (المستخدم لا يجب أن يكتب "عدل على نفس الموقع" في كل مرة —
            //  "قم بربط..."، "استخدم قالب..." كلها تعديلات على الموجود)
            const existing = await this.readCurrentCodeContextAsync(projectPath).catch(() => '');
            const hasProject = existing && existing.trim().length > 100;
            // كاشف أسئلة واعٍ بالعربية — \b القديم لم يكن يطابق "ماذا/هل..." أبداً
            const isQuestion = isQuestionMessage(message);
            const isSmalltalk = message.trim().length < 4;
            // 🔁 أي رسالة محجوبة سابقاً = إصرار → تعديل (يكسر الحلقة بلا مطابقة حرفية)
            const repeated = this.gatedMessages.has(username);

            if (hasProject && !isQuestion && !isSmalltalk && (hasActionIntent(message) || repeated)) {
                this.gatedMessages.delete(username);
                this.emitLiveLog(roomName, 'INTENT', 'Classifier',
                    repeated ? '🔁 رسالة بعد حجب — إصرار → تعديل جراحي' : '✏️ طلب على مشروع قائم → تعديل جراحي');
                recordEdit(username, message);
                this.surgicalEdit(message, projectPath, username, activeProject, roomName, agents, dbStatus);
                return;
            }
            if (hasProject && !isQuestion && !isSmalltalk) {
                this.gatedMessages.set(username, message.trim());
                this.io.to(roomName).emit('chat_reply', { message: this.gateConfirmReply(userLang) });
                return;
            }
            await this.generateChatResponse(message, username, roomName, userLang);
        }
    }
}
