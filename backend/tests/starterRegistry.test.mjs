// 🧰 سجلُّ القوالب + دعوى المصدر في تقرير التسليم.
//
// كان تقريرُ بناء React يقول للمستخدم: «⚛️ Next.js + Tailwind · … · قالب:
// Next.js SaaS + Stripe». والقالبُ لم يُقرأ في البناء إطلاقاً — لا سطرَ منه
// في المُسلَّم. هذا الملفُّ يحرس السجلَّ نفسَه، ويحرس ألّا تعود الدعوى.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STARTERS, resolveStack, selectStarter, listStarters } from '../agents/starterRegistry.js';
import { parseRepoUrl } from '../agents/starterFetch.js';
import { generateNextScaffold } from '../agents/reactGenerator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('السجلُّ متماسك: معرّفاتٌ فريدة، ومستودعاتٌ تُحلّ، ورخصةٌ لكلّ خارجيّ', () => {
    const ids = STARTERS.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'معرّفٌ مكرّر');
    for (const s of STARTERS) {
        assert.ok(s.id && s.type && s.name, `حقلٌ ناقص: ${s.id}`);
        assert.ok(['vanilla', 'react-next'].includes(s.stack), `مسارٌ مجهول: ${s.id}`);
        if (s.repo) {
            assert.doesNotThrow(() => parseRepoUrl(s.repo), `مستودعٌ لا يُحلّ: ${s.id}`);
            assert.strictEqual(s.license, 'MIT', `قالبٌ خارجيّ بلا رخصة MIT: ${s.id}`);
        } else {
            assert.strictEqual(s.license, 'internal', `قالبٌ بلا مستودع يجب أن يكون داخلياً: ${s.id}`);
        }
    }
});

test('الموجّه: النوعُ الكبير أو النطاقُ الكامل → React/Next، وغيرُه سريع', () => {
    for (const t of ['saas', 'ecommerce', 'marketplace', 'dashboard', 'fintech', 'platform'])
        assert.strictEqual(resolveStack({ projectType: t }), 'react-next', t);
    for (const scope of ['full', 'كامل', 'متكامل', 'كبير', 'large'])
        assert.strictEqual(resolveStack({ projectType: 'business', scope }), 'react-next', scope);
    assert.strictEqual(resolveStack({ projectType: 'restaurant' }), 'vanilla');
    assert.strictEqual(resolveStack({}), 'vanilla', 'بلا مدخلاتٍ لا يُقفز إلى المسار الثقيل');
});

test('الاختيار: النوعُ والمسارُ معاً أوّلاً، ثمّ النوع، ثمّ احتياطُ المسار', () => {
    assert.strictEqual(selectStarter({ projectType: 'saas' }).id, 'next-saas');
    assert.strictEqual(selectStarter({ projectType: 'restaurant' }).id, 'vanilla-restaurant');
    // نوعٌ كبير لا قالبَ له بعينه → احتياطٌ عامّ على نفس المسار
    assert.strictEqual(selectStarter({ projectType: 'marketplace' }).stack, 'react-next');
    assert.ok(selectStarter({}), 'مدخلاتٌ فارغة لا تُسقط الاختيار');
});

test('listStarters تُعيد نسخاً لا تُعدّل السجلَّ المشترك', () => {
    const first = listStarters();
    first[0].name = 'مُبدَّل';
    assert.notStrictEqual(listStarters()[0].name, 'مُبدَّل', 'السجلُّ تسرّب للمستدعي');
});

// 🔑 الدعوى الفارغة: السكافولد لا يدين للسجلّ بشيء.
test('سكافولد Next لا يحمل أثراً من أيّ قالبٍ في السجلّ', () => {
    const saas = STARTERS.find((s) => s.id === 'next-saas');
    const scaffold = generateNextScaffold({ projectName: 'x', sections: ['landing', 'pricing'], lang: 'ar' });
    const all = scaffold.files.map((f) => `${f.name}\n${f.content}`).join('\n').toLowerCase();
    assert.ok(scaffold.files.length > 0, 'لم يُولَّد شيء');
    for (const feature of saas.features) {
        assert.ok(!all.includes(feature.toLowerCase()),
            `القالبُ المزعوم حاضرٌ فعلاً (${feature}) — إن صار يُستعمل فالدعوى صارت صادقة، فحدِّث هذا الحارس`);
    }
});

// وحارسٌ نصّيّ كي لا يعود الاسمُ إلى تقرير التسليم بلا كودٍ يسنده
// (على نسق حارس `exec` في tests/gitAgent.test.mjs).
test('تقريرُ بناء React لا يسمّي قالباً لم يُستعمل كودُه', () => {
    const src = fs.readFileSync(path.join(HERE, '..', 'agents', 'jcr.js'), 'utf8');
    const start = src.indexOf('async _buildReactProject');
    assert.ok(start > 0, 'لم تُوجد دالةُ بناء React');
    const body = src.slice(start, src.indexOf('\n    }\n', start));
    assert.ok(!/\bstarter\b/.test(body),
        'عاد ذكرُ القالب إلى بناء React — لا يُسمّى قالبٌ إلا إذا جُلب كودُه فعلاً');
    // نداءً لا ذِكراً: التعليقُ الذي يشرح لماذا حُذف يجب ألّا يُسقط حارسَه.
    assert.ok(!/selectStarter\s*\(/.test(src),
        'عاد اختيارُ قالبٍ في مسار البناء بلا جلبٍ يسنده');
});
