import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { MonacoWorkspace } from '../components/editor/MonacoWorkspace.jsx';
import { MissionProgress } from '../components/MissionProgress.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { PreviewPanel } from '../components/PreviewPanel.jsx';
import { TimelinePanel } from '../components/TimelinePanel.jsx';
import { useJaolaStore } from '../store/useJaolaStore.js';
import { BACKEND_URL } from '../config.js';
import { useI18n } from '../i18n.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';

// 🧭 إطلاق سريع مقسّم بالمسار — كل زر يضبط المسار الصحيح + برومبت جاهز
// أنواع «الموقع» تطابق قوالبنا الحقيقية (متجر/مطعم/سفر/فعاليات/عقارات…)
const QUICK_BUILDS = {
  site: [
    { icon: '🛍️', labelKey: 'qtStore', promptKey: 'qbStore' },
    { icon: '🍽️', labelKey: 'qtRestaurant', promptKey: 'qbRestaurant' },
    { icon: '🎟️', labelKey: 'qtEvents', promptKey: 'qbEvents' },
    { icon: '🎬', labelKey: 'qtCinema', promptKey: 'qbCinemaSite' },
    { icon: '🏠', labelKey: 'qtRealestate', promptKey: 'qbRealestate' },
    { icon: '✈️', labelKey: 'qtTravel', promptKey: 'qbTravel' },
    { icon: '💪', labelKey: 'qtGym', promptKey: 'qbGym' },
    { icon: '💇', labelKey: 'qtSalon', promptKey: 'qbSalon' },
    { icon: '🏨', labelKey: 'qtHotel', promptKey: 'qbHotel' },
    { icon: '🎓', labelKey: 'qtLms', promptKey: 'qbLms' },
    { icon: '🛒', labelKey: 'qtMarketplace', promptKey: 'qbMarketplace' },
    { icon: '🚕', labelKey: 'qtTaxi', promptKey: 'qbTaxi' },
    { icon: '🚗', labelKey: 'qtCarRental', promptKey: 'qbCarRental' },
    { icon: '🧑‍💻', labelKey: 'qtCoworking', promptKey: 'qbCoworking' },
    { icon: '📸', labelKey: 'qtPhotography', promptKey: 'qbPhotography' },
    { icon: '📚', labelKey: 'qtTutoring', promptKey: 'qbTutoring' },
    { icon: '🧹', labelKey: 'qtCleaning', promptKey: 'qbCleaning' },
  ],
  system: [
    { icon: '🏭', labelKey: 'qtErp', promptKey: 'qbErpSys' },
    { icon: '🏥', labelKey: 'qtClinic', promptKey: 'qbClinic' },
    { icon: '💊', labelKey: 'qtPharmacy', promptKey: 'qbPharmacy' },
    { icon: '🏢', labelKey: 'qtProperty', promptKey: 'qbProperty' },
    { icon: '👥', labelKey: 'qtHr', promptKey: 'qbHr' },
    { icon: '🧾', labelKey: 'qtPos', promptKey: 'qbPos' },
    { icon: '🍳', labelKey: 'qtRestOps', promptKey: 'qbRestOps' },
    { icon: '🔧', labelKey: 'qtWorkshop', promptKey: 'qbWorkshop' },
    { icon: '📒', labelKey: 'qtAccounting', promptKey: 'qbAccounting' },
    { icon: '📦', labelKey: 'qtInventory', promptKey: 'qbInventory' },
    { icon: '🧺', labelKey: 'qtLaundry', promptKey: 'qbLaundry' },
    { icon: '⚖️', labelKey: 'qtLawfirm', promptKey: 'qbLawfirm' },
    { icon: '🎫', labelKey: 'qtHelpdesk', promptKey: 'qbHelpdesk' },
    { icon: '🚚', labelKey: 'qtFleet', promptKey: 'qbFleet' },
    { icon: '🐾', labelKey: 'qtVetClinic', promptKey: 'qbVetClinic' },
  ],
};

const BOOT_STEPS = [
  'Initializing JAOLA OS...',
  'Connecting AI Company...',
  'Loading Knowledge Base...',
  'Hiring AI Agents...',
  'Synchronizing Mission Control...',
  'Activating Digital Twin...',
  'Mission Control Ready ✓',
];

const SIDEBAR_ITEMS = [
  { icon: '⚡', label: 'Mission Control', id: 'mission' },
  { icon: '📁', label: 'Projects', id: 'projects' },
  { icon: '🤖', label: 'AI Company', id: 'agents' },
  { icon: '📚', label: 'Knowledge', id: 'knowledge' },
  { icon: '🛒', label: 'Marketplace', id: 'marketplace' },
  { icon: '🚀', label: 'Deployments', id: 'deployments' },
  { icon: '📈', label: 'Analytics', id: 'analytics' },
  { icon: '🎬', label: 'Cinema Studio', id: 'cinema' },
  { icon: '⚙️', label: 'Settings', id: 'settings' },
];

const MOBILE_TABS = [
  { id: 'mission', icon: '⚡', key: 'mMission' },
  { id: 'preview', icon: '🖥️', key: 'preview' },
  { id: 'editor', icon: '💻', key: 'code' },
  { id: 'logs', icon: '📋', key: 'logs' },
];

