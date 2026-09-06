/**
 * ⚙️ stages/backend.js — مرحلةُ الخلفية: فريقُ الخلفية المتخصّص (best-effort عبر LLM) ← المولّدُ التقليديّ
 * احتياطاً (`agents.generateBackend` + تكاملُ script.js) ← قاعدةُ البيانات ← Postgres/Prisma ← المصادقة.
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/16 بالمنهج نفسِه: `this` فيها = `emitLiveLog` (٢٨) + مفوِّضُ القارئ
 * (`readCodeContext` يُستورد مباشرةً). `agents` تبقى وسيطاً كما كانت (`needsBackend`، `generateBackend`،
 * `generateFrontendAPIIntegration`). تُستدعى بالاسم من `DELIVERY_STAGES` عبر مفوِّضٍ باقٍ في jcr. نقلٌ حرفيّ.
 */
import { promises as fsPromises } from 'fs';
import path from 'path';
import { smartChat } from '../../core/providers/llm.js';
import { getUserLanguage } from '../languageDetector.js';
import { runBackendTeam, writeBackendTeamFiles } from '../backendTeam/index.js';
import { generateDatabase } from '../databaseAgent.js';
import { generateAuth, needsAuth } from '../authAgent.js';
import { generatePrismaSetup, needsPostgres } from '../postgresAgent.js';
import { readCodeContext } from '../projectReader.js';
import { guardFiles, guardSingleJS } from '../../services/codeGuard.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';
import { getDomainModel } from '../projectMemory.js';
import { modelProjectType } from '../projectModel.js';
import { detectProjectType } from '../knowledgeEngine.js';

// ⚙️ مرحلة Backend — إذا كان المشروع يحتاج خادماً: فريق الخلفية المتخصص
// (best-effort) ← المولّد التقليدي احتياطاً ← قاعدة البيانات/Postgres/المصادقة.
// الجزء الوحيد بلا حارس هو استدعاء agents.needsBackend نفسه (كما كان).
// 🎯 PM/5 — نوعُ المشروع بالدليل لا بالتخمين: بريفُ التصميم أوّلاً (هو نفسُه صار
// يقرأ الفهم)، فالفهمُ المخزّن، فكشفُ النوع من الهدف نفسِه. كان الاحتياطُ ثابتاً
// مكتوباً: 'business' لقاعدة البيانات و'ecommerce' لـPrisma — و'ecommerce' مفتاحٌ
// موجود، فنظامُ تاكسي بلا نوعٍ في البريف كان يأخذ مخطّطَ متجرٍ إلكترونيّ حتميّاً.
function resolveType(context) {
    return context.mentalModel?.designBrief?.projectType
        || modelProjectType(getDomainModel(context.username, context.activeProject))
        || detectProjectType(context.originalGoal);
}

