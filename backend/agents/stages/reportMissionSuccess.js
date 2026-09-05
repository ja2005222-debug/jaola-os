/**
 * 📣 stages/reportMissionSuccess.js — ما بعد النجاح: تقريرُ التسليم بلغة المستخدم،
 * الاقتراحات، قائمةُ الملفّات، الدفعُ التلقائيّ، اللقطةُ الدائمة، المقاييس، وhook afterBuild.
 *
 * يخرج من `JaolaCognitiveRuntime` في JCR/11 بالمنهج نفسِه: `this` = البثُّ + `io` قيمةً
 * للدفع التلقائيّ (`reporter.io`، موضعٌ واحد — انظر JCR/10). مستدعٍ واحد (`_runMissionNow`).
 * نقلٌ حرفيّ؛ الدالّةُ متزامنةٌ كما كانت (ما بعدها وعودٌ لا تُنتظَر).
 */
import fs from 'fs';
import { getUserLanguage } from '../languageDetector.js';
import { getProjectSummary } from '../stateMachine.js';
import { getProjectMemory } from '../projectMemory.js';
import { orchestrator } from '../../core/PluginOrchestrator.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { recordBuild, buildMetricsPayload } from '../../services/metricsStore.js';

export function reportMissionSuccess(goal, ctx, reporter) {
    const { projectPath, username, activeProject, roomName } = ctx;
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

    reporter.send(roomName, 'chat_reply', {
        message: reportLines.join('\n'),
        options: suggestions,
    });

    // 🛠️ تحديث قائمة الملفات في الواجهة بعد البناء (كانت تبقى فارغة)
    reporter.send(roomName, 'workspace_files', builtFiles);

    // 🐙 الدفع التلقائي لـ GitHub إذا كان مفعلاً لهذا المشروع
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});

    // 🗄️ لقطة دائمة لملفات المشروع في MongoDB — تنجو من إعادة نشر Render
    snapshotWorkspace(username, activeProject, projectPath)
        .then(r => { if (r.success) reporter.liveLog(roomName, 'STORAGE', 'Snapshot', `🗄️ حُفظت نسخة دائمة (${r.count} ملف)`); })
        .catch(() => {});

    // 📊 تسجيل البناء + بث المقاييس الحقيقية للوحة الذكاء
    recordBuild(username, activeProject, {
        success: true, durationSec, filesCount: builtFiles.length, goal: goal || '',
    });
    reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));

    // 🔌 وكلاء الإضافات: hook afterBuild — تنفيذ ما بعد البناء
    orchestrator.runHook('afterBuild', {
        success: true, goal, username, project: activeProject, projectPath, files: builtFiles,
    }).catch(() => {});
}
