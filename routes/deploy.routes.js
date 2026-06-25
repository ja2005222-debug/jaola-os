import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getActiveProject } from '../services/projectManager.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = express.Router();
router.use(requireAuth);

// نشر المشروع النشط على Vercel (مثال بسيط)
router.post('/vercel', async (req, res) => {
    try {
        const active = getActiveProject();
        if (!active) return res.status(404).json({ error: 'No active project' });

        const token = process.env.VERCEL_TOKEN;
        if (!token) return res.status(400).json({ error: 'VERCEL_TOKEN not set in .env' });

        const execAsync = promisify(exec);
        const { stdout } = await execAsync(`npx vercel --prod --token ${token} --cwd "${active.path}" --yes`);
        const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
        const url = urlMatch ? urlMatch[0] : null;

        res.json({ success: true, url, message: 'Deployment initiated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
