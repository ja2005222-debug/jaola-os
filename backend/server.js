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
    coreEditCodePlan,
    architectReview,
    qaVerify,
    deployProject,
    verifyVercelAuth,
    applyTemplate,
    isFullStackProject,
    deployToRender,
    JaolaCognitiveRuntime
} from './agents/index.js';
import { generatePWA } from './agents/pwaAgent.js';
import { generateBackend, generateFrontendAPIIntegration } from './agents/backendAgent.js';
import { needsBackend } from './agents/knowledgeEngine.js';
import {
    startClarification,
    processAnswer,
    isConfirmation,
    getFinalGoal,
    clearState,
    getState
} from './agents/clarifierAgent.js';

import { schemas, validate, sanitizePath } from './middleware/security.js';
import { abortMission, hasActiveMission } from './services/abortRegistry.js';
import { pushProject, getIntegration, isPlatformRepo } from './services/githubSync.js';
import { encryptSecret, decryptSecret } from './utils/secretVault.js';
import * as oauth from './services/oauthLite.js';
import * as ghFiles from './services/githubFiles.js';
import { teamPlan, BACKEND_TEAM } from './agents/backendTeam/index.js';
import { frontendTeamPlan, FRONTEND_TEAM } from './agents/frontendTeam/index.js';
import { listStarters, selectStarter, resolveStack, STARTERS } from './agents/starterRegistry.js';
import { fetchStarter, fetchRepoFiles, parseRepoUrl } from './agents/starterFetch.js';
import * as siteCms from './services/siteCms.js';
import { buildStaticSiteFromSource, buildDashboardPage } from './services/reactPreview.js';
import { scanProjectFiles, buildProjectBrain, summarizeBrain } from './services/projectBrain.js';
import { getProjectMemory } from './agents/projectMemory.js';
import { setProjectSecret, deleteProjectSecret, getProjectSecretNames, getProjectSecrets } from './services/projectSecrets.js';
import { snapshotWorkspace, restoreWorkspaceIfEmpty } from './services/workspaceStore.js';
import { buildMetricsPayload } from './services/metricsStore.js';
import { queueStatus } from './services/missionQueue.js';
import { getCommitHistory, rollbackToCommit } from './agents/gitAgent.js';
import { adminOnly, isAdminUser } from './middleware/adminOnly.js';
import { orchestrator } from './core/PluginOrchestrator.js';
import { runSystemDiagnostics } from './agents/systemDoctorAgent.js';
import * as adminSvc from './services/adminService.js';
import { canCreateProject } from './services/subscriptionService.js';
import { createBillingRouter } from './routes/billing.js';
import { topLessons } from './services/platformLessons.js';
import { setStateEmitter } from './agents/stateMachine.js';
import { restorePluginsToDisk } from './services/pluginStore.js';
import { onMongoReady } from './services/persistence.js';

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
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,https://jaola-os.onrender.com')
    .split(',')
    .map(o => o.trim());

// 🛠️ Render يوفر رابط الخدمة تلقائياً — نضيفه للأصول المسموحة حتى لا يفشل
// الـ socket بسبب CORS إذا نُسي ضبط ALLOWED_ORIGINS في بيئة الإنتاج
if (process.env.RENDER_EXTERNAL_URL && !ALLOWED_ORIGINS.includes(process.env.RENDER_EXTERNAL_URL)) {
    ALLOWED_ORIGINS.push(process.env.RENDER_EXTERNAL_URL);
}

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
    },
    // 🛠️ تحمّل أعلى لشبكات الجوال المتقلبة: ping كل 25 ثانية ومهلة دقيقة كاملة
    // قبل اعتبار الاتصال ميتاً (الافتراضي 20 ثانية كان يقطع اتصالات الجوال البطيئة)
    pingInterval: 25000,
    pingTimeout: 60000,
    // 🛠️ استرجاع حالة الاتصال: الانقطاعات القصيرة (< دقيقتين) تستعيد الغرف
    // والأحداث الفائتة تلقائياً بدون فقدان أي رسالة
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: false,
    },
});

app.use(cors(corsOptions));
// 💳 Stripe webhook يحتاج الجسم الخام للتحقق من التوقيع — يُسجَّل قبل express.json
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
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

// 📡 بث انتقالات آلة الحالات كأحداث موحدة (MissionAccepted، CodingStarted،
// MissionCompleted...) لغرفة المشروع — لغة واحدة للواجهة بدل الصياغات المتفرقة
setStateEmitter(({ username, project, state, event }) => {
    io.to(`${username}-${project}`).emit('project_state', { project, state, event, at: Date.now() });
});

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
            // localPath مطلوب في المخطط — بدونه كان الإنشاء يفشل صامتاً
            try {
                return await Project.create({ name, owner, localPath: `workspace/${owner}/${name}` });
            } catch (e) {
                console.warn('[DB.createProject] فشل:', e.message);
            }
        }
        return { name, owner, vercelUrl: '' };
    },

    // ─── OAuth: إنشاء/ربط مستخدم بمزوّد خارجي ───────────────────────────
    async upsertOAuthUser({ provider, providerId, username, email, avatar }) {
        const base = (username || `${provider}_user`).replace(/[^a-z0-9_\-]/gi, '_').toLowerCase().slice(0, 20) || `${provider}_user`;
        if (this._isOnline()) {
            try {
                // مطابقة بالمزوّد+المعرّف أولاً، ثم بالبريد لربط حساب موجود
                let user = await User.findOne({ provider, providerId });
                if (!user && email) {
                    user = await User.findOne({ email });
                    if (user) { user.provider = provider; user.providerId = providerId; if (avatar) user.avatar = avatar; await user.save(); }
                }
                if (!user) {
                    // ضمان تفرّد اسم المستخدم
                    let uname = base; let n = 1;
                    while (await User.findOne({ username: uname })) uname = `${base}${n++}`;
                    user = await User.create({ username: uname, email, provider, providerId, avatar });
                }
                return user;
            } catch (e) { console.warn('[DB.upsertOAuthUser] فشل:', e.message); }
        }
        // offline: مستخدم مؤقت في الذاكرة
        const rec = { id: `oauth_${provider}_${providerId}`, username: base, email, provider, providerId, avatar };
        OFFLINE_USERS.set(base, rec);
        return rec;
    },

    // ─── تخزين توكن GitHub مشفّراً (AES-256-GCM) للوصول للملفات ─────────
    async setGithubToken(username, tokenPlain, githubLogin) {
        const enc = tokenPlain ? encryptSecret(tokenPlain) : null;
        if (this._isOnline()) {
            try { await User.updateOne({ username }, { $set: { githubToken: enc, githubLogin } }); return true; }
            catch (e) { console.warn('[DB.setGithubToken] فشل:', e.message); }
        }
        OFFLINE_GH_TOKENS.set(username, { enc, githubLogin });
        return true;
    },
    async getGithubToken(username) {
        let enc = null, githubLogin = null;
        if (this._isOnline()) {
            try {
                const u = await User.findOne({ username }).select('githubToken githubLogin').lean();
                enc = u?.githubToken || null; githubLogin = u?.githubLogin || null;
            } catch (e) { /* fallthrough */ }
        }
        if (!enc && OFFLINE_GH_TOKENS.has(username)) {
            const rec = OFFLINE_GH_TOKENS.get(username); enc = rec.enc; githubLogin = rec.githubLogin;
        }
        if (!enc) return null;
        try { return { token: decryptSecret(enc), githubLogin }; }
        catch { return null; }
    }
};

