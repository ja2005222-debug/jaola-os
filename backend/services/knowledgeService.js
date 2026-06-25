import fs from 'fs/promises';
import path from 'path';

const KNOWLEDGE_FILE = './knowledge/project-graph.json';

export async function scanProject(projectPath) {
    console.log(`Scanning project with Knowledge Graph: ${projectPath}`);
    const graph = {
        functions: [],
        classes: [],
        routes: [],
        database: [],
        components: [],
        imports: {},
        exports: {},
        lastScan: new Date().toISOString()
    };

    async function scanDir(dir, relative = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            const rel = path.join(relative, entry.name);
            if (entry.isDirectory()) {
                if (!['node_modules', '.next', '.git', 'public'].includes(entry.name))
                    await scanDir(full, rel);
            } else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
                const content = await fs.readFile(full, 'utf8');
                // Functions
                const funcMatches = [
                    ...content.matchAll(/export\s+function\s+([a-zA-Z0-9_]+)/g),
                    ...content.matchAll(/export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>|function\s*\([^)]*\)\s*{)/g)
                ];
                funcMatches.forEach(m => graph.functions.push({ name: m[1], file: rel }));
                // Classes
                const classMatches = [
                    ...content.matchAll(/export\s+class\s+([a-zA-Z0-9_]+)/g),
                    ...content.matchAll(/export\s+default\s+class\s+([a-zA-Z0-9_]+)/g)
                ];
                classMatches.forEach(m => graph.classes.push({ name: m[1], file: rel }));
                // Routes
                if (rel.includes('/app/') && entry.name === 'page.tsx') {
                    let routePath = '/' + rel.replace('app/', '').replace(/\/page\.tsx$/, '');
                    graph.routes.push({ route: routePath, file: rel });
                }
                // Components
                if (rel.includes('/components/') && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
                    const componentName = entry.name.replace(/\.(tsx|jsx)$/, '');
                    graph.components.push({ name: componentName, file: rel });
                }
                // Imports
                const importsList = [...content.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g)].map(m => m[1]);
                if (importsList.length) graph.imports[rel] = importsList;
                // Exports
                const exportsList = [...content.matchAll(/export\s+(?:default\s+)?(?:function|const|class|let|var)\s+([a-zA-Z0-9_]+)/g)].map(m => m[1]);
                if (exportsList.length) graph.exports[rel] = exportsList;
            } else if (entry.name === 'schema.prisma' || entry.name.includes('.sql')) {
                const content = await fs.readFile(full, 'utf8');
                const tableMatches = [...content.matchAll(/CREATE TABLE (\w+)/g)];
                tableMatches.forEach(m => graph.database.push({ table: m[1], file: rel }));
            }
        }
    }
    await scanDir(projectPath);
    await fs.mkdir('./knowledge', { recursive: true });
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(graph, null, 2));
    console.log(`Knowledge Graph saved: ${graph.functions.length} functions, ${graph.classes.length} classes, ${graph.routes.length} routes`);
    return graph;
}

export async function loadKnowledge() {
    try {
        const data = await fs.readFile(KNOWLEDGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch { return { functions: [], classes: [], routes: [], database: [], components: [], imports: {}, exports: {} }; }
}

export async function findUsage(entityName, type = 'function') {
    const graph = await loadKnowledge();
    if (type === 'function') return graph.functions.filter(f => f.name === entityName);
    if (type === 'class') return graph.classes.filter(c => c.name === entityName);
    if (type === 'route') return graph.routes.filter(r => r.route === entityName);
    if (type === 'component') return graph.components.filter(c => c.name === entityName);
    return [];
}

import { getActiveProject } from './projectManager.js';
import { updateTwin } from './twin.js';

// أضف هذه الدالة في نهاية الملف
export async function syncTwinAfterScan(projectPath, graph) {
    const active = getActiveProject();
    if (active && active.id) {
        await updateTwin(active.id, {
            pages: graph.pages,
            components: graph.components,
            routes: graph.routes,
            database: graph.database
        });
    }
}
