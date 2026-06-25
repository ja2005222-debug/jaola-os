import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getProjectMemory, updateProjectMemory, getDecisions, rememberDecision } from '../services/memory.js';

const router = express.Router();
router.use(requireAuth);

// الحصول على ذاكرة المشروع
router.get('/:projectId', async (req, res) => {
    try {
        const memory = await getProjectMemory(req.params.projectId);
        res.json(memory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تحديث ذاكرة المشروع
router.post('/:projectId', async (req, res) => {
    try {
        const memory = await updateProjectMemory(req.params.projectId, req.body);
        res.json(memory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// الحصول على قرارات المشروع
router.get('/:projectId/decisions', async (req, res) => {
    try {
        const decisions = await getDecisions(req.params.projectId);
        res.json(decisions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// إضافة قرار جديد
router.post('/:projectId/decisions', async (req, res) => {
    try {
        const { decision, reason } = req.body;
        const result = await rememberDecision(req.params.projectId, decision, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