// مخازن offline مؤقتة (بلا Mongo) — لا تدوم بعد إعادة التشغيل
const OFFLINE_USERS = new Map();
const OFFLINE_GH_TOKENS = new Map();

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

    // 🛠️ وضع offline (MongoDB غير متصل): المستخدم المصادق يملك مشاريعه —
    // العزل يتم بمجلده (workspace/<username>/...) لا بقاعدة البيانات.
    // بدون هذا كان كل مشروع مخصص يُرفض إذا لم يتصل Mongo على Render.
    if (!DB._isOnline()) {
        if (req.user.id === 'guest' || username === 'guest_user') {
            return res.status(403).json({ error: 'سجّل الدخول للعمل على المشاريع المخصصة.' });
        }
        req.projectPath = getProjectPath(username, safeProject);
        req.activeProject = safeProject;
        return next();
    }

    let projectRecord = await DB.findProject(safeProject, username);
    // إذا لم يُسجَّل بعد (أُنشئ لكن فشل الحفظ سابقاً) — سجّله الآن بدل الرفض
    if (!projectRecord) {
        projectRecord = await DB.createProject(safeProject, username);
    }
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

    // تسطيح المسارات المتداخلة (css/styles.css → css__styles.css) حتى لا تكسر مجلد النسخ
    const flatName = fileName.split(path.sep).join('__').split('/').join('__');
    const backupPath = path.join(backupDir, `${flatName}.${Date.now()}.bak`);

    try {
        fs.copyFileSync(filePath, backupPath);

        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith(flatName))
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
        // وضع offline: المستخدم المصادق يملك مشاريعه (معزولة بمجلده) — لا نرفضه
        if (safeProject !== 'sandbox_app' && DB._isOnline()) {
            let projectRecord = await DB.findProject(safeProject, username);
            if (!projectRecord) projectRecord = await DB.createProject(safeProject, username);
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

        // 🗄️ استعادة ملفات المشروع من MongoDB إذا مُسح القرص (إعادة نشر Render)
        try {
            const restored = await restoreWorkspaceIfEmpty(username, safeProject, projectPath);
            if (restored.restored > 0) {
                socket.emit('log', { message: `🗄️ [SYSTEM]: استُعيد مشروعك (${restored.restored} ملف) من النسخة الدائمة.` });
            }
        } catch (e) {}

        emitWorkspaceFiles(roomName, projectPath);
        await emitUserProjects(roomName, username, safeProject);

        // 📊 المقاييس الحقيقية للوحة الذكاء عند الانضمام
        socket.emit('project_metrics', buildMetricsPayload(username, safeProject));

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

    // ⏹️ إيقاف المهمة الجارية عبر الـ socket (بديل فوري لمسار /api/ai/abort)
    socket.on('abort_mission', () => {
        if (!socket.roomName) return;
        const wasActive = abortMission(socket.roomName);
        if (wasActive) {
            io.to(socket.roomName).emit('log', { message: '⏹️ [SYSTEM]: تم استلام طلب إيقاف المهمة...' });
        }
    });
});

// ─── المسارات ─────────────────────────────────────────────────────────

// 🛠️ نبض حياة — يبقي خدمة Render مستيقظة ويتيح فحص الحالة (بدون توكن)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        db: isDbConnected && mongoose.connection.readyState === 1 ? 'connected' : 'offline',
        queue: queueStatus(),
        timestamp: Date.now(),
    });
});

// workspace: يخدم ملفات الـ iframe
// ملاحظة مهمة: لا يمكن استخدام verifyToken هنا لأن <iframe src> لا يرسل
// Authorization header تلقائياً من المتصفح. الحماية تعتمد بدلاً من ذلك على:
// 1. تطهير صارم لاسم المستخدم والمشروع (path traversal محمي)
// 2. الملفات المخدومة للقراءة فقط ولا تحتوي بيانات حساسة (HTML/CSS/JS عامة)
// 🔐 مصادقة المعاينة — كانت /workspace بلا أي تحقق: أي زائر يقرأ ملفات أي
// مستخدم بتغيير query! الهوية الآن من التوكن حصراً (query ?auth= أو من
// Referer للأصول النسبية داخل الـ iframe). الزائر بلا توكن يُحصر في
// sandbox الضيف العامة فقط.
function verifyPreviewAccess(req, res, next) {
    let token = req.query.auth?.toString();
    if (!token) {
        try {
            token = new URL(req.headers.referer || '').searchParams.get('auth');
        } catch (e) { /* لا referer صالح */ }
    }
    if (!token) {
        req.previewUser = 'guest_user'; // زائر: معاينة sandbox الضيف فقط
        return next();
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).send('Unauthorized');
        req.previewUser = user.username; // من التوكن حصراً — لا من query أبداً
        next();
    });
}

