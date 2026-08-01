import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import { BACKEND_URL } from '../config.js';

// 🏠 اللاندنق الصادقة: كل ما فيها حقيقي — لقطات القوالب الفعلية، الأسعار من
// نفس مصدر صفحة الفوترة (/api/billing/plans مع نسخة ثابتة مطابقة كارتداد)،
// والميزات هي المبنيّة فعلاً. ثنائية اللغة بنفس نظام i18n (وRTL يُطبَّق عالمياً).

// عائلة "المستشارين الأذكياء" — أنظمة داخلية شخصية (لا مواقع عامة) بتحليل
// حقيقي وقراءة بالذكاء الاصطناعي. لقطات حقيقية أيضاً، مُلتقَطة من القوالب
// الفعلية عبر حصاد Playwright (بيانات تجريبية واقعية، لا تصميم وهمي).
const ADVISORS = [
  { id: 'jaola-crypto-advisor', nameKey: 'ldAdvCrypto', descKey: 'ldAdvCryptoD', icon: '📊' },
  { id: 'jaola-stock-advisor', nameKey: 'ldAdvStock', descKey: 'ldAdvStockD', icon: '📈' },
  { id: 'jaola-budget-advisor', nameKey: 'ldAdvBudget', descKey: 'ldAdvBudgetD', icon: '💰' },
];

// 🏢 مسار «السيستم الداخلي» — أدوات عمل يومية للمؤسسات (لا مواقع عامة)، بدخول
// حسب الأدوار. لقطات حقيقية من اللوحة الفعلية بعد الدخول التجريبي، لا شاشة
// دخول فارغة (harvestTemplateScreenshots.mjs).
const SYSTEMS = [
  { id: 'jaola-erp', ar: 'إدارة مصنع/منشأة (ERP)', en: 'Facility ERP' },
  { id: 'jaola-hr', ar: 'موارد بشرية ورواتب', en: 'HR & payroll' },
  { id: 'jaola-accounting', ar: 'محاسبة ودفاتر', en: 'Accounting & ledgers' },
  { id: 'jaola-pos', ar: 'نقطة بيع وكاشير', en: 'POS & cashier' },
  { id: 'jaola-warehouse', ar: 'مستودعات ومخزون', en: 'Warehouse & inventory' },
  { id: 'jaola-clinic', ar: 'عيادة طبية', en: 'Medical clinic' },
  { id: 'jaola-vetclinic', ar: 'عيادة بيطرية', en: 'Veterinary clinic' },
  { id: 'jaola-lawfirm', ar: 'مكتب محاماة', en: 'Law firm' },
  { id: 'jaola-fleet', ar: 'إدارة أسطول مركبات', en: 'Fleet management' },
  { id: 'jaola-pharmacy', ar: 'صيدلية', en: 'Pharmacy' },
  { id: 'jaola-property', ar: 'إدارة عقارات وإيجارات', en: 'Property & rentals' },
  { id: 'jaola-restaurant-ops', ar: 'تشغيل مطعم وشاشة مطبخ', en: 'Restaurant ops & KDS' },
  { id: 'jaola-helpdesk', ar: 'دعم فني وتذاكر', en: 'Helpdesk & tickets' },
  { id: 'jaola-laundry', ar: 'مغسلة', en: 'Laundry' },
  { id: 'jaola-workshop', ar: 'ورشة صيانة سيارات', en: 'Car repair workshop' },
];

// لقطات حقيقية من frontend/public/templates (تُلتقط من القوالب نفسها)
const SHOWCASE = [
  { id: 'jaola-store', ar: 'متجر إلكتروني', en: 'Online store' },
  { id: 'jaola-realestate', ar: 'عقارات', en: 'Real estate' },
  { id: 'jaola-delivery', ar: 'مطعم وتوصيل', en: 'Restaurant & delivery' },
  { id: 'jaola-travel', ar: 'سفر وسياحة', en: 'Travel' },
  { id: 'jaola-lms', ar: 'منصّة تعليمية', en: 'E-learning' },
  { id: 'jaola-events', ar: 'فعاليات وتذاكر', en: 'Events & tickets' },
  { id: 'jaola-booking', ar: 'حجوزات', en: 'Booking' },
  { id: 'jaola-marketplace', ar: 'سوق متعدد البائعين', en: 'Marketplace' },
];

