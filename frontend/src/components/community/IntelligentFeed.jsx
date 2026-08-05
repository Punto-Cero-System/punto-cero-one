/**
 * IntelligentFeed — Wave 12 heart of Punto Cero One.
 *
 * Renders the mixed feed from /api/content-sources/mixed-feed using the
 * type-specific card components (NewsCard, JobCard, EventCard, ...).
 * Each item dispatches to the right component via <ContentCard />.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Loader, RefreshCw, MapPin, Sparkles } from 'lucide-react';
import { contentSourcesService } from '../../services/feedService';
import ContentCard from './cards/ContentCard';

const NAVY = '#0B1F3A';

const IntelligentFeed = ({ limit = 30, country }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ resolved_country_label: null, distribution: {} });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await contentSourcesService.mixedFeed({ limit, country });
      setItems(data.items || []);
      setMeta({
        resolved_country_label: data.resolved_country_label,
        distribution: data.distribution || {},
        pool_sizes: data.pool_sizes || {},
      });
    } catch (e) {
      setError(e.message || 'No se pudo cargar el feed');
    } finally {
      setLoading(false);
    }
  }, [limit, country]);

  useEffect(() => { load(); }, [load]);

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
        <button data-testid="intelligent-feed-refresh" onClick={load}
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

      {error && (
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
