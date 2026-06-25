import express from 'express';
import { getAllTasks } from '../services/taskQueue.js';
import { usageStats } from '../services/groqService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/agents', async (req, res) => {
    const tasks = await getAllTasks();
    const agents = ['Planner', 'Coder', 'Reviewer', 'QA', 'Deployer'];
    const agentStats = agents.map(agent => {
        const agentTasks = tasks.filter(t => t.agent === agent.toLowerCase());
        const total = agentTasks.length;
        const completed = agentTasks.filter(t => t.status === 'completed').length;
        const failed = agentTasks.filter(t => t.status === 'failed').length;
        const successRate = total === 0 ? 100 : Math.round((completed / total) * 100);
        const currentTask = agentTasks.find(t => t.status === 'running')?.action || 'Idle';
        const queueLength = agentTasks.filter(t => t.status === 'pending').length;
        // tokens غير مخصصة لكل وكيل، نعرض الكل
        const tokens = usageStats.Groq?.tokens || 0;
        return {
            name: agent,
            currentTask,
            queue: queueLength,
            tokens,
            successRate,
            totalTasks: total
        };
    });
    res.json(agentStats);
});

export default router;