// نسخة ثابتة مطابقة لخطط backend/config/plans.js — تُستبدل بالحيّة عند توفر الخادم
const FALLBACK_PLANS = [
  { id: 'free', nameAr: 'مجانية', nameEn: 'Free', priceMonthly: 0,
    featuresAr: ['حتى 5 مشاريع', 'القوالب الأساسية', 'مساعد الموقع (قاعدة داخلية + 30 رسالة ذكاء/شهر)', 'دعم عبر المجتمع'],
    featuresEn: ['Up to 5 projects', 'Core templates', 'Site assistant (built-in KB + 30 AI msgs/mo)', 'Community support'] },
  { id: 'pro', nameAr: 'احترافية', nameEn: 'Pro', priceMonthly: 19,
    featuresAr: ['مشاريع غير محدودة', 'نشر تلقائي', 'مساعد الموقع بذكاء حيّ (2000 رسالة/شهر)', 'دعم أولوية', 'كل القوالب المتقدمة'],
    featuresEn: ['Unlimited projects', 'Auto deploy', 'AI site assistant (2000 msgs/mo)', 'Priority support', 'All advanced templates'] },
  { id: 'enterprise', nameAr: 'المؤسسات', nameEn: 'Enterprise', priceMonthly: 99,
    featuresAr: ['كل مزايا Pro', 'ذكاء البوت بلا حدود', 'وكلاء مخصّصون', 'استضافة خاصة', 'مدير حساب مخصص'],
    featuresEn: ['Everything in Pro', 'Unlimited bot AI', 'Custom agents', 'Private hosting', 'Dedicated account manager'] },
];

