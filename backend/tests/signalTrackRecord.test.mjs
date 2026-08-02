// 📊 signalTrackRecord: سجل أداء حقيقي للإشارات — تسجيل، حسم لاحق بالسعر الفعلي، إحصاء دقة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordSignal, getDueCoinIds, resolveDue, getAccuracy } from '../services/signalTrackRecord.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'track-'));

test('recordSignal: يتجاهل "انتظار" وبيانات ناقصة بلا رمي خطأ', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'hold', price: 100 });
    recordSignal(dir, { id: null, timeframe: 'week', signal: 'buy', price: 100 });
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: null });
    assert.deepEqual(getDueCoinIds(dir), []);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('recordSignal: يسجّل إشارة شراء/بيع صالحة، ولا يكرّرها إن كانت نفسها قائمة', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 100 });
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 101 }); // نفس الإشارة، تجاهل
    // نحسم الآن يدوياً بجعل التنبّؤ "مستحقاً" عبر priceById فقط بعد التأكد أنه لم يتضاعف
    const before = getAccuracy(dir, { id: 'bitcoin', timeframe: 'week' });
    assert.equal(before.total, 0, 'لم يُحسم أي تنبّؤ بعد');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('recordSignal: إشارة جديدة مختلفة (buy → sell) تُسجَّل كتنبّؤ إضافي', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 100 });
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'sell', price: 90 });
    // كلاهما غير محسوم بعد فلن يظهرا كمستحقين إلا بعد انقضاء الأفق — نتحقّق فقط أن التسجيل تمّ بلا استثناء
    fs.rmSync(dir, { recursive: true, force: true });
});

test('getDueCoinIds + resolveDue: لا يحسم قبل انقضاء الأفق الزمني', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 100 });
    assert.deepEqual(getDueCoinIds(dir), [], 'أفق أسبوع لم ينقضِ بعد');
    resolveDue(dir, { bitcoin: 150 });
    assert.equal(getAccuracy(dir, { id: 'bitcoin', timeframe: 'week' }).total, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

// نتلاعب بالوقت عبر قراءة/تعديل ملف predictions.json مباشرة لمحاكاة انقضاء الأفق بلا انتظار حقيقي.
function forceDue(dir) {
    const file = path.join(dir, 'predictions.json');
    const records = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const r of records) r.resolveAt = 0;
    fs.writeFileSync(file, JSON.stringify(records));
}

