import { create } from 'zustand';

// 🌍 نظام تعدد اللغات — الإنجليزية افتراضياً (SaaS) مع مبدّل لغات حي
// اللغة تُحفظ في localStorage وتُطبّق على اتجاه الصفحة (rtl/ltr) فوراً.

export const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧', dir: 'ltr' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦', dir: 'rtl' },
  { code: 'es', label: 'Español',    flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷', dir: 'ltr' },
  { code: 'pt', label: 'Português',  flag: '🇵🇹', dir: 'ltr' },
  { code: 'ur', label: 'اردو',       flag: '🇵🇰', dir: 'rtl' },
];

// نصوص الواجهة — المفتاح ثابت، القيمة حسب اللغة (تسقط للإنجليزية عند غياب الترجمة)
const STRINGS = {
  // shell / nav
  project: { en: 'PROJECT', ar: 'المشروع', es: 'PROYECTO', fr: 'PROJET', de: 'PROJEKT', tr: 'PROJE', pt: 'PROJETO', ur: 'پروجیکٹ' },
  newProject: { en: '+ New', ar: '+ جديد', es: '+ Nuevo', fr: '+ Nouveau', de: '+ Neu', tr: '+ Yeni', pt: '+ Novo', ur: '+ نیا' },
  operational: { en: 'All Systems Operational', ar: 'كل الأنظمة تعمل', es: 'Todos los sistemas operativos', fr: 'Tous systèmes opérationnels', de: 'Alle Systeme betriebsbereit', tr: 'Tüm sistemler çalışıyor', pt: 'Todos os sistemas operacionais', ur: 'تمام سسٹمز فعال' },
  reconnecting: { en: 'Reconnecting...', ar: 'جاري إعادة الاتصال...', es: 'Reconectando...', fr: 'Reconnexion...', de: 'Wiederverbindung...', tr: 'Yeniden bağlanılıyor...', pt: 'Reconectando...', ur: 'دوبارہ منسلک ہو رہا ہے...' },
  missionRunning: { en: 'Mission Running...', ar: 'المهمة جارية...', es: 'Misión en curso...', fr: 'Mission en cours...', de: 'Mission läuft...', tr: 'Görev çalışıyor...', pt: 'Missão em andamento...', ur: 'مشن جاری ہے...' },
  deploy: { en: 'Deploy', ar: 'نشر', es: 'Desplegar', fr: 'Déployer', de: 'Bereitstellen', tr: 'Yayınla', pt: 'Implantar', ur: 'تعیناتی' },
  redeploy: { en: 'Re-deploy', ar: 'إعادة النشر', es: 'Redesplegar', fr: 'Redéployer', de: 'Neu bereitstellen', tr: 'Yeniden yayınla', pt: 'Reimplantar', ur: 'دوبارہ تعیناتی' },
  deploying: { en: 'Deploying...', ar: 'جاري النشر...', es: 'Desplegando...', fr: 'Déploiement...', de: 'Bereitstellung...', tr: 'Yayınlanıyor...', pt: 'Implantando...', ur: 'تعینات جاری...' },
  liveSite: { en: 'Live Site', ar: 'الموقع المباشر', es: 'Sitio en vivo', fr: 'Site en direct', de: 'Live-Site', tr: 'Canlı Site', pt: 'Site ao vivo', ur: 'لائیو سائٹ' },
  vercelCheck: { en: 'Deploy check (Vercel)', ar: 'فحص النشر (Vercel)', es: 'Verificar despliegue', fr: 'Vérifier le déploiement', de: 'Deploy prüfen', tr: 'Dağıtım kontrolü', pt: 'Verificar deploy', ur: 'تعیناتی جانچ' },
  vercelChecking: { en: 'Checking Vercel setup...', ar: 'جاري فحص إعداد Vercel...', es: 'Verificando Vercel...', fr: 'Vérification de Vercel...', de: 'Vercel wird geprüft...', tr: 'Vercel kontrol ediliyor...', pt: 'Verificando Vercel...', ur: 'ورسل جانچ جاری...' },
  exit: { en: 'Exit', ar: 'خروج', es: 'Salir', fr: 'Quitter', de: 'Beenden', tr: 'Çıkış', pt: 'Sair', ur: 'باہر' },

  // tabs
  preview: { en: 'Preview', ar: 'معاينة', es: 'Vista previa', fr: 'Aperçu', de: 'Vorschau', tr: 'Önizleme', pt: 'Pré-visualização', ur: 'پیش نظارہ' },
  code: { en: 'Code', ar: 'الكود', es: 'Código', fr: 'Code', de: 'Code', tr: 'Kod', pt: 'Código', ur: 'کوڈ' },
  logs: { en: 'Logs', ar: 'السجل', es: 'Registros', fr: 'Journaux', de: 'Protokolle', tr: 'Günlükler', pt: 'Registros', ur: 'لاگز' },
  timeline: { en: 'Timeline', ar: 'الخط الزمني', es: 'Cronología', fr: 'Chronologie', de: 'Zeitleiste', tr: 'Zaman çizelgesi', pt: 'Linha do tempo', ur: 'ٹائم لائن' },

  // mission input
  missionControl: { en: 'Mission Control', ar: 'مركز القيادة', es: 'Control de Misión', fr: 'Contrôle de Mission', de: 'Missionskontrolle', tr: 'Görev Kontrolü', pt: 'Controle de Missão', ur: 'مشن کنٹرول' },
  promptPlaceholder: { en: 'What do you want your AI company to build today?', ar: 'ماذا تريد أن تبني شركة الذكاء اليوم؟', es: '¿Qué quieres que construya tu empresa de IA hoy?', fr: "Que voulez-vous construire aujourd'hui ?", de: 'Was soll Ihre KI-Firma heute bauen?', tr: 'AI şirketiniz bugün ne inşa etsin?', pt: 'O que sua empresa de IA vai construir hoje?', ur: 'آج آپ کی AI کمپنی کیا بنائے؟' },
  execute: { en: 'Execute Mission', ar: 'نفّذ المهمة', es: 'Ejecutar Misión', fr: 'Exécuter la Mission', de: 'Mission ausführen', tr: 'Görevi Yürüt', pt: 'Executar Missão', ur: 'مشن چلائیں' },
  sending: { en: 'Sending...', ar: 'جاري الإرسال...', es: 'Enviando...', fr: 'Envoi...', de: 'Senden...', tr: 'Gönderiliyor...', pt: 'Enviando...', ur: 'بھیجا جا رہا ہے...' },
  stop: { en: 'Stop', ar: 'إيقاف', es: 'Detener', fr: 'Arrêter', de: 'Stopp', tr: 'Durdur', pt: 'Parar', ur: 'روکیں' },
  quickLaunch: { en: 'Quick Launch', ar: 'إطلاق سريع', es: 'Lanzamiento rápido', fr: 'Lancement rapide', de: 'Schnellstart', tr: 'Hızlı Başlat', pt: 'Início rápido', ur: 'فوری آغاز' },

  // quick actions
  qaColors: { en: 'Change colors', ar: 'غيّر الألوان', es: 'Cambiar colores', fr: 'Changer les couleurs', de: 'Farben ändern', tr: 'Renkleri değiştir', pt: 'Mudar cores', ur: 'رنگ تبدیل کریں' },
  qaSection: { en: 'Add a section', ar: 'أضف قسماً', es: 'Añadir sección', fr: 'Ajouter une section', de: 'Abschnitt hinzufügen', tr: 'Bölüm ekle', pt: 'Adicionar seção', ur: 'سیکشن شامل کریں' },
  qaFaster: { en: 'Make it faster', ar: 'اجعله أسرع', es: 'Hazlo más rápido', fr: 'Rendre plus rapide', de: 'Schneller machen', tr: 'Daha hızlı yap', pt: 'Torná-lo mais rápido', ur: 'تیز بنائیں' },
  qaDeploy: { en: 'Deploy now', ar: 'انشر الآن', es: 'Desplegar ahora', fr: 'Déployer maintenant', de: 'Jetzt bereitstellen', tr: 'Şimdi yayınla', pt: 'Implantar agora', ur: 'ابھی تعینات' },

  // intelligence panel
  intelligence: { en: 'Intelligence', ar: 'الذكاء', es: 'Inteligencia', fr: 'Intelligence', de: 'Intelligenz', tr: 'Zeka', pt: 'Inteligência', ur: 'انٹیلیجنس' },
  builds: { en: 'Builds', ar: 'عمليات البناء', es: 'Construcciones', fr: 'Constructions', de: 'Builds', tr: 'Yapılar', pt: 'Construções', ur: 'بلڈز' },
  edits: { en: 'Edits', ar: 'التعديلات', es: 'Ediciones', fr: 'Modifications', de: 'Änderungen', tr: 'Düzenlemeler', pt: 'Edições', ur: 'ترامیم' },
  files: { en: 'Files', ar: 'الملفات', es: 'Archivos', fr: 'Fichiers', de: 'Dateien', tr: 'Dosyalar', pt: 'Arquivos', ur: 'فائلیں' },
  workspace: { en: 'Workspace', ar: 'مساحة العمل', es: 'Espacio de trabajo', fr: 'Espace de travail', de: 'Arbeitsbereich', tr: 'Çalışma alanı', pt: 'Área de trabalho', ur: 'ورک اسپیس' },

  // mobile tabs
  mMission: { en: 'Mission', ar: 'المهمة', es: 'Misión', fr: 'Mission', de: 'Mission', tr: 'Görev', pt: 'Missão', ur: 'مشن' },

  // login
  login: { en: 'Login', ar: 'دخول', es: 'Entrar', fr: 'Connexion', de: 'Anmelden', tr: 'Giriş', pt: 'Entrar', ur: 'لاگ ان' },
  register: { en: 'Sign up', ar: 'حساب جديد', es: 'Registrarse', fr: "S'inscrire", de: 'Registrieren', tr: 'Kayıt ol', pt: 'Cadastrar', ur: 'رجسٹر' },
  username: { en: 'Username', ar: 'اسم المستخدم', es: 'Usuario', fr: "Nom d'utilisateur", de: 'Benutzername', tr: 'Kullanıcı adı', pt: 'Usuário', ur: 'صارف نام' },
  password: { en: 'Password', ar: 'كلمة المرور', es: 'Contraseña', fr: 'Mot de passe', de: 'Passwort', tr: 'Şifre', pt: 'Senha', ur: 'پاس ورڈ' },
  enterMission: { en: 'Enter Mission Control', ar: 'دخول مركز القيادة', es: 'Entrar al Control', fr: 'Entrer au Contrôle', de: 'Zur Missionskontrolle', tr: 'Görev Kontrolüne Gir', pt: 'Entrar no Controle', ur: 'مشن کنٹرول میں داخل' },

  // notifications (en + ar، والباقي يسقط للإنجليزية)
  nBuildDone: { en: '✅ Build completed successfully!', ar: '✅ اكتمل البناء بنجاح!' },
  nDeploying: { en: '🚀 Deploying to Vercel...', ar: '🚀 جاري النشر على Vercel...' },
  nDeployed: { en: '✅ Deployed successfully!', ar: '✅ تم النشر بنجاح!' },
  nGithubLinked: { en: '🐙 GitHub linked successfully', ar: '🐙 تم ربط GitHub بنجاح' },
  nStopping: { en: '⏹️ Stopping the mission...', ar: '⏹️ جاري إيقاف المهمة...' },
  nNoMission: { en: 'No active mission', ar: 'لا توجد مهمة نشطة' },
  nRestored: { en: '⏪ Project restored to', ar: '⏪ استُرجع المشروع إلى' },
  nProjectCreated: { en: '✅ Project created', ar: '✅ تم إنشاء المشروع' },
  nSaved: { en: '💾 Saved', ar: '💾 تم الحفظ' },

  // empty states / hints / placeholders / titles
  feedHint: { en: "I'll show every step here as it happens — live.", ar: 'سأعرض لك هنا كل خطوة أثناء التنفيذ — لحظة بلحظة' },
  feedAsk: { en: 'What do you want to build today?', ar: 'ماذا تريد أن نبني اليوم؟' },
  receiving: { en: 'JAOLA is receiving the mission...', ar: 'JAOLA يستلم المهمة...' },
  mobilePrompt: { en: 'What should we build?', ar: 'ماذا تريد أن نبني؟' },
  stopTitle: { en: 'Stop', ar: 'إيقاف' },
  stopMission: { en: 'Stop the running mission', ar: 'إيقاف المهمة الجارية' },
  githubTitle: { en: 'Link project to GitHub', ar: 'ربط المشروع بـ GitHub' },
  adminTitle: { en: 'Admin panel', ar: 'لوحة التحكم (للمشرفين)' },
  newProjectTitle: { en: 'New Project', ar: 'مشروع جديد' },
  projectNameHint: { en: 'Project name in English (no spaces)', ar: 'اسم المشروع بالإنجليزية (بدون مسافات)' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  create: { en: 'Create', ar: 'إنشاء' },
  creating: { en: 'Creating...', ar: 'جاري الإنشاء...' },
  registering: { en: 'Creating account...', ar: 'جاري إنشاء الحساب...' },
  signingIn: { en: 'Signing in...', ar: 'جاري الدخول...' },
  save: { en: 'Save', ar: 'حفظ' },
  buildComplete: { en: 'Build Complete', ar: 'اكتمل البناء' },
  selectFile: { en: 'Select a file from the list', ar: 'اختر ملفاً من قائمة الملفات' },
  orAskJaola: { en: 'or ask JAOLA to generate code', ar: 'أو اطلب من JAOLA توليد الكود' },
  savingFile: { en: 'Saving...', ar: 'جاري الحفظ...' },
  unsavedChanges: { en: 'Unsaved changes (Ctrl+S)', ar: 'تغييرات غير محفوظة (Ctrl+S)' },

  // GitHub modal
  ghIntegration: { en: 'GitHub Integration', ar: 'تكامل GitHub' },
  ghConnected: { en: '● Connected', ar: '● مرتبط حالياً' },
  ghRepoUrl: { en: 'REPOSITORY URL', ar: 'رابط المستودع' },
  ghToken: { en: 'PERSONAL ACCESS TOKEN', ar: 'التوكن الشخصي (PAT)' },
  ghTokenSaved: { en: '(saved encrypted — leave empty to keep it)', ar: '(محفوظ مشفراً — اتركه فارغاً للإبقاء عليه)' },
  ghBranch: { en: 'BRANCH', ar: 'الفرع' },
  ghAutoPush: { en: 'Auto-push after build', ar: 'دفع تلقائي بعد البناء' },
  ghLastPush: { en: 'Last push:', ar: 'آخر دفع:' },
  ghPushNow: { en: '⬆ Push Now', ar: '⬆ ادفع الآن' },
  ghSaveConnect: { en: 'Save & Connect', ar: 'حفظ وربط' },
  ghSaving: { en: 'Saving...', ar: 'جاري الحفظ...' },

  // Timeline panel
  loadingTimeline: { en: 'Loading timeline...', ar: 'جاري تحميل الخط الزمني...' },
  timelineLoadFail: { en: 'Failed to load timeline', ar: 'فشل جلب الخط الزمني' },
  serverUnreachable: { en: 'Could not reach the server', ar: 'تعذر الاتصال بالخادم' },
  restoreFail: { en: 'Restore failed', ar: 'فشل الاسترجاع' },
  restoreConfirm: { en: 'Restore the project to this point?\nThe current state will be saved automatically first — you can return to it later.', ar: 'استرجاع المشروع إلى هذه النقطة؟\nسيُحفظ الوضع الحالي تلقائياً قبل الاسترجاع — يمكنك العودة إليه لاحقاً.' },
  buildsLog: { en: 'Builds log', ar: 'سجل البنايات' },
  noBuildsYet: { en: 'No builds recorded yet.', ar: 'لا بنايات مسجلة بعد.' },
  buildLabel: { en: 'Build', ar: 'بناء' },
  restorePoints: { en: 'Restore points', ar: 'نقاط الاسترجاع' },
  noRestorePoints: { en: 'No save points yet — created automatically with each build.', ar: 'لا نقاط حفظ بعد — تُنشأ تلقائياً مع كل بناء.' },
  currentPoint: { en: '● Current', ar: '● الحالي' },
  restoring: { en: 'Restoring...', ar: 'جاري الاسترجاع...' },
  restore: { en: '⏪ Restore', ar: '⏪ استرجاع' },
  unitMin: { en: 'm', ar: 'د' },
  unitSec: { en: 's', ar: 'ث' },
  // Site health (mobile ⋯ card)
  siteHealth: { en: 'Site health', ar: 'حالة الموقع', es: 'Estado del sitio', fr: 'État du site', de: 'Website-Status', tr: 'Site durumu', pt: 'Estado do site', ur: 'سائٹ کی حالت' },
  mBuilds: { en: 'Builds', ar: 'عمليات البناء', es: 'Compilaciones', fr: 'Constructions', de: 'Builds', tr: 'Yapılar', pt: 'Builds', ur: 'بلڈز' },
  mEdits: { en: 'Edits', ar: 'التعديلات', es: 'Ediciones', fr: 'Modifications', de: 'Änderungen', tr: 'Düzenlemeler', pt: 'Edições', ur: 'ترامیم' },
  noMetricsYet: { en: 'Build your site to see its scores.', ar: 'ابنِ موقعك لتظهر درجاته.', es: 'Crea tu sitio para ver sus puntuaciones.', fr: 'Créez votre site pour voir ses scores.', de: 'Erstellen Sie Ihre Website, um die Werte zu sehen.', tr: 'Puanları görmek için sitenizi oluşturun.', pt: 'Crie seu site para ver as pontuações.', ur: 'اسکور دیکھنے کے لیے اپنی سائٹ بنائیں۔' },

  // Mission progress
  phasePlanner: { en: 'Planning', ar: 'التخطيط' },
  phaseArchitect: { en: 'Architecting', ar: 'الهندسة' },
  phaseCoder: { en: 'Coding', ar: 'البرمجة' },
  phaseQa: { en: 'Testing', ar: 'الفحص' },
  phaseDeploy: { en: 'Deploying', ar: 'النشر' },
  inProgress: { en: 'In progress', ar: 'جاري' },
  preparingMission: { en: '⚡ Preparing mission...', ar: '⚡ جاري تجهيز المهمة...' },
  // مراحل آلة الحالات الحقيقية — من أحداث project_state الموحدة
  mstate_planning: { en: 'Planning the mission', ar: 'تخطيط المهمة' },
  mstate_architecture: { en: 'Designing the architecture', ar: 'تصميم المعمارية' },
  mstate_generating: { en: 'Writing the code', ar: 'كتابة الشفرة' },
  mstate_reviewing: { en: 'Reviewing quality', ar: 'مراجعة الجودة' },
  mstate_verifying: { en: 'Verifying requirements', ar: 'التحقق من المتطلبات' },
  mstate_deploying: { en: 'Deploying', ar: 'النشر' },
  mstate_completed: { en: 'Mission completed', ar: 'اكتملت المهمة' },
  mstate_failed: { en: 'Mission failed', ar: 'فشلت المهمة' },
  mstate_paused: { en: 'Mission paused', ar: 'المهمة متوقفة' },

  // Preview panel
  desktopView: { en: 'Desktop view', ar: 'عرض سطح المكتب' },
  mobileView: { en: 'Mobile view', ar: 'عرض الجوال' },
  refreshPreview: { en: 'Refresh preview', ar: 'تحديث المعاينة' },
  openNewTab: { en: 'Open in new tab', ar: 'فتح في تبويب جديد' },
  jaolaWriting: { en: '💻 JAOLA is writing code live...', ar: '💻 JAOLA يكتب الكود الآن مباشرة...' },
  charCount: { en: 'chars', ar: 'حرف' },

  // File tabs
  unsavedTooltip: { en: 'Unsaved changes', ar: 'تغييرات غير محفوظة' },
  closeTooltip: { en: 'Close', ar: 'إغلاق' },

  // Admin panel
  admGenericError: { en: 'Error', ar: 'خطأ' },
  admAccessDenied: { en: 'Access denied', ar: 'وصول مرفوض' },
  admNotAdmin: { en: 'Your account is not an admin. To enable access, add your username to the environment variable', ar: 'حسابك ليس مشرفاً. لتفعيل الوصول، أضف اسم مستخدمك في متغير البيئة' },
  admThenRestart: { en: 'on the server, then restart.', ar: 'على السيرفر ثم أعد التشغيل.' },
  admTabHealth: { en: 'System Health', ar: 'صحة النظام' },
  admTabAgents: { en: 'Agents & Plugins', ar: 'الوكلاء والإضافات' },
  admTabFiles: { en: 'File Manager', ar: 'إدارة الملفات' },
  admBack: { en: '← Back to dashboard', ar: '← الرجوع للوحة' },
  admScanning: { en: 'Scanning system...', ar: 'جاري فحص النظام...' },
  admHealthTitle: { en: '🩺 System Health', ar: '🩺 صحة النظام' },
  admRefresh: { en: '⟳ Refresh', ar: '⟳ تحديث' },
  admUptime: { en: 'minutes', ar: 'دقيقة' },
  admAgentsTitle: { en: '🤖 Agents & Plugins', ar: '🤖 الوكلاء والإضافات' },
  admNameInstrRequired: { en: 'Name and instructions are required.', ar: 'الاسم والتعليمات مطلوبان.' },
  admCreateNewAgent: { en: '✨ Create a new agent', ar: '✨ صنع وكيل جديد' },
  admCreateHint: { en: 'Give the agent a name and instructions — it becomes active instantly, no coding.', ar: 'أعطِ الوكيل اسماً وتعليماته — سيصبح عاملاً فوراً بلا برمجة.' },
  admAgentName: { en: 'Agent name (English)', ar: 'اسم الوكيل (إنجليزي)' },
  admDescOptional: { en: 'Description (optional)', ar: 'الوصف (اختياري)' },
  admDescPlaceholder: { en: 'Writes catchy marketing copy', ar: 'يكتب نصوصاً تسويقية جذابة' },
  admInstructions: { en: 'Instructions (the agent\'s persona and task)', ar: 'التعليمات (شخصية الوكيل ومهمته)' },
  admInstrPlaceholder: { en: 'You are a marketing expert. Write short, persuasive ad copy in a confident, energetic tone...', ar: 'أنت خبير تسويق. اكتب نصوصاً إعلانية قصيرة ومقنعة بالعربية الفصحى، بنبرة حماسية...' },
  admWhenRuns: { en: 'When does this agent run?', ar: 'متى يعمل هذا الوكيل؟' },
  admOnDemand: { en: 'On demand', ar: 'عند الطلب' },
  admOnDemandDesc: { en: 'Run manually and test from the panel', ar: 'تشغيل يدوي وتجربة من اللوحة' },
  admEveryBuild: { en: 'Every build', ar: 'في كل بناء' },
  admEveryBuildDesc: { en: 'Automatically guides every project built', ar: 'يشارك تلقائياً بتوجيه كل مشروع يُبنى' },
  admCreateActivate: { en: '✨ Create & activate', ar: '✨ إنشاء وتفعيل' },
  admAgentCreated: { en: 'Agent created and activated', ar: 'أُنشئ الوكيل وفُعّل فوراً' },
  admWillJoinBuilds: { en: ' — it will join every build.', ar: ' — سيشارك في كل بناء.' },
  admTestAgent: { en: '🧪 Test an agent', ar: '🧪 تجربة وكيل' },
  admTestPlaceholder: { en: 'Type an input to test the agent...', ar: 'اكتب مدخلاً لتجربة الوكيل...' },
  admRunning: { en: 'Running...', ar: 'جاري التشغيل...' },
  admInstalledPlugins: { en: 'Installed plugins', ar: 'الإضافات المثبّتة' },
  admNoPlugins: { en: 'No plugins yet — create your first agent above.', ar: 'لا إضافات بعد — أنشئ أول وكيل بالأعلى.' },
  admEnabled: { en: '● Enabled', ar: '● مفعّل' },
  admDisabled: { en: '○ Disabled', ar: '○ معطّل' },
  admLoadErrors: { en: '⚠️ Load errors', ar: '⚠️ أخطاء تحميل' },
  admConfirmDeletePlugin: { en: 'Delete the plugin permanently?', ar: 'حذف الإضافة نهائياً؟' },
  admFilesTitle: { en: '🗂️ File Manager', ar: '🗂️ إدارة الملفات' },
  admNoProjects: { en: 'No projects yet.', ar: 'لا مشاريع بعد.' },
  admBackProjects: { en: '← Projects', ar: '← المشاريع' },
  admSave: { en: '💾 Save', ar: '💾 حفظ' },
  admSaved: { en: '💾 Saved', ar: '💾 حُفظ' },
  admPickFile: { en: 'Pick a file to view and edit', ar: 'اختر ملفاً لعرضه وتعديله' },
  admConfirmDeleteFile: { en: 'Delete', ar: 'حذف' },

  // Quick-launch build prompts (sent to backend — follow UI language)
  qbSaaS: { en: 'Build a complete SaaS platform with subscriptions', ar: 'ابني منصة SaaS متكاملة مع اشتراكات' },
  qbTravel: { en: 'Build a luxury travel platform with booking', ar: 'ابني منصة سفر فاخرة مع حجز' },
  qbRestaurant: { en: 'Build a fine-dining restaurant site with table reservations', ar: 'ابني موقع مطعم فاخر مع حجز طاولات' },
  qbCinema: { en: 'Build a cinema platform with ticket booking', ar: 'ابني منصة سينما مع حجز تذاكر' },
  qbDashboard: { en: 'Build a professional analytics dashboard', ar: 'ابني لوحة تحكم تحليلية احترافية' },
  qbMobile: { en: 'Build a modern mobile app', ar: 'ابني تطبيق جوال عصري' },
  qbCRM: { en: 'Build a customer relationship management system', ar: 'ابني نظام إدارة علاقات عملاء' },
  qbERP: { en: 'Build an enterprise resource planning system', ar: 'ابني نظام تخطيط موارد مؤسسة' },

  // Dashboard errors / status
  linkFail: { en: 'Link failed', ar: 'فشل الربط' },
  pushingGithub: { en: '🐙 Pushing to GitHub... follow the chat', ar: '🐙 جاري الدفع إلى GitHub... تابع الشات' },
  pushFail: { en: 'Push failed', ar: 'فشل الدفع' },
  createProjectFail: { en: 'Failed to create the project.', ar: 'فشل إنشاء المشروع.' },
  serverConnFail: { en: 'Could not reach the server.', ar: 'تعذّر الاتصال بالخادم.' },
  registerFail: { en: 'Failed to create the account.', ar: 'فشل إنشاء الحساب.' },
  loginFail: { en: 'Failed to sign in.', ar: 'فشل تسجيل الدخول.' },
  serverConnRetry: { en: 'Could not reach the server — try again.', ar: 'تعذّر الاتصال بالخادم — حاول مرة أخرى.' },
  connectionLost: { en: 'Connection to the server lost — reconnecting automatically...', ar: 'انقطع الاتصال بالخادم — جاري إعادة الاتصال تلقائياً...' },
  liveLog: { en: '📋 Live Log', ar: '📋 السجل الحي' },
  timelineTab: { en: '🕘 Timeline', ar: '🕘 الخط الزمني' },

  // OAuth
  continueWithGithub: { en: 'Continue with GitHub', ar: 'المتابعة عبر GitHub' },
  continueWithGoogle: { en: 'Continue with Google', ar: 'المتابعة عبر Google' },
  orDivider: { en: 'or', ar: 'أو' },

  // GitHub files admin tab
  admTabGithub: { en: 'GitHub Files', ar: 'ملفات GitHub' },
  admGhTitle: { en: '🐙 GitHub Files', ar: '🐙 ملفات GitHub' },
  admGhNotLinked: { en: 'No GitHub account linked. Sign in with GitHub to browse and edit your repositories.', ar: 'لا يوجد حساب GitHub مرتبط. سجّل الدخول عبر GitHub لتصفّح وتعديل مستودعاتك.' },
  admGhLinkedAs: { en: 'Linked as', ar: 'مرتبط باسم' },
  admGhRepos: { en: 'Repositories', ar: 'المستودعات' },
  admGhLoadingRepos: { en: 'Loading repositories...', ar: 'جاري تحميل المستودعات...' },
  admGhNoRepos: { en: 'No repositories found.', ar: 'لا مستودعات.' },
  admGhBackRepos: { en: '← Repositories', ar: '← المستودعات' },
  admGhBackDir: { en: '← Up', ar: '← للأعلى' },
  admGhCommitMsg: { en: 'Commit message', ar: 'رسالة الـ commit' },
  admGhCommitPush: { en: '⬆ Commit & Push', ar: '⬆ حفظ ورفع' },
  admGhPushing: { en: 'Pushing...', ar: 'جاري الرفع...' },
  admGhPushed: { en: '✅ Pushed', ar: '✅ تم الرفع' },
  admGhPickFile: { en: 'Pick a file to view and edit', ar: 'اختر ملفاً لعرضه وتعديله' },
  admGhPrivate: { en: 'private', ar: 'خاص' },

  // Backend team tab
  admTabTeam: { en: 'Backend Team', ar: 'فريق الخلفية' },
  admTeamTitle: { en: '👥 Backend Agent Team', ar: '👥 فريق وكلاء الخلفية' },
  admTeamIntro: { en: 'Specialized agents that cooperate on backend builds — each follows the same 9-section contract for stable behavior across AI models.', ar: 'وكلاء متخصصون يتعاونون في بناء الخلفية — كلٌّ يتبع العقد الموحّد (9 أقسام) لسلوك مستقر عبر نماذج الذكاء.' },
  admTeamLoading: { en: 'Loading team...', ar: 'جاري تحميل الفريق...' },
  admTeamMission: { en: 'Mission', ar: 'المهمة' },
  admTeamResponsibilities: { en: 'Responsibilities', ar: 'المسؤوليات' },
  admTeamOutputs: { en: 'Outputs', ar: 'المخرجات' },
  admTeamCooperation: { en: 'Cooperation', ar: 'التعاون' },
  admTeamNeverDo: { en: 'Never Do', ar: 'ممنوع' },
  admTeamDependsOn: { en: 'Depends on', ar: 'يعتمد على' },
  admTeamOrder: { en: 'Execution order', ar: 'ترتيب التنفيذ' },

  // billing page
  billingTitle: { en: 'Billing & Subscription', ar: 'الاشتراك والفوترة', es: 'Facturación y suscripción', fr: 'Facturation et abonnement' },
  billingBack: { en: '← Back to dashboard', ar: '← الرجوع للوحة', es: '← Volver al panel', fr: '← Retour au tableau de bord' },
  billingDemoMode: { en: 'Payments are in demo mode (Stripe keys not configured on the server yet).', ar: 'نظام الدفع في وضع العرض فقط (لم تُضبط مفاتيح Stripe على الخادم بعد).', es: 'Los pagos están en modo demo (claves de Stripe sin configurar).', fr: 'Paiements en mode démo (clés Stripe non configurées).' },
  billingLoading: { en: 'Loading…', ar: 'جارٍ التحميل…', es: 'Cargando…', fr: 'Chargement…' },
  billingCurrentPlan: { en: 'Your current plan', ar: 'خطتك الحالية', es: 'Tu plan actual', fr: 'Votre forfait actuel' },
  billingUsedProjects: { en: 'Projects used', ar: 'المشاريع المستخدمة', es: 'Proyectos usados', fr: 'Projets utilisés' },
  billingMaxLimit: { en: 'Limit', ar: 'الحدّ الأقصى', es: 'Límite', fr: 'Limite' },
  billingRemaining: { en: 'Remaining', ar: 'المتبقي', es: 'Restante', fr: 'Restant' },
  billingAutoDeploy: { en: 'Auto deploy', ar: 'نشر تلقائي', es: 'Despliegue automático', fr: 'Déploiement auto' },
  billingEnabled: { en: 'Enabled ✅', ar: 'مفعّل ✅', es: 'Activado ✅', fr: 'Activé ✅' },
  billingNotAvailable: { en: 'Not available', ar: 'غير متاح', es: 'No disponible', fr: 'Non disponible' },
  billingUnlimited: { en: 'Unlimited', ar: 'غير محدود', es: 'Ilimitado', fr: 'Illimité' },
  billingManage: { en: 'Manage subscription', ar: 'إدارة الاشتراك', es: 'Gestionar suscripción', fr: 'Gérer l’abonnement' },
  billingPerMonth: { en: '/mo', ar: '/شهر', es: '/mes', fr: '/mois' },
  billingFree: { en: 'Free', ar: 'مجاناً', es: 'Gratis', fr: 'Gratuit' },
  billingYourPlan: { en: 'Your plan', ar: 'خطتك', es: 'Tu plan', fr: 'Votre forfait' },
  billingCurrentBtn: { en: 'Current plan', ar: 'خطتك الحالية', es: 'Plan actual', fr: 'Forfait actuel' },
  billingUpgrade: { en: 'Upgrade now', ar: 'ترقية الآن', es: 'Mejorar ahora', fr: 'Passer au niveau supérieur' },
  billingBasePlan: { en: 'Base plan', ar: 'الخطة الأساسية', es: 'Plan básico', fr: 'Forfait de base' },
  planFree: { en: 'Free', ar: 'مجانية', es: 'Gratis', fr: 'Gratuit' },
  planPro: { en: 'Pro', ar: 'احترافية', es: 'Pro', fr: 'Pro' },
  planEnterprise: { en: 'Enterprise', ar: 'المؤسسات', es: 'Empresas', fr: 'Entreprise' },
};

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('uiLang') : null;
const defaultLang = stored && LANGUAGES.some(l => l.code === stored) ? stored : 'en';

function applyDir(code) {
  const lang = LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', lang.dir);
    document.documentElement.setAttribute('lang', code);
  }
  return lang.dir;
}
applyDir(defaultLang);

export const useI18n = create((set, get) => ({
  lang: defaultLang,
  dir: (LANGUAGES.find(l => l.code === defaultLang) || LANGUAGES[0]).dir,

  setLang: (code) => {
    if (!LANGUAGES.some(l => l.code === code)) return;
    localStorage.setItem('uiLang', code);
    const dir = applyDir(code);
    set({ lang: code, dir });
  },

  // t(key) → النص باللغة الحالية مع السقوط للإنجليزية
  t: (key) => {
    const { lang } = get();
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[lang] || entry.en || key;
  },
}));
