/**
 * ⚛️ stages/buildReact.js — بناءُ مشروع React/Next حقيقيّ: سكافولد Next + Tailwind بمحتوىً مكتوبٍ بالذكاء (best-effort)،
 * تخصيصُ كلِّ صفحةٍ بقيت افتراضيّة، معاينةٌ ثابتة متعدّدةُ الصفحات، لوحةُ تحكّم العميل، نهائيّاتُ النجاح، ثمّ تحقّقٌ
 * سلوكيّ بلا إصلاح (لا `agents` في هذا المسار).
 *
 * يخرج من `JaolaCognitiveRuntime` في JCR/19 بالمنهج نفسِه: `this` = البثُّ (٦ + ٥) + `io` قيمةً للدفع التلقائيّ
 * (`reporter.io`، موضعٌ واحد — انظر JCR/10) + مفوِّضُ التحقّق (صار نداءً مباشراً لـ`verifyAndAutofix` بالمُبلِّغ نفسِه).
 * مستدعٍ واحد (`_selectBuildStrategy`). نقلٌ حرفيّ.
 */
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { smartChat } from '../../core/providers/llm.js';
import { getUserLanguage } from '../languageDetector.js';
import { addToHistory, updateStructure, getDomainModel } from '../projectMemory.js';
import { buildProjectModelContext } from '../projectModel.js';
import { composeRequirements } from '../requirementsVerifier.js';
import { isFullSpecification, specSections } from '../textNormalizer.js';
import { readProjectFiles } from '../projectReader.js';
import { generateNextScaffold, generateContentModel, generateSectionContent, slugify, defaultSection } from '../reactGenerator.js';
import { buildStaticSite, buildDashboardPage } from '../../services/reactPreview.js';
import { transitionState, STATES } from '../stateMachine.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { recordBuild, buildMetricsPayload } from '../../services/metricsStore.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';
import { verifyAndAutofix, strategyVerdict } from './verify.js';
import { withVerdict } from './reportMissionSuccess.js';

