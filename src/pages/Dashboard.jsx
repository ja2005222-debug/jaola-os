import React, { useState, useEffect, useRef, useReducer } from 'react';
import { 
  Bot, Zap, Clock, ShieldCheck, Cpu, 
  CheckCircle, Loader, AlertCircle, 
  Coffee, Plane, Hotel, BarChart,
  GitBranch, File, Folder, Send,
  Terminal, Play, Square, 
  Code, Database, Globe, Check, Plus,
  Target, TrendingUp, Users, Layers, RotateCcw
} from 'lucide-react';

// --------------------------------------------
// 1. الحالة الأولية
// --------------------------------------------
const initialProjectState = {
  name: 'Pizza Store',
  goal: 'بناء متجر بيتزا',
  progress: 0,
  eta: 'غير محدد',
  currentAgent: null,
  currentFile: null,
  pages: 0,
  components: 0,
  apis: 0,
  tables: 0,
  risks: [],
  todos: [],
  structure: {
    'app': { type: 'folder', children: { 'page.tsx': { type: 'file' } } },
    'components': { type: 'folder', children: {} },
    'lib': { type: 'folder', children: {} },
    'prisma': { type: 'folder', children: {} },
    'tests': { type: 'folder', children: {} }
  },
  changes: [],
  tasks: [],
  conversationHistory: [],
  digitalTwin: {
    framework: 'Next.js 15',
    database: 'PostgreSQL',
    health: 100,
    lastUpdated: new Date().toISOString()
  }
};

