import fs from 'fs/promises';
import path from 'path';
import { getActiveProject } from './projectManager.js';

const MEMORY_DIR = './memory';

async function ensureDir() {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
}

function getMemoryFilePath(projectId) {
    return path.join(MEMORY_DIR, `${projectId}.json`);
}

export async function loadProjectMemory(projectId) {
    await ensureDir();
    const filePath = getMemoryFilePath(projectId);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch {
        return { projectId, decisions: [], techStack: {}, lastSummary: '' };
    }
}

export async function saveProjectMemory(projectId, memory) {
    await ensureDir();
    const filePath = getMemoryFilePath(projectId);
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2));
}

export async function updateMemory(key, value) {
    const active = getActiveProject();
    if (!active) return;
    const memory = await loadProjectMemory(active.id);
    memory[key] = value;
    memory.lastUpdated = new Date().toISOString();
    await saveProjectMemory(active.id, memory);
}

export async function rememberDecision(decision) {
    const active = getActiveProject();
    if (!active) return;
    const memory = await loadProjectMemory(active.id);
    memory.decisions.push({ decision, timestamp: new Date().toISOString() });
    if (memory.decisions.length > 50) memory.decisions = memory.decisions.slice(-50);
    await saveProjectMemory(active.id, memory);
}

export async function recallProjectContext() {
    const active = getActiveProject();
    if (!active) return {};
    return await loadProjectMemory(active.id);
}
