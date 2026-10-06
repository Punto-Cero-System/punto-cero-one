import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { normalizeCoreLegalContext, normalizeCoreLegalUser } from '../system/coreLegalContext';
import { getAccessContext } from '../system/accessContext';

const AUTH_API = process.env.REACT_APP_AUTH_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
const API = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = 'pcl_token';
const USER_KEY = 'pcl_user';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, false = unauthenticated, object = authenticated user
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [systemContext, setSystemContext] = useState(null);
  // FASE 3B: identidad canónica y espacios disponibles (Access Bridge).
  const [accessContext, setAccessContext] = useState(null);

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
      // Core Legal: el rol llega como `admin_general` / `firm_owner` / `lawyer`.
      // Se normaliza al vocabulario de One sin perder el original en `core_role`.
      const normalized = normalizeCoreLegalUser(data);
      localStorage.setItem(USER_KEY, JSON.stringify(normalized));
      setUser(normalized);
      return normalized;
    } catch {
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
    setSystemContext(normalizeCoreLegalContext(data));
    // El adaptador conserva `path` / `workspace_id` como autoridad del destino.
    return normalizeCoreLegalContext(data);
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
      // FASE 3D: tras una recarga (F5) el Bridge NO se habia consultado, por lo
      // que `accessContext` quedaba null y el router de entrada caia a la
      // regla previa aunque la identidad existiera. Se rehidrata igual que
      // `systemContext`. Un fallo aqui NO cierra la sesión: solo deja el
      // contexto en null y el router usa su fallback seguro.
      try {
        const access = await getAccessContext(token);
        if (active) setAccessContext(access);
      } catch {
        if (active) setAccessContext(null);
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

    // FASE 3B / FIX LOGIN: tras autenticar se consulta el Identity Core y el
    // Access Bridge. Un fallo en CUALQUIERA de los dos NO invalida la sesión:
    // el login ya es valido (el token se guardo y `fetchMe` lo confirmo) y el
    // usuario simplemente aterriza en su pagina de inicio.
    //
    // El bloque anterior hacia justo lo contrario: el `catch` envolvia a ambos y
    // borraba `pcl_token` + `pcl_user`, devolviendo al usuario a "no
    // autenticado" con el error "No se pudo resolver el contexto del sistema".
    // Eso rompia el login contra cualquier backend sin el Identity Core
    // desplegado (p. ej. `/api/auth/system-context` -> 404) y contradecía el
    // comentario que documentaba la intencion correcta.
    let context = null;
    try {
      context = await fetchSystemContext(nextToken);
    } catch {
      context = null;
    }

    let access = null;
    try {
      access = await getAccessContext(nextToken);
    } catch {
      access = null;
    }

    setSystemContext(context);
    setAccessContext(access);
    setToken(nextToken);
    setUser(verifiedUser);
    return { ...verifiedUser, systemContext: context, accessContext: access };
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(false);
    setSystemContext(null);
    setAccessContext(null);
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
    <AuthContext.Provider value={{ user, token, systemContext, accessContext, login, logout, fetchMe, fetchSystemContext, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
