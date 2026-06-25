import express from 'express';
import { authenticate } from '../utils/auth.js';

const router = express.Router();

router.get('/health', authenticate, (req, res) => {
    res.json({
        Planner: { status: 'healthy', successRate: 100 },
        Architect: { status: 'healthy', successRate: 100 },
        Coder: { status: 'healthy', successRate: 95 },
        Reviewer: { status: 'healthy', successRate: 90 },
        QA: { status: 'healthy', successRate: 85 },
        Deployer: { status: 'healthy', successRate: 95 }
    });
});

export default router;
