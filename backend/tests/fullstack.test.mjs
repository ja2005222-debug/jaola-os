// 🏗️ قوالب Full-Stack (#21): كل فئة تولّد مشروعاً كاملاً متّسقاً —
// schema متوافق SQLite (لا Json)، كل نموذج مستخدم، كل مورد له routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFullStackCategories, buildFullStackProject, isFullStackCategory, resolveFullStackCategory, recommendFullStack } from '../agents/fullstackTemplates.js';

test('كل الفئات تولّد مشاريع كاملة ومتّسقة', () => {
    for (const cat of getFullStackCategories()) {
        const { files } = buildFullStackProject(cat, 'Demo');
        const names = files.map(f => f.name);
        for (const req of ['package.json', 'app/layout.js', 'app/page.js', 'lib/prisma.js', 'prisma/schema.prisma', 'prisma/seed.js', '.env.example']) {
            assert.ok(names.includes(req), `[${cat}] ملف مفقود: ${req}`);
        }
        assert.equal(new Set(names).size, names.length, `[${cat}] أسماء مكررة`);

        const schema = files.find(f => f.name === 'prisma/schema.prisma').content;
        assert.ok(!/\bJson\b/.test(schema), `[${cat}] نوع Json غير مدعوم في SQLite`);
        assert.match(schema, /datasource db/);

        // كل نموذج مستخدم فعلاً في route/page
        for (const m of [...schema.matchAll(/model (\w+) \{/g)].map(x => x[1])) {
            const acc = m[0].toLowerCase() + m.slice(1);
            assert.ok(files.some(f => f.name.startsWith('app/') && f.content.includes(`prisma.${acc}.`)),
                `[${cat}] النموذج ${m} غير مستخدم`);
        }
        // routes قائمة + عنصر متطابقة
        const list = names.filter(n => /^app\/api\/[^/]+\/route\.js$/.test(n));
        const item = names.filter(n => /^app\/api\/[^/]+\/\[id\]\/route\.js$/.test(n));
        assert.ok(list.length >= 2, `[${cat}] موارد قليلة`);
        assert.equal(list.length, item.length, `[${cat}] عدم تطابق routes`);
    }
});

test('الروابط (aliases) والتوصية', () => {
    assert.equal(resolveFullStackCategory('startup'), 'saas');
    assert.equal(resolveFullStackCategory('news'), 'blog');
    assert.equal(isFullStackCategory('gym'), false);
    assert.equal(recommendFullStack('متجر مع قاعدة بيانات', 'ecommerce').fullstack, true);
    assert.equal(recommendFullStack('متجر بسيط', 'ecommerce', 'brochure').fullstack, false);
    assert.equal(recommendFullStack('احجز موعد', 'booking', 'webapp').fullstack, true);
});
