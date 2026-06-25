import { useState, useEffect } from 'react';

// 🛠️ حساب عنوان الباك إند ديناميكياً لتفادي قيود الـ Localhost في الكروم بوك
const BACKEND_URL = `http://${window.location.hostname}:4000`;

export function useAuth(activeProject) {
  const [currentUser, setCurrentUser] = useState('guest_user');
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const loginSession = async () => {
      let currentToken = localStorage.getItem('token');
      let username = localStorage.getItem('currentUser') || 'guest_user';

      if (!currentToken) {
        try {
          // استدعاء المصادقة التلقائية على الرابط الديناميكي الصحيح
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });
          const data = await res.json();
          if (data.success && data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', data.currentUser);
            setToken(data.token);
            setCurrentUser(data.currentUser);
            setIsAuthenticated(true);
          }
        } catch (err) {
          console.error('Failed auto login:', err);
        }
      } else {
        setCurrentUser(username);
        setToken(currentToken);
        setIsAuthenticated(true);
      }
    };

    loginSession();
  }, [activeProject]);

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      setToken(null);
      setIsAuthenticated(false);
      window.location.reload(); 
    }
  };

  return { currentUser, token, isAuthenticated, handleAuthError };
}
