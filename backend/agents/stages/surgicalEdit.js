/**
 * ✂️ stages/surgicalEdit.js — التعديلُ الجراحيّ على مشروعٍ قائم: نسخةٌ احتياطيّة، عمليّاتُ صفحات React، قرارُ «تعديلٌ كبير →
 * بناءٌ كامل»، خطّةُ تعديلٍ موضعيّة (patch) عبر الوكلاء، حارسُ الكود والسلامة، إعادةُ توليد المعاينة، حارسُ الارتداد، التحقّقُ
 * السلوكيّ، ثمّ التقرير.
 *
 * يخرج من `JaolaCognitiveRuntime` في JCR/22 بالمنهج نفسِه، مع **شقٍّ محقَن** `ops`: خمسُ طرائقِ صنفٍ كان يستدعيها بـ`this`
 * (`_runMissionNow`، `_renamePageNow`، `_deletePageNow`، `_addPageNow`، `_verifyAndAutofix`) — والاختباراتُ تستبدلها على النسخة —
 * تُمرَّر دوالَّ من المفوِّض، فتبقى الاستبدالاتُ نافذة (كما فعلت JCR/8 بـ`verify`). القارئُ والمنظِّفُ يُستوردان مباشرةً.
 * `reporter.io` موضعٌ واحد للدفع التلقائيّ. نقلٌ حرفيّ.
 */
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { getUserLanguage } from '../languageDetector.js';
import { addToHistory, getDomainModel } from '../projectMemory.js';
import { buildProjectModelContext } from '../projectModel.js';
import { patchEditPlan } from '../patchEditor.js';
import { extractDefinedFunctions } from '../behaviorVerifier.js';
import { hasKeyword } from '../keywordMatch.js';
import { recordEdit } from '../userProfile.js';
import { backupProject } from '../fileManager.js';
import { buildStaticSiteFromSource } from '../../services/reactPreview.js';
import { guardFiles, scrubPlaceholders, ensureEditIntegrity } from '../../services/codeGuard.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { recordEditAction, buildMetricsPayload } from '../../services/metricsStore.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';
import { readProjectFiles } from '../projectReader.js';
import { cleanPageName } from './reactPages.js';

