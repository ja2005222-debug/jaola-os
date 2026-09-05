// 🗑️ «حذفٌ كامل» يجب أن يعني الحذف.
//
// حذفُ المشروع كان يمسح القرصَ وصفَّ Project والمقاييس (Sprint 3n) ويترك
// أسرارَه. مقيسٌ لا مفترَض: بعد الحذف كانت `STRIPE_SECRET_KEY` تُقرأ كما هي
// ويرثها مشروعٌ جديدٌ بالاسم نفسه. والمستخدمُ حذف ليُزيل لا ليُخفي.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'deletion-residue-test-key';
const {
    setProjectSecret, getProjectSecretNames, getProjectSecrets, clearProjectSecrets,
} = await import('../services/projectSecrets.js');
const { getProjectMemory, updateTech, clearProjectMemory } = await import('../agents/projectMemory.js');
const { transitionState, getProjectState, clearProjectState } = await import('../agents/stateMachine.js');

const BACKEND = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'del-'));

test('الأسرارُ لا تنجو من حذف المشروع', async () => {
    const dir = tmp();
    await setProjectSecret('ahmed', 'متجري', dir, 'STRIPE_SECRET_KEY', 'sk_live_XXXX');
    await setProjectSecret('ahmed', 'متجري', dir, 'DB_PASSWORD', 'p@ss');
    assert.strictEqual(getProjectSecretNames('ahmed', 'متجري').length, 2);

    fs.rmSync(dir, { recursive: true, force: true });
    await clearProjectSecrets('ahmed', 'متجري');

    assert.deepStrictEqual(getProjectSecretNames('ahmed', 'متجري'), [], 'بقيت أسماءُ الأسرار');
    assert.deepStrictEqual(getProjectSecrets('ahmed', 'متجري'), {}, 'بقيت قيمُ الأسرار مقروءة');
});

