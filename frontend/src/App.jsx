import { useState, useEffect, lazy, Suspense } from 'react'

const PAGE_TITLES = {
  landing: 'JAOLA OS — ابنِ موقعك بالذكاء الاصطناعي',
  boot: 'JAOLA OS',
  dashboard: 'لوحة المشروع — JAOLA OS',
  admin: 'لوحة المشرف — JAOLA OS',
  billing: 'الفوترة والاشتراك — JAOLA OS',
  privacy: 'سياسة الخصوصية — JAOLA OS',
  terms: 'الشروط والأحكام — JAOLA OS',
}

// ⚡ تقسيم الحزمة: كل صفحة تُحمَّل عند طلبها فقط — بدل حزمة واحدة ~700KB
// كانت تُحمَّل كاملة لكل زائر (الهبوط كانت تجرّ الداشبورد والأدمِن معها).
const LandingPage = lazy(() => import('./pages/LandingPage'))
const BootSequence = lazy(() => import('./pages/BootSequence'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))

// مؤشر تحميل خفيف بلا اعتماديات — يظهر لحظات فقط أثناء جلب شيفرة الصفحة
function PageLoader() {
  return (
    <div style={{ minHeight: '100dvh', background: '#050810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 34, height: 34, border: '3px solid #1e293b', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'jspin 0.8s linear infinite' }} />
      <style>{'@keyframes jspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname
    if (path === '/boot') return 'boot'
    if (path === '/dashboard') return 'dashboard'
    if (path === '/admin') return 'admin'
    if (path === '/billing' || path === '/settings') return 'billing'
    if (path === '/privacy') return 'privacy'
    if (path === '/terms') return 'terms'
    return 'landing'
  })

  useEffect(() => { document.title = PAGE_TITLES[page] || PAGE_TITLES.landing }, [page])

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    if (to === '/boot') setPage('boot')
    else if (to === '/dashboard') setPage('dashboard')
    else if (to === '/admin') setPage('admin')
    else if (to === '/billing' || to === '/settings') setPage('billing')
    else if (to === '/privacy') setPage('privacy')
    else if (to === '/terms') setPage('terms')
    else setPage('landing')
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {page === 'boot' && <BootSequence onDone={() => { sessionStorage.setItem('booted', '1'); navigate('/dashboard') }} />}
      {page === 'admin' && <AdminPanel onExit={() => navigate('/dashboard')} />}
      {page === 'billing' && <BillingPage onExit={() => navigate('/dashboard')} />}
      {page === 'privacy' && <LegalPage initialTab="privacy" onExit={() => navigate('/')} />}
      {page === 'terms' && <LegalPage initialTab="terms" onExit={() => navigate('/')} />}
      {page === 'dashboard' && <Dashboard />}
      {page === 'landing' && <LandingPage onStart={() => navigate('/boot')} />}
    </Suspense>
  )
}