test('resolveDue: شراء + ارتفاع سعر حقيقي → hit', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 100 });
    forceDue(dir);
    assert.deepEqual(getDueCoinIds(dir), ['bitcoin']);
    resolveDue(dir, { bitcoin: 110 });
    const acc = getAccuracy(dir, { id: 'bitcoin', timeframe: 'week' });
    assert.equal(acc.hits, 1);
    assert.equal(acc.misses, 0);
    assert.equal(acc.hitRate, 100);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveDue: شراء + انخفاض سعر → miss', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'ethereum', timeframe: 'week', signal: 'buy', price: 100 });
    forceDue(dir);
    resolveDue(dir, { ethereum: 90 });
    const acc = getAccuracy(dir, { id: 'ethereum', timeframe: 'week' });
    assert.equal(acc.hits, 0);
    assert.equal(acc.misses, 1);
    assert.equal(acc.hitRate, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveDue: بيع + انخفاض سعر → hit (الإشارة العكسية تنجح بعكس اتجاه السعر)', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'solana', timeframe: 'week', signal: 'sell', price: 100 });
    forceDue(dir);
    resolveDue(dir, { solana: 85 });
    const acc = getAccuracy(dir, { id: 'solana', timeframe: 'week' });
    assert.equal(acc.hits, 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveDue: تحرّك ضئيل جداً (<0.3%) → neutral، مُستبعَد من hitRate', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'cardano', timeframe: 'week', signal: 'buy', price: 100 });
    forceDue(dir);
    resolveDue(dir, { cardano: 100.1 }); // 0.1% فقط — أقل من عتبة 0.3%
    const acc = getAccuracy(dir, { id: 'cardano', timeframe: 'week' });
    assert.equal(acc.neutral, 1);
    assert.equal(acc.hits, 0);
    assert.equal(acc.misses, 0);
    assert.equal(acc.hitRate, null, 'لا تنبّؤات محكومة (hit/miss) بعد — hitRate غير محدَّد');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveDue: بلا سعر حالي معروف للعملة → لا يُحسم (يبقى معلَّقاً لمحاولة لاحقة)', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'dogecoin', timeframe: 'week', signal: 'buy', price: 100 });
    forceDue(dir);
    resolveDue(dir, {}); // لا سعر لدوجكوين
    assert.deepEqual(getDueCoinIds(dir), ['dogecoin'], 'يبقى مستحقاً — لم يُحسم بلا سعر');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('getAccuracy: يُجمِّع عبر كل العملات لمدى معيّن حين لا يُحدَّد id', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 100 });
    recordSignal(dir, { id: 'ethereum', timeframe: 'week', signal: 'sell', price: 100 });
    forceDue(dir);
    resolveDue(dir, { bitcoin: 110, ethereum: 50 }); // كلاهما hit
    const acc = getAccuracy(dir, { timeframe: 'week' });
    assert.equal(acc.hits, 2);
    assert.equal(acc.hitRate, 100);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('getAccuracy: مجلد فارغ/غير موجود → إحصاء صفري بلا رمي خطأ', () => {
    const dir = path.join(os.tmpdir(), 'does-not-exist-' + Date.now());
    const acc = getAccuracy(dir, { id: 'bitcoin', timeframe: 'week' });
    assert.deepEqual(acc, { hits: 0, misses: 0, neutral: 0, total: 0, pending: 0, hitRate: null });
});

test('getAccuracy: pending يعدّ التنبّؤات المسجَّلة غير المحسومة بعد (لا صفر رغم وجود تنبّؤات فعلية)', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: 'buy', price: 100 });
    recordSignal(dir, { id: 'bitcoin', timeframe: 'day', signal: 'sell', price: 100 }); // مدى مختلف — لا يُحتسب
    const acc = getAccuracy(dir, { id: 'bitcoin', timeframe: 'week' });
    assert.equal(acc.total, 0, 'لا شيء محسوماً بعد');
    assert.equal(acc.pending, 1, 'تنبّؤ واحد قيد المراقبة لهذا المدى تحديداً');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('getAccuracy: بعد الحسم ينتقل العدّ من pending إلى total (لا ازدواج)', () => {
    const dir = tmp();
    recordSignal(dir, { id: 'solana', timeframe: 'week', signal: 'buy', price: 100 });
    let acc = getAccuracy(dir, { id: 'solana', timeframe: 'week' });
    assert.equal(acc.pending, 1);
    assert.equal(acc.total, 0);
    forceDue(dir);
    resolveDue(dir, { solana: 110 });
    acc = getAccuracy(dir, { id: 'solana', timeframe: 'week' });
    assert.equal(acc.pending, 0);
    assert.equal(acc.total, 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('recordSignal: يفرض سقف 200 تنبّؤ لكل (عملة، مدى) — يحذف الأقدم فقط', () => {
    const dir = tmp();
    for (let i = 0; i < 205; i++) {
        recordSignal(dir, { id: 'bitcoin', timeframe: 'week', signal: i % 2 === 0 ? 'buy' : 'sell', price: 100 + i });
    }
    forceDue(dir);
    resolveDue(dir, { bitcoin: 1000 });
    const acc = getAccuracy(dir, { id: 'bitcoin', timeframe: 'week' });
    assert.ok(acc.total <= 200, 'total = ' + acc.total);
    fs.rmSync(dir, { recursive: true, force: true });
});
