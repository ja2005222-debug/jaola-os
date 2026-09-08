// 🚧 **حارسُ النطاق**: أن يقول جولا «لا» بصدق، بدل أن يبنيَ ما ليس مطلوباً ثمّ يُخفق.
//
// **العطبُ المقيس** (برومت «JAOLA Tester»، طلبُ حزمةِ اختباراتٍ لشفرة خادم): البُناةُ الثلاثة
// كلُّهم يُخرجون **موقعاً** — سطرٌ إلزاميّ في مُوجَّه `coderAgent`: «ثلاثة ملفات: index.html
// وstyles.css وscript.js» — وبوّاباتُ التحقّق كلُّها تفحص **صفحةً تعمل**. فكان يُبنى بروشورٌ
// عن الاختبارات ثمّ يُحكَم FAILED: حكمٌ صادقٌ **لا يقول لماذا**، فيُقرأ عجزاً وهو حدُّ نطاق.
//
// **الإشارةُ مقيسة، لا قائمةَ كلماتٍ محظورة** (١١ طلباً، فصلٌ تامّ عند ٢): طلباتُ المواقع
// تُسمّي **صفرَ** مُخرَجاتٍ برمجيّة — حتّى تعديلٌ يذكر `styles.css`، وموقعٌ يقرأ `data.json`،
// ومشروعُ React يسمّي `lib/content.js` — لأنّ ملفّات جولا تُستثنى. وما هو خارجٌ يسمّي اثنين
// فأكثر. ولمَ لا قائمةُ كلمات؟ لأنّها تُصيب **موضوعاً** لا **شكلاً**: «اختبارات» ترد في موقع
// مدرسةٍ بريئاً — وذاك درسُ PM/22: المقارنةُ المفتوحة تُقاس بكلمات صاحب الطلب.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foreignCodeArtifacts, isOutOfScopeRequest } from '../agents/textNormalizer.js';
import { selectBuildStrategy } from '../agents/stages/selectBuildStrategy.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { emptyProject, workingProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

let seq = 0;
function harness({ lang = 'ar', dir = null } = {}) {
    seq += 1;
    const events = [];
    const io = { to: () => ({ emit: (ev, payload) => events.push({ ev, payload }) }) };
    const built = { registry: [], clone: [], react: [] };
    const ops = {
        buildFromRegistry: async () => { built.registry.push(1); return { success: true, via: 'registry' }; },
        buildFromClone: async () => { built.clone.push(1); return { success: true, via: 'clone' }; },
        buildReactProject: async () => { built.react.push(1); return { success: true, via: 'react' }; },
        trackOf: () => undefined,
    };
    const username = `__scope_u${seq}_${process.pid}_${Math.random().toString(36).slice(2, 7)}__`;
    setUserLanguage(username, lang);
    const ctx = createExecutionContext({
        username, roomName: `scope_${seq}`, activeProject: `scope-${seq}`,
        projectPath: dir || emptyProject(), agents: {},
    });
    return {
        pick: (goal) => selectBuildStrategy(goal, null, ctx, new RoomReporter(io), ops),
        replies: () => events.filter(e => e.ev === 'chat_reply').map(e => e.payload.message),
        logs: () => events.filter(e => e.ev === 'log').map(e => e.payload.message),
        nothingBuilt: () => built.registry.length + built.clone.length + built.react.length === 0,
    };
}

const TESTER = `Build a testing system for JAOLA OS.

## 1. Unit Tests (backend/testing/unit/)
- auth.test.js: register, login
- project.test.js: create, read

## 2. Integration Tests (backend/testing/integration/)
- deploy.test.js: Vercel deployment
- socket.test.js: WebSocket events`;

test('🚧 لا يُبنى شيء — والامتناعُ يُقال نصّاً', async () => {
    const h = harness();
    const r = await h.pick(TESTER);
    assert.equal(r.skipped, 'out-of-scope');
    assert.ok(h.nothingBuilt(), 'لم يُستدعَ بانٍ');
    assert.match(h.replies()[0], /أبني مواقعَ وتطبيقاتِ متصفّح/);
    assert.match(h.replies()[0], /لن أبنيَ موقعاً عنها وأسمّي ذلك إنجازاً/);
});

