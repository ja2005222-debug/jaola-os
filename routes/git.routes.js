import express from 'express';
import simpleGit from 'simple-git';
import { getActiveProject } from '../services/projectManager.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// Helper للحصول على مسار المشروع النشط
async function getProjectPath() {
    const active = getActiveProject();
    if (!active) throw new Error('No active project');
    return active.path;
}

// جلب حالة git
router.get('/status', async (req, res) => {
    try {
        const path = await getProjectPath();
        const git = simpleGit(path);
        const status = await git.status();
        const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
        const log = await git.log({ maxCount: 1 });
        res.json({
            branch: branch.trim(),
            lastCommit: log.latest?.message || 'No commits',
            uncommitted: status.files.length,
            files: status.files.map(f => ({ file: f.path, status: f.working_dir }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Commit
router.post('/commit', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Commit message required' });
        const path = await getProjectPath();
        const git = simpleGit(path);
        await git.add('.');
        const result = await git.commit(message);
        res.json({ success: true, commit: result.commit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Push
router.post('/push', async (req, res) => {
    try {
        const path = await getProjectPath();
        const git = simpleGit(path);
        await git.push();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rollback (hard reset to last commit)
router.post('/rollback', async (req, res) => {
    try {
        const path = await getProjectPath();
        const git = simpleGit(path);
        await git.reset(['--hard', 'HEAD']);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