app.get('/workspace', verifyPreviewAccess, (req, res) => {
    const username = req.previewUser;
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

app.get('/workspace/:file(*)', verifyPreviewAccess, (req, res) => {
    const username = req.previewUser; // 🔐 من التوكن حصراً
    let project = req.query.project?.toString();

    // إذا لم يصل project (حالة الروابط النسبية)، استخرجه من الـ Referer
    if (!project) {
        try {
            project = new URL(req.headers.referer || '').searchParams.get('project') || 'sandbox_app';
        } catch (e) {
            project = 'sandbox_app';
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
    // لا تُخدَّم الملفات المخفية (.env، .sitecms…) — حماية من تسريب الأسرار
    if (path.basename(safeFile).startsWith('.')) {
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

// ═══════════════════════════════════════════════════════════════════
// 🔑 OAuth — الدخول عبر GitHub / Google
// ═══════════════════════════════════════════════════════════════════

// أي مزوّدين مُهيّئين؟ — الواجهة تُظهر أزرارهم فقط
app.get('/api/auth/providers', (req, res) => {
    res.json({ providers: oauth.configuredProviders() });
});

const oauthRedirectUri = (req, provider) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    return `${proto}://${req.get('host')}/api/auth/${provider}/callback`;
};
const frontendBase = () => (process.env.FRONTEND_URL || '').replace(/\/$/, '');

// 1) بدء التدفّق — إعادة توجيه لصفحة موافقة المزوّد
app.get('/api/auth/:provider', (req, res) => {
    const { provider } = req.params;
    if (!oauth.isProvider(provider)) return res.status(404).json({ error: 'مزوّد غير مدعوم' });
    if (!oauth.providerConfigured(provider)) {
        return res.status(503).json({ error: `${provider} OAuth غير مُهيّأ على الخادم` });
    }
    // state موقّع قصير العمر يمنع CSRF بلا حاجة لجلسة
    const state = jwt.sign({ provider, n: Math.random().toString(36).slice(2) }, JWT_SECRET, { expiresIn: '10m' });
    const url = oauth.getAuthUrl(provider, { state, redirectUri: oauthRedirectUri(req, provider) });
    res.redirect(url);
});

// 2) الـ callback — تبادل الكود، إنشاء/ربط المستخدم، إصدار JWT، العودة للواجهة
app.get('/api/auth/:provider/callback', async (req, res) => {
    const { provider } = req.params;
    const { code, state } = req.query;
    const fail = (msg) => res.redirect(`${frontendBase()}/dashboard?authError=${encodeURIComponent(msg)}`);

    if (!oauth.isProvider(provider) || !oauth.providerConfigured(provider)) return fail('مزوّد غير متاح');
    if (!code) return fail('لم يصل كود المصادقة');
    try {
        const decoded = jwt.verify(state, JWT_SECRET);
        if (decoded.provider !== provider) return fail('state غير صالح');
    } catch { return fail('انتهت صلاحية طلب الدخول — حاول مجدداً'); }

    try {
        const accessToken = await oauth.exchangeCode(provider, { code, redirectUri: oauthRedirectUri(req, provider) });
        const profile = await oauth.fetchProfile(provider, accessToken);
        const user = await DB.upsertOAuthUser({ provider, ...profile });
        const username = (user.username || profile.username || '').toLowerCase();

        // خزّن توكن GitHub مشفّراً لتمكين الوصول للملفات لاحقاً
        if (provider === 'github') {
            await DB.setGithubToken(username, accessToken, profile.username);
        }

        const token = jwt.sign(
            { id: user._id || user.id || username, username, email: user.email || profile.email },
            JWT_SECRET, { expiresIn: '7d' }
        );
        const params = new URLSearchParams({ token, user: username });
        res.redirect(`${frontendBase()}/dashboard?${params.toString()}`);
    } catch (err) {
        console.error('[OAuth callback] فشل:', err.message);
        fail('فشل الدخول عبر ' + provider);
    }
});

// 🆕 إنشاء مشروع جديد — كان المسار مفقوداً بالكامل (الواجهة تناديه فيرجع 404
// فلا يُسجَّل المشروع، ثم كل طلب لاحق عليه يُرفض بـ"غير مصرح").
app.post('/api/projects', verifyToken, async (req, res) => {
    const username = req.user.username;
    if (username === 'guest_user' || req.user.id === 'guest') {
        return res.status(403).json({ error: 'سجّل حساباً للعمل على مشاريع مخصصة.' });
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'اسم المشروع مطلوب.' });
    }
    const safeProject = name.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '-').replace(/^-+|-+$/g, '');
    if (!safeProject || safeProject.length < 2) {
        return res.status(400).json({ error: 'اسم المشروع غير صالح (حرفان على الأقل بالإنجليزية والأرقام).' });
    }
    if (safeProject === 'sandbox_app') {
        return res.status(400).json({ error: 'هذا الاسم محجوز للمشروع الافتراضي.' });
    }

    try {
        const exists = await DB.findProject(safeProject, username);
        if (!exists) {
            // 💳 فرض حدّ الخطة قبل إنشاء مشروع جديد
            const userDoc = await DB.findUser(username);
            const projects = await DB.findUserProjects(username);
            // لا نحسب sandbox_app الافتراضي ضمن الحدّ
            const count = (projects || []).filter(p => p.name !== 'sandbox_app').length;
            const gate = canCreateProject(userDoc, count);
            if (!gate.allowed) {
                return res.status(402).json({ error: gate.reason, code: 'plan_limit', planId: gate.planId, limit: gate.limit });
            }
            await DB.createProject(safeProject, username);
        }

        // إنشاء مجلد المشروع على القرص فوراً
        getProjectPath(username, safeProject);

        res.json({ success: true, currentUser: username, activeProject: safeProject });
    } catch (err) {
        res.status(500).json({ error: 'فشل إنشاء المشروع: ' + err.message });
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

// 🗑️ منطق الحذف الكامل — مشترك بين مسار REST ونية الحذف في الشات
async function deleteProjectCompletely(username, project) {
    const safeProject = (project || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '-');
    if (!safeProject) return { success: false, error: 'اسم المشروع مطلوب.' };
    if (safeProject === 'sandbox_app') {
        return { success: false, error: 'لا يمكن حذف المشروع الافتراضي sandbox_app.' };
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

        return { success: true, deleted: safeProject };
    } catch (err) {
        return { success: false, error: 'فشل حذف المشروع: ' + err.message };
    }
}

app.delete('/api/projects/:name', verifyToken, async (req, res) => {
    const result = await deleteProjectCompletely(req.user.username, req.params.name);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
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

        // التحقق من الملكية (offline: المستخدم المصادق يملك مشاريعه المعزولة بمجلده)
        if (safeProject !== 'sandbox_app' && DB._isOnline()) {
            const projectRecord = await DB.findProject(safeProject, username);
            if (!projectRecord) {
                return res.status(403).json({ error: 'Access Denied: You do not own this project.' });
            }
        }

        const projectPath = getProjectPath(username, safeProject);

        // sanitizePath يدعم المسارات المتداخلة (css/styles.css) ويمنع path traversal
        let filePath;
        try {
            filePath = sanitizePath(fileName || 'index.html', projectPath);
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: Out of workspace bounds.' });
        }

        return res.json({ content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '' });
    } catch (err) {
        res.status(500).json({ error: 'خطأ داخلي.' });
    }
});

app.post('/api/file-content/save', verifyToken, validate(schemas.saveFile), validateProjectOwnership, async (req, res) => {
    try {
        const { fileName, content } = req.body;
        const projectPath = req.projectPath;

        // sanitizePath يدعم المسارات المتداخلة ويمنع path traversal
        let filePath;
        try {
            filePath = sanitizePath(fileName, projectPath);
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied.' });
        }

        const relativeName = path.relative(projectPath, filePath);
        createBackupSnapshot(projectPath, relativeName);

        // إنشاء المجلدات الفرعية إذا كان الملف متداخلاً
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, projectPath);
        io.to(roomName).emit('log', { message: `💾 [SYSTEM]: تم حفظ (${relativeName}) مع نسخة احتياطية.` });

        // 🗄️ تحديث النسخة الدائمة في MongoDB
        snapshotWorkspace(req.user.username, req.activeProject, projectPath).catch(() => {});

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'فشل الحفظ.' });
    }
});

app.post('/api/chat', verifyToken, aiLimit, validate(schemas.sendMessage), validateProjectOwnership, async (req, res) => {
    const { message } = req.body;

    const projectPath = req.projectPath;
    const roomName = `${req.user.username}-${req.activeProject}`;

    res.json({ accepted: true });

    const agents = {
        coreClassifyIntent,
        coreGenerateCodePlan,
        coreEditCodePlan,
        architectReview,
        qaVerify,
        deployProject,
        templateAgent: applyTemplate,
        needsBackend,
        generateBackend,
        generateFrontendAPIIntegration,
        startClarification,
        processAnswer,
        isConfirmation,
        getFinalGoal,
        clearState,
        getState,
        // 🗑️ حذف مشروع كامل من الشات (بعد تأكيد صريح داخل jcr)
        deleteProject: (username, project) => deleteProjectCompletely(username, project),
    };

    const dbStatus = isDbConnected && mongoose.connection.readyState === 1;

    try {
        await runtime.handleUserMessage(null, {
            message: message.trim(),
            roomName,
            projectPath,
            username: req.user.username,
            activeProject: req.activeProject,
            uiLang: req.body.uiLang,
        }, agents, dbStatus);
    } catch (error) {
        io.to(roomName).emit('log', { message: `❌ [ERROR]: ${error.message}` });
    }
});

// 🆕 مسار نشر صريح — أبسط وأوثق من الاعتماد على تصنيف نية AI غامض
import { pushToGitHub } from './agents/gitAgent.js';

import { getProjectSummary } from './agents/stateMachine.js';

app.get('/api/project/state', verifyToken, validateProjectOwnership, async (req, res) => {
    const summary = getProjectSummary(req.user.username, req.activeProject);
    res.json({ success: true, ...summary });
});

// 🔑 أسرار المشروع (مفاتيح أطراف ثالثة مثل Travelpayouts) — مشفّرة، تُكتب في .env
app.get('/api/project/secrets', verifyToken, validateProjectOwnership, (req, res) => {
    res.json({ success: true, keys: getProjectSecretNames(req.user.username, req.activeProject) });
});
app.post('/api/project/secret', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { key, value } = req.body || {};
        await setProjectSecret(req.user.username, req.activeProject, req.projectPath, key, value);
        res.json({ success: true, keys: getProjectSecretNames(req.user.username, req.activeProject) });
    } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/project/secret', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { key } = req.body || {};
        await deleteProjectSecret(req.user.username, req.activeProject, req.projectPath, key);
        res.json({ success: true, keys: getProjectSecretNames(req.user.username, req.activeProject) });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// 🧠 Project Brain — فهم المشروع كاملاً (ملفات + قرارات + أُنجز/متبقٍّ)
app.get('/api/project/brain', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const files = await scanProjectFiles(req.projectPath);
        const mem = getProjectMemory(req.user.username, req.activeProject);
        res.json({ success: true, brain: buildProjectBrain(mem, files) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/github/push', verifyToken, validate(schemas.githubPush), validateProjectOwnership, async (req, res) => {
    const { repoUrl, branch } = req.body;
    const roomName = `${req.user.username}-${req.activeProject}`;

    // repoUrl اختياري الآن — إن لم يُرسل نستخدم التكامل المحفوظ للمشروع
    const integration = await getIntegration(req.user.username, req.activeProject);
    if (!repoUrl && !integration?.repoUrl) {
        return res.status(400).json({ error: 'لا يوجد مستودع مرتبط. اربط المشروع بـ GitHub أولاً أو أرسل repoUrl.' });
    }

    res.json({ accepted: true });

    try {
        io.to(roomName).emit('log', { message: '🐙 [GitHub]: جاري الرفع على GitHub...' });
        const result = await pushProject(req.user.username, req.activeProject, req.projectPath, { repoUrl, branch });
        if (result.success) {
            io.to(roomName).emit('log', { message: `✅ [GitHub]: تم الرفع على ${result.url} (${result.branch})` });
        } else {
            io.to(roomName).emit('log', { message: `❌ [GitHub]: فشل — ${result.error}` });
        }
    } catch (e) {
        io.to(roomName).emit('log', { message: `❌ [GitHub]: ${e.message}` });
    }
});

// 🆕 ربط المشروع بمستودع GitHub — يحفظ PAT مشفراً + إعدادات الدفع التلقائي
app.post('/api/github/connect', verifyToken, validate(schemas.githubConnect), validateProjectOwnership, async (req, res) => {
    const { pat, repoUrl, branch, autoCommit } = req.body;

    if (!isDbConnected || mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'قاعدة البيانات غير متصلة — لا يمكن حفظ إعدادات GitHub حالياً.' });
    }

    // 🛡️ منع ربط المشروع بمستودع المنصّة نفسه — الدفع force على main يمحوها
    if (repoUrl && isPlatformRepo(repoUrl)) {
        return res.status(400).json({ error: 'لا يمكن ربط مشروعك بمستودع المنصّة نفسه (jaola-os). أنشئ مستودعاً جديداً فارغاً خاصاً بمشروعك واربطه به.' });
    }

    try {
        // نبني كائن github كاملاً في الذاكرة بدل المسارات المنقّطة: إن كان
        // الحقل مخزّناً كـ null (مشروع قديم) يفشل "$set: { 'github.autoCommit' }"
        // بخطأ "Cannot create field 'autoCommit' in element {github: null}".
        // الدمج يحفظ الحقول الموجودة (كالتوكن) عند ترك الحقل فارغاً.
        const existing = await Project.findOne(
            { name: req.activeProject, owner: req.user.username }
        ).lean();
        const github = { ...(existing?.github || {}) };
        github.branch = branch;
        github.autoCommit = autoCommit;
        if (repoUrl !== undefined) github.repoUrl = repoUrl;
        if (pat) github.patEncrypted = encryptSecret(pat); // لا يُخزن التوكن خاماً أبداً

        await Project.findOneAndUpdate(
            { name: req.activeProject, owner: req.user.username },
            {
                $set: { github },
                $setOnInsert: { name: req.activeProject, owner: req.user.username, localPath: req.projectPath },
            },
            { upsert: true, new: true }
        );

        const roomName = `${req.user.username}-${req.activeProject}`;
        io.to(roomName).emit('log', { message: `🐙 [GitHub]: تم ربط المشروع${repoUrl ? ` بـ ${repoUrl}` : ''} — الدفع التلقائي ${autoCommit ? 'مفعّل ✅' : 'معطّل'}.` });

        res.json({ success: true, repoUrl: repoUrl || null, branch, autoCommit });
    } catch (err) {
        res.status(500).json({ error: 'فشل حفظ إعدادات GitHub: ' + err.message });
    }
});

// 🆕 حالة تكامل GitHub للمشروع الحالي — لا يُعيد التوكن أبداً
app.get('/api/github/status', verifyToken, validateProjectOwnership, async (req, res) => {
    const integration = await getIntegration(req.user.username, req.activeProject);
    res.json({
        connected: !!integration?.repoUrl,
        repoUrl: integration?.repoUrl || '',
        branch: integration?.branch || 'main',
        autoCommit: integration?.autoCommit ?? true,
        lastCommit: integration?.lastCommit || null,
        hasToken: !!integration?.patEncrypted,
    });
});

// 🆕 الخط الزمني: تاريخ git commits + سجل البنايات الحقيقي
app.get('/api/project/timeline', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const commits = await getCommitHistory(req.projectPath, 20);
        const metrics = buildMetricsPayload(req.user.username, req.activeProject);
        res.json({ success: true, commits, metrics });
    } catch (err) {
        res.status(500).json({ error: 'فشل جلب الخط الزمني: ' + err.message });
    }
});

