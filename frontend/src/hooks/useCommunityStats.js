/**
 * useCommunityStats — polling hook for /api/community/stats.
 *
 * Reused by ProfileCardWidget (Mi Espacio) and WelcomeModal. Refresh every
 * 45 s by default, plus a forced refetch when the tab regains focus and
 * when `bump()` is called (e.g. right after registration).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const formatCount = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  // Follows the spec: 1, 25, 156, 1.240, 12.548
  return new Intl.NumberFormat('es-ES').format(n);
};

export default function useCommunityStats(intervalMs = 45000) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/community/stats`, { credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
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
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchStats, intervalMs]);

  return { stats, error, refetch: fetchStats };
}
