/**
 * 🗂️ جمعُ التكسير — معجمُ بياناتٍ حقيقيّ، لا اشتقاقٌ خوارزميّ (‏#١٩٩)
 *
 * ‏#١٩٨ ترك جمعَ التكسير («كتاب» ← «الكتب») بندًا مفتوحاً: `matchTerm` تُطابق حرفيّاً على حدّ كلمة،
 * فلا ترى مصطلحاً مفرداً حين يظهر في النصّ جمعاً مكسَّراً. جُرِّب حلّان خوارزميّان (اختزالُ هيكلٍ صامت،
 * وتوليدُ مرشّحٍ بنمط) وقِيسا فسقطا: كلاهما يخلط كلماتٍ مختلفةَ المعنى بجذرٍ متقارب («كتاب»≠«كاتب») —
 * وهذا عطبٌ في **الاتّجاه المشدِّد** (يمنح PASS/traced زائفاً)، غيرُ محتمَلٍ في بوّابةٍ يُصدَّق حكمُها
 * (انظر CONTRACTS.md، حادثةَ «سوقٌ إلكترونيٌّ حُكم عليه ٩/٩»). فالحلُّ **بياناتٌ لا اشتقاق**: معجمُ
 * (مفرد ← جمعٌ مكسَّر) حقيقيّ لا يخمّن — كلُّ زوجٍ موثَّقٌ في مصدره، لا خطرَ تطابقٍ زائفٍ فيه.
 *
 * المصدر والترخيصُ والتنقية: `data/ARRAMOOZ_NOTICE.md`. القياسُ: ٣٥/٤٠ (٨٧٪) على أزواجَ معروفةِ الصحّة.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeLetters } from './projectModel.js';

const DATA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'arabicBrokenPlurals.json');

// 🔑 مفاتيحُ الفهرس بالتطبيع نفسِه الذي تُطبَّع به الكلمةُ المستعلَمة (normalizeLetters، PM/18: مصدرٌ واحد) —
//    وإلّا قُورنت مفردةٌ مطبَّعة بأخرى خامٍ فلم تُطابَق أبداً (الفخُّ نفسُه الذي وقع في مطابقة بنود الوثيقة).
const INDEX = new Map();
try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    for (const [single, plurals] of raw) {
        const key = normalizeLetters(single);
        if (!key) continue;
        const set = INDEX.get(key) || new Set();
        for (const p of plurals) { const np = normalizeLetters(p); if (np) set.add(np); }
        INDEX.set(key, set);
    }
} catch (e) {
    console.warn('[arabicBrokenPlurals] تعذّرت قراءةُ المعجم — يُتابَع بلا صيغِ جمعٍ إضافيّة:', e.message);
}

/** صيغُ جمعِ التكسير الموثَّقة لمفردٍ (بعد `normalizeLetters`)، أو مصفوفةٌ فارغة إن لم يكن في المعجم. */
export function brokenPluralsOf(term) {
    return [...(INDEX.get(normalizeLetters(term)) || [])];
}

/** عددُ المفردات في المعجم — للاختبار والتشخيص، لا حسابَ عليه في منطق المطابقة. */
export const LEXICON_SIZE = INDEX.size;
