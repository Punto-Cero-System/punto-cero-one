/**
 * IntelligentFeed — Wave 12 SOCIAL-FIRST feed with infinite scroll.
 *
 * - Consumes /api/content-sources/mixed-feed with `offset` pagination.
 * - IntersectionObserver sentinel triggers next page as user scrolls.
 * - Preserves scroll position + loaded items in sessionStorage so
 *   returning from another page keeps the reader's spot (LinkedIn-style).
 * - Lazy-loads images inside cards (loading="lazy" on <img>).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader, RefreshCw, MapPin, Sparkles } from 'lucide-react';
import { contentSourcesService } from '../../services/feedService';
import ContentCard from './cards/ContentCard';

const NAVY = '#0B1F3A';
const PAGE_SIZE = 15;
const CACHE_KEY = 'pc_intelligent_feed_cache_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - (parsed.ts || 0) > CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
};

const writeCache = (payload) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
  } catch { /* ignore quota */ }
};

const clearCache = () => {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
};

const IntelligentFeed = ({ limit = PAGE_SIZE, country }) => {
  const cached = readCache();
  const [items, setItems] = useState(cached?.items || []);
  const [offset, setOffset] = useState(cached?.next_offset || 0);
  const [hasMore, setHasMore] = useState(cached ? cached.next_offset != null : true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({
    resolved_country_label: cached?.resolved_country_label || null,
    distribution: cached?.distribution || {},
  });
  const inflight = useRef(false);
  const sentinelRef = useRef(null);
  const hasMoreRef = useRef(hasMore);
  const offsetRef = useRef(offset);

  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  const loadPage = useCallback(async (nextOffset, replace = false) => {
    if (inflight.current) return;
    if (!replace && !hasMoreRef.current) return;
    inflight.current = true;
    setLoading(true);
    setError('');
    try {
      const data = await contentSourcesService.mixedFeed({ limit, offset: nextOffset, country });
      const incoming = data.items || [];
      setItems((prev) => {
        if (replace) return incoming;
        // Dedupe by kind+id to avoid duplicates across pages
        const seen = new Set(prev.map((p) => `${p.kind}:${p.id}`));
        const merged = [...prev, ...incoming.filter((p) => !seen.has(`${p.kind}:${p.id}`))];
        return merged;
      });
      const newOffset = data.next_offset;
      offsetRef.current = newOffset || 0;
      setOffset(newOffset || 0);
      hasMoreRef.current = newOffset != null;
      setHasMore(newOffset != null);
      setMeta({
        resolved_country_label: data.resolved_country_label,
        distribution: data.distribution || {},
      });
    } catch (e) {
      setError(e.message || 'No se pudo cargar el feed');
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [limit, country]);

  // Initial load — only fetch if there's no valid cache
  useEffect(() => {
    if (items.length === 0) {
      loadPage(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to sessionStorage whenever items change (debounced via effect)
  useEffect(() => {
    if (items.length === 0) return;
    writeCache({
      items,
      next_offset: hasMore ? offset : null,
      resolved_country_label: meta.resolved_country_label,
      distribution: meta.distribution,
    });
  }, [items, offset, hasMore, meta.distribution, meta.resolved_country_label]);

  // Restore scroll position on mount if we came back with a cache
  useEffect(() => {
    if (cached?.scrollY != null && items.length > 0) {
      // wait a beat for layout to settle
      const t = setTimeout(() => window.scrollTo({ top: cached.scrollY, behavior: 'instant' in window ? 'instant' : 'auto' }), 30);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save scrollY on unmount / route change
  useEffect(() => {
    const save = () => {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        p.scrollY = window.scrollY;
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(p));
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', save);
    return () => {
      save();
      window.removeEventListener('beforeunload', save);
    };
  }, []);

  // IntersectionObserver — trigger next page when sentinel is near
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreRef.current && !inflight.current) {
        loadPage(offsetRef.current);
      }
    }, { rootMargin: '600px 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [loadPage]);

  const refresh = () => {
    clearCache();
    setItems([]);
    setOffset(0);
    setHasMore(true);
    hasMoreRef.current = true;
    offsetRef.current = 0;
    loadPage(0, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div data-testid="intelligent-feed" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
        <span data-testid="intelligent-feed-badge" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '0.32rem 0.7rem', borderRadius: 100,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(34,211,238,0.15))',
          color: '#5B21B6', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.16em',
        }}>
          <Sparkles size={11} /> FEED INTELIGENTE
        </span>
        {meta.resolved_country_label && (
          <span data-testid="intelligent-feed-region" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '0.3rem 0.6rem', borderRadius: 100,
            background: 'rgba(0,200,150,0.09)', color: '#00825E',
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
            border: '1px solid rgba(0,200,150,0.2)',
          }}>
            <MapPin size={11} /> {meta.resolved_country_label.toUpperCase()}
          </span>
        )}
        <button data-testid="intelligent-feed-refresh" onClick={refresh}
          disabled={loading}
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '0.35rem 0.65rem', borderRadius: 100,
            background: 'transparent', border: '1px solid rgba(11,31,58,0.12)',
            color: NAVY, fontSize: '0.7rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
          }}>
          <RefreshCw size={11} className={loading ? 'pc-spin' : ''} /> Actualizar
        </button>
        <style>{`.pc-spin { animation: pcSpin 1s linear infinite; } @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {loading && items.length === 0 && (
        <div data-testid="intelligent-feed-loading" style={{
          padding: '2rem 1.5rem', textAlign: 'center',
          background: '#FFFFFF', borderRadius: 16,
          border: '1px dashed rgba(11,31,58,0.12)',
        }}>
          <Loader size={16} className="pc-spin" style={{ marginRight: 8 }} />
          Componiendo tu feed personalizado…
        </div>
      )}

      {error && items.length === 0 && (
        <div data-testid="intelligent-feed-error" style={{
          padding: '0.9rem 1rem', borderRadius: 12,
          background: 'rgba(255,90,90,0.08)', color: '#B91C1C',
          border: '1px solid rgba(255,90,90,0.25)', fontSize: '0.85rem',
        }}>{error}</div>
      )}

      {items.length > 0 && (
        <div data-testid="intelligent-feed-grid" style={{
          display: 'flex', flexDirection: 'column', gap: '0.85rem',
        }}>
          {items.map((it, idx) => {
            const layout = it.layout || 'medium';
            return (
              <div key={`${it.kind}-${it.id || idx}`}
                data-testid={`feed-slot-${layout}-${idx}`}
                data-layout={layout}
                data-kind={it.kind}>
                <ContentCard item={it} layout={layout} />
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite-scroll sentinel + loader */}
      {hasMore && (
        <div ref={sentinelRef} data-testid="intelligent-feed-sentinel"
          style={{
            padding: '1.2rem', textAlign: 'center',
            color: 'rgba(11,31,58,0.5)', fontSize: '0.8rem',
          }}>
          {loading && items.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Loader size={14} className="pc-spin" /> Cargando más contenido…
            </span>
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div data-testid="intelligent-feed-end" style={{
          padding: '1.2rem', textAlign: 'center',
          color: 'rgba(11,31,58,0.4)', fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>· Has llegado al final del feed ·</div>
      )}

      {!loading && items.length === 0 && !error && (
        <div style={{
          padding: '2rem 1.5rem', textAlign: 'center', borderRadius: 16,
          background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)',
          color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem',
        }}>
          Aún no hay contenido para tu región. Volvé a intentarlo en unos minutos.
        </div>
      )}
    </div>
  );
};

export default IntelligentFeed;
