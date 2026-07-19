// 🧠 معرفة المنصة الحيّة — المساعد يعرف قدرات المنصة وحقائق المستخدم اللحظية
// بدل "لا أملك معلومات، راجع الإعدادات". نختبر التركيب النقي (بلا DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilitiesBlock, liveFactsBlock, buildKnowledgeBlock } from '../services/platformKnowledge.js';

test('القدرات تذكر Vercel والنشر وإعادة النشر بأمر اللغة الصحيح', () => {
    const ar = capabilitiesBlock('ar');
    assert.match(ar, /Vercel/);
    assert.match(ar, /🚀/);
    assert.match(ar, /"انشر"/);
    assert.match(ar, /احذف المشروع/);
    const en = capabilitiesBlock('en');
    assert.match(en, /"deploy"/);
    assert.match(en, /delete the project/);
});

test('خطة مجانية: يعرض الحد والمتبقّي', () => {
    const usage = { planId: 'free', projects: { used: 3, limit: 5, remaining: 2, unlimited: false }, features: { autoDeploy: false } };
    const block = liveFactsBlock({ lang: 'ar', usage, deployUrl: null });
    assert.match(block, /مجانية/); // اسم الخطة يُترجم حسب لغة المستخدم
    assert.match(block, /3\/5/);
    assert.match(block, /2 remaining/);
    assert.match(block, /not deployed yet/i);
});

test('خطة احترافية غير محدودة + مشروع منشور', () => {
    const usage = { planId: 'pro', projects: { used: 12, unlimited: true }, features: { autoDeploy: true } };
    const block = liveFactsBlock({ lang: 'en', usage, deployUrl: 'https://jamal-shop.vercel.app' });
    assert.match(block, /Pro/);
    assert.match(block, /unlimited/i);
    assert.match(block, /jamal-shop\.vercel\.app/);
    assert.match(block, /Re-deploy/i);
});

test('بلا usage (صمود DB) → كتلة القدرات تُبنى بلا انهيار', () => {
    const block = buildKnowledgeBlock({ lang: 'ar', usage: null, deployUrl: null });
    assert.match(block, /PLATFORM CAPABILITIES/);
    assert.match(block, /Vercel/);
    assert.match(block, /NOT deployed yet/i);
    // لا سطر خطة عند غياب usage
    assert.doesNotMatch(block, /Current plan/);
});

test('الكتلة الكاملة تجمع القدرات + الحقائق اللحظية', () => {
    const usage = { planId: 'free', projects: { used: 0, limit: 5, remaining: 5, unlimited: false }, features: { autoDeploy: false } };
    const block = buildKnowledgeBlock({ lang: 'en', usage, deployUrl: null });
    assert.match(block, /PLATFORM CAPABILITIES/);
    assert.match(block, /LIVE ACCOUNT & PROJECT STATE/);
    assert.match(block, /Current plan: Free/);
});
