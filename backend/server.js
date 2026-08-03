import 'dotenv/config';
import './dbConfig.js';

import express from 'express';
import compression from 'compression';
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
import BotTenant from './models/BotTenant.js';
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
import { generateJaolaBot, readBotManifest, buildEmbedBundle } from './agents/jaolaBot.js';
import { mailReady, sendMail, isEmail } from './services/mailer.js';
import { emailQuota, socialQuota, customAgentsMax, aiImagesQuota, customDomainsMax, cryptoWatchlistMax, stockWatchlistMax } from './services/subscriptionService.js';
import { validateDomain, dnsInstructionsFor, attachDomain, domainStatus, detachDomain, readUserDomains, saveUserDomain, removeUserDomain, countUserDomains } from './services/customDomains.js';
import { aiImagesReady, applyAiImages, applyHeroImage, generateProductImage, diagnoseImages } from './services/aiImages.js';
import { checkAiProviders } from './services/aiProviderCheck.js';
import {
    listAgents, upsertAgent, deleteAgent, getAgent,
    buildAgentSystemPrompt, agentToManifest,
} from './services/agentMarket.js';
import { recordExchange, readConversations, conversationSummary } from './services/agentConversations.js';
import {
    readTelegramConfig, saveTelegramConfig, deleteTelegramConfig,
    checkTelegramToken, sendTelegramMessage, validBotToken as isTgToken, validChatId as isTgChat,
} from './services/telegramPublisher.js';
import {
    saveFacebookConfig, deleteFacebookConfig, checkFacebookToken, sendFacebookPost,
    saveXConfig, deleteXConfig, sendXPost, channelsStatus,
} from './services/socialChannels.js';
import {
    schedulePosts, claimDuePosts, markResult, cancelSchedule, readSchedules, listScheduleUsers,
} from './services/postScheduler.js';
import { generateSocialPosts, draftInboxReply, extractSiteFacts } from './agents/marketingAgent.js';
import { signBotToken, verifyBotToken } from './agents/jaolaBotToken.js';
import { genTenantId, isValidTenantId, sanitizeTenantConfig } from './services/botTenants.js';
import { smartChat } from './agents/baseAgent.js';
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
import { recordMessage, recordVisit, readInbox, markSeen, visitSummary, unreadCount } from './services/siteInbox.js';
import { subscribe as subscribeNewsletter, listSubscribers as listNewsletterSubscribers, unsubscribe as unsubscribeNewsletter } from './services/newsletterSubscribers.js';
import { installSiteConnect } from './services/siteConnect.js';
import { applySeoPack } from './agents/seoPack.js';
import { installDataSync } from './services/dataSync.js';
import { readStore as readAppDataStore, writeKey as writeAppDataKey } from './services/appData.js';
import { recordError, recentErrors } from './services/errorLog.js';
import { recordAdminAction, recentAdminActions } from './services/adminAudit.js';
import { listUsers as listAdminUsers, setUserPlan } from './services/adminUsers.js';
import { verifyPassword as verifyProjectPassword, setPassword as setProjectPassword } from './services/projectAuth.js';
import { broadcastPresence } from './services/presence.js';
import { saveAsset, readAsset } from './services/appAssets.js';
import { listMarkets, getAnalysis, getOpportunities, searchCoins, isValidCoinId, MAX_WATCHLIST, SUPPORTED_COINS, TIMEFRAMES, findCoin } from './services/cryptoMarket.js';
import { generateCommentary } from './services/cryptoCommentary.js';
import { saveWatchlistIndex, listWatchlistIndex, markAlerted, shouldAlert } from './services/cryptoAlerts.js';
import { recordSignal, getDueCoinIds, resolveDue, getAccuracy } from './services/signalTrackRecord.js';
import { runTradingBotTickGuarded } from './services/tradingBotEngine.js';
import { getConfig as getTradingBotConfig, saveConfig as saveTradingBotConfig, isReadyToEnable as isTradingBotReadyToEnable } from './services/tradingBotConfig.js';
import { getTokenRegistry as getTradingBotTokenRegistry, upsertToken as upsertTradingBotToken, removeToken as removeTradingBotToken, lookupTokenByAddress as lookupTradingBotTokenByAddress, discoverCandidates as discoverTradingBotCandidates } from './services/tradingBotCoins.js';
import { listTrades as listTradingBotTrades, readPositions as readTradingBotPositions, readHeartbeat as readTradingBotHeartbeat } from './services/tradingBotLedger.js';
import { getCircuitBreakerStatus as getTradingBotCircuitBreakerStatus } from './services/tradingBotCircuitBreaker.js';
import { getPerformanceStats as getTradingBotPerformance, getRecentSkipSummary as getTradingBotSkipSummary } from './services/tradingBotStats.js';
import { listRecords as listCollectionRecords, upsertRecord as upsertCollectionRecord, deleteRecord as deleteCollectionRecord } from './services/appCollections.js';
import { summarize as summarizeBudget, lastMonths as budgetLastMonths, budgetStatus } from './services/budgetStats.js';
import { generateBudgetCommentary } from './services/budgetCommentary.js';
import { registerBudgetProject, listBudgetProjects, markBudgetAlerted, shouldAlertBudget } from './services/budgetAlerts.js';
import {
    listMarkets as listStockMarkets, getAnalysis as getStockAnalysis, getOpportunities as getStockOpportunities,
    searchSymbols, isValidSymbolId, MAX_WATCHLIST as STOCK_MAX_WATCHLIST, SUPPORTED_SYMBOLS, findSymbol,
} from './services/stockMarket.js';
import { generateStockCommentary } from './services/stockCommentary.js';
import { buildStaticSiteFromSource, buildDashboardPage } from './services/reactPreview.js';
import { scanProjectFiles, buildProjectBrain, summarizeBrain } from './services/projectBrain.js';
import { getProjectMemory, getDomainModel } from './agents/projectMemory.js';
import { summarizeModel } from './agents/projectModel.js';
import { librarySummary } from './agents/modelLibrary.js';
import { listClones, getCloneById } from './agents/cloneTemplates/index.js';
import { verifyBehavior } from './agents/behaviorVerifier.js';
import { localizeTemplateFiles } from './agents/templateLocalizer.js';
import { getUserLanguage } from './agents/languageDetector.js';
import { setDomainModel, setCloneTrack, getCloneTrack } from './agents/projectMemory.js';
import { mergeProjectModel } from './agents/projectModel.js';
import { prepareRenderDeploy } from './agents/renderAgent.js';
import { autoDeployFullStack, fullAutomationReady } from './services/deployAutomation.js';
import { assetsFor, injectFaviconTag } from './agents/cloneAssets.js';
import { listLibraries, getLibraryById, injectLibrary } from './agents/libraryRegistry.js';
import { polishHtml } from './agents/polishPack.js';
import { setProjectSecret, deleteProjectSecret, getProjectSecretNames, getProjectSecrets } from './services/projectSecrets.js';
import { snapshotWorkspace, restoreWorkspaceIfEmpty } from './services/workspaceStore.js';
import { recordTurn } from './services/conversationStore.js';
import { buildMetricsPayload } from './services/metricsStore.js';
import { queueStatus } from './services/missionQueue.js';
import { getCommitHistory, rollbackToCommit } from './agents/gitAgent.js';
import { adminOnly, isAdminUser } from './middleware/adminOnly.js';
import { orchestrator } from './core/PluginOrchestrator.js';
import { runSystemDiagnostics } from './agents/systemDoctorAgent.js';
import * as adminSvc from './services/adminService.js';
import { canCreateProject, botAiQuota } from './services/subscriptionService.js';
import { getUsageCount, bumpUsage } from './services/usageMeter.js';
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

// ─── مراقبة أعطال الإنتاج — عطل لا سجل له لا يمكن إصلاحه ───────────
// uncaughtException: حالة الخادم غير موثوقة بعده — سجّل ثم اخرج، فيعيد
// مدير العمليات (Render/Railway) تشغيله نظيفاً بدل الاستمرار في حالة فاسدة.
process.on('uncaughtException', (err) => {
    recordError({ source: 'uncaughtException', message: err?.message, stack: err?.stack });
    console.error('❌ uncaughtException:', err);
    process.exit(1);
});
// unhandledRejection: عادة محصور بطلب واحد (كل مسارات API هنا محميّة بـ
// try/catch) — سجّل واستمر، فلا يُسقط عطل طلب واحد الخادم بأكمله.
process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    recordError({ source: 'unhandledRejection', message: err.message, stack: err.stack });
    console.error('❌ unhandledRejection:', err);
});

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

// نقطة دردشة جولا بوت عامّة: تُستدعى من مواقع الزوّار (origins متعدّدة) —
// نسمح لأي origin لهذا المسار وحده؛ بقيّة المسارات تبقى مقيّدة بـ ALLOWED_ORIGINS.
const OPEN_CORS_PATHS = new Set(['/api/jaola-bot/chat', '/api/agent-chat', '/api/public/site-hit', '/api/public/site-message', '/api/public/data', '/api/public/auth/login', '/api/public/auth/set-password']);
// 🗄️ /api/public/data/:key و/api/public/collections/:name[/:id] بمفاتيح
// ديناميكية في المسار — تطابق بادئة لا مساواة تامّة
const isOpenCorsPath = (p) => OPEN_CORS_PATHS.has(p) || p.startsWith('/api/public/data/') || p.startsWith('/api/public/collections/') || p.startsWith('/api/public/assets/') || p.startsWith('/api/public/crypto/');
const corsDelegate = (req, callback) => {
    if (isOpenCorsPath(req.path)) return callback(null, { origin: true, credentials: false, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] });
    callback(null, corsOptions);
};
app.use(cors(corsDelegate));
// 💳 Stripe webhook يحتاج الجسم الخام للتحقق من التوقيع — يُسجَّل قبل express.json
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
// 🖼️ رفع صور حقيقية (jaola-assets) يحتاج حداً أعلى من الحدّ العام (صورة
// بترميز base64 أثقل ~33% من حجمها الخام) — يُسجَّل قبل express.json العام
app.use('/api/public/assets', express.json({ limit: '6mb' }));
app.use(compression()); // ضغط gzip لكل الاستجابات — واجهة أخف وAPI أسرع
app.use(express.json({ limit: '1mb' })); // حد أقصى لحجم الطلب

// ─── تقديم الواجهة الأمامية الثابتة ────────────────────────────────
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    // index.html بلا كاش (الأصول الأخرى مبصومة بالهاش فآمنة للتخزين الطويل) —
    // يضمن أن كل نشر جديد يصل للمتصفحات فوراً بلا «حزمة قديمة عالقة»
    app.use(express.static(frontendDistPath, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
            else if (/\.(js|css|jpg|png|svg|woff2?)$/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        },
    }));
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
    },

    // ─── 🤖 مستأجرو جولا بوت المستقلّون — ميزة تتطلّب Mongo دائماً (سجلّ
    // متعدّد المستأجرين حقيقي عبر خادم واحد)، بلا مسار offline بديل ───────
    async createBotTenant(ownerUsername, config) {
        if (!this._isOnline()) return null;
        try {
            let tenantId = genTenantId();
            while (await BotTenant.findOne({ tenantId })) tenantId = genTenantId(); // تصادم نادر جداً
            return await BotTenant.create({ tenantId, ownerUsername, ...config });
        } catch (e) { console.warn('[DB.createBotTenant] فشل:', e.message); return null; }
    },
    async findBotTenant(tenantId) {
        if (!this._isOnline() || !isValidTenantId(tenantId)) return null;
        try { return await BotTenant.findOne({ tenantId }); } catch { return null; }
    },
    async listBotTenants(ownerUsername) {
        if (!this._isOnline()) return [];
        try { return await BotTenant.find({ ownerUsername }).sort({ createdAt: -1 }).lean(); } catch { return []; }
    },
    async updateBotTenant(tenantId, ownerUsername, config) {
        if (!this._isOnline()) return null;
        try {
            return await BotTenant.findOneAndUpdate({ tenantId, ownerUsername }, { $set: config }, { new: true });
        } catch { return null; }
    },
    async deleteBotTenant(tenantId, ownerUsername) {
        if (!this._isOnline()) return false;
        try { const r = await BotTenant.deleteOne({ tenantId, ownerUsername }); return r.deletedCount > 0; } catch { return false; }
    },
};

// مخازن offline مؤقتة (بلا Mongo) — لا تدوم بعد إعادة التشغيل
const OFFLINE_USERS = new Map();
const OFFLINE_GH_TOKENS = new Map();

// ─── مسارات الـ workspace على القرص ─────────────────────────────────
const BASE_WORKSPACE = path.resolve(__dirname, '../workspace');
// 📊 عدّادات الاستهلاك الشهرية المقيسة بالخطط (رسائل ذكاء البوت...)
const USAGE_DIR = path.join(BASE_WORKSPACE, '.usage');
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

// Rate limiter لدردشة جولا بوت العامّة (زوّار غير مسجّلين) — مفتاحه IP،
// أشدّ من aiLimit لأن النداء عامّ ويستهلك رصيد الذكاء الاصطناعي.
const botChatLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(200).json({ reply: null }), // تجاوز الحد → يرتدّ الودجت لقاعدته
});

// Rate limiter لنقاط الموقع العامّة (زيارات + رسائل تواصل من مواقع العملاء)
const publicSiteLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(204).end(), // تجاوز الحد → صمت (الموقع لا يتأثر)
});

// Rate limiter لمزامنة بيانات القوالب — أعلى سقفاً (استخدام فعلي: عدّة موظفين
// خلف IP مكتب واحد يحفظون سجلّات باستمرار، لا زيارة/رسالة نادرة)
const appDataLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(204).end(),
});

// Rate limiter لمصادقة قوالب السيستم — سقف منخفض يمنع تخمين كلمة المرور
// (نافذة أطول ومحاولات أقل من appDataLimit عمداً؛ الدخول نادر، التخمين متكرر)
const authLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 15,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ ok: false }),
});

// Rate limiter لرفع صور حقيقية — أقل من appDataLimit عمداً (رفع صورة نادر
// نسبياً مقارنة بحفظ سجلّات مستمر، والصور أثقل على القرص والنطاق الترددي)
const assetLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ error: 'محاولات كثيرة جداً — أعد المحاولة بعد قليل' }),
});

// Rate limiter لتحليل الكريبتو — الكاش الداخلي (cryptoMarket.js) يحمي
// CoinGecko أصلاً من الاستهلاك المفرط عبر كل المستخدمين معاً؛ هذا سقف
// إضافي ضد إساءة استخدام نقطة النهاية نفسها من مشروع واحد.
const cryptoLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ error: 'محاولات كثيرة جداً — أعد المحاولة بعد قليل' }),
});
// أخفّ (بحث أثناء الكتابة قد يتكرر كثيراً؛ كاش cryptoMarket.js لا يزال يمتصّ التكرار الفعلي على CoinGecko)
const cryptoSearchLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ coins: [] }),
});
// أشدّ (كل نداء تعليق يستهلك من حصة الذكاء الاصطناعي الشهرية للمالك)
const cryptoCommentaryLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.json({ text: null }),
});

