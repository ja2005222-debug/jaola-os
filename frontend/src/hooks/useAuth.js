import { useState, useEffect } from 'react';

// 🛠️ تبديل ديناميكي ذكي: يتصل محلياً بـ 4000، ويتصل سحابياً برابط سيرفر الـ Render الخاص بك
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com'; // 👈 استبدل هذا برابط سيرفر الباك إند الذي يمنحه لك Render!

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
