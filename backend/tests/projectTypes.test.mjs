import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_TYPES, resolveProjectType, explicitProjectType } from '../core/contracts/projectTypes.js';

test('only direct type requests count; negation and incidental mentions remain ambiguous', () => {
    assert.equal(explicitProjectType('ابن لي موقع ويب للمطعم'), 'site');
    assert.equal(explicitProjectType('build an internal system for staff'), 'system');
    assert.equal(explicitProjectType('لا اريد موقع بل أداة'), undefined);
    assert.equal(explicitProjectType('أداة لمراجعة موقع المنافس'), undefined);
});

test('missing intent blocks execution, even with the default Site tab', () => {
    const result = resolveProjectType({ uiDefault: 'site' });
    assert.equal(result.status, 'AWAITING_USER_DECISION');
    assert.equal(result.needsClarification, true);
    assert.equal(result.type, undefined);
});
test('explicit choice resolves the project type', () => {
    assert.equal(resolveProjectType({ explicitType: 'system' }).type, 'system');
});
test('only confirmed memory can resolve a follow-up request', () => {
    assert.equal(resolveProjectType({ confirmedDecision: { type: 'system', source: 'inferred' } }).needsClarification, true);
    assert.equal(resolveProjectType({ confirmedDecision: { type: 'system', source: 'user-confirmed' } }).type, 'system');
});
test('changing a confirmed type requires confirmation', () => {
    const result = resolveProjectType({ explicitType: 'site', confirmedDecision: { type: 'system', source: 'user-confirmed' } });
    assert.equal(result.reason, 'project_type_change');
    assert.equal(result.needsClarification, true);
});
test('unknown type fails closed', () => {
    assert.equal(resolveProjectType({ explicitType: 'unknown' }).needsClarification, true);
});
test('future project types work through the registry', () => {
    const registry = [...PROJECT_TYPES, { id: 'mobile', label: 'تطبيق موبايل' }];
    assert.equal(resolveProjectType({ explicitType: 'mobile' }, registry).type, 'mobile');
    assert.equal(resolveProjectType({}, registry).options.length, 3);
});
test('duplicate registry IDs are rejected', () => {
    assert.throws(() => resolveProjectType({}, [...PROJECT_TYPES, PROJECT_TYPES[0]]), TypeError);
});
