import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Zap, Clock, ShieldCheck, Cpu, 
  LayoutDashboard, Terminal, ChevronRight, 
  CheckCircle, Loader, AlertCircle, 
  Coffee, Plane, Hotel, BarChart 
} from 'lucide-react';

// الأيقونات المساعدة للوكلاء
const agentIcons = {
  Planner: '🧠',
  Architect: '🏗',
  Coder: '💻',
  QA: '🔍',
  Deploy: '🚀'
};

export default function App() {
  // ---------- الحالات العامة ----------
  const [mission, setMission] = useState('Pizza Store');
  const [progress, setProgress] = useState(64);
  const [remainingTime, setRemainingTime] = useState('14 دقيقة');
  const [risks, setRisks] = useState('Stripe غير مربوط');
  const [tasksLeft, setTasksLeft] = useState(3);

  // ---------- وكلاء ----------
  const [agents, setAgents] = useState([
    { name: 'Planner', status: 'idle' },
    { name: 'Architect', status: 'idle' },
    { name: 'Coder', status: 'idle' },
    { name: 'QA', status: 'idle' }
  ]);

  // ---------- المحادثة (AI Chat) ----------
  const [chatMessages, setChatMessages] = useState([
    { agent: 'Planner', text: 'بدأ تحليل متطلبات متجر البيتزا...', icon: '🧠' },
    { agent: 'Architect', text: 'تم تصميم قاعدة البيانات مبدئياً.', icon: '🏗' }
  ]);
  const chatEndRef = useRef(null);

  // ---------- Timeline ----------
  const [timelineSteps, setTimelineSteps] = useState([
    { label: 'تحليل الطلب', done: true },
    { label: 'إنشاء الخطة', done: true },
    { label: 'إنشاء المشروع', done: false, active: true },
    { label: 'إنشاء المنتجات', done: false },
    { label: 'إنشاء السلة', done: false },
    { label: 'إنشاء الدفع', done: false }
  ]);

  // ---------- What Changed ----------
  const [changes, setChanges] = useState([
    { type: 'add', text: 'Product Card' },
    { type: 'add', text: 'Shopping Cart' },
    { type: 'add', text: 'Checkout Page' },
    { type: 'remove', text: 'Old Header' }
  ]);

  // ---------- Digital Twin ----------
  const [digitalTwin] = useState({
    framework: 'Next.js 15',
    database: 'PostgreSQL',
    pages: 17,
    components: 52,
    apis: 8,
    health: 96
  });

  // ---------- معاينة حية ----------
  const [previewUrl, setPreviewUrl] = useState('http://localhost:3000');

  // ---------- تنفيذ المهمة (محاكاة) ----------
  const runMission = (missionName) => {
    // إعادة تعيين الحالة
    setMission(missionName);
    setProgress(0);
    setTasksLeft(6);
    setRisks('جاري التهيئة...');
    setRemainingTime('جاري الحساب...');

    // إعادة تعيين التايملاين
    setTimelineSteps([
      { label: 'تحليل الطلب', done: false, active: false },
      { label: 'إنشاء الخطة', done: false, active: false },
      { label: 'إنشاء المشروع', done: false, active: false },
      { label: 'إنشاء المنتجات', done: false, active: false },
      { label: 'إنشاء السلة', done: false, active: false },
      { label: 'إنشاء الدفع', done: false, active: false }
    ]);

    // إعادة تعيين التغييرات
    setChanges([]);

    // إعادة تعيين المحادثة
    setChatMessages([
      { agent: 'System', text: `🚀 بدء تنفيذ مهمة: ${missionName}`, icon: '⚡' }
    ]);

    // إعادة تعيين الوكلاء
    setAgents(agents.map(a => ({ ...a, status: 'idle' })));

    // محاكاة خطوات التنفيذ
    let stepIndex = 0;
    const stepLabels = [
      'تحليل الطلب',
      'إنشاء الخطة',
      'إنشاء المشروع',
      'إنشاء المنتجات',
      'إنشاء السلة',
      'إنشاء الدفع'
    ];
    const agentSequence = ['Planner', 'Architect', 'Coder', 'Coder', 'Coder', 'QA'];
    const chatIcons = ['🧠', '🏗', '💻', '💻', '💻', '🔍'];

    const interval = setInterval(() => {
      if (stepIndex >= stepLabels.length) {
        clearInterval(interval);
        // انتهى
        setProgress(100);
        setTasksLeft(0);
        setRemainingTime('0 دقيقة');
        setRisks('لا يوجد');
        setAgents(agents.map(a => ({ ...a, status: 'done' })));
        setChatMessages(prev => [...prev, { agent: 'System', text: '✅ اكتملت المهمة بنجاح!', icon: '🎉' }]);
        return;
      }

      const label = stepLabels[stepIndex];
      const agentName = agentSequence[stepIndex];
      const icon = chatIcons[stepIndex];

      // تحديث التايملاين
      setTimelineSteps(prev => {
        const newSteps = [...prev];
        newSteps[stepIndex].done = true;
        newSteps[stepIndex].active = false;
        if (stepIndex + 1 < newSteps.length) {
          newSteps[stepIndex + 1].active = true;
        }
        return newSteps;
      });

      // تحديث الوكلاء
      setAgents(prev => prev.map(a => 
        a.name === agentName ? { ...a, status: 'working' } : a
      ));

      // إضافة رسالة محادثة
      const messages = {
        'Planner': '🧠 Planner: تم تحليل المتطلبات وإنشاء خطة عمل.',
        'Architect': '🏗 Architect: تم تصميم البنية واختيار التقنيات.',
        'Coder': '💻 Coder: جاري كتابة كود الوحدات...',
        'QA': '🔍 QA: جاري اختبار الوظائف الأساسية...'
      };
      const defaultMsg = `${icon} ${agentName}: تم إنجاز "${label}".`;
      const msgText = messages[agentName] || defaultMsg;

      setChatMessages(prev => [...prev, { agent: agentName, text: msgText, icon }]);

      // إضافة تغيير
      const changeText = `+ ${label}`;
      setChanges(prev => [...prev, { type: 'add', text: changeText }]);

      // تحديث التقدم والمتبقي
      const newProgress = Math.round(((stepIndex + 1) / stepLabels.length) * 100);
      setProgress(newProgress);
      setTasksLeft(stepLabels.length - stepIndex - 1);
      setRemainingTime(`${Math.floor((stepLabels.length - stepIndex - 1) * 2)} دقيقة`);
      if (stepIndex === 0) setRisks('قاعدة البيانات غير مهيأة');
      else if (stepIndex === 2) setRisks('Stripe غير مربوط');
      else if (stepIndex === 4) setRisks('اختبارات الدفع');
      else setRisks('لا مخاطر');

      stepIndex++;
    }, 1500); // كل 1.5 ثانية خطوة
  };

  // التمرير التلقائي لأسفل المحادثة
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ---------- عرض الواجهة ----------
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <div className="grid grid-cols-12 grid-rows-6 gap-2 w-full h-full p-2">

        {/* ----- CEO Brief (السطر الأول) ----- */}
        <div className="col-span-12 row-span-1 border border-slate-800 bg-slate-900/50 rounded-xl p-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">JAOLA OS</h1>
            <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-400">v2.0</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <div className="flex flex-col"><span className="text-xs text-slate-600">المشروع</span><span className="font-semibold text-white">{mission}</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">التقدم</span><span className="font-semibold text-emerald-400">{progress}%</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">المتبقي</span><span className="font-semibold">{tasksLeft} مهام</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">المخاطر</span><span className="font-semibold text-yellow-400">{risks}</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">الوقت المتوقع</span><span className="font-semibold">{remainingTime}</span></div>
          </div>
        </div>

        {/* ----- AI Chat + Live Preview (السطران 2 و 3) ----- */}
        <div className="col-span-4 row-span-3 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-hidden flex flex-col">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Bot size={16}/> AI CHAT</h2>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm pr-1">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`p-1.5 rounded border-l-2 ${msg.agent === 'System' ? 'border-purple-500 bg-slate-800/50' : 'border-cyan-500 bg-slate-800'} text-xs`}>
                <span className="font-mono">{msg.icon || '💬'} {msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {/* أزرار التنفيذ السريع أسفل الشات */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => runMission('منصة سفر')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition"><Plane size={14}/> منصة سفر</button>
            <button onClick={() => runMission('متجر بيتزا')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition"><Coffee size={14}/> متجر بيتزا</button>
            <button onClick={() => runMission('منصة حجوزات')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition"><Hotel size={14}/> منصة حجوزات</button>
            <button onClick={() => runMission('SaaS')} className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 transition"><BarChart size={14}/> SaaS</button>
          </div>
        </div>

        <div className="col-span-8 row-span-3 border border-slate-800 bg-white rounded-xl overflow-hidden shadow-inner flex flex-col">
          <div className="h-6 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-1 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-red-400"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-xs text-slate-500 ml-2">{previewUrl}</span>
          </div>
          <iframe src={previewUrl} className="w-full flex-1" title="Live Preview" />
        </div>

        {/* ----- Timeline (السطر الرابع، العمود 1-4) ----- */}
        <div className="col-span-4 row-span-2 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Clock size={16}/> TIMELINE</h2>
          <div className="text-xs space-y-1.5">
            {timelineSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle size={14} className="text-emerald-400" />
                ) : step.active ? (
                  <Loader size={14} className="text-white animate-spin" />
                ) : (
                  <Clock size={14} className="text-slate-600" />
                )}
                <span className={step.done ? 'text-emerald-400' : step.active ? 'text-white' : 'text-slate-500'}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ----- What Changed (السطر الرابع، العمود 5-8) ----- */}
        <div className="col-span-4 row-span-2 border border-slate-800 bg-slate-900 rounded-xl p-3 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Zap size={16}/> WHAT CHANGED</h2>
          <div className="text-xs space-y-1">
            {changes.length === 0 && <span className="text-slate-500">لا تغييرات حتى الآن</span>}
            {changes.map((ch, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {ch.type === 'add' ? <span className="text-emerald-400">+</span> : <span className="text-red-400">-</span>}
                <span className={ch.type === 'add' ? 'text-slate-200' : 'text-slate-400 line-through'}>{ch.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ----- Agents + Digital Twin (السطر الخامس) ----- */}
        <div className="col-span-4 row-span-1 border border-slate-800 bg-slate-900 rounded-xl p-3 flex flex-col">
          <h2 className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-2"><Cpu size={16}/> AGENTS</h2>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {agents.map(a => (
              <div key={a.name} className={`flex items-center justify-between p-1.5 rounded border ${a.status === 'working' ? 'border-emerald-900 bg-emerald-950/50' : a.status === 'done' ? 'border-green-700 bg-green-950/30' : 'border-slate-800'}`}>
                <span>{agentIcons[a.name] || '🤖'} {a.name}</span>
                <span>
                  {a.status === 'idle' && '⏳'}
                  {a.status === 'working' && '⚙️'}
                  {a.status === 'done' && '✅'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-8 row-span-1 border border-slate-800 bg-slate-900 rounded-xl p-3 flex flex-col">
          <h2 className="text-sm font-bold text-slate-500 mb-1 flex items-center gap-2"><ShieldCheck size={16}/> DIGITAL TWIN</h2>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div><span className="text-slate-500">Framework</span><br/><span className="text-white">{digitalTwin.framework}</span></div>
            <div><span className="text-slate-500">Database</span><br/><span className="text-white">{digitalTwin.database}</span></div>
            <div><span className="text-slate-500">Pages</span><br/><span className="text-white">{digitalTwin.pages}</span></div>
            <div><span className="text-slate-500">Components</span><br/><span className="text-white">{digitalTwin.components}</span></div>
            <div><span className="text-slate-500">APIs</span><br/><span className="text-white">{digitalTwin.apis}</span></div>
            <div className="col-span-2"><span className="text-slate-500">Health</span><br/><span className="text-emerald-400">{digitalTwin.health}%</span></div>
          </div>
        </div>

      </div>
    </div>
  );
}
