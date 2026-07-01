import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { groq } from './baseAgent.js';
import { promises as fsPromises } from 'fs';
import { initUserLanguage, getUserLanguage, getLangInfo } from './languageDetector.js';
import { getProjectMemory, initFromClarifier, addToHistory, buildMemoryContext, updateDesign, updateStructure } from './projectMemory.js';
import { getUserProfile, updateLanguage, recordProject, recordEdit, buildProfileContext } from './userProfile.js';
import { generateDesignBrief, saveDesignBrief } from './designerAgent.js';
import { generateDatabase, selectDatabase } from './databaseAgent.js';
import { generateAuth, needsAuth } from './authAgent.js';
import { reviewCode } from './reviewAgent.js';
import { commitBuild, initProjectRepo, getProjectStats } from './gitAgent.js';
import { backupProject, listSnapshots } from './fileManager.js';
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
                const result = await agents.templateAgent(context.goal, context.projectPath);
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
                context.activeProject
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
                    context.mentalModel.templateSections || []
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

            await Promise.all(plan.files
                .filter(f => ['index.html', 'styles.css', 'script.js'].includes(f.name) && typeof f.content === 'string')
                .map(f => fsPromises.writeFile(path.join(context.projectPath, f.name), f.content))
            );

            // 🆕 Review Agent — يراجع ويُصلح تلقائياً قبل العرض النهائي
            try {
                this.emitLiveLog(roomName, '5. RUNTIME', 'ReviewAgent', '🔍 مراجعة جودة الكود...');
                const reviewResult = await reviewCode(plan.files, context.originalGoal);

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
            } catch (e) {
                this.emitLiveLog(roomName, '5. RUNTIME', 'ReviewAgent', `⚠️ تخطّي: ${e.message}`);
            }
            await this.saveExecutiveMemory(context.username, context.mentalModel.visualIdentity);
            context.files = plan.files;
            context.images = plan.images;

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
                try {
                    const frontendContext = await this.readCurrentCodeContextAsync(context.projectPath);
                    const backendResult = await agents.generateBackend(context.goal, frontendContext);

                    if (backendResult.success && backendResult.files.length > 0) {
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
                                await fsPromises.writeFile(
                                    path.join(context.projectPath, 'script.js'),
                                    updatedScript
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

                // 🆕 Auth Agent — يُضيف نظام تسجيل دخول إذا احتاجه المشروع
                if (needsAuth(context.originalGoal)) {
                    try {
                        this.emitLiveLog(roomName, '5. RUNTIME', 'AuthAgent', '🔐 جاري توليد نظام المصادقة...');
                        const authResult = await generateAuth(context.originalGoal, context.projectPath);
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
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `صنف نية المستخدم بدقة. القواعد:
- "build": طلب صريح لبناء أو إنشاء أو تنفيذ موقع/ميزة الآن (مثل "اصنع موقعاً لمطعم بيتزا"، "ابدأ البناء")
- "modify": طلب تعديل على كود موجود
- "query": سؤال عن معلومة أو نقاش حول الفكرة قبل التنفيذ
- "chat": محادثة عامة
- "stop": طلب إيقاف
- "acknowledge": رد قصير بالموافقة فقط دون طلب فعلي جديد

مهم: إذا كانت الرسالة تحتوي طلباً صريحاً لبدء العمل الفعلي (حتى لو مسبوقة بنقاش)، صنّفها "build" وليس "query" أو "acknowledge".
أعد JSON: { intent, confidence }`
                    },
                    { role: "user", content: `تفضيلات: ${JSON.stringify(execMemory)}\nالرسالة: "${userMessage}"` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                max_tokens: 100,
                temperature: 0.1
            });
            const result = JSON.parse(completion.choices[0].message.content);
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
        const messages = [
            { role: "system", content: `You are JAOLA — a smart web building assistant.

CRITICAL LANGUAGE RULE: The user's language is "${userLang}" (${langInfo.label}). You MUST reply ONLY in this language for the entire conversation. Never switch languages even if the user writes a word in another language.

RESPONSE RULES:
- Keep replies SHORT: 1-3 sentences maximum
- Be direct and friendly
- Your specialty: websites, design, web development
- When user wants to build: tell them to type "${userLang === 'ar' ? 'ابني [اسم المشروع]' : 'build [project name]'}" to start the official build system

User preferences: ${JSON.stringify(execMemory)}` },
            ...history
        ];
        let reply = "عذراً، حدث خطأ في معالجة رسالتك. حاول مرة أخرى.";
        try {
            const completion = await groq.chat.completions.create({
                messages,
                model: "llama-3.3-70b-versatile",
                max_tokens: 200,
                temperature: 0.6
            });
            reply = completion.choices[0].message.content;
        } catch (e) { console.error('Chat error:', e); }
        history.push({ role: 'assistant', content: reply });
        if (mongoose.connection.readyState === 1) {
            await Conversation.findOneAndUpdate({ username }, { messages: history.slice(-MAX_HISTORY) }, { upsert: true });
        } else {
            this.conversationBuffer.set(username, history.slice(-MAX_HISTORY));
        }
        this.emitChatReply(roomName, reply);
        this.emitLiveLog(roomName, '💬 Assistant', 'Chat Reply', reply);
        return reply;
    }

    emitChatReply(roomName, replyMessage) {
        this.io.to(roomName).emit('chat_reply', { message: replyMessage });
    }

    async executeMission(goal, projectPath, username, activeProject, roomName, agents, dbStatus) {
        // 🆕 دمج Project Memory + User Profile في سياق الهدف
        const memoryContext = buildMemoryContext(username, activeProject);
        const profileContext = buildProfileContext(username);
        const enrichedGoal = (memoryContext || profileContext)
            ? `${goal}\n${memoryContext}${profileContext}`
            : goal;

        // تسجيل هذا الطلب في تاريخ المشروع
        addToHistory(username, activeProject, goal.slice(0, 80));

        const context = new JCRContext(enrichedGoal, projectPath, username, activeProject);
        this.emitLiveLog(roomName, 'JCOS', 'Kernel', `🏁 بدء المهمة: ${context.missionId}`);
        try {
            await this.buildWorldModel(context, roomName, dbStatus);
            await this.buildMissionAndMeta(context, roomName);
            await this.runExecutiveBrain(context, roomName, agents);
            if (context.executiveDecision.actionType !== 'EXECUTE') {
                await this.runReflectionAndSelfImprovement(context, roomName, true);
                this.io.to(roomName).emit('agent_states', { planner: 'completed', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
                return { success: true };
            }

            let execResult;
            try {
                execResult = await this.runDynamicMultiAgentRuntime(context, roomName, agents);
            } catch (runtimeError) {
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
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', execResult.success ? '✨ نجاح' : '❌ فشل');
            return execResult;
        } catch (error) {
            this.emitAgentError(roomName, 'planner');
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', `❌ تعطلت المهمة: ${error.message}`);
            await this.runReflectionAndSelfImprovement(context, roomName, false);
            return { success: false, error: error.message };
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

    async handleUserMessage(socket, data, agents, dbStatus) {
        const { message, roomName, projectPath, username, activeProject } = data;

        // ── 0. Language Detector — تسجيل اللغة من أول رسالة ────────────
        const userLang = initUserLanguage(username, message);
        const langInfo = getLangInfo(userLang);

        // 🆕 تحديث لغة ملف المستخدم
        updateLanguage(username, userLang);

        // ── 1. تحقق من حالة Clarifier ────────────────────────────────────
        const clarifierState = agents.getState?.(username);

        // إذا كنا في مرحلة التوضيح — معالجة الإجابة
        if (clarifierState?.stage === 'clarifying') {
            const result = await agents.processAnswer(username, message);
            if (result) {
                this.io.to(roomName).emit('chat_reply', { message: result.message });
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

        // ── 1. كشف التعديل المباشر ───────────────────────────────────────
        const modifyPattern = /^(غير|عدل|بدل|أضف|احذف|صحح|أصلح|تعديل|حوّل|اجعل|change|modify|update|add|remove)\s+/i;
        if (modifyPattern.test(message.trim())) {
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
            this.executeMission(message, projectPath, username, activeProject, roomName, agents, dbStatus);
            return;
        }

        // ── 2. تصنيف النية ───────────────────────────────────────────────
        const intentResult = await this.classifyIntent(message, username);
        this.emitLiveLog(roomName, 'INTENT', 'Classifier', `نية: ${intentResult.intent} (ثقة: ${intentResult.confidence}%)`);

        if (intentResult.intent === 'build') {
            // 🆕 ابدأ Clarifier بدلاً من البناء المباشر
            if (agents.startClarification) {
                const clarifyResult = agents.startClarification(username, message);
                // أضف رسالة المستخدم للشات أولاً
                this.io.to(roomName).emit('chat_reply', { 
                    message: clarifyResult.message,
                    type: 'clarification'
                });
            } else {
                this.executeMission(message, projectPath, username, activeProject, roomName, agents, dbStatus);
            }
        } else if (intentResult.intent === 'modify') {
            recordEdit(username, message);
            this.executeMission(message, projectPath, username, activeProject, roomName, agents, dbStatus);
            // Git commit للتعديل يحدث داخل executeMission بعد النجاح
        } else if (intentResult.intent === 'stop') {
            this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🛑 أمر إيقاف.');
            agents.clearState?.(username);
        } else {
            await this.generateChatResponse(message, username, roomName, userLang);
        }
    }
}
