// 🔇 حُرّاسُ الصمت — الطلبُ الذي يُقبَل ولا يُقال عنه شيء.
//
// جاء العطبُ من مالكِ المنصّة نفسِه: مواصفةُ نظامِ نقاطِ بيعٍ طويلة (≈٢٦ ألف حرف) تُرسَل، فيسكت جولا
// تماماً مع تكرار المحاولة. أُعيد إنتاجُه هنا حرفيّاً بلا شبكة: المصنِّفُ يسقط إلى `{chat, 50%}` (وهو ما
// رآه المالكُ في السجلّ)، فيصل النصُّ فرعَ «مشروعٌ قائم + نيّةُ فعل» في `handleClassifiedIntent`، وهذا
// يُطلق التعديلَ الجراحيَّ **أطلِق-وانسَ**: سطرا سجلٍّ وصفرُ ردود.
//
// وللصمت ثلاثةُ منابعَ متمايزة، ولكلٍّ اختبارُه هنا:
//   ١) `surgicalEdit` كان المُطلِقَ الوحيدَ الذي يبدأ عملاً طويلاً بلا كلمة (سائرُ المسارات تقول أوّلاً).
//   ٢) `ExecutionQueue#pump` يبتلع رفضَ `run` في `console.error` — سطرٌ في سجلّ الخادم لا يراه صاحبُ الطلب.
//   ٣) حارسُ `/api/chat` في `server.js` يبثّ `log` لا `chat_reply`، والاستجابةُ رُدَّت قبله.
//
// كلُّ تأكيدٍ هنا على قناةِ الشات (`chat_reply`) لا على السجلّ: السجلُّ لوحةٌ أخرى، وصمتُ الشات هو العطب.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// 🧾 سجلٌّ خاصٌّ بهذا الملفّ قبل أن يُحمَّل `ExecutionQueue` (يقرأ المسارَ مرّةً عند التحميل، فالاستيرادُ
//    هنا ديناميكيٌّ لا ساكن). هذا **ليس تجميلاً**: `node --test` يُشغّل الملفّات متوازيةً، وهذا أوّلُ اختبارٍ
//    يقود `surgicalEdit` الحقيقيَّ فيكتب في سجلّ المهامّ الدائم — والكتابةُ تستبدل الملفَّ كاملاً بخريطةِ
//    هذه العمليّة، فتمحو صفَّ `missionLedger` من تحت قدمَيه. قِيس: سقوطٌ متقطّعٌ في جولةٍ من ثلاث.
process.env.MISSION_LEDGER_PATH = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'silence-ledger-')), 'mission_ledger.json');