// 🆕 الاسترجاع لنقطة سابقة (rollback) — يحفظ الحالة الحالية أولاً ثم يسترجع
app.post('/api/project/rollback', verifyToken, validateProjectOwnership, async (req, res) => {
    const { hash } = req.body || {};
    if (!hash || !/^[0-9a-f]{6,40}$/i.test(hash)) {
        return res.status(400).json({ error: 'hash غير صالح.' });
    }

    try {
        const result = await rollbackToCommit(req.projectPath, hash);
        if (!result.success) {
            return res.status(400).json({ error: result.error || 'فشل الاسترجاع.' });
        }

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('log', { message: `⏪ [SYSTEM]: تم الاسترجاع إلى النقطة (${hash}).` });

        // تحديث النسخة الدائمة بعد الاسترجاع
        snapshotWorkspace(req.user.username, req.activeProject, req.projectPath).catch(() => {});

        res.json({ success: true, restoredTo: hash });
    } catch (err) {
        res.status(500).json({ error: 'فشل الاسترجاع: ' + err.message });
    }
});

// 🆕 إيقاف مهمة الـ AI الجارية للمشروع الحالي
app.post('/api/ai/abort', verifyToken, validate(schemas.abortMission), validateProjectOwnership, (req, res) => {
    const roomName = `${req.user.username}-${req.activeProject}`;
    const wasActive = abortMission(roomName);

    if (wasActive) {
        io.to(roomName).emit('log', { message: '⏹️ [SYSTEM]: تم استلام طلب إيقاف المهمة...' });
    }

    res.json({ success: true, aborted: wasActive, message: wasActive ? 'جاري إيقاف المهمة.' : 'لا توجد مهمة نشطة.' });
});

