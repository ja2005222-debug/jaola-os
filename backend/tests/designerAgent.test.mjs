import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateDesignBrief, requestAiEnhancements, saveDesignBrief, loadDesignBrief } from '../agents/designerAgent.js';

// ═══════════════════════════════════════════════════════
// 🔴 العطب: `groq.chat.completions.create(...)` و`groq` غير مستوردٍ في
// `designerAgent.js` — والمستورد `smartChat` لا يُستعمل. فكان كل نداءٍ يرمي
// ReferenceError يبتلعه `catch {}` فارغ: لا تخصيصَ بصرياً البتّة منذ كُتب
// الملف، بينما يعلن `jcr` «✅ Design Brief». عطبٌ صامتٌ فوقه إعلانُ نجاح.
//
// فالعقد الآن: التخصيص **يقع** حين يتوفّر مزوّد، و**يُقال سببُ تخلّفه** حين
// لا يقع — `aiEnhanced` و`aiSkipReason` جزءٌ من الناتج لا استنتاجٌ من فراغه.
// ═══════════════════════════════════════════════════════

const GOAL = 'أريد موقعاً لعيادة أسنان حديثة بتصميم نظيف وحجز مواعيد أونلاين';
const okChat = async () => JSON.stringify({
    heroSlogan: 'ابتسامتك تبدأ هنا',
    uniqueTouch: 'أيقونات سنّية مرسومة يدوياً',
    animations: ['fade-in', 'hover'],
});

test('التخصيص يصل إلى المزوّد فعلاً ويعود بحقوله', async () => {
    const r = await requestAiEnhancements({ userGoal: GOAL, projectType: 'clinic', paletteName: 'medical', lang: 'ar' }, okChat);
    assert.equal(r.ok, true);
    assert.equal(r.data.heroSlogan, 'ابتسامتك تبدأ هنا');
    assert.deepEqual(r.data.animations, ['fade-in', 'hover']);
});

test('الهدفُ والنوعُ واللوحةُ واللغة تُمرَّر كلُّها إلى المزوّد', async () => {
    let seen = null;
    await requestAiEnhancements({ userGoal: GOAL, projectType: 'clinic', paletteName: 'medical', lang: 'ar' },
        async (messages, opts) => { seen = { messages, opts }; return okChat(); });
    const body = seen.messages.map((m) => m.content).join('\n');
    assert.ok(body.includes(GOAL), 'الهدف لم يصل');
    assert.ok(body.includes('clinic') && body.includes('medical'), 'النوع أو اللوحة لم يصلا');
    assert.ok(seen.messages[0].content.includes('ar'), 'اللغة لم تصل للنظام');
    assert.equal(seen.opts.json, true, 'لم يُطلب JSON من المزوّد');
});

test('فشلُ المزوّد يُقال ولا يُبتلع', async () => {
    const r = await requestAiEnhancements({ userGoal: GOAL, projectType: 'clinic', paletteName: 'medical' },
        async () => { throw new Error('لا مفتاح'); });
    assert.equal(r.ok, false);
    assert.match(r.reason, /لا مفتاح/);
});

test('ردٌّ ليس JSON يُرفض بسببه لا بصمت', async () => {
    const r = await requestAiEnhancements({ userGoal: GOAL, projectType: 'x', paletteName: 'y' }, async () => 'مرحباً');
    assert.equal(r.ok, false);
    assert.match(r.reason, /JSON/);
});

test('ردٌّ صالحُ الصيغة بلا حقلٍ نافع يُعدّ تخلّفاً', async () => {
    const r = await requestAiEnhancements({ userGoal: GOAL, projectType: 'x', paletteName: 'y' },
        async () => JSON.stringify({ heroSlogan: '   ', animations: [] }));
    assert.equal(r.ok, false);
    assert.match(r.reason, /حقل/);
});

test('الحقولُ المشوَّهة تُسقَط ولا تُمرَّر إلى الـbrief', async () => {
    const r = await requestAiEnhancements({ userGoal: GOAL, projectType: 'x', paletteName: 'y' },
        async () => JSON.stringify({ heroSlogan: 'شعار', uniqueTouch: 42, animations: 'ليست قائمة' }));
    assert.equal(r.ok, true);
    assert.equal(r.data.heroSlogan, 'شعار');
    assert.ok(!('uniqueTouch' in r.data), 'رقمٌ مُرِّر كنصّ');
    assert.ok(!('animations' in r.data), 'نصٌّ مُرِّر كقائمة');
});

test('الوصفُ القصير تخطٍّ مقصود لا فشلُ مزوّد', async () => {
    let called = false;
    const r = await requestAiEnhancements({ userGoal: 'موقع', projectType: 'business', paletteName: 'corporate' },
        async () => { called = true; return okChat(); });
    assert.equal(r.ok, false);
    assert.equal(called, false, 'نُودي المزوّد على وصفٍ لا يستحق');
    assert.match(r.reason, /أقصر/);
});

test('الـbrief يحمل نتيجة التخصيص صراحةً حين يتخلّف', async () => {
    const r = await generateDesignBrief(GOAL, 'u_probe', 'p_probe', 'ar');
    assert.equal(r.success, true);
    // لا مزوّد في بيئة الاختبار — فالمنتظَر تخلّفٌ **معلَّلٌ**، لا صمت
    assert.equal(r.brief.aiEnhanced, false);
    assert.ok(r.brief.aiSkipReason, 'تخلّف التخصيص بلا سبب مذكور');
    assert.equal(r.brief.heroSlogan, null);
});

test('اللوحة تُختار بالنوع، والنوعُ الطبّي يغلب كلماتِ الوصف', async () => {
    const r = await generateDesignBrief('عيادة أسنان فاخرة وراقية جداً بتصميم ذهبي', 'u', 'p', 'ar');
    assert.equal(r.brief.paletteName, 'medical', 'كلمة «فاخر» غلبت النوع الطبّي');
});

test('لغةُ المستخدم تحكم زوجَ الخطوط', async () => {
    const ar = await generateDesignBrief(GOAL, 'u', 'p', 'ar');
    const en = await generateDesignBrief(GOAL, 'u', 'p', 'en');
    assert.match(ar.brief.googleFontsURL, /Cairo/);
    assert.match(en.brief.googleFontsURL, /Poppins/);
});

test('الـCSS يبني على المتغيّرات لا على ألوانٍ مسمّرة', async () => {
    const r = await generateDesignBrief(GOAL, 'u', 'p', 'ar');
    for (const v of ['--primary', '--secondary', '--accent', '--bg', '--text']) {
        assert.ok(r.brief.cssVariables.includes(v), `المتغيّر ${v} غائب`);
    }
    assert.ok(r.brief.images.hero.startsWith('https://images.unsplash.com/'));
});

test('الحفظ والقراءة رحلةٌ ذهاباً وإياباً، والغياب لا يرمي', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-'));
    assert.equal(loadDesignBrief(dir), null, 'ملفٌّ غائبٌ لم يُعِد null');
    const brief = { paletteName: 'medical', aiEnhanced: false };
    saveDesignBrief(dir, brief);
    assert.deepEqual(loadDesignBrief(dir), brief);
    fs.rmSync(dir, { recursive: true, force: true });
});