const { scenario, tempProject } = await import('./helpers/jcrScenario.mjs');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { isMissionActive, ledgerPath } = await import('../core/runtime/ExecutionQueue.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const HERE = import.meta.dirname;

/** مواصفةٌ طويلةٌ بشكلِ برومتِ المالك: أمرُ رغبةٍ صريح، أقسامٌ مرقّمة، وذيلُ «ابدأ الآن». */
function longSpec() {
    const sections = ['الصلاحيات والأدوار', 'المنتجات والأصناف', 'الباركود', 'شاشة الكاشير', 'طرق الدفع',
        'الفواتير', 'المرتجعات', 'دفتر المخزون', 'المشتريات', 'العملاء', 'الضريبة', 'التقارير',
        'تعدد الفروع', 'سجل التدقيق', 'المزامنة دون اتصال', 'الأمان', 'قاعدة البيانات', 'الأداء'];
    let t = 'أريد منك بناء نظام كاشير ونقطة بيع POS System متكامل وقابل للاستخدام الفعلي، وليس مجرد Demo أو واجهة شكلية.\n\n';
    sections.forEach((s, i) => {
        t += `${i + 1}. ${s}:\n`;
        for (let k = 1; k <= 6; k++) t += `   - متطلّبٌ ${k} في «${s}» يجب أن يعمل فعلياً على بيانات حقيقية ومترابطة مع بقية النظام.\n`;
    });
    return t + '\nابدأ الآن بـ: PROJECT AUDIT ثم ARCHITECTURE ثم PLAN.';
}

/** سيناريو يُبقي `surgicalEdit` الحقيقيّ (المُطلِق) ويستبدل الجسدَ الثقيل وحدَه. */
function launcher(prefix, body) {
    const s = scenario(prefix);
    delete s.rt.surgicalEdit;                 // نزعُ استبدالِ السيناريو — نريد المُطلِقَ نفسَه
    s.rt._runSurgicalEditNow = body;
    return s;
}

test('العطبُ بعينه: مواصفةٌ طويلةٌ على مشروعٍ قائم تُقبَل ويبدأ العملُ — والغرفةُ تسمع إقرارَ استلامٍ واحداً بلا انتظار', async () => {
    const spec = longSpec();
    assert.ok(spec.length > 5000, 'المواصفةُ طويلةٌ فعلاً — هذا شرطُ إعادةِ الإنتاج');
    let seen = null;
    const s = launcher('sil1', async (instruction) => { seen = instruction; });
    setUserLanguage(s.ctx.username, 'ar');
    await s.send(spec, {}, { projectPath: tempProject() });
    // المسارُ هو مسارُ الإنتاج نفسُه: المصنِّفُ بلا مزوّدٍ يسقط إلى chat/50٪ ثمّ فرعُ التعديل.
    assert.match(s.logs(), /نية: chat \(ثقة: 50%\)/);
    assert.match(s.logs(), /تعديل جراحي/);
    assert.equal(seen, spec, 'النصُّ كاملاً وصل الجسدَ (لا اقتطاع)');
    const replies = s.replies();
    assert.equal(replies.length, 1, `ردٌّ واحدٌ لا صفر (كان صفراً: هذا هو الصمت). جاء: ${JSON.stringify(replies)}`);
    assert.ok(replies[0].includes('تسلّمتُ طلبك'), replies[0]);
});

test('الإقرارُ بلغةِ المستخدم، ولا يُقال حين يُرفض الطلبُ لانشغالِ المشروع — الرسالتان لا تجتمعان', async () => {
    // جسدٌ لا ينتهي: يُبقي المفتاحَ نشطاً في الصفّ فيُرفض الطلبُ الثاني كما في الإنتاج.
    let release; const held = new Promise((r) => { release = r; });
    const s = launcher('sil2', () => held);
    setUserLanguage(s.ctx.username, 'en');
    const first = s.rt.surgicalEdit('change the colors to blue', s.ctx);
    assert.equal(first.accepted, true);
    assert.deepEqual(s.replies(), ["✂️ Got your request — I've started working on it now. Follow the live log; I'll report back with the result."]);

    const second = s.rt.surgicalEdit('change the colors to green', s.ctx);
    assert.equal(second.accepted, false, 'المشروعُ مشغول');
    assert.equal(s.replies().length, 2);
    assert.ok(s.replies()[1].startsWith('⚙️'), 'المرفوضُ يسمع نصَّ الانشغال وحدَه — لا إقرارَ بدءٍ كاذباً');
    release(); await held; await new Promise((r) => setImmediate(r));
});

test('المهمّةُ المنتظرةُ في الصفّ تسمع مركزَها وحدَه — لا «بدأتُ العمل» عمّا لم يبدأ (MAX_CONCURRENT=٢)', async () => {
    // ثلاثةُ مشاريعَ متزامنة: اثنان يشغلان السعة، والثالثُ ينتظر فعلاً — هذا وحدَه ما يُميّز
    // `result.waited` عن `result.accepted`، ولولاه لكان الشرطُ الثاني زخرفاً.
    let release; const held = new Promise((r) => { release = r; });
    let release2; const held2 = new Promise((r) => { release2 = r; });
    const a = launcher('silq1', () => held);
    const b = launcher('silq2', () => held2);
    const c = launcher('silq3', async () => {});
    for (const s of [a, b, c]) setUserLanguage(s.ctx.username, 'ar');
    a.rt.surgicalEdit('عدّل أ', a.ctx);
    b.rt.surgicalEdit('عدّل ب', b.ctx);
    const third = c.rt.surgicalEdit('عدّل ج', c.ctx);
    assert.equal(third.accepted, true);
    assert.equal(third.waited, true, 'السعةُ ممتلئة فالثالثُ ينتظر');
    assert.deepEqual(c.replies(), ['⏳ مهمتك في الصف (المركز 1).'],
        'رسالةُ الصفّ وحدَها — «بدأتُ العمل» كذبةٌ على مهمّةٍ لم تبدأ');
    release(); release2(); await Promise.all([held, held2]); await new Promise((r) => setTimeout(r, 20));
});

test('نصُّ الطلب يبلغ السجلَّ الدائم — فإشعارُ «مهمّةٌ سقطت مع إعادة التشغيل» يحمل تلميحاً يعرّفه صاحبُه', async () => {
    let release; const held = new Promise((r) => { release = r; });
    const s = launcher('silled', () => held);
    setUserLanguage(s.ctx.username, 'ar');
    s.rt.surgicalEdit('اضف قسم التقارير المالية', s.ctx);
    const rows = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8'));
    const mine = rows.find((r) => r.username === s.ctx.username);
    assert.ok(mine, 'التعديلُ مُقيَّدٌ في السجلّ');
    assert.equal(mine.goal, 'اضف قسم التقارير المالية', 'الهدفُ نصُّ الطلب — كان فارغاً فيخرج الإشعارُ بلا تلميح');
    release(); await held; await new Promise((r) => setTimeout(r, 20));
});

test('انهيارُ التعديل مسموع: الرفضُ يصير ردَّ شاتٍ يذكر السبب، ثمّ يُعاد رميُه فيبقى سطرُ الصفّ ويتحرّر المفتاح', async () => {
    const s = launcher('sil3', async () => { throw new Error('boom: patchEditPlan timed out'); });
    setUserLanguage(s.ctx.username, 'ar');
    s.rt.surgicalEdit('اضف زر الطباعة', s.ctx);
    await new Promise((r) => setTimeout(r, 20));
    const replies = s.replies();
    assert.equal(replies.length, 2, JSON.stringify(replies));
    assert.ok(replies[1].startsWith('❌ توقّف العمل بخطأ غير متوقّع'), replies[1]);
    assert.ok(replies[1].includes('boom: patchEditPlan timed out'), 'السببُ الحقيقيُّ يُقال لا يُخفى');
    // الغرفةُ جزءٌ من العنوان: رسالةٌ إلى غرفةٍ أخرى صمتٌ عند صاحبِ الطلب (طفرةٌ نجت حتّى قِيست).
    assert.deepEqual([...new Set(s.events.map((e) => e.room))], [s.ctx.roomName]);
    assert.equal(isMissionActive(s.ctx.username, s.ctx.activeProject), false,
        'إعادةُ الرمي لا تُعلّق الصفَّ: `finally` في pump حرّر المفتاح');
});

test('انهيارُ البناء مسموع كذلك، بالإنجليزية، ورسالةٌ واحدةٌ لا مكرّرة', async () => {
    const s = scenario('sil4');
    delete s.rt.executeMission;
    s.rt._runMissionNow = async () => { throw new Error('provider refused'); };
    setUserLanguage(s.ctx.username, 'en');
    s.rt.executeMission('build a landing page', s.ctx);
    await new Promise((r) => setTimeout(r, 20));
    const replies = s.replies();
    assert.equal(replies.length, 1, JSON.stringify(replies));
    assert.ok(replies[0].startsWith('❌ The work stopped with an unexpected error'), replies[0]);
    assert.ok(replies[0].includes('provider refused'));
});

test('نجاحٌ صامتٌ يبقى صامتاً: لا رسالةَ انهيارٍ حين لا انهيار', async () => {
    const s = launcher('sil5', async () => ({ ok: true }));
    setUserLanguage(s.ctx.username, 'ar');
    s.rt.surgicalEdit('غيّر العنوان', s.ctx);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(s.replies().length, 1, 'الإقرارُ وحدَه — والنتيجةُ يقولها الجسدُ نفسُه');
    assert.ok(!s.replies().join('\n').includes('❌'));
});

test('إعادةُ الرمي ليست زخرفاً: سطرُ `console.error` في الصفّ يبقى بعد أن يتكلّم الشات', async () => {
    const seen = [];
    const original = console.error;
    console.error = (...a) => { seen.push(a.map(String).join(' ')); };
    try {
        const s = launcher('silrt', async () => { throw new Error('نداءُ المزوّد رُفض'); });
        setUserLanguage(s.ctx.username, 'ar');
        s.rt.surgicalEdit('اضف زر', s.ctx);
        await new Promise((r) => setTimeout(r, 20));
        assert.ok(s.replies().some((m) => m.startsWith('❌')), 'الشات سمع');
        assert.ok(seen.some((l) => l.includes('[MissionQueue]') && l.includes('نداءُ المزوّد رُفض')),
            `وسجلُّ الخادم سمع أيضاً — لا نستبدل أثراً بأثر. جاء: ${JSON.stringify(seen)}`);
    } finally { console.error = original; }
});

test('حارسُ /api/chat في server.js: الاستجابةُ رُدَّت قبله فلا سبيلَ إلّا الشات — لا سطرَ سجلٍّ وحدَه', () => {
    const src = fs.readFileSync(path.join(HERE, '../server.js'), 'utf8');
    const i = src.indexOf('await runtime.handleUserMessage(null, {');
    assert.ok(i > 0, 'موضعُ نداء المسار');
    const c = src.indexOf('} catch (error) {', i);
    assert.ok(c > i, 'حارسُ المسار موجود');
    const guard = src.slice(c, src.indexOf('\n    }\n', c));
    assert.ok(guard.includes("emit('log'"), 'سطرُ السجلّ يبقى — لم نستبدل قناةً بأخرى');
    assert.ok(guard.includes("emit('chat_reply'"), 'وقناةُ الشات تُقال أيضاً — هذا هو الإصلاح');
    assert.ok(/res\.json\(\{ accepted: true \}\)/.test(src.slice(Math.max(0, i - 2000), i)),
        'الاستجابةُ رُدَّت قبل النداء — فلا يمكن للحارس أن يُبلّغ عبر HTTP');
});