// نفس حدود مستشار الكريبتو أعلاه، بنسخ منفصلة كي لا تتشارك حصة معدّل واحدة
// بين مستشاري الكريبتو والأسهم/الفوركس لمستخدم يستخدم كليهما معاً.
const stockLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ error: 'محاولات كثيرة جداً — أعد المحاولة بعد قليل' }),
});
const stockSearchLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ coins: [] }),
});
const stockCommentaryLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => ipKeyGenerator(req),
    handler: (req, res) => res.json({ text: null }),
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
        broadcastPresence(io, roomName);

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

        // استعادة تاريخ المحادثة — لكل مشروع (username::project) حتى لا تظهر
        // «الطبقة القديمة» من مشاريع أخرى مع كل تحديث
        if (isDbConnected && mongoose.connection.readyState === 1) {
            try {
                const convo = await Conversation.findOne({ username: `${username}::${safeProject}` });
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

    // 👥 عند قطع الاتصال، Socket.IO يزيل المقبس من غرفه تلقائياً قبل هذا
    // الحدث — البثّ هنا يعكس العدد الصحيح لمن تبقّى.
    socket.on('disconnect', () => {
        if (socket.roomName) broadcastPresence(io, socket.roomName);
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

// ═══════════════════════════════════════════════════════════════════
// 🧩 سوق صناعة الوكلاء — المستخدم يصنع وكلاءه (شخصية + معرفة) ويضمّنهم
//    في أي موقع. الإنشاء بسقف الخطة، والدردشة بحصة ذكاء البوت نفسها.
// ═══════════════════════════════════════════════════════════════════
const AGENTS_DIR = path.join(BASE_WORKSPACE, '.agents');
const AGENTCONVO_DIR = path.join(BASE_WORKSPACE, '.agentconvo');

app.get('/api/agents', verifyToken, async (req, res) => {
    const username = req.user.username;
    const owner = await DB.findUser(username).catch(() => null);
    const { max } = customAgentsMax(owner);
    const base = publicBaseOf(req);
    const agents = listAgents(AGENTS_DIR, username).map(a => ({
        ...a,
        embedUrl: `${base}/api/agents/embed.js?id=${encodeURIComponent(signBotToken({ u: username, a: a.id }))}`,
    }));
    res.json({ success: true, agents, used: agents.length, max: Number.isFinite(max) ? max : null });
});

app.post('/api/agents', verifyToken, async (req, res) => {
    const username = req.user.username;
    const owner = await DB.findUser(username).catch(() => null);
    const { max } = customAgentsMax(owner);
    const r = upsertAgent(AGENTS_DIR, username, req.body || {}, max);
    if (r.error) return res.status(r.limitReached ? 403 : 400).json({ error: r.error });
    res.json({ success: true, agent: r.agent });
});

app.delete('/api/agents/:id', verifyToken, (req, res) => {
    const r = deleteAgent(AGENTS_DIR, req.user.username, req.params.id);
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ success: true });
});

// 📊 محادثات وكيل معيّن (سجلّ + إحصاء استخدام) — لمالك الوكيل حصراً
app.get('/api/agents/:id/conversations', verifyToken, (req, res) => {
    const agent = getAgent(AGENTS_DIR, req.user.username, req.params.id);
    if (!agent) return res.status(404).json({ error: 'الوكيل غير موجود.' });
    const store = readConversations(AGENTCONVO_DIR, req.user.username, req.params.id);
    res.json({ success: true, exchanges: store.exchanges, summary: conversationSummary(store) });
});

// 🔗 حزمة تضمين الوكيل — نفس ودجت البوت بهوية الوكيل (عامة، بتوكن موقّع)
app.get('/api/agents/embed.js', (req, res) => {
    res.type('application/javascript');
    const claims = verifyBotToken(String(req.query.id || ''));
    if (!claims?.u || !claims?.a) return res.status(404).send('// JAOLA Agent: not found');
    const agent = getAgent(AGENTS_DIR, claims.u, claims.a);
    if (!agent) return res.status(404).send('// JAOLA Agent: not found');
    try {
        const js = buildEmbedBundle(agentToManifest(agent), {
            apiBase: `${publicBaseOf(req)}/api/agent-chat`,
            token: String(req.query.id),
        });
        res.set('Cache-Control', 'public, max-age=300').send(js);
    } catch {
        res.status(500).send('// JAOLA Agent: error');
    }
});

// 💬 دردشة الوكيل العامة — من ودجت أي موقع؛ بحصة ذكاء البوت الشهرية للمالك
app.post('/api/agent-chat', botChatLimit, async (req, res) => {
    try {
        const { message, token } = req.body || {};
        if (!message || typeof message !== 'string' || !message.trim()) return res.status(400).json({ reply: null });
        const claims = verifyBotToken(token);
        if (!claims?.u || !claims?.a) return res.status(401).json({ reply: null });
        const agent = getAgent(AGENTS_DIR, claims.u, claims.a);
        if (!agent) return res.status(404).json({ reply: null });

        const owner = await DB.findUser(claims.u).catch(() => null);
        const quota = botAiQuota(owner);
        if (Number.isFinite(quota.monthly) && getUsageCount(USAGE_DIR, claims.u, 'botAi') >= quota.monthly) {
            return res.json({ reply: null, quota: 'exhausted' });
        }
        // عطل مزوّد الذكاء (رصيد/شبكة) لا يجب أن يمنع تسجيل السؤال في محادثات
        // الوكيل — نعامله كردّ فارغ لا كاستثناء يُسقط بقية المسار.
        let reply = null;
        try {
            reply = await smartChat(
                [{ role: 'system', content: buildAgentSystemPrompt(agent) },
                 { role: 'user', content: message.trim().slice(0, 500) }],
                { max_tokens: 350, temperature: 0.4 }
            );
        } catch { /* يبقى null — يُسجَّل السؤال بلا ردّ أدناه */ }
        const finalReply = (reply || '').toString().trim() || null;
        if (finalReply) { try { bumpUsage(USAGE_DIR, claims.u, 'botAi'); } catch { /* العدّ لا يُسقط الرد */ } }
        try { recordExchange(AGENTCONVO_DIR, claims.u, claims.a, { message: message.trim(), reply: finalReply }); } catch { /* السجلّ لا يُسقط الرد أبداً */ }
        res.json({ reply: finalReply });
    } catch {
        res.status(200).json({ reply: null });
    }
});

// ═══════════════════════════════════════════════════════════════════
// 🎨 هوية الموقع: صور AI حقيقية فوق عقد imageForge + رفع الشعار
// ═══════════════════════════════════════════════════════════════════

// صور AI للعناصر (تستبدل SVG الحتمية أو الفارغة فقط — صور المستخدم لا تُمسّ)
app.post('/api/project/ai-images', verifyToken, aiLimit, validateProjectOwnership, async (req, res) => {
    try {
        if (!aiImagesReady()) {
            return res.status(503).json({ error: 'مزوّد الصور غير مُفعّل — اضبط GEMINI_API_KEY (يفتح صور Gemini) أو OPENAI_API_KEY في بيئة الخادم.', notConfigured: true });
        }
        const appPath = path.join(req.projectPath, 'app.js');
        if (!fs.existsSync(appPath)) return res.status(404).json({ error: 'لا app.js في المشروع — هذه الميزة لمواقع القوالب.' });

        const username = req.user.username;
        const owner = await DB.findUser(username).catch(() => null);
        const q = aiImagesQuota(owner);
        let allowed = Infinity;
        // 🔓 المشرف (مالك المنصة) بلا حصة — العدّ للعملاء المدفوعين
        if (!isAdminUser(req.user) && Number.isFinite(q.monthly)) {
            allowed = Math.max(0, q.monthly - getUsageCount(USAGE_DIR, username, 'aiImages'));
            if (allowed === 0) return res.status(403).json({ error: `حصة صور AI لخطتك (${q.monthly}/شهر) نفدت — رقِّ خطتك.` });
        }

        const files = [{ name: 'app.js', content: fs.readFileSync(appPath, 'utf8') }];
        const r = await applyAiImages(files, { goal: req.activeProject, maxCount: allowed });
        if (r.notConfigured) return res.status(503).json({ error: r.reason, notConfigured: true });
        if (!r.changed) {
            const why = r.reason || 'لا عناصر مؤهّلة للتوليد.';
            io.to(`${req.user.username}-${req.activeProject}`).emit('log', { message: `❌ [SYSTEM]: تعذّر توليد الصور — ${why}` });
            return res.status(400).json({ error: why });
        }

        fs.mkdirSync(path.join(req.projectPath, 'images'), { recursive: true });
        cleanupOldAiImages(req.projectPath, r.images);
        for (const img of r.images) fs.writeFileSync(path.join(req.projectPath, img.name), img.buf);
        fs.writeFileSync(appPath, r.appJs);
        for (let i = 0; i < r.count; i++) bumpUsage(USAGE_DIR, username, 'aiImages');

        const roomName = `${username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        io.to(roomName).emit('log', { message: `🎨 [SYSTEM]: وُلّدت ${r.count} صورة حقيقية بالذكاء واستُبدلت بالصور المؤقتة.` });
        snapshotWorkspace(username, req.activeProject, req.projectPath).catch(() => {});
        res.json({ success: true, count: r.count });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر توليد الصور: ' + err.message });
    }
});

/**
 * 🎨 توليد الصور من الشات — نفس محرّك زر «ولّد صوراً حقيقية» لكن يُستدعى
 * حين يطلب المستخدم الصور كلاماً («انشئ صورة حقيقية»، «غير صورة البنر»).
 * hero=true → صورة بنر واحدة من نص الطلب تُثبَّت خلفيةً لقسم الـ hero،
 * ثم تُستبدل صور العناصر المؤهّلة إن وُجد app.js. يرد في الشات دائماً.
 */
/** يحذف الأجيال السابقة لصور نفس العناصر (الأسماء فريدة لكل توليد). */
function cleanupOldAiImages(projectPath, images) {
    const dir = path.join(projectPath, 'images');
    if (!fs.existsSync(dir)) return;
    for (const img of images) {
        if (!img.key) continue;
        const esc = String(img.key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^ai-${esc}(?:\\.|-[a-z0-9]+\\.)`);
        try {
            for (const f of fs.readdirSync(dir)) {
                if (re.test(f) && `images/${f}` !== img.name) fs.unlinkSync(path.join(dir, f));
            }
        } catch (e) { /* تنظيف اختياري */ }
    }
}

const aiImagesBusyRooms = new Set(); // 🔒 طلبات متكررة متزامنة لا تحرق الحصة مرتين
async function generateAiImagesFromChat({ username, activeProject, projectPath, roomName, message, hero, target, isAdmin = false }) {
    // 💬 نحفظ الدورة في ذاكرة المشروع — وإلا اختفت «تم! ولّدت…» مع أول تحديث
    const say = (m) => {
        io.to(roomName).emit('chat_reply', { message: m });
        recordTurn(`${username}::${activeProject}`, message || 'صور', m).catch(() => {});
    };
    if (aiImagesBusyRooms.has(roomName)) {
        say('⏳ توليد صور سابق ما زال يعمل على هذا المشروع — انتظر رده ثم اطلب من جديد.');
        return;
    }
    aiImagesBusyRooms.add(roomName);
    try {
        if (!aiImagesReady()) {
            say('⚙️ توليد الصور غير مُفعّل بعد — اضبط GEMINI_API_KEY (يفتح صور Gemini) أو OPENAI_API_KEY في بيئة الخادم.');
            return;
        }
        const owner = await DB.findUser(username).catch(() => null);
        const q = aiImagesQuota(owner);
        let allowed = Infinity;
        // 🔓 المشرف (مالك المنصة) بلا حصة — العدّ للعملاء المدفوعين
        if (!isAdmin && Number.isFinite(q.monthly)) {
            allowed = Math.max(0, q.monthly - getUsageCount(USAGE_DIR, username, 'aiImages'));
            if (allowed === 0) { say(`❌ حصة صور AI لخطتك (${q.monthly}/شهر) نفدت — رقِّ خطتك من صفحة الفوترة.`); return; }
        }

        io.to(roomName).emit('log', { message: '🎨 [SYSTEM]: بدأ توليد صور حقيقية بالذكاء...' });
        const done = [];
        const errors = [];

        // ١) صورة البنر إن طُلبت — من نص طلب المستخدم نفسه.
        // اسم فريد لكل توليد: الكتابة على نفس ai-hero.png كانت تُبقي المتصفح
        // على نسخته («البنر لا يتغير» رغم ملف جديد على القرص)
        if (hero && allowed > 0) {
            const r = await generateProductImage(`${message}. Photorealistic wide website hero banner photo, professional, high quality, no text, no letters, no watermark.`);
            if (r.ok) {
                const idxPath = path.join(projectPath, 'index.html');
                const heroName = `images/ai-hero-${Date.now()}.png`;
                const heroRes = fs.existsSync(idxPath) ? applyHeroImage(fs.readFileSync(idxPath, 'utf8'), heroName) : { changed: false, reason: 'لا index.html — ابنِ الموقع أولاً' };
                if (heroRes.changed) {
                    fs.mkdirSync(path.join(projectPath, 'images'), { recursive: true });
                    // إزالة أبنرة سابقة كي لا تتراكم
                    try { for (const f of fs.readdirSync(path.join(projectPath, 'images'))) if (/^ai-hero.*\.png$/.test(f)) fs.unlinkSync(path.join(projectPath, 'images', f)); } catch (e) { /* تنظيف اختياري */ }
                    fs.writeFileSync(path.join(projectPath, heroName), r.buf);
                    fs.writeFileSync(idxPath, heroRes.html);
                    bumpUsage(USAGE_DIR, username, 'aiImages');
                    allowed--;
                    done.push(`صورة البنر (${heroName})`);
                } else errors.push(heroRes.reason);
            } else errors.push(r.error);
        }

        // ٢) صور العناصر (منتجات/أطباق/عقارات...) إن وُجدت مصفوفة بيانات
        const appPath = path.join(projectPath, 'app.js');
        if (!hero && fs.existsSync(appPath) && allowed > 0) {
            const r = await applyAiImages([{ name: 'app.js', content: fs.readFileSync(appPath, 'utf8') }], { goal: activeProject, maxCount: allowed, targetLabel: target || '' });
            if (r.changed) {
                fs.mkdirSync(path.join(projectPath, 'images'), { recursive: true });
                cleanupOldAiImages(projectPath, r.images);
                for (const img of r.images) fs.writeFileSync(path.join(projectPath, img.name), img.buf);
                fs.writeFileSync(appPath, r.appJs);
                for (let i = 0; i < r.count; i++) bumpUsage(USAGE_DIR, username, 'aiImages');
                done.push(`${r.count} صورة للعناصر`);
            } else if (!r.notConfigured && r.reason && !['لا عناصر مؤهّلة', 'لا مصفوفة بيانات', 'بيانات فارغة'].includes(r.reason)) {
                errors.push(r.reason);
            }
        }

        if (done.length) {
            emitWorkspaceFiles(roomName, projectPath);
            io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
            // 🗄️ لقطة دائمة فوراً — وإلا ارتدّ الموقع للنسخة القديمة بعد أي
            // إعادة تشغيل لخادم Render (قرصه مؤقت)
            snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
            say(`🎨 تم! ولّدت: ${done.join(' + ')} واستبدلتها في موقعك — انظر المعاينة.${errors.length ? `\n⚠️ ملاحظة: ${errors[0]}` : ''}`);
        } else {
            say(`❌ لم أستطع توليد الصور: ${errors[0] || 'لا عناصر مؤهّلة (صور موقعك الحالية حقيقية بالفعل ولا تُمسّ). جرّب طلب «صورة البنر» تحديداً.'}`);
        }
    } catch (e) {
        say('❌ تعذّر توليد الصور: ' + e.message);
    } finally {
        aiImagesBusyRooms.delete(roomName);
    }
}

/** 🔬 «شخص الصور» من الشات — يقرأ ملفات المشروع الفعلية ويطبع الحقيقة كاملة. */
function diagnoseAiImagesFromChat({ projectPath, roomName }) {
    const say = (m) => io.to(roomName).emit('chat_reply', { message: m });
    try {
        const appPath = path.join(projectPath, 'app.js');
        const files = fs.existsSync(appPath) ? [{ name: 'app.js', content: fs.readFileSync(appPath, 'utf8') }] : [];
        const d = diagnoseImages(files);
        const imagesDir = path.join(projectPath, 'images');
        const imgFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir).filter(f => f.startsWith('ai-')) : [];
        // البنر: الاسم المضبوط فعلاً في index.html + هل ملفه موجود؟
        let heroLine = '—';
        if (fs.existsSync(path.join(projectPath, 'index.html'))) {
            const hm = fs.readFileSync(path.join(projectPath, 'index.html'), 'utf8').match(/images\/ai-hero[\w-]*\.png/);
            if (hm) heroLine = `${hm[0]} (الملف ${fs.existsSync(path.join(projectPath, hm[0])) ? 'موجود ✅' : 'مفقود ❌'})`;
        }
        if (!d.ok) { say(`🔬 تشخيص الصور:\n- ${d.reason}\n- بنر index.html: ${heroLine}\n- ملفات ai-* على القرص: ${imgFiles.length}`); return; }
        say([
            '🔬 تشخيص الصور:',
            `- مصفوفة البيانات: ${d.seedName} (${d.readable ? d.itemCount + ' عنصر' : '⚠️ تعذّرت قراءتها'})`,
            `- قيم img الحالية: ${d.imgs.join(' | ') || '—'}`,
            `- تمرير المسارات المحلية (imgUrl): ${d.passthrough ? '✅' : '❌ غائب'}`,
            `- مزامن localStorage: ${d.syncBlock ? '✅' : '❌ غائب'}`,
            `- بنر index.html: ${heroLine}`,
            `- ملفات ai-* على القرص: ${imgFiles.length}${imgFiles.length ? ' (' + imgFiles.slice(0, 6).join('، ') + ')' : ''}`,
            '',
            'انسخ هذه الرسالة لدعم المنصة إن بقيت الصور لا تظهر.',
        ].join('\n'));
    } catch (e) {
        say('🔬 تعذّر التشخيص: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🌐 النطاقات الخاصة — ربط نطاق المستخدم بموقعه المنشور على Vercel
// ميزة خطط مدفوعة (المجانية 0). التخزين: workspace/.domains/<user>.json
// ═══════════════════════════════════════════════════════════════════
const DOMAINS_DIR = path.join(BASE_WORKSPACE, '.domains');

app.post('/api/domains', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const username = req.user.username;
        const v = validateDomain(req.body?.domain);
        if (v.error) return res.status(400).json({ error: v.error });

        // 💳 حد الخطة — استبدال نطاق نفس المشروع لا يُحسب إضافة جديدة.
        // 🔓 المشرف (مالك المنصة) بلا حد — العدّ للعملاء المدفوعين
        const owner = await DB.findUser(username).catch(() => null);
        const q = customDomainsMax(owner);
        const existing = readUserDomains(DOMAINS_DIR, username);
        const isReplacing = !!existing[req.activeProject];
        if (!isAdminUser(req.user) && !isReplacing && Number.isFinite(q.max) && countUserDomains(DOMAINS_DIR, username) >= q.max) {
            return res.status(403).json({
                error: q.max === 0
                    ? 'ربط النطاقات الخاصة ميزة الخطط المدفوعة — رقِّ خطتك من صفحة الفوترة.'
                    : `حد النطاقات لخطتك (${q.max}) مكتمل — رقِّ خطتك أو فُكّ نطاقاً آخر.`,
                code: 'plan_limit',
            });
        }

        // استبدال نطاق قديم لنفس المشروع → فكّه من Vercel أولاً (لا يفشل الطلب)
        if (isReplacing && existing[req.activeProject].domain !== v.domain) {
            await detachDomain({ username, project: req.activeProject, domain: existing[req.activeProject].domain }).catch(() => {});
        }

        const r = await attachDomain({ username, project: req.activeProject, domain: v.domain });
        if (r.error) return res.status(r.notConfigured ? 503 : 400).json({ error: r.error, notConfigured: !!r.notConfigured });

        saveUserDomain(DOMAINS_DIR, username, req.activeProject, v.domain);
        const status = await domainStatus({ username, project: req.activeProject, domain: v.domain });
        res.json({ success: true, domain: v.domain, dns: r.dns, verification: r.verification, status: status.status || 'awaiting-dns' });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر ربط النطاق: ' + err.message });
    }
});

app.get('/api/domains', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const username = req.user.username;
        const rec = readUserDomains(DOMAINS_DIR, username)[req.activeProject];
        if (!rec) return res.json({ success: true, none: true });
        const s = await domainStatus({ username, project: req.activeProject, domain: rec.domain });
        if (s.error && !s.notConfigured) {
            return res.json({ success: true, domain: rec.domain, status: 'error', error: s.error, dns: dnsInstructionsFor(rec.domain) });
        }
        res.json({ success: true, domain: rec.domain, status: s.status || 'unknown', dns: s.dns || dnsInstructionsFor(rec.domain), verification: s.verification || [] });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر قراءة حالة النطاق: ' + err.message });
    }
});

