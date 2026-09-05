/**
 * 🧩 stages/enrich.js — إثراءُ سياق البناء: محلّلُ المتطلبات الضمنيّة + صورٌ
 * مطابقة + توجيهاتُ وكلاء الإضافات (hook beforeBuild). كلُّها اختياريّة.
 *
 * ثالثُ طريقةٍ تخرج من `JaolaCognitiveRuntime` (JCR/6). قِيست قبل النقل: لا تلمس
 * من `this` إلّا البثَّ (٢ `emitLiveLog`)، مستدعيها واحد (`_runMissionNow`)، وثلاثةٌ
 * من استيراداتها يتيمةٌ في `jcr` بعدها. أمّا `resolveProjectType` فكانت تصديراً من
 * `jcr` لها مستهلكٌ ثانٍ فيه (`_selectBuildStrategy`) واختبارٌ يستوردها منه — فرحلت
 * إلى هنا، و`jcr` يستوردها ويعيد تصديرها: لا دورةَ، ولا كسرَ للمستورِدين.
 * نقلٌ حرفيّ: `this.emitLiveLog` → `reporter.liveLog`.
 */
import { detectProjectType } from '../knowledgeEngine.js';
import { analyzeRequirements, buildRequirementsContext } from '../requirementAnalyzer.js';
import { orchestrator } from '../../core/PluginOrchestrator.js';
import { buildImageContext } from '../../services/imageService.js';

/**
 * نوع المشروع للتوجيه والمتطلبات: فئة المخطّط فقط حين تأتي من النموذج —
 * الاحتياط يضع 'business' دائماً فكان يعطّل الموجّه الهجين ومحلّل المتطلبات
 * كلما غاب الـLLM (عطل كشفه التوصيف، راجع ARCHITECTURE_MIGRATION.md).
 */
export function resolveProjectType(goal, blueprint) {
    return blueprint?.category && blueprint.category !== 'other' && blueprint._source !== 'fallback'
        ? blueprint.category
        : detectProjectType(goal);
}

export async function enrichBuildContext(goal, blueprint, ctx, reporter) {
    const { projectPath, username, activeProject, roomName } = ctx;
    // 🆕 Smart Requirement Analyzer — يُثري الهدف بمتطلبات ضمنية
    let requirementsContext = '';
    let imageContext = '';
    // نوع المشروع من المخطط الذكي (أدق من كشف الكلمات المفتاحية) مع احتياط
    let projectType = 'business';
    try { projectType = resolveProjectType(goal, blueprint); } catch { /* الاحتياط أعلاه */ }

    // 🧱 إثراءان مستقلّان، ولكلٍّ احتياطه. كانا في try واحدة، فسقوطُ
    // المحلّل يُسقط الصور معه صامتاً — وهما لا يعتمد أحدهما على الآخر.
    try {
        const reqAnalysis = await analyzeRequirements(goal, projectType);
        requirementsContext = buildRequirementsContext(reqAnalysis);
    } catch (e) { /* اختياري */ }

    try {
        // 🖼️ صور حقيقية مطابقة للموضوع تُحقن في سياق البناء
        const img = await buildImageContext(goal, projectType, activeProject);
        imageContext = img.context;
        reporter.liveLog(roomName, 'ASSETS', 'ImageService', `🖼️ جُهزت ${img.count} صور (${img.source})`);
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
            reporter.liveLog(roomName, 'PLUGINS', 'beforeBuild',
                `🔌 شارك ${guidance.length} وكيل إضافي في التوجيه`);
        }
    } catch (e) { /* الإضافات اختيارية */ }
    return { requirementsContext, imageContext, pluginContext };
}
