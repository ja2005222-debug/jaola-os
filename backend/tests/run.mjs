import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// NODE_OPTIONS also loads the fixtures in subprocesses spawned by tests.
const preload = new URL('./helpers/mockProviders.mjs', import.meta.url).href;
const result = spawnSync(process.execPath, ['--test', 'tests/*.test.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${preload}` },
    stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
