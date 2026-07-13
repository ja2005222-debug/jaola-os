import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { groq, smartChat } from './baseAgent.js';
import { runBackendTeam, writeBackendTeamFiles } from './backendTeam/index.js';
import { scanProjectFiles, buildProjectBrain, summarizeBrain } from '../services/projectBrain.js';
import { selectStarter, resolveStack } from './starterRegistry.js';
import { generateNextScaffold } from './reactGenerator.js';
import { reactPreviewFile } from '../services/reactPreview.js';
import { promises as fsPromises } from 'fs';
import { initUserLanguage, getUserLanguage, getLangInfo, getReplyLanguage, detectExplicitLanguageSwitch, hasUserLanguage, LANGUAGE_INFO } from './languageDetector.js';
import { getLanguageDecision, buildLanguagePrompt } from './languageManager.js';
import { getProjectMemory, initFromClarifier, addToHistory, buildMemoryContext, updateDesign, updateStructure } from './projectMemory.js';
import { detectProjectType } from './knowledgeEngine.js';
import { getUserProfile, updateLanguage, recordProject, recordEdit, buildProfileContext } from './userProfile.js';
import { generateDesignBrief, saveDesignBrief } from './designerAgent.js';
import { generateDatabase, selectDatabase } from './databaseAgent.js';
import { generateAuth, needsAuth } from './authAgent.js';
import { generateAdvancedModules } from './backendAgent.js';
import { generatePrismaSetup, needsPostgres } from './postgresAgent.js';
import { prepareRenderDeploy } from './renderAgent.js';
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
import { normalizeText, normalizeArabic, detectIntentFromMeaning } from './textNormalizer.js';
import { classifyIntentFast, decide, buildContinuationGoal, buildStatusReply, missionBriefing, greetingReply } from './ceoBrain.js';
import { setUserLanguage } from './languageDetector.js';
import { registerMission, throwIfAborted, clearMission } from '../services/abortRegistry.js';
import { autoPushIfEnabled, pushProject } from '../services/githubSync.js';
import { snapshotWorkspace } from '../services/workspaceStore.js';
import { orchestrator } from '../core/PluginOrchestrator.js';
import { guardFiles, guardSingleJS } from '../services/codeGuard.js';
import { buildImageContext } from '../services/imageService.js';
import { generateBlueprint, buildBlueprintContext } from './appBlueprint.js';
import { recordScore, recordBuild, buildMetricsPayload } from '../services/metricsStore.js';
import { setPendingGoal, getPendingGoal, consumePendingGoal, clearDialog } from '../services/conversationManager.js';
import { enqueueMission } from '../services/missionQueue.js';
import Conversation from '../models/Conversation.js';
import mongoose from 'mongoose';

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

// ==========================================
// 🚀 JAOLA Cognitive Runtime
// ==========================================
export class JaolaCognitiveRuntime {
    constructor(ioInstance) {
        this.io = ioInstance;
        this.memoryDir = path.resolve(__dirname, '../memory');
        this.reflectionPath = path.join(this.memoryDir, 'reflection_knowledge_graph.json');
        this.executiveMemoryPath = path.join(this.memoryDir, 'executive_memory.json');
        this.conversationBuffer = new Map();
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
        } catch (e) {}
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

