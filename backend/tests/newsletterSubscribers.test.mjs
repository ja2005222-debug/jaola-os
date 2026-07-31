// 📧 مشتركو نشرة الموقع — تخزين ملفّي منقّى، بلا تكرار، معزول لكل مشروع
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isValidEmail, subscribe, listSubscribers, unsubscribe } from '../services/newsletterSubscribers.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-'));

test('isValidEmail: يميّز البريد الصالح من غير الصالح', () => {
    assert.ok(isValidEmail('a@b.com'));
    assert.ok(!isValidEmail('bad'));
    assert.ok(!isValidEmail('a@b'));
    assert.ok(!isValidEmail(''));
});

test('subscribe: يضيف مشتركاً، يرفض البريد غير الصالح، ويرفض التكرار (already)', () => {
    const dir = tmp();
    const r1 = subscribe(dir, 'user', 'shop', 'A@Example.com');
    assert.ok(r1.ok && !r1.already);
    const list = listSubscribers(dir, 'user', 'shop');
    assert.equal(list.length, 1);
    assert.equal(list[0].email, 'a@example.com', 'يُطبَّع لحروف صغيرة');

    const r2 = subscribe(dir, 'user', 'shop', 'a@example.com');
    assert.ok(r2.ok && r2.already, 'نفس البريد → already بلا تكرار');
    assert.equal(listSubscribers(dir, 'user', 'shop').length, 1);

    const bad = subscribe(dir, 'user', 'shop', 'ليس-بريداً');
    assert.ok(bad.error);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('العزل بين المشاريع: مشتركو مشروع لا يظهرون في آخر', () => {
    const dir = tmp();
    subscribe(dir, 'user', 'shop-a', 'x@y.com');
    assert.equal(listSubscribers(dir, 'user', 'shop-b').length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('unsubscribe: يحذف مشتركاً موجوداً ويتجاهل غير الموجود بأمان', () => {
    const dir = tmp();
    subscribe(dir, 'user', 'shop', 'x@y.com');
    const r = unsubscribe(dir, 'user', 'shop', 'x@y.com');
    assert.ok(r.ok && r.removed);
    assert.equal(listSubscribers(dir, 'user', 'shop').length, 0);
    const r2 = unsubscribe(dir, 'user', 'shop', 'not-there@y.com');
    assert.ok(r2.ok && !r2.removed);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('listSubscribers: الأحدث أولاً', () => {
    const dir = tmp();
    subscribe(dir, 'user', 'shop', 'first@y.com');
    subscribe(dir, 'user', 'shop', 'second@y.com');
    const list = listSubscribers(dir, 'user', 'shop');
    assert.equal(list[0].email, 'second@y.com');
    assert.equal(list[1].email, 'first@y.com');
    fs.rmSync(dir, { recursive: true, force: true });
});
