/**
 * 🍔 stages/buildFromClone.js — البناءُ من كلونٍ عامل: كتابةُ ملفّات القالب بلغة المستخدم،
 * البصمةُ (بيانات العيّنة + الصور + العلامة/الألوان) بتعديلٍ موضعيّ وتراجعٍ عند الكسر،
 * الهويّةُ البصريّة، إعدادُ النشر الثابت، ثمّ نهائيّاتُ البناء الناجح.
 *
 * يخرج من `JaolaCognitiveRuntime` في JCR/12 بالمنهج نفسِه: `this` = البثُّ + `io` قيمةً
 * للدفع التلقائيّ (`reporter.io`، موضعٌ واحد — انظر JCR/10). مستدعٍ واحد (`_selectBuildStrategy`).
 * نقلٌ حرفيّ.
 */
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { smartChat } from '../../core/providers/llm.js';
import { getUserLanguage, resolveGoalLanguage } from '../languageDetector.js';
import { addToHistory, updateStructure, setDomainModel, getDomainModel } from '../projectMemory.js';
import { mergeProjectModel } from '../projectModel.js';
import { composeRequirements } from '../requirementsVerifier.js';
import { readProjectFiles } from '../projectReader.js';
import { recordModel } from '../modelLibrary.js';
import { patchEditPlan } from '../patchEditor.js';
import { stampSeed } from '../seedStamp.js';
import { forgeSeedImages } from '../imageForge.js';
import { localizeTemplateFiles } from '../templateLocalizer.js';
import { assetsFor, injectFaviconTag, paletteHint } from '../cloneAssets.js';
import { polishHtml } from '../polishPack.js';
import { brandFromGoal, applyBrandName } from '../blockRegistry.js';
import { verifyBehavior, extractDefinedFunctions } from '../behaviorVerifier.js';
import { prepareRenderDeploy, renderServiceName } from '../renderAgent.js';
import { isExplicitNewBuild } from '../textNormalizer.js';
import { transitionState, STATES } from '../stateMachine.js';
import { guardFiles, scrubPlaceholders, ensureEditIntegrity } from '../../services/codeGuard.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { recordBuild, buildMetricsPayload } from '../../services/metricsStore.js';
import { writeProjectFile, writePlanFiles } from '../../core/runtime/workspacePaths.js';
import { strategyVerdict } from './verify.js';
import { withVerdict } from './reportMissionSuccess.js';