        for (let cycle = 0; cycle < maxDebateCycles; cycle++) {
            if (context.budget.isExhausted()) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'Orchestrator', '❌ الميزانية استنفدت.');
                break;
            }

            const critiquesText = context.internalDebate.criticTranscripts.length > 0
                ? `\n⚠️ انتقادات سابقة:\n${JSON.stringify(context.internalDebate.criticTranscripts, null, 2)}\n`
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

            const secAudit = CognitiveCapabilities.runSecurityAudit(plan.files);
            const archPromise = context.budget.consumeCall() ? agents.architectReview(plan) : Promise.resolve({ approved: true, feedback: '' });
            const qaPromise = context.budget.consumeCall() ? agents.qaVerify(plan) : Promise.resolve({ passed: true, logs: [] });
            const [archResult, qaResult] = await Promise.all([archPromise, qaPromise]);

            const newCritiques = [];
            if (!archResult.approved) newCritiques.push({ agent: 'Architect', critique: archResult.feedback });
            if (!secAudit.isSafe) newCritiques.push({ agent: 'Security', critique: secAudit.critique });
            if (!qaResult.passed) newCritiques.push({ agent: 'QA', critique: qaResult.logs.join(' | ') });

            if (newCritiques.length > 0) {
                context.internalDebate.criticTranscripts.push(...newCritiques);
                this.emitLiveLog(roomName, '5. RUNTIME', 'Specialists', `❌ رُفض من ${newCritiques.length} متخصص.`);
                continue;
            }

            // 🛡️ Code Guard — فحص syntax وإصلاح ذاتي قبل أي حفظ
            plan.files = await guardFiles(plan.files,
                (m) => this.emitLiveLog(roomName, '5. RUNTIME', 'CodeGuard', m));

            await Promise.all(plan.files
                .filter(f => ['index.html', 'styles.css', 'script.js'].includes(f.name) && typeof f.content === 'string')
                .map(f => fsPromises.writeFile(path.join(context.projectPath, f.name), f.content))
            );

            // 🆕 Review Agent — يراجع ويُصلح تلقائياً قبل العرض النهائي
            try {
                this.emitLiveLog(roomName, '5. RUNTIME', 'ReviewAgent', '🔍 مراجعة جودة الكود...');
                const reviewResult = await reviewCode(plan.files, context.originalGoal, getUserLanguage(context.username) || 'en');

                if (reviewResult.fixedCount > 0) {
                    // حفظ الملفات المُصلحة
                    await Promise.all(reviewResult.fixedFiles
                        .filter(f => ['index.html', 'styles.css', 'script.js'].includes(f.name) && typeof f.content === 'string')
                        .map(f => fsPromises.writeFile(path.join(context.projectPath, f.name), f.content))
                    );
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
            } catch (e) { /* اختياري */ }

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
                    } else {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', `⚠️ تعذّر توليد الخادم: ${backendResult.error}`);
                    }
                } catch (e) {
                    this.emitLiveLog(roomName, '5. RUNTIME', 'BackendAgent', `❌ خطأ في BackendAgent: ${e.message}`);
                }

                // 🆕 DatabaseAgent — يُولّد Schema + Seed Data مع Backend
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

                // 🆕 PostgreSQL + Prisma — للمشاريع التي تحتاج قاعدة بيانات علاقية
                if (needsPostgres(context.originalGoal)) {
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
            } catch (e) { /* اختياري */ }

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
            } catch (e) { /* اختياري */ }

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
        } catch (e) {}
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

    async generateChatResponse(userMessage, username, roomName, userLang = 'en') {
        const langInfo = getLangInfo(userLang);
        const execMemory = await this.loadExecutiveMemory(username);
        const MAX_HISTORY = 30;
        let history;
        try {
            if (mongoose.connection.readyState === 1) {
                const conv = await Conversation.findOne({ username });
                history = conv ? conv.messages.slice(-MAX_HISTORY) : [];
            } else {
                history = this.conversationBuffer.get(username) || [];
            }
        } catch (e) { history = this.conversationBuffer.get(username) || []; }
        history.push({ role: 'user', content: userMessage });

        // 🧠 Project Brain — يفهم كامل المشروع (ملفات + قرارات + أُنجز/متبقٍّ) لا الرسالة الأخيرة فقط
        let brainContext = '';
        try {
            const project = roomName.startsWith(username + '-') ? roomName.slice(username.length + 1) : null;
            if (project) {
                const safeUser = username.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
                const safeProject = project.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
                const projectPath = path.resolve(__dirname, '../../workspace', safeUser, safeProject);
                const files = await scanProjectFiles(projectPath, { maxFiles: 300 });
                const brain = buildProjectBrain(getProjectMemory(username, project), files);
                brainContext = summarizeBrain(brain, userLang);
            }
        } catch { /* الشات يعمل حتى لو تعذّر بناء الصورة */ }

        const messages = [
            { role: "system", content: `You are JAOLA — a smart web building assistant.

CRITICAL LANGUAGE RULE: The user's language is "${userLang}" (${langInfo.label}). You MUST reply ONLY in this language for the entire conversation. Never switch languages even if the user writes a word in another language.

RESPONSE RULES:
- Keep replies SHORT: 1-3 sentences maximum
- Be direct and friendly
- Your specialty: websites, design, web development
- When user wants to build: tell them to type "${userLang === 'ar' ? 'ابني [اسم المشروع]' : 'build [project name]'}" to start the official build system
- Answer about the WHOLE project using the state below — not just the last message. If asked what's done or remaining, use it.

## Current project state (Project Brain):
${brainContext || 'No project files yet.'}

User preferences: ${JSON.stringify(execMemory)}` },
            ...history
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
        history.push({ role: 'assistant', content: reply });
        if (mongoose.connection.readyState === 1) {
            await Conversation.findOneAndUpdate({ username }, { messages: history.slice(-MAX_HISTORY) }, { upsert: true });
        } else {
            this.conversationBuffer.set(username, history.slice(-MAX_HISTORY));
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
        } catch (e) { /* اختياري */ }

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

        const finalGoalWithRequirements = `${enrichedGoal}${blueprintContext}\n${requirementsContext}${imageContext}${pluginContext}`;

        // تسجيل هذا الطلب في تاريخ المشروع
        addToHistory(username, activeProject, goal.slice(0, 80));

        const context = new JCRContext(finalGoalWithRequirements || enrichedGoal, projectPath, username, activeProject);
        context.originalGoal = goal;
        context.blueprint = blueprint;   // متاح للـ template agent وباقي المراحل
        transitionState(username, activeProject, STATES.GENERATING);

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
    async readProjectFilesArray(projectPath) {
        try {
            const files = await fsPromises.readdir(projectPath);
            const relevant = files.filter(f => ['index.html', 'styles.css', 'script.js'].includes(f));
            return await Promise.all(relevant.map(async f => ({
                name: f, content: await fsPromises.readFile(path.join(projectPath, f), 'utf-8')
            })));
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

    async _runSurgicalEditNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus) {
        const lang = getUserLanguage(username) || 'ar';
        const files = await this.readProjectFilesArray(projectPath);

        // لا مشروع قائم، أو تعديل كبير (إعادة تصميم/بناء) → البناء الكامل بدل الجراحي
        const bigChange = /أعد التصميم|اعد التصميم|أعد البناء|اعد البناء|من جديد|صفحة جديدة|صفحات|redesign|rebuild|from scratch|new page/i.test(instruction);
        if (files.length === 0 || bigChange || !agents.coreEditCodePlan) {
            return this._runMissionNow(instruction, projectPath, username, activeProject, roomName, agents, dbStatus);
        }

        this.emitLiveLog(roomName, 'EDIT', 'SurgicalEditor', '✂️ تعديل دقيق (لا إعادة بناء كاملة)...');
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });

        let plan;
        try {
            plan = await agents.coreEditCodePlan(instruction, files, lang,
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
        const guarded = await guardFiles(plan.files, (m) => this.emitLiveLog(roomName, 'EDIT', 'CodeGuard', m));
        for (const file of guarded) {
            await fsPromises.writeFile(path.join(projectPath, file.name), file.content);
        }
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });

        const changedNames = guarded.map(f => f.name).join('، ');
        recordEdit(username, instruction);
        addToHistory(username, activeProject, `تعديل: ${instruction.slice(0, 60)}`);

        // تحديث المعاينة + قائمة الملفات + لقطة دائمة
        this.io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
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

    // ⚛️ بناء مشروع React/Next حقيقي + معاينة حيّة في الـ iframe + خيار النشر
    async _buildReactProject(goal, projectPath, username, activeProject, roomName, { sections = [], starter } = {}) {
        const lang = getUserLanguage(username) || 'ar';
        const t0 = Date.now();
        this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
        this.emitLiveLog(roomName, '5. RUNTIME', 'ReactGen', '⚛️ توليد مشروع Next.js + Tailwind...');

        // 1) سكافولد Next الحقيقي (للنشر/التنزيل)
        const scaffold = generateNextScaffold({ projectName: activeProject, sections, lang });
        for (const f of scaffold.files) {
            const p = path.join(projectPath, f.name);
            await fsPromises.mkdir(path.dirname(p), { recursive: true });
            await fsPromises.writeFile(p, f.content);
        }

        // 2) معاينة حيّة مكتفية ذاتياً (index.html) تصيّر المكوّنات فعلياً في الـ iframe
        const preview = reactPreviewFile(scaffold.files, { title: activeProject, lang });
        await fsPromises.writeFile(path.join(projectPath, 'index.html'), preview.content);

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
        const durationSec = Math.round((Date.now() - t0) / 1000);
        recordBuild(username, activeProject, { success: true, durationSec, filesCount: builtFiles.length, goal: goal || '' });
        this.io.to(roomName).emit('project_metrics', buildMetricsPayload(username, activeProject));

        const report = lang === 'ar'
            ? [
                '✅ مشروع React/Next جاهز — معاينة حيّة تعمل الآن.',
                `⚛️ Next.js + Tailwind · ${scaffold.meta.components.length} مكوّن${starter ? ` · قالب: ${starter.name}` : ''}`,
                '🖥️ المعاينة الحيّة تعرض المكوّنات فعلياً — عدّل ثم شاهد التغيير مباشرة.',
                '⬇️ للتشغيل محلياً: npm install && npm run dev · وجاهز للنشر على Vercel.',
              ].join('\n')
            : [
                '✅ React/Next project ready — live preview running now.',
                `⚛️ Next.js + Tailwind · ${scaffold.meta.components.length} components${starter ? ` · template: ${starter.name}` : ''}`,
                '🖥️ Live preview renders the real components — edit and see changes instantly.',
                '⬇️ Local run: npm install && npm run dev · Ready to deploy on Vercel.',
              ].join('\n');
        this.io.to(roomName).emit('chat_reply', {
            message: report,
            options: lang === 'ar' ? ['🚀 انشر على Vercel', '🐙 ادفع إلى GitHub', '✏️ عدّل قسماً'] : ['🚀 Deploy to Vercel', '🐙 Push to GitHub', '✏️ Edit a section'],
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
                    const deployMsg = lang === 'ar'
                        ? '🚀 أمر النشر مقبول — جاري الرفع للإنتاج الآن...'
                        : '🚀 Deploy order accepted — shipping to production...';
                    this.io.to(roomName).emit('chat_reply', { message: deployMsg });
                    agents.deployProject?.(
                        { projectPath, activeProject, currentUser: username },
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

        // ── 1. كشف التعديل المباشر ───────────────────────────────────────
        // النمط مكتوب بدون همزات لأننا نفحص النص المطبّع (اضف = أضف = إضف)
        const modifyPattern = /^(غير|عدل|بدل|اضف|ضف|زود|احذف|امسح|شيل|صحح|اصلح|تعديل|حول|اجعل|ضع|حط|زد|كبر|صغر|change|modify|update|add|remove|put|fix|make|delete)\s+/i;
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
            const confirmQ = lang === 'ar'
                ? `هل تريد بناء موقع لـ "${projectHint}"؟`
                : `Do you want me to build a website for "${projectHint}"?`;
            const opts = lang === 'ar'
                ? ['نعم، ابنه الآن ⚡', 'لا، أخبرني أكثر']
                : ['Yes, build it now ⚡', 'No, tell me more'];
            this.io.to(roomName).emit('chat_reply', { message: confirmQ, options: opts, pendingGoal: userGoal });
            setPendingGoal(username, userGoal, activeProject);
        } else if (finalIntent.intent === 'modify') {
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
            const isQuestion = /(^|\s)(هل|ما|ماذا|كيف|لماذا|ليش|وش|ايش|إيش|متى|اين|أين|وين|كم|مين|من هو|شنو)\b|\?|؟|^(what|how|why|when|where|who|can you|could you|is it|do you|does)\b/i.test(message.trim());
            const isSmalltalk = message.trim().length < 4;

            if (hasProject && !isQuestion && !isSmalltalk) {
                this.emitLiveLog(roomName, 'INTENT', 'Classifier', '✏️ طلب على مشروع قائم → تعديل جراحي');
                recordEdit(username, message);
                this.surgicalEdit(message, projectPath, username, activeProject, roomName, agents, dbStatus);
                return;
            }
            await this.generateChatResponse(message, username, roomName, userLang);
        }
    }
}
