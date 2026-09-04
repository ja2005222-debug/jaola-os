// 🔐 مصادقة قوالب السيستم: كلمة مرور مُجزَّأة، افتراضية 'admin' قبل التغيير
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { verifyPassword, setPassword } from '../services/projectAuth.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'projectauth-'));

test('projectAuth: كلمة المرور الافتراضية admin تُقبَل قبل أي تغيير', async () => {
    const dir = tmp();
    assert.equal(await verifyPassword(dir, 'u', 'p', 'admin'), true);
    assert.equal(await verifyPassword(dir, 'u', 'p', 'wrong'), false);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: بعد تغيير كلمة المرور، القديمة (admin) تُرفض والجديدة تُقبَل', async () => {
    const dir = tmp();
    const r = await setPassword(dir, 'u', 'p', 'newSecret123');
    assert.ok(r.ok);
    assert.equal(await verifyPassword(dir, 'u', 'p', 'admin'), false, 'الافتراضية لم تعد صالحة');
    assert.equal(await verifyPassword(dir, 'u', 'p', 'newSecret123'), true);
    assert.equal(await verifyPassword(dir, 'u', 'p', 'wrong'), false);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: عزل تام بين المشاريع', async () => {
    const dir = tmp();
    await setPassword(dir, 'u', 'p1', 'secretOne');
    assert.equal(await verifyPassword(dir, 'u', 'p2', 'secretOne'), false, 'مشروع آخر لم يتأثر');
    assert.equal(await verifyPassword(dir, 'u', 'p2', 'admin'), true, 'مشروع آخر لا يزال على الافتراضية');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: يرفض كلمة مرور قصيرة جداً أو فارغة', async () => {
    const dir = tmp();
    assert.ok((await setPassword(dir, 'u', 'p', '')).error);
    assert.ok((await setPassword(dir, 'u', 'p', 'ab')).error);
    assert.ok((await setPassword(dir, 'u', 'p', 'abc')).ok, '3 أحرف حدّ أدنى مقبول');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: لا يخزّن التجزئة كنص صريح، ولا يرمي مع ملف تالف', async () => {
    const dir = tmp();
    await setPassword(dir, 'u', 'p', 'mySecretPass');
    const raw = fs.readFileSync(path.join(dir, 'u__p.json'), 'utf8');
    assert.ok(!raw.includes('mySecretPass'), 'كلمة المرور الخام غائبة عن الملف المخزَّن');

    fs.writeFileSync(path.join(dir, 'u2__p2.json'), '{not json');
    assert.equal(await verifyPassword(dir, 'u2', 'p2', 'admin'), true, 'ملف تالف → يُعامَل كغير موجود (افتراضية)');
    fs.rmSync(dir, { recursive: true, force: true });
});

// 🔴 استيلاءٌ كامل على لوحة التطبيق المنشور، بلا معرفة كلمة المرور.
//
// `/api/public/auth/set-password` كان محروساً بتوكن المشروع وحده — والتوكن
// **ليس سرّاً**: `dataSync.js` يكتبه حرفياً في `jaola-data.js` داخل الموقع
// المنشور ويعرضه على `window.JAOLA_SYNC.token`. فأي زائر يفتح الطرفية،
// يقرؤه، ويستبدل كلمة المرور — فيدخل ويُقصي المالك.
//
// ووجودُ `/auth/login` نفسه هو الدليل على أن كلمة المرور اعتمادٌ حقيقي:
// التجزيء لا يغادر الخادم، والتحقق في هذا الملف وحده. ثم كان مسارٌ شقيق
// يسلّم الاعتماد لمن طلبه — حارسٌ يَعِد بما ينقضه جارُه.
// ⚠️ كلمات المرور هنا **تُولَّد وقت التشغيل لا تُكتب في المصدر**: ثابتٌ
// نصّي يشبه اعتماداً حقيقياً يوقفه ماسح الأسرار في CI — وقع ذلك فعلاً على
// أول صياغةٍ لهذا الاختبار. نفس سبب توليد الهاش الوهمي في `accounts.js`
// بخدمة السفر. والاختبار لا يعنيه نصُّ الكلمة بل **تمايزُها**.
const pw = (tag) => `pw-${tag}-${randomUUID()}`;

