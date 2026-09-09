// 🗂️ #١٩٩ — معجمُ جمع التكسير (Arramooz، GPLv2) مستهلَكٌ من `matchTerm` وحده هناك؛ هنا اختبارُ الوحدة
// نفسِها: هل يعود بصيغِ الجمع الموثَّقة، وهل يطبّع طرفَي المقارنة بالتطبيع نفسِه (PM/18)؟
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const { brokenPluralsOf, LEXICON_SIZE } = await import('../agents/arabicBrokenPlurals.js');

test('#١٩٩: مفردٌ موثّقٌ يعيد صيغَ جمعه المكسَّر', () => {
    const plurals = brokenPluralsOf('كتاب');
    assert.ok(plurals.includes('كتب'), JSON.stringify(plurals));
});

test('#١٩٩: التطبيعُ نفسُه على الطرفَين — همزةٌ/تشكيلٌ في الاستعلام لا يُسقط المطابقة', () => {
    // «أ» تُطبَّع إلى «ا» (normalizeLetters) — فيجب أن تصل الاستعلامَ نفسَه الذي يصل الفهرسة.
    const plurals = brokenPluralsOf('أستاذ');
    assert.ok(plurals.length > 0, 'مفردٌ حقيقيٌّ بهمزة أوّل — يجب أن يُطبَّع كما طُبِّع عند البناء');
});

test('#١٩٩: مفردٌ خارج المعجم يعيد مصفوفةً فارغة — لا يُخترَع جمع', () => {
    assert.deepEqual(brokenPluralsOf('طرطبيشوفلان'), []);
});

// المعجمُ يُبنى بفهرسةِ ٤٥٤١ صفّاً (`ARRAMOOZ_NOTICE.md`)، لكن `INDEX.size` مفاتيحُ **بعد**
// `normalizeLetters` — فبعضُ الصفوف يتّحد مفتاحُها (فروقُ تشكيلٍ لا تنجو من التطبيع)؛ الرقمُ هنا
// مقيسٌ من `INDEX.size` نفسِها لا من عدد صفوف JSON.
test('#١٩٩: حجمُ المعجم كما قِيس — لا يتقلّص صامتاً', () => {
    assert.equal(LEXICON_SIZE, 4533);
});
