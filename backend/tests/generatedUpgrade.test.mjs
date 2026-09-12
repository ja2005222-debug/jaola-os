import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { upgradeGeneratedFiles } from '../services/generatedUpgrade.js';

function fixture(t) {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-upgrade-'));
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
    const root = path.join(parent, 'project');
    fs.mkdirSync(root);
    return root;
}
test('managed update preserves database/custom files and saves recoverable original outside export', t => {
    const root = fixture(t);
    assert.equal(upgradeGeneratedFiles(root, [{ name: 'server.js', content: 'version one' }]).success, true);
    fs.writeFileSync(path.join(root, 'customer.js'), 'custom code');
    fs.writeFileSync(path.join(root, 'data.db'), 'customer data');
    const result = upgradeGeneratedFiles(root, [{ name: 'server.js', content: 'version two' }]);
    assert.deepEqual(result.changed, ['server.js']);
    assert.equal(fs.readFileSync(path.join(root, 'customer.js'), 'utf8'), 'custom code');
    assert.equal(fs.readFileSync(path.join(root, 'data.db'), 'utf8'), 'customer data');
    const hash = createHash('sha256').update(root).digest('hex');
    const snapshot = JSON.parse(fs.readFileSync(path.join(path.dirname(root), '.jaola-upgrade-backups', hash, result.backupId, 'snapshot.json')));
    assert.equal(Buffer.from(snapshot.files[0].before, 'base64').toString(), 'version one');
    assert.equal(upgradeGeneratedFiles(root, [{ name: 'server.js', content: 'version two' }]).backupId, null);
});
test('customized managed file blocks whole batch before any write', t => {
    const root = fixture(t);
    upgradeGeneratedFiles(root, [{ name: 'app.js', content: 'original' }]);
    fs.writeFileSync(path.join(root, 'app.js'), 'customer change');
    const result = upgradeGeneratedFiles(root, [{ name: 'new.js', content: 'new' }, { name: 'app.js', content: 'upgrade' }]);
    assert.equal(result.success, false);
    assert.deepEqual(result.conflicts, ['app.js']);
    assert.equal(fs.existsSync(path.join(root, 'new.js')), false);
    assert.equal(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), 'customer change');
});
test('legacy untracked file is only adopted if identical', t => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, 'app.js'), 'old');
    assert.equal(upgradeGeneratedFiles(root, [{ name: 'app.js', content: 'new' }]).success, false);
    assert.equal(upgradeGeneratedFiles(root, [{ name: 'app.js', content: 'old' }]).success, true);
    assert.equal(upgradeGeneratedFiles(root, [{ name: 'app.js', content: 'new' }]).success, true);
});
test('database, secrets, traversal and symlink destinations are refused', t => {
    const root = fixture(t);
    for (const name of ['../other.js', '/absolute.js', 'data.db', '.env', 'nested/../escape.js']) {
        assert.throws(() => upgradeGeneratedFiles(root, [{ name, content: 'x' }]), /INVALID_UPGRADE_TARGET/);
    }
    fs.symlinkSync(path.dirname(root), path.join(root, 'external'));
    assert.throws(() => upgradeGeneratedFiles(root, [{ name: 'external/file.js', content: 'x' }]), /UPGRADE_SYMLINK/);
});
