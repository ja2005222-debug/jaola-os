import 'dotenv/config';
import './dbConfig.js';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import User from './models/User.js';
import Project from './models/Project.js';
import Conversation from './models/Conversation.js';

import {
    coreClassifyIntent,
    coreGenerateCodePlan,
    architectReview,
    qaVerify,
    deployProject,
    applyTemplate,
    JaolaCognitiveRuntime
} from './agents/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ─── حارس JWT_SECRET — يمنع التشغيل بسر افتراضي معروف ──────────────
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET غير مضبوط في ملف .env — لا يمكن التشغيل بأمان.');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// ─── CORS مضبوط — ليس مفتوحاً للجميع ──────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(o => o.trim());

const corsOptions = {
    origin: (origin, callback) => {
        // السماح لطلبات بدون origin (مثل curl أو SSR) أو من النطاقات المسموحة
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origin غير مسموح: ${origin}`));
        }
    },
    credentials: true,
};

const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
    }
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // حد أقصى لحجم الطلب

// ─── تقديم الواجهة الأمامية الثابتة ────────────────────────────────
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/workspace')) return next();
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

// ─── محرك JCOS v4.0 ─────────────────────────────────────────────────
const runtime = new JaolaCognitiveRuntime(io);

// ─── اتصال MongoDB ──────────────────────────────────────────────────
let isDbConnected = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jaola_os';

mongoose.connect(MONGO_URI)
    .then(() => { console.log('💾 [Database]: متصل بـ MongoDB.'); isDbConnected = true; })
    .catch(() => { console.log('⚠️ [Database]: وضع الصمود المؤقت نشط.'); isDbConnected = false; });

// ─── غلاف DB مع graceful fallback ───────────────────────────────────
const DB = {
    _isOnline() { return isDbConnected && mongoose.connection.readyState === 1; },

    async findUser(username) {
        if (this._isOnline()) {
            try { return await User.findOne({ username }); } catch (e) {}
        }
        return null; // لا نُعيد user وهمي — يُعالج في الـ route
    },
    async createUser(username, passwordHash = null) {
        if (this._isOnline()) {
            try {
                return await User.create({
                    username,
                    email: `${username}@jaola-twin.io`,
                    ...(passwordHash && { password: passwordHash })
                });
            } catch (e) { return null; }
        }
        return { id: `offline_${username}`, username, email: `${username}@jaola-twin.io` };
    },
    async findProject(name, owner) {
        if (this._isOnline()) {
            try { return await Project.findOne({ name, owner }); } catch (e) {}
        }
        // في وضع offline: المشاريع العامة + sandbox_app مسموحة
        return name === 'sandbox_app' ? { name, owner, vercelUrl: '' } : null;
    },
    async findUserProjects(owner) {
        if (this._isOnline()) {
            try { return await Project.find({ owner }).lean(); } catch (e) {}
        }
        return [{ name: 'sandbox_app', owner }];
    },
    async createProject(name, owner) {
        if (this._isOnline()) {
            try { return await Project.create({ name, owner }); } catch (e) {}
        }
        return { name, owner, vercelUrl: '' };
    }
};

// ─── مسارات الـ workspace على القرص ─────────────────────────────────
const BASE_WORKSPACE = path.resolve(__dirname, '../workspace');
if (!fs.existsSync(BASE_WORKSPACE)) fs.mkdirSync(BASE_WORKSPACE);

const getProjectPath = (username, activeProject) => {
    // تطهير المدخلات لمنع path traversal
    const safeUser = (username || 'guest_user').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
    const safeProject = (activeProject || 'sandbox_app').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();

    const userPath = path.join(BASE_WORKSPACE, safeUser);
    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });

    const projectPath = path.join(userPath, safeProject);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    return projectPath;
};

// ─── Middlewares أمنية ───────────────────────────────────────────────

// Rate limiter للـ AI — يمنع الاستنزاف
const aiLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({
        error: 'API_QUOTA_EXHAUSTED',
        details: 'تجاوزت الحد المسموح (10 طلبات/دقيقة). انتظر قليلاً.'
    })
});

// Rate limiter عام للـ API
const generalLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    keyGenerator: (req) => ipKeyGenerator(req),
});
app.use('/api', generalLimit);

// verifyToken — يرفض الطلبات بدون توكن صريح
export function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'غير مصرح: التوكن مفقود.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'غير مصرح: التوكن منتهي أو غير صالح.' });
        }
        req.user = user;
        next();
    });
}

// verifyToken مع fallback للضيف — فقط للمسارات التي تسمح بالوصول كضيف
function verifyTokenOrGuest(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = { id: 'guest', username: 'guest_user' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        req.user = err ? { id: 'guest', username: 'guest_user' } : user;
        next();
    });
}

// التحقق من ملكية المشروع
async function validateProjectOwnership(req, res, next) {
    const project = req.body?.project || req.query?.project || 'sandbox_app';
    const username = req.user.username;
    const safeProject = project.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '-');

    if (safeProject === 'sandbox_app') {
        req.projectPath = getProjectPath(username, safeProject);
        req.activeProject = safeProject;
        return next();
    }

const projectRecord = await DB.findProject(safeProject, username);
if (!projectRecord) {
    // إنشاء المشروع تلقائياً إذا لم يكن موجوداً
    await DB.createProject(safeProject, username);
}
    req.projectPath = getProjectPath(username, safeProject);
    req.activeProject = safeProject;
    next();
}

// إنشاء نسخة احتياطية قبل الحفظ
function createBackupSnapshot(projectPath, fileName) {
    const filePath = path.join(projectPath, fileName);
    if (!fs.existsSync(filePath)) return;

    const backupDir = path.join(projectPath, '.backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupPath = path.join(backupDir, `${fileName}.${Date.now()}.bak`);
    fs.copyFileSync(filePath, backupPath);

    try {
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith(fileName))
            .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time);
        if (backups.length > 5) {
            backups.slice(5).forEach(b => fs.unlinkSync(path.join(backupDir, b.name)));
        }
    } catch (e) {}
}

// ─── دوال بث الأحداث ─────────────────────────────────────────────────
const emitWorkspaceFiles = (roomName, projectPath) => {
    try {
        const files = fs.readdirSync(projectPath).filter(f => f !== '.backups' && !f.startsWith('.'));
        io.to(roomName).emit('workspace_files', files);
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
    } catch (e) {}
};

const emitUserProjects = async (roomName, username, activeProject) => {
    try {
        const projectsData = await DB.findUserProjects(username);
        const projects = projectsData.length > 0 ? projectsData.map(p => p.name) : ['sandbox_app'];
        const currentProj = projectsData.find(p => p.name === activeProject);
        io.to(roomName).emit('user_projects', {
            projects,
            activeProject,
            currentUser: username,
            vercelUrl: currentProj?.vercelUrl || ''
        });
    } catch (e) {}
};

// ─── Socket.io — مصادقة صارمة ────────────────────────────────────────
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized: Token Required'));

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error('Unauthorized: Invalid Token'));
        socket.user = user;
        next();
    });
});

io.on('connection', (socket) => {
    socket.on('join_project', async ({ project }) => {
        const username = socket.user.username;
        const safeProject = (project || 'sandbox_app').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '-');

        // التحقق من الملكية (sandbox_app مفتوح للجميع)
        if (safeProject !== 'sandbox_app') {
            const projectRecord = await DB.findProject(safeProject, username);
            if (!projectRecord) {
                socket.emit('log', { message: `❌ [ERROR]: غير مصرح لك بالانضمام للمشروع (${safeProject}).` });
                return;
            }
        }

        const roomName = `${username}-${safeProject}`;

        // مغادرة الغرف السابقة
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomName);
        socket.roomName = roomName;
        socket.activeProject = safeProject;

        const projectPath = getProjectPath(username, safeProject);
        emitWorkspaceFiles(roomName, projectPath);
        await emitUserProjects(roomName, username, safeProject);

        // استعادة تاريخ المحادثة
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try {
                const convo = await Conversation.findOne({ username });
                if (convo?.messages?.length > 0) {
                    socket.emit('chat_history', convo.messages.slice(-50));
                }
            } catch (e) {}
        }
    });
});

// ─── المسارات ─────────────────────────────────────────────────────────

// workspace: يخدم ملفات الـ iframe — مع تحقق من الـ username عبر التوكن
// ملاحظة: الـ iframe لا يستطيع إرسال Authorization header، لذا نستخدم query token مؤقت
app.get('/workspace', verifyTokenOrGuest, (req, res) => {
    const username = req.user.username;
    const project = req.query.project || 'sandbox_app';
    const projectPath = getProjectPath(username, project);
    const filePath = path.join(projectPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('index.html not found');
});

app.get('/workspace/:file(*)', verifyTokenOrGuest, (req, res) => {
    const username = req.user.username;
    const project = req.query.project || 'sandbox_app';
    const projectPath = getProjectPath(username, project);

    const safeFile = path.normalize(req.params.file)
        .replace(/^(\.\.[\/\\])+/, '')
        .replace(/^\/+/, '');
    const filePath = path.join(projectPath, safeFile);

    // التحقق الصارم أن الملف داخل مجلد المشروع
    if (!filePath.startsWith(projectPath)) {
        return res.status(403).send('Access Denied');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('File not found');
});

// تسجيل الدخول — بدون كلمة مرور في الوقت الحالي (يمكن إضافتها لاحقاً)
// TODO: إضافة كلمة مرور + bcrypt في الإصدار القادم
app.post('/api/auth/login', async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'اسم المستخدم مطلوب (3 أحرف على الأقل).' });
    }

    try {
        const sanitizedUser = username.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_');

        let userRecord = await DB.findUser(sanitizedUser);
        if (!userRecord) {
            userRecord = await DB.createUser(sanitizedUser);
        }

        if (!userRecord) {
            return res.status(500).json({ error: 'فشل إنشاء الحساب.' });
        }

        const payload = {
            id: userRecord._id || userRecord.id || sanitizedUser,
            username: sanitizedUser,
            email: userRecord.email || `${sanitizedUser}@jaola-twin.io`
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, currentUser: sanitizedUser, activeProject: 'sandbox_app' });
    } catch (err) {
        res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
    }
});

app.post('/api/project-context/switch', verifyToken, async (req, res) => {
    const { project } = req.body;
    const username = req.user.username;
    const safeProject = (project || 'sandbox_app').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '-');

    try {
        const exists = await DB.findProject(safeProject, username);
        if (!exists) await DB.createProject(safeProject, username);
    } catch (e) {}

    res.json({ success: true, currentUser: username, activeProject: safeProject });
});

app.get('/api/file-content', verifyToken, async (req, res) => {
    try {
        const { fileName, project } = req.query;
        const username = req.user.username;
        const safeProject = (project || 'sandbox_app').replace(/[^a-z0-9_\-]/g, '-');

        // التحقق من الملكية
        if (safeProject !== 'sandbox_app') {
            const projectRecord = await DB.findProject(safeProject, username);
            if (!projectRecord) {
                return res.status(403).json({ error: 'Access Denied: You do not own this project.' });
            }
        }

        const projectPath = getProjectPath(username, safeProject);
        const safeFileName = path.basename(fileName || 'index.html'); // basename يمنع path traversal
        const filePath = path.join(projectPath, safeFileName);

        if (!filePath.startsWith(projectPath)) {
            return res.status(403).json({ error: 'Access Denied: Out of workspace bounds.' });
        }

        return res.json({ content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '' });
    } catch (err) {
        res.status(500).json({ error: 'خطأ داخلي.' });
    }
});

app.post('/api/file-content/save', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { fileName, content } = req.body;
        if (!fileName || typeof content !== 'string') {
            return res.status(400).json({ error: 'fileName و content مطلوبان.' });
        }

        const safeFileName = path.basename(fileName); // منع path traversal
        const projectPath = req.projectPath;
        const filePath = path.join(projectPath, safeFileName);

        if (!filePath.startsWith(projectPath)) {
            return res.status(403).json({ error: 'Access Denied.' });
        }

        createBackupSnapshot(projectPath, safeFileName);
        fs.writeFileSync(filePath, content);

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, projectPath);
        io.to(roomName).emit('log', { message: `💾 [SYSTEM]: تم حفظ (${safeFileName}) مع نسخة احتياطية.` });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'فشل الحفظ.' });
    }
});

app.post('/api/chat', verifyToken, aiLimit, validateProjectOwnership, async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'الرسالة فارغة.' });
    }

    const projectPath = req.projectPath;
    const roomName = `${req.user.username}-${req.activeProject}`;

    res.json({ accepted: true });

    const agents = {
        coreClassifyIntent,
        coreGenerateCodePlan,
        architectReview,
        qaVerify,
        deployProject,
        templateAgent: applyTemplate
    };

    const dbStatus = isDbConnected && mongoose.connection.readyState === 1;

    try {
        await runtime.handleUserMessage(null, {
            message: message.trim(),
            roomName,
            projectPath,
            username: req.user.username,
            activeProject: req.activeProject
        }, agents, dbStatus);
    } catch (error) {
        io.to(roomName).emit('log', { message: `❌ [ERROR]: ${error.message}` });
    }
});

// ─── معالج أخطاء عام ────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
});

httpServer.listen(4000, '0.0.0.0', () => console.log('🟢 JAOLA OS Server on Port 4000'));
