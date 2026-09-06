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

// ⚖️ عنوانُ التقرير من الحكم (PM/2): PASS كما كان؛ UNVERIFIED «اكتمل البناء ولم يكتمل التحقّق»؛
// FAILED «اكتمل البناء لكنّ التحقّق وجد ثغرات» — ولا يُقال «اكتملت المهمة» إلّا لما اجتاز البوّابات.
function verdictLines(verdict, lang) {
    if (!verdict) return { headline: lang === 'ar' ? '✅ اكتملت المهمة — تقرير التسليم:' : '✅ Mission complete — Delivery report:', gateLine: null };
    const bad = (verdict.gates || []).filter(g => g.status === 'fail' || g.status === 'unverified');
    const why = bad.map(g => `${g.name}: ${g.detail}`).join(' • ');
    const gateLine = lang === 'ar' ? `⚖️ التحقّق: ${verdict.summary}` : `⚖️ Verification: ${verdict.summary}`;
    if (verdict.status === 'FAILED') return { headline: lang === 'ar' ? `⚠️ اكتمل البناء لكنّ التحقّق وجد ثغرات — ${why}` : `⚠️ Build complete, but verification found gaps — ${why}`, gateLine };
    if (verdict.status === 'UNVERIFIED') return { headline: lang === 'ar' ? `☑️ اكتمل البناء — ولم يكتمل التحقّق: ${why}` : `☑️ Build complete — verification incomplete: ${why}`, gateLine };
    return { headline: lang === 'ar' ? '✅ اكتملت المهمة — تقرير التسليم:' : '✅ Mission complete — Delivery report:', gateLine };
}

/**
 * ⚖️ رسالةُ بانٍ (Registry/Clone/React) بحكمها (PM/2b): PASS يلحق سطرَ التحقّق؛ UNVERIFIED/FAILED يبدّل أيقونةَ
 * «✅ اكتمل» ويقول ما لم يُتحقَّق أو ما وُجد — فلا يُقال «✅» إلّا لما اجتاز.
 */
export function withVerdict(message, verdict, lang = 'ar') {
    if (!verdict) return message;
    const { headline, gateLine } = verdictLines(verdict, lang);
    if (verdict.status === 'PASS') return `${message}\n${gateLine}`;
    const icon = verdict.status === 'FAILED' ? '⚠️' : '☑️';
    const note = headline.replace(/^[^ ]+ /, '').replace(lang === 'ar' ? /^اكتمل البناء (لكنّ التحقّق وجد ثغرات — |— ولم يكتمل التحقّق: )/ : /^Build complete(, but verification found gaps — | — verification incomplete: )/, '');
    const body = message.replace(/^✅/, icon);
    return `${body}\n${icon} ${lang === 'ar' ? (verdict.status === 'FAILED' ? 'التحقّق وجد ثغرات — ' : 'لم يكتمل التحقّق: ') : (verdict.status === 'FAILED' ? 'Verification found gaps — ' : 'Verification incomplete: ')}${note}\n${gateLine}`;
}

/**
 * ⚖️ سطرُ النواة الختاميّ بحكمه (PM/10): كان «✨ نجاح» حتميّاً على كلِّ مهمّةٍ اكتملت — فيُبثّ بجوار «⚖️ الحكم: FAILED».
 * «✨ نجاح» لما اجتاز (أو لما لا حكمَ له لأنّ شيئاً لم يُبنَ)؛ FAILED: اكتملت المهمّةُ ولم يجتز المنتج؛ وما سواهما: لم يكتمل التحقّق.
 * `note` ملحقُ البُناة (« (قالب jaola عامل)») يبقى كما كان.
 */
export function kernelOutcomeLine(verdict, note = '') {
    if (!verdict || verdict.status === 'PASS') return `✨ نجاح${note}`;
    if (verdict.status === 'FAILED') return `⚠️ اكتملت المهمّة — ولم يجتز المنتجُ التحقّق${note}`;
    return `☑️ اكتملت المهمّة — ولم يكتمل التحقّق${note}`;
}

export function reportMissionSuccess(goal, ctx, reporter, verdict = null) {
    const { projectPath, username, activeProject, roomName } = ctx;
    const langMsg = getUserLanguage(username);

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

    const { headline, gateLine } = verdictLines(verdict, langMsg);
    const reportLines = langMsg === 'ar'
        ? [
            headline,
            gateLine,
            `⏱️ مدة التنفيذ: ${durText}`,
            builtFiles.length ? `📁 الملفات (${builtFiles.length}): ${builtFiles.slice(0, 8).join('، ')}` : null,
            memSections.length ? `🧱 الأقسام: ${memSections.join('، ')}` : null,
            '',
            '🖥️ المعاينة الحية تحدّثت وفُتحت تلقائياً — راجعها الآن.',
            'ما الخطوة التالية؟',
        ].filter(Boolean)
        : [
            headline,
            gateLine,
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
