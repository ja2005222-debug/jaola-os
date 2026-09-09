/**
 * 🧱 stages/buildFromRegistry.js — بناءٌ بإعادة التركيب من JAOLA Registry: صفحةٌ
 * تسويقيّة/تعريفيّة كاملة من بلوكاتٍ جاهزة مختبَرة (Hero/Features/Pricing/…)، ثمّ
 * بصمةٌ (علامة/لون) + أيقونة + تلميع. لا توليدَ من الصفر.
 *
 * أوّلُ بانٍ يخرج من `JaolaCognitiveRuntime` (JCR/10) — وأوّلُ ما يخرج من طبقة
 * «البثّ + `io`»: قِيس أنّ `this.io` يُمرَّر **قيمةً** لـ`autoPushIfEnabled` التي لا
 * تفعل به إلّا `io.to(room).emit('log', …)`. المُبلِّغُ يحمل `io` نفسَه، فيُمرَّر
 * `reporter.io` — تسريبٌ صريحٌ للمقبس الخام، أهونُ من تغيير توقيعٍ في `services/`
 * الآن، ويُقاس عزلُه وحدَه حين تُطلَب. نقلٌ حرفيّ فيما عدا ذلك.
 */
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { getUserLanguage, resolveGoalLanguage } from '../languageDetector.js';
import { transitionState, STATES } from '../stateMachine.js';
import { addToHistory, setDomainModel, getDomainModel, updateStructure } from '../projectMemory.js';
import { assetsFor, injectFaviconTag, pickPalette } from '../cloneAssets.js';
import { polishHtml } from '../polishPack.js';
import { brandFromGoal, composePage, selectBlocks } from '../blockRegistry.js';
import { prepareRenderDeploy, renderServiceName } from '../renderAgent.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { recordBuild, buildMetricsPayload } from '../../services/metricsStore.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';
import { verifyBehavior } from '../behaviorVerifier.js';
import { strategyVerdict } from './verify.js';
import { composeRequirements } from '../requirementsVerifier.js';
import { withVerdict, kernelOutcomeLine } from './reportMissionSuccess.js';

