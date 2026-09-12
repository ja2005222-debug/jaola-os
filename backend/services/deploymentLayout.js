import fs from 'node:fs';
import path from 'node:path';

/** Detect executable Next projects, including the scaffold's fullstack/ directory.
 * Never follow a project symlink into another customer's files. */
export function deploymentLayout(projectPath) {
    const base = path.resolve(projectPath);
    const read = relative => {
        const target = path.join(base, relative);
        if (!fs.existsSync(target)) return null;
        const realBase = fs.realpathSync(base);
        const real = fs.realpathSync(target);
        if (!real.startsWith(realBase + path.sep)) throw new Error('DEPLOY_PATH_OUTSIDE_PROJECT');
        return fs.readFileSync(real, 'utf8');
    };
    const candidates = [];
    for (const rootDir of ['', 'fullstack']) {
        const filename = name => rootDir ? `${rootDir}/${name}` : name;
        const source = read(filename('package.json'));
        if (!source) continue;
        let pkg;
        try { pkg = JSON.parse(source); } catch { throw new Error('INVALID_DEPLOY_PACKAGE'); }
        if (!pkg.dependencies?.next && !pkg.devDependencies?.next) continue;
        if (!pkg.scripts?.build || !pkg.scripts?.start) throw new Error('NEXT_SCRIPTS_REQUIRED');
        const schema = read(filename('prisma/schema.prisma')) || '';
        const provider = schema.match(/datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"/s)?.[1] || null;
        if (provider === 'postgresql' && !pkg.scripts['db:deploy']) throw new Error('DATABASE_DEPLOY_SCRIPT_REQUIRED');
        candidates.push({ kind: 'next', rootDir, database: provider,
            buildCommand: 'npm install --include=dev && npm run build',
            startCommand: provider ? 'npm run db:deploy && npm start' : 'npm start' });
    }
    if (candidates.length > 1) throw new Error('AMBIGUOUS_DEPLOY_ROOT');
    return candidates[0] || { kind: 'express', rootDir: '', database: null,
        buildCommand: 'npm install', startCommand: 'node server.js' };
}

export function validateDeploymentDatabase(layout) {
    if (layout.kind === 'next' && layout.database && layout.database !== 'postgresql') {
        throw new Error('يتطلب النشر قاعدة PostgreSQL. المشروع الحالي يستخدم ' + layout.database
            + '؛ يجب ترحيل بياناته أولاً. لم تُعدّل قاعدة البيانات.');
    }
}

export function nextRenderConfig(name, layout) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) throw new Error('INVALID_SERVICE_NAME');
    validateDeploymentDatabase(layout);
    const database = layout.database === 'postgresql';
    return `services:
  - type: web
    name: ${name}
    runtime: node
    plan: free
    region: frankfurt
    rootDir: ${JSON.stringify(layout.rootDir)}
    buildCommand: ${layout.buildCommand}
    startCommand: ${layout.startCommand}
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: "22"
      - key: JAOLA_ADMIN_TOKEN
        generateValue: true${database ? `
      - key: DATABASE_URL
        fromDatabase:
          name: ${name}-db
          property: connectionString
databases:
  - name: ${name}-db
    plan: free
    region: frankfurt` : ''}
`;
}
