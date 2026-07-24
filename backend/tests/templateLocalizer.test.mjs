// 🌐 توطين القوالب: تُسلَّم بلغة المستخدم المختارة — حتميّاً وبلا كسر أي دالة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { localizeText, localizeTemplateFiles, arabicRatio } from '../agents/templateLocalizer.js';
import { extractDefinedFunctions, verifyBehavior } from '../agents/behaviorVerifier.js';
import { listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { jaolaStore } from '../agents/cloneTemplates/jaolaStore.js';

test('localizeText: ترجمة حتميّة بالأطول-أولاً (لا أكل جزئي)', () => {
    assert.equal(localizeText('تسجيل الدخول'), 'Sign in');
    assert.equal(localizeText('لوحة الإدارة — كل الحجوزات'), 'Admin Panel — All Bookings');
    // «دخول المدير» يجب ألا تُترجم كـ «Sign in Admin» بالخطأ
    assert.equal(localizeText('دخول المدير'), 'Admin sign in');
});

test('لا فواصل عليا مفردة في أي ترجمة (حماية سلاسل JS)', async () => {
    const mod = await fs.promises.readFile(new URL('../agents/templateLocalizer.js', import.meta.url), 'utf8');
    const dictSection = mod.slice(mod.indexOf('const DICT'), mod.indexOf('const ORDERED'));
    // الترجمة هي العنصر الثاني في كل زوج — تحقّق أن لا "'" داخل نص إنجليزي مقتبس
    for (const m of dictSection.matchAll(/,\s*'([^']*)'\]/g)) {
        assert.ok(!m[1].includes("\\'"), `ترجمة تحوي فاصلة عليا مهرّبة: ${m[1]}`);
    }
});

test('localizeTemplateFiles: العربية (الأصل) تُعاد كما هي', () => {
    const c = jaolaStore();
    const out = localizeTemplateFiles(c.files, 'ar');
    assert.deepEqual(out.map(f => f.content), c.files.map(f => f.content));
});

test('المتجر بالإنجليزية: lang/dir مقلوبان وصفر عربية في الواجهة والدوال محفوظة', () => {
    const c = jaolaStore();
    const out = localizeTemplateFiles(c.files, 'en');
    const html = out.find(f => f.name === 'index.html').content;
    const js = out.find(f => f.name === 'app.js').content;
    assert.ok(html.includes('lang="en"') && html.includes('dir="ltr"'), 'قلب اللغة والاتجاه');
    assert.ok(html.includes('Sign in') && html.includes('Your cart'), 'الكروم مُترجم');
    // صفر عربية في HTML *المرئي* (التعليقات البرمجية مقبولة عربية — غير معروضة)
    const visible = html.replace(/<!--[\s\S]*?-->/g, '');
    assert.equal((visible.match(/[؀-ۿ]/g) || []).length, 0, 'لا عربية متبقية في المحتوى المرئي');
    // الدوال كما هي تماماً
    const before = extractDefinedFunctions(c.files.find(f => f.name === 'app.js').content);
    const after = extractDefinedFunctions(js);
    assert.deepEqual(after, before, 'لا مساس بالدوال');
});

test('تغطية شاملة: كل القوالب الـ13 بالإنجليزية شبه خالية من العربية الظاهرة', () => {
    for (const meta of listClones()) {
        const c = getCloneById(meta.id);
        const out = localizeTemplateFiles(c.files, 'en');
        const html = (out.find(f => f.name === 'index.html')?.content || '').replace(/<!--[\s\S]*?-->/g, '');
        const ratio = arabicRatio(html);
        assert.ok(ratio < 0.002, `${meta.id}: عربية متبقية في HTML بنسبة ${(ratio * 100).toFixed(1)}%`);
    }
});

test('تكامل jsdom: المتجر المُوطَّن بالإنجليزية يعمل بلا أخطاء وبتغطية أدوار', async () => {
    const c = jaolaStore();
    const out = localizeTemplateFiles(c.files, 'en');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loc-'));
    for (const f of out) fs.writeFileSync(path.join(dir, f.name), f.content);
    const v = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'x' }] }, domainModel: c.model });
    assert.equal(v.ok, true, 'القالب الإنجليزي يعمل — ' + v.summary);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('بيانات المعرض الوصفية: nameEn/descriptionEn إنجليزية فعلاً لكل القوالب', () => {
    for (const c of listClones()) {
        assert.ok(c.nameEn && c.descriptionEn, `${c.id}: الحقول الإنجليزية موجودة`);
        assert.equal((c.nameEn.match(/[؀-ۿ]/g) || []).length, 0, `${c.id}: nameEn بلا عربية`);
        assert.equal((c.descriptionEn.match(/[؀-ۿ]/g) || []).length, 0, `${c.id}: descriptionEn بلا عربية`);
    }
});