// ── Boot Screen ──────────────────────────────────────────────────
function BootScreen({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step < BOOT_STEPS.length) {
      const t = setTimeout(() => setStep(s => s + 1), step === BOOT_STEPS.length - 1 ? 600 : 500);
      return () => clearTimeout(t);
    } else {
      setTimeout(onDone, 300);
    }
  }, [step, onDone]);

  return (
    <div style={{ position:'fixed', inset:0, background:'#030508', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:9999, gap:40, padding:20 }}>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.3)}50%{box-shadow:0 0 60px rgba(59,130,246,0.7)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 20px', animation:'glow 2s infinite' }}>⚡</div>
        <div style={{ fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-1px', fontFamily:'system-ui' }}>JAOLA OS</div>
        <div style={{ fontSize:12, color:'#475569', marginTop:6, letterSpacing:'2px', textTransform:'uppercase' }}>Autonomous Software Engineering</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, width:'min(320px, 90vw)' }}>
        {BOOT_STEPS.slice(0, step).map((msg, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, animation:'fadeIn 0.3s ease', opacity: i < step - 1 ? 0.4 : 1, transition:'opacity 0.3s' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: i < step - 1 ? '#10b981' : '#3b82f6', boxShadow: i === step - 1 ? '0 0 10px #3b82f6' : 'none', flexShrink:0 }} />
            <span style={{ fontSize:13, color: i < step - 1 ? '#475569' : '#94a3b8', fontFamily:'monospace' }}>{msg}</span>
          </div>
        ))}
      </div>

      <div style={{ width:240, height:2, background:'#1e293b', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(step/BOOT_STEPS.length)*100}%`, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2, transition:'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Execution Feed Item — فقاعات بمستوى كلاود ───────────────────
// رسائل النظام (أحداث البناء الحية) — تُجمَّع في كتلة خطوات قابلة للطيّ
export function isStatusMsg(msg) {
  return msg.sender === 'system' ||
    (msg.sender !== 'user' && msg.text && (msg.text.includes('✅') || msg.text.includes('❌') || msg.text.includes('🎯') || msg.text.includes('🚀') || msg.text.includes('⚙️') || msg.text.includes('🔍')));
}

// يجمع رسائل الحالة المتتالية في مجموعات — كما يطوي كلاود خطوات تفكيره
export function groupFeed(messages = []) {
  const out = [];
  for (const msg of messages) {
    if (isStatusMsg(msg)) {
      const last = out[out.length - 1];
      if (last && last.type === 'steps') last.msgs.push(msg);
      else out.push({ type: 'steps', msgs: [msg] });
    } else {
      out.push({ type: 'msg', msg });
    }
  }
  return out;
}

// كتلة خطوات التنفيذ: مطويّة تلقائياً حين تنتهي، حيّة ومفتوحة أثناء البناء
export function StepsGroup({ msgs, live, t }) {
  const [open, setOpen] = useState(live);
  const shown = open || live;
  const last = msgs[msgs.length - 1];
  return (
    <div style={{ border:'1px solid rgba(59,130,246,0.12)', borderRadius:10, background:'rgba(15,23,42,0.4)', overflow:'hidden', animation:'fadeIn 0.2s ease' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'transparent', border:'none', color:'#64748b', fontSize:11, fontWeight:700, textAlign:'start' }}>
        <span style={{ display:'inline-block', transition:'transform 0.2s', transform: shown ? 'rotate(90deg)' : 'none', fontSize:9, color:'#3b82f6' }}>▶</span>
        <span style={{ color:'#94a3b8' }}>⚙️ {t?.('execSteps') || 'خطوات التنفيذ'}</span>
        <span style={{ background:'rgba(59,130,246,0.12)', color:'#93c5fd', borderRadius:10, padding:'0 7px', fontSize:9.5, fontWeight:800 }}>{msgs.length}</span>
        {live && <span style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', animation:'pulse 1s infinite' }} />}
        {!shown && last?.text && (
          <span style={{ color:'#475569', fontWeight:500, fontSize:10.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1, fontFamily:'monospace' }}>{last.text}</span>
        )}
      </button>
      {shown && (
        <div style={{ padding:'2px 12px 8px', display:'flex', flexDirection:'column', gap:2, borderTop:'1px solid rgba(59,130,246,0.08)' }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display:'flex', alignItems:'baseline', gap:10, padding:'2px 0' }}>
              <div style={{ width:1, background:'rgba(59,130,246,0.25)', alignSelf:'stretch', flexShrink:0 }} />
              <div style={{ fontSize:11, color:'#64748b', fontFamily:'monospace', flex:1, wordBreak:'break-word', lineHeight:1.6 }}>{m.text}</div>
              {m.timestamp && (
                <span style={{ fontSize:9, color:'#334155', fontFamily:'monospace', flexShrink:0, direction:'ltr' }}>
                  {new Date(m.timestamp).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedItem({ msg, onOption, onEdit, onRegenerate, canRegenerate, t }) {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  };
  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
    : null;
  const actionBtn = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'2px 8px', color:'#94a3b8', fontSize:10, fontWeight:600 };

  if (msg.sender === 'user') {
    return (
      <div className="feed-msg" style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', animation:'msgIn 0.3s cubic-bezier(.2,.8,.25,1)' }}>
        <div style={{ background:'linear-gradient(135deg,#1e40af,#4338ca)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:'14px 14px 4px 14px', padding:'9px 14px', maxWidth:'80%', fontSize:13, color:'#eef2ff', lineHeight:1.65, boxShadow:'0 4px 16px -8px rgba(67,56,202,0.5)', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
          {msg.text}
        </div>
        {/* أدوات تظهر عند المرور — نسخ + تعديل (يعيد النص لصندوق الكتابة) */}
        <div className="msg-tools" style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
          {timeStr && <span style={{ fontSize:9, color:'#334155', direction:'ltr' }}>{timeStr}</span>}
          <button onClick={() => copy(msg.text)} style={actionBtn}>{copied ? `✓ ${t?.('msgCopied') || 'نُسخ'}` : `⧉ ${t?.('msgCopy') || 'نسخ'}`}</button>
          {onEdit && <button onClick={() => onEdit(msg.text)} style={actionBtn}>✏️ {t?.('msgEdit') || 'تعديل'}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="feed-msg" style={{ display:'flex', gap:10, alignItems:'flex-start', animation:'msgIn 0.3s cubic-bezier(.2,.8,.25,1)' }}>
      <div style={{ width:28, height:28, borderRadius:9, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, marginTop:2, animation: msg.streaming ? 'avatarGlow 1.2s infinite' : 'none' }}>⚡</div>
      <div style={{ flex:1, minWidth:0, maxWidth:'88%' }}>
        <div style={{ background:'rgba(15,23,42,0.65)', border:'1px solid rgba(59,130,246,0.13)', borderRadius:'4px 14px 14px 14px', padding:'10px 14px', fontSize:12.5, color:'#cbd5e1', lineHeight:1.75, position:'relative', transition:'border-color 0.2s' }}>
          {msg.streaming && !msg.text
            ? <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                <span className="thinking-shimmer" style={{ fontSize:12, fontWeight:600 }}>{t?.('thinking') || 'يفكّر'}</span>
                <span style={{ display:'inline-flex', gap:3 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite' }} />
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite 0.2s' }} />
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite 0.4s' }} />
                </span>
              </span>
            : <span style={{ display:'inline' }}>
                <Markdown text={msg.text} />
                {msg.streaming && <span style={{ display:'inline-block', width:7, height:14, background:'#60a5fa', marginInlineStart:2, verticalAlign:'text-bottom', animation:'blink 1s step-end infinite', borderRadius:1 }} />}
              </span>}

          {/* 🔟 اقتراحات استباقية — أزرار الخطوة التالية */}
          {Array.isArray(msg.options) && msg.options.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
              {msg.options.map((opt, i) => (
                <button key={i} onClick={() => onOption?.(opt)} className="chip-suggest"
                  style={{
                    background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.28)',
                    borderRadius:99, padding:'6px 14px', color:'#93c5fd', fontSize:11, fontWeight:700,
                  }}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* شريط أدوات الرد — يظهر عند المرور */}
        {!msg.streaming && msg.text && (
          <div className="msg-tools" style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
            <button onClick={() => copy(msg.text)} style={actionBtn}>{copied ? `✓ ${t?.('msgCopied') || 'نُسخ'}` : `⧉ ${t?.('msgCopy') || 'نسخ'}`}</button>
            {canRegenerate && onRegenerate && <button onClick={onRegenerate} style={actionBtn}>🔄 {t?.('msgRegenerate') || 'إعادة التوليد'}</button>}
            {timeStr && <span style={{ fontSize:9, color:'#334155', direction:'ltr' }}>{timeStr}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent Node (شريط الوكلاء السفلي — سطح المكتب) ───────────────
function AgentNode({ name, state, icon }) {
  const isActive = state === 'running';
  const isDone = state === 'completed';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
      <div style={{
        width:36, height:36, borderRadius:10,
        background: isDone ? 'rgba(16,185,129,0.1)' : isActive ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isDone ? 'rgba(16,185,129,0.4)' : isActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
        boxShadow: isActive ? '0 0 12px rgba(59,130,246,0.25)' : 'none',
        animation: isActive ? 'agentPulse 1.5s infinite' : 'none',
        transition:'all 0.3s'
      }}>
        {isDone ? '✓' : icon}
      </div>
      <span style={{ fontSize:9, color: isDone ? '#10b981' : isActive ? '#60a5fa' : '#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{name}</span>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const { currentUser: authUser, token, isAuthenticated, handleAuthError, setIsAuthenticated, setCurrentUser, setToken, isLoading, oauthError } = useAuth();
  const isMobile = useIsMobile();

  const [booted, setBooted] = useState(() => sessionStorage.getItem('booted') === '1');
  const [activeNav, setActiveNav] = useState('mission');
  const [activeTab, setActiveTab] = useState('preview');       // سطح المكتب: تاب العمود الأوسط
  const [mobileView, setMobileView] = useState('mission');     // الجوال: الشاشة النشطة
  const [mobileLogsMode, setMobileLogsMode] = useState('logs'); // الجوال: سجل حي / خط زمني
  const [showMobileMenu, setShowMobileMenu] = useState(false);  // الجوال: قائمة الإجراءات الثانوية
  const [showSiteHealth, setShowSiteHealth] = useState(false);  // الجوال: بطاقة حالة الموقع (مؤشرات الجودة)
  const [prompt, setPrompt] = useState('');
  // 🧭 مسار البناء: موقع (لزوّار) أو سيستم داخلي (أداة عمل) — يمنع القفز لقالب خاطئ
  const [buildTrack, setBuildTrack] = useState('site');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState('');
  const [addingLibrary, setAddingLibrary] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authError, setAuthError] = useState('');
  const [oauthProviders, setOauthProviders] = useState([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledge, setKnowledge] = useState(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // 'grow' | 'settings' | null
  const [visitsToday, setVisitsToday] = useState(0);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [inbox, setInbox] = useState(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryTemplates, setGalleryTemplates] = useState(null);
  const [galleryFilter, setGalleryFilter] = useState('all');
  const [showSecretsModal, setShowSecretsModal] = useState(false);
  const [secretKeys, setSecretKeys] = useState([]);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretVal, setNewSecretVal] = useState('');
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretError, setSecretError] = useState('');
  const [ghForm, setGhForm] = useState({ repoUrl: '', pat: '', branch: 'main', autoCommit: true });
  const [ghStatus, setGhStatus] = useState(null);
  const [isGhSaving, setIsGhSaving] = useState(false);
  const [buildStartedAt, setBuildStartedAt] = useState(null);

  const feedEndRef = useRef(null);
  const textareaRef = useRef(null);
  const feedScrollRef = useRef(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  // زرّ «الأحدث» يظهر حين يبتعد المستخدم عن أسفل الشات (يقرأ سجلّاً قديماً)
  const handleFeedScroll = () => {
    const el = feedScrollRef.current; if (!el) return;
    setShowJumpLatest(el.scrollHeight - el.scrollTop - el.clientHeight > 280);
  };
  const notifId = useRef(0);

  // 🔑 اكتشاف مزوّدي OAuth المُهيّئين + عرض خطأ ارتداد OAuth إن وُجد
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/providers`)
      .then(r => r.json()).then(d => setOauthProviders(d.providers || [])).catch(() => {});
  }, []);
  useEffect(() => { if (oauthError) setAuthError(oauthError); }, [oauthError]);

  const { files, logs, streamingContent, agentStates, projects, activeProject, currentUser, vercelUrl, chatMessages, setChatMessages, setActiveProject, previewTimestamp, refreshPreview, isConnected, connectionError, metrics, latencyMs, missionPhase } = useSocket(isAuthenticated, handleAuthError);

  // 📊 قيم لوحة الذكاء الحقيقية (مع بدائل عند غياب البيانات)
  const gradeColor = (g) => g === 'A' ? '#10b981' : g === 'B' ? '#fbbf24' : g ? '#f97316' : '#334155';
  const fmtScore = (s) => s ? `${s.grade}${s.score != null ? ` ${s.score}%` : ''}` : '—';
  const sysUptime = metrics?.system?.uptimeSec ?? null;
  const fmtUptime = sysUptime == null ? '—'
    : sysUptime >= 3600 ? `${Math.floor(sysUptime/3600)}س ${Math.floor((sysUptime%3600)/60)}د`
    : `${Math.floor(sysUptime/60)}د`;

  // ── Monaco Workspace Store ──────────────────────────────────────
  const openJaolaFile = useJaolaStore(s => s.openFile);
  const openFiles = useJaolaStore(s => s.openFiles);
  const activeFilePath = useJaolaStore(s => s.activeFilePath);
  const activeFileContent = openFiles.find(f => f.path === activeFilePath)?.content || '';
  const activeFile = activeFilePath;

  useEffect(() => {
    if (isAuthenticated && token) {
      useJaolaStore.getState().setContext({ token, project: activeProject });
    }
  }, [token, activeProject, isAuthenticated]);

  const t = useI18n(s => s.t);
  const uiLang = useI18n(s => s.lang);

  const isBuilding = Object.values(agentStates || {}).some(s => s === 'running');
  const lastLogMsg = logs[logs.length - 1]?.message || '';

  // تتبع بداية البناء لعرض المؤقت في بطاقة التقدم
  useEffect(() => {
    setBuildStartedAt(prev => {
      if (isBuilding && !prev) return Date.now();
      if (!isBuilding && prev) return null;
      return prev;
    });
  }, [isBuilding]);

  // تمرير تلقائي للأحدث (سلوك كلاود):
  //  - أول تحميل (تاريخ محادثة أو فتح مشروع): قفزة فورية لآخر رسالة — لا يفتح على القديم أبداً
  //  - رسالة من المستخدم نفسه: تمرير مضمون دائماً مهما كان موضعه
  //  - غير ذلك: يتبع الأحدث إلا إذا صعد المستخدم يقرأ سجلاً قديماً
  const prevFeedCount = useRef(0);
  useEffect(() => { prevFeedCount.current = 0; }, [activeProject]); // تبديل المشروع = تحميل أول من جديد
  useEffect(() => {
    const el = feedScrollRef.current;
    const last = chatMessages[chatMessages.length - 1];
    // «أول تحميل» = أول رسائل تظهر، أو وصول دفعة التاريخ (قد تصل بعد أحداث حية)
    const bulkInsert = chatMessages.length - prevFeedCount.current > 3;
    const firstLoad = (prevFeedCount.current === 0 && chatMessages.length > 0) || bulkInsert;
    prevFeedCount.current = chatMessages.length;
    if (firstLoad) {
      requestAnimationFrame(() => feedEndRef.current?.scrollIntoView({ behavior:'auto' }));
      return;
    }
    const nearBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight) < 280;
    // ✨ أثناء البثّ الحرفي (نفس الرسالة تنمو ~60fps): تثبيت فوري ناعم على
    // القاع بلا تكديس «smooth» يتضارب — تماماً كسلوك كلاود
    if (last?.streaming) {
      if (nearBottom) feedEndRef.current?.scrollIntoView({ behavior:'auto' });
      return;
    }
    if (last?.sender === 'user' || nearBottom) {
      feedEndRef.current?.scrollIntoView({ behavior:'smooth' });
    }
  }, [chatMessages, isBuilding, isSending]);

  useEffect(() => {
    if (logs.length > 0) {
      const last = logs[logs.length - 1];
      if (last?.message?.includes('✨ نجاح')) {
        addNotification(t('nBuildDone'), 'success');
        if (isMobile) setMobileView('preview'); else setActiveTab('preview');
      }
    }
  }, [logs]);

  const addNotification = (msg, type = 'info') => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const getHeaders = () => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' });

  const handleSend = async (overrideText) => {
    // overrideText: نص مباشر من زر اقتراح (وليس حدث onClick)
    const raw = typeof overrideText === 'string' ? overrideText : prompt;
    const msg = raw.trim();
    if (!msg || isSending) return;
    setIsSending(true);
    if (typeof overrideText !== 'string') setPrompt('');
    setChatMessages(prev => [...prev, { sender: 'user', text: msg, timestamp: Date.now() }]);
    try {
      await fetch(`${BACKEND_URL}/api/chat`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ message: msg, project: activeProject, uiLang, track: buildTrack }) });
    } catch { setIsSending(false); return; }
    // فقاعة «يفكّر» تبقى حتى وصول أول رد/حدث فعلي (لا مؤقّت ثانية يتركك في صمت)
    // — تُطفأ في effect أدناه، مع سقف أمان إن انقطع كل شيء
    setTimeout(() => setIsSending(false), 45000);
  };

  // إطفاء «يفكّر» لحظة وصول أي رد أو حدث من المنصّة
  useEffect(() => {
    if (!isSending) return;
    const last = chatMessages[chatMessages.length - 1];
    if (last && last.sender !== 'user') setIsSending(false);
  }, [chatMessages, isSending]);

  // 🔟 ضغطة زر اقتراح → تُرسل كرسالة (بعد إزالة الرموز التعبيرية من البداية)
  const handleOptionClick = (opt) => {
    const clean = opt.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    handleSend(clean || opt);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    addNotification(t('nDeploying'), 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/deploy`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json().catch(() => ({}));
      // 🖥️ مشروع full-stack → خادم دائم على Render (زر بضغطة واحدة)
      if (d.target === 'render') {
        setIsDeploying(false);
        // 🚀 أتمتة كاملة: المنصّة أنشأت المستودع والخدمة وحقنت الأسرار — الرابط جاهز
        if (d.liveUrl) {
          addNotification(`${t('renderAutoLive')} ${d.liveUrl}`, 'success');
          window.open(d.liveUrl, '_blank', 'noopener');
          return;
        }
        if (d.needsGitHub) {
          // Render ينشر من GitHub — نفتح ربط GitHub مباشرةً (الخطوة الوحيدة المتبقية)
          addNotification(t('renderNeedsGithub'), 'info');
          openGithubModal();
          return;
        }
        if (d.deployUrl) {
          addNotification(t('renderReady'), 'success');
          window.open(d.deployUrl, '_blank', 'noopener');
          return;
        }
        addNotification(`❌ ${d.error || t('deployFail')}`, 'info');
        return;
      }
    } catch {}
    setTimeout(() => { setIsDeploying(false); addNotification(t('nDeployed'), 'success'); }, 8000);
  };

  // 🤖 استوديو مساعد الموقع — تخصيص كامل (اسم/رمز/ترحيب/أسئلة شائعة/ذكاء)
  const [showBotModal, setShowBotModal] = useState(false);
  const [botInstalled, setBotInstalled] = useState(false);
  const [botLoading, setBotLoading] = useState(false);
  const [botEmbedUrl, setBotEmbedUrl] = useState(null);
  const [botForm, setBotForm] = useState({ brandName: '', emoji: '🤖', welcome: '', quick: '', faq: [], ai: true });

  const openBotModal = async () => {
    setShowBotModal(true);
    setBotLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/jaola-bot/status?project=${encodeURIComponent(activeProject || '')}`, { headers: getHeaders() });
      const d = await res.json().catch(() => ({}));
      setBotInstalled(!!d.installed);
      setBotEmbedUrl(d.embedUrl || null);
      const c = d.config || {};
      setBotForm({
        brandName: c.brandName || activeProject || '',
        emoji: c.emoji || '🤖',
        welcome: c.welcome || '',
        quick: Array.isArray(c.quick) ? c.quick.join('، ') : '',
        faq: Array.isArray(c.faq) && c.faq.length ? c.faq : [{ q: '', a: '' }],
        ai: c.ai !== false,
      });
    } catch {
      setBotInstalled(false);
      setBotForm({ brandName: activeProject || '', emoji: '🤖', welcome: '', quick: '', faq: [{ q: '', a: '' }], ai: true });
    }
    setBotLoading(false);
  };

  const handleSaveBot = async () => {
    if (isAddingBot) return;
    setIsAddingBot(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/jaola-bot/generate`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          project: activeProject,
          brandName: botForm.brandName.trim() || activeProject,
          emoji: botForm.emoji.trim() || '🤖',
          welcome: botForm.welcome.trim() || undefined,
          quick: botForm.quick.split(/[،,]/).map(s => s.trim()).filter(Boolean).slice(0, 4),
          faq: botForm.faq.filter(x => x.q.trim() && x.a.trim()).map(x => ({ q: x.q.trim(), a: x.a.trim() })),
          ai: botForm.ai,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        addNotification(t('botAdded'), 'success');
        setBotInstalled(true);
        setShowBotModal(false);
        refreshPreview();
      } else {
        addNotification(`❌ ${d.error || t('botFail')}`, 'info');
      }
    } catch {
      addNotification(`❌ ${t('botFail')}`, 'info');
    }
    setIsAddingBot(false);
  };

  // 🧩 «ابدأ من قالب» — يطبّق كلوناً عاملاً على المشروع مباشرةً (حتميّ، بلا ذكاء)
  const handleApplyTemplate = async (cloneId) => {
    if (applyingTemplate) return;
    setApplyingTemplate(cloneId);
    addNotification(t('applyingTemplate'), 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/template/apply`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject, cloneId, lang: uiLang }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        addNotification(`${t('templateApplied')} «${d.name}»`, 'success');
        setShowKnowledgeModal(false);
        setShowGalleryModal(false);
        refreshPreview();
      } else {
        addNotification(`❌ ${d.error || t('templateFail')}`, 'info');
      }
    } catch {
      addNotification(`❌ ${t('templateFail')}`, 'info');
    }
    setApplyingTemplate('');
  };

  // 🔗 «أضف مكتبة» — يحقن مكتبة جاهزة (CDN) في موقع المشروع
  const handleAddLibrary = async (libraryId) => {
    if (addingLibrary) return;
    setAddingLibrary(libraryId);
    addNotification(t('addingLibrary'), 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/library/add`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject, libraryId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        addNotification(d.already ? t('libraryExists') : `${t('libraryAdded')} «${d.name}»`, 'success');
        refreshPreview();
      } else {
        addNotification(`❌ ${d.error || t('libraryFail')}`, 'info');
      }
    } catch {
      addNotification(`❌ ${t('libraryFail')}`, 'info');
    }
    setAddingLibrary('');
  };

  // ✨ «اجعله احترافياً» — باقة تلميع حتميّة على الموقع
  const handlePolish = async () => {
    if (isPolishing) return;
    setIsPolishing(true);
    addNotification(t('polishing'), 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/polish/apply`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        addNotification(d.already ? t('polishedAlready') : t('polished'), 'success');
        refreshPreview();
      } else {
        addNotification(`❌ ${d.error || t('polishFail')}`, 'info');
      }
    } catch {
      addNotification(`❌ ${t('polishFail')}`, 'info');
    }
    setIsPolishing(false);
  };

  // 🩺 فحص جاهزية النشر على Vercel — يعرض تشخيصاً دقيقاً بدل تخمين "Not authorized"
  const handleVercelCheck = async () => {
    addNotification(t('vercelChecking') || 'جاري فحص إعداد Vercel...', 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/deploy/vercel-check`, { headers: getHeaders() });
      const d = await res.json();
      addNotification(d.message || (d.ok ? '✅' : '❌'), d.ok ? 'success' : 'info');
    } catch (e) {
      addNotification('❌ تعذّر الوصول للخادم للفحص.', 'info');
    }
  };

  // 📚 معرفة المنصّة — فهم المشروع الحالي + مكتبة الفئات + الدروس المتراكمة
  const openKnowledgeModal = async () => {
    setShowKnowledgeModal(true);
    setKnowledgeLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/platform/knowledge?project=${encodeURIComponent(activeProject || '')}`, { headers: getHeaders() });
      const d = await res.json();
      setKnowledge(d);
    } catch {
      setKnowledge({ error: true });
    }
    setKnowledgeLoading(false);
  };

  // 🖼️ معرض القوالب البصري — بطاقات بمعاينات حقيقية، يبدأ منها المستخدم بضغطة
  const openGalleryModal = async () => {
    setShowGalleryModal(true);
    if (galleryTemplates) return; // القائمة ثابتة — لا إعادة جلب
    try {
      const res = await fetch(`${BACKEND_URL}/api/templates`, { headers: getHeaders() });
      const d = await res.json();
      setGalleryTemplates(d.templates || []);
    } catch {
      setGalleryTemplates([]);
    }
  };

  // 🩺 صحّة المشروع — يعرض نتيجة التحقّق السلوكي (يعمل / يحتاج مراجعة + تفصيل الفحوص)
  const openHealthModal = async () => {
    setShowHealthModal(true);
    setHealthLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/health?project=${encodeURIComponent(activeProject || '')}`, { headers: getHeaders() });
      const d = await res.json();
      setHealth(d);
    } catch {
      setHealth({ error: true });
    }
    setHealthLoading(false);
  };

  // 🎨 هوية الموقع — رفع الشعار + صور AI حقيقية فوق الصور الحتمية
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandBusy, setBrandBusy] = useState(null); // 'logo' | 'ai' | null
  const logoInputRef = useRef(null);

  const uploadLogo = (file) => {
    if (!file || brandBusy) return;
    if (file.size > 3 * 1024 * 1024) { addNotification(`❌ ${t('brandLogoTooBig')}`, 'info'); return; }
    setBrandBusy('logo');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/project/logo`, {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ project: activeProject, name: file.name, dataUrl: reader.result }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.success) { addNotification(`✓ ${t('brandLogoDone')}`, 'success'); refreshPreview(); }
        else addNotification(`❌ ${d.error || t('serverUnreachable')}`, 'info');
      } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
      setBrandBusy(null);
    };
    reader.onerror = () => setBrandBusy(null);
    reader.readAsDataURL(file);
  };

  const generateAiImages = async () => {
    if (brandBusy) return;
    setBrandBusy('ai');
    addNotification(t('brandAiWorking'), 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/ai-images`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) { addNotification(`🎨 ${t('brandAiDone')} (${d.count})`, 'success'); refreshPreview(); }
      else addNotification(`${d.notConfigured ? '⚙️' : '❌'} ${d.error || t('serverUnreachable')}`, 'info');
    } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
    setBrandBusy(null);
  };

  // 🌐 نطاقك الخاص — ربط نطاق المستخدم بموقعه المنشور على Vercel
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [domainData, setDomainData] = useState(null); // null=تحميل | {none} | {domain,status,dns,verification} | {error}
  const [domainInput, setDomainInput] = useState('');
  const [domainBusy, setDomainBusy] = useState(false);

  const fetchDomainStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/domains?project=${activeProject}`, { headers: getHeaders() });
      const d = await res.json().catch(() => ({}));
      setDomainData(res.ok ? d : { error: d.error || t('serverUnreachable') });
    } catch { setDomainData({ error: t('serverUnreachable') }); }
  };
  const openDomainModal = () => { setDomainData(null); setShowDomainModal(true); fetchDomainStatus(); };

  const attachDomainReq = async () => {
    if (!domainInput.trim() || domainBusy) return;
    setDomainBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/domains`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject, domain: domainInput }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        addNotification(`✓ ${t('domAttached')}`, 'success');
        setDomainInput('');
        setDomainData({ domain: d.domain, status: d.status, dns: d.dns, verification: d.verification });
      } else addNotification(`❌ ${d.error || t('serverUnreachable')}`, 'info');
    } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
    setDomainBusy(false);
  };

  const detachDomainReq = async () => {
    if (domainBusy) return;
    setDomainBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/domains?project=${activeProject}`, { method: 'DELETE', headers: getHeaders() });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) { addNotification(`✓ ${t('domDetached')}`, 'success'); setDomainData({ none: true }); }
      else addNotification(`❌ ${d.error || t('serverUnreachable')}`, 'info');
    } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
    setDomainBusy(false);
  };

  // 🧩 وكلائي — صناعة وكلاء مخصّصين (شخصية + معرفة) قابلين للتضمين في أي موقع
  const [showAgentsModal, setShowAgentsModal] = useState(false);
  const [agentsData, setAgentsData] = useState(null);
  const [agentForm, setAgentForm] = useState(null); // null = القائمة؛ كائن = نموذج تحرير/إنشاء
  const [agentSaving, setAgentSaving] = useState(false);

  const openAgentsModal = async () => {
    setShowAgentsModal(true);
    setAgentForm(null);
    setAgentsData(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents`, { headers: getHeaders() });
      const d = await res.json().catch(() => ({}));
      setAgentsData(res.ok ? d : { error: true });
    } catch { setAgentsData({ error: true }); }
  };

  const saveAgent = async () => {
    if (agentSaving || !agentForm) return;
    setAgentSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(agentForm),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) { addNotification(`✓ ${t('agSaved')}`, 'success'); openAgentsModal(); }
      else addNotification(`❌ ${d.error || t('serverUnreachable')}`, 'info');
    } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
    setAgentSaving(false);
  };

  const removeAgent = async (a) => {
    if (!window.confirm(`${t('agDeleteConfirm')} «${a.name}»`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/agents/${a.id}`, { method: 'DELETE', headers: getHeaders() });
      openAgentsModal();
    } catch {}
  };

  // 📣 المساعد التسويقي — أسبوع منشورات من محتوى الموقع + مسودّات ردود
  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [mkPosts, setMkPosts] = useState(null);
  const [mkLoading, setMkLoading] = useState(false);
  const [copiedPost, setCopiedPost] = useState(null);
  const [inboxDrafts, setInboxDrafts] = useState({});

  const [chStatus, setChStatus] = useState(null);
  const [chSetup, setChSetup] = useState(null); // 'telegram' | 'facebook' | 'x' | null
  const [tgForm, setTgForm] = useState({ botToken: '', chatId: '' });
  const [fbForm, setFbForm] = useState({ pageId: '', pageToken: '' });
  const [xForm, setXForm] = useState({ apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' });
  const [tgBusy, setTgBusy] = useState(false);
  const [tgPublishing, setTgPublishing] = useState(null);
  const [schedItems, setSchedItems] = useState(null);
  const [schedBusy, setSchedBusy] = useState(false);

  const anyChannel = !!(chStatus?.telegram?.configured || chStatus?.facebook?.configured || chStatus?.x?.configured);
  const postText = (p) => `${p.text}\n\n${(p.hashtags || []).join(' ')}`.trim();

  const fetchChannels = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/social/status`, { headers: getHeaders() });
      const d = await res.json().catch(() => ({}));
      setChStatus(res.ok ? d.channels : null);
    } catch { setChStatus(null); }
  };
  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/social/schedule`, { headers: getHeaders() });
      const d = await res.json().catch(() => ({}));
      setSchedItems(res.ok ? (d.items || []) : []);
    } catch { setSchedItems([]); }
  };

  const setupChannel = async (channel) => {
    if (tgBusy) return;
    setTgBusy(true);
    const bodies = {
      telegram: { url: '/api/social/telegram/setup', body: { botToken: tgForm.botToken.trim(), chatId: tgForm.chatId.trim() } },
      facebook: { url: '/api/social/facebook/setup', body: { pageId: fbForm.pageId.trim(), pageToken: fbForm.pageToken.trim() } },
      x: { url: '/api/social/x/setup', body: { apiKey: xForm.apiKey.trim(), apiSecret: xForm.apiSecret.trim(), accessToken: xForm.accessToken.trim(), accessSecret: xForm.accessSecret.trim() } },
    };
    try {
      const res = await fetch(`${BACKEND_URL}${bodies[channel].url}`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(bodies[channel].body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        addNotification(`✓ ${t('chConnected')}`, 'success');
        setChSetup(null);
        setTgForm({ botToken: '', chatId: '' }); setFbForm({ pageId: '', pageToken: '' });
        setXForm({ apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' });
        fetchChannels();
      } else addNotification(`❌ ${d.error || t('serverUnreachable')}`, 'info');
    } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
    setTgBusy(false);
  };

  const disconnectChannel = async (channel) => {
    const urls = { telegram: '/api/social/telegram', facebook: '/api/social/facebook', x: '/api/social/x' };
    try {
      await fetch(`${BACKEND_URL}${urls[channel]}`, { method: 'DELETE', headers: getHeaders() });
      fetchChannels();
    } catch {}
  };

  const publishPost = async (i, p) => {
    if (tgPublishing != null) return;
    setTgPublishing(i);
    try {
      const res = await fetch(`${BACKEND_URL}/api/social/publish`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ text: postText(p) }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        const fails = Object.entries(d.results || {}).filter(([, r]) => !r.ok);
        addNotification(fails.length ? `${t('pubPartial')} (${fails.map(([c]) => c).join('، ')})` : t('tgPublished'), fails.length ? 'info' : 'success');
      } else {
        const firstErr = d.error || Object.values(d.results || {}).find(r => r.error)?.error;
        addNotification(`❌ ${firstErr || t('tgPublishFail')}`, 'info');
      }
    } catch { addNotification(`❌ ${t('tgPublishFail')}`, 'info'); }
    setTgPublishing(null);
  };

  const shareWhatsApp = (p) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(postText(p))}`, '_blank', 'noopener');
  };

  // 📅 جدولة الأسبوع: منشور يومياً الساعة 10 صباحاً بدءاً من الغد
  const scheduleWeek = async () => {
    if (schedBusy || !mkPosts?.posts?.length) return;
    setSchedBusy(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(10, 0, 0, 0);
      const posts = mkPosts.posts.map((p, i) => ({ text: postText(p), at: start.getTime() + i * 86400000 }));
      const res = await fetch(`${BACKEND_URL}/api/social/schedule`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ posts }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) { addNotification(`📅 ${t('schedDone')} (${d.scheduled})`, 'success'); fetchSchedules(); }
      else addNotification(`❌ ${d.error || t('serverUnreachable')}`, 'info');
    } catch { addNotification(`❌ ${t('serverUnreachable')}`, 'info'); }
    setSchedBusy(false);
  };

  const cancelScheduled = async (id) => {
    try {
      await fetch(`${BACKEND_URL}/api/social/schedule/${id}`, { method: 'DELETE', headers: getHeaders() });
      fetchSchedules();
    } catch {}
  };

  const generatePosts = async () => {
    setMkLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/marketing/posts`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject, lang: uiLang }),
      });
      const d = await res.json().catch(() => ({}));
      setMkPosts(res.ok && d.success ? d : { error: d.error || true });
    } catch { setMkPosts({ error: true }); }
    setMkLoading(false);
  };
  const openMarketingModal = () => { setShowMarketingModal(true); setMkPosts(null); generatePosts(); fetchChannels(); fetchSchedules(); };

  const copyPost = (i, p) => {
    const text = `${p.text}\n\n${(p.hashtags || []).join(' ')}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedPost(i);
    setTimeout(() => setCopiedPost(null), 1500);
  };

  const [sendingReply, setSendingReply] = useState(null);
  const sendReplyMail = async (m, draftText) => {
    const id = m.id || m.at;
    if (sendingReply) return;
    setSendingReply(id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/inbox/reply-send`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject, to: m.contact, text: draftText }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) addNotification(t('replySent'), 'success');
      else addNotification(`❌ ${d.error || t('replySendFail')}`, 'info');
    } catch { addNotification(`❌ ${t('replySendFail')}`, 'info'); }
    setSendingReply(null);
  };

  const draftReply = async (m) => {
    const id = m.id || m.at;
    setInboxDrafts(dr => ({ ...dr, [id]: { loading: true } }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/marketing/reply-draft`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ project: activeProject, name: m.name, message: m.message, lang: uiLang }),
      });
      const d = await res.json().catch(() => ({}));
      setInboxDrafts(dr => ({ ...dr, [id]: { loading: false, text: (res.ok && d.draft) || '' } }));
    } catch {
      setInboxDrafts(dr => ({ ...dr, [id]: { loading: false, text: '' } }));
    }
  };

  // 📬 بريد الموقع — رسائل «تواصل معنا» من الموقع المنشور + عدّاد الزيارات
  const openInboxModal = async () => {
    setShowInboxModal(true);
    setInboxLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/site/inbox?project=${encodeURIComponent(activeProject || '')}`, { headers: getHeaders() });
      const d = await res.json();
      setInbox(res.ok ? d : { error: true });
      // فتح الصندوق = قراءة الكل (الشارة تُصفَّر)
      if (res.ok && d.unread > 0) {
        fetch(`${BACKEND_URL}/api/site/inbox/seen`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) }).catch(() => {});
      }
      setInboxUnread(0);
    } catch {
      setInbox({ error: true });
    }
    setInboxLoading(false);
  };

  // شارة غير المقروء — تُحدَّث مع تبديل المشروع
  useEffect(() => {
    if (!activeProject || !token) { setInboxUnread(0); return; }
    fetch(`${BACKEND_URL}/api/site/inbox?project=${encodeURIComponent(activeProject)}`, { headers: getHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setInboxUnread(d?.unread || 0); setVisitsToday(d?.visits?.today || 0); })
      .catch(() => {});
  }, [activeProject, token]);

  // ⏹️ إيقاف المهمة الجارية
  const handleAbort = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/abort`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json();
      addNotification(d.aborted ? t('nStopping') : t('nNoMission'), 'info');
    } catch {}
  };

  // 🐙 GitHub
  const openGithubModal = async () => {
    setShowGithubModal(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/github/status?project=${activeProject}`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setGhStatus(d);
        setGhForm(f => ({ ...f, repoUrl: d.repoUrl || '', branch: d.branch || 'main', autoCommit: d.autoCommit ?? true, pat: '' }));
      }
    } catch {}
  };

  // 🔑 أسرار المشروع (متغيّرات البيئة مثل MONGODB_URI)
  const openSecretsModal = async () => {
    setShowSecretsModal(true); setSecretError(''); setNewSecretKey(''); setNewSecretVal('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/secrets?project=${activeProject}`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setSecretKeys(d.keys || []); }
    } catch {}
  };
  const handleAddSecret = async () => {
    const key = newSecretKey.trim(), value = newSecretVal.trim();
    if (!key || !value) return;
    setSecretBusy(true); setSecretError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/secret`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject, key, value }) });
      const d = await res.json();
      if (res.ok) { setSecretKeys(d.keys || []); setNewSecretKey(''); setNewSecretVal(''); addNotification(t('secretSaved'), 'success'); }
      else setSecretError(d.error || 'خطأ');
    } catch { setSecretError('تعذّر الحفظ'); }
    setSecretBusy(false);
  };
  const handleDeleteSecret = async (key) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/secret`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ project: activeProject, key }) });
      const d = await res.json();
      if (res.ok) setSecretKeys(d.keys || []);
    } catch {}
  };

  const handleGithubConnect = async () => {
    if (!ghForm.repoUrl.trim() && !ghForm.pat.trim()) return;
    setIsGhSaving(true);
    try {
      const body = { project: activeProject, branch: ghForm.branch || 'main', autoCommit: ghForm.autoCommit };
      if (ghForm.repoUrl.trim()) body.repoUrl = ghForm.repoUrl.trim();
      if (ghForm.pat.trim()) body.pat = ghForm.pat.trim();
      const res = await fetch(`${BACKEND_URL}/api/github/connect`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
      const d = await res.json();
      if (res.ok) {
        addNotification(t('nGithubLinked'), 'success');
        setGhForm(f => ({ ...f, pat: '' }));
        setShowGithubModal(false);
      } else {
        addNotification(`❌ ${d.error || t('linkFail')}`, 'info');
      }
    } catch {}
    setIsGhSaving(false);
  };

  const handleGithubPush = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/github/push`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json();
      addNotification(res.ok ? t('pushingGithub') : `❌ ${d.error || t('pushFail')}`, 'info');
      if (res.ok) setShowGithubModal(false);
    } catch {}
  };

  const handleSwitchProject = (p) => {
    setActiveProject(p);
    // إعادة الانضمام لغرفة المشروع الجديد عبر الـ socket فوراً
    if (socket.connected) socket.emit('join_project', { project: p });
  };

  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ name }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // نستخدم الاسم المُطهَّر من السيرفر (قد يختلف عن المُدخل)
        handleSwitchProject(d.activeProject || name);
        setShowProjectModal(false);
        setNewProjectName('');
        addNotification(`${t('nProjectCreated')} "${d.activeProject || name}"`, 'success');
      } else {
        setCreateError(d.error || t('createProjectFail'));
      }
    } catch {
      setCreateError(t('serverConnFail'));
    }
    setIsCreating(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // 🛠️ السيرفر يرجع الحقل باسم currentUser — قراءة d.username كانت تخزن
        // "undefined" فتكسر رابط المعاينة (مجلد مستخدم خاطئ → 404)
        const uname = d.currentUser || d.username || loginUsername.trim().toLowerCase();
        setToken(d.token); setCurrentUser(uname); setIsAuthenticated(true);
        localStorage.setItem('token', d.token); localStorage.setItem('currentUser', uname);
        localStorage.removeItem('loggedOut');
      } else {
        setAuthError(d.error || (authMode === 'register' ? t('registerFail') : t('loginFail')));
      }
    } catch {
      setAuthError(t('serverConnRetry'));
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    // 🔐 هدم كامل للجلسة — الـ socket مفرد ويبقى موثّقاً بالحساب القديم،
    // وحالة React (شات/مشاريع/ملفات) تعيش لأن المكوّن لا يُفكك. بدون هذا
    // كان الحساب التالي يرى كل بيانات السابق (تسريب حقيقي مُبلغ عنه).
    try { socket.disconnect(); } catch { /* لا يهم */ }
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeProject');
    sessionStorage.removeItem('booted');
    window.location.replace('/'); // تصفير كل حالة الذاكرة — عزل تام بين الحسابات
  };

  const handleBoot = useCallback(() => {
    sessionStorage.setItem('booted', '1');
    setBooted(true);
  }, []);

  const getLogColor = (msg = '') => {
    if (msg.includes('✅') || msg.includes('نجاح')) return '#10b981';
    if (msg.includes('❌') || msg.includes('فشل')) return '#ef4444';
    if (msg.includes('⚠️')) return '#f59e0b';
    if (msg.includes('🎨') || msg.includes('Designer')) return '#a78bfa';
    if (msg.includes('💻') || msg.includes('Coder')) return '#60a5fa';
    if (msg.includes('🔐') || msg.includes('Security')) return '#f97316';
    return '#475569';
  };

  const S = {
    bg: '#030508', bg2: '#070b12', bg3: '#0d1220',
    surface: 'rgba(255,255,255,0.025)', surfaceHi: 'rgba(255,255,255,0.045)',
    border: '#1a2332', border2: '#0f1a2a', borderHi: 'rgba(59,130,246,0.25)',
    text: '#f1f5f9', muted: '#64748b', dim: '#475569',
    blue: '#3b82f6', purple: '#8b5cf6',
    good: '#10b981', warn: '#f59e0b', danger: '#ef4444',
    accent: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    font: 'system-ui,-apple-system,sans-serif',
  };

  // ── LOGIN ────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:S.bg }}>
      <div style={{ width:28, height:28, border:'2px solid #3b82f6', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:S.bg, fontFamily:S.font, padding:16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input{outline:none!important;} input:focus{border-color:#3b82f6!important;}`}</style>
      <div style={{ background:'#0d1117', border:'1px solid #1f2937', borderRadius:16, padding:'40px 28px', width:'min(380px, 100%)', textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:14, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 20px' }}>⚡</div>
        <h2 style={{ color:'#fff', fontSize:20, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>JAOLA OS</h2>
        <p style={{ color:S.muted, fontSize:13, marginBottom:20 }}>Autonomous Software Engineering</p>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}><LanguageSwitcher /></div>

        {/* تبويب دخول / حساب جديد */}
        <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:9, padding:3, marginBottom:18 }}>
          {[['login', t('login')],['register', t('register')]].map(([mode, label]) => (
            <button key={mode} type="button" onClick={() => { setAuthMode(mode); setAuthError(''); }}
              style={{
                flex:1, padding:'8px', borderRadius:7, border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
                background: authMode === mode ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'transparent',
                color: authMode === mode ? '#fff' : '#64748b',
              }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder={t('username')} required dir="ltr"
            style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'12px 14px', color:'#fff', fontSize:16, fontFamily:S.font, transition:'border-color 0.2s', textAlign:'left' }} />
          <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type="password" dir="ltr"
            placeholder={t('password')}
            required={authMode === 'register'} minLength={authMode === 'register' ? 6 : undefined}
            style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'12px 14px', color:'#fff', fontSize:16, fontFamily:S.font, transition:'border-color 0.2s', textAlign:'left' }} />

          {authError && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'9px 12px', color:'#f87171', fontSize:12, textAlign:'center' }}>
              {authError}
            </div>
          )}

          <button type="submit" disabled={isLoggingIn}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:13, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:S.font, opacity: isLoggingIn ? 0.7 : 1 }}>
            {isLoggingIn
              ? (authMode === 'register' ? t('registering') : t('signingIn'))
              : (authMode === 'register' ? `✨ ${t('register')}` : `⚡ ${t('enterMission')}`)}
          </button>
        </form>

        {/* 🔑 الدخول عبر مزوّدي OAuth (يظهر فقط إذا هُيّئ على الخادم) */}
        {oauthProviders.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 14px' }}>
              <div style={{ flex:1, height:1, background:'#1f2937' }} />
              <span style={{ color:S.muted, fontSize:11 }}>{t('orDivider')}</span>
              <div style={{ flex:1, height:1, background:'#1f2937' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {oauthProviders.includes('github') && (
                <a href={`${BACKEND_URL}/api/auth/github`}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#161b22', border:'1px solid #30363d', borderRadius:8, padding:'11px', color:'#fff', fontSize:14, fontWeight:600, textDecoration:'none' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  {t('continueWithGithub')}
                </a>
              )}
              {oauthProviders.includes('google') && (
                <a href={`${BACKEND_URL}/api/auth/google`}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#fff', border:'1px solid #30363d', borderRadius:8, padding:'11px', color:'#1f2937', fontSize:14, fontWeight:600, textDecoration:'none' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 009 18z"/><path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 010-3.44V4.94H.96a9 9 0 000 8.12l3.02-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 00.96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                  {t('continueWithGoogle')}
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (!booted) return <BootScreen onDone={handleBoot} />;

  const globalStyles = `
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes agentPulse{0%,100%{box-shadow:0 0 8px rgba(59,130,246,0.2)}50%{box-shadow:0 0 20px rgba(59,130,246,0.5)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes typing{0%,60%,100%{transform:translateY(0);opacity:0.5}30%{transform:translateY(-4px);opacity:1}}
    *{box-sizing:border-box}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:#334155}

    /* 🖱️ طبقة التفاعل الموحدة — كل زر ورابط في التطبيق يستجيب للمس */
    button{cursor:pointer;transition:all 0.15s ease;font-family:system-ui}
    button:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-1px)}
    button:active:not(:disabled){transform:translateY(0) scale(0.97);filter:brightness(0.95)}
    button:disabled{cursor:not-allowed}
    a{transition:all 0.15s ease}
    a:hover{filter:brightness(1.25)}
    button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid rgba(59,130,246,0.6);outline-offset:2px}
    select{cursor:pointer}
    textarea,input{font-family:system-ui;outline:none;transition:border-color 0.2s}
    textarea:focus,input:focus{border-color:rgba(59,130,246,0.5)!important}

    /* 💬 حيوية الشات (بمستوى كلاود): أدوات الرسالة تظهر عند المرور فقط */
    .feed-msg .msg-tools{opacity:0;transform:translateY(-2px);transition:opacity 0.18s ease,transform 0.18s ease;pointer-events:none}
    .feed-msg:hover .msg-tools{opacity:1;transform:translateY(0);pointer-events:auto}
    @keyframes msgIn{from{opacity:0;transform:translateY(10px) scale(0.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes avatarGlow{0%,100%{box-shadow:0 0 6px rgba(59,130,246,0.3)}50%{box-shadow:0 0 14px rgba(139,92,246,0.6)}}
    /* «يفكّر…» متلألئ كنبض كلاود */
    .thinking-shimmer{background:linear-gradient(90deg,#475569 20%,#c7d2fe 50%,#475569 80%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 1.6s linear infinite}
    @keyframes shimmer{0%{background-position:180% 0}100%{background-position:-20% 0}}
    /* رقائق الاقتراحات: رفعة وإنارة عند المرور */
    .chip-suggest:hover{background:rgba(59,130,246,0.2)!important;border-color:rgba(59,130,246,0.55)!important;box-shadow:0 4px 14px -6px rgba(59,130,246,0.5)}
    /* 🖼️ بطاقات معرض القوالب: رفعة + تقريب المعاينة عند المرور */
    .tpl-card:hover{transform:translateY(-3px);border-color:rgba(139,92,246,0.45)!important}
    .tpl-card:hover .tpl-shot{transform:scale(1.045)}

    /* 🎴 نظام بطاقات موحّد — سطح زجاجي يرتفع قليلاً عند المرور */
    .jaola-card{background:rgba(255,255,255,0.025);border:1px solid #1a2332;border-radius:12px;transition:transform .18s ease,border-color .18s ease,background .18s ease}
    .jaola-card:hover{border-color:rgba(59,130,246,0.28);background:rgba(255,255,255,0.045)}
    .stat-tile{background:rgba(255,255,255,0.025);border:1px solid #1a2332;border-radius:10px;padding:10px 12px;transition:border-color .18s ease,background .18s ease}
    .stat-tile:hover{border-color:rgba(59,130,246,0.28);background:rgba(255,255,255,0.045)}
    /* 📊 مؤشر: أطراف مدوّرة، حركة انسيابية — بديل الشريط المسطّح 2px */
    .meter{height:6px;background:rgba(255,255,255,0.05);border-radius:999px;overflow:hidden}
    .meter>span{display:block;height:100%;border-radius:999px;transition:width .7s cubic-bezier(.4,0,.2,1)}
    .sec-title{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
    /* توهّج خلفي ناعم يعطي عمقاً بلا ضجيج */
    .glow-bg{position:relative}
    .glow-bg::before{content:'';position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 0%,rgba(59,130,246,0.06),transparent 70%);pointer-events:none;z-index:0}
  `;

  // ═══ الأجزاء المشتركة (سطح المكتب + الجوال) ═══════════════════

  // شريط حالة الاتصال — يظهر فقط عند الانقطاع، ويطمئن المستخدم أن الإرجاع تلقائي
  const connectionBanner = !isConnected && (
    <div style={{
      background:'rgba(245,158,11,0.1)', borderBottom:'1px solid rgba(245,158,11,0.3)',
      padding:'6px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0,
    }}>
      <div style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', animation:'pulse 1s infinite', flexShrink:0 }} />
      <span style={{ fontSize:11, color:'#fbbf24', fontWeight:600 }}>
        {connectionError || t('connectionLost')}
      </span>
    </div>
  );

  // بث المهمة داخل الشات: فقاعات بمستوى كلاود — خطوات مطويّة + أدوات hover
  const feedGroups = groupFeed(chatMessages);
  const lastUserText = [...chatMessages].reverse().find(m => m.sender === 'user')?.text || '';
  const lastRealMsgIdx = (() => {
    for (let i = feedGroups.length - 1; i >= 0; i--) {
      if (feedGroups[i].type === 'msg' && feedGroups[i].msg.sender !== 'user') return i;
    }
    return -1;
  })();
  const missionFeed = (
    <div style={{ flex:1, minHeight:0, position:'relative', display:'flex', flexDirection:'column' }}>
      <div ref={feedScrollRef} onScroll={handleFeedScroll}
        style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
        {chatMessages.length === 0 && !isBuilding && (
          <div style={{ textAlign:'center', color:S.muted, fontSize:12, marginTop:40, lineHeight:2 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚡</div>
            {t('feedAsk')}<br/>
            <span style={{ fontSize:11, color:'#334155' }}>{t('feedHint')}</span>
          </div>
        )}
        {feedGroups.map((g, i) => g.type === 'steps'
          ? <StepsGroup key={i} msgs={g.msgs} live={isBuilding && i === feedGroups.length - 1} t={t} />
          : <FeedItem key={i} msg={g.msg} onOption={handleOptionClick} t={t}
              onEdit={(text) => { setPrompt(text); textareaRef.current?.focus(); }}
              canRegenerate={i === lastRealMsgIdx && !isBuilding && !isSending && !!lastUserText}
              onRegenerate={() => handleSend(lastUserText)} />)}
        {isBuilding && buildStartedAt && (
          <MissionProgress agentStates={agentStates} lastLog={lastLogMsg} startedAt={buildStartedAt} phase={missionPhase} />
        )}
        {/* 💬 فقاعة انتظار بمستوى كلاود: أفاتار متوهج + نقاط تكتب — لا سطر باهت */}
        {isSending && !isBuilding && (
          <div style={{ display:'flex', gap:10, alignItems:'flex-start', animation:'msgIn 0.25s ease' }}>
            <div style={{ width:28, height:28, borderRadius:9, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, marginTop:2, animation:'avatarGlow 1.2s infinite' }}>⚡</div>
            <div style={{ background:'rgba(15,23,42,0.65)', border:'1px solid rgba(59,130,246,0.13)', borderRadius:'4px 14px 14px 14px', padding:'12px 16px', display:'inline-flex', alignItems:'center', gap:8 }}>
              <span className="thinking-shimmer" style={{ fontSize:12, fontWeight:600 }}>{t('thinking')}</span>
              <span style={{ display:'inline-flex', gap:3 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite' }} />
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite 0.2s' }} />
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite 0.4s' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>
      {/* ↓ زرّ القفز للأحدث — يظهر فقط حين يصعد المستخدم في السجلّ */}
      {showJumpLatest && (
        <button onClick={() => feedEndRef.current?.scrollIntoView({ behavior:'smooth' })}
          style={{ position:'absolute', bottom:12, insetInlineStart:'50%', transform:'translateX(-50%)', background:'rgba(15,23,42,0.92)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:99, padding:'6px 14px', color:'#93c5fd', fontSize:11, fontWeight:700, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', backdropFilter:'blur(8px)', zIndex:5, animation:'fadeIn 0.2s ease' }}>
          ↓ {t('jumpLatest')}
        </button>
      )}
    </div>
  );

  const quickBuilds = chatMessages.length === 0 && (
    <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
      {/* 🧭 مبدّل المسار — يقود نوعية الأزرار أدناه */}
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        {[['site', '🌍', t('trackSite')], ['system', '🏢', t('trackSystem')]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setBuildTrack(id)} title={t('trackHint')}
            style={{ flex:1, background: buildTrack === id ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.02)', border:`1px solid ${buildTrack === id ? 'rgba(99,102,241,0.5)' : S.border}`, borderRadius:8, padding:'7px 10px', color: buildTrack === id ? '#c7d2fe' : S.muted, fontSize:12, fontWeight:800, cursor:'pointer' }}>
            {icon} {label}
          </button>
        ))}
      </div>
      <div className="sec-title" style={{ color:S.muted, marginBottom:8 }}>
        {buildTrack === 'system' ? t('qlSystem') : t('qlSite')}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, maxHeight:216, overflowY:'auto', paddingInlineEnd:2 }}>
        {QUICK_BUILDS[buildTrack].map((b, i) => (
          <button key={i} onClick={() => { setBuildTrack(buildTrack); setPrompt(t(b.promptKey)); textareaRef.current?.focus(); }}
            className="stat-tile"
            style={{ color:S.muted, fontSize:11, textAlign:'start', display:'flex', alignItems:'center', gap:6, padding:'8px 10px' }}>
            <span style={{ fontSize:14 }}>{b.icon}</span><span>{t(b.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const logsView = (
    <div style={{ height:'100%', overflowY:'auto', padding:'12px 16px', background:'#060a10', fontFamily:'monospace', fontSize:11 }}>
      {logs.length === 0 && <div style={{ color:S.muted, textAlign:'center', marginTop:60, fontSize:13 }}>Awaiting mission orders...</div>}
      {logs.map((log, i) => (
        <div key={i} style={{ display:'flex', gap:12, padding:'3px 0', borderBottom:`1px solid rgba(255,255,255,0.02)`, animation:'fadeIn 0.1s ease' }}>
          <span style={{ color:'#1e2d45', flexShrink:0, fontSize:10, minWidth:60 }}>{new Date().toLocaleTimeString()}</span>
          <span style={{ color: getLogColor(log.message), wordBreak:'break-word' }}>{log.message}</span>
        </div>
      ))}
    </div>
  );

  const previewView = (
    <PreviewPanel
      activeProject={activeProject}
      previewTimestamp={previewTimestamp}
      streamingContent={streamingContent}
      currentUser={currentUser && currentUser !== 'guest_user' ? currentUser : authUser}
      onRefresh={refreshPreview}
      compact={isMobile}
    />
  );

  const notificationsOverlay = (
    <div style={{ position:'fixed', bottom: isMobile ? 76 : 20, left:20, right: isMobile ? 20 : 'auto', display:'flex', flexDirection:'column', gap:8, zIndex:1000 }}>
      {notifications.map(n => (
        <div key={n.id} style={{
          background: n.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
          border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
          borderRadius:10, padding:'10px 16px', fontSize:12, color: n.type === 'success' ? '#10b981' : '#93c5fd',
          backdropFilter:'blur(10px)', animation:'slideIn 0.3s ease', fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.3)'
        }}>
          {n.msg}
        </div>
      ))}
    </div>
  );

  const githubModal = showGithubModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowGithubModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'24px 22px', width:'min(420px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6 }}>🐙 {t('ghIntegration')}</h3>
        <p style={{ color:S.muted, fontSize:12, marginBottom:12 }}>
          {activeProject}
          {ghStatus?.connected && <span style={{ color:'#10b981' }}> {t('ghConnected')}</span>}
        </p>

        <p style={{ color:'#93c5fd', fontSize:11, lineHeight:1.6, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, padding:'8px 10px', marginBottom:16 }}>
          🖥️ {t('ghRenderHint')}
        </p>

        <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>{t('ghRepoUrl')}</label>
        <input value={ghForm.repoUrl} onChange={e => setGhForm(f => ({ ...f, repoUrl: e.target.value }))}
          placeholder="https://github.com/username/repo.git" dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, margin:'6px 0 12px', fontFamily:'monospace' }} />

        <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>
          {t('ghToken')} {ghStatus?.hasToken && <span style={{ color:'#10b981', fontWeight:400 }}>{t('ghTokenSaved')}</span>}
        </label>
        <input value={ghForm.pat} onChange={e => setGhForm(f => ({ ...f, pat: e.target.value }))}
          placeholder="ghp_..." type="password" dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, margin:'6px 0 12px', fontFamily:'monospace' }} />

        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:120 }}>
            <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>{t('ghBranch')}</label>
            <input value={ghForm.branch} onChange={e => setGhForm(f => ({ ...f, branch: e.target.value }))}
              placeholder="main" dir="ltr"
              style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, marginTop:6, fontFamily:'monospace' }} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginTop:18, fontSize:12, color:'#94a3b8' }}>
            <input type="checkbox" checked={ghForm.autoCommit}
              onChange={e => setGhForm(f => ({ ...f, autoCommit: e.target.checked }))}
              style={{ accentColor:'#3b82f6', width:15, height:15 }} />
            {t('ghAutoPush')}
          </label>
        </div>

        {ghStatus?.lastCommit && (
          <p style={{ color:S.muted, fontSize:10, marginBottom:12 }}>{t('ghLastPush')} {new Date(ghStatus.lastCommit).toLocaleString()}</p>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={() => setShowGithubModal(false)}
            style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 16px', color:S.muted, fontSize:13 }}>{t('cancel')}</button>
          {ghStatus?.connected && (
            <button onClick={handleGithubPush}
              style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, padding:'8px 16px', color:'#10b981', fontWeight:700, fontSize:13 }}>
              {t('ghPushNow')}
            </button>
          )}
          <button onClick={handleGithubConnect} disabled={isGhSaving}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 20px', color:'#fff', fontWeight:700, fontSize:13, opacity: isGhSaving ? 0.7 : 1 }}>
            {isGhSaving ? t('ghSaving') : t('ghSaveConnect')}
          </button>
        </div>
      </div>
    </div>
  );

  // 📚 لوحة «معرفة المنصّة» — تجعل الفهم المتراكم مرئياً (المشروع + الفئات + الدروس)
  // 🖼️ معرض القوالب — بطاقات بمعاينات حقيقية، وبيانات وصفية بلغة الواجهة
  const CAT_LABELS = {
    restaurant:{ ar:'مطاعم وتوصيل', en:'Food & Delivery' }, ecommerce:{ ar:'متاجر', en:'Stores' },
    marketplace:{ ar:'أسواق', en:'Marketplaces' }, realestate:{ ar:'عقارات', en:'Real Estate' },
    appointments:{ ar:'حجوزات', en:'Bookings' }, education:{ ar:'تعليم', en:'Education' },
    events:{ ar:'فعاليات وتذاكر', en:'Events & Tickets' }, travel:{ ar:'سفر', en:'Travel' },
    ridehailing:{ ar:'تنقّل', en:'Rides' }, tool:{ ar:'أدوات', en:'Tools' },
    weather:{ ar:'أدوات', en:'Tools' }, crypto:{ ar:'أدوات', en:'Tools' }, finance:{ ar:'مالية', en:'Finance' },
  };
  const isEn = uiLang === 'en';
  const catLabel = (c) => (CAT_LABELS[c.category]?.[isEn ? 'en' : 'ar']) || (isEn ? 'Other' : 'أخرى');
  const tplName = (c) => (isEn ? (c.nameEn || c.name) : c.name);
  const tplDesc = (c) => (isEn ? (c.descriptionEn || c.description) : c.description);
  const galleryCats = galleryTemplates
    ? ['all', ...new Set(galleryTemplates.map(catLabel))]
    : ['all'];
  const galleryList = (galleryTemplates || []).filter(c =>
    galleryFilter === 'all' || catLabel(c) === galleryFilter);
  const galleryModal = showGalleryModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(5px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowGalleryModal(false)}>
      <div style={{ background:'#0b0f17', border:`1px solid ${S.border}`, borderRadius:16, padding:'22px 20px', width:'min(920px, 100%)', maxHeight:'92dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:16, fontWeight:800 }}>🖼️ {t('galleryTitle')}</h3>
          <button onClick={() => setShowGalleryModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11.5, marginBottom:14 }}>{t('gallerySubtitle')}</p>

        {/* فلاتر الفئات */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {galleryCats.map(cat => (
            <button key={cat} onClick={() => setGalleryFilter(cat)}
              style={{ background: galleryFilter === cat ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'rgba(255,255,255,0.04)',
                border:`1px solid ${galleryFilter === cat ? 'transparent' : S.border}`, borderRadius:99, padding:'5px 14px',
                color: galleryFilter === cat ? '#fff' : S.muted, fontSize:11, fontWeight:700 }}>
              {cat === 'all' ? t('galleryAll') : cat}
            </button>
          ))}
        </div>

        {!galleryTemplates && <p style={{ color:S.muted, fontSize:13, textAlign:'center', padding:30 }}>{t('knLoading')}</p>}
        {galleryTemplates && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
            {galleryList.map(c => (
              <div key={c.id} className="tpl-card" style={{ background:'#121826', border:`1px solid ${S.border}`, borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', transition:'transform 0.2s, border-color 0.2s' }}>
                <div style={{ position:'relative', aspectRatio:'11/7', overflow:'hidden', background:'#0a0f1a' }}>
                  <img src={uiLang === 'ar' ? `/templates/${c.id}.jpg` : `/templates/en/${c.id}.jpg`} alt={c.name} loading="lazy"
                    className="tpl-shot" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top', transition:'transform 0.4s' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <span style={{ position:'absolute', top:8, insetInlineStart:8, background:'rgba(6,10,18,0.85)', border:'1px solid rgba(59,130,246,0.3)', color:'#93c5fd', fontSize:9.5, fontWeight:800, padding:'3px 9px', borderRadius:20 }}>
                    {catLabel(c)}
                  </span>
                  {c.externalApi && (
                    <span style={{ position:'absolute', top:8, insetInlineEnd:8, background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.35)', color:'#7dd3fc', fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:20 }}>🌐 API</span>
                  )}
                </div>
                <div style={{ padding:'12px 13px 13px', display:'flex', flexDirection:'column', gap:7, flex:1 }}>
                  <div style={{ color:'#fff', fontSize:13.5, fontWeight:800 }}>{tplName(c)}</div>
                  <div style={{ color:S.muted, fontSize:11, lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{tplDesc(c)}</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {(c.roles || []).map(r => (
                      <span key={r} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#94a3b8', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>{r}</span>
                    ))}
                  </div>
                  <button onClick={() => handleApplyTemplate(c.id)} disabled={!!applyingTemplate}
                    style={{ marginTop:'auto', background: applyingTemplate === c.id ? 'rgba(59,130,246,0.15)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:9, padding:'8px 12px', color:'#fff', fontSize:12, fontWeight:800, opacity: applyingTemplate && applyingTemplate !== c.id ? 0.4 : 1 }}>
                    {applyingTemplate === c.id ? `⏳ ${t('applyingTemplate')}` : `🚀 ${t('useTemplate')}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const healthCheckMeta = { pass: { icon:'✅', color:'#22c55e', bg:'rgba(34,197,94,0.1)', bd:'rgba(34,197,94,0.25)' },
    warn: { icon:'⚠️', color:'#f59e0b', bg:'rgba(245,158,11,0.1)', bd:'rgba(245,158,11,0.25)' },
    fail: { icon:'❌', color:'#ef4444', bg:'rgba(239,68,68,0.1)', bd:'rgba(239,68,68,0.25)' } };
  const healthModal = showHealthModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowHealthModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(520px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>🩺 {t('healthTitle')}</h3>
          <button onClick={() => setShowHealthModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        {healthLoading && <p style={{ color:S.muted, fontSize:13 }}>{t('healthChecking')}</p>}
        {!healthLoading && health?.error && <p style={{ color:S.danger, fontSize:13 }}>{t('serverUnreachable')}</p>}
        {!healthLoading && health && !health.error && (
          <>
            {health.ran === false ? (
              <p style={{ color:S.muted, fontSize:13 }}>{health.summary || t('healthNoProject')}</p>
            ) : (
              <>
                {/* الشريط العام */}
                <div style={{ background: health.ok ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                  border:`1px solid ${health.ok ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  borderRadius:11, padding:'14px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:26 }}>{health.ok ? '✅' : '⚠️'}</span>
                  <div>
                    <div style={{ color:'#fff', fontSize:14, fontWeight:800 }}>
                      {health.ok ? t('healthOk') : t('healthNeedsReview')}
                      {typeof health.score === 'number' && <span style={{ color:S.muted, fontWeight:600, fontSize:12 }}> · {health.score}%</span>}
                    </div>
                    <div style={{ color:S.muted, fontSize:11, marginTop:2 }}>{health.summary}</div>
                  </div>
                </div>
                {/* تفصيل الفحوص */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(health.checks || []).map((c, i) => {
                    const m = healthCheckMeta[c.status] || healthCheckMeta.warn;
                    return (
                      <div key={i} style={{ background:m.bg, border:`1px solid ${m.bd}`, borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ fontSize:14 }}>{m.icon}</span>
                          <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{c.label}</span>
                        </div>
                        {c.detail && <div style={{ color:S.muted, fontSize:11, marginTop:4, paddingInlineStart:21 }}>{c.detail}</div>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={openHealthModal}
                  style={{ marginTop:14, width:'100%', background:'rgba(56,189,248,0.12)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:9, padding:'9px', color:'#7dd3fc', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  🔄 {t('healthRecheck')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  // 📣 المساعد التسويقي — أسبوع منشورات جاهزة للنسخ بصور بهوية العلامة
  const marketingModal = showMarketingModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowMarketingModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(640px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>📣 {t('mkTitle')}</h3>
          <button onClick={() => setShowMarketingModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11, marginBottom:14 }}>{t('mkSub')}</p>

        {mkLoading && <p style={{ color:S.muted, fontSize:13 }}>⏳ {t('mkGenerating')}</p>}
        {!mkLoading && mkPosts?.error && <p style={{ color:S.danger, fontSize:13 }}>{typeof mkPosts.error === 'string' ? mkPosts.error : t('serverUnreachable')}</p>}

        {!mkLoading && mkPosts && !mkPosts.error && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:10, color: mkPosts.ai ? '#a78bfa' : '#38bdf8', fontWeight:800, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:5, padding:'2px 8px' }}>
                {mkPosts.ai ? `✨ ${t('mkAiMade')}` : `⚡ ${t('mkPlanMade')}`}
              </span>
              {[
                { id:'telegram', icon:'✈️', label:'Telegram', on: chStatus?.telegram?.configured, detail: chStatus?.telegram?.chatId },
                { id:'facebook', icon:'📘', label:'Facebook', on: chStatus?.facebook?.configured, detail: chStatus?.facebook?.pageName },
                { id:'x', icon:'𝕏', label:'X', on: chStatus?.x?.configured, detail: '' },
              ].map(ch => ch.on ? (
                <span key={ch.id} style={{ fontSize:10, color:'#38bdf8', fontWeight:700, background:'rgba(56,189,248,0.07)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:5, padding:'2px 8px' }}>
                  {ch.icon} {ch.detail ? <span style={{ direction:'ltr', display:'inline-block' }}>{ch.detail}</span> : ch.label}
                  <button onClick={() => disconnectChannel(ch.id)} title={t('tgDisconnect')}
                    style={{ background:'transparent', border:'none', color:'#64748b', fontSize:10, cursor:'pointer', marginInlineStart:5 }}>✕</button>
                </span>
              ) : (
                <button key={ch.id} onClick={() => setChSetup(v => v === ch.id ? null : ch.id)}
                  style={{ fontSize:10, color:'#7dd3fc', fontWeight:700, background:'rgba(56,189,248,0.07)', border:'1px dashed rgba(56,189,248,0.3)', borderRadius:5, padding:'2px 10px', cursor:'pointer' }}>
                  {ch.icon} {ch.label} +
                </button>
              ))}
              <button onClick={generatePosts}
                style={{ marginInlineStart:'auto', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.25)', borderRadius:7, padding:'4px 12px', color:'#7dd3fc', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                🔄 {t('mkRegenerate')}
              </button>
            </div>

            {/* ⚙️ لوحات ربط القنوات */}
            {chSetup === 'telegram' && (
              <div style={{ background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.18)', borderRadius:10, padding:'12px', marginBottom:12 }}>
                <div style={{ color:S.muted, fontSize:10, marginBottom:8 }}>{t('tgSetupHint')}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <input value={tgForm.botToken} placeholder={t('tgBotToken')} type="password"
                    onChange={e => setTgForm(f => ({ ...f, botToken: e.target.value }))}
                    style={{ flex:2, minWidth:180, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 10px', color:'#e2e8f0', fontSize:11, direction:'ltr' }} />
                  <input value={tgForm.chatId} placeholder="@mychannel"
                    onChange={e => setTgForm(f => ({ ...f, chatId: e.target.value }))}
                    style={{ flex:1, minWidth:120, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 10px', color:'#e2e8f0', fontSize:11, direction:'ltr' }} />
                  <button onClick={() => setupChannel('telegram')} disabled={tgBusy}
                    style={{ background:'rgba(56,189,248,0.12)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, padding:'7px 16px', color:'#7dd3fc', fontSize:11, fontWeight:700, cursor:'pointer', opacity: tgBusy ? 0.6 : 1 }}>
                    {tgBusy ? '⏳' : t('tgSave')}
                  </button>
                </div>
              </div>
            )}
            {chSetup === 'facebook' && (
              <div style={{ background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.18)', borderRadius:10, padding:'12px', marginBottom:12 }}>
                <div style={{ color:S.muted, fontSize:10, marginBottom:8 }}>{t('fbSetupHint')}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <input value={fbForm.pageId} placeholder={t('fbPageId')}
                    onChange={e => setFbForm(f => ({ ...f, pageId: e.target.value }))}
                    style={{ flex:1, minWidth:120, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 10px', color:'#e2e8f0', fontSize:11, direction:'ltr' }} />
                  <input value={fbForm.pageToken} placeholder={t('fbPageToken')} type="password"
                    onChange={e => setFbForm(f => ({ ...f, pageToken: e.target.value }))}
                    style={{ flex:2, minWidth:180, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 10px', color:'#e2e8f0', fontSize:11, direction:'ltr' }} />
                  <button onClick={() => setupChannel('facebook')} disabled={tgBusy}
                    style={{ background:'rgba(56,189,248,0.12)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, padding:'7px 16px', color:'#7dd3fc', fontSize:11, fontWeight:700, cursor:'pointer', opacity: tgBusy ? 0.6 : 1 }}>
                    {tgBusy ? '⏳' : t('tgSave')}
                  </button>
                </div>
              </div>
            )}
            {chSetup === 'x' && (
              <div style={{ background:'rgba(56,189,248,0.04)', border:'1px solid rgba(56,189,248,0.18)', borderRadius:10, padding:'12px', marginBottom:12 }}>
                <div style={{ color:S.muted, fontSize:10, marginBottom:8 }}>{t('xSetupHint')}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {[['apiKey','API Key'],['apiSecret','API Secret'],['accessToken','Access Token'],['accessSecret','Access Secret']].map(([k, ph]) => (
                    <input key={k} value={xForm[k]} placeholder={ph} type="password"
                      onChange={e => setXForm(f => ({ ...f, [k]: e.target.value }))}
                      style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 10px', color:'#e2e8f0', fontSize:11, direction:'ltr' }} />
                  ))}
                </div>
                <button onClick={() => setupChannel('x')} disabled={tgBusy}
                  style={{ marginTop:8, background:'rgba(56,189,248,0.12)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, padding:'7px 16px', color:'#7dd3fc', fontSize:11, fontWeight:700, cursor:'pointer', opacity: tgBusy ? 0.6 : 1 }}>
                  {tgBusy ? '⏳' : t('tgSave')}
                </button>
              </div>
            )}

            {/* 📅 جدولة الأسبوع كاملاً */}
            {anyChannel && (
              <button onClick={scheduleWeek} disabled={schedBusy}
                style={{ width:'100%', marginBottom:12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:9, padding:'8px', color:'#fbbf24', fontSize:12, fontWeight:800, cursor:'pointer', opacity: schedBusy ? 0.6 : 1 }}>
                {schedBusy ? '⏳' : `📅 ${t('schedWeek')}`}
              </button>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(mkPosts.posts || []).map((p, i) => (
                <div key={i} style={{ display:'flex', gap:12, background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:11, padding:'12px' }}>
                  <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(p.svg || '')}`}
                    style={{ width:72, height:72, borderRadius:9, flexShrink:0, objectFit:'cover' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:10, color:'#60a5fa', fontWeight:800 }}>{p.day}</span>
                      <div style={{ marginInlineStart:'auto', display:'flex', gap:5 }}>
                        {anyChannel && (
                          <button onClick={() => publishPost(i, p)} disabled={tgPublishing != null}
                            style={{ background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.25)', borderRadius:6, padding:'2px 10px', color:'#7dd3fc', fontSize:10, fontWeight:700, cursor:'pointer', opacity: tgPublishing != null ? 0.6 : 1 }}>
                            {tgPublishing === i ? `⏳ ${t('tgPublishing')}` : `🚀 ${t('tgPublish')}`}
                          </button>
                        )}
                        <button onClick={() => shareWhatsApp(p)} title="WhatsApp"
                          style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:6, padding:'2px 8px', color:'#4ade80', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                          🟢
                        </button>
                        <button onClick={() => copyPost(i, p)}
                          style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:6, padding:'2px 10px', color:'#34d399', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                          {copiedPost === i ? `✓ ${t('msgCopied')}` : `📋 ${t('msgCopy')}`}
                        </button>
                      </div>
                    </div>
                    <div style={{ color:'#e2e8f0', fontSize:12, marginTop:5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{p.text}</div>
                    <div style={{ color:'#818cf8', fontSize:11, marginTop:4, direction:'ltr', textAlign:'start' }}>{(p.hashtags || []).join(' ')}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 📅 المجدول: المعلّق أولاً ثم آخر المنفّذ */}
            {(schedItems || []).length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>
                  📅 {t('schedTitle')}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[...schedItems].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || a.at - b.at).slice(0, 12).map(it => (
                    <div key={it.id} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:8, padding:'6px 10px', fontSize:11 }}>
                      <span>{it.status === 'pending' ? '⏳' : it.status === 'sent' ? '✅' : '❌'}</span>
                      <span style={{ color:'#334155', fontSize:10, direction:'ltr', flexShrink:0 }}>
                        {new Date(it.at).toLocaleString(uiLang, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </span>
                      <span style={{ flex:1, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.text}</span>
                      {it.error && <span style={{ color:'#f87171', fontSize:9, flexShrink:0 }} title={it.error}>!</span>}
                      {it.status === 'pending' && (
                        <button onClick={() => cancelScheduled(it.id)}
                          style={{ background:'transparent', border:'none', color:'#64748b', fontSize:11, cursor:'pointer', flexShrink:0 }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // 🎨 هوية الموقع: شعار + صور AI
  const brandModal = showBrandModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowBrandModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(460px, 100%)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>🎨 {t('brandTitle')}</h3>
          <button onClick={() => setShowBrandModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11, marginBottom:16 }}>{t('brandSub')}</p>

        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display:'none' }}
          onChange={e => { uploadLogo(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={() => logoInputRef.current?.click()} disabled={!!brandBusy}
          style={{ width:'100%', marginBottom:8, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:10, padding:'12px', color:'#34d399', fontSize:13, fontWeight:800, cursor:'pointer', opacity: brandBusy ? 0.6 : 1 }}>
          {brandBusy === 'logo' ? '⏳' : `🖼️ ${t('brandLogoBtn')}`}
        </button>
        <p style={{ color:'#334155', fontSize:10, marginBottom:16 }}>{t('brandLogoHint')}</p>

        <button onClick={generateAiImages} disabled={!!brandBusy}
          style={{ width:'100%', marginBottom:8, background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.28)', borderRadius:10, padding:'12px', color:'#f9a8d4', fontSize:13, fontWeight:800, cursor:'pointer', opacity: brandBusy ? 0.6 : 1 }}>
          {brandBusy === 'ai' ? `⏳ ${t('brandAiWorking')}` : `🎨 ${t('brandAiBtn')}`}
        </button>
        <p style={{ color:'#334155', fontSize:10 }}>{t('brandAiHint')}</p>
      </div>
    </div>
  );

  // 🌐 نطاقك الخاص: ربط + سجلات DNS + حالة حية
  const DOMAIN_STATUS_UI = {
    'active': { color: '#4ade80', bg: 'rgba(34,197,94,0.1)', label: t('domStatusActive') },
    'awaiting-dns': { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', label: t('domStatusDns') },
    'needs-verification': { color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', label: t('domStatusVerify') },
  };
  const domainModal = showDomainModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowDomainModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(520px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>🌐 {t('domTitle')}</h3>
          <button onClick={() => setShowDomainModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11, marginBottom:16 }}>{t('domSub')}</p>

        {!domainData && <p style={{ color:S.muted, fontSize:13 }}>⏳</p>}
        {domainData?.error && <p style={{ color:S.danger, fontSize:12, marginBottom:10 }}>{domainData.error}</p>}

        {domainData?.none && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input value={domainInput} onChange={e => setDomainInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && attachDomainReq()}
                placeholder={t('domPlaceholder')} dir="ltr"
                style={{ flex:1, background:'#0a0e14', border:`1px solid ${S.border}`, borderRadius:9, padding:'11px 12px', color:'#e2e8f0', fontSize:13, outline:'none' }} />
              <button onClick={attachDomainReq} disabled={domainBusy || !domainInput.trim()}
                style={{ background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:9, padding:'11px 16px', color:'#93c5fd', fontSize:12, fontWeight:800, cursor:'pointer', opacity: domainBusy || !domainInput.trim() ? 0.5 : 1 }}>
                {domainBusy ? '⏳' : t('domAttach')}
              </button>
            </div>
            <p style={{ color:'#334155', fontSize:10 }}>{t('domHint')}</p>
          </>
        )}

        {domainData?.domain && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
              <span dir="ltr" style={{ color:'#e2e8f0', fontSize:14, fontWeight:800 }}>{domainData.domain}</span>
              {(() => { const ui = DOMAIN_STATUS_UI[domainData.status] || { color:S.muted, bg:'rgba(255,255,255,0.05)', label: domainData.status }; return (
                <span style={{ color:ui.color, background:ui.bg, border:`1px solid ${ui.color}33`, borderRadius:7, padding:'3px 10px', fontSize:10, fontWeight:800 }}>{ui.label}</span>
              ); })()}
            </div>

            {domainData.status !== 'active' && (
              <>
                <p style={{ color:S.muted, fontSize:11, marginBottom:8 }}>{t('domDnsHint')}</p>
                <div style={{ border:`1px solid ${S.border}`, borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'70px 1fr 2fr', background:'rgba(255,255,255,0.03)', padding:'7px 10px', color:S.muted, fontSize:10, fontWeight:800 }}>
                    <span>{t('domType')}</span><span>{t('domHost')}</span><span>{t('domValue')}</span>
                  </div>
                  {[...(domainData.dns || []), ...(domainData.verification || []).map(vr => ({ type: vr.type, host: vr.domain, value: vr.value }))].map((rec, i) => (
                    <div key={i} dir="ltr" style={{ display:'grid', gridTemplateColumns:'70px 1fr 2fr', padding:'8px 10px', borderTop:`1px solid ${S.border}`, color:'#e2e8f0', fontSize:11, fontFamily:'monospace', wordBreak:'break-all' }}>
                      <span style={{ color:'#93c5fd', fontWeight:800 }}>{rec.type}</span>
                      <span>{rec.host}</span>
                      <span style={{ cursor:'pointer' }} title="نسخ" onClick={() => navigator.clipboard?.writeText(rec.value)}>{rec.value} 📋</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {domainData.status === 'active' && (
              <p style={{ color:'#4ade80', fontSize:12, marginBottom:14 }}>
                ✅ <a href={`https://${domainData.domain}`} target="_blank" rel="noreferrer" style={{ color:'#4ade80' }}>{domainData.domain}</a> — {t('domActiveMsg')}
              </p>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={fetchDomainStatus} disabled={domainBusy}
                style={{ flex:1, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:9, padding:'10px', color:'#93c5fd', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                🔄 {t('domCheck')}
              </button>
              <button onClick={detachDomainReq} disabled={domainBusy}
                style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:9, padding:'10px 14px', color:'#fca5a5', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                {t('domDetach')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // 🧩 وكلائي: قائمة الوكلاء + نموذج الإنشاء/التحرير
  const agentsModal = showAgentsModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowAgentsModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(600px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>
            🧩 {t('agTitle')}
            {agentsData && !agentsData.error && (
              <span style={{ marginInlineStart:8, fontSize:9, color:'#a5b4fc', fontWeight:800, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:5, padding:'2px 8px' }}>
                {agentsData.used} / {agentsData.max ?? '∞'}
              </span>
            )}
          </h3>
          <button onClick={() => setShowAgentsModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11, marginBottom:14 }}>{t('agSub')}</p>

        {!agentsData && <p style={{ color:S.muted, fontSize:13 }}>⏳</p>}
        {agentsData?.error && <p style={{ color:S.danger, fontSize:13 }}>{t('serverUnreachable')}</p>}

        {agentsData && !agentsData.error && !agentForm && (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
              {agentsData.agents.length === 0 && (
                <div style={{ color:S.muted, fontSize:12, background:'rgba(255,255,255,0.02)', border:`1px dashed ${S.border}`, borderRadius:11, padding:'18px 16px', textAlign:'center' }}>
                  {t('agEmpty')}
                </div>
              )}
              {agentsData.agents.map(a => (
                <div key={a.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:11, padding:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{a.emoji}</span>
                    <span style={{ color:'#fff', fontSize:13, fontWeight:800 }}>{a.name}</span>
                    <div style={{ marginInlineStart:'auto', display:'flex', gap:5 }}>
                      <button onClick={() => setAgentForm({ id: a.id, name: a.name, emoji: a.emoji, welcome: a.welcome || '', instructions: a.instructions, knowledge: a.knowledge || '' })}
                        style={{ background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.25)', borderRadius:6, padding:'2px 10px', color:'#7dd3fc', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                        ✏️ {t('agEdit')}
                      </button>
                      <button onClick={() => removeAgent(a)}
                        style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6, padding:'2px 10px', color:'#f87171', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                  <div style={{ color:'#94a3b8', fontSize:11, marginTop:6, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{a.instructions}</div>
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    <input readOnly value={`<script src="${a.embedUrl}"></script>`} onFocus={e => e.target.select()}
                      style={{ flex:1, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 8px', color:'#64748b', fontSize:9, fontFamily:'monospace', direction:'ltr' }} />
                    <button onClick={() => { navigator.clipboard?.writeText(`<script src="${a.embedUrl}"></script>`).catch(() => {}); addNotification(t('msgCopied'), 'success'); }}
                      style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:7, padding:'0 12px', color:'#a5b4fc', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                      🔗 {t('msgCopy')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {(agentsData.max == null || agentsData.used < agentsData.max) ? (
              <button onClick={() => setAgentForm({ name: '', emoji: '🧩', welcome: '', instructions: '', knowledge: '' })}
                style={{ width:'100%', background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:9, padding:'10px', color:'#a5b4fc', fontSize:13, fontWeight:800, cursor:'pointer' }}>
                ＋ {t('agNew')}
              </button>
            ) : (
              <div style={{ color:'#fbbf24', fontSize:11, textAlign:'center', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:9, padding:'10px' }}>
                💳 {t('agLimit')}
              </div>
            )}
          </>
        )}

        {agentForm && (
          <>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <label style={{ display:'block', fontSize:10, color:S.muted, fontWeight:700, marginBottom:4 }}>{t('agName')}</label>
                <input value={agentForm.name} maxLength={40}
                  onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:12 }} />
              </div>
              <div style={{ width:70 }}>
                <label style={{ display:'block', fontSize:10, color:S.muted, fontWeight:700, marginBottom:4 }}>{t('botEmojiL')}</label>
                <input value={agentForm.emoji} maxLength={4}
                  onChange={e => setAgentForm(f => ({ ...f, emoji: e.target.value }))}
                  style={{ width:'100%', textAlign:'center', background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:12 }} />
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, color:S.muted, fontWeight:700, marginBottom:4 }}>{t('botWelcomeL')}</label>
              <input value={agentForm.welcome} maxLength={200}
                onChange={e => setAgentForm(f => ({ ...f, welcome: e.target.value }))}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:12 }} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:10, color:S.muted, fontWeight:700, marginBottom:4 }}>{t('agInstructions')}</label>
              <textarea value={agentForm.instructions} maxLength={2000} rows={4} placeholder={t('agInstructionsPh')}
                onChange={e => setAgentForm(f => ({ ...f, instructions: e.target.value }))}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:12, resize:'vertical' }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, color:S.muted, fontWeight:700, marginBottom:4 }}>{t('agKnowledge')}</label>
              <textarea value={agentForm.knowledge} maxLength={4000} rows={5} placeholder={t('agKnowledgePh')}
                onChange={e => setAgentForm(f => ({ ...f, knowledge: e.target.value }))}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:12, resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={saveAgent} disabled={agentSaving}
                style={{ flex:1, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:9, padding:'10px', color:'#a5b4fc', fontSize:13, fontWeight:800, cursor:'pointer', opacity: agentSaving ? 0.6 : 1 }}>
                {agentSaving ? '⏳' : `💾 ${t('agSave')}`}
              </button>
              <button onClick={() => setAgentForm(null)}
                style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:9, padding:'10px 18px', color:S.muted, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {t('agBack')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // 🤖 استوديو مساعد الموقع — نموذج التخصيص الكامل
  const botInput = { width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontSize:12, outline:'none' };
  const botLabel = { display:'block', fontSize:10, color:S.muted, fontWeight:700, marginBottom:4, letterSpacing:'0.5px' };
  const botModal = showBotModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowBotModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(560px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>
            🤖 {t('botStudioTitle')}
            {botInstalled && <span style={{ marginInlineStart:8, fontSize:9, color:'#34d399', fontWeight:800, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:5, padding:'2px 8px' }}>{t('botInstalledBadge')}</span>}
          </h3>
          <button onClick={() => setShowBotModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11, marginBottom:14 }}>{t('botStudioSub')}</p>

        {botLoading ? <p style={{ color:S.muted, fontSize:13 }}>{t('botLoadingS')}</p> : (
          <>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <label style={botLabel}>{t('botNameL')}</label>
                <input style={botInput} value={botForm.brandName} maxLength={40}
                  onChange={e => setBotForm(f => ({ ...f, brandName: e.target.value }))} />
              </div>
              <div style={{ width:70 }}>
                <label style={botLabel}>{t('botEmojiL')}</label>
                <input style={{ ...botInput, textAlign:'center' }} value={botForm.emoji} maxLength={4}
                  onChange={e => setBotForm(f => ({ ...f, emoji: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={botLabel}>{t('botWelcomeL')}</label>
              <input style={botInput} value={botForm.welcome} maxLength={200} placeholder={t('botWelcomePh')}
                onChange={e => setBotForm(f => ({ ...f, welcome: e.target.value }))} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={botLabel}>{t('botQuickL')}</label>
              <input style={botInput} value={botForm.quick} maxLength={200} placeholder={t('botQuickPh')}
                onChange={e => setBotForm(f => ({ ...f, quick: e.target.value }))} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={botLabel}>{t('botFaqL')}</label>
              {botForm.faq.map((row, i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
                  <input style={{ ...botInput, flex:1 }} value={row.q} maxLength={200} placeholder={t('botFaqQ')}
                    onChange={e => setBotForm(f => ({ ...f, faq: f.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x) }))} />
                  <input style={{ ...botInput, flex:1.4 }} value={row.a} maxLength={600} placeholder={t('botFaqA')}
                    onChange={e => setBotForm(f => ({ ...f, faq: f.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x) }))} />
                  <button onClick={() => setBotForm(f => ({ ...f, faq: f.faq.filter((_, j) => j !== i) }))}
                    style={{ background:'transparent', border:'none', color:'#64748b', fontSize:14, cursor:'pointer' }}>✕</button>
                </div>
              ))}
              {botForm.faq.length < 20 && (
                <button onClick={() => setBotForm(f => ({ ...f, faq: [...f.faq, { q: '', a: '' }] }))}
                  style={{ background:'rgba(255,255,255,0.03)', border:`1px dashed ${S.border}`, borderRadius:8, padding:'6px 12px', color:S.muted, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  ＋ {t('botFaqAdd')}
                </button>
              )}
            </div>

            <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, cursor:'pointer' }}>
              <input type="checkbox" checked={botForm.ai}
                onChange={e => setBotForm(f => ({ ...f, ai: e.target.checked }))} />
              <span style={{ color:'#e2e8f0', fontSize:12, fontWeight:700 }}>✨ {t('botAiL')}</span>
              <span style={{ color:S.muted, fontSize:10 }}>{t('botAiHint')}</span>
            </label>

            <button onClick={handleSaveBot} disabled={isAddingBot}
              style={{ width:'100%', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:9, padding:'10px', color:'#c4b5fd', fontSize:13, fontWeight:800, cursor:'pointer', opacity: isAddingBot ? 0.6 : 1 }}>
              {isAddingBot ? `⏳ ${t('addingBot')}` : (botInstalled ? `💾 ${t('botUpdate')}` : `➕ ${t('botInstall')}`)}
            </button>

            {/* 🔗 كود التضمين — يعمل في أي موقع خارج JAOLA أيضاً */}
            {botInstalled && botEmbedUrl && (
              <div style={{ marginTop:14, background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.2)', borderRadius:10, padding:'12px' }}>
                <div style={{ ...botLabel, color:'#7dd3fc' }}>🔗 {t('botEmbedL')}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <input readOnly value={`<script src="${botEmbedUrl}"></script>`} onFocus={e => e.target.select()}
                    style={{ ...botInput, direction:'ltr', fontSize:10, fontFamily:'monospace', color:'#94a3b8' }} />
                  <button onClick={() => { navigator.clipboard?.writeText(`<script src="${botEmbedUrl}"></script>`).catch(() => {}); addNotification(t('msgCopied'), 'success'); }}
                    style={{ background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, padding:'0 14px', color:'#7dd3fc', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                    📋
                  </button>
                </div>
                <div style={{ color:S.muted, fontSize:10, marginTop:6 }}>{t('botEmbedHint')}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // 📬 بريد الموقع: رسائل نماذج التواصل + ملخّص الزيارات
  const inboxModal = showInboxModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowInboxModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(560px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>📬 {t('inboxTitle')}</h3>
          <button onClick={() => setShowInboxModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <p style={{ color:S.muted, fontSize:11, marginBottom:14 }}>{t('inboxSubtitle')}</p>

        {inboxLoading && <p style={{ color:S.muted, fontSize:13 }}>{t('inboxLoading')}</p>}
        {!inboxLoading && inbox?.error && <p style={{ color:S.danger, fontSize:13 }}>{t('serverUnreachable')}</p>}

        {!inboxLoading && inbox && !inbox.error && (
          <>
            {/* الزيارات: إجمالي + اليوم + أعمدة آخر ٧ أيام */}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <div style={{ flex:1, background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:11, padding:'12px 14px' }}>
                <div style={{ color:'#60a5fa', fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{inbox.visits?.total ?? 0}</div>
                <div style={{ color:S.muted, fontSize:10, fontWeight:700 }}>{t('inboxVisitsTotal')}</div>
              </div>
              <div style={{ flex:1, background:'rgba(16,185,129,0.07)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:11, padding:'12px 14px' }}>
                <div style={{ color:'#34d399', fontSize:20, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>{inbox.visits?.today ?? 0}</div>
                <div style={{ color:S.muted, fontSize:10, fontWeight:700 }}>{t('inboxVisitsToday')}</div>
              </div>
              <div style={{ flex:1.4, background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:11, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:24 }}>
                  {(inbox.visits?.last7 || []).map((d, i) => {
                    const max = Math.max(1, ...(inbox.visits?.last7 || []).map(x => x.count));
                    return <div key={i} title={`${d.day}: ${d.count}`}
                      style={{ flex:1, borderRadius:2, background: d.count ? '#3b82f6' : '#1e293b', height: `${Math.max(12, (d.count / max) * 100)}%` }} />;
                  })}
                </div>
                <div style={{ color:S.muted, fontSize:10, fontWeight:700, marginTop:5 }}>{t('inboxVisits7d')}</div>
              </div>
            </div>

            {/* الرسائل */}
            {(inbox.messages || []).length === 0 && (
              <div style={{ color:S.muted, fontSize:12, background:'rgba(255,255,255,0.02)', border:`1px dashed ${S.border}`, borderRadius:11, padding:'18px 16px', textAlign:'center' }}>
                {t('inboxEmpty')}
                <div style={{ marginTop:6, fontSize:10, color:'#334155' }}>{t('inboxHint')}</div>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(inbox.messages || []).map((m, i) => (
                <div key={m.id || i} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${i < (inbox.unread || 0) ? 'rgba(59,130,246,0.35)' : S.border}`, borderRadius:10, padding:'10px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{m.name || t('inboxAnon')}</span>
                    {m.contact && <span style={{ color:'#60a5fa', fontSize:11, direction:'ltr' }}>{m.contact}</span>}
                    {i < (inbox.unread || 0) && <span style={{ fontSize:9, color:'#60a5fa', fontWeight:800, background:'rgba(59,130,246,0.12)', borderRadius:5, padding:'1px 7px' }}>{t('inboxNew')}</span>}
                    <span style={{ marginInlineStart:'auto', color:'#334155', fontSize:10, direction:'ltr' }}>
                      {new Date(m.at).toLocaleString(uiLang, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                  <div style={{ color:'#94a3b8', fontSize:12, marginTop:5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{m.message}</div>
                  {m.page && <div style={{ color:'#334155', fontSize:10, marginTop:4, direction:'ltr' }}>{m.page}</div>}
                  {(() => {
                    const dr = inboxDrafts[m.id || m.at];
                    if (!dr) return (
                      <button onClick={() => draftReply(m)}
                        style={{ marginTop:8, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:7, padding:'4px 12px', color:'#c4b5fd', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                        ✍️ {t('inboxDraftReply')}
                      </button>
                    );
                    if (dr.loading) return <div style={{ marginTop:8, color:S.muted, fontSize:11 }}>⏳ {t('inboxDrafting')}</div>;
                    if (!dr.text) return <div style={{ marginTop:8, color:'#f87171', fontSize:11 }}>{t('serverUnreachable')}</div>;
                    return (
                      <div style={{ marginTop:8, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:9, padding:'10px' }}>
                        <div style={{ color:'#c4b5fd', fontSize:11, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{dr.text}</div>
                        <div style={{ display:'flex', gap:6, marginTop:8 }}>
                          <button onClick={() => { navigator.clipboard?.writeText(dr.text).catch(() => {}); addNotification(t('msgCopied'), 'success'); }}
                            style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:6, padding:'3px 12px', color:'#34d399', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                            📋 {t('msgCopy')}
                          </button>
                          {/\S+@\S+\.\S+/.test(m.contact || '') && (
                            <button onClick={() => sendReplyMail(m, dr.text)} disabled={!!sendingReply}
                              style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:6, padding:'3px 12px', color:'#93c5fd', fontSize:10, fontWeight:700, cursor:'pointer', opacity: sendingReply ? 0.6 : 1 }}>
                              {sendingReply === (m.id || m.at) ? `⏳ ${t('replySending')}` : `📧 ${t('replySend')}`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const knowledgeModal = showKnowledgeModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowKnowledgeModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(560px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>📚 {t('knTitle')}</h3>
          <button onClick={() => setShowKnowledgeModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {knowledgeLoading && <p style={{ color:S.muted, fontSize:13 }}>{t('knLoading')}</p>}
        {!knowledgeLoading && knowledge?.error && <p style={{ color:S.danger, fontSize:13 }}>{t('serverUnreachable')}</p>}

        {!knowledgeLoading && knowledge && !knowledge.error && (
          <>
            {/* فهم المشروع الحالي */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knProject')} — {activeProject}</p>
              {knowledge.projectModel ? (
                <div style={{ background:'#161b22', border:`1px solid ${S.border}`, borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ color:S.accent, fontSize:12, marginBottom:10 }}>{knowledge.projectSummary}</p>
                  {['entities','roles','flows'].map(kind => (knowledge.projectModel[kind]?.length > 0) && (
                    <div key={kind} style={{ marginBottom:8 }}>
                      <span style={{ fontSize:10, color:S.muted, fontWeight:700 }}>{t('kn_'+kind)}: </span>
                      <span style={{ fontSize:12, color:'#cbd5e1' }}>
                        {knowledge.projectModel[kind].map(x => x.name).join('، ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knNoModel')}</p>
              )}
            </div>

            {/* قوالب التطبيقات العاملة (كلون + بصمة) */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:2 }}>{t('knClones')}</p>
              <p style={{ fontSize:10, color:S.muted, marginBottom:8 }}>{t('galleryHint')}</p>
              {knowledge.clones?.length ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {knowledge.clones.map(c => (
                    <div key={c.id} style={{ background:'#161b22', border:'1px solid rgba(255,107,53,0.25)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ color:'#fff', fontSize:13, fontWeight:800 }}>🧩 {c.name}</span>
                        <span style={{ color:'#64748b', fontSize:9, fontFamily:'monospace' }}>{c.id}</span>
                        {c.externalApi && <span style={{ background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', color:'#7dd3fc', fontSize:9, padding:'1px 6px', borderRadius:8 }}>🌐 API: {c.externalApi}</span>}
                      </div>
                      <div style={{ color:S.muted, fontSize:11, marginTop:3 }}>{c.description}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:6, flexWrap:'wrap' }}>
                        <span style={{ color:'#ff9d6b', fontSize:10 }}>{(c.roles||[]).join(' · ')}</span>
                        <button onClick={() => handleApplyTemplate(c.id)} disabled={!!applyingTemplate}
                          style={{ background:'linear-gradient(135deg,#ff6b35,#f7931e)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', fontSize:11, fontWeight:800, cursor: applyingTemplate ? 'default' : 'pointer', opacity: applyingTemplate && applyingTemplate !== c.id ? 0.4 : 1, whiteSpace:'nowrap' }}>
                          {applyingTemplate === c.id ? `⏳ ${t('applyingTemplate')}` : `🚀 ${t('useTemplate')}`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knClonesEmpty')}</p>
              )}
            </div>

            {/* المكتبات الجاهزة (CDN) — تُحقن عند الطلب */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:2 }}>{t('knLibraries')}</p>
              <p style={{ fontSize:10, color:S.muted, marginBottom:8 }}>{t('librariesHint')}</p>
              {knowledge.libraries?.length ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {knowledge.libraries.map(l => (
                    <div key={l.id} style={{ background:'#161b22', border:'1px solid rgba(56,189,248,0.2)', borderRadius:10, padding:'9px 11px', display:'flex', flexDirection:'column', gap:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                        <span style={{ color:'#fff', fontSize:12, fontWeight:800 }}>🔗 {l.name}</span>
                        <span style={{ background:'rgba(56,189,248,0.12)', color:'#7dd3fc', fontSize:9, padding:'1px 6px', borderRadius:8 }}>{l.category}</span>
                      </div>
                      <div style={{ color:S.muted, fontSize:10, lineHeight:1.5, flex:1 }}>{l.description}</div>
                      <button onClick={() => handleAddLibrary(l.id)} disabled={!!addingLibrary}
                        style={{ background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.35)', borderRadius:7, padding:'5px 10px', color:'#7dd3fc', fontSize:10, fontWeight:800, cursor: addingLibrary ? 'default' : 'pointer', opacity: addingLibrary && addingLibrary !== l.id ? 0.4 : 1, alignSelf:'flex-start' }}>
                        {addingLibrary === l.id ? `⏳ ${t('addingLibrary')}` : `➕ ${t('addLibrary')}`}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>—</p>
              )}
            </div>

            {/* مكتبة نماذج الفئات المتراكمة */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knLibrary')}</p>
              {knowledge.library?.length ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {knowledge.library.map(c => (
                    <div key={c.category} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 12px' }}>
                      <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{c.category}</span>
                      <span style={{ color:S.muted, fontSize:11 }}>
                        {c.entities}🧩 · {c.roles}👤 · {c.flows}🔀 · <span style={{ color:S.good }}>{c.verified}✓</span>/{c.contributions}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knLibraryEmpty')}</p>
              )}
            </div>

            {/* الدروس المتراكمة */}
            <div>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knLessons')}</p>
              {knowledge.lessons?.length ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {knowledge.lessons.map((l, i) => (
                    <span key={i} style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:14, padding:'4px 10px', fontSize:11, color:'#c4b5fd' }}>
                      {l.key} <span style={{ opacity:0.7 }}>×{l.count}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knLessonsEmpty')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const projectModal = showProjectModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowProjectModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:28, width:'min(360px, 100%)' }}>
        <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6 }}>{t('newProjectTitle')}</h3>
        <p style={{ color:S.muted, fontSize:12, marginBottom:16 }}>{t('projectNameHint')}</p>
        <input value={newProjectName} onChange={e => { setNewProjectName(e.target.value); setCreateError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
          placeholder="my-awesome-project" autoFocus dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${createError ? 'rgba(239,68,68,0.5)' : S.border}`, borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14, marginBottom: createError ? 8 : 14, fontFamily:'monospace', textAlign:'left' }} />
        {createError && (
          <div style={{ color:'#f87171', fontSize:12, marginBottom:14 }}>{createError}</div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={() => { setShowProjectModal(false); setCreateError(''); }}
            style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 16px', color:S.muted, fontSize:13 }}>{t('cancel')}</button>
          <button onClick={handleCreateProject} disabled={isCreating}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 20px', color:'#fff', fontWeight:700, fontSize:13, opacity: isCreating ? 0.6 : 1 }}>
            {isCreating ? t('creating') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );

  // 🔑 نافذة أسرار المشروع (متغيّرات البيئة) — MONGODB_URI وغيرها
  const secretsModal = showSecretsModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowSecretsModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:24, width:'min(440px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontSize:18 }}>🔑</span>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, flex:1 }}>{t('secretsTitle')}</h3>
          <button onClick={() => setShowSecretsModal(false)} style={{ width:30, height:30, borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, color:S.muted, fontSize:14 }}>✕</button>
        </div>
        <p style={{ color:S.muted, fontSize:12, lineHeight:1.7, marginBottom:14 }}>{t('secretsHint')}</p>

        {/* تلميح MONGODB_URI للمشاريع full-stack */}
        <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:10, padding:'10px 12px', marginBottom:16, fontSize:11.5, color:'#6ee7b7', lineHeight:1.7 }}>
          🗄️ {t('secretsMongoHint')}
        </div>

        {/* المفاتيح الحالية */}
        {secretKeys.length > 0 && (
          <div style={{ marginBottom:16 }}>
            {secretKeys.map(k => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 12px', marginBottom:6 }}>
                <span style={{ fontSize:13 }}>🔒</span>
                <span style={{ flex:1, fontSize:12.5, color:S.text, fontFamily:'monospace' }}>{k}</span>
                <span style={{ fontSize:10, color:S.dim }}>••••••••</span>
                <button onClick={() => handleDeleteSecret(k)} title={t('delete')} style={{ background:'transparent', border:'none', color:'#f87171', fontSize:13, padding:'2px 6px' }}>🗑️</button>
              </div>
            ))}
          </div>
        )}

        {/* إضافة سرّ */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input value={newSecretKey} onChange={e => { setNewSecretKey(e.target.value.toUpperCase()); setSecretError(''); }}
            placeholder="MONGODB_URI" dir="ltr"
            style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:'monospace', textAlign:'left' }} />
          <input value={newSecretVal} onChange={e => { setNewSecretVal(e.target.value); setSecretError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAddSecret()}
            placeholder={t('secretValuePlaceholder')} dir="ltr" type="password"
            style={{ width:'100%', background:'#161b22', border:`1px solid ${secretError ? 'rgba(239,68,68,0.5)' : S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:'monospace', textAlign:'left' }} />
          {secretError && <div style={{ color:'#f87171', fontSize:12 }}>{secretError}</div>}
          <button onClick={handleAddSecret} disabled={secretBusy || !newSecretKey.trim() || !newSecretVal.trim()}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'10px', color:'#fff', fontWeight:700, fontSize:13, opacity: (secretBusy || !newSecretKey.trim() || !newSecretVal.trim()) ? 0.5 : 1 }}>
            {secretBusy ? '…' : `➕ ${t('secretAdd')}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // 📱 تخطيط الجوال — شاشة واحدة + تنقل سفلي
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ height:'100dvh', background:S.bg, color:S.text, display:'flex', flexDirection:'column', fontFamily:S.font, overflow:'hidden' }}>
        <style>{globalStyles}</style>

        {/* رأس مضغوط — الأساسي ظاهر، الثانوي في قائمة ⋯ (تفريغ الازدحام) */}
        <nav style={{ height:56, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0, position:'relative', zIndex:60 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>⚡</div>

          {/* منتقي المشروع — يأخذ المساحة المرنة ولا يطفح */}
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:10, paddingInlineStart:10, minWidth:0, height:40 }}>
            <select value={activeProject} onChange={e => handleSwitchProject(e.target.value)}
              style={{ flex:1, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:700, outline:'none', minWidth:0, textOverflow:'ellipsis' }}>
              {projects.map(p => <option key={p} value={p} style={{ background:'#161b22' }}>{p}</option>)}
            </select>
            <button onClick={() => setShowProjectModal(true)} title={t('newProject')}
              style={{ width:32, height:32, borderRadius:8, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', color:S.blue, fontSize:17, fontWeight:700, flexShrink:0, marginInlineEnd:3 }}>+</button>
          </div>

          {isBuilding && (
            <span style={{ display:'flex', alignItems:'center', flexShrink:0 }} title={t('building')}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#3b82f6', boxShadow:'0 0 8px #3b82f6', animation:'pulse 1s infinite' }} />
            </span>
          )}

          {/* رابط الموقع (إن وُجد) + زر النشر/إعادة النشر — الأخير يبقى دائماً */}
          {vercelUrl && (
            <a href={vercelUrl} target="_blank" rel="noreferrer" title={t('liveSite')} style={{ width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, textDecoration:'none', border:'1px solid rgba(16,185,129,0.35)', borderRadius:10, flexShrink:0 }}>🌍</a>
          )}
          <button onClick={handleDeploy} disabled={isDeploying} title={vercelUrl ? t('redeploy') : t('deploy')} style={{ width:40, height:40, background: vercelUrl ? 'rgba(59,130,246,0.14)' : 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: vercelUrl ? '1px solid rgba(59,130,246,0.3)' : 'none', borderRadius:10, color:'#fff', fontSize:16, opacity:isDeploying?0.6:1, flexShrink:0 }}>{isDeploying ? '⏳' : (vercelUrl ? '🔄' : '🚀')}</button>

          {/* قائمة الإجراءات الثانوية */}
          <button onClick={() => setShowMobileMenu(v => !v)} title="•••"
            style={{ width:40, height:40, borderRadius:10, background: showMobileMenu ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)', border:`1px solid ${showMobileMenu ? 'rgba(59,130,246,0.3)' : S.border}`, color:S.text, fontSize:20, lineHeight:1, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>⋯</button>

          {showMobileMenu && (
            <>
              <div onClick={() => setShowMobileMenu(false)} style={{ position:'fixed', inset:0, zIndex:59 }} />
              <div style={{ position:'absolute', top:'calc(100% + 6px)', insetInlineEnd:12, background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:8, minWidth:210, zIndex:61, boxShadow:'0 14px 44px rgba(0,0,0,0.55)', display:'flex', flexDirection:'column', gap:2, animation:'fadeIn 0.15s ease' }}>
                <div style={{ padding:'8px 10px 10px', display:'flex', alignItems:'center', gap:9, borderBottom:`1px solid ${S.border}`, marginBottom:5 }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff', flexShrink:0 }}>{(authUser || 'U')[0].toUpperCase()}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{authUser || 'guest'}</div>
                    <div style={{ fontSize:10, color: isConnected ? S.good : S.warn, fontWeight:600 }}>{isConnected ? '● ONLINE' : '● OFFLINE'}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize:13, color:S.text }}>🌐 {t('language') || 'Language'}</span>
                  <LanguageSwitcher compact />
                </div>
                <button onClick={() => { setShowMobileMenu(false); setShowSiteHealth(true); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>📊</span> {t('siteHealth')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openGithubModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🐙</span> GitHub
                </button>
                <button onClick={() => { setShowMobileMenu(false); openKnowledgeModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>📚</span> {t('knTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openHealthModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🩺</span> {t('healthTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openInboxModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>📬</span> {t('inboxTitle')}
                  {inboxUnread > 0 && (
                    <span style={{ background:'#3b82f6', color:'#fff', fontSize:10, fontWeight:800, borderRadius:9, minWidth:17, height:17, display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>
                      {inboxUnread > 99 ? '99+' : inboxUnread}
                    </span>
                  )}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openMarketingModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>📣</span> {t('mkTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openDomainModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', borderRadius:8, padding:'11px 10px', color:'#e2e8f0', fontSize:13, fontWeight:600, textAlign:'start' }}>
                  🌐 {t('domTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); setShowBrandModal(true); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🎨</span> {t('brandTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openAgentsModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🧩</span> {t('agTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openBotModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🤖</span> {t('botStudioTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openGalleryModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🖼️</span> {t('galleryTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openSecretsModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🔑</span> {t('secretsTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); handleVercelCheck(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🩺</span> {t('vercelCheck') || 'فحص النشر (Vercel)'}
                </button>
                <button onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:13, fontWeight:700, textAlign:'start', marginTop:3 }}>
                  <span style={{ fontSize:16 }}>🚪</span> {t('exit') || 'Exit'}
                </button>
              </div>
            </>
          )}
        </nav>

        {connectionBanner}

        {/* المحتوى النشط */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
          {mobileView === 'mission' && (
            <>
              {missionFeed}
              {quickBuilds}
              {/* إدخال المهمة — أسلوب تطبيقات المحادثة */}
              <div style={{ padding:'10px 12px', borderTop:`1px solid ${S.border}`, flexShrink:0, display:'flex', gap:8, alignItems:'flex-end', background:S.bg2 }}>
                <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={t('mobilePrompt')}
                  rows={2}
                  style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:12, padding:'10px 12px', color:S.text, fontSize:16, resize:'none', lineHeight:1.5 }} />
                {(isBuilding || isSending) && (
                  <button onClick={handleAbort} title={t('stopTitle')}
                    style={{ width:44, height:44, borderRadius:12, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)', color:'#f87171', fontSize:16, flexShrink:0 }}>⏹</button>
                )}
                <button onClick={handleSend} disabled={isSending || !prompt.trim()}
                  style={{ width:44, height:44, borderRadius:12, background: prompt.trim() ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'rgba(255,255,255,0.05)', border:'none', color:'#fff', fontSize:17, flexShrink:0, opacity: isSending ? 0.6 : 1 }}>
                  {isSending ? '…' : '⚡'}
                </button>
              </div>
            </>
          )}

          {mobileView === 'preview' && previewView}

          {mobileView === 'editor' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
              {/* قائمة ملفات أفقية سريعة */}
              {files.length > 0 && (
                <div style={{ display:'flex', gap:6, padding:'8px 12px', overflowX:'auto', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
                  {files.map(f => (
                    <button key={f} onClick={() => openJaolaFile(f)}
                      style={{ background: activeFile === f ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)', border:`1px solid ${activeFile === f ? 'rgba(59,130,246,0.3)' : S.border}`, borderRadius:7, padding:'4px 10px', color: activeFile === f ? '#93c5fd' : S.muted, fontSize:11, whiteSpace:'nowrap', flexShrink:0 }}>
                      {f}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ flex:1, minHeight:0 }}><MonacoWorkspace /></div>
            </div>
          )}

          {mobileView === 'logs' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
              {/* تبديل: السجل الحي / الخط الزمني */}
              <div style={{ display:'flex', gap:4, padding:'8px 12px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
                {[['logs',t('liveLog')],['timeline',t('timelineTab')]].map(([mode, label]) => (
                  <button key={mode} onClick={() => setMobileLogsMode(mode)}
                    style={{
                      flex:1, padding:'6px', borderRadius:7, fontSize:11, fontWeight:700,
                      background: mobileLogsMode === mode ? 'rgba(59,130,246,0.12)' : 'transparent',
                      border:`1px solid ${mobileLogsMode === mode ? 'rgba(59,130,246,0.3)' : S.border}`,
                      color: mobileLogsMode === mode ? '#93c5fd' : S.muted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ flex:1, minHeight:0, overflow:'hidden' }}>
                {mobileLogsMode === 'logs' ? logsView : (
                  <TimelinePanel activeProject={activeProject} token={token}
                    onRestored={(h) => { addNotification(`${t('nRestored')} (${h})`, 'success'); refreshPreview(); }} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* التنقل السفلي */}
        <nav style={{
          height:'calc(58px + env(safe-area-inset-bottom))', paddingBottom:'env(safe-area-inset-bottom)',
          background:S.bg2, borderTop:`1px solid ${S.border}`, display:'flex', flexShrink:0,
        }}>
          {MOBILE_TABS.map(tab => {
            const isActive = mobileView === tab.id;
            const showBadge = tab.id === 'logs' && logs.length > 0;
            return (
              <button key={tab.id} onClick={() => setMobileView(tab.id)}
                style={{
                  flex:1, background:'transparent', border:'none', display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:3, position:'relative',
                  color: isActive ? '#60a5fa' : '#475569',
                }}>
                <span style={{ fontSize:18, filter: isActive ? 'none' : 'grayscale(0.6)' }}>{tab.icon}</span>
                <span style={{ fontSize:9, fontWeight:700 }}>{t(tab.key)}</span>
                {isActive && <span style={{ position:'absolute', top:0, left:'25%', right:'25%', height:2, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2 }} />}
                {showBadge && !isActive && <span style={{ position:'absolute', top:8, left:'calc(50% - 16px)', width:6, height:6, borderRadius:'50%', background: isBuilding ? '#3b82f6' : '#1f2937' }} />}
              </button>
            );
          })}
        </nav>

        {notificationsOverlay}
        {githubModal}
        {knowledgeModal}
        {healthModal}
        {inboxModal}
        {brandModal}
      {domainModal}
        {agentsModal}
        {botModal}
        {marketingModal}
        {galleryModal}
        {projectModal}
        {secretsModal}

        {/* 📊 بطاقة حالة الموقع — مؤشرات الجودة على الجوال (بديل الشريط الجانبي) */}
        {showSiteHealth && (
          <div onClick={() => setShowSiteHealth(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'flex-end', backdropFilter:'blur(3px)' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:'100%', background:'#0d1117', borderTop:`1px solid ${S.border}`, borderRadius:'18px 18px 0 0', padding:'16px 16px calc(20px + env(safe-area-inset-bottom))', animation:'fadeIn 0.2s ease' }}>
              <div style={{ width:38, height:4, borderRadius:2, background:S.border, margin:'0 auto 14px' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <span style={{ fontSize:17 }}>📊</span>
                <span style={{ fontSize:15, fontWeight:800, color:S.text, flex:1 }}>{t('siteHealth')}</span>
                <button onClick={() => setShowSiteHealth(false)} style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, color:S.muted, fontSize:15 }}>✕</button>
              </div>
              {metrics && (metrics.seo || metrics.security || metrics.quality || metrics.totalBuilds) ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'SEO', value: fmtScore(metrics?.seo), color: gradeColor(metrics?.seo?.grade) },
                    { label:'Security', value: fmtScore(metrics?.security), color: gradeColor(metrics?.security?.grade) },
                    { label:'Quality', value: fmtScore(metrics?.quality), color: gradeColor(metrics?.quality?.grade) },
                    { label:t('mBuilds'), value: metrics?.totalBuilds ?? 0, color:S.blue },
                    { label:t('mEdits'), value: metrics?.totalEdits ?? 0, color:S.purple },
                  ].map(m => (
                    <div key={m.label} className="stat-tile">
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:m.color, boxShadow:`0 0 6px ${m.color}88`, flexShrink:0 }} />
                        <span style={{ fontSize:10, color:S.muted, fontWeight:600 }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize:16, fontWeight:800, color:S.text, fontVariantNumeric:'tabular-nums' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding:'24px 12px', textAlign:'center', color:S.muted, fontSize:13 }}>{t('noMetricsYet')}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 🖥️ تخطيط سطح المكتب
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ height:'100vh', background:S.bg, color:S.text, display:'flex', flexDirection:'column', fontFamily:S.font, overflow:'hidden' }}>
      <style>{globalStyles}</style>

      {/* TOP NAV */}
      <nav style={{ height:48, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
          <span style={{ fontSize:14, fontWeight:800, letterSpacing:'-0.5px' }}>JAOLA OS</span>
          <span style={{ fontSize:9, color:S.blue, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', padding:'1px 6px', borderRadius:4, fontWeight:700, letterSpacing:'0.5px' }}>v2.4</span>
        </div>

        <div style={{ width:1, height:20, background:S.border, margin:'0 4px' }} />

        {/* Project Selector */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:8, padding:'4px 12px' }}>
          <span style={{ fontSize:10, color:S.muted }}>PROJECT</span>
          <select value={activeProject} onChange={e => handleSwitchProject(e.target.value)}
            style={{ background:'transparent', border:'none', color:S.text, fontSize:12, fontWeight:700, cursor:'pointer', outline:'none' }}>
            {projects.map(p => <option key={p} value={p} style={{ background:'#161b22' }}>{p}</option>)}
          </select>
          <button onClick={() => setShowProjectModal(true)}
            style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:5, padding:'2px 8px', color:S.blue, fontSize:10, fontWeight:700 }}>
            + New
          </button>
        </div>

        <div style={{ flex:1 }} />

        {/* Status */}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color: !isConnected ? '#f59e0b' : isBuilding ? '#60a5fa' : S.muted }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background: !isConnected ? '#f59e0b' : isBuilding ? '#3b82f6' : '#10b981', animation:'pulse 2s infinite' }} />
          {!isConnected ? t('reconnecting') : isBuilding ? t('missionRunning') : t('operational')}
        </div>

        <div style={{ width:1, height:20, background:S.border }} />

        {/* غطاء شفاف يغلق القوائم عند النقر خارجها */}
        {openMenu && <div onClick={() => setOpenMenu(null)} style={{ position:'fixed', inset:0, zIndex:55 }} />}

        {/* 📊 أرقام حيّة — القيمة تظهر دون فتح شيء (ضغطها يفتح البريد) */}
        {activeProject && (
          <button onClick={openInboxModal} title={t('inboxTitle')}
            style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:11, cursor:'pointer' }}>
            <span title={t('inboxVisitsToday')}>👁 {visitsToday}</span>
            <span style={{ color: inboxUnread > 0 ? '#60a5fa' : S.muted, fontWeight: inboxUnread > 0 ? 800 : 400 }} title={t('inboxTitle')}>
              📬 {inboxUnread}
            </span>
          </button>
        )}

        {/* 📈 مركز النمو — كل ما يخدم موقعك بعد البناء في قائمة واحدة */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setOpenMenu(m => m === 'grow' ? null : 'grow')}
            style={{ position:'relative', display:'flex', alignItems:'center', gap:6, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:7, padding:'5px 12px', color:'#93c5fd', fontSize:11, fontWeight:700 }}>
            📈 {t('growMenu')} ▾
            {inboxUnread > 0 && (
              <span style={{ position:'absolute', top:-6, insetInlineEnd:-6, background:'#3b82f6', color:'#fff', fontSize:9, fontWeight:800, borderRadius:9, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
                {inboxUnread > 99 ? '99+' : inboxUnread}
              </span>
            )}
          </button>
          {openMenu === 'grow' && (
            <div style={{ position:'absolute', top:'110%', insetInlineEnd:0, zIndex:60, background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:11, padding:6, minWidth:200, boxShadow:'0 12px 32px rgba(0,0,0,0.5)' }}>
              {[
                ['📬', t('inboxTitle'), openInboxModal, inboxUnread],
                ['📣', t('mkTitle'), openMarketingModal, 0],
                ['🤖', t('botStudioTitle'), openBotModal, 0],
                ['🧩', t('agTitle'), openAgentsModal, 0],
                ['🎨', t('brandTitle'), () => setShowBrandModal(true), 0],
                ['🌐', t('domTitle'), openDomainModal, 0],
              ].map(([icon, label, fn, badge], i) => (
                <button key={i} onClick={() => { setOpenMenu(null); fn(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, width:'100%', background:'transparent', border:'none', borderRadius:8, padding:'9px 10px', color:'#e2e8f0', fontSize:12, fontWeight:600, textAlign:'start', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize:15 }}>{icon}</span> {label}
                  {badge > 0 && <span style={{ marginInlineStart:'auto', background:'#3b82f6', color:'#fff', fontSize:9, fontWeight:800, borderRadius:8, padding:'1px 7px' }}>{badge}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* البناء: المعرض والصحة يبقيان ظاهرين */}
        <button onClick={openGalleryModal} title={t('galleryTitle')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.28)', borderRadius:7, padding:'5px 12px', color:'#c4b5fd', fontSize:11, fontWeight:700 }}>
          🖼️ {t('galleryTitle')}
        </button>
        <button onClick={openHealthModal} title={t('healthTitle')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.22)', borderRadius:7, padding:'5px 12px', color:'#4ade80', fontSize:11, fontWeight:700 }}>
          🩺 {t('healthTitle')}
        </button>

        {/* ⚙️ الإعدادات والأدوات النادرة */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setOpenMenu(m => m === 'settings' ? null : 'settings')} title={t('settingsMenu')}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 12px', color:'#94a3b8', fontSize:11, fontWeight:600 }}>
            ⚙️ ▾
          </button>
          {openMenu === 'settings' && (
            <div style={{ position:'absolute', top:'110%', insetInlineEnd:0, zIndex:60, background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:11, padding:6, minWidth:200, boxShadow:'0 12px 32px rgba(0,0,0,0.5)' }}>
              {[
                ['🐙', 'GitHub', openGithubModal],
                ['🔑', t('secretsTitle'), openSecretsModal],
                ['📚', t('knTitle'), openKnowledgeModal],
              ].map(([icon, label, fn], i) => (
                <button key={i} onClick={() => { setOpenMenu(null); fn(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, width:'100%', background:'transparent', border:'none', borderRadius:8, padding:'9px 10px', color:'#e2e8f0', fontSize:12, fontWeight:600, textAlign:'start', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize:15 }}>{icon}</span> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Deploy — رابط الموقع (إن وُجد) + زر النشر/إعادة النشر دائماً حاضر */}
        {vercelUrl && (
          <a href={vercelUrl} target="_blank" rel="noreferrer" title={t('liveSite')}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:7, padding:'5px 12px', color:'#10b981', fontSize:11, textDecoration:'none', fontWeight:600 }}>
            🌍 {t('liveSite')}
          </a>
        )}
        <button onClick={handlePolish} disabled={isPolishing} title={t('polish')}
          style={{ background:'rgba(56,189,248,0.12)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:7, padding:'5px 12px', color:'#7dd3fc', fontSize:11, fontWeight:700, opacity: isPolishing ? 0.7 : 1 }}>
          {isPolishing ? `⏳ ${t('polishing')}` : `✨ ${t('polish')}`}
        </button>

        <button onClick={handleDeploy} disabled={isDeploying} title={vercelUrl ? t('redeploy') : t('deploy')}
          style={{ background: isDeploying ? 'rgba(59,130,246,0.1)' : (vercelUrl ? 'rgba(59,130,246,0.12)' : 'linear-gradient(135deg,#1d4ed8,#4f46e5)'), border: vercelUrl ? '1px solid rgba(59,130,246,0.3)' : 'none', borderRadius:7, padding:'5px 14px', color: vercelUrl ? '#93c5fd' : '#fff', fontSize:11, fontWeight:700, opacity: isDeploying ? 0.7 : 1 }}>
          {isDeploying ? `⏳ ${t('deploying')}` : (vercelUrl ? `🔄 ${t('redeploy')}` : `🚀 ${t('deploy')}`)}
        </button>

        {/* User */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:8, padding:'5px 12px' }}>
          <div style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
            {(authUser || 'U')[0].toUpperCase()}
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>{(authUser || '').toUpperCase()}</span>
        </div>

        <a href="/billing" title={t('billingTitle')}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:13, textDecoration:'none' }}>
          💳
        </a>

        <a href="/admin" title={t('adminTitle')}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:13, textDecoration:'none' }}>
          ⚙️
        </a>

        <LanguageSwitcher />

        <button onClick={handleLogout}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:11 }}>
          {t('exit')}
        </button>
      </nav>

      {connectionBanner}

      {/* MAIN BODY */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width:56, background:S.bg2, borderRight:`1px solid ${S.border}`, display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:4, flexShrink:0 }}>
          {SIDEBAR_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} title={item.label}
              style={{
                width:40, height:40, borderRadius:10, border:`1px solid ${activeNav === item.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                background: activeNav === item.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: activeNav === item.id ? S.blue : S.muted, fontSize:18,
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>
              {item.icon}
            </button>
          ))}
        </div>

        {/* MISSION CONTROL — CENTER-LEFT */}
        <div style={{ width:380, minWidth:340, background:S.bg2, borderRight:`1px solid ${S.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Execution Feed */}
          {missionFeed}

          {/* Quick Builds */}
          {quickBuilds}

          {/* Quick Actions */}
          <div style={{ padding:'10px 16px', borderTop:`1px solid ${S.border}`, display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
            {[t('qaColors'), t('qaSection'), t('qaFaster'), t('qaDeploy')].map(a => (
              <button key={a} onClick={() => setPrompt(a)}
                style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:20, padding:'4px 10px', color:S.muted, fontSize:10, fontWeight:600 }}>
                {a}
              </button>
            ))}
          </div>

          {/* Mission Input */}
          <div style={{ padding:'16px', borderTop:`1px solid ${S.border}`, flexShrink:0 }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>⚡ Mission Control</span>
              {chatMessages.length > 0 && (
                <span style={{ display:'flex', gap:4 }}>
                  {[['site', '🌍'], ['system', '🏢']].map(([id, icon]) => (
                    <button key={id} onClick={() => setBuildTrack(id)} title={id === 'system' ? t('trackSystem') : t('trackSite')}
                      style={{ background: buildTrack === id ? 'rgba(99,102,241,0.2)' : 'transparent', border:`1px solid ${buildTrack === id ? 'rgba(99,102,241,0.5)' : S.border}`, borderRadius:6, padding:'2px 7px', fontSize:12, cursor:'pointer' }}>{icon}</button>
                  ))}
                </span>
              )}
            </div>
            <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t('promptPlaceholder')}
              rows={3}
              style={{
                width:'100%', background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`,
                borderRadius:10, padding:'12px 14px', color:S.text, fontSize:13, resize:'none', lineHeight:1.6,
                paddingBottom:48, transition:'border-color 0.2s'
              }}
            />
            <div style={{ display:'flex', gap:8, marginTop:-40, paddingBottom:8, position:'relative', zIndex:1, paddingRight:8, paddingLeft:8 }}>
              <button onClick={handleSend} disabled={isSending || !prompt.trim()}
                style={{
                  flex:1, background: isSending ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  border:'none', borderRadius:7, padding:'8px', color:'#fff', fontSize:12, fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: !prompt.trim() ? 0.4 : 1
                }}>
                <span>{isSending ? t('sending') : t('execute')}</span>
                {!isSending && <span style={{ opacity:0.6, fontSize:10 }}>↵</span>}
              </button>
              {(isBuilding || isSending) && (
                <button onClick={handleAbort} title={t('stopMission')}
                  style={{
                    background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)',
                    borderRadius:7, padding:'8px 14px', color:'#f87171', fontSize:12, fontWeight:700,
                    display:'flex', alignItems:'center', gap:5
                  }}>
                  ⏹ Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CENTER — PREVIEW */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {/* Tab Bar */}
          <div style={{ height:44, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:2, flexShrink:0 }}>
            {[
              { id:'preview', label:`🖥️ ${t('preview')}` },
              { id:'editor', label:`💻 ${t('code')}` },
              { id:'logs', label:`📋 ${t('logs')}${logs.length > 0 ? ` (${logs.length})` : ''}` },
              { id:'timeline', label:`🕘 ${t('timeline')}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                  borderRadius:7, padding:'5px 14px', color: activeTab === tab.id ? '#93c5fd' : S.muted,
                  fontSize:12, fontWeight: activeTab === tab.id ? 600 : 400
                }}>
                {tab.label}
              </button>
            ))}
            {logs.some(l => l.message?.includes('✨')) && (
              <div style={{ marginRight:4, display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#10b981', marginLeft:8 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', animation:'pulse 1s infinite' }} /> {t('buildComplete')}
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
            {activeTab === 'preview' && previewView}
            {activeTab === 'editor' && <MonacoWorkspace />}
            {activeTab === 'logs' && logsView}
            {activeTab === 'timeline' && (
              <TimelinePanel activeProject={activeProject} token={token}
                onRestored={(h) => { addNotification(`${t('nRestored')} (${h})`, 'success'); refreshPreview(); }} />
            )}
          </div>

          {/* Agent Timeline */}
          <div style={{ height:60, background:'#050910', borderTop:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:0, overflowX:'auto', flexShrink:0 }}>
            {Object.entries(agentStates || { planner:'waiting', architect:'waiting', coder:'waiting', qa:'waiting', deploy:'waiting' }).map(([name, state], i, arr) => (
              <div key={name} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
                <AgentNode name={name} state={state} icon={
                  name === 'planner' ? '🗺️' : name === 'architect' ? '🏗️' : name === 'coder' ? '💻' : name === 'qa' ? '🧪' : '🚀'
                } />
                {i < arr.length - 1 && <div style={{ width:24, height:1, background: state === 'completed' ? 'rgba(16,185,129,0.3)' : S.border, flexShrink:0, margin:'0 2px' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — INTELLIGENCE */}
        <div style={{ width:220, background:S.bg2, borderLeft:`1px solid ${S.border}`, display:'flex', flexDirection:'column', overflowY:'auto', flexShrink:0 }}>

          {/* Digital Twin — حالة السيرفر الحقيقية */}
          <div style={{ padding:'14px', borderBottom:`1px solid ${S.border}` }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>⬡ Digital Twin</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background: isConnected ? S.good : S.warn, boxShadow:`0 0 8px ${isConnected ? S.good : S.warn}`, animation:'pulse 1.6s infinite', flexShrink:0 }} />
              <span style={{ fontSize:20, fontWeight:900, letterSpacing:'0.5px', color: isConnected ? S.good : S.warn }}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
              <span style={{ fontSize:10, color:S.muted, marginInlineStart:'auto' }}>Uptime {fmtUptime}</span>
            </div>
            <div className="meter">
              <span style={{ width: isConnected ? '100%' : '15%', background: isConnected ? 'linear-gradient(90deg,#10b981,#059669)' : S.warn, boxShadow:`0 0 8px ${isConnected ? S.good : S.warn}66` }} />
            </div>
          </div>

          {/* Metrics — مؤشرات النظام الحقيقية (مؤشرات مدوّرة، القيمة بالحبر النصّي) */}
          <div style={{ padding:14, borderBottom:`1px solid ${S.border}`, display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'CPU', value: metrics?.system?.cpuPct != null ? `${metrics.system.cpuPct}%` : '—', pct: metrics?.system?.cpuPct ?? 0, color:S.blue },
              { label:'RAM', value: metrics?.system?.rssMb != null ? `${metrics.system.rssMb} MB` : '—', pct: Math.min(100, (metrics?.system?.rssMb ?? 0) / 5), color:S.purple },
              { label:'Latency', value: latencyMs != null ? `${latencyMs} ms` : '—', pct: Math.min(100, (latencyMs ?? 0) / 10), color: (latencyMs ?? 0) > 500 ? S.warn : S.good },
            ].map(m => (
              <div key={m.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:10, color:S.muted, fontWeight:600 }}>{m.label}</span>
                  <span style={{ fontSize:11, color:S.text, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{m.value}</span>
                </div>
                <div className="meter">
                  <span style={{ width:`${Math.max(m.pct, 2)}%`, background:m.color, boxShadow:`0 0 8px ${m.color}66` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Business Intelligence — بطاقات إحصاء: القيمة بالحبر، لون الحالة على النقطة */}
          <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>📊 {t('intelligence')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[
                { label:'SEO', value: fmtScore(metrics?.seo), color: gradeColor(metrics?.seo?.grade) },
                { label:'Security', value: fmtScore(metrics?.security), color: gradeColor(metrics?.security?.grade) },
                { label:'Quality', value: fmtScore(metrics?.quality), color: gradeColor(metrics?.quality?.grade) },
                { label:'Builds', value: metrics?.totalBuilds ?? 0, color:S.blue },
                { label:'Edits', value: metrics?.totalEdits ?? 0, color:S.purple },
              ].map(m => (
                <div key={m.label} className="stat-tile">
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:m.color, boxShadow:`0 0 6px ${m.color}88`, flexShrink:0 }} />
                    <span style={{ fontSize:9, color:S.muted, fontWeight:600, letterSpacing:'0.3px' }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:S.text, fontVariantNumeric:'tabular-nums' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          {files.length > 0 && (
            <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
              <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>📁 Workspace</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Files', value: files.length },
                  { label:'Lines', value: activeFileContent.split('\n').length },
                ].map(s => (
                  <div key={s.label} className="stat-tile">
                    <div style={{ fontSize:9, color:S.muted, fontWeight:600 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:S.text, marginTop:2, fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div style={{ padding:14, flex:1 }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>Files</div>
            {files.map(f => (
              <button key={f} onClick={() => { openJaolaFile(f); setActiveTab('editor'); }}
                style={{ width:'100%', background: activeFile === f ? 'rgba(59,130,246,0.08)' : 'transparent', border:`1px solid ${activeFile === f ? 'rgba(59,130,246,0.2)' : 'transparent'}`, borderRadius:6, padding:'5px 8px', color: activeFile === f ? '#93c5fd' : S.muted, fontSize:10, textAlign:'right', display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span>{f.endsWith('.html') ? '🧡' : f.endsWith('.css') ? '💙' : f.endsWith('.js') ? '💛' : '📄'}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>{f}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {notificationsOverlay}
      {githubModal}
      {knowledgeModal}
      {healthModal}
      {inboxModal}
      {brandModal}
      {domainModal}
      {agentsModal}
      {botModal}
      {marketingModal}
      {galleryModal}
      {projectModal}
      {secretsModal}
    </div>
  );
}
