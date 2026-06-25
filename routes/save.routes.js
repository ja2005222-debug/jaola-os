import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getActiveProject } from '../services/projectManager.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.post('/file', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path required' });
        const active = getActiveProject();
        if (!active) return res.status(404).json({ error: 'No active project' });
        const fullPath = path.join(active.path, filePath);
        await fs.writeFile(fullPath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
