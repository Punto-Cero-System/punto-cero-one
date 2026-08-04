/**
 * ExternalSourcesSection — surfaces the Content Sources System per page.
 *
 * Used by JobsPage / EventsPage / VideosPage / etc. to guarantee the
 * section is never empty even when the internal collection is small.
 * Fetches /api/content-sources/by-type/{type} (or /videos or /ai-tools)
 * and renders each item with the right card.
 */
import React, { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { contentSourcesService } from '../../services/feedService';
import ContentCard from './cards/ContentCard';

const NAVY = '#0B1F3A';

const ExternalSourcesSection = ({ type, title, subtitle, limit = 12, testid }) => {
  const [items, setItems] = useState([]);
  const [region, setRegion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let data;
        if (type === 'videos') {
          data = await contentSourcesService.videos({ limit });
        } else if (type === 'ai_tools') {
          data = await contentSourcesService.aiTools();
          data = { items: (data.items || []).slice(0, limit) };
        } else {
          data = await contentSourcesService.byType(type, { limit });
        }
        if (cancelled) return;
        setItems(data.items || []);
        setRegion(data.resolved_country_label || null);
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [type, limit]);

  if (!loading && items.length === 0) return null;

  return (
    <section data-testid={testid || `external-sources-${type}`}
      style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '0.28rem 0.65rem', borderRadius: 100,
          background: 'rgba(11,31,58,0.06)', color: NAVY,
          fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.16em',
        }}>
          <Compass size={11} /> RECURSOS EXTERNOS
        </span>
        {region && (
          <span style={{
            padding: '0.28rem 0.6rem', borderRadius: 100,
            background: 'rgba(0,200,150,0.09)', color: '#00825E',
            fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em',
            border: '1px solid rgba(0,200,150,0.22)',
          }}>{region.toUpperCase()}</span>
        )}
      </header>
      {title && (
        <div>
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif', margin: 0,
            fontSize: '1.15rem', fontWeight: 700, color: NAVY, letterSpacing: '-0.01em',
          }}>{title}</h2>
          {subtitle && <div style={{ fontSize: '0.85rem', color: 'rgba(11,31,58,0.65)' }}>{subtitle}</div>}
        </div>
      )}
      <div style={{
        display: 'grid', gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}>
        {items.map((it, idx) => <ContentCard key={`${it.kind}-${it.id || idx}`} item={it} />)}
      </div>
    </section>
  );
};

export default ExternalSourcesSection;
