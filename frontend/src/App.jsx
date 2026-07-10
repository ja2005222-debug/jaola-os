import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import BootSequence from './pages/BootSequence'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname
    if (path === '/boot') return 'boot'
    if (path === '/dashboard') return 'dashboard'
    if (path === '/admin') return 'admin'
    return 'landing'
  })

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    if (to === '/boot') setPage('boot')
    else if (to === '/dashboard') setPage('dashboard')
    else if (to === '/admin') setPage('admin')
    else setPage('landing')
  }

  if (page === 'boot') return <BootSequence onDone={() => navigate('/dashboard')} />
  if (page === 'admin') return <AdminPanel onExit={() => navigate('/dashboard')} />
  if (page === 'dashboard') return <Dashboard />
  return <LandingPage onStart={() => navigate('/boot')} />
}