app.delete('/api/domains', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const username = req.user.username;
        const rec = readUserDomains(DOMAINS_DIR, username)[req.activeProject];
        if (!rec) return res.status(404).json({ error: 'لا نطاق مربوط بهذا المشروع.' });
        const r = await detachDomain({ username, project: req.activeProject, domain: rec.domain });
        if (r.error && !r.notConfigured) return res.status(400).json({ error: r.error });
        removeUserDomain(DOMAINS_DIR, username, req.activeProject);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر فكّ النطاق: ' + err.message });
    }
});

// رفع شعار الموقع → assets/ + أيقونة المتصفح (favicon)
app.post('/api/project/logo', verifyToken, validateProjectOwnership, (req, res) => {
    try {
        const { name, dataUrl } = req.body || {};
        const dec = siteCms.decodeDataUrl(dataUrl);
        if (dec.error) return res.status(400).json({ error: dec.error });
        const indexPath = path.join(req.projectPath, 'index.html');
        if (!fs.existsSync(indexPath)) return res.status(404).json({ error: 'لا index.html — ابنِ الموقع أولاً.' });

        fs.mkdirSync(path.join(req.projectPath, 'assets'), { recursive: true });
        const file = siteCms.safeAssetName(name || 'logo', dec.ext);
        fs.writeFileSync(path.join(req.projectPath, 'assets', file), dec.buf);
        const href = `assets/${file}`;

        // الأيقونة: استبدال أي favicon قائم، أو حقن وسم جديد
        let html = fs.readFileSync(indexPath, 'utf8');
        if (/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i.test(html)) {
            html = html.replace(/(<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["'])[^"']*(["'])/i, `$1${href}$2`);
        } else {
            html = injectFaviconTag(html, href);
        }
        fs.writeFileSync(indexPath, html);

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        snapshotWorkspace(req.user.username, req.activeProject, req.projectPath).catch(() => {});
        res.json({ success: true, url: href });
    } catch (err) {
        res.status(500).json({ error: 'فشل رفع الشعار: ' + err.message });
    }
});

// 📣 المساعد التسويقي: أسبوع منشورات سوشيال من محتوى الموقع الفعلي
// (ذكاء أولاً + ارتداد حتمي كامل — يعمل حتى مع تعطّل المزوّد)
app.post('/api/marketing/posts', verifyToken, aiLimit, validateProjectOwnership, async (req, res) => {
    try {
        const lang = (req.body?.lang === 'en' || req.body?.lang === 'ar') ? req.body.lang : (langOf(req.user.username) || 'ar');
        const result = await generateSocialPosts(req.projectPath, { lang, goal: req.activeProject });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر توليد المنشورات: ' + err.message });
    }
});

// 📣 مسودّة ردّ على رسالة من صندوق النماذج
app.post('/api/marketing/reply-draft', verifyToken, aiLimit, validateProjectOwnership, async (req, res) => {
    try {
        const { name, message } = req.body || {};
        if (!message || typeof message !== 'string') return res.status(400).json({ error: 'الرسالة مطلوبة' });
        const lang = (req.body?.lang === 'en' || req.body?.lang === 'ar') ? req.body.lang : (langOf(req.user.username) || 'ar');
        const brand = extractSiteFacts(req.projectPath).brand;
        const result = await draftInboxReply({ brand, name, message, lang });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر توليد المسودّة: ' + err.message });
    }
});

const publicBaseOf = (req) => (process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL
    || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

// ═══════════════════════════════════════════════════════════════════
// ✈️ النشر المباشر — تيليجرام (وكلاء القنوات، الجولة ٣ أ)
//    التوكن مشفّر في ملف تكاملات المستخدم ولا يُعاد للواجهة أبداً.
// ═══════════════════════════════════════════════════════════════════
const INTEG_DIR = path.join(BASE_WORKSPACE, '.integrations');

app.get('/api/social/telegram/status', verifyToken, (req, res) => {
    res.json({ success: true, ...readTelegramConfig(INTEG_DIR, req.user.username) });
});

app.post('/api/social/telegram/setup', verifyToken, async (req, res) => {
    const { botToken, chatId } = req.body || {};
    if (!isTgToken(botToken)) return res.status(400).json({ error: 'صيغة توكن البوت غير صحيحة (من @BotFather).' });
    if (!isTgChat(chatId)) return res.status(400).json({ error: 'معرّف القناة غير صالح — مثل ‎@mychannel أو رقم المحادثة.' });
    const check = await checkTelegramToken(String(botToken).trim());
    if (check.error) return res.status(400).json({ error: check.error });
    saveTelegramConfig(INTEG_DIR, req.user.username, { botToken, chatId, botName: check.botName });
    res.json({ success: true, botName: check.botName, chatId: String(chatId).trim() });
});

app.delete('/api/social/telegram', verifyToken, (req, res) => {
    deleteTelegramConfig(INTEG_DIR, req.user.username);
    res.json({ success: true });
});

// 📡 حالة كل قنوات النشر (بلا توكنات)
app.get('/api/social/status', verifyToken, (req, res) => {
    res.json({ success: true, channels: channelsStatus(INTEG_DIR, req.user.username) });
});

// فيسبوك (صفحة Meta): ربط بتوكن الصفحة + تحقق حيّ من اسمها
app.post('/api/social/facebook/setup', verifyToken, async (req, res) => {
    const { pageId, pageToken } = req.body || {};
    if (!/^\d{5,}$/.test(String(pageId || '').trim())) return res.status(400).json({ error: 'معرّف الصفحة رقمي — من إعدادات صفحتك في Meta.' });
    if (typeof pageToken !== 'string' || pageToken.trim().length < 30) return res.status(400).json({ error: 'توكن الصفحة غير صالح.' });
    const check = await checkFacebookToken(String(pageId).trim(), pageToken.trim());
    if (check.error) return res.status(400).json({ error: check.error });
    saveFacebookConfig(INTEG_DIR, req.user.username, { pageId, pageToken, pageName: check.pageName });
    res.json({ success: true, pageName: check.pageName });
});
app.delete('/api/social/facebook', verifyToken, (req, res) => {
    deleteFacebookConfig(INTEG_DIR, req.user.username);
    res.json({ success: true });
});

// X: مفاتيح المطوّر الأربعة للمستخدم (تُختبر عند أول نشر)
app.post('/api/social/x/setup', verifyToken, (req, res) => {
    const r = saveXConfig(INTEG_DIR, req.user.username, req.body || {});
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ success: true });
});
app.delete('/api/social/x', verifyToken, (req, res) => {
    deleteXConfig(INTEG_DIR, req.user.username);
    res.json({ success: true });
});

const CHANNEL_SENDERS = {
    telegram: (user, text) => sendTelegramMessage(INTEG_DIR, user, text),
    facebook: (user, text) => sendFacebookPost(INTEG_DIR, user, text),
    x: (user, text) => sendXPost(INTEG_DIR, user, text),
};

// 🚀 نشر فوري لكل القنوات المطلوبة المربوطة — كل إرسال يُحسب من الحصة
app.post('/api/social/publish', verifyToken, async (req, res) => {
    try {
        const { text, channels } = req.body || {};
        if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'نص المنشور مطلوب.' });
        const username = req.user.username;
        const st = channelsStatus(INTEG_DIR, username);
        const wanted = (Array.isArray(channels) && channels.length ? channels : Object.keys(CHANNEL_SENDERS))
            .filter(c => CHANNEL_SENDERS[c] && st[c]?.configured);
        if (!wanted.length) return res.status(400).json({ error: 'لا قنوات مربوطة — اربط قناة أولاً.' });
        const owner = await DB.findUser(username).catch(() => null);
        const q = socialQuota(owner);
        const results = {};
        for (const ch of wanted) {
            if (Number.isFinite(q.monthly) && getUsageCount(USAGE_DIR, username, 'socialPosts') >= q.monthly) {
                results[ch] = { error: `حصة النشر (${q.monthly}/شهر) نفدت.` };
                continue;
            }
            const r = await CHANNEL_SENDERS[ch](username, text);
            results[ch] = r;
            if (r.ok) bumpUsage(USAGE_DIR, username, 'socialPosts');
        }
        res.json({ success: Object.values(results).some(r => r.ok), results });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر النشر: ' + err.message });
    }
});

// 📅 الجدولة: دفعة منشورات بأوقات مستقبلية للقنوات المختارة
const SCHED_DIR = path.join(BASE_WORKSPACE, '.schedules');
app.post('/api/social/schedule', verifyToken, (req, res) => {
    const { posts, channels } = req.body || {};
    const st = channelsStatus(INTEG_DIR, req.user.username);
    const chans = (Array.isArray(channels) && channels.length ? channels : Object.keys(CHANNEL_SENDERS))
        .filter(c => CHANNEL_SENDERS[c] && st[c]?.configured);
    if (!chans.length) return res.status(400).json({ error: 'لا قنوات مربوطة — اربط قناة أولاً.' });
    const r = schedulePosts(SCHED_DIR, req.user.username,
        (Array.isArray(posts) ? posts : []).map(p => ({ text: p?.text, at: p?.at, channels: chans })));
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ success: true, scheduled: r.scheduled });
});
app.get('/api/social/schedule', verifyToken, (req, res) => {
    res.json({ success: true, items: readSchedules(SCHED_DIR, req.user.username) });
});
app.delete('/api/social/schedule/:id', verifyToken, (req, res) => {
    const r = cancelSchedule(SCHED_DIR, req.user.username, req.params.id);
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ success: true });
});

// نشر منشور واحد في القناة — بحصة الخطة الشهرية (socialPosts)
app.post('/api/social/telegram/publish', verifyToken, async (req, res) => {
    try {
        const { text } = req.body || {};
        if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'نص المنشور مطلوب.' });
        const username = req.user.username;
        const owner = await DB.findUser(username).catch(() => null);
        const q = socialQuota(owner);
        if (Number.isFinite(q.monthly) && getUsageCount(USAGE_DIR, username, 'socialPosts') >= q.monthly) {
            return res.status(403).json({ error: `حصة النشر المباشر لخطتك (${q.monthly}/شهر) نفدت — رقِّ خطتك للمزيد.` });
        }
        const r = await sendTelegramMessage(INTEG_DIR, username, text);
        if (r.error) return res.status(r.notConfigured ? 503 : 502).json(r);
        bumpUsage(USAGE_DIR, username, 'socialPosts');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر النشر: ' + err.message });
    }
});

// 🤖 حالة البوت — هل هو مركَّب؟ وإعداده + كود التضمين لأي موقع خارجي
app.get('/api/jaola-bot/status', verifyToken, validateProjectOwnership, (req, res) => {
    const m = readBotManifest(req.projectPath);
    let embedUrl = null;
    if (m.installed && m.config) {
        const id = signBotToken({ u: req.user.username, p: req.activeProject, b: m.config.brandName });
        embedUrl = `${publicBaseOf(req)}/api/jaola-bot/embed.js?id=${encodeURIComponent(id)}`;
    }
    res.json({ success: true, ...m, embedUrl });
});

