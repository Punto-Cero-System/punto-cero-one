/**
 * RealtimeContext — Server-Sent Events wrapper.
 *
 * Public API (via useRealtime()):
 *   status:       'idle' | 'connecting' | 'open' | 'closed'
 *   presenceOf:   (userIds: string[]) => Promise<{ [id]: { status, last_seen } }>
 *   subscribe:    (eventType, handler) => unsubscribe fn
 *
 * Design
 * ------
 * - One EventSource per authenticated tab. If the user logs out we tear it down.
 * - Exponential backoff (max 30s) on error/close so we never storm the server.
 * - Consumers register per-eventType handlers; the context does not own state.
 *   This keeps the context tiny and future-proof: any new event kind (feed,
 *   presence, custom) is just another `subscribe('feed', fn)` call somewhere.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useCommunityAuth } from './CommunityAuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const RealtimeContext = createContext(null);

export const RealtimeProvider = ({ children }) => {
  const { user } = useCommunityAuth();
  const [status, setStatus] = useState('idle');
  const esRef = useRef(null);
  const handlersRef = useRef(new Map());   // eventType -> Set<handler>
  const backoffRef = useRef(1000);         // ms, exponential
  const retryTimerRef = useRef(null);
  const teardownRef = useRef(null);

  const dispatch = useCallback((eventType, payload) => {
    const set = handlersRef.current.get(eventType);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(payload); } catch (e) { /* silent per-handler */ }
    });
  }, []);

  const connect = useCallback(() => {
    if (!user?.id) return;
    if (esRef.current) return;               // already connected

    setStatus('connecting');
    const url = `${API}/api/realtime/stream`;
    // withCredentials tells the browser to send the session_token cookie.
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    const bindNamedEvent = (name) => {
      es.addEventListener(name, (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          dispatch(name, parsed?.data || parsed);
        } catch { /* noop */ }
      });
    };

    ['system.hello', 'notification', 'message', 'feed', 'presence'].forEach(bindNamedEvent);

    es.onopen = () => {
      backoffRef.current = 1000;
      setStatus('open');
    };
    es.onerror = () => {
      setStatus('closed');
      try { es.close(); } catch { /* noop */ }
      esRef.current = null;
      // reconnect with backoff
      const wait = Math.min(backoffRef.current, 30_000);
      backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(connect, wait);
    };
  }, [user?.id, dispatch]);

  useEffect(() => {
    // Whenever user changes: rebuild the stream.
    if (teardownRef.current) teardownRef.current();

    teardownRef.current = () => {
      clearTimeout(retryTimerRef.current);
      if (esRef.current) {
        try { esRef.current.close(); } catch { /* noop */ }
        esRef.current = null;
      }
      setStatus('idle');
    };

    if (user?.id) {
      connect();
    } else {
      teardownRef.current();
    }

    return () => { if (teardownRef.current) teardownRef.current(); };
  }, [user?.id, connect]);

  const subscribe = useCallback((eventType, handler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType).add(handler);
    return () => {
      const set = handlersRef.current.get(eventType);
      if (set) set.delete(handler);
    };
  }, []);

  const presenceOf = useCallback(async (userIds = []) => {
    if (!userIds.length) return {};
    try {
      const res = await fetch(`${API}/api/realtime/presence?ids=${encodeURIComponent(userIds.join(','))}`, {
        credentials: 'include',
      });
      if (!res.ok) return {};
      const data = await res.json();
      return data.presence || {};
    } catch { return {}; }
  }, []);

  const value = useMemo(() => ({ status, subscribe, presenceOf }), [status, subscribe, presenceOf]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    // Safe fallback: if the provider is missing (e.g., in isolated tests), return no-op API.
    return {
      status: 'idle',
      subscribe: () => () => {},
      presenceOf: async () => ({}),
    };
  }
  return ctx;
};
