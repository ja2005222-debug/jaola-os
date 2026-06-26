import fs from 'fs';
import path from 'path';
import { ai } from './baseAgent.js'; 

// دالة توليد الأصول والصور المفتوحة فائقة السرعة مدمجة بداخل بيئة التشغيل لسرعة استجابة الوكلاء
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
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const targetPath = path.join(projectPath, fileName);
        fs.writeFileSync(targetPath, buffer);

        console.log(`🖼️ [JAR ENGINE - Image]: تم توليد وحفظ الصورة بنجاح في: ${fileName}`);
    } catch (e) {
        console.error(`❌ [JAR ENGINE - Image Error]: فشل توليد الصورة (${fileName}):`, e.message);
    }
}

// تعريف هيكل الحالة المشتركة لبيئة تشغيل الوكلاء (Unified Shared Context)
class AgentState {
    constructor(missionGoal, projectPath, username, activeProject) {
        this.missionId = `mission_${Date.now()}`;
        this.goal = missionGoal;
        this.projectPath = projectPath;
        this.username = username;
        this.activeProject = activeProject;
        this.currentStep = 'planning'; // 'planning' | 'coding' | 'auditing' | 'testing' | 'completed' | 'failed'
        this.files = [];               
        this.images = [];
        this.agentLogs = [];           
        this.errors = [];              
        this.retryCount = 0;           
        this.maxRetries = 3;           
    }

    addLog(agentName, message) {
        this.agentLogs.push({
            timestamp: new Date().toLocaleTimeString(),
            agent: agentName,
            message
        });
    }

    addError(agentName, errorDetail) {
        this.errors.push({
            timestamp: new Date().toLocaleTimeString(),
            agent: agentName,
            detail: errorDetail
        });
    }
}

// محرك تشغيل وإدارة دورة حياة الوكلاء (JAOLA Agent Runtime - JAR)
export class JaolaAgentRuntime {
    constructor(ioInstance) {
        this.io = ioInstance; 
    }

    emitLiveLog(roomName, agentTag, message) {
        this.io.to(roomName).emit('log', { message: `[${agentTag}]: ${message}` });
    }

    emitAgentState(roomName, states) {
        this.io.to(roomName).emit('agent_states', states);
    }