// --------------------------------------------
// 2. تكامل Groq API مع logging
// --------------------------------------------
const callGroq = async (messages) => {
  const response = await fetch('http://localhost:3001/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  const data = await response.json();
  return data.choices[0].message.content;
};

const saveFileToDisk = async (fileName, content) => {
  try {
    const response = await fetch('http://localhost:3001/api/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, content })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ فشل حفظ الملف:', error);
  }
};
// دوال الـ Agents (كما هي، مع try/catch)
const agentFunctions = {
  '👔 CEO': async (projectState, userMessage) => {
    const prompt = `
أنت المدير التنفيذي (CEO) لنظام JAOLA OS. مهمتك هي تحليل طلب المستخدم وتقسيم المشروع إلى مهام فرعية وتقدير التكلفة والمدة.

المشروع الحالي:
- الاسم: ${projectState.name}
- الهدف: ${projectState.goal}
- التقدم: ${projectState.progress}%
- المهام الحالية: ${projectState.tasks.map(t => t.name).join(', ')}
- المهام المكتملة: ${projectState.tasks.filter(t => t.done).length}

رسالة المستخدم: "${userMessage}"

قم بالرد على المستخدم بطريقة احترافية، مع تقديم خطة عمل مقسمة، والتكلفة التقديرية، والمدة المتوقعة. أضف أي مخاطر محتملة.
`;
    try {
      return await callGroq([{ role: 'system', content: 'أنت خبير في إدارة المشاريع التقنية.' }, { role: 'user', content: prompt }]);
    } catch (error) {
      return { error: error.message };
    }
  },
  '🧠 Planner': async (projectState, userMessage) => {
    const prompt = `
أنت المخطط (Planner) في نظام JAOLA OS. مهمتك هي تحليل المتطلبات وتحديد الخطوات اللازمة لتنفيذ المشروع.

المشروع الحالي:
- الاسم: ${projectState.name}
- الهدف: ${projectState.goal}
- المهام الحالية: ${projectState.tasks.map(t => t.name).join(', ')}

رسالة المستخدم: "${userMessage}"

قم بتقديم قائمة بالمهام المطلوبة (كل مهمة في سطر جديد) مع ترتيب الأولوية. حدد المدة المتوقعة لكل مهمة.
`;
    try {
      return await callGroq([{ role: 'system', content: 'أنت خبير في تخطيط المشاريع.' }, { role: 'user', content: prompt }]);
    } catch (error) {
      return { error: error.message };
    }
  },
  '🏗 Architect': async (projectState, userMessage) => {
    const prompt = `
أنت المعماري (Architect) في نظام JAOLA OS. مهمتك هي تصميم البنية التقنية للمشروع، بما في ذلك قاعدة البيانات، واجهات API، وهيكل التطبيق.

المشروع الحالي:
- الاسم: ${projectState.name}
- الهدف: ${projectState.goal}
- المهام الحالية: ${projectState.tasks.map(t => t.name).join(', ')}

رسالة المستخدم: "${userMessage}"

قدم توصيات حول التقنيات المناسبة، هيكل قاعدة البيانات (جداول وعلاقات)، وواجهات API الأساسية.
`;
    try {
      return await callGroq([{ role: 'system', content: 'أنت خبير في هندسة البرمجيات وتصميم الأنظمة.' }, { role: 'user', content: prompt }]);
    } catch (error) {
      return { error: error.message };
    }
  },
  '💻 Coder': async (projectState, userMessage) => {
    const prompt = `
أنت المبرمج (Coder) في نظام JAOLA OS. مهمتك هي كتابة الكود وتنفيذ المهام البرمجية.

المشروع الحالي:
- الاسم: ${projectState.name}
- الهدف: ${projectState.goal}
- المهام الحالية: ${projectState.tasks.map(t => t.name).join(', ')}
- الملفات الحالية: ${Object.keys(projectState.structure).join(', ')}

رسالة المستخدم: "${userMessage}"

قم بكتابة الكود المطلوب، أو اقتراح التعديلات اللازمة، أو شرح كيفية تنفيذ مهمة برمجية معينة.
`;
    try {
      return await callGroq([{ role: 'system', content: 'أنت مطور محترف في React و Next.js.' }, { role: 'user', content: prompt }]);
    } catch (error) {
      return { error: error.message };
    }
  },
  '🔍 QA': async (projectState, userMessage) => {
    const prompt = `
أنت مسؤول ضمان الجودة (QA) في نظام JAOLA OS. مهمتك هي اختبار التطبيق، وتحليل الأداء، والأمان، وسهولة الاستخدام.

المشروع الحالي:
- الاسم: ${projectState.name}
- الهدف: ${projectState.goal}
- المهام الحالية: ${projectState.tasks.map(t => t.name).join(', ')}

رسالة المستخدم: "${userMessage}"

قدم تقريراً عن جودة الكود، اقترح تحسينات، وأشر إلى أي مشاكل محتملة (أداء، أمان، توافق).
`;
    try {
      return await callGroq([{ role: 'system', content: 'أنت خبير في اختبار البرمجيات وضمان الجودة.' }, { role: 'user', content: prompt }]);
    } catch (error) {
      return { error: error.message };
    }
  },
  '🚀 Deploy': async (projectState, userMessage) => {
    const prompt = `
أنت مسؤول النشر (Deploy) في نظام JAOLA OS. مهمتك هي إعداد بيئة الإنتاج ونشر التطبيق.

المشروع الحالي:
- الاسم: ${projectState.name}
- الهدف: ${projectState.goal}

رسالة المستخدم: "${userMessage}"

قدم خطة نشر (خطوات، أدوات، متغيرات البيئة)، وأي تحذيرات أو متطلبات مسبقة.
`;
    try {
      return await callGroq([{ role: 'system', content: 'أنت خبير في DevOps ونشر التطبيقات.' }, { role: 'user', content: prompt }]);
    } catch (error) {
      return { error: error.message };
    }
  }
};

// --------------------------------------------
// 3. Intent Engine
// --------------------------------------------
const intentEngine = (message) => {
  const lower = message.toLowerCase();
  const intents = {
    build: /ابني|أنشئ|بناء|طور|جهز/i,
    add_component: /أضف مكون|أنشئ مكون|مكون جديد/i,
    add_page: /أضف صفحة|صفحة جديدة|أنشئ صفحة/i,
    change_name: /غير المشروع|غير اسم|عدل اسم/i,
    add_task: /أضف مهمة|مهمة جديدة/i,
    progress: /التقدم|الprogress|تقدم/i,
    help: /مساعدة|help|الأوامر/i,
    estimate: /كم سعر|تكلفة|مدة|سعر/i,
    deploy: /انشر|نشر|رفع/i,
    debug: /خطأ|debug|اصلح/i,
    business: /سوق|ربح|منافس/i,
    design: /تصميم|واجهة|ui/i,
  };
  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(lower)) {
      return { intent, confidence: 0.95, requiresExecution: true };
    }
  }
  return { intent: 'chat', confidence: 0.6, requiresExecution: false };
};

