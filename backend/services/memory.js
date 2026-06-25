import fs from 'fs/promises';
import path from 'path';
import { getDB } from './database.js';

const MEMORY_DIR = './memory';

async function ensureDir() {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
}

function getMemoryPath(projectId) {
    return path.join(MEMORY_DIR, `${projectId}.json`);
}

export async function getProjectMemory(projectId) {
    await ensureDir();
    const filePath = getMemoryPath(projectId);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch {
        return { projectId, decisions: [], lastUpdated: new Date().toISOString() };
    }
}

export async function updateProjectMemory(projectId, updates) {
    const memory = await getProjectMemory(projectId);
    const newMemory = { ...memory, ...updates, lastUpdated: new Date().toISOString() };
    await fs.writeFile(getMemoryPath(projectId), JSON.stringify(newMemory, null, 2));
    return newMemory;
}

export async function getDecisions(projectId) {
    const memory = await getProjectMemory(projectId);
    return memory.decisions || [];
}

export async function rememberDecision(projectId, decision, reason) {
    const memory = await getProjectMemory(projectId);
    const newDecision = { decision, reason, timestamp: new Date().toISOString() };
    memory.decisions = memory.decisions || [];
    memory.decisions.push(newDecision);
    if (memory.decisions.length > 50) memory.decisions = memory.decisions.slice(-50);
    await updateProjectMemory(projectId, { decisions: memory.decisions });
    return newDecision;
}
