/**
 * 🧪 stages/quality.js — مراحلُ الجودة الستّ بعد الكتابة: المراجعة (مع إصلاحٍ تلقائيّ وتسجيلِ درجة)،
 * التنظيف، الاختبار، SEO (ملفّاتٌ جديدة + درجة)، الأمان (ملفّاتٌ جديدة + درجة)، والنسخُ الاحتياطيّ مع commit.
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/13 بالمنهج نفسِه: كلُّها بالشكل `(context, roomName)`،
 * `this` فيها = `emitLiveLog` فقط، ولا تستدعي طرائقَ الصنف. تُستدعى بالاسم من `DELIVERY_STAGES`
 * عبر مفوِّضاتٍ باقيةٍ في jcr. نقلٌ حرفيّ.
 */
import { getUserLanguage } from '../languageDetector.js';
import { transitionState, STATES } from '../stateMachine.js';
import { runSEO } from '../seoAgent.js';
import { runSecurity } from '../securityAgent.js';
import { refactorCode } from '../refactorAgent.js';
import { reviewCode } from '../reviewAgent.js';
import { runTests } from '../testingAgent.js';
import { commitBuild } from '../gitAgent.js';
import { backupProject } from '../fileManager.js';
import { recordScore } from '../../services/metricsStore.js';
import { writeProjectFile, writePlanFiles } from '../../core/runtime/workspacePaths.js';

// 🆕 Review Agent — يراجع ويُصلح تلقائياً قبل العرض النهائي
export async function runReviewStage(context, roomName, reporter) {
    const plan = context.plan;
    transitionState(context.username, context.activeProject, STATES.REVIEWING, { agent: 'ReviewAgent' });
    try {
        reporter.liveLog(roomName, '5. RUNTIME', 'ReviewAgent', '🔍 مراجعة جودة الكود...');
        const reviewResult = await reviewCode(plan.files, context.originalGoal, getUserLanguage(context.username));

        if (reviewResult.fixedCount > 0) {
            // حفظ الملفات المُصلحة — كل الملفات، لا القائمة البيضاء
            await writePlanFiles(context.projectPath, reviewResult.fixedFiles);
            plan.files = reviewResult.fixedFiles;
        }

        const statusEmoji = reviewResult.grade === 'A' ? '✅' : reviewResult.grade === 'B' ? '🟡' : '🟠';
        reporter.liveLog(roomName, '5. RUNTIME', 'ReviewAgent',
            `${statusEmoji} الجودة: ${reviewResult.grade} (${reviewResult.score}/100) — ${reviewResult.overallQuality}${reviewResult.fixedCount > 0 ? ` — تم إصلاح ${reviewResult.fixedCount} مشكلة` : ''}`
        );
        // 📊 تسجيل درجة الجودة الفعلية للوحة الذكاء
        recordScore(context.username, context.activeProject, 'quality', reviewResult);
    } catch (e) {
        reporter.liveLog(roomName, '5. RUNTIME', 'ReviewAgent', `⚠️ تخطّي: ${e.message}`);
    }
}

// 🆕 Refactor Agent — تنظيف الكود
export async function runRefactorStage(context, roomName, reporter) {
    const plan = context.plan;
    try {
        const refactorResult = await refactorCode(plan.files, getUserLanguage(context.username));
        if (refactorResult.success) {
            plan.files = refactorResult.files;
            if (refactorResult.totalReduction > 0) {
                reporter.liveLog(roomName, '5. RUNTIME', 'RefactorAgent',
                    `✅ ${refactorResult.summary}`
                );
            }
        }
    } catch (e) { console.warn('[RefactorAgent]', 'فشل التحسين (تخطٍّ):', e.message); }
}

// 🆕 Testing Agent — اختبار شامل للكود المُنتج
export async function runTestingStage(context, roomName, reporter) {
    const plan = context.plan;
    try {
        if (!plan?.files) throw new Error('plan is not defined');
        const testResult = await runTests(plan.files, getUserLanguage(context.username));
        const emoji = testResult.grade === 'A' ? '✅' : testResult.grade === 'B' ? '🟡' : '🟠';
        reporter.liveLog(roomName, '5. RUNTIME', 'TestingAgent',
            `${emoji} ${testResult.report}`
        );
        // إذا كان هناك اختبارات فاشلة — سجّلها كتحذير
        if (testResult.failedTests.length > 0) {
            reporter.liveLog(roomName, '5. RUNTIME', 'TestingAgent',
                `⚠️ اختبارات فاشلة: ${testResult.failedTests.join(' | ')}`
            );
        }
    } catch (e) {
        reporter.liveLog(roomName, '5. RUNTIME', 'TestingAgent', `⚠️ تخطّي: ${e.message}`);
    }
}

// 🆕 SEO Agent
export async function runSeoStage(context, roomName, reporter) {
    const plan = context.plan;
    try {
        const projectName = context.originalGoal?.split(' ').slice(0, 3).join(' ') || context.activeProject;
        const seoResult = await runSEO(plan.files, {
            name: projectName,
            description: context.originalGoal?.slice(0, 150) || projectName,
            url: `https://${context.username}-${context.activeProject}.vercel.app`,
            lang: getUserLanguage(context.username),
        });
        if (seoResult.success) {
            plan.files = seoResult.files;
            // حفظ robots.txt و sitemap.xml
            for (const file of seoResult.newFiles) {
                await writeProjectFile(context.projectPath, file.name, file.content);
            }
            reporter.liveLog(roomName, '5. RUNTIME', 'SEOAgent', `✅ ${seoResult.summary}`);
            // 📊 حزمة SEO كاملة طُبقت (robots + sitemap + meta + schema)
            recordScore(context.username, context.activeProject, 'seo', seoResult);
        }
    } catch (e) {
        reporter.liveLog(roomName, '5. RUNTIME', 'SEOAgent', `⚠️ تخطّي: ${e.message}`);
    }
}

// 🆕 Security Agent
export async function runSecurityStage(context, roomName, reporter) {
    const plan = context.plan;
    try {
        const secResult = await runSecurity(plan.files);
        if (secResult.success) {
            // لا إسنادَ لـfixedFiles: لم يعد ثمّة مُصلِحٌ يغيّر شيئاً هنا
            for (const file of secResult.newFiles) {
                await writeProjectFile(context.projectPath, file.name, file.content);
            }
            const secEmoji = secResult.grade === 'A' ? '✅' : secResult.grade === 'B' ? '🟡' : '🟠';
            reporter.liveLog(roomName, '5. RUNTIME', 'SecurityAgent',
                `${secEmoji} ${secResult.summary}`
            );
            // 📊 تسجيل درجة الأمان الفعلية
            recordScore(context.username, context.activeProject, 'security', secResult);
        }
    } catch (e) {
        reporter.liveLog(roomName, '5. RUNTIME', 'SecurityAgent', `⚠️ تخطّي: ${e.message}`);
    }
}

// 🆕 Git Agent — commit تلقائي + نسخة احتياطية (اختياري — لا يوقف البناء)
export async function runGitBackupStage(context, roomName, reporter) {
    try {
        await backupProject(context.projectPath, 'build');
        const commitResult = await commitBuild(
            context.projectPath,
            context.originalGoal?.slice(0, 60) || context.goal.slice(0, 60),
            'build'
        );
        if (commitResult.success && !commitResult.skipped) {
            reporter.liveLog(roomName, '5. RUNTIME', 'GitAgent',
                `✅ تم الحفظ [${commitResult.hash}]`
            );
        }
    } catch (e) {
        // Git اختياري — لا يوقف البناء
    }
}
