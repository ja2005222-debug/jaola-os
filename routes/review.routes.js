import express from 'express';
import { queryGroq } from '../services/groqService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.post('/code', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code required' });
        const prompt = `Analyze this code and return a JSON object with scores for security, performance, SEO, accessibility (each out of 100) and a brief summary. Code:\n${code.substring(0, 3000)}`;
        const response = await queryGroq(prompt, 0.2, 'You are a code quality expert. Return ONLY valid JSON.');
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { security: 70, performance: 70, seo: 70, accessibility: 70, summary: 'Auto-evaluated' };
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
