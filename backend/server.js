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
import bcrypt from 'bcrypt';
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
import { generatePWA } from './agents/pwaAgent.js';

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
        return null;
    },
    async createUser(username, passwordHash) {
        if (this._isOnline()) {
            try {
                return await User.create({
                    username,
                    email: `${username}@jaola-twin.io`,
                    password: passwordHash
                });
            } catch (e) { return null; }
        }
        // وضع offline: لا يمكن إنشاء حساب دائم بكلمة مرور بدون DB
        return { id: `offline_${username}`, username, email: `${username}@jaola-twin.io`, password: passwordHash };
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
        return res.status(403).json({ error: 'غير مصرح: هذا المشروع لا يخص حسابك.' });
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

// workspace: يخدم ملفات الـ iframe
// ملاحظة مهمة: لا يمكن استخدام verifyToken هنا لأن <iframe src> لا يرسل
// Authorization header تلقائياً من المتصفح. الحماية تعتمد بدلاً من ذلك على:
// 1. تطهير صارم لاسم المستخدم والمشروع (path traversal محمي)
// 2. الملفات المخدومة للقراءة فقط ولا تحتوي بيانات حساسة (HTML/CSS/JS عامة)
app.get('/workspace', (req, res) => {
    const username = (req.query.username || 'guest_user').toString();
    const project = req.query.project || 'sandbox_app';
    const projectPath = getProjectPath(username, project);
    const filePath = path.join(projectPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('index.html not found');
});

// 🆕 المشكلة الجذرية: روابط نسبية مثل href="styles.css" داخل index.html
// لا تحمل query parameters (?project=...&username=...) عند حلها من المتصفح،
// فتفقد هوية المستخدم/المشروع وتُخدَّم من مسار افتراضي خاطئ (404).
// الحل: نلتقط آخر username/project طُلب فعلياً عبر /workspace/index.html
// ونُعيد استخدامهما كـ fallback للطلبات اللاحقة من نفس الـ Referer (الصفحة الأم).
const lastKnownContext = new Map(); // key: referer base path → { username, project }

app.get('/workspace/:file(*)', (req, res) => {
    let username = req.query.username?.toString();
    let project = req.query.project?.toString();

    // إذا لم تصل query params (حالة الروابط النسبية)، استخرجها من الـ Referer
    if (!username || !project) {
        const referer = req.headers.referer || '';
        try {
            const refUrl = new URL(referer);
            username = username || refUrl.searchParams.get('username') || 'guest_user';
            project = project || refUrl.searchParams.get('project') || 'sandbox_app';
        } catch (e) {
            username = username || 'guest_user';
            project = project || 'sandbox_app';
        }
    }

    const projectPath = getProjectPath(username, project);

    const safeFile = path.normalize(req.params.file)
        .replace(/^(\.\.[\/\\])+/, '')
        .replace(/^\/+/, '');
    const filePath = path.join(projectPath, safeFile);

    if (!filePath.startsWith(projectPath)) {
        return res.status(403).send('Access Denied');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('File not found');
});

// تسجيل حساب جديد — يتطلب كلمة مرور
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'اسم المستخدم مطلوب.' });
    }

    const validUsernamePattern = /^[a-zA-Z][a-zA-Z0-9_\-]{2,19}$/;
    const trimmedUsername = username.trim();
    if (!validUsernamePattern.test(trimmedUsername)) {
        return res.status(400).json({
            error: 'اسم المستخدم غير صالح. يجب أن يكون بالإنجليزية فقط (أحرف وأرقام)، يبدأ بحرف، وطوله 3-20.'
        });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
    }

    try {
        const sanitizedUser = trimmedUsername.toLowerCase();

        const existing = await DB.findUser(sanitizedUser);
        if (existing) {
            return res.status(409).json({ error: 'اسم المستخدم محجوز بالفعل. اختر اسماً آخر أو سجّل دخولك.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userRecord = await DB.createUser(sanitizedUser, passwordHash);

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

// تسجيل الدخول بكلمة مرور
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'اسم المستخدم مطلوب.' });
    }

    // 🆕 تحقق صارم: أحرف إنجليزية وأرقام وشرطات فقط — يمنع الأسماء التي تتحول بالكامل لـ "_____"
    const validUsernamePattern = /^[a-zA-Z][a-zA-Z0-9_\-]{2,19}$/;
    const trimmed = username.trim();
    if (!validUsernamePattern.test(trimmed)) {
        return res.status(400).json({
            error: 'اسم المستخدم غير صالح. يجب أن يكون بالإنجليزية فقط (أحرف وأرقام)، يبدأ بحرف، وطوله 3-20.'
        });
    }

    try {
        const sanitizedUser = trimmed.toLowerCase();
        const userRecord = await DB.findUser(sanitizedUser);

        // المستخدم غير موجود في DB أو وضع offline — استخدم وضع الضيف بدون كلمة مرور
        if (!userRecord) {
            if (DB._isOnline()) {
                return res.status(404).json({ error: 'الحساب غير موجود. سجّل حساباً جديداً أولاً.' });
            }
            // وضع offline: دخول كضيف بدون التحقق من كلمة مرور (للتطوير المحلي فقط)
            const payload = { id: `offline_${sanitizedUser}`, username: sanitizedUser, email: `${sanitizedUser}@jaola-twin.io` };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ success: true, token, currentUser: sanitizedUser, activeProject: 'sandbox_app', offlineMode: true });
        }

        // المستخدم موجود في DB — كلمة المرور مطلوبة
        if (!password) {
            return res.status(400).json({ error: 'كلمة المرور مطلوبة لهذا الحساب.' });
        }

        if (!userRecord.password) {
            return res.status(500).json({ error: 'حساب بدون كلمة مرور مسجّلة. تواصل مع الدعم.' });
        }

        const isValid = await bcrypt.compare(password, userRecord.password);
        if (!isValid) {
            return res.status(401).json({ error: 'كلمة المرور غير صحيحة.' });
        }

        const payload = {
            id: userRecord._id || userRecord.id,
            username: sanitizedUser,
            email: userRecord.email
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

app.delete('/api/projects/:name', verifyToken, async (req, res) => {
    const username = req.user.username;
    const safeProject = (req.params.name || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '-');

    if (!safeProject) {
        return res.status(400).json({ error: 'اسم المشروع مطلوب.' });
    }
    if (safeProject === 'sandbox_app') {
        return res.status(400).json({ error: 'لا يمكن حذف المشروع الافتراضي sandbox_app.' });
    }

    try {
        // حذف الملفات من القرص
        const projectPath = getProjectPath(username, safeProject);
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }

        // حذف السجل من قاعدة البيانات
        if (DB._isOnline()) {
            try { await Project.deleteOne({ name: safeProject, owner: username }); } catch (e) {}
        }

        // إذا كان هذا هو المشروع النشط حالياً للمستخدم، بلّغ الـ socket room
        const roomName = `${username}-${safeProject}`;
        io.to(roomName).emit('log', { message: `🗑️ [SYSTEM]: تم حذف المشروع (${safeProject}).` });

        res.json({ success: true, deleted: safeProject });
    } catch (err) {
        res.status(500).json({ error: 'فشل حذف المشروع: ' + err.message });
    }
});

