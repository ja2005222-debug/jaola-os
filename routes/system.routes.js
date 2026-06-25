import express from 'express';
import os from 'os';
import { getDB } from '../services/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/stats', async (req, res) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuUsage = os.loadavg()[0] * 10; // تقريبي
    
    const db = getDB();
    const pendingTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'`).get().count;
    const runningTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'running'`).get().count;
    
    res.json({
        cpu: cpuUsage.toFixed(1),
        ram: (usedMem / (1024**3)).toFixed(1),
        queue: pendingTasks + runningTasks,
        tasks: { pending: pendingTasks, running: runningTasks }
    });
});

export default router;
