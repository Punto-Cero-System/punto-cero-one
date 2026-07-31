import React, { useEffect, useState } from 'react';
import { RightCard } from './rightBlocks';
import PresenceDot from '../PresenceDot';
import { useRealtime } from '../../../contexts/RealtimeContext';

const NAVY = '#0B1F3A';

const SuggestedPeopleWidget = () => {
  const [people, setPeople] = useState(null);
  const { subscribe } = useRealtime();

  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/feed/posts?limit=15`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (cancelled) return;
        const seen = new Set();
        const out = [];
        for (const p of (d.items || [])) {
          const a = p.author;
          if (!a?.id || seen.has(a.id)) continue;
          seen.add(a.id);
          out.push({ id: a.id, name: a.name, headline: a.headline || 'Miembro', picture: a.picture });
          if (out.length >= 5) break;
        }
        setPeople(out);
      })
      .catch(() => setPeople([]));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => subscribe('notification', () => { /* triggers presence refresh */ }), [subscribe]);

  if (!people || people.length === 0) return null;
  return (
    <RightCard title="Personas sugeridas" icon="community" testid="workspace-widget-suggested-people">
      {people.map((u) => (
        <div key={u.id} data-testid={`suggested-person-${u.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.65rem',
            padding: '0.55rem 0.85rem', borderTop: '1px solid rgba(11,31,58,0.05)',
          }}>
          <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
            {u.picture ? (
              <img src={u.picture} alt={u.name} referrerPolicy="no-referrer"
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.85rem',
              }}>{(u.name || 'M').charAt(0).toUpperCase()}</div>
            )}
            <PresenceDot userId={u.id} size={9} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.name}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.headline}
            </div>
          </div>
          <button style={{
            padding: '0.3rem 0.65rem', borderRadius: 100,
            background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.4)',
            color: '#00A277', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
          }}>+ Seguir</button>
        </div>
      ))}
    </RightCard>
  );
};
export default SuggestedPeopleWidget;
