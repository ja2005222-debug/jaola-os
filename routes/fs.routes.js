import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getActiveProject, getProjectById } from '../services/projectManager.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// جلب هيكل المجلدات للمشروع النشط (بدون تحديد معرف)
router.get('/tree/active', async (req, res) => {
    try {
        const active = getActiveProject();
        if (!active) return res.status(404).json({ error: 'No active project' });
        const tree = await buildFileTree(active.path);
        res.json(tree);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// جلب هيكل المجلدات لمشروع محدد بواسطة معرفه
router.get('/tree/:projectId', async (req, res) => {
    try {
        const project = getProjectById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        const tree = await buildFileTree(project.path);
        res.json(tree);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// جلب محتوى ملف معين
router.get('/file', async (req, res) => {
    try {
        const { path: filePath, projectId } = req.query;
        if (!filePath) return res.status(400).json({ error: 'Missing path' });
        
        let basePath;
        if (projectId) {
            const project = getProjectById(projectId);
            if (!project) return res.status(404).json({ error: 'Project not found' });
            basePath = project.path;
        } else {
            const active = getActiveProject();
            if (!active) return res.status(404).json({ error: 'No active project' });
            basePath = active.path;
        }
        const fullPath = path.join(basePath, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        res.json({ content, path: filePath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// دالة مساعدة لبناء شجرة الملفات
async function buildFileTree(dir, relative = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
        if (['node_modules', '.next', '.git', 'public', '.env'].includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relative, entry.name);
        if (entry.isDirectory()) {
            result.push({
                name: entry.name,
                type: 'folder',
                path: relPath,
                children: await buildFileTree(fullPath, relPath)
            });
        } else if (entry.name.match(/\.(js|jsx|ts|tsx|html|css|json|md)$/)) {
            result.push({
                name: entry.name,
                type: 'file',
                path: relPath
            });
        }
    }
    return result;
}

export default router;
