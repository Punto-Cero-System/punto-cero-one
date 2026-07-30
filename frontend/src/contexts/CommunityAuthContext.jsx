import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/authService';

/**
 * CommunityAuthContext — cookie-based social auth for regular community members.
 * Coexists with the existing admin JWT `AuthContext` (used for /admin only).
 *
 * States:
 *   user === undefined  → still loading
 *   user === null       → not authenticated
 *   user === {...}      → authenticated
 */
const CommunityAuthContext = createContext(null);

export const CommunityAuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(async () => {
    try {
      const data = await authService.me();
      setUser(data || null);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // CRITICAL: if we're returning from OAuth callback, skip the /me check —
    // AuthCallback will exchange the session_id and establish the session first.
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      return;
    }
    refresh();
  }, [refresh]);

  const setUserFromCallback = (u) => setUser(u);

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <CommunityAuthContext.Provider value={{ user, refresh, setUserFromCallback, logout }}>
      {children}
    </CommunityAuthContext.Provider>
  );
};

export const useCommunityAuth = () => {
  const ctx = useContext(CommunityAuthContext);
  if (!ctx) throw new Error('useCommunityAuth must be used within CommunityAuthProvider');
  return ctx;
};
