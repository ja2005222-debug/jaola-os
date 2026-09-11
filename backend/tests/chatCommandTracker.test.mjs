import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatCommandTracker } from '../core/runtime/ChatCommandTracker.js';

test('معرّف الرسالة يجعل إعادة الطلب idempotent داخل المشروع نفسه', () => {
    let now = 100;
    const tracker = new ChatCommandTracker({ now: () => now });
    const first = tracker.begin({ username: 'u1', project: 'p1', messageId: 'm1' });
    tracker.transition(first, 'processing');
    const duplicate = tracker.begin({ username: 'u1', project: 'p1', messageId: 'm1' });
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.status, 'processing');
});

test('المعرّف نفسه لا يخلط حسابين أو مشروعين', () => {
    const tracker = new ChatCommandTracker();
    assert.equal(tracker.begin({ username: 'u1', project: 'p1', messageId: 'same' }).duplicate, false);
    assert.equal(tracker.begin({ username: 'u2', project: 'p1', messageId: 'same' }).duplicate, false);
    assert.equal(tracker.begin({ username: 'u1', project: 'p2', messageId: 'same' }).duplicate, false);
});

test('الحالة النهائية لا تتراجع إلى حالة أقدم', () => {
    const tracker = new ChatCommandTracker();
    const command = tracker.begin({ username: 'u', project: 'p', messageId: 'm' });
    tracker.transition(command, 'failed', { error: 'boom' });
    const after = tracker.transition(command, 'processing');
    assert.equal(after.status, 'failed');
    assert.equal(after.error, 'boom');
});

test('السجل محدود ويحذف المنتهي زمنيًا', () => {
    let now = 0;
    const tracker = new ChatCommandTracker({ ttlMs: 10, maxEntries: 2, now: () => now });
    tracker.begin({ username: 'u', project: 'p', messageId: 'old' });
    now = 20;
    tracker.begin({ username: 'u', project: 'p', messageId: 'new' });
    assert.equal(tracker.begin({ username: 'u', project: 'p', messageId: 'old' }).duplicate, false);
});
