import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AUTH_API = process.env.REACT_APP_AUTH_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'pcl_token';
const USER_KEY = 'pcl_user';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, false = unauthenticated, object = authenticated user
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [systemContext, setSystemContext] = useState(null);

  const fetchMe = useCallback(async (t) => {
    if (!t) {
      setUser(false);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    try {
      const res = await fetch(`${AUTH_API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error('unauth');
      const data = await res.json();
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      setUser(data);
      return data;
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(false);
      setSystemContext(null);
      return null;
    }
  }, []);

  const fetchSystemContext = useCallback(async (t) => {
    if (!t) {
      setSystemContext(null);
      return null;
    }
    const res = await fetch(`${AUTH_API}/api/auth/system-context`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail?.message || data?.detail || 'No se pudo resolver el contexto del sistema');
    setSystemContext(data);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    if (!token) {
      setUser(false);
      setSystemContext(null);
      return () => { active = false; };
    }
    (async () => {
      const currentUser = await fetchMe(token);
      if (!active || !currentUser) return;
      try {
        await fetchSystemContext(token);
      } catch {
        if (active) setSystemContext(null);
      }
    })();
    return () => { active = false; };
  }, [token, fetchMe, fetchSystemContext]);

  const login = async (email, password) => {
    const res = await fetch(`${AUTH_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(' ')
        : (detail || 'Error de autenticación');
      throw new Error(msg);
    }

    const nextToken = data.access_token;
    localStorage.setItem(TOKEN_KEY, nextToken);
    const verifiedUser = await fetchMe(nextToken);
    if (!verifiedUser) throw new Error('No se pudo validar la sesión');

    try {
      const context = await fetchSystemContext(nextToken);
      setToken(nextToken);
      setUser(verifiedUser);
      return { ...verifiedUser, systemContext: context };
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(false);
      setSystemContext(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(false);
    setSystemContext(null);
  };

  const authFetch = useCallback(
    async (path, opts = {}) => {
      const headers = { ...(opts.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${API}${path}`, { ...opts, headers });
      if (res.status === 401) {
        logout();
      }
      return res;
    },
    [token],
  );

  return (
    <AuthContext.Provider value={{ user, token, systemContext, login, logout, fetchMe, fetchSystemContext, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
