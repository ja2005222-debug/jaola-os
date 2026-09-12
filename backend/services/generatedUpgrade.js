import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MANIFEST = '.jaola-generated.json';
const digest = content => createHash('sha256').update(content).digest('hex');

/** Update only managed, unmodified files. Backups live outside the exported project.
 * Untracked existing files may only be adopted when their content already matches.
 * Database files and secrets are never upgrade targets. */
export function upgradeGeneratedFiles(projectPath, files) {
    const root = fs.realpathSync(projectPath);
    const names = new Set();
    const targets = files.map(file => {
        if (typeof file.name !== 'string' || typeof file.content !== 'string'
            || !/^[\w./\[\]-]+$/.test(file.name) || file.name.split('/').some(part => !part || part === '..'
                || (part.startsWith('.') && !['.env.example', '.gitignore'].includes(part)))
            || /\.(?:db|sqlite|sqlite3)(?:-|$)/i.test(file.name) || names.has(file.name)) throw new Error('INVALID_UPGRADE_TARGET');
        names.add(file.name);
        const target = path.join(root, file.name);
        let current = root;
        for (const part of file.name.split('/')) {
            current = path.join(current, part);
            if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('UPGRADE_SYMLINK');
        }
        return { ...file, target, before: fs.existsSync(target) ? fs.readFileSync(target) : null };
    });
    const manifestPath = path.join(root, MANIFEST);
    if (fs.existsSync(manifestPath) && fs.lstatSync(manifestPath).isSymbolicLink()) throw new Error('UPGRADE_SYMLINK');
    const beforeManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : null;
    const manifest = beforeManifest ? JSON.parse(beforeManifest.toString('utf8')) : { version: 1, files: {} };
    if (manifest.version !== 1 || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw new Error('INVALID_UPGRADE_MANIFEST');
    const conflicts = targets.filter(file => file.before && digest(file.before) !== digest(file.content)
        && manifest.files[file.name] !== digest(file.before)).map(file => file.name);
    if (conflicts.length) return { success: false, code: 'CUSTOM_FILE_CONFLICT', conflicts };
    const changed = targets.filter(file => !file.before || digest(file.before) !== digest(file.content));
    const nextManifest = { ...manifest, files: { ...manifest.files } };
    for (const file of targets) nextManifest.files[file.name] = digest(file.content);
    const content = Buffer.from(JSON.stringify(nextManifest, null, 2) + '\n');
    if (!changed.length && beforeManifest?.equals(content)) return { success: true, changed: [], backupId: null };
    const backupId = randomUUID();
    const backupDir = path.join(path.dirname(root), '.jaola-upgrade-backups', digest(root), backupId);
    for (const directory of [path.dirname(path.dirname(backupDir)), path.dirname(backupDir)]) {
        if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error('UPGRADE_SYMLINK');
    }
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    // Complete backup before the first project mutation, including the old manifest.
    fs.writeFileSync(path.join(backupDir, 'snapshot.json'), JSON.stringify({
        project: root, manifest: beforeManifest?.toString('base64') ?? null,
        files: changed.map(file => ({ name: file.name, before: file.before?.toString('base64') ?? null, after: digest(file.content) })),
    }), { mode: 0o600, flag: 'wx' });
    const written = [];
    const atomicWrite = (target, value) => {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const temp = target + '.' + backupId + '.tmp';
        try { fs.writeFileSync(temp, value, { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, target); }
        finally { fs.rmSync(temp, { force: true }); }
    };
    try {
        for (const file of changed) { atomicWrite(file.target, file.content); written.push(file); }
        atomicWrite(manifestPath, content);
    } catch (error) {
        for (const file of written.reverse()) {
            if (file.before) atomicWrite(file.target, file.before); else fs.rmSync(file.target, { force: true });
        }
        throw error;
    }
    return { success: true, changed: changed.map(file => file.name), backupId };
}