test('الردُّ يسمّي ما رآه بالاسم — لا جملةً عامّة', async () => {
    const h = harness();
    await h.pick(TESTER);
    // 📋 اللغةُ لغةُ صاحب الطلب: يرى **ملفّاته هو**، فيعرف أين اختلف الفهم.
    assert.match(h.replies()[0], /auth\.test\.js/);
    assert.match(h.logs().join('\n'), /خارجَ ما أصنع/);
});

test('بالإنجليزيّة يقولها بالإنجليزيّة', async () => {
    const h = harness({ lang: 'en' });
    await h.pick(TESTER);
    assert.match(h.replies()[0], /I build websites and browser apps/);
    assert.match(h.replies()[0], /auth\.test\.js/);
});

test('🔒 طلبُ الموقع يمرّ — ولا يُمَسّ', async () => {
    for (const goal of [
        'ابني لي متجر عطور إلكتروني فيه سلة شراء وصفحة منتج ودفع.',
        'غيّر لون الأزرار في styles.css وكبّر الخط في index.html.',
        'ابنِ موقع أسعار يقرأ المنتجات من data.json ويعرضها في جدول.',
        'ابنِ موقعاً يشبه https://example.com/shop/items/ وhttps://foo.org/a/b/ فيه سلة.',
        // 🔒 قتلَ هذا طفرةً نجت أوّلَ مرّة: بلا استثناءِ ملفّات جولا يصير هذا طلبَ تعديلٍ
        //    مُداناً باثنين (`script.js` + `app.js`) — وهو أشيعُ ما يُكتب على مشروعٍ قائم.
        'عدّل script.js وapp.js: اجعل الأزرار تعمل.',
    ]) {
        const h = harness();
        const r = await h.pick(goal);
        assert.notEqual(r?.skipped, 'out-of-scope', `أُدين بلا ذنب: ${goal.slice(0, 40)}`);
    }
});

test('🔒 مشروعٌ قائمٌ لا يُمَسّ بالحارس — الامتناعُ للبناء الجديد وحدَه', async () => {
    // الحارسُ يقرأ الطلبَ لا المشروع؛ فعلى مشروعٍ عامل يبقى القرارُ للمسارات الأخرى.
    const h = harness({ dir: workingProject() });
    const r = await h.pick(TESTER);
    assert.notEqual(r?.skipped, 'out-of-scope');
});

test('العتبةُ اثنان: واحدٌ يمرّ، اثنان يقفان', () => {
    assert.equal(isOutOfScopeRequest('اكتب migrate.py فقط.'), false, 'واحدٌ ليس دليلاً');
    assert.equal(isOutOfScopeRequest('اكتب migrate.py وconfig.yaml.'), true);
});

test('الأسماءُ تخرج كاملةً بمجلّداتها — لا مبتورة', () => {
    const got = foreignCodeArtifacts('حزمة فيها src/parse.js وtests/parse.test.js.');
    assert.deepEqual(got, ['src/parse.js', 'tests/parse.test.js']);
});

test('🔗 الروابطُ تُنزع فلا تُعدّ مساراتٍ', () => {
    assert.deepEqual(foreignCodeArtifacts('انظر https://a.com/x/y/ وhttps://b.org/p/q/'), []);
});

test('⚠️ حدٌّ مكتوب: خارجُ النطاق بلا ملفّاتٍ مسمّاة يمرّ — المقياسُ يُدين بدليلٍ ولا يُبرّئ بغيابه', () => {
    assert.equal(isOutOfScopeRequest('اكتب لي خوارزميّة فرز سريع واشرحها.'), false);
});

test('لا مُدخَل = لا حكم', () => {
    assert.equal(isOutOfScopeRequest(''), false);
    assert.deepEqual(foreignCodeArtifacts(null), []);
});
