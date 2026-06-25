// services/knowledgeService.js
import fs from 'fs/promises';
import path from 'path';

const KNOWLEDGE_FILE = './knowledge/project-index.json';

export async function scanProject(projectPath) {
    console.log(`🔍 Scanning project: ${projectPath}`);
    const index = { pages: [], components: [], exports: {}, imports: {}, lastScan: new Date().toISOString() };

    async function scanDir(dir, relative = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            const rel = path.join(relative, entry.name);
            if (entry.isDirectory()) {
                if (!['node_modules', '.next', 'public', '.git'].includes(entry.name))
                    await scanDir(full, rel);
            } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx')) {
                const content = await fs.readFile(full, 'utf8');
                const exports = [...content.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);
                if (exports.length) index.exports[rel] = exports;
                if (rel.includes('app/') && (entry.name === 'page.tsx' || entry.name === 'page.jsx')) {
                    let pagePath = '/' + rel.replace('app/', '').replace(/\/page\.(tsx|jsx)$/, '');
                    if (pagePath === '/') pagePath = '/';
                    index.pages.push(pagePath);
                }
                if (rel.includes('components/') && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
                    const compName = entry.name.replace(/\.(tsx|jsx)$/, '');
                    if (!index.components.includes(compName)) index.components.push(compName);
// كشف نوع الـ Router
if (graph.pages.some(p => p.startsWith('/'))) {
    graph.routerType = 'app'; // App Router
} else {
    const hasPagesDir = await fs.access(path.join(projectPath, 'pages')).then(() => true).catch(() => false);
    graph.routerType = hasPagesDir ? 'pages' : 'unknown';
}

                }
            }
        }
    }
    await scanDir(projectPath);
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(index, null, 2));
    console.log(`✅ Knowledge base updated: ${index.pages.length} pages, ${index.components.length} components`);
    return index;
}

export async function loadKnowledge() {
    try {
        const data = await fs.readFile(KNOWLEDGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch { return { pages: [], components: [], exports: {}, imports: {} }; }
}