app.post('/api/deploy', verifyToken, validateProjectOwnership, async (req, res) => {
    const roomName = `${req.user.username}-${req.activeProject}`;

    // 🧭 مشاريع full-stack (فيها دوال api/ حقيقية) تُنشر على Render (خادم دائم،
    // بلا حدّ 12 دالة، DB متصلة). نُعيد للواجهة نوع النشر ورابط الزر إن جاهز.
    if (isFullStackProject(req.projectPath)) {
        try {
            const projectSlug = `${req.user.username}-${req.activeProject}`
                .toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
            const r = await deployToRender(
                { projectPath: req.projectPath, projectName: projectSlug, username: req.user.username, activeProject: req.activeProject, hasBackend: true },
                io, roomName
            );
            if (r.success) {
                io.to(roomName).emit('log', { message: `✅ [Render]: جاهز للنشر كخادم دائم — افتح الرابط لإنشائه: ${r.deployUrl}` });
                return res.json({ accepted: true, target: 'render', deployUrl: r.deployUrl, repoUrl: r.repoUrl });
            }
            if (r.needsGitHub) {
                return res.status(409).json({ target: 'render', needsGitHub: true, error: r.error });
            }
            io.to(roomName).emit('log', { message: `❌ [Render]: ${r.error}` });
            return res.status(502).json({ target: 'render', error: r.error });
        } catch (error) {
            io.to(roomName).emit('log', { message: `❌ [Render]: ${error.message}` });
            return res.status(500).json({ target: 'render', error: error.message });
        }
    }

    res.json({ accepted: true, target: 'vercel' });

    try {
        await deployProject(
            {
                projectPath: req.projectPath,
                activeProject: req.activeProject,
                currentUser: req.user.username,
                // 🔑 أسرار المشروع (MONGODB_URI...) تُحقن في دوال Serverless الحيّة
                env: getProjectSecrets(req.user.username, req.activeProject),
            },
            io,
            () => emitUserProjects(roomName, req.user.username, req.activeProject)
        );
    } catch (error) {
        io.to(roomName).emit('log', { message: `❌ [DEPLOY]: خطأ غير متوقع: ${error.message}` });
    }
});

