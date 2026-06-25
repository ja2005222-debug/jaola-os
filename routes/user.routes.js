import express from 'express';
import jwt from 'jsonwebtoken';
import { createProject, initProject, startDevServer, getProjects } from '../services/projectManager.js';
import { analyzeUserRequest } from '../agents/reasoning.agent.js';
import { execute as conversationExecute } from '../agents/conversation.agent.js';

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

const sessions = new Map();

router.post('/request', authenticate, async (req, res) => {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const sessionKey = sessionId || req.user.id;
    if (!sessions.has(sessionKey)) {
        sessions.set(sessionKey, { history: [] });
    }
    const session = sessions.get(sessionKey);

    const intent = await analyzeUserRequest(message);
    console.log(`[Intent] ${message} -> ${intent.intent}`);

    // محادثة
    if (intent.intent === 'chat' || intent.intent === 'question') {
        session.history.push({ role: 'user', content: message });
        const reply = await conversationExecute(message, session.history, req.user.id);
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, type: 'conversation', sessionId: sessionKey });
    }

    // أمر تنفيذي
    if (intent.intent === 'command') {
        try {
            // 1. إنشاء مشروع في قاعدة البيانات فوراً
            const project = createProject(req.user.id, 'مشروع جديد');

            // 2. إرسال رد فوري للمستخدم (بدون انتظار create-next-app)
            const reply = `✅ تم تسجيل مشروع "${project.name}" وسيبدأ التنفيذ خلال لحظات.`;
            session.history.push({ role: 'user', content: message });
            session.history.push({ role: 'assistant', content: reply });

            // 3. تنفيذ initProject و startDevServer في الخلفية (غير متزامن)
            (async () => {
                try {
                    const initResult = await initProject(project.id);
                    if (initResult.success) {
                        const dev = await startDevServer(project.id);
                        console.log(`✅ Project ${project.name} started on port ${dev.port}`);
                        // يمكنك إرسال تحديث عبر WebSocket هنا
                    } else {
                        console.error('Init failed:', initResult.error);
                    }
                } catch (err) {
                    console.error('Background error:', err);
                }
            })();

            return res.json({
                success: true,
                projectId: project.id,
                message: reply,
                sessionId: sessionKey
            });
        } catch (error) {
            console.error('Error executing command:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: '❌ فشل تنفيذ الأمر'
            });
        }
    }

    // أي شيء آخر
    const reply = await conversationExecute(message, session.history, req.user.id);
    return res.json({ reply, type: 'conversation', sessionId: sessionKey });
});

router.get('/profile', authenticate, (req, res) => {
    res.json({ username: req.user.username, id: req.user.id });
});

export default router;
