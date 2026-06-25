import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const envPath = path.join(process.cwd(), '.env');

router.get('/', async (req, res) => {
    try {
        const content = await fs.readFile(envPath, 'utf8').catch(() => '');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { content } = req.body;
        await fs.writeFile(envPath, content, 'utf8');
        // إعادة تحميل المتغيرات البيئية
        const dotenv = await import('dotenv');
        dotenv.config({ override: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
