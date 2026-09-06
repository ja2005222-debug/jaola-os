/**
 * ➕ stages/addPage.js — إضافةُ صفحةٍ إلى مشروع React قائم بلا إعادة بناء: قراءةُ `lib/content.js`، اسمُ مكوّنٍ ومسارٌ (slug)
 * فريدان، محتوىً قالبيٌّ يخصّصه الذكاءُ (best-effort)، كتابةُ المحتوى والمكوّن وصفحة Next، إعادةُ توليد الموقع الثابت كلِّه،
 * ثمّ الذاكرةُ والقياساتُ والمعاينةُ والتقرير. تعذّرُ قراءة المحتوى → احتياطُ «عودة للبناء» بسياقٍ من الوسائط (JCR/متابعة-ج).
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/23 بالمنهج نفسِه: المُبلِّغُ يُمرَّر، و`_runMissionNow` — الطريقةُ الوحيدة التي كانت
 * تُستدعى بـ`this` والاختباراتُ تستبدلها على النسخة — تُمرَّر دالّةً في `ops` (كما فعلت JCR/22). `extractPageName` يُستورد.
 * `reporter.io` موضعٌ واحد للدفع التلقائيّ. نقلٌ حرفيّ.
 */
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { smartChat } from '../../core/providers/llm.js';
import { generateSectionContent, compName, slugify, componentSource, defaultSection, pageFileSource } from '../reactGenerator.js';
import { buildStaticSite } from '../../services/reactPreview.js';
import { addToHistory } from '../projectMemory.js';
import { recordEdit } from '../userProfile.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { recordEditAction, buildMetricsPayload } from '../../services/metricsStore.js';
import { createExecutionContext } from '../../core/runtime/ExecutionContext.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';
import { extractPageName } from './reactPages.js';

// ➕ يضيف صفحة جديدة لمشروع React قائم دون إعادة بناء — يحفظ المحتوى الحالي:
//    قسم + وجهة في lib/content.js، مكوّن، صفحة Next، ثم إعادة توليد الموقع الثابت.
export async function addPageNow(instruction, projectPath, username, activeProject, roomName, lang, reporter, ops) {
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
    reporter.liveLog(roomName, 'EDIT', 'AddPage', '➕ إضافة صفحة جديدة (بلا إعادة بناء)...');

    // اقرأ المحتوى الحالي (lib/content.js: export const content = {...})
    let content;
    try {
        const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
        content = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
    } catch (e) {
        reporter.liveLog(roomName, 'EDIT', 'AddPage', `⚠️ تعذّر قراءة المحتوى — عودة للبناء: ${e.message}`);
        // 🔴 كان `{ ...ctx }` — و`ctx` ليس من وسائط هذه الطريقة الستّ، فكان الاحتياطُ يرمي
        //    `ReferenceError: ctx is not defined` بعد أن وعد السجلُّ بالعودة للبناء، وتموت المهمّةُ
        //    في الصفّ بلا ردٍّ للمستخدم. السياقُ يُبنى من الوسائط نفسِها (مقيسٌ في JCR/متابعة-ج).
        return ops.runMission(instruction, createExecutionContext({ projectPath, username, activeProject, roomName, agents: {}, dbStatus: null }));
    }

    const pageLabel = extractPageName(instruction, lang);

    // اسم مكوّن + مسار (slug) فريدان
    const existingComps = new Set(Object.keys(content.sections || {}));
    const existingSlugs = new Set((content.routes || []).map(r => (r.href || '').replace(/^\//, '')));
    // التفرّد بلاحقةٍ رقمية لا بإعادة الاشتقاق: `compName` صار يشتقّ الاسم
    // من **معنى** التسمية لا من موضعها، فهو ثابتٌ مهما تغيّر `n` — وإعادةُ
    // ندائه في حلقةٍ شرطُها ثباتُ القيمة حلقةٌ لا تنتهي.
    const base = compName(pageLabel, existingComps.size);
    let comp = base, dup = 1;
    while (existingComps.has(comp)) comp = base + (++dup);
    let slug = slugify(comp), k = 1;
    while (existingSlugs.has(slug) || slug === '' ) { slug = slugify(comp) + '-' + (++k); }

    // محتوى الصفحة: قالبي افتراضياً، ويخصّصه الذكاء بمحتوى واقعي (best-effort)
    let section = defaultSection(pageLabel, lang);
    try {
        reporter.liveLog(roomName, 'EDIT', 'ContentWriter', '✍️ تخصيص محتوى الصفحة بالذكاء...');
        const model = await generateSectionContent(pageLabel, {
            brand: content.brand || activeProject,
            goal: content.hero?.title || content.hero?.subtitle || '',
            lang, llm: (m, o) => smartChat(m, o),
        });
        if (model) section = {
            heading: model.heading || section.heading,
            subheading: model.subheading || section.subheading,
            items: (model.items && model.items.length) ? model.items : section.items,
        };
    } catch { /* الافتراضي */ }

    // حدّث المحتوى: قسم جديد + وجهة تنقّل
    content.sections = content.sections || {};
    content.sections[comp] = section;
    content.routes = content.routes || [{ label: lang === 'ar' ? 'الرئيسية' : 'Home', href: '/' }];
    content.routes.push({ label: pageLabel, href: '/' + slug });

    // اكتب: content.js + مكوّن القسم + صفحة Next
    await fsPromises.writeFile(path.join(projectPath, 'lib/content.js'),
        `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(content, null, 2)};\n`);
    await fsPromises.writeFile(path.join(projectPath, `components/${comp}.jsx`), componentSource(comp, lang));
    await fsPromises.mkdir(path.join(projectPath, `app/${slug}`), { recursive: true });
    const hasNav = fs.existsSync(path.join(projectPath, 'components/Navbar.jsx'));
    const hasFooter = fs.existsSync(path.join(projectPath, 'components/Footer.jsx'));
    const body = [hasNav ? 'Navbar' : null, comp, hasFooter ? 'Footer' : null].filter(Boolean);
    await fsPromises.writeFile(path.join(projectPath, `app/${slug}/page.jsx`), pageFileSource('/' + slug, `${comp}Page`, body, 2));

    // أعِد توليد الموقع الثابت كله (الصفحة الجديدة + الشريط المحدَّث في كل صفحة)
    for (const pg of buildStaticSite(content, lang)) {
        await writeProjectFile(projectPath, pg.name, pg.content);
    }

    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
    addToHistory(username, activeProject, `إضافة صفحة: ${pageLabel}`);
    recordEdit(username, instruction);
    recordEditAction(username, activeProject); // عدّاد تعديلات اللوحة

    reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
    reporter.send(roomName, 'project_metrics', buildMetricsPayload(username, activeProject));
    let builtFiles = [];
    try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
    reporter.send(roomName, 'workspace_files', builtFiles);
    snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});

    const msg = lang === 'ar'
        ? `✅ أضفت صفحة **${pageLabel}** (\`${slug}.html\`) وربطتها بشريط التنقّل في كل الصفحات — المعاينة تحدّثت. اضغط رابطها لفتحها.`
        : `✅ Added page **${pageLabel}** (\`${slug}.html\`), linked in the nav across all pages — preview updated. Click its link to open it.`;
    reporter.send(roomName, 'chat_reply', {
        message: msg,
        options: lang === 'ar' ? ['➕ أضف صفحة أخرى', '✏️ عدّل محتواها', '🚀 انشر الآن'] : ['➕ Add another page', '✏️ Edit its content', '🚀 Deploy now'],
    });
    return { success: true, addedPage: slug, label: pageLabel };
}
