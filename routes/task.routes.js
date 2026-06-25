import express from 'express';
import { getDB } from '../services/database.js';
import { authenticate } from '../utils/auth.js';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
    const db = getDB();
    const tasks = db.prepare(`
        SELECT tasks.*
        FROM tasks
        JOIN projects ON projects.id = tasks.project_id
        WHERE projects.user_id = ?
        ORDER BY tasks.created_at DESC
    `).all(req.user.id);
    res.json(tasks);
});

export default router;
