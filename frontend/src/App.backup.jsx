import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import LandingPage from './pages/LandingPage.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [activeProject] = useState('sandbox_app');
  const { isAuthenticated } = useAuth(activeProject);

  const [currentRoute, setCurrentRoute] = useState(() => {
    return window.location.pathname === '/dashboard' ? 'dashboard' : 'landing';
  });

  const navigateTo = (route) => {
    setCurrentRoute(route);
    window.history.pushState(null, '', route === 'dashboard' ? '/dashboard' : '/');
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname === '/dashboard' ? 'dashboard' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentRoute === 'landing') {
    return <LandingPage navigateTo={navigateTo} />;
  }

  return <Dashboard />;
}
