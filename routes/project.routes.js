import express from 'express';
import jwt from 'jsonwebtoken';
import { getProjects, getActiveProject, setActiveProject } from '../services/projectManager.js';

const router = express.Router();

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

router.get('/', authenticate, (req, res) => {
    const projects = getProjects(req.user.id);
    res.json(projects);
});

router.get('/active', authenticate, (req, res) => {
    const project = getActiveProject(req.user.id);
    res.json(project || {});
});

router.post('/active/:id', authenticate, (req, res) => {
    setActiveProject(req.user.id, req.params.id);
    res.json({ success: true });
});

export default router;
