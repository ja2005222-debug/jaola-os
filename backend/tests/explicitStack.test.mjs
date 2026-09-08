// ⚛️ «طلبتَ الإطارَ باسمه» — الذِّكرُ الصريح لا يُنقَض بتصنيف (من سجلٍّ حيّ لصاحب المشروع).
//
// الطلبُ يقول حرفيّاً «— واجهة **React** مع لوحة Kanban» و«منتج SaaS **متكامل**»، والسجلُّ
// يقول `🧰 مسار سريع → Vanilla`. وتتبُّعُ السبب بالقياس:
//   • `detectProjectType(الطلب)` = `saas`، و`saas` في `BIG_TYPES` ← فالطلبُ **كان** يكفي.
//   • لكنّ `resolveProjectType` تُعطي فئةَ المخطّط الأولويّةَ المطلقة، وحارسُها يحمي من
//     الاحتياط لا من نموذجٍ يُصنّف SaaS بأنّه `business`. والسجلُّ يشهد: «تم تطبيق قالب business».
// فالكلمةُ التي كتبها صاحبُ المشروع بيده خسرت أمام تخمينِ نموذج.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveStack, explicitStackRequest } from '../agents/starterRegistry.js';
import { resolveProjectType } from '../agents/stages/enrich.js';
import { detectProjectType } from '../agents/knowledgeEngine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();   // `knowledgeEngine` وحدةٌ طابعة — عرفُ الحزمة يُخلي قناةَ التقرير

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIVE_GOAL = `ابني منتج SaaS متكامل لإدارة المشاريع:
- واجهة React مع لوحة Kanban (سحب وإفلات)
- خادم Node.js/Express مع REST API كامل
- قاعدة بيانات MongoDB (مستخدمين، مشاريع، مهام، تعليقات)
- مصادقة JWT مع أدوار (owner, editor, viewer)
- WebSocket للتحديثات الفورية
- لوحة تحكم إدارية منفصلة
- صفحات: هبوط، تسجيل، مشاريع، تفاصيل المهمة، إعدادات
- تقارير وتحليلات للمسؤول

أنشئ جميع الملفات مع Docker وdocker-compose وREADME.`;
// 📌 النصُّ كامل عمداً: قِيس أنّ اقتطاعَ الأسطر الأخيرة يقلب `detectProjectType` من
//    `saas` إلى `ecommerce` — وكلاهما في `BIG_TYPES` فلا أثرَ هنا، لكنّ التصنيفَ
//    **غيرُ مستقرٍّ على نصَّين متقاربَين**، وذاك بندٌ آخر (#186) لا يُخلط بهذا.

test('🔴 العطبُ نفسُه: فئةُ نموذجٍ مخطئة كانت تُسقط الطلبَ إلى Vanilla', () => {
    assert.equal(detectProjectType(LIVE_GOAL), 'saas', 'الطلبُ وحدَه يقول saas');
    // والمخطّطُ من نموذجٍ يقول business ← يغلب، وهذا هو الموضع
    assert.equal(resolveProjectType(LIVE_GOAL, { category: 'business', _source: 'llm' }), 'business');
    // بلا قراءةِ الطلب (السلوكُ القديم) كانت النتيجةُ vanilla
    assert.equal(resolveStack({ projectType: 'business', scope: '' }), 'vanilla', 'هذا ما كان يحدث');
    // ومع قراءةِ ذِكرِ الإطار تصير react-next
    assert.equal(resolveStack({ projectType: 'business', scope: '', goal: LIVE_GOAL }), 'react-next');
});

test('الذِّكرُ الصريحُ وحدَه — لا سَعةٌ ولا تعقيدٌ ولا تصنيف', () => {
    assert.equal(explicitStackRequest('ابنِ تطبيقاً بواجهة React'), 'react-next');
    assert.equal(explicitStackRequest('أريد مشروع Next.js للمدوّنة'), 'react-next');
    assert.equal(explicitStackRequest('nextjs app'), 'react-next');
    // ما ليس ذكراً للإطار
    assert.equal(explicitStackRequest('اصنع لي موقعاً لمطعمٍ صغير بصفحةٍ واحدة'), null);
    assert.equal(explicitStackRequest('موقعٌ تفاعليّ للمطاعم'), null, '«تفاعليّ» ليست React');
    assert.equal(explicitStackRequest('نظامٌ لإدارة reaction الزوّار'), null, 'كلمةٌ تحتويها ليست هي');
    assert.equal(explicitStackRequest(''), null);
    assert.equal(explicitStackRequest(null), null);
});

test('🚫 والنفيُ يُطوى: «بدون React» ليست طلباً لـReact (علّةُ PM/23 بمصدرها الواحد)', () => {
    assert.equal(explicitStackRequest('ابنِ موقعاً بسيطاً بدون React ولا أطر'), null);
    assert.equal(explicitStackRequest('simple static site, no React'), null);
    // 📏 حدٌّ مكتوب: `stripNegated` القائمة تطوي «بدون X» و«بلا X» و«no X» — **لا** «لا أريد X».
    //    فهذه الصيغةُ تمرّ اليوم. لم أوسّع النافي هنا: مستهلكوه ثلاثةٌ (سؤالُ الخادم، بوّابةُ
    //    الفهم، وهذا)، وتوسيعُه يمسّهم جميعاً — قرارٌ ببندِه ودليله لا رقعةٌ في الطريق.
    assert.equal(explicitStackRequest('لا أريد Next.js — HTML عاديّ يكفي'), 'react-next',
        'مثبَّتٌ كما هو: صيغةُ «لا أريد» خارج ما يطويه النافي القائم');
});

test('📏 حدٌّ مكتوب: لا يُقلَب القرارُ بالكشف وحدَه — موقعُ مطعمٍ يبقى Vanilla', () => {
    // التصنيفُ تخمينٌ من الطرفَين؛ قلبُه بمجرّد «الكشفُ قال كبير» يجعل موقعَ مطعمٍ مشروعَ React.
    // فالمنصوصُ وحدَه يُنقض التصنيف، لا المُخمَّن.
    assert.equal(resolveStack({ projectType: 'restaurant', scope: '', goal: 'موقع لمطعم صغير' }), 'vanilla');
    assert.equal(resolveStack({ projectType: 'business', scope: '', goal: 'صفحةُ هبوطٍ لشركتي' }), 'vanilla');
});

test('السلوكُ القديم لم يُمَسّ حين لا هدفَ ولا ذِكر', () => {
    for (const t of ['saas', 'ecommerce', 'marketplace', 'dashboard', 'fintech', 'platform']) {
        assert.equal(resolveStack({ projectType: t }), 'react-next', t);
    }
    for (const scope of ['full', 'كامل', 'متكامل']) {
        assert.equal(resolveStack({ projectType: 'business', scope }), 'react-next', scope);
    }
    assert.equal(resolveStack({ projectType: 'restaurant' }), 'vanilla');
    assert.equal(resolveStack({}), 'vanilla', 'بلا مدخلاتٍ لا يُقفز إلى المسار الثقيل');
});

test('📏 المستهلكُ الحيّ يقرأ الطلبَ ويقول قرارَه', () => {
    const stage = fs.readFileSync(path.join(HERE, '../agents/stages/selectBuildStrategy.js'), 'utf8');
    assert.match(stage, /resolveStack\(\{ projectType: ptype, scope, goal \}\)/, 'الهدفُ يُمرَّر');
    assert.match(stage, /طلبتَ الإطارَ باسمه/, 'والقرارُ يُقال — لا يُقلَب صامتاً');
});
