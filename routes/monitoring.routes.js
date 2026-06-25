import express from 'express';
import { usageStats } from '../services/groqService.js';
import { getAllTasks, getAllPlans, getAllLogs } from '../services/taskQueue.js';

const router = express.Router();

router.get('/usage', (req, res) => { res.json(usageStats); });

router.post('/usage/reset', (req, res) => {
    Object.keys(usageStats).forEach(p => { usageStats[p].requests = 0; usageStats[p].tokens = 0; });
    res.json({ success: true });
});

router.get('/tasks', async (req, res) => { try { res.json(await getAllTasks()); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/plans', async (req, res) => { try { res.json(await getAllPlans()); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/logs', async (req, res) => { try { res.json(await getAllLogs()); } catch (err) { res.status(500).json({ error: err.message }); } });
router.get('/task/:id', async (req, res) => {
    try { const { getTask } = await import('../services/taskQueue.js'); res.json(await getTask(req.params.id) || {}); }
    catch (err) { res.json({}); }
});

export default router;
