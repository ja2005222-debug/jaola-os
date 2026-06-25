import fs from 'fs/promises';
import path from 'path';

const CONTEXT_FILE = './memory/conversation-state.json';

async function loadContext() {
    try {
        const data = await fs.readFile(CONTEXT_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return { activePage: null, lastModifiedFile: null, activeProjectId: null, conversationTopic: null };
    }
}

async function saveContext(context) {
    await fs.mkdir('./memory', { recursive: true });
    await fs.writeFile(CONTEXT_FILE, JSON.stringify(context, null, 2));
}

export async function updateContext(updates) {
    const ctx = await loadContext();
    Object.assign(ctx, updates);
    await saveContext(ctx);
    return ctx;
}

export async function getContext() {
    return await loadContext();
}
