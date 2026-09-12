import { isDeepStrictEqual } from 'node:util';

const denied = () => Object.assign(new Error('ACCESS_DENIED'), { status: 403, code: 'ACCESS_DENIED' });
const parse = value => {
    try { return JSON.parse(value); } catch { throw denied(); }
};
const owns = (record, rule, actor) => record && typeof record === 'object' && !Array.isArray(record)
    && record[rule.ownerField] === actor.recordId;
const visible = (value, rule, actor) => {
    if (rule.scope !== 'own' && !rule.readFields) return value;
    let source = parse(value);
    if (rule.scope === 'own') {
        if (!Array.isArray(source) || !actor.recordId) throw denied();
        source = source.filter(row => owns(row, rule, actor));
    }
    if (rule.readFields) {
        const project = row => Object.fromEntries(Object.entries(row).filter(([key]) => rule.readFields.includes(key)));
        if (Array.isArray(source)) return JSON.stringify(source.map(project));
        if (source && typeof source === 'object') return JSON.stringify(project(source));
        throw denied();
    }
    return JSON.stringify(source);
};

/** Policy is resolved by the server from the authenticated account, never the request body.
 * Own-record writes merge into the full project snapshot without deleting hidden records. */
export function transactionAccess(actor, rules) {
    if (!actor?.id || !rules || typeof rules !== 'object') throw denied();
    function snapshot(data) {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            const rule = rules[key];
            if (rule?.read) result[key] = visible(value, rule, actor);
        }
        return result;
    }
    function changes(data, requested) {
        const result = {};
        for (const [key, value] of Object.entries(requested)) {
            const rule = rules[key];
            if (!rule?.write || !rule.read || value === null) throw denied();
            if (rule.readFields) throw denied();
            if (rule.scope === 'collection') {
                const before = parse(data[key] || '[]');
                const after = parse(value);
                if (!Array.isArray(before) || !Array.isArray(after)) throw denied();
                const ids = new Set();
                for (const row of after) {
                    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw denied();
                    ids.add(row.id);
                    const previous = before.find(item => item.id === row.id);
                    if (!previous && !rule.create) throw denied();
                    if (previous && rule.fields) {
                        for (const field of new Set([...Object.keys(previous), ...Object.keys(row)])) {
                            if (!rule.fields.includes(field) && !isDeepStrictEqual(previous[field], row[field])) throw denied();
                        }
                    }
                    rule.validate?.(row, previous, actor);
                }
                if (!rule.delete && before.some(row => !ids.has(row.id))) throw denied();
                result[key] = value;
                continue;
            }
            if (rule.scope !== 'own') {
                if (rule.fields) {
                    const before = parse(data[key] || '{}');
                    const after = parse(value);
                    if (!before || !after || Array.isArray(before) || Array.isArray(after)
                        || typeof before !== 'object' || typeof after !== 'object') throw denied();
                    for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
                        if (!rule.fields.includes(field) && !isDeepStrictEqual(before[field], after[field])) throw denied();
                    }
                }
                rule.validate?.(parse(value), parse(data[key] || 'null'), actor);
                result[key] = value;
                continue;
            }
            if (!actor.recordId || !rule.ownerField) throw denied();
            const before = parse(data[key] || '[]');
            const after = parse(value);
            if (!Array.isArray(before) || !Array.isArray(after)) throw denied();
            const ids = new Set();
            for (const row of after) {
                if (!owns(row, rule, actor) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw denied();
                ids.add(row.id);
                const previous = before.find(item => item.id === row.id);
                if (previous && !owns(previous, rule, actor)) throw denied();
                if (!previous && !rule.create) throw denied();
                if (rule.fields && previous) {
                    for (const field of new Set([...Object.keys(previous), ...Object.keys(row)])) {
                        if (!rule.fields.includes(field) && !isDeepStrictEqual(previous[field], row[field])) throw denied();
                    }
                }
                rule.validate?.(row, previous, actor);
            }
            if (!rule.delete && before.some(row => owns(row, rule, actor) && !ids.has(row.id))) throw denied();
            result[key] = JSON.stringify([...before.filter(row => !owns(row, rule, actor)), ...after]);
        }
        return result;
    }
    return { snapshot, changes, actorId: actor.id };
}
