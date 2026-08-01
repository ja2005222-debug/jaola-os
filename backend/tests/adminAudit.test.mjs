// 🧾 سجلّ تدقيق الأدمِن: حلقة محدودة، الأحدث أولاً، لا يرمي أبداً
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordAdminAction, recentAdminActions, resetAdminAudit } from '../services/adminAudit.js';

test('adminAudit: يسجّل ويعيد الأحدث أولاً', () => {
    resetAdminAudit();
    recordAdminAction({ admin: 'root', action: 'setUserPlan', target: 'ali', details: '→ pro' });
    recordAdminAction({ admin: 'root', action: 'deleteFile', target: 'ali/shop/app.js' });
    const recent = recentAdminActions(10);
    assert.equal(recent.length, 2);
    assert.equal(recent[0].action, 'deleteFile', 'الأحدث أولاً');
    assert.equal(recent[1].action, 'setUserPlan');
    resetAdminAudit();
});

test('adminAudit: يفرض سقف عدد الأفعال المحفوظة', () => {
    resetAdminAudit();
    for (let i = 0; i < 510; i++) recordAdminAction({ admin: 'root', action: 'a' + i });
    assert.equal(recentAdminActions(1000).length, 500, 'سقف 500 فعل');
    assert.equal(recentAdminActions(1000)[0].action, 'a509', 'الأحدث محفوظ لا يُهمَل');
    resetAdminAudit();
});

test('adminAudit: يقصّ الحقول الطويلة ولا يرمي مع مدخلات ناقصة', () => {
    resetAdminAudit();
    const e = recordAdminAction({ admin: 'root', action: 'x'.repeat(200), details: 'y'.repeat(1000) });
    assert.ok(e.action.length <= 60);
    assert.ok(e.details.length <= 500);
    assert.doesNotThrow(() => recordAdminAction({}));
    assert.equal(recentAdminActions(10).length, 2);
    resetAdminAudit();
});
