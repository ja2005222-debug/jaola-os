// 🏷️ اسم خدمة Render **هوية**: يدخل render.yaml حرفياً ويصير اسم المضيف
// https://<الاسم>.onrender.com. كان يُشتقّ في ستة مواضع بصيغتين متعارضتين.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderServiceName } from '../agents/renderAgent.js';
import { vercelProjectNameOf } from '../services/customDomains.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// قاعدة تسمية مضيف DNS: يبدأ وينتهي بحرف أو رقم، وبينهما شرطات مسموحة
const VALID_HOST_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

test('كل ناتج اسمُ مضيفٍ صالح — بما فيه ما كان يخرج باطلاً', () => {
    const cases = [
        ['guest_user', 'متجري'],   // ضيف النظام: الشرطة السفلية كانت تبقى في مسار واحد
        ['ali_2005', 'shop'],
        ['ali', 'shop'],
        ['ali', '-----'],           // اسمٌ عربي طهّرته الطبقة الأعلى إلى شرطات
        ['ali_2005', 'a'.repeat(80)],
        ['', ''], [null, undefined],
    ];
    for (const [u, p] of cases) {
        const name = renderServiceName(u, p);
        assert.match(name, VALID_HOST_LABEL, `${u}/${p} → ${name}`);
        assert.ok(name.length <= 50, `طول ${name}`);
    }
});

test('الحالة السائدة لم تتغيّر — الصيغة القديمة الصحيحة تبقى بحرفها', () => {
    // ما كانت تنتجه المواضع الخمسة حين لا يوجد محرف مشكِل
    assert.equal(renderServiceName('ali', 'shop'), 'ali-shop');
    assert.equal(renderServiceName('sara', 'my-store'), 'sara-my-store');
    assert.equal(renderServiceName('ali_2005', 'shop'), 'ali-2005-shop');
});

test('لا هويتان لمشروعٍ واحد: guest_user كان يُكتب بصيغتين', () => {
    // قديماً: _stageRenderConfig ينتج «guest_user-shop» (شرطة سفلية = مضيف باطل)
    // والخمسة الباقية «guest-user-shop». الآن واحدة.
    const name = renderServiceName('guest_user', 'shop');
    assert.equal(name, 'guest-user-shop');
    assert.ok(!name.includes('_'), 'لا شرطة سفلية في اسم مضيف');
});

test('اسمٌ لا يترك محرفاً لاتينياً لا يُطوى إلى فراغ — ولا يتصادم مشروعان', () => {
    const a = renderServiceName('guest_user', 'متجري');
    const b = renderServiceName('guest_user', 'مطعمي');
    assert.notEqual(a, b, 'مشروعان مختلفان لا يشتركان في خدمة واحدة');
    assert.equal(a, renderServiceName('guest_user', 'متجري'), 'البصمة ثابتة عبر النداءات');
    assert.match(a, VALID_HOST_LABEL);
});

test('الاقتطاع لا يترك شرطةً طرفية', () => {
    // اسم مستخدم بطول 20 (سقف التسجيل) ومشروع طويل: الحدّ 50 قد يقع على شرطة
    for (let n = 1; n <= 60; n++) {
        const name = renderServiceName('u'.repeat(20), 'a-'.repeat(n));
        assert.match(name, VALID_HOST_LABEL, `n=${n} → ${name}`);
    }
});

// 📌 كان هذا الاختبار يحرس **القيمة المكسورة** عمداً: اسم مشروع Vercel
// هويةٌ حيّة مرتبطة بنطاقات مخصّصة منشورة، فأُجِّل إصلاحه لقرار المالك.
// رُفع التأجيل، وأُصلح في `hostNames.js` بشرطٍ صارم: **لا يتغيّر ناتجٌ
// كان صالحاً**، فلا يُعاد تسمية مشروعٍ يعمل اليوم — والسطران الأولان
// أدناه هما نفسهما بحرفهما، دليلاً على ذلك. تفصيلُه في
// `tests/hostNames.test.mjs` بمقارنةٍ ضد الصيغة القديمة.
test('اسم Vercel: نسخةٌ واحدة، والصالح منه كما كان بحرفه', () => {
    assert.equal(vercelProjectNameOf('ali', 'shop'), 'ali-shop');
    assert.equal(vercelProjectNameOf('ali_2005', 'My App'), 'ali-2005-my-app');
    // كان `'guest-user-'`: شَرطةٌ طرفية يرفضها Vercel، وهويةٌ يتقاسمها كل
    // مشاريع المستخدم العربية. صار لكلٍّ بصمتُه.
    const n = vercelProjectNameOf('guest_user', 'متجري');
    assert.match(n, /^guest-user-p[0-9a-f]{6}$/);
    assert.notEqual(n, vercelProjectNameOf('guest_user', 'دكاني'));
});
