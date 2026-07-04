import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import BootSequence from './pages/BootSequence'
import Dashboard from './pages/Dashboard'

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

  if (page === 'boot') return <BootSequence onDone={() => navigate('/dashboard')} />
  if (page === 'dashboard') return <Dashboard />
  return <LandingPage onStart={() => navigate('/boot')} />
}
