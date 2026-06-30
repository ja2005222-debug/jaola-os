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

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
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
    handleAuthError,
  };
}

