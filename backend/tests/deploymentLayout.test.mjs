import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deploymentLayout } from '../services/deploymentLayout.js';
import { prepareRenderDeploy } from '../agents/renderAgent.js';
import { buildFullStackProject, getFullStackCategories } from '../agents/fullstackTemplates.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
function fixture(t, rootDir = 'fullstack', databaseProvider = 'postgresql', category = getFullStackCategories()[0]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-next-layout-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const file of buildFullStackProject(category, 'demo', { databaseProvider }).files) {
        const filename = path.join(dir, rootDir, file.name);
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, file.content);
    }
    return dir;
}
for (const category of getFullStackCategories()) {
    test(`${category}: nested Next uses PostgreSQL and retains custom root server`, async t => {
        const dir = fixture(t, 'fullstack', 'postgresql', category);
        fs.writeFileSync(path.join(dir, 'server.js'), '// customer code');
        const result = await prepareRenderDeploy(dir, 'demo', true);
        assert.equal(result.success, true);
        assert.equal(result.layout.rootDir, 'fullstack');
        assert.equal(result.layout.database, 'postgresql');
        const yaml = fs.readFileSync(path.join(dir, 'render.yaml'), 'utf8');
        assert.match(yaml, /rootDir: "fullstack"/);
        assert.match(yaml, /fromDatabase:/);
        assert.match(yaml, /npm run db:deploy && npm start/);
        assert.doesNotMatch(yaml, /node server.js|db:seed|accept-data-loss|force-reset/);
        assert.equal(fs.readFileSync(path.join(dir, 'server.js'), 'utf8'), '// customer code');
    });
}
test('root Next and ambiguous roots are distinguished', t => {
    const dir = fixture(t, '');
    assert.equal(deploymentLayout(dir).rootDir, '');
    fs.mkdirSync(path.join(dir, 'fullstack'));
    fs.copyFileSync(path.join(dir, 'package.json'), path.join(dir, 'fullstack/package.json'));
    assert.throws(() => deploymentLayout(dir), /AMBIGUOUS_DEPLOY_ROOT/);
});
test('SQLite deployment stops before altering any project file', async t => {
    const dir = fixture(t, 'fullstack', 'sqlite');
    fs.writeFileSync(path.join(dir, 'render.yaml'), 'custom configuration');
    const result = await prepareRenderDeploy(dir, 'demo', true);
    assert.equal(result.success, false);
    assert.match(result.error, /sqlite/);
    assert.equal(fs.readFileSync(path.join(dir, 'render.yaml'), 'utf8'), 'custom configuration');
    assert.equal(fs.existsSync(path.join(dir, 'server.js')), false);
});
test('Next package symlink outside project is rejected', t => {
    const outside = fixture(t, '');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-layout-link-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.symlinkSync(path.join(outside, 'package.json'), path.join(dir, 'package.json'));
    assert.throws(() => deploymentLayout(dir), /DEPLOY_PATH_OUTSIDE_PROJECT/);
});
