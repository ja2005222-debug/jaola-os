import simpleGit from 'simple-git';
import { getActiveProject } from '../services/projectManager.js';

async function getGit() {
    const active = getActiveProject();
    if (!active) throw new Error('No active project');
    return simpleGit(active.path);
}

export async function executeGitCommand(command, params = {}) {
    const git = await getGit();
    switch (command) {
        case 'status':
            return await git.status();
        case 'commit':
            await git.add('.');
            const result = await git.commit(params.message || 'Auto commit by JAOLA');
            return result;
        case 'push':
            await git.push();
            return { success: true };
        case 'pull':
            await git.pull();
            return { success: true };
        case 'branch':
            const branches = await git.branch();
            return branches;
        case 'rollback':
            await git.reset(['--hard', 'HEAD']);
            return { success: true };
        default:
            throw new Error(`Unknown git command: ${command}`);
    }
}
