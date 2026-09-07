// 🏷️ PM/20 — «المفتاحُ يُنفَّذ والتسميةُ تُقرأ»: `DEFAULT_SECTIONS` مفاتيحُ لاتينيّة بالضرورة — منها يُشتقّ اسمُ
// المكوّن (`Features.jsx`) ومسارُ الصفحة (`/features`). لكنّها تُعرض أيضاً تسميةً: عنوانَ الصفحة، وعنوانَ
// التبويب، وبندَ التنقّل. فموقعٌ عربيٌّ يُبنى بلا مزوّد (المخطّطُ الاحتياطيّ بلا `keySections`) يخرج
// بـ**٣ صفحاتٍ من ٥** عنوانُها لاتينيٌّ خالص، وشريطِ تنقّلٍ مختلط: «الرئيسية | Features | About | Contact».
// والدليلُ أنّ القصد كان غيرَ ذلك: `homeLabel` في المولّد **مترجَمٌ أصلاً** («الرئيسية») — تُرجم بندٌ واحد وبقي جيرانُه.
// وهو PM/17 نفسُه: قيمةٌ واحدة لغرضَين — تُنفَّذ فتلزمها ASCII، وتُقرأ فتلزمها لغةُ صاحب المشروع.
// الحدُّ: ما سمّاه صاحبُ المشروع بنفسه لا يُترجَم أبداً — تسميتُه هي المعنى (PM/9). يُترجَم ما حقنّاه نحن وحدَه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateNextScaffold, planSections, generateContentModel } from '../agents/reactGenerator.js';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const LATIN_ONLY = (s) => /[A-Za-z]/.test(s) && !/[؀-ۿ]/.test(s);
const pagesOf = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'dashboard.html');
const headings = (html) => [...html.matchAll(/<h[12][^>]*>([^<]+)<\/h[12]>/g)].map((m) => m[1].trim());
const navLabels = (html) => [...html.matchAll(/<nav class="links">(.*?)<\/nav>/gs)]
    .flatMap((m) => [...m[1].matchAll(/>([^<]+)<\/a>/g)].map((a) => a[1].trim()));

test('موقعٌ عربيٌّ بلا أقسامٍ مسمّاة: لا عنوانَ لاتينيّاً في صفحةٍ ولا في تبويبٍ ولا في تنقّل', async () => {
    const s = scenario('pm20ar'); setUserLanguage(s.ctx.username, 'ar');
    const dir = emptyProject();
    const reporter = new RoomReporter({ to: () => ({ emit: () => {} }) });
    await buildReactProject('نظام إدارة مكتبة', { ...s.ctx, projectPath: dir },
        { sections: [], llm: async () => { throw new Error('لا مزوّد'); } }, reporter);

    const pages = pagesOf(dir);
    assert.ok(pages.length >= 4, `صفحاتٌ مبنيّة: ${pages.length}`);
    for (const p of pages) {
        const html = fs.readFileSync(path.join(dir, p), 'utf8');
        for (const h of headings(html)) assert.ok(!LATIN_ONLY(h), `عنوانٌ لاتينيٌّ في ${p}: «${h}»`);
        const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
        assert.ok(!/— (?:Features|About|Contact)\b/.test(title), `تبويبٌ لاتينيٌّ في ${p}: «${title}»`);
        for (const n of navLabels(html)) assert.ok(!LATIN_ONLY(n), `بندُ تنقّلٍ لاتينيّ في ${p}: «${n}»`);
    }
});

test('والمفتاحُ لا يُترجَم: المسارُ واسمُ المكوّن يبقيان لاتينيَّين — لغةُ الآلة لا تتبع لغةَ العرض', () => {
    const { files, meta } = generateNextScaffold({ projectName: 'مكتبة', sections: [], lang: 'ar', content: null });
    assert.deepEqual(meta.components.filter((c) => !['Navbar', 'Hero', 'Footer'].includes(c)), ['Features', 'About', 'Contact']);
    for (const n of ['app/features/page.jsx', 'app/about/page.jsx', 'components/Features.jsx']) {
        assert.ok(files.some((f) => f.name === n), `${n} مبنيّ بمفتاحه اللاتينيّ`);
    }
});

test('وبالإنجليزيّة تبقى كما كانت — لا ترجمةَ حيث لا حاجة', () => {
    const en = planSections([], 'en');
    assert.equal(en.labels.Features, 'Features');
    assert.equal(en.labels.About, 'About');
    assert.equal(en.labels.Contact, 'Contact');
});

test('الحدّ: ما سمّاه صاحبُ المشروع لا يُترجَم — بأيّ لغةٍ كتبه', () => {
    const ar = planSections(['الأعضاء', 'الإعارة'], 'ar');
    assert.equal(ar.labels.Section3 ?? Object.values(ar.labels).find((v) => v === 'الأعضاء'), 'الأعضاء');
    for (const v of ['الأعضاء', 'الإعارة']) assert.ok(Object.values(ar.labels).includes(v), `«${v}» كما سمّاها`);
    // كلمةٌ إنجليزيّةٌ كتبها صاحبُ المشروع بنفسه في مشروعٍ عربيّ: تبقى كما كتبها، لا تُترجَم
    const mixed = planSections(['Pricing'], 'ar');
    assert.ok(Object.values(mixed.labels).includes('Pricing'), 'تسميةُ صاحب المشروع لا تُمَسّ');
    // والحدُّ الحادّ: حتّى لو سمّى قسمَه بالمفتاح نفسِه الذي نحقنه — تسميتُه هي التي تُعرض، لا ترجمتُنا
    const same = planSections(['features', 'about'], 'ar');
    assert.equal(same.labels.Features, 'Features', '«features» جاءت من الطلب فلا تُترجَم');
    assert.equal(same.labels.About, 'About');
});

test('وبلا لغةٍ مذكورة لا تُترجَم — الترجمةُ تحتاج لغةً مقصودة لا افتراضاً', () => {
    const bare = planSections([]);
    assert.equal(bare.labels.Features, 'Features');
    assert.equal(bare.labels.Contact, 'Contact');
});

test('وكاتبُ المحتوى يُخبَر بالتسمية المعروضة — فيكتب لقسمٍ يعرف اسمَه بلغة صاحبه', async () => {
    const seen = [];
    const llm = async (messages) => { seen.push(messages.map((m) => m.content).join('\n')); throw new Error('يكفي التقاطُ الطلب'); };
    await generateContentModel('نظام إدارة مكتبة', { sections: [], lang: 'ar', llm });
    assert.equal(seen.length, 1, 'وصل طلبٌ واحد للنموذج');
    assert.match(seen[0], /"Features" = "المزايا"/, 'المفتاحُ لاتينيٌّ والتسميةُ عربيّة');
    assert.ok(!/"Features" = "Features"/.test(seen[0]), 'لا تسميةَ إنجليزيّة لقسمٍ في موقعٍ عربيّ');
});
