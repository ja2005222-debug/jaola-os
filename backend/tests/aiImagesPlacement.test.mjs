import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAiImages } from '../services/aiImages.js';

// ═══════════════════════════════════════════════════════
// 🔴 الاستبدال كان يُحدَّد بـ«أوّل `img` قيمتُه مطابقةٌ داخل نطاق العنصر»،
//    والأهدافُ تشمل كائناتٍ متداخلة (غرفاً داخل فندق، أطباقاً داخل قسم).
//    فصورةُ **الفندق** كانت تنزل على **أوّل غرفة**، وتسقط بقيةُ الأهداف
//    صامتةً لأنّ نطاق العنصر يَبلى بعد أوّل استبدالٍ فيه — وقد دُفع ثمنُ
//    توليدها كلِّها. قِيس: ٣ صور وُلّدت، واحدةٌ طُبّقت، وفي غير موضعها.
// ═══════════════════════════════════════════════════════

const stubGen = () => {
    const prompts = [];
    const fn = async (p) => { prompts.push(p.split('.')[0]); return { ok: true, buf: Buffer.from('x'), ext: 'png' }; };
    return { fn, prompts };
};
const seedLine = (r) => r.appJs.split('\n').find((l) => l.includes('id: 1'));

test('كلُّ كائنٍ متداخل يأخذ صورته هو — لا صورةَ أبيه', async () => {
    const app = { name: 'app.js', content:
`const hotels = [
  { id: 1, name: 'فندق النخيل', rooms: [ { id: 'a', name: 'غرفة عادية', img: '' }, { id: 'b', name: 'جناح ملكي', img: '' } ], img: '' }
];` };
    const { fn, prompts } = stubGen();
    const r = await applyAiImages([app], { stamp: 'S' }, fn);

    assert.equal(prompts.length, 3, 'ثلاثةُ أهدافٍ ⇒ ثلاثةُ توليدات');
    assert.equal(r.count, 3, 'وثلاثةُ تطبيقات — لا واحد');
    const line = seedLine(r);
    assert.match(line, /'غرفة عادية', img: 'images\/ai-1-rooms-a-S\.png'/);
    assert.match(line, /'جناح ملكي', img: 'images\/ai-1-rooms-b-S\.png'/);
    // صورةُ الفندق على الفندق: آخرُ حقل img في العنصر
    assert.match(line, /\], img: 'images\/ai-1-S\.png'/);
});

test('ما وُلّد يُطبَّق كلُّه — لا يسقط هدفٌ صامتاً بعد أوّل استبدال', async () => {
    const app = { name: 'app.js', content:
`const menu = [
  { id: 1, name: 'قسم المقبلات', dishes: [ { id: 'd1', name: 'حمص', img: '' }, { id: 'd2', name: 'تبولة', img: '' }, { id: 'd3', name: 'فتوش', img: '' } ], img: '' }
];` };
    const { fn, prompts } = stubGen();
    const r = await applyAiImages([app], { stamp: 'T' }, fn);
    assert.equal(prompts.length, 4);
    assert.equal(r.count, prompts.length, 'كلُّ ما دُفع ثمنُه طُبّق');
    assert.equal(new Set(r.images.map((i) => i.name)).size, 4, 'أسماءٌ متمايزة');
});

test('عنصرٌ مسطّحٌ بلا تداخل يبقى كما كان يعمل', async () => {
    const app = { name: 'app.js', content:
`const products = [
  { id: 1, name: 'كرسي', img: '' },
  { id: 2, name: 'طاولة', img: '' }
];` };
    const { fn } = stubGen();
    const r = await applyAiImages([app], { stamp: 'U' }, fn);
    assert.equal(r.count, 2);
    assert.match(r.appJs, /'كرسي', img: 'images\/ai-1-U\.png'/);
    assert.match(r.appJs, /'طاولة', img: 'images\/ai-2-U\.png'/);
});

test('البرومبت يُبنى من هويّة الكائن المتداخل نفسه', async () => {
    const app = { name: 'app.js', content:
`const halls = [
  { id: 1, name: 'قاعة الأمير', img: '', events: [ { id: 'e1', name: 'حفل زفاف', category: 'أعراس', img: '' } ] }
];` };
    const { fn, prompts } = stubGen();
    await applyAiImages([app], { stamp: 'V' }, fn);
    assert.ok(prompts.some((p) => p.includes('حفل زفاف') && p.includes('أعراس')),
        `البرومبتات: ${prompts.join(' | ')}`);
});

test('صورُ المستخدم الفعلية لا تُمسّ، والمسمّى صراحةً وحده يُستبدل', async () => {
    const app = { name: 'app.js', content:
`const rooms = [
  { id: 1, name: 'غرفة عادية', img: 'assets/mine.jpg' },
  { id: 2, name: 'جناح ملكي', img: 'assets/other.jpg' }
];` };
    const { fn } = stubGen();
    const none = await applyAiImages([app], { stamp: 'W' }, fn);
    assert.equal(none.changed, false, 'بلا تسميةٍ صريحة لا تُمسّ صورُ المستخدم');

    const one = await applyAiImages([app], { stamp: 'W', targetLabel: 'جناح ملكي' }, fn);
    assert.equal(one.count, 1);
    assert.match(one.appJs, /'غرفة عادية', img: 'assets\/mine\.jpg'/, 'غيرُ المسمّى لم يُمسّ');
    assert.match(one.appJs, /'جناح ملكي', img: 'images\/ai-2-W\.png'/);
});
