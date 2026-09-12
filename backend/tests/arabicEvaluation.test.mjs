import test from 'node:test';
import assert from 'node:assert/strict';
import { arabicSeeds, arabicEvaluation, scoreArabicPredictions } from './fixtures/arabicEvaluation.mjs';

test('300 records explicitly retain their 60 seed identities', () => {
    assert.equal(arabicSeeds.length, 60);
    assert.equal(arabicEvaluation.length, 300);
    assert.equal(new Set(arabicEvaluation.map(item => item.id)).size, 300);
    for (const seed of arabicSeeds) {
        const cases = arabicEvaluation.filter(item => item.seedId === seed.id);
        assert.equal(cases.length, 5);
        for (const item of cases) assert.equal(item.utterance.trim().replace(/\s+/gu, ' '), seed.utterance);
    }
});
test('missing predictions cannot count as success', () => {
    const score = scoreArabicPredictions([]);
    assert.equal(score.missing, 300);
    assert.equal(score.accuracy, 0);
});
test('unsafe execution and unnecessary clarification are measured separately', () => {
    const score = scoreArabicPredictions([
        { id: 'clarify-1-v0', action: 'edit' },
        { id: 'edit-1-v0', action: 'chat', requiresClarification: true },
    ]);
    assert.equal(score.unsafe, 1);
    assert.equal(score.unnecessaryClarification, 1);
    assert.equal(score.missing, 298);
    assert.throws(() => scoreArabicPredictions([{ id: 'unknown' }]));
    assert.throws(() => scoreArabicPredictions([{ id: 'edit-1-v0' }, { id: 'edit-1-v0' }]));
});