// 🔗 المقتطف المُستضاف — سطر واحد يركّب البوت في أي موقع (WordPress/Shopify/مخصّص):
// <script src=".../api/jaola-bot/embed.js?id=..."></script>
// id = توكن موقّع بهوية المشروع؛ الكود يبقى عندنا فتحديث واحد يحسّن كل البوتات.
app.get('/api/jaola-bot/embed.js', (req, res) => {
    res.type('application/javascript');
    const claims = verifyBotToken(String(req.query.id || ''));
    if (!claims?.u || !claims?.p) return res.status(404).send('// JAOLA Bot: not found');
    try {
        const m = readBotManifest(getProjectPath(claims.u, claims.p));
        if (!m.installed || !m.config) return res.status(404).send('// JAOLA Bot: not configured');
        const js = buildEmbedBundle(m.config, {
            apiBase: `${publicBaseOf(req)}/api/jaola-bot/chat`,
            token: String(req.query.id),
        });
        res.set('Cache-Control', 'public, max-age=300').send(js);
    } catch {
        res.status(500).send('// JAOLA Bot: error');
    }
});

// ─── 🤖 مستأجرو جولا بوت المستقلّون (JAOLA_BOT_PRODUCT_ROADMAP.md § 2.2) ───
// عميل من خارج jaola يلصق سطر تضمين واحد في موقعه — بلا مشروع jaola. يتطلّب
// Mongo دائماً (سجلّ مستأجرين حقيقي)؛ لا يمسّ مسار مشاريع jaola الحالي إطلاقاً.
const noDbTenant = (res) => res.status(503).json({ error: 'هذه الميزة تتطلّب اتصالاً دائماً بقاعدة البيانات (غير متاحة الآن).' });

app.post('/api/bot-tenants', verifyToken, async (req, res) => {
    if (!DB._isOnline()) return noDbTenant(res);
    try {
        const cfg = sanitizeTenantConfig(req.body || {});
        const doc = await DB.createBotTenant(req.user.username, cfg);
        if (!doc) return res.status(500).json({ error: 'تعذّر إنشاء المستأجر.' });
        res.json({ success: true, tenantId: doc.tenantId, embedUrl: `${publicBaseOf(req)}/api/jaola-bot/tenant-embed.js?id=${doc.tenantId}` });
    } catch (err) { res.status(500).json({ error: 'تعذّر إنشاء المستأجر: ' + err.message }); }
});

app.get('/api/bot-tenants', verifyToken, async (req, res) => {
    if (!DB._isOnline()) return res.json({ success: true, tenants: [] });
    const list = await DB.listBotTenants(req.user.username);
    const base = publicBaseOf(req);
    res.json({ success: true, tenants: list.map(t => ({ ...t, embedUrl: `${base}/api/jaola-bot/tenant-embed.js?id=${t.tenantId}` })) });
});

app.put('/api/bot-tenants/:id', verifyToken, async (req, res) => {
    if (!DB._isOnline()) return noDbTenant(res);
    if (!isValidTenantId(req.params.id)) return res.status(400).json({ error: 'معرّف غير صالح.' });
    const cfg = sanitizeTenantConfig(req.body || {});
    const doc = await DB.updateBotTenant(req.params.id, req.user.username, cfg);
    if (!doc) return res.status(404).json({ error: 'المستأجر غير موجود أو لا يخصّ حسابك.' });
    res.json({ success: true });
});

app.delete('/api/bot-tenants/:id', verifyToken, async (req, res) => {
    if (!DB._isOnline()) return noDbTenant(res);
    const ok = await DB.deleteBotTenant(req.params.id, req.user.username);
    res.json({ success: ok });
});

// حزمة تضمين مستأجر مستقلّ — سطر واحد في أي موقع خارج jaola تماماً
app.get('/api/jaola-bot/tenant-embed.js', async (req, res) => {
    res.type('application/javascript');
    const tenantId = String(req.query.id || '');
    if (!isValidTenantId(tenantId)) return res.status(404).send('// JAOLA Bot: not found');
    const tenant = await DB.findBotTenant(tenantId);
    if (!tenant) return res.status(404).send('// JAOLA Bot: not found');
    try {
        const js = buildEmbedBundle(
            { brandName: tenant.brandName, emoji: tenant.emoji, welcome: tenant.welcome, quick: tenant.quick, faq: tenant.faq, color: tenant.color, ai: !!tenant.apiEnabled },
            { apiBase: `${publicBaseOf(req)}/api/jaola-bot/chat`, token: tenantId }
        );
        res.set('Cache-Control', 'public, max-age=300').send(js);
    } catch { res.status(500).send('// JAOLA Bot: error'); }
});

// 🤖 إضافة «جولا بوت» عند الطلب لمشروع موجود (مساعد محادثة offline + API-ready)
app.post('/api/jaola-bot/generate', verifyToken, validateProjectOwnership, async (req, res) => {
    const { brandName, emoji, apiBase, faq, quick, welcome, fallback, ai } = req.body || {};
    try {
        // عند تفعيل الذكاء: نضبط apiBase لنقطة الدردشة العامّة ونضمّن توكناً موقّعاً
        // يحمل هوية المشروع — فيردّ البوت بذكاء حيّ مع بقاء قاعدته احتياطاً.
        let liveApiBase, botToken;
        if (ai === true) {
            const publicBase = process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL
                || `${req.protocol}://${req.get('host')}`;
            liveApiBase = `${publicBase.replace(/\/$/, '')}/api/jaola-bot/chat`;
            botToken = signBotToken({ u: req.user.username, p: req.activeProject, b: typeof brandName === 'string' ? brandName.slice(0, 40) : req.activeProject });
        }
        const result = await generateJaolaBot(req.projectPath, {
            brandName: typeof brandName === 'string' ? brandName : undefined,
            emoji: typeof emoji === 'string' ? emoji : undefined,
            apiBase: liveApiBase || (typeof apiBase === 'string' ? apiBase : undefined),
            token: botToken,
            faq: Array.isArray(faq) ? faq : undefined,
            quick: Array.isArray(quick) ? quick : undefined,
            welcome: typeof welcome === 'string' ? welcome : undefined,
            fallback: typeof fallback === 'string' ? fallback : undefined,
        });
        if (!result.success) return res.status(400).json({ error: result.error });

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('log', {
            message: `🤖 [SYSTEM]: تم إضافة المساعد «${result.brandName}» إلى موقعك${result.apiBase ? ' (ذكاء حيّ + قاعدة احتياطية)' : ' (يعمل بقاعدة معرفة داخلية)'}.`
        });
        res.json({ success: true, brandName: result.brandName, apiBase: result.apiBase, ai: !!liveApiBase, files: result.files });
    } catch (err) {
        res.status(500).json({ error: 'فشل إضافة البوت: ' + err.message });
    }
});

// 🤖 دردشة جولا بوت الحيّة — نقطة عامّة يستدعيها الودجت من موقع الزائر.
// آمنة عبر: توكن موقّع (هوية المشروع) + محدّد معدّل صارم + سقف طول الرسالة.
// أي خطأ يعيد reply=null فيرتدّ الودجت لقاعدته الداخلية (لا انقطاع للخدمة).
app.post('/api/jaola-bot/chat', botChatLimit, async (req, res) => {
    try {
        const { message, token } = req.body || {};
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ reply: null });
        }
        // مصدر الهوية: توكن موقّع (مشاريع jaola — المسار الأصلي بلا أي تغيير)،
        // وإلا مستأجر مستقلّ بمعرّفه الخام من السجلّ (خارج jaola تماماً).
        const claims = verifyBotToken(token);
        let ownerUsername, brand, tenantApiEnabled = true;
        if (claims && claims.p) {
            ownerUsername = claims.u;
            brand = (claims.b || claims.p).toString().slice(0, 40);
        } else {
            const tenant = await DB.findBotTenant(String(token || ''));
            if (!tenant) return res.status(401).json({ reply: null });
            ownerUsername = tenant.ownerUsername;
            brand = (tenant.brandName || 'مساعدك').toString().slice(0, 40);
            tenantApiEnabled = !!tenant.apiEnabled;
        }
        if (!tenantApiEnabled) return res.json({ reply: null }); // مستأجر عطّل الذكاء الحيّ — قاعدته الثابتة فقط من طرف العميل

        // 💳 حصة الذكاء الحيّ الشهرية لصاحب الحساب — عند النفاد يرتدّ الودجت
        // لقاعدته الداخلية بصمت (الزائر لا يرى انقطاعاً، والمالك يرقّي خطته)
        if (ownerUsername) {
            const owner = await DB.findUser(ownerUsername).catch(() => null);
            const quota = botAiQuota(owner);
            if (Number.isFinite(quota.monthly) && getUsageCount(USAGE_DIR, ownerUsername, 'botAi') >= quota.monthly) {
                return res.json({ reply: null, quota: 'exhausted' });
            }
        }

        const msg = message.trim().slice(0, 500);
        const system = `أنت مساعد خدمة عملاء لموقع «${brand}». أجب بإيجاز واحترافية وبنفس لغة الزائر (عربي أو إنجليزي حسب سؤاله). التزم بنطاق الموقع وخدماته، ولا تختلق معلومات أو أسعاراً؛ إن لم تكن متأكّداً، اقترح بلطف التواصل المباشر مع الموقع.`;
        const reply = await smartChat(
            [{ role: 'system', content: system }, { role: 'user', content: msg }],
            { max_tokens: 300, temperature: 0.4 }
        );
        const finalReply = (reply || '').toString().trim() || null;
        if (finalReply && ownerUsername) {
            try { bumpUsage(USAGE_DIR, ownerUsername, 'botAi'); } catch { /* العدّ لا يُسقط الرد */ }
        }
        res.json({ reply: finalReply });
    } catch {
        res.status(200).json({ reply: null });
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
        // 🎨 توليد صور حقيقية من الشات (نفس محرّك زر «ولّد صوراً حقيقية»)
        generateAiImages: (opts) => generateAiImagesFromChat({
            username: req.user.username, activeProject: req.activeProject,
            projectPath, roomName, isAdmin: isAdminUser(req.user), ...opts,
        }),
        // 🔬 «شخص الصور» — كشف حقيقة ملفات المشروع في الإنتاج
        diagnoseAiImages: () => diagnoseAiImagesFromChat({ projectPath, roomName }),
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
            track: req.body.track, // 🧭 مسار البناء من زر الواجهة (موقع/سيستم)
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

// 🧩 نموذج المشروع المُهيكَل (طبقة الفهم) — كيانات + أدوار + تدفّقات.
// يجعل "فهم" المنصّة للمشروع قابلاً للمعاينة بدل أن يكون ضمنياً.
app.get('/api/project/model', verifyToken, validateProjectOwnership, (req, res) => {
    const model = getDomainModel(req.user.username, req.activeProject);
    res.json({
        success: true,
        model: model || null,
        summary: model ? summarizeModel(model) : null,
    });
});

// 📚 معرفة المنصّة التراكمية — فهم المشروع الحالي + مكتبة نماذج الفئات + الدروس.
// تجعل ما تعلّمته المنصّة مرئياً وقابلاً للفهم بدل أن يكون خفياً.
app.get('/api/platform/knowledge', verifyToken, (req, res) => {
    const project = req.query.project;
    const projectModel = project ? getDomainModel(req.user.username, project) : null;
    res.json({
        success: true,
        projectModel: projectModel || null,
        projectSummary: projectModel ? summarizeModel(projectModel) : null,
        library: librarySummary().sort((a, b) => b.contributions - a.contributions),
        lessons: topLessons(15),
        clones: listClones(), // قوالب التطبيقات العاملة المتاحة (كلون + بصمة)
        libraries: listLibraries(), // مكتبات جاهزة تُحقن عبر CDN عند الطلب
    });
});

// 🖼️ معرض القوالب — قائمة خفيفة للبطاقات البصرية (المعاينات أصول ثابتة
// في الواجهة /templates/{id}.jpg مولّدة من القوالب الحقيقية نفسها).
app.get('/api/templates', verifyToken, (req, res) => {
    res.json({ success: true, templates: listClones() });
});

// 🩺 صحّة المشروع — يُظهر نتيجة التحقّق السلوكي للمستخدم بدل إخفائها.
// «يعمل / يحتاج مراجعة» + تفصيل كل فحص (أخطاء JS، أزرار غير موصولة، أدوار ناقصة…).
// يُشغَّل عند الطلب على المشروع الحالي (المحرّك نفسه المستخدَم أثناء البناء).
const HEALTH_LABELS = {
    'no-js-errors': 'يعمل بلا أخطاء برمجية',
    'wiring-complete': 'كل الأزرار موصولة بوظائفها',
    'role-coverage': 'كل الأدوار ممثَّلة في الواجهة',
    'data-presence': 'يوجد محتوى/مصدر بيانات',
    'interactive-wired': 'التفاعل يعمل فعلاً (استجابة حيّة)',
    'missing-script': 'ملفّات السكربت موجودة',
    'runtime': 'التشغيل الفعليّ',
};
app.get('/api/project/health', verifyToken, async (req, res) => {
    try {
        const username = req.user.username;
        const safeProject = (req.query.project || 'sandbox_app').replace(/[^a-z0-9_\-]/g, '-');
        if (safeProject !== 'sandbox_app' && DB._isOnline()) {
            const rec = await DB.findProject(safeProject, username);
            if (!rec) return res.status(403).json({ success: false, error: 'Access Denied: You do not own this project.' });
        }
        const projectPath = getProjectPath(username, safeProject);
        if (!fs.existsSync(path.join(projectPath, 'index.html'))) {
            return res.json({ success: true, ran: false, skipped: true, summary: 'لا مشروع بعد للفحص.', checks: [] });
        }
        const domainModel = getDomainModel(username, safeProject);
        const mem = getProjectMemory(username, safeProject);
        const features = ((mem && mem.structure && mem.structure.features) || []).map(name => ({ name }));
        const blueprint = features.length ? { kind: 'webapp', functionalComponents: features } : { kind: 'webapp' };
        const v = await verifyBehavior({ projectPath, blueprint, domainModel });
        return res.json({
            success: true, ran: !!v.ran, ok: !!v.ok, skipped: !!v.skipped,
            score: typeof v.score === 'number' ? v.score : null, summary: v.summary || '',
            checks: (v.checks || []).map(c => ({
                name: c.name, status: c.status,
                label: HEALTH_LABELS[c.name] || c.name, detail: c.detail,
            })),
        });
    } catch (e) {
        console.warn('[ProjectHealth]', e.message);
        return res.status(500).json({ success: false, error: 'تعذّر فحص صحّة المشروع.' });
    }
});

// ✨ «اجعله احترافياً» — باقة تلميع حتميّة (خطّ + حركات + تحسينات) على المشروع
app.post('/api/polish/apply', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const idxPath = path.join(req.projectPath, 'index.html');
        if (!fs.existsSync(idxPath)) return res.status(400).json({ error: 'index.html غير موجود — ابنِ موقعك أولاً.' });
        const html = fs.readFileSync(idxPath, 'utf8');
        const updated = polishHtml(html);
        const already = updated === html;
        if (!already) fs.writeFileSync(idxPath, updated);

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('log', { message: `✨ [SYSTEM]: ${already ? 'موقعك مُلمَّع مسبقاً' : 'أُضيفت لمسة احترافية (خطّ أنيق + حركات ظهور)'}.` });
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        res.json({ success: true, already });
    } catch (err) {
        res.status(500).json({ error: 'فشل التلميع: ' + err.message });
    }
});

