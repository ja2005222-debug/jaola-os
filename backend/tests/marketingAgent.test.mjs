// 📣 المساعد التسويقي: استخراج الحقائق + منشورات بذكاء أو بارتداد حتمي + مسودّة ردّ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    extractSiteFacts, fallbackWeekPlan, generateSocialPosts, draftInboxReply,
} from '../agents/marketingAgent.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mk-'));

function cmsProject() {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(path.join(dir, 'lib/content.js'),
        `export const content = ${JSON.stringify({
            brand: 'حلويات الياسمين',
            hero: { title: 'حلويات الياسمين', subtitle: 'أشهى الحلويات الشرقية الطازجة' },
            products: [{ name: 'كنافة نابلسية', price: '25 ر.س' }, { name: 'بقلاوة فستق', price: '30 ر.س' }],
            sections: { about: { heading: 'من نحن', items: [] } },
        })};\n`);
    return dir;
}

test('استخراج الحقائق: من CMS أولاً، ومن index.html كارتداد', () => {
    const dir = cmsProject();
    const f = extractSiteFacts(dir);
    assert.equal(f.brand, 'حلويات الياسمين');
    assert.ok(f.items.some(i => i.name === 'كنافة نابلسية'));
    assert.ok(f.sections.includes('من نحن'));
    fs.rmSync(dir, { recursive: true, force: true });

    const dir2 = tmp();
    fs.writeFileSync(path.join(dir2, 'index.html'),
        '<html><head><title>مطعم البستان</title></head><body><h1>أطيب المأكولات</h1><h2>قائمتنا</h2></body></html>');
    const f2 = extractSiteFacts(dir2);
    assert.equal(f2.brand, 'مطعم البستان');
    assert.equal(f2.tagline, 'أطيب المأكولات');
    assert.ok(f2.sections.includes('قائمتنا'));
    fs.rmSync(dir2, { recursive: true, force: true });

    assert.equal(extractSiteFacts(tmp()).brand, 'موقعنا', 'مشروع فارغ لا ينهار');
});

test('منشورات: الذكاء المعطّل لا يمنع أسبوعاً كاملاً (ارتداد حتمي بصور)', async () => {
    const dir = cmsProject();
    const failingChat = async () => { throw new Error('AI down'); };
    const r = await generateSocialPosts(dir, { lang: 'ar' }, { chat: failingChat });
    assert.equal(r.ai, false);
    assert.equal(r.posts.length, 7);
    assert.ok(r.posts.every(p => p.text.length > 10 && p.day && Array.isArray(p.hashtags)));
    assert.ok(r.posts.some(p => p.text.includes('كنافة نابلسية')), 'المحتوى من الموقع الفعلي');
    assert.ok(r.posts.every(p => p.svg.includes('<svg')), 'صورة SVG لكل منشور');
    assert.equal(r.brand, 'حلويات الياسمين');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('منشورات: ردّ الذكاء الصالح يُقبل والمشوّه يرتدّ للخطة', async () => {
    const dir = cmsProject();
    const goodChat = async () => JSON.stringify({
        posts: Array.from({ length: 7 }, (_, i) => ({ day: `يوم ${i + 1}`, text: `منشور ذكي رقم ${i + 1} عن حلوياتنا الشهية`, hashtags: ['#حلويات'] })),
    });
    const r = await generateSocialPosts(dir, { lang: 'ar' }, { chat: goodChat });
    assert.equal(r.ai, true);
    assert.ok(r.posts[0].text.includes('منشور ذكي'));

    const junkChat = async () => JSON.stringify({ posts: [{ text: 'قصير' }] });
    const r2 = await generateSocialPosts(dir, { lang: 'ar' }, { chat: junkChat });
    assert.equal(r2.ai, false, 'أقل من 5 منشورات صالحة → الخطة الحتمية');
    assert.equal(r2.posts.length, 7);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('مسودّة الردّ: ذكاء أولاً، وارتداد لائق باسم المرسل والعلامة', async () => {
    const ai = await draftInboxReply(
        { brand: 'متجري', name: 'سالم', message: 'هل يوجد توصيل؟', lang: 'ar' },
        { chat: async () => 'أهلاً سالم، نعم نوفر التوصيل لجميع المدن. تواصل معنا لتفاصيل منطقتك.' });
    assert.equal(ai.ai, true);
    assert.ok(ai.draft.includes('سالم'));

    const fb = await draftInboxReply(
        { brand: 'متجري', name: 'سالم', message: 'هل يوجد توصيل؟', lang: 'ar' },
        { chat: async () => { throw new Error('down'); } });
    assert.equal(fb.ai, false);
    assert.ok(fb.draft.includes('سالم') && fb.draft.includes('متجري'));
    const en = await draftInboxReply({ brand: 'MyShop', message: 'Do you ship?', lang: 'en' },
        { chat: async () => { throw new Error('down'); } });
    assert.ok(en.draft.includes('MyShop') && en.draft.includes('Thank you'));
});

test('الخطة الحتمية ثنائية اللغة وبهاشتاقات', () => {
    const facts = { brand: 'My Cafe', tagline: 'Best coffee', items: [{ name: 'Latte' }], sections: [] };
    const en = fallbackWeekPlan(facts, 'en');
    assert.equal(en.length, 7);
    assert.ok(en[0].text.includes('My Cafe'));
    assert.ok(en.some(p => p.text.includes('Latte')));
    assert.ok(en[0].hashtags[0].startsWith('#'));
    assert.equal(fallbackWeekPlan(facts, 'ar')[0].day, 'السبت');
});