export async function buildFromClone(clone, goal, ctx, reporter) {
    const { projectPath, username, activeProject, roomName } = ctx;
    const lang = resolveGoalLanguage(goal, getUserLanguage(username)); // لا ردّ إنجليزي على طلب عربيّ
    reporter.setLang(roomName, lang);
    const t0 = Date.now();
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
    reporter.liveLog(roomName, '5. RUNTIME', 'JaolaTemplate', `🧩 قالب jaola عامل: ${clone.name} (${clone.id})${clone.externalApi ? ` — API خارجي: ${clone.externalApi}` : ''} — نبدأ من تطبيق يعمل فعلاً (لا توليد من الصفر)`);

    // 1) اكتب ملفات الكلون العامل — بلغة المستخدم (توطين حتميّ للسلاسل
    //    الظاهرة + قلب lang/dir؛ العربية هي الأصل فلا تغيير لها)
    const baseFiles = localizeTemplateFiles(clone.files, lang);
    if (lang === 'en') reporter.liveLog(roomName, '5. RUNTIME', 'Localizer', '🌐 Template delivered in English (your selected language).');
    for (const f of baseFiles) {
        await writeProjectFile(projectPath, f.name, f.content);
    }
    // احفظ نموذج الكلون (يُدمج + يُغني المكتبة)
    const model = mergeProjectModel(getDomainModel(username, activeProject) || {}, clone.model);
    setDomainModel(username, activeProject, model);

    // 2) البصمة — تخصيص محدود المخرَج فقط (لا إعادة كتابة كاملة أبداً — هو
    //    جذر «التخصيص لا يحدث»: الملف الكبير يُبتَر فتُفقد الدوال ويُرتدّ):
    //    (أ) بيانات العيّنة: مصفوفة واحدة عبر نداء ذكاء صغير محدود.
    //    (ب) العلامة/الألوان: تعديل موضعي (patch) دقيق.
    //    ثم حارس فقد الدوال + تحقّق سلوكي + تراجع آمن للكلون النظيف.
    try {
        reporter.liveLog(roomName, '5. RUNTIME', 'CloneTemplate', '🎨 وضع البصمة — تخصيص المحتوى ليطابق طلبك...');
        let workFiles = baseFiles.map(f => ({ name: f.name, content: f.content }));
        const appBefore = workFiles.find(f => f.name === 'app.js');
        const fnsBefore = new Set(appBefore ? extractDefinedFunctions(appBefore.content) : []);
        let changed = false;
        const mergeFileList = (base, changes) => {
            const out = base.map(f => ({ ...f }));
            for (const c of changes) {
                const idx = out.findIndex(f => f.name === c.name);
                if (idx >= 0) out[idx] = { name: c.name, content: c.content };
                else out.push({ name: c.name, content: c.content });
            }
            return out;
        };

        // (أ) بيانات العيّنة — مصفوفة محدودة (مخرَج صغير = لا بتر مهما كبر app.js)
        try {
            const seed = await stampSeed(workFiles, goal, { chat: smartChat, category: clone.category });
            if (seed.ok && seed.files.length) {
                workFiles = mergeFileList(workFiles, seed.files);
                changed = true;
                reporter.liveLog(roomName, '5. RUNTIME', 'SeedStamp', `🌱 خُصّصت بيانات العيّنة (${seed.name}) لتطابق طلبك — بلا مساس بالدوال.`);
            }
        } catch (e) { console.warn('[Stamp/Seed]', e.message); }

        // (أ٢) 🖼️ توليد الصور المضمون: أي عنصر بلا صورة (المبصوم يُفرِّغها
        // عمداً كي لا تظهر صور غير مطابقة) → SVG مولَّد بلون المجال ورمزه.
        try {
            const forged = forgeSeedImages(workFiles, { goal, category: clone.category });
            if (forged.changed) {
                workFiles = mergeFileList(workFiles, forged.files);
                changed = true;
                reporter.liveLog(roomName, '5. RUNTIME', 'ImageForge', `🖼️ وُلّدت ${forged.count} صورة للعناصر بلا صور — هوية بصرية كاملة بلا انتظار.`);
            }
        } catch (e) { console.warn('[ImageForge]', e.message); }

        // (ب) العلامة/الألوان — تعديل موضعي دقيق (اسم العلامة + العنوان + --accent فقط)
        const brandInstruction = `عدّل *العلامة والألوان فقط* لتطابق: "${goal}".
غيّر: نصّ brandName والعنوان (title) في index.html، ومتغيّر اللون --accent/--brand في styles.css إن لزم. ${paletteHint(goal)}
🚫 لا تلمس app.js إطلاقاً، ولا بنية index.html أو معرّفات id/data-action.
أعِد كتل SEARCH/REPLACE موضعية دقيقة فقط.`;
        try {
            const brandFiles = workFiles.filter(f => f.name !== 'app.js'); // لا نمسّ المنطق
            const patch = await patchEditPlan(brandInstruction, brandFiles, lang);
            if (patch.ok && patch.files.length) {
                workFiles = mergeFileList(workFiles, patch.files);
                changed = true;
                reporter.liveLog(roomName, '5. RUNTIME', 'PatchEditor', `🩹 خُصّصت العلامة/الألوان موضعياً (${patch.files.map(f => f.name).join('، ')}).`);
            }
        } catch (e) { console.warn('[Stamp/Brand]', e.message); }

        const stamped = changed ? workFiles.filter(f => {
            const orig = baseFiles.find(o => o.name === f.name);
            return !orig || orig.content !== f.content;
        }) : [];

        if (stamped && stamped.length) {
            // خطّ الأساس: نقيس *الارتداد* لا المطلق — نتحقّق من الكلون النظيف (على
            // القرص من الخطوة 1) بنفس النموذج، فأي فشل موجود أصلاً (مثل دور Admin
            // غير مبنيّ في قالب متجر) لا يُحسب على البصمة ولا يُبرّر الاسترجاع.
            let baseFails = new Set();
            try {
                const bv = await verifyBehavior({ projectPath, blueprint: { kind: 'webapp' }, domainModel: model });
                if (bv.ran) baseFails = new Set(bv.checks.filter(c => c.status === 'fail').map(c => c.name));
            } catch { /* تجاهل */ }

            const emitG = (m) => reporter.liveLog(roomName, '5. RUNTIME', 'CodeGuard', m);
            const guarded = await ensureEditIntegrity(
                await guardFiles(scrubPlaceholders(stamped, activeProject), emitG), projectPath, emitG);
            await writePlanFiles(projectPath, guarded);

            // حارس ارتداد: لا دالة تُفقد بالتخصيص (belt & suspenders مع التحقّق السلوكي)
            let lostFn = [];
            try {
                const appPath = path.join(projectPath, 'app.js');
                const appAfterContent = (guarded.find(f => f.name === 'app.js') || {}).content
                    || (fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '');
                const fnsAfter = new Set(extractDefinedFunctions(appAfterContent));
                lostFn = [...fnsBefore].filter(n => !fnsAfter.has(n));
            } catch { /* تجاهل */ }

            const verdict = await verifyBehavior({ projectPath, blueprint: { kind: 'webapp' }, domainModel: model });
            const stampFails = verdict.ran ? verdict.checks.filter(c => c.status === 'fail').map(c => c.name) : [];
            const newFails = stampFails.filter(n => !baseFails.has(n)); // ما أدخلته البصمة فقط
            const broke = newFails.length > 0 || lostFn.length > 0;
            if (broke) {
                const why = lostFn.length ? `فقد دوال (${lostFn.slice(0, 3).join('، ')})` : `فشل جديد: ${newFails.join('، ')}`;
                reporter.liveLog(roomName, '5. RUNTIME', 'CloneTemplate', `↩️ التخصيص أدخل عطلاً (${why}) — استرجاع الكلون العامل النظيف.`);
                for (const f of baseFiles) await writeProjectFile(projectPath, f.name, f.content);
            } else {
                reporter.liveLog(roomName, '5. RUNTIME', 'CloneTemplate', `✅ البصمة وُضعت والتطبيق يعمل (${verdict.summary || 'تحقّق سلوكي'}).`);
            }
        }
    } catch (e) { reporter.liveLog(roomName, '5. RUNTIME', 'CloneTemplate', `⚠️ تخطّي التخصيص (الكلون العامل محفوظ): ${e.message}`); }

    // 2.5) هوية بصرية + نضج: أيقونة مطابقة للمجال + باقة تلميع (خطّ أنيق +
    //      حركات ظهور + تحسينات) — حتميّ هنا (بعد أي ارتداد) فتخرج كل نسخة ناضجة.
    try {
        const assets = assetsFor(goal);
        await fsPromises.writeFile(path.join(projectPath, 'brand.svg'), assets.favicon);
        const idxPath = path.join(projectPath, 'index.html');
        if (fs.existsSync(idxPath)) {
            let html = await fsPromises.readFile(idxPath, 'utf8');
            html = injectFaviconTag(html, 'brand.svg');
            html = polishHtml(html);
            // اسم علامة نظيف حتميّاً على البناء الجديد — يزيل فعل الأمر (لا «Build Pizza Chop»)
            if (isExplicitNewBuild(goal)) {
                const brand = brandFromGoal(goal, '');
                if (brand && brand.length >= 2) html = applyBrandName(html, brand);
            }
            await fsPromises.writeFile(idxPath, html);
        }
        reporter.liveLog(roomName, '5. RUNTIME', 'CloneTemplate', '🎨 أُضيفت هوية العلامة ولمسة احترافية (خطّ + حركات ظهور).');
    } catch { /* اختياري */ }

    // 3) إعداد النشر (موقع ثابت — لا خادم مطلوب للكلون التجريبي)
    try {
        await prepareRenderDeploy(projectPath, renderServiceName(username, activeProject), false);
    } catch { /* اختياري */ }

    // ⚖️ الحكم (PM/2b): تحقّقٌ نهائيّ على ما وصل القرصَ فعلاً (بعد البصمة أو الاسترجاع والتلميع) — لا على القالب النظيف.
    //    PM/7: المتطلّباتُ من الفهم المدمَج (ما فهمه جولا من الطلب + نموذجُ الكلون) تُتتبَّع في الملفّات نفسِها — فما طلبه
    //    المستخدمُ ولا يمثّله الكلونُ يُقال بالاسم، لا «لا ينطبق».
    const verdict = strategyVerdict({ filesCount: baseFiles.length, behavior: await verifyBehavior({ projectPath, blueprint: { kind: 'webapp' }, domainModel: model }),
        requirements: composeRequirements(null, model), files: await readProjectFiles(projectPath),
        requirementsNote: 'مسارُ الكلون — لا متطلّباتٍ من الفهم' });

    // 4) نهائيات كبناءٍ ناجح
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
    transitionState(username, activeProject, STATES.COMPLETED);
    updateStructure(username, activeProject,
        (clone.model.roles || []).map(r => `واجهة ${r.name}`),
        (clone.model.flows || []).map(f => f.name));
    addToHistory(username, activeProject, `كلون ${clone.id}: ${(goal || '').slice(0, 60)}`);
    reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
    let builtFiles = [];
    try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
    reporter.send(roomName, 'workspace_files', builtFiles);
    snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});
    const durationSec = Math.round((Date.now() - t0) / 1000);
    recordBuild(username, activeProject, { success: true, durationSec, filesCount: builtFiles.length, goal: goal || '' });
    reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));
    try { recordModel(clone.category, model, { verified: true }); } catch {}

    const rolesLabel = (clone.model?.roles || []).map(r => r.name).join(' · ');
    const apiNote = clone.externalApi ? (lang === 'ar' ? ` (متصل بـ API خارجي حيّ: ${clone.externalApi})` : ` (live external API: ${clone.externalApi})`) : '';
    const msg = lang === 'ar'
        ? `✅ اكتمل — بدأنا من قالب **${clone.name}** (jaola) يعمل فعلاً${rolesLabel ? ` — ${rolesLabel}` : ''}${apiNote} ووضعنا بصمتك. جرّبه في المعاينة، ثم اطلب أي تعديل.`
        : `✅ Done — started from a working **${clone.name}** jaola template${apiNote} and applied your brand. Try it in the preview, then request any change.`;
    reporter.send(roomName, 'chat_reply', { message: withVerdict(msg, verdict, lang) });
    reporter.liveLog(roomName, 'JCOS', 'Kernel', '✨ نجاح (قالب jaola عامل)');
    return { success: true, clone: clone.id, verdict };
}
