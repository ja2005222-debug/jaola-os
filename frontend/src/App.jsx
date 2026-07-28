import { useState, lazy, Suspense } from 'react'

// تحميل كسول — كل صفحة في chunk منفصل، فلا تُحمَّل framer-motion وlucide
// (الخاصة بصفحة الهبوط) عند الدخول المباشر على /dashboard والعكس صحيح
const LandingPage = lazy(() => import('./pages/LandingPage'))
const BootSequence = lazy(() => import('./pages/BootSequence'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030508' }}>
      <div style={{ width: 28, height: 28, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname
    if (path === '/boot') return 'boot'
    if (path === '/dashboard') return 'dashboard'
    return 'landing'
  })

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    if (to === '/boot') setPage('boot')
    else if (to === '/dashboard') setPage('dashboard')
    else setPage('landing')
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {page === 'boot' ? <BootSequence onDone={() => navigate('/dashboard')} />
        : page === 'dashboard' ? <Dashboard />
        : <LandingPage onStart={() => navigate('/boot')} />}
    </Suspense>
  )
}
