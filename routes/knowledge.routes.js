import express from 'express';
import { loadKnowledge, findUsage } from '../services/knowledgeService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/graph', async (req, res) => {
    const graph = await loadKnowledge();
    res.json(graph);
});

router.get('/search', async (req, res) => {
    const { q, type } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });
    const results = await findUsage(q, type);
    res.json({ results });
});

export default router;