// 🔗 «أضف مكتبة» — يحقن مكتبة جاهزة (CDN) في index.html للمشروع (idempotent)
app.post('/api/library/add', verifyToken, validateProjectOwnership, async (req, res) => {
    const { libraryId } = req.body || {};
    const lib = libraryId && typeof libraryId === 'string' ? getLibraryById(libraryId) : null;
    if (!lib) return res.status(400).json({ error: 'مكتبة غير معروفة.' });
    try {
        const idxPath = path.join(req.projectPath, 'index.html');
        if (!fs.existsSync(idxPath)) return res.status(400).json({ error: 'index.html غير موجود — ابنِ موقعك أولاً.' });
        const html = fs.readFileSync(idxPath, 'utf8');
        const updated = injectLibrary(html, lib);
        const already = updated === html;
        if (!already) fs.writeFileSync(idxPath, updated);

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, req.projectPath);
        io.to(roomName).emit('log', { message: `🔗 [SYSTEM]: ${already ? 'المكتبة موجودة مسبقاً' : 'أُضيفت مكتبة'} «${lib.name}»${already ? '.' : ' — متاحة الآن في موقعك.'}` });
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        res.json({ success: true, libraryId: lib.id, name: lib.name, already });
    } catch (err) {
        res.status(500).json({ error: 'فشل إضافة المكتبة: ' + err.message });
    }
});

// 🧩 «ابدأ من قالب» — يطبّق كلوناً عاملاً مباشرةً على المشروع (حتميّ، بلا ذكاء):
// يكتب الملفات + يضبط النموذج + يضيف الهوية البصرية + يهيّئ النشر. التخصيص لاحقاً بالشات.
app.post('/api/template/apply', verifyToken, validateProjectOwnership, async (req, res) => {
    const { cloneId } = req.body || {};
    const clone = cloneId && typeof cloneId === 'string' ? getCloneById(cloneId) : null;
    if (!clone) return res.status(400).json({ error: 'قالب غير معروف.' });
    try {
        const projectPath = req.projectPath;
        fs.mkdirSync(projectPath, { recursive: true });
        // 1) اكتب ملفات الكلون العامل — بلغة المستخدم المختارة (توطين حتميّ).
        //    لغة الواجهة المُرسلة صراحةً تتقدّم (لا افتراض en على مستخدم عربي لم يتحدّث بعد)
        const uiLang = (req.body?.lang === 'en' || req.body?.lang === 'ar') ? req.body.lang : getUserLanguage(req.user.username);
        const localized = localizeTemplateFiles(clone.files, uiLang);
        for (const f of localized) fs.writeFileSync(path.join(projectPath, f.name), f.content);
        // 2) اضبط نموذج المشروع (دمج مع أي نموذج سابق)
        const model = mergeProjectModel(getDomainModel(req.user.username, req.activeProject) || {}, clone.model);
        setDomainModel(req.user.username, req.activeProject, model);
        // 3) الهوية البصرية (أيقونة) + باقة التلميع (نضج فوري) — حتميّ
        try {
            const assets = assetsFor(clone.name || clone.id);
            fs.writeFileSync(path.join(projectPath, 'brand.svg'), assets.favicon);
            const idxPath = path.join(projectPath, 'index.html');
            if (fs.existsSync(idxPath)) {
                let html = fs.readFileSync(idxPath, 'utf8');
                html = injectFaviconTag(html, 'brand.svg');
                html = polishHtml(html); // خطّ أنيق + حركات ظهور + تحسينات أساسية
                fs.writeFileSync(idxPath, html);
            }
        } catch { /* اختياري */ }
        // 3.5) تخزين حقيقي متزامن (jaola-data) — لقوالب «السيستم» فقط (أدوات
        // عمل داخلية: عيادة/نقطة بيع/مستودع...)، لا قوالب «الموقع» التعريفية
        // — فلا نُعرِّض بيانات زوّار لا حاجة لمزامنتها عبر توكن عام. يعمل فوراً
        // حتى في المعاينة الحيّة، قبل النشر أصلاً (idempotent).
        try { setCloneTrack(req.user.username, req.activeProject, clone.track); } catch { /* اختياري */ }
        if (clone.track === 'system') {
            try {
                const publicBase = (process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL
                    || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
                installDataSync(projectPath, {
                    apiBase: publicBase,
                    token: signBotToken({ u: req.user.username, p: req.activeProject }),
                });
            } catch { /* اختياري */ }
        }
        // 4) تهيئة النشر (موقع ثابت) — أفضل جهد
        try {
            const projectName = `${req.user.username}-${req.activeProject}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
            await prepareRenderDeploy(projectPath, projectName, false);
        } catch { /* اختياري */ }

        const roomName = `${req.user.username}-${req.activeProject}`;
        emitWorkspaceFiles(roomName, projectPath);
        io.to(roomName).emit('log', { message: `🧩 [SYSTEM]: بدأتَ من قالب «${clone.name}» — التطبيق يعمل فوراً. اطلب أي تخصيص في الشات.` });
        io.to(roomName).emit('preview_updated', { timestamp: Date.now() });
        res.json({ success: true, cloneId: clone.id, name: clone.name, files: clone.files.map(f => f.name) });
    } catch (err) {
        res.status(500).json({ error: 'فشل تطبيق القالب: ' + err.message });
    }
});

// 📦 تنزيل المشروع كاملاً (zip) — «كودك ملكك». يستثني node_modules/.git
// وملفات الأسرار (.env) دائماً.
app.get('/api/project/export', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { exportProjectZip } = await import('./services/projectExport.js');
        const buf = exportProjectZip(req.projectPath);
        const fname = `${(req.activeProject || 'project').replace(/[^a-z0-9_-]/gi, '-')}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.send(buf);
    } catch (e) {
        res.status(500).json({ error: 'تعذّر تجهيز ملف التنزيل: ' + e.message });
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

    // 📬 قبل النشر: تثبيت وصلة الموقع (عدّاد زيارات + إيصال نماذج التواصل
    // لصندوق المالك) في صفحات HTML — idempotent ولا يعطّل النشر أبداً.
    try {
        const publicBase = (process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL
            || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const botToken = signBotToken({ u: req.user.username, p: req.activeProject });
        installSiteConnect(req.projectPath, { apiBase: publicBase, token: botToken });
        // 🔍 حزمة SEO الحتمية مع كل نشر — وصف meta + Open Graph + JSON-LD +
        // robots.txt (نفس ما تسوّقه المنافسات كـ«SEO تلقائي»)، idempotent.
        applySeoPack(req.projectPath, { siteName: req.activeProject });
        // 🗄️ تخزين حقيقي متزامن — لقوالب السيستم فقط (نفس قيد وقت التطبيق)،
        // idempotent، وتتجاوز تلقائياً أي مشروع بلا app.js بالشكل المتوقَّع.
        if (getCloneTrack(req.user.username, req.activeProject) === 'system') {
            installDataSync(req.projectPath, { apiBase: publicBase, token: botToken });
        }
    } catch { /* اختياري — النشر يمضي */ }

    // 🧭 مشاريع full-stack (فيها دوال api/ حقيقية) تُنشر على Render (خادم دائم،
    // بلا حدّ 12 دالة، DB متصلة). نُعيد للواجهة نوع النشر ورابط الزر إن جاهز.
    if (isFullStackProject(req.projectPath)) {
        try {
            const projectSlug = `${req.user.username}-${req.activeProject}`
                .toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);

            // 🚀 الأتمتة الكاملة (الجولة أ): إن هُيّئت مفاتيح المنصّة
            // (GITHUB_PLATFORM_TOKEN + RENDER_API_KEY) → زر واحد → رابط حيّ:
            // مستودع يُنشأ تلقائياً + دفع + خدمة Render بأسرار المشروع محقونة.
            if (fullAutomationReady()) {
                io.to(roomName).emit('log', { message: '🚀 [Render]: نشر آليّ كامل — مستودع + خدمة + أسرار...' });
                const auto = await autoDeployFullStack({
                    username: req.user.username,
                    project: req.activeProject,
                    projectPath: req.projectPath,
                    projectSlug,
                    secrets: getProjectSecrets(req.user.username, req.activeProject),
                });
                if (auto.success) {
                    io.to(roomName).emit('log', { message: `✅ [Render]: ${auto.serviceCreated ? 'أُنشئت خدمتك ويجري أول نشر' : 'أُعيد النشر'} — موقعك: ${auto.liveUrl}` });
                    try {
                        const Project = (await import('./models/Project.js')).default;
                        await Project.findOneAndUpdate({ name: req.activeProject, owner: req.user.username }, { vercelUrl: auto.liveUrl });
                    } catch { /* تحديث اختياري */ }
                    emitUserProjects(roomName, req.user.username, req.activeProject);
                    return res.json({ accepted: true, target: 'render', liveUrl: auto.liveUrl, repoUrl: auto.repoUrl, serviceCreated: auto.serviceCreated });
                }
                if (!auto.fallback) {
                    io.to(roomName).emit('log', { message: `❌ [Render]: ${auto.error}` });
                    return res.status(502).json({ target: 'render', error: auto.error });
                }
                // fallback → المسار النصف-آلي أدناه كما كان
            }

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
app.use('/api/billing', createBillingRouter({
    verifyToken, DB,
    getBotAiUsed: (username) => getUsageCount(USAGE_DIR, username, 'botAi'),
}));

// ─── 🩺 مسارات المشرف: فحص النظام + إدارة الإضافات ──────────────────
app.get('/api/admin/health', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, report: runSystemDiagnostics() });
});

// 🩺 آخر أعطال الإنتاج الحقيقية (استثناءات/رفض Promise/أخطاء خادم عامة) —
// الأحدث أولاً؛ فارغ يعني عدم وجود سجل عطل حقيقي (لا يعني عدم فحص).
app.get('/api/admin/errors', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, errors: recentErrors(100) });
});

// 👥 قائمة المستخدمين (بحث + عدّ مشاريع) — بلا أي حقل حسّاس (لا كلمة مرور/توكن)
app.get('/api/admin/users', verifyToken, adminOnly, async (req, res) => {
    try {
        const { search = '', page = '1' } = req.query;
        const limit = 50;
        const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
        const result = await listAdminUsers({ search: String(search), limit, skip });
        res.json({ success: true, ...result });
    } catch (err) { res.status(500).json({ error: 'تعذّر جلب المستخدمين: ' + err.message }); }
});

// 💳 تغيير خطة مستخدم يدوياً (منحة/تعويض/دعم) — يُسجَّل في سجلّ التدقيق دائماً
app.post('/api/admin/users/:username/plan', verifyToken, adminOnly, async (req, res) => {
    try {
        const { plan, currentPeriodEnd } = req.body || {};
        const r = await setUserPlan(req.params.username, plan, currentPeriodEnd || null);
        if (r.error) return res.status(400).json(r);
        recordAdminAction({
            admin: req.user.username, action: 'setUserPlan', target: req.params.username,
            details: `→ ${r.plan} (${r.status})`,
        });
        res.json(r);
    } catch (err) { res.status(500).json({ error: 'تعذّر تحديث الخطة: ' + err.message }); }
});

// 🧾 سجلّ تدقيق أفعال الأدمِن الحسّاسة (تغيير خطط، كتابة/حذف ملفات مستخدمين)
app.get('/api/admin/audit', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, actions: recentAdminActions(200) });
});

