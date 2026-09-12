import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { buildFullStackProject, getFullStackCategories } from '../agents/fullstackTemplates.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
divertConsoleToStderr();
const admin = 'admin-key-'.repeat(5), reader = 'reader-key-'.repeat(5);
const strip = source => source.replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
function harness(files, route, env = { JAOLA_ADMIN_TOKEN: admin, JAOLA_READER_TOKEN: reader }) {
    const calls = [];
    let failure = null;
    const model = new Proxy({}, { get: (_, method) => async args => { calls.push({ method, args }); if (failure) throw failure; return method === 'findMany' ? [] : { id: 1, published: false }; } });
    const c = vm.createContext({ adminSession: async () => false, sameOrigin: () => false, Response, TextDecoder, createHash, timingSafeEqual, process: { env }, prisma: new Proxy({}, { get: () => model }) });
    vm.runInContext(strip(files.find(f => f.name === 'lib/api.js').content), c);
    vm.runInContext(strip(files.find(f => f.name === route).content), c);
    return { c, calls, fail: error => { failure = error; } };
}
function request(method = 'GET', token, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return new Request('https://project.test/api/resource', { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
for (const category of getFullStackCategories()) {
    test(`${category}: every generated mutation rejects anonymous and read-only access before database calls`, async () => {
        const { files } = buildFullStackProject(category);
        for (const route of files.filter(f => /^app\/api\//.test(f.name) && !f.name.startsWith('app/api/admin/'))) {
            const h = harness(files, route.name);
            for (const method of ['POST', 'PUT', 'DELETE'].filter(m => typeof h.c[m] === 'function')) {
                for (const [token, status] of [[undefined, 401], [reader, 403], ['wrong', 401]]) {
                    const response = await h.c[method](request(method, token, method === 'DELETE' ? undefined : {}), { params: { id: '1' } });
                    assert.equal(response.status, status);
                    assert.equal(h.calls.length, 0);
                }
            }
        }
    });
}
test('private records require credentials; catalog remains public; credentials never enter page source', async () => {
    const { files } = buildFullStackProject('ecommerce');
    const privateRoute = harness(files, 'app/api/orders/route.js');
    assert.equal((await privateRoute.c.GET(request())).status, 401);
    assert.equal((await privateRoute.c.GET(request('GET', reader))).status, 200);
    assert.equal(privateRoute.calls.length, 1);
    const catalog = harness(files, 'app/api/products/route.js');
    assert.equal((await catalog.c.GET(request())).status, 200);
    assert.equal(catalog.calls[0].args.take, 100);
    const accounts = buildFullStackProject('saas').files;
    assert.doesNotMatch(accounts.find(f => f.name === 'app/page.js').content, /prisma|findMany|email/);
    for (const f of files.filter(f => /^app\//.test(f.name))) assert.doesNotMatch(f.content, /JAOLA_ADMIN_TOKEN|JAOLA_READER_TOKEN/);
});
test('missing server keys fail closed even for supplied credentials', async () => {
    const { files } = buildFullStackProject('ecommerce');
    const h = harness(files, 'app/api/products/route.js', {});
    assert.equal((await h.c.POST(request('POST', admin, {}))).status, 401);
    assert.equal(h.calls.length, 0);
});
test('validated create and partial update reject mass assignment, malformed types and invalid identifiers', async () => {
    const { files } = buildFullStackProject('ecommerce');
    const list = harness(files, 'app/api/products/route.js');
    const valid = { name: 'منتج', description: '', price: 2.5, image: '', category: 'عام', stock: 3 };
    for (const patch of [{ id: 8 }, { createdAt: '2026-01-01' }, { price: { increment: 100 } }, { price: -1 }, { stock: 1.5 }, { stock: '2' }, { unknown: true }]) {
        assert.equal((await list.c.POST(request('POST', admin, { ...valid, ...patch }))).status, 400);
        assert.equal(list.calls.length, 0);
    }
    assert.equal((await list.c.POST(request('POST', admin, { name: 'incomplete' }))).status, 400);
    assert.equal((await list.c.POST(request('POST', admin, valid))).status, 201);
    assert.deepEqual(JSON.parse(JSON.stringify(list.calls[0].args.data)), valid);
    const item = harness(files, 'app/api/products/[id]/route.js');
    for (const id of ['0', '-1', '1.5', 'NaN', '2147483648', '1e2']) assert.equal((await item.c.DELETE(request('DELETE', admin), { params: { id } })).status, 400);
    assert.equal(item.calls.length, 0);
    assert.equal((await item.c.PUT(request('PUT', admin, { stock: 4 }), { params: Promise.resolve({ id: '1' }) })).status, 200);
    assert.equal(item.calls[0].args.data.stock, 4);
});
test('oversized or malformed bodies and database failures have explicit safe responses', async () => {
    const { files } = buildFullStackProject('ecommerce');
    const h = harness(files, 'app/api/products/route.js');
    assert.equal((await h.c.POST(request('POST', admin, { name: 'x'.repeat(70000) }))).status, 413);
    const bad = new Request('https://project.test', { method: 'POST', headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal((await h.c.POST(bad)).status, 400);
    assert.equal(h.calls.length, 0);
    for (const [code, status] of [['P2025', 404], ['P2002', 409], ['internal-secret', 503]]) {
        h.fail(Object.assign(Error('database password is private'), { code }));
        const response = await h.c.GET(request());
        assert.equal(response.status, status);
        assert.doesNotMatch(await response.text(), /password|private|internal-secret/);
    }
});
test('unpublished blog posts stay private in list, detail and server-rendered homepage', async () => {
    const { files } = buildFullStackProject('blog');
    const list = harness(files, 'app/api/posts/route.js');
    await list.c.GET(request());
    assert.equal(list.calls[0].args.where.published, true);
    const item = harness(files, 'app/api/posts/[id]/route.js');
    assert.equal((await item.c.GET(request(), { params: { id: '1' } })).status, 404);
    assert.match(files.find(f => f.name === 'app/page.js').content, /where: \{ published: true \}/);
});

test('all resource schemas accept valid scalar creates and reject unknown fields', async () => {
    for (const category of getFullStackCategories()) {
        const { files } = buildFullStackProject(category);
        for (const file of files.filter(f => /^app\/api\/[^/]+\/route\.js$/.test(f.name))) {
            const h = harness(files, file.name);
            const fields = vm.runInContext('fields', h.c);
            const values = { String: 'valid', Int: 1, Float: 1.5, Boolean: true, DateTime: '2026-09-12T12:00:00Z' };
            const data = Object.fromEntries(fields.map(f => [f.name, values[f.type]]));
            assert.equal((await h.c.POST(request('POST', admin, { ...data, injected: { connect: { id: 2 } } }))).status, 400);
            assert.equal(h.calls.length, 0);
            assert.equal((await h.c.POST(request('POST', admin, data))).status, 201, category + '/' + file.name);
        }
    }
});

test('generated JSX and routes parse even with quotes, markup and newlines in project name', async () => {
    const { default: babel } = await import('@babel/standalone');
    for (const category of getFullStackCategories()) {
        const { files } = buildFullStackProject(category, "فريق 'جولا'\n</h1>{broken()}");
        for (const file of files.filter(f => f.name.endsWith('.js'))) {
            assert.doesNotThrow(() => babel.transform(file.content, { presets: ['react'], sourceType: 'module' }), category + '/' + file.name);
        }
    }
});

test('all private resources block reads, including patient appointments and enrollments', async () => {
    const publicPaths = new Set(['products', 'services', 'properties', 'courses', 'doctors', 'menu', 'posts']);
    for (const category of getFullStackCategories()) {
        const { files } = buildFullStackProject(category);
        for (const file of files.filter(f => /^app\/api\/[^/]+\/route\.js$/.test(f.name))) {
            const h = harness(files, file.name);
            const publicRead = publicPaths.has(file.name.split('/')[2]);
            assert.equal((await h.c.GET(request())).status, publicRead ? 200 : 401, category + '/' + file.name);
            assert.equal(h.calls.length, publicRead ? 1 : 0);
        }
    }
});

test('JSON media type and calendar dates are strict; key rotation revokes access', async () => {
    const { files } = buildFullStackProject('saas');
    const env = { JAOLA_ADMIN_TOKEN: admin };
    const h = harness(files, 'app/api/subscriptions/route.js', env);
    const badType = new Request('https://project.test', { method: 'POST', headers: { Authorization: 'Bearer ' + admin, 'Content-Type': 'application/jsonp' }, body: '{}' });
    assert.equal((await h.c.POST(badType)).status, 415);
    for (const renewsAt of ['2026-02-31T12:00:00Z', 'not-a-date', 123]) assert.equal((await h.c.POST(request('POST', admin, { plan: 'free', renewsAt }))).status, 400);
    assert.equal(h.calls.length, 0);
    env.JAOLA_ADMIN_TOKEN = 'rotated-key-'.repeat(4);
    assert.equal((await h.c.GET(request('GET', admin))).status, 401);
    assert.equal((await h.c.GET(request('GET', env.JAOLA_ADMIN_TOKEN))).status, 200);
});