export default function LandingPage({ onStart = () => {} }) {
  const t = useI18n(s => s.t);
  const lang = useI18n(s => s.lang);
  const isAr = lang === 'ar';
  // اللقطات بنسختين: عربية (الأصل) وإنجليزية (مولّدة عبر مترجم القوالب نفسه)
  const shot = (id) => (isAr ? `/templates/${id}.jpg` : `/templates/en/${id}.jpg`);
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  // الأسعار الحيّة من نفس مصدر صفحة الفوترة — لا ازدواجية حقيقة
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/billing/plans`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (Array.isArray(d?.plans) && d.plans.length) setPlans(d.plans); })
      .catch(() => {});
  }, []);

  const planName = (p) => (isAr ? p.nameAr : (p.nameEn || p.nameAr));
  const planFeatures = (p) => (isAr ? p.featuresAr : (p.featuresEn || p.featuresAr)) || [];

  const steps = [
    { icon: '💬', title: t('ldStep1'), desc: t('ldStep1d') },
    { icon: '🧩', title: t('ldStep2'), desc: t('ldStep2d') },
    { icon: '🎨', title: t('ldStep3'), desc: t('ldStep3d') },
    { icon: '🚀', title: t('ldStep4'), desc: t('ldStep4d') },
  ];

  const features = [
    { icon: '🤖', title: t('ldFeatBot'), desc: t('ldFeatBotD') },
    { icon: '📬', title: t('ldFeatInbox'), desc: t('ldFeatInboxD') },
    { icon: '📣', title: t('ldFeatMk'), desc: t('ldFeatMkD') },
    { icon: '🧩', title: t('ldFeatAgents'), desc: t('ldFeatAgentsD') },
    { icon: '📦', title: t('ldFeatOwn'), desc: t('ldFeatOwnD') },
    { icon: '🩺', title: t('ldFeatHealth'), desc: t('ldFeatHealthD') },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070f] text-white">
      {/* HERO */}
      <section className="relative px-6 py-8 grid-bg">
        <div className="absolute inset-0 gradient-orb opacity-70" />
        <nav className="relative z-30 mx-auto flex max-w-7xl items-center justify-between rounded-2xl glass px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 pulse-node flex items-center justify-center">⚡</div>
            <span className="text-lg font-semibold tracking-tight">JAOLA OS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#how" className="hover:text-white transition">{t('ldNavHow')}</a>
            <a href="#templates" className="hover:text-white transition">{t('ldNavTemplates')}</a>
            <a href="#systems" className="hover:text-white transition">{t('ldNavSystems')}</a>
            <a href="#advisors" className="hover:text-white transition">{t('ldNavAdvisors')}</a>
            <a href="#pricing" className="hover:text-white transition">{t('ldNavPricing')}</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button onClick={() => onStart()} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200 transition">
              {t('ldCta')}
            </button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 pt-24 pb-16 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-6 inline-flex rounded-full glass px-4 py-2 text-sm text-slate-300">
              ✦ {t('ldBadge')}
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl leading-tight">
              {t('ldH1a')}{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">{t('ldH1b')}</span>
            </h1>
            <p className="mt-7 text-lg leading-8 text-slate-400">{t('ldSub')}</p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button onClick={() => onStart()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-semibold text-black hover:bg-slate-200 transition">
                {t('ldCtaFree')} <ArrowRight size={18} className={isAr ? 'rotate-180' : ''} />
              </button>
              <a href="#templates" className="inline-flex items-center justify-center gap-2 rounded-2xl glass px-6 py-4 font-semibold hover:bg-white/10 transition">
                🖼️ {t('ldCtaTemplates')}
              </a>
            </div>
            <p className="mt-5 text-xs text-slate-500">{t('ldNoCard')}</p>
          </motion.div>

          {/* لقطات حقيقية — لا لوحات وهمية + محاكاة المحادثة (المنتج الفعلي) */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
            className="relative h-[420px] hidden sm:block">
            {SHOWCASE.slice(0, 3).map((s, i) => (
              <img key={s.id} src={shot(s.id)} alt={isAr ? s.ar : s.en} loading="lazy"
                className="absolute w-[78%] rounded-2xl border border-white/10 shadow-2xl"
                style={{ top: `${i * 44}px`, insetInlineStart: `${i * 11}%`, transform: `rotate(${(i - 1) * 2}deg)`, zIndex: 3 - i, opacity: 1 - i * 0.12 }} />
            ))}
            {/* بطاقة المحادثة — هكذا يعمل المنتج فعلاً (بناء بالكلام + تراجع بكلمة) */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
              className="absolute bottom-0 inset-inline-end-0 z-10 w-[86%] rounded-2xl glass p-4 shadow-2xl"
              style={{ insetInlineEnd: 0 }}>
              <div className="flex justify-end mb-2">
                <div className="max-w-[85%] rounded-2xl bg-blue-500/90 px-4 py-2 text-sm font-medium">{t('ldChatUser')}</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs">⚡</div>
                <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm text-slate-200">{t('ldChatReply')}</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* 📊 أرقام صادقة — كل رقم من الكود الفعلي لا من التسويق */}
        <div className="relative z-10 mx-auto max-w-7xl pb-14">
          <div className="grid grid-cols-2 gap-4 rounded-3xl glass px-6 py-8 md:grid-cols-4 text-center">
            {[
              ['41', t('ldStatTemplates')],
              ['8', t('ldStatLangs')],
              ['3', t('ldStatAdvisors')],
              ['600+', t('ldStatChecks')],
            ].map(([n, label], i) => (
              <div key={i}>
                <div className="text-3xl font-bold md:text-4xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{n}</div>
                <div className="mt-1 text-xs text-slate-400 md:text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">{t('ldNavHow')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-14">{t('ldHowTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <div key={i} className="rounded-3xl glass p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-xl">{s.icon}</div>
                <p className="font-semibold mb-2">{i + 1}. {s.title}</p>
                <p className="text-sm text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEMPLATES — لقطات حقيقية من القوالب العاملة */}
      <section id="templates" className="px-6 py-24 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">{t('ldNavTemplates')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-4">{t('ldTplTitle')}</h2>
          <p className="text-slate-400 mb-14">{t('ldTplSub')}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SHOWCASE.map(s => (
              <button key={s.id} onClick={() => onStart()} className="group rounded-2xl overflow-hidden glass text-start hover:bg-white/[0.07] transition">
                <img src={shot(s.id)} alt={isAr ? s.ar : s.en} loading="lazy"
                  className="w-full aspect-video object-cover object-top group-hover:scale-[1.02] transition" />
                <div className="p-4 font-semibold text-sm">{isAr ? s.ar : s.en}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* INTERNAL SYSTEMS — مسار «السيستم» للمؤسسات والشركات (منفصل عن الموقع العام) */}
      <section id="systems" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-cyan-300">✦ {t('ldSysKicker')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-4">{t('ldSysTitle')}</h2>
          <p className="text-slate-400 mb-14 max-w-2xl">{t('ldSysSub')}</p>
          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {SYSTEMS.map(s => (
              <button key={s.id} onClick={() => onStart()} className="group rounded-2xl overflow-hidden glass text-start hover:bg-white/[0.07] transition">
                <img src={shot(s.id)} alt={isAr ? s.ar : s.en} loading="lazy"
                  className="w-full aspect-video object-cover object-top group-hover:scale-[1.02] transition" />
                <div className="p-3 font-semibold text-xs leading-tight">{isAr ? s.ar : s.en}</div>
              </button>
            ))}
          </div>
          <div className="mt-8">
            <button onClick={() => onStart()} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-slate-200 transition">
              {t('ldSysCta')} <ArrowRight size={16} className={isAr ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </section>

      {/* SMART ADVISORS — عائلة أنظمة داخلية شخصية، لقطات حقيقية أيضاً */}
      <section id="advisors" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-emerald-300">✦ {t('ldAdvKicker')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-4">{t('ldAdvTitle')}</h2>
          <p className="text-slate-400 mb-14 max-w-2xl">{t('ldAdvSub')}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ADVISORS.map(a => (
              <button key={a.id} onClick={() => onStart()} className="group rounded-2xl overflow-hidden glass text-start hover:bg-white/[0.07] transition">
                <img src={shot(a.id)} alt={t(a.nameKey)} loading="lazy"
                  className="w-full aspect-video object-cover object-top group-hover:scale-[1.02] transition" />
                <div className="p-5">
                  <div className="flex items-center gap-2 font-semibold mb-2"><span>{a.icon}</span>{t(a.nameKey)}</div>
                  <p className="text-sm text-slate-400 leading-6 mb-3">{t(a.descKey)}</p>
                  <span className="text-sm font-semibold text-blue-300 group-hover:text-blue-200">{t('ldAdvCta')} →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — المبنيّ فعلاً */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">{t('ldFeatKicker')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-14">{t('ldFeatTitle')}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="rounded-3xl glass p-6 hover:bg-white/[0.07] transition">
                <div className="mb-4 text-2xl">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-6">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY JAOLA — التمايز الحقيقي (كل بند مبنيّ فعلاً) */}
      <section id="why" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-purple-300">✦ {t('ldWhyKicker')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-4">{t('ldWhyTitle')}</h2>
          <p className="text-slate-400 mb-14 max-w-2xl">{t('ldWhySub')}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['🔬', t('ldWhy1'), t('ldWhy1d')],
              ['⏪', t('ldWhy2'), t('ldWhy2d')],
              ['🔍', t('ldWhy3'), t('ldWhy3d')],
              ['🕌', t('ldWhy4'), t('ldWhy4d')],
              ['🧰', t('ldWhy5'), t('ldWhy5d')],
              ['📦', t('ldWhy6'), t('ldWhy6d')],
            ].map(([icon, title, desc], i) => (
              <div key={i} className="rounded-3xl border border-purple-400/15 bg-purple-500/[0.06] p-6 hover:bg-purple-500/[0.1] transition">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-xl">{icon}</div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-6">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — من نفس مصدر صفحة الفوترة */}
      <section id="pricing" className="px-6 py-24 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-sm font-medium text-blue-300">{t('ldNavPricing')}</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-14">{t('ldPriceTitle')}</h2>
          <div className="grid gap-6 lg:grid-cols-3 max-w-5xl">
            {plans.map((p, i) => (
              <div key={p.id} className={`rounded-3xl p-7 ${p.id === 'pro' ? 'border border-blue-400/40 bg-blue-500/10' : 'glass'}`}>
                {p.id === 'pro' && <div className="text-xs text-blue-300 font-bold mb-4 tracking-widest">★ {t('ldRecommended')}</div>}
                <h3 className="text-xl font-semibold">{planName(p)}</h3>
                <div className="mt-5 text-4xl font-bold">
                  {p.priceMonthly === 0 ? t('ldFree') : `$${p.priceMonthly}`}
                  {p.priceMonthly > 0 && <span className="text-sm font-normal text-slate-400"> / {t('ldMonth')}</span>}
                </div>
                <ul className="mt-6 space-y-2 text-sm text-slate-300">
                  {planFeatures(p).map((f, j) => <li key={j} className="flex gap-2"><span className="text-emerald-400">✓</span>{f}</li>)}
                </ul>
                <button onClick={() => onStart()}
                  className={`mt-8 w-full rounded-2xl px-5 py-3 font-semibold transition ${p.id === 'pro' ? 'bg-white text-black hover:bg-slate-200' : 'glass hover:bg-white/10 text-white'}`}>
                  {p.priceMonthly === 0 ? t('ldCtaFree') : t('ldCta')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — أسئلة حقيقية بإجابات مبنيّة فعلاً */}
      <section id="faq" className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl mb-12 text-center">{t('ldFaqTitle')}</h2>
          <div className="space-y-3">
            {[
              [t('ldFaq1'), t('ldFaq1a')],
              [t('ldFaq2'), t('ldFaq2a')],
              [t('ldFaq3'), t('ldFaq3a')],
              [t('ldFaq4'), t('ldFaq4a')],
              [t('ldFaq5'), t('ldFaq5a')],
            ].map(([q, a], i) => (
              <details key={i} className="group rounded-2xl glass px-6 py-4">
                <summary className="flex cursor-pointer items-center justify-between font-semibold list-none">
                  {q}
                  <span className="text-slate-500 transition group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-400">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative px-6 py-24 overflow-hidden">
        <div className="absolute inset-0 gradient-orb opacity-60" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">{t('ldFinalTitle')}</h2>
          <p className="mt-5 text-lg text-slate-400">{t('ldFinalSub')}</p>
          <button onClick={() => onStart()}
            className="mt-9 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-black hover:bg-slate-200 transition">
            {t('ldCtaFree')} <ArrowRight size={20} className={isAr ? 'rotate-180' : ''} />
          </button>
          <p className="mt-4 text-xs text-slate-500">{t('ldNoCard')}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 pt-14 pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-3 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3"><span className="text-xl">⚡</span><h3 className="font-semibold">JAOLA OS</h3></div>
              <p className="text-sm text-slate-500 max-w-xs leading-6">{t('ldFooter')}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-4 text-slate-300">{t('ldFootProduct')}</p>
              <div className="flex flex-col gap-2 text-sm text-slate-400">
                <a href="#how" className="hover:text-white transition">{t('ldNavHow')}</a>
                <a href="#templates" className="hover:text-white transition">{t('ldNavTemplates')}</a>
                <a href="#advisors" className="hover:text-white transition">{t('ldNavAdvisors')}</a>
                <a href="#pricing" className="hover:text-white transition">{t('ldNavPricing')}</a>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-4 text-slate-300">{t('ldFootLegal')}</p>
              <div className="flex flex-col gap-2 text-sm text-slate-400">
                <a href="/privacy" className="hover:text-white transition">{t('legalTabPrivacy')}</a>
                <a href="/terms" className="hover:text-white transition">{t('legalTabTerms')}</a>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6">
            <span className="text-xs text-slate-600">© 2026 JAOLA OS</span>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-node" />
              <span className="text-emerald-400">{t('operational')}</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
