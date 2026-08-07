/**
 * useCommunityStats — polling hook for /api/community/stats.
 *
 * Reused by ProfileCardWidget (Mi Espacio) and WelcomeModal. Refreshes at
 * `intervalMs` (default 45 s), plus a forced refetch when the tab regains
 * focus.
 *
 * Optimizations (Fase de Optimización):
 *  - Module-level cache: same-tab consumers share the last successful
 *    response and any in-flight request → no duplicated calls when
 *    multiple components mount within a few seconds (StrictMode, remounts,
 *    concurrent widgets).
 *  - Polling pauses on `visibilitychange:hidden` and resumes on visible.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const CACHE_TTL_MS = 20_000;

// Shared across hook instances in the same tab.
let cache = { at: 0, data: null };
let inflight = null;

const fetchOnce = async () => {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch(`${BACKEND}/api/community/stats`, { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      cache = { at: Date.now(), data };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

export const formatCount = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES').format(n);
};

export default function useCommunityStats(intervalMs = 45000) {
  const [stats, setStats] = useState(cache.data);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      const data = await fetchOnce();
      if (mountedRef.current) { setStats(data); setError(null); }
    } catch (e) {
      if (mountedRef.current) setError(e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStats();
    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(fetchStats, intervalMs);
    };
    const stop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    start();
    const onVis = () => {
      if (document.visibilityState === 'visible') { fetchStats(); start(); } else { stop(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mountedRef.current = false;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchStats, intervalMs]);

  return { stats, error, refetch: fetchStats };
}
