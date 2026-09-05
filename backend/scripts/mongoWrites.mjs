/**
 * 🗄️ mongoWrites.mjs — جردُ مواضع الكتابة المباشرة على Mongo في `backend/`.
 *
 * وُجد لأنّ `ARCHITECTURE_GAP_AUDIT.md` قدّر «٢٠ كاتباً على القاعدة» بمطابقةٍ
 * نصّيّة، ورقمان سابقان من المصدر نفسِه أخطآ في **الاتجاهين**: الكتابةُ على
 * القرص ٣٣ والمقيسُ ١٩٨، وتشغيلُ الصدفة ١٦ والمقيسُ واحد. فالرقمُ الثالثُ
 * لا يُنقل، بل يُقاس.
 *
 * ── لماذا لا تكفي مطابقةُ أسماء العمليّات وحدَها
 *
 * `.create(` وحدَها تظهر ١٥ مرّةً في الخلفية، **واحدةٌ منها فقط** على Mongo.
 * الباقي: `groq.chat.completions.create`، `stripe.paymentIntents.create`،
 * `prisma.product.create`. فالعمليّةُ لا تُعرّف الوجهة — **المستقبِلُ يُعرّفها**.
 *
 * لذلك يُشتقّ الماسحُ أوّلاً معرِّفاتِ نماذجِ Mongo في كلِّ ملفّ:
 *   • `import X from '…/models/…'`
 *   • `const X = mongoose.models.Y || mongoose.model('Y', …)`
 * ثمّ يطابق `X.<عمليّةُ كتابة>(` على تلك المعرِّفات وحدَها.
 *
 * ── ثلاثُ حالاتٍ لا تُخلط في الحكم (تصنيفٌ مُعارٌ من `diskWrites.mjs`)
 *
 *   1. **كتابةُ الخلفية نفسها** — ما نريد ضبطَه.
 *   2. **داخل قالبٍ نصّيّ** — كودٌ يُولَّد لمشروع المستخدم ويُنفَّذ عنده
 *      (`agents/authAgent.js` يولّد `User.create` لتطبيقِ المستخدم لا لنا).
 *   3. **في تعليقٍ أو نصّ** — لا يُنفَّذ.
 *
 * ⚠️ حدٌّ قائم: `doc.save()` مستقبِلُها **مثيلٌ** لا نموذج، فلا يُشتقّ نوعُه
 *    بلا تحليلِ تدفّق. تُبلَّغ منفصلةً كـ `saves` — مُرشَّحاتٌ تُفحص بيدٍ لا
 *    نتيجةٌ مؤكَّدة. **الإبلاغُ عن حدٍّ أصدقُ من ابتلاعِه.**
 *
 * التشغيل:  node scripts/mongoWrites.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { charStates } from './diskWrites.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND = path.resolve(HERE, '..');
const SKIP = new Set(['node_modules', '.git', 'memory', 'workspaces', '.next', 'dist', 'build', 'tests', 'scripts']);

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
        else if (/\.m?js$/.test(e.name)) out.push(p);
    }
    return out;
}

/** عمليّاتُ الكتابة في Mongoose — القراءةُ (`find`/`countDocuments`) خارجَها عمداً. */
export const WRITE_OPS = Object.freeze([
    'create', 'insertMany', 'updateOne', 'updateMany', 'replaceOne',
    'findOneAndUpdate', 'findByIdAndUpdate', 'findOneAndReplace',
    'deleteOne', 'deleteMany', 'findOneAndDelete', 'findByIdAndDelete', 'remove',
    'bulkWrite', 'createIndex', 'createIndexes', 'syncIndexes', 'dropIndex', 'dropIndexes',
]);

const IMPORT_MODEL = /import\s+(\w+)\s+from\s+['"][^'"]*models\/[^'"]+['"]/g;
/** 🔴 الاستيرادُ الديناميكيّ: أوّلُ صيغةٍ كتبتُها أغفلته، فسقط
 *  `services/deployAutomation.js:119` من الجرد كلِّه. */
const DYNAMIC_MODEL = /(?:const|let|var)\s+(\w+)\s*=\s*\(\s*await\s+import\(\s*['"][^'"]*models\/[^'"]+['"]\s*\)\s*\)/g;
const INLINE_MODEL = /(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*mongoose\.model[s]?\b/g;

/** معرِّفاتُ نماذجِ Mongo المرئيّةُ في هذا الملفّ — من الكود وحدَه لا من نصوصه. */
export function modelIdents(src, st = charStates(src)) {
    const names = new Set();
    for (const re of [IMPORT_MODEL, DYNAMIC_MODEL, INLINE_MODEL]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(src))) { if (st[m.index] === 0) names.add(m[1]); }
    }
    return names;
}

const lineOf = (src, i) => src.slice(0, i).split('\n').length;

/**
 * @returns {{own:string[], generated:string[], inert:string[], saves:string[]}}
 *          كلٌّ منها `ملفّ:سطر → المستقبِل.العمليّة`
 */
export function scanMongoWrites(root = BACKEND) {
    const own = [], generated = [], inert = [], saves = [];
    for (const abs of walk(root)) {
        const rel = path.relative(root, abs);
        const src = fs.readFileSync(abs, 'utf8');
        const st = charStates(src);
        const models = modelIdents(src, st);
        if (models.size) {
            const re = new RegExp(`\\b(${[...models].join('|')})\\.(${WRITE_OPS.join('|')})\\s*\\(`, 'g');
            let m;
            while ((m = re.exec(src))) {
                const at = `${rel}:${lineOf(src, m.index)} → ${m[1]}.${m[2]}`;
                const s = st[m.index];
                if (s === 3) generated.push(at); else if (s === 0) own.push(at); else inert.push(at);
            }
        }
        const sv = /\b(\w+)\.save\s*\(/g;
        let s2;
        while ((s2 = sv.exec(src))) {
            if (st[s2.index] !== 0) continue;
            saves.push(`${rel}:${lineOf(src, s2.index)} → ${s2[1]}.save`);
        }
    }
    return { own, generated, inert, saves };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { own, generated, inert, saves } = scanMongoWrites();
    const byFile = (l) => { const m = new Map(); for (const s of l) { const f = s.split(':')[0]; m.set(f, (m.get(f) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
    console.log(`كتابةٌ مباشرةٌ على Mongo في كودِ الخلفية: ${own.length} موضعاً / ${byFile(own).length} ملفاً\n`);
    for (const o of own) console.log(`     ${o}`);
    console.log(`\nمُرشَّحاتُ .save() (المستقبِلُ مثيلٌ — تُفحص بيد): ${saves.length}`);
    for (const s of saves) console.log(`     ${s}`);
    console.log(`\nداخل قوالبَ نصّية (كودٌ مولَّدٌ لمشروع المستخدم): ${generated.length}`);
    for (const g of generated) console.log(`     ${g}`);
    console.log(`\nفي تعليقٍ أو نصّ (لا يُنفَّذ): ${inert.length}`);
    for (const d of inert) console.log(`     ${d}`);
}
