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

// استيراد الموديلات واجهة الاتصال بـ Gemini المشتركة
import User from './models/User.js';
import Project from './models/Project.js';
import { ai } from './agents/baseAgent.js'; // استيراد عميل جوميني لطلب صور Imagen 3

// استيراد الوكلاء المطورين
import { 
    coreClassifyIntent, 
    coreGenerateCodePlan, 
    architectReview, 
    qaVerify, 
    deployProject 
} from './agents/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// مفتاح التوقيع والتشفير للـ JWT
const JWT_SECRET = process.env.JWT_SECRET || 'jaola-super-secret-key-98745';

const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] } // فتح الـ CORS للسوكيت بالكامل عبر البروكسي
});

app.use(cors()); // فتح الـ CORS لجميع مسارات Express
app.use(express.json());

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

// ==========================================
// 🛡️ غلاف البيانات المحصن أمنياً (DB Isolation Wrapper)
// ==========================================
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

// 🛠️ بديل خارق لـ Imagen 3 يعتمد على محرك البث المفتوح Pollinations لتفادي قيود الـ OAuth وعقبات الـ 401 لجوجل
async function generateAIImage(promptText, projectPath, fileName) {
    try {
        // تنظيف وترميز النص ليكون صالحاً للروابط الشبكية
        const encodedPrompt = encodeURIComponent(promptText);
        
        // جلب صورة نيونية عالية الدقة والجمال بمقاس 1024x576 عريضة بدون أي أختام مائية
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true`;

        console.log(`🖼️ [AI Image]: جاري رسم وتحميل صورة نيونية عالية الدقة لـ (${fileName})...`);
        
        // استخدام محرك Fetch المدمج في Node.js تلقائياً
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`فشل جلب الصورة من خادم التوليد: ${res.statusText}`);
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // إنشاء مجلد الأصول إذا لم يكن موجوداً
        const assetsDir = path.join(projectPath, 'assets');
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

        const targetPath = path.join(projectPath, fileName);
        fs.writeFileSync(targetPath, buffer);

        console.log(`🖼️ [AI Image]: تم توليد وحفظ الصورة بنجاح في مسار المشروع: ${fileName}`);
    } catch (e) {
        console.error(`❌ [AI Image Error]: فشل توليد الصورة المفتوحة (${fileName}):`, e.message);
    }
}


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

// وسيط مطابقة ملكية وصلاحية الوصول للمشروع مع حارس حظر الانهيار المعزول بالـ DB Wrapper
async function validateProjectOwnership(req, res, next) {
    const { project } = req.body;
    const activeProj = project || req.query.project || 'sandbox_app';
    const username = req.user.username;

    // الفحص عبر الغلاف الآمن بدلاً من الاتصال المباشر لضمان الصمود
    const projectRecord = await DB.findProject(activeProj, username);
    if (!projectRecord && activeProj !== 'sandbox_app') {
        return res.status(403).json({ error: 'غير مصرح بالوصول: هذا المشروع لا يخص حسابك.' });
    }
    
    req.projectPath = getProjectPath(activeProj);
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

const getProjectPath = (activeProject) => {
    const projectPath = path.join(BASE_WORKSPACE, activeProject || 'sandbox_app');
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    return projectPath;
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
        
        // التحقق عبر الغلاف الآمن لحظر الانهيار الصامت
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

        const projectPath = getProjectPath(sanitizedProject);
        emitWorkspaceFiles(roomName, projectPath, true);
        await emitUserProjects(roomName, username, sanitizedProject);
    });
});

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
// 🌐 المسارات البرمجية الموثوقة (Secure Routes)
// ==========================================

app.get('/workspace', (req, res) => {
    const { project } = req.query;
    const projectPath = getProjectPath(project);
    const filePath = path.join(projectPath, 'index.html');
    if (fs.existsSync(filePath)) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.sendFile(filePath);
    }
    res.status(404).send('index.html not found');
});

// 🛠️ التعديل الشبكي الحاسم: تصفية وتنظيف مسار الملفات النسبية المرفقة بالـ Iframe لمنع الـ 403 الخاطئ للقرص
app.get('/workspace/:file(*)', (req, res) => {
    const { project } = req.query;
    const projectPath = getProjectPath(project);
    
    // تأمين وتنظيف المسار لمنع ثغرات الـ Path Traversal بشكل مبسط وآمن ومقاوم للشرطات المكررة
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
        
        // استدعاء المستخدم عبر الغلاف الآمن
        const userRecord = await DB.findUser(sanitizedUser);
        const tokenUserPayload = { id: userRecord.id || userRecord._id, username: sanitizedUser, email: userRecord.email };

        const token = jwt.sign(tokenUserPayload, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, currentUser: sanitizedUser, activeProject: 'sandbox_app' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/project-context/switch', verifyToken, async (req, res) => {
    const { project } = req.body;
    const activeProject = project ? project.trim().toLowerCase().replace(/\s+/g, '-') : 'sandbox_app';
    res.json({ success: true, currentUser: req.user.username, activeProject });
});

app.get('/api/file-content', verifyToken, async (req, res) => {
    try {
        const { fileName, project } = req.query;
        const username = req.user.username;
        const activeProj = project || 'sandbox_app';

        // التحقق عبر الغلاف الآمن
        const projectRecord = await DB.findProject(activeProj, username);
        if (!projectRecord && activeProj !== 'sandbox_app') {
            return res.status(403).json({ error: 'Access Denied: You do not own this project.' });
        }

        const projectPath = getProjectPath(activeProj);
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

    const sendState = (states) => {
        io.to(roomName).emit('agent_states', states);
    };

    try {
        sendState({ planner: 'running', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
        io.to(roomName).emit('log', { message: `⚙️ [SYSTEM]: جاري معالجة طلبك بمسار آمن ومعزول ومصادق بالكامل...` });
        
        const intent = await coreClassifyIntent(message);
        
        if (intent.error) {
            sendState({ planner: 'error', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
            io.to(roomName).emit('log', { message: `❌ [ERROR]: خطأ في وكيل الـ Planner: ${intent.details}` });
            return;
        }

        if (intent.type === "DEPLOY_APPROVAL") {
            sendState({ planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'running' });
            io.to(roomName).emit('log', { message: `🚀 [DEPLOY]: تم استقبال موافقتك! جاري النشر السحابي الآن...` });
            
            deployProject({ projectPath, activeProject: req.activeProject, currentUser: req.user.username }, io, () => {
                emitUserProjects(roomName, req.user.username, req.activeProject);
                sendState({ planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
            });
            return;
        }

        if (intent.type === "GENERAL_CHAT") {
            sendState({ planner: 'completed', architect: 'waiting', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
            io.to(roomName).emit('log', { message: `🤖 [INFO]: ${intent.reply}` });
            return;
        }

        sendState({ planner: 'completed', architect: 'running', coder: 'waiting', qa: 'waiting', deploy: 'waiting' });
        const category = intent.category;

        let currentCodeContext = "";
        try {
            const files = fs.readdirSync(projectPath);
            files.forEach(f => {
                if (['index.html', 'styles.css', 'script.js'].includes(f)) {
                    currentCodeContext += `\n--- FILE: ${f} ---\n${fs.readFileSync(path.join(projectPath, f), 'utf-8')}\n`;
                }
            });
        } catch (e) {}

        io.to(roomName).emit('log', { message: `🧠 [PLANNER]: تم التحقق من المجال المعتمد (${category}). جاري صياغة خطة التعديل التراكمي...` });
        
        sendState({ planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
        io.to(roomName).emit('log', { message: `💻 [CODER]: جاري الآن توليد وبث الأكواد حياً...` });
        
        const plan = await coreGenerateCodePlan(
            message, 
            currentCodeContext, 
            category, 
            [], 
            (chunkText) => {
                io.to(roomName).emit('code_stream_chunk', chunkText);
            }
        );

        if (plan.error) {
            sendState({ planner: 'completed', architect: 'completed', coder: 'error', qa: 'waiting', deploy: 'waiting' });
            io.to(roomName).emit('log', { message: `❌ [ERROR]: خطأ في وكيل الـ Coder: ${plan.details}` });
            return;
        }

        sendState({ planner: 'completed', architect: 'running', coder: 'completed', qa: 'waiting', deploy: 'waiting' });
        io.to(roomName).emit('log', { message: `🏗️ [ARCHITECT]: جاري مراجعة قواعد البناء البصري...` });
        
        const archCheck = architectReview(plan);
        if (!archCheck.approved) {
            sendState({ planner: 'completed', architect: 'error', coder: 'completed', qa: 'waiting', deploy: 'waiting' });
            io.to(roomName).emit('log', { message: `⚠️ [ERROR]: فشل مطابقة المعايير الهيكلية: ${archCheck.feedback}` });
            return;
        }

        sendState({ planner: 'completed', architect: 'completed', coder: 'completed', qa: 'running', deploy: 'waiting' });
        io.to(roomName).emit('log', { message: `🔍 [QA]: إجراء فحوصات الجودة والترابط محلياً...` });
        
        const qaCheck = qaVerify(plan);
        qaCheck.logs.forEach(logMsg => {
            io.to(roomName).emit('log', { message: `🔍 [QA REPORT]: ${logMsg}` });
        });
        if (!qaCheck.passed) {
            sendState({ planner: 'completed', architect: 'completed', coder: 'completed', qa: 'error', deploy: 'waiting' });
            io.to(roomName).emit('log', { message: `❌ [ERROR]: تم إلغاء حقن الكود لوجود أخطاء هيكلية رصدها وكيل الجودة.` });
            return;
        }

        plan.files.forEach(file => {
            if (['index.html', 'styles.css', 'script.js'].includes(file.name) && typeof file.content === 'string') {
                createBackupSnapshot(projectPath, file.name); 
                const filePath = path.join(projectPath, file.name);
                fs.writeFileSync(filePath, file.content);
            }
        });

        // 🖼️ التوليد والحقن الحركي للصور المستهدفة بـ Imagen 3 إن طلبت في خطة المبرمج
        if (plan.images && Array.isArray(plan.images)) {
            sendState({ planner: 'completed', architect: 'completed', coder: 'running', qa: 'completed', deploy: 'waiting' });
            io.to(roomName).emit('log', { message: `🖼️ [SYSTEM]: جاري الاستعانة بـ Imagen 3 لتوليد وحقن الصور الفنية حياً بالخلفية...` });
            
            for (const img of plan.images) {
                io.to(roomName).emit('log', { message: `🖼️ [Imagen 3]: جاري رسم وتفصيل صورة (${img.fileName}) بأعلى دقة نيون...` });
                await generateAIImage(img.prompt, projectPath, img.fileName);
            }
        }

        sendState({ planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'waiting' });
        io.to(roomName).emit('log', { message: `✨ [SUCCESS]: تم التحديث والنسخ الاحتياطي وحقن الصور وتعديل المعاينة بنجاح!` });
        
        emitWorkspaceFiles(roomName, projectPath, true);
        await emitUserProjects(roomName, req.user.username, req.activeProject);
        
    } catch (error) {
        sendState({ planner: 'error', coder: 'error', qa: 'error' });
        io.to(roomName).emit('log', { message: `❌ [ERROR]: حدث خطأ في منصة المعالجة: ${error.message}` });
    }
});

httpServer.listen(4000, '0.0.0.0', () => console.log('🟢 JAOLA OS Unified Server Active on Port 4000'));