// 🔌 فحص حيّ لمزوّدي الذكاء: أيّ مفتاح يُقرأ فعلاً (بذيله المقنّع)، هل يقبل
// الاستدعاء الآن، ورصيد DeepSeek الفعلي — يحسم «المفتاح موجود لكن لا يعمل»
app.get('/api/admin/ai-providers', verifyToken, adminOnly, async (req, res) => {
    try {
        res.json({ success: true, providers: await checkAiProviders() });
    } catch (err) {
        res.status(500).json({ error: 'فشل الفحص: ' + err.message });
    }
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

// 🤖💱 بوت PancakeSwap الشخصي — محصور بالمشرف حصراً، منظومة منفصلة تماماً
// عن قالب مستشار الكريبتو العام (jaolaCryptoAdvisor.js لا تُنفّذ صفقات
// آلياً أبداً ولن تُعدَّل). كل فعل يمسّ الإعداد/التفعيل يُسجَّل عبر
// recordAdminAction — سجل "من فعل ماذا" لكل قرار يمسّ مالاً حقيقياً.
app.get('/api/admin/tradingbot/config', verifyToken, adminOnly, (req, res) => {
    const config = getTradingBotConfig(TRADINGBOT_DIR);
    res.json({ success: true, config, readyToEnable: isTradingBotReadyToEnable(TRADINGBOT_DIR, config) });
});

app.put('/api/admin/tradingbot/config', verifyToken, adminOnly, (req, res) => {
    try {
        const patch = { ...(req.body || {}) };
        delete patch.enabled; // التفعيل عبر /enable حصراً — فعل مميَّز مسجَّل بذاته
        const config = saveTradingBotConfig(TRADINGBOT_DIR, patch);
        recordAdminAction({ admin: req.user.username, action: 'tradingbot.config.update', target: 'tradingbot', details: JSON.stringify(patch) });
        res.json({ success: true, config, readyToEnable: isTradingBotReadyToEnable(TRADINGBOT_DIR, config) });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// 🪙 سجل العملات القابلة للتداول — يديره المشرف نفسه من الواجهة (بدل PR/كود
// في كل مرة). كل إضافة تتطلب مشرفاً مسجَّل دخوله يكتب العنوان بنفسه، فتبقى
// نفس روح "تأكيد بشري قبل أي عنوان عقد" لكن عبر لوحة التحكم مباشرة.
app.get('/api/admin/tradingbot/tokens', verifyToken, adminOnly, (req, res) => {
    res.json({ success: true, tokens: getTradingBotTokenRegistry(TRADINGBOT_DIR) });
});

app.post('/api/admin/tradingbot/tokens', verifyToken, adminOnly, (req, res) => {
    try {
        const { coinId, symbol, address, decimals } = req.body || {};
        const tokens = upsertTradingBotToken(TRADINGBOT_DIR, { coinId, symbol, address, decimals });
        recordAdminAction({ admin: req.user.username, action: 'tradingbot.tokens.upsert', target: coinId, details: JSON.stringify({ symbol, address, decimals }) });
        res.json({ success: true, tokens });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/admin/tradingbot/tokens', verifyToken, adminOnly, (req, res) => {
    const { coinId } = req.body || {};
    const tokens = removeTradingBotToken(TRADINGBOT_DIR, coinId);
    recordAdminAction({ admin: req.user.username, action: 'tradingbot.tokens.remove', target: coinId, details: '' });
    res.json({ success: true, tokens });
});

// بحث راحة بعنوان العقد — لا يضيف شيئاً تلقائياً، المشرف يراجع ويضغط Add بنفسه
app.get('/api/admin/tradingbot/tokens/lookup', verifyToken, adminOnly, async (req, res) => {
    try {
        const result = await lookupTradingBotTokenByAddress(req.query?.address);
        res.json({ success: true, ...result });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// اكتشاف مرشّحين عبر CoinGecko بعدة أنماط (trending/gainers/losers/volume/market_cap)
// — اقتراح فقط، لا إضافة تلقائية
app.get('/api/admin/tradingbot/tokens/discover', verifyToken, adminOnly, async (req, res) => {
    try {
        const candidates = await discoverTradingBotCandidates(req.query?.mode || 'trending');
        res.json({ success: true, candidates, mode: req.query?.mode || 'trending' });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/admin/tradingbot/enable', verifyToken, adminOnly, (req, res) => {
    try {
        const enabled = req.body?.enabled === true;
        const config = saveTradingBotConfig(TRADINGBOT_DIR, { enabled });
        recordAdminAction({ admin: req.user.username, action: enabled ? 'tradingbot.enable' : 'tradingbot.disable', target: 'tradingbot', details: '' });
        res.json({ success: true, config });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/admin/tradingbot/status', verifyToken, adminOnly, (req, res) => {
    const config = getTradingBotConfig(TRADINGBOT_DIR);
    res.json({
        success: true,
        config,
        readyToEnable: isTradingBotReadyToEnable(TRADINGBOT_DIR, config),
        circuitBreaker: getTradingBotCircuitBreakerStatus(TRADINGBOT_DIR, config),
        positions: readTradingBotPositions(TRADINGBOT_DIR),
        heartbeat: readTradingBotHeartbeat(TRADINGBOT_DIR),
        performance: getTradingBotPerformance(TRADINGBOT_DIR),
        skipSummary: getTradingBotSkipSummary(TRADINGBOT_DIR),
    });
});

app.get('/api/admin/tradingbot/trades', verifyToken, adminOnly, (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt(req.query?.limit, 10) || 100));
    res.json({ success: true, trades: listTradingBotTrades(TRADINGBOT_DIR, { limit }) });
});

app.post('/api/admin/tradingbot/circuit-breaker/rearm', verifyToken, adminOnly, (req, res) => {
    try {
        const config = saveTradingBotConfig(TRADINGBOT_DIR, { reArmedAt: new Date().toISOString() });
        recordAdminAction({ admin: req.user.username, action: 'tradingbot.circuitbreaker.rearm', target: 'tradingbot', details: '' });
        res.json({ success: true, config, circuitBreaker: getTradingBotCircuitBreakerStatus(TRADINGBOT_DIR, config) });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/admin/tradingbot/run-once', verifyToken, adminOnly, async (req, res) => {
    recordAdminAction({ admin: req.user.username, action: 'tradingbot.run_once', target: 'tradingbot', details: '' });
    try {
        const result = await runTradingBotTickGuarded(TRADINGBOT_DIR);
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
        recordAdminAction({ admin: req.user.username, action: 'writeFile', target: `${user}/${project}/${p}` });
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/admin/files', verifyToken, adminOnly, async (req, res) => {
    try {
        const { user, project, path: p } = req.body || {};
        const r = await adminSvc.deleteProjectFile(user, project, p);
        recordAdminAction({ admin: req.user.username, action: 'deleteFile', target: `${user}/${project}/${p}` });
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

// ═══════════════════════════════════════════════════════════════════
// 📬 صندوق الموقع + عدّاد الزيارات — نقاط عامّة من مواقع العملاء المنشورة
//    (توكن موقّع بهوية المشروع + rate limit) ولوحة قراءة للمالك.
// ═══════════════════════════════════════════════════════════════════
const SITEDATA_DIR = path.join(BASE_WORKSPACE, '.sitedata');
const NEWSLETTERDATA_DIR = path.join(BASE_WORKSPACE, '.newsletterdata');

// زيارة من موقع منشور (snippet يرسل مرّة لكل جلسة زائر) — الردّ صامت دائماً
app.post('/api/public/site-hit', publicSiteLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (v?.u && v?.p) { try { recordVisit(SITEDATA_DIR, v.u, v.p); } catch { /* صامت */ } }
    res.status(204).end();
});

// رسالة «تواصل معنا» من موقع منشور → صندوق المالك (+ إشعار بريدي اختياري)
app.post('/api/public/site-message', publicSiteLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const r = recordMessage(SITEDATA_DIR, v.u, v.p, req.body || {});
        res.json({ success: !r.error });
        // 📧 إشعار المالك ببريده (صامت تماماً، بسقف شهري ثابت لا يمسّ حصة خطته)
        if (!r.error && mailReady()) {
            (async () => {
                try {
                    if (getUsageCount(USAGE_DIR, v.u, 'notifyMail') >= 300) return;
                    const owner = await DB.findUser(v.u).catch(() => null);
                    if (!owner?.email || !isEmail(owner.email)) return;
                    const m = r.message;
                    const sent = await sendMail({
                        to: owner.email,
                        subject: `📬 رسالة جديدة من موقعك (${v.p})`,
                        text: `الاسم: ${m.name || '—'}\nالتواصل: ${m.contact || '—'}\nالصفحة: ${m.page || '—'}\n\n${m.message}\n\n— افتح «بريد موقعك» في داشبورد JAOLA للردّ.`,
                    });
                    if (sent.ok) bumpUsage(USAGE_DIR, v.u, 'notifyMail');
                } catch { /* الإشعار لا يعطّل الاستقبال أبداً */ }
            })();
        }
    } catch { res.json({ success: false }); }
});

// اشتراك نشرة من موقع منشور (بريد فقط — لا صندوق رسائل)
app.post('/api/public/site-subscribe', publicSiteLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const r = subscribeNewsletter(NEWSLETTERDATA_DIR, v.u, v.p, req.body?.email);
        res.json({ success: !r.error });
    } catch { res.json({ success: false }); }
});

// ─── 🗄️ مزامنة بيانات القوالب (jaola-data) — بديل localStorage الحقيقي ───
// يقرأ/يكتب موقع منشور مباشرة (توكن المشروع الموقّع، لا جلسة مستخدم) —
// نفس فلسفة صندوق الموقع أعلاه: ملفّي، صامد بلا Mongo، فشل صامت دائماً.
const APPDATA_DIR = path.join(BASE_WORKSPACE, '.appdata');

// سحب كل مفاتيح المشروع دفعة واحدة (عند تحميل الصفحة، قبل تشغيل app.js)
app.get('/api/public/data', appDataLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({});
    try { res.json(readAppDataStore(APPDATA_DIR, v.u, v.p)); } catch { res.json({}); }
});

// كتابة مفتاح واحد (كل نداء localStorage.setItem محليّاً يُرحَّل هنا)
app.put('/api/public/data/:key', appDataLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const r = writeAppDataKey(APPDATA_DIR, v.u, v.p, req.params.key, req.body?.value);
        if (r.error) return res.status(400).json({ error: r.error });
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
});

// 🔐 مصادقة حقيقية لدخول قوالب السيستم — كلمة مرور مُجزَّأة تُتحقَّق هنا
// فقط، بدل مقارنة نص صريح محلياً (كانت تُقرَأ من localStorage/jaola-data
// مباشرة). الافتراضية 'admin' مقبولة حتى يُغيِّرها المالك من الإعدادات.
const APPAUTH_DIR = path.join(BASE_WORKSPACE, '.appauth');
app.post('/api/public/auth/login', authLimit, async (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.json({ ok: false });
    try { res.json({ ok: await verifyProjectPassword(APPAUTH_DIR, v.u, v.p, req.body?.password) }); }
    catch { res.json({ ok: false }); }
});
app.post('/api/public/auth/set-password', authLimit, async (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const r = await setProjectPassword(APPAUTH_DIR, v.u, v.p, req.body?.password);
        if (r.error) return res.status(400).json({ error: r.error });
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
});

// 🗄️ مجموعات حقيقية (jaola-collections) — سجلات بمعرّفات وCRUD فردي، فوق
// appData.js. قدرة إضافية جاهزة لقوالب السيستم (لا القوالب الحالية بعد —
// انظر تعليق appCollections.js)، بنفس قيد التتبّع (system فقط) والتوكن.
const APPCOLLECTIONS_DIR = path.join(BASE_WORKSPACE, '.appcollections');
app.get('/api/public/collections/:name', appDataLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p || getCloneTrack(v.u, v.p) !== 'system') return res.json({ records: [] });
    try {
        const filter = { ...req.query }; delete filter.token;
        res.json({ records: listCollectionRecords(APPCOLLECTIONS_DIR, v.u, v.p, req.params.name, filter) });
    } catch { res.json({ records: [] }); }
});
app.post('/api/public/collections/:name', appDataLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p || getCloneTrack(v.u, v.p) !== 'system') return res.status(204).end();
    try {
        const r = upsertCollectionRecord(APPCOLLECTIONS_DIR, v.u, v.p, req.params.name, req.body?.record);
        if (r.error) return res.status(400).json({ error: r.error });
        res.json(r);
    } catch { res.status(500).json({ success: false }); }
});
app.delete('/api/public/collections/:name/:id', appDataLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token || req.body?.token);
    if (!v?.u || !v?.p || getCloneTrack(v.u, v.p) !== 'system') return res.status(204).end();
    try { res.json(deleteCollectionRecord(APPCOLLECTIONS_DIR, v.u, v.p, req.params.name, req.params.id)); }
    catch { res.status(500).json({ success: false }); }
});

// 💰 مستشار الميزانية الشخصية — يبني فوق مجموعات appCollections.js أعلاه
// (transactions/budgets)؛ لا تخزين جديد هنا، فقط تسجيل للفحص الدوري
// وتعليق ذكي مبني على أرقام حقيقية محسوبة من سجلات المستخدم فعلياً.
app.put('/api/public/budget/register', appDataLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p || getCloneTrack(v.u, v.p) !== 'system') return res.status(204).end();
    try { registerBudgetProject(BUDGETWATCH_DIR, v.u, v.p); res.json({ success: true }); }
    catch { res.status(500).json({ success: false }); }
});
app.get('/api/public/budget/commentary', cryptoCommentaryLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p || getCloneTrack(v.u, v.p) !== 'system') return res.json({ text: null });
    try {
        const owner = await DB.findUser(v.u).catch(() => null);
        const quota = botAiQuota(owner);
        if (Number.isFinite(quota.monthly) && getUsageCount(USAGE_DIR, v.u, 'botAi') >= quota.monthly) {
            return res.json({ text: null, quota: 'exhausted' });
        }
        const months = req.query?.period === 'last3' ? budgetLastMonths(3) : req.query?.period === 'lastMonth' ? budgetLastMonths(2).slice(0, 1) : budgetLastMonths(1);
        const records = listCollectionRecords(APPCOLLECTIONS_DIR, v.u, v.p, 'transactions');
        const sum = summarizeBudget(records, months);
        const periodLabelAr = { thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي', last3: 'آخر 3 أشهر' };
        const periodLabelEn = { thisMonth: 'this month', lastMonth: 'last month', last3: 'the last 3 months' };
        const lang = req.query?.lang === 'en' ? 'en' : 'ar';
        const periodLabel = (lang === 'en' ? periodLabelEn : periodLabelAr)[req.query?.period] || (lang === 'en' ? periodLabelEn.thisMonth : periodLabelAr.thisMonth);
        const text = await generateBudgetCommentary({ periodLabel, income: sum.income, expense: sum.expense, net: sum.net, categories: sum.categories, lang });
        if (text) { try { bumpUsage(USAGE_DIR, v.u, 'botAi'); } catch { /* العدّ لا يُسقط الرد */ } }
        res.json({ text });
    } catch { res.json({ text: null }); }
});

// 🖼️ صور حقيقية من مالك القالب (jaola-assets) — لا صورة Unsplash ولا AI
// مولَّدة؛ صورة العيادة/المحل الفعلية. متاح لأي قالب استنساخ (site أو
// system) — عرض صورة علناً لا يحمل نفس حساسية مزامنة سجلات العمل.
const APPASSETS_DIR = path.join(BASE_WORKSPACE, '.appassets');
const CRYPTOWATCH_DIR = path.join(BASE_WORKSPACE, '.cryptowatch');
const SIGNAL_TRACK_DIR = path.join(BASE_WORKSPACE, '.signaltrack');
const BUDGETWATCH_DIR = path.join(BASE_WORKSPACE, '.budgetwatch');
const STOCKWATCH_DIR = path.join(BASE_WORKSPACE, '.stockwatch');
const STOCK_SIGNAL_TRACK_DIR = path.join(BASE_WORKSPACE, '.stocksignaltrack');
const TRADINGBOT_DIR = path.join(BASE_WORKSPACE, '.tradingbot');
app.post('/api/public/assets/:slot', assetLimit, (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const r = saveAsset(APPASSETS_DIR, v.u, v.p, req.params.slot, req.body?.dataUrl);
        if (r.error) return res.status(400).json({ error: r.error });
        res.json({ success: true });
    } catch { res.status(500).json({ success: false }); }
});
app.get('/api/public/assets/:slot', assetLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.status(404).end();
    try {
        const asset = readAsset(APPASSETS_DIR, v.u, v.p, req.params.slot);
        if (!asset) return res.status(404).end();
        res.set('Cache-Control', 'no-cache').type(asset.mime).send(asset.buf);
    } catch { res.status(500).end(); }
});

// 📊 تحليل كريبتو حقيقي (jaola-crypto-advisor) — بيانات سوق + مؤشرات فنية
// (SMA/RSI) وإشارة شراء/بيع/انتظار مفسَّرة، عبر كاش داخلي مشترك (لا لكل
// مشروع) يحمي CoinGecko من الاستهلاك المفرط. تحليل وعرض فقط — لا تنفيذ
// تداول آلي إطلاقاً؛ بيانات سوق عامة فلا حاجة لتقييدها بمسار system.
// ?ids=a,b,c تحدّد قائمة متابعة القالب الفعلية (لا الثماني المدعومة فقط).
app.get('/api/public/crypto/markets', cryptoLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ coins: [], stale: true });
    try {
        const ids = typeof req.query?.ids === 'string' ? req.query.ids.split(',').map(s => s.trim()) : undefined;
        res.json(await listMarkets(ids));
    } catch { res.json({ coins: [], stale: true }); }
});
// ?timeframe=day|week|long — مدى التحليل (افتراضي week)؛ getAnalysis نفسها
// تتجاهل قيمة غير صالحة وتُرجع للافتراضي بصمت (لا حاجة للتحقق هنا أيضاً).
app.get('/api/public/crypto/analysis/:id', cryptoLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.status(400).json({ error: 'غير مصرّح' });
    try {
        const r = await getAnalysis(req.params.id, req.query?.timeframe);
        if (r.error) return res.status(400).json(r);
        try { recordSignal(SIGNAL_TRACK_DIR, r); } catch { /* السجل لا يُسقط الاستجابة أبداً */ }
        res.json(r);
    } catch { res.status(500).json({ error: 'تعذّر التحليل الآن' }); }
});

// 📈 سجل أداء الإشارات — دقة تاريخية شفّافة (لا وعد، بيانات فعلية): من
// GET بلا :id → تجميع عبر كل العملات لمدى معيّن؛ بـ:id → عملة محدَّدة.
app.get('/api/public/crypto/track-record', cryptoLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null });
    try { res.json(getAccuracy(SIGNAL_TRACK_DIR, { timeframe: req.query?.timeframe })); }
    catch { res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null }); }
});
app.get('/api/public/crypto/track-record/:id', cryptoLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null });
    try { res.json(getAccuracy(SIGNAL_TRACK_DIR, { id: req.params.id, timeframe: req.query?.timeframe })); }
    catch { res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null }); }
});

// 🔗 رابط أفلييت اختياري لمنصة تداول — مُعطَّل تماماً افتراضياً (لا رابط
// وهمي أو منصّة مفترضة أبداً)، يُفعَّل فقط إن ضُبط متغيّر بيئة حقيقي
// CRYPTO_AFFILIATE_URL_TEMPLATE (قالب يحوي {symbol}/{id})؛ غيابه يُبقي
// الزر مختفياً كليّاً في الواجهة (لا نص "قريباً" أو رابط معطَّل ظاهر).
function affiliateUrlFor(symbol, id) {
    const tpl = process.env.CRYPTO_AFFILIATE_URL_TEMPLATE;
    if (!tpl) return null;
    return tpl.replace('{symbol}', encodeURIComponent(String(symbol || '').toLowerCase()))
        .replace('{id}', encodeURIComponent(String(id || '')));
}
app.get('/api/public/crypto/affiliate/:id', cryptoLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p || !isValidCoinId(req.params.id)) return res.json({ url: null });
    const meta = findCoin(req.params.id);
    res.json({ url: affiliateUrlFor(meta?.symbol || req.params.id.toUpperCase(), req.params.id) });
});

