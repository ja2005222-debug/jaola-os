import simpleGit from 'simple-git';
import { getActiveProject } from './projectManager.js';

let gitInstance = null;

async function getGit() {
    const active = getActiveProject();
    if (!active) throw new Error('No active project');
    if (!gitInstance) gitInstance = simpleGit(active.path);
    return gitInstance;
}

export async function getStatus() {
    const git = await getGit();
    return await git.status();
}

export async function commit(message) {
    const git = await getGit();
    await git.add('.');
    const result = await git.commit(message);
    return result;
}

export async function push() {
    const git = await getGit();
    return await git.push();
}

export async function pull() {
    const git = await getGit();
    return await git.pull();
}

export async function getBranches() {
    const git = await getGit();
    const branches = await git.branch();
    return branches.all;
}

export async function checkoutBranch(branchName) {
    const git = await getGit();
    return await git.checkout(branchName);
}

export async function createBranch(branchName) {
    const git = await getGit();
    return await git.checkoutLocalBranch(branchName);
}

export async function rollback(commitHash = 'HEAD') {
    const git = await getGit();
    return await git.reset(['--hard', commitHash]);
}

export async function getDiff() {
    const git = await getGit();
    return await git.diff();
}

export async function autoCommitAfterAiEdit(filePath) {
    const status = await getStatus();
    if (status.files.length > 0) {
        await commit(`AI auto-commit: edited ${filePath}`);
        await push();
    }
}