export async function runBackendStage(context, roomName, agents, reporter) {
    const plan = context.plan;
    if (agents.needsBackend && agents.needsBackend(context.goal)) {
        reporter.liveLog(roomName, '5. RUNTIME', 'BackendAgent', '⚙️ المشروع يحتاج خادماً — جاري توليد APIs...');

        // 👥 فريق الوكلاء الخلفي المتخصص — ينتج ملفات الخلفية الحقيقية تعاونياً (best-effort)
        let teamGuidance = '';
        let teamWroteFiles = 0;
        try {
            const buildLang = getUserLanguage(context.username);
            const team = await runBackendTeam(context.goal, {
                lang: buildLang,
                verify: true, // فحص تنفيذي حقيقي + إصلاح Debug تلقائي
                llm: (messages, options) => smartChat(messages, options),
                onEvent: (evt) => {
                    if (evt.type === 'agent_start') reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `${evt.icon} ${evt.role} يعمل...`);
                    else if (evt.type === 'agent_done') reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `✅ ${evt.role}: ${evt.summary} (${evt.files} ملف)`);
                    else if (evt.type === 'agent_skipped') reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `⏭️ ${evt.role} (${evt.reason})`);
                    else if (evt.type === 'verify_failed') reporter.liveLog(roomName, '5. RUNTIME', 'BackendVerify', `🔎 فحص: ${evt.failures} خطأ — Debug يصلح (جولة ${evt.round})...`);
                    else if (evt.type === 'verify_done') reporter.liveLog(roomName, '5. RUNTIME', 'BackendVerify', evt.ok ? `✅ الكود المولّد اجتاز الفحص` : `⚠️ بقي ${evt.failures} خطأ بعد ${evt.rounds} جولة`);
                    else if (evt.type === 'agent_error') reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `⚠️ ${evt.role}: ${evt.error}`);
                },
            });
            const delivered = team.mode === 'execute' ? team.results.filter(r => !r.skipped && !r.error) : [];
            if (team.mode === 'execute' && delivered.length === 0) {
                // لا أحد أنجز (مزوّد غائب/أعطال) — لا وثيقة فريق ولا ادّعاء؛ المولّد التقليدي يتكفّل
                reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `⚠️ لم يُنجز أي وكيل من ${team.results.length} — الاحتياط: المولّد التقليدي`);
            }
            if (team.mode === 'execute' && delivered.length > 0) {
                // احفظ وثيقة مرجعية موجزة — فقط حين يوجد ما يُوثَّق
                const doc = [`# Backend Team\n`, `> ${team.summary}\n`,
                    ...delivered.map(r => `## ${r.role}\n${r.summary}\n`)].join('\n');
                await fsPromises.writeFile(path.join(context.projectPath, 'BACKEND_TEAM.md'), doc).catch(() => {});

                // اكتب ملفات الفريق الحقيقية عبر CodeGuard (فحص/إصلاح قبل الحفظ)
                if (team.files.length > 0) {
                    const guarded = await guardFiles(
                        team.files.map(f => ({ name: f.path, content: f.content })),
                        (m) => reporter.liveLog(roomName, '5. RUNTIME', 'CodeGuard', m)
                    );
                    const byPath = Object.fromEntries(guarded.map(g => [g.name, g.content]));
                    teamWroteFiles = await writeBackendTeamFiles(
                        team.files.map(f => ({ ...f, content: byPath[f.path] ?? f.content })),
                        context.projectPath
                    ).then(w => w.length);
                    reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `📦 كتب الفريق ${teamWroteFiles} ملف خلفية`);
                }
                teamGuidance = `\n\n## توجيهات فريق الخلفية المتخصص (اتبعها ولا تكرّر ملفاته):\n${team.results.filter(r => r.summary).map(r => `- ${r.role}: ${r.summary}`).join('\n')}`;
            }
        } catch (e) {
            reporter.liveLog(roomName, '5. RUNTIME', 'BackendTeam', `⚠️ تخطّي فريق الخلفية: ${e.message}`);
        }

        // إن أنتج الفريق ملفات كافية، نكتفي بها؛ وإلا نُكمل بالمولّد التقليدي (fallback)
        try {
            if (teamWroteFiles >= 2) {
                reporter.liveLog(roomName, '5. RUNTIME', 'BackendAgent', `✅ اعتمد ملفات فريق الخلفية (${teamWroteFiles})`);
            }
            const frontendContext = await readCodeContext(context.projectPath);
            const backendResult = teamWroteFiles >= 2
                ? { success: false, files: [] }   // الفريق كفى — تخطّى المولّد التقليدي
                : await agents.generateBackend(context.goal + teamGuidance, frontendContext);

            if (backendResult.success && backendResult.files.length > 0) {
                // 🛡️ فحص ملفات الـ Backend قبل الحفظ
                backendResult.files = await guardFiles(backendResult.files,
                    (m) => reporter.liveLog(roomName, '5. RUNTIME', 'CodeGuard', m));

                // حفظ ملفات الـ Backend
                for (const file of backendResult.files) {
                    await writeProjectFile(context.projectPath, file.name, file.content);
                }
                reporter.liveLog(roomName, '5. RUNTIME', 'BackendAgent',
                    `✅ تم توليد ${backendResult.files.length} ملف (${backendResult.files.map(f => f.name).join(', ')})`
                );

                // تحديث script.js ليستدعي الـ APIs
                if (agents.generateFrontendAPIIntegration) {
                    const updatedScript = await agents.generateFrontendAPIIntegration(
                        context.goal,
                        backendResult.files,
                        plan.files.find(f => f.name === 'script.js')?.content || ''
                    );
                    if (updatedScript) {
                        // 🛡️ فحص script.js المحدَّث قبل الحفظ
                        const guardedScript = await guardSingleJS('script.js', updatedScript,
                            (m) => reporter.liveLog(roomName, '5. RUNTIME', 'CodeGuard', m));
                        await fsPromises.writeFile(
                            path.join(context.projectPath, 'script.js'),
                            guardedScript
                        );
                        reporter.liveLog(roomName, '5. RUNTIME', 'BackendAgent', '🔗 تم تحديث script.js ليستدعي الـ APIs');
                    }
                }
            } else if (teamWroteFiles < 2) {
                // إنذار حقيقي فقط حين يفشل المولّد التقليدي فعلاً — لا حين
                // يكون الفريق قد كفى (كنا نطبع "undefined" في تلك الحالة)
                reporter.liveLog(roomName, '5. RUNTIME', 'BackendAgent', `⚠️ تعذّر توليد الخادم: ${backendResult.error || 'لم يُنتج ملفات صالحة'}`);
            }
        } catch (e) {
            reporter.liveLog(roomName, '5. RUNTIME', 'BackendAgent', `❌ خطأ في BackendAgent: ${e.message}`);
        }

        // 🆕 DatabaseAgent — يُولّد Schema + Seed Data مع Backend.
        // ⛔ فقط إن لم يتكفّل فريق الخلفية بطبقة البيانات — وإلا نُنتج
        // قاعدتَي بيانات متضاربتين (SQLite من الفريق + MongoDB من هنا).
        if (teamWroteFiles < 2) {
          try {
            // 🎯 PM/5: البريفُ أوّلاً، فالفهمُ، فاعترافٌ لا تخمين — 'unknown' ليست
            // مفتاحاً في أيّ جدول مخطّطات، فيقرأ المولّدُ الهدفَ نفسَه بدل قالبٍ مغاير.
            const projectType = resolveType(context);
            reporter.liveLog(roomName, '5. RUNTIME', 'DatabaseAgent', '🗄️ جاري توليد قاعدة البيانات...');
            const dbResult = await generateDatabase(context.originalGoal, projectType, context.projectPath);
            if (dbResult.success) {
                for (const file of dbResult.files) {
                    await writeProjectFile(context.projectPath, file.name, file.content);
                }
                reporter.liveLog(roomName, '5. RUNTIME', 'DatabaseAgent',
                    `✅ ${dbResult.summary}`
                );
            }
          } catch (e) {
            reporter.liveLog(roomName, '5. RUNTIME', 'DatabaseAgent', `⚠️ تخطّي: ${e.message}`);
          }
        } else {
            reporter.liveLog(roomName, '5. RUNTIME', 'DatabaseAgent', 'ℹ️ فريق الخلفية تكفّل بقاعدة البيانات — تخطّي المولّد المستقل.');
        }

        // 🆕 PostgreSQL + Prisma — للمشاريع التي تحتاج قاعدة علاقية
        // (أيضاً فقط إن لم يتكفّل الفريق — منعاً لتكدّس قواعد البيانات)
        if (teamWroteFiles < 2 && needsPostgres(context.originalGoal)) {
            try {
                reporter.liveLog(roomName, '5. RUNTIME', 'PostgresAgent', '🐘 جاري توليد Prisma Schema...');
                // 🎯 PM/5: كان الاحتياطُ 'ecommerce' — وهو **مفتاحٌ موجود** في
                // `PRISMA_SCHEMAS`، فنظامُ تاكسي بلا نوعٍ في البريف كان يأخذ
                // Product/OrderItem/Review حتميّاً وبلا مزوّد. 'unknown' ليست مفتاحاً.
                const projectType = resolveType(context);
                const pgResult = await generatePrismaSetup(context.originalGoal, projectType);
                if (pgResult.success) {
                    for (const file of pgResult.files) {
                        await writeProjectFile(context.projectPath, file.name, file.content);
                    }
                    reporter.liveLog(roomName, '5. RUNTIME', 'PostgresAgent',
                        `✅ ${pgResult.summary}`
                    );
                } else {
                    // ⚖️ PM/5: الصمتُ هنا كان يخفي كتابةَ قالبٍ مغاير. الآن يُقال ما لم يقع.
                    reporter.liveLog(roomName, '5. RUNTIME', 'PostgresAgent',
                        `⚠️ لم يُولَّد Prisma: ${pgResult.reason || 'سببٌ غير معروف'}`
                    );
                }
            } catch (e) {
                reporter.liveLog(roomName, '5. RUNTIME', 'PostgresAgent', `⚠️ تخطّي: ${e.message}`);
            }
        }

        // 🆕 Auth Agent — يُضيف نظام تسجيل دخول إذا احتاجه المشروع
        if (needsAuth(context.originalGoal)) {
            try {
                reporter.liveLog(roomName, '5. RUNTIME', 'AuthAgent', '🔐 جاري توليد نظام المصادقة...');
                const authResult = await generateAuth(context.originalGoal, context.projectPath, getUserLanguage(context.username));
                if (authResult.success) {
                    for (const file of authResult.files) {
                        await writeProjectFile(context.projectPath, file.name, file.content);
                    }
                    reporter.liveLog(roomName, '5. RUNTIME', 'AuthAgent',
                        `✅ ${authResult.summary}`
                    );
                }
            } catch (e) {
                reporter.liveLog(roomName, '5. RUNTIME', 'AuthAgent', `⚠️ تخطّي: ${e.message}`);
            }
        }
    }
}
