/**
 * 📄 stages/reactPages.js — عمليّاتُ صفحات مشروع React القائم (بلا إعادة بناء): استخراجُ اسم الصفحة من الأمر
 * وتنظيفُه، قراءةُ `lib/content.js`، إيجادُ صفحةٍ بالاسم، الكتابةُ + إعادةُ توليد الموقع الثابت + البثّ، إعادةُ التسمية،
 * الحذفُ، و«لم أجد صفحة».
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/20 بالمنهج نفسِه: أربعُ دوالّ نقيّة بلا `this`، وأربعٌ تبثّ (`reporter` وسيطاً
 * أخيراً؛ `reporter.io` موضعٌ واحد للدفع التلقائيّ — انظر JCR/10). النداءاتُ بين أفراد العائلة صارت مباشرة. المفوِّضاتُ الثماني
 * تبقى على الصنف لأنّ `_runSurgicalEditNow`/`_addPageNow` يستدعيانها بـ`this` والاختباراتُ تستبدل بعضَها. نقلٌ حرفيّ.
 */
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { addToHistory } from '../projectMemory.js';
import { slugify } from '../reactGenerator.js';
import { buildStaticSite } from '../../services/reactPreview.js';
import { autoPushIfEnabled } from '../../services/githubSync.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';

// يستخرج اسم الصفحة من أمر "أضف صفحة …" (عربي/إنجليزي)
export function extractPageName(instruction, lang) {
    let s = String(instruction || '').trim();
    s = s.replace(/^[^\p{L}]+/u, '');   // أزل الرموز/الإيموجي في البداية (زر "➕ أضف صفحة")
    s = s.replace(/^\s*(?:من فضلك|رجاء[ًا]?|please)\s+/i, '');
    s = s.replace(/^\s*(?:أضف|اضف|أضِف|ضيف|زد|أنشئ|انشئ|اضافة|إضافة|add|create|make)\s+/i, '');
    s = s.replace(/^\s*(?:لي|me)\s+/i, '');
    s = s.replace(/^\s*(?:a|an)\s+/i, '');
    s = s.replace(/^\s*(?:جديدة|جديد|new)\s+/i, '');
    s = s.replace(/^\s*(?:صفحة|صفحه|page)\s+/i, '');
    s = s.replace(/^\s*(?:جديدة|جديد|new)\s+/i, '');
    s = s.replace(/^\s*(?:اسمها|بعنوان|باسم|تسمى|عنوانها|بـ|called|named|titled|about|for)\s+/i, '');
    s = s.replace(/["'«»]/g, '').replace(/[.،,!?]+$/g, '').trim();
    // بقايا من كلمات دالّة فقط (زر "أضف صفحة" بلا اسم) → افتراضي
    s = s.replace(/^(?:صفحة|صفحه|page|جديدة|جديد|new)(?:\s+(?:صفحة|صفحه|page|جديدة|جديد|new))*$/i, '').trim();
    if (!s || s.length > 60) return lang === 'ar' ? 'صفحة جديدة' : 'New Page';
    return s;
}

// ينظّف اسم صفحة ملتقَط من أمر (يزيل الاقتباس/الترقيم/كلمة صفحة الزائدة)
export function cleanPageName(s) {
    return String(s || '')
        .replace(/["'«»]/g, '')
        .replace(/^\s*(?:صفحة|صفحه|the|page)\s+/i, '')
        .replace(/[.،,!?\s]+$/g, '')
        .trim();
}

// يقرأ محتوى مشروع React من القرص (أو null)
export async function readReactContent(projectPath) {
    try {
        const src = await fsPromises.readFile(path.join(projectPath, 'lib/content.js'), 'utf8');
        return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
    } catch { return null; }
}

// يجد صفحة بالاسم (تطابق تسمية الوجهة، ثم تضمين، ثم المسار)
export function findPage(content, name) {
    const t = String(name || '').trim().toLowerCase();
    const routes = (content.routes || []).filter(r => r.href !== '/');
    const compBySlug = {};
    for (const c of Object.keys(content.sections || {})) compBySlug[slugify(c)] = c;
    const route = routes.find(r => (r.label || '').trim().toLowerCase() === t)
        || routes.find(r => (r.label || '').trim().toLowerCase().includes(t) && t.length >= 2)
        || routes.find(r => r.href.replace(/^\//, '') === slugify(t));
    if (!route) return null;
    const slug = route.href.replace(/^\//, '');
    return { route, slug, comp: compBySlug[slug] };
}

// كتابة المحتوى + إعادة توليد الموقع الثابت + بثّ التحديث (مشترك لعمليات الصفحات)
export async function persistReactContent(projectPath, content, username, activeProject, roomName, lang, historyMsg, reporter) {
    await fsPromises.writeFile(path.join(projectPath, 'lib/content.js'),
        `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(content, null, 2)};\n`);
    for (const pg of buildStaticSite(content, lang)) {
        await writeProjectFile(projectPath, pg.name, pg.content);
    }
    reporter.send(roomName, 'agent_states', { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
    addToHistory(username, activeProject, historyMsg);
    reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
    let builtFiles = [];
    try { builtFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
    reporter.send(roomName, 'workspace_files', builtFiles);
    snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
    autoPushIfEnabled(username, activeProject, projectPath, reporter.io, roomName).catch(() => {});
}

// 🖊️ إعادة تسمية صفحة (تسمية الوجهة + عنوان القسم) — تحفظ المسار والملفات
export async function renamePageNow(projectPath, username, activeProject, roomName, lang, oldName, newName, reporter) {
    const content = await readReactContent(projectPath);
    if (!content) return reporter.send(roomName, 'chat_reply', { message: lang === 'ar' ? '⚠️ تعذّر قراءة المشروع.' : '⚠️ Could not read project.' });
    const found = findPage(content, oldName);
    if (!found || !found.comp) return pageNotFound(content, roomName, lang, oldName, reporter);
    found.route.label = newName;
    if (content.sections[found.comp]) content.sections[found.comp].heading = newName;
    await persistReactContent(projectPath, content, username, activeProject, roomName, lang, `إعادة تسمية صفحة: ${oldName} → ${newName}`, reporter);
    reporter.send(roomName, 'chat_reply', {
        message: lang === 'ar' ? `✅ أعدت تسمية الصفحة إلى **${newName}** — حُدِّث الشريط في كل الصفحات.` : `✅ Renamed the page to **${newName}** — nav updated across all pages.`,
        options: lang === 'ar' ? ['➕ أضف صفحة', '🚀 انشر الآن'] : ['➕ Add a page', '🚀 Deploy now'],
    });
    return { success: true, renamed: found.slug, label: newName };
}

// 🗑️ حذف صفحة (الوجهة + القسم + الملفات) — لا يمكن حذف الرئيسية
export async function deletePageNow(projectPath, username, activeProject, roomName, lang, name, reporter) {
    const content = await readReactContent(projectPath);
    if (!content) return reporter.send(roomName, 'chat_reply', { message: lang === 'ar' ? '⚠️ تعذّر قراءة المشروع.' : '⚠️ Could not read project.' });
    const found = findPage(content, name);
    if (!found || !found.comp) return pageNotFound(content, roomName, lang, name, reporter);
    // احذف من المحتوى
    content.routes = (content.routes || []).filter(r => r.href !== found.route.href);
    delete content.sections[found.comp];
    // احذف الملفات (المكوّن + صفحة Next + صفحة المعاينة)
    await fsPromises.rm(path.join(projectPath, `components/${found.comp}.jsx`), { force: true });
    await fsPromises.rm(path.join(projectPath, `app/${found.slug}`), { recursive: true, force: true });
    await fsPromises.rm(path.join(projectPath, `${found.slug}.html`), { force: true });
    await persistReactContent(projectPath, content, username, activeProject, roomName, lang, `حذف صفحة: ${found.route.label}`, reporter);
    reporter.send(roomName, 'chat_reply', {
        message: lang === 'ar' ? `✅ حذفت صفحة **${found.route.label}** وأزلتها من شريط التنقّل — المعاينة تحدّثت.` : `✅ Deleted page **${found.route.label}** and removed it from the nav — preview updated.`,
        options: lang === 'ar' ? ['➕ أضف صفحة', '🚀 انشر الآن'] : ['➕ Add a page', '🚀 Deploy now'],
    });
    return { success: true, deleted: found.slug };
}

export function pageNotFound(content, roomName, lang, name, reporter) {
    const names = (content.routes || []).filter(r => r.href !== '/').map(r => r.label).join('، ');
    reporter.send(roomName, 'chat_reply', {
        message: lang === 'ar'
            ? `⚠️ لم أجد صفحة باسم «${name}». الصفحات الحالية: ${names || '—'}`
            : `⚠️ No page named "${name}". Current pages: ${names || '—'}`,
    });
    return { success: false, notFound: name };
}
