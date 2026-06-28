import 'dotenv/config';
import './dbConfig.js'; // استيراد ملف التهيئة كأول سطر على الإطلاق لتفادي الـ Hoisting الانهياري

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

// استيراد الموديلات
import User from './models/User.js';
import Project from './models/Project.js';
import Conversation from './models/Conversation.js'; // استيراد الموديل لإنعاش ذاكرة الشات

// استيراد الوكلاء المطورين ومحرك الـ JCOS 
import { 
    coreClassifyIntent, 
    coreGenerateCodePlan, 
    architectReview, 
    qaVerify, 
    deployProject,
    JaolaCognitiveRuntime 
} from './agents/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'jaola-super-secret-key-98745';

const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] } // فتح الـ CORS للسوكيت بالكامل عبر البروكسي
});

app.use(cors()); // فتح الـ CORS لجميع مسارات Express
app.use(express.json());
// 🟢 تقديم ملفات الواجهة الأمامية الثابتة
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// 🟢 إعادة جميع المسارات غير المعروفة إلى index.html (لتطبيقات SPA)
app.get('*', (req, res, next) => {
  // استثناء مسارات الـ API حتى لا يتعارض
  if (req.path.startsWith('/api') || req.path.startsWith('/workspace')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// تهيئة محرك الإدراك المعرفي الشامل لـ JCOS v4.0
const runtime = new JaolaCognitiveRuntime(io);

// مفتاح التحقق الصارم والذكي من نجاح الاتصال الفعلي بقاعدة البيانات
let isDbConnected = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jaola_os';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('💾 [Database]: متصل بنواة MongoDB بنجاح.');
        isDbConnected = true; 
    })
    .catch((err) => {
        console.log('⚠️ [Database]: وضع الاستعداد المحلي (الـ VPS) نشط تلقائياً، والمنصة تعمل بنظام الصمود المؤقت.');
        isDbConnected = false;
    });

// غلاف البيانات الموحد لحظر الانهيارات الصامتة لمونجوس عند غياب الـ DB
const DB = {
    async findUser(username) {
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try { return await User.findOne({ username }); } catch (e) {}
        }
        return { id: 'mock_user_id', username, email: `${username}@jaola-twin.io` };
    },
    async createUser(username) {
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try { return await User.create({ username, email: `${username}@jaola-twin.io` }); } catch (e) {}
        }
        return { id: 'mock_user_id', username, email: `${username}@jaola-twin.io` };
    },
    async findProject(name, owner) {
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try { return await Project.findOne({ name, owner }); } catch (e) {}
        }
        return { name, owner, vercelUrl: '' };
    },
    async findUserProjects(owner) {
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try { return await Project.find({ owner }).lean(); } catch (e) {}
        }
        return [{ name: 'sandbox_app', owner }];
    },
    async createProject(name, owner) {
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try { return await Project.create({ name, owner }); } catch (e) {}
        }
        return { name, owner, vercelUrl: '' };
    }
};

const BASE_WORKSPACE = path.resolve(__dirname, '../workspace');
if (!fs.existsSync(BASE_WORKSPACE)) fs.mkdirSync(BASE_WORKSPACE);

// إعادة هيكلة المسار ليكون معزولاً فيزيائياً بإنشاء مجلد مخصص لكل مستخدم وبداخله مشاريعه (True Isolation)
const getProjectPath = (username, activeProject) => {
    const user = username || 'guest_user';
    const userPath = path.join(BASE_WORKSPACE, user);
    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });

    const projectPath = path.join(userPath, activeProject || 'sandbox_app');
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    return projectPath;
};

// ==========================================
// 🛡️ الوسائط الأمنية (Security Middlewares)
// ==========================================

const aiLimit = rateLimit({
    windowMs: 60 * 1000, 
    max: 10, 
    keyGenerator: (req) => req.user?.id || 'anonymous', 
    handler: (req, res) => res.status(429).json({ 
        error: 'API_QUOTA_EXHAUSTED', 
        details: 'لقد تجاوزت حد استهلاك طلبات الـ AI للدقيقة الحالية. يرجى الانتظار قليلاً.' 
    })
});

export function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = { id: 'guest_user_id', username: 'guest_user', email: 'guest@jaola-twin.io' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = { id: 'guest_user_id', username: 'guest_user', email: 'guest@jaola-twin.io' };
            return next();
        }
        req.user = user;
        next();
    });
}

async function validateProjectOwnership(req, res, next) {
    const { project } = req.body;
    const activeProj = project || req.query.project || 'sandbox_app';
    const username = req.user.username;

    const projectRecord = await DB.findProject(activeProj, username);
    if (!projectRecord && activeProj !== 'sandbox_app') {
        return res.status(403).json({ error: 'غير مصرح بالوصول: هذا المشروع لا يخص حسابك.' });
    }
    
    req.projectPath = getProjectPath(username, activeProj); 
    req.activeProject = activeProj;
    next();
}