// 🆕 توليد PWA (manifest + service worker + أيقونة) لمشروع موجود
app.post('/api/pwa/generate', verifyToken, validateProjectOwnership, async (req, res) => {
    const { appName, shortName } = req.body;

    if (!appName || typeof appName !== 'string' || appName.trim().length === 0) {
        return res.status(400).json({ error: 'اسم التطبيق مطلوب.' });
    }

    try {
        const result = await generatePWA(req.projectPath, {
            appName: appName.trim(),
            shortName: shortName?.trim()
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('log', {
            message: `📱 [SYSTEM]: تم تحويل الموقع لتطبيق "${result.appName}" بنجاح! يمكنك الآن تثبيته من المتصفح.`
        });

        res.json({
            success: true,
            appName: result.appName,
            themeColor: result.themeColor,
            files: result.files
        });
    } catch (err) {
        res.status(500).json({ error: 'فشل توليد التطبيق: ' + err.message });
    }
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

// 🆕 مسار نشر صريح — أبسط وأوثق من الاعتماد على تصنيف نية AI غامض
app.post('/api/deploy', verifyToken, validateProjectOwnership, async (req, res) => {
    res.json({ accepted: true });

    const roomName = `${req.user.username}-${req.activeProject}`;

    try {
        await deployProject(
            {
                projectPath: req.projectPath,
                activeProject: req.activeProject,
                currentUser: req.user.username
            },
            io,
            () => emitUserProjects(roomName, req.user.username, req.activeProject)
        );
    } catch (error) {
        io.to(roomName).emit('log', { message: `❌ [DEPLOY]: خطأ غير متوقع: ${error.message}` });
    }
});

// ─── معالج أخطاء عام ────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
});

httpServer.listen(4000, '0.0.0.0', () => console.log('🟢 JAOLA OS Server on Port 4000'));
