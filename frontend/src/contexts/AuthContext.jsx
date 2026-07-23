import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'pcs_admin_token';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, false = unauthenticated, object = authenticated user
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const fetchMe = useCallback(async (t) => {
    if (!t) {
      setUser(false);
      return null;
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error('unauth');
      const data = await res.json();
      setUser(data);
      return data;
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(false);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchMe(token);
  }, [token, fetchMe]);

  const login = async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
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
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(false);
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
    <AuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
