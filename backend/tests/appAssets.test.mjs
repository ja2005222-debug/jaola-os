// 🖼️ صور حقيقية من مالك القالب (jaola-assets): حفظ/قراءة بمعرّف slot
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveAsset, readAsset } from '../services/appAssets.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'appassets-'));

// بكسل PNG شفّاف 1×1 حقيقي (أصغر صورة PNG صالحة)
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
// صورة JPEG صغيرة صالحة (1×1 أبيض)
const JPG_1PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

test('appAssets: حفظ وقراءة صورة، عزل بين المشاريع', () => {
    const dir = tmp();
    assert.equal(readAsset(dir, 'u', 'p', 'clinicPhoto'), null, 'لا صورة بعد');
    const r = saveAsset(dir, 'u', 'p', 'clinicPhoto', PNG_1PX);
    assert.ok(r.ok);
    const a = readAsset(dir, 'u', 'p', 'clinicPhoto');
    assert.ok(a && a.buf.length > 0);
    assert.equal(a.mime, 'image/png');
    assert.equal(readAsset(dir, 'u', 'other', 'clinicPhoto'), null, 'مشروع آخر معزول تماماً');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appAssets: رفع جديد لنفس slot يستبدل القديم حتى مع اختلاف الامتداد', () => {
    const dir = tmp();
    saveAsset(dir, 'u', 'p', 'clinicPhoto', PNG_1PX);
    const r2 = saveAsset(dir, 'u', 'p', 'clinicPhoto', JPG_1PX);
    assert.ok(r2.ok);
    const a = readAsset(dir, 'u', 'p', 'clinicPhoto');
    assert.equal(a.mime, 'image/jpeg', 'الصورة الجديدة استبدلت القديمة');
    // لا ملف png يتيم متبقٍ
    const files = fs.readdirSync(dir).filter(f => f.includes('clinicPhoto'));
    assert.equal(files.length, 1, 'ملف واحد فقط لهذا الـslot — لا تراكم ملفات يتيمة');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appAssets: يرفض slot غير صالح/محجوز وdata:URL فاسدة', () => {
    const dir = tmp();
    assert.ok(saveAsset(dir, 'u', 'p', '__proto__', PNG_1PX).error);
    assert.ok(saveAsset(dir, 'u', 'p', 'bad slot!', PNG_1PX).error);
    assert.ok(saveAsset(dir, 'u', 'p', 'ok', 'not-a-data-url').error);
    assert.ok(saveAsset(dir, 'u', 'p', 'ok', 'data:text/plain;base64,aGVsbG8=').error, 'نوع غير صورة مرفوض');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appAssets: يفرض سقف عدد الصور لكل مشروع', () => {
    const dir = tmp();
    for (let i = 0; i < 30; i++) assert.ok(saveAsset(dir, 'u', 'p', 'slot' + i, PNG_1PX).ok);
    assert.ok(saveAsset(dir, 'u', 'p', 'slot30', PNG_1PX).error, 'الصورة الحادية والثلاثون تتجاوز السقف');
    assert.ok(saveAsset(dir, 'u', 'p', 'slot0', JPG_1PX).ok, 'استبدال slot موجود لا يُحسب جديداً');
    fs.rmSync(dir, { recursive: true, force: true });
});

// 🗝️ العزل أعلاه («مشروع آخر معزول تماماً») كان صحيحاً للأسماء البسيطة
// فقط: المفتاح `clean(u)__clean(p)__clean(slot)` يجمع ثلاثة حقولٍ بفاصلٍ
// تحتمله الحقول نفسها، فثلاثيّتان مختلفتان تقرآن الصورة نفسها.
test('appAssets: مشروعا مستخدمَين مختلفَين لا يتشاركان صورةً واحدة', () => {
    const dir = tmp();
    assert.ok(saveAsset(dir, 'alice__bob', 'site', 'clinicPhoto', PNG_1PX).ok);
    assert.equal(readAsset(dir, 'alice', 'bob__site', 'clinicPhoto'), null,
        'صورة مشروعٍ آخر كانت تُقرأ — والرفع كان يدهسها');
    assert.ok(saveAsset(dir, 'alice', 'bob__site', 'clinicPhoto', JPG_1PX).ok);
    assert.equal(readAsset(dir, 'alice__bob', 'site', 'clinicPhoto').mime, 'image/png', 'صورته لم تُدهَس');
    assert.equal(readAsset(dir, 'alice', 'bob__site', 'clinicPhoto').mime, 'image/jpeg');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appAssets: التباسُ الشريحة كذلك — (p, a__b) ليست (p__a, b)', () => {
    const dir = tmp();
    assert.ok(saveAsset(dir, 'u', 'p', 'a__b', PNG_1PX).ok);
    assert.equal(readAsset(dir, 'u', 'p__a', 'b'), null);
    fs.rmSync(dir, { recursive: true, force: true });
});
