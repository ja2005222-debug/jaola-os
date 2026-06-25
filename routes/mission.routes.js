import express from 'express';
import { getDB } from '../services/database.js';
import { loadKnowledge } from '../services/knowledgeService.js';
import { getActiveProject, startDevServer, exposeWithNgrok } from '../services/projectManager.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// كل مسارات المهمة محمية بالمصادقة
router.use(requireAuth);

// 1. KPIs
router.get('/kpis', async (req, res) => {
    try {
        const db = getDB();
        const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks`).get().count;
        const completedTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'`).get().count;
        const buildSuccessRate = totalTasks === 0 ? 100 : Math.round((completedTasks / totalTasks) * 100);
        const autoFixRate = 75; // يمكن جلبها من سجلات autoFix لاحقاً
        const deploySuccessRate = 90;
        res.json({ totalTasks, buildSuccessRate, autoFixRate, deploySuccessRate });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Workflow live status
router.get('/workflow/status/live', async (req, res) => {
    const steps = ['Requirements', 'Architecture', 'Planning', 'Development', 'Review', 'Testing', 'Deploy', 'Monitoring'];
    const db = getDB();
    const runningTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'running'`).get().count;
    const completedTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'`).get().count;
    const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks`).get().count || 1;
    const statusList = steps.map((step, idx) => {
        let status = 'pending';
        if (idx < Math.floor((completedTasks / totalTasks) * steps.length)) status = 'completed';
        else if (runningTasks > 0 && idx === Math.floor((completedTasks / totalTasks) * steps.length)) status = 'current';
        return { name: step, status };
    });
    res.json(statusList);
});

// 3. Structured Architecture
router.get('/architecture/structured', async (req, res) => {
    try {
        const knowledge = await loadKnowledge();
        res.json({
            Frontend: { pages: knowledge.pages || [], components: knowledge.components || [] },
            Backend: { apis: [], services: [] },
            Database: { tables: [] },
            Agents: [
                { name: 'Architect', status: 'active' },
                { name: 'Planner', status: 'active' },
                { name: 'Coder', status: 'active' },
                { name: 'QA', status: 'active' }
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Preview active project
router.get('/active-project/preview', async (req, res) => {
    try {
        const active = getActiveProject();
        if (!active || !active.port) return res.json({ running: false, url: null });
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);
        try {
            await execPromise(`lsof -i :${active.port} | grep LISTEN`);
            res.json({ running: true, url: `http://localhost:${active.port}` });
        } catch {
            res.json({ running: false, url: null });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Start dev server for active project
router.post('/active-project/start', async (req, res) => {
    try {
        const active = getActiveProject();
        if (!active) return res.status(404).json({ error: 'No active project' });
        const result = await startDevServer(active.id);
        res.json({ port: result.port, message: 'Dev server started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Create ngrok tunnel for active project
router.post('/active-project/ngrok', async (req, res) => {
    try {
        const active = getActiveProject();
        if (!active) return res.status(404).json({ error: 'No active project' });
        const url = await exposeWithNgrok(active.id);
        if (url) res.json({ url });
        else res.status(500).json({ error: 'Failed to get ngrok URL' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