export async function buildFromRegistry(goal, ctx, reporter) {
    const { projectPath, username, activeProject, roomName } = ctx;
    const lang = resolveGoalLanguage(goal, getUserLanguage(username)); // لا ردّ إنجليزي على طلب عربيّ
    const t0 = Date.now();
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
    reporter.liveLog(roomName, '5. RUNTIME', 'JaolaRegistry', '🧱 إعادة تركيب صفحة احترافية من JAOLA Registry (بلوكات جاهزة) — لا توليد من الصفر');

    // 1) ركّب صفحة كاملة مخصّصة (علامة + لون المجال) من البلوكات
    const palette = pickPalette(goal);
    const brand = brandFromGoal(goal, activeProject);
    const { files, blocks } = composePage({ brand, accent: palette.accent, blocks: selectBlocks(goal) });
    for (const f of files) await writeProjectFile(projectPath, f.name, f.content);
    reporter.liveLog(roomName, '5. RUNTIME', 'JaolaRegistry', `🧩 رُكّبت ${blocks.length} أقسام: ${blocks.join(' · ')}`);

    // 2) هوية بصرية + تلميع (خطّ + حركات) — حتميّ
    try {
        const assets = assetsFor(goal);
        await fsPromises.writeFile(path.join(projectPath, 'brand.svg'), assets.favicon);
        const idxPath = path.join(projectPath, 'index.html');
        let html = await fsPromises.readFile(idxPath, 'utf8');
        html = injectFaviconTag(html, 'brand.svg');
        html = polishHtml(html);
        await fsPromises.writeFile(idxPath, html);
    } catch { /* اختياري */ }

    // 3) نموذج + نشر ثابت
    //
    // 🔴 #196: **هذا المسارُ كان يفبرك نموذجَه** — `{entities: [], roles: [Visitor]}` ثابتٌ مكتوب،
    //    يُكتب فوق ما فهمتْه بوّابةُ الفهم قبل قليل (`_understandGoal` تسبق `_selectBuildStrategy`).
    //    فيُمحى الفهمُ من الذاكرة، ولا يصل البوّابةَ منه شيء. والأثرُ مقيسٌ على سجلّ صاحب المشروع
    //    حرفيّاً: طلبُ «منصّة لجمعية خيرية» بأربعة أدوارٍ مسمّاة خرج صفحةَ تسويقٍ من عشرة بلوكات
    //    (pricing/testimonials/logos)، ومع ذلك:
    //      requirements-verify: skipped — «1 متطلّب بلا مفردةٍ تُتتبَّع» (المتطلّبُ الوحيدُ «شاشة Visitor»،
    //      واسمُه لاتينيٌّ لا يُتتبَّع في نصٍّ عربيّ) → و`skipped` محايد → **PASS**.
    //    وبنموذجه المفهوم نفسِه على الملفّات نفسِها: `6 متطلّب بلا أثر` → **FAILED**. هو الفرقُ كلُّه.
    //
    //    والعلّةُ عينُها قاعدةُ «مصدرٌ واحدٌ لكلّ قاعدة»: البانيان الآخران يقرآن النموذجَ من الذاكرة
    //    (`buildFromClone` يدمجه، `buildReact` يقرؤه) وهذا وحدَه كان يستبدله.
    //
    // 🔻 ونتيجةٌ سلبيّةٌ تُسجَّل: جُرِّب هنا أيضاً تمريرُ **بنود وثيقة** صاحب المشروع كما يفعل البانيان
    //    (PM/9، PM/12)، ثمّ قِيس فوُجد ميّتاً: نداءُ هذا الباني الوحيد داخل
    //    `if (!documentOrSystem && …)` في `selectBuildStrategy` — و`documentOrSystem` يبدأ بـ
    //    `isFullSpecification(goal)`. فالوثيقةُ **لا تبلغ هذا المسار بنيةً**، وحارسُ
    //    `specVerdict.test` («البروشورُ ليس وثيقة») أصاب. فحُذف السطرُ وبقي الحارس.
    const understood = (() => { try { return getDomainModel(username, activeProject); } catch { return null; } })();
    const hasUnderstanding = !!(understood?.roles?.length || understood?.entities?.length);
    const registryModel = hasUnderstanding
        ? understood
        : { entities: [], roles: [{ name: 'Visitor', capabilities: ['تصفّح'] }], flows: [], _source: 'registry' };
    // فهمٌ قائمٌ لا يُدهَس بنموذجِ زائرٍ عامّ. وحارسُ `if (!hasUnderstanding)` **قِيس فوجد ميّتاً**
    // وحُذف: حين يوجد فهمٌ يكون `registryModel` هو `understood` بعينه، فالكتابةُ إعادةُ ما هو مكتوب.
    try { setDomainModel(username, activeProject, registryModel); } catch {}
    // ⚖️ الحكم (PM/2b): الصفحةُ المركّبة تُتحقَّق فعلاً (صفحةُ هبوط — لا شرطَ تفاعل) لا تُعلَن ناجحةً بلا فحص.
    //    PM/7: المتطلّباتُ تُمرَّر كما على المسارات كلِّها — وحين لا يكون ثمّ فهمٌ يبقى نموذجُ الزائر عامّاً
    //    فلا يُتتبَّع، والبوّابةُ تقول ذلك بعدده لا تفترضه.
    const verdict = strategyVerdict({ filesCount: files.length, behavior: await verifyBehavior({ projectPath, blueprint: { kind: 'landing' }, domainModel: registryModel }),
        requirements: composeRequirements(null, registryModel), files,
        requirementsNote: 'صفحةٌ من بلوكات Registry — لا مكوّناتٍ وظيفيّة تُتحقَّق' });
    try {
        await prepareRenderDeploy(projectPath, renderServiceName(username, activeProject), false);
    } catch { /* اختياري */ }

    // 4) نهائيات كبناءٍ ناجح
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
    transitionState(username, activeProject, STATES.COMPLETED);
    // PM/19: البلوكاتُ المركّبةُ هي هيكلُ هذا المنتج — كانت تُبثّ في السجلّ ولا تُسجَّل قطّ،
    //        فيرث تقريرُ التسليم «🧱 الأقسام» من منتجٍ سابقٍ في المشروع نفسِه.
    updateStructure(username, activeProject, blocks);
    addToHistory(username, activeProject, `registry: ${(goal || '').slice(0, 60)}`);
    let builtFiles = [];
    try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
    reporter.send(roomName, 'workspace_files', builtFiles);
    reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
    snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});
    const durationSec = Math.round((Date.now() - t0) / 1000);
    recordBuild(username, activeProject, { success: true, durationSec, filesCount: builtFiles.length, goal: goal || '' });
    reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));

    const msg = lang === 'ar'
        ? `✅ اكتمل — ركّبنا صفحة احترافية **كاملة** لـ «${brand}» من مكوّنات JAOLA الجاهزة (${blocks.length} قسم) ووضعنا بصمتك وهويتك البصرية. جرّبها في المعاينة، ثم اطلب أي تعديل.`
        : `✅ Done — composed a **complete** professional page for "${brand}" from ${blocks.length} ready JAOLA blocks, with your brand and visual identity. Try it in the preview, then request any change.`;
    reporter.send(roomName, 'chat_reply', { message: withVerdict(msg, verdict, lang) });
    reporter.liveLog(roomName, 'JCOS', 'Kernel', kernelOutcomeLine(verdict, ' (إعادة تركيب من Registry)'));
    return { success: true, registry: true, blocks, verdict };
}
