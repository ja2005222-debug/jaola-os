/**
 * 📖 agents/projectReader.js — قارئا ملفّات المشروع المشتركان بين البناء والتعديل الجراحيّ:
 *   - `readCodeContext(projectPath)` → نصٌّ واحد (index.html/styles.css/script.js) لسياق الـLLM؛ فارغٌ عند أيّ خطأ.
 *   - `readProjectFiles(projectPath)` → مصفوفة `{name, content}`: كلُّ CSS + الصفحةُ وما تُحمّله فعلاً (تحديدُ المُتحقّق)
 *     + احتياطُ `script.js` غير المُشار إليه؛ `[]` عند أيّ خطأ. **قارئُ التعديل** — من يقرأ ليكتب.
 *   - `readBuiltFiles(projectPath)` → **قارئُ الحكم** (PM/15): كلُّ مصدرٍ وصل القرصَ، بمجلّداته. لا يُستعمل للتعديل.
 *
 * خرجا من `JaolaCognitiveRuntime` في JCR/15: لا `this` فيهما أصلاً (٨ + ٤ مستدعين عبر مفوِّضَين باقيَين على الصنف —
 * الاختباراتُ تستبدلهما على النسخة). يبقيان في طبقة `agents` لأنّ الثاني يستورد `readPageCode` من `behaviorVerifier`
 * (حارسُ الطبقات: `core → agents` ممنوع). نقلٌ حرفيّ.
 */
import { promises as fsPromises } from 'fs';
import path from 'path';
import { readPageCode } from './behaviorVerifier.js';

export async function readCodeContext(projectPath) {
    let context = "";
    try {
        const files = await fsPromises.readdir(projectPath);
        const relevant = files.filter(f => ['index.html', 'styles.css', 'script.js'].includes(f));
        const contents = await Promise.all(relevant.map(async f => ({
            name: f, content: await fsPromises.readFile(path.join(projectPath, f), 'utf-8')
        })));
        contents.forEach(f => { context += `\n--- ${f.name} ---\n${f.content}\n`; });
    } catch (e) {}
    return context;
}

/**
 * 🧾 PM/15 — **قارئُ الحكم**: كلُّ مصدرٍ وصل القرصَ، بمجلّداته.
 *
 * `readProjectFiles` تحته يختار **الصفحةَ وما تُحمّله** — تحديدٌ صحيحٌ لغرضه (التعديلُ والإصلاح يعملان على
 * صفحةٍ بعينها) وخاطئٌ للحكم. قِيس على مسار React بوثيقة مكتبة: البناءُ يكتب ٣٠ ملفّاً منها ٧ صفحاتٍ ثابتة،
 * والقارئُ يعود بـ`index.html` وحدَها — فالمتطلّباتُ ٣/٤ بدل ٤/٤، وبنودُ الوثيقة ١٠/١٢ بدل ١١/١٢: **سقوطٌ
 * زائف** على صفحاتٍ بُنيت فعلاً. (وعلى مسار الكلون قِيس ٠ من ٤١ ملفّاً مخفيّاً — ملفّاتُه الثلاثة كلُّها
 * تُقرأ؛ فهذا التوحيدُ هناك بلا أثرٍ اليوم، وقاعدةُ القاضي واحدة.)
 *
 * لا يُوسَّع القارئُ القائمُ مكانَه: له تسعةُ مواضع نداء، منها ثلاثةٌ في التعديل الجراحيّ وواحدٌ في جولة
 * الإصلاح — لو رأى المُعدِّلُ سبعَ صفحاتٍ لعدّل الخطأ منها.
 *
 * ما يُقرأ: امتداداتُ المصدر التي يقرؤها بشر. ما لا يُقرأ: `node_modules` وكلُّ مجلّدٍ يبدأ بنقطة (سجلُّ git
 * ليس منتجَ المستخدم)، والثنائيّاتُ والصور. `[]` عند أيّ خطأ — كالقارئ القائم، فالحكمُ لا ينهار بمسارٍ غائب.
 * @returns {Promise<Array<{name: string, content: string}>>} الاسمُ مسارٌ نسبيٌّ بفواصل `/`
 */
const SOURCE_EXT = /\.(html?|jsx?|tsx?|mjs|cjs|css|json|md|svg|txt)$/i;
export async function readBuiltFiles(projectPath) {
    const out = [];
    const walk = async (dir, prefix) => {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            if (e.name.startsWith('.') || e.name === 'node_modules') continue;
            const rel = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.isDirectory()) await walk(path.join(dir, e.name), rel);
            else if (SOURCE_EXT.test(e.name)) {
                out.push({ name: rel, content: await fsPromises.readFile(path.join(dir, e.name), 'utf-8') });
            }
        }
    };
    try { await walk(projectPath, ''); return out; } catch { return []; }
}

// ملفات الواجهة للتعديل/الإصلاح: index.html + كل CSS + سكربتات الواجهة
// التي يشير إليها index.html فعلاً (لا server.js). كان مثبّتاً على
// "script.js" فقط، فمشروع يستخدم app.js كان *أعمى* للتعديل والإصلاح.
export async function readProjectFiles(projectPath) {
    try {
        const out = [];
        const files = await fsPromises.readdir(projectPath);
        // كل ملفات CSS (سياق التنسيق للتعديل)
        for (const f of files) {
            if (/\.css$/i.test(f)) {
                out.push({ name: f, content: await fsPromises.readFile(path.join(projectPath, f), 'utf-8') });
            }
        }
        // index.html + السكربتات التي تُحمّلها الصفحة (نفس تحديد المُتحقّق)
        const page = await readPageCode(projectPath);
        if (page) {
            out.push({ name: 'index.html', content: page.html });
            for (const [name, content] of Object.entries(page.assets)) {
                if (!out.some(x => x.name === name)) out.push({ name, content });
            }
        }
        // احتياط: script.js موجود لكن لم يشِر إليه index.html
        if (files.includes('script.js') && !out.some(x => x.name === 'script.js')) {
            out.push({ name: 'script.js', content: await fsPromises.readFile(path.join(projectPath, 'script.js'), 'utf-8') });
        }
        return out;
    } catch { return []; }
}
