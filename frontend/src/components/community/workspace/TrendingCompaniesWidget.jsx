/**
 * TrendingCompaniesWidget — Empresas activas en las últimas 48h.
 *
 * Ranking calculado por el backend a partir de:
 *   • menciones en growth_items (RSS, videos, repos, jobs auto-taggeados)
 *   • posts sociales que las citen por hashtag/slug
 *   • seguidores actuales
 *
 * Reutiliza el shell `RightCard` + `FollowButton` que ya existen. Cero
 * componentes nuevos.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { RightCard } from './rightBlocks';
import { discoveryService } from '../../../services/platformService';
import FollowButton from '../FollowButton';

const NAVY = '#0B1F3A';

const TrendingCompaniesWidget = () => {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    discoveryService.trending(6, 48)
      .then((d) => { if (!cancelled) setItems(d?.items || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <RightCard title="Empresas trending" icon="companies" testid="workspace-widget-trending-companies">
      <div style={{ fontSize: '0.64rem', color: 'rgba(11,31,58,0.55)',
        marginBottom: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Flame size={11} color="#F59E0B" /> Las 48 horas más activas del ecosistema
      </div>
      {items.map((c, i) => (
        <div key={c.slug} data-testid={`trending-company-${c.slug}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.55rem',
            padding: '0.5rem 0.1rem',
            borderTop: '1px solid rgba(11,31,58,0.05)',
          }}>
          <span style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.4)',
            fontWeight: 800, width: 16 }}>{String(i + 1).padStart(2, '0')}</span>
          <Link to={`/empresas/${c.slug}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.55rem',
            flex: 1, minWidth: 0, textDecoration: 'none', color: NAVY,
          }}>
            {c.logo_url ? (
              <img src={c.logo_url} alt="" referrerPolicy="no-referrer" loading="lazy"
                onError={(ev) => {
                  const fb = ev.currentTarget.nextSibling;
                  ev.currentTarget.style.display = 'none';
                  if (fb) fb.style.display = 'flex';
                }}
                style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', background: '#F0F2F7', flexShrink: 0 }} />
            ) : null}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #0B1F3A, #F59E0B)',
              color: '#FFFFFF', display: c.logo_url ? 'none' : 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.7rem',
            }}>{(c.name || '?').charAt(0)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NAVY,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(11,31,58,0.55)' }}>
                {c.mentions_recent > 0 && `${c.mentions_recent} menciones`}
                {c.followers > 0 && ` · ${c.followers} seguidores`}
              </div>
            </div>
          </Link>
          <FollowButton entityType="company" entityId={c.id || c.slug} size="sm" />
        </div>
      ))}
    </RightCard>
  );
};

export default TrendingCompaniesWidget;
