// 🧭 ExecutionContext: بيئة المهمة في كائن واحد مجمَّد — الحقول الستة نفسها
// التي كانت تُمرَّر موضعياً في jcr.js، والبناء من MissionRequest يعطي المطابق.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionContext, contextFromRequest, withAgents } from '../core/runtime/ExecutionContext.js';

const FULL = {
    username: 'sara', activeProject: 'shop', projectPath: '/w/sara/shop',
    roomName: 'sara-shop', agents: { qaVerify: () => ({}) }, dbStatus: true,
};

test('الحقول الستة بالضبط، مجمَّدة، ولا هدف/تعليمة داخل السياق', () => {
    const ctx = createExecutionContext(FULL);
    assert.deepEqual(Object.keys(ctx).sort(),
        ['activeProject', 'agents', 'dbStatus', 'projectPath', 'roomName', 'username']);
    assert.ok(Object.isFrozen(ctx));
    assert.equal(ctx.goal, undefined, 'الهدف عملٌ لا بيئة — يبقى معاملاً صريحاً');
    assert.throws(() => { 'use strict'; ctx.username = 'x'; }, TypeError);
});

test('القيم المحايدة: بلا وكلاء = {} وبلا حالة قاعدة = null (نفس تسامح المسار الحالي)', () => {
    const bare = createExecutionContext({ username: 'u', activeProject: 'p', projectPath: '/p', roomName: 'u-p' });
    assert.deepEqual(bare.agents, {});
    assert.equal(bare.dbStatus, null);
    assert.equal(createExecutionContext({ ...FULL, agents: null }).agents !== null, true);
    assert.equal(createExecutionContext({ ...FULL, dbStatus: undefined }).dbStatus, null);
    assert.equal(createExecutionContext({ ...FULL, dbStatus: false }).dbStatus, false, 'false حالةٌ لا غياب');
    assert.deepEqual(Object.keys(createExecutionContext()).length, 6, 'بلا وسائط لا يرمي');
});

test('contextFromRequest يطابق البناء اليدوي من نفس MissionRequest', () => {
    const req = {
        message: 'ابنِ متجراً', normalizedMessage: 'ابن متجرا', meaningIntent: null, userLang: 'ar',
        username: FULL.username, activeProject: FULL.activeProject,
        projectPath: FULL.projectPath, roomName: FULL.roomName, dbStatus: FULL.dbStatus,
    };
    assert.deepEqual(contextFromRequest(req, FULL.agents), createExecutionContext(FULL));
    assert.equal(contextFromRequest(req, FULL.agents).message, undefined, 'الرسالة لا تتسرّب للبيئة');
});

test('withAgents ينسخ ببيئة جديدة ولا يمسّ الأصل (مسار التراجع بلا وكلاء)', () => {
    const ctx = createExecutionContext(FULL);
    const bare = withAgents(ctx, {});
    assert.deepEqual(bare.agents, {});
    assert.equal(bare.projectPath, ctx.projectPath);
    assert.equal(ctx.agents.qaVerify !== undefined, true, 'الأصل سليم');
    assert.ok(Object.isFrozen(bare));
});
