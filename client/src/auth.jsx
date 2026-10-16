import { createContext, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { api } from './api';

const AuthContext = createContext(null);

// Wraps only the admin routes, so the public site never calls the login API.
export function AuthShell() {
  const [status, setStatus] = useState('loading'); // loading | in | out

  useEffect(() => {
    api
      .me()
      .then(() => setStatus('in'))
      .catch(() => setStatus('out'));
    const expire = () => setStatus('out');
    window.addEventListener('session-expired', expire);

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      window.removeEventListener('session-expired', expire);
      meta.remove();
    };
  }, []);

  const login = async (username, password) => {
    await api.login(username, password);
    setStatus('in');
  };
  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // the cookie is gone or the server is down; either way show the login
    }
    setStatus('out');
  };

  return (
    <AuthContext.Provider value={{ status, login, logout }}>
      <Outlet />
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
