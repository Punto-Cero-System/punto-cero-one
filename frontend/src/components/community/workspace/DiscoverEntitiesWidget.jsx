/**
 * DiscoverEntitiesWidget — surfaces `GET /api/discovery/suggested` in Mi
 * Espacio. Reuses the RightCard shell and the existing FollowButton so
 * users can follow any suggested entity in one click. NO new pages.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { RightCard } from './rightBlocks';
import { discoveryService } from '../../../services/platformService';
import FollowButton from '../FollowButton';

const NAVY = '#0B1F3A';

const DiscoverEntitiesWidget = () => {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    discoveryService.suggested(6)
      .then((d) => { if (!cancelled) setItems(d?.items || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <RightCard title="Descubre entidades" icon="companies" testid="workspace-widget-discover-entities">
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)',
        marginBottom: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Sparkles size={11} /> Sigue una y aparecerán en tu Feed automáticamente
      </div>
      {items.map((e) => (
        <div key={e.id || e.slug} data-testid={`discover-entity-${e.slug}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.55rem',
            padding: '0.55rem 0.1rem',
            borderTop: '1px solid rgba(11,31,58,0.05)',
          }}>
          <Link to={`/empresas/${e.slug}`} style={{
            display: 'flex', alignItems: 'center', gap: '0.55rem',
            flex: 1, minWidth: 0, textDecoration: 'none', color: NAVY,
          }}>
            {e.logo_url ? (
              <img src={e.logo_url} alt="" referrerPolicy="no-referrer" loading="lazy"
                onError={(ev) => {
                  const fb = ev.currentTarget.nextSibling;
                  ev.currentTarget.style.display = 'none';
                  if (fb) fb.style.display = 'flex';
                }}
                style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', background: '#F0F2F7', flexShrink: 0 }} />
            ) : null}
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)',
              color: '#FFFFFF', display: e.logo_url ? 'none' : 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.72rem',
            }}>{(e.name || 'M').charAt(0)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
              <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.tagline || e.vertical}
              </div>
            </div>
          </Link>
          <FollowButton entityType="company" entityId={e.id} size="sm" />
        </div>
      ))}
    </RightCard>
  );
};

export default DiscoverEntitiesWidget;