// --------------------------------------------
// 4. State Reducer (مع إضافة CLEAR_TASKS و CLEAR_CHANGES)
// --------------------------------------------
const projectReducer = (state, action) => {
  switch (action.type) {
    case 'SET_PROJECT_NAME': return { ...state, name: action.payload };
    case 'SET_GOAL': return { ...state, goal: action.payload };
    case 'SET_PROGRESS': return { ...state, progress: action.payload };
    case 'SET_ETA': return { ...state, eta: action.payload };
    case 'SET_CURRENT_AGENT': return { ...state, currentAgent: action.payload };
    case 'SET_CURRENT_FILE': return { ...state, currentFile: action.payload };
    case 'ADD_TASK': return { ...state, tasks: [...state.tasks, { name: action.payload, done: false }] };
    case 'COMPLETE_TASK': return { ...state, tasks: state.tasks.map((t, i) => i === action.payload ? { ...t, done: true } : t) };
    case 'ADD_CHANGE': return { ...state, changes: [...state.changes, action.payload] };
    case 'UPDATE_STRUCTURE': return { ...state, structure: action.payload };
    case 'SET_RISKS': return { ...state, risks: action.payload };
    case 'CLEAR_TASKS': return { ...state, tasks: [] };
    case 'CLEAR_CHANGES': return { ...state, changes: [] };
    case 'SCAN_PROJECT': return scanProject(state);
    default: return state;
  }
};

const scanProject = (state) => {
  const structure = state.structure;
  const pages = structure.app?.children ? Object.keys(structure.app.children).filter(k => structure.app.children[k].type === 'folder').length : 0;
  const components = structure.components?.children ? Object.keys(structure.components.children).length : 0;
  const apis = structure.lib?.children ? Object.keys(structure.lib.children).filter(k => k.includes('api')).length : 0;
  const tables = structure.prisma?.children ? Object.keys(structure.prisma.children).length : 0;
  return {
    ...state,
    pages,
    components,
    apis,
    tables,
    digitalTwin: {
      ...state.digitalTwin,
      pages,
      components,
      apis,
      tables,
      health: 100 - (state.risks.length * 5)
    }
  };
};

const generateCEOMission = (goal) => {
  const tasks = [];
  if (goal.includes('بيتزا') || goal.includes('مطعم')) {
    tasks.push('صفحة رئيسية', 'المنتجات', 'السلة', 'الدفع', 'لوحة تحكم');
  } else if (goal.includes('سفر')) {
    tasks.push('البحث', 'الحجز', 'الدفع', 'الملف الشخصي');
  } else if (goal.includes('حجوزات')) {
    tasks.push('قائمة الفنادق', 'الحجز', 'الدفع', 'المراجعات');
  } else {
    tasks.push('الصفحة الرئيسية', 'الميزات', 'التسعير', 'لوحة التحكم');
  }
  return tasks.map(t => ({ name: t, done: false }));
};

