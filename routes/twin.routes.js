import express from 'express';
import { loadTwin, getActiveProjectTwin, updateTwin } from '../services/twin.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/active', async (req, res) => {
    try {
        const twin = await getActiveProjectTwin();
        res.json(twin);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:projectId', async (req, res) => {
    try {
        const twin = await loadTwin(req.params.projectId);
        res.json(twin);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:projectId', async (req, res) => {
    try {
        const twin = await updateTwin(req.params.projectId, req.body);
        res.json(twin);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
