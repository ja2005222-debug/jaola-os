import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadKnowledge } from '../services/knowledgeService.js';
import fs from 'fs/promises';
import path from 'path';
import { getActiveProject } from '../services/projectManager.js';

const router = express.Router();
router.use(requireAuth);

// البحث عن ملف يحتوي على نص معين (تقريبي)
async function findFileContainingText(projectPath, searchText) {
    const files = [];
    async function scan(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.next') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await scan(full);
            else if (/\.(jsx?|tsx?|html)$/.test(entry.name)) {
                const content = await fs.readFile(full, 'utf8').catch(() => '');
                if (content.includes(searchText)) {
                    files.push({ file: full, match: searchText });
                }
            }
        }
    }
    await scan(projectPath);
    return files.slice(0, 5); // أقصى 5 نتائج
}

router.post('/element', async (req, res) => {
    const { tag, id, classes, text, selector } = req.body;
    const project = getActiveProject();
    if (!project) return res.status(404).json({ error: 'No active project' });
    
    let searchTerm = id || text?.trim() || classes?.[0] || tag;
    if (!searchTerm) return res.status(400).json({ error: 'No identifiable info' });
    
    const files = await findFileContainingText(project.path, searchTerm);
    if (files.length === 0) {
        return res.json({ found: false, message: 'لم يتم العثور على ملف يحتوي على هذا العنصر.' });
    }
    
    res.json({
        found: true,
        files: files.map(f => ({ path: path.relative(project.path, f.file), fullPath: f.file }))
    });
});

export default router;
