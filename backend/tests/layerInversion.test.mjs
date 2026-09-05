// 🔻 انعكاسُ الطبقات — الأدنى لا يستورد الأعلى
//
// `ARCHITECTURE_GAP_AUDIT.md` قاس ١٤ حافّةَ انعكاسٍ (`services → agents`)،
// سبعٌ منها سببُها واحد: بوّابةُ الـLLM كانت تسكن `agents/`. أُنزلت في
// Sprint 4g إلى `core/providers/llm.js` فصارت السبعُ صفراً.
//
// هذا الحارسُ يُثبّت السبعَ الباقية **بأسمائها**: كلٌّ منها اعتمادٌ على منطقِ
// وكيلٍ حقيقيّ لا على نموذج. وثبوتُها بالاسم يجعل أيَّ حافّةٍ جديدةٍ قراراً
// واعياً لا انزلاقاً صامتاً — وأيَّ حافّةٍ تزول تحديثاً للوثيقة لا نسياناً.
//
// 🔴 الحقيقةُ هنا مكتوبةٌ بيدٍ عمداً: لو اشتُقّت التوقّعاتُ من الاشتقاق نفسه
//    لصار الاختبارُ يسأل المفحوصَ عن نفسه فيمرّ دائماً — وهو الخطأُ الذي
//    أوقعني في `templateRegistrySync` حتى نجت الطفرة.
import test from 'node:test';
import assert from 'node:assert/strict';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { layerEdges, edgesBetween, scannedFiles } from '../scripts/layerEdges.mjs';

divertConsoleToStderr();

const EXPECTED_INVERSION = [
    'services/adminService.js → agents/platformContext.js',
    'services/aiImages.js → agents/imageForge.js',
    'services/aiImages.js → agents/seedStamp.js',
    'services/conversationManager.js → agents/clarifierAgent.js',
    'services/conversationManager.js → agents/stateMachine.js',
    'services/deployAutomation.js → agents/renderAgent.js',
    'services/githubSync.js → agents/gitAgent.js',
];

const edges = layerEdges();
const fmt = (list) => [...new Set(list.map((e) => `${e.file} → ${e.target}`))].sort();

test('الاشتقاقُ ليس فارغاً — حارسٌ لا يقيس شيئاً أسوأ من لا حارس', () => {
    assert.ok(edges.length > 300, `حوافُ العبور ${edges.length} — الاشتقاقُ نفسه معطوب`);
    // 🔴 كانت هذه تسأل عن `root → services` وحدها، فنجت منها طفرةٌ أسقطت
    //    `services/` من المسح كلِّه: الحافّةُ تُحسب من **مصدرها**، فإسقاطُ
    //    مجلّدٍ يُخفي ما يخرج منه لا ما يدخل إليه. فالسؤالُ الصحيح: أيُّ
    //    الطبقات مسحناها فعلاً — لا أيَّها ذُكرت هدفاً.
    // 🔴 ولا تُقاس التغطيةُ بالحواف: لـ`core/` **صفرُ** حوافَ خارجةٍ فعلاً
    //    (لا يستورد ما فوقه، وهو المطلوب) — فلو قِيست بها لبدا غيرَ ممسوح.
    //    فتُقاس بما مُسح لا بما نتج، وإلا صار الصمتُ الصحيحُ دليلَ عطب.
    const scanned = scannedFiles();
    for (const layer of ['agents', 'services', 'core', 'routes', 'middleware', 'utils', 'models']) {
        assert.ok(scanned.some((f) => f.startsWith(layer + '/')), `لم يُمسح \`${layer}/\``);
    }
    assert.ok(scanned.includes('server.js'), 'لم يُمسح `server.js`');
});

test('services → agents: السبعُ المعروفةُ وحدها', () => {
    assert.deepEqual(fmt(edgesBetween(edges, 'services', 'agents')), EXPECTED_INVERSION,
        'انعكاسُ الطبقات تغيّر — إن كانت حافّةٌ جديدةً فاقصدها وسجّلها، وإن زالت فحدّث القائمة والوثيقة');
});

test('النواةُ لا تعرف ما فوقها', () => {
    assert.deepEqual(fmt(edgesBetween(edges, 'core', 'agents')), [], 'core → agents');
    assert.deepEqual(fmt(edgesBetween(edges, 'core', 'services')), [], 'core → services');
});

test('بوّابةُ الـLLM تحت الوكلاء لا فيهم (Sprint 4g)', () => {
    const llm = edges.filter((e) => e.target.includes('providers/llm.js'));
    assert.ok(llm.length >= 20, `مستهلكو مزوّد الـLLM ${llm.length} — أقلُّ من المقيس`);
    const fromAgentsDir = edges.filter((e) => e.target === 'agents/baseAgent.js');
    assert.deepEqual(fromAgentsDir, [], 'ما زال أحدٌ يستورد `agents/baseAgent.js` — والملفُّ لم يعد هناك');
    assert.deepEqual(fmt(edgesBetween(edges, 'services', 'core').filter((e) => e.target.includes('llm.js'))).length > 0, true,
        'الخدماتُ لم تعد تصل إلى النموذج عبر النواة — تحقّق من النقل');
});
