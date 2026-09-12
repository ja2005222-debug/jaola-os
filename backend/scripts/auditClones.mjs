// Offline generated-app audit. A passing UI check is not a production authorization test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { listClones, getCloneById } from '../agents/cloneTemplates/index.js';
import { verifyBehavior } from '../agents/behaviorVerifier.js';
const report = [];
for (const meta of listClones()) {
    const clone = getCloneById(meta.id), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-audit-'));
    try {
        for (const file of clone.files) {
            const name = path.resolve(dir, file.name);
            if (!name.startsWith(dir + path.sep)) throw Error('Invalid clone path');
            fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, file.content);
        }
        const behavior = await verifyBehavior({ projectPath: dir, blueprint: { kind: 'webapp', functionalComponents: [{ name: 'app' }] }, domainModel: clone.model });
        report.push({ id: meta.id, roles: meta.roles, files: meta.files, sourceSha256: createHash('sha256').update(JSON.stringify(clone.files)).digest('hex'), readiness: meta.readiness, behavior });
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const output = new URL('../docs/CLONE_READINESS_AUDIT.json', import.meta.url);
fs.writeFileSync(output, JSON.stringify({ scope: 'Offline UI behavior; server auth and transaction suites run separately in CI', clones: report }, null, 2) + '\n');
console.log(`${report.filter(r => r.behavior.ok).length}/${report.length} clone UI audits passed`);
if (report.some(r => !r.behavior.ok)) process.exitCode = 1;
