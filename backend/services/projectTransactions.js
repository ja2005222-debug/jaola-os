import { createHash } from 'node:crypto';

const WRITE = { writeConcern: { w: 'majority' }, maxTimeMS: 5000 };
const KEY = /^[\w.-]{1,80}$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const error = (status, code) => Object.assign(new Error(code), { status, code });
const identity = (user, project) => {
    if (typeof user !== 'string' || !user || typeof project !== 'string' || !project) throw error(400, 'INVALID_IDENTITY');
    return JSON.stringify([user, project]);
};
function validateData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw error(400, 'INVALID_DATA');
    if (Object.keys(data).length > 60 || bytes(data) > 4 * 1024 * 1024) throw error(413, 'DATA_LIMIT');
    for (const [key, value] of Object.entries(data)) {
        if (!KEY.test(key) || RESERVED.has(key) || /_session$/.test(key)) throw error(400, 'INVALID_KEY');
        if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 512 * 1024) throw error(413, 'VALUE_LIMIT');
    }
}

/** Each project is one Mongo document. Revision-conditional updates atomically replace
 * data and the idempotency receipt. No filesystem or in-memory success fallback. */
export function projectTransactions(collection, { importLegacy = async () => ({}) } = {}) {
    async function document(user, project) {
        const _id = identity(user, project);
        let doc = await collection.findOne({ _id }, { maxTimeMS: 5000 });
        if (doc) return doc;
        const data = await importLegacy(user, project);
        // Old session flags are deliberately not imported into shared data.
        const clean = Object.fromEntries(Object.entries(data).filter(([key]) => !/_session$/.test(key)));
        validateData(clean);
        try {
            await collection.insertOne({ _id, revision: 0, data: clean, receipts: [] }, WRITE);
        } catch (failure) { if (failure.code !== 11000) throw failure; }
        return collection.findOne({ _id }, { maxTimeMS: 5000 });
    }
    async function snapshot(user, project) {
        const doc = await document(user, project);
        return { revision: doc.revision, data: doc.data };
    }
    async function commit(user, project, request) {
        const { revision, id, changes } = request || {};
        if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw error(400, 'INVALID_REVISION');
        if (typeof id !== 'string' || !/^[\w-]{16,100}$/.test(id)) throw error(400, 'INVALID_REQUEST_ID');
        if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) throw error(400, 'EMPTY_TRANSACTION');
        for (const [key, value] of Object.entries(changes)) {
            validateData({ [key]: value === null ? '' : value });
        }
        if (Object.keys(changes).length > 60 || bytes(changes) > 4 * 1024 * 1024) throw error(413, 'DATA_LIMIT');
        const hash = createHash('sha256').update(JSON.stringify([revision, Object.entries(changes).sort(([a], [b]) => a.localeCompare(b))])).digest('hex');
        const doc = await document(user, project);
        const prior = doc.receipts.find(receipt => receipt.id === id);
        if (prior) {
            if (prior.hash !== hash) throw error(409, 'REQUEST_ID_REUSED');
            return { revision: prior.revision, replayed: true };
        }
        if (doc.revision !== revision) throw error(409, 'REVISION_CONFLICT');
        const data = { ...doc.data };
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) delete data[key]; else data[key] = value;
        }
        validateData(data);
        const receipt = { id, hash, revision: revision + 1 };
        const result = await collection.updateOne({ _id: doc._id, revision }, {
            $set: { data, revision: revision + 1, receipts: [...doc.receipts.slice(-127), receipt] },
        }, WRITE);
        if (result.modifiedCount !== 1) {
            // A concurrent identical retry may have committed while this request read.
            const latest = await collection.findOne({ _id: doc._id }, { maxTimeMS: 5000 });
            const replay = latest?.receipts.find(item => item.id === id && item.hash === hash);
            if (replay) return { revision: replay.revision, replayed: true };
            throw error(409, 'REVISION_CONFLICT');
        }
        return { revision: revision + 1, replayed: false };
    }
    return { snapshot, commit };
}
