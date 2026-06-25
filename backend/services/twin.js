import fs from 'fs/promises';
import path from 'path';
import { getActiveProject } from './projectManager.js';
import { logger } from './logger.js';

const TWIN_DIR = './twins';

async function ensureDir() {
    await fs.mkdir(TWIN_DIR, { recursive: true });
}

function getTwinFilePath(projectId) {
    return path.join(TWIN_DIR, `${projectId}.json`);
}

function createEmptyTwin(projectId) {
    return {
        projectId,
        lastUpdated: new Date().toISOString(),
        pages: [],
        components: [],
        routes: [],
        apis: [],
        database: [],
        env: {},
        seo: {},
        deployments: [],
        businessGoals: {
            revenueTarget: null,
            trafficTarget: null,
            affiliates: [],
            opportunities: []
        }
    };
}

export async function loadTwin(projectId) {
    await ensureDir();
    const filePath = getTwinFilePath(projectId);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch {
        const newTwin = createEmptyTwin(projectId);
        await saveTwin(projectId, newTwin);
        return newTwin;
    }
}

export async function saveTwin(projectId, twin) {
    await ensureDir();
    twin.lastUpdated = new Date().toISOString();
    const filePath = getTwinFilePath(projectId);
    await fs.writeFile(filePath, JSON.stringify(twin, null, 2));
    logger.info(`Twin saved for project ${projectId}`);
}

export async function updateTwin(projectId, updates) {
    const twin = await loadTwin(projectId);
    Object.assign(twin, updates);
    await saveTwin(projectId, twin);
    return twin;
}

export async function getActiveProjectTwin() {
    const active = getActiveProject();
    if (!active) throw new Error('No active project');
    return await loadTwin(active.id);
}
