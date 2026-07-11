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
  deploying: { en: 'Deploying...', ar: 'جاري النشر...', es: 'Desplegando...', fr: 'Déploiement...', de: 'Bereitstellung...', tr: 'Yayınlanıyor...', pt: 'Implantando...', ur: 'تعینات جاری...' },
  liveSite: { en: 'Live Site', ar: 'الموقع المباشر', es: 'Sitio en vivo', fr: 'Site en direct', de: 'Live-Site', tr: 'Canlı Site', pt: 'Site ao vivo', ur: 'لائیو سائٹ' },
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
