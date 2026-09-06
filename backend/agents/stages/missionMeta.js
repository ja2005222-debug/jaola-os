/**
 * 🔍 stages/missionMeta.js — المرحلةُ الثانية من النواة «2. MISSION & META»: تفكيكُ الهدف إلى مهمّةٍ (أعمال/تقنيّة/تجربة/معايير/مخاطر)
 * ووعيٍ ذاتيّ (ثقة/مجاهيل/أولويّة) باستدعاءِ نموذجٍ واحد بصيغة JSON، ثمّ ميزانيةٌ معرفيّة تُشتقّ من الأولويّة (`complex` ١٥ استدعاءً
 * لـCritical/High، وإلّا `medium` ٧)؛ وعلى أيّ تعذّر (ميزانيةٌ مستنفدة، لا مزوّد، JSON معطوب) احتياطٌ حتميّ: هدفٌ عامّ وثقة ٧٠ وميزانية
 * `medium` مع سببٍ يُقال كما هو في السجلّ. المجاهيلُ التي تكشفها الثقةُ المنخفضة تُعرض للمستخدم بشفافية (`noteUnknowns`).
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/30 بالمنهج نفسِه: `this` = البثُّ (٣ + ٢) + `loadExecutiveMemory` (تقرأ `executiveMemoryPath`
 * على النسخة → `ops`) + `_noteUnknowns` (تخرج معها). صنفُ الميزانية `CognitiveBudget` يخرج معها لأنّها مستهلكُه الوحيد (المراحلُ الأخرى
 * تستهلك *النسخة* عبر `context.budget`). عميلُ النموذج `groq` يُحقَن بمعاملٍ افتراضيّ على سابقة `router` في JCR/27. لا `io`.
 * مستدعٍ واحد (`_runMissionNow`) + اختباراتُ التوصيف على المفوِّض. نقلٌ حرفيّ.
 */
import { groq } from '../../core/providers/llm.js';

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

// المُبلِّغُ يُمرَّر؛ ذاكرةُ التفضيلات عبر `ops.loadExecutiveMemory` (تقرأ مسارَ النسخة)؛ عميلُ النموذج يُحقَن بمعاملٍ افتراضيّ
// `client = groq` على سابقة `router` في JCR/27 — فيُوصَّف مسارُ النجاح (ثقة ≤ ١ → مئويّة، الأولويّة → الميزانية، المجاهيل) بلا شبكة.
export async function runMissionMeta(context, roomName, reporter, ops, client = groq) {
    reporter.liveLog(roomName, '2. MISSION & META', 'Mission+Meta', '🔍 تفكيك الهدف والوعي الذاتي...');
    const execMemory = await ops.loadExecutiveMemory(context.username);
    try {
        if (!context.budget) context.budget = new CognitiveBudget();
        if (!context.budget.consumeCall()) throw new Error('Budget exhausted');
        // بلا مزوّد كان السطر التالي يرمي «Cannot read properties of null (reading 'chat')»
        // فيبدو عطلاً برمجياً في السجل — السبب الحقيقي غياب المزوّد، ونقوله كما هو
        if (!client) throw new Error('لا مزوّد AI مُهيأ');
        const completion = await client.chat.completions.create({
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
        noteUnknowns(context, roomName, reporter);

        const allowed = ['Critical', 'High', 'Medium', 'Low'];
        const priority = allowed.includes(result.meta.priority) ? result.meta.priority : 'Medium';
        context.budget = new CognitiveBudget(priority === 'Critical' || priority === 'High' ? 'complex' : 'medium');
        context.budget.apiCallsUsed = 1;
        reporter.liveLog(roomName, '2. MISSION & META', 'Mission+Meta', `✓ الأولوية: ${priority}, الميزانية: ${context.budget.maxApiCalls} استدعاءات.`);
    } catch (e) {
        context.mentalModel.businessGoal = "بناء كود الموقع";
        context.metaReasoning.confidence = 70;
        context.budget = new CognitiveBudget('medium');
        reporter.liveLog(roomName, '2. MISSION & META', 'Mission+Meta',
            `ℹ️ تعذّر تحليل المهمة (${e.message}) — الاحتياط الحتمي: ميزانية medium (${context.budget.maxApiCalls} استدعاءات)`);
    }
}

// 🟡 المجاهيل التي كشفها تحليل المهمة تُعرض للمستخدم بشفافية (كانت الجزء
// الوحيد المفيد في «Executive Brain» المحذوف — استدعاء LLM كان يُنتج
// taskGraph لا يقرؤه أي سطر، راجع ARCHITECTURE_MIGRATION.md).
export function noteUnknowns(context, roomName, reporter) {
    const unknowns = Array.isArray(context.metaReasoning?.unknowns) ? context.metaReasoning.unknowns : [];
    if (!context.metaReasoning?.needsUserClarification || unknowns.length === 0) return false;
    reporter.liveLog(roomName, '2. MISSION & META', 'Mission+Meta', '🟡 ملاحظة: توجد مجاهيل، لكننا سنحاول المتابعة.');
    reporter.liveLog(roomName, '2. MISSION & META', 'Mission+Meta', `الأسئلة المحتملة:\n${unknowns.map((u, i) => `${i + 1}. ${u}`).join('\n')}`);
    return true;
}
