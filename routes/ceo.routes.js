import express from 'express';
import { analyzeBusinessGoal } from '../agents/ceo.agent.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.post('/analyze', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    try {
        const plan = await analyzeBusinessGoal(message, req.userId);
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