test('مشروعٌ جديدٌ بالاسم نفسه لا يرث أسرارَ المحذوف', async () => {
    const dir = tmp();
    await setProjectSecret('ahmed', 'متجري2', dir, 'STRIPE_SECRET_KEY', 'sk_live_OLD');
    await clearProjectSecrets('ahmed', 'متجري2');
    // «إنشاءٌ» جديدٌ بالاسم نفسه = القراءةُ من مفتاحٍ نظيف
    assert.deepStrictEqual(getProjectSecretNames('ahmed', 'متجري2'), [],
        'الوارثُ يُشغَّل بمفتاحِ دفعٍ لمشروعٍ ظنّ صاحبُه أنّه أزاله');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('حذفٌ لا يمسّ مشروعاً آخر لنفس المستخدم ولا مستخدماً آخر', async () => {
    const dir = tmp();
    await setProjectSecret('ahmed', 'أ', dir, 'K_A', 'v1');
    await setProjectSecret('ahmed', 'ب', dir, 'K_B', 'v2');
    await setProjectSecret('سالم', 'أ', dir, 'K_C', 'v3');
    await clearProjectSecrets('ahmed', 'أ');
    assert.deepStrictEqual(getProjectSecretNames('ahmed', 'أ'), []);
    assert.deepStrictEqual(getProjectSecretNames('ahmed', 'ب'), ['K_B'], 'مُسح مشروعٌ آخر للمستخدم');
    assert.deepStrictEqual(getProjectSecretNames('سالم', 'أ'), ['K_C'], 'مُسح مشروعُ مستخدمٍ آخر');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('لا يُدّعى مسحٌ لم يقع', async () => {
    assert.strictEqual((await clearProjectSecrets('لا', 'أحد')).cleared, false);
    const dir = tmp();
    await setProjectSecret('ahmed', 'ج', dir, 'K_D', 'v');
    assert.strictEqual((await clearProjectSecrets('ahmed', 'ج')).cleared, true);
    fs.rmSync(dir, { recursive: true, force: true });
});

// 🔑 الحارسُ المشتقّ: كلُّ مخزنٍ مفتاحُه `user:project` يجب أن يُمحى عند
// حذف المشروع. القائمةُ تُستخرج من المصدر لا تُكتب بيدي، فمخزنٌ خامسٌ
// يُضاف غداً بنفس المفتاح يدخل الفحصَ بحكم الاشتقاق ويسقط حتى يُمحى.
test('لا مخزنَ مفتاحُه user:project يبقى بلا مسحٍ عند الحذف', () => {
    const perProject = new Map();          // اسمُ المخزن → الملفُّ الذي يكتبه
    (function walk(dir, rel = '') {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'tests', 'workspaces', 'memory', 'plugins'].includes(e.name) || e.name.startsWith('.')) continue;
            const p = path.join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) { walk(p, r); continue; }
            if (!e.name.endsWith('.js')) continue;
            const src = fs.readFileSync(p, 'utf8');
            // مفتاحٌ مركّبٌ من مستخدمٍ ومشروع، أيّاً كانت تسميةُ المتغيّرين
            if (!/`\$\{(user|username)\}:\$\{(project|activeProject|safeProject)\}`/.test(src)) continue;
            // 🔴 كان البحثُ عن `persistEntry(` بالاسم، فمخزنٌ يستورده باسمٍ
            //    آخر (`persistEntry as pe`) يمرّ من تحت الحارس — نفسُ ضِيق
            //    حارس `jwt.verify`. القاعدةُ على الوحدة لا على الاسم:
            //    يُستخرج الاسمُ المحلّيّ من الاستيراد ثمّ يُبحث عن ندائه.
            //    ولا يكفي أوّلُ استيراد: ملفٌّ قد يستورد من `persistence.js`
            //    مرّتين، فيُقرأ الأوّلُ ويمرّ الثاني بأليَاسه. تُجمع الأسماءُ كلُّها.
            const locals = new Set();
            for (const imp of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*persistence\.js['"]/g)) {
                for (const spec of imp[1].split(',')) {
                    const m = /^\s*persistEntry(?:\s+as\s+(\w+))?\s*$/.exec(spec);
                    if (m) locals.add(m[1] || 'persistEntry');
                }
            }
            for (const local of locals) {
                for (const m of src.matchAll(new RegExp(`\\b${local}\\(\\s*'([^']+)'`, 'g'))) perProject.set(m[1], r);
            }
        }
    })(BACKEND);

    // 🔴 والمسحُ أعلاه يرى مخازنَ `persistEntry` وحدَها. و`workspaceStore`
    //    يحفظ **شيفرةَ المستخدم** في نموذج mongoose خاصٍّ به بحقلَي
    //    username+project — فمرّ من تحت الحارس وهو يُعلن الشمول. القاعدةُ
    //    تشمل الآن أيَّ نموذجٍ يحمل الحقلين معاً.
    (function walkModels(dir, rel = '') {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'tests', 'workspaces', 'memory', 'plugins'].includes(e.name) || e.name.startsWith('.')) continue;
            const p = path.join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) { walkModels(p, r); continue; }
            if (!e.name.endsWith('.js')) continue;
            const src = fs.readFileSync(p, 'utf8');
            // 🔴 كُتب هذا أوّلاً بنمطٍ كسولٍ ينتهي عند أوّل `}` — وهو نهايةُ
            //    حقلِ `username` لا نهايةُ المخطّط، فلم يُرَ `project` قطّ
            //    ووجد الحارسُ **صفراً** ومرّ. نافذةٌ ثابتةٌ بعد رأس المخطّط.
            for (const m of src.matchAll(/new mongoose\.Schema\(\{/g)) {
                const body = src.slice(m.index, m.index + 1200);
                if (/\busername\s*:/.test(body) && /\bproject\s*:/.test(body)) {
                    const name = (/const\s+(\w+)\s*=\s*mongoose\.models\.(\w+)/.exec(src) || [])[2] || r;
                    perProject.set(`نموذج:${name}`, r);
                }
            }
        }
    })(BACKEND);

    assert.ok(perProject.size >= 3, `لم يُعثر على مخازنِ المشروع (${perProject.size}) — راجِع الاشتقاق`);

    const del = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8');
    const body = del.slice(del.indexOf('async function deleteProjectCompletely'));
    const scope = body.slice(0, body.indexOf('\n}\n'));

    // مخزنٌ مُصان = ملفُّه يُصدّر ماسحاً، والماسحُ (١) منادىً في دالّة الحذف
    // و(٢) يُزيل السجلَّ المحفوظ لا الذاكرةَ وحدَها — وإلا عاد بعد الإقلاع.
    const unmopped = [], cacheOnly = [];
    for (const [store, file] of perProject) {
        const src = fs.readFileSync(path.join(BACKEND, file), 'utf8');
        const clears = [...src.matchAll(/export (?:async )?function (clear\w+|remove\w+)\s*\([^)]*\)\s*\{/g)];
        const called = clears.filter(([, fn]) => new RegExp(`\\b${fn}\\s*\\(`).test(scope));
        if (!called.length) { unmopped.push(`${store} (${file})`); continue; }
        // «يبلغ الدائمَ» لا «ينادي removeEntry»: مخازنُ persistEntry تمحو به،
        // ونماذجُ mongoose بـdeleteMany/deleteOne. الشرطُ على الأثر لا على
        // اسمِ الدالّة — وإلا رُدَّ ماسحٌ صحيحٌ لأنّه كُتب بأداةٍ أخرى.
        const reaches = called.some(([whole, fn]) => {
            const from = src.indexOf(whole);
            return /(removeEntry|deleteMany|deleteOne)\s*\(/.test(src.slice(from, from + 800));
        });
        if (!reaches) cacheOnly.push(`${store} (${file})`);
    }
    assert.deepStrictEqual(unmopped, [],
        'مخازنُ تحمل بيانات المشروع وتبقى بعد حذفه — الحذفُ يجب أن يعني الحذف');
    assert.deepStrictEqual(cacheOnly, [],
        'ماسحٌ يمسح الذاكرةَ ولا يُزيل السجلَّ المحفوظ — تعود البياناتُ بعد أوّل إقلاع');
});

test('الذاكرةُ والحالةُ لا تنجوان كذلك — لا يرث الجديدُ خطّةَ المحذوف', async () => {
    updateTech('ahmed', 'مطعمي', { stack: 'next' });
    // 🔴 كُتب هنا أوّلاً `'building'` — وهو انتقالٌ **ممنوع** من `idle`، فلم
    //    تُكتب حالةٌ قطّ ومرّ الاختبارُ على فراغ. `'planning'` مسموحٌ منه.
    transitionState('ahmed', 'مطعمي', 'planning');
    assert.strictEqual(getProjectState('ahmed', 'مطعمي').state, 'planning', 'لم تُكتب الحالةُ أصلاً');
    assert.strictEqual(getProjectMemory('ahmed', 'مطعمي').tech.stack, 'next', 'لم تُكتب الذاكرةُ أصلاً');

    await clearProjectMemory('ahmed', 'مطعمي');
    await clearProjectState('ahmed', 'مطعمي');

    const mem = getProjectMemory('ahmed', 'مطعمي');
    assert.notStrictEqual(mem?.tech?.stack, 'next', 'ورث الجديدُ تقنيّاتِ المحذوف');
    assert.notStrictEqual(getProjectState('ahmed', 'مطعمي').state, 'planning', 'ورث الجديدُ حالةَ مشروعٍ زال');
});
