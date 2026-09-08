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
/**
 * ⚛️ PM/22 — «نوعُ المشروع حقيقةٌ على القرص»: هل هذا مشروعُ React/Next؟ يُسأل القرصُ مباشرةً، لا قائمةُ
 * `readProjectFiles` — فتلك تقرأ الصفحةَ وما تُحمّله وحدَها **بتصميمٍ مقصود** (انظر فوق)، فلا ترى
 * `lib/content.js` قطّ. قِيس أنّ الاشتقاقَ منها يجعل `isReact` خطأً على كلِّ مشروع React حقيقيّ، فتموت
 * عمليّاتُ الصفحات الثلاث ولا تُعاد المعاينةُ من مصدرها. الكشفُ هنا لا يُوسّع القارئَ ولا يمسّه.
 */
export async function isReactProject(projectPath) {
    for (const marker of ['lib/content.js', 'app/page.jsx']) {
        try { await fsPromises.access(path.join(projectPath, marker)); return true; } catch { /* التالي */ }
    }
    return false;
}

/**
 * ⚛️ PM/22 — **مصادرُ** مشروع React: `lib/content.js` (المحتوى) + مكوّناتُ `components/`. قِيس أنّ فرعَ React
 * في التعديل الجراحيّ يستبعد صفحاتِ HTML المولَّدة — وهو صحيح، فهي تُعاد من المصدر — لكنّ قارئَ التعديل
 * لا يعود إلّا بـ`index.html`، فيبقى المُعدِّلُ بـ**صفر ملفّات**. هذا ليس توسيعاً لقارئ الصفحات (تحذيرُ PM/15
 * قائم): هذه ليست صفحاتٍ يختار المُعدِّلُ خطأً من بينها، بل مصدرُ المشروع الوحيد الذي تُشتقّ منه كلُّ صفحاته.
 * `[]` عند أيّ خطأ.
 */
export async function readReactSources(projectPath) {
    const out = [];
    const add = async (rel) => {
        try { out.push({ name: rel, content: await fsPromises.readFile(path.join(projectPath, rel), 'utf-8') }); } catch { /* غائب */ }
    };
    await add('lib/content.js');
    try {
        for (const e of await fsPromises.readdir(path.join(projectPath, 'components'), { withFileTypes: true })) {
            if (e.isFile() && /\.(jsx?|tsx?)$/i.test(e.name)) await add(`components/${e.name}`);
        }
    } catch { /* بلا مجلّد مكوّنات */ }
    return out;
}

/**
 * 🏗️ **أثمّة مشروعٌ هنا؟** — سؤالُ وجودٍ يُسأل **للقرص**، لا يُشتقّ من قارئ محتوى.
 *
 * **العطبُ المقيس**: أربعةٌ من مواضع نداء `readCodeContext` لا تريد المحتوى أصلاً —
 * تسأل هذا السؤال عبر `length > 100` (وفي `selectBuildStrategy` عبر `< 80` باسم
 * `isFreshBuild`). وذلك القارئُ يفلتر بقائمةٍ **مغلقة** من ثلاثة أسماء
 * (`index.html`/`styles.css`/`script.js`). فمستودعٌ بسبعةِ ملفّات PHP حقيقيّة يُقرأ
 * **صفرَ حرف** → `isFreshBuild = true` → وهو الشرطُ الذي **يُجيز الاستبدالَ الكامل**.
 * أي أنّ مشروعاً عامراً **يُدهَس صامتاً**. (قِيس: ٧ ملفّات ← ٠ حرفاً ← يُعامَل فارغاً.)
 *
 * ولا يقتصر على المستودعات الغريبة: مشروعُ React خالص، أو مشروعٌ يسمّي ملفَّه `main.js`،
 * يُقرأ فارغاً بالقدر نفسِه.
 *
 * **ما تغيّر وما لم يتغيّر**: العطبُ في **القائمة المغلقة** لا في **العتبة**. فالعتبةُ
 * تبقى — مشروعٌ صفحتُه `<h1>x</h1>` (أحد عشر حرفاً) بقيّةُ ركامٍ من بناءٍ فاشل، لا
 * منتجٌ يُخشى دهسُه؛ ولو عُدّ قائماً لامتنع مسارُ React عنه إلى الأبد. فالسؤالُ هنا:
 * «أعلى القرص مصدرٌ يزن شيئاً؟» — **بلا قائمةِ أسماء ولا قائمةِ امتدادات**، وبالحجم
 * وحدَه. والعتبةُ تُمرَّر من موضع النداء بقيمتِه التي كانت له، فلا رقمَ يتغيّر خلسة.
 *
 * **ولمَ لا يُوسَّع القارئُ القائم؟** تحذيرُ PM/15 قائمٌ حرفيّاً: «لو رأى المُعدِّلُ سبعَ
 * صفحاتٍ لعدّل الخطأ منها». وهذه **سادسةُ** حالات المبدأ نفسِه (بعد PM/11 قائمة، PM/14 نصّ،
 * PM/17 اسم، PM/19 ذاكرة، PM/20 مفتاح، PM/22 نوع): قارئٌ صحيحٌ لغرضه، أُعيد استعمالُه
 * لغرضٍ آخر. والسابقةُ في هذا الملفّ نفسِه: `isReactProject` يسأل `access` ولا يقرأ محتوى.
 *
 * **رخيصٌ عمداً**: `stat` لا `readFile` — لا يُقرأ محتوى أصلاً؛ ويخرج عند تجاوز العتبة.
 * وميزانيّةُ عقدٍ مقيَّدة (`budget`) تحدّه على مستودعٍ ضخم.
 *
 * ⚠️ **حدٌّ مكتوب**: يقول «أثمّة شيء؟» فقط. لا يقول ما هو، ولا أنّ جولا يفهمه — وقراءةُ
 *    محتواه سؤالٌ آخر لم يُبنَ هنا ولا يُدَّعى.
 */
const NOISE_DIR = new Set(['node_modules', 'vendor', 'dist', 'build', '__pycache__']);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp[34]|zip|gz|pdf|lock)$/i;

export async function hasProjectSource(projectPath, { minBytes = 80, budget = 400 } = {}) {
    let seen = 0;
    let bytes = 0;
    const walk = async (dir) => {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        const dirs = [];
        for (const e of entries) {
            if (++seen > budget) return false;
            if (e.name.startsWith('.') || NOISE_DIR.has(e.name)) continue;
            if (e.isDirectory()) { dirs.push(e.name); continue; }
            if (BINARY_EXT.test(e.name)) continue;
            bytes += (await fsPromises.stat(path.join(dir, e.name))).size;
            if (bytes > minBytes) return true;          // كفى دليلاً
        }
        for (const d of dirs) if (await walk(path.join(dir, d))) return true;
        return false;
    };
    try { return await walk(projectPath); } catch { return false; }
}

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
