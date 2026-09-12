import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { issueMemberSessionToken, readMemberSessionToken } from './projectSessions.js';
import { transactionAccess } from './transactionAccess.js';

const WRITE = { writeConcern: { w: 'majority' }, maxTimeMS: 5000 };
const failure = (status, code) => Object.assign(new Error(code), { status, code });
const accountName = value => {
    if (typeof value !== 'string') throw failure(400, 'INVALID_ACCOUNT');
    const account = value.normalize('NFKC').trim().toLowerCase();
    if (!/^[\p{L}\p{N}._-]{3,64}$/u.test(account)) throw failure(400, 'INVALID_ACCOUNT');
    return account;
};
const identity = (user, project, account) => {
    if (typeof user !== 'string' || !user || typeof project !== 'string' || !project) throw failure(400, 'INVALID_PROJECT');
    return JSON.stringify([user, project, account]);
};

/** Account roles are resolved from a server-owned clone policy. Neither JWT payloads
 * nor client request bodies can provide permissions. Every request rechecks revocation. */
export function projectMembers(collection, { secret, ownerVersion, projectInstance, resolvePolicy }) {
    if (!secret || typeof ownerVersion !== 'function' || typeof projectInstance !== 'function' || typeof resolvePolicy !== 'function') throw new Error('Member service configuration required');
    const safeRecord = record => ({ account: record.account, role: record.role, recordId: record.recordId, active: record.active });
    async function save(user, project, cloneId, input) {
        const account = accountName(input?.account);
        const password = input?.password;
        if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) throw failure(400, 'INVALID_PASSWORD');
        const recordId = input.recordId == null ? '' : String(input.recordId);
        if (recordId.length > 100 || /[\u0000-\u001f]/.test(recordId)) throw failure(400, 'INVALID_RECORD_BINDING');
        const policy = resolvePolicy(cloneId, input.role, recordId);
        if (!policy) throw failure(400, 'ROLE_NOT_AVAILABLE');
        if (!await ownerVersion(user, project)) throw failure(403, 'OWNER_SETUP_REQUIRED');
        const instance = await projectInstance(user, project);
        if (typeof instance !== 'string' || !instance) throw failure(403, 'PROJECT_NOT_REGISTERED');
        const record = { user, project, account, cloneId, projectInstance: instance, role: input.role, recordId, active: true,
            hash: await bcrypt.hash(password, 10), version: randomUUID(), updatedAt: new Date() };
        await collection.updateOne({ _id: identity(user, project, account) }, { $set: record }, { ...WRITE, upsert: true });
        return safeRecord(record);
    }
    async function list(user, project) {
        const instance = await projectInstance(user, project);
        if (!instance) return [];
        const records = await collection.find({ user, project, projectInstance: instance }, { projection: { hash: 0, version: 0 }, maxTimeMS: 5000 }).limit(200).toArray();
        return records.filter(record => record.projectInstance === instance).map(safeRecord);
    }
    async function revoke(user, project, value) {
        const account = accountName(value);
        await collection.updateOne({ _id: identity(user, project, account) }, { $set: { active: false, version: randomUUID(), updatedAt: new Date() } }, WRITE);
        return { ok: true };
    }
    async function login(user, project, cloneId, input) {
        let account;
        try { account = accountName(input?.account); } catch { return null; }
        if (typeof input?.password !== 'string' || input.password.length < 12 || Buffer.byteLength(input.password) > 72) return null;
        const record = await collection.findOne({ _id: identity(user, project, account) }, { maxTimeMS: 5000 });
        if (!record?.active || record.cloneId !== cloneId || record.projectInstance !== await projectInstance(user, project)
            || !await bcrypt.compare(input.password, record.hash)) return null;
        const version = await ownerVersion(user, project);
        const policy = resolvePolicy(cloneId, record.role, record.recordId);
        if (!version || !policy) return null;
        const session = issueMemberSessionToken({ user, project, account, version: record.version, ownerVersion: version }, secret);
        return { ok: true, session, role: record.role, uiRole: policy.uiRole, ui: policy.ui || {}, account };
    }
    async function resolveSession(token, user, project, cloneId) {
        const claims = readMemberSessionToken(token, secret);
        if (!claims) return null;
        if (claims.user !== user || claims.project !== project || typeof claims.account !== 'string') return null;
        const record = await collection.findOne({ _id: identity(user, project, claims.account) }, { maxTimeMS: 5000 });
        if (!record?.active || record.cloneId !== cloneId || record.version !== claims.version
            || record.projectInstance !== await projectInstance(user, project)
            || claims.ownerVersion !== await ownerVersion(user, project)) return null;
        const policy = resolvePolicy(cloneId, record.role, record.recordId);
        if (!policy) return null;
        return { user, project, role: 'project-member', account: record.account, uiRole: policy.uiRole,
            apiFamilies: policy.apiFamilies || [],
            access: transactionAccess({ id: record._id, recordId: record.recordId }, policy.rules) };
    }
    return { save, list, revoke, login, resolveSession };
}
