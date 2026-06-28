import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { groq } from './baseAgent.js';
import { promises as fsPromises } from 'fs';
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
            
            // 🟢 تطبيع الثقة: إذا كانت بين 0-1 نعتبرها نسبة مئوية
            let confidence = result.meta.confidence;
            if (typeof confidence === 'number' && confidence <= 1) {
                confidence = Math.round(confidence * 100);
            }
            context.metaReasoning.confidence = confidence || 70;
            context.metaReasoning.unknowns = Array.isArray(result.meta.unknowns) ? result.meta.unknowns : [];
            
            // نطلب توضيحاً فقط إذا الثقة ضعيفة جداً (أقل من 45) والمجاهيل موجودة
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
        
        // 🟢 تعديل: لا نطلب توضيحاً بشكل صارم، بل نستمر إذا كانت الثقة معقولة
        if (context.metaReasoning.needsUserClarification && unknowns.length > 0) {
            // عرض الأسئلة ولكن مع خيار المتابعة التلقائية
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', '🟡 ملاحظة: توجد مجاهيل، لكننا سنحاول المتابعة.');
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', `الأسئلة المحتملة:\n${unknowns.map((u,i)=>`${i+1}. ${u}`).join('\n')}`);
            // لا نوقف التنفيذ، بل نستمر
        }
        
        if (!context.budget.consumeCall()) {
            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO', '❌ الميزانية استنفدت.');
            context.executiveDecision.actionType = 'STOP_AND_ASK';
            return;
        }
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "أنتج JSON: taskGraph, priorityQueue" },
                    { role: "user", content: JSON.stringify(context.mentalModel) }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
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
        const initialCodeContext = await this.readCurrentCodeContextAsync(context.projectPath);
        const maxDebateCycles = context.budget.maxApiCalls;

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
                    (chunk) => this.io.to(roomName).emit('code_stream_chunk', chunk)
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

            // مراجعة متوازية
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

            // نجاح
            await Promise.all(plan.files
                .filter(f => ['index.html', 'styles.css', 'script.js'].includes(f.name) && typeof f.content === 'string')
                .map(f => fsPromises.writeFile(path.join(context.projectPath, f.name), f.content))
            );
            await this.saveExecutiveMemory(context.username, context.mentalModel.visualIdentity);
            context.files = plan.files;
            context.images = plan.images;
            return { success: true };
        }

        throw new Error(`فشل الفريق بعد ${maxDebateCycles} دورات. آخر الانتقادات: ${JSON.stringify(context.internalDebate.criticTranscripts.slice(-2))}`);
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
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "صنف النية: build, modify, query, chat, stop. أعد JSON: { intent, confidence }" },
                    { role: "user", content: `تفضيلات: ${JSON.stringify(execMemory)}\nالرسالة: "${userMessage}"` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                max_tokens: 100, temperature: 0.1
            });
            const result = JSON.parse(completion.choices[0].message.content);
            // تطبيع الثقة إذا كانت بين 0-1
            if (result.confidence && result.confidence <= 1) {
                result.confidence = Math.round(result.confidence * 100);
            }
            return result;
        } catch (e) { return { intent: "chat", confidence: 50 }; }
    }

    async generateChatResponse(userMessage, username, roomName) {
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
            { role: "system", content: `أنت مساعد تطوير ويب. تذكر التفضيلات: ${JSON.stringify(execMemory)}. استمر من السياق.` },
            ...history
        ];
        let reply = "عذراً، حدث خطأ في معالجة رسالتك. حاول مرة أخرى.";
        try {
            const completion = await groq.chat.completions.create({
                messages,
                model: "llama-3.3-70b-versatile",
                max_tokens: 500, temperature: 0.7
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
        const context = new JCRContext(goal, projectPath, username, activeProject);
        this.emitLiveLog(roomName, 'JCOS', 'Kernel', `🏁 بدء المهمة: ${context.missionId}`);
        try {
            await this.buildWorldModel(context, roomName, dbStatus);
            await this.buildMissionAndMeta(context, roomName);
            await this.runExecutiveBrain(context, roomName, agents);
            if (context.executiveDecision.actionType !== 'EXECUTE') {
                await this.runReflectionAndSelfImprovement(context, roomName, true);
                this.io.to(roomName).emit('agent_state', { planner: 'completed', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
                return { success: true };
            }
            const execResult = await this.runDynamicMultiAgentRuntime(context, roomName, agents);
            this.runCuriosityInBackground(context, roomName);
            if (execResult.success && context.images?.length) {
                await Promise.all(context.images.map(img => generateAIImage(img.prompt, projectPath, img.fileName)));
            }
            await this.runReflectionAndSelfImprovement(context, roomName, execResult.success);
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', execResult.success ? '✨ نجاح' : '❌ فشل');
        } catch (error) {
            this.emitLiveLog(roomName, 'JCOS', 'Kernel', `❌ تعطلت: ${error.message}`);
            await this.runReflectionAndSelfImprovement(context, roomName, false);
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
        const intentResult = await this.classifyIntent(message, username);
        this.emitLiveLog(roomName, 'INTENT', 'Classifier', `نية: ${intentResult.intent} (ثقة: ${intentResult.confidence}%)`);
        if (intentResult.intent === 'build' || intentResult.intent === 'modify') {
            this.executeMission(message, projectPath, username, activeProject, roomName, agents, dbStatus);
        } else if (intentResult.intent === 'stop') {
            this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🛑 أمر إيقاف.');
        } else {
            await this.generateChatResponse(message, username, roomName);
        }
    }
}