export async function runSurgicalEdit(instruction, ctx, reporter, ops) {
    const { projectPath, username, activeProject, roomName, agents } = ctx;
    const lang = getUserLanguage(username);
    const files = await readProjectFiles(projectPath);

    // 📸 نسخة احتياطية كاملة قبل كل تعديل — وقود أمر «تراجع» الفوري من
    // الشات (فشلها لا يعطّل التعديل أبداً).
    if (files.length) await backupProject(projectPath, 'edit').catch(() => {});

    // مشروع React؟ (يحوي lib/content.js أو app/page.jsx)
    const isReact = files.some(f => f.name === 'lib/content.js' || f.name === 'app/page.jsx');

    // 🗂️ عمليات الصفحات لمشروع React (تزايدية، تحفظ باقي المحتوى) — قبل فحص
    // "التغيير الكبير" (الذي يلتقط "صفحة/صفحات" ويعيد البناء بالكامل).
    if (isReact) {
        // إعادة تسمية: "أعد تسمية صفحة X إلى Y" / "rename page X to Y"
        const ren = instruction.match(/(?:أعد\s*تسمية|اعد\s*تسمية|غيّر\s*اسم|غير\s*اسم|rename)\s+(?:صفحة|صفحه|page\s+)?(.+?)\s+(?:إلى|الى|to)\s+(.+)/i);
        if (ren) return ops.renamePage(projectPath, username, activeProject, roomName, lang, cleanPageName(ren[1]), cleanPageName(ren[2]));
        // حذف: "احذف صفحة X" / "delete page X"
        const del = instruction.match(/(?:احذف|امسح|إحذف|delete|remove)\s+(?:صفحة|صفحه|page)\s+(.+)/i);
        if (del) return ops.deletePage(projectPath, username, activeProject, roomName, lang, cleanPageName(del[1]));
        // إضافة: "أضف صفحة …"
        const wantsAddPage = /(?:أضف|اضف|أضِف|ضيف|زد|أنشئ|انشئ|اضافة|إضافة)\s+(?:لي\s+)?(?:صفحة|صفحه)|صفحة\s*جديدة|add\s+(?:a\s+|an\s+)?page|new\s+page|create\s+(?:a\s+)?page/i.test(instruction);
        if (wantsAddPage) return ops.addPage(instruction, projectPath, username, activeProject, roomName, lang);
    }

    // لا مشروع قائم، أو تعديل كبير (إعادة تصميم/بناء) → البناء الكامل بدل الجراحي
    // أوامر البناء الصريحة ("ابنِ تطبيق...") تعني بناءً كاملاً لا تعديلاً
    // جراحياً على المشروع الحالي — منعاً لتشويه مشروع بنمط مختلف تماماً.
    // إعادة بناء كاملة فقط لطلب صريح — لا لمجرّد ذكر «صفحات» (كان تحسينٌ
    // على تطبيق يعمل «فعّل الخدمات مع صفحات خاصة» يُعيد البناء من الصفر
    // فيدهس الكلون العامل). إضافة الصفحات/الميزات تبقى تعديلاً جراحياً.
    const bigChange = /أعد التصميم|اعد التصميم|أعد البناء|اعد البناء|أعد بناء|اعد بناء|من جديد|من الصفر|ابنِ?\s|ابن\s|أبنِ?\s|تطبيق\s+جديد|موقع\s+جديد|redesign|rebuild|from scratch|start over/i.test(instruction);
    if (files.length === 0 || bigChange || !agents.coreEditCodePlan) {
        return ops.runMission(instruction, ctx);
    }

    // نوجّه التعديل للمصدر (lib/content.js، المكوّنات) لا لصفحات HTML المولّدة
    // (index.html/*.html) — فتلك نُعيد توليدها من المحتوى بعد التعديل.
    const editFiles = isReact ? files.filter(f => !/^[^/]+\.html$/.test(f.name)) : files;

    reporter.liveLog(roomName, 'EDIT', 'SurgicalEditor', '✂️ تعديل دقيق (لا إعادة بناء كاملة)...');
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });

    // 🧩 نحقن نموذج المشروع في التعديل — يبقى التعديل متماسكاً مع كيانات
    // وأدوار وتدفّقات النظام (لا رقعة نصّية معزولة تكسر التماسك).
    const editModelCtx = buildProjectModelContext(getDomainModel(username, activeProject));

    // 🔒 عقد الحفظ — التعديلات ليست تراكمية بطبيعتها: «أضف 3 مطاعم» أعاد
    // كتابة app.js فحذف التفاصيل المالية السابقة (سجل المستخدم). نُلزم
    // المولّد بقائمة الدوال/الميزات الحالية: احتفظ بها كلّها، أضِف فقط المطلوب.
    const currentJs = editFiles.filter(f => /\.(m?js)$/i.test(f.name)).map(f => f.content).join('\n');
    const existingFns = [...extractDefinedFunctions(currentJs)].filter(n => n.length > 2);
    const preserveCtx = existingFns.length
        ? `\n\n🔒 عقد الحفظ (إلزامي): الكود الحالي يعرّف هذه الدوال/الميزات — **احتفظ بها جميعاً كاملةً** ولا تحذف ولا تُبسّط أياً منها (خاصةً الميزات المُضافة سابقاً كالتقارير المالية). أضِف المطلوب فوقها، وأعِد الملف **كاملاً** بكل دواله السابقة + الإضافة الجديدة:\n${existingFns.join('، ')}`
        : '';

    const editInstruction = `${instruction}${editModelCtx || ''}`;

    // 🩹 المسار النموذجي أولاً: تعديل موضعي (patch) — يُعيد الجزء المتغيّر
    // فقط، فلا بتر مهما كبر المشروع، وما لا يُذكر لا يُلمس (حفظ حتمي). نسقط
    // للمسار الكامل فقط إن تعذّر التطبيق الموضعي.
    let plan = null;
    try {
        const patch = await patchEditPlan(instruction, editFiles, lang);
        if (patch.ok && patch.files.length) {
            plan = { files: patch.files };
            reporter.liveLog(roomName, 'EDIT', 'PatchEditor',
                `🩹 تعديل موضعي — ${patch.applied} تغيير على ${patch.files.map(f => f.name).join('، ')} (بلا إعادة كتابة كاملة).`);
            if (patch.retried) {
                reporter.liveLog(roomName, 'EDIT', 'PatchEditor',
                    `🔁 صُحِّحت محاولة فاشلة تلقائياً بعد رؤية المحتوى الفعلي.`);
            }
            if (patch.partial) {
                reporter.liveLog(roomName, 'EDIT', 'PatchEditor',
                    `ℹ️ طُبّق ما أمكن موضعياً؛ تعذّر ${patch.failed.length} جزء (لم يُطابَق) — أعد صياغة الباقي إن لزم.`);
            }
        } else if (patch.failed?.length) {
            reporter.liveLog(roomName, 'EDIT', 'PatchEditor', `↩️ التعديل الموضعي لم يُطابِق — عودة للتعديل الكامل.`);
        }
    } catch (e) { console.warn('[PatchEditor]', e.message); }

    // مسار كامل (احتياط): إعادة كتابة الملف مع عقد الحفظ + حارس الارتداد.
    if (!plan) {
        try {
            plan = await agents.coreEditCodePlan(`${editInstruction}${preserveCtx}`, editFiles, lang,
                (chunk) => reporter.send(roomName, 'code_stream_chunk', chunk));
        } catch (e) {
            reporter.liveLog(roomName, 'EDIT', 'SurgicalEditor', `⚠️ تعذّر — عودة للبناء الكامل: ${e.message}`);
            reporter.send(roomName, 'stream_done', {});
            return ops.runMission(instruction, ctx);
        }
    }
    reporter.send(roomName, 'stream_done', {});

    // فشل الجراحي → عودة آمنة للبناء الكامل
    if (!plan || plan.error || !plan.files?.length) {
        reporter.liveLog(roomName, 'EDIT', 'SurgicalEditor', '⚠️ بلا نتيجة — عودة للبناء الكامل');
        return ops.runMission(instruction, ctx);
    }

    // فحص الملفات المتغيّرة عبر CodeGuard ثم كتابتها فقط
    // (مع تنظيف أي placeholder قوالب تسرّب أثناء التعديل).
    // ensureEditIntegrity قبل الكتابة حتماً — يقارن بالنسخة السابقة على
    // القرص ويعيد ما أسقطه التعديل (رابط التنسيق، DOCTYPE، السكربتات).
    const emitGuard = (m) => reporter.liveLog(roomName, 'EDIT', 'CodeGuard', m);
    const guarded = await ensureEditIntegrity(
        await guardFiles(scrubPlaceholders(plan.files, activeProject), emitGuard),
        projectPath, emitGuard);
    for (const file of guarded) {
        await writeProjectFile(projectPath, file.name, file.content);
    }

    // React: أعِد توليد صفحات المعاينة الثابتة من المحتوى المحدَّث — فينعكس
    // التعديل على كل الصفحات (لا على index وحده).
    if (isReact) {
        try {
            const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
            for (const pg of buildStaticSiteFromSource(src, lang)) {
                await writeProjectFile(projectPath, pg.name, pg.content);
            }
        } catch (e) { reporter.liveLog(roomName, 'EDIT', 'Preview', `⚠️ تعذّر تحديث المعاينة: ${e.message}`); }
    }
    // 🛡️ حارس الارتداد على مرحلتين — العطل السابق: تعديل المستخدم كان يُطبَّق
    // بنجاح، ثم جولة «الإصلاح السلوكي التلقائي» تعيد كتابة الملفات كاملة
    // فتُبتر وتُسقط دوالاً، فيسترجع الحارس *ما قبل تعديل المستخدم* ويمسح
    // تعديلاً نجح فعلاً — «كل تعديل يعود للنسخة الأصلية» (بلاغ مستخدم).
    // الفصل: (أ) تعديل المستخدم نفسه أتلف → استرجاع ما قبله (كما كان).
    //        (ب) جولة الإصلاح التلقائي أتلفت → إلغاء الإصلاح وحده،
    //            وتعديل المستخدم الناجح يبقى.
    // 🔤 «شيل» كانت تُقرأ داخل «تشيلي»، فطلبُ **إضافة** يُعطّل حارسَ الارتداد
    //    أدناه فيضيع ما فقده التعديلُ صامتاً. المُطابِقُ المشترك يمنعها.
    const isRemoval = /احذف|امسح|أزل|إزالة|بسّ?ط|remove|delete|drop|simplify/i.test(instruction)
        || hasKeyword(instruction, ['شيل']);
    const readLostFns = async () => {
        const js = (await readProjectFiles(projectPath))
            .filter(f => /\.(m?js)$/i.test(f.name)).map(f => f.content).join('\n');
        const after = extractDefinedFunctions(js);
        return existingFns.filter(n => !after.has(n));
    };
    const restoreFiles = async (snapshot) => {
        for (const f of snapshot) await writeProjectFile(projectPath, f.name, f.content);
        if (isReact) {
            try {
                const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
                for (const pg of buildStaticSiteFromSource(src, lang)) await writeProjectFile(projectPath, pg.name, pg.content);
            } catch {}
        }
    };

    // (أ) فحص تعديل المستخدم قبل أي إصلاح تلقائي
    try {
        const lost = await readLostFns();
        if (lost.length >= 2 && !isRemoval) {
            reporter.liveLog(roomName, 'EDIT', 'RegressionGuard',
                `↩️ التعديل حذف ${lost.length} ميزة (${lost.slice(0, 5).join('، ')}) — استرجاع نسختك الكاملة.`);
            await restoreFiles(files);
            reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
            const warn = lang === 'en'
                ? `⚠️ This change would have dropped existing features (${lost.slice(0, 4).join(', ')}) — likely the file grew and the output was cut off. I kept your full working version. Try a smaller, more specific change (one feature at a time).`
                : `⚠️ هذا التعديل كان سيحذف ميزات موجودة (${lost.slice(0, 4).join('، ')}) — غالباً لأن الملف كبر وانقطع الناتج. أبقيتُ نسختك الكاملة سليمة. جرّب طلباً **أصغر وأكثر تحديداً** (ميزة واحدة كل مرة).`;
            reporter.send(roomName, 'chat_reply', { message: warn });
            return { success: false, reverted: true, lost };
        }
    } catch (e) { console.warn('[RegressionGuard]', 'تعذّر فحص الارتداد:', e.message); }

    // 📸 تعديل المستخدم سليم — لقطة ما بعده مرجعُ استرجاعٍ لأي عبث لاحق
    let postEditSnapshot = [];
    try { postEditSnapshot = await readProjectFiles(projectPath); } catch { /* الفحص (ب) سيُتخطى */ }

    // 🔬 تحقّق سلوكي بعد التعديل — يمسك إن كسر التعديل تشغيل الصفحة أو
    // ترك دوراً بلا واجهة، ويُصلح جولةً واحدة قبل إعلان النجاح.
    try {
        await ops.verify({
            projectPath, blueprint: null, username, activeProject, roomName, agents, lang, canFix: true,
        });
    } catch (e) { console.warn('[BehaviorVerify]', 'تخطّي التحقّق بعد التعديل:', e.message); }

    // (ب) فحص ما بعد الإصلاح التلقائي — إتلافه يُلغيه هو، لا تعديل المستخدم
    try {
        if (postEditSnapshot.length) {
            const lost = await readLostFns();
            if (lost.length >= 2 && !isRemoval) {
                reporter.liveLog(roomName, 'EDIT', 'RegressionGuard',
                    `↩️ جولة الإصلاح التلقائي أسقطت ${lost.length} ميزة (${lost.slice(0, 5).join('، ')}) — أُلغي الإصلاح وحده، تعديلك محفوظ.`);
                await restoreFiles(postEditSnapshot);
            }
        }
    } catch (e) { console.warn('[RegressionGuard]', 'تعذّر فحص ما بعد الإصلاح:', e.message); }

    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });

    const changedNames = guarded.map(f => f.name).join('، ');
    recordEdit(username, instruction);
    recordEditAction(username, activeProject); // عدّاد تعديلات اللوحة — كان لا يُستدعى أبداً
    addToHistory(username, activeProject, `تعديل: ${instruction.slice(0, 60)}`);

    // تحديث المعاينة + قائمة الملفات + لقطة دائمة
    reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
    reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));
    let builtFiles = [];
    try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
    reporter.send(roomName, 'workspace_files', builtFiles);
    snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});

    const msg = lang === 'ar'
        ? `✅ طبّقت التعديل على: **${changedNames}** فقط (بلا إعادة بناء الموقع) — المعاينة تحدّثت.`
        : `✅ Applied the change to **${changedNames}** only (no full rebuild) — preview updated.`;
    reporter.send(roomName, 'chat_reply', { message: msg, options: lang === 'ar' ? ['🚀 انشر الآن', '📊 أين وصلنا'] : ['🚀 Deploy now', '📊 Status'] });
    return { success: true, edited: guarded.map(f => f.name) };
}
