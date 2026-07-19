// 🧩 إصلاح 404 على Vercel: مشاريع فيها package.json كان Vercel يحاول بناءها
// بدل خدمة صفحات HTML الجاهزة → لا مخرجات → 404. ensureStaticDeploy يحقن
// vercel.json يثبّت الخدمة الثابتة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureStaticDeploy, ensureFullStackDeploy, isFullStackProject, ensurePackageJson, cleanDeployUrl } from '../agents/deployAgent.js';
import fs from 'node:fs';
import os from 'node:os';
import pathMod from 'node:path';

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

// ─── المرحلة ١: نشر full-stack (دوال Serverless) ───────────────────
test('كشف full-stack: دالة API حقيقية vs ملفات بيانات فقط', () => {
    const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'jaola-fs-'));
    fs.writeFileSync(pathMod.join(dir, 'index.html'), '<html></html>');
    assert.equal(isFullStackProject(dir), false, 'بلا api/');
    fs.mkdirSync(pathMod.join(dir, 'api'));
    fs.writeFileSync(pathMod.join(dir, 'api', 'db.js'), 'x');
    assert.equal(isFullStackProject(dir), false, 'ملف بيانات وحده ليس دالة');
    fs.writeFileSync(pathMod.join(dir, 'api', 'orders.js'), 'export default (req,res)=>{}');
    assert.equal(isFullStackProject(dir), true, 'دالة orders حقيقية → full-stack');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('نشر full-stack: rewrites صالحة (لا negative-lookahead) ولا @vercel/static', () => {
    const out = ensureFullStackDeploy([f('index.html'), f('api/orders.js'), f('styles.css')]);
    const cfg = cfgOf(out);
    assert.ok(cfg.rewrites, 'rewrites موجودة');
    assert.equal(cfg.builds, undefined, 'لا @vercel/static — لا يعطّل الدوال');
    // النمط السابق (?! كان يرفضه Vercel فيفشل البناء → DEPLOYMENT_NOT_FOUND
    for (const r of cfg.rewrites) assert.doesNotMatch(r.source, /\(\?\!/, 'لا negative-lookahead غير صالح');
});

test('نشر full-stack: يحترم vercel.json موجوداً (من المولّد)', () => {
    const existing = f('vercel.json', '{"rewrites":[{"source":"/x","destination":"/y"}]}');
    const out = ensureFullStackDeploy([f('index.html'), f('api/orders.js'), existing]);
    assert.equal(out.filter(x => x.file === 'vercel.json').length, 1, 'لا ازدواج');
});

test('نشر full-stack بلا index.html → خطأ واضح', () => {
    assert.throws(() => ensureFullStackDeploy([f('api/orders.js')]), /index\.html/);
});

test('ensurePackageJson: يولّد package.json بتبعية mongoose (سبب DEPLOYMENT_NOT_FOUND)', async () => {
    const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'jaola-pkg-'));
    fs.mkdirSync(pathMod.join(dir, 'api'));
    fs.writeFileSync(pathMod.join(dir, 'api', 'orders.js'), 'import mongoose from "mongoose";\nconst s = new mongoose.Schema({});\nexport default function handler(req,res){}');
    const created = await ensurePackageJson(dir, 'jamal-delv');
    assert.equal(created, true);
    const pkg = JSON.parse(fs.readFileSync(pathMod.join(dir, 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies.mongoose, 'mongoose في التبعيات');
    assert.equal(pkg.type, 'module', 'ESM لدوال export default');
    // موجود مسبقاً → يُحترم ولا يُستبدل
    assert.equal(await ensurePackageJson(dir, 'jamal-delv'), false);
    fs.rmSync(dir, { recursive: true, force: true });
});
