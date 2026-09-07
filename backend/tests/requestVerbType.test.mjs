// 🏗️ PM/13 — «فعلُ الطلب ليس صناعةَ المنتج»: «بناء» كانت في كلمات صناعة المقاولات، وهي الفعلُ الذي يبدأ به
// المستخدمُ العربيُّ طلبَه («أريد بناء متجر ملابس»). فقِيس: الفعلُ يقلب نوعَ المشروع إلى `construction` في
// **٧ من ١٠** طلباتٍ حقيقيّة؛ وبالإنجليزيّة «building a restaurant website» كذلك عبر الكلمة `building`.
// والنوعُ ليس زينةً: يختار لوحةَ الألوان وصورَ الستوك، ويُحقن في بريف المصمّم، ومنه يُقرأ في `resolveType`
// فيُرسَل إلى مولّد مخطّط قاعدة البيانات («النوع: construction» لنظام مكتبة).
// المبدأُ نفسُه الذي أخرج «شركة» من ألفاظ البروشور: ما يصف *الطلب* لا يصف *المطلوب*.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { detectProjectType } from '../agents/knowledgeEngine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
// منتجاتٌ حقيقيّة وأنواعُها حين تُطلب بلا فعل — خطُّ الأساس المقيس
const PRODUCTS = [
    ['متجر ملابس', 'ecommerce'], ['نظام إدارة مكتبة', 'saas'], ['تطبيق توصيل طعام', 'restaurant'],
    ['موقع مطعم', 'restaurant'], ['نظام عيادة أسنان', 'clinic'], ['منصة تعليمية', 'saas'],
    ['تطبيق حجز فنادق', 'booking'], ['نظام نقاط بيع', 'ecommerce'], ['موقع عقارات', 'realestate'],
];

test('فعلُ الطلب لا يغيّر نوعَ المنتج: «أريد بناء X» تبقى X — وكانت تقلب سبعةً من عشرة إلى مقاولات', () => {
    for (const [product, type] of PRODUCTS) {
        assert.equal(detectProjectType(product), type, `الأساس: ${product}`);
        for (const verb of ['أريد بناء ', 'ابنِ ', 'أريد تصميم ', 'صمّم ', 'أريد إنشاء ', 'اعمل لي ']) {
            assert.equal(detectProjectType(verb + product), type, `«${verb.trim()}» غيّرت نوعَ «${product}»`);
        }
    }
    assert.notEqual(detectProjectType('أريد بناء متجر ملابس'), 'construction');
});

test('وبالإنجليزيّة: «building a restaurant website» مطعمٌ لا مقاولات', () => {
    assert.equal(detectProjectType('restaurant website'), 'restaurant');
    assert.equal(detectProjectType('build a restaurant website'), 'restaurant');
    assert.equal(detectProjectType('building a restaurant website'), 'restaurant');
    assert.equal(detectProjectType('building an online clothing store'), 'ecommerce');
});

test('وطلبُ المقاولات الحقيقيُّ يبقى مقاولات — بأسماء الصناعة لا بفعل الطلب', () => {
    for (const g of ['شركة مقاولات وبناء', 'مكتب هندسي للإنشاءات', 'موقع مقاول تشطيبات',
        'construction company website', 'contractor portfolio']) {
        assert.equal(detectProjectType(g), 'construction', g);
    }
});

test('الحدود: قائمةُ المقاولات بلا أفعالِ طلب — والصناعةُ تبقى مسمّاة', () => {
    const src = fs.readFileSync(path.join(HERE, '../agents/knowledgeEngine.js'), 'utf8');
    const row = src.match(/construction:\s*\[([^\]]*)\]/);
    assert.ok(row, 'صفُّ المقاولات موجود');
    const words = row[1].split(',').map(w => w.trim().replace(/^['"]|['"]$/g, ''));
    for (const verb of ['بناء', 'building', 'تصميم', 'إنشاء', 'انشاء', 'عمل', 'build', 'create', 'make', 'design'])
        assert.ok(!words.includes(verb), `«${verb}» فعلُ طلبٍ لا صناعة — خرجت من القائمة`);
    for (const name of ['مقاولات', 'إنشاءات', 'هندسي', 'construction', 'contractor'])
        assert.ok(words.includes(name), `«${name}» اسمُ الصناعة — يبقى`);
});
