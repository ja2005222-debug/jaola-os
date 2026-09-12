import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { projectMembers } from '../services/projectMembers.js';
import { projectTransactions } from '../services/projectTransactions.js';
import { projectSessionGuard, issueProjectSession, credentialVersion } from '../services/projectSessions.js';
import { setPassword } from '../services/projectAuth.js';
import { registerProjectMemberRoutes } from '../services/projectMemberRoutes.js';
import { resolveCloneRole, cloneRoleOptions } from '../services/cloneRoles.js';

function memoryCollection() {
    const docs = new Map();
    return {
        async findOne({ _id }) { return structuredClone(docs.get(_id) || null); },
        async insertOne(doc) { docs.set(doc._id, structuredClone(doc)); },
        async updateOne(query, update, options = {}) {
            const doc = docs.get(query._id);
            if ((!doc && !options.upsert) || (query.revision !== undefined && doc?.revision !== query.revision)) return { modifiedCount: 0 };
            docs.set(query._id, { _id: query._id, ...doc, ...structuredClone(update.$set) }); return { modifiedCount: 1 };
        },
        find(query) { return { limit() { return { async toArray() { return [...docs.values()].filter(row => row.user === query.user && row.project === query.project); } }; } }; },
    };
}
test('HTTP team lifecycle: owner provisions, employee is isolated, forged grants denied, relogin and revocation', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-team-http-'));
    const secret = randomUUID();
    await setPassword(dir, 'owner', 'hr', randomUUID(), undefined, { ownerReset: true });
    const members = projectMembers(memoryCollection(), { secret, ownerVersion: (u, p) => credentialVersion(dir, u, p), projectInstance: async () => 'hr-instance', resolvePolicy: resolveCloneRole });
    const transactions = projectTransactions(memoryCollection(), { importLegacy: async () => ({
        jhr_employees: JSON.stringify([{ id: 'e1', name: 'أحمد', salary: 1000 }, { id: 'e2', name: 'سارة', salary: 2000 }]),
        jhr_leaves: '[]', jhr_attendance: '[]', jhr_payslips: '[]', jhr_settings: '{}',
    }) });
    const verifyProjectToken = token => token === 'public' ? { u: 'owner', p: 'hr' } : token === 'other' ? { u: 'other', p: 'hr' } : null;
    const guard = projectSessionGuard({ dir, secret, verifyProjectToken, resolveMemberSession: (token, u, p) => members.resolveSession(token, u, p, 'jaola-hr') });
    const app = express(); app.use(express.json());
    registerProjectMemberRoutes(app, { adminGuard: guard, limit: (q, s, next) => next(), verifyProjectToken,
        cloneId: () => 'jaola-hr', store: () => members, roles: cloneRoleOptions,
        bindings: async () => [{ id: 'e1', name: 'أحمد' }, { id: 'e2', name: 'سارة' }] });
    app.get('/api/public/data', guard, async (req, res) => {
        const { user, project, access } = req.projectSession;
        res.json(await transactions.snapshot(user, project, access));
    });
    app.post('/api/public/data/transaction', guard, async (req, res) => {
        try { const { user, project, access } = req.projectSession; res.json(await transactions.commit(user, project, req.body, access)); }
        catch (error) { res.status(error.status || 500).json({ error: error.code }); }
    });
    app.get('/api/public/assets/private', guard, (req, res) => res.json({ secret: true }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const request = (route, bearer, body, method = body ? 'POST' : 'GET', token = 'public') => fetch(base + route + '?token=' + token, {
        method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) },
        ...(body ? { body: JSON.stringify({ ...body, token }) } : {}),
    });
    try {
        const admin = issueProjectSession(dir, 'owner', 'hr', secret);
        const password = randomUUID();
        const input = { account: 'ahmed', password, role: 'employee', recordId: 'e1' };
        assert.equal((await request('/api/public/team', null, input)).status, 401);
        assert.equal((await request('/api/public/team', admin, { ...input, recordId: 'missing' })).status, 400);
        assert.equal((await request('/api/public/team', admin, input)).status, 200);
        const login = await (await request('/api/public/auth/member-login', null, { ...input, role: 'manager' })).json();
        assert.equal(login.uiRole, 'employee');
        const employee = login.session;
        const snapshot = await (await request('/api/public/data', employee)).json();
        assert.deepEqual(JSON.parse(snapshot.data.jhr_employees).map(row => row.id), ['e1']);
        const leave = { id: randomUUID(), eid: 'e1', from: '2030-01-01', to: '2030-01-02', reason: 'تجربة', status: 'pending' };
        const transaction = { id: randomUUID(), revision: snapshot.revision, changes: { jhr_leaves: JSON.stringify([leave]) } };
        assert.equal((await request('/api/public/data/transaction', employee, transaction)).status, 200);
        const forged = { ...transaction, id: randomUUID(), revision: 1, changes: { jhr_leaves: JSON.stringify([{ ...leave, status: 'approved' }]) } };
        assert.equal((await request('/api/public/data/transaction', employee, forged)).status, 403);
        assert.equal((await request('/api/public/team', employee, { ...input, role: 'manager' })).status, 403);
        assert.equal((await request('/api/public/assets/private', employee)).status, 403);
        assert.equal((await request('/api/public/data', employee, undefined, 'GET', 'other')).status, 401);
        const relogin = await (await request('/api/public/auth/member-login', null, input)).json();
        const restored = await (await request('/api/public/data', relogin.session)).json();
        assert.equal(JSON.parse(restored.data.jhr_leaves)[0].id, leave.id);
        assert.equal((await request('/api/public/team/ahmed', admin, undefined, 'DELETE')).status, 200);
        assert.equal((await request('/api/public/data', relogin.session)).status, 401);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
});
