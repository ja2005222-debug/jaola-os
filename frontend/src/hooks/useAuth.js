import { useState, useEffect, useRef } from 'react';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(
    () => localStorage.getItem('currentUser') || ''
  );
  const [token, setToken] = useState(
    () => localStorage.getItem('token') || null
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('currentUser');
      const loggedOut = localStorage.getItem('loggedOut') === 'true';
      return !loggedOut && !!t && !!u;
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');

  // 🔑 استقبال ارتداد OAuth: /dashboard?token=...&user=... أو ?authError=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const u = params.get('user');
    const err = params.get('authError');
    if (t && u) {
      localStorage.setItem('token', t);
      localStorage.setItem('currentUser', u);
      localStorage.removeItem('loggedOut');
      setToken(t); setCurrentUser(u); setIsAuthenticated(true);
      // نظّف الرابط من التوكن حتى لا يبقى في التاريخ
      window.history.replaceState({}, '', window.location.pathname);
    } else if (err) {
      setOauthError(err);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('activeProject'); // لا يورَّث للحساب التالي
      setToken(null);
      setCurrentUser('');
      setIsAuthenticated(false);
    }
  };

  return {
    currentUser, setCurrentUser,
    token, setToken,
    isAuthenticated, setIsAuthenticated,
    isLoading,
    oauthError,
    handleAuthError,
  };
}