// ─── 💳 مسارات الاشتراكات والدفع (Stripe) — مستخرجة إلى routes/billing.js
// (أول قطعة من التفكيك التزايدي لـ server.js؛ raw middleware للـ webhook
// يبقى مسجلاً أعلاه قبل express.json لأن الترتيب هو ما يحميه)
app.use('/api/billing', createBillingRouter({ verifyToken, DB }));

// ─── 🩺 مسارات المشرف: فحص النظام + إدارة الإضافات ──────────────────
app.get('/api/admin/health', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, report: runSystemDiagnostics() });
});

// 📚 ذاكرة دروس المنصة — ما تعلّمته من كل المشاريع (الأكثر تكراراً أولاً)
app.get('/api/admin/lessons', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, lessons: topLessons(30) });
});

// 🩺 فحص صلاحية Vercel — يؤكّد إعداد التوكن/الفريق قبل النشر (بلا كشف التوكن).
// متاح لأي مستخدم مسجّل (النشر متاح للجميع)، لكن تفاصيل الحساب/الفريق
// تُخفى عن غير المشرف — يرى الجاهزية فقط لا اسم حساب Vercel للمالك.
app.get('/api/deploy/vercel-check', verifyToken, async (req, res) => {
    try {
        const result = await verifyVercelAuth();
        if (!isAdminUser(req.user)) {
            const { account, team, status, ...safe } = result;
            return res.json({ success: true, ...safe });
        }
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/admin/plugins', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, ...orchestrator.status() });
});

app.post('/api/admin/plugins/:name/toggle', verifyToken, adminOnly, (req, res) => {
    const { enabled } = req.body || {};
    const ok = orchestrator.setEnabled(req.params.name, enabled !== false);
    if (!ok) return res.status(404).json({ error: 'الإضافة غير موجودة.' });
    res.json({ success: true, name: req.params.name, enabled: enabled !== false });
});

// 🤖 صناعة وكيل جديد (اسم + تعليمات → إضافة عاملة) ثم إعادة التحميل
app.post('/api/admin/agents', verifyToken, adminOnly, async (req, res) => {
    try {
        const { name, description, instructions, rawCode, temperature, runsOnBuild } = req.body || {};
        if (!name) return res.status(400).json({ error: 'اسم الوكيل مطلوب.' });
        const result = await adminSvc.createAgentPlugin({ name, description, instructions, rawCode, temperature, runsOnBuild });
        const status = await orchestrator.reload();
        res.json({ success: true, ...result, plugins: status });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 📄 قراءة/تعديل/حذف كود إضافة
app.get('/api/admin/plugins/:file/code', verifyToken, adminOnly, async (req, res) => {
    try {
        res.json({ success: true, code: await adminSvc.readPluginCode(req.params.file) });
    } catch (err) { res.status(404).json({ error: err.message }); }
});

app.put('/api/admin/plugins/:file/code', verifyToken, adminOnly, async (req, res) => {
    try {
        await adminSvc.writePluginCode(req.params.file, req.body?.code);
        const status = await orchestrator.reload();
        res.json({ success: true, plugins: status });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/admin/plugins/:file', verifyToken, adminOnly, async (req, res) => {
    try {
        const r = await adminSvc.deletePluginFile(req.params.file);
        const status = await orchestrator.reload();
        res.json({ success: true, ...r, plugins: status });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// 🔄 إعادة تحميل كل الإضافات يدوياً
app.post('/api/admin/plugins/reload', verifyToken, adminOnly, async (req, res) => {
    const status = await orchestrator.reload();
    res.json({ success: true, plugins: status });
});

// 🧪 تجربة وكيل مباشرة من اللوحة
app.post('/api/admin/agents/:name/run', verifyToken, adminOnly, async (req, res) => {
    const handler = orchestrator.getAgent(req.params.name);
    if (!handler) return res.status(404).json({ error: 'الوكيل غير مسجّل.' });
    try {
        const result = await handler(req.body?.input ?? {});
        res.json({ success: true, result });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 👥 فرق الوكلاء (خلفية + أمامية) — عرض العقود وخطة التنفيذ
const serializeAgent = (a) => ({
    id: a.id, role: a.role, icon: a.icon, mission: a.mission,
    responsibilities: a.responsibilities, inputs: a.inputs, outputs: a.outputs,
    rules: a.rules, qualityStandards: a.qualityStandards, cooperation: a.cooperation,
    selfReview: a.selfReview, neverDo: a.neverDo, dependsOn: a.dependsOn,
});
app.get('/api/admin/backend-team', verifyToken, adminOnly, (req, res) => {
    res.json({
        success: true,
        teams: [
            { key: 'backend', label: 'Backend', plan: teamPlan(), agents: BACKEND_TEAM.map(serializeAgent) },
            { key: 'frontend', label: 'Frontend', plan: frontendTeamPlan(), agents: FRONTEND_TEAM.map(serializeAgent) },
        ],
        // توافق خلفي: الحقول القديمة تُشير للفريق الخلفي
        plan: teamPlan(),
        agents: BACKEND_TEAM.map(serializeAgent),
    });
});

// 🧰 Starter Registry (بذرة Marketplace) — القوالب المنسّقة + اختيار المسار
app.get('/api/admin/starters', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, starters: listStarters() });
});

// 📥 استيراد كود قالب حقيقي من GitHub (نصوص فقط، بحدود آمنة)
// يقبل { id } لقالب من السجلّ، أو { repo } لرابط مستودع مباشر.
// يستخدم توكن GitHub المخزّن مشفّراً إن وُجد (يرفع الحدّ + يصل للخاص).
app.post('/api/admin/starters/import', verifyToken, adminOnly, async (req, res) => {
    const { id, repo, ref } = req.body || {};
    try {
        const rec = await DB.getGithubToken(req.user.username).catch(() => null);
        const token = rec?.token || undefined;      // اختياري: القوالب عامة MIT
        const opts = { token, ...(ref ? { ref } : {}) };

        let result;
        if (id) {
            const starter = STARTERS.find((s) => s.id === id);
            if (!starter) return res.status(404).json({ error: 'قالب غير موجود' });
            if (!starter.repo) return res.status(400).json({ error: 'قالب داخليّ (Vanilla) — يُولّده JAOLA مباشرة، لا يُجلب من GitHub.' });
            result = await fetchStarter(starter, opts);
        } else if (repo) {
            const { owner, repo: name } = parseRepoUrl(repo);
            const r = await fetchRepoFiles(owner, name, opts);
            result = { ...r, starter: { repo: `${owner}/${name}` } };
        } else {
            return res.status(400).json({ error: 'أرسل id (من السجلّ) أو repo (رابط مستودع).' });
        }
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// 🗂️ إدارة ملفات المشاريع
app.get('/api/admin/files/tree', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, tree: adminSvc.listWorkspaceTree() });
});

app.get('/api/admin/files/list', verifyToken, adminOnly, (req, res) => {
    const { user, project } = req.query;
    if (!user || !project) return res.status(400).json({ error: 'user و project مطلوبان.' });
    res.json({ success: true, files: adminSvc.listProjectFiles(user, project) });
});

app.get('/api/admin/files/read', verifyToken, adminOnly, async (req, res) => {
    try {
        const { user, project, path: p } = req.query;
        res.json({ success: true, content: await adminSvc.readProjectFile(user, project, p) });
    } catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/admin/files/write', verifyToken, adminOnly, async (req, res) => {
    try {
        const { user, project, path: p, content } = req.body || {};
        await adminSvc.writeProjectFile(user, project, p, content);
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/admin/files', verifyToken, adminOnly, async (req, res) => {
    try {
        const { user, project, path: p } = req.body || {};
        const r = await adminSvc.deleteProjectFile(user, project, p);
        res.json({ success: true, ...r });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// 🐙 إدارة ملفات GitHub من لوحة الأدمِن (عبر توكن المستخدم المخزّن)
// ═══════════════════════════════════════════════════════════════════
const REPO_RE = /^[\w.\-]+\/[\w.\-]+$/;      // owner/repo
const SAFE_PATH_RE = /^[\w.\-\/ ]*$/;         // لا .. ولا أحرف خطيرة
const isSafePath = (p) => typeof p === 'string' && SAFE_PATH_RE.test(p) && !p.includes('..');

async function requireGithubToken(req, res) {
    const rec = await DB.getGithubToken(req.user.username);
    if (!rec || !rec.token) {
        res.status(409).json({ error: 'GITHUB_NOT_LINKED', details: 'لا يوجد حساب GitHub مرتبط. سجّل الدخول عبر GitHub أولاً.' });
        return null;
    }
    return rec;
}

app.get('/api/admin/github/status', verifyToken, adminOnly, async (req, res) => {
    const rec = await DB.getGithubToken(req.user.username);
    res.json({ linked: !!(rec && rec.token), githubLogin: rec?.githubLogin || null });
});

app.get('/api/admin/github/repos', verifyToken, adminOnly, async (req, res) => {
    const rec = await requireGithubToken(req, res); if (!rec) return;
    try { res.json({ repos: await ghFiles.listRepos(rec.token) }); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.get('/api/admin/github/contents', verifyToken, adminOnly, async (req, res) => {
    const rec = await requireGithubToken(req, res); if (!rec) return;
    const { repo, path: p = '' } = req.query;
    if (!REPO_RE.test(repo || '') || !isSafePath(p)) return res.status(400).json({ error: 'مدخلات غير صالحة' });
    try { res.json({ items: await ghFiles.listContents(rec.token, repo, p) }); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.get('/api/admin/github/file', verifyToken, adminOnly, async (req, res) => {
    const rec = await requireGithubToken(req, res); if (!rec) return;
    const { repo, path: p } = req.query;
    if (!REPO_RE.test(repo || '') || !isSafePath(p) || !p) return res.status(400).json({ error: 'مدخلات غير صالحة' });
    try { res.json(await ghFiles.getFile(rec.token, repo, p)); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.put('/api/admin/github/file', verifyToken, adminOnly, async (req, res) => {
    const rec = await requireGithubToken(req, res); if (!rec) return;
    const { repo, path: p, content, message, sha, branch } = req.body || {};
    if (!REPO_RE.test(repo || '') || !isSafePath(p) || !p) return res.status(400).json({ error: 'مدخلات غير صالحة' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'المحتوى مطلوب' });
    if (content.length > 1_000_000) return res.status(413).json({ error: 'الملف كبير جداً (>1MB)' });
    try { res.json({ success: true, ...(await ghFiles.putFile(rec.token, repo, p, content, message, sha, branch)) }); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// 🛠️ Site CMS — لوحة تحكم يديرها عميل الموقع المولَّد (منفصلة عن أدمِن جولا)
//    محميّة بكلمة مرور خاصة بالموقع؛ تحفظ في lib/content.js وتعيد توليد الموقع.
// ═══════════════════════════════════════════════════════════════════
const SITECMS_DIR = path.join(BASE_WORKSPACE, '.sitecms');
const cmsKey = (u, p) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(p || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const cmsCredPath = (u, p) => path.join(SITECMS_DIR, cmsKey(u, p) + '.json');
function readSiteCred(u, p) { try { return JSON.parse(fs.readFileSync(cmsCredPath(u, p), 'utf8')); } catch { return null; } }
function writeSiteCred(u, p, obj) { fs.mkdirSync(SITECMS_DIR, { recursive: true }); fs.writeFileSync(cmsCredPath(u, p), JSON.stringify(obj)); }
function readSiteContent(projectPath) {
    try { const s = fs.readFileSync(path.join(projectPath, 'lib/content.js'), 'utf8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); }
    catch { return null; }
}
// حارس توكن الموقع: يطابق {user,project} في التوكن مع الطلب
function siteAuth(req, res) {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : (req.body?.token || req.query?.token);
    const v = siteCms.verifySiteToken(tok, JWT_SECRET);
    const project = req.body?.project || req.query?.project;
    const username = req.body?.username || req.query?.username;
    if (!v || v.project !== project || v.user !== username) { res.status(401).json({ error: 'غير مصرّح' }); return null; }
    return v;
}
function langOf(username) { try { return getUserLanguage(username) || 'ar'; } catch { return 'ar'; } }

// حالة كلمة المرور (هل عُيّنت؟) — يقرّر الواجهة بين تسجيل الدخول أو التعيين الأول
app.get('/api/site/status', (req, res) => {
    const { username, project } = req.query;
    if (!username || !project) return res.status(400).json({ error: 'مدخلات ناقصة' });
    const cred = readSiteCred(username, project);
    res.json({ hasPassword: !!(cred && cred.password) });
});

// التعيين الأول لكلمة المرور (يتطلّب وجود المشروع، ولا كلمة مرور سابقة)
app.post('/api/site/password', (req, res) => {
    const { username, project, password } = req.body || {};
    if (!username || !project) return res.status(400).json({ error: 'مدخلات ناقصة' });
    if (!fs.existsSync(getProjectPath(username, project))) return res.status(404).json({ error: 'المشروع غير موجود' });
    if (readSiteCred(username, project)?.password) return res.status(409).json({ error: 'كلمة المرور معيّنة — استخدم الدخول' });
    if (typeof password !== 'string' || password.length < 4) return res.status(400).json({ error: 'كلمة مرور قصيرة (٤ أحرف على الأقل)' });
    writeSiteCred(username, project, { password: siteCms.hashPassword(password) });
    res.json({ token: siteCms.signSiteToken({ user: username, project }, JWT_SECRET) });
});

// تسجيل دخول العميل — يتحقّق من كلمة المرور ويُصدر توكناً
app.post('/api/site/auth', (req, res) => {
    const { username, project, password } = req.body || {};
    const cred = readSiteCred(username, project);
    if (!cred || !cred.password || !siteCms.verifyPassword(password, cred.password)) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    res.json({ token: siteCms.signSiteToken({ user: username, project }, JWT_SECRET) });
});

// قراءة محتوى الموقع (للوحة)
app.get('/api/site/content', (req, res) => {
    if (!siteAuth(req, res)) return;
    const content = readSiteContent(getProjectPath(req.query.username, req.query.project));
    if (!content) return res.status(404).json({ error: 'لا يوجد محتوى موقع' });
    res.json({ content });
});

// حفظ تعديلات العميل → دمج بقائمة سماح + إعادة توليد الموقع + اللوحة
app.post('/api/site/content', (req, res) => {
    const v = siteAuth(req, res); if (!v) return;
    const { username, project, content: patch } = req.body || {};
    const projectPath = getProjectPath(username, project);
    const cur = readSiteContent(projectPath);
    if (!cur) return res.status(404).json({ error: 'لا يوجد محتوى موقع' });
    try {
        const next = siteCms.applyContentPatch(cur, patch || {});
        const lang = langOf(username);
        fs.writeFileSync(path.join(projectPath, 'lib/content.js'),
            `// محتوى الموقع — عدّله بحرّية. يملؤه JAOLA بالذكاء حسب مشروعك.\nexport const content = ${JSON.stringify(next, null, 2)};\n`);
        for (const pg of buildStaticSiteFromSource(fs.readFileSync(path.join(projectPath, 'lib/content.js'), 'utf8'), lang)) {
            fs.writeFileSync(path.join(projectPath, pg.name), pg.content);
        }
        fs.writeFileSync(path.join(projectPath, 'dashboard.html'), buildDashboardPage(next, { project, username, lang }));
        try { io.to(`${username}-${sanitizePath(project)}`).emit('preview_updated', { timestamp: Date.now() }); } catch {}
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// رفع صورة → assets/ داخل المشروع → رابط نسبي
app.post('/api/site/asset', (req, res) => {
    const v = siteAuth(req, res); if (!v) return;
    const { username, project, name, dataUrl } = req.body || {};
    const dec = siteCms.decodeDataUrl(dataUrl);
    if (dec.error) return res.status(400).json({ error: dec.error });
    try {
        const projectPath = getProjectPath(username, project);
        fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
        const file = siteCms.safeAssetName(name, dec.ext);
        fs.writeFileSync(path.join(projectPath, 'assets', file), dec.buf);
        res.json({ url: `assets/${file}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── معالج أخطاء عام ────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
});

// 🔌 تحميل الإضافات ثم تشغيل الخادم
orchestrator.init().catch(e => console.warn('[Plugins] init فشل:', e.message)).finally(() => {
    httpServer.listen(4000, '0.0.0.0', () => console.log('🟢 JAOLA OS Server on Port 4000'));
});

// 🗄️ عند جاهزية MongoDB: استعادة الإضافات الدائمة للقرص ثم إعادة تحميلها
// (وكلاؤك المصنوعون من اللوحة ينجون من إعادة نشر Render)
onMongoReady(async () => {
    try {
        const r = await restorePluginsToDisk();
        if (r.restored > 0) await orchestrator.reload();
    } catch (e) { console.warn('[PluginStore] استعادة فشلت:', e.message); }
});
