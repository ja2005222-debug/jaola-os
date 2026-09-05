/**
 * 🚀 stages/renderConfig.js — إعدادُ المشروع للنشر على Render: اسمُ الخدمة من
 * المصدر الواحد، قرارُ الخلفيّة (نيّةٌ من الهدف) يُحفظ في ذاكرة المشروع مع
 * `apis` (دليلٌ من القرص)، ثمّ `render.yaml` بالشكل المطابق.
 *
 * خامسُ مرحلةٍ تخرج من `JaolaCognitiveRuntime` (JCR/9). قِيست: `this` = بثٌّ
 * واحد؛ تُنادى بالاسم من `DELIVERY_STAGES` فالمفوِّضُ يُبقيها. نقلٌ حرفيّ.
 * ⚠️ حارسُ `renderConfigShape` يثبّت موضعَ نداءِ إعداد النشر بـ`hasBackend`
 *    سطراً ومِلفّاً — انتقل معها إلى هنا وأُعيد تثبيتُه عمداً (لا يُذكر النداءُ
 *    هنا بصيغته كي لا يعدّه الحارسُ موضعاً).
 */
import { needsBackend } from '../backendAgent.js';
import { listApiModules } from '../deployAgent.js';
import { prepareRenderDeploy, renderServiceName } from '../renderAgent.js';
import { updateTech } from '../projectMemory.js';

export async function runRenderConfig(context, roomName, reporter) {
    try {
        // 🏷️ اسم الخدمة من المصدر الواحد — كان هذا الموضع وحده يطهّر
        // المشروع دون اسم المستخدم، فيكتب `guest_user-…` في render.yaml
        // بينما تستعمل بقية المسارات `guest-user-…`: هويتان لمشروعٍ واحد.
        const serviceName = renderServiceName(context.username, context.activeProject);
        const hasBackend = needsBackend(context.originalGoal);

        // 🔀 القرارُ يُحفظ لا يُنسى. كان `tech.hasBackend` و`tech.apis`
        //    حقلَين **لا يكتبهما أحد**: يبقيان على قيمتهما الابتدائية
        //    (`false` و`[]`) أبداً، وثلاثةُ قرّاءٍ يعتمدون عليهما فلا
        //    يقع أيٌّ منهم. `hasBackend` **نيّةٌ** مشتقّةٌ من الهدف،
        //    و`apis` **دليلٌ** مجرودٌ من القرص — ولا يُخلطان.
        try {
            updateTech(context.username, context.activeProject, {
                hasBackend,
                apis: listApiModules(context.projectPath),
            });
        } catch { /* حفظُ الذاكرة لا يُسقط بناءً ناجحاً */ }

        const renderResult = await prepareRenderDeploy(context.projectPath, serviceName, hasBackend);
        if (renderResult.success) {
            reporter.liveLog(roomName, '5. RUNTIME', 'RenderAgent',
                `✅ ${renderResult.summary}`
            );
        }
    } catch (e) { console.warn('[RenderDeploy]', 'فشل إعداد النشر:', e.message); }
}
