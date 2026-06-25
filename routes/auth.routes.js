import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDB } from '../services/database.js';
import { getJwtSecret } from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post('/register', async (req, res) => {
    const username = req.body.username?.trim();
    const { password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: 'Username must be 3-30 characters' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const db = getDB();
    if (db.prepare(`SELECT * FROM users WHERE username = ?`).get(username))
        return res.status(400).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)`).run(id, username, hash);
    res.json({ success: true, user: { id, username } });
});

router.post('/login', async (req, res) => {
    const username = req.body.username?.trim();
    const { password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const db = getDB();
    const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
});

export default router;
