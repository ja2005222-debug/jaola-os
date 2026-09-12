import { promises as fs, constants } from 'node:fs';
import path from 'node:path';

const UNKNOWN = Symbol('not-static');
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

export async function readProjectDefaults(projectPath) {
    if ((await fs.lstat(projectPath)).isSymbolicLink()) throw new Error('Template root cannot be a symlink');
    const read = async name => {
        const file = await fs.open(path.join(projectPath, name), constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const buffer = Buffer.alloc(512 * 1024 + 1);
            const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
            if (bytesRead > 512 * 1024) throw new Error('Template source exceeds limit');
            return buffer.subarray(0, bytesRead).toString('utf8');
        } finally { await file.close(); }
    };
    const source = await read('app.js');
    const html = await read('index.html');
    const language = /<html\b[^>]*\blang=["']en["']/i.test(html) ? 'en' : 'ar';
    return templateDefaults(source, { language });
}

/** Read literal template defaults from syntax only. No script, function call, getter,
 * import or interpolated expression from a customer's app is executed. */
export async function templateDefaults(source, { now = Date.now(), language = 'ar' } = {}) {
    if (typeof source !== 'string' || Buffer.byteLength(source) > 512 * 1024) return { ready: false, data: {} };
    const imported = await import('@babel/standalone');
    const babel = imported.default || imported;
    let ast;
    try { ast = babel.packages.parser.parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] }); }
    catch { return { ready: false, data: {} }; }
    const variables = new Map();
    // Only the exact built-in date helper shipped by the templates is recognized.
    const future = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id?.name === 'futureDate');
    const helperSource = future ? source.slice(future.start, future.end).replace(/\s+/g, '') : '';
    const staticFuture = helperSource === 'functionfutureDate(days){vard=newDate();d.setDate(d.getDate()+days);returnd.toISOString().slice(0,10);}';
    function literal(node, depth = 0) {
        if (!node || depth > 32) return UNKNOWN;
        if (['StringLiteral', 'BooleanLiteral', 'NumericLiteral'].includes(node.type)) return node.value;
        if (node.type === 'NullLiteral') return null;
        if (node.type === 'Identifier') return variables.has(node.name) ? variables.get(node.name) : UNKNOWN;
        if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
        if (node.type === 'BinaryExpression') {
            const left = literal(node.left, depth + 1), right = literal(node.right, depth + 1);
            if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
            if (node.operator === '===') return left === right;
            if (typeof left !== 'number' || typeof right !== 'number') return UNKNOWN;
            const value = node.operator === '+' ? left + right : node.operator === '-' ? left - right : node.operator === '*' ? left * right : UNKNOWN;
            return typeof value === 'number' && Number.isFinite(value) ? value : UNKNOWN;
        }
        if (node.type === 'ConditionalExpression') {
            const condition = literal(node.test, depth + 1);
            return typeof condition === 'boolean' ? literal(condition ? node.consequent : node.alternate, depth + 1) : UNKNOWN;
        }
        if (node.type === 'NewExpression' && node.callee?.name === 'Date' && node.arguments.length <= 1) {
            const value = node.arguments.length ? literal(node.arguments[0], depth + 1) : now;
            if (!['number', 'string'].includes(typeof value)) return UNKNOWN;
            const result = new Date(value);
            return Number.isFinite(result.getTime()) ? result : UNKNOWN;
        }
        if (node.type === 'CallExpression') {
            if (staticFuture && node.callee?.name === 'futureDate' && node.arguments.length === 1) {
                const days = literal(node.arguments[0], depth + 1);
                if (!Number.isSafeInteger(days) || Math.abs(days) > 36500) return UNKNOWN;
                const result = new Date(now); result.setUTCDate(result.getUTCDate() + days);
                return result.toISOString().slice(0, 10);
            }
            const callee = node.callee;
            if (callee?.type !== 'MemberExpression' || callee.computed) return UNKNOWN;
            if (callee.object?.name === 'Date' && callee.property?.name === 'now' && !node.arguments.length) return now;
            if (callee.property?.name === 'getAttribute' && callee.object?.type === 'MemberExpression'
                && callee.object.object?.name === 'document' && callee.object.property?.name === 'documentElement'
                && node.arguments.length === 1 && node.arguments[0].value === 'lang') return language;
            const value = literal(callee.object, depth + 1);
            if (value instanceof Date && callee.property?.name === 'toISOString' && !node.arguments.length) return value.toISOString();
            if (typeof value === 'string' && callee.property?.name === 'slice' && node.arguments.length <= 2) {
                const args = node.arguments.map(argument => literal(argument, depth + 1));
                return args.every(Number.isSafeInteger) ? value.slice(...args) : UNKNOWN;
            }
            return UNKNOWN;
        }
        if (node.type === 'UnaryExpression' && ['-', '+'].includes(node.operator)) {
            const value = literal(node.argument, depth + 1);
            return typeof value === 'number' ? (node.operator === '-' ? -value : value) : UNKNOWN;
        }
        if (node.type === 'ArrayExpression') {
            const values = node.elements.map(item => literal(item, depth + 1));
            return values.includes(UNKNOWN) ? UNKNOWN : values;
        }
        if (node.type === 'ObjectExpression') {
            const value = {};
            for (const property of node.properties) {
                if (property.type !== 'ObjectProperty' || property.computed || property.method) return UNKNOWN;
                const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
                if (typeof key !== 'string' || RESERVED.has(key)) return UNKNOWN;
                const item = literal(property.value, depth + 1);
                if (item === UNKNOWN) return UNKNOWN;
                value[key] = item;
            }
            return value;
        }
        return UNKNOWN;
    }
    for (const statement of ast.program.body) {
        if (statement.type !== 'VariableDeclaration') continue;
        for (const declaration of statement.declarations) {
            if (declaration.id.type === 'Identifier') {
                const value = literal(declaration.init);
                if (value !== UNKNOWN) variables.set(declaration.id.name, value);
            }
        }
    }
    const prefixes = new Set(), defaults = new Map();
    let nodes = 0;
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (++nodes > 100000) throw new Error('Syntax limit');
        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression'
            && node.callee.object?.name === 'localStorage' && node.callee.property?.name === 'getItem') {
            const argument = node.arguments[0];
            if (argument?.type === 'BinaryExpression' && argument.operator === '+' && argument.left.type === 'StringLiteral'
                && /^[a-z][a-z0-9_]*_$/.test(argument.left.value)) prefixes.add(argument.left.value);
        }
        if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'load'
            && node.arguments[0]?.type === 'StringLiteral' && node.arguments.length >= 2) {
            const key = node.arguments[0].value;
            if (/^[a-z][a-z0-9_-]{0,60}$/i.test(key) && key !== 'session') {
                const value = literal(node.arguments[1]);
                if (!defaults.has(key) || value !== UNKNOWN) defaults.set(key, value);
            }
        }
        for (const [key, value] of Object.entries(node)) {
            if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
            if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
        }
    };
    try { visit(ast.program); } catch { return { ready: false, data: {} }; }
    if (prefixes.size !== 1 || !defaults.size || defaults.size > 60 || [...defaults.values()].includes(UNKNOWN)) {
        return { ready: false, data: {}, unresolved: [...defaults].filter(([, value]) => value === UNKNOWN).map(([key]) => key) };
    }
    const prefix = [...prefixes][0];
    const data = Object.fromEntries([...defaults].map(([key, value]) => [prefix + key, JSON.stringify(value)]));
    return { ready: true, data };
}