// 🔍 بحث عن عملة لإضافتها لقائمة المتابعة — يفتح المتابعة لأي عملة يدعمها
// CoinGecko، لا الثماني المُنسَّقة فقط.
app.get('/api/public/crypto/search', cryptoSearchLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ coins: [] });
    try { res.json({ coins: await searchCoins(req.query?.q) }); } catch { res.json({ coins: [] }); }
});

// 🚀 أقوى فرص الدخول (شراء/بيع فعلي) ضمن قائمة عملات — لشريط "الفرص
// القوية" في لوحة القالب. يعيد استخدام كاش getAnalysis لكل عملة (نفس
// التكلفة كأن الواجهة طلبت كل عملة على حدة، فقط بنداء HTTP واحد).
app.get('/api/public/crypto/opportunities', cryptoLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ opportunities: [] });
    try {
        const ids = typeof req.query?.ids === 'string' ? req.query.ids.split(',').map(s => s.trim()) : [];
        const tf = req.query?.timeframe;
        const opportunities = await getOpportunities(ids, tf);
        for (const o of opportunities) {
            try { recordSignal(SIGNAL_TRACK_DIR, { id: o.id, timeframe: tf || 'week', signal: o.signal, price: o.price }); } catch { /* لا يُسقط الاستجابة */ }
        }
        res.json({ opportunities });
    } catch { res.json({ opportunities: [] }); }
});

// 🗂️ فهرسة قائمة المتابعة (لا تخزينها الأساسي — ذاك عبر jaola-data كسائر
// إعدادات القالب) — فقط لتمكين حلقة فحص "الفرص القوية" أدناه من معرفة أي
// مشاريع تتابع أي عملات، بلا حاجة لمسح كل بيانات كل المشاريع.
app.put('/api/public/crypto/watchlist', cryptoLimit, async (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const owner = await DB.findUser(v.u).catch(() => null);
        const cap = Math.min(cryptoWatchlistMax(owner).max, MAX_WATCHLIST);
        const list = Array.isArray(req.body?.watchlist)
            ? req.body.watchlist.filter(isValidCoinId).slice(0, cap) : [];
        saveWatchlistIndex(CRYPTOWATCH_DIR, v.u, v.p, list);
        res.json({ success: true, watchlistMax: cap });
    } catch { res.status(500).json({ success: false }); }
});

// 📏 سقف قائمة المتابعة الفعلي حسب خطة صاحب المشروع — تعرضه الواجهة قبل
// محاولة الإضافة (لا تكتشف الحدّ فقط بعد رفض الحفظ).
app.get('/api/public/crypto/limits', cryptoLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ watchlistMax: 5 });
    const owner = await DB.findUser(v.u).catch(() => null);
    res.json({ watchlistMax: Math.min(cryptoWatchlistMax(owner).max, MAX_WATCHLIST) });
});

// 🤖 تعليق آلي قصير (2-3 جمل) يفسّر أرقام التحليل بلغة مبسّطة — وكيل ضيّق
// مهمته الوحيدة الكتابة، لا التوصية بالتنفيذ (انظر cryptoCommentary.js).
// يستهلك من حصة الذكاء الاصطناعي الشهرية للمالك (نفس حصة agent-chat).
app.get('/api/public/crypto/commentary/:id', cryptoCommentaryLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ text: null });
    try {
        const owner = await DB.findUser(v.u).catch(() => null);
        const quota = botAiQuota(owner);
        if (Number.isFinite(quota.monthly) && getUsageCount(USAGE_DIR, v.u, 'botAi') >= quota.monthly) {
            return res.json({ text: null, quota: 'exhausted' });
        }
        const a = await getAnalysis(req.params.id, req.query?.timeframe);
        if (a.error) return res.json({ text: null });
        const text = await generateCommentary({ id: a.id, symbol: req.query?.symbol, price: a.price, smaShort: a.smaShort, smaLong: a.smaLong, rsi: a.rsi, signal: a.signal, reasonCode: a.reasonCode, timeframe: a.timeframe, lang: req.query?.lang });
        if (text) { try { bumpUsage(USAGE_DIR, v.u, 'botAi'); } catch { /* العدّ لا يُسقط الرد */ } }
        res.json({ text });
    } catch { res.json({ text: null }); }
});

// ═══════════════════════════════════════════════════════════════════
// 📈 مستشار الأسهم/الفوركس (jaola-stock-advisor) — نفس بنية نقاط مستشار
// الكريبتو أعلاه بالضبط (سجل أداء مشترك signalTrackRecord.js بدليل تخزين
// منفصل، فهرسة تنبيهات مشترك cryptoAlerts.js بدليل منفصل)، بمصدر بيانات
// مختلف (stockMarket.js / Yahoo Finance بدل CoinGecko).
// ═══════════════════════════════════════════════════════════════════
app.get('/api/public/stock/markets', stockLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ symbols: [], stale: true });
    try {
        const ids = typeof req.query?.ids === 'string' ? req.query.ids.split(',').map(s => s.trim()) : undefined;
        res.json(await listStockMarkets(ids));
    } catch { res.json({ symbols: [], stale: true }); }
});
app.get('/api/public/stock/analysis/:id', stockLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.status(400).json({ error: 'غير مصرّح' });
    try {
        const r = await getStockAnalysis(req.params.id, req.query?.timeframe);
        if (r.error) return res.status(400).json(r);
        try { recordSignal(STOCK_SIGNAL_TRACK_DIR, r); } catch { /* السجل لا يُسقط الاستجابة أبداً */ }
        res.json(r);
    } catch { res.status(500).json({ error: 'تعذّر التحليل الآن' }); }
});
app.get('/api/public/stock/track-record', stockLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null });
    try { res.json(getAccuracy(STOCK_SIGNAL_TRACK_DIR, { timeframe: req.query?.timeframe })); }
    catch { res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null }); }
});
app.get('/api/public/stock/track-record/:id', stockLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null });
    try { res.json(getAccuracy(STOCK_SIGNAL_TRACK_DIR, { id: req.params.id, timeframe: req.query?.timeframe })); }
    catch { res.json({ hits: 0, misses: 0, neutral: 0, total: 0, hitRate: null }); }
});
// 🔗 رابط أفلييت اختياري لوسيط تداول — مُعطَّل تماماً افتراضياً، بمتغيّر
// بيئة مستقلّ عن الكريبتو (منصّة مختلفة عادةً) STOCK_AFFILIATE_URL_TEMPLATE.
app.get('/api/public/stock/affiliate/:id', stockLimit, (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p || !isValidSymbolId(req.params.id)) return res.json({ url: null });
    const meta = findSymbol(req.params.id);
    const tpl = process.env.STOCK_AFFILIATE_URL_TEMPLATE;
    if (!tpl) return res.json({ url: null });
    const symbol = meta?.symbol || req.params.id;
    res.json({ url: tpl.replace('{symbol}', encodeURIComponent(symbol)).replace('{id}', encodeURIComponent(req.params.id)) });
});
app.get('/api/public/stock/search', stockSearchLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ coins: [] });
    try { res.json({ coins: await searchSymbols(req.query?.q) }); } catch { res.json({ coins: [] }); }
});
app.get('/api/public/stock/opportunities', stockLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ opportunities: [] });
    try {
        const ids = typeof req.query?.ids === 'string' ? req.query.ids.split(',').map(s => s.trim()) : [];
        const tf = req.query?.timeframe;
        const opportunities = await getStockOpportunities(ids, tf);
        for (const o of opportunities) {
            try { recordSignal(STOCK_SIGNAL_TRACK_DIR, { id: o.id, timeframe: tf || 'week', signal: o.signal, price: o.price }); } catch { /* لا يُسقط الاستجابة */ }
        }
        res.json({ opportunities });
    } catch { res.json({ opportunities: [] }); }
});
app.put('/api/public/stock/watchlist', stockLimit, async (req, res) => {
    const v = verifyBotToken(req.body?.token);
    if (!v?.u || !v?.p) return res.status(204).end();
    try {
        const owner = await DB.findUser(v.u).catch(() => null);
        const cap = Math.min(stockWatchlistMax(owner).max, STOCK_MAX_WATCHLIST);
        const list = Array.isArray(req.body?.watchlist)
            ? req.body.watchlist.filter(isValidSymbolId).slice(0, cap) : [];
        saveWatchlistIndex(STOCKWATCH_DIR, v.u, v.p, list);
        res.json({ success: true, watchlistMax: cap });
    } catch { res.status(500).json({ success: false }); }
});
app.get('/api/public/stock/limits', stockLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ watchlistMax: 5 });
    const owner = await DB.findUser(v.u).catch(() => null);
    res.json({ watchlistMax: Math.min(stockWatchlistMax(owner).max, STOCK_MAX_WATCHLIST) });
});
app.get('/api/public/stock/commentary/:id', stockCommentaryLimit, async (req, res) => {
    const v = verifyBotToken(req.query?.token);
    if (!v?.u || !v?.p) return res.json({ text: null });
    try {
        const owner = await DB.findUser(v.u).catch(() => null);
        const quota = botAiQuota(owner);
        if (Number.isFinite(quota.monthly) && getUsageCount(USAGE_DIR, v.u, 'botAi') >= quota.monthly) {
            return res.json({ text: null, quota: 'exhausted' });
        }
        const a = await getStockAnalysis(req.params.id, req.query?.timeframe);
        if (a.error) return res.json({ text: null });
        const text = await generateStockCommentary({ id: a.id, symbol: req.query?.symbol, price: a.price, smaShort: a.smaShort, smaLong: a.smaLong, rsi: a.rsi, signal: a.signal, reasonCode: a.reasonCode, timeframe: a.timeframe, lang: req.query?.lang });
        if (text) { try { bumpUsage(USAGE_DIR, v.u, 'botAi'); } catch { /* العدّ لا يُسقط الرد */ } }
        res.json({ text });
    } catch { res.json({ text: null }); }
});

// 📧 إرسال ردّ فعلي من الداشبورد على رسالة واردة — بحصة الخطة الشهرية
app.post('/api/inbox/reply-send', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { to, subject, text } = req.body || {};
        if (!isEmail(to)) return res.status(400).json({ error: 'عنوان بريد المستلم غير صالح.' });
        if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'نص الرد مطلوب.' });
        const username = req.user.username;
        const owner = await DB.findUser(username).catch(() => null);
        const q = emailQuota(owner);
        if (Number.isFinite(q.monthly) && getUsageCount(USAGE_DIR, username, 'emails') >= q.monthly) {
            return res.status(403).json({ error: `حصة بريد خطتك (${q.monthly}/شهر) نفدت — رقِّ خطتك للمزيد.` });
        }
        const r = await sendMail({
            to,
            subject: (typeof subject === 'string' && subject.trim()) ? subject.trim() : `ردّ من ${req.activeProject}`,
            text: text.trim(),
            replyTo: owner?.email,
        });
        if (r.error) return res.status(r.notConfigured ? 503 : 502).json(r);
        bumpUsage(USAGE_DIR, username, 'emails');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر الإرسال: ' + err.message });
    }
});

// المالك يقرأ صندوقه: الرسائل + ملخّص الزيارات + غير المقروء
app.get('/api/site/inbox', verifyToken, validateProjectOwnership, (req, res) => {
    const store = readInbox(SITEDATA_DIR, req.user.username, req.activeProject);
    res.json({
        success: true,
        messages: store.messages,
        unread: unreadCount(store),
        visits: visitSummary(store),
    });
});

// المالك فتح الصندوق → كل الرسائل مقروءة
app.post('/api/site/inbox/seen', verifyToken, validateProjectOwnership, (req, res) => {
    markSeen(SITEDATA_DIR, req.user.username, req.activeProject);
    res.json({ success: true });
});

// المالك يقرأ قائمة مشتركي نشرة موقعه
app.get('/api/site/subscribers', verifyToken, validateProjectOwnership, (req, res) => {
    const subscribers = listNewsletterSubscribers(NEWSLETTERDATA_DIR, req.user.username, req.activeProject);
    res.json({ success: true, subscribers, count: subscribers.length });
});

// المالك يحذف مشتركاً يدوياً
app.post('/api/site/subscribers/remove', verifyToken, validateProjectOwnership, (req, res) => {
    const r = unsubscribeNewsletter(NEWSLETTERDATA_DIR, req.user.username, req.activeProject, req.body?.email);
    res.json(r);
});

// 📧 إرسال نشرة لكل مشتركي الموقع دفعة واحدة — بحصة الخطة الشهرية (نفس حصة emails)
app.post('/api/newsletter/send', verifyToken, validateProjectOwnership, async (req, res) => {
    try {
        const { subject, text } = req.body || {};
        if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'نص النشرة مطلوب.' });
        if (!mailReady()) return res.status(503).json({ error: 'البريد غير مُفعّل — اضبط RESEND_API_KEY في بيئة الخادم.', notConfigured: true });
        const username = req.user.username;
        const subscribers = listNewsletterSubscribers(NEWSLETTERDATA_DIR, username, req.activeProject);
        if (!subscribers.length) return res.status(400).json({ error: 'لا يوجد مشتركون بعد.' });
        const owner = await DB.findUser(username).catch(() => null);
        const q = emailQuota(owner);
        const used = getUsageCount(USAGE_DIR, username, 'emails');
        const remaining = Number.isFinite(q.monthly) ? Math.max(0, q.monthly - used) : Infinity;
        if (remaining <= 0) return res.status(403).json({ error: `حصة بريد خطتك (${q.monthly}/شهر) نفدت — رقِّ خطتك للمزيد.` });

        const finalSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim() : `نشرة ${req.activeProject}`;
        const targets = subscribers.slice(0, remaining);
        let sent = 0, failed = 0;
        for (const s of targets) {
            const r = await sendMail({ to: s.email, subject: finalSubject, text: text.trim(), replyTo: owner?.email });
            if (r.ok) { sent++; bumpUsage(USAGE_DIR, username, 'emails'); } else { failed++; }
        }
        res.json({ success: true, sent, failed, totalSubscribers: subscribers.length, skippedByQuota: subscribers.length - targets.length });
    } catch (err) {
        res.status(500).json({ error: 'تعذّر إرسال النشرة: ' + err.message });
    }
});

// ─── معالج أخطاء عام ────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    recordError({ source: 'express', message: err?.message, stack: err?.stack, path: req?.path, method: req?.method });
    res.status(500).json({ error: 'خطأ داخلي في الخادم.' });
});

// 📅 حلقة المجدول — كل دقيقة: يلتقط المنشورات المستحقة وينشرها للقنوات
// المربوطة بحصة الخطة، ويعلّم النتيجة (نجاح/فشل بسببه) في سجل المستخدم.
setInterval(async () => {
    try {
        for (const user of listScheduleUsers(SCHED_DIR)) {
            const due = claimDuePosts(SCHED_DIR, user);
            for (const p of due) {
                let anyOk = false, lastErr = '';
                const owner = await DB.findUser(user).catch(() => null);
                const q = socialQuota(owner);
                for (const ch of p.channels) {
                    if (Number.isFinite(q.monthly) && getUsageCount(USAGE_DIR, user, 'socialPosts') >= q.monthly) {
                        lastErr = `حصة النشر (${q.monthly}/شهر) نفدت.`;
                        break;
                    }
                    const sender = CHANNEL_SENDERS[ch];
                    if (!sender) continue;
                    const r = await sender(user, p.text).catch(e => ({ error: e.message }));
                    if (r.ok) { anyOk = true; bumpUsage(USAGE_DIR, user, 'socialPosts'); }
                    else lastErr = r.error || lastErr;
                }
                markResult(SCHED_DIR, user, p.id, { ok: anyOk, error: anyOk ? undefined : lastErr });
            }
        }
    } catch (e) { console.warn('[Scheduler]', 'دورة المجدول فشلت:', e.message); }
}, 60 * 1000);

