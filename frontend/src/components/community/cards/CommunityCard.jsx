import React from 'react';
import { Users, Clock } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#059669';

const HeroBand = ({ accent }) => (
  <div style={{
    position: 'relative', height: 80,
    background: `linear-gradient(135deg, ${accent} 0%, #047857 50%, #064E3B 100%)`,
  }}>
    <div aria-hidden style={{
      position: 'absolute', top: -20, right: -20, width: 100, height: 100,
      borderRadius: '50%', border: `2px dashed rgba(255,255,255,0.14)`,
    }} />
  </div>
);

const Avatar = ({ src, name, accent }) => (
  <div style={{
    width: 46, height: 46, borderRadius: '50%',
    background: '#FFFFFF', border: '3px solid #FFFFFF',
    marginTop: -28, marginBottom: 4,
    boxShadow: '0 6px 18px rgba(11,31,58,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  }}>
    {src ? (
      <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <span style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 800, fontSize: '1.05rem', color: accent,
      }}>{(name || '·').charAt(0).toUpperCase()}</span>
    )}
  </div>
);

const CommunityCard = ({ item }) => {
  const meta = item.metadata || {};
  const members = meta.meta?.members_count;
  const lastActivity = meta.meta?.last_activity;

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Comunidad"
      badgeIcon={Users}
      testid={`card-community-${item.id}`}
      media={<HeroBand accent={ACCENT} />}
      header={<Avatar src={item.image} name={item.title} accent={ACCENT} />}
      title={item.title}
      description={item.description}
      meta={
        <>
          {item.category && (
            <span style={{
              padding: '1px 7px', borderRadius: 6,
              background: 'rgba(5,150,105,0.12)', color: '#065F46',
              fontSize: '0.6rem', fontWeight: 700,
            }}>{item.category}</span>
          )}
          {item.country && <CardMeta>{item.country}</CardMeta>}
          {members > 0 && <CardMeta><Users size={11} /> {members.toLocaleString('es')} miembros</CardMeta>}
          {lastActivity && <CardMeta><Clock size={11} /> {lastActivity}</CardMeta>}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Unirse" color={ACCENT}
          testid={`card-community-open-${item.id}`} />
      }
    />
  );
};

export default CommunityCard;
