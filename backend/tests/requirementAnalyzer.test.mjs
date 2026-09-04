import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { staticAnalysis, buildRequirementsContext, analyzeRequirements } from '../agents/requirementAnalyzer.js';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══════════════════════════════════════════════════════
// ما تُسلّمه الوحدة فعلاً
// ═══════════════════════════════════════════════════════

test('المتطلبات الضمنية تأتي من نوع المشروع', () => {
    const a = staticAnalysis('متجر عطور', 'ecommerce');
    assert.ok(a.implicitRequirements.some((r) => r.includes('سلة')));
    assert.ok(staticAnalysis('عيادة', 'medical').implicitRequirements.some((r) => r.includes('موعد')));
});

test('نوعٌ غير معروف يأخذ الأساسيات لا الفراغ', () => {
    const a = staticAnalysis('أيّ شيء', 'nope');
    assert.equal(a.implicitRequirements.length, 3);
    assert.ok(a.implicitRequirements.some((r) => r.includes('التواصل')));
});

test('الاقتراح يُكبَح إن ذكره المستخدم سلفاً', () => {
    assert.ok(staticAnalysis('متجر', 'ecommerce').suggestions.some((s) => s.includes('SEO')));
    assert.ok(!staticAnalysis('متجر مع seo', 'ecommerce').suggestions.some((s) => s.includes('SEO')));
});

// ═══════════════════════════════════════════════════════
// حقولٌ كانت تُحسب ولا يقرأها أحد — لا تعود
// ═══════════════════════════════════════════════════════

test('لا حقولَ تُحسب ولا تُقرأ', () => {
    const a = staticAnalysis('متجر عطور مع سلة ودفع وحجز ولوحة تحكم', 'ecommerce');
    assert.deepEqual(Object.keys(a).sort(), ['implicitRequirements', 'suggestions']);
});

test('لا مصدرَ ثانياً للتعقيد ولا للتحذيرات في الريبو', () => {
    const files = [];
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
            else if (e.name.endsWith('.js')) files.push(p);
        }
    };
    for (const r of ['agents', 'services', 'core']) walk(path.join(BACKEND, r));
    // استعمالُ حقلٍ لا ذِكرُ اسمه: إسنادٌ (`x:`) أو قراءةٌ (`.x`). التعليقُ
    // الذي يشرح سببَ حذفه يذكر الاسم مجرّداً، فلا يُحسب استعمالاً.
    const used = /(?:^|[^.\w])technicalComplexity\s*:|\.technicalComplexity\b/m;
    const hits = files.filter((f) => used.test(fs.readFileSync(f, 'utf8')));
    assert.deepEqual(hits.map((f) => path.relative(BACKEND, f)), [],
        'عاد حقلُ تعقيدٍ ثانٍ بجانب needsBackend');
});

// ═══════════════════════════════════════════════════════
// تركيبُ المُصدَّرَين لا يرمي — كان يرمي
// ═══════════════════════════════════════════════════════

test('buildRequirementsContext(staticAnalysis(...)) لا يرمي', () => {
    const ctx = buildRequirementsContext(staticAnalysis('متجر', 'ecommerce'));
    assert.match(ctx, /متطلبات ضمنية/);
});

test('كائنٌ ناقصٌ أو فارغٌ يُعطي نصاً فارغاً لا انهياراً', () => {
    assert.equal(buildRequirementsContext(), '');
    assert.equal(buildRequirementsContext({}), '');
    assert.equal(buildRequirementsContext({ keyFeatures: null, implicitRequirements: 'ليست مصفوفة' }), '');
});

test('الحقول الذكية تدخل السياق حين تُوجد', () => {
    const ctx = buildRequirementsContext({
        implicitRequirements: [], suggestions: [], contentSuggestions: [],
        mainGoal: 'بيع العطور', targetAudience: 'النساء', keyFeatures: ['تجربة عطر'], colorPersonality: 'دافئة',
    });
    for (const s of ['بيع العطور', 'النساء', 'تجربة عطر', 'دافئة']) assert.ok(ctx.includes(s), s);
});

// ═══════════════════════════════════════════════════════
// بلا ذكاء: التحليل الكامل يبقى صالحاً ولا يرمي
// ═══════════════════════════════════════════════════════

test('غيابُ الذكاء يترك الحقول فارغةً لا مفقودة', async () => {
    const a = await analyzeRequirements('متجر عطور', 'ecommerce');   // لا مفاتيح → deepAnalysis يردّ null
    assert.deepEqual(a.keyFeatures, []);
    assert.deepEqual(a.contentSuggestions, []);
    assert.equal(a.projectName, null);
    assert.ok(a.implicitRequirements.length > 0, 'ضاع الجزء الحتمي بسقوط الذكاء');
    assert.match(buildRequirementsContext(a), /متطلبات ضمنية/);
});