    async executeMission(goal, projectPath, username, activeProject, roomName, agents) {
        // 1. توليد وتهيئة الحالة المشتركة للمهمة
        const state = new AgentState(goal, projectPath, username, activeProject);
        this.emitLiveLog(roomName, 'JAR ENGINE', `🏁 تم بدء تشغيل بيئة الوكلاء المستقلة للمهمة: ${state.missionId}`);

        try {
            // 2. مرحلة التخطيط والفرز (CEO & Mission Planner)
            state.currentStep = 'planning';
            this.emitAgentState(roomName, { planner: 'running', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
            this.emitLiveLog(roomName, 'CEO / PLANNER', `🧠 جاري دراسة الهدف وتفكيكه لمهام إنشائية متناسقة...`);
            
            const intent = await agents.coreClassifyIntent(state.goal);
            if (intent.error) {
                throw new Error(`تعطل المخطط: ${intent.details}`);
            }
            state.addLog('CEO', 'تمت هندسة النية وتحديد المجال: ' + intent.category);

            // 🛡️ التعديل الحاسم: في حال تصنيف النية كمحادثة عامة (GENERAL_CHAT)، توقف فوراً ولا تقم ببناء الأكواد!
            if (intent.type === "GENERAL_CHAT") {
                this.emitLiveLog(roomName, 'AI CEO Consultant', intent.reply || "أنا هنا لإرشادك ومساعدتك؛ تفضل بطلب أي تعديل برمجى.");
                this.emitAgentState(roomName, { planner: 'completed', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
                return { success: true, isGeneralChat: true };
            }

            // 3. حلقة البناء والتصحيح الذاتي التكرارية (Autonomous Coding & QA Loop)
            let isMissionSuccessful = false;
            
            while (state.retryCount < state.maxRetries && !isMissionSuccessful) {
                state.currentStep = 'coding';
                this.emitAgentState(roomName, { planner: 'completed', architect: 'waiting', coder: 'running', qa: 'waiting', deploy: 'waiting' });
                this.emitLiveLog(roomName, 'CODER AGENT', `💻 جاري الآن توليد الشفرات وحقن الإضافات (المحاولة ${state.retryCount + 1}/${state.maxRetries})...`);

                // جلب سياق الكود الحالي لتمريره للمبرمج
                let currentCodeContext = this.readCurrentCodeContext(projectPath);
                
                // صياغة خطة التعديل مع حقن الأخطاء السابقة للإصلاح الذاتي إن وجدت
                const promptWithErrors = state.errors.length > 0 
                    ? `${state.goal}\n⚠️ تنبيه من وكيل الجودة: حدثت الأخطاء التالية في محاولتك السابقة، يرجى إصلاحها وتجنبها:\n${JSON.stringify(state.errors)}`
                    : state.goal;

                const plan = await agents.coreGenerateCodePlan(
                    promptWithErrors, 
                    currentCodeContext, 
                    intent.category, 
                    [], 
                    (chunk) => {
                        this.io.to(roomName).emit('code_stream_chunk', chunk); // بث مباشر حركي للكود
                    }
                );

                if (plan.error) {
                    state.addError('CODER', plan.details);
                    state.retryCount++;
                    continue; 
                }

                // 4. مراجعة البنية وتأصيل القواعد (Architect Review)
                state.currentStep = 'auditing';
                this.emitAgentState(roomName, { planner: 'completed', architect: 'running', coder: 'completed', qa: 'waiting', deploy: 'waiting' });
                this.emitLiveLog(roomName, 'ARCHITECT AGENT', `🏗️ جاري التحقق الهيكلي من مطابقة معايير القوالب البصرية...`);
                
                const archCheck = agents.architectReview(plan);
                if (!archCheck.approved) {
                    this.emitLiveLog(roomName, 'ARCHITECT ALERT', `⚠️ تعثر الفحص الهيكلي: ${archCheck.feedback}`);
                    state.addError('ARCHITECT', archCheck.feedback);
                    state.retryCount++;
                    continue; 
                }

                // 5. فحص واختبار الجودة (QA Verification)
                state.currentStep = 'testing';
                this.emitAgentState(roomName, { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'running', deploy: 'waiting' });
                this.emitLiveLog(roomName, 'QA AGENT', `🔍 جاري تشغيل الفحوصات والترابط البصري محلياً...`);

                const qaCheck = agents.qaVerify(plan);
                qaCheck.logs.forEach(logMsg => {
                    this.emitLiveLog(roomName, 'QA REPORT', logMsg);
                });

                if (!qaCheck.passed) {
                    this.emitLiveLog(roomName, 'QA ALERT', `❌ لم يجتز الكود فحص الجودة البرمجية، جاري إرسال التقرير للمبرمج للإصلاح الذاتي...`);
                    state.addError('QA', qaCheck.logs.join(' | '));
                    state.retryCount++;
                    continue; 
                }

                isMissionSuccessful = true;
                state.files = plan.files;
                state.images = plan.images;
                state.addLog('JAR', 'اجتازت المهمة البرمجية الفحوصات بنجاح!');
            }

            // 7. معالجة وحفظ الناتج النهائي للمهمة أو إعلان الفشل
            if (isMissionSuccessful) {
                this.emitLiveLog(roomName, 'JAR ENGINE', `✨ [SUCCESS]: نجح فريق الوكلاء في إتمام المهمة بعدد محاولات (${state.retryCount + 1})! جاري الحفظ والتأصيل...`);
                
                // حفظ الملفات الفعلي على القرص
                state.files.forEach(file => {
                    if (['index.html', 'styles.css', 'script.js'].includes(file.name) && typeof file.content === 'string') {
                        const filePath = path.join(projectPath, file.name);
                        fs.writeFileSync(filePath, file.content);
                    }
                });

                // 🖼️ التوليد والحقن الحركي للصور المستهدفة بـ Imagen 3 إن طلبت في خطة المبرمج المعتمدة
                if (state.images && Array.isArray(state.images)) {
                    this.emitLiveLog(roomName, 'JAR ENGINE', `🖼️ جاري الاستعانة بـ Imagen 3 لتوليد الصور المخصصة حياً بالخلفية...`);
                    for (const img of state.images) {
                        this.emitLiveLog(roomName, 'Imagen 3', `جاري رسم وتفصيل صورة (${img.fileName}) بأعلى دقة نيون...`);
                        await generateAIImage(img.prompt, projectPath, img.fileName);
                    }
                }

                state.currentStep = 'completed';
                this.emitAgentState(roomName, { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'waiting' });
                return { success: true, files: state.files, images: state.images };
            } else {
                state.currentStep = 'failed';
                this.emitAgentState(roomName, { planner: 'completed', architect: 'completed', coder: 'error', qa: 'error', deploy: 'waiting' });
                throw new Error(`فشل فريق الوكلاء في إصلاح الشفرة بعد محاولات مكثفة (${state.maxRetries}).`);
            }

        } catch (error) {
            this.emitLiveLog(roomName, 'JAR ENGINE', `❌ [FAILED]: تعطل محرك تشغيل الوكلاء: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // دالة مساعدة لقراءة الكود الفعلي الحالي
    readCurrentCodeContext(projectPath) {
        let context = "";
        try {
            const files = fs.readdirSync(projectPath);
            files.forEach(f => {
                if (['index.html', 'styles.css', 'script.js'].includes(f)) {
                    context += `\n--- FILE: ${f} ---\n${fs.readFileSync(path.join(projectPath, f), 'utf-8')}\n`;
                }
            });
        } catch (e) {}
        return context;
    }
}
