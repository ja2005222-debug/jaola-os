import express from 'express';
import { analyzeRequest } from '../agents/architect.agent.js';
import { loadKnowledge } from '../services/knowledgeService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.post('/analyze', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    try {
        const context = await loadKnowledge();
        const plan = await analyzeRequest(message, context);
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
