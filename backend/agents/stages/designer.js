/**
 * 🎨 stages/designer.js — قرارٌ بصريّ قبل الـCoder: Design Brief (لوحةٌ حتميّة + تخصيصُ AI إن جرى)
 * يُحفظ في المشروع ويُثبَّت في `context.mentalModel`.
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/14 بالمنهج نفسِه: `this` = `emitLiveLog` فقط. مستدعٍ واحد
 * (`runDynamicMultiAgentRuntime`، قبل النقاش). نقلٌ حرفيّ.
 */
import { getUserLanguage } from '../languageDetector.js';
import { generateDesignBrief, saveDesignBrief } from '../designerAgent.js';

// 🎨 مرحلة Designer Agent — قرار بصري قبل Coder (احتياط حتمي: لوحة minimal)
export async function runDesigner(context, roomName, reporter) {
    try {
        reporter.liveLog(roomName, '5. RUNTIME', 'DesignerAgent', '🎨 جاري توليد الـ Design Brief...');
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
            // 📌 السطر يقول ما جرى فعلاً: لوحةٌ دائماً، وتخصيصُ AI إن جرى
            // وسببُ تخلّفه إن لم يجرِ. كان يعلن ✅ فوق تخصيصٍ لم يقع قطّ.
            reporter.liveLog(roomName, '5. RUNTIME', 'DesignerAgent',
                `✅ Design Brief — ${brief.paletteName} palette`
                + (brief.aiEnhanced ? ' + تخصيص AI' : ` (بلا تخصيص AI: ${brief.aiSkipReason})`)
            );
        }
    } catch (e) {
        reporter.liveLog(roomName, '5. RUNTIME', 'DesignerAgent', `⚠️ تخطّي: ${e.message}`);
    }
}