function createBackupSnapshot(projectPath, fileName) {
    const filePath = path.join(projectPath, fileName);
    if (!fs.existsSync(filePath)) return;

    const backupDir = path.join(projectPath, '.backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = Date.now();
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`);
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

const emitWorkspaceFiles = (roomName, projectPath, force = false) => {
    try {
        const files = fs.readdirSync(projectPath).filter(f => f !== '.backups');
        io.to(roomName).emit('workspace_files', files);
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() }); 
    } catch (e) {}
};

const emitUserProjects = async (roomName, username, activeProject) => {
    try {
        let projects = ['sandbox_app'];
        let currentVercelUrl = '';

        const projectsData = await DB.findUserProjects(username);
        if (projectsData.length > 0) projects = projectsData.map(p => p.name);
        const currentProjRecord = projectsData.find(p => p.name === activeProject);
        if (currentProjRecord) currentVercelUrl = currentProjRecord.vercelUrl || '';
        
        io.to(roomName).emit('user_projects', { 
            projects, 
            activeProject, 
            currentUser: username, 
            vercelUrl: currentVercelUrl 
        });
    } catch (err) {}
};

// ==========================================
// 🔌 تأمين اتصالات ومصادقة الـ WebSockets
// ==========================================

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('صلاحية الاتصال مفقودة (Token Required)'));

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error('اتصال سوكيت غير مصرح به (Unauthorized)'));
        socket.user = user; 
        next();
    });
});

io.on('connection', (socket) => {
    
    socket.on('join_project', async ({ project }) => {
        const username = socket.user.username;
        const sanitizedProject = (project || 'sandbox_app').trim().toLowerCase().replace(/\s+/g, '-');
        
        const projectRecord = await DB.findProject(sanitizedProject, username);
        if (!projectRecord && sanitizedProject !== 'sandbox_app') {
            socket.emit('log', { message: `❌ [ERROR]: غير مصرح لك بالانضمام للمشروع (${sanitizedProject}).` });
            return;
        }

        const roomName = `${username}-${sanitizedProject}`;
        
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomName);
        socket.roomName = roomName;
        socket.activeProject = sanitizedProject;

        const projectPath = getProjectPath(username, sanitizedProject); 
        emitWorkspaceFiles(roomName, projectPath, true);
        await emitUserProjects(roomName, username, sanitizedProject);

        // جلب وبث تاريخ المحادثة التراكمي للمستخدم من الأطلس لإنعاش الذاكرة المعرفية حراً
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try {
                const convo = await Conversation.findOne({ username });
                if (convo && convo.messages.length > 0) {
                    socket.emit('chat_history', convo.messages); 
                }
            } catch (e) {
                console.error('Failed to emit chat history:', e);
            }
        }
    });
});

// ==========================================
// 🌐 المسارات البرمجية الموثوقة (Secure Routes)
// ==========================================

app.get('/workspace', (req, res) => {
    const { project, username } = req.query;
    const projectPath = getProjectPath(username, project);
    const filePath = path.join(projectPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('index.html not found');
});

app.get('/workspace/:file(*)', (req, res) => {
    const { project, username } = req.query;
    const projectPath = getProjectPath(username, project);
    
    const safeFile = path.normalize(req.params.file).replace(/^(\.\.[\/\\])+/, '').replace(/^\/+/, '');
    const filePath = path.join(projectPath, safeFile);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('File not found');
});

app.post('/api/auth/login', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    try {
        const sanitizedUser = username.trim().toLowerCase().replace(/\s+/g, '_');
        const userRecord = await DB.findUser(sanitizedUser);
        const tokenUserPayload = { id: userRecord.id || userRecord._id, username: sanitizedUser, email: userRecord.email };

        const token = jwt.sign(tokenUserPayload, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, currentUser: sanitizedUser, activeProject: 'sandbox_app' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/project-context/switch', verifyToken, async (req, res) => {
    const { project } = req.body;
    const username = req.user.username;
    const activeProject = project ? project.trim().toLowerCase().replace(/\s+/g, '-') : 'sandbox_app';

    try {
        const projectRecord = await DB.findProject(activeProject, username);
        if (!projectRecord) {
            await DB.createProject(activeProject, username);
        }
    } catch(e) {}

    res.json({ success: true, currentUser: username, activeProject });
});

app.get('/api/file-content', verifyToken, async (req, res) => {
    try {
        const { fileName, project } = req.query;
        const username = req.user.username;
        const activeProj = project || 'sandbox_app';

        const projectRecord = await DB.findProject(activeProj, username);
        if (!projectRecord && activeProj !== 'sandbox_app') {
            return res.status(403).json({ error: 'Access Denied: You do not own this project.' });
        }

        const projectPath = getProjectPath(username, activeProj);
        const filePath = path.resolve(projectPath, fileName || 'index.html');

        if (!filePath.startsWith(projectPath)) {
            return res.status(403).json({ error: 'Access denied: Out of workspace bounds' });
        }

        return res.json({ content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/file-content/save', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { fileName, content } = req.body;
        if (!fileName || typeof content !== 'string') {
            return res.status(400).json({ error: 'Filename and content are required' });
        }
        
        const projectPath = req.projectPath;
        const filePath = path.resolve(projectPath, fileName);

        if (!filePath.startsWith(projectPath)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        createBackupSnapshot(projectPath, fileName);
        fs.writeFileSync(filePath, content);
        
        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, projectPath, true);
        
        io.to(roomName).emit('log', { message: `💾 [SYSTEM]: تم حفظ لقطة احتياطية وحفظ الكود اليدوي بملف (${fileName}) بنجاح.` });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat', verifyToken, aiLimit, validateProjectOwnership, async (req, res) => {
    const { message } = req.body;
    const projectPath = req.projectPath;
    const roomName = `${req.user.username}-${req.activeProject}`;
    
    res.json({ accepted: true });

    const agents = { coreClassifyIntent, coreGenerateCodePlan, architectReview, qaVerify, deployProject };
    const dbStatus = isDbConnected && mongoose.connection.readyState === 1;

    const data = {
        message,
        roomName,
        projectPath,
        username: req.user.username,
        activeProject: req.activeProject
    };

    try {
        await runtime.handleUserMessage(null, data, agents, dbStatus);
    } catch (error) {
        io.to(roomName).emit('log', { message: `❌ [ERROR]: فشل تشغيل المحادثة: ${error.message}` });
    }
});

httpServer.listen(4000, '0.0.0.0', () => console.log('🟢 JAOLA OS Unified Server Active on Port 4000'));