// ⚛️ بناء مشروع React/Next حقيقي + معاينة حيّة في الـ iframe + خيار النشر
export async function buildReactProject(goal, ctx, { sections = [] } = {}, reporter) {
    const { projectPath, username, activeProject, roomName } = ctx;
    const lang = getUserLanguage(username);
    const t0 = Date.now();
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
    reporter.liveLog(roomName, '5. RUNTIME', 'ReactGen', '⚛️ توليد مشروع Next.js + Tailwind...');

    // 🧩 نموذج المشروع يُثري هدف كتابة المحتوى — فيَعِي الكيانات والأدوار
    // والتدفّقات حتى في مسار React (كان يُشتقّ ويُحفظ لكن لا يُحقن هنا).
    const reactModelCtx = buildProjectModelContext(getDomainModel(username, activeProject));
    const modelAwareGoal = reactModelCtx ? `${goal}\n${reactModelCtx}` : goal;

    // 🧠 محتوى بالذكاء (best-effort) يملأ الهيكل بمحتوى المشروع الفعلي
    let content = null;
    try {
        reporter.liveLog(roomName, '5. RUNTIME', 'ContentWriter', '✍️ كتابة محتوى المشروع...');
        content = await generateContentModel(modelAwareGoal, { sections, lang, llm: (m, o) => smartChat(m, o) });
    } catch { /* افتراضي */ }

    // 1) سكافولد Next الحقيقي (للنشر/التنزيل) — بمحتوى مخصّص
    const scaffold = generateNextScaffold({ projectName: activeProject, sections, lang, content });
    for (const f of scaffold.files) {
        await writeProjectFile(projectPath, f.name, f.content);
    }

    // 1.5) تخصيص محتوى **كل صفحة** بالذكاء: النموذج الدفعي قد يترك أقساماً
    //      افتراضية (خاصة مع كثرة الصفحات). نملأ كل قسم بقي افتراضياً فردياً
    //      (best-effort، تراجع آمن للافتراضي) — فلا صفحة بمحتوى قالبي.
    const finalContent = scaffold.meta.content;
    try {
        const CHROME = new Set(['Navbar', 'Hero', 'Footer']);
        const pageComps = (scaffold.meta.components || []).filter((c) => !CHROME.has(c));
        const routes = scaffold.meta.pages || [];
        for (const comp of pageComps) {
            const cur = finalContent.sections?.[comp];
            if (!cur) continue;
            const label = (routes.find((r) => r.href === '/' + slugify(comp)) || {}).label || cur.heading;
            // لم يخصّصه النموذج الدفعي؟ (لا يزال مطابقاً للافتراضي) → خصّصه فردياً
            if (JSON.stringify(cur) !== JSON.stringify(defaultSection(label, lang))) continue;
            reporter.liveLog(roomName, '5. RUNTIME', 'ContentWriter', `✍️ محتوى صفحة: ${label}...`);
            const model = await generateSectionContent(label, {
                brand: finalContent.brand || activeProject, goal, lang, llm: (m, o) => smartChat(m, o),
            });
            if (model) finalContent.sections[comp] = {
                heading: model.heading || cur.heading,
                subheading: model.subheading || cur.subheading,
                items: (model.items && model.items.length) ? model.items : cur.items,
            };
        }
        // أعِد كتابة lib/content.js بالمحتوى المُثرى (المكوّنات تقرأ منه)
        await fsPromises.writeFile(path.join(projectPath, 'lib/content.js'),
            `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(finalContent, null, 2)};\n`);
    } catch (e) { reporter.liveLog(roomName, '5. RUNTIME', 'ContentWriter', `⚠️ تخصيص جزئي: ${e.message}`); }

    // 2) معاينة ثابتة متعدّدة الصفحات: صفحة HTML حقيقية لكل مسار بروابط تعمل
    //    (index.html + <slug>.html) — بلا CDN، فالتنقّل يفتح صفحات فعلية.
    const staticPages = buildStaticSite(finalContent, lang);
    for (const pg of staticPages) {
        await writeProjectFile(projectPath, pg.name, pg.content);
    }
    // 🛠️ لوحة تحكم يديرها العميل لموقعه (dashboard.html) — يضبط كلمة مرورها أول مرة
    await fsPromises.writeFile(path.join(projectPath, 'dashboard.html'),
        buildDashboardPage(finalContent, { project: activeProject, username, lang }));

    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
    transitionState(username, activeProject, STATES.COMPLETED);
    updateStructure(username, activeProject, sections, scaffold.meta.components);
    addToHistory(username, activeProject, `بناء React/Next: ${(goal || '').slice(0, 60)}`);

    // 3) تحديث المعاينة + قائمة الملفات + لقطة
    reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
    let builtFiles = [];
    try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
    reporter.send(roomName, 'workspace_files', builtFiles);
    snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});
    // 🔬 تحقّق سلوكي على المعاينة (تقرير صادق؛ بلا إصلاح تلقائي لأن بنية
    // React تختلف عن ملفات vanilla الثلاثة التي يعدّلها المُصلِح). لا يوجد
    // agents في هذا المسار (canFix=false) — نمرّر null صراحةً.
    let behavior = null;
    try {
        behavior = await verifyAndAutofix({
            projectPath, blueprint: null, username, activeProject, roomName, agents: null, lang, canFix: false,
        }, reporter);
    } catch (e) { console.warn('[BehaviorVerify]', 'تخطّي تحقّق React:', e.message); }
    // ⚖️ الحكم (PM/2b): من التحقّق على المعاينة الثابتة — ما لا يراه المحقّقُ الثابت يُقال «لم يُتحقَّق» لا «نجح».
    //    PM/7: متطلّباتُ الفهم تُتتبَّع في المعاينة الثابتة (ما يقرؤه المحقّقُ نفسُه) — لا «لا ينطبق» حتميّاً.
    const verdict = strategyVerdict({ filesCount: builtFiles.length, behavior,
        requirements: composeRequirements(null, getDomainModel(username, activeProject)), files: await readProjectFiles(projectPath),
        sections: isFullSpecification(goal) ? specSections(goal) : [],
        requirementsNote: 'مسارُ React — لا متطلّباتٍ من الفهم' });

    const durationSec = Math.round((Date.now() - t0) / 1000);
    recordBuild(username, activeProject, { success: true, durationSec, filesCount: builtFiles.length, goal: goal || '' });
    reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));

    const pageCount = scaffold.meta.pages?.length || staticPages.length;
    const report = lang === 'ar'
        ? [
            '✅ مشروع React/Next جاهز — معاينة متعدّدة الصفحات تعمل الآن.',
            `⚛️ Next.js + Tailwind · ${pageCount} صفحة · ${scaffold.meta.components.length} مكوّن`,
            '🖥️ اضغط روابط الشريط للتنقّل بين صفحات حقيقية — كل تعديل ينعكس فوراً.',
            '🛠️ لوحة إدارة موقعك: افتح `dashboard.html` وعيّن كلمة مرور — تدير بها النصوص والصور والمنتجات بنفسك.',
            '⬇️ للتشغيل محلياً: npm install && npm run dev · وجاهز للنشر على Vercel.',
          ].join('\n')
        : [
            '✅ React/Next project ready — multi-page preview running now.',
            `⚛️ Next.js + Tailwind · ${pageCount} pages · ${scaffold.meta.components.length} components`,
            '🖥️ Click the nav links to move between real pages — every edit reflects instantly.',
            '⬇️ Local run: npm install && npm run dev · Ready to deploy on Vercel.',
          ].join('\n');
    reporter.send(roomName, 'chat_reply', {
        message: withVerdict(report, verdict, lang),
        options: lang === 'ar' ? ['➕ أضف صفحة', '🚀 انشر على Vercel', '🐙 ادفع إلى GitHub', '✏️ عدّل قسماً'] : ['➕ Add a page', '🚀 Deploy to Vercel', '🐙 Push to GitHub', '✏️ Edit a section'],
    });
    reporter.liveLog(roomName, 'JCOS', 'Kernel', '✨ نجاح');
    return { success: true, stack: 'react-next', files: builtFiles, verdict };
}
