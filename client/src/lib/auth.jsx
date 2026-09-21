import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, setSessionLostHandler } from '@/api/client';

const AuthContext = createContext(null);

export const ADMIN_ROLES = ['owner', 'manager'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  // Au chargement, on tente de reprendre la session grace au cookie de refresh.
  useEffect(() => {
    let cancelled = false;
    api.post('/auth/refresh')
      .then(({ data }) => {
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setStatus('anonymous');
      });
    return () => { cancelled = true; };
  }, []);

  const signOutLocal = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => setSessionLostHandler(signOutLocal), [signOutLocal]);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { signOutLocal(); }
  }, [signOutLocal]);

  const value = useMemo(() => ({
    user,
    status,
    login,
    logout,
    isAdmin: ADMIN_ROLES.includes(user?.role),
    isOwner: user?.role === 'owner',
  }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
}
