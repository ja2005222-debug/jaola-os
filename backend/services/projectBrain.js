import fs from 'fs/promises';
import path from 'path';
import { getActiveProject } from './projectManager.js';
import { loadKnowledge } from './knowledgeService.js';

const BRAIN_FILE = './memory/project-brain.json';

async function ensureDir() {
    await fs.mkdir('./memory', { recursive: true });
}

export async function loadProjectBrain() {
    await ensureDir();
    try {
        const data = await fs.readFile(BRAIN_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return {
            name: 'Unknown',
            framework: 'Next.js',
            database: 'PostgreSQL',
            language: 'TypeScript',
            design: 'Modern',
            business: 'Generic',
            features: [],
            lastUpdated: new Date().toISOString()
        };
    }
}

export async function saveProjectBrain(brain) {
    await ensureDir();
    brain.lastUpdated = new Date().toISOString();
    await fs.writeFile(BRAIN_FILE, JSON.stringify(brain, null, 2));
}

export async function updateProjectBrainFromTwin() {
    const active = getActiveProject();
    if (!active) return;
    const knowledge = await loadKnowledge();
    const brain = await loadProjectBrain();
    
    // تحديث من الـ Knowledge Graph
    brain.framework = 'Next.js'; // افتراضي
    brain.pages = knowledge.pages || [];
    brain.components = knowledge.components || [];
    brain.features = brain.features || [];
    
    await saveProjectBrain(brain);
    return brain;
}

// دالة للحصول على سياق المشروع كـ string للـ prompts
export async function getProjectContext() {
    const brain = await loadProjectBrain();
    return `
Project Name: ${brain.name}
Framework: ${brain.framework}
Database: ${brain.database}
Language: ${brain.language}
Business Type: ${brain.business}
Features: ${brain.features.join(', ')}
Pages: ${brain.pages?.length || 0} pages
Components: ${brain.components?.length || 0} components
`;
}
