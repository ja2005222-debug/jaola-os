import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.post('/proxy', async (req, res) => {
    try {
        const { method, url, headers, body } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });
        
        const response = await fetch(url, {
            method: method || 'GET',
            headers: headers || { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.text();
        res.json({ status: response.status, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
