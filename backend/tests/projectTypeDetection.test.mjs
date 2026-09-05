// 🧭 نوعُ المشروع — أوّلُ قرارٍ يتّخذه قلبُ جولا عن طلب المستخدم، ومنه
// تُشتقّ قواعد التصميم والمكوّنات واستراتيجية البناء.
//
// 🔴 كان الحكم **عدداً خاماً** للكلمات المطابقة، والتعادل يُحسم بترتيب
// مفاتيح `design-rules.json`. قياسٌ فعليّ قبل الإصلاح: ٤ من ١٠ أهدافٍ
// واقعية يقرّر نوعَها ذلك الترتيب لا الدليل. فصار الوزن مشتقّاً من
// البيانات نفسها: ندرةُ الكلمة بين الأنواع، وموضعُها في الهدف.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectProjectType } from '../agents/knowledgeEngine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// أهدافٌ واقعية كُتبت **قبل** قياس أثر الإصلاح، لا مُنتقاةً بعده.
const CORPUS = [
    ['موقع عقارات للبيع والإيجار', 'realestate'],
    ['صالون تجميل مع حجز مواعيد', 'beauty'],
    ['عيادة أسنان مع حجز مواعيد', 'clinic'],
    ['فندق مع حجز غرف أونلاين', 'hotel'],
    ['مطعم مع توصيل طعام وحجز طاولات', 'restaurant'],
    ['نادي رياضي مع اشتراكات ومواعيد تدريب', 'gym'],
    ['مدرسة لتعليم القرآن مع دورات وحجز', 'education'],
    ['معرض سيارات للبيع والتمويل', 'automotive'],
    ['شركة محاماة مع استشارة قانونية وحجز موعد', 'law'],
    ['مدونة شخصية عن السفر', 'blog'],
    ['موقع زفاف مع دعوات وقائمة ضيوف', 'wedding'],
    ['تطبيق توصيل طعام مع سائقين', 'restaurant'],
];

test('🧭 النوع يتبع الدليل: كلمةٌ نادرةٌ خاصّةٌ بمجالٍ تغلب كلمةً عامّة', () => {
    const wrong = CORPUS.filter(([g, expect]) => detectProjectType(g) !== expect)
        .map(([g, expect]) => `${g} → ${detectProjectType(g)} (المتوقَّع ${expect})`);
    assert.deepEqual(wrong, [], `أهدافٌ صُنّفت خطأً:\n  ${wrong.join('\n  ')}`);
});

test('🧭 «حجز» وحدها لا تصنع نوعاً — العامُّ لا يغلب الخاصّ', () => {
    // «حجز» ترد في booking وhotel وclinic وغيرها؛ «صالون» في beauty وحدها.
    assert.equal(detectProjectType('صالون تجميل مع حجز مواعيد'), 'beauty');
    assert.equal(detectProjectType('عيادة أسنان مع حجز مواعيد'), 'clinic');
    assert.equal(detectProjectType('فندق مع حجز غرف'), 'hotel');
    // ومع ذلك يبقى booking متاحاً حين لا مجالَ أخصّ منه في الجملة
    assert.equal(detectProjectType('نظام حجز مواعيد واحجز موعدك'), 'booking');
});

test('🧭 الندرة دليلٌ مستقلٌّ عن الموضع — تُرجّح ولو جاءت متأخّرة', () => {
    // «حجز» و«مواعيد» تتصدّران الجملة وهما عامّتان (في أنواعٍ عدّة)، و«صالون»
    // متأخّرةٌ ولا ترد إلا في beauty. فلو كان الموضع وحده هو الوزن لَفازت
    // booking — وهذا ما يحدث فعلاً حين يُنزع مقسوم الندرة.
    assert.equal(detectProjectType('حجز مواعيد في صالون تجميل'), 'beauty');
});

test('🧭 الموضع دليل: ما يبدأ به الطلب هو موضوعه', () => {
    assert.equal(detectProjectType('متجر ملابس وأزياء'), 'ecommerce');
    assert.equal(detectProjectType('مدونة عن التسوق'), 'blog', 'المدوّنة أولاً وإن ذُكر التسوّق');
});

test('🧭 الحكم حتميّ: نفس الهدف يعطي نفس النوع في كل نداء', () => {
    for (const [goal] of CORPUS) {
        const first = detectProjectType(goal);
        for (let i = 0; i < 3; i++) assert.equal(detectProjectType(goal), first, goal);
    }
});

test('🧭 لا هدفَ يسقط في المجهول: كل ناتجٍ نوعٌ معروف، والفراغ business', () => {
    assert.equal(detectProjectType(''), 'business');
    assert.equal(detectProjectType(null), 'business');
    assert.equal(detectProjectType('شيء لا معنى له إطلاقاً زذض'), 'business');
});

test('🧭 التلميح الصريح من الـBlueprint يسبق كشف الكلمات', () => {
    assert.equal(detectProjectType('موقع عام', 'realestate'), 'realestate');
    assert.equal(detectProjectType('موقع عام', 'legal'), 'law', 'الفئة تُترجَم إلى نوع القالب');
    assert.equal(detectProjectType('مطعم للأكل', 'nope_not_a_type'), 'restaurant', 'تلميحٌ مجهول يسقط للكشف');
});

// 📌 غموضٌ حقيقي يُقال ولا يُخفى: هذان الهدفان يحتملان قراءتين، ولم أُعدّل
// الوزن لأجلهما — تعديلٌ يلاحق حالتين هو تفصيلٌ على مقاسِ اختباري لا تحسينٌ.
test('📌 موثَّق: هدفان يحتملان قراءتين، والنتيجة الحالية مقبولة لا مثالية', () => {
    assert.equal(detectProjectType('متجر ملابس مع معرض أعمال المصمم'), 'portfolio',
        'قد يكون متجراً وقد يكون معرضَ مصمّمٍ يبيع — الجملة نفسها تحتمل الاثنين');
    assert.equal(detectProjectType('منصة دورات أونلاين باشتراك شهري'), 'saas',
        'منصّةٌ باشتراك (saas) أم أكاديمية (education)؟ كلمتان لكلٍّ منهما');
});