// --------------------------------------------
// 5. المكون الرئيسي Dashboard
// --------------------------------------------
export default function Dashboard() {
  const loadState = () => {
    const saved = localStorage.getItem('jaola_os_state');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return initialProjectState;
  };

  const [projectState, dispatch] = useReducer(projectReducer, loadState());
  const projectStateRef = useRef(projectState);
  useEffect(() => {
    projectStateRef.current = projectState;
  }, [projectState]);

  useEffect(() => {
    localStorage.setItem('jaola_os_state', JSON.stringify(projectState));
  }, [projectState]);

  // ------ حالات الواجهة ------
  const [chatMessages, setChatMessages] = useState([
    { agent: 'System', text: 'مرحباً! أنا JAOLA OS. اكتب أمراً لبدء المشروع، أو "مساعدة" لعرض الأوامر.', icon: '🤖' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingStream, setThinkingStream] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const chatEndRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('http://localhost:3000');
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
  const [agentStream, setAgentStream] = useState([]);
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const addChange = (type, text) => dispatch({ type: 'ADD_CHANGE', payload: { type, text } });
  const completeTask = (index) => dispatch({ type: 'COMPLETE_TASK', payload: index });

  // وظيفة مسح بيانات المشروع (Reset)
  const resetProject = () => {
    dispatch({ type: 'CLEAR_TASKS' });
    dispatch({ type: 'CLEAR_CHANGES' });
    dispatch({ type: 'SET_GOAL', payload: '' });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    dispatch({ type: 'SET_ETA', payload: 'غير محدد' });
    dispatch({ type: 'SET_RISKS', payload: [] });
    dispatch({ type: 'UPDATE_STRUCTURE', payload: initialProjectState.structure });
    dispatch({ type: 'SCAN_PROJECT' });
    setAgentStream([]);
    setThinkingStream([]);
    setChatMessages([
      { agent: 'System', text: '🔄 تم إعادة تعيين المشروع. اكتب أمراً لبدء مشروع جديد.', icon: '🔄' }
    ]);
    localStorage.removeItem('jaola_os_state');
  };

  // ------ تنفيذ المهمة (مع مسح المهام والتغييرات السابقة) ------
  const runMission = async (goal) => {
    if (isRunning) return;
    setIsRunning(true);
    setThinkingStream([]);
    setAgentStream([]);

    // 1. مسح المهام والتغييرات السابقة
    dispatch({ type: 'CLEAR_TASKS' });
    dispatch({ type: 'CLEAR_CHANGES' });

    dispatch({ type: 'SET_GOAL', payload: goal });
    dispatch({ type: 'SET_PROGRESS', payload: 0 });
    dispatch({ type: 'SET_ETA', payload: 'جاري الحساب...' });
    dispatch({ type: 'SET_CURRENT_AGENT', payload: '👔 CEO' });

    setThinkingStream(prev => [...prev, '👔 CEO: جاري تحليل المشروع...']);

    // 2. استدعاء CEO Agent
    let ceoReply = await agentFunctions['👔 CEO'](projectStateRef.current, `ابني مشروع ${goal}`);
    let ceoPlan = [];

    if (ceoReply && !ceoReply.error) {
      setChatMessages(prev => [...prev, { agent: '👔 CEO', text: ceoReply, icon: '👔' }]);
      const lines = ceoReply.split('\n');
      const taskLines = lines.filter(line => line.match(/^\d+\.|^- |^•/));
      if (taskLines.length > 0) {
        taskLines.forEach(task => {
          const cleanTask = task.replace(/^\d+\.|^- |^•/, '').trim();
          if (cleanTask) ceoPlan.push({ name: cleanTask, done: false });
        });
      }
    } else {
      const errorMsg = ceoReply?.error || 'فشل الاتصال بـ Groq API.';
      setChatMessages(prev => [...prev, { agent: '👔 CEO', text: `⚠️ ${errorMsg}`, icon: '⚠️' }]);
      ceoPlan = generateCEOMission(goal);
    }

    if (ceoPlan.length === 0) ceoPlan = generateCEOMission(goal);
    ceoPlan.forEach(task => dispatch({ type: 'ADD_TASK', payload: task.name }));

    // 3. محاكاة تنفيذ المهام
    const pipeline = [
      { agent: '🧠 Planner', task: 'تحليل الطلب', action: 'فهم المتطلبات', delay: 1500 },
      { agent: '🏗 Architect', task: 'تصميم النظام', action: 'تصميم قاعدة البيانات', delay: 1800 },
      { agent: '💻 Coder', task: 'كتابة الكود', action: 'إنشاء المكونات', delay: 2000 },
      { agent: '🔍 QA', task: 'اختبار التكامل', action: 'تشغيل الاختبارات', delay: 1600 },
      { agent: '🚀 Deploy', task: 'النشر', action: 'رفع التطبيق', delay: 1200 }
    ];

    let stepIndex = 0;
    const runNextStep = async () => {
      if (stepIndex >= pipeline.length) {
        setIsRunning(false);
        dispatch({ type: 'SET_PROGRESS', payload: 100 });
        dispatch({ type: 'SET_ETA', payload: '0 دقيقة' });
        dispatch({ type: 'SET_CURRENT_AGENT', payload: null });
        setChatMessages(prev => [...prev, { agent: 'System', text: '✅ اكتمل المشروع بنجاح!', icon: '🎉' }]);
        setThinkingStream(prev => [...prev, '✅ جميع المهام مكتملة.']);
        return;
      }

      const step = pipeline[stepIndex];
      const agentName = step.agent;
      dispatch({ type: 'SET_CURRENT_AGENT', payload: agentName });
      dispatch({ type: 'SET_CURRENT_FILE', payload: `task_${stepIndex+1}.md` });
      setThinkingStream(prev => [...prev, `${agentName}: ${step.action}...`]);

      setTimeout(() => {
        const currentState = projectStateRef.current;
        const now = new Date();
        const timeStr = now.toTimeString().slice(0,5);
        setAgentStream(prev => [...prev, { time: timeStr, agent: agentName, action: step.action }]);

        const newStructure = { ...currentState.structure };
        const folder = stepIndex % 2 === 0 ? 'components' : 'app';
        if (!newStructure[folder].children) newStructure[folder].children = {};
        newStructure[folder].children[`${stepIndex}_${step.task}.tsx`] = { type: 'file' };
        dispatch({ type: 'UPDATE_STRUCTURE', payload: newStructure });
        addChange('add', `${agentName} - ${step.task}`);

        if (stepIndex < currentState.tasks.length) {
          dispatch({ type: 'COMPLETE_TASK', payload: stepIndex });
        }

        const risks = [];
        if (stepIndex === 0) risks.push('السوق متغير');
        if (stepIndex === 2) risks.push('مفتاح Stripe مفقود');
        if (stepIndex === 3) risks.push('اختبار الدفع يفشل');
        dispatch({ type: 'SET_RISKS', payload: risks });

        const progress = Math.round(((stepIndex + 1) / pipeline.length) * 100);
        dispatch({ type: 'SET_PROGRESS', payload: progress });
        const eta = Math.round((pipeline.length - stepIndex - 1) * 1.5);
        dispatch({ type: 'SET_ETA', payload: `${eta} دقيقة` });
        dispatch({ type: 'SCAN_PROJECT' });
        setPreviewTimestamp(Date.now());

        stepIndex++;
        runNextStep();
      }, step.delay);
    };
    runNextStep();
  };

  // ------ معالجة الأوامر (مع Groq وعرض الأخطاء) ------
  const handleSendMessage = async () => {
    const cmd = inputValue.trim();
    if (!cmd || isProcessing) return;
    setInputValue('');
    setIsProcessing(true);

    setChatMessages(prev => [...prev, { agent: 'User', text: cmd, icon: '👤' }]);

    const { intent } = intentEngine(cmd);

    try {
      switch (intent) {
        case 'build': {
          const goalName = cmd.replace(/ابني|أنشئ|بناء|طور|جهز/i, '').trim() || 'مشروع جديد';
          setChatMessages(prev => [...prev, { agent: 'System', text: `🚀 بدء بناء "${goalName}"...`, icon: '🚀' }]);
          await runMission(goalName);
          break;
        }
        case 'add_component': {
          const compName = cmd.replace(/أضف مكون|أنشئ مكون|مكون جديد/i, '').trim() || 'NewComponent';
          try {
            const reply = await agentFunctions['💻 Coder'](projectStateRef.current, `أضف مكون ${compName}`);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '💻 Coder', text: reply, icon: '💻' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '💻 Coder', text: `✅ تم إنشاء المكون "${compName}.tsx".`, icon: '💻' }]);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ خطأ من Groq: ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ خطأ في الاتصال بـ Groq: ${error.message}`, icon: '⚠️' }]);
          }
          const currentState = projectStateRef.current;
          const newStructure = { ...currentState.structure };
          if (!newStructure.components) newStructure.components = { type: 'folder', children: {} };
          newStructure.components.children[`${compName}.tsx`] = { type: 'file' };
          dispatch({ type: 'UPDATE_STRUCTURE', payload: newStructure });
          dispatch({ type: 'SCAN_PROJECT' });
          addChange('add', `components/${compName}.tsx`);
          const now = new Date();
          const timeStr = now.toTimeString().slice(0,5);
          setAgentStream(prev => [...prev, { time: timeStr, agent: '💻 Coder', action: `إضافة مكون ${compName}` }]);
          break;
        }
        case 'add_page': {
          const pageName = cmd.replace(/أضف صفحة|صفحة جديدة|أنشئ صفحة/i, '').trim() || 'new-page';
          try {
            const reply = await agentFunctions['💻 Coder'](projectStateRef.current, `أضف صفحة ${pageName}`);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '💻 Coder', text: reply, icon: '💻' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '💻 Coder', text: `✅ تم إنشاء صفحة "${pageName}".`, icon: '📄' }]);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ خطأ من Groq: ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${error.message}`, icon: '⚠️' }]);
          }
          const currentState = projectStateRef.current;
          const newStructure = { ...currentState.structure };
          if (!newStructure.app) newStructure.app = { type: 'folder', children: {} };
          newStructure.app.children[pageName] = { type: 'folder', children: { 'page.tsx': { type: 'file' } } };
          dispatch({ type: 'UPDATE_STRUCTURE', payload: newStructure });
          dispatch({ type: 'SCAN_PROJECT' });
          addChange('add', `app/${pageName}/page.tsx`);
          const now = new Date();
          const timeStr = now.toTimeString().slice(0,5);
          setAgentStream(prev => [...prev, { time: timeStr, agent: '💻 Coder', action: `إضافة صفحة ${pageName}` }]);
          break;
        }
        case 'change_name': {
          const newName = cmd.replace(/غير المشروع|غير اسم|عدل اسم/i, '').trim() || 'مشروع غير مسمى';
          dispatch({ type: 'SET_PROJECT_NAME', payload: newName });
          setChatMessages(prev => [...prev, { agent: 'System', text: `📝 تم تغيير اسم المشروع إلى "${newName}".`, icon: '📝' }]);
          break;
        }
        case 'add_task': {
          const taskName = cmd.replace(/أضف مهمة|مهمة جديدة/i, '').trim() || 'مهمة جديدة';
          dispatch({ type: 'ADD_TASK', payload: taskName });
          setChatMessages(prev => [...prev, { agent: 'System', text: `📌 تم إضافة مهمة "${taskName}".`, icon: '📌' }]);
          break;
        }
        case 'progress': {
          const currentState = projectStateRef.current;
          const done = currentState.tasks.filter(t => t.done).length;
          const total = currentState.tasks.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          setChatMessages(prev => [...prev, { agent: 'System', text: `📊 التقدم: ${done}/${total} مهمة مكتملة (${pct}%).`, icon: '📊' }]);
          break;
        }
        case 'estimate': {
          try {
            const reply = await agentFunctions['👔 CEO'](projectStateRef.current, cmd);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '👔 CEO', text: reply, icon: '👔' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '🧠 Planner', text: '💰 التكلفة التقديرية: €2000 - €4000\n⏱ المدة: 3 أيام', icon: '🧠' }]);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${error.message}`, icon: '⚠️' }]);
          }
          break;
        }
        case 'deploy': {
          try {
            const reply = await agentFunctions['🚀 Deploy'](projectStateRef.current, cmd);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '🚀 Deploy', text: reply, icon: '🚀' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '🚀 Deploy', text: '🚀 جاري النشر... (محاكاة)', icon: '🚀' }]);
              setTimeout(() => {
                setChatMessages(prev => [...prev, { agent: '🚀 Deploy', text: '✅ تم النشر بنجاح على Vercel.', icon: '✅' }]);
              }, 2000);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${error.message}`, icon: '⚠️' }]);
          }
          break;
        }
        case 'debug': {
          try {
            const reply = await agentFunctions['🔍 QA'](projectStateRef.current, cmd);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '🔍 QA', text: reply, icon: '🔍' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '🔍 QA', text: '🔍 جاري تحليل الأخطاء... (محاكاة)', icon: '🔍' }]);
              setTimeout(() => {
                setChatMessages(prev => [...prev, { agent: '🔍 QA', text: '✅ تم إصلاح خطأ في استيراد المكونات.', icon: '✅' }]);
              }, 1500);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${error.message}`, icon: '⚠️' }]);
          }
          break;
        }
        case 'business': {
          try {
            const reply = await agentFunctions['👔 CEO'](projectStateRef.current, cmd);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '👔 CEO', text: reply, icon: '👔' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '👔 CEO', text: '📈 تحليل السوق: السوق المستهدف: مطاعم محلية. الربح المتوقع: 2000-4000€/شهر.', icon: '👔' }]);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${error.message}`, icon: '⚠️' }]);
          }
          break;
        }
        case 'design': {
          try {
            const reply = await agentFunctions['🏗 Architect'](projectStateRef.current, cmd);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: '🏗 Architect', text: reply, icon: '🏗' }]);
            } else {
              setChatMessages(prev => [...prev, { agent: '🏗 Architect', text: '🎨 تحليل التصميم: سيتم اعتماد واجهة حديثة باستخدام Tailwind CSS و Shadcn UI.', icon: '🏗' }]);
              if (reply?.error) {
                setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${reply.error}`, icon: '⚠️' }]);
              }
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${error.message}`, icon: '⚠️' }]);
          }
          break;
        }
        case 'help': {
          const helpText = `📖 **الأوامر المتاحة**:\n- ابني [اسم المشروع]\n- أضف مكون [الاسم]\n- أضف صفحة [الاسم]\n- غير المشروع [الاسم]\n- أضف مهمة [المهمة]\n- التقدم\n- كم سعر\n- انشر\n- خطأ (debug)\n- سوق (business)\n- تصميم (design)\n- مساعدة`;
          setChatMessages(prev => [...prev, { agent: 'System', text: helpText, icon: '📖' }]);
          break;
        }
        default: {
          try {
            const reply = await agentFunctions['👔 CEO'](projectStateRef.current, cmd);
            if (reply && !reply.error) {
              setChatMessages(prev => [...prev, { agent: 'System', text: reply, icon: '🤖' }]);
            } else {
              const errorMsg = reply?.error || 'فشل الاتصال بـ Groq.';
              setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ ${errorMsg}`, icon: '⚠️' }]);
              const currentState = projectStateRef.current;
              const fallback = `أنا JAOLA OS. أنت تعمل حالياً على مشروع "${currentState.name}" (${currentState.goal}). التقدم: ${currentState.progress}%. اكتب "مساعدة" لعرض الأوامر.`;
              setChatMessages(prev => [...prev, { agent: 'System', text: fallback, icon: '🤖' }]);
            }
          } catch (error) {
            setChatMessages(prev => [...prev, { agent: 'System', text: `⚠️ خطأ: ${error.message}`, icon: '⚠️' }]);
          }
          break;
        }
      }
    } catch (error) {
      console.error('❌ [Chat] Unhandled error:', error);
      setChatMessages(prev => [...prev, { agent: 'System', text: '⚠️ حدث خطأ غير متوقع، حاول مرة أخرى.', icon: '⚠️' }]);
    }

    setIsProcessing(false);
  };

  // ------ تأثيرات جانبية ------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const checkPreview = async () => {
    try {
      setPreviewLoading(true);
      await fetch(previewUrl, { mode: 'no-cors', signal: AbortSignal.timeout(3000) });
      setPreviewError(false);
    } catch (e) {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    checkPreview();
  }, [previewUrl]);

  const reloadPreview = () => {
    setPreviewTimestamp(Date.now());
    checkPreview();
  };

  // ------ دوال العرض ------
  const renderTree = (node, path = '') => {
    if (node.type === 'file') {
      return <div key={path} className="flex items-center gap-1 text-slate-300"><File size={12} /> {path.split('/').pop()}</div>;
    }
    return (
      <div key={path} className="ml-2">
        <div className="flex items-center gap-1 text-cyan-400"><Folder size={12} /> {path.split('/').pop() || 'root'}</div>
        <div className="ml-3 border-l border-slate-700 pl-2">
          {Object.entries(node.children || {}).map(([name, child]) => renderTree(child, path + '/' + name))}
        </div>
      </div>
    );
  };

  const renderChanges = () => {
    return projectState.changes.map((ch, idx) => (
      <div key={idx} className="flex items-center gap-1 text-xs">
        {ch.type === 'add' ? <span className="text-emerald-400">+</span> : <span className="text-red-400">-</span>}
        <span className={ch.type === 'add' ? 'text-slate-200' : 'text-slate-400 line-through'}>{ch.text}</span>
      </div>
    ));
  };

  const renderStream = () => {
    return agentStream.map((item, idx) => (
      <div key={idx} className="flex items-center gap-2 text-xs border-b border-slate-800 py-1">
        <span className="text-slate-500 w-12">{item.time}</span>
        <span className="text-cyan-400 w-20">{item.agent}</span>
        <span className="text-slate-300">{item.action}</span>
      </div>
    ));
  };

  const renderTasks = () => {
    return projectState.tasks.map((t, idx) => (
      <div key={idx} className="flex items-center gap-2 text-xs">
        {t.done ? <CheckCircle size={14} className="text-emerald-400" /> : <Clock size={14} className="text-slate-500" />}
        <span className={t.done ? 'text-slate-300' : 'text-slate-500'}>{t.name}</span>
      </div>
    ));
  };

  const renderThinking = () => {
    if (!isRunning && thinkingStream.length === 0) return null;
    return (
      <div className="bg-slate-800/70 rounded-lg p-2 border border-slate-700 mt-2 max-h-32 overflow-y-auto">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
          <Loader size={12} className="animate-spin" />
          <span>{isRunning ? 'جاري التنفيذ...' : 'اكتمل'}</span>
        </div>
        <div className="mt-1 space-y-0.5 text-xs text-slate-300">
          {thinkingStream.map((step, i) => <div key={i}>{step}</div>)}
        </div>
      </div>
    );
  };

  // -------- الواجهة الرئيسية --------
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <div className="grid grid-cols-12 grid-rows-6 gap-2 w-full h-full p-2">

        {/* CEO Brief */}
        <div className="col-span-12 row-span-1 border border-slate-800 bg-slate-900/50 rounded-xl p-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">JAOLA OS</h1>
            <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-400">v4.2</span>
            <button 
              onClick={resetProject}
              className="flex items-center gap-1 text-xs bg-red-900/30 hover:bg-red-800/40 text-red-400 px-2 py-1 rounded border border-red-700/30 transition"
            >
              <RotateCcw size={12} /> إعادة تعيين
            </button>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <div className="flex flex-col"><span className="text-xs text-slate-600">🎯 الهدف</span><span className="font-semibold text-white">{projectState.goal}</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">التقدم</span><span className="font-semibold text-emerald-400">{projectState.progress}%</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">⏳ ETA</span><span className="font-semibold text-cyan-400">{projectState.eta}</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">🤖 الوكيل الحالي</span><span className="font-semibold text-white">{projectState.currentAgent || '—'}</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">📄 الملف الحالي</span><span className="font-semibold text-white">{projectState.currentFile || '—'}</span></div>
          </div>
        </div>

        {/* AI Chat + Live Preview */}
        <div className="col-span-4 row-span-3 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-hidden flex flex-col">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Bot size={16}/> AI CHAT</h2>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm pr-1">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`p-1.5 rounded border-l-2 ${msg.agent === 'System' ? 'border-purple-500 bg-slate-800/50' : msg.agent === 'User' ? 'border-blue-500 bg-slate-800/30' : 'border-cyan-500 bg-slate-800'} text-xs`}>
                <span className="font-mono">{msg.icon || '💬'} {msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="اكتب أمراً (مثال: ابني متجر بيتزا)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              disabled={isProcessing}
            />
            <button onClick={handleSendMessage} className="bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-1.5 transition flex items-center disabled:opacity-50" disabled={isProcessing}>
              {isProcessing ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button onClick={() => runMission('منصة سفر')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-full border border-slate-700 transition"><Plane size={12}/> سفر</button>
            <button onClick={() => runMission('متجر بيتزا')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-full border border-slate-700 transition"><Coffee size={12}/> بيتزا</button>
            <button onClick={() => runMission('منصة حجوزات')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-full border border-slate-700 transition"><Hotel size={12}/> حجوزات</button>
            <button onClick={() => runMission('SaaS')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-full border border-slate-700 transition"><BarChart size={12}/> SaaS</button>
          </div>
          {renderThinking()}
        </div>

        {/* Live Preview */}
        <div className="col-span-8 row-span-3 border border-slate-800 bg-slate-900 rounded-xl overflow-hidden shadow-inner flex flex-col">
          <div className="flex items-center justify-between px-3 py-1 bg-slate-800/50 border-b border-slate-700">
            <span className="text-xs text-slate-400">{previewUrl}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                آخر تحديث: {new Date(previewTimestamp).toLocaleTimeString()}
                {previewLoading && <Loader size={12} className="inline animate-spin ml-1" />}
              </span>
              <button onClick={reloadPreview} className="text-xs text-cyan-400 hover:text-cyan-300 transition px-2 py-0.5 bg-slate-800 rounded">
                تحديث
              </button>
            </div>
          </div>
          {previewError ? (
            <div className="flex-1 flex items-center justify-center bg-slate-900 text-slate-400">
              <div className="text-center">
                <Globe size={48} className="mx-auto text-slate-600" />
                <p className="mt-4 text-sm">⚠️ خادم المعاينة غير متاح</p>
                <p className="text-xs text-slate-500 mt-1">تأكد من تشغيل مشروع Next.js على {previewUrl}</p>
                <button onClick={reloadPreview} className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition">
                  إعادة المحاولة
                </button>
              </div>
            </div>
          ) : (
            <iframe key={previewTimestamp} src={previewUrl} className="w-full flex-1" title="Live Preview" />
          )}
        </div>

        {/* Agent Stream */}
        <div className="col-span-3 row-span-2 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Terminal size={16}/> AGENT STREAM</h2>
          <div className="text-xs space-y-0.5">
            {agentStream.length === 0 && <span className="text-slate-500">بانتظار الأحداث...</span>}
            {renderStream()}
          </div>
        </div>

        {/* What Changed */}
        <div className="col-span-4 row-span-2 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><GitBranch size={16}/> WHAT CHANGED</h2>
          <div className="text-xs space-y-1">
            {projectState.changes.length === 0 ? <span className="text-slate-500">لا تغييرات</span> : renderChanges()}
          </div>
        </div>

        {/* Digital Twin */}
        <div className="col-span-5 row-span-2 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><ShieldCheck size={16}/> DIGITAL TWIN</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-500">المهام</div>
              <div className="text-xs space-y-0.5">{renderTasks()}</div>
              <div className="text-xs text-slate-500 mt-2">المخاطر</div>
              <div className="text-xs text-yellow-400">
                {projectState.risks.length === 0 ? 'لا مخاطر' : projectState.risks.join(', ')}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">هيكل المشروع</div>
              <div className="text-xs max-h-24 overflow-y-auto">
                {Object.entries(projectState.structure).map(([name, node]) => renderTree(node, name))}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                📄 الصفحات: {projectState.pages} | 🧩 المكونات: {projectState.components} | 📡 APIs: {projectState.apis} | 🗄 الجداول: {projectState.tables}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
