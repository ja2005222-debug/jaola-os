// Smoke test for API availability
import { test } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

test('GET /api/projects returns array', async () => {
    const res = await fetch(`${BASE_URL}/api/projects`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data));
});

test('POST /api/auth/register fails without username', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '123' })
    });
    assert.strictEqual(res.status, 400);
});

console.log('✅ Smoke tests passed');