// 📈 حلقة فحص "الفرص القوية" لمستشار الكريبتو — كل 5 دقائق: لكل مشروع
// مفهرَس (watchlist محفوظة عبر PUT .../crypto/watchlist)، تحقّق من إشارة
// كل عملة متابَعة (نفس التحليل المخزَّن مؤقتاً، لا نداء إضافي لCoinGecko)
// وأرسل بريداً عند شراء/بيع فعليّ — لا عند "انتظار"، ولا تكراراً لنفس
// الإشارة خلال 12 ساعة (shouldAlert). فشل مشروع واحد لا يوقف البقية.
setInterval(async () => {
    try {
        for (const entry of listWatchlistIndex(CRYPTOWATCH_DIR)) {
            try {
                const { user, project, watchlist } = entry;
                if (!Array.isArray(watchlist) || !watchlist.length) continue;
                if (getUsageCount(USAGE_DIR, user, 'notifyMail') >= 300) continue;
                const owner = await DB.findUser(user).catch(() => null);
                if (!owner?.email || !isEmail(owner.email)) continue;
                for (const id of watchlist) {
                    const a = await getAnalysis(id).catch(() => null);
                    if (!a || a.error) continue;
                    try { recordSignal(SIGNAL_TRACK_DIR, a); } catch { /* السجل لا يُسقط الحلقة أبداً */ }
                    if (a.signal === 'hold') continue;
                    if (!shouldAlert(entry, id, a.signal)) continue;
                    const label = a.signal === 'buy' ? 'شراء' : 'بيع';
                    const sent = await sendMail({
                        to: owner.email,
                        subject: `📈 فرصة ${label} محتملة — ${id} (مستشار الكريبتو)`,
                        text: `رصد مستشار الكريبتو في مشروعك «${project}» إشارة ${label} لعملة ${id}.\n\n` +
                            `السعر الحالي: ${a.price ?? '—'}\nRSI: ${a.rsi != null ? a.rsi.toFixed(0) : '—'}\n\n` +
                            `هذا تحليل آلي إحصائي وليس نصيحة استثمارية ملزمة — راجع لوحة مشروعك للتفاصيل.`,
                    }).catch(() => ({ ok: false }));
                    if (sent.ok) { bumpUsage(USAGE_DIR, user, 'notifyMail'); markAlerted(CRYPTOWATCH_DIR, user, project, id, a.signal); }
                }
            } catch (e) { console.warn('[CryptoAlerts]', 'مشروع فشل:', e.message); }
        }
    } catch (e) { console.warn('[CryptoAlerts]', 'دورة الفحص فشلت:', e.message); }
}, 5 * 60 * 1000);

// 🎯 حلقة حسم سجل الأداء — كل 30 دقيقة: تجلب أسعار العملات التي انقضى
// أفقها الزمني بنداء واحد مُجمَّع (لا نداء لكل تنبّؤ) وتحسم نتيجتها (hit/miss/neutral).
setInterval(async () => {
    try {
        const dueIds = getDueCoinIds(SIGNAL_TRACK_DIR);
        if (!dueIds.length) return;
        const { coins } = await listMarkets(dueIds).catch(() => ({ coins: [] }));
        const priceById = {};
        for (const m of coins) if (m?.id && m.price != null) priceById[m.id] = m.price;
        resolveDue(SIGNAL_TRACK_DIR, priceById);
    } catch (e) { console.warn('[SignalTrackRecord]', 'دورة الحسم فشلت:', e.message); }
}, 30 * 60 * 1000);

// 🌱 حلقة تغذية سجل الأداء للعملات الثماني المدعومة — بدون هذه الحلقة، سجل
// الدقة يظل فارغاً إلى الأبد لأي عملة لا يفتح أحد شاشة تحليلها فعلياً (رسالة
// "لا بيانات كافية" الدائمة، مشكلة اكتشفها المالك فعلياً). زوج (عملة، مدى)
// واحد فقط كل 3 دقائق (لا انفجار نداءات كالعطل السابق الموثَّق أعلاه في حلقة
// تسخين الكاش) — getAnalysis تستخدم كاشها الخاص فمعظم النداءات هنا مجانية
// أصلاً إن كانت ساخنة من زيارات حقيقية. عند الجفاف الكامل: نداء شبكي واحد
// كل 3 دقائق على الأكثر، أبطأ بكثير من العطل الذي أدّى لحذف التسخين هناك.
const TRACK_WARM_PAIRS = SUPPORTED_COINS.flatMap(c => Object.keys(TIMEFRAMES).map(tf => ({ id: c.id, tf })));
let trackWarmCursor = 0;
setInterval(async () => {
    if (!TRACK_WARM_PAIRS.length) return;
    const { id, tf } = TRACK_WARM_PAIRS[trackWarmCursor % TRACK_WARM_PAIRS.length];
    trackWarmCursor++;
    try {
        const r = await getAnalysis(id, tf);
        if (!r.error) recordSignal(SIGNAL_TRACK_DIR, r);
    } catch (e) { console.warn('[SignalTrackRecord]', 'تغذية سجل الأداء فشلت:', e.message); }
}, 3 * 60 * 1000);

// 💰 حلقة فحص تجاوز الميزانية — كل 6 ساعات: لكل مشروع مسجَّل عبر
// /api/public/budget/register، تقارن مصروف الشهر الحالي الفعلي بكل
// ميزانية مضبوطة، وترسل بريداً عند أول تجاوز لكل (فئة، شهر) — لا تكراراً
// مزعجاً. لا نداء شبكي خارجي هنا إطلاقاً (كل البيانات محلية)، فلا خطر
// حدّ معدّل خارجي كما حدث مع CoinGecko.
setInterval(async () => {
    try {
        const month = budgetLastMonths(1)[0];
        for (const entry of listBudgetProjects(BUDGETWATCH_DIR)) {
            try {
                const { user, project } = entry;
                if (getUsageCount(USAGE_DIR, user, 'notifyMail') >= 300) continue;
                const budgets = listCollectionRecords(APPCOLLECTIONS_DIR, user, project, 'budgets');
                if (!budgets.length) continue;
                const transactions = listCollectionRecords(APPCOLLECTIONS_DIR, user, project, 'transactions');
                const statuses = budgetStatus(budgets, transactions, month).filter(s => s.over && shouldAlertBudget(entry, s.category, month));
                if (!statuses.length) continue;
                const owner = await DB.findUser(user).catch(() => null);
                if (!owner?.email || !isEmail(owner.email)) continue;
                for (const s of statuses) {
                    const sent = await sendMail({
                        to: owner.email,
                        subject: `⚠️ تجاوزت ميزانية «${s.category}» هذا الشهر — مستشار الميزانية`,
                        text: `رصد مستشار الميزانية في مشروعك «${project}» تجاوزاً لسقف فئة "${s.category}" هذا الشهر.\n\n` +
                            `السقف الشهري: ${s.monthlyLimit}\nالمصروف الفعلي: ${s.spent}\n\n` +
                            `راجع لوحة مشروعك للتفاصيل وتعديل الميزانية إن رغبت.`,
                    }).catch(() => ({ ok: false }));
                    if (sent.ok) { bumpUsage(USAGE_DIR, user, 'notifyMail'); markBudgetAlerted(BUDGETWATCH_DIR, user, project, s.category, month); }
                }
            } catch (e) { console.warn('[BudgetAlerts]', 'مشروع فشل:', e.message); }
        }
    } catch (e) { console.warn('[BudgetAlerts]', 'دورة الفحص فشلت:', e.message); }
}, 6 * 60 * 60 * 1000);

// 🔥 حلقة تسخين كاش مستشار الكريبتو — كل 45 ثانية (أقل من مهلة كاش
// الأسعار 60 ثانية): تُحدّث سلفاً أسعار العملات الشائعة + كل العملات
// المتابَعة عبر كل المشاريع (نداءات مُجمَّعة قليلة ≤20 عملة لكل نداء) —
// فيصل أغلب طلبات المستخدمين (تحديث لوحة العميل كل 60 ثانية) كاشاً ساخناً
// بدل انتظار نداء CoinGecko حيّ.
//
// ⚠️ عطل حقيقي كُشف هنا: كانت هذه الحلقة تُسخِّن أيضاً كاش getAnalysis
// بنداء منفصل لكل عملة (حتى 60 نداءً شبكياً متتالياً) — عند أول تشغيل بعد
// كل إعادة نشر/إيقاظ الخادم (Render ينام الخدمات المجانية) يكون الكاش
// بارداً بالكامل، فيضرب هذا الانفجار من النداءات المتتالية حدّ معدّل
// CoinGecko المجاني ويُسقط كل الاستجابات (بيانات "قديمة/تعذّر التحديث")
// حتى للمستخدمين الحقيقيين. أُزيل تسخين getAnalysis من هذه الحلقة تماماً؛
// تحديث تحليل كل عملة يبقى مغطّى بفتح المستخدم لشاشة التحليل مباشرة
// وبحلقة تنبيهات "الفرص القوية" الأبطأ (كل 5 دقائق) أدناه.
// حارس busy يمنع تراكم دورات متداخلة إن طال نداء شبكي واحد.
let cacheWarmBusy = false;
setInterval(async () => {
    if (cacheWarmBusy) return;
    cacheWarmBusy = true;
    try {
        const ids = new Set(SUPPORTED_COINS.map(c => c.id));
        for (const entry of listWatchlistIndex(CRYPTOWATCH_DIR)) {
            if (Array.isArray(entry.watchlist)) for (const id of entry.watchlist) ids.add(id);
        }
        const idList = [...ids].filter(isValidCoinId).slice(0, 60);
        for (let i = 0; i < idList.length; i += MAX_WATCHLIST) {
            await listMarkets(idList.slice(i, i + MAX_WATCHLIST)).catch(() => {});
        }
    } catch (e) { console.warn('[CacheWarm]', 'دورة التسخين فشلت:', e.message); }
    finally { cacheWarmBusy = false; }
}, 45 * 1000);

// ═══════════════════════════════════════════════════════════════════
// 📈 حلقات مستشار الأسهم/الفوركس — نفس منطق حلقات الكريبتو أعلاه بالضبط،
// بفهرس/سجل أداء/كاش منفصلين (STOCKWATCH_DIR/STOCK_SIGNAL_TRACK_DIR).
// ═══════════════════════════════════════════════════════════════════
setInterval(async () => {
    try {
        for (const entry of listWatchlistIndex(STOCKWATCH_DIR)) {
            try {
                const { user, project, watchlist } = entry;
                if (!Array.isArray(watchlist) || !watchlist.length) continue;
                if (getUsageCount(USAGE_DIR, user, 'notifyMail') >= 300) continue;
                const owner = await DB.findUser(user).catch(() => null);
                if (!owner?.email || !isEmail(owner.email)) continue;
                for (const id of watchlist) {
                    const a = await getStockAnalysis(id).catch(() => null);
                    if (!a || a.error) continue;
                    try { recordSignal(STOCK_SIGNAL_TRACK_DIR, a); } catch { /* السجل لا يُسقط الحلقة أبداً */ }
                    if (a.signal === 'hold') continue;
                    if (!shouldAlert(entry, id, a.signal)) continue;
                    const label = a.signal === 'buy' ? 'شراء' : 'بيع';
                    const sent = await sendMail({
                        to: owner.email,
                        subject: `📈 فرصة ${label} محتملة — ${id} (مستشار الأسهم/الفوركس)`,
                        text: `رصد مستشار الأسهم/الفوركس في مشروعك «${project}» إشارة ${label} لرمز ${id}.\n\n` +
                            `السعر الحالي: ${a.price ?? '—'}\nRSI: ${a.rsi != null ? a.rsi.toFixed(0) : '—'}\n\n` +
                            `هذا تحليل آلي إحصائي وليس نصيحة استثمارية ملزمة — راجع لوحة مشروعك للتفاصيل.`,
                    }).catch(() => ({ ok: false }));
                    if (sent.ok) { bumpUsage(USAGE_DIR, user, 'notifyMail'); markAlerted(STOCKWATCH_DIR, user, project, id, a.signal); }
                }
            } catch (e) { console.warn('[StockAlerts]', 'مشروع فشل:', e.message); }
        }
    } catch (e) { console.warn('[StockAlerts]', 'دورة الفحص فشلت:', e.message); }
}, 5 * 60 * 1000);

setInterval(async () => {
    try {
        const dueIds = getDueCoinIds(STOCK_SIGNAL_TRACK_DIR);
        if (!dueIds.length) return;
        const { symbols } = await listStockMarkets(dueIds).catch(() => ({ symbols: [] }));
        const priceById = {};
        for (const s of symbols) if (s?.id && s.price != null) priceById[s.id] = s.price;
        resolveDue(STOCK_SIGNAL_TRACK_DIR, priceById);
    } catch (e) { console.warn('[StockSignalTrackRecord]', 'دورة الحسم فشلت:', e.message); }
}, 30 * 60 * 1000);

// 🔥 تسخين كاش مستشار الأسهم/الفوركس — أسعار فقط (نفس الدرس المستفاد من
// عطل CoinGecko: لا تسخين لـgetAnalysis هنا إطلاقاً — انظر تعليق حلقة
// تسخين الكريبتو أعلاه لتفاصيل العطل الأصلي).
let stockCacheWarmBusy = false;
setInterval(async () => {
    if (stockCacheWarmBusy) return;
    stockCacheWarmBusy = true;
    try {
        const ids = new Set(SUPPORTED_SYMBOLS.map(s => s.id));
        for (const entry of listWatchlistIndex(STOCKWATCH_DIR)) {
            if (Array.isArray(entry.watchlist)) for (const id of entry.watchlist) ids.add(id);
        }
        const idList = [...ids].filter(isValidSymbolId).slice(0, 60);
        for (let i = 0; i < idList.length; i += STOCK_MAX_WATCHLIST) {
            await listStockMarkets(idList.slice(i, i + STOCK_MAX_WATCHLIST)).catch(() => {});
        }
    } catch (e) { console.warn('[StockCacheWarm]', 'دورة التسخين فشلت:', e.message); }
    finally { stockCacheWarmBusy = false; }
}, 45 * 1000);

// 🤖💱 حلقة بوت PancakeSwap الشخصي — كل 5 دقائق (نفس وتيرة CryptoAlerts).
// runTradingBotTickGuarded تبدأ بـcfg.enabled=false افتراضياً (لا شيء يعمل حتى
// يُفعِّله المشرف صراحةً من اللوحة)، وتحمل حارس تداخل خاصاً بها مشتركاً مع
// مسار /run-once اليدوي — تمنع تسابقاً يضاعف nonce التوقيع على معاملة حقيقية.
setInterval(async () => {
    try {
        const r = await runTradingBotTickGuarded(TRADINGBOT_DIR);
        if (r?.executed) console.warn('[TradingBot]', 'صفقة:', JSON.stringify({ coinId: r.coinId, side: r.side, status: r.status, txHash: r.txHash }));
    } catch (e) { console.warn('[TradingBot]', 'دورة التنفيذ فشلت:', e.message); }
}, 5 * 60 * 1000);

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
