import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { transactionSyncClient } from '../services/transactionSyncClient.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
async function client(handler) {
    const dom = new JSDOM('<body></body>', { url: 'https://example.test', runScripts: 'dangerously' });
    let starts = 0;
    dom.window.fetch = handler;
    dom.window.start = () => starts++;
    dom.window.eval('(' + transactionSyncClient.toString() + ')("https://api.example", "public", window.start)');
    await tick();
    return { dom, w: dom.window, starts: () => starts };
}
test('sync batches related keys and serializes later actions with acknowledged revision', async () => {
    const pending = [];
    const c = await client((url, options) => {
        if (!options.body) return Promise.resolve({ ok: true, json: async () => ({ revision: 0, data: {} }) });
        return new Promise(resolve => pending.push({ body: JSON.parse(options.body), resolve }));
    });
    try {
        assert.equal(c.starts(), 1);
        c.w.localStorage.setItem('items', '[3]');
        c.w.localStorage.setItem('history', '["sale"]');
        c.w.localStorage.setItem('settings', '{"seq":2}');
        c.w.localStorage.setItem('user_session', 'local-only');
        await tick();
        assert.equal(pending.length, 1);
        assert.deepEqual(pending[0].body.changes, { items: '[3]', history: '["sale"]', settings: '{"seq":2}' });
        c.w.localStorage.removeItem('history');
        await tick();
        assert.equal(pending.length, 1);
        pending[0].resolve({ ok: true, json: async () => ({ revision: 1 }) });
        await tick();
        assert.equal(pending.length, 2);
        assert.equal(pending[1].body.revision, 1);
        assert.deepEqual(pending[1].body.changes, { history: null });
        pending[1].resolve({ ok: true, json: async () => ({ revision: 2 }) });
        await tick();
        assert.match(c.w.document.body.textContent, /حُفظت/);
    } finally { c.dom.window.close(); }
});
test('sync retries an uncertain request with identical identity and payload', async () => {
    const bodies = [];
    const c = await client(async (url, options) => {
        if (!options.body) return { ok: true, json: async () => ({ revision: 0, data: {} }) };
        bodies.push(options.body);
        if (bodies.length === 1) throw Error('response lost after server commit');
        return { ok: true, json: async () => ({ revision: 1, replayed: true }) };
    });
    try { c.w.localStorage.setItem('items', 'new'); await tick(); assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1]); }
    finally { c.dom.window.close(); }
});
test('conflict freezes subsequent writes rather than overwriting another session', async () => {
    let writes = 0;
    const c = await client(async (url, options) => {
        if (!options.body) return { ok: true, json: async () => ({ revision: 0, data: {} }) };
        writes++; return { ok: false, status: 409 };
    });
    try {
        c.w.localStorage.setItem('items', 'new'); await tick();
        assert.equal(writes, 1);
        assert.throws(() => c.w.localStorage.setItem('items', 'overwrite'));
        assert.match(c.w.document.querySelector('[role="alert"]').textContent, /جلسة أخرى/);
    } finally { c.dom.window.close(); }
});
test('failed hydration never starts the application', async () => {
    const c = await client(async () => ({ ok: false, status: 503 }));
    try { assert.equal(c.starts(), 0); assert.ok(c.w.document.querySelector('[role="alert"]')); }
    finally { c.dom.window.close(); }
});

test('flush remains pending until acknowledgement and rejects on conflict', async () => {
    let answer;
    const c = await client(async (url, options) => {
        if (!options.body) return { ok: true, json: async () => ({ revision: 0, data: {} }) };
        return new Promise(resolve => { answer = resolve; });
    });
    try {
        c.w.localStorage.setItem('items', 'new');
        let settled = false;
        const flushed = c.w.JAOLA_SYNC.flush();
        const rejected = assert.rejects(flushed);
        flushed.then(() => { settled = true; }, () => { settled = true; });
        await tick(); assert.equal(settled, false);
        answer({ ok: false, status: 409 }); await rejected;
        await assert.rejects(c.w.JAOLA_SYNC.flush());
    } finally { c.dom.window.close(); }
});
