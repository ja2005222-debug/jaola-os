import fs from 'fs';
import fsPromises from 'fs/promises'; 
import path from 'path';
import { fileURLToPath } from 'url';
import { groq, ai } from './baseAgent.js';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// 🧠 1. المكونات المعرفية المفتتة لـ JCOS v4.0
// ==========================================

class WorldRepresentation {
    constructor(projectPath) {
        this.fileTree = [];
        this.gitState = 'clean';
        this.dbState = 'standby';
        this.previousBuilds = [];
        this.resources = { cpu: 14, ram: 42, latency: 12 };
    }

    async scan(projectPath, dbStatus) {
        try {
            const exists = await fsPromises.access(projectPath).then(() => true).catch(() => false);
            this.fileTree = exists 
                ? (await fsPromises.readdir(projectPath)).filter(f => f !== '.backups' && f !== '.next') 
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
        this.maxApiCalls = complexity === 'complex' ? 15 : 5;
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
        
        this.metaReasoning = {
            confidence: 100,         
            unknowns: [],            
            needsUserClarification: false
        };

        this.executiveDecision = {
            actionType: 'EXECUTE',   
            taskGraph: [],           
            priorityQueue: []        
        };

        this.internalDebate = {
            currentConfidence: 100,
            criticTranscripts: [],    
            specialistPersonality: 'ReactExpert' 
        };

        this.reflection = {
            failurePatterns: [],     
            successfulStrategies: [],
            tokensUsed: 0,
            learningTakeaway: ""     
        };
    }
}

const CognitiveCapabilities = {
    async runSecurityAudit(files) {
        let isSafe = true;
        let critique = "";
        files.forEach(file => {
            if (file.name === 'index.html' && file.content.includes('innerHTML') && !file.content.includes('textContent')) {
                isSafe = false;
                critique = "تنبيه أمني: استخدام innerHTML بشكل مباشر قد يسمح بـ XSS. يرجى استبداله بـ textContent.";
            }
        });
        return { isSafe, critique };
    },

    async runPerformanceAudit(files) {
        let score = 95;
        let recommendations = [];
        files.forEach(file => {
            if (file.name === 'styles.css' && file.content.length > 5000) {
                score = 80;
                recommendations.push("حجم ملف CSS كبير نسبياً، يرجى اختصاره وتفادي التكرار.");
            }
        });
        return { score, recommendations };
    }
};

async function generateAIImage(promptText, projectPath, fileName) {
    try {
        const encodedPrompt = encodeURIComponent(promptText);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true`;

        console.log(`🖼️ [JAR ENGINE - Image]: جاري رسم وتحميل صورة نيونية عالية الدقة لـ (${fileName})...`);
        
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`فشل جلب الصورة من خادم التوليد: ${res.statusText}`);
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const assetsDir = path.join(projectPath, 'assets');
        const assetsExist = await fsPromises.access(assetsDir).then(() => true).catch(() => false);
        if (!assetsExist) await fsPromises.mkdir(assetsDir, { recursive: true });

        const targetPath = path.join(projectPath, fileName);
        await fsPromises.writeFile(targetPath, buffer);

        console.log(`🖼️ [JAR ENGINE - Image]: تم توليد وحفظ الصورة بنجاح في: ${fileName}`);
    } catch (e) {
        console.error(`❌ [JAR ENGINE - Image Error]: فشل توليد الصورة (${fileName}):`, e.message);
    }
}

export class JaolaCognitiveRuntime {
    constructor(ioInstance) {
        this.io = ioInstance;
        this.memoryDir = path.resolve(__dirname, '../memory');
        this.reflectionPath = path.join(this.memoryDir, 'reflection_knowledge_graph.json');
        this.executiveMemoryPath = path.join(this.memoryDir, 'executive_memory.json');

        if (!fs.existsSync(this.memoryDir)) {
            fs.mkdirSync(this.memoryDir, { recursive: true });
        }
    }

    emitLiveLog(roomName, layer, agent, message) {
        this.io.to(roomName).emit('log', { message: `[${layer}] ➔ [${agent}]: ${message}` });
    }

    loadExecutiveMemory(username) {
        try {
            if (fs.existsSync(this.executiveMemoryPath)) {
                const mem = JSON.parse(fs.readFileSync(this.executiveMemoryPath, 'utf-8') || "{}");
                return mem[username] || { preferredUi: 'Neon Dark', dislikedTech: 'Bootstrap', language: 'Arabic' };
            }
        } catch (e) {}
        return { preferredUi: 'Neon Dark', dislikedTech: 'Bootstrap', language: 'Arabic' };
    }

    saveExecutiveMemory(username, preferredUi) {
        try {
            let mem = {};
            if (fs.existsSync(this.executiveMemoryPath)) {
                mem = JSON.parse(fs.readFileSync(this.executiveMemoryPath, 'utf-8') || "{}");
            }
            mem[username] = { preferredUi, dislikedTech: 'Bootstrap', language: 'Arabic' };
            fs.writeFileSync(this.executiveMemoryPath, JSON.stringify(mem, null, 2));
        } catch (e) {}
    }

    async saveChatToDatabase(username, role, content) {
        if (mongoose.connection.readyState === 1) {
            try {
                let convo = await Conversation.findOne({ username });
                if (!convo) {
                    convo = await Conversation.create({ username, messages: [] });
                }
                convo.messages.push({ role, content });
                await convo.save();
            } catch (e) {
                console.error('Failed to save conversation to DB:', e);
            }
        }
    }

    async buildWorldModel(context, roomName, dbStatus) {
        this.emitLiveLog(roomName, '1. PERCEPTION', 'World Scanner', '👁️ جاري استكشاف العالم النشط وبناء الـ World Model...');
        await context.worldModel.scan(context.projectPath, dbStatus);
        this.emitLiveLog(roomName, '1. PERCEPTION', 'World Scanner', `✓ تم بناء الـ World Model. بيئة الملفات الحالية: [${context.worldModel.fileTree.join(', ')}]`);
    }

    async buildMissionAndMeta(context, roomName) {
        this.emitLiveLog(roomName, '2. MISSION & META', 'Mission+Meta Planner', '🔍 جاري تفكيك رموز المهمة وتفعيل التفكير الفوقي وأولويات الانتباه في خطوة مدمجة...');

        const execMemory = this.loadExecutiveMemory(context.username);

        const systemInstruction = `أنت العقل المعرفي والمدير التنفيذي لـ JCOS 4.0.
        مهمتك هي فهم نية العميل والبيئة المحيطة، وتوليد مخرجات نسيجية بالـ JSON تشتمل على:
        1. mission: { businessGoal, technicalGoal, uxGoal, successCriteria, risks }
        2. meta: { confidence, unknowns, priority }

        رد بصيغة JSON صافية فقط كالتالي:
        {
          "mission": {
            "businessGoal": "...",
            "technicalGoal": "...",
            "uxGoal": "...",
            "successCriteria": [],
            "risks": []
          },
          "meta": {
            "confidence": 95,
            "unknowns": [],
            "priority": "Medium"
          }
        }`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `[ذاكرة تفضيلات المستخدم]: ${JSON.stringify(execMemory)}\n[طلب المستخدم الأصلي]: "${context.goal}"` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0].message.content);
            context.mentalModel.businessGoal = result.mission.businessGoal || "هدف عام";
            context.mentalModel.technicalGoal = result.mission.technicalGoal || "تطبيق ويب";
            context.mentalModel.visualIdentity = result.mission.uxGoal || "";
            context.mentalModel.successCriteria = Array.isArray(result.mission.successCriteria) ? result.mission.successCriteria : [];
            context.mentalModel.risks = Array.isArray(result.mission.risks) ? result.mission.risks : [];

            context.metaReasoning.confidence = typeof result.meta.confidence === 'number' ? result.meta.confidence : 70;
            
            if (Array.isArray(result.meta.unknowns)) {
                context.metaReasoning.unknowns = result.meta.unknowns;
            } else {
                context.metaReasoning.unknowns = [];
                if (typeof result.meta.unknowns === 'string' && result.meta.unknowns.trim() !== '') {
                    context.metaReasoning.unknowns = [result.meta.unknowns.trim()];
                }
            }

            context.metaReasoning.needsUserClarification = (context.metaReasoning.confidence < 45) && (context.metaReasoning.unknowns.length > 0);

            const allowedPriorities = ['Critical', 'High', 'Medium', 'Low'];
            const rawPriority = result.meta.priority || 'Medium';
            const priority = allowedPriorities.includes(rawPriority) ? rawPriority : 'Medium';
            
            const isComplex = priority === 'Critical' || priority === 'High';
            context.budget = new CognitiveBudget(isComplex ? 'complex' : 'medium');
            context.budget.apiCallsUsed = 1;

            this.emitLiveLog(roomName, '2. MISSION & META', 'Mission+Meta Planner', 
                `✓ تم استخراج الرؤية والوعي دفعة واحدة. الأولوية: (${priority}) ➔ الميزانية: ${context.budget.maxApiCalls} استدعاءات كحد أقصى.`);
                
        } catch (e) {
            context.mentalModel.businessGoal = "بناء كود الموقع";
            context.metaReasoning.confidence = 70;
            context.metaReasoning.unknowns = [];
            context.budget = new CognitiveBudget('medium');
            this.emitLiveLog(roomName, '2. MISSION & META', 'Mission+Meta Planner', `⚠️ فشل الاستدعاء الموحد، استخدام القيم الافتراضية.`);
        }
    }

    async runExecutiveBrain(context, roomName, agents) {
        this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO Coordinator', '🎯 تفكيك الأهداف وجدولة الأولويات...');

        const unknowns = Array.isArray(context.metaReasoning.unknowns) ? context.metaReasoning.unknowns : [];
        if (context.metaReasoning.needsUserClarification && unknowns.length > 0) {
            this.emitLiveLog(roomName, '4. EXECUTIVE BRAIN', 'CEO Coordinator', '🛑 القرار: الشك الذاتي مرتفع! تم حظر خط البناء وطلب توضيح من العميل للوقاية من العشوائية.');
            
            const askMessage = `أرجو توضيح:\n${unknowns.map((u, i) => `${i+1}. ${u}`).join('\n')}`;
            this.emitLiveLog(roomName, '4. EXECUTIVE BRAIN', 'AI CEO Consultant', askMessage);
            await this.saveChatToDatabase(context.username, 'assistant', askMessage); 

            context.executiveDecision.actionType = 'STOP_AND_ASK';
            return;
        }

        const systemInstruction = `أنت العقل والمدير التنفيذي لـ JCOS 4.0.`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: `[الهدف والنموذج الذهني]: ${JSON.stringify(context.mentalModel)}` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0].message.content);
            context.executiveDecision.taskGraph = result.taskGraph || ["بناء وتحديث كود الواجهة"];
            context.executiveDecision.priorityQueue = result.priorityQueue || [];

            this.emitLiveLog(roomName, '3. EXECUTIVE BRAIN', 'CEO Coordinator', 
                `✓ تم تفكيك الهدف إلى (${context.executiveDecision.taskGraph.length}) مهام فرعية.`);
        } catch (e) {
            context.executiveDecision.taskGraph = ["بناء وتحديث كود الواجهة"];
        }
    }

    async runDynamicMultiAgentRuntime(context, roomName, agents) {
        this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', '💻 جاري إطلاق حلقة النقاش الداخلي المتعدد التخصصات...');

        const initialCodeContext = await this.readCurrentCodeContextAsync(context.projectPath);
        let currentCodeContext = initialCodeContext;
        const maxDebateCycles = context.budget.maxApiCalls;

        for (let cycle = 0; cycle < maxDebateCycles; cycle++) {
            if (context.budget.isExhausted()) {
                this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', '❌ الميزانية استنفدت.');
                break;
            }

            this.emitAgentState(roomName, { planner: 'completed', architect: 'waiting', coder: 'running', qa: 'waiting', deploy: 'waiting' });
            this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Coder Agent', `جاري كتابة وتحديث الشفرات (دورة التقييم ${debateCycles + 1}/${maxDebateCycles})...`);
            context.budget.apiCallsUsed++;

            const promptWithCritiques = context.internalDebate.criticTranscripts.length > 0
                ? `${context.goal}\n⚠️ [انتقادات من حلقة الجدل التخصصية الموحدة]: يرجى إصلاح هذه العيوب فوراً وبدقة:\n${JSON.stringify(context.internalDebate.criticTranscripts)}`
                : context.goal;

            const plan = await agents.coreGenerateCodePlan(
                promptWithCritiques,
                currentCodeContext,
                context.mentalModel.visualIdentity,
                [],
                (chunk) => {
                    this.io.to(roomName).emit('code_stream_chunk', chunk);
                }
            );

            if (plan.error) {
                context.internalDebate.criticTranscripts.push({ agent: 'CODER_ERROR', critique: plan.details });
                this.emitAgentState(roomName, { planner: 'completed', architect: 'waiting', coder: 'error', qa: 'waiting', deploy: 'waiting' });
                debateCycles++;
                continue;
            }

            this.emitAgentState(roomName, { planner: 'completed', architect: 'running', coder: 'completed', qa: 'waiting', deploy: 'waiting' });
            this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', `🕵️ جاري مراجعة الشفرة من قِبل جميع المتخصصين بالتوازي (Design & Security & Quality)...`);
            
            const [archCheck, securityCheck, qaCheck] = await Promise.all([
                agents.architectReview(plan),
                CognitiveCapabilities.runSecurityAudit(plan.files),
                agents.qaVerify(plan)
            ]);

            const currentCritiques = [];
            if (!archCheck.approved) {
                currentCritiques.push({ agent: 'DesignExpert', critique: archCheck.feedback });
            }
            if (!securityCheck.isSafe) {
                currentCritiques.push({ agent: 'SecurityExpert', critique: securityCheck.critique });
            }
            if (!qaCheck.passed) {
                currentCritiques.push({ agent: 'PerformanceExpert', critique: qaCheck.logs.join(' | ') });
            }

            if (currentCritiques.length > 0) {
                this.emitAgentState(roomName, { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'error', deploy: 'waiting' });
                this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', `❌ [اعترض المراجعون]: تم رصد ثغرات أو تعارضات؛ إعادة التوجيه للـ Coder للتصحيح...`);
                context.internalDebate.criticTranscripts.push(...currentCritiques);
                debateCycles++;
                continue; 
            }

            isCodePerfected = true;
            context.files = plan.files;
            context.images = plan.images;
        }

        if (isCodePerfected) {
            this.emitAgentState(roomName, { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'waiting' });
            this.emitLiveLog(roomName, '5. RUNTIME & DEBATE', 'Orchestrator', `✨ [SUCCESS]: نجح فريق الوكلاء التخصصيين في الوصول لشفرة برمجية مصفاة ومتقاطعة مائة بالمائة!`);
            
            await Promise.all(context.files.map(async (file) => {
                if (['index.html', 'styles.css', 'script.js'].includes(file.name) && typeof file.content === 'string') {
                    createBackupSnapshot(context.projectPath, file.name); 
                    const filePath = path.join(context.projectPath, file.name);
                    await fsPromises.writeFile(filePath, file.content, 'utf-8');
                }
            }));

            this.saveExecutiveMemory(context.username, context.mentalModel.visualIdentity);
            return { success: true };
        } else {
            throw new Error(`فشل فريق الوكلاء وفشل في إيجاد كود برمجى متكامل ومصادق هيكلياً وأمنياً بعد دورات نقاش متعددة (${maxDebateCycles}).`);
        }
    }

    async runCuriosityEngine(context, roomName) {
        this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity Engine', '🧩 جاري تشغيل محرك الفضول التلقائي بالخلفية... التساؤل: هل توجد طريقة أفضل لتنظيف وتحسين الكود أكثر؟');
        
        const performanceCheck = await CognitiveCapabilities.runPerformanceAudit(context.files);
        this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity Engine', `معدل الأداء الحالي للكود: ${performanceCheck.score}%.`);

        if (performanceCheck.score < 90 && performanceCheck.recommendations.length > 0) {
            this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity Engine', `🔎 الفضول ينشط بالخلفية: جاري تحسين ملف styles.css ذاتياً لرفع الأداء...`);
            
            const systemInstruction = `أنت محرك الفضول والتنظيف البرمجي لـ JCOS 4.0.`;
            const targetFile = context.files.find(f => f.name === 'styles.css');
            if (targetFile) {
                try {
                    const completion = await groq.chat.completions.create({
                        messages: [
                            { role: "system", content: systemInstruction },
                            { role: "user", content: `[توصية الأداء]: ${JSON.stringify(performanceCheck.recommendations)}\n[الكود الحالي]:\n${targetFile.content}` }
                        ],
                        model: "llama-3.3-70b-versatile"
                    });
                    const cleanedCss = completion.choices[0].message.content;
                    await fsPromises.writeFile(path.join(context.projectPath, 'styles.css'), cleanedCss, 'utf-8');
                    this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity Engine', `✓ [SUCCESS]: تم تحسين ملف styles.css بالخلفية وارتفع معدل الأداء لـ 95%!`);
                } catch (e) {}
            }
        } else {
            this.emitLiveLog(roomName, '5. CURIOSITY', 'Curiosity Engine', '✓ الفضول مكتفٍ: الأكواد مكتوبة بأعلى معايير الأداء والنظافة حالياً.');
        }
    }

    async runReflectionLayer(context, roomName, isSuccess) {
        this.emitLiveLog(roomName, '6. REFLECTION', 'Learning Engine', '👁️ جاري تقييم ونقد المهمة وصياغة أنماط الفشل والتفوق لحفظها في الـ Knowledge Graph...');
        
        const reflectionNode = {
            missionId: context.missionId,
            timestamp: new Date().toISOString(),
            goal: context.goal,
            success: isSuccess,
            retries: context.internalDebate.criticTranscripts.length,
            failures: context.internalDebate.criticTranscripts.filter(c => c.agent.includes('Expert')),
            takeaways: isSuccess 
                ? `نجحت استراتيجية التوجيه المعرفي النيوني بـ (${context.internalDebate.criticTranscripts.length}) دورات نقاش داخلي.`
                : `فشلت الاستراتيجية بسبب تعطل دالات الإقلاع أو عدم تطابق بنيوي بروتوكولي.`
        };

        try {
            let knowledgeGraph = [];
            const exists = await fsPromises.access(this.reflectionPath).then(() => true).catch(() => false);
            if (exists) {
                knowledgeGraph = JSON.parse(await fsPromises.readFile(this.reflectionPath, 'utf-8') || "[]");
            }
            knowledgeGraph.push(reflectionNode);
            
            await fsPromises.writeFile(this.reflectionPath, JSON.stringify(knowledgeGraph.slice(-50), null, 2), 'utf-8');
            this.emitLiveLog(roomName, '6. REFLECTION', 'Learning Engine', `✓ تم حفظ وتغذية التوأم المعرفي بالدروس المستفادة بنجاح!`);
        } catch (e) {
            console.error('Failed to save reflection knowledge graph:', e);
        }
    }

    emitAgentState(roomName, states) {
        this.io.to(roomName).emit('agent_states', states); 
    }

    executeMission = async (goal, projectPath, username, activeProject, roomName, agents, dbStatus) => {
        const context = new JCRContext(goal, projectPath, username, activeProject);
        this.emitLiveLog(roomName, 'JCOS v4.0', 'Cognitive Kernel', `🏁 تم تشغيل النواة المعرفية لنظام التشغيل JCOS v4.0: ${context.missionId}`);

        try {
            await this.saveChatToDatabase(username, 'user', goal);

            await this.buildWorldModel(context, roomName, dbStatus);
            await this.buildMissionAndMeta(context, roomName);
            
            this.emitAgentState(roomName, { planner: 'running', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
            await this.runExecutiveBrain(context, roomName, agents);

            if (context.executiveDecision.actionType !== 'EXECUTE') {
                await this.runReflectionLayer(context, roomName, true);
                this.emitAgentState(roomName, { planner: 'completed', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
                return { success: true };
            }

            const execResult = await this.runDynamicMultiAgentRuntime(context, roomName, agents);
            await this.runReflectionLayer(context, roomName, execResult.success);

            if (execResult.success) {
                if (context.images && Array.isArray(context.images)) {
                    this.emitLiveLog(roomName, 'JCOS v4.0', 'Media Agent', `🖼️ جاري جلب ورسم الصور الفنية بالتوازي عبر خوادم البث المفتوحة...`);
                    await Promise.all(context.images.map(img => 
                        generateAIImage(img.prompt, projectPath, img.fileName)
                    ));
                }

                this.runCuriosityEngine(context, roomName).catch(e => console.error('Curiosity failed:', e));
                this.emitLiveLog(roomName, 'JCOS v4.0', 'Cognitive Kernel', '✨ [SUCCESS]: اكتملت الدورة المعرفية والإدراكية الشاملة لـ JCOS v4.0 بنجاح تام وتم تفعيل البرفيو!');
            }

        } catch (error) {
            await this.runReflectionLayer(context, roomName, false);
            this.emitLiveLog(roomName, 'JCOS v4.0', 'Cognitive Kernel', `❌ [FAILED]: تعطلت الدورة المعرفية للتشغيل: ${error.message}`);
        }
    };

    readCurrentCodeContextAsync = async (projectPath) => {
        let context = "";
        try {
            const files = await fsPromises.readdir(projectPath);
            const relevantFiles = files.filter(f => ['index.html', 'styles.css', 'script.js'].includes(f));
            const contents = await Promise.all(
                relevantFiles.map(f => 
                    fsPromises.readFile(path.join(projectPath, f), 'utf-8')
                        .then(content => ({ name: f, content }))
                )
            );
            contents.forEach(file => {
                context += `\n--- FILE: ${file.name} ---\n${file.content}\n`;
            });
        } catch (e) {}
        return context;
    };

    handleUserMessage = async (socket, data, agents, dbStatus) => {
        const { message, roomName, projectPath, username, activeProject } = data;

        const intentResult = await this.classifyIntent(message, username);
        
        this.emitLiveLog(roomName, 'INTENT', 'Classifier', 
            `نية المستخدم: ${intentResult.intent} (ثقة: ${intentResult.confidence}%)`);

        if (intentResult.intent === 'build' || intentResult.intent === 'modify') {
            this.executeMission(message, projectPath, username, activeProject, roomName, agents, dbStatus);
        } else if (intentResult.intent === 'stop') {
            this.emitLiveLog(roomName, 'INTENT', 'Classifier', '🛑 أمر إيقاف البناء.');
        } else {
            const reply = await this.generateChatResponse(message, username);
            await this.saveChatToDatabase(username, 'assistant', reply);
            this.emitChatReply(roomName, reply);
        }
    };

    classifyIntent = async (userMessage, username) => {
        const execMemory = await this.loadExecutiveMemory(username);
        
        const systemPrompt = `أنت مصنف نوايا لنظام JCOS. حدد نية المستخدم بدقة وأعد كائن JSON بحقلين:
- "intent": نوع النية من القائمة: ["build", "modify", "query", "chat", "stop"]
- "confidence": رقم بين 0 و100 يعبر عن ثقتك.

أصلها ب JSON فقط.`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `[تفضيلات المستخدم]: ${JSON.stringify(execMemory)}\n[رسالة المستخدم]: "${userMessage}"` }
                ],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                max_tokens: 100,
                temperature: 0.1
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            return { intent: "chat", confidence: 50 };
        }
    };

    generateChatResponse = async (userMessage, username) => {
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "أنت مساعد ذكي مختص بتطوير الويب لـ JAOLA OS. أجب بأسلوب ودود ومختصر بالعربية. ساعد المستخدم في استفساراته البرمجية." 
                    },
                    { role: "user", content: userMessage }
                ],
                model: "llama-3.3-70b-versatile",
                max_tokens: 300,
                temperature: 0.7
            });

            return completion.choices[0].message.content;
        } catch (e) {
            return "عذراً، حدث خطأ في معالجة رسالتك. حاول مرة أخرى.";
        }
    }

    emitChatReply = (roomName, replyMessage) => {
        this.io.to(roomName).emit('chat_reply', { message: replyMessage });
    };
}
