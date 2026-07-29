// 🗄️ مجموعات حقيقية (jaola-collections): CRUD فردي بلا استبدال الكتلة كاملة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listRecords, upsertRecord, deleteRecord } from '../services/appCollections.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'appcoll-'));

test('appCollections: إضافة سجلات، القراءة تعيدها كلها', () => {
    const dir = tmp();
    assert.deepEqual(listRecords(dir, 'u', 'p', 'owners'), []);
    assert.ok(upsertRecord(dir, 'u', 'p', 'owners', { id: 'o1', name: 'أحمد' }).ok);
    assert.ok(upsertRecord(dir, 'u', 'p', 'owners', { id: 'o2', name: 'سارة' }).ok);
    const all = listRecords(dir, 'u', 'p', 'owners');
    assert.equal(all.length, 2);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appCollections: تحديث سجل بنفس id يستبدله دون المساس بالبقية', () => {
    const dir = tmp();
    upsertRecord(dir, 'u', 'p', 'owners', { id: 'o1', name: 'أحمد' });
    upsertRecord(dir, 'u', 'p', 'owners', { id: 'o2', name: 'سارة' });
    upsertRecord(dir, 'u', 'p', 'owners', { id: 'o1', name: 'أحمد المحدَّث' });
    const all = listRecords(dir, 'u', 'p', 'owners');
    assert.equal(all.length, 2, 'لا تكرار — تحديث لا إضافة');
    assert.equal(all.find(r => r.id === 'o1').name, 'أحمد المحدَّث');
    assert.equal(all.find(r => r.id === 'o2').name, 'سارة', 'السجل الآخر لم يتأثر');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appCollections: الحذف يزيل سجلاً واحداً فقط', () => {
    const dir = tmp();
    upsertRecord(dir, 'u', 'p', 'owners', { id: 'o1', name: 'أحمد' });
    upsertRecord(dir, 'u', 'p', 'owners', { id: 'o2', name: 'سارة' });
    const r = deleteRecord(dir, 'u', 'p', 'owners', 'o1');
    assert.ok(r.ok && r.deleted);
    const all = listRecords(dir, 'u', 'p', 'owners');
    assert.equal(all.length, 1);
    assert.equal(all[0].id, 'o2');
    const r2 = deleteRecord(dir, 'u', 'p', 'owners', 'nope');
    assert.ok(r2.ok && !r2.deleted, 'حذف id غير موجود لا يرمي، ويُبلِغ deleted:false');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appCollections: الفلترة بمساواة حقل بسيط', () => {
    const dir = tmp();
    upsertRecord(dir, 'u', 'p', 'pets', { id: 'p1', ownerId: 'o1', name: 'لولو' });
    upsertRecord(dir, 'u', 'p', 'pets', { id: 'p2', ownerId: 'o2', name: 'ريكس' });
    upsertRecord(dir, 'u', 'p', 'pets', { id: 'p3', ownerId: 'o1', name: 'مشمش' });
    const forOwner1 = listRecords(dir, 'u', 'p', 'pets', { ownerId: 'o1' });
    assert.equal(forOwner1.length, 2);
    assert.deepEqual(forOwner1.map(r => r.id).sort(), ['p1', 'p3']);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appCollections: عزل تام بين المجموعات والمشاريع', () => {
    const dir = tmp();
    upsertRecord(dir, 'u', 'p1', 'owners', { id: 'x', name: 'A' });
    upsertRecord(dir, 'u', 'p2', 'owners', { id: 'x', name: 'B' });
    upsertRecord(dir, 'u', 'p1', 'pets', { id: 'x', name: 'C' });
    assert.equal(listRecords(dir, 'u', 'p1', 'owners')[0].name, 'A');
    assert.equal(listRecords(dir, 'u', 'p2', 'owners')[0].name, 'B');
    assert.equal(listRecords(dir, 'u', 'p1', 'pets')[0].name, 'C');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appCollections: يرفض معرّفات/أسماء غير صالحة ومحجوزة، وسجلات كبيرة جداً', () => {
    const dir = tmp();
    assert.ok(upsertRecord(dir, 'u', 'p', 'owners', { id: '' }).error, 'معرّف فارغ مرفوض');
    assert.ok(upsertRecord(dir, 'u', 'p', 'owners', { id: '__proto__' }).error, 'معرّف محجوز مرفوض');
    assert.ok(upsertRecord(dir, 'u', 'p', '__proto__', { id: 'ok' }).error, 'اسم مجموعة محجوز مرفوض');
    assert.ok(upsertRecord(dir, 'u', 'p', 'owners', { id: 'ok', blob: 'x'.repeat(70 * 1024) }).error, 'سجل أكبر من 64KB مرفوض');
    assert.ok(upsertRecord(dir, 'u', 'p', 'owners', [1, 2]).error, 'مصفوفة بدل كائن مرفوضة');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('appCollections: يفرض سقف عدد السجلات لكل مجموعة', () => {
    const dir = tmp();
    for (let i = 0; i < 2000; i++) assert.ok(upsertRecord(dir, 'u', 'p', 'many', { id: 'r' + i }).ok);
    assert.ok(upsertRecord(dir, 'u', 'p', 'many', { id: 'r2000' }).error, 'السجل رقم 2001 يتجاوز السقف');
    assert.ok(upsertRecord(dir, 'u', 'p', 'many', { id: 'r0', updated: true }).ok, 'تحديث سجل موجود لا يُحسب جديداً');
    fs.rmSync(dir, { recursive: true, force: true });
});