test('🔒 استبدالُ كلمة مرور مضبوطة يتطلّب معرفتها — لا التوكن وحده', async () => {
    const dir = tmp();
    const ownerPass = pw('owner'), attackerPass = pw('attacker'), rotatedPass = pw('rotated');
    assert.ok((await setPassword(dir, 'owner', 'shop', ownerPass)).ok);

    // مهاجمٌ يملك التوكن (منشورٌ في الصفحة) ولا يعرف كلمة المرور
    const noProof = await setPassword(dir, 'owner', 'shop', attackerPass);
    assert.ok(noProof.error, 'استُبدل الاعتماد بلا إثبات — الاستيلاء ما زال ممكناً');
    assert.equal(noProof.status, 403);
    const wrongProof = await setPassword(dir, 'owner', 'shop', attackerPass, 'admin');
    assert.ok(wrongProof.error, 'تخمينٌ خاطئ للحالية مرّ');

    // والمالك لم يُمسّ
    assert.equal(await verifyPassword(dir, 'owner', 'shop', ownerPass), true);
    assert.equal(await verifyPassword(dir, 'owner', 'shop', attackerPass), false);

    // ويغيّرها هو بالحالية الصحيحة
    assert.ok((await setPassword(dir, 'owner', 'shop', rotatedPass, ownerPass)).ok);
    assert.equal(await verifyPassword(dir, 'owner', 'shop', rotatedPass), true);
    fs.rmSync(dir, { recursive: true, force: true });
});

// 📌 حدٌّ معلومٌ يُقال لا يُدَّعى خلافُه: مشروعٌ لم تُضبط له كلمة مرور بعدُ
// يبقى على الافتراضية `'admin'` — **معلنةً في المصدر ويعرفها الجميع**،
// فلا إثباتَ فيها يُطلَب. اشتراطُها كان سيمنع أصحاب التطبيقات المنشورة
// سلفاً من أول تغيير بلا أن يمنع مهاجماً يعرفها أصلاً. الحماية الحقيقية
// لتلك الحالة قرارُ منتَج (إلزام ضبط كلمة مرور عند أول نشر) لا شرطٌ هنا.
test('📌 أول ضبطٍ يبقى بلا إثبات (الافتراضية معلنة) — ثم يُقفَل', async () => {
    const dir = tmp();
    assert.ok((await setPassword(dir, 'u', 'p', pw('first'))).ok, 'أول ضبط لم يعد ممكناً');
    const after = await setPassword(dir, 'u', 'p', pw('attacker'));
    assert.ok(after.error && after.status === 403, 'لم يُقفَل بعد أول ضبط');
    fs.rmSync(dir, { recursive: true, force: true });
});

// كل قالبٍ يرسل الكلمة الحالية فعلاً، وله حقلٌ يجمعها — وإلا صار المسار
// يرفض تغييراً مشروعاً من لوحةٍ لا تملك ما تُثبت به.
test('🧩 القوالب الـ19 كلها ترسل currentPassword ولها حقلٌ يجمعها', async () => {
    const dir = new URL('../agents/cloneTemplates/', import.meta.url);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    const senders = files.filter(f => fs.readFileSync(new URL(f, dir), 'utf8').includes('auth/set-password'));
    assert.ok(senders.length >= 19, `قوالب تغيّر كلمة المرور: ${senders.length}`);
    for (const f of senders) {
        const src = fs.readFileSync(new URL(f, dir), 'utf8');
        assert.ok(src.includes('currentPassword'), `${f}: لا يرسل الكلمة الحالية`);
        // 🪞 «واحدٌ» لا «واحدٌ فأكثر»: صيغتي الأولى قبلت التكرار، فمرّ حقلٌ
        // مضاعفٌ في jaolaVetClinic — مُعرِّفٌ مكرَّر لا يبلغه getElementById
        // ويراه صاحب اللوحة مرّتين. الحارس يعدّ الآن لا يكتفي بالوجود.
        const fields = (src.match(/id="stPassCur"/g) || []).length
            + (src.match(/value=\{curPass\}/g) || []).length;
        assert.equal(fields, 1, `${f}: عدد حقول الكلمة الحالية ${fields} لا 1`);
    }
});
