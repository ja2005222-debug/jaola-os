import express from 'express';
import { getDB } from '../services/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// جلب جميع الجداول
router.get('/tables', async (req, res) => {
    try {
        const db = getDB();
        const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
        res.json(tables.map(t => t.name));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تنفيذ استعلام (SELECT only للأمان)
router.post('/query', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });
        const upper = query.trim().toUpperCase();
        if (!upper.startsWith('SELECT')) {
            return res.status(403).json({ error: 'Only SELECT queries are allowed' });
        }
        const db = getDB();
        const stmt = db.prepare(query);
        const result = stmt.all();
        res.json({ result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
