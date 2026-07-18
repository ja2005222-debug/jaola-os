// 🧩 إصلاح 404 على Vercel: مشاريع فيها package.json كان Vercel يحاول بناءها
// بدل خدمة صفحات HTML الجاهزة → لا مخرجات → 404. ensureStaticDeploy يحقن
// vercel.json يثبّت الخدمة الثابتة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureStaticDeploy, cleanDeployUrl } from '../agents/deployAgent.js';

const f = (name, content = 'x') => ({ file: name, data: Buffer.from(content).toString('base64'), encoding: 'base64' });
const cfgOf = (files) => {
    const v = files.find(x => x.file === 'vercel.json');
    return v ? JSON.parse(Buffer.from(v.data, 'base64').toString()) : null;
};

test('index.html بالجذر → يُحقن vercel.json ثابت بلا route (يُخدم index تلقائياً)', () => {
    const out = ensureStaticDeploy([f('index.html'), f('styles.css'), f('package.json')]);
    const cfg = cfgOf(out);
    assert.ok(cfg, 'vercel.json محقون');
    assert.deepEqual(cfg.builds, [{ src: '**/*', use: '@vercel/static' }]);
    assert.equal(cfg.routes, undefined, 'index.html لا يحتاج توجيهاً');
});

test('لا index.html لكن صفحة HTML أخرى بالجذر → route يوجّه "/" إليها', () => {
    const out = ensureStaticDeploy([f('home.html'), f('app.js')]);
    const cfg = cfgOf(out);
    assert.deepEqual(cfg.routes, [{ src: '/', dest: '/home.html' }]);
});

test('لا HTML في الجذر إطلاقاً → خطأ واضح قبل الرفع', () => {
    assert.throws(() => ensureStaticDeploy([f('app.js'), f('lib/content.js')]), /HTML في جذر/);
});

test('مشروع فيه vercel.json مسبقاً → يُحترم ولا يُستبدل', () => {
    const existing = f('vercel.json', '{"rewrites":[]}');
    const out = ensureStaticDeploy([f('index.html'), existing]);
    assert.equal(out.filter(x => x.file === 'vercel.json').length, 1, 'لا ازدواج');
    assert.equal(cfgOf(out).rewrites?.length, 0, 'إعداد المستخدم محفوظ');
});

test('index.html في مجلد فرعي فقط لا يُحتسب جذراً', () => {
    // pages/index.html ليست جذراً → لا index بالجذر، لكن يوجد HTML جذر آخر؟ لا
    assert.throws(() => ensureStaticDeploy([f('pages/index.html'), f('style.css')]), /HTML في جذر/);
});

// ─── الرابط النظيف: لا رابط نشرة مُجزّأ طويل بعد الآن ───────────────
test('رابط النشرة المُجزّأ في الرد يُتجاهل لصالح نطاق المشروع الحتمي', () => {
    const result = { url: 'jamal-new16jul-ggihmlmx6-jazaki-s-projects.vercel.app', alias: [] };
    assert.equal(cleanDeployUrl(result, 'jamal-new16jul'), 'jamal-new16jul.vercel.app');
});

test('alias إنتاج نظيف في الرد يُفضَّل كما هو', () => {
    const result = { url: 'x-abcd1234ef-team.vercel.app', alias: ['jamal-shop.vercel.app', 'x-abcd1234ef-team.vercel.app'] };
    assert.equal(cleanDeployUrl(result, 'jamal-shop'), 'jamal-shop.vercel.app');
});

test('نطاق مخصّص في alias يُفضَّل على .vercel.app', () => {
    const result = { url: 'x-hash1234ab-team.vercel.app', alias: ['mystore.com'] };
    assert.equal(cleanDeployUrl(result, 'jamal-store'), 'mystore.com');
});

test('بلا alias وبلا اسم مشروع → يعود لرابط الرد', () => {
    assert.equal(cleanDeployUrl({ url: 'fallback.vercel.app' }, ''), 'fallback.vercel.app');
});
